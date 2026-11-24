// Página de inicio
import { estado, contexto, anotarRevision, dejarDeSeguir } from '../estado.js';
import { crearBuscador } from '../autocompletar.js';
import { obtenerDestacados } from '../api.js';
import { html, dinero, haceCuanto } from '../formato.js';
import { etiqueta, precio, foto, icono, nombreTienda, activarRespaldoImagenes } from '../ui.js';
import { TIENDAS } from '../core/tiendas.js';
import { KITS } from '../core/presupuesto.js';
import { ir, enlaceBusqueda, enlaceProducto } from '../navegacion.js';
import { consultarProducto } from '../reencontrar.js';
import { avisarSiBajo } from './favoritos.js';

const ATAJOS = ['iPhone 17', 'Freidora de aire', 'Televisor 55', 'AirPods', 'Galaxy S25', 'PlayStation 5'];

// Categorías del inicio (ícono, nombre, búsqueda).
const CATEGORIAS = [
  ['celular', 'Celulares', 'celular'],
  ['laptop', 'Laptops', 'laptop'],
  ['tele', 'Televisores', 'televisor'],
  ['audifonos', 'Audio', 'audifonos inalambricos'],
  ['consola', 'Consolas', 'consola'],
  ['freidora', 'Cocina', 'freidora de aire'],
  ['refri', 'Línea blanca', 'refrigeradora'],
  ['reloj2', 'Relojes', 'reloj inteligente'],
];

const ICONO_KIT = { clases: 'libro', apartamento: 'casa', setup: 'escritorio' };

// "Walmart, MaxiPalí, … e iCon"
const listaTiendas = () => {
  const n = Object.values(TIENDAS).map((t) => t.nombre);
  return `${n.slice(0, -1).join(', ')} e ${n.at(-1)}`;
};

export async function mostrar({ raiz, senal }) {
  const ctx = contexto();

  raiz.innerHTML = String(html`
    <section class="portada" aria-labelledby="t-portada">
      <div class="contenedor">
        <div class="portada__bloque">
          <div class="portada__texto">
            <h1 class="t-hero" id="t-portada">Lo mismo, pero vale menos.</h1>
            <p class="portada__bajada">Buscá un producto y te decimos en qué tienda de Costa Rica sale más barato, con el envío incluido.</p>
            <div class="portada__busqueda" id="buscar-portada"></div>
            <p class="portada__tiendas">Comparamos en vivo ${listaTiendas()}</p>
            <div class="atajos">
              ${ATAJOS.map((a) => html`<a class="chip-enlace" href="${enlaceBusqueda(a.toLowerCase())}">${a}</a>`)}
              <button type="button" class="enlace-boton" data-captura="enlace">${icono('enlace')}Pegar enlace</button>
            </div>
          </div>
          <!-- Etiqueta de marca. Si hay datos reales, muestra la mejor oferta de hoy; nunca un precio inventado. -->
          <div class="portada__oferta" id="hero-oferta">
            <div class="etiqueta etiqueta--grande etiqueta--marca">
              <span class="etiqueta__rotulo">Siempre te mostramos el</span>
              <span class="etiqueta__precio">mejor total</span>
              <span class="etiqueta__pie">con el envío incluido</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div id="destacados"></div>

    <section class="contenedor seccion revela" aria-labelledby="t-categorias">
      <div class="seccion__cab"><h2 class="t-2" id="t-categorias">Explorá por categoría</h2></div>
      <ul class="categorias">
        ${CATEGORIAS.map(([ic, nombre, q]) => html`<li><a class="categoria" href="${enlaceBusqueda(q)}"><span class="categoria__icono">${icono(ic)}</span><span>${nombre}</span></a></li>`)}
      </ul>
    </section>

    <div id="vistos"></div>
    <div id="seguidos"></div>

    <div class="contenedor seccion revela">
      <section class="franja" aria-labelledby="t-presupuesto">
        <div class="franja__grid">
          <div>
            <h2 class="t-2" id="t-presupuesto">Con presupuesto</h2>
            <p>Decinos cuánto tenés y qué necesitás. Te armamos la compra sin pasarte.</p>
            <a class="boton boton--blanco" href="#/presupuesto">Armar mi compra${icono('flecha')}</a>
          </div>
          <ul class="kits">
            ${KITS.map((k) => html`<li><a class="kit" href="#/presupuesto?kit=${k.id}">
              <span class="kit__icono">${icono(ICONO_KIT[k.id] || 'caja')}</span>
              <span class="kit__texto"><b>${k.nombre}</b><small>${k.descripcion}</small></span>
              <span class="kit__monto num">${dinero(k.presupuesto, ctx)}</span>
            </a></li>`)}
          </ul>
        </div>
      </section>
    </div>

    <section class="banda banda--gris revela" aria-labelledby="t-pasos">
      <div class="contenedor">
        <h2 class="solo-lector" id="t-pasos">Cómo funciona</h2>
        <ol class="pasos">
          <li><span class="pasos__icono">${icono('lupa')}</span><span><b>Buscá</b> por nombre, foto, código de barras o enlace.</span></li>
          <li><span class="pasos__icono">${icono('columnas')}</span><span><b>Comparamos</b> el mismo modelo en las ${Object.keys(TIENDAS).length} tiendas.</span></li>
          <li><span class="pasos__icono">${icono('carrito')}</span><span><b>Comprá</b> donde el total con envío sale más barato.</span></li>
        </ol>
      </div>
    </section>

    <section class="tiendas-linea revela" aria-label="Tiendas que comparamos">
      <div class="contenedor">
        <ul class="tiendas-puntos">${Object.values(TIENDAS).map((t) => html`<li><i class="punto" style="background:${t.color}" aria-hidden="true"></i>${t.nombre}</li>`)}</ul>
        <a href="#/tiendas">Tiendas y envíos</a>
      </div>
    </section>
  `);

  crearBuscador(raiz.querySelector('#buscar-portada'), {
    grande: true,
    captura: true,
    alBuscar: (q) => ir(`/buscar?q=${encodeURIComponent(q)}`),
  });
  vigilarBuscadorDelHero(raiz.querySelector('#buscar-portada'), senal);

  pintarVistos(raiz.querySelector('#vistos'), ctx);
  pintarDestacados(raiz, senal);
  await pintarSeguidos(raiz.querySelector('#seguidos'), senal);
}

