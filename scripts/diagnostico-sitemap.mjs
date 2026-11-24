// Revisa paso a paso un conector de sitemap (Gollo o Monge) para ver dónde se pierden los productos.
//   node scripts/diagnostico-sitemap.mjs monge "freidora de aire"
import { SITEMAPS } from '../netlify/lib/buscar.js';
import { descargarUrls, construirIndice, buscarEnIndice, leerProducto } from '../netlify/lib/tiendas/sitemap.js';
import { pedirPagina } from '../netlify/lib/http.js';

const id = process.argv[2] || 'monge';
const consulta = process.argv.slice(3).join(' ') || 'freidora de aire';
const cfg = SITEMAPS[id];
if (!cfg) { console.log(`Tienda desconocida: ${id}. Usá: ${Object.keys(SITEMAPS).join(', ')}`); process.exit(1); }

console.log(`\n1) Sitemap: ${cfg.sitemap}`);
let todas;
try {
  todas = await descargarUrls({ ...cfg, filtro: () => true });
} catch (e) { console.log('   No se pudo descargar:', e.message); process.exit(1); }
const filtradas = todas.filter(cfg.filtro);
console.log(`   URLs en el sitemap: ${todas.length}`);
console.log(`   URLs que pasan el filtro de "producto": ${filtradas.length}`);
console.log('   Ejemplos del sitemap:'); todas.slice(0, 5).forEach((u) => console.log('    ', u));
const conPalabra = todas.filter((u) => u.toLowerCase().includes(consulta.split(' ')[0].toLowerCase()));
console.log(`   URLs que contienen "${consulta.split(' ')[0]}": ${conPalabra.length}`);
conPalabra.slice(0, 5).forEach((u) => console.log('    ', u, cfg.filtro(u) ? '(pasa filtro)' : '(NO pasa filtro)'));

console.log(`\n2) Índice invertido con "${consulta}"`);
const urls = buscarEnIndice(construirIndice(filtradas), consulta, 6);
console.log(`   Resultados: ${urls.length}`);
urls.forEach((u) => console.log('    ', u));

console.log('\n3) Páginas de producto');
for (const u of urls.slice(0, 3)) {
  try {
    const html = await pedirPagina(u, { tiempo: 8000 });
    const p = leerProducto(html);
    const ld = (html.match(/application\/ld\+json/g) || []).length;
    console.log(`   ${p ? 'OK ' : 'SIN PRECIO'}  bloques JSON-LD: ${ld}  ${p ? `${p.titulo} ₡${p.precio}` : u}`);
  } catch (e) {
    const c = e.cause || {};
    console.log(`   ERROR ${e.message}  causa: ${c.code || c.name || '?'} ${c.message || ''}  ${u}`);
  }
}

// Segunda mirada: ¿qué contesta el servidor (estado y redirecciones) sin leer el cuerpo?
console.log('\n4) Respuesta cruda de la primera página');
if (urls[0]) {
  try {
    const r = await fetch(urls[0], { redirect: 'manual', headers: { 'User-Agent': 'Vale/1.0 (comparador de precios; +https://vale-cr.netlify.app/#/sobre)' } });
    console.log(`   HTTP ${r.status}  location: ${r.headers.get('location') || '-'}`);
  } catch (e) {
    const c = e.cause || {};
    console.log(`   ERROR ${e.message}  causa: ${c.code || c.name || '?'} ${c.message || ''}`);
  }
}
