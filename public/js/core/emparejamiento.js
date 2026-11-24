// Emparejamiento: decidir qué publicaciones de distintas tiendas son el MISMO producto.
// Es la parte donde MisterPrecios falla (mezcla 256 GB con 512 GB), así que aquí
// la capacidad, la RAM y la línea del modelo (Pro, Max, Ultra…) nunca se mezclan.

import { ConjuntosDisjuntos, levenshtein, sinTildes, mediana } from './estructuras.js';

const MARCAS = [
  'apple', 'samsung', 'xiaomi', 'redmi', 'poco', 'motorola', 'honor', 'huawei', 'oppo', 'realme', 'vivo', 'nokia',
  'google', 'oneplus', 'tcl', 'zte', 'blu', 'lg', 'sony', 'hisense', 'philips', 'panasonic', 'jbl', 'bose',
  'lenovo', 'hp', 'dell', 'asus', 'acer', 'msi', 'microsoft', 'nintendo', 'xbox', 'playstation', 'logitech',
  'oster', 'black decker', 'black+decker', 'hamilton beach', 'ninja', 'cuisinart', 'mabe', 'whirlpool', 'frigidaire',
  'electrolux', 'midea', 'daewoo', 'atvio', 'mainstays', 'imaco', 'taurus', 'remington', 'conair', 'braun',
  'dji', 'garmin', 'amazfit', 'beats', 'anker', 'belkin', 'kitchenaid', 'westinghouse', 'haier', 'sankey', 'premier',
  'rca', 'mertec', 'truvolt', 'maggio', 'telstar', 'tefal', 'cosori', 'kalley', 'chefman', 'gourmia', 'instant', 'recco', 'durabrand', 'xtech', 'klip',
];

// La "línea" de un modelo: si estas palabras no coinciden, NO es el mismo producto.
const LINEA = new Set(['pro', 'max', 'ultra', 'plus', 'mini', 'fe', 'lite', 'air', 'edge', 'neo', 'prime', 'e', 'slim', 'flip', 'fold']);

// Familias conocidas: ayudan a armar la "firma" del modelo.
const FAMILIAS = new Set([
  'iphone', 'ipad', 'macbook', 'imac', 'airpods', 'watch', 'galaxy', 'tab', 'buds', 'redmi', 'note', 'poco', 'moto',
  'razr', 'pixel', 'magic', 'nova', 'xbox', 'series', 'switch', 'playstation', 'ps5', 'ideapad', 'thinkpad', 'vivobook',
  'zenbook', 'pavilion', 'inspiron', 'aspire', 'nitro', 'legion', 'yoga', 'chromebook', 'surface', 'mate', 'reno',
]);

const COLORES = {
  negro: 'Negro', black: 'Negro', grafito: 'Grafito', medianoche: 'Medianoche', midnight: 'Medianoche',
  blanco: 'Blanco', white: 'Blanco', estelar: 'Blanco estelar', starlight: 'Blanco estelar',
  azul: 'Azul', blue: 'Azul', celeste: 'Celeste', gris: 'Gris', gray: 'Gris', grey: 'Gris',
  plata: 'Plata', plateado: 'Plata', silver: 'Plata', verde: 'Verde', green: 'Verde', menta: 'Menta',
  rojo: 'Rojo', red: 'Rojo', rosado: 'Rosado', rosa: 'Rosado', pink: 'Rosado', morado: 'Morado', purpura: 'Morado',
  lila: 'Lila', lavanda: 'Lavanda', purple: 'Morado', dorado: 'Dorado', oro: 'Dorado', gold: 'Dorado',
  titanio: 'Titanio', naranja: 'Naranja', orange: 'Naranja', amarillo: 'Amarillo', yellow: 'Amarillo', cafe: 'Café',
  marron: 'Café', beige: 'Beige', crema: 'Crema', turquesa: 'Turquesa', coral: 'Coral', bronce: 'Bronce',
};

// Palabras que adornan el título pero no identifican el modelo.
const RELLENO = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'con', 'y', 'para', 'en', 'a', 'por', 'un', 'una', 'color', 'tono',
  'celular', 'celulares', 'smartphone', 'telefono', 'movil', 'nuevo', 'nueva', 'version', 'desbloqueado', 'liberado',
  '5g', '4g', 'lte', 'dual', 'sim', 'esim', 'nanosim', 'ram', 'gb', 'almacenamiento', 'memoria', 'interna',
  'pantalla', 'camara', 'posterior', 'frontal', 'experiencia', 'potente', 'chip', 'procesador', 'bateria',
  'intenso', 'intensa', 'cosmico', 'cosmica', 'oscuro', 'oscura', 'claro', 'clara', 'profundo', 'natural', 'cielo',
  'capacidad', 'digital', 'unidad', 'unidades', 'pulgadas', 'pulg', 'litros', 'lts', 'equipo', 'modelo', 'mod',
  'original', 'oficial', 'garantia', 'envio', 'gratis', 'oferta', 'promo', 'combo', 'edicion', 'generacion', 'gen',
]);

