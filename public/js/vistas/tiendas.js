// Tiendas conectadas, cómo calculamos el envío de cada una y cuáles no incluimos.
import { TIENDAS, TIENDAS_EXCLUIDAS } from '../core/tiendas.js';
import { html, haceCuanto } from '../formato.js';

export async function mostrar({ raiz }) {
  document.title = 'Tiendas · Vale Menos';
  let ultima = null;
  try { ultima = JSON.parse(sessionStorage.getItem('vale:ultima') || 'null'); } catch { /* sin almacenamiento */ }
  const n = Object.keys(TIENDAS).length;

  raiz.innerHTML = String(html`<section class="contenedor">
    <div class="resultados__cab">
      <h1 class="t-1">Tiendas y envíos</h1>
      <p class="resumen">Consultamos estas ${n} tiendas cada vez que buscás. Solo usamos lo que cada una publica en su sitio.</p>
    </div>

    <div class="tabla" style="margin-top:24px"><table>
      <thead><tr><th scope="col">Tienda</th><th scope="col">Envío que sumamos</th><th scope="col">En tu última búsqueda</th></tr></thead>
      <tbody>${Object.values(TIENDAS).map((t) => {
        const e = ultima?.estados?.[t.id];
        let estadoTxt = 'Todavía no has buscado';
        let color = 'var(--linea-campo)';
        if (e?.estado === 'listo') { estadoTxt = `Respondió en ${e.ms} ms`; color = 'var(--menta-viva)'; }
        if (e?.estado === 'vacio') { estadoTxt = 'Respondió, sin coincidencias'; color = 'var(--menta-viva)'; }
        if (e?.estado === 'error') { estadoTxt = 'No respondió'; color = 'var(--error)'; }
        if (e?.estado === 'nodisponible') { estadoTxt = 'No disponible por ahora'; color = 'var(--linea-fuerte)'; }
        return html`<tr>
          <td><span class="tienda-celda"><i class="tienda-marca" style="background:${t.color}"></i><a href="${t.sitio}" target="_blank" rel="noopener noreferrer">${t.nombre}</a></span><span class="nota-celda">Precios en ${t.moneda === 'USD' ? 'dólares, convertidos al tipo de cambio del día' : 'colones'}</span></td>
          <td style="min-width:240px">${t.envioResumen}</td>
          <td><span class="tienda-celda" style="font-weight:500"><i class="tienda-marca" style="border-radius:50%;background:${color}"></i>${estadoTxt}</span>${ultima ? html`<span class="nota-celda">"${ultima.q}", ${haceCuanto(new Date(ultima.hora).toISOString())}</span>` : ''}</td>
        </tr>`;
      })}</tbody>
    </table></div>
    <p class="tenue" style="margin-top:12px">Si una tienda cotiza el envío al pagar, usamos un estimado y lo marcamos como "aproximado".</p>
  </section>

  <section class="contenedor pagina pagina--sin-cab">
    <h2>Tiendas que no incluimos</h2>
    <p>Sus reglas no permiten consultas automáticas, y las respetamos.</p>
    <ul>${TIENDAS_EXCLUIDAS.map((t) => html`<li><strong>${t.nombre}:</strong> ${t.motivo}</li>`)}</ul>
    <h2>¿Tenés una tienda en línea?</h2>
    <p>Si querés aparecer, o preferís que no consultemos tu sitio, leé <a href="#/sobre">Quiénes somos</a>.</p>
  </section>`);
}
