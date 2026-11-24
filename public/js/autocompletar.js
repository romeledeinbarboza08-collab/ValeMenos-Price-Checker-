// Buscador con autocompletado (usa el Trie de estado.js).
import { estado } from './estado.js';
import { escapar } from './formato.js';

let contadorId = 0;
const ICONO_LUPA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>';
const ICONO_CAMARA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const ICONO_CODIGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M4 6v12M7 6v12M10.5 6v12M14 6v12M16.5 6v12M20 6v12"/></svg>';
const ICONO_RELOJ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';

// captura: true agrega, dentro del campo y a la derecha, los botones de foto y código de barras.
// Esos botones solo llevan data-captura; app.js abre el diálogo que corresponde.
export function crearBuscador(contenedor, { grande = false, captura = false, valor = '', alBuscar }) {
  const id = `sug-${++contadorId}`;
  contenedor.innerHTML = `
    <div class="buscador${grande ? ' buscador--grande' : ''}">
      <form role="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>
        <label class="solo-lector" for="${id}-input">Buscar un producto</label>
        <input id="${id}-input" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search"
          placeholder="${grande ? 'iPhone 17, freidora de aire…' : 'Buscá un producto en 8 tiendas'}"
          role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}" value="${escapar(valor)}">
        ${captura ? `<button type="button" class="buscador__icono" data-captura="foto" aria-label="Buscar con una foto" data-tip="Buscar con una foto">${ICONO_CAMARA}</button>
        <button type="button" class="buscador__icono" data-captura="codigo" aria-label="Buscar por código de barras" data-tip="Código de barras">${ICONO_CODIGO}</button>` : ''}
        ${grande ? '<button class="boton" type="submit">Buscar</button>' : ''}
      </form>
      <ul class="sugerencias" id="${id}" role="listbox" hidden></ul>
    </div>`;

  const input = contenedor.querySelector('input');
  const lista = contenedor.querySelector('ul');
  let opciones = [];
  let activa = -1;

  function cerrar() {
    lista.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activa = -1;
  }

  function mostrar() {
    const texto = input.value.trim();
    if (texto) {
      opciones = estado.trie.sugerir(texto, 7).filter((s) => s.toLowerCase() !== texto.toLowerCase()).slice(0, 6);
    } else {
      // Sin texto: lo último que esta persona buscó.
      opciones = Object.entries(estado.busquedas).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([q]) => q);
    }
    if (!opciones.length) return cerrar();
    const n = texto.length;
    lista.innerHTML = opciones.map((s, i) => {
      const inicio = n && s.slice(0, n).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') ===
        texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const etiqueta = inicio ? `<mark>${escapar(s.slice(0, n))}</mark>${escapar(s.slice(n))}` : escapar(s);
      const nota = !texto ? '<small>reciente</small>' : '';
      const ic = texto ? ICONO_LUPA : ICONO_RELOJ;
      return `<li role="option" id="${id}-op${i}" aria-selected="false" data-valor="${escapar(s)}">${ic}<span>${etiqueta}</span>${nota}</li>`;
    }).join('');
    lista.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    activa = -1;
  }

  function marcar(i) {
    const items = lista.querySelectorAll('li');
    items.forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
    activa = i;
    if (i >= 0) input.setAttribute('aria-activedescendant', items[i].id);
    else input.removeAttribute('aria-activedescendant');
  }

  function enviar(q) {
    const consulta = q.trim();
    if (consulta.length < 2) { input.focus(); return; }
    cerrar();
    input.value = consulta;
    alBuscar(consulta);
  }

  input.addEventListener('input', mostrar);
  input.addEventListener('focus', mostrar);
  input.addEventListener('blur', () => setTimeout(cerrar, 120));
  input.addEventListener('keydown', (e) => {
    if (lista.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); marcar((activa + 1) % opciones.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); marcar(activa <= 0 ? opciones.length - 1 : activa - 1); }
    else if (e.key === 'Escape') { cerrar(); }
    else if (e.key === 'Enter' && activa >= 0) { e.preventDefault(); enviar(opciones[activa]); }
  });
  lista.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li');
    if (li) { e.preventDefault(); enviar(li.dataset.valor); }
  });
  contenedor.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); enviar(input.value); });

  return { input, fijar: (v) => { input.value = v; } };
}
