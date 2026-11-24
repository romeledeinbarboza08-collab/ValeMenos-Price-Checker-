// Conector para MExpress (plataforma nopCommerce).
// Su robots.txt prohíbe la página /search?, pero permite el autocompletado del buscador
// y las páginas de producto. Por eso el flujo es en dos pasos:
//   1. El autocompletado nos da hasta 10 productos (nombre + enlace).
//   2. Abrimos cada página de producto y leemos el precio de sus microdatos
//      (<meta itemprop="price" content="327500.00">), que son estándar de schema.org.

import { pedir, colaConLimite } from '../http.js';

const BASE = 'https://www.tiendamexpress.com';

function meta(html, prop) {
  const re = new RegExp(`<meta[^>]*itemprop="${prop}"[^>]*content="([^"]*)"`, 'i');
  const m = html.match(re);
  return m ? decodificar(m[1]) : null;
}

function decodificar(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export const mexpress = {
  id: 'mexpress',
  async buscar(consulta) {
    const sugerencias = await pedir(`${BASE}/catalog/searchtermautocomplete?term=${encodeURIComponent(consulta)}`, { tiempo: 5000 });
    const lista = (Array.isArray(sugerencias) ? sugerencias : []).filter((s) => s.producturl).slice(0, 10);

    // Máximo 5 páginas a la vez para no cargar el sitio de la tienda. Con 10 páginas son
    // 2 rondas de máximo 3 s: así la función nunca pasa el límite de 10 s de Netlify.
    const paginas = await colaConLimite(
      lista.map((s) => () => pedir(BASE + s.producturl, { json: false, tiempo: 3000 })),
      5,
    );

    const ofertas = [];
    paginas.forEach((r, i) => {
      if (!r.ok) return;
      const html = r.valor;
      const precio = Number(meta(html, 'price'));
      if (!precio) return;
      const disponibilidad = meta(html, 'availability') || '';
      ofertas.push({
        tienda: 'mexpress',
        titulo: lista[i].label || meta(html, 'name'),
        marca: '',
        precio: Math.round(precio),
        precioLista: null,
        moneda: 'CRC',
        disponible: /InStock|PreOrder/i.test(disponibilidad),
        url: BASE + lista[i].producturl,
        imagen: meta(html, 'image') || lista[i].productpictureurl || null,
        ean: meta(html, 'gtin') || null,
        categoria: '',
      });
    });
    return ofertas;
  },
};
