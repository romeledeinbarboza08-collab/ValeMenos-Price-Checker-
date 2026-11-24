// Comparar hasta 3 productos lado a lado.
import { estado, contexto, quitarDeComparar, suscribir } from '../estado.js';
import { html, dinero, haceCuanto } from '../formato.js';
import { icono, nombreTienda, activarRespaldoImagenes } from '../ui.js';
import { mejorOferta } from '../analisis.js';
import { enlaceProducto } from '../navegacion.js';

export async function mostrar({ raiz, senal }) {
  document.title = 'Comparar · Vale Menos';
  const pintar = () => pintarComparar(raiz);
  pintar();
  const quitar = suscribir((c) => { if (['zona', 'moneda', 'tasa', 'comparar'].includes(c)) pintar(); });
  senal.addEventListener('abort', quitar);
}

function pintarComparar(raiz) {
  const ctx = contexto();
  const lista = estado.comparar;
  if (!lista.length) {
    raiz.innerHTML = String(html`<section class="contenedor pagina"><h1 class="t-1">Comparar</h1>
      <div class="vacio" style="margin-top:20px"><h2 class="t-2">No hay productos para comparar</h2>
      <p>En los resultados, tocá el botón de columnas en hasta tres productos y aparecen aquí lado a lado.</p>
      <a class="boton" href="#/">Buscar productos</a></div></section>`);
    return;
  }

  const filas = lista.map((g) => ({ g, m: mejorOferta(g, ctx) }));
  const masBarato = filas.reduce((a, b) => (b.m.total < a.m.total ? b : a));
  const capacidad = (a) => (a?.almacenamiento ? (a.almacenamiento >= 1024 ? `${a.almacenamiento / 1024} TB` : `${a.almacenamiento} GB`) : '—');
  const celda = (f, contenido) => html`<td class="${f === masBarato && filas.length > 1 ? 'gana' : ''}">${contenido}</td>`;

  raiz.innerHTML = String(html`<div class="contenedor">
    <div class="resultados__cab"><h1 class="t-1">Comparar</h1>
      <p class="resumen">El más barato con envío queda resaltado.</p></div>
    <div class="comparar"><table>
      <thead><tr><th scope="col"><span class="solo-lector">Dato</span></th>
        ${filas.map((f) => html`<th scope="col">
          <div class="foto">${f.g.imagen ? html`<img src="${f.g.imagen}" alt="" referrerpolicy="no-referrer" data-respaldo>` : icono('caja')}</div>
          <a class="fila__titulo" href="${enlaceProducto(f.g.clave, f.g.consulta)}" style="display:block;margin-top:10px;white-space:normal">${f.g.titulo}</a>
        </th>`)}</tr></thead>
      <tbody>
        <tr><th scope="row">Mejor total</th>${filas.map((f) => celda(f, html`<span class="precio-celda">${dinero(f.m.total, ctx)}</span>`))}</tr>
        <tr><th scope="row">Dónde</th>${filas.map((f) => celda(f, `${nombreTienda(f.m.tienda)}${f.m.disponible ? '' : ' (agotado)'}`))}</tr>
        <tr><th scope="row">Rango de precios</th>${filas.map((f) => celda(f, `${dinero(Math.min(...f.g.ofertas.map((o) => o.precio)), ctx)} a ${dinero(Math.max(...f.g.ofertas.map((o) => o.precio)), ctx)}`))}</tr>
        <tr><th scope="row">Tiendas</th>${filas.map((f) => celda(f, [...new Set(f.g.ofertas.map((o) => nombreTienda(o.tienda)))].join(', ')))}</tr>
        ${filas.some((f) => f.g.atributos?.almacenamiento) ? html`<tr><th scope="row">Almacenamiento</th>${filas.map((f) => celda(f, capacidad(f.g.atributos)))}</tr>` : ''}
        ${filas.some((f) => f.g.atributos?.ram) ? html`<tr><th scope="row">RAM</th>${filas.map((f) => celda(f, f.g.atributos?.ram ? `${f.g.atributos.ram} GB` : '—'))}</tr>` : ''}
        ${filas.some((f) => f.g.atributos?.pulgadas >= 10) ? html`<tr><th scope="row">Pantalla</th>${filas.map((f) => celda(f, f.g.atributos?.pulgadas ? `${f.g.atributos.pulgadas}″` : '—'))}</tr>` : ''}
        ${filas.some((f) => f.g.atributos?.litros) ? html`<tr><th scope="row">Capacidad (litros)</th>${filas.map((f) => celda(f, f.g.atributos?.litros ? `${String(f.g.atributos.litros).replace('.', ',')} L` : '—'))}</tr>` : ''}
        <tr><th scope="row">Colores</th>${filas.map((f) => celda(f, f.g.colores?.join(', ') || '—'))}</tr>
        <tr><th scope="row">Precios de</th>${filas.map((f) => celda(f, haceCuanto(f.g.guardado)))}</tr>
        <tr><th scope="row"><span class="solo-lector">Acciones</span></th>${filas.map((f) => html`<td><button class="boton boton--texto boton--chico" data-quitar="${f.g.clave}">Quitar</button></td>`)}</tr>
      </tbody>
    </table></div>
  </div>`);
  activarRespaldoImagenes(raiz);
  raiz.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', () => quitarDeComparar(b.dataset.quitar)));
}
