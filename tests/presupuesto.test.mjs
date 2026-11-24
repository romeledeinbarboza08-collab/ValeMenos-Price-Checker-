import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarKit, queMeAlcanza } from '../public/js/core/presupuesto.js';
import { construirIndice, buscarEnIndice, palabrasDeUrl } from '../netlify/lib/tiendas/sitemap.js';
import { elegirDestacados } from '../netlify/functions/foto-de-precios.mjs';

const op = (total) => ({ total });

test('Mochila: lo imprescindible entra primero', () => {
  const r = armarKit([
    { nombre: 'freidora', prioridad: 'imprescindible', opciones: [op(40000), op(55000)] },
    { nombre: 'licuadora', prioridad: 'deseable', opciones: [op(30000)] },
    { nombre: 'olla', prioridad: 'imprescindible', opciones: [op(25000), op(18000)] },
  ], 60000);
  assert.equal(r.elegidos[0].opcion.total, 40000);
  assert.equal(r.elegidos[2].opcion.total, 18000);
  assert.equal(r.elegidos[1].opcion, null);
  assert.deepEqual(r.faltan, ['licuadora']);
  assert.equal(r.total, 58000);
});

test('Mochila: con preferencia "calidad" usa la mejor opción que alcance', () => {
  const r = armarKit([
    { nombre: 'monitor', prioridad: 'imprescindible', opciones: [op(70000), op(95000), op(150000)] },
  ], 100000, { preferencia: 'calidad' });
  assert.equal(r.elegidos[0].opcion.total, 95000);
});

test('Mochila: nunca se pasa del presupuesto', () => {
  const r = armarKit([
    { nombre: 'a', prioridad: 'imprescindible', opciones: [op(30250), op(41000)] },
    { nombre: 'b', prioridad: 'imprescindible', opciones: [op(30250)] },
  ], 60000);
  assert.ok(r.total <= 60000);
});

test('¿Qué me alcanza? marca el de mejor relación', () => {
  const g = (total, almacenamiento, ram) => ({ total, atributos: { almacenamiento, ram } });
  const a = g(300000, 256, 8); const b = g(320000, 512, 16); const c = g(500000, 1024, 16);
  const r = queMeAlcanza([a, b, c], 350000);
  assert.equal(r.caben.length, 2);
  assert.equal(r.destacados.find((d) => d.etiquetas.includes('Mejor relación precio y specs')).g, b);
});

test('Índice invertido sobre el sitemap', () => {
  const urls = [
    'https://www.gollo.com/iphone-15-4gb-128gb-negro-1008010001/p',
    'https://www.gollo.com/freidora-de-aire-oster-4l-1008010002/p',
    'https://www.gollo.com/iphone-15-pro-8gb-256gb-azul-1008010003/p',
  ];
  assert.deepEqual(palabrasDeUrl(urls[1]).slice(0, 3), ['freidora', 'de', 'aire']);
  const idx = construirIndice(urls);
  assert.equal(buscarEnIndice(idx, 'freidora de aire')[0], urls[1]);
  assert.equal(buscarEnIndice(idx, 'iphone 15')[0], urls[0]);
  assert.equal(buscarEnIndice(idx, 'licuadora').length, 0);
});

test('Destacados: solo comparaciones reales del mismo producto', () => {
  const g = (clave, ofertas, extra = {}) => ({ clave, titulo: clave, confianza: 'alta', secundario: false, ofertas, ...extra });
  const o = (tienda, precio) => ({ tienda, precio, disponible: true });
  const r = elegirDestacados([{ consulta: 'x', grupos: [
    g('a', [o('walmart', 100), o('gollo', 150)]),
    g('b', [o('walmart', 100), o('walmart', 200)]),            // una sola tienda
    g('c', [o('walmart', 100), o('icon', 300)], { confianza: 'media' }),
  ] }]);
  assert.deepEqual(r.map((d) => d.clave), ['a']);
});
