/*
 * Código de práctica en JavaScript y en Java.
 * La estructura de clases replica la de la materia (ArbolBinario → ArbolBinarioBusqueda → ArbolAVL,
 * con Nodo incluido). Cada ejercicio trae un esqueleto para completar y una solución de referencia
 * que solo se muestra (y se puede ejecutar) con «Ver ejemplo correcto».
 */

const LANGS = {
  js: { name: 'JavaScript', stub: 'throw new Error("No implementado");', parser: () => JSParser },
  java: { name: 'Java', stub: 'throw new UnsupportedOperationException("No implementado");', parser: () => JavaParser },
};

const CLASS_ORDER = ['ArbolBinario', 'ArbolBinarioBusqueda', 'ArbolAVL'];

const CLASS_CODE = {
  js: {
    skeleton: {
      ArbolBinario: `// AB: árbol binario genérico, sin orden entre los nodos
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
`,
      ArbolBinarioBusqueda: `// ABB: árbol binario con la propiedad de orden (izq < raíz < der)
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
`,
      ArbolAVL: `// AVL: ABB auto-balanceado, |factor de balance| <= 1 en todo nodo
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
`,
    },
    solution: {
      ArbolBinario: `// AB: árbol binario genérico, sin orden entre los nodos
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
`,
      ArbolBinarioBusqueda: `// ABB: árbol binario con la propiedad de orden (izq < raíz < der)
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
`,
      ArbolAVL: `// AVL: ABB auto-balanceado, |factor de balance| <= 1 en todo nodo
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
`,
    },
  },
  java: {
    skeleton: {
      ArbolBinario: `// AB: árbol binario genérico, sin orden entre los nodos
public class ArbolBinario<T> {
    protected Nodo<T> raiz;

    public ArbolBinario() {
        this.raiz = null;
    }

    public ArbolBinario(Nodo<T> raiz) {
        this.raiz = raiz;
    }

    public Nodo<T> getRaiz() {
        return raiz;
    }

    public boolean estaVacio() {
        return this.raiz == null;
    }

    public void vaciar() {
        this.raiz = null;
    }

    // inserción por nivel (primer lugar libre recorriendo por niveles)
    public void insertar(T dato) {
        throw new UnsupportedOperationException("No implementado");
    }

    public boolean contiene(T dato) {
        throw new UnsupportedOperationException("No implementado");
    }

    public int altura() {
        throw new UnsupportedOperationException("No implementado");
    }

    public int cantidadNodos() {
        throw new UnsupportedOperationException("No implementado");
    }

    public int cantidadHojas() {
        throw new UnsupportedOperationException("No implementado");
    }

    public List<T> preorden() {
        throw new UnsupportedOperationException("No implementado");
    }

    public List<T> inorden() {
        throw new UnsupportedOperationException("No implementado");
    }

    public List<T> posorden() {
        throw new UnsupportedOperationException("No implementado");
    }

    public List<T> porNiveles() {
        throw new UnsupportedOperationException("No implementado");
    }
}
`,
      ArbolBinarioBusqueda: `// ABB: árbol binario con la propiedad de orden (izq < raíz < der)
public class ArbolBinarioBusqueda<T extends Comparable<T>> extends ArbolBinario<T> {

    public ArbolBinarioBusqueda() {
        super();
    }

    // en un ABB la inserción respeta el orden, no es por nivel
    @Override
    public void insertar(T dato) {
        throw new UnsupportedOperationException("No implementado");
    }

    @Override
    public boolean contiene(T dato) {
        throw new UnsupportedOperationException("No implementado");
    }

    public Nodo<T> buscar(T dato) {
        throw new UnsupportedOperationException("No implementado");
    }

    public void eliminar(T dato) {
        throw new UnsupportedOperationException("No implementado");
    }

    public T minimo() {
        throw new UnsupportedOperationException("No implementado");
    }

    public T maximo() {
        throw new UnsupportedOperationException("No implementado");
    }

    public T predecesor(T dato) {
        throw new UnsupportedOperationException("No implementado");
    }

    public T sucesor(T dato) {
        throw new UnsupportedOperationException("No implementado");
    }
}
`,
      ArbolAVL: `// AVL: ABB auto-balanceado, |factor de balance| <= 1 en todo nodo
public class ArbolAVL<T extends Comparable<T>> extends ArbolBinarioBusqueda<T> {

    public ArbolAVL() {
        super();
    }

    // insertar y eliminar se redefinen porque deben rebalancear
    @Override
    public void insertar(T dato) {
        throw new UnsupportedOperationException("No implementado");
    }

    @Override
    public void eliminar(T dato) {
        throw new UnsupportedOperationException("No implementado");
    }

    public int factorBalance(Nodo<T> nodo) {
        throw new UnsupportedOperationException("No implementado");
    }

    public boolean estaBalanceado() {
        throw new UnsupportedOperationException("No implementado");
    }

    public Nodo<T> rotacionDerecha(Nodo<T> nodo) {
        throw new UnsupportedOperationException("No implementado");
    }

    public Nodo<T> rotacionIzquierda(Nodo<T> nodo) {
        throw new UnsupportedOperationException("No implementado");
    }

    public Nodo<T> rotacionDobleIzquierdaDerecha(Nodo<T> nodo) {
        throw new UnsupportedOperationException("No implementado");
    }

    public Nodo<T> rotacionDobleDerechaIzquierda(Nodo<T> nodo) {
        throw new UnsupportedOperationException("No implementado");
    }
}
`,
    },
    solution: {
      ArbolBinario: `// AB: árbol binario genérico, sin orden entre los nodos
public class ArbolBinario<T> {
    protected Nodo<T> raiz;

    public ArbolBinario() {
        this.raiz = null;
    }

    public ArbolBinario(Nodo<T> raiz) {
        this.raiz = raiz;
    }

    public Nodo<T> getRaiz() {
        return raiz;
    }

    public boolean estaVacio() {
        return this.raiz == null;
    }

    public void vaciar() {
        this.raiz = null;
    }

    // inserción por nivel (primer lugar libre recorriendo por niveles)
    public void insertar(T dato) {
        Nodo<T> nuevo = new Nodo<>(dato);
        if (estaVacio()) {
            raiz = nuevo;
            return;
        }
        Queue<Nodo<T>> cola = new LinkedList<>();
        cola.add(raiz);
        while (!cola.isEmpty()) {
            Nodo<T> actual = cola.poll();
            if (actual.izq == null) {
                actual.izq = nuevo;
                return;
            }
            if (actual.der == null) {
                actual.der = nuevo;
                return;
            }
            cola.add(actual.izq);
            cola.add(actual.der);
        }
    }

    public boolean contiene(T dato) {
        return contiene(raiz, dato);
    }

    protected boolean contiene(Nodo<T> nodo, T dato) {
        if (nodo == null) return false;
        if (nodo.dato.equals(dato)) return true;
        return contiene(nodo.izq, dato) || contiene(nodo.der, dato);
    }

    // misma convención que Nodo.altura: una hoja mide 1 y el árbol vacío, 0
    public int altura() {
        return altura(raiz);
    }

    protected int altura(Nodo<T> nodo) {
        if (nodo == null) return 0;
        return 1 + Math.max(altura(nodo.izq), altura(nodo.der));
    }

    public int cantidadNodos() {
        return cantidadNodos(raiz);
    }

    protected int cantidadNodos(Nodo<T> nodo) {
        if (nodo == null) return 0;
        return 1 + cantidadNodos(nodo.izq) + cantidadNodos(nodo.der);
    }

    public int cantidadHojas() {
        return cantidadHojas(raiz);
    }

    protected int cantidadHojas(Nodo<T> nodo) {
        if (nodo == null) return 0;
        if (nodo.esHoja()) return 1;
        return cantidadHojas(nodo.izq) + cantidadHojas(nodo.der);
    }

    public List<T> preorden() {
        List<T> res = new ArrayList<>();
        preorden(raiz, res);
        return res;
    }

    protected void preorden(Nodo<T> nodo, List<T> res) {
        if (nodo == null) return;
        res.add(nodo.dato);
        preorden(nodo.izq, res);
        preorden(nodo.der, res);
    }

    public List<T> inorden() {
        List<T> res = new ArrayList<>();
        inorden(raiz, res);
        return res;
    }

    protected void inorden(Nodo<T> nodo, List<T> res) {
        if (nodo == null) return;
        inorden(nodo.izq, res);
        res.add(nodo.dato);
        inorden(nodo.der, res);
    }

    public List<T> posorden() {
        List<T> res = new ArrayList<>();
        posorden(raiz, res);
        return res;
    }

    protected void posorden(Nodo<T> nodo, List<T> res) {
        if (nodo == null) return;
        posorden(nodo.izq, res);
        posorden(nodo.der, res);
        res.add(nodo.dato);
    }

    public List<T> porNiveles() {
        List<T> res = new ArrayList<>();
        if (estaVacio()) return res;
        Queue<Nodo<T>> cola = new LinkedList<>();
        cola.add(raiz);
        while (!cola.isEmpty()) {
            Nodo<T> actual = cola.poll();
            res.add(actual.dato);
            if (actual.izq != null) cola.add(actual.izq);
            if (actual.der != null) cola.add(actual.der);
        }
        return res;
    }
}
`,
      ArbolBinarioBusqueda: `// ABB: árbol binario con la propiedad de orden (izq < raíz < der)
public class ArbolBinarioBusqueda<T extends Comparable<T>> extends ArbolBinario<T> {

    public ArbolBinarioBusqueda() {
        super();
    }

    // en un ABB la inserción respeta el orden, no es por nivel
    @Override
    public void insertar(T dato) {
        raiz = insertar(raiz, dato);
    }

    protected Nodo<T> insertar(Nodo<T> nodo, T dato) {
        if (nodo == null) return new Nodo<>(dato);
        int cmp = dato.compareTo(nodo.dato);
        if (cmp < 0) {
            nodo.izq = insertar(nodo.izq, dato);
        } else if (cmp > 0) {
            nodo.der = insertar(nodo.der, dato);
        }
        return nodo;
    }

    @Override
    public boolean contiene(T dato) {
        return buscar(dato) != null;
    }

    public Nodo<T> buscar(T dato) {
        Nodo<T> actual = raiz;
        while (actual != null) {
            int cmp = dato.compareTo(actual.dato);
            if (cmp == 0) return actual;
            actual = cmp < 0 ? actual.izq : actual.der;
        }
        return null;
    }

    public void eliminar(T dato) {
        raiz = eliminar(raiz, dato);
    }

    protected Nodo<T> eliminar(Nodo<T> nodo, T dato) {
        if (nodo == null) return null;
        int cmp = dato.compareTo(nodo.dato);
        if (cmp < 0) {
            nodo.izq = eliminar(nodo.izq, dato);
        } else if (cmp > 0) {
            nodo.der = eliminar(nodo.der, dato);
        } else {
            // sin hijos o con uno solo: lo reemplaza el otro
            if (nodo.izq == null) return nodo.der;
            if (nodo.der == null) return nodo.izq;
            // dos hijos: copio el sucesor (mínimo del subárbol derecho) y lo borro
            Nodo<T> sucesor = minimoNodo(nodo.der);
            nodo.dato = sucesor.dato;
            nodo.der = eliminar(nodo.der, sucesor.dato);
        }
        return nodo;
    }

    public T minimo() {
        if (estaVacio()) return null;
        return minimoNodo(raiz).dato;
    }

    public T maximo() {
        if (estaVacio()) return null;
        return maximoNodo(raiz).dato;
    }

    protected Nodo<T> minimoNodo(Nodo<T> nodo) {
        while (nodo.izq != null) nodo = nodo.izq;
        return nodo;
    }

    protected Nodo<T> maximoNodo(Nodo<T> nodo) {
        while (nodo.der != null) nodo = nodo.der;
        return nodo;
    }

    // el mayor dato que es menor que el pedido (o null)
    public T predecesor(T dato) {
        Nodo<T> actual = raiz;
        T candidato = null;
        while (actual != null) {
            if (dato.compareTo(actual.dato) > 0) {
                candidato = actual.dato;
                actual = actual.der;
            } else {
                actual = actual.izq;
            }
        }
        return candidato;
    }

    // el menor dato que es mayor que el pedido (o null)
    public T sucesor(T dato) {
        Nodo<T> actual = raiz;
        T candidato = null;
        while (actual != null) {
            if (dato.compareTo(actual.dato) < 0) {
                candidato = actual.dato;
                actual = actual.izq;
            } else {
                actual = actual.der;
            }
        }
        return candidato;
    }
}
`,
      ArbolAVL: `// AVL: ABB auto-balanceado, |factor de balance| <= 1 en todo nodo
public class ArbolAVL<T extends Comparable<T>> extends ArbolBinarioBusqueda<T> {

    public ArbolAVL() {
        super();
    }

    // insertar y eliminar se redefinen porque deben rebalancear
    @Override
    public void insertar(T dato) {
        raiz = insertarAVL(raiz, dato);
    }

    private Nodo<T> insertarAVL(Nodo<T> nodo, T dato) {
        if (nodo == null) return new Nodo<>(dato);
        int cmp = dato.compareTo(nodo.dato);
        if (cmp < 0) {
            nodo.izq = insertarAVL(nodo.izq, dato);
        } else if (cmp > 0) {
            nodo.der = insertarAVL(nodo.der, dato);
        } else {
            return nodo; // repetido: no se inserta
        }
        return balancear(nodo);
    }

    @Override
    public void eliminar(T dato) {
        raiz = eliminarAVL(raiz, dato);
    }

    private Nodo<T> eliminarAVL(Nodo<T> nodo, T dato) {
        if (nodo == null) return null;
        int cmp = dato.compareTo(nodo.dato);
        if (cmp < 0) {
            nodo.izq = eliminarAVL(nodo.izq, dato);
        } else if (cmp > 0) {
            nodo.der = eliminarAVL(nodo.der, dato);
        } else {
            if (nodo.izq == null) return nodo.der;
            if (nodo.der == null) return nodo.izq;
            Nodo<T> sucesor = minimoNodo(nodo.der);
            nodo.dato = sucesor.dato;
            nodo.der = eliminarAVL(nodo.der, sucesor.dato);
        }
        return balancear(nodo);
    }

    // recalcula la altura del nodo y aplica la rotación que corresponda
    private Nodo<T> balancear(Nodo<T> nodo) {
        actualizarAltura(nodo);
        int fb = factorBalance(nodo);
        if (fb > 1) {
            if (factorBalance(nodo.izq) < 0) return rotacionDobleIzquierdaDerecha(nodo);
            return rotacionDerecha(nodo);
        }
        if (fb < -1) {
            if (factorBalance(nodo.der) > 0) return rotacionDobleDerechaIzquierda(nodo);
            return rotacionIzquierda(nodo);
        }
        return nodo;
    }

    private int alturaDe(Nodo<T> nodo) {
        return nodo == null ? 0 : nodo.altura;
    }

    private void actualizarAltura(Nodo<T> nodo) {
        nodo.altura = 1 + Math.max(alturaDe(nodo.izq), alturaDe(nodo.der));
    }

    public int factorBalance(Nodo<T> nodo) {
        if (nodo == null) return 0;
        return alturaDe(nodo.izq) - alturaDe(nodo.der);
    }

    public boolean estaBalanceado() {
        return estaBalanceado(raiz);
    }

    private boolean estaBalanceado(Nodo<T> nodo) {
        if (nodo == null) return true;
        int fb = alturaReal(nodo.izq) - alturaReal(nodo.der);
        return Math.abs(fb) <= 1 && estaBalanceado(nodo.izq) && estaBalanceado(nodo.der);
    }

    private int alturaReal(Nodo<T> nodo) {
        if (nodo == null) return 0;
        return 1 + Math.max(alturaReal(nodo.izq), alturaReal(nodo.der));
    }

    public Nodo<T> rotacionDerecha(Nodo<T> nodo) {
        Nodo<T> nuevaRaiz = nodo.izq;
        nodo.izq = nuevaRaiz.der;
        nuevaRaiz.der = nodo;
        actualizarAltura(nodo);
        actualizarAltura(nuevaRaiz);
        return nuevaRaiz;
    }

    public Nodo<T> rotacionIzquierda(Nodo<T> nodo) {
        Nodo<T> nuevaRaiz = nodo.der;
        nodo.der = nuevaRaiz.izq;
        nuevaRaiz.izq = nodo;
        actualizarAltura(nodo);
        actualizarAltura(nuevaRaiz);
        return nuevaRaiz;
    }

    public Nodo<T> rotacionDobleIzquierdaDerecha(Nodo<T> nodo) {
        nodo.izq = rotacionIzquierda(nodo.izq);
        return rotacionDerecha(nodo);
    }

    public Nodo<T> rotacionDobleDerechaIzquierda(Nodo<T> nodo) {
        nodo.der = rotacionDerecha(nodo.der);
        return rotacionIzquierda(nodo);
    }
}
`,
    },
  },
};

