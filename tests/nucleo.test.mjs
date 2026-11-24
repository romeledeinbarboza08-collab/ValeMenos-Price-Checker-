// Pruebas del núcleo. Se corren con:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Trie, Monticulo, topK, CacheLRU, levenshtein, ConjuntosDisjuntos, contarEnRango, mediana,
} from '../public/js/core/estructuras.js';
import { extraerAtributos, agruparOfertas, relevancia, limpiarTitulo } from '../public/js/core/emparejamiento.js';
import { optimizarCompra } from '../public/js/core/optimizador.js';

test('Trie sugiere por prefijo, las más buscadas primero', () => {
  const t = new Trie();
  t.insertar('iphone 17', 5);
  t.insertar('iphone 15', 2);
  t.insertar('freidora de aire', 1);
  assert.deepEqual(t.sugerir('iph'), ['iphone 17', 'iphone 15']);
  assert.deepEqual(t.sugerir('Fréi'), ['freidora de aire']);
  assert.deepEqual(t.sugerir('xyz'), []);
});

test('Montículo saca siempre el menor', () => {
  const h = new Monticulo();
  [5, 3, 9, 1, 7].forEach((x) => h.insertar(x));
  const out = [];
  while (h.tamano) out.push(h.extraer());
  assert.deepEqual(out, [1, 3, 5, 7, 9]);
  assert.deepEqual(topK([8, 2, 6, 4, 1], 3, (a, b) => a - b), [1, 2, 4]);
});

test('LRU saca al menos usado', () => {
  const c = new CacheLRU(2);
  c.guardar('a', 1);
  c.guardar('b', 2);
  c.obtener('a');       // a pasa al frente
  c.guardar('c', 3);    // sale b
  assert.equal(c.obtener('b'), undefined);
  assert.deepEqual(c.lista().map((x) => x.clave), ['c', 'a']);
});

test('Levenshtein', () => {
  assert.equal(levenshtein('ipone', 'iphone'), 1);
  assert.equal(levenshtein('samsumg', 'samsung'), 1);
  assert.equal(levenshtein('casa', 'casa'), 0);
});

test('Union-Find une conjuntos', () => {
  const uf = new ConjuntosDisjuntos(5);
  uf.unir(0, 1); uf.unir(3, 4);
  assert.equal(uf.buscar(0), uf.buscar(1));
  assert.notEqual(uf.buscar(1), uf.buscar(3));
});

test('Búsqueda binaria cuenta en rango y mediana', () => {
  const precios = [1000, 2000, 2000, 5000, 9000];
  assert.equal(contarEnRango(precios, 2000, 5000), 3);
  assert.equal(contarEnRango(precios, 9500, 10000), 0);
  assert.equal(mediana([5, 1, 3]), 3);
  assert.equal(mediana([4, 1, 3, 2]), 2.5);
});

test('Extrae capacidad y RAM de títulos distintos', () => {
  const a = extraerAtributos('Celular 5G Samsung Galaxy S25 Ultra 12GB RAM 512GB S25 ULTRA');
  assert.equal(a.marca, 'samsung');
  assert.equal(a.almacenamiento, 512);
  assert.equal(a.ram, 12);
  const b = extraerAtributos('Samsung Galaxy S25 Ultra Celular de Color Negro RAM 12 Gigabytes / Almacenamiento 512 Gigabytes');
  assert.equal(b.almacenamiento, 512);
  assert.equal(b.ram, 12);
  assert.equal(b.color, 'Negro');
  const c = extraerAtributos('iPhone 17 Pro Max 1 TB Naranja cósmico', 'Apple');
  assert.equal(c.almacenamiento, 1024);
  assert.deepEqual(c.linea, ['max', 'pro']);
});

