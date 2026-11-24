// Con presupuesto: "¿Qué me alcanza?" y "Armá tu kit".
import { estado, contexto, agregarACompra } from '../estado.js';
import { buscarEnVivo } from '../api.js';
import { resumirGrupos } from '../core/emparejamiento.js';
import { armarKit, queMeAlcanza, quitarPreciosAtipicos, KITS } from '../core/presupuesto.js';
import { html, dinero, plural } from '../formato.js';
import { precio, foto, icono, nombreTienda, avisar, activarRespaldoImagenes, datosProducto } from '../ui.js';
import { mejorOferta } from '../analisis.js';
import { enlaceProducto } from '../navegacion.js';

const leerMonto = (texto) => {
  const n = Number(String(texto).replace(/[^\d]/g, ''));
  if (!n) return 0;
  return estado.moneda === 'USD' ? n * estado.tasa.venta : n;
};
const montoParaCampo = (colones) => String(Math.round(estado.moneda === 'USD' ? colones / estado.tasa.venta : colones));

// Busca en las 8 tiendas y devuelve los grupos con su mejor total ya calculado.
async function gruposCon(q, senal) {
  const ctx = contexto();
  const respuestas = await buscarEnVivo(q, { senal });
  const grupos = resumirGrupos(respuestas.flatMap((r) => r.ofertas || []), q);
  const disponibles = grupos
    .filter((g) => !g.secundario) // fuera accesorios, juguetes, higiene… (ver esCategoriaAjena)
    .map((g) => { const m = mejorOferta(g, ctx); return { ...g, mejor: m, total: m.total, disponible: m.disponible }; })
    .filter((g) => g.disponible);
  // Fuera lo que cuesta menos del 35 % de la mediana de las demás opciones:
  // así, en modo "Ahorrar", no gana un producto equivocado solo por ser barato.
  return quitarPreciosAtipicos(disponibles);
}