const CLASS_EXAMPLES = {
  ArbolBinario: 'arbol.altura()   arbol.insertar(99)   arbol.porNiveles()',
  ArbolBinarioBusqueda: 'arbol.insertar(35)   arbol.buscar(30)   arbol.eliminar(20)',
  ArbolAVL: 'arbol.insertar(27)   arbol.eliminar(10)   arbol.estaBalanceado()',
};

function classHeader(ex, lang) {
  const included = ['Nodo', ...ex.provides].join(', ');
  if (lang === 'java') {
    return `// ${ex.cls} (${ex.tag}) en Java.
// Ya vienen incluidas: ${included}. Nodo<T> tiene dato, izq, der y altura (arranca en 1).
// «arbol» es una instancia de la clase elegida en «arbol es un», y arbol.raiz es el árbol dibujado.
// Probá, por ejemplo: ${CLASS_EXAMPLES[ex.cls]}
import java.util.*;

`;
  }
  return `// ${ex.cls} (${ex.tag}) en JavaScript.
// Ya vienen incluidas: ${included}.   new Nodo(dato) → { dato, izq: null, der: null, altura: 1 }
// «arbol» es una instancia de la clase elegida en «arbol es un», y arbol.raiz es el árbol dibujado.
// Probá, por ejemplo: ${CLASS_EXAMPLES[ex.cls]}

`;
}

