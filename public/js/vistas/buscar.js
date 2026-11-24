// Resultados de búsqueda en vivo.
// Cada tienda responde por su lado; con cada respuesta se vuelve a agrupar y se repinta.
import { estado, contexto, registrarBusqueda, aprenderTitulos, agregarACompra, enCompra, alternarComparar, enComparar, seguir, seguido, dejarDeSeguir, suscribir } from '../estado.js';
import { buscarEnVivo } from '../api.js';
import { resumirGrupos, palabrasConsulta } from '../core/emparejamiento.js';
import { limiteInferior, limiteSuperior, contarEnRango, levenshtein } from '../core/estructuras.js';
import { TIENDAS } from '../core/tiendas.js';
import { html, dinero, haceCuanto, plural } from '../formato.js';
import { etiqueta, precio, foto, icono, tiraTiendas, estadoDeRespuesta, datosProducto, nombreTienda, avisar, activarRespaldoImagenes } from '../ui.js';
import { mejorOferta } from '../analisis.js';
import { enlaceBusqueda, enlaceProducto, enlaceCodigo } from '../navegacion.js';

const ORDENES = {
  relevancia: 'Más relevantes',
  total: 'Menor total',
  diferencia: 'Mayor diferencia entre tiendas',
  tiendas: 'En más tiendas',
};

const VIA = { foto: ['camara', 'Encontrado con tu foto'], codigo: ['codigo', 'Buscado por código de barras'], enlace: ['enlace', 'Encontrado desde un enlace'] };

const NOMBRE_MARCA = { black_decker: 'Black+Decker', hamilton_beach: 'Hamilton Beach', jbl: 'JBL', hp: 'HP', lg: 'LG', tcl: 'TCL', blu: 'BLU', msi: 'MSI', dji: 'DJI', zte: 'ZTE' };
const nombreMarca = (m) => NOMBRE_MARCA[m] || (m ? m[0].toUpperCase() + m.slice(1).replace(/_/g, ' ') : 'Sin marca');

