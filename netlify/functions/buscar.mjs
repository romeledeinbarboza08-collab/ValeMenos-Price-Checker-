// GET /api/buscar?q=iphone 17&tienda=walmart   -> ofertas de UNA tienda (lo usa el sitio)
// GET /api/buscar?q=iphone 17                  -> todas las tiendas, ya agrupadas
//
// La CDN de Netlify guarda cada respuesta 5 minutos: 50 personas buscando lo mismo no
// generan 50 consultas a cada tienda. "Refrescar ahora" agrega &fresco=<hora> y se lo salta.

import { buscarEnTienda, buscarEnTiendas, CONECTORES } from '../lib/buscar.js';
import { registrarOfertas } from '../lib/historial.js';

const CACHE_OK = 'public, durable, s-maxage=300, stale-while-revalidate=300';

export default async (req, context) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const tienda = url.searchParams.get('tienda');

  if (q.length < 2) return Response.json({ error: 'Escribí al menos 2 letras para buscar.' }, { status: 400 });
  if (tienda && !CONECTORES[tienda]) return Response.json({ error: 'Esa tienda no está conectada.' }, { status: 404 });

  if (tienda) {
    const r = await buscarEnTienda(tienda, q);
    // Guardar precios para el historial sin hacer esperar a la persona.
    const tarea = registrarOfertas(r.ofertas);
    if (context?.waitUntil) context.waitUntil(tarea); else await tarea;
    return Response.json({ consulta: q, generado: new Date().toISOString(), ...r }, {
      headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control': r.ok ? CACHE_OK : 'no-store',
      },
    });
  }

  const r = await buscarEnTiendas(q);
  return Response.json(r, {
    headers: { 'Cache-Control': 'public, max-age=0, must-revalidate', 'Netlify-CDN-Cache-Control': CACHE_OK },
  });
};

export const config = { path: '/api/buscar' };
