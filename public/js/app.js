// Punto de entrada: enrutador por hash (#/buscar?q=…), encabezado y barra móvil.
import { estado, suscribir, cambiarZona, cambiarMoneda, fijarTasa } from './estado.js';
import { obtenerTipoCambio } from './api.js';
import { crearBuscador } from './autocompletar.js';
import { activarRespaldoImagenes, activarTooltips, revelar } from './ui.js';
import { abrirCaptura } from './captura.js';
import { ir } from './navegacion.js';

import * as inicio from './vistas/inicio.js';
import * as buscar from './vistas/buscar.js';
import * as producto from './vistas/producto.js';
import * as compra from './vistas/compra.js';
import * as comparar from './vistas/comparar.js';
import * as tiendas from './vistas/tiendas.js';
import * as presupuesto from './vistas/presupuesto.js';
import * as favoritos from './vistas/favoritos.js';
import { sobre, ayuda, terminos, privacidad } from './vistas/paginas.js';

const RUTAS = {
  '/': inicio,
  '/buscar': buscar,
  '/producto': producto,
  '/mi-lista': compra,
  '/mi-compra': compra, // enlaces viejos
  '/comparar': comparar,
  '/tiendas': tiendas,
  '/presupuesto': presupuesto,
  '/favoritos': favoritos,
  '/sobre': sobre,
  '/ayuda': ayuda,
  '/terminos': terminos,
  '/privacidad': privacidad,
};

const vista = document.getElementById('vista');
let controlador = null;
let rutaActual = null;

function leerHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [ruta, qs = ''] = h.split('?');
  return { ruta: ruta || '/', params: new URLSearchParams(qs) };
}

async function mostrar() {
  const { ruta, params } = leerHash();
  const modulo = RUTAS[ruta];
  controlador?.abort();
  controlador = new AbortController();

  const cambioDePagina = ruta !== rutaActual;
  rutaActual = ruta;
  const nombre = ruta.slice(1) || 'inicio';
  document.body.dataset.ruta = nombre;
  document.title = 'Vale Menos · Lo mismo, pero vale menos.';
  buscadorEncabezado.fijar(ruta === '/buscar' ? params.get('q') || '' : '');
  marcarNavegacion(nombre, params);

  if (!modulo) {
    vista.innerHTML = `<section class="contenedor pagina"><h1 class="t-1">No encontramos esa página</h1><p>Puede que el enlace esté incompleto. <a href="#/">Volver al inicio</a>.</p></section>`;
    return;
  }
  try {
    await modulo.mostrar({ raiz: vista, params, senal: controlador.signal });
    activarRespaldoImagenes(vista);
    revelar(vista);
  } catch (e) {
    if (e.name === 'AbortError') return;
    console.error(e);
    vista.innerHTML = `<section class="contenedor pagina"><h1 class="t-1">Algo falló al mostrar esta página</h1><p>Recargá la página. Si sigue pasando, probá otra búsqueda.</p></section>`;
  }
  if (cambioDePagina) {
    window.scrollTo(0, 0);
    vista.focus({ preventScroll: true });
  }
}

