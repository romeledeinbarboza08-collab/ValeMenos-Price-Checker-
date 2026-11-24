// Estado de la aplicación en el navegador: preferencias, Mi compra, productos seguidos,
// vistos recientemente y el diccionario del autocompletado.
// Se guarda en localStorage (si el navegador lo bloquea, todo sigue funcionando en memoria).

import { CacheLRU, Trie } from './core/estructuras.js';
import { MAX_PRODUCTOS } from './core/optimizador.js';

const almacen = {
  leer(clave, porDefecto) {
    try {
      const v = localStorage.getItem(`vale:${clave}`);
      return v == null ? porDefecto : JSON.parse(v);
    } catch { return porDefecto; }
  },
  guardar(clave, valor) {
    try { localStorage.setItem(`vale:${clave}`, JSON.stringify(valor)); } catch { /* sin espacio o bloqueado */ }
  },
};

// Palabras de arranque para el autocompletado (lo que la gente busca en Costa Rica).
const SEMILLA = [
  'iphone 17', 'iphone 17 pro', 'iphone 17 pro max', 'iphone 16', 'iphone 15', 'ipad', 'ipad air', 'macbook air',
  'airpods', 'airpods pro', 'apple watch', 'samsung galaxy s25', 'samsung galaxy s25 ultra', 'mouse inalambrico', 'teclado', 'memoria usb', 'monitor 24', 'plancha de ropa', 'consola', 'samsung galaxy a56',
  'samsung galaxy a36', 'samsung galaxy a16', 'xiaomi redmi note 14', 'xiaomi redmi 15', 'motorola moto g',
  'honor magic', 'televisor 32', 'televisor 43', 'televisor 55', 'televisor 65', 'smart tv', 'laptop', 'laptop hp',
  'laptop lenovo', 'monitor', 'audifonos', 'audifonos inalambricos', 'parlante bluetooth', 'jbl', 'playstation 5',
  'nintendo switch', 'xbox series', 'freidora de aire', 'licuadora', 'cafetera', 'microondas', 'olla arrocera',
  'refrigeradora', 'lavadora', 'secadora', 'aspiradora', 'aspiradora robot', 'ventilador', 'aire acondicionado',
  'plancha de cabello', 'secadora de pelo', 'cortadora de cabello', 'tablet', 'impresora', 'reloj inteligente',
];

const escuchas = new Set();
export function suscribir(fn) { escuchas.add(fn); return () => escuchas.delete(fn); }
function avisar(cambio) { escuchas.forEach((fn) => fn(cambio)); }

export const estado = {
  zona: almacen.leer('zona', 'gam'),
  moneda: almacen.leer('moneda', 'CRC'),
  tasa: { venta: 455, fecha: null, respaldo: true },
  compra: almacen.leer('compra', []),
  seguidos: almacen.leer('seguidos', []),
  comparar: almacen.leer('comparar', []),
  vistos: CacheLRU.desde(almacen.leer('vistos', []), 8),
  busquedas: almacen.leer('busquedas', {}),
  trie: new Trie(),
};

// El Trie se arma con la semilla + lo que esta persona ya buscó (con más peso).
SEMILLA.forEach((t) => estado.trie.insertar(t, 1));
Object.entries(estado.busquedas).forEach(([q, n]) => estado.trie.insertar(q, 5 + n * 3));

export const contexto = () => ({ zona: estado.zona, moneda: estado.moneda, tasa: estado.tasa.venta });

export function cambiarZona(z) { estado.zona = z; almacen.guardar('zona', z); avisar('zona'); }
export function cambiarMoneda(m) { estado.moneda = m; almacen.guardar('moneda', m); avisar('moneda'); }
export function fijarTasa(t) { estado.tasa = t; avisar('tasa'); }

export function registrarBusqueda(q) {
  const k = q.trim().toLowerCase();
  if (k.length < 2) return;
  estado.busquedas[k] = (estado.busquedas[k] || 0) + 1;
  estado.trie.insertar(k, 8);
  // Solo guardamos las 60 más frecuentes.
  const top = Object.entries(estado.busquedas).sort((a, b) => b[1] - a[1]).slice(0, 60);
  estado.busquedas = Object.fromEntries(top);
  almacen.guardar('busquedas', estado.busquedas);
}

// Títulos de productos vistos en resultados: el autocompletado también los sugiere.
export function aprenderTitulos(grupos) {
  for (const g of grupos.slice(0, 12)) if (!g.secundario) estado.trie.insertar(g.titulo.toLowerCase().replace(/\s+/g, ' '), 0.5);
}

