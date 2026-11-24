// Convierte un código de barras (EAN/UPC) en algo que se pueda buscar en las tiendas.
// Orden de consulta:
//   1. Walmart, MaxiPalí y Simán (VTEX) por EAN exacto, al mismo tiempo. Si una lo tiene,
//      su nombre es el mejor: es como lo escriben las tiendas de Costa Rica.
//   2. Las tres "Open … Facts" (comida, belleza, otros productos), al mismo tiempo.
//      Si varias lo conocen, gana la primera en el orden comida > belleza > productos.
//   3. UPCitemdb (más fuerte en electrónica).
//   4. Nadie lo conoce: se busca el número tal cual (las tiendas VTEX comparan el EAN).
// Con el nombre se arma una consulta CORTA (máx. 4 palabras): el buscador de VTEX exige
// todas las palabras, y "Maruchan Instant Lunch Sabor a Pollo" da 0 resultados.

import { pedir } from './http.js';
import { llamarGemini, textoDe } from './gemini.js';
import { CONECTORES } from './buscar.js';
import { VARIANTES } from '../../public/js/core/emparejamiento.js';

const TIEMPO_POR_FUENTE = 3000; // 3 s cada una, para no dejar al usuario esperando
const MAX_PALABRAS = 4;

/* ---------------- Fuentes ---------------- */

export const TIENDAS_EAN = ['walmart', 'maxipali', 'siman']; // en este orden de preferencia

// Las tres bases "Open … Facts" tienen la misma API: status 1 = encontrado.
// Ojo: Open Food Facts responde status 0 a una pasta dental ("product found with a
// different product type: beauty"), por eso se pregunta también a las otras dos.
function leerOpenFacts(d) {
  if (d?.status !== 1 || !d.product) return null;
  const p = d.product;
  const nombre = (p.product_name || p.product_name_es || '').trim();
  if (!nombre) return null;
  // "brands" muchas veces viene vacío; si trae varias ("Colgate,Colgate-Palmolive") usamos la primera.
  return { producto: nombre, marca: (p.brands || '').split(',')[0].trim() };
}

function leerUpcitemdb(d) {
  const item = d?.items?.[0];
  return item?.title ? { producto: item.title.trim(), marca: (item.brand || '').trim() } : null;
}

// En orden de preferencia: comida > belleza > productos.
export const FUENTES_OPEN = [
  { id: 'openfoodfacts', url: (ean) => `https://world.openfoodfacts.org/api/v2/product/${ean}.json` },
  { id: 'openbeautyfacts', url: (ean) => `https://world.openbeautyfacts.org/api/v2/product/${ean}.json` },
  { id: 'openproductsfacts', url: (ean) => `https://world.openproductsfacts.org/api/v2/product/${ean}.json` },
];
const UPCITEMDB = (ean) => `https://api.upcitemdb.com/prod/trial/lookup?upc=${ean}`;

// Recorre resultados de Promise.allSettled en orden y devuelve el primero que sirva.
function primeroQueSirva(respuestas, ids, leer) {
  for (let i = 0; i < respuestas.length; i++) {
    const encontrado = respuestas[i].status === 'fulfilled' ? leer(respuestas[i].value) : null;
    if (encontrado) return { ...encontrado, fuente: ids[i] };
  }
  return null;
}

export async function nombrarCodigo(ean) {
  // 1. Tiendas VTEX por EAN exacto (en paralelo).
  const enTiendas = await Promise.allSettled(TIENDAS_EAN.map((id) => CONECTORES[id].porEan(ean, { tiempo: TIEMPO_POR_FUENTE })));
  const tienda = primeroQueSirva(enTiendas, TIENDAS_EAN, (x) => x);
  if (tienda) return tienda;

  // 2. Las tres Open … Facts (en paralelo): el tiempo total es el de la más lenta, no la suma.
  //    allSettled no se cae si una falla (404, tiempo agotado): esa queda "rejected".
  const open = await Promise.allSettled(FUENTES_OPEN.map((f) => pedir(f.url(ean), { tiempo: TIEMPO_POR_FUENTE })));
  const base = primeroQueSirva(open, FUENTES_OPEN.map((f) => f.id), leerOpenFacts);
  if (base) return base;

  // 3. UPCitemdb.
  try {
    const encontrado = leerUpcitemdb(await pedir(UPCITEMDB(ean), { tiempo: TIEMPO_POR_FUENTE }));
    if (encontrado) return { ...encontrado, fuente: 'upcitemdb' };
  } catch { /* no respondió o no lo conoce */ }
  return null;
}

