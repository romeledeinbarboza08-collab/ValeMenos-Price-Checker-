// Volver a consultar un producto guardado (ficha, Mi compra, seguidos).
// Se repite la búsqueda original y se busca el mismo grupo:
//   1) por su clave, 2) si la clave cambió, por las URLs de tienda que comparten.
import { buscarEnVivo } from './api.js';
import { resumirGrupos } from './core/emparejamiento.js';

export function encontrarGrupo(grupos, { clave, ofertas = [] }) {
  const exacto = grupos.find((g) => g.clave === clave);
  if (exacto) return exacto;
  const urls = new Set(ofertas.map((o) => o.url));
  let mejor = null;
  let mejorComunes = 0;
  for (const g of grupos) {
    const comunes = g.ofertas.filter((o) => urls.has(o.url)).length;
    if (comunes > mejorComunes) { mejor = g; mejorComunes = comunes; }
  }
  return mejor;
}

export async function consultarProducto(guardado, { fresco = false, senal, alRecibir } = {}) {
  const respuestas = await buscarEnVivo(guardado.consulta, { fresco, senal, alRecibir });
  const ofertas = respuestas.flatMap((r) => r.ofertas || []);
  const grupos = resumirGrupos(ofertas, guardado.consulta);
  return { grupo: encontrarGrupo(grupos, guardado), grupos, respuestas };
}
