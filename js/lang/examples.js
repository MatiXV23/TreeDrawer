/*
 * Código de práctica. La estructura de clases replica la de la materia
 * (ArbolBinario → ArbolBinarioBusqueda → ArbolAVL, con Nodo incluido) en JavaScript.
 */

const CLASS_HEADER = `// Estructura de la materia en JavaScript.
// La clase Nodo ya viene incluida y está conectada al dibujo:
//   new Nodo(dato)  →  { dato, izq: null, der: null, altura: 1 }
// «arbol» es una instancia de la clase elegida abajo, con arbol.raiz = el árbol dibujado.
// Probá, por ejemplo: arbol.altura()   arbol.insertar(35)   arbol.eliminar(20)
`;

const CLASS_SKELETON = `${CLASS_HEADER}
// AB: árbol binario genérico, sin orden entre los nodos
class ArbolBinario {
  constructor(raiz = null) {
    this.raiz = raiz;
  }

  getRaiz() {
    return this.raiz;
  }

  estaVacio() {
    return this.raiz === null;
  }

  vaciar() {
    this.raiz = null;
  }

  // inserción por nivel (primer lugar libre recorriendo por niveles)
  insertar(dato) {
    throw new Error("No implementado");
  }

  contiene(dato) {
    throw new Error("No implementado");
  }

  altura() {
    throw new Error("No implementado");
  }

  cantidadNodos() {
    throw new Error("No implementado");
  }

  cantidadHojas() {
    throw new Error("No implementado");
  }

  // los recorridos devuelven un array con los datos
  preorden() {
    throw new Error("No implementado");
  }

  inorden() {
    throw new Error("No implementado");
  }

  posorden() {
    throw new Error("No implementado");
  }

  porNiveles() {
    throw new Error("No implementado");
  }
}

// ABB: árbol binario con la propiedad de orden (izq < raíz < der)
class ArbolBinarioBusqueda extends ArbolBinario {
  constructor() {
    super();
  }

  // en un ABB la inserción respeta el orden, no es por nivel
  insertar(dato) {
    throw new Error("No implementado");
  }

  contiene(dato) {
    throw new Error("No implementado");
  }

  // devuelve el Nodo que tiene el dato, o null
  buscar(dato) {
    throw new Error("No implementado");
  }

  eliminar(dato) {
    throw new Error("No implementado");
  }

  minimo() {
    throw new Error("No implementado");
  }

  maximo() {
    throw new Error("No implementado");
  }

  predecesor(dato) {
    throw new Error("No implementado");
  }

  sucesor(dato) {
    throw new Error("No implementado");
  }
}

// AVL: ABB auto-balanceado, |factor de balance| <= 1 en todo nodo
class ArbolAVL extends ArbolBinarioBusqueda {
  constructor() {
    super();
  }

  // insertar y eliminar se redefinen porque deben rebalancear
  insertar(dato) {
    throw new Error("No implementado");
  }

  eliminar(dato) {
    throw new Error("No implementado");
  }

  factorBalance(nodo) {
    throw new Error("No implementado");
  }

  estaBalanceado() {
    throw new Error("No implementado");
  }

  rotacionDerecha(nodo) {
    throw new Error("No implementado");
  }

  rotacionIzquierda(nodo) {
    throw new Error("No implementado");
  }

  rotacionDobleIzquierdaDerecha(nodo) {
    throw new Error("No implementado");
  }

  rotacionDobleDerechaIzquierda(nodo) {
    throw new Error("No implementado");
  }
}
`;

