// POST /api/identificar   { imagen: "data:image/jpeg;base64,..." }
// Gemini mira la foto y nos dice qué producto es y qué buscar en las tiendas.
// La llave va en Netlify como variable de entorno GEMINI_API_KEY (nunca en el código).
// La foto no se guarda en ningún lado: se manda a Gemini y se descarta.
// Modelos: GEMINI_MODEL (principal) y GEMINI_MODELO_RESPALDO, con reintentos (ver netlify/lib/gemini.js).

import { llamarGemini, textoDe } from '../lib/gemini.js';

const MAX_BYTES = 4 * 1024 * 1024;

const INSTRUCCION = `Sos el asistente de un comparador de precios de Costa Rica.
Mirá la foto e identificá el producto que se vende (electrónica, electrodomésticos, hogar, etc.).
Respondé SOLO con JSON con esta forma:
{"producto": "nombre corto en español", "marca": "marca o vacío", "modelo": "modelo o vacío",
 "consulta": "lo que alguien escribiría en el buscador de una tienda, 2 a 5 palabras, sin colores",
 "confianza": "alta" | "media" | "baja"}
Si en la foto no hay un producto que se pueda comprar, usá "consulta": "" y "confianza": "baja".`;

// Mensaje para la persona según el ÚLTIMO fallo (el que hizo que nos rindiéramos).
export function mensajeDeFallo(fallos) {
  const ultimo = fallos.at(-1)?.estado;
  if (ultimo === 401 || ultimo === 403) return { estado: 502, error: 'La llave de Gemini no es válida.' };
  if (ultimo === 429) return { estado: 429, error: 'Llegamos al límite de búsquedas por foto por hoy.' };
  if (ultimo === 400) return { estado: 400, error: 'No pudimos procesar esa foto. Probá con otra o escribí el producto.' };
  // 503, 500, tiempo agotado o sin conexión: el servicio está saturado.
  return { estado: 503, error: 'El reconocimiento de fotos está saturado en este momento. Probá en un minuto o escribí el producto.' };
}

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Usá POST.' }, { status: 405 });
  const llave = process.env.GEMINI_API_KEY;
  if (!llave) {
    return Response.json({ error: 'La búsqueda por foto todavía no está activada en este sitio.' }, { status: 503 });
  }

  let imagen;
  try { ({ imagen } = await req.json()); } catch { /* cuerpo inválido */ }
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(imagen || '');
  if (!m) return Response.json({ error: 'No recibimos una imagen válida.' }, { status: 400 });
  if (m[2].length * 0.75 > MAX_BYTES) return Response.json({ error: 'La foto es muy pesada. Probá con una más pequeña.' }, { status: 413 });

  // Reintentos y modelos de respaldo, con plazo total de 8.5 s (Netlify corta a los 10 s).
  const r = await llamarGemini({
    llave,
    partes: [{ text: INSTRUCCION }, { inline_data: { mime_type: m[1], data: m[2] } }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    plazoTotal: 8500,
  });
  if (!r.ok) {
    const { estado, error } = mensajeDeFallo(r.fallos);
    return Response.json({ error }, { status: estado });
  }

  // Google respondió bien: ahora hay que entender lo que dijo.
  let res = {};
  try { res = JSON.parse(textoDe(r.datos).replace(/^```json|```$/g, '').trim()); } catch { /* no vino JSON */ }
  const consulta = String(res.consulta || '').trim().slice(0, 80);
  if (!consulta) {
    return Response.json({ error: 'No pudimos reconocer la foto. Probá otra vez con más luz o escribí el producto.', modeloIA: r.modelo }, { status: 422 });
  }
  return Response.json({
    producto: String(res.producto || '').slice(0, 120),
    marca: String(res.marca || '').slice(0, 60),
    modelo: String(res.modelo || '').slice(0, 60),
    consulta,
    confianza: ['alta', 'media', 'baja'].includes(res.confianza) ? res.confianza : 'baja',
    modeloIA: r.modelo, // qué modelo de Gemini respondió ("modelo" ya es el del producto)
  });
};

export const config = { path: '/api/identificar' };
