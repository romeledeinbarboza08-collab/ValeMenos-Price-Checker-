// Búsqueda por código de barras, con respuestas simuladas (no sale a internet: se reemplaza fetch).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscarCodigo } from '../netlify/lib/codigo.js';
import { estadoDeRespuesta } from '../public/js/ui.js';
import { buscarEnTienda, esCodigo } from '../netlify/lib/buscar.js';
import { resumirGrupos } from '../public/js/core/emparejamiento.js';

// respuestas: [[parte de la URL, cuerpo]]. Lo que no esté en la lista responde 404.
// Devuelve la lista de URLs pedidas, para revisar el orden de las fuentes.
function simular(respuestas) {
  const pedidas = [];
  globalThis.fetch = async (url) => {
    pedidas.push(String(url));
    const r = respuestas.find(([patron]) => String(url).includes(patron));
    if (!r) return new Response(JSON.stringify({ status: 0 }), { status: 404 });
    return new Response(typeof r[1] === 'string' ? r[1] : JSON.stringify(r[1]), { status: 200 });
  };
  return pedidas;
}

const TASA = { venta: 510, compra: 500 };
delete process.env.GEMINI_API_KEY; // las pruebas usan las reglas, nunca Gemini

// Una respuesta de VTEX con dos productos: solo el primero tiene el EAN buscado.
const vtexCon = (ean) => ({ products: [
  { productName: 'Pasta Dental Colgate Triple Acción 100ml', brand: 'Colgate', linkText: 'pasta-colgate-triple', categories: ['/Higiene/'],
    items: [{ nameComplete: 'Pasta Dental Colgate Triple Acción 100ml', ean, images: [],
      sellers: [{ sellerDefault: true, commertialOffer: { Price: 1450, ListPrice: 1450, AvailableQuantity: 50 } }] }] },
  { productName: 'Cepillo Dental Oral-B', brand: 'Oral-B', linkText: 'cepillo-oral-b', categories: ['/Higiene/'],
    items: [{ nameComplete: 'Cepillo Dental Oral-B', ean: '7500435000000', images: [],
      sellers: [{ sellerDefault: true, commertialOffer: { Price: 990, AvailableQuantity: 20 } }] }] },
] });

// Caso real (7509546669007): Open Food Facts dice status 0 porque es de belleza,
// Open Beauty Facts lo conoce como "Colgate 160 ml" con "brands" vacío.
test('Pasta Colgate: Open Food Facts dice status 0, Open Beauty Facts la conoce sin marca', async () => {
  const pedidas = simular([
    ['openfoodfacts', { status: 0, status_verbose: 'product found with a different product type: beauty' }],
    ['openbeautyfacts', { status: 1, product: { product_name: 'Colgate 160 ml', product_type: 'beauty', brands: '' } }],
  ]);
  const r = await buscarCodigo('7509546669007');
  assert.equal(r.fuente, 'openbeautyfacts');
  assert.equal(r.consulta, 'colgate 160 ml'); // sin marca conocida: la primera palabra + el tamaño
  assert.deepEqual(r.alternativas, ['colgate 160 ml', 'colgate']);
  // Primero se preguntó a las 3 tiendas VTEX por EAN (no lo tenían), después a las Open … Facts
  // (las tres, en paralelo); como una respondió, no se llega a UPCitemdb.
  assert.equal(pedidas.filter((u) => u.includes('alternateIds_Ean:7509546669007')).length, 3);
  assert.equal(pedidas.filter((u) => /open(food|beauty|products)facts/.test(u)).length, 3);
  assert.ok(!pedidas.some((u) => u.includes('upcitemdb')));
});

test('Si varias Open … Facts lo conocen, gana comida > belleza > productos', async () => {
  simular([
    ['openfoodfacts', { status: 1, product: { product_name: 'Pasta dental Triple Acción', brands: 'Colgate,Colgate-Palmolive' } }],
    ['openbeautyfacts', { status: 1, product: { product_name: 'Otro nombre' } }],
  ]);
  const r = await buscarCodigo('7501035911208');
  assert.equal(r.fuente, 'openfoodfacts');
  assert.equal(r.consulta, 'colgate pasta dental triple'); // marca + tipo + resto, máximo 4 palabras
});

test('Si las tres Open … Facts dicen status 0, se usa UPCitemdb', async () => {
  simular([
    ['openfoodfacts', { status: 0 }], ['openbeautyfacts', { status: 0 }], ['openproductsfacts', { status: 0 }],
    ['upcitemdb', { code: 'OK', items: [{ title: 'JBL Tune 110 In-Ear Headphones', brand: 'JBL' }] }],
  ]);
  const r = await buscarCodigo('050036335560');
  assert.equal(r.fuente, 'upcitemdb');
  assert.equal(r.consulta, 'jbl tune 110 ear'); // el número del modelo se queda
});

