// Diagnóstico del error 429 en las tiendas VTEX (Walmart, MaxiPalí, Simán).
// Prueba la misma búsqueda con distintas variantes para saber qué la provoca.
//   node scripts/diagnostico-vtex.mjs
const TIENDAS = {
  walmart: 'https://www.walmart.co.cr',
  maxipali: 'https://www.maxipali.co.cr',
  siman: 'https://cr.siman.com',
};

const VARIANTES = [
  {
    nombre: 'A. Como está ahora (ValeBot)',
    ruta: '/api/io/_v/api/intelligent-search/product_search/?query=iphone&count=4',
    headers: { 'User-Agent': 'ValeBot/1.0 (comparador academico de precios)', Accept: 'application/json' },
  },
  {
    nombre: 'B. Sin identificación propia (la de Node)',
    ruta: '/api/io/_v/api/intelligent-search/product_search/?query=iphone&count=4',
    headers: { Accept: 'application/json' },
  },
  {
    nombre: 'C. Nombre sin la palabra "bot"',
    ruta: '/api/io/_v/api/intelligent-search/product_search/?query=iphone&count=4',
    headers: { 'User-Agent': 'Vale/1.0 (comparador academico de precios)', Accept: 'application/json' },
  },
  {
    nombre: 'D. Buscador antiguo de VTEX (catalog_system)',
    ruta: '/api/catalog_system/pub/products/search?ft=iphone&_from=0&_to=3',
    headers: { 'User-Agent': 'ValeBot/1.0 (comparador academico de precios)', Accept: 'application/json' },
  },
];

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [tienda, base] of Object.entries(TIENDAS)) {
  console.log(`\n=== ${tienda} ===`);
  for (const v of VARIANTES) {
    try {
      const r = await fetch(base + v.ruta, { headers: v.headers, signal: AbortSignal.timeout(8000) });
      const texto = await r.text();
      let resumen = '';
      try {
        const j = JSON.parse(texto);
        const n = Array.isArray(j) ? j.length : (j.products?.length ?? '?');
        resumen = `${n} productos`;
      } catch {
        resumen = texto.slice(0, 80).replace(/\s+/g, ' ');
      }
      const extra = ['retry-after', 'server', 'x-vtex-router-version', 'cf-ray']
        .map((h) => (r.headers.get(h) ? `${h}=${r.headers.get(h)}` : null)).filter(Boolean).join(' ');
      console.log(`${v.nombre}\n   HTTP ${r.status}  ${resumen}  ${extra}`);
    } catch (e) {
      console.log(`${v.nombre}\n   ERROR ${e.name}: ${e.message}`);
    }
    await espera(1500); // pausa entre pruebas para no provocar un 429 de verdad
  }
}
