// Piezas de interfaz reutilizables. Todas devuelven HTML ya escapado (plantilla `html`).
import { html, crudo, dinero, partesDinero, fechaCorta } from './formato.js';
import { TIENDAS } from './core/tiendas.js';

// Todos los íconos: 24×24 con trazo de 1.75 (se muestran a 20 px).
const svg = (cuerpo) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${cuerpo}</svg>`;

export const ICONOS = {
  externo: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  carrito: svg('<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20.5" r="1.2"/><circle cx="17" cy="20.5" r="1.2"/>'),
  listo: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  campana: svg('<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
  refrescar: svg('<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4"/>'),
  columnas: svg('<rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/>'),
  escudo: svg('<path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6Z"/><path d="m9 12 2 2 4-4"/>'),
  duda: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.5V14"/><circle cx="12" cy="17.2" r=".6" fill="currentColor"/>'),
  caja: svg('<path d="m3 7.5 9-4.5 9 4.5v9L12 21l-9-4.5Z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>'),
  filtro: svg('<path d="M4 6h16M7 12h10M10 18h4"/>'),
  basura: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  lupa: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
  reloj: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  camara: svg('<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z"/><circle cx="12" cy="13" r="3.5"/>'),
  codigo: svg('<path d="M4 6v12M7 6v12M10.5 6v12M14 6v12M16.5 6v12M20 6v12"/>'),
  enlace: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  texto: svg('<path d="M5 6h14M12 6v13M9 19h6"/>'),
  corazon: svg('<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"/>'),
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Zm0 16.4a7.4 7.4 0 0 1-3.8-1l-.3-.2-2.7.7.7-2.6-.2-.3A7.4 7.4 0 1 1 12 19.4Zm4.1-5.5c-.2-.1-1.3-.7-1.5-.7-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6 6 0 0 1-3-2.6c-.2-.4.2-.4.6-1.2.1-.1 0-.3 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.4a.8.8 0 0 0-.6.3 2.5 2.5 0 0 0-.8 1.9 4.4 4.4 0 0 0 .9 2.3 10 10 0 0 0 3.8 3.4c1.4.6 2 .6 2.7.5.4-.1 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1l-.4-.4Z"/></svg>',
  billetera: svg('<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16 14.5h2"/>'),
  chispa: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>'),
  cerrar: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  flecha: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  // Categorías
  celular: svg('<rect x="7" y="3" width="10" height="18" rx="2.2"/><path d="M11 18h2"/>'),
  laptop: svg('<rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M3 18.5h18"/>'),
  tele: svg('<rect x="3" y="5" width="18" height="12" rx="1.8"/><path d="M9 20.5h6M12 17v3.5"/>'),
  audifonos: svg('<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4" height="6.5" rx="1.5"/><rect x="16.5" y="14" width="4" height="6.5" rx="1.5"/>'),
  consola: svg('<path d="M7 8h10a4 4 0 0 1 4 4.5l-.6 3.8a2.3 2.3 0 0 1-4 1.1L15 16H9l-1.4 1.4a2.3 2.3 0 0 1-4-1.1L3 12.5A4 4 0 0 1 7 8Z"/><path d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01"/>'),
  freidora: svg('<path d="M6 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19Z"/><path d="M6 10h12M9 14h6"/><circle cx="12" cy="7.5" r=".5" fill="currentColor"/>'),
  refri: svg('<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M6 10h12M9 6v2M9 13v3"/>'),
  reloj2: svg('<rect x="7" y="6" width="10" height="12" rx="2.5"/><path d="M9 6l.5-3h5l.5 3M9 18l.5 3h5l.5-3M12 10v2.2l1.4 1"/>'),
  libro: svg('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 1 4 17.5ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 0 1.5-1.5Z"/>'),
  casa: svg('<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1Z"/>'),
  escritorio: svg('<rect x="4" y="4" width="16" height="10" rx="1.5"/><path d="M12 14v4M8 20h8"/>'),
};

export const icono = (nombre) => crudo(ICONOS[nombre] || '');

export function nombreTienda(id) { return TIENDAS[id]?.nombre || id; }

// La etiqueta de precio (menta): SOLO para el precio ganador.
// `sello`: aparece con un "estampado" corto (scale 1.04 → 1). Se usa solo la primera vez.
export function etiqueta(colones, ctx, { rotulo = 'Mejor total', pie = '', grande = false, sello = false } = {}) {
  const { simbolo, numero } = partesDinero(colones, ctx);
  const clases = ['etiqueta', grande && 'etiqueta--grande', sello && 'sella'].filter(Boolean).join(' ');
  return html`<div class="${clases}">
    <span class="etiqueta__rotulo">${rotulo}</span>
    <span class="etiqueta__precio">${simbolo}${numero}</span>
    ${pie ? html`<span class="etiqueta__pie">${pie}</span>` : ''}
  </div>`;
}

// Cualquier otro precio: texto normal, sin etiqueta.
export function precio(colones, ctx, { rotulo = '', pie = '' } = {}) {
  return html`<div class="precio">
    ${rotulo ? html`<span class="precio__rotulo">${rotulo}</span>` : ''}
    <span class="precio__monto">${dinero(colones, ctx)}</span>
    ${pie ? html`<span class="precio__pie">${pie}</span>` : ''}
  </div>`;
}

export function foto(src, alt) {
  if (!src) return html`<div class="foto" aria-hidden="true">${icono('caja')}</div>`;
  return html`<div class="foto"><img src="${src}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-respaldo></div>`;
}