const CLASS_SOLUTION = `${CLASS_HEADER}
// AB: árbol binario genérico, sin orden entre los nodos
class ArbolBinario {
  constructor(raiz = null) {
    this.raiz = raiz;
  }

  getRaiz() {
    return this.raiz;
  }

  estaVacio() {
    return this.raiz === null;
  }

  vaciar() {
    this.raiz = null;
  }

  // inserción por nivel (primer lugar libre recorriendo por niveles)
  insertar(dato) {
    const nuevo = new Nodo(dato);
    if (this.estaVacio()) {
      this.raiz = nuevo;
      return;
    }
    const cola = [this.raiz];
    while (cola.length > 0) {
      const actual = cola.shift();
      if (actual.izq === null) {
        actual.izq = nuevo;
        return;
      }
      if (actual.der === null) {
        actual.der = nuevo;
        return;
      }
      cola.push(actual.izq, actual.der);
    }
  }

  contiene(dato) {
    return this.contieneRec(this.raiz, dato);
  }

  contieneRec(nodo, dato) {
    if (nodo === null) return false;
    if (nodo.dato === dato) return true;
    return this.contieneRec(nodo.izq, dato) || this.contieneRec(nodo.der, dato);
  }

  // misma convención que Nodo.altura: una hoja mide 1 y el árbol vacío, 0
  altura() {
    return this.alturaRec(this.raiz);
  }

  alturaRec(nodo) {
    if (nodo === null) return 0;
    return 1 + Math.max(this.alturaRec(nodo.izq), this.alturaRec(nodo.der));
  }

  cantidadNodos() {
    return this.contarRec(this.raiz);
  }

  contarRec(nodo) {
    if (nodo === null) return 0;
    return 1 + this.contarRec(nodo.izq) + this.contarRec(nodo.der);
  }

  cantidadHojas() {
    return this.hojasRec(this.raiz);
  }

  hojasRec(nodo) {
    if (nodo === null) return 0;
    if (nodo.esHoja()) return 1;
    return this.hojasRec(nodo.izq) + this.hojasRec(nodo.der);
  }

  preorden() {
    const res = [];
    this.preordenRec(this.raiz, res);
    return res;
  }

  preordenRec(nodo, res) {
    if (nodo === null) return;
    res.push(nodo.dato);
    this.preordenRec(nodo.izq, res);
    this.preordenRec(nodo.der, res);
  }

  inorden() {
    const res = [];
    this.inordenRec(this.raiz, res);
    return res;
  }

  inordenRec(nodo, res) {
    if (nodo === null) return;
    this.inordenRec(nodo.izq, res);
    res.push(nodo.dato);
    this.inordenRec(nodo.der, res);
  }

  posorden() {
    const res = [];
    this.posordenRec(this.raiz, res);
    return res;
  }

  posordenRec(nodo, res) {
    if (nodo === null) return;
    this.posordenRec(nodo.izq, res);
    this.posordenRec(nodo.der, res);
    res.push(nodo.dato);
  }

  porNiveles() {
    const res = [];
    if (this.estaVacio()) return res;
    const cola = [this.raiz];
    while (cola.length > 0) {
      const actual = cola.shift();
      res.push(actual.dato);
      if (actual.izq !== null) cola.push(actual.izq);
      if (actual.der !== null) cola.push(actual.der);
    }
    return res;
  }
}

// ABB: árbol binario con la propiedad de orden (izq < raíz < der)
class ArbolBinarioBusqueda extends ArbolBinario {
  constructor() {
    super();
  }

  // en un ABB la inserción respeta el orden, no es por nivel
  insertar(dato) {
    this.raiz = this.insertarRec(this.raiz, dato);
  }

  insertarRec(nodo, dato) {
    if (nodo === null) return new Nodo(dato);
    if (dato < nodo.dato) {
      nodo.izq = this.insertarRec(nodo.izq, dato);
    } else if (dato > nodo.dato) {
      nodo.der = this.insertarRec(nodo.der, dato);
    }
    return nodo;
  }

  contiene(dato) {
    return this.buscar(dato) !== null;
  }

  // devuelve el Nodo que tiene el dato, o null
  buscar(dato) {
    let actual = this.raiz;
    while (actual !== null && actual.dato !== dato) {
      actual = dato < actual.dato ? actual.izq : actual.der;
    }
    return actual;
  }

  eliminar(dato) {
    this.raiz = this.eliminarRec(this.raiz, dato);
  }

  eliminarRec(nodo, dato) {
    if (nodo === null) return null;
    if (dato < nodo.dato) {
      nodo.izq = this.eliminarRec(nodo.izq, dato);
    } else if (dato > nodo.dato) {
      nodo.der = this.eliminarRec(nodo.der, dato);
    } else {
      // sin hijos o con uno solo: lo reemplaza el otro
      if (nodo.izq === null) return nodo.der;
      if (nodo.der === null) return nodo.izq;
      // dos hijos: copio el sucesor (mínimo del subárbol derecho) y lo borro
      const sucesor = this.minimoNodo(nodo.der);
      nodo.dato = sucesor.dato;
      nodo.der = this.eliminarRec(nodo.der, sucesor.dato);
    }
    return nodo;
  }

  minimo() {
    if (this.estaVacio()) return null;
    return this.minimoNodo(this.raiz).dato;
  }

  maximo() {
    if (this.estaVacio()) return null;
    return this.maximoNodo(this.raiz).dato;
  }

  minimoNodo(nodo) {
    while (nodo.izq !== null) nodo = nodo.izq;
    return nodo;
  }

  maximoNodo(nodo) {
    while (nodo.der !== null) nodo = nodo.der;
    return nodo;
  }

  // el mayor dato que es menor que el pedido (o null)
  predecesor(dato) {
    let actual = this.raiz;
    let candidato = null;
    while (actual !== null) {
      if (dato > actual.dato) {
        candidato = actual.dato;
        actual = actual.der;
      } else {
        actual = actual.izq;
      }
    }
    return candidato;
  }

  // el menor dato que es mayor que el pedido (o null)
  sucesor(dato) {
    let actual = this.raiz;
    let candidato = null;
    while (actual !== null) {
      if (dato < actual.dato) {
        candidato = actual.dato;
        actual = actual.izq;
      } else {
        actual = actual.der;
      }
    }
    return candidato;
  }
}

// AVL: ABB auto-balanceado, |factor de balance| <= 1 en todo nodo
class ArbolAVL extends ArbolBinarioBusqueda {
  constructor() {
    super();
  }

  // insertar y eliminar se redefinen porque deben rebalancear
  insertar(dato) {
    this.raiz = this.insertarAVL(this.raiz, dato);
  }

  insertarAVL(nodo, dato) {
    if (nodo === null) return new Nodo(dato);
    if (dato < nodo.dato) {
      nodo.izq = this.insertarAVL(nodo.izq, dato);
    } else if (dato > nodo.dato) {
      nodo.der = this.insertarAVL(nodo.der, dato);
    } else {
      return nodo; // repetido: no se inserta
    }
    return this.balancear(nodo);
  }

  eliminar(dato) {
    this.raiz = this.eliminarAVL(this.raiz, dato);
  }

  eliminarAVL(nodo, dato) {
    if (nodo === null) return null;
    if (dato < nodo.dato) {
      nodo.izq = this.eliminarAVL(nodo.izq, dato);
    } else if (dato > nodo.dato) {
      nodo.der = this.eliminarAVL(nodo.der, dato);
    } else {
      if (nodo.izq === null) return nodo.der;
      if (nodo.der === null) return nodo.izq;
      const sucesor = this.minimoNodo(nodo.der);
      nodo.dato = sucesor.dato;
      nodo.der = this.eliminarAVL(nodo.der, sucesor.dato);
    }
    return this.balancear(nodo);
  }

  // recalcula la altura del nodo y aplica la rotación que corresponda
  balancear(nodo) {
    this.actualizarAltura(nodo);
    const fb = this.factorBalance(nodo);
    if (fb > 1) {
      if (this.factorBalance(nodo.izq) < 0) return this.rotacionDobleIzquierdaDerecha(nodo);
      return this.rotacionDerecha(nodo);
    }
    if (fb < -1) {
      if (this.factorBalance(nodo.der) > 0) return this.rotacionDobleDerechaIzquierda(nodo);
      return this.rotacionIzquierda(nodo);
    }
    return nodo;
  }

  alturaDe(nodo) {
    return nodo === null ? 0 : nodo.altura;
  }

  actualizarAltura(nodo) {
    nodo.altura = 1 + Math.max(this.alturaDe(nodo.izq), this.alturaDe(nodo.der));
  }

  factorBalance(nodo) {
    if (nodo === null) return 0;
    return this.alturaDe(nodo.izq) - this.alturaDe(nodo.der);
  }

  estaBalanceado() {
    return this.balanceadoRec(this.raiz);
  }

  balanceadoRec(nodo) {
    if (nodo === null) return true;
    const fb = this.alturaRec(nodo.izq) - this.alturaRec(nodo.der);
    return Math.abs(fb) <= 1 && this.balanceadoRec(nodo.izq) && this.balanceadoRec(nodo.der);
  }

  rotacionDerecha(nodo) {
    const nuevaRaiz = nodo.izq;
    nodo.izq = nuevaRaiz.der;
    nuevaRaiz.der = nodo;
    this.actualizarAltura(nodo);
    this.actualizarAltura(nuevaRaiz);
    return nuevaRaiz;
  }

  rotacionIzquierda(nodo) {
    const nuevaRaiz = nodo.der;
    nodo.der = nuevaRaiz.izq;
    nuevaRaiz.izq = nodo;
    this.actualizarAltura(nodo);
    this.actualizarAltura(nuevaRaiz);
    return nuevaRaiz;
  }

  rotacionDobleIzquierdaDerecha(nodo) {
    nodo.izq = this.rotacionIzquierda(nodo.izq);
    return this.rotacionDerecha(nodo);
  }

  rotacionDobleDerechaIzquierda(nodo) {
    nodo.der = this.rotacionDerecha(nodo.der);
    return this.rotacionIzquierda(nodo);
  }
}
`;

