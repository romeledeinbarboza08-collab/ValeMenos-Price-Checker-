// Función programada: cada 6 horas toma una "foto" de los precios de los productos más
// buscados aunque nadie los esté buscando. Alimenta:
//   - el historial (medidor "¿Vale la pena?" y detector de descuentos inflados)
//   - "Mayores diferencias de hoy" en la portada (solo comparaciones reales del mismo producto)

import { buscarEnTiendas } from '../lib/buscar.js';
import { registrarOfertas } from '../lib/historial.js';
import { topK } from '../../public/js/core/estructuras.js';

export const SEGUIMIENTO = [
  'iphone 17', 'iphone 16', 'samsung galaxy s25', 'samsung galaxy a56', 'xiaomi redmi note',
  'airpods', 'ipad', 'macbook air', 'laptop', 'freidora de aire', 'televisor 55', 'playstation 5',
  'nintendo switch', 'audifonos inalambricos', 'licuadora', 'monitor',
];

export function elegirDestacados(resultados, cuantos = 12) {
  const candidatos = [];
  for (const { consulta, grupos } of resultados) {
    for (const g of grupos) {
      const disp = g.ofertas.filter((o) => o.disponible);
      const tiendas = new Set(disp.map((o) => o.tienda));
      if (g.secundario || g.confianza !== 'alta' || tiendas.size < 2) continue;
      const min = Math.min(...disp.map((o) => o.precio));
      const max = Math.max(...disp.map((o) => o.precio));
      if ((max - min) / max < 0.05) continue;
      const barata = disp.find((o) => o.precio === min);
      candidatos.push({
        clave: g.clave, titulo: g.titulo, imagen: g.imagen, consulta,
        min, max, ahorro: max - min, tienda: barata.tienda, tiendas: tiendas.size,
      });
    }
  }
  // Sin repetir productos y con el montículo para quedarnos con los de mayor ahorro.
  const unicos = [...new Map(candidatos.map((c) => [c.clave, c])).values()];
  return topK(unicos, cuantos, (a, b) => b.ahorro - a.ahorro);
}

export default async () => {
  let guardados = 0;
  const resultados = [];
  for (let i = 0; i < SEGUIMIENTO.length; i += 3) {
    const lote = SEGUIMIENTO.slice(i, i + 3);
    const rs = await Promise.all(lote.map((q) => buscarEnTiendas(q).catch(() => null)));
    for (const r of rs) {
      if (!r) continue;
      resultados.push(r);
      for (const t of r.tiendas) guardados += await registrarOfertas(r.ofertas.filter((o) => o.tienda === t.id));
    }
  }
  try {
    const { getStore } = await import('@netlify/blobs');
    await getStore({ name: 'portada' }).setJSON('destacados', { generado: new Date().toISOString(), items: elegirDestacados(resultados) });
  } catch (e) { console.error('destacados:', e.message); }
  console.log(`Foto de precios: ${guardados} precios guardados`);
};

export const config = { schedule: '0 */6 * * *' };