export async function mostrar({ raiz, params, senal }) {
  document.title = 'Con presupuesto · Vale Menos';
  const kitInicial = KITS.find((k) => k.id === params.get('kit'));
  const pestana = kitInicial || params.get('modo') === 'kit' ? 'kit' : 'alcanza';
  const ctx = contexto();
  const simbolo = ctx.moneda === 'USD' ? '$' : '₡';

  raiz.innerHTML = String(html`<div class="contenedor">
    <div class="resultados__cab">
      <h1 class="t-1">Con presupuesto</h1>
      <p class="resumen">Decinos cuánto tenés y te mostramos lo que alcanza, sin pasarte.</p>
      <div class="pestanas" role="tablist">
        <button role="tab" id="tab-alcanza" aria-selected="${String(pestana === 'alcanza')}" aria-controls="panel-alcanza">¿Qué me alcanza?</button>
        <button role="tab" id="tab-kit" aria-selected="${String(pestana === 'kit')}" aria-controls="panel-kit">Armá tu kit</button>
      </div>
    </div>

    <div class="dos-columnas" style="padding-top:12px">
      <div>
        <section role="tabpanel" id="panel-alcanza" aria-labelledby="tab-alcanza" ${pestana === 'alcanza' ? '' : 'hidden'}>
          <form class="formulario panel" id="form-alcanza">
            <label>¿Qué querés comprar?
              <input class="campo" name="q" placeholder="laptop, celular, audífonos…" autocomplete="off" required minlength="2">
            </label>
            <label>¿Cuánto tenés? (${simbolo})
              <input class="campo" name="monto" inputmode="numeric" placeholder="${ctx.moneda === 'USD' ? '600' : '300000'}" required>
            </label>
            <button class="boton" type="submit">${icono('lupa')}Ver qué me alcanza</button>
          </form>
        </section>

        <section role="tabpanel" id="panel-kit" aria-labelledby="tab-kit" ${pestana === 'kit' ? '' : 'hidden'}>
          <form class="formulario panel" id="form-kit">
            <div><span style="font-weight:600;font-size:0.9rem">Empezá con un kit</span>
              <div class="presets" style="margin-top:8px">${KITS.map((k) => html`<button class="boton boton--sec boton--chico" type="button" data-kit="${k.id}" aria-pressed="${String(k === kitInicial)}">${k.nombre}</button>`)}</div>
            </div>
            <label>Tu presupuesto (${simbolo})
              <input class="campo" name="monto" inputmode="numeric" required value="${kitInicial ? montoParaCampo(kitInicial.presupuesto) : ''}" placeholder="${ctx.moneda === 'USD' ? '500' : '250000'}">
            </label>
            <div>
              <span style="font-weight:600;font-size:0.9rem">Lo que necesitás</span>
              <div class="items-kit" id="items-kit" style="margin-top:8px"></div>
              <button class="boton boton--texto boton--chico" type="button" id="agregar-item" style="margin-top:6px">+ Agregar producto</button>
            </div>
            <label>Si sobra plata, preferís
              <span class="control" style="width:100%"><select name="preferencia" style="width:100%">
                <option value="barato">Ahorrar: lo más barato de cada cosa</option>
                <option value="calidad">Mejor calidad: lo mejor que alcance</option>
              </select></span>
            </label>
            <button class="boton" type="submit">${icono('chispa')}Armar mi compra</button>
          </form>
        </section>
      </div>

      <aside id="resultado" aria-live="polite">
        <div class="panel panel--gris">
          <h2 class="t-3">Cómo funciona</h2>
          <p class="suave"><b>¿Qué me alcanza?</b> Buscamos en las 8 tiendas y te mostramos lo que entra en tu presupuesto.</p>
          <p class="suave"><b>Armá tu kit</b> Marcá qué es imprescindible y elegimos la combinación que más rinde.</p>
        </div>
      </aside>
    </div>
  </div>`);

  const $ = (s) => raiz.querySelector(s);
  const resultado = $('#resultado');

  // Pestañas
  raiz.querySelectorAll('[role="tab"]').forEach((t) => t.addEventListener('click', () => {
    raiz.querySelectorAll('[role="tab"]').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    $('#panel-alcanza').hidden = t.id !== 'tab-alcanza';
    $('#panel-kit').hidden = t.id !== 'tab-kit';
  }));

  /* ---------- ¿Qué me alcanza? ---------- */
  $('#form-alcanza').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const q = f.q.value.trim();
    const monto = leerMonto(f.monto.value);
    if (q.length < 2 || !monto) return;
    const boton = f.querySelector('button'); boton.disabled = true;
    resultado.innerHTML = String(html`<div class="panel"><p class="suave" style="margin:0">Buscando "${q}" en las 8 tiendas…</p><div class="esqueleto" style="height:90px;margin-top:12px"></div></div>`);
    try {
      const grupos = await gruposCon(q, senal);
      if (senal.aborted) return;
      pintarAlcanza(resultado, q, monto, grupos);
    } catch (err) {
      if (err.name !== 'AbortError') resultado.innerHTML = '<div class="panel"><p class="mensaje-error">No pudimos consultar las tiendas. Probá de nuevo.</p></div>';
    } finally { boton.disabled = false; }
  });

  /* ---------- Armá tu kit ---------- */
  const items = (kitInicial?.items || [{ nombre: '', prioridad: 'imprescindible' }]).map((x) => ({ ...x }));
  const pintarItems = () => {
    $('#items-kit').innerHTML = String(html`${items.map((it, i) => html`<div class="item-kit">
      <input class="campo" data-i="${i}" data-campo="nombre" value="${it.nombre}" placeholder="ej. freidora de aire" aria-label="Producto ${i + 1}">
      <select data-i="${i}" data-campo="prioridad" aria-label="Prioridad">
        <option value="imprescindible" ${it.prioridad === 'imprescindible' ? 'selected' : ''}>Imprescindible</option>
        <option value="deseable" ${it.prioridad === 'deseable' ? 'selected' : ''}>Si alcanza</option>
      </select>
      <button class="boton boton--sec boton--icono boton--chico" type="button" data-quitar="${i}" aria-label="Quitar">${icono('cerrar')}</button>
    </div>`)}`);
  };
  pintarItems();
  $('#items-kit').addEventListener('input', (e) => { const t = e.target; if (t.dataset.i) items[t.dataset.i][t.dataset.campo] = t.value; });
  $('#items-kit').addEventListener('change', (e) => { const t = e.target; if (t.dataset.i) items[t.dataset.i][t.dataset.campo] = t.value; });
  $('#items-kit').addEventListener('click', (e) => {
    const b = e.target.closest('[data-quitar]');
    if (b && items.length > 1) { items.splice(Number(b.dataset.quitar), 1); pintarItems(); }
  });
  $('#agregar-item').addEventListener('click', () => {
    if (items.length >= 8) return avisar('Hasta 8 productos por kit');
    items.push({ nombre: '', prioridad: 'deseable' }); pintarItems();
    raiz.querySelector(`[data-i="${items.length - 1}"]`).focus();
  });
  raiz.querySelectorAll('[data-kit]').forEach((b) => b.addEventListener('click', () => {
    const k = KITS.find((x) => x.id === b.dataset.kit);
    raiz.querySelectorAll('[data-kit]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    items.splice(0, items.length, ...k.items.map((x) => ({ ...x })));
    $('#form-kit').monto.value = montoParaCampo(k.presupuesto);
    pintarItems();
  }));

  $('#form-kit').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const monto = leerMonto(f.monto.value);
    const lista = items.filter((it) => it.nombre.trim().length >= 2);
    if (!monto || !lista.length) return avisar('Poné un presupuesto y al menos un producto');
    const boton = f.querySelector('button[type="submit"]'); boton.disabled = true;
    const progreso = (n) => { resultado.innerHTML = String(html`<div class="panel"><p class="suave" style="margin:0">Buscando ${n} de ${lista.length}: ${lista[Math.min(n, lista.length) - 1].nombre}…</p><div class="barra-uso"><i style="width:${(n / lista.length) * 100}%"></i></div></div>`); };
    try {
      const conOpciones = [];
      // De dos en dos para no saturar las tiendas.
      for (let i = 0; i < lista.length; i += 2) {
        progreso(Math.min(i + 2, lista.length));
        const lote = await Promise.all(lista.slice(i, i + 2).map((it) => gruposCon(it.nombre.trim(), senal)));
        lote.forEach((grupos, j) => {
          const it = lista[i + j];
          conOpciones.push({ nombre: it.nombre.trim(), prioridad: it.prioridad, opciones: grupos.slice(0, 8).map((g) => ({ total: g.total, g })) });
        });
        if (senal.aborted) return;
      }
      const r = armarKit(conOpciones, monto, { preferencia: f.preferencia.value });
      pintarKit(resultado, r, monto);
    } catch (err) {
      if (err.name !== 'AbortError') resultado.innerHTML = '<div class="panel"><p class="mensaje-error">No pudimos consultar las tiendas. Probá de nuevo.</p></div>';
    } finally { boton.disabled = false; }
  });
}

