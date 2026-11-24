// Conector para tiendas en WooCommerce (Intelec).
// WooCommerce trae la "Store API": el mismo JSON que usa la tienda para su buscador.
// Su robots.txt no prohíbe /wp-json/ (Intelec además declara search_yes).

import { pedir } from '../http.js';

const ENTIDADES = { amp: '&', quot: '"', '#39': "'", '#8211': '–', '#8243': '″', '#8217': '’', nbsp: ' ' };
export const sinEntidades = (s) => String(s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z#0-9]+);/gi, (m, n) => ENTIDADES[n] ?? m)
  .replace(/<[^>]+>/g, '');

export function crearConectorWoo({ id, base, maxResultados = 12 }) {
  return {
    id,
    async buscar(consulta) {
      const url = `${base}/wp-json/wc/store/v1/products?search=${encodeURIComponent(consulta)}&per_page=${maxResultados}`;
      const lista = await pedir(url, { tiempo: 7000 });
      return (Array.isArray(lista) ? lista : []).map((p) => {
        const div = 10 ** (p.prices?.currency_minor_unit ?? 0);
        const precio = Number(p.prices?.price) / div;
        const regular = Number(p.prices?.regular_price) / div;
        return {
          tienda: id,
          titulo: sinEntidades(p.name).replace(/\s+–\s+/g, ' '),
          marca: p.brands?.[0]?.name || '',
          precio: Math.round(precio),
          precioLista: regular > precio ? Math.round(regular) : null,
          moneda: p.prices?.currency_code || 'CRC',
          disponible: p.is_in_stock !== false,
          url: p.permalink,
          imagen: p.images?.[0]?.thumbnail || p.images?.[0]?.src || null,
          ean: null,
          categoria: p.categories?.[0]?.name || '',
        };
      }).filter((o) => o.precio > 0);
    },
  };
}