// Un solo buscador visible a la vez: mientras el del hero se vea, el del encabezado
// se oculta (clase en <body>); cuando el del hero sale de la pantalla, aparece el otro.
function vigilarBuscadorDelHero(buscador, senal) {
  if (!('IntersectionObserver' in window)) return;
  document.body.classList.add('hero-visible'); // desde el primer cuadro, sin parpadeo
  const obs = new IntersectionObserver(([e]) => {
    document.body.classList.toggle('hero-visible', e.isIntersecting);
  }, { rootMargin: '-72px 0px 0px 0px' }); // descuenta el encabezado fijo
  obs.observe(buscador);
  senal.addEventListener('abort', () => { obs.disconnect(); document.body.classList.remove('hero-visible'); });
}

// "Donde más se ahorra hoy" + la mejor oferta en el hero. Sin datos reales, no se muestra nada inventado.
async function pintarDestacados(raiz, senal) {
  const caja = raiz.querySelector('#destacados');
  caja.innerHTML = String(html`<section class="banda banda--gris" aria-busy="true" aria-label="Cargando ofertas">
    <div class="contenedor"><div class="carrusel">${Array.from({ length: 4 }, () => html`<div class="esqueleto esqueleto--tarjeta" aria-hidden="true"></div>`)}</div></div>
  </section>`);
  let datos = {};
  try { datos = await obtenerDestacados(); } catch { /* sin datos */ }
  const { generado, items } = datos;
  if (senal.aborted) return;
  if (!items?.length) { caja.innerHTML = ''; return; }
  const ctx = contexto();

  // La mejor oferta de hoy, con su precio real, va en la etiqueta del hero.
  const mejor = items.reduce((a, b) => (b.ahorro > a.ahorro ? b : a));
  raiz.querySelector('#hero-oferta').innerHTML = String(html`<a class="oferta-hero" href="${enlaceProducto(mejor.clave, mejor.consulta)}">
    <span class="oferta-hero__foto">${mejor.imagen ? html`<img src="${mejor.imagen}" alt="" referrerpolicy="no-referrer" data-respaldo>` : icono('caja')}</span>
    <span class="oferta-hero__titulo">${mejor.titulo}</span>
    ${etiqueta(mejor.min, ctx, { rotulo: `Hoy en ${nombreTienda(mejor.tienda)}`, pie: 'mejor total con envío' })}
    <span class="chip chip--ahorro">Ahorrás ${dinero(mejor.ahorro, ctx)}</span>
  </a>`);

  caja.innerHTML = String(html`<section class="banda banda--gris" aria-labelledby="t-destacados">
    <div class="contenedor">
      <div class="seccion__cab">
        <h2 class="t-2" id="t-destacados">Donde más se ahorra hoy</h2>
        <span class="tenue">Revisado ${haceCuanto(generado)}</span>
      </div>
      <div class="carrusel">
        ${items.map((d) => html`<a class="tarjeta" href="${enlaceProducto(d.clave, d.consulta)}">
          <div class="tarjeta__foto">${d.imagen ? html`<img src="${d.imagen}" alt="" loading="lazy" referrerpolicy="no-referrer" data-respaldo>` : icono('caja')}</div>
          <div class="tarjeta__titulo">${d.titulo}</div>
          <div class="tarjeta__precio"><b class="num">${dinero(d.min, ctx)}</b><s class="num">${dinero(d.max, ctx)}</s></div>
          <div class="tarjeta__nota"><span class="chip chip--ahorro">Ahorrás ${dinero(d.ahorro, ctx)}</span><span>en ${nombreTienda(d.tienda)}</span></div>
        </a>`)}
      </div>
    </div>
  </section>`);
  activarRespaldoImagenes(raiz);
}

