// Estructuras de datos de Vale.
// Todo está escrito a mano (sin librerías) para que se pueda explicar línea por línea.
// Este mismo archivo lo usan el navegador y las funciones de Netlify.

/* ------------------------------------------------------------------
 * 1. Trie (árbol de prefijos) — autocompletado del buscador
 *    insertar: O(L)   buscar prefijo: O(L + k)   (L = largo de la palabra)
 * ------------------------------------------------------------------ */
class NodoTrie {
  constructor() {
    this.hijos = new Map(); // letra -> NodoTrie
    this.fin = false;       // ¿termina una palabra aquí?
    this.peso = 0;          // cuántas veces se ha buscado (para ordenar sugerencias)
    this.texto = null;      // la frase original, con tildes y mayúsculas
  }
}

export class Trie {
  constructor() {
    this.raiz = new NodoTrie();
    this.total = 0;
  }

  insertar(frase, peso = 1) {
    const clave = sinTildes(frase.toLowerCase().trim());
    if (!clave) return;
    let nodo = this.raiz;
    for (const letra of clave) {
      if (!nodo.hijos.has(letra)) nodo.hijos.set(letra, new NodoTrie());
      nodo = nodo.hijos.get(letra);
    }
    if (!nodo.fin) this.total++;
    nodo.fin = true;
    nodo.peso += peso;
    nodo.texto = nodo.texto || frase.trim();
  }

  // Devuelve hasta `limite` frases que empiezan con `prefijo`, las más buscadas primero.
  sugerir(prefijo, limite = 6) {
    const clave = sinTildes(prefijo.toLowerCase().trim());
    let nodo = this.raiz;
    for (const letra of clave) {
      nodo = nodo.hijos.get(letra);
      if (!nodo) return [];
    }
    // Recorrido en profundidad (DFS) usando una pila explícita.
    const encontrados = [];
    const pila = [nodo];
    while (pila.length) {
      const actual = pila.pop();
      if (actual.fin) encontrados.push(actual);
      for (const hijo of actual.hijos.values()) pila.push(hijo);
    }
    // Un montículo nos da los `limite` de mayor peso sin ordenar toda la lista.
    return topK(encontrados, limite, (a, b) => b.peso - a.peso).map((n) => n.texto);
  }

  // Todas las frases (sirve para buscar "¿quisiste decir…?")
  todas() {
    const out = [];
    const pila = [this.raiz];
    while (pila.length) {
      const n = pila.pop();
      if (n.fin) out.push(n.texto);
      for (const h of n.hijos.values()) pila.push(h);
    }
    return out;
  }
}

/* ------------------------------------------------------------------
 * 2. Montículo binario (min-heap) — "los k más baratos" sin ordenar todo
 *    insertar / extraer: O(log n)
 * ------------------------------------------------------------------ */
export class Monticulo {
  // `comparar(a, b)` < 0 significa que `a` debe salir antes que `b`.
  constructor(comparar = (a, b) => a - b) {
    this.datos = [];
    this.comparar = comparar;
  }

  get tamano() { return this.datos.length; }
  ver() { return this.datos[0]; }

  insertar(valor) {
    const d = this.datos;
    d.push(valor);
    let i = d.length - 1;
    // Subir el elemento mientras sea "menor" que su padre.
    while (i > 0) {
      const padre = (i - 1) >> 1;
      if (this.comparar(d[i], d[padre]) >= 0) break;
      [d[i], d[padre]] = [d[padre], d[i]];
      i = padre;
    }
  }

  extraer() {
    const d = this.datos;
    if (!d.length) return undefined;
    const tope = d[0];
    const ultimo = d.pop();
    if (d.length) {
      d[0] = ultimo;
      // Bajar el elemento hasta que sus dos hijos sean "mayores".
      let i = 0;
      for (;;) {
        const izq = 2 * i + 1;
        const der = izq + 1;
        let menor = i;
        if (izq < d.length && this.comparar(d[izq], d[menor]) < 0) menor = izq;
        if (der < d.length && this.comparar(d[der], d[menor]) < 0) menor = der;
        if (menor === i) break;
        [d[i], d[menor]] = [d[menor], d[i]];
        i = menor;
      }
    }
    return tope;
  }
}

// Los k primeros según `comparar`, en orden. O(n log k)
export function topK(lista, k, comparar) {
  if (k <= 0) return [];
  // Montículo "al revés" de tamaño k: en la cima queda el peor de los k mejores.
  const h = new Monticulo((a, b) => comparar(b, a));
  for (const x of lista) {
    if (h.tamano < k) h.insertar(x);
    else if (comparar(x, h.ver()) < 0) { h.extraer(); h.insertar(x); }
  }
  const out = [];
  while (h.tamano) out.push(h.extraer());
  return out.reverse();
}

/* ------------------------------------------------------------------
 * 3. Caché LRU (lista doblemente enlazada + Map) — "Vistos recientemente"
 *    obtener / guardar: O(1)
 * ------------------------------------------------------------------ */