// Si la imagen de la tienda no carga, se cambia por un ícono neutro.
export function activarRespaldoImagenes(raiz) {
  raiz.querySelectorAll('img[data-respaldo]').forEach((img) => {
    img.removeAttribute('data-respaldo');
    img.addEventListener('error', () => {
      const caja = document.createElement('span');
      caja.innerHTML = ICONOS.caja;
      img.replaceWith(caja.firstChild);
    }, { once: true });
  });
}

// Datos cortos del producto: 256 GB · 12 GB RAM · 3 colores
export function datosProducto(g) {
  const a = g.atributos || {};
  const d = [];
  if (a.almacenamiento) d.push(a.almacenamiento >= 1024 ? `${a.almacenamiento / 1024} TB` : `${a.almacenamiento} GB`);
  if (a.ram) d.push(`${a.ram} GB RAM`);
  if (a.pulgadas && a.pulgadas >= 10) d.push(`${a.pulgadas}″`);
  if (a.litros) d.push(`${String(a.litros).replace('.', ',')} L`);
  if (g.colores?.length > 1) d.push(`${g.colores.length} colores`);
  else if (g.colores?.length === 1) d.push(g.colores[0]);
  return d;
}

// Respuesta de una tienda -> estado para la tira: listo, vacio, nodisponible (403, gris) o error (rojo).
export function estadoDeRespuesta(r) {
  if (r.ok) return { estado: (r.ofertas || []).length ? 'listo' : 'vacio', cantidad: new Set((r.ofertas || []).map((o) => o.clave)).size, ms: r.ms };
  return { estado: r.noDisponible ? 'nodisponible' : 'error', error: r.error };
}

// Estado en vivo de cada tienda. Cada una lleva su punto de color.
// `recien`: tiendas que acaban de responder; dan un pequeño rebote una sola vez.
export function tiraTiendas(estados, recien = new Set()) {
  return html`<ul class="tira" aria-label="Estado de cada tienda">
    ${Object.values(TIENDAS).map((t) => {
      const e = estados[t.id] || { estado: 'cargando' };
      let detalle = 'buscando';
      if (e.estado === 'listo') detalle = String(e.cantidad);
      if (e.estado === 'vacio') detalle = '0';
      if (e.estado === 'error') detalle = 'sin respuesta';
      if (e.estado === 'nodisponible') detalle = 'No disponible';
      const titulo = e.error ? e.error : e.ms ? `${e.ms} ms` : '';
      return html`<li data-estado="${e.estado}" ${recien.has(t.id) ? 'data-recien' : ''} title="${titulo}"><i class="punto" style="background:${t.color}" aria-hidden="true"></i><b>${t.nombre}</b><span>${detalle}</span></li>`;
    })}
  </ul>`;
}

