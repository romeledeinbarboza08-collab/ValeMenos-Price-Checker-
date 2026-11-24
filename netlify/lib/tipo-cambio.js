// Tipo de cambio oficial (referencia del BCCR) publicado por el Ministerio de Hacienda.
// No requiere token. Si falla, se usa el último valor bueno y se avisa en la respuesta.

import { pedir } from './http.js';

const URL_HACIENDA = 'https://api.hacienda.go.cr/indicadores/tc/dolar';
const RESPALDO = { venta: 455, compra: 450, fecha: null, respaldo: true };

let enMemoria = null; // { datos, hora }

export async function obtenerTipoCambio() {
  // Dentro de la misma instancia de la función, lo reutilizamos una hora.
  if (enMemoria && Date.now() - enMemoria.hora < 60 * 60 * 1000) return enMemoria.datos;
  try {
    const d = await pedir(URL_HACIENDA, { tiempo: 3000 });
    const datos = {
      venta: Number(d.venta.valor),
      compra: Number(d.compra.valor),
      fecha: d.venta.fecha,
      fuente: 'Ministerio de Hacienda (referencia del BCCR)',
      respaldo: false,
    };
    if (!datos.venta) throw new Error('respuesta sin valor');
    enMemoria = { datos, hora: Date.now() };
    return datos;
  } catch {
    return enMemoria?.datos ? { ...enMemoria.datos, respaldo: true } : { ...RESPALDO, fuente: 'valor de respaldo' };
  }
}