// Si el título trae alguna de estas, es un accesorio (funda, cargador…), no el equipo.
const ACCESORIO = new Set([
  'funda', 'case', 'estuche', 'protector', 'vidrio', 'mica', 'cargador', 'cable', 'adaptador', 'soporte', 'correa',
  'pulso', 'care', 'applecare', 'skin', 'lamina', 'templado', 'cubierta', 'carcasa', 'repuesto', 'filtro', 'bolsa',
  'magsafe', 'lapiz', 'stylus', 'teclado', 'base', 'dock', 'hub', 'audifonos', 'audifono', 'mousepad',
]);

// Variantes de productos de supermercado (sabor, aroma). Dos productos sin modelo que
// difieren en una de estas palabras son distintos: "Maruchan pollo" ≠ "Maruchan pollo picante".
export const VARIANTES = new Set([
  'picante', 'pollo', 'res', 'carne', 'cerdo', 'camaron', 'mariscos', 'jamon', 'tocino', 'queso', 'chile', 'habanero',
  'jalapeno', 'tomate', 'vegetales', 'verduras', 'cebolla', 'ajo', 'limon', 'lima', 'naranja', 'mandarina', 'mango',
  'fresa', 'frambuesa', 'mora', 'uva', 'manzana', 'pera', 'durazno', 'melocoton', 'pina', 'coco', 'banano', 'sandia',
  'cereza', 'maracuya', 'guanabana', 'tamarindo', 'menta', 'hierbabuena', 'canela', 'vainilla', 'chocolate', 'cafe',
  'caramelo', 'miel', 'mantequilla', 'lavanda', 'eucalipto', 'manzanilla', 'sabila', 'aloe', 'carbon', 'sensitive',
  'light', 'diet', 'zero', 'deslactosada', 'descremada', 'integral',
]);

/* ------------------------------------------------------------------
 * 1) Normalizar un título: minúsculas, sin tildes, unidades unificadas
 * ------------------------------------------------------------------ */
