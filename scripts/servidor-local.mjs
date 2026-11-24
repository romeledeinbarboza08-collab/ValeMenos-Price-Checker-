// Servidor local sin instalar nada: sirve /public y ejecuta las funciones de /api.
//   node scripts/servidor-local.mjs      ->  http://localhost:8888
// (El historial y los destacados necesitan Netlify Blobs, así que en local se ven vacíos.
//  La búsqueda por foto necesita GEMINI_API_KEY en el entorno.)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../public/', import.meta.url));
const PUERTO = Number(process.env.PORT || 8888);

const funciones = {
  '/api/buscar': () => import('../netlify/functions/buscar.mjs'),
  '/api/tipo-cambio': () => import('../netlify/functions/tipo-cambio.mjs'),
  '/api/historial': () => import('../netlify/functions/historial.mjs'),
  '/api/destacados': () => import('../netlify/functions/destacados.mjs'),
  '/api/identificar': () => import('../netlify/functions/identificar.mjs'),
  '/api/codigo': () => import('../netlify/functions/codigo.mjs'),
  '/api/enlace': () => import('../netlify/functions/enlace.mjs'),
};

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PUERTO}`);
  try {
    if (funciones[url.pathname]) {
      const { default: manejador } = await funciones[url.pathname]();
      let cuerpo;
      if (req.method === 'POST') { const partes = []; for await (const p of req) partes.push(p); cuerpo = Buffer.concat(partes); }
      const respuesta = await manejador(new Request(url, { method: req.method, headers: req.headers, body: cuerpo }), {});
      res.writeHead(respuesta.status, Object.fromEntries(respuesta.headers));
      res.end(Buffer.from(await respuesta.arrayBuffer()));
      return;
    }
    let ruta = normalize(join(raiz, decodeURIComponent(url.pathname)));
    if (!ruta.startsWith(raiz)) throw new Error('fuera de raíz');
    if (url.pathname.endsWith('/')) ruta = join(ruta, 'index.html');
    const contenido = await readFile(ruta);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(ruta)] || 'application/octet-stream' });
    res.end(contenido);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
  }
}).listen(PUERTO, () => console.log(`Vale Menos corriendo en http://localhost:${PUERTO}`));