export function medidor(v, ctx) {
  if (v.nivel === 'sin-datos') {
    return html`<div class="medidor panel">
      <div class="medidor__cab"><span class="t-3">¿Conviene comprarlo hoy?</span></div>
      <div class="medidor__veredicto" data-nivel="sin-datos">${v.texto}</div>
      <p style="margin:0">${v.detalle}</p>
    </div>`;
  }
  const dif = Math.round(Math.abs(v.diferencia) * 100);
  const comparado = v.diferencia < 0 ? `${dif} % por debajo` : v.diferencia > 0 ? `${dif} % por encima` : 'igual a';
  return html`<div class="medidor panel">
    <div class="medidor__cab">
      <span class="t-3">¿Conviene comprarlo hoy?</span>
      <span class="tenue">últimos ${v.dias} días</span>
    </div>
    <div class="medidor__veredicto" data-nivel="${v.nivel}">${v.texto}</div>
    <div class="medidor__barra" role="img" aria-label="${v.texto}: ${comparado} del precio típico">
      <span></span><span></span><span></span>
      <i style="left:${(v.posicion * 100).toFixed(1)}%"></i>
    </div>
    <div class="medidor__escala" aria-hidden="true"><span>Más barato que lo usual</span><span>Más caro</span></div>
    <p>El precio más bajo de hoy está ${comparado} de su precio típico (${dinero(v.tipico, ctx)}). El mínimo del mes fue ${dinero(v.minimo, ctx)}.</p>
  </div>`;
}

// Gráfico de historial: una línea por tienda. SVG hecho a mano.
export function graficoHistorial(series, ctx, ancho = 720) {
  const todas = series.flatMap((s) => s.puntos);
  if (todas.length < 2) return null;
  const W = Math.max(300, Math.round(ancho)); const H = W < 500 ? 200 : 240; const izq = 74; const der = 16; const arr = 12; const abj = 28;
  const ts = todas.map((p) => Date.parse(p.t));
  const ps = todas.map((p) => p.p);
  let t0 = Math.min(...ts); let t1 = Math.max(...ts);
  if (t1 - t0 < 86_400_000) { t0 -= 43_200_000; t1 += 43_200_000; }
  let p0 = Math.min(...ps); let p1 = Math.max(...ps);
  const margen = Math.max((p1 - p0) * 0.12, p1 * 0.02);
  p0 -= margen; p1 += margen;
  const X = (t) => izq + ((t - t0) / (t1 - t0)) * (W - izq - der);
  const Y = (p) => arr + (1 - (p - p0) / (p1 - p0)) * (H - arr - abj);

  // Marcas en números redondos (1, 2 o 5 por potencia de 10).
  const bruto = (p1 - p0) / 4;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 5, 10].map((m) => m * pot).find((x) => x >= bruto);
  const marcasY = [];
  for (let v = Math.ceil(p0 / paso) * paso; v <= p1; v += paso) marcasY.push(v);
  const dias = Math.max(1, Math.round((t1 - t0) / 86_400_000));
  const pasoDias = (dias > 60 ? 14 : dias > 20 ? 7 : dias > 6 ? 2 : 1) * (W < 500 ? 2 : 1);
  const marcasX = [];
  for (let t = t0; t <= t1; t += pasoDias * 86_400_000) marcasX.push(t);

  const lineas = series.map((s) => {
    const pts = s.puntos.map((p) => `${X(Date.parse(p.t)).toFixed(1)},${Y(p.p).toFixed(1)}`);
    const ultimo = s.puntos.at(-1);
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${X(Date.parse(ultimo.t)).toFixed(1)}" cy="${Y(ultimo.p).toFixed(1)}" r="3.5" fill="${s.color}"/>`;
  }).join('');

  const dibujo = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Historial de precios por tienda">
    ${marcasY.map((p) => `<line x1="${izq}" x2="${W - der}" y1="${Y(p).toFixed(1)}" y2="${Y(p).toFixed(1)}" stroke="#e5e7eb"/><text x="${izq - 8}" y="${(Y(p) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#6b7280">${dinero(p, ctx)}</text>`).join('')}
    ${marcasX.map((t) => `<text x="${X(t).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#6b7280">${fechaCorta(new Date(t).toISOString())}</text>`).join('')}
    ${lineas}
  </svg>`;

  return html`<div class="grafico panel">
    <ul class="grafico__leyenda">${series.map((s) => html`<li><i style="background:${s.color}"></i>${s.nombre}</li>`)}</ul>
    ${crudo(dibujo)}
  </div>`;
}

// Mensaje listo para WhatsApp con el mejor precio.
export function enlaceWhatsApp(titulo, total, tienda, ctx, url = location.href) {
  const texto = `${titulo}: ${dinero(total, ctx)} con envío en ${nombreTienda(tienda)}. Lo vi en Vale Menos ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