export function normalizarTexto(titulo) {
  let t = sinTildes(String(titulo || '').toLowerCase());
  t = t.replace(/(\d),(\d)/g, '$1.$2');                                  // 4,2 -> 4.2
  t = t.replace(/\b(\d+)\s+(\d)\s*(litros?|lts?|l)\b/g, '$1.$2 $3');            // "4 2 l" (coma perdida) -> 4.2 l
  t = t.replace(/(\d+)\s*(?:tb|terabytes?)\b/g, (_, n) => `${n * 1024}gb`);
  t = t.replace(/(\d+)\s*(?:gb|gigas?|gigabytes?|g\.b\.)(?![a-z])/g, '$1gb');
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:mp|megapixeles)\b/g, ' ');           // cámara: no sirve para emparejar
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:mah|hz|nits|w|watts?)\b/g, ' ');
  t = t.replace(/(?:pantalla|display)\s+(?:de\s+)?(\d+(?:\.\d+)?)/g, '$1in');
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:pulgadas|pulg|"|''|in)(?![a-z])/g, '$1in');
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:ml|mililitros?)(?![a-z])/g, '$1ml');   // "160 ml" es UNA medida, no dos palabras
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:g|gr|grs|gramos?)(?![a-z0-9])/g, '$1g'); // "64 g", "150 gramos" -> 64g, 150g
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilos?|kilogramos?)(?![a-z])/g, '$1kg');
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:oz|onzas?)(?![a-z])/g, '$1oz');
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:litros?|lts?|l)(?![a-z])/g, '$1l');
  t = t.replace(/\b(?:chip|procesador)\s+[a-z]*\d+[a-z0-9]*/g, ' ');        // "chip a19"
  t = t.replace(/black\s*(?:\+|&|and|y|a)?\s*decker/g, 'black_decker').replace(/hamilton\s+beach/g, 'hamilton_beach');
  t = t.replace(/\bmouse\s*pad\b/g, 'mousepad');                          // el mouse pad es un accesorio, no un mouse
  t = t.replace(/[^a-z0-9._ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t;
}

export function tokens(texto) {
  return texto.split(' ').map((x) => x.replace(/^\.+|\.+$/g, '')).filter(Boolean);
}

/* ------------------------------------------------------------------
 * 2) Extraer atributos del título
 * ------------------------------------------------------------------ */
// ¿Este token es un contenido de empaque? 64g, 1.5kg, 160ml, 3oz.
// No cuenta 2g a 5g: eso es la red del celular ("5G"), no un peso.
function esContenido(t) {
  const m = t.match(/^(\d+(?:\.\d+)?)(g|kg|ml|oz)$/);
  return Boolean(m) && !(m[2] === 'g' && Number(m[1]) <= 5);
}

export function extraerAtributos(titulo, marcaTienda = '') {
  const norm = normalizarTexto(titulo);
  const tk = tokens(norm);

  // Marca: primero la que dice la tienda; si no, la primera marca conocida en el título.
  let marca = normalizarTexto(marcaTienda).replace(/ /g, '_');
  if (!marca || !MARCAS.some((m) => m.replace(/[ +]/g, '_').replace('black_decker', 'black_decker') === marca)) {
    const encontrada = MARCAS.find((m) => tk.includes(m.replace(/[ +]/g, '_')) || tk.includes(m));
    marca = encontrada ? encontrada.replace(/[ +]/g, '_') : marca || '';
  }
  if (marca === 'black+decker') marca = 'black_decker';
  if (marca === 'redmi' || marca === 'poco') marca = 'xiaomi';

  // Capacidad y RAM. "12gb ram 512gb" -> ram 12, almacenamiento 512.
  const gbs = [...norm.matchAll(/(\d+)gb/g)].map((m) => Number(m[1]));
  let ram = null;
  const mRam = norm.match(/(\d+)gb\s*(?:de\s*)?ram/) || norm.match(/ram\s*(?:de\s*)?(\d+)gb/);
  if (mRam) ram = Number(mRam[1]);
  let almacenamiento = null;
  const candidatos = gbs.filter((g) => g !== ram);
  if (candidatos.length) {
    const mayor = Math.max(...candidatos);
    if (mayor >= 32) almacenamiento = mayor;
    else if (ram == null && candidatos.length === 1 && /ram/.test(norm)) ram = mayor;
  }
  if (ram == null && gbs.length >= 2) {
    const menor = Math.min(...gbs);
    if (menor <= 24 && menor !== almacenamiento) ram = menor;
  }

  const pulgadas = (norm.match(/(\d+(?:\.\d+)?)in\b/) || [])[1];
  const litros = (norm.match(/(\d+(?:\.\d+)?)l\b/) || [])[1];

  let color = null;
  for (const t of tk) if (COLORES[t]) { color = COLORES[t]; break; }

  const accesorio = tk.some((t) => ACCESORIO.has(t));

  // Contenido del empaque (peso o volumen). Es un dato del producto, no su modelo.
  const contenido = tk.find(esContenido) || null;

  // Variante (sabor/aroma). "Menta" justo después de "verde" o "color" es un color, no un sabor.
  const variante = [...new Set(tk.filter((t, i) =>
    VARIANTES.has(t) && !(t === 'menta' && /^(verde|color)$/.test(tk[i - 1] || ''))))].sort();

  // Firma del modelo: códigos con números (s25, a56, 17) + familias + línea.
  const significativos = tk.filter((t) =>
    !RELLENO.has(t) && !COLORES[t] && t !== marca && !MARCAS.includes(t) &&
    !/^\d+(?:\.\d+)?(gb|in|l)$/.test(t) && !esContenido(t) && t.length > 0);
  let firma = significativos.filter((t) => /\d/.test(t) || FAMILIAS.has(t) || LINEA.has(t));
  // Sin códigos de modelo (una freidora sin modelo, una sopa, una pasta dental): la firma
  // son las primeras palabras útiles, y las de variante (sabor) siempre entran aunque estén al final.
  const sinModelo = firma.filter((t) => !LINEA.has(t)).length === 0;
  if (sinModelo) firma = [...significativos.slice(0, 5), ...variante];
  firma = [...new Set(firma)];
  const linea = firma.filter((t) => LINEA.has(t)).sort();

  return {
    norm, marca, almacenamiento, ram,
    pulgadas: pulgadas ? Number(pulgadas) : null,
    litros: litros ? Number(litros) : null,
    color, accesorio, firma, linea, contenido, variante, sinModelo,
  };
}

// Clave legible del producto: marca|firma|capacidad. El color queda fuera (es variante).
export function claveProducto(a) {
  const partes = [a.marca || 'x', [...a.firma].sort().join('-') || 'sinmodelo'];
  if (a.almacenamiento) partes.push(`${a.almacenamiento}gb`);
  if (a.ram) partes.push(`${a.ram}ram`);
  if (a.pulgadas) partes.push(`${a.pulgadas}in`);
  if (a.litros) partes.push(`${a.litros}l`);
  if (a.contenido) partes.push(a.contenido);
  return partes.join('|');
}

/* ------------------------------------------------------------------
 * 3) ¿Dos ofertas son el mismo producto?
 * ------------------------------------------------------------------ */
function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

// Modo estricto: un dato que falta solo es igual a otro que también falta.
// Modo flexible: un dato que falta es "comodín".
const compatible = (x, y, estricto) => (estricto ? x === y : x == null || y == null || x === y);

export function mismoProducto(a, b, estricto = false) {
  if (a.ean && b.ean && a.ean === b.ean) return { igual: true, confianza: 'alta', motivo: 'mismo código de barras' };
  if (a.accesorio !== b.accesorio) return { igual: false };
  if (!a.marca || a.marca !== b.marca) return { igual: false };
  if (a.linea.join() !== b.linea.join()) return { igual: false };          // Pro ≠ Pro Max
  if (!compatible(a.almacenamiento, b.almacenamiento, estricto)) return { igual: false }; // 256 GB ≠ 512 GB
  if (!compatible(a.ram, b.ram, estricto)) return { igual: false };
  // Pulgadas y litros siempre son flexibles: muchas tiendas los ponen solo como dato
  // de marketing ("pantalla 6.3"), y si ambos los traen y no coinciden, sí se separan.
  if (!compatible(a.pulgadas, b.pulgadas, false)) return { igual: false };
  if (!compatible(a.litros, b.litros, false)) return { igual: false };
  // Contenido del empaque: si los dos lo dicen y es distinto (64 g ≠ 85 g), son otro producto.
  if (!compatible(a.contenido, b.contenido, false)) return { igual: false };
  // Productos sin modelo (supermercado): si uno tiene un sabor que el otro no, son distintos.
  if ((a.sinModelo || b.sinModelo) && a.variante.join() !== b.variante.join()) return { igual: false };

  const parecido = jaccard(a.firma, b.firma);
  if (parecido >= 0.999) {
    const completo = a.almacenamiento === b.almacenamiento || (a.almacenamiento == null && b.almacenamiento == null);
    return { igual: true, confianza: completo ? 'alta' : 'media', motivo: 'mismo modelo' };
  }
  if (parecido >= 0.66) return { igual: true, confianza: 'media', motivo: `modelo parecido (${Math.round(parecido * 100)} %)` };
  return { igual: false };
}

/* ------------------------------------------------------------------
 * 4) Agrupar todas las ofertas
 *    - Primero se reparten por marca en una tabla hash (Map), así solo se comparan
 *      ofertas de la misma marca: O(Σ b²) en vez de O(n²).
 *    - Las parejas iguales se unen con Union-Find.
 * ------------------------------------------------------------------ */
export function agruparOfertas(ofertas) {
  const attrs = ofertas.map((o) => extraerAtributos(o.titulo, o.marca));
  attrs.forEach((a, i) => { a.ean = ofertas[i].ean || null; });

  const porMarca = new Map();
  attrs.forEach((a, i) => {
    const k = a.marca || `__sin_marca_${i}`;
    if (!porMarca.has(k)) porMarca.set(k, []);
    porMarca.get(k).push(i);
  });

  // Los códigos de barras pueden unir ofertas aunque la marca venga distinta.
  const porEan = new Map();
  const uf = new ConjuntosDisjuntos(ofertas.length);
  const confianza = new Array(ofertas.length).fill('alta');

  attrs.forEach((a, i) => {
    if (!a.ean) return;
    if (porEan.has(a.ean)) uf.unir(porEan.get(a.ean), i);
    else porEan.set(a.ean, i);
  });

  // Pasada 1 (estricta): solo se unen ofertas con los mismos datos.
  for (const indices of porMarca.values()) {
    for (let x = 0; x < indices.length; x++) {
      for (let y = x + 1; y < indices.length; y++) {
        const i = indices[x];
        const j = indices[y];
        const r = mismoProducto(attrs[i], attrs[j], true);
        if (r.igual) {
          uf.unir(i, j);
          if (r.confianza === 'media') { confianza[i] = 'media'; confianza[j] = 'media'; }
        }
      }
    }
  }

  // Pasada 2 (flexible): una oferta a la que le falta la capacidad o la RAM se pega a un
  // grupo SOLO si encaja en uno. Si encaja en dos (256 GB y 512 GB) se queda aparte:
  // así una tienda incompleta nunca funde dos versiones distintas, que es el error
  // que vimos en MisterPrecios.
  const MAX_DESVIO_PRECIO = 0.15;
  const incompleta = (a) => a.almacenamiento == null || a.ram == null;
  // j "completa" a i si trae al menos uno de los datos que a i le faltan.
  const completa = (i, j) =>
    (attrs[i].almacenamiento == null && attrs[j].almacenamiento != null) ||
    (attrs[i].ram == null && attrs[j].ram != null);
  for (const indices of porMarca.values()) {
    for (const i of indices) {
      if (!incompleta(attrs[i])) continue;
      const raices = new Set();
      for (const j of indices) {
        if (j === i || uf.buscar(j) === uf.buscar(i) || !completa(i, j)) continue;
        if (mismoProducto(attrs[i], attrs[j], false).igual) raices.add(uf.buscar(j));
      }
      if (raices.size === 1) {
        const [r] = raices;
        // Detector de valores atípicos: si el precio se aleja más de 15 % de la mediana
        // del grupo, probablemente es otra versión (ej. 512 GB sin decirlo). Queda aparte.
        // Se revisa todo el grupo de i (puede traer otras ofertas sin capacidad ya unidas a ella).
        const propio = uf.buscar(i);
        const precios = indices.filter((j) => uf.buscar(j) === propio).map((j) => ofertas[j].precio).filter(Boolean);
        const tipico = mediana(indices.filter((j) => uf.buscar(j) === r).map((j) => ofertas[j].precio).filter(Boolean));
        if (tipico && precios.some((p) => Math.abs(p - tipico) / tipico > MAX_DESVIO_PRECIO)) continue;
        uf.unir(i, r);
        // Si solo faltaba la RAM (Apple casi nunca la pone), la unión sigue siendo segura.
        // Si faltaba la capacidad, la marcamos como "media" para que el sitio lo avise.
        if (attrs[i].almacenamiento == null) {
          confianza[i] = 'media';
          confianza[r] = 'media';
        }
      }
    }
  }

  const grupos = new Map(); // raíz -> índices
  ofertas.forEach((_, i) => {
    const r = uf.buscar(i);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r).push(i);
  });

  return [...grupos.values()].map((idx) => armarGrupo(idx.map((i) => ({ ...ofertas[i], attrs: attrs[i] })), idx.some((i) => confianza[i] === 'media') ? 'media' : 'alta'));
}

