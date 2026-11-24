// GET /api/codigo?ean=7501035911208
// Convierte un código de barras en algo que se pueda buscar en las tiendas.
// Pregunta en orden a UPCitemdb, Open Food Facts, Open Beauty Facts y Open Products Facts
// (ver netlify/lib/codigo.js). Si ninguna lo conoce, se busca el número tal cual.

import { buscarCodigo } from '../lib/codigo.js';

export default async (req) => {
  const ean = (new URL(req.url).searchParams.get('ean') || '').replace(/\D/g, '');
  if (ean.length < 8 || ean.length > 14) return Response.json({ error: 'Ese código no parece válido.' }, { status: 400 });

  const r = await buscarCodigo(ean);
  // Solo guardamos en caché lo que sí se encontró: un código desconocido hoy puede aparecer mañana.
  return Response.json(r, r.producto ? { headers: { 'Netlify-CDN-Cache-Control': 'public, s-maxage=604800' } } : undefined);
};

export const config = { path: '/api/codigo' };