export async function mostrar({ raiz, params, senal }) {
  const q = (params.get('q') || '').trim();
  if (q.length < 2) { location.hash = '#/'; return; }
  const fresco = params.has('fresco');
  document.title = `${q} · Vale Menos`;
  registrarBusqueda(q);

  const v = {
    estados: Object.fromEntries(Object.keys(TIENDAS).map((id) => [id, { estado: 'cargando' }])),
    ofertas: [],
    grupos: [],
    terminado: false,
    generado: null,
    filtros: {
      tiendas: new Set(Object.keys(TIENDAS)),
      marcas: new Set(),
      soloDisponibles: true,
      min: null,
      max: null,
      orden: 'relevancia',
    },
  };

  raiz.innerHTML = String(html`
    <div class="contenedor">
      <div class="resultados__cab">
        ${VIA[params.get('via')] ? html`<p class="nota-via">${icono(VIA[params.get('via')][0])}${VIA[params.get('via')][1]}</p>` : ''}
        ${params.has('respaldo') ? html`<p class="nota-respaldo">Buscamos “${q}” porque no encontramos el nombre exacto.</p>` : ''}
        <h1 class="t-1">${q}</h1>
        <div class="resumen" aria-live="polite"><span id="resumen">Preguntando a las tiendas…</span></div>
        <div id="tira">${tiraTiendas(v.estados)}</div>
      </div>
      <div class="resultados">
        <!-- En escritorio es una barra lateral; en teléfono, una hoja que sube desde abajo. -->
        <div class="hoja-fondo" id="hoja-fondo" hidden></div>
        <aside class="filtros" id="filtros" aria-labelledby="t-filtros">
          <div class="filtros__cab">
            <h2 class="t-3" id="t-filtros">Filtros</h2>
            <button class="boton boton--sec boton--icono filtros__cerrar" type="button" id="cerrar-filtros" aria-label="Cerrar filtros">${icono('cerrar')}</button>
          </div>
          <fieldset><legend>Tiendas</legend><div id="f-tiendas"></div></fieldset>
          <fieldset>
            <legend>Total con envío</legend>
            <div class="rango">
              <label>Desde<input class="campo" id="f-min" inputmode="numeric" placeholder="₡ mínimo" aria-describedby="f-conteo"></label>
              <label>Hasta<input class="campo" id="f-max" inputmode="numeric" placeholder="₡ máximo" aria-describedby="f-conteo"></label>
            </div>
            <div class="rango__conteo" id="f-conteo"></div>
          </fieldset>
          <fieldset><legend>Disponibilidad</legend>
            <label class="casilla"><input type="checkbox" id="f-disp" checked> Ocultar agotados</label>
          </fieldset>
          <fieldset><legend>Marca</legend><div id="f-marcas"></div></fieldset>
          <div class="filtros__pie"><button class="boton" type="button" id="listo-filtros">Ver resultados</button></div>
        </aside>
        <section aria-labelledby="titulo-lista">
          <h2 id="titulo-lista" class="solo-lector">Productos encontrados</h2>
          <div class="barra-orden">
            <button class="boton boton--sec boton--chico filtros__abrir" id="abrir-filtros" aria-controls="filtros" aria-expanded="false">${icono('filtro')}Filtros</button>
            <div class="control"><label class="solo-lector" for="orden">Ordenar por</label>
              <select id="orden">${Object.entries(ORDENES).map(([k, t]) => html`<option value="${k}">${t}</option>`)}</select>
            </div>
            <button class="boton boton--sec boton--chico boton--icono" id="refrescar" aria-label="Volver a consultar las tiendas" data-tip="Volver a consultar">${icono('refrescar')}</button>
          </div>
          <ul class="lista" id="lista">${Array.from({ length: 4 }, () => html`<li class="esqueleto" aria-hidden="true"></li>`)}</ul>
        </section>
      </div>
    </div>`);

  const $ = (sel) => raiz.querySelector(sel);
  const porClave = new Map();
  const vistas = new Set();   // filas ya pintadas: solo las nuevas entran con animación
  let estadosPrevios = {};    // para saber qué tiendas acaban de responder

  /* ---------- Pintado ---------- */
  let pendiente = false;
  const repintar = () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => { pendiente = false; pintar(); });
  };

  function pintar() {
    if (senal.aborted) return;
    const ctx = contexto();
    // Rebote solo en las tiendas que cambiaron de "buscando" a su resultado desde el último pintado.
    const recien = new Set(Object.keys(v.estados).filter((id) => v.estados[id].estado !== 'cargando' && estadosPrevios[id] !== v.estados[id].estado));
    estadosPrevios = Object.fromEntries(Object.entries(v.estados).map(([id, e]) => [id, e.estado]));
    $('#tira').innerHTML = String(tiraTiendas(v.estados, recien));

    // 1. Filtrar ofertas por tienda y disponibilidad, luego agrupar.
    const ofertas = v.ofertas.filter((o) => v.filtros.tiendas.has(o.tienda) && (!v.filtros.soloDisponibles || o.disponible));
    let grupos = resumirGrupos(ofertas, q);
    grupos.forEach((g) => { g.mejor = mejorOferta(g, ctx); g.total = g.mejor.total; });

    // 2. Marcas presentes (para el filtro)
    pintarFiltros(grupos);
    if (v.filtros.marcas.size) grupos = grupos.filter((g) => v.filtros.marcas.has(g.marca || ''));

    // 3. Rango de precio con búsqueda binaria sobre la lista ordenada por total.
    const porTotal = [...grupos].sort((a, b) => a.total - b.total);
    const min = v.filtros.min ?? -Infinity;
    const max = v.filtros.max ?? Infinity;
    const enRango = porTotal.slice(limiteInferior(porTotal, min, (g) => g.total), limiteSuperior(porTotal, max, (g) => g.total));
    const hayRango = v.filtros.min != null || v.filtros.max != null;
    $('#f-conteo').textContent = hayRango ? `${plural(contarEnRango(porTotal, min, max, (g) => g.total), 'producto', 'productos')} en ese rango` : '';

    // 4. Orden elegido
    const elegidos = new Set(enRango);
    grupos = grupos.filter((g) => elegidos.has(g));
    const o = v.filtros.orden;
    if (o === 'total') grupos.sort((a, b) => a.secundario - b.secundario || a.total - b.total);
    if (o === 'diferencia') grupos.sort((a, b) => a.secundario - b.secundario || (b.max - b.min) - (a.max - a.min));
    if (o === 'tiendas') grupos.sort((a, b) => a.secundario - b.secundario || b.tiendas.length - a.tiendas.length || a.total - b.total);

    v.grupos = grupos;
    porClave.clear();
    grupos.forEach((g) => porClave.set(g.clave, g));

    pintarResumen(grupos);
    pintarLista(grupos, ctx);
  }

  function pintarResumen(grupos) {
    const listas = Object.values(v.estados).filter((e) => e.estado !== 'cargando' && e.estado !== 'error').length;
    const conProductos = new Set(grupos.flatMap((g) => g.tiendas)).size;
    const principales = grupos.filter((g) => !g.secundario).length;
    let texto;
    if (!v.terminado) texto = `Llevamos ${listas} de ${Object.keys(TIENDAS).length} tiendas…`;
    else if (!principales) texto = 'Sin productos para esta búsqueda';
    else texto = `${plural(principales, 'producto', 'productos')} en ${plural(conProductos, 'tienda', 'tiendas')}, consultado ${haceCuanto(v.generado)}`;
    $('#resumen').textContent = texto;
  }

  function pintarLista(grupos, ctx) {
    const lista = $('#lista');
    const principales = grupos.filter((g) => !g.secundario);
    const secundarios = grupos.filter((g) => g.secundario);

    if (!grupos.length) {
      if (!v.terminado) return; // seguimos esperando tiendas: se quedan los esqueletos
      lista.innerHTML = String(vacio());
      return;
    }
    // La etiqueta menta va solo en el precio ganador: el total más bajo de la lista.
    const disponibles = principales.filter((g) => g.mejor.disponible);
    const ganador = disponibles.length > 1 ? disponibles.reduce((a, b) => (b.total < a.total ? b : a)) : null;
    lista.innerHTML = String(html`
      ${principales.map((g) => fila(g, ctx, g === ganador))}
      ${secundarios.length ? html`<li class="separador">Accesorios y otros productos relacionados</li>${secundarios.map((g) => fila(g, ctx))}` : ''}
      ${!v.terminado ? html`<li class="esqueleto" aria-hidden="true"></li>` : ''}
    `);
    activarRespaldoImagenes(lista);
  }

  function fila(g, ctx, esGanador = false) {
    const m = g.mejor;
    const pie = m.disponible
      ? `en ${nombreTienda(m.tienda)} · ${m.envio.costo ? `con envío${m.envio.estimado ? ' aprox.' : ''}` : 'envío gratis'}`
      : 'agotado en todas las tiendas';
    // Precio más bajo por tienda
    const porTienda = new Map();
    for (const o of g.ofertas) if (!porTienda.has(o.tienda) || o.precio < porTienda.get(o.tienda).precio) porTienda.set(o.tienda, o);
    const datos = datosProducto(g);
    const sinCapacidad = !g.atributos.accesorio && g.atributos.almacenamiento == null && /iphone|galaxy|redmi|ipad|macbook|pixel|moto|honor/.test(g.clave);
    const url = enlaceProducto(g.clave, q);
    const disp = [...porTienda.values()].filter((o) => o.disponible);
    const ahorro = disp.length > 1 ? Math.max(...disp.map((o) => o.precio)) - Math.min(...disp.map((o) => o.precio)) : 0;
    const enLista = enCompra(g.clave);
    const nueva = !vistas.has(g.clave);
    vistas.add(g.clave);
    return html`<li class="fila${nueva ? ' entra' : ''}">
      ${foto(g.imagen, g.titulo)}
      <div class="fila__info">
        <a class="fila__titulo" href="${url}">${g.titulo}</a>
        <div class="chips">
          ${ahorro > 0 ? html`<span class="chip chip--ahorro">Ahorrás ${dinero(ahorro, ctx)}</span>` : ''}
          ${g.coincidenciaExacta ? html`<span class="chip chip--marca">Mismo código de barras</span>` : ''}
          ${datos.map((d) => html`<span class="chip">${d}</span>`)}
          ${sinCapacidad ? html`<span class="chip chip--aviso">La tienda no indica la capacidad</span>` : ''}
          ${g.confianza === 'media' && !sinCapacidad ? html`<span class="chip chip--aviso">Unido por parecido</span>` : ''}
        </div>
        <div class="fila__tiendas">
          ${[...porTienda.values()].map((o) => html`<span class="${o.tienda === m.tienda ? 'gana' : ''}${!o.disponible ? ' agotado' : ''}"><i class="punto" style="background:${TIENDAS[o.tienda]?.color}" aria-hidden="true"></i>${nombreTienda(o.tienda)} ${dinero(o.precio, ctx)}</span>`)}
        </div>
      </div>
      <div class="fila__lado">
        ${esGanador
          ? etiqueta(m.total, ctx, { rotulo: 'El más barato', pie })
          : precio(m.total, ctx, { pie })}
        <div class="fila__acciones">
          <button class="boton boton--sec boton--icono corazon" data-accion="seguir" data-clave="${g.clave}" aria-pressed="${String(Boolean(seguido(g.clave)))}" aria-label="Guardar en favoritos" data-tip="Favoritos">${icono('corazon')}</button>
          <button class="boton boton--sec boton--icono" data-accion="compra" data-clave="${g.clave}" aria-pressed="${String(enLista)}" aria-label="${enLista ? 'Ya está en Mi lista' : 'Agregar a Mi lista'}" data-tip="${enLista ? 'En Mi lista' : 'Agregar a Mi lista'}">${enLista ? icono('listo') : icono('carrito')}</button>
          <button class="boton boton--sec boton--icono" data-accion="comparar" data-clave="${g.clave}" aria-pressed="${String(enComparar(g.clave))}" aria-label="Comparar lado a lado" data-tip="Comparar">${icono('columnas')}</button>
        </div>
      </div>
    </li>`;
  }

  // ¿Quisiste decir…? Corrige palabra por palabra con Levenshtein contra el diccionario del Trie.
  function vacio() {
    const fallaron = Object.values(v.estados).filter((e) => e.estado === 'error').length;
    const diccionario = [...new Set(estado.trie.todas().flatMap((f) => f.toLowerCase().split(/\s+/)))].filter((w) => w.length > 2);
    const palabras = palabrasConsulta(q);
    let cambio = false;
    const corregida = palabras.map((p) => {
      if (diccionario.includes(p) || /\d/.test(p)) return p;
      let mejor = p; let distancia = Math.max(2, Math.floor(p.length / 3)) + 1;
      for (const w of diccionario) {
        const d = levenshtein(p, w, distancia - 1);
        if (d < distancia) { mejor = w; distancia = d; }
      }
      if (mejor !== p) cambio = true;
      return mejor;
    }).join(' ');
    const filtrando = v.filtros.tiendas.size < Object.keys(TIENDAS).length || v.filtros.marcas.size || v.filtros.min != null || v.filtros.max != null;
    // Llegó por código de barras y ninguna tienda lo tiene: pedimos el nombre del producto.
    if (params.get('via') === 'codigo' && !filtrando) {
      const codigo = params.get('ean') || q;
      return html`<li class="vacio">
        <h2 class="t-2">No encontramos el código ${codigo}</h2>
        <p>Probá buscando el nombre del producto, por ejemplo "pasta dental colgate 100 ml".</p>
        <form class="buscar-nombre" id="buscar-nombre" role="search">
          <input class="campo" id="nombre-producto" name="nombre" aria-label="Nombre del producto" type="search" placeholder="Nombre del producto" autocomplete="off" required>
          <button class="boton" type="submit">Buscar</button>
        </form>
        ${fallaron ? html`<p class="tenue">${plural(fallaron, 'tienda no respondió', 'tiendas no respondieron')}. Podés intentar de nuevo con Refrescar.</p>` : ''}
      </li>`;
    }
    return html`<li class="vacio">
      <h2 class="t-2">${filtrando ? 'Ningún producto cumple con los filtros' : 'No encontramos productos para esta búsqueda'}</h2>
      ${cambio && !filtrando ? html`<p>¿Quisiste decir <a href="${enlaceBusqueda(corregida)}"><strong>${corregida}</strong></a>?</p>` : ''}
      ${filtrando ? html`<p>Probá ampliar el rango de precio o marcar más tiendas.</p>` : html`<p>Probá con menos palabras o con el nombre del modelo, por ejemplo "galaxy a56" en vez de "celular samsung bueno".</p>`}
      ${fallaron ? html`<p class="tenue">${plural(fallaron, 'tienda no respondió', 'tiendas no respondieron')}. Podés intentar de nuevo con Refrescar.</p>` : ''}
    </li>`;
  }

  /* ---------- Filtros ---------- */
  let marcasPrevias = '';
  function pintarFiltros(grupos) {
    const conteoTienda = {};
    v.ofertas.forEach((o) => { if (!v.filtros.soloDisponibles || o.disponible) conteoTienda[o.tienda] = (conteoTienda[o.tienda] || 0) + 1; });
    $('#f-tiendas').innerHTML = String(html`${Object.values(TIENDAS).map((t) => html`
      <label class="casilla"><input type="checkbox" data-tienda="${t.id}" ${v.filtros.tiendas.has(t.id) ? 'checked' : ''}>${t.nombre}<small>${conteoTienda[t.id] || 0}</small></label>`)}`);

    const conteoMarca = new Map();
    grupos.forEach((g) => { if (!g.secundario) conteoMarca.set(g.marca || '', (conteoMarca.get(g.marca || '') || 0) + 1); });
    const marcas = [...conteoMarca.entries()].sort((a, b) => b[1] - a[1]);
    const firma = marcas.map(([m, n]) => m + n).join() + [...v.filtros.marcas].join();
    if (firma === marcasPrevias) return; // no repintar si no cambió (así no se pierde el foco)
    marcasPrevias = firma;
    $('#f-marcas').innerHTML = marcas.length
      ? String(html`${marcas.slice(0, 10).map(([m, n]) => html`<label class="casilla"><input type="checkbox" data-marca="${m}" ${v.filtros.marcas.has(m) ? 'checked' : ''}>${nombreMarca(m)}<small>${n}</small></label>`)}`)
      : '<span class="tenue">Aparecen cuando lleguen resultados</span>';
  }

  raiz.querySelector('#filtros').addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.tienda) { t.checked ? v.filtros.tiendas.add(t.dataset.tienda) : v.filtros.tiendas.delete(t.dataset.tienda); }
    if (t.dataset.marca !== undefined) { t.checked ? v.filtros.marcas.add(t.dataset.marca) : v.filtros.marcas.delete(t.dataset.marca); }
    if (t.id === 'f-disp') v.filtros.soloDisponibles = t.checked;
    repintar();
  });

  const leerMonto = (s) => {
    const n = Number(String(s).replace(/[^\d]/g, ''));
    if (!s.trim() || !n) return null;
    return estado.moneda === 'USD' ? n * estado.tasa.venta : n;
  };
  ['#f-min', '#f-max'].forEach((sel) => $(sel).addEventListener('input', () => {
    v.filtros.min = leerMonto($('#f-min').value);
    v.filtros.max = leerMonto($('#f-max').value);
    repintar();
  }));

  $('#orden').addEventListener('change', (e) => { v.filtros.orden = e.target.value; repintar(); });
  // Hoja de filtros (teléfono): abre, cierra con la X, "Ver resultados", el fondo o Escape.
  const hoja = $('#filtros');
  const abrirFiltros = $('#abrir-filtros');
  function hojaFiltros(abrir) {
    hoja.dataset.abierto = String(abrir);
    $('#hoja-fondo').hidden = !abrir;
    abrirFiltros.setAttribute('aria-expanded', String(abrir));
    document.body.classList.toggle('sin-scroll', abrir);
    if (abrir) $('#cerrar-filtros').focus();
    else abrirFiltros.focus();
  }
  abrirFiltros.addEventListener('click', () => hojaFiltros(true));
  ['#cerrar-filtros', '#listo-filtros', '#hoja-fondo'].forEach((sel) => $(sel).addEventListener('click', () => hojaFiltros(false)));
  hoja.addEventListener('keydown', (e) => { if (e.key === 'Escape' && hoja.dataset.abierto === 'true') hojaFiltros(false); });
  senal.addEventListener('abort', () => document.body.classList.remove('sin-scroll'));
  $('#refrescar').addEventListener('click', () => {
    location.hash = `#/buscar?q=${encodeURIComponent(q)}&fresco=${Date.now()}`;
  });

  $('#lista').addEventListener('submit', (e) => {
    if (e.target.id !== 'buscar-nombre') return;
    e.preventDefault();
    const nombre = e.target.nombre.value.trim();
    if (nombre.length >= 2) location.hash = enlaceBusqueda(nombre);
  });

  $('#lista').addEventListener('click', (e) => {
    const b = e.target.closest('[data-accion]');
    if (!b) return;
    const g = porClave.get(b.dataset.clave);
    if (!g) return;
    if (b.dataset.accion === 'compra') {
      const r = agregarACompra(g, q);
      if (!r.ok) avisar(r.motivo);
      else avisar(r.repetido ? 'Ya estaba en Mi lista' : 'Agregado a Mi lista', { href: '#/mi-lista', texto: 'Ver lista' });
    }
    if (b.dataset.accion === 'comparar') {
      const r = alternarComparar(g, q);
      if (!r.ok) avisar(r.motivo, { href: '#/comparar', texto: 'Ir a comparar' });
      else if (r.agregado) avisar(`${estado.comparar.length} de 3 para comparar`, { href: '#/comparar', texto: 'Comparar ahora' });
    }
    if (b.dataset.accion === 'seguir') {
      if (seguido(g.clave)) { dejarDeSeguir(g.clave); avisar('Quitado de favoritos'); }
      else { seguir(g, q); avisar('Guardado en favoritos. Te avisamos si baja.', { href: '#/favoritos', texto: 'Ver' }); }
    }
    repintar();
  });

  const quitar = suscribir((c) => { if (c === 'zona' || c === 'moneda' || c === 'tasa') repintar(); });
  senal.addEventListener('abort', quitar);

  /* ---------- Búsqueda en vivo ---------- */
  await buscarEnVivo(q, {
    fresco,
    senal,
    alRecibir: (r) => {
      if (senal.aborted) return;
      v.estados[r.id] = estadoDeRespuesta(r);
      v.ofertas.push(...(r.ofertas || []));
      if (r.generado && (!v.generado || r.generado < v.generado)) v.generado = r.generado;
      repintar();
    },
  });
  v.terminado = true;
  v.generado = v.generado || new Date().toISOString();
  pintar();

  // Vino de un código de barras y no hubo nada: probamos la siguiente consulta, más corta
  // ("maruchan pollo" -> "maruchan"). replace() para que Atrás no caiga en la búsqueda vacía.
  const alternativas = params.getAll('alt');
  if (params.get('via') === 'codigo' && alternativas.length && !v.grupos.some((g) => !g.secundario)) {
    location.replace(enlaceCodigo({ q: alternativas[0], ean: params.get('ean'), alternativas: alternativas.slice(1), respaldo: true }));
    return;
  }
  aprenderTitulos(v.grupos);
  try { sessionStorage.setItem('vale:ultima', JSON.stringify({ q, estados: v.estados, hora: Date.now() })); } catch { /* sin almacenamiento */ }
}