/**
 * Estructura que se muestra en el modal: qué clases y métodos hay que implementar.
 * `sig` es la firma en JavaScript y `jsig` en Java. `override`: tiene que redefinirse en esa clase.
 */
const TREE_STRUCTURE = [
  {
    name: 'Nodo',
    builtin: true,
    desc: 'Incluida. Cada nodo del dibujo es un Nodo; los que crees con new Nodo(...) aparecen en el lienzo.',
    fields: {
      js: [['dato', 'el valor guardado'], ['izq, der', 'hijos izquierdo y derecho (Nodo o null)'], ['altura', 'arranca en 1; la usa el AVL']],
      java: [['T dato', 'el valor guardado'], ['Nodo<T> izq, der', 'hijos izquierdo y derecho (o null)'], ['int altura', 'arranca en 1; la usa el AVL']],
    },
    methods: {
      js: [
        ['constructor(dato, izq = null, der = null)', 'new Nodo(5) o new Nodo(5, izq, der)'],
        ['getDato() / setDato(dato)', ''], ['getIzq() / setIzq(nodo)', ''], ['getDer() / setDer(nodo)', ''],
        ['getAltura() / setAltura(n)', ''], ['esHoja()', 'true si no tiene hijos'],
      ],
      java: [
        ['Nodo(T dato) · Nodo(T dato, Nodo<T> izq, Nodo<T> der)', 'new Nodo<>(5)'],
        ['T getDato() / void setDato(T dato)', ''], ['Nodo<T> getIzq() / void setIzq(Nodo<T> izq)', ''],
        ['Nodo<T> getDer() / void setDer(Nodo<T> der)', ''], ['int getAltura() / void setAltura(int altura)', ''],
        ['boolean esHoja()', 'true si no tiene hijos'],
      ],
    },
  },
  {
    name: 'ArbolBinario',
    tag: 'AB',
    jheader: 'public class ArbolBinario<T>',
    desc: 'Árbol binario genérico, sin orden entre los nodos.',
    fields: { js: [['this.raiz', 'Nodo o null']], java: [['protected Nodo<T> raiz', 'Nodo o null']] },
    methods: [
      { name: 'getRaiz', sig: 'getRaiz()', ret: 'Nodo | null', jsig: 'Nodo<T> getRaiz()' },
      { name: 'estaVacio', sig: 'estaVacio()', ret: 'boolean', jsig: 'boolean estaVacio()' },
      { name: 'vaciar', sig: 'vaciar()', ret: 'void', jsig: 'void vaciar()' },
      { name: 'insertar', sig: 'insertar(dato)', ret: 'void', jsig: 'void insertar(T dato)', desc: 'por nivel: primer lugar libre recorriendo por niveles' },
      { name: 'contiene', sig: 'contiene(dato)', ret: 'boolean', jsig: 'boolean contiene(T dato)' },
      { name: 'altura', sig: 'altura()', ret: 'number', jsig: 'int altura()', desc: 'hoja = 1, árbol vacío = 0' },
      { name: 'cantidadNodos', sig: 'cantidadNodos()', ret: 'number', jsig: 'int cantidadNodos()' },
      { name: 'cantidadHojas', sig: 'cantidadHojas()', ret: 'number', jsig: 'int cantidadHojas()' },
      { name: 'preorden', sig: 'preorden()', ret: 'dato[]', jsig: 'List<T> preorden()' },
      { name: 'inorden', sig: 'inorden()', ret: 'dato[]', jsig: 'List<T> inorden()' },
      { name: 'posorden', sig: 'posorden()', ret: 'dato[]', jsig: 'List<T> posorden()' },
      { name: 'porNiveles', sig: 'porNiveles()', ret: 'dato[]', jsig: 'List<T> porNiveles()' },
    ],
  },
  {
    name: 'ArbolBinarioBusqueda',
    tag: 'ABB',
    parent: 'ArbolBinario',
    jheader: 'public class ArbolBinarioBusqueda<T extends Comparable<T>> extends ArbolBinario<T>',
    desc: 'Árbol binario con la propiedad de orden (izq < raíz < der).',
    methods: [
      { name: 'insertar', sig: 'insertar(dato)', ret: 'void', jsig: 'void insertar(T dato)', desc: 'respeta el orden, no es por nivel', override: true },
      { name: 'contiene', sig: 'contiene(dato)', ret: 'boolean', jsig: 'boolean contiene(T dato)', desc: 'puede aprovechar el orden' },
      { name: 'buscar', sig: 'buscar(dato)', ret: 'Nodo | null', jsig: 'Nodo<T> buscar(T dato)' },
      { name: 'eliminar', sig: 'eliminar(dato)', ret: 'void', jsig: 'void eliminar(T dato)' },
      { name: 'minimo', sig: 'minimo()', ret: 'dato', jsig: 'T minimo()' },
      { name: 'maximo', sig: 'maximo()', ret: 'dato', jsig: 'T maximo()' },
      { name: 'predecesor', sig: 'predecesor(dato)', ret: 'dato | null', jsig: 'T predecesor(T dato)', desc: 'el mayor dato menor que el pedido' },
      { name: 'sucesor', sig: 'sucesor(dato)', ret: 'dato | null', jsig: 'T sucesor(T dato)', desc: 'el menor dato mayor que el pedido' },
    ],
  },
  {
    name: 'ArbolAVL',
    tag: 'AVL',
    parent: 'ArbolBinarioBusqueda',
    jheader: 'public class ArbolAVL<T extends Comparable<T>> extends ArbolBinarioBusqueda<T>',
    desc: 'ABB auto-balanceado: |factor de balance| ≤ 1 en todo nodo.',
    methods: [
      { name: 'insertar', sig: 'insertar(dato)', ret: 'void', jsig: 'void insertar(T dato)', desc: 'inserta y rebalancea', override: true },
      { name: 'eliminar', sig: 'eliminar(dato)', ret: 'void', jsig: 'void eliminar(T dato)', desc: 'elimina y rebalancea', override: true },
      { name: 'factorBalance', sig: 'factorBalance(nodo)', ret: 'number', jsig: 'int factorBalance(Nodo<T> nodo)', desc: 'altura(izq) − altura(der)' },
      { name: 'estaBalanceado', sig: 'estaBalanceado()', ret: 'boolean', jsig: 'boolean estaBalanceado()' },
      { name: 'rotacionDerecha', sig: 'rotacionDerecha(nodo)', ret: 'Nodo', jsig: 'Nodo<T> rotacionDerecha(Nodo<T> nodo)', desc: 'devuelve la nueva raíz del subárbol' },
      { name: 'rotacionIzquierda', sig: 'rotacionIzquierda(nodo)', ret: 'Nodo', jsig: 'Nodo<T> rotacionIzquierda(Nodo<T> nodo)' },
      { name: 'rotacionDobleIzquierdaDerecha', sig: 'rotacionDobleIzquierdaDerecha(nodo)', ret: 'Nodo', jsig: 'Nodo<T> rotacionDobleIzquierdaDerecha(Nodo<T> nodo)' },
      { name: 'rotacionDobleDerechaIzquierda', sig: 'rotacionDobleDerechaIzquierda(nodo)', ret: 'Nodo', jsig: 'Nodo<T> rotacionDobleDerechaIzquierda(Nodo<T> nodo)' },
    ],
  },
];

