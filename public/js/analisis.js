// Cálculos sobre un producto: precio total con envío, medidor "¿Vale la pena?",
// ahorro honesto y detector de descuentos inflados.
import { mediana, limiteInferior } from './core/estructuras.js';
import { precioTotal, esVoluminoso } from './core/tiendas.js';

export const llaveHistorial = (tienda, clave) => `${tienda}/${encodeURIComponent(clave)}`.slice(0, 500);

export function voluminosoDe(grupo) {
  return esVoluminoso(grupo.titulo, grupo.atributos?.pulgadas);
}

// Ofertas con su total, de la más barata a la más cara (las agotadas al final).
export function ofertasConTotal(grupo, ctx) {
  const voluminoso = voluminosoDe(grupo);
  return grupo.ofertas
    .map((o) => ({ ...o, ...precioTotal(o, { ...ctx, voluminoso }) }))
    .sort((a, b) => (b.disponible - a.disponible) || (a.total - b.total));
}

export function mejorOferta(grupo, ctx) {
  const lista = ofertasConTotal(grupo, ctx);
  return lista.find((o) => o.disponible) || lista[0];
}

const DIA = 86_400_000;

// Junta el historial de todas las tiendas en una serie diaria con el mínimo de cada día.
export function serieDiaria(historial) {
  const porDia = new Map();
  for (const puntos of Object.values(historial)) {
    for (const { t, p } of puntos) {
      const dia = t.slice(0, 10);
      if (!porDia.has(dia) || p < porDia.get(dia)) porDia.set(dia, p);
    }
  }
  return [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dia, p]) => ({ t: `${dia}T12:00:00Z`, p }));
}

// Medidor: compara el precio de hoy con la mediana de los últimos 30 días.
export function veredicto(precioHoy, serie) {
  const desde = Date.now() - 30 * DIA;
  // La serie viene ordenada por fecha: con búsqueda binaria encontramos dónde empieza la ventana.
  const inicio = limiteInferior(serie, desde, (x) => Date.parse(x.t));
  const ventana = serie.slice(inicio);
  const dias = ventana.length;
  if (dias < 3) {
    return { nivel: 'sin-datos', dias, texto: 'Todavía no hay historial suficiente', detalle: dias ? `Llevamos ${dias} ${dias === 1 ? 'día' : 'días'} registrando este producto. El medidor se activa con 3 días.` : 'Empezamos a registrar este producto con esta búsqueda. Volvé en unos días.' };
  }
  const tipico = mediana(ventana.map((x) => x.p));
  const minimo = Math.min(...ventana.map((x) => x.p));
  const diferencia = (precioHoy - tipico) / tipico;
  // Posición en la barra: de -12 % a +12 %, así cada tercio coincide con un veredicto (±4 %).
  const posicion = Math.min(1, Math.max(0, (diferencia + 0.12) / 0.24));
  let nivel = 'normal';
  if (diferencia <= -0.04) nivel = 'bueno';
  else if (diferencia >= 0.04) nivel = 'caro';
  const textos = { bueno: 'Buen momento para comprar', normal: 'Precio normal', caro: 'Está más caro de lo usual' };
  return { nivel, dias, tipico, minimo, diferencia, posicion, texto: textos[nivel] };
}

// Si la tienda anuncia "antes ₡X" pero en los últimos 30 días ya tuvo este precio o menos,
// el descuento no es real.
export function descuentoInflado(oferta, puntosTienda = []) {
  if (!oferta.precioLista || oferta.precioLista <= oferta.precio || puntosTienda.length < 2) return null;
  const desde = Date.now() - 30 * DIA;
  const anteriores = puntosTienda.filter((x) => Date.parse(x.t) >= desde && Date.now() - Date.parse(x.t) > DIA / 2);
  const masBarato = anteriores.reduce((m, x) => (!m || x.p < m.p ? x : m), null);
  if (masBarato && masBarato.p <= oferta.precio) return { fecha: masBarato.t, precio: masBarato.p };
  return null;
}
