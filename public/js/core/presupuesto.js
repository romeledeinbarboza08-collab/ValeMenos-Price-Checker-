// "Con presupuesto": comprar lo que necesitás sin pasarte de lo que tenés.
import { mediana } from './estructuras.js';

/* ------------------------------------------------------------------
 * 1. Armá tu kit — problema de la mochila de ELECCIÓN MÚLTIPLE
 *    Cada producto de la lista tiene varias opciones (una por tienda/modelo).
 *    Se escoge como máximo UNA opción por producto, sin pasar el presupuesto,
 *    maximizando el valor: primero lo imprescindible, después lo que "si alcanza".
 *
 *    Programación dinámica: mejor[w] = el mejor puntaje gastando como máximo w unidades.
 *    El dinero se cuenta en unidades de ₡500 para que la tabla no sea gigante.
 *    Tiempo O(productos × opciones × W), memoria O(productos × W).
 * ------------------------------------------------------------------ */
const PESO = { imprescindible: 1000, deseable: 100 };
const MAX_CELDAS = 4000;

// items: [{ nombre, prioridad, opciones: [{ total, ...lo que sea }] }]
// preferencia: 'barato' (la opción más económica) o 'calidad' (la mejor que alcance)
export function armarKit(items, presupuesto, { preferencia = 'barato' } = {}) {
  const unidad = Math.max(500, Math.ceil(presupuesto / MAX_CELDAS / 500) * 500);
  const W = Math.floor(presupuesto / unidad);

  // Valor de cada opción. El costo se resta un poquito para que, a igual valor,
  // gane la combinación más barata.
  const prep = items.map((it) => {
    const ordenadas = [...it.opciones].sort((a, b) => a.total - b.total);
    return ordenadas.map((op, rango) => {
      const bonoCalidad = preferencia === 'calidad' ? rango * 10 : (ordenadas.length - 1 - rango) * 10;
      return {
        op,
        costo: Math.ceil(op.total / unidad),
        valor: ((PESO[it.prioridad] || PESO.deseable) + bonoCalidad) * 1e8 - op.total,
      };
    });
  });

  let mejor = new Array(W + 1).fill(0);
  const eleccion = []; // eleccion[i][w] = índice de la opción tomada (-1 = ninguna)
  prep.forEach((opciones, i) => {
    const nuevo = mejor.slice();              // por defecto: no comprar este producto
    const elegido = new Array(W + 1).fill(-1);
    opciones.forEach((o, j) => {
      for (let w = o.costo; w <= W; w++) {
        const v = mejor[w - o.costo] + o.valor;
        if (v > nuevo[w]) { nuevo[w] = v; elegido[w] = j; }
      }
    });
    eleccion[i] = elegido;
    mejor = nuevo;
  });

  // Reconstruir hacia atrás qué opción se tomó en cada producto.
  let w = W;
  const elegidos = new Array(items.length).fill(null);
  for (let i = items.length - 1; i >= 0; i--) {
    const j = eleccion[i][w];
    if (j >= 0) { elegidos[i] = prep[i][j].op; w -= prep[i][j].costo; }
  }

  const total = elegidos.reduce((s, op) => s + (op?.total || 0), 0);
  return {
    elegidos: items.map((it, i) => ({ ...it, opcion: elegidos[i] })),
    total,
    sobrante: presupuesto - total,
    faltan: items.filter((_, i) => !elegidos[i]).map((it) => it.nombre),
    tabla: { unidad, celdas: (W + 1) * items.length },
  };
}

/* ------------------------------------------------------------------
 * 2. ¿Qué me alcanza? — lo que te da cada opción por cada colón
 * ------------------------------------------------------------------ */
export function puntajeSpecs(a = {}) {
  let s = 0;
  if (a.almacenamiento) s += Math.log2(a.almacenamiento);
  if (a.ram) s += 1.5 * Math.log2(a.ram);
  if (a.pulgadas && a.pulgadas >= 10) s += a.pulgadas / 8;
  if (a.litros) s += a.litros;
  return s;
}

