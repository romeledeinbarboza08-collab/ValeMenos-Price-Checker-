// Pruebas de los conectores con respuestas que tienen la misma forma que las reales
// (no salen a internet: se reemplaza fetch).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearConectorVtex } from '../netlify/lib/tiendas/vtex.js';
import { mexpress } from '../netlify/lib/tiendas/mexpress.js';
import { icon } from '../netlify/lib/tiendas/icon.js';

function simular(respuestas) {
  globalThis.fetch = async (url) => {
    const r = respuestas.find(([patron]) => String(url).includes(patron));
    if (!r) return new Response('no', { status: 404 });
    const cuerpo = typeof r[1] === 'string' ? r[1] : JSON.stringify(r[1]);
    return new Response(cuerpo, { status: 200 });
  };
}

test('VTEX: lee precio, precio de lista, disponibilidad y enlace', async () => {
  simular([['intelligent-search', { products: [{
    productName: 'Iphone 17 Pro Max Naranja', brand: 'APPLE', linkText: 'iphone-17-pro-max-naranja-7', categories: ['/Celulares/'],
    items: [{ nameComplete: 'Iphone 17 Pro Max Naranja', ean: '195950', images: [{ imageUrl: 'http://x/a.jpg' }],
      sellers: [{ sellerDefault: true, commertialOffer: { Price: 680022, ListPrice: 693900, AvailableQuantity: 10000 } }] }],
  }] }]]);
  const [o] = await crearConectorVtex({ id: 'walmart', base: 'https://www.walmart.co.cr' }).buscar('iphone');
  assert.equal(o.precio, 680022);
  assert.equal(o.precioLista, 693900);
  assert.equal(o.disponible, true);
  assert.equal(o.url, 'https://www.walmart.co.cr/iphone-17-pro-max-naranja-7/p');
  assert.equal(o.imagen, 'https://x/a.jpg');
});

test('MExpress: autocompletado + microdatos de la página', async () => {
  simular([
    ['searchtermautocomplete', [{ label: 'Celular APPLE iPhone 15 128GB Azul', producturl: '/celular-apple-iphone-15-128gb-celeste' }]],
    ['/celular-apple-iphone-15', '<meta itemprop="name" content="Celular APPLE iPhone 15 128GB "><meta itemprop="price" content="327500.00"><meta itemprop="availability" content="http://schema.org/InStock">'],
  ]);
  const [o] = await mexpress.buscar('iphone 15');
  assert.equal(o.precio, 327500);
  assert.equal(o.disponible, true);
  assert.equal(o.url, 'https://www.tiendamexpress.com/celular-apple-iphone-15-128gb-celeste');
});

test('iCon (Shopify): precios en dólares', async () => {
  simular([['suggest.json', { resources: { results: { products: [
    { title: 'iPhone 17 Pro Max 256 GB Azul intenso', price: '1569.00', compare_at_price_max: '0.00', available: true, handle: 'iphone-17-pro-mfyp4be-a', vendor: 'Apple' },
  ] } } }]]);
  const [o] = await icon.buscar('iphone 17');
  assert.equal(o.precio, 1569);
  assert.equal(o.moneda, 'USD');
  assert.equal(o.precioLista, null);
  assert.equal(o.url, 'https://icon.co.cr/products/iphone-17-pro-mfyp4be-a');
});