export class CacheLRU {
  constructor(capacidad = 8) {
    this.capacidad = capacidad;
    this.mapa = new Map(); // clave -> nodo
    // Nodos centinela para no revisar casos vacíos.
    this.cabeza = { prev: null, next: null };
    this.cola = { prev: this.cabeza, next: null };
    this.cabeza.next = this.cola;
  }

  get tamano() { return this.mapa.size; }

  _quitar(nodo) {
    nodo.prev.next = nodo.next;
    nodo.next.prev = nodo.prev;
  }

  _alFrente(nodo) {
    nodo.next = this.cabeza.next;
    nodo.prev = this.cabeza;
    this.cabeza.next.prev = nodo;
    this.cabeza.next = nodo;
  }

  obtener(clave) {
    const nodo = this.mapa.get(clave);
    if (!nodo) return undefined;
    this._quitar(nodo);
    this._alFrente(nodo); // usado recién: pasa al frente
    return nodo.valor;
  }

  guardar(clave, valor) {
    let nodo = this.mapa.get(clave);
    if (nodo) {
      nodo.valor = valor;
      this._quitar(nodo);
    } else {
      nodo = { clave, valor, prev: null, next: null };
      this.mapa.set(clave, nodo);
      if (this.mapa.size > this.capacidad) {
        const viejo = this.cola.prev; // el menos usado está al final
        this._quitar(viejo);
        this.mapa.delete(viejo.clave);
      }
    }
    this._alFrente(nodo);
  }

  // Del más reciente al más viejo
  lista() {
    const out = [];
    for (let n = this.cabeza.next; n !== this.cola; n = n.next) out.push({ clave: n.clave, valor: n.valor });
    return out;
  }

  static desde(arreglo, capacidad) {
    const c = new CacheLRU(capacidad);
    // Se insertan del más viejo al más nuevo para conservar el orden.
    for (let i = arreglo.length - 1; i >= 0; i--) c.guardar(arreglo[i].clave, arreglo[i].valor);
    return c;
  }
}

/* ------------------------------------------------------------------
 * 4. Distancia de Levenshtein (programación dinámica)
 *    O(n·m) tiempo, O(m) memoria porque solo guardamos dos filas.
 * ------------------------------------------------------------------ */
export function levenshtein(a, b, tope = Infinity) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  let actual = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    actual[0] = i;
    let minFila = actual[0];
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(
        anterior[j] + 1,        // borrar
        actual[j - 1] + 1,      // insertar
        anterior[j - 1] + costo // cambiar
      );
      if (actual[j] < minFila) minFila = actual[j];
    }
    if (minFila > tope) return tope + 1; // ya no puede mejorar: cortamos
    [anterior, actual] = [actual, anterior];
  }
  return anterior[b.length];
}

/* ------------------------------------------------------------------
 * 5. Conjuntos disjuntos (Union-Find) — unir ofertas del mismo producto
 *    casi O(1) por operación con compresión de caminos y unión por rango
 * ------------------------------------------------------------------ */
export class ConjuntosDisjuntos {
  constructor(n) {
    this.padre = Array.from({ length: n }, (_, i) => i);
    this.rango = new Array(n).fill(0);
  }

  buscar(x) {
    while (this.padre[x] !== x) {
      this.padre[x] = this.padre[this.padre[x]]; // compresión de caminos
      x = this.padre[x];
    }
    return x;
  }

  unir(a, b) {
    let ra = this.buscar(a);
    let rb = this.buscar(b);
    if (ra === rb) return false;
    if (this.rango[ra] < this.rango[rb]) [ra, rb] = [rb, ra];
    this.padre[rb] = ra;
    if (this.rango[ra] === this.rango[rb]) this.rango[ra]++;
    return true;
  }
}

/* ------------------------------------------------------------------
 * 6. Búsqueda binaria — límites de un rango en un arreglo ordenado
 *    O(log n)
 * ------------------------------------------------------------------ */
// Primer índice i tal que arr[i] >= valor
export function limiteInferior(arr, valor, clave = (x) => x) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (clave(arr[mid]) < valor) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Primer índice i tal que arr[i] > valor
export function limiteSuperior(arr, valor, clave = (x) => x) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (clave(arr[mid]) <= valor) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Cuántos elementos caen en [min, max] — el arreglo debe venir ordenado por `clave`
export function contarEnRango(arr, min, max, clave = (x) => x) {
  return Math.max(0, limiteSuperior(arr, max, clave) - limiteInferior(arr, min, clave));
}

/* ------------------------------------------------------------------
 * 7. Mediana (para el "ahorro honesto" de 30 días)
 * ------------------------------------------------------------------ */
export function mediana(valores) {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/* ------------------------------------------------------------------
 * Utilidades de texto compartidas
 * ------------------------------------------------------------------ */
export function sinTildes(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}