function armarGrupo(miembros, confianza) {
  // El atributo más completo gana (si una tienda no dice la capacidad, otra sí).
  const primero = (campo) => miembros.map((m) => m.attrs[campo]).find((v) => v != null) ?? null;
  const todosDicen = (campo) => (miembros.every((m) => m.attrs[campo] != null) ? miembros[0].attrs[campo] : null);

  // La firma que más se repite entre las tiendas (si empatan, la más corta).
  const conteo = new Map();
  for (const m of miembros) {
    const k = [...m.attrs.firma].sort().join('-');
    conteo.set(k, (conteo.get(k) || 0) + 1);
  }
  const base = miembros
    .map((m) => ({ m, veces: conteo.get([...m.attrs.firma].sort().join('-')) }))
    .sort((a, b) => b.veces - a.veces || a.m.attrs.firma.length - b.m.attrs.firma.length)[0].m;

  const attrs = {
    marca: base.attrs.marca,
    firma: base.attrs.firma,
    linea: base.attrs.linea,
    almacenamiento: primero('almacenamiento'),
    ram: primero('ram'),
    pulgadas: primero('pulgadas'),
    litros: primero('litros'),
    contenido: primero('contenido'),
    accesorio: base.attrs.accesorio,
  };
  // La clave solo usa pulgadas/litros/contenido si TODAS las tiendas los dicen; así la clave
  // (y el enlace al producto) no cambia según qué tienda haya respondido.
  const clave = claveProducto({ ...attrs, pulgadas: todosDicen('pulgadas'), litros: todosDicen('litros'), contenido: todosDicen('contenido') });
  const colores = [...new Set(miembros.map((m) => m.attrs.color).filter(Boolean))];
  const ofertas = miembros
    .map(({ attrs: a, ...o }) => ({ ...o, color: a.color }))
    .sort((a, b) => a.precio - b.precio);

  return {
    clave,
    titulo: tituloLimpio(miembros, attrs),
    marca: attrs.marca,
    imagen: ofertas.find((o) => o.imagen)?.imagen || null,
    atributos: attrs,
    colores,
    confianza,
    ofertas,
  };
}

