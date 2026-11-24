// Búsqueda por foto: reintentos y modelos de respaldo de Gemini, con respuestas simuladas
// (no sale a internet: se reemplaza fetch). Los mensajes de error que ve la persona también se prueban.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import identificar from '../netlify/functions/identificar.mjs';

const FOTO = 'data:image/jpeg;base64,' + Buffer.from('foto de prueba').toString('base64');
const pedir = () => identificar(new Request('http://x/api/identificar', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imagen: FOTO }),
}));

// Respuesta correcta de Gemini con el JSON del producto.
const exito = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text:
  '{"producto":"Freidora de aire","marca":"Oster","modelo":"","consulta":"freidora de aire oster","confianza":"alta"}' }] } }] }), { status: 200 });

// respuestas: lista de funciones (una por llamada, en orden). Guarda qué modelo se pidió en cada una.
let llamadas;
function simular(...respuestas) {
  llamadas = [];
  globalThis.fetch = async (url) => {
    const modelo = String(url).match(/models\/([^:]+):/)[1];
    const tiempo = Date.now();
    llamadas.push({ modelo, tiempo });
    const r = respuestas[llamadas.length - 1];
    return r ? r() : new Response('{}', { status: 500 });
  };
}
const estado = (n) => () => new Response('{}', { status: n });

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'llave-de-prueba';
  delete process.env.GEMINI_MODEL;
  delete process.env.GEMINI_MODELO_RESPALDO;
  console.error = () => {}; // los intentos fallidos se registran; en las pruebas no hace falta verlos
});

test('Gemini: 503 y luego éxito, con el mismo modelo después de 800 ms', async () => {
  simular(estado(503), exito);
  const r = await pedir();
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.consulta, 'freidora de aire oster');
  assert.equal(d.modeloIA, 'gemini-3.8-flash');
  assert.deepEqual(llamadas.map((l) => l.modelo), ['gemini-3.8-flash', 'gemini-3.8-flash']);
  assert.ok(llamadas[1].tiempo - llamadas[0].tiempo >= 750, 'espera antes de reintentar');
});

test('Gemini: 503 dos veces en el principal, responde el modelo de respaldo', async () => {
  simular(estado(503), estado(503), exito);
  const r = await pedir();
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.modeloIA, 'gemini-3.5-flash');
  assert.deepEqual(llamadas.map((l) => l.modelo), ['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.5-flash']);
});

test('Gemini: el respaldo se puede cambiar con GEMINI_MODELO_RESPALDO y al final queda gemini-flash-latest', async () => {
  process.env.GEMINI_MODELO_RESPALDO = 'gemini-otro';
  simular(estado(500), estado(500), estado(503), estado(503), exito);
  const d = await (await pedir()).json();
  assert.equal(d.modeloIA, 'gemini-flash-latest');
  assert.deepEqual(llamadas.map((l) => l.modelo), ['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-otro', 'gemini-otro', 'gemini-flash-latest']);
});

test('Gemini: 429 en todos los modelos -> "límite por hoy" (sin reintentar el mismo modelo)', async () => {
  simular(estado(429), estado(429), estado(429));
  const r = await pedir();
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error, 'Llegamos al límite de búsquedas por foto por hoy.');
  assert.deepEqual(llamadas.map((l) => l.modelo), ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-flash-latest']);
});

test('Gemini: llave inválida (403) no prueba otros modelos; todo saturado da el mensaje de saturado', async () => {
  simular(estado(403));
  let r = await pedir();
  assert.equal((await r.json()).error, 'La llave de Gemini no es válida.');
  assert.equal(llamadas.length, 1);

  simular(estado(503), estado(503), estado(503), estado(503), estado(503), estado(503));
  r = await pedir();
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /saturado en este momento/);
});

test('Gemini: si un intento se queda colgado, se corta y se salta al siguiente modelo', async () => {
  llamadas = [];
  globalThis.fetch = async (url, { signal }) => {
    llamadas.push({ modelo: String(url).match(/models\/([^:]+):/)[1] });
    if (llamadas.length === 1) {
      // El principal nunca responde: solo termina cuando lo aborta el AbortController.
      return new Promise((_, rechazar) => signal.addEventListener('abort', () => rechazar(Object.assign(new Error('abortado'), { name: 'AbortError' }))));
    }
    return exito();
  };
  const inicio = Date.now();
  const d = await (await pedir()).json();
  assert.equal(d.modeloIA, 'gemini-3.5-flash');
  assert.ok(Date.now() - inicio < 9000, 'todo termina antes de 9 s');
});
