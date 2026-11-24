# Vale Menos

Comparador de precios en vivo para Costa Rica. Proyecto final de Estructura de Datos (UNADECA) de Ede.
HTML, CSS y JavaScript sin frameworks + Netlify Functions. Se publica en Netlify desde GitHub.

## Comandos
- `npm test`: 46 pruebas (node --test). Correrlas después de cada cambio.
- `node scripts/servidor-local.mjs`: sitio en http://localhost:8888 (historial y destacados se ven vacíos en local).
- `node scripts/probar-tiendas.mjs "freidora de aire"`: prueba las 8 tiendas en vivo.
- `node scripts/diagnostico-sitemap.mjs monge "freidora de aire"`: revisa Gollo o Monge paso a paso.

## Estructura
- `public/js/core/`: lógica compartida (estructuras.js, emparejamiento.js, optimizador.js, presupuesto.js, tiendas.js).
- `public/js/vistas/`: una página por archivo. Enrutador por hash en `public/js/app.js`.
- `netlify/lib/tiendas/`: un conector por plataforma (vtex, sitemap, woocommerce, mexpress, icon).
- `DOCUMENTACION.md`: estructuras de datos para la defensa. Actualizarla si se agrega o cambia una.

## Reglas
- Tiendas: Walmart, MaxiPalí, Simán, Gollo, Monge, Intelec, MExpress, iCon (8). PriceSmart y Extreme Tech están excluidas porque rechazan consultas automáticas; no volver a agregarlas.
- Si una tienda responde 401/403, se muestra como "No disponible" (gris) y no cuenta como falla. Nunca intentar saltarse el bloqueo.
- El scraper siempre se identifica como `Vale/1.0` (AGENTE en netlify/lib/http.js). Nunca disfrazarlo de navegador.
- Páginas de Gollo/Monge se piden con `pedirPagina` (https con maxHeaderSize alto), no con fetch: Monge manda encabezados de más de 16 KB.
- Nunca inventar precios en la interfaz. Si no hay datos, la sección no se muestra.
- La llave GEMINI_API_KEY va solo en variables de entorno de Netlify, nunca en el código.
- El sitio público no menciona que es un proyecto académico ni explica estructuras de datos.

## Diseño
- Colores sólidos: cobalto #2f4fd8 (hero, botones y enlaces), etiqueta menta #8fe0c0 con texto #063a2a SOLO para el precio ganador (o como marca en el hero, sin precio inventado), ahorro en chip #0d7a57 sobre #e2f6ec. Bandas blanco / #f3f4f6. Franja "Con presupuesto" #111735 y pie #0c1129 con texto #c3c8de. Texto #111827 / #4b5563 / #6b7280 (nunca más claro). Bordes #e5e7eb (tarjetas) y #d1d5db (campos). Sin amarillo ni coral. Todo par texto/fondo cumple WCAG AA.
- Fuente: solo Inter (variable, local en public/fuentes, licencia OFL). Texto 400, menú y botones 500–600, títulos y precios 700 (precios con tabular-nums). Hero entre 2.25 y 3.25 rem con -0.02em.
- Nada de gradientes, brillos ni blur. Sombras solo en lo que flota (buscador del hero, sugerencias, menús, diálogos, avisos). Radios: 8 px controles, 12 px tarjetas, 16 px hero y franjas; chips en píldora. Íconos 20 px con trazo 1.75.
- Movimiento sutil y solo con transform/opacity, apagado con prefers-reduced-motion: encabezado fijo que se compacta, hover de 2 px, :active de 1 px, rebote de cada tienda al responder, filas nuevas con fade, sello del precio ganador, secciones del inicio que aparecen una vez.
- Tooltips propios (data-tip + activarTooltips en ui.js): debajo del botón y nunca fuera de la pantalla. En el inicio hay un solo buscador visible a la vez.
- En teléfono, todo lo que se toca mide al menos 44 px.
- Textos en español de Costa Rica con voseo ("buscá", "comprá"). Tono cálido y directo, nada que suene a IA.
- Revisar que nada se desborde a 1440, 1280, 1024, 768 y 390 px.

## Forma de trabajar
- Ede tiene que poder defender el código ante el profesor: código claro, comentarios en español y explicarle qué se cambió y por qué.
