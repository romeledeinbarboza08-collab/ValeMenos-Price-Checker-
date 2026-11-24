// Cambiar de página sin recargar (el enrutador escucha el cambio de hash).
export function ir(ruta) { location.hash = '#' + ruta; }

export const enlaceBusqueda = (q) => `#/buscar?q=${encodeURIComponent(q)}`;
export const enlaceProducto = (clave, q) => `#/producto?c=${encodeURIComponent(clave)}&q=${encodeURIComponent(q)}`;

// Búsqueda que vino de un código de barras. `alternativas` son las consultas de respaldo
// (cada vez más cortas) que se prueban si esta no trae nada; `respaldo` marca que esta ya es una.
export function enlaceCodigo({ q, ean, alternativas = [], respaldo = false }) {
  const p = new URLSearchParams({ q, via: 'codigo' });
  if (ean) p.set('ean', ean);
  alternativas.filter((a) => a && a !== q).forEach((a) => p.append('alt', a));
  if (respaldo) p.set('respaldo', '1');
  return `#/buscar?${p.toString().replace(/\+/g, '%20')}`;
}
