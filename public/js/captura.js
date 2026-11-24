// Buscar sin escribir: foto del producto, código de barras o enlace de otra tienda.
// Todo pasa en un <dialog>; al final siempre termina en una búsqueda normal.
import { html, escapar } from './formato.js';
import { icono } from './ui.js';
import { ir, enlaceCodigo } from './navegacion.js';

const dialogo = () => document.getElementById('dialogo-captura');
let limpiar = () => {};

const TITULOS = {
  foto: ['Buscar con una foto', 'Tomale una foto al producto o subí una captura. Te decimos qué es y lo buscamos en las 8 tiendas.'],
  codigo: ['Escanear código de barras', 'Apuntá la cámara al código de la caja. También podés escribir los números.'],
  enlace: ['Pegar un enlace', '¿Lo viste en Amazon, Instagram o en una tienda? Pegá el enlace y buscamos ese producto aquí.'],
};

export function abrirCaptura(modo = 'foto') {
  const d = dialogo();
  if (!d) return;
  limpiar();
  const [titulo, bajada] = TITULOS[modo];
  d.innerHTML = String(html`<div class="dialogo">
    <div class="dialogo__cab">
      <h2 class="t-2" id="captura-titulo">${titulo}</h2>
      <button class="boton boton--sec boton--icono" type="button" data-cerrar aria-label="Cerrar">${icono('cerrar')}</button>
    </div>
    <p>${bajada}</p>
    <div id="captura-cuerpo"></div>
  </div>`);
  d.querySelector('[data-cerrar]').addEventListener('click', () => d.close());
  d.addEventListener('close', () => limpiar(), { once: true });
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  if (!d.open) d.showModal();
  const cuerpo = d.querySelector('#captura-cuerpo');
  if (modo === 'foto') modoFoto(cuerpo);
  if (modo === 'codigo') modoCodigo(cuerpo);
  if (modo === 'enlace') modoEnlace(cuerpo);
}

function buscar(consulta, via) {
  dialogo().close();
  ir(`/buscar?q=${encodeURIComponent(consulta)}${via ? `&via=${via}` : ''}`);
}

/* ---------------- Foto ---------------- */
function modoFoto(cuerpo) {
  cuerpo.innerHTML = String(html`
    <label class="zona-foto" id="zona-foto">
      ${icono('camara')}
      <strong>Tomar o subir una foto</strong>
      <span class="tenue">JPG o PNG. La foto no se guarda.</span>
      <input type="file" accept="image/*" capture="environment" class="solo-lector" id="archivo-foto">
    </label>
    <div id="foto-estado"></div>`);
  const zona = cuerpo.querySelector('#zona-foto');
  const input = cuerpo.querySelector('#archivo-foto');
  input.addEventListener('change', () => input.files[0] && procesar(input.files[0]));
  zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('encima'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('encima'));
  zona.addEventListener('drop', (e) => {
    e.preventDefault(); zona.classList.remove('encima');
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) procesar(f);
  });

  async function procesar(archivo) {
    const estadoEl = cuerpo.querySelector('#foto-estado');
    let imagen;
    try { imagen = await reducirImagen(archivo, 1024); } catch {
      estadoEl.innerHTML = '<p class="mensaje-error">No pudimos abrir esa imagen. Probá con otra.</p>';
      return;
    }
    zona.hidden = true;
    estadoEl.innerHTML = String(html`<div class="vista-previa analizando"><img src="${imagen}" alt="Tu foto"></div>
      <p class="tenue" style="margin-top:10px" aria-live="polite">Reconociendo el producto…</p>`);
    try {
      const r = await fetch('/api/identificar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imagen }) });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || 'No pudimos reconocer la foto.');
      cuerpo.querySelector('.vista-previa').classList.remove('analizando');
      if (!datos.consulta) throw new Error('No vemos un producto claro en la foto. Probá acercándote más.');
      mostrarResultado(estadoEl, imagen, datos);
    } catch (e) {
      cuerpo.querySelector('.vista-previa')?.classList.remove('analizando');
      estadoEl.querySelector('p').outerHTML = `<p class="mensaje-error">${escapar(e.message)}</p>`;
      estadoEl.insertAdjacentHTML('beforeend', '<div class="acciones"><button class="boton boton--sec" type="button" data-otra>Probar otra foto</button></div>');
      estadoEl.querySelector('[data-otra]').addEventListener('click', () => modoFoto(cuerpo));
    }
  }
}

function mostrarResultado(estadoEl, imagen, datos) {
  const nombre = [datos.marca, datos.modelo].filter(Boolean).join(' ') || datos.producto;
  estadoEl.innerHTML = String(html`
    <div class="resultado-ia">
      <div class="foto" style="width:64px;height:64px"><img src="${imagen}" alt=""></div>
      <div style="min-width:0">
        <span class="tenue">${datos.confianza === 'alta' ? 'Parece que es' : 'Creemos que es'}</span>
        <div class="t-3">${nombre}</div>
      </div>
    </div>
    <form class="formulario" style="margin-top:14px" id="form-ia">
      <label>Vamos a buscar
        <input class="campo" name="q" value="${datos.consulta}" autocomplete="off">
      </label>
      <div class="acciones" style="margin-top:0">
        <button class="boton boton--sec" type="button" data-otra>Otra foto</button>
        <button class="boton" type="submit">${icono('lupa')}Comparar precios</button>
      </div>
    </form>`);
  estadoEl.querySelector('[data-otra]').addEventListener('click', () => abrirCaptura('foto'));
  estadoEl.querySelector('#form-ia').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = e.currentTarget.q.value.trim();
    if (q.length >= 2) buscar(q, 'foto');
  });
}

