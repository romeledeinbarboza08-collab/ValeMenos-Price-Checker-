// GET /api/historial?k=walmart/<clave>&k=icon/<clave>
// Devuelve { "walmart/<clave>": [{ t, p }, ...], ... }
import { leerHistorial } from '../lib/historial.js';

export default async (req) => {
  const llaves = new URL(req.url).searchParams.getAll('k').filter(Boolean).slice(0, 20);
  if (!llaves.length) return Response.json({ error: 'Falta indicar qué historial querés.' }, { status: 400 });
  const datos = await leerHistorial(llaves);
  return Response.json(datos, {
    headers: { 'Cache-Control': 'public, max-age=0, must-revalidate', 'Netlify-CDN-Cache-Control': 'public, s-maxage=600' },
  });
};

export const config = { path: '/api/historial' };
