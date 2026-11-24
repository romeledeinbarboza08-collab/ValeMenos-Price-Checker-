// GET /api/tipo-cambio  ->  { venta, compra, fecha, fuente, respaldo }
import { obtenerTipoCambio } from '../lib/tipo-cambio.js';

export default async () => {
  const datos = await obtenerTipoCambio();
  return Response.json(datos, {
    headers: {
      'Cache-Control': 'public, max-age=600',
      'Netlify-CDN-Cache-Control': datos.respaldo ? 'no-store' : 'public, durable, s-maxage=3600',
    },
  });
};

export const config = { path: '/api/tipo-cambio' };