// Avisos flotantes ("Agregado a Mi lista · Ver")
export function avisar(texto, accion) {
  const cont = document.getElementById('avisos');
  const div = document.createElement('div');
  div.className = 'aviso';
  div.innerHTML = '<span></span>';
  div.firstChild.textContent = texto;
  if (accion) {
    const a = document.createElement('a');
    a.href = accion.href;
    a.textContent = accion.texto;
    div.appendChild(a);
  }
  cont.appendChild(div);
  while (cont.children.length > 2) cont.firstChild.remove(); // máximo dos a la vez
  setTimeout(() => div.remove(), 4200);
}

/* ------------------------------------------------------------------
 * Tooltip propio para los botones que solo tienen ícono (atributo data-tip).
 * Sale DEBAJO del botón; si no cabe, arriba; y nunca se sale de la pantalla.
 * Con mouse aparece al pasar por encima; con teclado, al enfocar.
 * En pantallas táctiles no aparece (los botones ya tienen aria-label).
 * ------------------------------------------------------------------ */
export function activarTooltips() {
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.setAttribute('aria-hidden', 'true'); // el texto ya está en el aria-label del botón
  tip.hidden = true;
  document.body.appendChild(tip);
  let actual = null;
  const MARGEN = 8;

  function mostrar(el) {
    actual = el;
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    let arriba = r.bottom + MARGEN;                                   // abajo por defecto
    if (arriba + t.height > innerHeight - MARGEN) arriba = r.top - t.height - MARGEN;
    let izq = r.left + r.width / 2 - t.width / 2;                      // centrado
    izq = Math.max(MARGEN, Math.min(izq, innerWidth - t.width - MARGEN)); // sin salirse
    tip.style.transform = `translate(${Math.round(izq)}px, ${Math.round(Math.max(MARGEN, arriba))}px)`;
  }
  function ocultar() { actual = null; tip.hidden = true; }

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest('[data-tip]');
    if (el && el !== actual) mostrar(el);
  });
  document.addEventListener('pointerout', (e) => {
    if (actual && !actual.contains(e.relatedTarget)) ocultar();
  });
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (el && el.matches(':focus-visible')) mostrar(el); else ocultar();
  });
  document.addEventListener('focusout', ocultar);
  window.addEventListener('scroll', ocultar, { passive: true });
  document.addEventListener('click', ocultar);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ocultar(); });
}

// Las secciones marcadas con .revela aparecen una sola vez al entrar en pantalla.
let observador = null;
export function revelar(raiz) {
  const els = raiz.querySelectorAll('.revela:not(.visible)');
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('visible')); return; }
  observador ??= new IntersectionObserver((entradas) => {
    entradas.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); observador.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -10% 0px' });
  els.forEach((e) => observador.observe(e));
}

// Cuenta de 0 al número final (el ahorro). Con "reducir movimiento" pone el número de una vez.
export function contarHasta(el, final, formato) {
  if (!el) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = formato(final); return; }
  const t0 = performance.now(); const dur = 700;
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = formato(Math.round(final * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}