test('No mezcla 256 GB con 512 GB (el error de MisterPrecios)', () => {
  const grupos = agruparOfertas([
    { tienda: 'mexpress', titulo: 'Celular SAMSUNG S25 ULTRA 256GB Negro', precio: 479900 },
    { tienda: 'mexpress', titulo: 'Celular SAMSUNG S25 ULTRA 512GB Negro', precio: 529900 },
    { tienda: 'walmart', titulo: 'Samsung Galaxy S25 Ultra 512GB Gris', marca: 'Samsung', precio: 859900 },
  ]);
  const de512 = grupos.find((g) => g.atributos.almacenamiento === 512);
  const de256 = grupos.find((g) => g.atributos.almacenamiento === 256);
  assert.equal(de512.ofertas.length, 2);
  assert.equal(de256.ofertas.length, 1);
});

test('Una oferta sin capacidad no funde dos versiones', () => {
  const grupos = agruparOfertas([
    { tienda: 'icon', titulo: 'iPhone 17 Pro Max 256 GB Azul intenso', marca: 'Apple', precio: 700000 },
    { tienda: 'icon', titulo: 'iPhone 17 Pro Max 512 GB Color plata', marca: 'Apple', precio: 800000 },
    { tienda: 'walmart', titulo: 'Iphone 17 Pro Max Naranja', marca: 'APPLE', precio: 680022 },
  ]);
  assert.equal(grupos.length, 3);
});

test('Pro y Pro Max son productos distintos; mismo modelo se une', () => {
  const grupos = agruparOfertas([
    { tienda: 'icon', titulo: 'iPhone 17 Pro 256 GB Plata', marca: 'Apple', precio: 1 },
    { tienda: 'icon', titulo: 'iPhone 17 Pro Max 256 GB Plata', marca: 'Apple', precio: 2 },
    { tienda: 'mexpress', titulo: 'Celular APPLE iPhone 17 Pro 256GB Azul', precio: 3 },
  ]);
  assert.equal(grupos.length, 2);
  assert.equal(grupos.find((g) => g.atributos.linea.join() === 'pro').ofertas.length, 2);
});

test('Relevancia tolera errores de dedo', () => {
  assert.ok(relevancia('ipone 15', 'Celular APPLE iPhone 15 128GB Azul') >= 0.8);
  assert.ok(relevancia('freidora aire', 'Licuadora Oster 600W') < 0.5);
});

test('Optimizador junta compras para ahorrar envío', () => {
  const items = [
    { clave: 'a', titulo: 'A', ofertas: [{ tienda: 'walmart', precio: 10000 }, { tienda: 'mexpress', precio: 10500 }] },
    { clave: 'b', titulo: 'B', ofertas: [{ tienda: 'mexpress', precio: 30000 }, { tienda: 'walmart', precio: 31000 }] },
  ];
  const r = optimizarCompra(items, { zona: 'gam', tasa: 455 });
  // Ingenuo: 10000 + 2500 (Walmart) + 30000 + 3500 (MExpress < 35k) = 46000
  assert.equal(r.ingenuo.total, 46000);
  // Óptimo: todo en MExpress = 40500, y pasa los ₡35.000 -> envío gratis
  assert.equal(r.optimo.total, 40500);
  assert.equal(r.ahorro, 5500);
});

test('Una oferta sin capacidad con precio muy distinto no se une (valor atípico)', () => {
  const grupos = agruparOfertas([
    { tienda: 'icon', titulo: 'iPhone 17 Pro 256 GB Plata', marca: 'Apple', precio: 649938 },
    { tienda: 'mexpress', titulo: 'Celular APPLE iPhone 17 Pro 256GB Azul', precio: 687900 },
    { tienda: 'walmart', titulo: 'Iphone 17 Pro Plata', marca: 'APPLE', precio: 849900 }, // ¿512 GB?
    { tienda: 'siman', titulo: 'Apple iPhone 17 Pro Naranja', marca: 'Apple', precio: 689900 },
  ]);
  const de256 = grupos.find((g) => g.atributos.almacenamiento === 256);
  // Walmart queda aparte (y Simán con él, porque las dos dicen lo mismo: "17 Pro" sin capacidad).
  assert.ok(!de256.ofertas.some((o) => o.tienda === 'walmart'));
  assert.deepEqual(de256.ofertas.map((o) => o.tienda).sort(), ['icon', 'mexpress']);
});