/* ------------------------------------------------------------------
 * Precios sospechosamente bajos
 *    Si buscás "laptop" y casi todas cuestan ₡300.000, una de ₡8.000 no es una ganga:
 *    es otra cosa (un juguete, un repuesto). Se descarta toda opción que cueste menos
 *    del 35 % de la MEDIANA de las demás opciones de ese mismo producto.
 *    Se usa la mediana y no el promedio porque una sola opción carísima (o baratísima)
 *    no la mueve. O(n² log n) con n ≤ unas decenas de opciones.
 * ------------------------------------------------------------------ */
export const PISO_DE_PRECIO = 0.35;

export function quitarPreciosAtipicos(opciones, precio = (o) => o.total) {
  return opciones.filter((o, i) => {
    const resto = opciones.filter((_, j) => j !== i).map(precio);
    if (!resto.length) return true;                 // sin con qué comparar, se queda
    return precio(o) >= PISO_DE_PRECIO * mediana(resto);
  });
}

// grupos: con `total` ya calculado. Devuelve los que caben y tres destacados.
export function queMeAlcanza(grupos, presupuesto) {
  const caben = grupos.filter((g) => g.total <= presupuesto && !g.secundario && g.disponible !== false);
  if (!caben.length) return { caben, destacados: [] };
  const conPuntaje = caben.map((g) => ({ g, s: puntajeSpecs(g.atributos) }));
  const masBarato = caben.reduce((a, b) => (b.total < a.total ? b : a));
  const mejorQueAlcanza = caben.reduce((a, b) => (b.total > a.total ? b : a));
  const conSpecs = conPuntaje.filter((x) => x.s > 0);
  const mejorRelacion = conSpecs.length > 1
    ? conSpecs.reduce((a, b) => (b.s / b.g.total > a.s / a.g.total ? b : a)).g
    : null;

  const destacados = [];
  const agregar = (g, etiqueta, motivo) => {
    if (!g) return;
    const ya = destacados.find((d) => d.g === g);
    if (ya) ya.etiquetas.push(etiqueta); else destacados.push({ g, etiquetas: [etiqueta], motivo });
  };
  agregar(mejorRelacion, 'Mejor relación precio y specs', 'Te da más capacidad por cada colón.');
  agregar(masBarato, 'El más barato', 'Te sobra más plata.');
  agregar(mejorQueAlcanza, 'Lo mejor que te alcanza', 'Usa casi todo tu presupuesto en el producto de gama más alta.');
  return { caben, destacados };
}

/* ------------------------------------------------------------------
 * Kits listos para estudiantes
 * ------------------------------------------------------------------ */
export const KITS = [
  {
    id: 'clases', nombre: 'Volver a clases', presupuesto: 450000,
    descripcion: 'Lo básico para estudiar y entregar trabajos.',
    items: [
      { nombre: 'laptop', prioridad: 'imprescindible' },
      { nombre: 'audifonos inalambricos', prioridad: 'deseable' },
      { nombre: 'mouse inalambrico', prioridad: 'deseable' },
      { nombre: 'memoria usb', prioridad: 'deseable' },
    ],
  },
  {
    id: 'apartamento', nombre: 'Primer apartamento', presupuesto: 120000,
    descripcion: 'Cocina y ventilación para irte a vivir solo.',
    items: [
      { nombre: 'olla arrocera', prioridad: 'imprescindible' },
      { nombre: 'freidora de aire', prioridad: 'imprescindible' },
      { nombre: 'licuadora', prioridad: 'deseable' },
      { nombre: 'ventilador', prioridad: 'deseable' },
      { nombre: 'plancha de ropa', prioridad: 'deseable' },
    ],
  },
  {
    id: 'setup', nombre: 'Setup de estudio', presupuesto: 220000,
    descripcion: 'Un escritorio cómodo para la U o el trabajo.',
    items: [
      { nombre: 'monitor 24', prioridad: 'imprescindible' },
      { nombre: 'teclado', prioridad: 'deseable' },
      { nombre: 'mouse', prioridad: 'deseable' },
      { nombre: 'audifonos', prioridad: 'deseable' },
    ],
  },
];
