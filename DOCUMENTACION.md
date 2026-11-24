# Vale Menos: estructuras de datos y algoritmos

Este documento sirve de guía para la defensa: qué estructura se usa, en qué archivo y qué problema resuelve.

| # | Estructura / algoritmo | Archivo | Para qué se usa | Complejidad |
|---|---|---|---|---|
| 1 | **Trie** (árbol de prefijos) | `core/estructuras.js`, usado en `estado.js` y `autocompletar.js` | Autocompletado del buscador. Cada palabra guarda un peso; lo que la persona ya buscó pesa más. | Insertar O(L); sugerir O(L + nodos visitados) |
| 2 | **Montículo binario** + `topK` | `core/estructuras.js`, usado en `foto-de-precios.mjs` | Elegir los 12 productos con mayor ahorro entre cientos sin ordenar todo. | O(n log k) |
| 3 | **Caché LRU** (lista doblemente enlazada + Map) | `core/estructuras.js`, usado en `api.js` (30 respuestas) y `estado.js` (8 vistos) | Volver atrás sin repetir consultas; "Vistos hace poco". | O(1) por operación |
| 4 | **Distancia de Levenshtein** (programación dinámica) | `core/estructuras.js`, usado en `vistas/buscar.js` y `emparejamiento.js` | "¿Quisiste decir…?" y tolerar errores de escritura en modelos. Tiene un tope para cortar temprano. Al calcular la relevancia, el sustantivo de la consulta (monitor, laptop) admite como máximo 1 error; las demás palabras de 7+ letras admiten 2. | O(a·b) |
| 5 | **Union-Find** (conjuntos disjuntos) | `core/emparejamiento.js` | Agrupar ofertas de distintas tiendas que son el mismo producto. Si A≈B y B≈C, quedan en el mismo grupo. | Casi O(1) amortizado |
| 6 | **Búsqueda binaria** (límite inferior/superior) | `core/estructuras.js`, usado en `vistas/buscar.js` y `analisis.js` | Filtro de rango de precio sobre la lista ordenada; recortar el historial a los últimos 30 días. | O(log n) |
| 7 | **Mediana** | `core/estructuras.js` | Precio típico del mes (no se deja engañar por un pico) y descartar ofertas con precio atípico (más de 15 % de la mediana) al agrupar. En Con presupuesto se descarta la opción que cueste menos del 35 % de la mediana de las demás opciones de ese producto (`quitarPreciosAtipicos`). | O(n log n) |
| 8 | **Tabla hash** (Map) | en todo el proyecto | Agrupar por clave de producto, por tienda, conteos de filtros. | O(1) promedio |
| 9 | **Cola FIFO con límite de concurrencia** | `netlify/lib/http.js` (`colaConLimite`) | Abrir varias páginas de producto sin saturar a la tienda (máx. 3 a 5 a la vez). | O(n) |
| 10 | **Índice invertido** | `netlify/lib/tiendas/sitemap.js` | Gollo y Monge no tienen buscador público: se descarga su sitemap (miles de URLs), se indexa palabra → URLs y se busca por puntaje. Se guarda 24 h. | Construir O(total de palabras); buscar O(palabras de la consulta + coincidencias) |
| 11 | **Backtracking con poda** | `core/optimizador.js` | Mi lista: qué tienda para cada producto para que productos + envíos salgan lo más barato. Una rama se corta si ya cuesta más que la mejor encontrada. | Peor caso O(tiendasⁿ), n ≤ 8 |
| 12 | **Mochila de elección múltiple** (programación dinámica) | `core/presupuesto.js` | Con presupuesto → Armá tu kit: elegir a lo sumo una opción por producto sin pasarse, primero lo imprescindible. El dinero se cuenta en unidades de ₡500 (tabla de máx. 4000 columnas). | O(productos × opciones × W) |

## Cómo se decide que dos ofertas son "el mismo producto"

1. `normalizarTexto` quita tildes, mayúsculas, palabras de relleno ("celular", "nuevo") y unifica unidades ("256GB" = "256 gb", "64 g" = "64g", "160 ml" = "160ml").
2. `extraerAtributos` saca marca, modelo, almacenamiento, RAM, pulgadas, litros, color, **contenido** (peso o volumen del empaque: g, kg, ml, oz) y **variante** (sabor o aroma, de la lista `VARIANTES`). El contenido nunca forma parte del modelo, y "5G" en un celular no cuenta como 5 gramos.
   - En productos **sin modelo** (supermercado) la firma son las palabras útiles más las de variante. Si una oferta tiene un sabor que la otra no tiene, son distintas: "Maruchan pollo 64 g" ≠ "Maruchan pollo picante 64 g". Si las dos dicen el contenido y es distinto (64 g ≠ 85 g), también.