/**
 * Estructura que se muestra en el modal: qué clases y métodos hay que implementar.
 * `override`: el método tiene que redefinirse en esa clase (no alcanza con heredarlo).
 */
const TREE_STRUCTURE = [
  {
    name: 'Nodo',
    builtin: true,
    desc: 'Incluida. Cada nodo del dibujo es un Nodo; los que crees con new Nodo(...) aparecen en el lienzo.',
    fields: [
      ['dato', 'el valor guardado'],
      ['izq, der', 'hijos izquierdo y derecho (Nodo o null)'],
      ['altura', 'arranca en 1; la usa el AVL'],
    ],
    methods: [
      ['constructor(dato, izq = null, der = null)', 'new Nodo(5) o new Nodo(5, izq, der)'],
      ['getDato() / setDato(dato)', ''],
      ['getIzq() / setIzq(nodo)', ''],
      ['getDer() / setDer(nodo)', ''],
      ['getAltura() / setAltura(n)', ''],
      ['esHoja()', 'true si no tiene hijos'],
    ],
  },
  {
    name: 'ArbolBinario',
    tag: 'AB',
    desc: 'Árbol binario genérico, sin orden entre los nodos.',
    fields: [['raiz', 'Nodo o null']],
    methods: [
      { name: 'getRaiz', sig: 'getRaiz()', ret: 'Nodo | null' },
      { name: 'estaVacio', sig: 'estaVacio()', ret: 'boolean' },
      { name: 'vaciar', sig: 'vaciar()', ret: 'void' },
      { name: 'insertar', sig: 'insertar(dato)', ret: 'void', desc: 'por nivel: primer lugar libre recorriendo por niveles' },
      { name: 'contiene', sig: 'contiene(dato)', ret: 'boolean' },
      { name: 'altura', sig: 'altura()', ret: 'number', desc: 'hoja = 1, árbol vacío = 0' },
      { name: 'cantidadNodos', sig: 'cantidadNodos()', ret: 'number' },
      { name: 'cantidadHojas', sig: 'cantidadHojas()', ret: 'number' },
      { name: 'preorden', sig: 'preorden()', ret: 'dato[]' },
      { name: 'inorden', sig: 'inorden()', ret: 'dato[]' },
      { name: 'posorden', sig: 'posorden()', ret: 'dato[]' },
      { name: 'porNiveles', sig: 'porNiveles()', ret: 'dato[]' },
    ],
  },
  {
    name: 'ArbolBinarioBusqueda',
    tag: 'ABB',
    parent: 'ArbolBinario',
    desc: 'Árbol binario con la propiedad de orden (izq < raíz < der).',
    methods: [
      { name: 'insertar', sig: 'insertar(dato)', ret: 'void', desc: 'respeta el orden, no es por nivel', override: true },
      { name: 'contiene', sig: 'contiene(dato)', ret: 'boolean', desc: 'puede aprovechar el orden' },
      { name: 'buscar', sig: 'buscar(dato)', ret: 'Nodo | null' },
      { name: 'eliminar', sig: 'eliminar(dato)', ret: 'void' },
      { name: 'minimo', sig: 'minimo()', ret: 'dato' },
      { name: 'maximo', sig: 'maximo()', ret: 'dato' },
      { name: 'predecesor', sig: 'predecesor(dato)', ret: 'dato | null', desc: 'el mayor dato menor que el pedido' },
      { name: 'sucesor', sig: 'sucesor(dato)', ret: 'dato | null', desc: 'el menor dato mayor que el pedido' },
    ],
  },
  {
    name: 'ArbolAVL',
    tag: 'AVL',
    parent: 'ArbolBinarioBusqueda',
    desc: 'ABB auto-balanceado: |factor de balance| ≤ 1 en todo nodo.',
    methods: [
      { name: 'insertar', sig: 'insertar(dato)', ret: 'void', desc: 'inserta y rebalancea', override: true },
      { name: 'eliminar', sig: 'eliminar(dato)', ret: 'void', desc: 'elimina y rebalancea', override: true },
      { name: 'factorBalance', sig: 'factorBalance(nodo)', ret: 'number', desc: 'altura(izq) − altura(der)' },
      { name: 'estaBalanceado', sig: 'estaBalanceado()', ret: 'boolean' },
      { name: 'rotacionDerecha', sig: 'rotacionDerecha(nodo)', ret: 'Nodo', desc: 'devuelve la nueva raíz del subárbol' },
      { name: 'rotacionIzquierda', sig: 'rotacionIzquierda(nodo)', ret: 'Nodo' },
      { name: 'rotacionDobleIzquierdaDerecha', sig: 'rotacionDobleIzquierdaDerecha(nodo)', ret: 'Nodo' },
      { name: 'rotacionDobleDerechaIzquierda', sig: 'rotacionDobleDerechaIzquierda(nodo)', ret: 'Nodo' },
    ],
  },
];

