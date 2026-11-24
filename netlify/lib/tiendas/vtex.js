// Conector para tiendas en VTEX (Walmart, MaxiPalí, Simán).
// VTEX expone el buscador de su propio sitio en JSON ("Intelligent Search").
// Su robots.txt no prohíbe /api/, así que es la forma más limpia de leer precios.

import { pedir } from '../http.js';

export function crearConectorVtex({ id, base, maxResultados = 24 }) {
  return {
    id,
    // Busca UN producto por su código de barras exacto en el catálogo de la tienda.
    // Devuelve { producto, marca } o null si la tienda no lo tiene.
    async porEan(ean, { tiempo = 3000 } = {}) {
      const lista = await pedir(`${base}/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${ean}`, { tiempo });
      const p = Array.isArray(lista) ? lista[0] : null;
      return p?.productName ? { producto: p.productName.trim(), marca: (p.brand || '').trim() } : null;
    },
    async buscar(consulta) {
      const url = `${base}/api/io/_v/api/intelligent-search/product_search/?query=${encodeURIComponent(consulta)}&count=${maxResultados}&hideUnavailableItems=false`;
      const datos = await pedir(url, { tiempo: 7000 });
      const ofertas = [];
      for (const p of datos.products || []) {
        // Cada "item" es una variante (por ejemplo, un color). Tomamos hasta 3.
        for (const item of (p.items || []).slice(0, 3)) {
          const vendedor = (item.sellers || []).find((s) => s.sellerDefault) || (item.sellers || [])[0];
          const o = vendedor?.commertialOffer;
          if (!o || !o.Price) continue;
          ofertas.push({
            tienda: id,
            titulo: item.nameComplete || p.productName,
            marca: p.brand || '',
            precio: Math.round(o.Price),
            precioLista: o.ListPrice && o.ListPrice > o.Price ? Math.round(o.ListPrice) : null,
            moneda: 'CRC',
            disponible: (o.AvailableQuantity ?? 0) > 0 || o.IsAvailable === true,
            url: `${base}/${p.linkText}/p`,
            imagen: item.images?.[0]?.imageUrl?.replace(/^http:/, 'https:') || null,
            ean: item.ean || null,
            categoria: p.categories?.[0] || '',
          });
        }
      }
      return ofertas;
    },
  };
}
