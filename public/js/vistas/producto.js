// Ficha de producto: todas las tiendas, total con envío, medidor, historial y ahorro honesto.
import { estado, contexto, registrarVisto, agregarACompra, enCompra, alternarComparar, enComparar, seguir, seguido, dejarDeSeguir, actualizarEnCompra, suscribir } from '../estado.js';
import { obtenerHistorial } from '../api.js';
import { consultarProducto } from '../reencontrar.js';
import { TIENDAS } from '../core/tiendas.js';
import { html, dinero, haceCuanto, fechaCorta, plural } from '../formato.js';
import { etiqueta, icono, tiraTiendas, estadoDeRespuesta, medidor, graficoHistorial, datosProducto, nombreTienda, avisar, activarRespaldoImagenes, enlaceWhatsApp, contarHasta } from '../ui.js';
import { ofertasConTotal, serieDiaria, veredicto, descuentoInflado, llaveHistorial } from '../analisis.js';
import { enlaceBusqueda } from '../navegacion.js';

// El sello del precio y el conteo del ahorro se animan solo la primera vez que se pinta cada producto.
let animado = null;

export async function mostrar({ raiz, params, senal }) {
  const clave = params.get('c') || '';
  const q = params.get('q') || '';
  // Si el producto está en alguna lista, ya tenemos su foto para mostrar algo mientras carga.
  const guardado = [...estado.compra, ...estado.seguidos, ...estado.comparar].find((x) => x.clave === clave);

  raiz.innerHTML = String(html`
    <div class="contenedor">
      <nav class="migas" aria-label="Ruta"><a href="${enlaceBusqueda(q)}">Resultados de “${q}”</a><span aria-hidden="true">/</span><span>Producto</span></nav>
      <div id="ficha" aria-busy="true">
        <div class="ficha"><div class="ficha__foto">${icono('caja')}</div>
          <div class="ficha__info"><h1 class="t-1">${guardado?.titulo || 'Consultando las tiendas…'}</h1><div id="tira-producto"></div></div></div>
      </div>
    </div>`);

  const estados = {};
  const { grupo } = await consultarProducto({ clave, consulta: q, ofertas: guardado?.ofertas || [] }, {
    fresco: params.has('fresco'),
    senal,
    alRecibir: (r) => {
      // En la ficha se cuentan ofertas (no productos distintos), como antes.
      estados[r.id] = r.ok ? { ...estadoDeRespuesta(r), cantidad: r.ofertas?.length || 0 } : estadoDeRespuesta(r);
      const t = raiz.querySelector('#tira-producto');
      if (t) t.innerHTML = String(tiraTiendas(estados, new Set([r.id])));
    },
  });
  if (senal.aborted) return;

  if (!grupo) {
    raiz.querySelector('#ficha').innerHTML = String(html`<div class="vacio">
      <h1 class="t-2">Este producto ya no aparece en las tiendas</h1>
      <p>Puede que se haya agotado o que la tienda cambió el nombre de la publicación.</p>
      <a class="boton" href="${enlaceBusqueda(q)}">Ver resultados de “${q}”</a>
    </div>`);
    return;
  }

  document.title = `${grupo.titulo} · Vale Menos`;
  registrarVisto(grupo, q);
  if (enCompra(grupo.clave)) actualizarEnCompra(grupo.clave, grupo); // precios frescos para Mi compra

  // Historial de cada oferta (por tienda) desde Netlify Blobs.
  const llaves = [...new Set(grupo.ofertas.filter((o) => o.clave).map((o) => llaveHistorial(o.tienda, o.clave)))];
  const historial = await obtenerHistorial(llaves);
  if (senal.aborted) return;

  const pintar = () => pintarFicha(raiz, grupo, q, historial, estados);
  pintar();
  const quitar = suscribir((c) => { if (['zona', 'moneda', 'tasa', 'compra', 'seguidos', 'comparar'].includes(c)) pintar(); });
  senal.addEventListener('abort', quitar);
}