// Copia liviana de un producto para guardar en la lista.
export function fotoDeGrupo(g, consulta) {
  return {
    clave: g.clave,
    titulo: g.titulo,
    imagen: g.imagen,
    consulta,
    atributos: g.atributos,
    colores: g.colores,
    confianza: g.confianza,
    min: g.min,
    tiendas: g.tiendas,
    ofertas: g.ofertas.map((o) => ({
      tienda: o.tienda, titulo: o.titulo, precio: o.precio, precioLista: o.precioLista ?? null,
      precioOriginal: o.precioOriginal ?? null, moneda: o.moneda, disponible: o.disponible, url: o.url, clave: o.clave, color: o.color ?? null,
    })),
    guardado: new Date().toISOString(),
  };
}

/* ---- Mi compra ---- */
export const enCompra = (clave) => estado.compra.some((x) => x.clave === clave);
export function agregarACompra(grupo, consulta) {
  if (enCompra(grupo.clave)) return { ok: true, repetido: true };
  if (estado.compra.length >= MAX_PRODUCTOS) return { ok: false, motivo: `Mi lista admite hasta ${MAX_PRODUCTOS} productos.` };
  estado.compra.push(fotoDeGrupo(grupo, consulta));
  almacen.guardar('compra', estado.compra);
  avisar('compra');
  return { ok: true };
}
export function quitarDeCompra(clave) {
  estado.compra = estado.compra.filter((x) => x.clave !== clave);
  almacen.guardar('compra', estado.compra);
  avisar('compra');
}
export function actualizarEnCompra(clave, grupo) {
  const i = estado.compra.findIndex((x) => x.clave === clave);
  if (i < 0) return;
  estado.compra[i] = fotoDeGrupo(grupo, estado.compra[i].consulta);
  almacen.guardar('compra', estado.compra);
  avisar('compra');
}

/* ---- Seguir precio ---- */
export const seguido = (clave) => estado.seguidos.find((x) => x.clave === clave);
export function seguir(grupo, consulta, objetivo) {
  const previo = seguido(grupo.clave);
  const registro = {
    ...fotoDeGrupo(grupo, consulta),
    precioAlSeguir: previo?.precioAlSeguir ?? grupo.min,
    objetivo: objetivo || null,
    ultimoPrecio: grupo.min,
    revisado: new Date().toISOString(),
  };
  estado.seguidos = [registro, ...estado.seguidos.filter((x) => x.clave !== grupo.clave)].slice(0, 20);
  almacen.guardar('seguidos', estado.seguidos);
  avisar('seguidos');
}
export function dejarDeSeguir(clave) {
  estado.seguidos = estado.seguidos.filter((x) => x.clave !== clave);
  almacen.guardar('seguidos', estado.seguidos);
  avisar('seguidos');
}
export function fijarObjetivo(clave, objetivo) {
  const s = seguido(clave);
  if (!s) return;
  s.objetivo = objetivo || null;
  almacen.guardar('seguidos', estado.seguidos);
}
export function anotarRevision(clave, precio) {
  const s = seguido(clave);
  if (!s) return;
  s.ultimoPrecio = precio;
  s.revisado = new Date().toISOString();
  almacen.guardar('seguidos', estado.seguidos);
}

/* ---- Comparar (máximo 3) ---- */
export const enComparar = (clave) => estado.comparar.some((x) => x.clave === clave);
export function alternarComparar(grupo, consulta) {
  if (enComparar(grupo.clave)) {
    estado.comparar = estado.comparar.filter((x) => x.clave !== grupo.clave);
  } else {
    if (estado.comparar.length >= 3) return { ok: false, motivo: 'Podés comparar hasta 3 productos. Quitá uno primero.' };
    estado.comparar.push(fotoDeGrupo(grupo, consulta));
  }
  almacen.guardar('comparar', estado.comparar);
  avisar('comparar');
  return { ok: true, agregado: enComparar(grupo.clave) };
}
export function quitarDeComparar(clave) {
  estado.comparar = estado.comparar.filter((x) => x.clave !== clave);
  almacen.guardar('comparar', estado.comparar);
  avisar('comparar');
}

/* ---- Vistos recientemente (caché LRU) ---- */
export function registrarVisto(grupo, consulta) {
  estado.vistos.guardar(grupo.clave, { clave: grupo.clave, titulo: grupo.titulo, imagen: grupo.imagen, consulta, min: grupo.min });
  almacen.guardar('vistos', estado.vistos.lista());
}
