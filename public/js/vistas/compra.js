// Mi lista: lista de productos + la combinación de tiendas más barata (envíos incluidos).
import { estado, contexto, quitarDeCompra, actualizarEnCompra, suscribir } from '../estado.js';
import { optimizarCompra, MAX_PRODUCTOS } from '../core/optimizador.js';
import { esVoluminoso } from '../core/tiendas.js';
import { consultarProducto } from '../reencontrar.js';
import { html, dinero, haceCuanto, plural } from '../formato.js';
import { foto, icono, nombreTienda, avisar, activarRespaldoImagenes } from '../ui.js';
import { enlaceProducto } from '../navegacion.js';

export async function mostrar({ raiz, senal }) {
  document.title = 'Mi lista · Vale Menos';
  const pintar = () => pintarCompra(raiz, senal);
  pintar();
  const quitar = suscribir((c) => { if (['zona', 'moneda', 'tasa', 'compra'].includes(c)) pintar(); });
  senal.addEventListener('abort', quitar);
}

function pintarCompra(raiz, senal) {
  const ctx = contexto();
  const items = estado.compra;

  if (!items.length) {
    raiz.innerHTML = String(html`<section class="contenedor pagina">
      <h1 class="t-1">Mi lista</h1>
      <div class="vacio" style="margin-top:20px">
        <h2 class="t-2">Tu lista está vacía</h2>
        <p>Agregá lo que pensás comprar y te decimos en qué tienda conviene cada cosa, contando el envío.</p>
        <a class="boton" href="#/">Buscar productos</a>
      </div>
    </section>`);
    return;
  }

  const r = optimizarCompra(items.map((it) => ({
    clave: it.clave,
    titulo: it.titulo,
    voluminoso: esVoluminoso(it.titulo, it.atributos?.pulgadas),
    ofertas: it.ofertas.map((o) => ({ tienda: o.tienda, precio: o.precio, disponible: o.disponible })),
  })), ctx);

  const masViejo = items.reduce((a, b) => (a.guardado < b.guardado ? a : b)).guardado;

  raiz.innerHTML = String(html`<div class="contenedor">
    <div class="resultados__cab">
      <h1 class="t-1">Mi lista</h1>
      <p class="resumen">${plural(items.length, 'producto', 'productos')} de ${MAX_PRODUCTOS} posibles. Precios consultados ${haceCuanto(masViejo)}.</p>
    </div>
    <div class="dos-columnas">
      <section aria-labelledby="t-lista">
        <div class="barra-orden">
          <h2 class="t-3" id="t-lista">Productos</h2>
          <button class="boton boton--sec boton--chico" id="actualizar">${icono('refrescar')}Actualizar precios</button>
        </div>
        <ul class="lista">
          ${items.map((it) => {
            const disponibles = it.ofertas.filter((o) => o.disponible);
            const elegido = r?.optimo.asignacion.find((a) => a.clave === it.clave)?.oferta;
            return html`<li class="item-lista">
              ${foto(it.imagen, it.titulo)}
              <div>
                <a class="fila__titulo" href="${enlaceProducto(it.clave, it.consulta)}">${it.titulo}</a>
                <div class="fila__tiendas">
                  ${elegido ? html`<span class="gana">Comprar en ${nombreTienda(elegido.tienda)}: ${dinero(elegido.precio, ctx)}</span>` : html`<span>Agotado en todas las tiendas</span>`}
                  <span>${plural(new Set(disponibles.map((o) => o.tienda)).size, 'tienda lo tiene', 'tiendas lo tienen')}</span>
                </div>
              </div>
              <button class="boton boton--texto boton--chico" data-quitar="${it.clave}">${icono('basura')}Quitar</button>
            </li>`;
          })}
        </ul>
      </section>

      ${r ? planHtml(r, ctx) : html`<aside class="plan panel"><h2 class="t-2">Sin plan</h2><p>Ninguno de los productos está disponible ahora. Probá actualizar los precios.</p></aside>`}
    </div>
  </div>`);
  activarRespaldoImagenes(raiz);

  raiz.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', () => {
    quitarDeCompra(b.dataset.quitar);
    avisar('Quitado de Mi lista');
  }));

  raiz.querySelector('#actualizar').addEventListener('click', async (e) => {
    const boton = e.currentTarget;
    boton.disabled = true;
    let hechos = 0;
    for (const it of [...estado.compra]) {
      boton.textContent = `Actualizando ${++hechos} de ${estado.compra.length}…`;
      try {
        const { grupo } = await consultarProducto(it, { senal });
        if (grupo) actualizarEnCompra(it.clave, grupo);
      } catch (err) { if (err.name === 'AbortError') return; }
    }
    avisar('Precios actualizados');
  });
}

function planHtml(r, ctx) {
  const { optimo, ingenuo } = r;
  return html`<aside class="plan panel" aria-labelledby="t-plan">
    <h2 class="t-2" id="t-plan">La combinación más barata</h2>
    ${optimo.porTienda.map((t) => html`<div class="plan__tienda">
      <header><span>${nombreTienda(t.tienda)}</span><span class="num">${dinero(t.subtotal + t.envio.costo, ctx)}</span></header>
      <ul>${t.productos.map((p) => html`<li>${p.titulo}</li>`)}</ul>
      <div class="plan__envio"><span>Envío${t.envio.estimado ? ' (aproximado)' : ''}</span><span class="num">${t.envio.costo ? dinero(t.envio.costo, ctx) : 'Gratis'}</span></div>
    </div>`)}
    <div class="plan__total"><span>Total con envíos</span><strong>${dinero(optimo.total, ctx)}</strong></div>
    ${r.ahorro > 0
      ? html`<div class="nota-verde">Comprar cada producto donde está más barato costaría ${dinero(ingenuo.total, ctx)} por los envíos. Con esta combinación ahorrás ${dinero(r.ahorro, ctx)}.</div>`
      : html`<div class="nota-gris">Aquí la combinación más barata coincide con comprar cada producto donde está más barato.</div>`}
    <details class="como">
      <summary>Cómo se calculó</summary>
      <p style="margin-top:8px">Probamos combinaciones de tiendas con un árbol de decisión y descartó las ramas que ya no podían ganar (backtracking con poda).</p>
      <p>${r.combinacionesPosibles.toLocaleString('es-CR')} combinaciones posibles; revisamos ${r.nodosVisitados.toLocaleString('es-CR')} y descartamos ${r.ramasPodadas.toLocaleString('es-CR')} ramas que ya no podían ganar.</p>
    </details>
  </aside>`;
}