function tarjetaGrupo(g, ctx, q, extra = '') {
  const datos = datosProducto(g);
  return html`<li class="item-lista">
    ${foto(g.imagen, g.titulo)}
    <div>
      <a class="fila__titulo" href="${enlaceProducto(g.clave, q)}">${g.titulo}</a>
      <div class="chips">${extra}${datos.slice(0, 3).map((d) => html`<span class="chip">${d}</span>`)}</div>
      <div class="fila__tiendas"><span class="gana">${dinero(g.total, ctx)} en ${nombreTienda(g.mejor.tienda)}</span><span>con envío</span></div>
    </div>
  </li>`;
}

function pintarAlcanza(caja, q, monto, grupos) {
  const ctx = contexto();
  const { caben, destacados } = queMeAlcanza(grupos, monto);
  if (!caben.length) {
    const masBarato = grupos.reduce((a, b) => (!a || b.total < a.total ? b : a), null);
    caja.innerHTML = String(html`<div class="vacio">
      <h2 class="t-2">No alcanza todavía</h2>
      <p>${masBarato ? `Lo más barato que encontramos de "${q}" cuesta ${dinero(masBarato.total, ctx)} con envío, ${dinero(masBarato.total - monto, ctx)} más de lo que tenés.` : `No encontramos "${q}" en las tiendas.`}</p>
      ${masBarato ? html`<a class="boton boton--sec" href="${enlaceProducto(masBarato.clave, q)}">Ver ese producto</a>` : ''}
    </div>`);
    return;
  }
  const resto = caben.filter((g) => !destacados.some((d) => d.g === g)).sort((a, b) => a.total - b.total).slice(0, 8);
  caja.innerHTML = String(html`<div class="resultado-kit">
    <div class="panel">
      <div class="t-3">${plural(caben.length, 'opción entra', 'opciones entran')} en ${dinero(monto, ctx)}</div>
      <p class="tenue" style="margin:4px 0 0">${grupos.length - caben.length ? `${plural(grupos.length - caben.length, 'opción queda fuera', 'opciones quedan fuera')} del presupuesto.` : 'Todo lo que encontramos entra.'}</p>
    </div>
    <ul class="lista">${destacados.map((d) => tarjetaGrupo(d.g, ctx, q, html`${d.etiquetas.map((t) => html`<span class="chip chip--marca">${t}</span>`)}<span class="chip chip--ahorro">Te sobran ${dinero(monto - d.g.total, ctx)}</span>`))}</ul>
    ${resto.length ? html`<h3 class="t-3" style="margin-top:6px">También te alcanza</h3><ul class="lista">${resto.map((g) => tarjetaGrupo(g, ctx, q))}</ul>` : ''}
  </div>`);
  activarRespaldoImagenes(caja);
}

