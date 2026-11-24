// Prueba los conectores desde la terminal, sin abrir el sitio:
//   node scripts/probar-tiendas.mjs "iphone 17"
import { buscarEnTiendas } from '../netlify/lib/buscar.js';
import { extraerAtributos } from '../public/js/core/emparejamiento.js';

const consulta = process.argv.slice(2).join(' ') || 'iphone 17';
console.log(`\nBuscando "${consulta}" en las tiendas...\n`);

const r = await buscarEnTiendas(consulta);
console.log(`Tipo de cambio: ₡${r.tipoCambio.venta} (${r.tipoCambio.fuente})\n`);
console.table(r.tiendas.map((t) => ({
  tienda: t.id,
  estado: t.ok ? 'ok' : t.noDisponible ? 'no disponible' : 'error',
  'tiempo (ms)': t.ms,
  encontradas: t.encontradas,
  relevantes: t.relevantes,
  detalle: t.error || '',
})));

const colones = (n) => '₡' + Math.round(n).toLocaleString('es-CR');
const principales = r.grupos.filter((g) => !g.secundario);
const accesorios = r.grupos.length - principales.length;
console.log(`\n${principales.length} productos (+ ${accesorios} accesorios) en ${r.ms} ms:\n`);

for (const g of principales.slice(0, 12)) {
  console.log(`■ ${g.titulo}   [confianza ${g.confianza}]   clave: ${g.clave}`);
  for (const o of g.ofertas) {
    const a = extraerAtributos(o.titulo, o.marca);
    const cap = a.almacenamiento ? `${a.almacenamiento} GB` : a.litros ? `${a.litros} L` : a.pulgadas ? `${a.pulgadas} pulg` : '—';
    const agotado = o.disponible ? '' : '  (agotado)';
    console.log(`    ${o.tienda.padEnd(9)} ${colones(o.precio).padStart(11)}  ${cap.padEnd(14)} "${o.titulo}"${agotado}`);
  }
  console.log('');
}