/** Línea de ejecución sugerida para un método de la estructura. */
function structureCall(m) {
  const params = /\(([^)]*)\)/.exec(m.sig)[1].split(',').map(x => x.trim()).filter(Boolean);
  const args = params.map(p => (p === 'nodo' ? 'arbol.raiz' : '?'));
  const call = `arbol.${m.name}(${args.join(', ')})`;
  return m.name.startsWith('rotacion') ? `arbol.raiz = ${call}` : call;
}

/* ---------- funciones sueltas (sin clases) ---------- */

const CODE_FUNCTIONS = {
  altura: `// Altura: una hoja mide 1 y el árbol vacío, 0 (como Nodo.altura)
function altura(nodo) {
  if (nodo === null) return 0;
  const izq = altura(nodo.izq);
  const der = altura(nodo.der);
  return 1 + Math.max(izq, der);
}`,

  contarNodos: `function contarNodos(nodo) {
  if (nodo === null) return 0;
  return 1 + contarNodos(nodo.izq) + contarNodos(nodo.der);
}`,

  contarHojas: `function contarHojas(nodo) {
  if (nodo === null) return 0;
  if (nodo.esHoja()) return 1;
  return contarHojas(nodo.izq) + contarHojas(nodo.der);
}`,

  sumar: `function sumar(nodo) {
  if (nodo === null) return 0;
  return nodo.dato + sumar(nodo.izq) + sumar(nodo.der);
}`,

  minimo: `// En un ABB el mínimo está en el nodo de más a la izquierda
function minimo(nodo) {
  let actual = nodo;
  while (actual.izq !== null) {
    actual = actual.izq;
  }
  return actual.dato;
}`,

  maximo: `// En un ABB el máximo está en el nodo de más a la derecha
function maximo(nodo) {
  if (nodo.der === null) return nodo.dato;
  return maximo(nodo.der);
}`,

  buscar: `// Búsqueda en un ABB: devuelve el nodo o null
function buscar(nodo, x) {
  if (nodo === null || nodo.dato === x) return nodo;
  if (x < nodo.dato) return buscar(nodo.izq, x);
  return buscar(nodo.der, x);
}`,

  esABB: `// Cada nodo tiene que estar entre los límites que le imponen sus ancestros
function esABB(nodo, min = -Infinity, max = Infinity) {
  if (nodo === null) return true;
  if (nodo.dato <= min || nodo.dato >= max) return false;
  return esABB(nodo.izq, min, nodo.dato) && esABB(nodo.der, nodo.dato, max);
}`,

  esAVL: `function esAVL(nodo) {
  return esABB(nodo) && balanceado(nodo);
}

function balanceado(nodo) {
  if (nodo === null) return true;
  const fb = altura(nodo.izq) - altura(nodo.der);
  if (Math.abs(fb) > 1) return false;
  return balanceado(nodo.izq) && balanceado(nodo.der);
}`,

  espejo: `// Intercambia izquierda y derecha en todo el árbol
function espejo(nodo) {
  if (nodo === null) return;
  const aux = nodo.izq;
  nodo.izq = nodo.der;
  nodo.der = aux;
  espejo(nodo.izq);
  espejo(nodo.der);
}`,

  nivel: `// Nivel (profundidad) en el que está x, o -1 si no está
function nivel(nodo, x, prof = 0) {
  if (nodo === null) return -1;
  if (nodo.dato === x) return prof;
  const izq = nivel(nodo.izq, x, prof + 1);
  if (izq !== -1) return izq;
  return nivel(nodo.der, x, prof + 1);
}`,

  ag: `// Árbol general: se recorren todos los hijos (sirve también para binarios)
function alturaAG(nodo) {
  let max = 0;
  for (const hijo of nodo.hijos) {
    max = Math.max(max, alturaAG(hijo));
  }
  return max + 1;
}

function contarAG(nodo) {
  let total = 1;
  for (const hijo of nodo.hijos) {
    total += contarAG(hijo);
  }
  return total;
}

// Grado del árbol: la mayor cantidad de hijos de un nodo
function grado(nodo) {
  let g = nodo.hijos.length;
  for (const hijo of nodo.hijos) {
    g = Math.max(g, grado(hijo));
  }
  return g;
}`,
};