function pintarKit(caja, r, monto) {
  const ctx = contexto();
  const uso = Math.min(100, (r.total / monto) * 100);
  caja.innerHTML = String(html`<div class="resultado-kit">
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap">
        ${precio(r.total, ctx, { rotulo: 'Total del kit', pie: 'con envío estimado' })}
        <div class="precio precio--derecha"><span class="precio__rotulo">Te sobran</span><span class="precio__monto ahorro">${dinero(r.sobrante, ctx)}</span></div>
      </div>
      <div class="barra-uso" role="img" aria-label="Usás el ${Math.round(uso)} % del presupuesto"><i style="width:${uso}%"></i></div>
      <div class="tenue">Usás ${Math.round(uso)} % de ${dinero(monto, ctx)}</div>
    </div>
    <ul class="lista">
      ${r.elegidos.map((it) => it.opcion
        ? tarjetaGrupo(it.opcion.g, ctx, it.nombre, html`<span class="chip${it.prioridad === 'imprescindible' ? ' chip--marca' : ''}">${it.prioridad === 'imprescindible' ? 'Imprescindible' : 'Si alcanza'}: ${it.nombre}</span>`)
        : html`<li class="item-lista falta"><div class="foto" style="width:64px;height:64px">${icono('caja')}</div><div><b>${it.nombre}</b><div class="tenue">${it.opciones.length ? 'No alcanzó con este presupuesto' : 'No lo encontramos en las tiendas'}</div></div></li>`)}
    </ul>
    ${r.elegidos.some((it) => it.opcion) ? html`<button class="boton" id="kit-a-lista">${icono('carrito')}Pasar todo a Mi lista</button>` : ''}
    ${r.faltan.length ? html`<div class="nota-gris">No entró: ${r.faltan.join(', ')}. Probá subir el presupuesto o pasarlo a "Si alcanza".</div>` : html`<div class="nota-verde">¡Entró todo lo que pediste!</div>`}
    <details class="como"><summary>Cómo lo calculamos</summary>
      <p>Es el problema de la mochila: cada producto tiene varias opciones y escogemos a lo sumo una de cada uno sin pasarnos del presupuesto. Lo resolvemos con programación dinámica sobre una tabla de ${r.tabla.celdas.toLocaleString('es-CR')} casillas (de ${dinero(r.tabla.unidad, ctx)} en ${dinero(r.tabla.unidad, ctx)}). El envío se estima por producto; si comprás varias cosas en la misma tienda puede salir más barato. Revisalo en Mi lista.</p>
    </details>
  </div>`);
  activarRespaldoImagenes(caja);
  caja.querySelector('#kit-a-lista')?.addEventListener('click', () => {
    let n = 0;
    for (const it of r.elegidos) if (it.opcion && agregarACompra(it.opcion.g, it.nombre).ok) n++;
    avisar(`${plural(n, 'producto', 'productos')} en Mi lista`, { href: '#/mi-lista', texto: 'Ver la mejor combinación' });
  });
}