// Título para mostrar: se limpia el de cada tienda y se escoge el más corto.
const SIGLAS = new Set(['GB', 'TB', 'RAM', 'USB', 'LED', 'TV', 'HD', 'UHD', 'FHD', 'QLED', 'OLED', 'SSD', 'HDD', 'JBL', 'LG', 'HP', 'TCL', 'BLU', 'MSI', 'DJI', 'ZTE', 'AMD', 'NFC', 'GPS', 'WIFI', '5G', '4G']);

function quitarRepetidos(palabras) {
  // "Apple iPhone 17 Pro iPhone 17 Pro 256GB" -> "Apple iPhone 17 Pro 256GB"
  const bajo = palabras.map((p) => sinTildes(p.toLowerCase()));
  for (let largo = 4; largo >= 2; largo--) {
    for (let i = 0; i + 2 * largo <= bajo.length; i++) {
      const trozo = bajo.slice(i, i + largo).join(' ');
      for (let j = i + largo; j + largo <= bajo.length; j++) {
        if (bajo.slice(j, j + largo).join(' ') === trozo) {
          palabras.splice(j, largo);
          bajo.splice(j, largo);
          return quitarRepetidos(palabras);
        }
      }
    }
  }
  return palabras;
}

export function limpiarTitulo(titulo, atributos = {}) {
  let partes = titulo.replace(/\s+/g, ' ').trim().split(' ');

  // Cortar desde el color en adelante (solo colores en español: "Black" suele ser parte
  // de una marca, como Black+Decker).
  const INGLES = ['black', 'white', 'blue', 'gray', 'grey', 'silver', 'green', 'red', 'pink', 'purple', 'gold', 'orange', 'yellow', 'midnight', 'starlight'];
  const idx = partes.findIndex((p, i) => {
    const w = sinTildes(p.toLowerCase()).replace(/[^a-z]/g, '');
    return i > 1 && COLORES[w] && !INGLES.includes(w);
  });
  if (idx > 1) partes = partes.slice(0, idx);

  // "Celular", "Smartphone" al inicio no aportan.
  while (partes.length > 2 && /^(celular|smartphone|telefono|teléfono)$/i.test(partes[0])) partes.shift();

  partes = quitarRepetidos(partes);
  // Una palabra suelta al final que ya apareció antes ("… 256GB iPhone") también sobra.
  while (partes.length > 2 && partes.slice(0, -1).some((p) => p.toLowerCase() === partes.at(-1).toLowerCase())) partes.pop();
  let t = partes.join(' ')
    .replace(/\s+(color|de color|en|y|con)$/i, '')
    .replace(/(\d+\s*GB)\s*\/\s*\d+\s*GB/gi, '$1');            // "512GB/12GB" -> "512GB"

  // Mayúsculas: "APPLE" -> "Apple", "PRO" -> "Pro"; las siglas (GB, TV, USB) se quedan.
  t = t.replace(/\b([A-ZÁÉÍÓÚÑ]{3,})\b/g, (w) => (SIGLAS.has(w) ? w : w[0] + w.slice(1).toLowerCase()));
  t = t.replace(/\b(pro|max|plus|ultra|mini|air|lite)\b/g, (w) => w[0].toUpperCase() + w.slice(1));
  const OFICIAL = { iphone: 'iPhone', ipad: 'iPad', airpods: 'AirPods', macbook: 'MacBook', imac: 'iMac' };
  t = t.replace(/\b(iphone|ipad|airpods|macbook|imac)\b/gi, (w) => OFICIAL[w.toLowerCase()]);
  t = t.replace(/(\d+)\s*(GB|TB)\b/gi, (_, n, u) => `${n} ${u.toUpperCase()}`);

  // Si el grupo tiene capacidad y el título no la dice, se agrega.
  if (atributos.almacenamiento && !/\d+ (GB|TB)/.test(t)) {
    t += atributos.almacenamiento >= 1024 ? ` ${atributos.almacenamiento / 1024} TB` : ` ${atributos.almacenamiento} GB`;
  }
  return t.trim();
}