/* ---------------- Consulta corta ---------------- */

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// Frases de empaque y palabras (casi siempre en inglés) que no aparecen en los títulos
// de las tiendas de Costa Rica. Primero las frases, después las palabras sueltas.
const FRASES_EMPAQUE = [/\binstant lunch\b/g, /\bfamily size\b/g, /\bvalue pack\b/g, /\bsabor a\b/g, /\bsabor de\b/g, /\bcup noodles?\b/g];
const PALABRAS_FUERA = new Set([
  'instant', 'lunch', 'flavor', 'flavour', 'flavored', 'original', 'new', 'nuevo', 'nueva', 'family', 'size', 'pack',
  'value', 'with', 'and', 'the', 'of', 'in', 'for', 'oz', 'fl', 'sabor', 'tipo', 'presentacion', 'paquete', 'unidad',
  'unidades', 'de', 'del', 'la', 'el', 'los', 'las', 'con', 'y', 'a', 'en', 'para', 'por', 'un', 'una', 'x',
]);
// Contenido del empaque: "64 g", "160 ml", "3 oz". Solo se usa si no queda otra palabra.
const CONTENIDO = /\b\d+(?:[.,]\d+)?\s*(?:g|gr|kg|ml|l|lt|oz)\b/g;

function palabras(texto) {
  return texto.split(/[^a-z0-9ñ]+/).filter(Boolean);
}

// Arma [consulta corta, marca + tipo, solo marca] con reglas (sin internet).
//   marca + tipo de producto + variante/sabor, máximo 4 palabras.
export function consultasPorReglas(producto, marca = '') {
  let texto = sinTildes(String(producto).toLowerCase());
  for (const f of FRASES_EMPAQUE) texto = texto.replace(f, ' ');
  const contenido = (texto.match(CONTENIDO) || [])[0] || '';
  texto = texto.replace(CONTENIDO, ' ');

  const m = sinTildes(String(marca).toLowerCase()).trim();
  const palabrasMarca = palabras(m);
  // Palabras útiles: sin relleno y sin la marca (que va al inicio). Los números sueltos se
  // quedan: en electrónica son el modelo ("tune 110"); el tamaño ya se quitó arriba.
  const resto = palabras(texto).filter((p) => !PALABRAS_FUERA.has(p) && !palabrasMarca.includes(p));

  // Sin marca conocida, la primera palabra hace de marca ("Colgate 160 ml").
  const laMarca = palabrasMarca.length ? palabrasMarca.join(' ') : (resto.shift() || '');
  const tipo = resto.find((p) => !VARIANTES.has(p)) || '';
  const variantes = resto.filter((p) => VARIANTES.has(p));
  const otras = resto.filter((p) => p !== tipo && !VARIANTES.has(p));

  const corta = [laMarca, tipo, ...variantes, ...otras].filter(Boolean).join(' ').split(' ').slice(0, MAX_PALABRAS);
  // Si solo quedó la marca, el contenido ayuda a no traer toda la marca ("colgate 160 ml").
  if (corta.length === 1 && contenido) corta.push(...contenido.replace(',', '.').match(/[\d.]+|[a-z]+/g));

  const alternativas = [corta.join(' '), [laMarca, tipo].filter(Boolean).join(' '), laMarca];
  return [...new Set(alternativas.filter(Boolean))];
}

// Si hay llave de Gemini, le pedimos que resuma el NOMBRE (nunca mandamos el número solo).
async function consultaConGemini(producto, marca) {
  const llave = process.env.GEMINI_API_KEY;
  if (!llave) return null;
  // Mismos reintentos y modelos de respaldo que la foto, pero con solo 3 s en total:
  // si Gemini no contesta a tiempo, las reglas ya dieron una consulta que sirve.
  const r = await llamarGemini({
    llave,
    partes: [{ text: `Producto: "${producto}"${marca ? `, marca "${marca}"` : ''}.
Escribí lo que alguien pondría en el buscador de un supermercado de Costa Rica para encontrarlo:
máximo ${MAX_PALABRAS} palabras en español, marca + tipo de producto + sabor o variante,
sin tamaño ni frases de empaque. Respondé solo con esas palabras, sin comillas.` }],
    generationConfig: { temperature: 0, maxOutputTokens: 30 },
    plazoTotal: TIEMPO_POR_FUENTE,
    plazoPorIntento: TIEMPO_POR_FUENTE,
  });
  if (!r.ok) return null;
  const texto = sinTildes(textoDe(r.datos).toLowerCase()).replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const n = texto.split(' ').filter(Boolean).length;
  // Se descarta si viene vacía, larga o es solo un número.
  return n >= 1 && n <= MAX_PALABRAS && !/^\d+$/.test(texto) ? texto : null;
}

/* ---------------- Todo junto ---------------- */

export async function buscarCodigo(ean) {
  const encontrado = await nombrarCodigo(ean);
  if (!encontrado) {
    // Nadie lo conoce: se busca el número tal cual y en las tiendas se compara el EAN exacto.
    return { ean, producto: null, marca: '', consulta: ean, alternativas: [ean], fuente: 'codigo' };
  }
  const reglas = consultasPorReglas(encontrado.producto, encontrado.marca);
  const gemini = await consultaConGemini(encontrado.producto, encontrado.marca);
  const alternativas = [...new Set([gemini, ...reglas].filter(Boolean))];
  return { ean, ...encontrado, consulta: alternativas[0], alternativas };
}
