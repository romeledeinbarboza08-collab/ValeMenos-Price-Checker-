// GET /api/enlace?url=https://www.gollo.com/iphone-15-...-1008/p
// Pegás el enlace de un producto y te decimos qué buscar para compararlo.
// Por seguridad SOLO se abren páginas de las tiendas conectadas; para cualquier otro sitio
// se usan las palabras de la dirección, sin visitarla.

import { pedir } from '../lib/http.js';
import { TIENDAS } from '../../public/js/core/tiendas.js';
import { sinEntidades } from '../lib/tiendas/woocommerce.js';

const HOSTS = new Map(Object.values(TIENDAS).map((t) => [new URL(t.sitio).hostname.replace(/^www\./, ''), t.id]));
const RUIDO = /\b(p|producto|productos|product|products|item|dp|celular|es|cr|html?|www|com)\b/gi;

function desdeRuta(url) {
  const ruta = decodeURIComponent(url.pathname).split('/').filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] || '';
  return ruta.replace(/\.[a-z]+$/, '').replace(/[-_+]/g, ' ').replace(/\b\d{5,}\b/g, '')
    .replace(RUIDO, '').replace(/\s+/g, ' ').trim().split(' ').slice(0, 7).join(' ');
}

export default async (req) => {
  let url;
  try { url = new URL(new URL(req.url).searchParams.get('url') || ''); } catch { /* inválida */ }
  if (!url || !/^https?:$/.test(url.protocol)) return Response.json({ error: 'Pegá un enlace completo, que empiece con https://' }, { status: 400 });

  const host = url.hostname.replace(/^www\./, '');
  const tienda = HOSTS.get(host) || null;
  let titulo = null;
  if (tienda) {
    try {
      const html = await pedir(url.href, { json: false, tiempo: 4000 });
      titulo = sinEntidades((html.match(/property="og:title"\s+content="([^"]+)"/) || html.match(/<title>([^<]+)<\/title>/) || [])[1] || '')
        .replace(/\s*[|–-]\s*[^|–-]+$/, '').trim() || null;
    } catch { /* usamos la ruta */ }
  }
  const consulta = (titulo || desdeRuta(url)).split(' ').slice(0, 7).join(' ');
  if (consulta.length < 3) return Response.json({ error: 'No logramos entender qué producto es ese enlace. Probá escribiendo el nombre.' }, { status: 422 });
  return Response.json({ tienda, titulo, consulta });
};

export const config = { path: '/api/enlace' };
