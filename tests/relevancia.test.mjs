// Casos reales de "Con presupuesto" que elegían el producto equivocado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relevancia, esCategoriaAjena, resumirGrupos } from '../public/js/core/emparejamiento.js';
import { quitarPreciosAtipicos } from '../public/js/core/presupuesto.js';

const UMBRAL = 0.6; // el mismo de netlify/lib/buscar.js

test('"monitor 24" no encuentra un Hot Wheels escala 1:24, sí un monitor de 24"', () => {
  const carrito = 'Vehiculos Hot Wheels Monster Trucks escala 1:24';
  assert.ok(relevancia('monitor 24', carrito) < UMBRAL);
  assert.ok(esCategoriaAjena({ titulo: carrito, categoria: '' }, 'monitor 24'));
  assert.ok(relevancia('monitor 24', 'Monitor Samsung 24" FHD') >= UMBRAL);
  assert.ok(relevancia('monitor 24', 'Monitor LG 24MK600 IPS') >= UMBRAL);
});

test('"mouse" no elige un cepillo de dientes de Mickey Mouse', () => {
  const cepillo = { tienda: 'maxipali', titulo: 'Cepillo de Dientes Oral-B Kids Mickey Mouse', categoria: '/Cuidado Personal/Higiene Bucal/', precio: 2500, disponible: true };
  const mouse = { tienda: 'walmart', titulo: 'Mouse Inalambrico Logitech M170', categoria: '/Tecnologia/Computacion/', precio: 7900, disponible: true };
  assert.ok(esCategoriaAjena(cepillo, 'mouse'));
  assert.ok(!esCategoriaAjena(mouse, 'mouse'));
  // Sin categoría, el título sirve de respaldo.
  assert.ok(esCategoriaAjena({ titulo: cepillo.titulo }, 'mouse'));
  // Si la persona busca un cepillo, sí corresponde.
  assert.ok(!esCategoriaAjena(cepillo, 'cepillo de dientes'));
  // En la búsqueda normal no se borra: se va a secundarios.
  const grupos = resumirGrupos([cepillo, mouse], 'mouse');
  assert.equal(grupos.length, 2);
  assert.equal(grupos.find((g) => g.ofertas[0].tienda === 'maxipali').secundario, true);
  assert.equal(grupos.find((g) => g.ofertas[0].tienda === 'walmart').secundario, false);
});

test('"laptop" no elige una laptop de juguete', () => {
  assert.ok(esCategoriaAjena({ titulo: 'Laptop de Juguete Bilingue para Ninos', categoria: '' }, 'laptop'));
  assert.ok(esCategoriaAjena({ titulo: 'Computadora didactica', categoria: '/Jugueteria/Didacticos/' }, 'laptop'));
  assert.ok(!esCategoriaAjena({ titulo: 'Laptop HP 15 Ryzen 5 8GB 512GB', categoria: '/Tecnologia/Laptops/' }, 'laptop'));
  // Precio atípico: ₡8.000 contra laptops de ₡300.000 queda fuera.
  const opciones = [8000, 289000, 310000, 355000].map((total) => ({ total }));
  assert.deepEqual(quitarPreciosAtipicos(opciones).map((o) => o.total), [289000, 310000, 355000]);
});

test('Lo que no se debe romper: freidora para 4 personas y errores de dedo', () => {
  const q = 'Freidora de aire para 4 personas';
  assert.ok(relevancia(q, 'Freidora de aire Ninja para 4 personas') >= UMBRAL);
  assert.ok(!esCategoriaAjena({ titulo: 'Freidora de aire Ninja para 4 personas', categoria: '/Electrodomesticos/Cocina/' }, q));
  assert.ok(relevancia('ipone 15', 'Celular APPLE iPhone 15 128GB Azul') >= 0.8);
  assert.ok(relevancia('secadora de pelo', 'Secadora de Pelo Remington 1875W') >= UMBRAL);
  assert.ok(!esCategoriaAjena({ titulo: 'Secadora de Pelo Remington', categoria: '/Cuidado Personal/Cabello/' }, 'secadora de pelo'));
  // Con una sola opción, o precios parecidos, no se descarta nada.
  assert.equal(quitarPreciosAtipicos([{ total: 5000 }]).length, 1);
  assert.equal(quitarPreciosAtipicos([30000, 35000, 42000].map((total) => ({ total }))).length, 3);
});

test('"mouse" tampoco trae mouse pads ni cosas de Minnie Mouse como principales', () => {
  const grupos = resumirGrupos([
    { tienda: 'intelec', titulo: 'Mouse Pad Nova 22X18X5MM', categoria: 'Mouse Pad', precio: 550, disponible: true },
    { tienda: 'maxipali', titulo: 'Mini ligas Disney Minnie Mouse - 1000 Uds', categoria: '/Bebes y Niños/Accesorios Para Bebes/', precio: 800, disponible: true },
    { tienda: 'maxipali', titulo: 'Libreta Minnie Mouse pasta dura -120 hojas', categoria: '/Papelería/Cuadernos/', precio: 1980, disponible: true },
    { tienda: 'walmart', titulo: 'Mouse Negro Durabrand Int 211201b inalámbrico', categoria: '/Electrónica/Computación/', precio: 1725, disponible: true },
  ], 'mouse');
  assert.deepEqual(grupos.filter((g) => !g.secundario).map((g) => g.ofertas[0].tienda), ['walmart']);
});

// Caso real del código de barras 7509546669007: Open Beauty Facts lo nombra "Colgate 160 ml".
test('"Colgate 160 ml" trae la pasta como principal y no una plancha de 160 ml', () => {
  const plancha = 'Plancha de vapor Oster GCSTBS3802-013 1000 W 160 ml';
  const pasta = { tienda: 'walmart', titulo: 'Pasta Dental Colgate Triple Acción Xtra Blancura -160 ml', categoria: '/Higiene y Belleza/Cuidado Bucal/Pasta dental/', precio: 1650, disponible: true };
  // "160 ml" es una sola medida: la plancha solo coincide en eso (1 de 2) y queda fuera.
  assert.ok(relevancia('Colgate 160 ml', plancha) < UMBRAL);
  assert.equal(relevancia('Colgate 160 ml', pasta.titulo), 1);
  // Nombrar la marca de higiene es pedir esa categoría: la pasta no va a "secundarios".
  assert.equal(esCategoriaAjena(pasta, 'Colgate 160 ml'), false);
  assert.equal(esCategoriaAjena(pasta, 'oral-b'), false);
  assert.equal(esCategoriaAjena(pasta, 'mouse'), true); // sin marca ni palabra de higiene, sigue siendo ajena
});
