// Búsqueda en vivo en las tiendas.
// - buscarEnTienda(): consulta UNA tienda. El navegador la llama una vez por tienda para
//   ir mostrando resultados conforme cada tienda responde.
// - buscarEnTiendas(): consulta todas y agrupa (la usan la foto programada y el script de prueba).

import { crearConectorVtex } from './tiendas/vtex.js';
import { mexpress } from './tiendas/mexpress.js';
import { icon } from './tiendas/icon.js';
import { crearConectorWoo } from './tiendas/woocommerce.js';
import { crearConectorSitemap } from './tiendas/sitemap.js';
import { obtenerTipoCambio } from './tipo-cambio.js';
import { relevancia, claveOferta, resumirGrupos } from '../../public/js/core/emparejamiento.js';

// Tiendas sin buscador público: se busca en su sitemap con un índice invertido.
export const SITEMAPS = {
  gollo: {
    id: 'gollo',
    sitemap: 'https://www.gollo.com/media/sitemap/sitemap_gollo_cr_sitemap_products_gollo_cr.xml',
    filtro: (u) => /\/p$/.test(u),
  },
  monge: {
    id: 'monge',
    sitemap: 'https://www.tiendamonge.com/media/sitemap_tienda_monge_cr.xml',
    filtro: (u) => /-\d{5,}$/.test(u),
  },
};

export const CONECTORES = {
  walmart: crearConectorVtex({ id: 'walmart', base: 'https://www.walmart.co.cr' }),
  maxipali: crearConectorVtex({ id: 'maxipali', base: 'https://www.maxipali.co.cr', maxResultados: 16 }),
  siman: crearConectorVtex({ id: 'siman', base: 'https://cr.siman.com' }),
  gollo: crearConectorSitemap(SITEMAPS.gollo),
  monge: crearConectorSitemap(SITEMAPS.monge),
  intelec: crearConectorWoo({ id: 'intelec', base: 'https://www.intelec.co.cr' }),
  mexpress,
  icon,
};

const UMBRAL_RELEVANCIA = 0.6;

// Una consulta de solo dígitos (8 a 14) es un código de barras que nadie supo nombrar.
// Ahí el filtro de relevancia no sirve: ningún título contiene el número y se descartaría todo.
export const esCodigo = (consulta) => /^\d{8,14}$/.test(String(consulta).trim());

// Compara códigos sin los ceros de la izquierda: un UPC de 12 dígitos ("012345678905")
// es el mismo producto que su EAN-13 ("0012345678905").
const mismoCodigo = (a, b) => String(a).replace(/^0+/, '') === String(b).replace(/^0+/, '');

// Con un código: si la tienda manda el EAN de cada producto (VTEX lo trae en item.ean),
// solo se quedan los que coinciden exactamente y se marcan como coincidencia exacta.
// Si la tienda no manda EAN en ningún producto, no hay con qué comparar y se deja lo que devolvió.
export function filtrarPorCodigo(ofertas, codigo) {
  const tiendaTraeEan = ofertas.some((o) => o.ean);
  if (tiendaTraeEan) {
    return ofertas
      .filter((o) => o.ean && mismoCodigo(o.ean, codigo))
      .map((o) => ({ ...o, relevancia: 1, coincidenciaExacta: true }));
  }
  return ofertas.map((o) => ({ ...o, relevancia: 0.5, coincidenciaExacta: false }));
}

export async function buscarEnTienda(id, consulta, tipoCambio) {
  const conector = CONECTORES[id];
  const t0 = Date.now();
  // El tipo de cambio se pide en paralelo con la tienda, no después.
  const tipoCambioListo = tipoCambio ? Promise.resolve(tipoCambio) : obtenerTipoCambio();
  try {
    const crudas = await conector.buscar(consulta);
    const tasa = (await tipoCambioListo).venta;
    const enColones = crudas
      .map((o) => (o.moneda === 'USD'
        ? { ...o, precioOriginal: o.precio, precio: Math.round(o.precio * tasa), precioLista: o.precioLista ? Math.round(o.precioLista * tasa) : null }
        : o));
    const filtradas = esCodigo(consulta)
      ? filtrarPorCodigo(enColones, consulta) // código de barras: se compara el EAN, no el título
      : enColones
        .map((o) => ({ ...o, relevancia: relevancia(consulta, o.titulo) }))
        .filter((o) => o.relevancia >= UMBRAL_RELEVANCIA);
    const ofertas = filtradas.map((o) => ({ ...o, clave: claveOferta(o) }));
    return { id, ok: true, ms: Date.now() - t0, encontradas: crudas.length, ofertas, error: null };
  } catch (e) {
    // 401/403: la tienda está bloqueando consultas automáticas. No intentamos saltarlo:
    // se marca como "no disponible" (gris) y no cuenta como falla.
    const noDisponible = /HTTP 40[13]\b/.test(e?.message || '');
    return { id, ok: false, noDisponible, ms: Date.now() - t0, encontradas: 0, ofertas: [], error: noDisponible ? 'La tienda no está aceptando consultas por ahora' : mensajeError(e) };
  }
}

export async function buscarEnTiendas(consulta) {
  const inicio = Date.now();
  const tipoCambio = await obtenerTipoCambio();
  const respuestas = await Promise.all(Object.keys(CONECTORES).map((id) => buscarEnTienda(id, consulta, tipoCambio)));
  const ofertas = respuestas.flatMap((r) => r.ofertas);
  return {
    consulta,
    generado: new Date().toISOString(),
    ms: Date.now() - inicio,
    tipoCambio,
    tiendas: respuestas.map(({ ofertas: lista, ...r }) => ({ ...r, relevantes: lista.length })),
    ofertas,
    grupos: resumirGrupos(ofertas, consulta),
  };
}

function mensajeError(e) {
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return 'La tienda tardó demasiado en responder';
  if (/HTTP 4\d\d/.test(e?.message)) return `La tienda rechazó la consulta (${e.message})`;
  if (/HTTP 5\d\d/.test(e?.message)) return `La tienda tuvo un error (${e.message})`;
  return 'No se pudo conectar con la tienda';
}
