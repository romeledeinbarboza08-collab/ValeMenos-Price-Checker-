// Conector para iCon (Shopify).
// Shopify ofrece /search/suggest.json para el buscador de la tienda; su robots.txt lo permite.
// iCon publica precios en DÓLARES, así que aquí se guardan en USD y la búsqueda los convierte.

import { pedir } from '../http.js';

const BASE = 'https://icon.co.cr';

export const icon = {
  id: 'icon',
  async buscar(consulta) {
    const url = `${BASE}/search/suggest.json?q=${encodeURIComponent(consulta)}&resources[type]=product&resources[limit]=10&resources[options][unavailable_products]=last`;
    const datos = await pedir(url, { tiempo: 7000 });
    const productos = datos?.resources?.results?.products || [];
    return productos.map((p) => {
      const precio = Number(p.price);
      const antes = Number(p.compare_at_price_max || 0);
      return {
        tienda: 'icon',
        titulo: p.title,
        marca: p.vendor || '',
        precio,
        precioLista: antes > precio ? antes : null,
        moneda: 'USD',
        disponible: p.available !== false,
        url: `${BASE}/products/${p.handle}`,
        imagen: (p.featured_image?.url || p.image || '').replace(/^\/\//, 'https://') || null,
        ean: null,
        categoria: p.type || '',
      };
    }).filter((o) => o.precio > 0);
  },
};
