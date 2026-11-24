// Comunicación con las funciones de Netlify.
import { CacheLRU } from './core/estructuras.js';
import { TIENDAS } from './core/tiendas.js';

const memoria = new CacheLRU(30);      // respuestas recientes por tienda (para ir y volver sin esperar)
const VIGENCIA = 2 * 60 * 1000;        // 2 minutos

// Consulta cada tienda por separado. `alRecibir` se llama apenas responde cada una,
// así la lista se va armando en pantalla mientras las demás siguen buscando.
export async function buscarEnVivo(consulta, { fresco = false, alRecibir = () => {}, senal } = {}) {
  const q = consulta.trim().replace(/\s+/g, ' ');
  const ids = Object.keys(TIENDAS);
  const marca = fresco ? `&fresco=${Date.now()}` : '';

  const tareas = ids.map(async (id) => {
    const clave = `${id}|${q.toLowerCase()}`;
    const guardado = !fresco && memoria.obtener(clave);
    if (guardado && Date.now() - guardado.hora < VIGENCIA) {
      alRecibir(guardado.datos);
      return guardado.datos;
    }
    const t0 = performance.now();
    let datos;
    try {
      const r = await fetch(`/api/buscar?q=${encodeURIComponent(q)}&tienda=${id}${marca}`, { signal: senal });
      datos = await r.json();
      if (!r.ok && !datos.id) throw new Error(datos.error || `HTTP ${r.status}`);
      datos.msTotal = Math.round(performance.now() - t0);
      if (datos.ok) memoria.guardar(clave, { datos, hora: Date.now() });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      datos = { id, ok: false, ofertas: [], ms: Math.round(performance.now() - t0), error: 'No hubo respuesta del servidor de Vale Menos' };
    }
    alRecibir(datos);
    return datos;
  });

  return Promise.all(tareas);
}

export async function obtenerTipoCambio() {
  try {
    const r = await fetch('/api/tipo-cambio');
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { venta: 455, compra: 450, fecha: null, respaldo: true, fuente: 'valor de respaldo' };
  }
}

export { llaveHistorial } from "./analisis.js";

// llaves: ["walmart/<clave>", ...]
export async function obtenerHistorial(llaves) {
  if (!llaves.length) return {};
  const qs = llaves.map((k) => `k=${encodeURIComponent(k)}`).join('&');
  try {
    const r = await fetch(`/api/historial?${qs}`);
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return {};
  }
}

// Las mayores diferencias de precio que encontró la última "foto de precios" (cada 6 horas).
export async function obtenerDestacados() {
  try {
    const r = await fetch('/api/destacados');
    if (!r.ok) throw new Error();
    return await r.json();
  } catch {
    return { generado: null, items: [] };
  }
}
