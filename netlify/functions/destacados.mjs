// GET /api/destacados -> { generado, items: [...] }
// Lo que dejó la última "foto de precios". Si todavía no hay, responde una lista vacía
// y la portada muestra búsquedas populares en su lugar (nunca datos inventados).

export default async () => {
  let datos = { generado: null, items: [] };
  try {
    const { getStore } = await import('@netlify/blobs');
    datos = (await getStore({ name: 'portada' }).get('destacados', { type: 'json' })) || datos;
  } catch { /* local o sin datos */ }
  return Response.json(datos, {
    headers: { 'Cache-Control': 'public, max-age=0, must-revalidate', 'Netlify-CDN-Cache-Control': 'public, s-maxage=900' },
  });
};

export const config = { path: '/api/destacados' };
