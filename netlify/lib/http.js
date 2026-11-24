import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';

// Utilidades de red para los conectores.

// Nos identificamos con un nombre propio, como prometimos en el documento de diseño.
// Nota: VTEX (Walmart, MaxiPalí, Simán) responde 429 a cualquier nombre que diga "bot",
// así que usamos "Vale/1.0". Seguimos diciendo quiénes somos; no nos hacemos pasar por navegador.
export const AGENTE = 'Vale/1.0 (comparador de precios; +https://valemenos.netlify.app/#/)';

export async function pedir(url, { tiempo = 8000, json = true, ...opciones } = {}) {
  const intentar = () => fetch(url, {
    ...opciones,
    headers: {
      'User-Agent': AGENTE,
      Accept: json ? 'application/json' : 'text/html',
      'Accept-Language': 'es-CR,es;q=0.9',
      ...(opciones.headers || {}),
    },
    signal: AbortSignal.timeout(tiempo),
    redirect: 'follow',
  });

  let r = await intentar();
  // 429 = "más despacio". Si la tienda dice cuánto esperar (y es poco), esperamos y
  // reintentamos UNA sola vez. Si pide más de 2 segundos, nos rendimos.
  if (r.status === 429) {
    const espera = Number(r.headers.get('retry-after') || 1);
    if (espera <= 2) {
      await new Promise((ok) => setTimeout(ok, espera * 1000));
      r = await intentar();
    }
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return json ? r.json() : r.text();
}

// Cola de trabajo con límite de concurrencia (FIFO).
// Sirve para no abrir 12 conexiones al mismo tiempo contra una sola tienda.
export async function colaConLimite(tareas, limite = 4) {
  const resultados = new Array(tareas.length);
  let siguiente = 0; // puntero al frente de la cola
  async function trabajador() {
    while (siguiente < tareas.length) {
      const i = siguiente++;
      try { resultados[i] = { ok: true, valor: await tareas[i]() }; }
      catch (e) { resultados[i] = { ok: false, error: e }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, tareas.length) }, trabajador));
  return resultados;
}

// Algunas tiendas en Magento (Monge) mandan encabezados de más de 16 KB (cookies, enlaces
// de precarga). El fetch de Node los rechaza con "fetch failed". Para esas páginas usamos
// https.request, que deja subir el límite por petición (maxHeaderSize) sin tocar nada global.

export function pedirPagina(url, { tiempo = 8000, saltos = 3 } = {}) {
  return new Promise((resolver, rechazar) => {
    const cliente = url.startsWith('http:') ? http : https;
    const req = cliente.get(url, {
      maxHeaderSize: 128 * 1024,
      headers: { 'User-Agent': AGENTE, Accept: 'text/html,application/xml', 'Accept-Language': 'es-CR,es;q=0.9', 'Accept-Encoding': 'gzip, deflate, br' },
      timeout: tiempo,
    }, (res) => {
      const { statusCode: estado, headers } = res;
      if (estado >= 300 && estado < 400 && headers.location && saltos > 0) {
        res.resume();
        resolver(pedirPagina(new URL(headers.location, url).href, { tiempo, saltos: saltos - 1 }));
        return;
      }
      if (estado !== 200) {
        res.resume();
        rechazar(new Error(estado === 403 || estado === 401 ? `La tienda rechazó la consulta (HTTP ${estado})` : `HTTP ${estado}`));
        return;
      }
      const cod = headers['content-encoding'];
      const flujo = cod === 'gzip' ? res.pipe(zlib.createGunzip())
        : cod === 'deflate' ? res.pipe(zlib.createInflate())
        : cod === 'br' ? res.pipe(zlib.createBrotliDecompress())
        : res;
      const partes = [];
      flujo.on('data', (p) => partes.push(p));
      flujo.on('end', () => resolver(Buffer.concat(partes).toString('utf8')));
      flujo.on('error', rechazar);
    });
    req.on('timeout', () => req.destroy(new Error('La tienda tardó demasiado en responder')));
    req.on('error', rechazar);
  });
}