function tituloLimpio(miembros, atributos) {
  const candidatos = miembros.map((m) => limpiarTitulo(m.titulo, atributos));
  candidatos.sort((a, b) => a.length - b.length);
  return candidatos.find((c) => c.length >= 12) || candidatos[0];
}

/* ------------------------------------------------------------------
 * 5) Relevancia: ¿qué tanto se parece el título a lo que buscó la persona?
 *    Tolera errores de dedo con Levenshtein ("ipone" encuentra "iphone").
 * ------------------------------------------------------------------ */
export function palabrasConsulta(consulta) {
  return tokens(normalizarTexto(consulta)).filter((t) => !RELLENO.has(t) || /\d/.test(t));
}

// El "sustantivo" de la consulta: la primera palabra sin números, la que dice QUÉ
// producto es ("monitor" en "monitor 24", "freidora" en "freidora de aire").
export function sustantivoConsulta(consulta) {
  return palabrasConsulta(consulta).find((p) => !/\d/.test(p)) || null;
}

// Quita del título las escalas y proporciones ("escala 1:24", "1/64") para que su
// número no se confunda con una medida o un modelo.
function sinEscalas(titulo) {
  return String(titulo || '').replace(/\b\d+\s*[:/]\s*\d+\b/g, ' ');
}

// ¿El número de la consulta aparece en el título como medida o como modelo?
//   "24" coincide con 24 suelto, con 24in (24" o 24 pulgadas ya normalizado), 4l, 128gb…
//   y con modelos como "s24" o "24mk600". No coincide con 2024 ni 124.
function numeroCoincide(palabra, t) {
  const n = palabra.match(/^\d+(?:\.\d+)?/)?.[0];
  if (!n) return false;
  if (t.includes(palabra)) return true;
  if (palabra !== n) return false;                                     // "24in" pide justo 24in
  const medida = new RegExp(`^${n.replace('.', '\\.')}[a-z]+$`);       // 24in, 4l, 128gb
  const modelo = new RegExp(`(^|[a-z])${n.replace('.', '\\.')}($|[a-z])`); // s24, 24mk600
  return t.some((x) => medida.test(x) || (/[a-z]/.test(x) && modelo.test(x)));
}

