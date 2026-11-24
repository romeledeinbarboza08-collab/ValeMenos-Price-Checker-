// Optimizador "Mi compra"
// Problema: tengo N productos y cada uno se vende en varias tiendas. El envío se paga
// UNA vez por tienda (y en MExpress depende del subtotal), así que la combinación más
// barata no siempre es "cada producto donde esté más barato".
//
// Solución: árbol de decisión con backtracking y poda.
//   - Nivel k del árbol = decidir en qué tienda compro el producto k.
//   - Cota inferior = lo ya gastado + el precio mínimo de cada producto que falta.
//     Si esa cota ya es peor que la mejor solución encontrada, se poda la rama.
// Peor caso O(t^n), pero la poda descarta la mayoría de ramas; la lista se limita a 8.

import { TIENDAS } from './tiendas.js';

export const MAX_PRODUCTOS = 8;

// items: [{ clave, titulo, voluminoso, ofertas: [{ tienda, precio }] }]
export function optimizarCompra(items, { zona = 'gam', tasa = 455 } = {}) {
  const lista = items
    .map((it) => ({ ...it, ofertas: it.ofertas.filter((o) => o.disponible !== false && TIENDAS[o.tienda]) }))
    .filter((it) => it.ofertas.length);
  if (!lista.length) return null;

  // Ordenar las ofertas de cada producto de más barata a más cara ayuda a encontrar
  // pronto una buena solución, y con eso la poda corta más.
  lista.forEach((it) => it.ofertas.sort((a, b) => a.precio - b.precio));
  // Mínimo por producto y suma de mínimos de "lo que falta" (sufijos).
  const minimos = lista.map((it) => it.ofertas[0].precio);
  const faltante = new Array(lista.length + 1).fill(0);
  for (let k = lista.length - 1; k >= 0; k--) faltante[k] = faltante[k + 1] + minimos[k];

  const costoEnvios = (subtotales, voluminosos) => {
    let suma = 0;
    const detalle = {};
    for (const [tienda, subtotal] of subtotales) {
      const e = TIENDAS[tienda].envio({ subtotal, zona, tasa, voluminoso: voluminosos.get(tienda) > 0 });
      detalle[tienda] = e;
      suma += e.costo;
    }
    return { suma, detalle };
  };

  let mejor = { costo: Infinity, eleccion: null };
  let nodosVisitados = 0;
  let ramasPodadas = 0;
  const eleccion = new Array(lista.length);
  const subtotales = new Map();   // tienda -> subtotal
  const voluminosos = new Map();  // tienda -> cantidad de artículos grandes

  function explorar(k, gastado) {
    nodosVisitados++;
    if (k === lista.length) {
      const total = gastado + costoEnvios(subtotales, voluminosos).suma;
      if (total < mejor.costo) mejor = { costo: total, eleccion: [...eleccion] };
      return;
    }
    // Poda: aunque el envío fuera gratis, ¿podría esta rama ganar?
    if (gastado + faltante[k] >= mejor.costo) { ramasPodadas++; return; }

    for (const oferta of lista[k].ofertas) {
      eleccion[k] = oferta;
      subtotales.set(oferta.tienda, (subtotales.get(oferta.tienda) || 0) + oferta.precio);
      if (lista[k].voluminoso) voluminosos.set(oferta.tienda, (voluminosos.get(oferta.tienda) || 0) + 1);

      explorar(k + 1, gastado + oferta.precio);

      // Deshacer (esto es el "back" de backtracking)
      const s = subtotales.get(oferta.tienda) - oferta.precio;
      if (s === 0) subtotales.delete(oferta.tienda); else subtotales.set(oferta.tienda, s);
      if (lista[k].voluminoso) voluminosos.set(oferta.tienda, voluminosos.get(oferta.tienda) - 1);
    }
  }

  explorar(0, 0);

  // Plan "ingenuo" para comparar: cada producto donde esté más barato.
  const ingenuo = calcularPlan(lista, lista.map((it) => it.ofertas[0]), { zona, tasa, costoEnvios });
  const optimo = calcularPlan(lista, mejor.eleccion, { zona, tasa, costoEnvios });

  return {
    optimo,
    ingenuo,
    ahorro: ingenuo.total - optimo.total,
    combinacionesPosibles: lista.reduce((p, it) => p * it.ofertas.length, 1),
    nodosVisitados,
    ramasPodadas,
  };
}

function calcularPlan(lista, elegidas, { costoEnvios }) {
  const subtotales = new Map();
  const voluminosos = new Map();
  let productos = 0;
  elegidas.forEach((o, k) => {
    productos += o.precio;
    subtotales.set(o.tienda, (subtotales.get(o.tienda) || 0) + o.precio);
    if (lista[k].voluminoso) voluminosos.set(o.tienda, (voluminosos.get(o.tienda) || 0) + 1);
  });
  const envios = costoEnvios(subtotales, voluminosos);
  const porTienda = [...subtotales.keys()].map((tienda) => ({
    tienda,
    productos: lista.filter((_, k) => elegidas[k].tienda === tienda).map((it, _i) => it),
    subtotal: subtotales.get(tienda),
    envio: envios.detalle[tienda],
  }));
  return {
    asignacion: lista.map((it, k) => ({ clave: it.clave, titulo: it.titulo, oferta: elegidas[k] })),
    porTienda,
    productos,
    envio: envios.suma,
    total: productos + envios.suma,
  };
}
