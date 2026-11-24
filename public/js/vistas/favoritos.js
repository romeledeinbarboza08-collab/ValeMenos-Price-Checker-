// Favoritos y alertas de precio.
// Se guardan en este navegador; cada vez que abrís Vale Menos se revisan en vivo
// y, si bajaron (o llegaron a tu precio objetivo), te avisamos.
import { estado, contexto, anotarRevision, dejarDeSeguir, fijarObjetivo, suscribir } from '../estado.js';
import { consultarProducto } from '../reencontrar.js';
import { html, dinero, haceCuanto } from '../formato.js';
import { precio, foto, icono, avisar, activarRespaldoImagenes } from '../ui.js';
import { enlaceProducto } from '../navegacion.js';

// Se llama ANTES de anotar el precio nuevo, para comparar contra el último visto.
export function avisarSiBajo(s, precio) {
  const bajo = precio < (s.ultimoPrecio ?? Infinity);
  const llego = s.objetivo ? precio <= s.objetivo : true;
  if (!bajo || !llego) return;
  const texto = `${s.titulo} bajó a ${dinero(precio, contexto())}`;
  avisar(texto, { href: enlaceProducto(s.clave, s.consulta), texto: 'Ver' });
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    try { new Notification('Bajó un favorito', { body: texto, icon: '/img/favicon.svg' }); } catch { /* algunos móviles solo permiten notificaciones desde un service worker */ }
  }
}

export async function mostrar({ raiz, senal }) {
  document.title = 'Favoritos · Vale Menos';
  const resultados = {};
  const pintar = () => pintarFavoritos(raiz, resultados);
  pintar();
  const quitar = suscribir((c) => { if (['zona', 'moneda', 'tasa', 'seguidos'].includes(c)) pintar(); });
  senal.addEventListener('abort', quitar);

  for (const s of [...estado.seguidos]) {
    if (senal.aborted) return;
    try {
      const { grupo } = await consultarProducto(s, { senal });
      if (grupo) { avisarSiBajo(s, grupo.min); anotarRevision(s.clave, grupo.min); resultados[s.clave] = { min: grupo.min }; }
      else resultados[s.clave] = { noEncontrado: true };
    } catch (e) {
      if (e.name === 'AbortError') return;
      resultados[s.clave] = { error: true };
    }
    pintar();
  }
}

function pintarFavoritos(raiz, resultados) {
  const ctx = contexto();
  const lista = estado.seguidos;
  const permiso = 'Notification' in window ? Notification.permission : 'no';

  if (!lista.length) {
    raiz.innerHTML = String(html`<section class="contenedor pagina">
      <h1 class="t-1">Favoritos</h1>
      <div class="vacio" style="margin-top:20px">
        <h2 class="t-2">Todavía no guardaste nada</h2>
        <p>Tocá el corazón en un producto y revisamos su precio cada vez que volvás.</p>
        <a class="boton" href="#/">Buscar productos</a>
      </div>
    </section>`);
    return;
  }

  const revisados = Object.keys(resultados).length;
  raiz.innerHTML = String(html`<div class="contenedor">
    <div class="resultados__cab">
      <h1 class="t-1">Favoritos</h1>
      <p class="resumen" aria-live="polite">${revisados < lista.length ? `Revisando precios en vivo: ${revisados} de ${lista.length}…` : 'Todos revisados ahora mismo.'}</p>
    </div>
    ${permiso === 'default' ? html`<div class="panel panel--fila">
      <div class="panel__texto">${icono('campana')}<span>¿Te avisamos con una notificación cuando baje algo?</span></div>
      <button class="boton boton--chico" id="permiso">Activar avisos</button>
    </div>` : ''}
    <ul class="lista" style="margin:16px 0 64px">
      ${lista.map((s) => {
        const r = resultados[s.clave];
        const actual = r?.min ?? s.ultimoPrecio;
        const dif = actual - s.precioAlSeguir;
        const cumplido = s.objetivo && actual <= s.objetivo;
        let estadoTxt = r ? (r.noEncontrado ? 'Ya no aparece con esta búsqueda' : r.error ? 'No pudimos revisarlo ahora' : 'Igual que cuando lo guardaste') : `Revisado ${haceCuanto(s.revisado)}`;
        if (r?.min != null && dif < 0) estadoTxt = `Bajó ${dinero(-dif, ctx)} desde que lo guardaste`;
        if (r?.min != null && dif > 0) estadoTxt = `Subió ${dinero(dif, ctx)} desde que lo guardaste`;
        return html`<li class="fila">
          ${foto(s.imagen, s.titulo)}
          <div>
            <a class="fila__titulo" href="${enlaceProducto(s.clave, s.consulta)}">${s.titulo}</a>
            <div class="chips">
              ${cumplido ? html`<span class="chip chip--ahorro">¡Llegó a tu precio!</span>` : ''}
              <span class="chip${dif < 0 && r?.min != null ? ' chip--ahorro' : ''}">${estadoTxt}</span>
            </div>
            <form class="item-kit" data-objetivo="${s.clave}" style="margin-top:10px;max-width:360px">
              <input class="campo" name="objetivo" inputmode="numeric" placeholder="Avisame bajo ₡…" aria-label="Precio objetivo" value="${s.objetivo ? Math.round(ctx.moneda === 'USD' ? s.objetivo / ctx.tasa : s.objetivo) : ''}">
              <button class="boton boton--sec boton--chico" type="submit">Guardar</button>
            </form>
          </div>
          <div class="fila__lado">
            ${precio(actual, ctx, { rotulo: r?.min != null ? 'Precio ahora' : 'Último precio' })}
            <button class="boton boton--texto boton--chico" data-quitar="${s.clave}">${icono('basura')}Quitar</button>
          </div>
        </li>`;
      })}
    </ul>
  </div>`);
  activarRespaldoImagenes(raiz);

  raiz.querySelector('#permiso')?.addEventListener('click', async () => {
    try { await Notification.requestPermission(); } catch { /* sin soporte */ }
    pintarFavoritos(raiz, resultados);
  });
  raiz.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', () => { dejarDeSeguir(b.dataset.quitar); avisar('Quitado de favoritos'); }));
  raiz.querySelectorAll('[data-objetivo]').forEach((f) => f.addEventListener('submit', (e) => {
    e.preventDefault();
    const s = estado.seguidos.find((x) => x.clave === f.dataset.objetivo);
    if (!s) return;
    const n = Number(f.objetivo.value.replace(/[^\d]/g, ''));
    fijarObjetivo(s.clave, n ? (ctx.moneda === 'USD' ? n * ctx.tasa : n) : null);
    avisar(s.objetivo ? `Te avisamos cuando baje de ${dinero(s.objetivo, ctx)}` : 'Quitamos el precio objetivo');
  }));
}