export function relevancia(consulta, titulo) {
  const q = palabrasConsulta(consulta);
  if (!q.length) return 1;
  const t = tokens(normalizarTexto(sinEscalas(titulo)));
  const sustantivo = sustantivoConsulta(consulta);
  let encontradas = 0;
  for (const palabra of q) {
    // Los números solo cuentan como medida o modelo (nunca dentro de "escala 1:24").
    if (/\d/.test(palabra)) { if (numeroCoincide(palabra, t)) encontradas++; continue; }
    if (t.includes(palabra)) { encontradas++; continue; }
    if (palabra.length >= 3 && t.some((x) => x.startsWith(palabra))) { encontradas += 0.9; continue; }
    if (palabra.length >= 4 && t.some((x) => levenshtein(palabra, x, 1) <= 1)) { encontradas += 0.8; continue; }
    // Dos errores solo se toleran en palabras secundarias: si el sustantivo admitiera
    // dos cambios, "monitor" encontraría "monster" (un carrito de juguete).
    if (palabra !== sustantivo && palabra.length >= 7 && t.some((x) => levenshtein(palabra, x, 2) <= 2)) encontradas += 0.6;
  }
  return encontradas / q.length;
}

/* ------------------------------------------------------------------
 * Categorías que no corresponden: juguetes, higiene, mascotas…
 * Buscar "mouse" no debe traer un cepillo de Mickey Mouse ni "laptop" una de juguete.
 * Se revisa la categoría que da la tienda (VTEX, WooCommerce, iCon la llenan) y, como
 * respaldo, frases del título. Si la consulta pide esa categoría, no se filtra.
 * ------------------------------------------------------------------ */
const AJENAS = [
  {
    nombre: 'juguetes y bebés',
    categoria: /juguet|disfraz|munec|peluche|bebes/,
    titulo: /\bjuguetes?\b|\bpara nin(?:o|a|os|as)\b|hot wheels|\bescala\s+1\s*[:/]|\bdidactic[oa]s?\b/,
    pide: /juguet|nin[oa]s?\b|bebe|hot wheels|escala|didactic|munec|peluche|lego|carrito/,
  },
  {
    // "Minnie Mouse" es un personaje: buscar "mouse" no debe traer ligas ni libretas de Minnie.
    // Esta regla solo aplica si la consulta dice "mouse" (si buscás "cepillo", el de Mickey sí sirve).
    nombre: 'personajes',
    soloSi: /\bmouse\b/,
    titulo: /\b(?:mickey|minnie) mouse\b/,
    pide: /mickey|minnie|disney/,
  },
  {
    nombre: 'higiene y cuidado personal',
    categoria: /higiene|cuidado personal|cuidado (?:bucal|oral)|salud bucal|belleza/,
    titulo: /cepillo (?:de dientes|dental)|pasta dental|enjuague bucal|hilo dental/,
    // En "cuidado personal" las tiendas ponen secadoras, planchas de pelo y afeitadoras:
    // si se busca alguna de esas cosas, la categoría sí corresponde.
    // También cuenta como pedido si nombra una marca de higiene: "Colgate 160 ml" (así llega
    // una pasta desde el código de barras) sí quiere la pasta dental.
    pide: /cepillo|dental|dientes|higiene|belleza|enjuague|shampoo|champu|desodorante|maquillaje|crema|secadora|plancha|alisador|rizador|afeitadora|rasuradora|depiladora|cortadora|cortapelo|recortadora|barba|cabello|pelo|colgate|oral.?b\b|sensodyne|crest|listerine|close.?up|dove|rexona|nivea|gillette|pantene|head.{0,3}shoulders/,
  },
  {
    nombre: 'mascotas',
    categoria: /mascota/,
    titulo: /para (?:perros?|gatos?|mascotas?)\b/,
    pide: /mascota|perro|gato|cachorro/,
  },
];

