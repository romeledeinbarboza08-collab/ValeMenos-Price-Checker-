// Formato de precios, fechas y HTML seguro.

// Los títulos vienen de las tiendas: siempre se escapan antes de meterlos al HTML.
export function escapar(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Plantilla `html` que escapa todo lo interpolado salvo lo marcado con crudo().
class Crudo { constructor(t) { this.t = t; } toString() { return this.t; } }
export const crudo = (t) => new Crudo(t);
export function html(partes, ...valores) {
  let out = partes[0];
  valores.forEach((v, i) => {
    if (Array.isArray(v)) out += v.map((x) => (x instanceof Crudo ? x.t : escapar(x))).join('');
    else if (v instanceof Crudo) out += v.t;
    else if (v === false || v == null) out += '';
    else out += escapar(v);
    out += partes[i + 1];
  });
  return crudo(out);
}

// 509900 -> "509.900" (formato costarricense: punto para miles)
function miles(n, decimales = 0) {
  const fijo = Math.abs(n).toFixed(decimales);
  const [ent, dec] = fijo.split('.');
  const conPuntos = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '−' : '') + conPuntos + (dec && Number(dec) !== 0 ? ',' + dec : '');
}

// colones -> texto en la moneda elegida
export function dinero(colones, { moneda = 'CRC', tasa = 455 } = {}) {
  if (colones == null || Number.isNaN(colones)) return '—';
  if (moneda === 'USD') {
    const d = colones / tasa;
    return '$' + miles(d, d < 100 ? 2 : 0);
  }
  return '₡' + miles(Math.round(colones));
}

export function partesDinero(colones, { moneda = 'CRC', tasa = 455 } = {}) {
  const texto = dinero(colones, { moneda, tasa });
  return { simbolo: texto.replace(/[\d.,−]+/g, '').trim(), numero: texto.replace(/[^\d.,−]/g, '') };
}

export function porcentaje(x) {
  return `${Math.round(x * 100)} %`;
}

export function haceCuanto(fechaISO) {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(fechaISO)) / 1000));
  if (s < 45) return 'hace unos segundos';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
export function fechaCorta(fechaISO) {
  const f = new Date(fechaISO);
  return `${f.getDate()} ${MESES[f.getMonth()]}`;
}

export function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}
