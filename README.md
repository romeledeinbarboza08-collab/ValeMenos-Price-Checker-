# Vale Menos: lo mismo, pero vale menos

Un comparador de precios en vivo para Costa Rica. Busca un producto en 8 tiendas al mismo tiempo, junta las publicaciones que son el mismo producto y muestra el precio total con envío.

Es el proyecto final de Estructura de Datos. En `DOCUMENTACION.md` está cada estructura y algoritmo, dónde se usa y por qué.

**Tiendas:** Walmart, MaxiPalí y Simán (VTEX), Gollo y Monge (sitemap + JSON-LD), Intelec (WooCommerce), MExpress (nopCommerce) e iCon (Shopify, en dólares). PriceSmart y Extreme Tech no se incluyen porque no permiten consultas automáticas.

**Formas de buscar:** escribir (con autocompletado), foto (Gemini), código de barras (cámara o número) y pegar un enlace.

**Otras funciones:** Mi lista (la combinación de tiendas más barata), Comparar, Favoritos con precio objetivo y avisos, historial de precios, "¿Conviene comprarlo hoy?", Compartir por WhatsApp y Con presupuesto ("¿Qué me alcanza?" y "Armá tu kit").

## Cómo está armado

```
public/                    el sitio (HTML, CSS y JavaScript sin frameworks)
  js/core/                 código que se usa en el navegador y en el servidor
    estructuras.js         Trie, montículo, LRU, Levenshtein, Union-Find, búsqueda binaria
    emparejamiento.js      decide qué ofertas son el mismo producto
    optimizador.js         Mi lista: backtracking con poda
    presupuesto.js         Con presupuesto: mochila de elección múltiple (programación dinámica)
    tiendas.js             datos de cada tienda y reglas de envío
  js/vistas/               una página por archivo
  js/captura.js            foto, código de barras y enlace
  js/app.js                enrutador por hash (#/buscar?q=…)
netlify/functions/
  buscar.mjs               GET  /api/buscar?q=…&tienda=walmart
  tipo-cambio.mjs          GET  /api/tipo-cambio
  historial.mjs            GET  /api/historial?k=…
  destacados.mjs           GET  /api/destacados
  identificar.mjs          POST /api/identificar   (foto → producto, con Gemini y modelos de respaldo)
  codigo.mjs               GET  /api/codigo?ean=…
  enlace.mjs               GET  /api/enlace?url=…
  foto-de-precios.mjs      programada cada 6 horas: historial + "Donde más se ahorra hoy"
netlify/lib/tiendas/       un conector por plataforma (vtex, sitemap, woocommerce, mexpress, icon)
tests/                     pruebas (npm test)
scripts/                   probar-tiendas.mjs y servidor-local.mjs
```

## Correrlo en tu compu

Necesitás Node.js 20 o más nuevo.

```bash
npm install
npm test                                   # 24 pruebas
node scripts/servidor-local.mjs            # http://localhost:8888
node scripts/probar-tiendas.mjs "freidora de aire"
```

En local no funcionan el historial ni los destacados porque necesitan Netlify Blobs. Para probar la foto en local: `GEMINI_API_KEY=tu_llave node scripts/servidor-local.mjs`.

## Publicarlo en Netlify

Las funciones solo se publican si Netlify construye el proyecto, así que **no sirve arrastrar la carpeta**.

1. Subí la carpeta a un repositorio de GitHub.
2. En Netlify: Add new site → Import an existing project → elegí el repositorio. `netlify.toml` ya trae todo.
3. **Búsqueda por foto:** en Google AI Studio creá una llave nueva. En Netlify andá a Site configuration → Environment variables y agregá `GEMINI_API_KEY` con esa llave. (Opcionales: `GEMINI_MODEL`, el modelo principal, por defecto `gemini-3.8-flash`; y `GEMINI_MODELO_RESPALDO`, el que se usa si el principal está saturado, por defecto `gemini-3.5-flash`. Si los dos fallan se prueba `gemini-flash-latest`.) Volvé a publicar. La llave nunca va en el código ni en el chat.
4. **Destacados de la portada:** en Netlify → Functions → `foto-de-precios` → **Run now** una vez. Después corre sola cada 6 horas. Mientras no haya datos, la sección simplemente no aparece (nunca se inventan precios).

## Ética

Nos identificamos siempre como `Vale/1.0`, no nos hacemos pasar por un navegador, revisamos el robots.txt de cada tienda antes de conectarla, usamos caché y pocas consultas por búsqueda. La función de enlaces solo abre páginas de las 8 tiendas.
