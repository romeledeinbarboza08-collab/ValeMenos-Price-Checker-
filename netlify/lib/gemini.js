// Llamadas a Gemini con reintentos y modelos de respaldo.
// Google a veces responde 503 ("modelo saturado") o 500. El plan es:
//   1. Modelo principal (GEMINI_MODEL, por defecto gemini-3.8-flash).
//      Si da 503/500, se espera 800 ms y se reintenta UNA vez con el mismo modelo.
//   2. Modelo de respaldo (GEMINI_MODELO_RESPALDO, por defecto gemini-3.5-flash), igual.
//   3. gemini-flash-latest, igual.
// Todo tiene un tiempo límite total (Netlify corta las funciones a los 10 s): cada intento
// lleva su AbortController y, si se le acaba el tiempo, se salta al siguiente modelo.
// La llave va solo en variables de entorno (GEMINI_API_KEY), nunca en el código.

export const MODELO_ULTIMO_RECURSO = 'gemini-flash-latest';
const ESPERA_REINTENTO = 800;   // ms antes de reintentar el mismo modelo
const MINIMO_PARA_INTENTAR = 500; // si quedan menos de 500 ms, no vale la pena otro intento

export function modelosEnOrden() {
  const principal = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const respaldo = process.env.GEMINI_MODELO_RESPALDO || 'gemini-3.5-flash';
  return [...new Set([principal, respaldo, MODELO_ULTIMO_RECURSO])]; // sin repetir si coinciden
}

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

// partes: el "contents[0].parts" de Gemini (texto, imagen…).
// Devuelve { ok: true, modelo, datos, fallos } o { ok: false, fallos }.
// fallos = [{ modelo, intento, estado }] donde estado es el código HTTP, 'tiempo' o 'red'.
export async function llamarGemini({ llave, partes, generationConfig, plazoTotal = 8500, plazoPorIntento = 4000 }) {
  const inicio = Date.now();
  const resta = () => plazoTotal - (Date.now() - inicio);
  const fallos = [];

  for (const modelo of modelosEnOrden()) {
    for (let intento = 1; intento <= 2; intento++) {
      if (resta() < MINIMO_PARA_INTENTAR) return { ok: false, fallos };
      const control = new AbortController();
      const reloj = setTimeout(() => control.abort(), Math.min(plazoPorIntento, resta()));
      let estado;
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': llave },
          body: JSON.stringify({ contents: [{ parts: partes }], generationConfig }),
          signal: control.signal,
        });
        if (r.ok) return { ok: true, modelo, datos: await r.json(), fallos };
        estado = r.status;
      } catch (e) {
        estado = e.name === 'AbortError' ? 'tiempo' : 'red';
      } finally {
        clearTimeout(reloj);
      }
      console.error(`gemini: ${modelo} (intento ${intento}) falló con estado ${estado}`);
      fallos.push({ modelo, intento, estado });

      // Llave inválida o pedido mal hecho: otro modelo no lo va a arreglar.
      if (estado === 400 || estado === 401 || estado === 403) return { ok: false, fallos };
      // Saturado o error interno: un reintento con el mismo modelo, después de una pausa.
      if ((estado === 503 || estado === 500) && intento === 1 && resta() > ESPERA_REINTENTO + MINIMO_PARA_INTENTAR) {
        await esperar(ESPERA_REINTENTO);
        continue;
      }
      break; // 429, tiempo agotado, red o segundo fallo: siguiente modelo
    }
  }
  return { ok: false, fallos };
}

// Texto de la primera respuesta de Gemini.
export const textoDe = (datos) => datos?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