/** Esqueleto de un conjunto de funciones: conserva comentarios y firmas, vacía los cuerpos. */
function makeStub(code) {
  const lines = code.split('\n');
  const decls = JSParser.parseProgram(code).body.filter(d => d.t === 'funcdecl');
  for (const d of decls.reverse()) {
    const indent = /^\s*/.exec(lines[d.line - 1])[0] + '  ';
    lines.splice(d.line, d.body.endLine - d.line - 1, `${indent}// Tu código acá`, `${indent}throw new Error("No implementado");`);
  }
  return lines.join('\n');
}

const FN_TASK = `// Completá las funciones. «raiz» es la raíz del árbol dibujado (o null).
// Cada nodo tiene nodo.dato, nodo.izq, nodo.der y nodo.altura (hijos para árboles generales).
`;

/** Ejercicios del selector. `starter` va al editor; `solution` solo se ve con «Ver ejemplo correcto». */
const EXERCISES = [
  { id: 'clases', group: 'Estructura de clases', name: 'Clases AB → ABB → AVL', kind: 'classes', starter: CLASS_SKELETON, solution: CLASS_SOLUTION, call: 'arbol.altura()' },
  ...[
    ['altura', 'Altura', ['altura'], 'altura(raiz)'],
    ['contar', 'Contar nodos y hojas', ['contarNodos', 'contarHojas'], 'contarHojas(raiz)'],
    ['sumar', 'Sumar datos', ['sumar'], 'sumar(raiz)'],
    ['minmax', 'Mínimo y máximo (ABB)', ['minimo', 'maximo'], 'minimo(raiz)'],
    ['buscar', 'Buscar (ABB)', ['buscar'], 'buscar(raiz, 30)'],
    ['esABB', 'esABB', ['esABB'], 'esABB(raiz)'],
    ['esAVL', 'esAVL', ['esAVL', 'esABB', 'altura'], 'esAVL(raiz)'],
    ['espejo', 'Espejo', ['espejo'], 'espejo(raiz)'],
    ['nivel', 'Nivel de un valor', ['nivel'], 'nivel(raiz, 30)'],
    ['ag', 'Árbol general: altura, cantidad y grado', ['ag'], 'alturaAG(raiz)'],
  ].map(([id, name, fns, call]) => {
    const solution = FN_TASK + '\n' + fns.map(k => CODE_FUNCTIONS[k]).join('\n\n') + '\n';
    return { id, group: 'Funciones sueltas', name, kind: 'functions', solution, get starter() { return makeStub(solution); }, call };
  }),
  {
    id: 'blanco', group: 'Libre', name: 'Hoja en blanco', kind: 'free', solution: null, call: 'miFuncion(raiz)',
    starter: `// Escribí tus propias clases o funciones.
// «raiz» es la raíz del árbol dibujado y «arbol» la instancia de la clase elegida (si definís alguna).

function miFuncion(nodo) {
  // Tu código acá
  throw new Error("No implementado");
}
`,
  },
];