3. **Pasada estricta:** se unen solo ofertas con la misma marca, modelo y capacidad.
4. **Pasada flexible:** una oferta a la que le falta un dato (por ejemplo la tienda no dice los GB) se une solo si hay **un único** grupo candidato y el precio no se aleja más de 15 % de su mediana. Si no, queda aparte. Estos grupos se marcan con confianza "media".

## Cómo se decide si un resultado es lo que se buscó

`relevancia()` y `esCategoriaAjena()` en `core/emparejamiento.js`:

1. **Relevancia** = qué fracción de las palabras de la consulta aparece en el título (exacta 1, prefijo 0.9, 1 error 0.8, 2 errores 0.6). Por debajo de 0.6 la oferta se descarta (`netlify/lib/buscar.js`).
2. **El sustantivo manda:** la primera palabra sin números de la consulta dice qué producto es. Solo se le tolera 1 error ("ipone" → iphone), nunca 2; con 2, "monitor" encontraba "monster".
3. **Los números cuentan como medida o modelo:** "24" coincide con 24", 24 pulgadas o modelos como S24 / 24MK600. Las escalas tipo "1:24" se quitan antes de comparar.
4. **Categorías que no corresponden** (juguetes y bebés, higiene y cuidado personal, mascotas, personajes como Mickey Mouse): se revisa la categoría que manda la tienda y, si no hay, frases del título ("de juguete", "hot wheels", "cepillo de dientes"). Si la consulta pide esa categoría ("juguete", "cepillo", "secadora de pelo"), no se filtra. Estos resultados no se borran: pasan a la sección de secundarios.

## Flujo de una búsqueda

1. El navegador llama `/api/buscar?q=…&tienda=X` **una vez por tienda, en paralelo**.
2. Cada función consulta esa tienda, convierte dólares con el tipo de cambio de Hacienda y descarta lo poco relevante.
3. Conforme llega cada tienda, el navegador reagrupa todo y repinta, así los resultados aparecen de a poco.
4. Se suma el envío según la zona (GAM o fuera) y se ordena por total.
5. Los precios se guardan en Netlify Blobs para el historial.

## Buscar sin escribir

- **Foto:** se achica en el navegador (máx. 1024 px), se manda a `/api/identificar`, Gemini devuelve qué producto es y qué buscar. La foto no se guarda. Gemini a veces responde 503 (saturado): `netlify/lib/gemini.js` reintenta una vez tras 800 ms con el mismo modelo y después pasa a `GEMINI_MODELO_RESPALDO` y a `gemini-flash-latest`. Cada intento tiene su `AbortController` y todo termina antes de 8.5 s (Netlify corta a los 10 s). La respuesta dice qué modelo contestó (`modeloIA`).
- **Código de barras:** `BarcodeDetector` del navegador o la librería html5-qrcode. `/api/codigo` (`netlify/lib/codigo.js`) primero pregunta el EAN exacto a Walmart, MaxiPalí y Simán (`/api/catalog_system/pub/products/search?fq=alternateIds_Ean:`, en paralelo); si una lo tiene, se usa el nombre de la tienda. Si no, consulta **en paralelo** (`Promise.allSettled`, 3 s) Open Food Facts, Open Beauty Facts y Open Products Facts, y se queda con la primera que diga status 1 en el orden comida > belleza > productos (una pasta dental da status 0 en la de comida). Si las tres dicen que no, pregunta a UPCitemdb. Responde también qué fuente se usó. Con el nombre se arma una **consulta corta** (marca + tipo + sabor, máximo 4 palabras, sin frases de empaque como "instant lunch" o "sabor a"), porque el buscador de VTEX exige todas las palabras. Si hay `GEMINI_API_KEY`, Gemini resume el nombre (nunca se le manda solo el número). La respuesta trae `alternativas` [corta, marca + tipo, solo marca]: si una da 0 resultados, la página prueba la siguiente y avisa. Si ninguna lo conoce se busca el número tal cual: como el título no contiene el número, para consultas de solo dígitos (8 a 14) **no se aplica el filtro de relevancia**. En las tiendas que mandan el EAN de cada producto (VTEX) solo quedan los que tienen exactamente ese código (sin contar ceros a la izquierda) y se marcan como `coincidenciaExacta`; nada de eso se manda a "secundarios".
- **Enlace:** `/api/enlace` abre el enlace solo si es de una de las 8 tiendas (lista blanca); si no, saca el nombre de las palabras de la URL.

## Pruebas

`npm test` corre 24 pruebas: estructuras, emparejamiento (incluye 256 vs 512 GB y precio atípico), conectores con respuestas simuladas, la mochila, el índice invertido y la selección de destacados.