function pintarFicha(raiz, g, q, historial, estados) {
  const ctx = contexto();
  const ofertas = ofertasConTotal(g, ctx);
  const disponibles = ofertas.filter((o) => o.disponible);
  const mejor = disponibles[0] || ofertas[0];

  // Serie diaria con el mínimo entre tiendas + el precio de hoy.
  const serie = serieDiaria(historial);
  const hoy = new Date().toISOString().slice(0, 10);
  if (disponibles.length) {
    const minHoy = Math.min(...disponibles.map((o) => o.precio));
    const i = serie.findIndex((x) => x.t.startsWith(hoy));
    if (i >= 0) serie[i] = { ...serie[i], p: Math.min(serie[i].p, minHoy) };
    else serie.push({ t: `${hoy}T12:00:00Z`, p: minHoy });
  }
  const v = veredicto(disponibles.length ? Math.min(...disponibles.map((o) => o.precio)) : mejor.precio, serie);

  // Series por tienda para el gráfico (si una tienda tiene varias claves, la de más puntos).
  const porTienda = new Map();
  for (const [llave, puntos] of Object.entries(historial)) {
    const tienda = llave.split('/')[0];
    if (puntos.length && (!porTienda.has(tienda) || puntos.length > porTienda.get(tienda).length)) porTienda.set(tienda, puntos);
  }
  const series = [...porTienda.entries()].map(([t, puntos]) => ({ nombre: nombreTienda(t), color: TIENDAS[t]?.color || '#888', puntos }));
  const anchoGrafico = (raiz.querySelector('.contenedor')?.clientWidth || 760) - 98;
  const grafico = graficoHistorial(series, ctx, anchoGrafico);

  const tiendasDisp = new Set(disponibles.map((o) => o.tienda));
  const peorDisp = disponibles.at(-1);
  const sig = seguido(g.clave);
  const datos = datosProducto(g);

  raiz.querySelector('#ficha').removeAttribute('aria-busy');
  raiz.querySelector('#ficha').innerHTML = String(html`
    <div class="ficha">
      <div class="ficha__foto">${g.imagen ? html`<img src="${g.imagen}" alt="${g.titulo}" referrerpolicy="no-referrer" data-respaldo>` : icono('caja')}</div>
      <div class="ficha__info">
        <h1 class="t-1">${g.titulo}</h1>
        <div class="chips">
          ${datos.map((d) => html`<span class="chip">${d}</span>`)}
          ${g.colores.length > 1 ? html`<span class="chip">${g.colores.join(', ')}</span>` : ''}
        </div>
        <p class="confianza${g.confianza === 'alta' ? '' : ' confianza--media'}">${icono(g.confianza === 'alta' ? 'escudo' : 'duda')}<span>${g.confianza === 'alta'
          ? `Mismo modelo en ${plural(g.tiendas.length, 'tienda', 'tiendas')}${g.atributos.almacenamiento ? ', con la misma capacidad' : ''}. El color puede variar.`
          : 'Unido por parecido: alguna tienda no da todos los datos. Revisá la descripción antes de comprar.'}</span></p>
      </div>

      <div class="ficha__compra">
        ${mejor.disponible
          ? etiqueta(mejor.total, ctx, { grande: true, sello: animado !== g.clave, rotulo: 'Mejor total hoy', pie: mejor.envio.costo ? `incluye envío de ${dinero(mejor.envio.costo, ctx)}` : 'envío gratis' })
          : html`<div class="precio precio--grande"><span class="precio__rotulo">Agotado</span><span class="precio__monto">${dinero(mejor.total, ctx)}</span></div>`}
        <p class="ficha__donde">${mejor.disponible
          ? html`En <strong>${nombreTienda(mejor.tienda)}</strong>: ${dinero(mejor.precio, ctx)} + envío a ${ctx.zona === 'gam' ? 'la GAM' : 'fuera de la GAM'}.`
          : 'Ninguna tienda lo tiene disponible ahora.'}</p>
        <a class="boton boton--ancho" href="${mejor.url}" target="_blank" rel="noopener noreferrer">Ir a ${nombreTienda(mejor.tienda)}${icono('externo')}</a>
        <div class="ficha__acciones">
          <button class="boton boton--sec" data-accion="compra">${enCompra(g.clave) ? icono('listo') : icono('carrito')}${enCompra(g.clave) ? 'En Mi lista' : 'Agregar a Mi lista'}</button>
          <button class="boton boton--sec boton--icono corazon" data-accion="seguir" aria-pressed="${String(Boolean(sig))}" aria-label="${sig ? 'En favoritos: cambiar aviso' : 'Avisame si baja'}" data-tip="${sig ? 'En favoritos' : 'Avisame si baja'}">${icono('corazon')}</button>
          <button class="boton boton--sec boton--icono" data-accion="comparar" aria-pressed="${String(enComparar(g.clave))}" aria-label="${enComparar(g.clave) ? 'Quitar de comparar' : 'Comparar'}" data-tip="${enComparar(g.clave) ? 'Quitar de comparar' : 'Comparar'}">${icono('columnas')}</button>
          <a class="boton boton--sec boton--icono" href="${enlaceWhatsApp(g.titulo, mejor.total, mejor.tienda, ctx)}" target="_blank" rel="noopener noreferrer" aria-label="Compartir por WhatsApp" data-tip="Compartir">${icono('whatsapp')}</a>
          <button class="boton boton--sec boton--icono" data-accion="refrescar" aria-label="Volver a consultar las tiendas" data-tip="Volver a consultar">${icono('refrescar')}</button>
        </div>
      </div>
    </div>

    <section class="bloque" aria-labelledby="t-tiendas">
      <div class="bloque__cab">
        <h2 class="t-2" id="t-tiendas">Precio en cada tienda</h2>
        <span class="tenue">Total con envío a ${ctx.zona === 'gam' ? 'la GAM' : 'fuera de la GAM'}</span>
      </div>
      <div class="tabla"><table class="tabla-ofertas">
        <thead><tr><th scope="col">Tienda</th><th scope="col">Así aparece en la tienda</th><th scope="col" class="num">Precio</th><th scope="col" class="num">Envío</th><th scope="col" class="num">Total</th><th scope="col"><span class="solo-lector">Enlace</span></th></tr></thead>
        <tbody>
          ${ofertas.map((o, i) => {
            const inflado = descuentoInflado(o, historial[llaveHistorial(o.tienda, o.clave)]);
            const esMejor = i === 0 && o.disponible && ofertas.length > 1;
            return html`<tr class="${esMejor ? 'fila-gana' : ''}${!o.disponible ? ' fila-agotada' : ''}">
              <td><span class="tienda-celda"><i class="tienda-marca" style="background:${TIENDAS[o.tienda]?.color}"></i>${nombreTienda(o.tienda)}</span>${esMejor ? html`<span class="nota-celda nota-celda--gana">Más barato</span>` : ''}${!o.disponible ? html`<span class="nota-celda">Agotado</span>` : ''}</td>
              <td class="oferta-titulo">${o.titulo}</td>
              <td class="num"><span class="precio-celda">${dinero(o.precio, ctx)}</span>
                ${o.precioOriginal ? html`<span class="nota-celda">$${o.precioOriginal.toLocaleString('en-US')} en la tienda</span>` : ''}
                ${o.precioLista ? html`<span class="precio-antes">antes ${dinero(o.precioLista, ctx)}</span>` : ''}
                ${inflado ? html`<span class="alerta-oferta">El "descuento" no es real: el ${fechaCorta(inflado.fecha)} ya costaba ${dinero(inflado.precio, ctx)}</span>` : ''}</td>
              <td class="num">${o.envio.costo ? dinero(o.envio.costo, ctx) : 'Gratis'}${o.envio.estimado ? html`<span class="nota-celda">aproximado</span>` : ''}</td>
              <td class="num"><span class="precio-celda precio-celda--total">${dinero(o.total, ctx)}</span><span class="nota-celda solo-movil">${o.envio.costo ? `envío ${dinero(o.envio.costo, ctx)}` : 'envío gratis'}</span></td>
              <td><a class="ir-tienda" href="${o.url}" target="_blank" rel="noopener noreferrer">Ver${icono('externo')}<span class="solo-lector"> en ${nombreTienda(o.tienda)}</span></a></td>
            </tr>`;
          })}
        </tbody>
      </table></div>
      <p class="resumen-ahorro">${tiendasDisp.size > 1
        ? html`<span class="chip chip--ahorro chip--grande">Ahorrás <span id="ahorro-tiendas">${dinero(peorDisp.total - mejor.total, ctx)}</span></span> frente a ${nombreTienda(peorDisp.tienda)}, la tienda más cara con este mismo producto.`
        : tiendasDisp.size ? 'Solo una tienda lo tiene disponible ahora: no hay contra qué comparar.' : 'Ninguna tienda lo tiene disponible en este momento.'}</p>
    </section>

    <section class="bloque" aria-label="¿Conviene comprarlo hoy?">
      ${medidor(v, ctx)}
      ${v.tipico && disponibles.length ? html`<p class="tenue" style="margin-top:8px">${v.tipico > Math.min(...disponibles.map((o) => o.precio))
        ? html`Está <span class="ahorro">${dinero(v.tipico - Math.min(...disponibles.map((o) => o.precio)), ctx)}</span> por debajo de su precio típico del mes.`
        : 'Hoy no está más barato que su precio típico del mes.'}</p>` : ''}
    </section>

    <section class="bloque" aria-labelledby="t-historial">
      <div class="bloque__cab"><h2 class="t-2" id="t-historial">Historial de precios</h2></div>
      ${grafico || html`<p class="sin-historial">Todavía no hay suficientes datos para dibujar el historial. Desde hoy queda registrado.</p>`}
    </section>

    <dialog id="dialogo-seguir" aria-labelledby="t-seguir">
      <form method="dialog" class="dialogo">
        <h2 class="t-2" id="t-seguir">Avisame si baja</h2>
        <p>Lo guardamos en tus favoritos y revisamos el precio cada vez que abrís Vale Menos.</p>
        <label class="formulario"><span>Avisame si baja de (opcional)</span>
          <input class="campo" name="objetivo" inputmode="numeric" placeholder="${dinero(Math.round(mejor.precio * 0.95), ctx)}" value="${sig?.objetivo ? Math.round(sig.objetivo) : ''}">
        </label>
        <div class="acciones">
          ${sig ? html`<button class="boton boton--texto" value="quitar">Dejar de seguir</button>` : ''}
          <button class="boton boton--sec" value="cancelar">Cancelar</button>
          <button class="boton" value="guardar">Guardar</button>
        </div>
      </form>
    </dialog>
  `);
  activarRespaldoImagenes(raiz);
  if (animado !== g.clave && tiendasDisp.size > 1) contarHasta(raiz.querySelector('#ahorro-tiendas'), peorDisp.total - mejor.total, (n) => dinero(n, ctx));
  animado = g.clave;

  raiz.querySelector('.ficha__acciones').addEventListener('click', (e) => {
    const b = e.target.closest('[data-accion]');
    if (!b) return;
    const a = b.dataset.accion;
    if (a === 'compra') {
      const r = agregarACompra(g, q);
      avisar(r.ok ? (r.repetido ? 'Ya estaba en Mi lista' : 'Agregado a Mi lista') : r.motivo, r.ok ? { href: '#/mi-lista', texto: 'Ver lista' } : null);
    }
    if (a === 'comparar') {
      const r = alternarComparar(g, q);
      if (!r.ok) avisar(r.motivo, { href: '#/comparar', texto: 'Ir a comparar' });
      else if (r.agregado) avisar(`${estado.comparar.length} de 3 para comparar`, { href: '#/comparar', texto: 'Comparar ahora' });
    }
    if (a === 'seguir') raiz.querySelector('#dialogo-seguir').showModal();
    if (a === 'refrescar') location.hash = `#/producto?c=${encodeURIComponent(g.clave)}&q=${encodeURIComponent(q)}&fresco=${Date.now()}`;
  });

  const dialogo = raiz.querySelector('#dialogo-seguir');
  dialogo.addEventListener('close', () => {
    if (dialogo.returnValue === 'guardar') {
      const texto = dialogo.querySelector('input').value.replace(/[^\d]/g, '');
      const objetivo = texto ? (ctx.moneda === 'USD' ? Number(texto) * ctx.tasa : Number(texto)) : null;
      seguir(g, q, objetivo);
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
      avisar('Guardado en favoritos. Te avisamos si baja.', { href: '#/favoritos', texto: 'Ver' });
    }
    if (dialogo.returnValue === 'quitar') { dejarDeSeguir(g.clave); avisar('Dejaste de seguir este producto'); }
  });
}
