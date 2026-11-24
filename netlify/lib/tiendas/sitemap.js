// Conector para tiendas que NO permiten usar su buscador (Gollo, Monge), pero sí su
// mapa del sitio (sitemap.xml) y sus páginas de producto. Es lo mismo que hace Google.
//
// 1. Una vez al día se descarga el sitemap: ~3.000 URLs como
//    /celular-5g-apple-iphone-13-negro-128gb-174886
// 2. Con las palabras de cada URL se arma un ÍNDICE INVERTIDO: palabra -> URLs que la tienen.
// 3. Al buscar, se cruzan las listas de cada palabra de la consulta y se abren solo las
//    5 o 6 páginas que mejor coinciden, para leer el precio en vivo (JSON-LD de schema.org).

import { pedirPagina, colaConLimite } from '../http.js';
import { normalizarTexto, tokens } from '../../../public/js/core/emparejamiento.js';
import { sinEntidades } from './woocommerce.js';

const UN_DIA = 24 * 3600_000;
const indices = new Map(); // id -> { hora, urls, invertido }

async function almacen() {
  const { getStore } = await import('@netlify/blobs');
  return getStore({ name: 'sitemaps', consistency: 'eventual' });
}

const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);

export async function descargarUrls({ sitemap, filtro }) {
  let urls = locs(await pedirPagina(sitemap, { tiempo: 6000 }));
  // Si es un índice de sitemaps, bajamos el de productos.
  if (urls.length && urls.every((u) => u.endsWith('.xml'))) {
    const hijo = urls.find((u) => /product|urls/i.test(u)) || urls[0];
    urls = locs(await pedirPagina(hijo.replace(/^http:/, 'https:'), { tiempo: 6000 }));
  }
  return urls.map((u) => u.replace(/^http:/, 'https:')).filter(filtro);
}

// Palabras de la URL: "/tablet-samsung-tab-s10-lite-128-gb-1008010234/p" -> [tablet, samsung, tab, s10, lite, 128gb]
export function palabrasDeUrl(url) {
  const ruta = new URL(url).pathname.replace(/\/p$/, '').split('/').filter(Boolean).pop() || '';
  const sinId = ruta.replace(/-\d{5,}$/, '');
  return tokens(normalizarTexto(sinId.replace(/-/g, ' ')));
}

export function construirIndice(urls) {
  const invertido = new Map();
  urls.forEach((url, i) => {
    for (const p of new Set(palabrasDeUrl(url))) {
      if (!invertido.has(p)) invertido.set(p, []);
      invertido.get(p).push(i);
    }
  });
  return { urls, invertido };
}

// Busca en el índice: cada palabra de la consulta suma puntos a las URLs que la contienen.
export function buscarEnIndice(indice, consulta, limite = 6) {
  const q = tokens(normalizarTexto(consulta)).filter((p) => p.length > 1);
  if (!q.length) return [];
  const puntos = new Map();
  for (const palabra of q) {
    let lista = indice.invertido.get(palabra);
    let peso = 1;
    if (!lista && palabra.length >= 4) { // prefijo: "freid" encuentra "freidora"
      lista = [];
      for (const [k, v] of indice.invertido) if (k.startsWith(palabra)) lista.push(...v);
      peso = 0.8;
    }
    for (const i of lista || []) puntos.set(i, (puntos.get(i) || 0) + peso);
  }
  const minimo = q.length >= 2 ? Math.max(1.6, q.length * 0.66) : 1;
  return [...puntos.entries()]
    .filter(([, p]) => p >= minimo - 0.01)
    .sort((a, b) => b[1] - a[1] || indice.urls[a[0]].length - indice.urls[b[0]].length)
    .slice(0, limite)
    .map(([i]) => indice.urls[i]);
}

async function obtenerIndice(cfg) {
  const enMemoria = indices.get(cfg.id);
  if (enMemoria && Date.now() - enMemoria.hora < UN_DIA) return enMemoria;
  let urls = null;
  let store = null;
  try {
    store = await almacen();
    const guardado = await store.get(cfg.id, { type: 'json' });
    if (guardado && Date.now() - guardado.hora < UN_DIA) urls = guardado.urls;
  } catch { /* sin Blobs (local): se descarga directo */ }
  if (!urls) {
    urls = await descargarUrls(cfg);
    try { await store?.setJSON(cfg.id, { hora: Date.now(), urls }); } catch { /* opcional */ }
  }
  const indice = { hora: Date.now(), ...construirIndice(urls) };
  indices.set(cfg.id, indice);
  return indice;
}

export function leerProducto(html) {
  const bloques = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, texto] of bloques) {
    let datos;
    try { datos = JSON.parse(texto.trim()); } catch { continue; }
    const lista = Array.isArray(datos) ? datos : datos['@graph'] || [datos];
    const p = lista.find((x) => x?.['@type'] === 'Product');
    if (!p) continue;
    const oferta = Array.isArray(p.offers) ? p.offers[0] : p.offers;
    const precio = Number(oferta?.price ?? oferta?.lowPrice);
    if (!precio) continue;
    const imagen = Array.isArray(p.image) ? p.image[0] : (p.image?.url || p.image);
    return {
      titulo: sinEntidades(p.name),
      marca: typeof p.brand === 'string' ? p.brand : p.brand?.name || '',
      precio: Math.round(precio),
      moneda: oferta?.priceCurrency || 'CRC',
      disponible: !/OutOfStock|Discontinued|SoldOut/i.test(oferta?.availability || ''),
      imagen: typeof imagen === 'string' ? imagen : null,
      ean: p.gtin13 || p.gtin || null,
    };
  }
  // Respaldo: metadatos Open Graph de precio
  const precio = Number((html.match(/property="product:price:amount"\s+content="([\d.]+)"/) || [])[1]);
  if (!precio) return null;
  const titulo = (html.match(/property="og:title"\s+content="([^"]+)"/) || [])[1];
  const imagen = (html.match(/property="og:image"\s+content="([^"]+)"/) || [])[1];
  return { titulo: sinEntidades(titulo), marca: '', precio: Math.round(precio), moneda: 'CRC', disponible: true, imagen: imagen || null, ean: null };
}

export function crearConectorSitemap(cfg) {
  return {
    id: cfg.id,
    async buscar(consulta) {
      const indice = await obtenerIndice(cfg);
      const urls = buscarEnIndice(indice, consulta, 6);
      const paginas = await colaConLimite(urls.map((u) => () => pedirPagina(u, { tiempo: 3500 })), 3);
      const ofertas = [];
      paginas.forEach((r, i) => {
        if (!r.ok) return;
        const p = leerProducto(r.valor);
        if (!p) return;
        ofertas.push({ tienda: cfg.id, ...p, precioLista: null, url: urls[i], categoria: '' });
      });
      return ofertas;
    },
  };
}