/** Cantidad de parámetros de una firma de la estructura. */
function structureArity(m) {
  return /\(([^)]*)\)/.exec(m.sig)[1].split(',').filter(x => x.trim()).length;
}

/**
 * Línea de ejecución sugerida para un método de la estructura (igual en JS y en Java).
 * En los grafos, {v} y {w} se reemplazan por valores de vértices del dibujo al usarla.
 */
function structureCall(m, obj = 'arbol') {
  const params = /\(([^)]*)\)/.exec(m.sig)[1].split(',').map(x => x.trim()).filter(Boolean);
  const GRAPH_ARG = { dato: '{v}', origen: '{v}', destino: '{w}', peso: '5' };
  const args = params.map(p => (p === 'nodo' ? 'arbol.raiz' : obj === 'grafo' ? GRAPH_ARG[p] ?? '?' : '?'));
  const call = `${obj}.${m.name}(${args.join(', ')})`;
  return m.name.startsWith('rotacion') ? `arbol.raiz = ${call}` : call;
}

/* ---------- funciones sueltas ---------- */

const JS_FUNCTIONS = {
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

const JAVA_FUNCTIONS = {
  altura: `// Altura: una hoja mide 1 y el árbol vacío, 0 (como Nodo.altura)
static int altura(Nodo<Integer> nodo) {
    if (nodo == null) return 0;
    int izq = altura(nodo.izq);
    int der = altura(nodo.der);
    return 1 + Math.max(izq, der);
}`,

  contarNodos: `static int contarNodos(Nodo<Integer> nodo) {
    if (nodo == null) return 0;
    return 1 + contarNodos(nodo.izq) + contarNodos(nodo.der);
}`,

  contarHojas: `static int contarHojas(Nodo<Integer> nodo) {
    if (nodo == null) return 0;
    if (nodo.esHoja()) return 1;
    return contarHojas(nodo.izq) + contarHojas(nodo.der);
}`,

  sumar: `static int sumar(Nodo<Integer> nodo) {
    if (nodo == null) return 0;
    return nodo.dato + sumar(nodo.izq) + sumar(nodo.der);
}`,

  minimo: `// En un ABB el mínimo está en el nodo de más a la izquierda
static int minimo(Nodo<Integer> nodo) {
    Nodo<Integer> actual = nodo;
    while (actual.izq != null) {
        actual = actual.izq;
    }
    return actual.dato;
}`,

  maximo: `// En un ABB el máximo está en el nodo de más a la derecha
static int maximo(Nodo<Integer> nodo) {
    if (nodo.der == null) return nodo.dato;
    return maximo(nodo.der);
}`,

  buscar: `// Búsqueda en un ABB: devuelve el nodo o null
static Nodo<Integer> buscar(Nodo<Integer> nodo, int x) {
    if (nodo == null || nodo.dato == x) return nodo;
    if (x < nodo.dato) return buscar(nodo.izq, x);
    return buscar(nodo.der, x);
}`,

  esABB: `// Cada nodo tiene que estar entre los límites que le imponen sus ancestros (null = sin límite)
static boolean esABB(Nodo<Integer> nodo, Integer min, Integer max) {
    if (nodo == null) return true;
    if (min != null && nodo.dato <= min) return false;
    if (max != null && nodo.dato >= max) return false;
    return esABB(nodo.izq, min, nodo.dato) && esABB(nodo.der, nodo.dato, max);
}`,

  esAVL: `static boolean esAVL(Nodo<Integer> nodo) {
    return esABB(nodo, null, null) && balanceado(nodo);
}

static boolean balanceado(Nodo<Integer> nodo) {
    if (nodo == null) return true;
    int fb = altura(nodo.izq) - altura(nodo.der);
    if (Math.abs(fb) > 1) return false;
    return balanceado(nodo.izq) && balanceado(nodo.der);
}`,

  espejo: `// Intercambia izquierda y derecha en todo el árbol
static void espejo(Nodo<Integer> nodo) {
    if (nodo == null) return;
    Nodo<Integer> aux = nodo.izq;
    nodo.izq = nodo.der;
    nodo.der = aux;
    espejo(nodo.izq);
    espejo(nodo.der);
}`,

  nivel: `// Nivel (profundidad) en el que está x, o -1 si no está
static int nivel(Nodo<Integer> nodo, int x, int prof) {
    if (nodo == null) return -1;
    if (nodo.dato == x) return prof;
    int izq = nivel(nodo.izq, x, prof + 1);
    if (izq != -1) return izq;
    return nivel(nodo.der, x, prof + 1);
}`,

  ag: `// Árbol general: se recorren todos los hijos (sirve también para binarios)
static int alturaAG(Nodo<String> nodo) {
    int max = 0;
    for (Nodo<String> hijo : nodo.hijos) {
        max = Math.max(max, alturaAG(hijo));
    }
    return max + 1;
}

static int contarAG(Nodo<String> nodo) {
    int total = 1;
    for (Nodo<String> hijo : nodo.hijos) {
        total += contarAG(hijo);
    }
    return total;
}

// Grado del árbol: la mayor cantidad de hijos de un nodo
static int grado(Nodo<String> nodo) {
    int g = nodo.hijos.size();
    for (Nodo<String> hijo : nodo.hijos) {
        g = Math.max(g, grado(hijo));
    }
    return g;
}`,
};

const FN_TASK = {
  js: `// Completá las funciones. «raiz» es la raíz del árbol dibujado (o null).
// Cada nodo tiene nodo.dato, nodo.izq, nodo.der y nodo.altura (nodo.hijos para árboles generales).
`,
  java: `// Completá los métodos. «raiz» es la raíz del árbol dibujado (o null).
// Cada nodo tiene nodo.dato, nodo.izq, nodo.der y nodo.altura (nodo.hijos, una List, para árboles generales).
`,
};

const BLANK = {
  js: `// Escribí tus propias clases o funciones.
// «raiz» es la raíz del árbol dibujado y «arbol» la instancia de la clase elegida (si definís alguna).

function miFuncion(nodo) {
  // Tu código acá
  throw new Error("No implementado");
}
`,
  java: `// Escribí tus propias clases o métodos (los métodos sueltos van con static).
// «raiz» es la raíz del árbol dibujado y «arbol» la instancia de la clase elegida (si definís alguna).
import java.util.*;

static int miMetodo(Nodo<Integer> nodo) {
    // Tu código acá
    throw new UnsupportedOperationException("No implementado");
}
`,
};

/** Esqueleto de un conjunto de funciones: conserva comentarios y firmas, vacía los cuerpos. */
function makeStub(code, lang) {
  const lines = code.split('\n');
  const decls = LANGS[lang].parser().parseProgram(code).body.filter(d => d.t === 'funcdecl');
  for (const d of decls.reverse()) {
    const indent = /^\s*/.exec(lines[d.line - 1])[0] + (lang === 'java' ? '    ' : '  ');
    lines.splice(d.line, d.body.endLine - d.line - 1, `${indent}// Tu código acá`, `${indent}${LANGS[lang].stub}`);
  }
  return lines.join('\n');
}

/**
 * Ejercicios del selector. Las clases van por separado: en ABB y AVL las clases madre
 * vienen incluidas (resueltas) para concentrarse en la clase del ejercicio.
 */
const EXERCISES = [
  { id: 'ab', group: 'Estructura de clases', name: 'AB · ArbolBinario', kind: 'classes', cls: 'ArbolBinario', tag: 'AB', provides: [], call: { js: 'arbol.altura()', java: 'arbol.altura()' } },
  { id: 'abb', group: 'Estructura de clases', name: 'ABB · ArbolBinarioBusqueda', kind: 'classes', cls: 'ArbolBinarioBusqueda', tag: 'ABB', provides: ['ArbolBinario'], call: { js: 'arbol.insertar(35)', java: 'arbol.insertar(35)' } },
  { id: 'avl', group: 'Estructura de clases', name: 'AVL · ArbolAVL', kind: 'classes', cls: 'ArbolAVL', tag: 'AVL', provides: ['ArbolBinario', 'ArbolBinarioBusqueda'], call: { js: 'arbol.insertar(27)', java: 'arbol.insertar(27)' } },
  ...[
    ['altura', 'Altura', ['altura'], 'altura(raiz)'],
    ['contar', 'Contar nodos y hojas', ['contarNodos', 'contarHojas'], 'contarHojas(raiz)'],
    ['sumar', 'Sumar datos', ['sumar'], 'sumar(raiz)'],
    ['minmax', 'Mínimo y máximo (ABB)', ['minimo', 'maximo'], 'minimo(raiz)'],
    ['buscar', 'Buscar (ABB)', ['buscar'], 'buscar(raiz, 30)'],
    ['esABB', 'esABB', ['esABB'], { js: 'esABB(raiz)', java: 'esABB(raiz, null, null)' }],
    ['esAVL', 'esAVL', ['esAVL', 'esABB', 'altura'], 'esAVL(raiz)'],
    ['espejo', 'Espejo', ['espejo'], 'espejo(raiz)'],
    ['nivel', 'Nivel de un valor', ['nivel'], { js: 'nivel(raiz, 30)', java: 'nivel(raiz, 30, 0)' }],
    ['ag', 'Árbol general: altura, cantidad y grado', ['ag'], 'alturaAG(raiz)'],
  ].map(([id, name, fns, call]) => ({
    id, group: 'Funciones sueltas', name, kind: 'functions', fns,
    call: typeof call === 'string' ? { js: call, java: call } : call,
  })),
  { id: 'blanco', group: 'Libre', name: 'Hoja en blanco', kind: 'free', call: { js: 'miFuncion(raiz)', java: 'miMetodo(raiz)' } },
];

const Exercise = (() => {
  const cache = new Map();
  const memo = (key, fn) => {
    if (!cache.has(key)) cache.set(key, fn());
    return cache.get(key);
  };

  const graph = ex => ex.space === 'graph';

  function solution(ex, lang) {
    if (ex.kind === 'classes') return (graph(ex) ? graphClassHeader : classHeader)(ex, lang) + CLASS_CODE[lang].solution[ex.cls];
    if (ex.kind === 'functions') {
      const fns = lang === 'java' ? JAVA_FUNCTIONS : JS_FUNCTIONS;
      return (graph(ex) ? GRAPH_FN_TASK : FN_TASK)[lang] + '\n' + ex.fns.map(k => fns[k]).join('\n\n') + '\n';
    }
    return null;
  }

  function starter(ex, lang) {
    if (ex.kind === 'classes') return (graph(ex) ? graphClassHeader : classHeader)(ex, lang) + CLASS_CODE[lang].skeleton[ex.cls];
    if (ex.kind === 'functions') return memo(`stub:${ex.id}:${lang}`, () => makeStub(solution(ex, lang), lang));
    return (graph(ex) ? GRAPH_BLANK : BLANK)[lang];
  }

  /** Código incluido (clases resueltas que el ejercicio da hechas) que se carga antes del código del editor. */
  function prelude(ex, lang) {
    if (!ex.provides?.length) return null;
    return memo(`prelude:${ex.id}:${lang}`, () => {
      const prog = LANGS[lang].parser().parseProgram(ex.provides.map(c => CLASS_CODE[lang].solution[c]).join('\n'));
      (function mark(n) {
        if (!n || typeof n !== 'object') return;
        if (n.t === 'funcexpr' || n.t === 'funcdecl' || n.t === 'classdecl') n.lib = true;
        for (const v of Object.values(n)) if (v && typeof v === 'object') Array.isArray(v) ? v.forEach(mark) : mark(v);
      })(prog);
      return prog;
    });
  }

  /** Línea donde está un método (o función) en la solución de referencia. */
  function solutionLine(ex, lang, name, arity = null) {
    const prog = memo(`sol:${ex.id}:${lang}`, () => LANGS[lang].parser().parseProgram(solution(ex, lang)));
    for (const d of prog.body) {
      if (d.t === 'funcdecl' && d.name === name) return d.line;
      if (d.t === 'classdecl' && d.name === ex.cls) {
        const ms = d.methods.filter(m => m.name === name);
        return (ms.find(m => arity === null || m.fn.params.length === arity) ?? ms[0])?.line ?? null;
      }
    }
    return null;
  }

  return { solution, starter, prelude, solutionLine, call: (ex, lang) => ex.call[lang], space: ex => ex.space ?? 'tree' };
})();