test('Limpia títulos repetidos y en mayúsculas', () => {
  assert.equal(limpiarTitulo('Apple Iphone 17 Air 256GB iPhone Air 256GB Blanco Nube'), 'Apple iPhone 17 Air 256 GB');
  assert.equal(limpiarTitulo('Celular APPLE iPhone 17 PRO 512GB/12GB  Azul'), 'Apple iPhone 17 Pro 512 GB');
  assert.equal(limpiarTitulo('Apple Iphone 17 pro iPhone 17 Pro 256GB Naranja Cosmico'), 'Apple iPhone 17 Pro 256 GB');
  assert.equal(limpiarTitulo('Iphone 17 Pro Max Naranja', { almacenamiento: 256 }), 'iPhone 17 Pro Max 256 GB');
  assert.equal(limpiarTitulo('Freidora de aire Black & Decker Digital 5.5 Litros'), 'Freidora de aire Black & Decker Digital 5.5 Litros');
});

test('Si solo falta la RAM, la confianza sigue siendo alta', () => {
  const [g] = agruparOfertas([
    { tienda: 'mexpress', titulo: 'Celular APPLE iPhone 17 PRO 256GB/12GB Azul', precio: 687900 },
    { tienda: 'icon', titulo: 'iPhone 17 Pro 256 GB Azul intenso', marca: 'Apple', precio: 649938 },
  ]);
  assert.equal(g.ofertas.length, 2);
  assert.equal(g.confianza, 'alta');
});

test('"Bandeja para freidora" es accesorio, "Freidora para 4 personas" no', async () => {
  const { esParaOtroProducto, resumirGrupos } = await import('../public/js/core/emparejamiento.js');
  assert.equal(esParaOtroProducto('Bandeja de silicona para freidora de aire 16cm', 'freidora de aire'), true);
  assert.equal(esParaOtroProducto('Freidora de aire para 4 personas', 'freidora de aire'), false);
  const g = resumirGrupos([{ tienda: 'siman', titulo: 'Bandeja de silicona para freidora de aire 16cm', precio: 750, disponible: true }], 'freidora de aire');
  assert.equal(g[0].secundario, true);
});

// Caso real de "maruchan pollo": la clave era maruchan|64 y juntaba sabores distintos.
test('Supermercado: distinto sabor o distinto contenido no es el mismo producto', () => {
  const o = (tienda, titulo, precio) => ({ tienda, titulo, marca: 'Maruchan', precio, disponible: true });
  const grupos = agruparOfertas([
    o('walmart', 'Sopa Maruchan instantánea ramen pollo - 64 g', 495),
    o('maxipali', 'Sopa Maruchan Instantánea Pollo - 64 g', 450),
    o('walmart', 'Sopa Maruchan Instantánea Pollo Picante - 64 g', 495),
    o('siman', 'Sopa Maruchan Instantánea Pollo - 85 g', 690),
  ]).map((g) => g.ofertas.map((x) => x.titulo).sort());
  assert.equal(grupos.length, 3);
  // El mismo sabor y peso se une aunque una tienda diga "ramen" y la otra no.
  assert.ok(grupos.some((g) => g.length === 2 && g.every((t) => /pollo - 64 g/i.test(t))));
  const a = extraerAtributos('Sopa Maruchan Instantánea Pollo Picante - 64 g', 'Maruchan');
  assert.equal(a.contenido, '64g');
  assert.deepEqual(a.variante, ['picante', 'pollo']);
  assert.ok(!a.firma.includes('64g') && !a.firma.includes('64')); // el peso no es el modelo
  // Un celular "5G" no tiene contenido: 5g es la red, no 5 gramos.
  assert.equal(extraerAtributos('Celular Samsung Galaxy A56 5G 256GB').contenido, null);
});