// Achica la foto en el navegador antes de mandarla (menos datos móviles, más rápido).
function reducirImagen(archivo, lado) {
  return new Promise((resolver, rechazar) => {
    const img = new Image();
    const url = URL.createObjectURL(archivo);
    img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolver(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('imagen')); };
    img.src = url;
  });
}

/* ---------------- Código de barras ---------------- */
function modoCodigo(cuerpo) {
  cuerpo.innerHTML = String(html`
    <div class="camara" id="camara"><div id="lector"></div><div class="camara__marco"></div></div>
    <p class="tenue" id="codigo-estado" aria-live="polite" style="margin-top:10px">Pidiendo permiso para usar la cámara…</p>
    <form class="formulario" id="form-codigo">
      <label>O escribí el número
        <input class="campo" name="ean" inputmode="numeric" pattern="[0-9]{8,14}" placeholder="7501234567890" autocomplete="off">
      </label>
      <div class="acciones" style="margin-top:0"><button class="boton" type="submit">Buscar código</button></div>
    </form>`);
  const estadoEl = cuerpo.querySelector('#codigo-estado');
  let resuelto = false;

  async function resolver(ean) {
    if (resuelto) return;
    resuelto = true;
    limpiar();
    if (navigator.vibrate) navigator.vibrate(40);
    estadoEl.textContent = `Código ${ean}. Buscando qué producto es…`;
    try {
      const r = await fetch(`/api/codigo?ean=${encodeURIComponent(ean)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      dialogo().close();
      // Si la consulta no trae nada, la página de resultados prueba las alternativas (más cortas).
      location.hash = enlaceCodigo({ q: d.consulta, ean, alternativas: d.alternativas });
    } catch (e) {
      resuelto = false;
      estadoEl.innerHTML = `<span class="mensaje-error">${escapar(e.message || 'No pudimos leer ese código.')}</span>`;
    }
  }

  cuerpo.querySelector('#form-codigo').addEventListener('submit', (e) => {
    e.preventDefault();
    const ean = e.currentTarget.ean.value.replace(/\D/g, '');
    if (ean.length >= 8) resolver(ean);
    else estadoEl.innerHTML = '<span class="mensaje-error">El código tiene entre 8 y 14 números.</span>';
  });

  iniciarEscaner(cuerpo.querySelector('#lector'), resolver, estadoEl);
}

async function iniciarEscaner(contenedor, alLeer, estadoEl) {
  if (!navigator.mediaDevices?.getUserMedia) {
    estadoEl.textContent = 'Este navegador no deja usar la cámara. Escribí el número de abajo.';
    contenedor.closest('.camara').hidden = true;
    return;
  }
  // 1) Lector nativo (Chrome en Android).
  if ('BarcodeDetector' in window) {
    try {
      const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      const flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.createElement('video');
      video.setAttribute('playsinline', ''); video.muted = true; video.srcObject = flujo;
      contenedor.replaceWith(video);
      await video.play();
      estadoEl.textContent = 'Acercá el código al recuadro.';
      let activo = true;
      limpiar = () => { activo = false; flujo.getTracks().forEach((t) => t.stop()); limpiar = () => {}; };
      const leer = async () => {
        if (!activo) return;
        try {
          const [c] = await detector.detect(video);
          if (c?.rawValue) return alLeer(c.rawValue);
        } catch { /* cuadro sin código */ }
        setTimeout(leer, 180);
      };
      leer();
      return;
    } catch (e) {
      if (e.name === 'NotAllowedError') { negado(estadoEl, contenedor); return; }
    }
  }
  // 2) Librería html5-qrcode (Safari y otros).
  try {
    await cargarScript('https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js');
    const lector = new window.Html5Qrcode(contenedor.id, { verbose: false });
    await lector.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 120 } }, (texto) => alLeer(texto), () => {});
    estadoEl.textContent = 'Acercá el código al recuadro.';
    limpiar = () => { lector.stop().catch(() => {}); limpiar = () => {}; };
  } catch (e) {
    negado(estadoEl, contenedor);
  }
}

function negado(estadoEl, contenedor) {
  estadoEl.textContent = 'No tenemos acceso a la cámara. Podés escribir el número del código.';
  contenedor.closest('.camara')?.setAttribute('hidden', '');
}

function cargarScript(src) {
  return new Promise((ok, mal) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = mal;
    document.head.appendChild(s);
  });
}

/* ---------------- Enlace ---------------- */
function modoEnlace(cuerpo) {
  cuerpo.innerHTML = String(html`<form class="formulario" id="form-enlace">
    <label>Enlace del producto
      <input class="campo" name="url" type="url" inputmode="url" placeholder="https://…" autocomplete="off" required>
    </label>
    <p class="tenue" id="enlace-estado" aria-live="polite" style="margin:0"></p>
    <div class="acciones" style="margin-top:0">
      <button class="boton boton--sec" type="button" id="pegar">Pegar</button>
      <button class="boton" type="submit">Buscar este producto</button>
    </div>
  </form>`);
  const form = cuerpo.querySelector('#form-enlace');
  const estadoEl = cuerpo.querySelector('#enlace-estado');
  const pegar = cuerpo.querySelector('#pegar');
  if (!navigator.clipboard?.readText) pegar.hidden = true;
  pegar.addEventListener('click', async () => {
    try { form.url.value = (await navigator.clipboard.readText()).trim(); form.requestSubmit(); } catch { form.url.focus(); }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    estadoEl.textContent = 'Leyendo el enlace…';
    try {
      const r = await fetch(`/api/enlace?url=${encodeURIComponent(form.url.value.trim())}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      buscar(d.consulta, 'enlace');
    } catch (err) {
      estadoEl.innerHTML = `<span class="mensaje-error">${escapar(err.message || 'No pudimos leer ese enlace.')}</span>`;
    }
  });
  setTimeout(() => form.url.focus(), 50);
}