// oferta: { titulo, categoria? }. Devuelve true si es de una categoría que no se pidió.
export function esCategoriaAjena(oferta, consulta) {
  const q = sinTildes(String(consulta || '').toLowerCase());
  const categoria = sinTildes(String(oferta.categoria || '').toLowerCase());
  const titulo = sinTildes(String(oferta.titulo || '').toLowerCase());
  return AJENAS.some((a) =>
    (!a.soloSi || a.soloSi.test(q)) &&                      // la regla aplica a esta consulta
    !a.pide.test(q) &&                                      // y la persona no pidió esa categoría
    ((categoria && a.categoria?.test(categoria)) || a.titulo.test(titulo)));
}

// "Bandeja de silicona PARA freidora": si lo que buscaste solo aparece después de "para",
// la publicación es algo que se usa con ese producto, no el producto.
export function esParaOtroProducto(titulo, consulta) {
  const t = tokens(normalizarTexto(titulo));
  const i = t.indexOf('para');
  if (i < 0) return false;
  const q = palabrasConsulta(consulta).filter((p) => !/\d/.test(p));
  if (!q.length) return false;
  const antes = new Set(t.slice(0, i));
  const despues = new Set(t.slice(i + 1));
  return q.every((p) => !antes.has(p)) && q.some((p) => despues.has(p));
}

export function consultaPideAccesorio(consulta) {
  return tokens(normalizarTexto(consulta)).some((t) => ACCESORIO.has(t));
}

// Clave de UNA oferta suelta (sirve para guardar su historial por tienda).
export function claveOferta(oferta) {
  return claveProducto(extraerAtributos(oferta.titulo, oferta.marca));
}

/* ------------------------------------------------------------------
 * 6) De ofertas sueltas a la lista de resultados (lo usan servidor y navegador)
 * ------------------------------------------------------------------ */
export function resumirGrupos(ofertas, consulta) {
  const pideAccesorio = consultaPideAccesorio(consulta);
  // Con un código de barras (solo dígitos) no hay palabras que digan qué categoría se pidió:
  // el código ya identifica el producto, así que nada se manda a "secundarios".
  const porCodigo = /^\d{8,14}$/.test(String(consulta || '').trim());
  const grupos = agruparOfertas(ofertas).map((g) => {
    const disponibles = g.ofertas.filter((o) => o.disponible);
    const precios = (disponibles.length ? disponibles : g.ofertas).map((o) => o.precio);
    return {
      ...g,
      min: Math.min(...precios),
      max: Math.max(...precios),
      tiendas: [...new Set(g.ofertas.map((o) => o.tienda))],
      disponible: disponibles.length > 0,
      relevancia: Math.max(...g.ofertas.map((o) => o.relevancia ?? 1)),
      // Secundario = accesorio, algo "para" el producto, o de una categoría que no se pidió
      // (juguete, higiene…). No se borra: se muestra abajo, en la sección aparte.
      secundario: !porCodigo && ((!pideAccesorio &&(g.atributos.accesorio || g.ofertas.every((o) => esParaOtroProducto(o.titulo, consulta)))) ||
        g.ofertas.every((o) => esCategoriaAjena(o, consulta))),
      coincidenciaExacta: g.ofertas.some((o) => o.coincidenciaExacta),
    };
  });
  // Lo más relevante primero, luego lo que está en más tiendas, luego lo más barato.
  grupos.sort((a, b) =>
    (a.secundario - b.secundario) ||
    (b.disponible - a.disponible) ||
    (Math.round(b.relevancia * 10) - Math.round(a.relevancia * 10)) ||
    (b.tiendas.length - a.tiendas.length) ||
    (a.min - b.min));
  return grupos;
}