/* ---------- ejemplos correctos por método / función ---------- */

const Reference = (() => {
  const cache = new Map();

  /** El texto del método empieza en su nombre (sin sangría): se le quita la misma sangría al resto. */
  function dedent(text, indent) {
    const re = new RegExp(`^ {0,${indent}}`);
    return text.split('\n').map((l, i) => (i === 0 ? l : l.replace(re, ''))).join('\n');
  }

  /** Métodos de la solución de clases: clase → nombre → código. */
  function classMethods() {
    if (cache.has('classes')) return cache.get('classes');
    const out = new Map();
    for (const c of JSParser.parseProgram(CLASS_SOLUTION).body.filter(d => d.t === 'classdecl')) {
      const methods = new Map();
      for (const m of c.methods) methods.set(m.name, dedent(m.fn.txt, 2));
      out.set(c.name, { parent: c.parent, methods });
    }
    cache.set('classes', out);
    return out;
  }

  /** Código del método (y los auxiliares privados que usa) en la solución de referencia. */
  function forMethod(className, name) {
    const classes = classMethods();
    const pub = new Set(TREE_STRUCTURE.flatMap(c => (c.builtin ? [] : c.methods.map(m => m.name))));
    const find = (cls, n) => {
      for (let c = cls; c; c = classes.get(c)?.parent) {
        const code = classes.get(c)?.methods.get(n);
        if (code) return code;
      }
      return null;
    };
    const main = classes.get(className)?.methods.get(name);
    if (!main) return null;
    const parts = [main];
    const seen = new Set([name]);
    for (let i = 0; i < parts.length; i++) {
      for (const [, helper] of parts[i].matchAll(/this\.(\w+)\(/g)) {
        if (seen.has(helper) || pub.has(helper)) continue;
        seen.add(helper);
        const code = find(className, helper);
        if (code) parts.push(code);
      }
    }
    return parts.join('\n\n');
  }

  /** Funciones de una solución de funciones sueltas: nombre → código. */
  function functions(solution) {
    const lines = solution.split('\n');
    return new Map(JSParser.parseProgram(solution).body.filter(d => d.t === 'funcdecl')
      .map(d => [d.name, lines.slice(d.line - 1, d.body.endLine).join('\n')]));
  }

  return { forMethod, functions };
})();