function pintarVistos(caja, ctx) {
  const vistos = estado.vistos.lista().map((x) => x.valor);
  if (!vistos.length) return;
  caja.innerHTML = String(html`
    <section class="contenedor seccion" aria-labelledby="vistos-titulo">
      <div class="seccion__cab"><h2 class="t-2" id="vistos-titulo">Vistos hace poco</h2></div>
      <div class="carrusel">
        ${vistos.map((v) => html`<a class="tarjeta" href="${enlaceProducto(v.clave, v.consulta)}">
          <div class="tarjeta__foto">${v.imagen ? html`<img src="${v.imagen}" alt="" loading="lazy" referrerpolicy="no-referrer" data-respaldo>` : icono('caja')}</div>
          <div class="tarjeta__titulo">${v.titulo}</div>
          <div class="tarjeta__precio"><span class="tenue">Desde</span><b class="num">${dinero(v.min, ctx)}</b></div>
        </a>`)}
      </div>
    </section>`);
}

async function pintarSeguidos(caja, senal) {
  if (!estado.seguidos.length) return;
  const ctx = contexto();
  const filas = estado.seguidos.slice(0, 4);

  const dibujar = (resultados = {}) => {
    caja.innerHTML = String(html`
      <section class="contenedor seccion" aria-labelledby="seguidos-titulo">
        <div class="seccion__cab">
          <h2 class="t-2" id="seguidos-titulo">Tus favoritos</h2>
          <span class="tenue" aria-live="polite">${Object.keys(resultados).length < filas.length ? 'Revisando precios…' : 'Revisados ahora'} · <a href="#/favoritos">Ver todos</a></span>
        </div>
        <ul class="lista">
          ${filas.map((s) => {
            const r = resultados[s.clave];
            const actual = r?.min ?? s.ultimoPrecio;
            const bajo = actual < s.precioAlSeguir;
            const cumplido = s.objetivo && actual <= s.objetivo;
            let texto = r ? 'Sin cambios desde que lo guardaste' : `Revisado ${haceCuanto(s.revisado)}`;
            if (r?.noEncontrado) texto = 'Ya no aparece con esta búsqueda';
            else if (bajo) texto = `Bajó ${dinero(s.precioAlSeguir - actual, ctx)}`;
            else if (actual > s.precioAlSeguir) texto = `Subió ${dinero(actual - s.precioAlSeguir, ctx)}`;
            return html`<li class="fila">
              ${foto(s.imagen, s.titulo)}
              <div>
                <a class="fila__titulo" href="${enlaceProducto(s.clave, s.consulta)}">${s.titulo}</a>
                <div class="chips">
                  ${cumplido ? html`<span class="chip chip--ahorro">Llegó a tu precio (${dinero(s.objetivo, ctx)})</span>` : s.objetivo ? html`<span class="chip">Avisame bajo ${dinero(s.objetivo, ctx)}</span>` : ''}
                  <span class="chip${bajo ? ' chip--ahorro' : ''}">${texto}</span>
                </div>
              </div>
              <div class="fila__lado">
                ${precio(actual, ctx, { rotulo: r ? 'Precio ahora' : 'Último precio' })}
                <button class="boton boton--texto boton--chico" data-dejar="${s.clave}">Quitar</button>
              </div>
            </li>`;
          })}
        </ul>
      </section>`);
    activarRespaldoImagenes(caja);
    caja.querySelectorAll('[data-dejar]').forEach((b) => b.addEventListener('click', () => {
      dejarDeSeguir(b.dataset.dejar);
      caja.innerHTML = '';
      pintarSeguidos(caja, senal);
    }));
  };

  dibujar();
  const resultados = {};
  // Uno por uno para no lanzar decenas de consultas a la vez.
  for (const s of filas) {
    if (senal.aborted) return;
    try {
      const { grupo } = await consultarProducto(s, { senal });
      if (grupo) {
        resultados[s.clave] = { min: grupo.min };
        avisarSiBajo(s, grupo.min);
        anotarRevision(s.clave, grupo.min);
      } else {
        resultados[s.clave] = { min: s.ultimoPrecio, noEncontrado: true };
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      resultados[s.clave] = { min: s.ultimoPrecio };
    }
    dibujar(resultados);
  }
}