// Caso real 041789001918: Open Food Facts lo llama "Maruchan Instant Lunch Sabor a Pollo".
// Con ese nombre el buscador de Walmart y MaxiPalí da 0 (VTEX exige todas las palabras).
test('Maruchan: frases de empaque fuera, consulta corta y alternativas', async () => {
  simular([['openfoodfacts', { status: 1, product: { product_name: 'Maruchan Instant Lunch Sabor a Pollo', brands: 'Maruchan' } }]]);
  const r = await buscarCodigo('041789001918');
  assert.equal(r.fuente, 'openfoodfacts');
  assert.equal(r.consulta, 'maruchan pollo');
  assert.deepEqual(r.alternativas, ['maruchan pollo', 'maruchan']);
});

test('Si una tienda VTEX tiene el EAN, se usa su nombre y no se pregunta a las bases públicas', async () => {
  const pedidas = simular([
    ['maxipali.co.cr/api/catalog_system', [{ productName: 'Sopa Maruchan instantánea ramen pollo - 64 g', brand: 'MARUCHAN', items: [{ ean: '041789001918' }] }]],
  ]);
  const r = await buscarCodigo('041789001918');
  assert.equal(r.fuente, 'maxipali');
  assert.equal(r.consulta, 'maruchan sopa pollo instantanea'); // marca + tipo + sabor, sin el tamaño
  assert.deepEqual(r.alternativas, ['maruchan sopa pollo instantanea', 'maruchan sopa', 'maruchan']);
  assert.ok(!pedidas.some((u) => /facts|upcitemdb/.test(u)));
});

test('Una tienda que responde 403 queda "no disponible" (gris), no como falla', async () => {
  globalThis.fetch = async () => new Response('Forbidden', { status: 403 });
  const r = await buscarEnTienda('mexpress', 'maruchan pollo', TASA);
  assert.equal(r.ok, false);
  assert.equal(r.noDisponible, true);
  assert.equal(estadoDeRespuesta(r).estado, 'nodisponible');
  // Un error de verdad (500) sigue siendo error.
  globalThis.fetch = async () => new Response('x', { status: 500 });
  assert.equal(estadoDeRespuesta(await buscarEnTienda('mexpress', 'maruchan pollo', TASA)).estado, 'error');
});

test('Ninguna fuente conoce el código, pero VTEX lo encuentra por EAN', async () => {
  const ean = '7509546000000';
  simular([]); // las 4 fuentes responden 404
  const r = await buscarCodigo(ean);
  assert.equal(r.producto, null);
  assert.equal(r.consulta, ean); // se busca el número tal cual

  simular([['intelligent-search', vtexCon(ean)]]);
  const tienda = await buscarEnTienda('walmart', r.consulta, TASA);
  assert.equal(tienda.ok, true);
  assert.equal(tienda.encontradas, 2);
  assert.equal(tienda.ofertas.length, 1); // el cepillo tiene otro EAN: se descarta
  assert.equal(tienda.ofertas[0].ean, ean);
  assert.equal(tienda.ofertas[0].coincidenciaExacta, true);
  // Y en la lista no se manda a "secundarios" aunque sea de higiene.
  const [grupo] = resumirGrupos(tienda.ofertas, ean);
  assert.equal(grupo.secundario, false);
  assert.equal(grupo.coincidenciaExacta, true);
});

test('Una consulta de solo dígitos no pasa por el filtro de relevancia', async () => {
  assert.equal(esCodigo('7501035911208'), true);
  assert.equal(esCodigo('1234567'), false); // menos de 8 dígitos: no es código
  assert.equal(esCodigo('monitor 24'), false);
  // Tienda sin EAN en los productos (forma de MExpress): el título no contiene el número
  // y con relevancia se descartaría todo. Con un código se deja lo que la tienda devolvió.
  simular([
    ['searchtermautocomplete', [{ label: 'Jabón Axion Limón 450g', producturl: '/jabon-axion-limon' }]],
    ['/jabon-axion-limon', '<meta itemprop="name" content="Jabón Axion Limón 450g"><meta itemprop="price" content="1290.00"><meta itemprop="availability" content="http://schema.org/InStock">'],
  ]);
  const r = await buscarEnTienda('mexpress', '7501025400001', TASA);
  assert.equal(r.ok, true);
  assert.equal(r.ofertas.length, 1);
  assert.equal(r.ofertas[0].coincidenciaExacta, false);
});
