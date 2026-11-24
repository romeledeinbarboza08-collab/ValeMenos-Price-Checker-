// Historial de precios en Netlify Blobs (almacén clave-valor incluido en Netlify).
// Se guarda POR TIENDA para que dos tiendas respondiendo al mismo tiempo nunca
// sobrescriban el historial de la otra:
//   clave del blob: "walmart/apple|17-iphone-max-pro|256gb"
//   valor:          { titulo, puntos: [{ t: "2026-10-29T18:00:00Z", p: 680022 }, ...] }

const MAX_PUNTOS = 400;            // ~100 días con una foto cada 6 horas
const CADA_CUANTO = 3 * 3600_000;  // no más de un punto cada 3 horas por oferta

async function almacen() {
  // Import dinámico: fuera de Netlify (pruebas locales) simplemente no hay historial.
  const { getStore } = await import('@netlify/blobs');
  return getStore({ name: 'historial', consistency: 'eventual' });
}

export const llaveHistorial = (tienda, clave) => `${tienda}/${encodeURIComponent(clave)}`.slice(0, 500);

export async function leerHistorial(llaves) {
  try {
    const store = await almacen();
    const pares = await Promise.all(llaves.map(async (k) => [k, (await store.get(k, { type: 'json' }))?.puntos || []]));
    return Object.fromEntries(pares);
  } catch {
    return Object.fromEntries(llaves.map((k) => [k, []]));
  }
}

// ofertas: las de UNA tienda, ya con `clave`.
export async function registrarOfertas(ofertas) {
  let store;
  try { store = await almacen(); } catch { return 0; }

  // Si la tienda tiene varios colores del mismo producto, guardamos el más barato.
  const porClave = new Map();
  for (const o of ofertas) {
    if (!o.disponible || !o.clave) continue;
    const previa = porClave.get(o.clave);
    if (!previa || o.precio < previa.precio) porClave.set(o.clave, o);
  }

  const ahora = Date.now();
  let guardados = 0;
  await Promise.all([...porClave.values()].slice(0, 30).map(async (o) => {
    try {
      const k = llaveHistorial(o.tienda, o.clave);
      const actual = (await store.get(k, { type: 'json' })) || { titulo: o.titulo, puntos: [] };
      const ultimo = actual.puntos.at(-1);
      if (ultimo && ahora - Date.parse(ultimo.t) < CADA_CUANTO) return;
      actual.titulo = o.titulo;
      actual.puntos.push({ t: new Date(ahora).toISOString(), p: o.precio });
      if (actual.puntos.length > MAX_PUNTOS) actual.puntos = actual.puntos.slice(-MAX_PUNTOS);
      await store.setJSON(k, actual);
      guardados++;
    } catch { /* si un producto falla, los demás siguen */ }
  }));
  return guardados;
}
