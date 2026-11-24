// Páginas de texto: Quiénes somos, Ayuda, Términos y Privacidad.
import { html } from '../formato.js';
import { TIENDAS } from '../core/tiendas.js';

const pagina = (titulo, contenido) => ({
  async mostrar({ raiz }) {
    document.title = `${titulo} · Vale Menos`;
    raiz.innerHTML = String(html`<article class="contenedor"><div class="pagina">${contenido()}</div></article>`);
  },
});

const nombres = () => Object.values(TIENDAS).map((t) => t.nombre).join(', ');

export const sobre = pagina('Quiénes somos', () => html`
  <h1 class="t-1">Quiénes somos</h1>
  <p>Vale Menos hace por vos lo que casi todo mundo hace antes de comprar: abrir cinco pestañas para ver dónde sale más barato. Lo hacemos en vivo y le sumamos el envío.</p>

  <h2>Qué hacemos</h2>
  <ul>
    <li>Consultamos ${nombres()} en el momento en que buscás.</li>
    <li>Juntamos el mismo modelo aunque cada tienda lo escriba distinto, y separamos las versiones que no son iguales (por ejemplo 128 GB y 256 GB).</li>
    <li>Sumamos el envío a tu zona para mostrarte el total real.</li>
    <li>Guardamos el historial de precios para decirte si hoy es buen día para comprar o si un "descuento" no es tan descuento.</li>
  </ul>

  <h2>Qué no hacemos</h2>
  <ul>
    <li>No vendemos nada ni cobramos comisión por mandarte a una tienda.</li>
    <li>No pedimos cuenta, correo ni datos personales. Tus listas y favoritos se quedan en tu navegador.</li>
    <li>No ordenamos los resultados según quién nos paga: no nos paga nadie.</li>
  </ul>

  <h2 id="para-tiendas">Para tiendas</h2>
  <p>Leemos solo la información que cada tienda ya publica para su propio buscador, revisamos su archivo robots.txt antes de conectarla y hacemos pocas consultas, con pausas y caché. Nuestro programa siempre se presenta con el nombre <b>Vale/1.0</b>; nunca se hace pasar por un navegador.</p>
  <p>Si tenés una tienda y preferís que no la consultemos, podés bloquear ese nombre en tu servidor. Si querés aparecer y tu sitio usa VTEX, Shopify o WooCommerce, conectarla es casi inmediato.</p>
`);

const PREGUNTAS = [
  ['¿Los precios son en vivo?', 'Sí. Cada búsqueda le pregunta a las tiendas en ese momento. Para no saturarlas, si alguien hizo la misma búsqueda hace un par de minutos reutilizamos esa respuesta. El botón Refrescar siempre consulta de nuevo.'],
  ['¿Por qué el precio es distinto al de la tienda?', 'Porque te mostramos el total con envío a tu zona. Si una tienda cobra el envío al pagar según peso o distancia, usamos un estimado y lo marcamos como aproximado. El precio que vale siempre es el que muestra la tienda al pagar.'],
  ['¿Cómo funciona la búsqueda por foto?', 'Achicamos la foto en tu teléfono, la mandamos a un modelo de inteligencia artificial que reconoce el producto y con eso hacemos una búsqueda normal. La foto no se guarda.'],
  ['¿Y el código de barras?', 'Leemos el código con la cámara (o lo escribís) y buscamos a qué producto corresponde en una base de datos pública de códigos. Si no lo encontramos, buscamos el número directamente en las tiendas.'],
  ['¿Qué es "Con presupuesto"?', 'Le decís cuánto tenés y qué necesitás, y buscamos la combinación de productos y tiendas que más te rinde sin pasarte. Lo imprescindible va primero; lo demás entra si alcanza.'],
  ['¿Cómo me avisan si baja un precio?', 'Guardá el producto con el corazón y, si querés, ponele un precio objetivo. Cada vez que abrís Vale Menos revisamos tus favoritos en vivo y te avisamos si bajaron. Si das permiso, también te mandamos una notificación del navegador.'],
  ['¿Por qué no aparece PriceSmart?', 'Sus reglas no permiten consultas automáticas, y preferimos respetarlas.'],
  ['¿Qué significa "Unido por parecido"?', 'Que juntamos publicaciones de tiendas distintas porque el modelo coincide, aunque alguna no indique todos los datos (por ejemplo, la capacidad). Revisá la descripción en la tienda antes de comprar.'],
];

export const ayuda = pagina('Preguntas frecuentes', () => html`
  <h1 class="t-1">Preguntas frecuentes</h1>
  <p>Cómo comparamos, de dónde salen los precios y qué hacemos con tus datos.</p>
  <div class="preguntas">
    ${PREGUNTAS.map(([p, r]) => html`<details><summary>${p}</summary><p>${r}</p></details>`)}
  </div>
`);

export const terminos = pagina('Términos de uso', () => html`
  <h1 class="t-1">Términos de uso</h1>
  <p class="tenue">Última actualización: octubre de 2026</p>
  <h2>El servicio</h2>
  <p>Vale Menos es un comparador gratuito. Mostramos información pública de tiendas en línea de Costa Rica para ayudarte a decidir dónde comprar. No vendemos productos ni intervenimos en tu compra.</p>
  <h2>Precios y disponibilidad</h2>
  <p>Los precios, existencias y costos de envío vienen de cada tienda y pueden cambiar en cualquier momento. Algunos envíos son estimados. El precio válido es el que la tienda te muestra al finalizar la compra.</p>
  <h2>Marcas</h2>
  <p>Los nombres de las tiendas y productos pertenecen a sus dueños. Los usamos solo para identificarlos; no implica relación ni patrocinio.</p>
  <h2>Uso razonable</h2>
  <p>No uses Vale Menos para hacer consultas automáticas masivas. Eso afecta a las tiendas y al resto de personas que lo usan.</p>
`);

export const privacidad = pagina('Privacidad', () => html`
  <h1 class="t-1">Privacidad</h1>
  <p class="tenue">Última actualización: octubre de 2026</p>
  <h2>Lo que se queda en tu navegador</h2>
  <p>Mi lista, tus favoritos, lo que viste hace poco, tus búsquedas recientes, la zona de envío y la moneda se guardan en tu propio navegador (localStorage). No tenemos cuentas ni los recibimos en un servidor. Si borrás los datos del sitio, desaparecen.</p>
  <h2>Lo que pasa por nuestro servidor</h2>
  <ul>
    <li><b>Búsquedas:</b> el texto que buscás se usa para consultar las tiendas. Guardamos los precios encontrados (no quién buscó) para armar el historial.</li>
    <li><b>Fotos:</b> se envían al modelo de reconocimiento de imágenes de Google (Gemini) para identificar el producto y se descartan. No las guardamos.</li>
    <li><b>Códigos de barras:</b> el número se consulta en una base de datos pública de productos.</li>
    <li><b>Enlaces:</b> solo abrimos enlaces de las tiendas que comparamos; de otros sitios solo leemos el texto del enlace.</li>
  </ul>
  <h2>Sin rastreo</h2>
  <p>No usamos cookies de publicidad ni herramientas de seguimiento de terceros.</p>
`);