// Marca la página actual en la fila de categorías, el encabezado y la barra móvil.
// Una categoría queda marcada si la búsqueda actual es justo la de esa categoría.
function marcarNavegacion(nombre, params) {
  const busqueda = nombre === 'buscar' ? params.get('q') : null;
  document.querySelectorAll('.nav-categorias a, .accion-enlace, .barra-movil a').forEach((a) => {
    const [ruta, qs = ''] = a.getAttribute('href').replace(/^#\//, '').split('?');
    const destino = ruta || 'inicio';
    const igual = destino === 'buscar'
      ? busqueda !== null && new URLSearchParams(qs).get('q') === busqueda
      : destino === nombre || (nombre === 'mi-compra' && destino === 'mi-lista');
    if (igual) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

/* ---------- Encabezado ---------- */
// `captura: true` pone los botones de cámara y código de barras dentro del campo.
const buscadorEncabezado = crearBuscador(document.getElementById('buscar-encabezado'), {
  captura: true,
  alBuscar: (q) => ir(`/buscar?q=${encodeURIComponent(q)}`),
});

/* ---------- Envío y moneda: un solo botón que abre un menú pequeño ---------- */
const preferencias = document.getElementById('preferencias');
const botonPref = preferencias.querySelector('.preferencias__boton');
const menuPref = document.getElementById('preferencias-menu');

// El botón muestra solo lo corto ("GAM · ₡"); el texto largo vive en el menú y en el aria-label.
function pintarPreferencias() {
  const zona = estado.zona === 'gam' ? 'GAM' : 'Fuera GAM';
  const moneda = estado.moneda === 'USD' ? '$' : '₡';
  document.getElementById('preferencias-texto').textContent = `${zona} · ${moneda}`;
  botonPref.setAttribute('aria-label', `Envío ${estado.zona === 'gam' ? 'dentro de la GAM' : 'fuera de la GAM'}, precios en ${estado.moneda === 'USD' ? 'dólares' : 'colones'}. Cambiar`);
  menuPref.querySelectorAll('input[name="zona"]').forEach((r) => { r.checked = r.value === estado.zona; });
  menuPref.querySelectorAll('input[name="moneda"]').forEach((r) => { r.checked = r.value === estado.moneda; });
}

function abrirPreferencias(abrir) {
  menuPref.hidden = !abrir;
  botonPref.setAttribute('aria-expanded', String(abrir));
  if (abrir) menuPref.querySelector('input:checked')?.focus();
}

botonPref.addEventListener('click', () => abrirPreferencias(menuPref.hidden));
menuPref.addEventListener('change', (e) => {
  if (e.target.name === 'zona') cambiarZona(e.target.value);
  if (e.target.name === 'moneda') cambiarMoneda(e.target.value);
});
// El menú se cierra con Escape o al tocar fuera de él.
preferencias.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !menuPref.hidden) { abrirPreferencias(false); botonPref.focus(); }
});
document.addEventListener('click', (e) => {
  if (!menuPref.hidden && !preferencias.contains(e.target)) abrirPreferencias(false);
});
pintarPreferencias();

// Los contadores dan un saltito cuando cambian (no al cargar la página).
function pintarContadores(animar) {
  document.querySelectorAll('[data-contador]').forEach((el) => {
    const n = String(estado[el.dataset.contador].length || '');
    if (animar && n !== el.textContent) { el.classList.remove('salta'); void el.offsetWidth; el.classList.add('salta'); }
    el.textContent = n;
  });
}
pintarContadores(false);

// Encabezado fijo: al bajar gana un borde y se compacta (72 → 60 px, solo con transform).
const encabezado = document.querySelector('.encabezado');
const compactar = () => { encabezado.dataset.compacto = String(window.scrollY > 8); };
window.addEventListener('scroll', compactar, { passive: true });
compactar();

activarTooltips();

suscribir((cambio) => {
  if (cambio === 'compra' || cambio === 'seguidos') pintarContadores(true);
  if (cambio === 'zona' || cambio === 'moneda') pintarPreferencias();
});

// Botones de captura (foto, código, enlace) en cualquier parte de la página.
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-captura]');
  if (b) { e.preventDefault(); abrirCaptura(b.dataset.captura); }
});

window.addEventListener('hashchange', mostrar);
mostrar();

// Tipo de cambio del día (para convertir iCon y para mostrar en dólares).
obtenerTipoCambio().then((t) => {
  fijarTasa(t);
  const el = document.getElementById('pie-tasa');
  if (el && t.fecha && !t.respaldo) el.textContent = `Dólar de hoy: ₡${t.venta.toFixed(2).replace('.', ',')} (Ministerio de Hacienda)`;
});
