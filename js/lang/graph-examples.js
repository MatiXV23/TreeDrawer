/*
 * Práctica de grafos en JavaScript y en Java.
 * El grafo se guarda con lista de adyacencia: Vertice (dato, adyacentes, visitado) y Arista
 * (destino, peso) vienen incluidas y están conectadas al dibujo; la clase Grafo es la que se
 * programa. Los algoritmos (BFS, DFS, Dijkstra…) reciben el grafo con la clase Grafo incluida.
 */

CLASS_CODE.js.skeleton.Grafo = `// Grafo con lista de adyacencia: cada Vertice guarda las aristas que salen de él
class Grafo {
  constructor(dirigido = false) {
    this.vertices = [];        // array de Vertice
    this.dirigido = dirigido;  // si no es dirigido, cada arista se guarda en los dos sentidos
  }

  getVertices() {
    return this.vertices;
  }

  esDirigido() {
    return this.dirigido;
  }

  // el Vertice que tiene ese dato, o null si no está
  buscarVertice(dato) {
    throw new Error("No implementado");
  }

  // agrega un vértice nuevo (si ya está, no hace nada)
  agregarVertice(dato) {
    throw new Error("No implementado");
  }

  // agrega los vértices que falten; si no es dirigido, también la arista destino → origen
  agregarArista(origen, destino, peso = 1) {
    throw new Error("No implementado");
  }

  existeArista(origen, destino) {
    throw new Error("No implementado");
  }

  // si no es dirigido, saca las dos direcciones
  eliminarArista(origen, destino) {
    throw new Error("No implementado");
  }

  // saca el vértice y también todas las aristas que llegan a él
  eliminarVertice(dato) {
    throw new Error("No implementado");
  }

  // los datos de sus vecinos (a donde llegan sus aristas)
  adyacentes(dato) {
    throw new Error("No implementado");
  }

  // cantidad de aristas que salen (en un grafo no dirigido, el grado)
  gradoSalida(dato) {
    throw new Error("No implementado");
  }

  // cantidad de aristas que llegan
  gradoEntrada(dato) {
    throw new Error("No implementado");
  }

  cantidadVertices() {
    throw new Error("No implementado");
  }

  // en un no dirigido cada arista está guardada dos veces, pero cuenta una
  cantidadAristas() {
    throw new Error("No implementado");
  }
}
`;

CLASS_CODE.js.solution.Grafo = `// Grafo con lista de adyacencia: cada Vertice guarda las aristas que salen de él
class Grafo {
  constructor(dirigido = false) {
    this.vertices = [];        // array de Vertice
    this.dirigido = dirigido;  // si no es dirigido, cada arista se guarda en los dos sentidos
  }

  getVertices() {
    return this.vertices;
  }

  esDirigido() {
    return this.dirigido;
  }

  buscarVertice(dato) {
    for (const v of this.vertices) {
      if (v.dato === dato) return v;
    }
    return null;
  }

  agregarVertice(dato) {
    if (this.buscarVertice(dato) === null) {
      this.vertices.push(new Vertice(dato));
    }
  }

  agregarArista(origen, destino, peso = 1) {
    this.agregarVertice(origen);
    this.agregarVertice(destino);
    const desde = this.buscarVertice(origen);
    const hasta = this.buscarVertice(destino);
    if (!this.existeArista(origen, destino)) {
      desde.adyacentes.push(new Arista(hasta, peso));
    }
    if (!this.dirigido && !this.existeArista(destino, origen)) {
      hasta.adyacentes.push(new Arista(desde, peso));
    }
  }

  existeArista(origen, destino) {
    const desde = this.buscarVertice(origen);
    if (desde === null) return false;
    for (const arista of desde.adyacentes) {
      if (arista.destino.dato === destino) return true;
    }
    return false;
  }

  eliminarArista(origen, destino) {
    this.quitarArista(this.buscarVertice(origen), destino);
    if (!this.dirigido) {
      this.quitarArista(this.buscarVertice(destino), origen);
    }
  }

  // saca de «desde» la arista que va a «destino» (si está)
  quitarArista(desde, destino) {
    if (desde === null) return;
    const i = desde.adyacentes.findIndex(arista => arista.destino.dato === destino);
    if (i >= 0) desde.adyacentes.splice(i, 1);
  }

  eliminarVertice(dato) {
    const v = this.buscarVertice(dato);
    if (v === null) return;
    for (const otro of this.vertices) {
      this.quitarArista(otro, dato);
    }
    this.vertices.splice(this.vertices.indexOf(v), 1);
  }

  adyacentes(dato) {
    const v = this.buscarVertice(dato);
    if (v === null) return [];
    return v.adyacentes.map(arista => arista.destino.dato);
  }

  gradoSalida(dato) {
    const v = this.buscarVertice(dato);
    return v === null ? 0 : v.adyacentes.length;
  }

  gradoEntrada(dato) {
    let grado = 0;
    for (const v of this.vertices) {
      for (const arista of v.adyacentes) {
        if (arista.destino.dato === dato) grado++;
      }
    }
    return grado;
  }

  cantidadVertices() {
    return this.vertices.length;
  }

  cantidadAristas() {
    let total = 0;
    for (const v of this.vertices) {
      total += v.adyacentes.length;
    }
    return this.dirigido ? total : total / 2;
  }
}
`;

CLASS_CODE.java.skeleton.Grafo = `// Grafo con lista de adyacencia: cada Vertice guarda las aristas que salen de él
public class Grafo<T> {
    protected List<Vertice<T>> vertices;
    protected boolean dirigido; // si no es dirigido, cada arista se guarda en los dos sentidos

    public Grafo() {
        this(false);
    }

    public Grafo(boolean dirigido) {
        this.vertices = new ArrayList<>();
        this.dirigido = dirigido;
    }

    public List<Vertice<T>> getVertices() {
        return vertices;
    }

    public boolean esDirigido() {
        return dirigido;
    }

    // el Vertice que tiene ese dato, o null si no está
    public Vertice<T> buscarVertice(T dato) {
        throw new UnsupportedOperationException("No implementado");
    }

    // agrega un vértice nuevo (si ya está, no hace nada)
    public void agregarVertice(T dato) {
        throw new UnsupportedOperationException("No implementado");
    }

    public void agregarArista(T origen, T destino) {
        agregarArista(origen, destino, 1);
    }

    // agrega los vértices que falten; si no es dirigido, también la arista destino → origen
    public void agregarArista(T origen, T destino, int peso) {
        throw new UnsupportedOperationException("No implementado");
    }

    public boolean existeArista(T origen, T destino) {
        throw new UnsupportedOperationException("No implementado");
    }

    // si no es dirigido, saca las dos direcciones
    public void eliminarArista(T origen, T destino) {
        throw new UnsupportedOperationException("No implementado");
    }

    // saca el vértice y también todas las aristas que llegan a él
    public void eliminarVertice(T dato) {
        throw new UnsupportedOperationException("No implementado");
    }

    // los datos de sus vecinos (a donde llegan sus aristas)
    public List<T> adyacentes(T dato) {
        throw new UnsupportedOperationException("No implementado");
    }

    // cantidad de aristas que salen (en un grafo no dirigido, el grado)
    public int gradoSalida(T dato) {
        throw new UnsupportedOperationException("No implementado");
    }

    // cantidad de aristas que llegan
    public int gradoEntrada(T dato) {
        throw new UnsupportedOperationException("No implementado");
    }

    public int cantidadVertices() {
        throw new UnsupportedOperationException("No implementado");
    }

    // en un no dirigido cada arista está guardada dos veces, pero cuenta una
    public int cantidadAristas() {
        throw new UnsupportedOperationException("No implementado");
    }
}
`;

CLASS_CODE.java.solution.Grafo = `// Grafo con lista de adyacencia: cada Vertice guarda las aristas que salen de él
public class Grafo<T> {
    protected List<Vertice<T>> vertices;
    protected boolean dirigido; // si no es dirigido, cada arista se guarda en los dos sentidos

    public Grafo() {
        this(false);
    }

    public Grafo(boolean dirigido) {
        this.vertices = new ArrayList<>();
        this.dirigido = dirigido;
    }

    public List<Vertice<T>> getVertices() {
        return vertices;
    }

    public boolean esDirigido() {
        return dirigido;
    }

    public Vertice<T> buscarVertice(T dato) {
        for (Vertice<T> v : vertices) {
            if (v.getDato().equals(dato)) {
                return v;
            }
        }
        return null;
    }

    public void agregarVertice(T dato) {
        if (buscarVertice(dato) == null) {
            vertices.add(new Vertice<>(dato));
        }
    }

    public void agregarArista(T origen, T destino) {
        agregarArista(origen, destino, 1);
    }

    public void agregarArista(T origen, T destino, int peso) {
        agregarVertice(origen);
        agregarVertice(destino);
        Vertice<T> desde = buscarVertice(origen);
        Vertice<T> hasta = buscarVertice(destino);
        if (!existeArista(origen, destino)) {
            desde.getAdyacentes().add(new Arista<>(hasta, peso));
        }
        if (!dirigido && !existeArista(destino, origen)) {
            hasta.getAdyacentes().add(new Arista<>(desde, peso));
        }
    }

    public boolean existeArista(T origen, T destino) {
        Vertice<T> desde = buscarVertice(origen);
        if (desde == null) {
            return false;
        }
        for (Arista<T> arista : desde.getAdyacentes()) {
            if (arista.getDestino().getDato().equals(destino)) {
                return true;
            }
        }
        return false;
    }

    public void eliminarArista(T origen, T destino) {
        quitarArista(buscarVertice(origen), destino);
        if (!dirigido) {
            quitarArista(buscarVertice(destino), origen);
        }
    }

    // saca de «desde» la arista que va a «destino» (si está)
    protected void quitarArista(Vertice<T> desde, T destino) {
        if (desde == null) {
            return;
        }
        List<Arista<T>> aristas = desde.getAdyacentes();
        for (int i = 0; i < aristas.size(); i++) {
            if (aristas.get(i).getDestino().getDato().equals(destino)) {
                aristas.remove(i);
                return;
            }
        }
    }

    public void eliminarVertice(T dato) {
        Vertice<T> v = buscarVertice(dato);
        if (v == null) {
            return;
        }
        for (Vertice<T> otro : vertices) {
            quitarArista(otro, dato);
        }
        vertices.remove(v);
    }

    public List<T> adyacentes(T dato) {
        List<T> vecinos = new ArrayList<>();
        Vertice<T> v = buscarVertice(dato);
        if (v != null) {
            for (Arista<T> arista : v.getAdyacentes()) {
                vecinos.add(arista.getDestino().getDato());
            }
        }
        return vecinos;
    }

    public int gradoSalida(T dato) {
        Vertice<T> v = buscarVertice(dato);
        return v == null ? 0 : v.getAdyacentes().size();
    }

    public int gradoEntrada(T dato) {
        int grado = 0;
        for (Vertice<T> v : vertices) {
            for (Arista<T> arista : v.getAdyacentes()) {
                if (arista.getDestino().getDato().equals(dato)) {
                    grado++;
                }
            }
        }
        return grado;
    }

    public int cantidadVertices() {
        return vertices.size();
    }

    public int cantidadAristas() {
        int total = 0;
        for (Vertice<T> v : vertices) {
            total += v.getAdyacentes().size();
        }
        return dirigido ? total : total / 2;
    }
}
`;

function graphClassHeader(ex, lang) {
  if (lang === 'java') {
    return `// ${ex.cls} en Java.
// Ya vienen incluidas: Vertice<T> (dato, adyacentes, visitado) y Arista<T> (destino, peso).
// «grafo» es una instancia de la clase elegida en «grafo es un», con los vértices y aristas dibujados.
// Probá, por ejemplo: grafo.adyacentes(1)   grafo.agregarArista(1, 9)   grafo.eliminarVertice(2)
import java.util.*;

`;
  }
  return `// ${ex.cls} en JavaScript.
// Ya vienen incluidas: new Vertice(dato) → { dato, adyacentes: [], visitado: false }
//                      new Arista(destino, peso = 1) → { destino, peso }
// «grafo» es una instancia de la clase elegida en «grafo es un», con los vértices y aristas dibujados.
// Probá, por ejemplo: grafo.adyacentes(1)   grafo.agregarArista(1, 9)   grafo.eliminarVertice(2)

`;
}

const GRAPH_STRUCTURE = [
  {
    name: 'Vertice',
    builtin: true,
    desc: 'Incluida. Cada vértice del dibujo es un Vertice; los que crees con new Vertice(...) aparecen en el lienzo.',
    fields: {
      js: [['dato', 'el valor del vértice'], ['adyacentes', 'array de Arista: las que salen de este vértice'], ['visitado', 'marca para los recorridos (arranca en false)']],
      java: [['T dato', 'el valor del vértice'], ['List<Arista<T>> adyacentes', 'las aristas que salen de este vértice'], ['boolean visitado', 'marca para los recorridos (arranca en false)']],
    },
    methods: {
      js: [['constructor(dato)', 'new Vertice(5)'], ['getDato() / setDato(dato)', ''], ['getAdyacentes()', ''], ['isVisitado() / setVisitado(b)', '']],
      java: [['Vertice(T dato)', 'new Vertice<>(5)'], ['T getDato() / void setDato(T dato)', ''], ['List<Arista<T>> getAdyacentes()', ''], ['boolean isVisitado() / void setVisitado(boolean v)', '']],
    },
  },
  {
    name: 'Arista',
    builtin: true,
    desc: 'Incluida. Va en la lista de adyacentes de su vértice de origen.',
    fields: {
      js: [['destino', 'el Vertice al que llega'], ['peso', 'número (1 si no se indica)']],
      java: [['Vertice<T> destino', 'el vértice al que llega'], ['int peso', 'su peso']],
    },
    methods: {
      js: [['constructor(destino, peso = 1)', 'new Arista(v, 4)'], ['getDestino() / setDestino(v)', ''], ['getPeso() / setPeso(p)', '']],
      java: [['Arista(Vertice<T> destino, int peso)', 'new Arista<>(v, 4)'], ['Vertice<T> getDestino() / void setDestino(Vertice<T> v)', ''], ['int getPeso() / void setPeso(int peso)', '']],
    },
  },
  {
    name: 'Grafo',
    tag: 'Grafo',
    jheader: 'public class Grafo<T>',
    desc: 'Grafo con lista de adyacencia: cada vértice guarda las aristas que salen de él.',
    fields: {
      js: [['this.vertices', 'array de Vertice'], ['this.dirigido', 'boolean']],
      java: [['protected List<Vertice<T>> vertices', 'los vértices'], ['protected boolean dirigido', 'si las aristas tienen sentido']],
    },
    methods: [
      { name: 'getVertices', sig: 'getVertices()', ret: 'Vertice[]', jsig: 'List<Vertice<T>> getVertices()' },
      { name: 'esDirigido', sig: 'esDirigido()', ret: 'boolean', jsig: 'boolean esDirigido()' },
      { name: 'buscarVertice', sig: 'buscarVertice(dato)', ret: 'Vertice | null', jsig: 'Vertice<T> buscarVertice(T dato)' },
      { name: 'agregarVertice', sig: 'agregarVertice(dato)', ret: 'void', jsig: 'void agregarVertice(T dato)', desc: 'sin repetidos' },
      { name: 'agregarArista', sig: 'agregarArista(origen, destino, peso)', ret: 'void', jsig: 'void agregarArista(T origen, T destino, int peso)', desc: 'agrega los vértices que falten; si no es dirigido, en los dos sentidos' },
      { name: 'existeArista', sig: 'existeArista(origen, destino)', ret: 'boolean', jsig: 'boolean existeArista(T origen, T destino)' },
      { name: 'eliminarArista', sig: 'eliminarArista(origen, destino)', ret: 'void', jsig: 'void eliminarArista(T origen, T destino)' },
      { name: 'eliminarVertice', sig: 'eliminarVertice(dato)', ret: 'void', jsig: 'void eliminarVertice(T dato)', desc: 'también las aristas que llegan a él' },
      { name: 'adyacentes', sig: 'adyacentes(dato)', ret: 'dato[]', jsig: 'List<T> adyacentes(T dato)' },
      { name: 'gradoSalida', sig: 'gradoSalida(dato)', ret: 'number', jsig: 'int gradoSalida(T dato)', desc: 'en un no dirigido, el grado' },
      { name: 'gradoEntrada', sig: 'gradoEntrada(dato)', ret: 'number', jsig: 'int gradoEntrada(T dato)' },
      { name: 'cantidadVertices', sig: 'cantidadVertices()', ret: 'number', jsig: 'int cantidadVertices()' },
      { name: 'cantidadAristas', sig: 'cantidadAristas()', ret: 'number', jsig: 'int cantidadAristas()', desc: 'en un no dirigido cada arista cuenta una vez' },
    ],
  },
];

/* ---------- algoritmos ---------- */

Object.assign(JS_FUNCTIONS, {
  bfs: `// BFS (en anchura): visita por niveles desde el origen, usando una cola
function bfs(grafo, origen) {
  const orden = [];
  const inicio = grafo.buscarVertice(origen);
  if (inicio === null) return orden;
  for (const v of grafo.getVertices()) v.visitado = false;
  const cola = [inicio];
  inicio.visitado = true;
  while (cola.length > 0) {
    const actual = cola.shift();
    orden.push(actual.dato);
    for (const arista of actual.adyacentes) {
      const vecino = arista.destino;
      if (!vecino.visitado) {
        vecino.visitado = true;
        cola.push(vecino);
      }
    }
  }
  return orden;
}`,
  dfs: `// DFS (en profundidad): avanza todo lo que puede antes de volver atrás (recursivo)
function dfs(grafo, origen) {
  const orden = [];
  const inicio = grafo.buscarVertice(origen);
  if (inicio === null) return orden;
  for (const v of grafo.getVertices()) v.visitado = false;
  visitar(inicio, orden);
  return orden;
}

function visitar(vertice, orden) {
  vertice.visitado = true;
  orden.push(vertice.dato);
  for (const arista of vertice.adyacentes) {
    if (!arista.destino.visitado) visitar(arista.destino, orden);
  }
}`,
  existeCamino: `// ¿Se puede llegar de origen a destino siguiendo las aristas? (DFS con una pila)
function existeCamino(grafo, origen, destino) {
  const inicio = grafo.buscarVertice(origen);
  if (inicio === null) return false;
  for (const v of grafo.getVertices()) v.visitado = false;
  const pila = [inicio];
  while (pila.length > 0) {
    const actual = pila.pop();
    if (actual.dato === destino) return true;
    if (actual.visitado) continue;
    actual.visitado = true;
    for (const arista of actual.adyacentes) {
      if (!arista.destino.visitado) pila.push(arista.destino);
    }
  }
  return false;
}`,
  conexo: `// Conexo: desde un vértice se llega a todos.
// En un dirigido se pide que sea fuertemente conexo: desde cada vértice se llega a todos.
function esConexo(grafo) {
  const vertices = grafo.getVertices();
  for (const origen of vertices) {
    if (alcanzables(grafo, origen) < vertices.length) return false;
    // en un no dirigido alcanza con probar desde un vértice
    if (!grafo.esDirigido()) return true;
  }
  return true;
}

// cuántos vértices se alcanzan desde inicio (contándolo)
function alcanzables(grafo, inicio) {
  for (const v of grafo.getVertices()) v.visitado = false;
  const pila = [inicio];
  inicio.visitado = true;
  let cantidad = 0;
  while (pila.length > 0) {
    const actual = pila.pop();
    cantidad++;
    for (const arista of actual.adyacentes) {
      const vecino = arista.destino;
      if (!vecino.visitado) {
        vecino.visitado = true;
        pila.push(vecino);
      }
    }
  }
  return cantidad;
}`,
  componentes: `// Componentes conexas (no dirigido): cada DFS que arranca en un vértice sin visitar marca una componente entera
function contarComponentes(grafo) {
  for (const v of grafo.getVertices()) v.visitado = false;
  let componentes = 0;
  for (const v of grafo.getVertices()) {
    if (!v.visitado) {
      componentes++;
      marcar(v);
    }
  }
  return componentes;
}

function marcar(vertice) {
  vertice.visitado = true;
  for (const arista of vertice.adyacentes) {
    if (!arista.destino.visitado) marcar(arista.destino);
  }
}`,
  tieneCiclo: `// Dirigido: hay ciclo si el DFS llega a un vértice que sigue «en curso» (está en la pila de llamadas).
// No dirigido: hay ciclo si llega a un vértice ya visitado que no es desde donde vino.
function tieneCiclo(grafo) {
  const estado = new Map(); // dato → "en curso" o "terminado"
  for (const v of grafo.getVertices()) {
    if (!estado.has(v.dato) && cicloDesde(grafo, v, null, estado)) return true;
  }
  return false;
}

function cicloDesde(grafo, v, padre, estado) {
  estado.set(v.dato, "en curso");
  for (const arista of v.adyacentes) {
    const w = arista.destino;
    if (!grafo.esDirigido() && w === padre) continue;
    if (estado.get(w.dato) === "en curso") return true;
    if (!estado.has(w.dato) && cicloDesde(grafo, w, v, estado)) return true;
  }
  estado.set(v.dato, "terminado");
  return false;
}`,
  ordenTopologico: `// Orden topológico (Kahn): se van sacando los vértices sin aristas entrantes pendientes.
// Devuelve null si hay un ciclo (no existe orden topológico).
function ordenTopologico(grafo) {
  const entrantes = new Map();
  for (const v of grafo.getVertices()) entrantes.set(v.dato, 0);
  for (const v of grafo.getVertices()) {
    for (const arista of v.adyacentes) {
      const destino = arista.destino.dato;
      entrantes.set(destino, entrantes.get(destino) + 1);
    }
  }
  const cola = [];
  for (const v of grafo.getVertices()) {
    if (entrantes.get(v.dato) === 0) cola.push(v);
  }
  const orden = [];
  while (cola.length > 0) {
    const actual = cola.shift();
    orden.push(actual.dato);
    for (const arista of actual.adyacentes) {
      const destino = arista.destino.dato;
      entrantes.set(destino, entrantes.get(destino) - 1);
      if (entrantes.get(destino) === 0) cola.push(arista.destino);
    }
  }
  return orden.length === grafo.getVertices().length ? orden : null;
}`,
  dijkstra: `// Dijkstra: distancia mínima desde el origen a cada vértice (con pesos no negativos)
function dijkstra(grafo, origen) {
  const dist = new Map();
  for (const v of grafo.getVertices()) {
    dist.set(v.dato, Infinity);
    v.visitado = false;
  }
  if (!dist.has(origen)) return dist; // el origen no está: no se llega a ninguno
  dist.set(origen, 0);
  let actual = masCercano(grafo, dist);
  while (actual !== null) {
    actual.visitado = true;
    for (const arista of actual.adyacentes) {
      const vecino = arista.destino.dato;
      const nueva = dist.get(actual.dato) + arista.peso;
      if (nueva < dist.get(vecino)) dist.set(vecino, nueva);
    }
    actual = masCercano(grafo, dist);
  }
  return dist;
}

// el vértice sin visitar con menor distancia, o null si no queda ninguno alcanzable
function masCercano(grafo, dist) {
  let mejor = null;
  for (const v of grafo.getVertices()) {
    const d = dist.get(v.dato);
    if (!v.visitado && d < Infinity && (mejor === null || d < dist.get(mejor.dato))) mejor = v;
  }
  return mejor;
}`,
  prim: `// Prim: árbol de expansión mínima de un grafo no dirigido y conexo. Devuelve su peso total.
// Arranca en el primer vértice y en cada paso suma la arista más liviana que sale del árbol.
function prim(grafo) {
  const vertices = grafo.getVertices();
  if (vertices.length === 0) return 0;
  for (const v of vertices) v.visitado = false;
  vertices[0].visitado = true;
  let total = 0;
  for (let i = 1; i < vertices.length; i++) {
    let mejor = null;
    let desde = null;
    for (const v of vertices) {
      if (!v.visitado) continue;
      for (const arista of v.adyacentes) {
        if (!arista.destino.visitado && (mejor === null || arista.peso < mejor.peso)) {
          mejor = arista;
          desde = v;
        }
      }
    }
    if (mejor === null) break; // no es conexo: ningún árbol abarca a todos
    mejor.destino.visitado = true;
    total += mejor.peso;
    console.log(\`\${desde.dato} - \${mejor.destino.dato} (\${mejor.peso})\`);
  }
  return total;
}`,
});

Object.assign(JAVA_FUNCTIONS, {
  bfs: `// BFS (en anchura): visita por niveles desde el origen, usando una cola
static <T> List<T> bfs(Grafo<T> grafo, T origen) {
    List<T> orden = new ArrayList<>();
    Vertice<T> inicio = grafo.buscarVertice(origen);
    if (inicio == null) {
        return orden;
    }
    for (Vertice<T> v : grafo.getVertices()) {
        v.setVisitado(false);
    }
    Queue<Vertice<T>> cola = new LinkedList<>();
    cola.add(inicio);
    inicio.setVisitado(true);
    while (!cola.isEmpty()) {
        Vertice<T> actual = cola.poll();
        orden.add(actual.getDato());
        for (Arista<T> arista : actual.getAdyacentes()) {
            Vertice<T> vecino = arista.getDestino();
            if (!vecino.isVisitado()) {
                vecino.setVisitado(true);
                cola.add(vecino);
            }
        }
    }
    return orden;
}`,
  dfs: `// DFS (en profundidad): avanza todo lo que puede antes de volver atrás (recursivo)
static <T> List<T> dfs(Grafo<T> grafo, T origen) {
    List<T> orden = new ArrayList<>();
    Vertice<T> inicio = grafo.buscarVertice(origen);
    if (inicio == null) {
        return orden;
    }
    for (Vertice<T> v : grafo.getVertices()) {
        v.setVisitado(false);
    }
    visitar(inicio, orden);
    return orden;
}

static <T> void visitar(Vertice<T> vertice, List<T> orden) {
    vertice.setVisitado(true);
    orden.add(vertice.getDato());
    for (Arista<T> arista : vertice.getAdyacentes()) {
        if (!arista.getDestino().isVisitado()) {
            visitar(arista.getDestino(), orden);
        }
    }
}`,
  existeCamino: `// ¿Se puede llegar de origen a destino siguiendo las aristas? (DFS con una pila)
static <T> boolean existeCamino(Grafo<T> grafo, T origen, T destino) {
    Vertice<T> inicio = grafo.buscarVertice(origen);
    if (inicio == null) {
        return false;
    }
    for (Vertice<T> v : grafo.getVertices()) {
        v.setVisitado(false);
    }
    Stack<Vertice<T>> pila = new Stack<>();
    pila.push(inicio);
    while (!pila.isEmpty()) {
        Vertice<T> actual = pila.pop();
        if (actual.getDato().equals(destino)) {
            return true;
        }
        if (actual.isVisitado()) {
            continue;
        }
        actual.setVisitado(true);
        for (Arista<T> arista : actual.getAdyacentes()) {
            if (!arista.getDestino().isVisitado()) {
                pila.push(arista.getDestino());
            }
        }
    }
    return false;
}`,
  conexo: `// Conexo: desde un vértice se llega a todos.
// En un dirigido se pide que sea fuertemente conexo: desde cada vértice se llega a todos.
static <T> boolean esConexo(Grafo<T> grafo) {
    List<Vertice<T>> vertices = grafo.getVertices();
    for (Vertice<T> origen : vertices) {
        if (alcanzables(grafo, origen) < vertices.size()) {
            return false;
        }
        // en un no dirigido alcanza con probar desde un vértice
        if (!grafo.esDirigido()) {
            return true;
        }
    }
    return true;
}

// cuántos vértices se alcanzan desde inicio (contándolo)
static <T> int alcanzables(Grafo<T> grafo, Vertice<T> inicio) {
    for (Vertice<T> v : grafo.getVertices()) {
        v.setVisitado(false);
    }
    Stack<Vertice<T>> pila = new Stack<>();
    pila.push(inicio);
    inicio.setVisitado(true);
    int cantidad = 0;
    while (!pila.isEmpty()) {
        Vertice<T> actual = pila.pop();
        cantidad++;
        for (Arista<T> arista : actual.getAdyacentes()) {
            Vertice<T> vecino = arista.getDestino();
            if (!vecino.isVisitado()) {
                vecino.setVisitado(true);
                pila.push(vecino);
            }
        }
    }
    return cantidad;
}`,
  componentes: `// Componentes conexas (no dirigido): cada DFS que arranca en un vértice sin visitar marca una componente entera
static <T> int contarComponentes(Grafo<T> grafo) {
    for (Vertice<T> v : grafo.getVertices()) {
        v.setVisitado(false);
    }
    int componentes = 0;
    for (Vertice<T> v : grafo.getVertices()) {
        if (!v.isVisitado()) {
            componentes++;
            marcar(v);
        }
    }
    return componentes;
}

static <T> void marcar(Vertice<T> vertice) {
    vertice.setVisitado(true);
    for (Arista<T> arista : vertice.getAdyacentes()) {
        if (!arista.getDestino().isVisitado()) {
            marcar(arista.getDestino());
        }
    }
}`,
  tieneCiclo: `// Dirigido: hay ciclo si el DFS llega a un vértice que sigue «en curso» (está en la pila de llamadas).
// No dirigido: hay ciclo si llega a un vértice ya visitado que no es desde donde vino.
static <T> boolean tieneCiclo(Grafo<T> grafo) {
    Map<T, String> estado = new HashMap<>(); // dato → "en curso" o "terminado"
    for (Vertice<T> v : grafo.getVertices()) {
        if (!estado.containsKey(v.getDato()) && cicloDesde(grafo, v, null, estado)) {
            return true;
        }
    }
    return false;
}

static <T> boolean cicloDesde(Grafo<T> grafo, Vertice<T> v, Vertice<T> padre, Map<T, String> estado) {
    estado.put(v.getDato(), "en curso");
    for (Arista<T> arista : v.getAdyacentes()) {
        Vertice<T> w = arista.getDestino();
        if (!grafo.esDirigido() && w == padre) {
            continue;
        }
        if ("en curso".equals(estado.get(w.getDato()))) {
            return true;
        }
        if (!estado.containsKey(w.getDato()) && cicloDesde(grafo, w, v, estado)) {
            return true;
        }
    }
    estado.put(v.getDato(), "terminado");
    return false;
}`,
  ordenTopologico: `// Orden topológico (Kahn): se van sacando los vértices sin aristas entrantes pendientes.
// Devuelve null si hay un ciclo (no existe orden topológico).
static <T> List<T> ordenTopologico(Grafo<T> grafo) {
    Map<T, Integer> entrantes = new HashMap<>();
    for (Vertice<T> v : grafo.getVertices()) {
        entrantes.put(v.getDato(), 0);
    }
    for (Vertice<T> v : grafo.getVertices()) {
        for (Arista<T> arista : v.getAdyacentes()) {
            T destino = arista.getDestino().getDato();
            entrantes.put(destino, entrantes.get(destino) + 1);
        }
    }
    Queue<Vertice<T>> cola = new LinkedList<>();
    for (Vertice<T> v : grafo.getVertices()) {
        if (entrantes.get(v.getDato()) == 0) {
            cola.add(v);
        }
    }
    List<T> orden = new ArrayList<>();
    while (!cola.isEmpty()) {
        Vertice<T> actual = cola.poll();
        orden.add(actual.getDato());
        for (Arista<T> arista : actual.getAdyacentes()) {
            T destino = arista.getDestino().getDato();
            entrantes.put(destino, entrantes.get(destino) - 1);
            if (entrantes.get(destino) == 0) {
                cola.add(arista.getDestino());
            }
        }
    }
    if (orden.size() < grafo.getVertices().size()) {
        return null;
    }
    return orden;
}`,
  dijkstra: `// Dijkstra: distancia mínima desde el origen a cada vértice (con pesos no negativos).
// Integer.MAX_VALUE hace de «infinito» (todavía no se llegó).
static <T> Map<T, Integer> dijkstra(Grafo<T> grafo, T origen) {
    Map<T, Integer> dist = new HashMap<>();
    for (Vertice<T> v : grafo.getVertices()) {
        dist.put(v.getDato(), Integer.MAX_VALUE);
        v.setVisitado(false);
    }
    if (!dist.containsKey(origen)) {
        return dist; // el origen no está: no se llega a ninguno
    }
    dist.put(origen, 0);
    Vertice<T> actual = masCercano(grafo, dist);
    while (actual != null) {
        actual.setVisitado(true);
        for (Arista<T> arista : actual.getAdyacentes()) {
            T vecino = arista.getDestino().getDato();
            int nueva = dist.get(actual.getDato()) + arista.getPeso();
            if (nueva < dist.get(vecino)) {
                dist.put(vecino, nueva);
            }
        }
        actual = masCercano(grafo, dist);
    }
    return dist;
}

// el vértice sin visitar con menor distancia, o null si no queda ninguno alcanzable
static <T> Vertice<T> masCercano(Grafo<T> grafo, Map<T, Integer> dist) {
    Vertice<T> mejor = null;
    for (Vertice<T> v : grafo.getVertices()) {
        int d = dist.get(v.getDato());
        if (!v.isVisitado() && d < Integer.MAX_VALUE && (mejor == null || d < dist.get(mejor.getDato()))) {
            mejor = v;
        }
    }
    return mejor;
}`,
  prim: `// Prim: árbol de expansión mínima de un grafo no dirigido y conexo. Devuelve su peso total.
// Arranca en el primer vértice y en cada paso suma la arista más liviana que sale del árbol.
static <T> int prim(Grafo<T> grafo) {
    List<Vertice<T>> vertices = grafo.getVertices();
    if (vertices.isEmpty()) {
        return 0;
    }
    for (Vertice<T> v : vertices) {
        v.setVisitado(false);
    }
    vertices.get(0).setVisitado(true);
    int total = 0;
    for (int i = 1; i < vertices.size(); i++) {
        Arista<T> mejor = null;
        Vertice<T> desde = null;
        for (Vertice<T> v : vertices) {
            if (!v.isVisitado()) {
                continue;
            }
            for (Arista<T> arista : v.getAdyacentes()) {
                if (!arista.getDestino().isVisitado() && (mejor == null || arista.getPeso() < mejor.getPeso())) {
                    mejor = arista;
                    desde = v;
                }
            }
        }
        if (mejor == null) {
            break; // no es conexo: ningún árbol abarca a todos
        }
        mejor.getDestino().setVisitado(true);
        total += mejor.getPeso();
        System.out.println(desde.getDato() + " - " + mejor.getDestino().getDato() + " (" + mejor.getPeso() + ")");
    }
    return total;
}`,
});

/* ---------- funciones sueltas (recorren la lista de adyacencia directamente) ---------- */

const LLEGA_ALGUNA_JS = `// ¿Alguna arista del grafo llega a este vértice?
function llegaAlguna(grafo, vertice) {
  for (const v of grafo.getVertices()) {
    for (const arista of v.adyacentes) {
      if (arista.destino === vertice) return true;
    }
  }
  return false;
}`;

const LLEGA_ALGUNA_JAVA = `// ¿Alguna arista del grafo llega a este vértice?
static <T> boolean llegaAlguna(Grafo<T> grafo, Vertice<T> vertice) {
    for (Vertice<T> v : grafo.getVertices()) {
        for (Arista<T> arista : v.getAdyacentes()) {
            if (arista.getDestino() == vertice) {
                return true;
            }
        }
    }
    return false;
}`;

Object.assign(JS_FUNCTIONS, {
  g_contar: `// Cantidad de vértices del grafo
function contarVertices(grafo) {
  return grafo.getVertices().length;
}

// Cantidad de aristas: en un no dirigido cada arista está en las listas de sus dos vértices
function contarAristas(grafo) {
  let total = 0;
  for (const v of grafo.getVertices()) {
    total += v.adyacentes.length;
  }
  return grafo.esDirigido() ? total : total / 2;
}`,
  g_grado: `// Grado de un vértice: cuántas aristas salen de él (en un no dirigido, cuántos vecinos tiene).
// Devuelve -1 si el vértice no está.
function grado(grafo, dato) {
  const v = grafo.buscarVertice(dato);
  if (v === null) return -1;
  return v.adyacentes.length;
}

// El mayor grado entre todos los vértices (0 si el grafo está vacío)
function gradoMaximo(grafo) {
  let maximo = 0;
  for (const v of grafo.getVertices()) {
    maximo = Math.max(maximo, v.adyacentes.length);
  }
  return maximo;
}`,
  g_vecinos: `// Los datos de los vecinos de un vértice (a donde llegan sus aristas)
function vecinos(grafo, dato) {
  const resultado = [];
  const v = grafo.buscarVertice(dato);
  if (v === null) return resultado;
  for (const arista of v.adyacentes) {
    resultado.push(arista.destino.dato);
  }
  return resultado;
}

// Vértices aislados: no sale ninguna arista de ellos ni llega ninguna
function aislados(grafo) {
  const resultado = [];
  for (const v of grafo.getVertices()) {
    if (v.adyacentes.length === 0 && !llegaAlguna(grafo, v)) resultado.push(v.dato);
  }
  return resultado;
}

` + LLEGA_ALGUNA_JS,
  g_pesos: `// Suma de los pesos de todas las aristas (en un no dirigido, cada arista cuenta una vez)
function pesoTotal(grafo) {
  let total = 0;
  for (const v of grafo.getVertices()) {
    for (const arista of v.adyacentes) {
      total += arista.peso;
    }
  }
  return grafo.esDirigido() ? total : total / 2;
}

// El peso de la arista más liviana, o null si no hay aristas
function pesoMinimo(grafo) {
  let minimo = null;
  for (const v of grafo.getVertices()) {
    for (const arista of v.adyacentes) {
      if (minimo === null || arista.peso < minimo) minimo = arista.peso;
    }
  }
  return minimo;
}`,
  g_fuentes: `// Fuentes (dirigido): vértices a los que no llega ninguna arista
function fuentes(grafo) {
  const entrantes = new Map();
  for (const v of grafo.getVertices()) entrantes.set(v.dato, 0);
  for (const v of grafo.getVertices()) {
    for (const arista of v.adyacentes) {
      const destino = arista.destino.dato;
      entrantes.set(destino, entrantes.get(destino) + 1);
    }
  }
  const resultado = [];
  for (const v of grafo.getVertices()) {
    if (entrantes.get(v.dato) === 0) resultado.push(v.dato);
  }
  return resultado;
}

// Sumideros (dirigido): vértices de los que no sale ninguna arista
function sumideros(grafo) {
  const resultado = [];
  for (const v of grafo.getVertices()) {
    if (v.adyacentes.length === 0) resultado.push(v.dato);
  }
  return resultado;
}`,
  g_completo: `// Completo: cada vértice tiene una arista hacia cada uno de los demás
function esCompleto(grafo) {
  for (const v of grafo.getVertices()) {
    for (const otro of grafo.getVertices()) {
      if (otro !== v && !tieneAristaA(v, otro)) return false;
    }
  }
  return true;
}

// ¿Sale de v una arista que llega a otro?
function tieneAristaA(v, otro) {
  for (const arista of v.adyacentes) {
    if (arista.destino === otro) return true;
  }
  return false;
}`,
  g_bipartito: `// Bipartito (no dirigido): se pintan los vértices con dos colores sin que dos vecinos compartan color.
// BFS desde cada vértice sin color: cada vecino recibe el color contrario al del actual.
function esBipartito(grafo) {
  const color = new Map(); // dato → 0 o 1
  for (const inicio of grafo.getVertices()) {
    if (color.has(inicio.dato)) continue;
    color.set(inicio.dato, 0);
    const cola = [inicio];
    while (cola.length > 0) {
      const actual = cola.shift();
      for (const arista of actual.adyacentes) {
        const vecino = arista.destino;
        if (!color.has(vecino.dato)) {
          color.set(vecino.dato, 1 - color.get(actual.dato));
          cola.push(vecino);
        } else if (color.get(vecino.dato) === color.get(actual.dato)) {
          return false;
        }
      }
    }
  }
  return true;
}`,
  g_camino: `// Camino más corto (en cantidad de aristas) de origen a destino, con BFS. null si no hay camino.
// «padre» guarda desde qué vértice se llegó a cada uno; al final el camino se arma hacia atrás.
function caminoMasCorto(grafo, origen, destino) {
  const inicio = grafo.buscarVertice(origen);
  if (inicio === null || grafo.buscarVertice(destino) === null) return null;
  const padre = new Map();
  padre.set(origen, null);
  const cola = [inicio];
  while (cola.length > 0) {
    const actual = cola.shift();
    if (actual.dato === destino) break;
    for (const arista of actual.adyacentes) {
      const vecino = arista.destino;
      if (!padre.has(vecino.dato)) {
        padre.set(vecino.dato, actual.dato);
        cola.push(vecino);
      }
    }
  }
  if (!padre.has(destino)) return null;
  const camino = [];
  for (let paso = destino; paso !== null; paso = padre.get(paso)) {
    camino.unshift(paso);
  }
  return camino;
}`,
  g_modificar: `// Saca del grafo los vértices aislados. Devuelve cuántos sacó.
function eliminarAislados(grafo) {
  const vertices = grafo.getVertices();
  let sacados = 0;
  for (let i = vertices.length - 1; i >= 0; i--) {
    const v = vertices[i];
    if (v.adyacentes.length === 0 && !llegaAlguna(grafo, v)) {
      vertices.splice(i, 1);
      sacados++;
    }
  }
  return sacados;
}

` + LLEGA_ALGUNA_JS + `

// Invierte el sentido de todas las aristas (grafo transpuesto). En un no dirigido queda igual.
function invertir(grafo) {
  const origenes = [];
  const aristas = [];
  for (const v of grafo.getVertices()) {
    for (const arista of v.adyacentes) {
      origenes.push(v);
      aristas.push(arista);
    }
    v.adyacentes = [];
  }
  for (let i = 0; i < aristas.length; i++) {
    aristas[i].destino.adyacentes.push(new Arista(origenes[i], aristas[i].peso));
  }
}`,
});

Object.assign(JAVA_FUNCTIONS, {
  g_contar: `// Cantidad de vértices del grafo
static <T> int contarVertices(Grafo<T> grafo) {
    return grafo.getVertices().size();
}

// Cantidad de aristas: en un no dirigido cada arista está en las listas de sus dos vértices
static <T> int contarAristas(Grafo<T> grafo) {
    int total = 0;
    for (Vertice<T> v : grafo.getVertices()) {
        total += v.getAdyacentes().size();
    }
    return grafo.esDirigido() ? total : total / 2;
}`,
  g_grado: `// Grado de un vértice: cuántas aristas salen de él (en un no dirigido, cuántos vecinos tiene).
// Devuelve -1 si el vértice no está.
static <T> int grado(Grafo<T> grafo, T dato) {
    Vertice<T> v = grafo.buscarVertice(dato);
    if (v == null) {
        return -1;
    }
    return v.getAdyacentes().size();
}

// El mayor grado entre todos los vértices (0 si el grafo está vacío)
static <T> int gradoMaximo(Grafo<T> grafo) {
    int maximo = 0;
    for (Vertice<T> v : grafo.getVertices()) {
        maximo = Math.max(maximo, v.getAdyacentes().size());
    }
    return maximo;
}`,
  g_vecinos: `// Los datos de los vecinos de un vértice (a donde llegan sus aristas)
static <T> List<T> vecinos(Grafo<T> grafo, T dato) {
    List<T> resultado = new ArrayList<>();
    Vertice<T> v = grafo.buscarVertice(dato);
    if (v == null) {
        return resultado;
    }
    for (Arista<T> arista : v.getAdyacentes()) {
        resultado.add(arista.getDestino().getDato());
    }
    return resultado;
}

// Vértices aislados: no sale ninguna arista de ellos ni llega ninguna
static <T> List<T> aislados(Grafo<T> grafo) {
    List<T> resultado = new ArrayList<>();
    for (Vertice<T> v : grafo.getVertices()) {
        if (v.getAdyacentes().isEmpty() && !llegaAlguna(grafo, v)) {
            resultado.add(v.getDato());
        }
    }
    return resultado;
}

` + LLEGA_ALGUNA_JAVA,
  g_pesos: `// Suma de los pesos de todas las aristas (en un no dirigido, cada arista cuenta una vez)
static <T> int pesoTotal(Grafo<T> grafo) {
    int total = 0;
    for (Vertice<T> v : grafo.getVertices()) {
        for (Arista<T> arista : v.getAdyacentes()) {
            total += arista.getPeso();
        }
    }
    return grafo.esDirigido() ? total : total / 2;
}

// El peso de la arista más liviana, o null si no hay aristas
static <T> Integer pesoMinimo(Grafo<T> grafo) {
    Integer minimo = null;
    for (Vertice<T> v : grafo.getVertices()) {
        for (Arista<T> arista : v.getAdyacentes()) {
            if (minimo == null || arista.getPeso() < minimo) {
                minimo = arista.getPeso();
            }
        }
    }
    return minimo;
}`,
  g_fuentes: `// Fuentes (dirigido): vértices a los que no llega ninguna arista
static <T> List<T> fuentes(Grafo<T> grafo) {
    Map<T, Integer> entrantes = new HashMap<>();
    for (Vertice<T> v : grafo.getVertices()) {
        entrantes.put(v.getDato(), 0);
    }
    for (Vertice<T> v : grafo.getVertices()) {
        for (Arista<T> arista : v.getAdyacentes()) {
            T destino = arista.getDestino().getDato();
            entrantes.put(destino, entrantes.get(destino) + 1);
        }
    }
    List<T> resultado = new ArrayList<>();
    for (Vertice<T> v : grafo.getVertices()) {
        if (entrantes.get(v.getDato()) == 0) {
            resultado.add(v.getDato());
        }
    }
    return resultado;
}

// Sumideros (dirigido): vértices de los que no sale ninguna arista
static <T> List<T> sumideros(Grafo<T> grafo) {
    List<T> resultado = new ArrayList<>();
    for (Vertice<T> v : grafo.getVertices()) {
        if (v.getAdyacentes().isEmpty()) {
            resultado.add(v.getDato());
        }
    }
    return resultado;
}`,
  g_completo: `// Completo: cada vértice tiene una arista hacia cada uno de los demás
static <T> boolean esCompleto(Grafo<T> grafo) {
    for (Vertice<T> v : grafo.getVertices()) {
        for (Vertice<T> otro : grafo.getVertices()) {
            if (otro != v && !tieneAristaA(v, otro)) {
                return false;
            }
        }
    }
    return true;
}

// ¿Sale de v una arista que llega a otro?
static <T> boolean tieneAristaA(Vertice<T> v, Vertice<T> otro) {
    for (Arista<T> arista : v.getAdyacentes()) {
        if (arista.getDestino() == otro) {
            return true;
        }
    }
    return false;
}`,
  g_bipartito: `// Bipartito (no dirigido): se pintan los vértices con dos colores sin que dos vecinos compartan color.
// BFS desde cada vértice sin color: cada vecino recibe el color contrario al del actual.
static <T> boolean esBipartito(Grafo<T> grafo) {
    Map<T, Integer> color = new HashMap<>(); // dato → 0 o 1
    for (Vertice<T> inicio : grafo.getVertices()) {
        if (color.containsKey(inicio.getDato())) {
            continue;
        }
        color.put(inicio.getDato(), 0);
        Queue<Vertice<T>> cola = new LinkedList<>();
        cola.add(inicio);
        while (!cola.isEmpty()) {
            Vertice<T> actual = cola.poll();
            for (Arista<T> arista : actual.getAdyacentes()) {
                Vertice<T> vecino = arista.getDestino();
                if (!color.containsKey(vecino.getDato())) {
                    color.put(vecino.getDato(), 1 - color.get(actual.getDato()));
                    cola.add(vecino);
                } else if (color.get(vecino.getDato()).equals(color.get(actual.getDato()))) {
                    return false;
                }
            }
        }
    }
    return true;
}`,
  g_camino: `// Camino más corto (en cantidad de aristas) de origen a destino, con BFS. null si no hay camino.
// «padre» guarda desde qué vértice se llegó a cada uno; al final el camino se arma hacia atrás.
static <T> List<T> caminoMasCorto(Grafo<T> grafo, T origen, T destino) {
    Vertice<T> inicio = grafo.buscarVertice(origen);
    if (inicio == null || grafo.buscarVertice(destino) == null) {
        return null;
    }
    Map<T, T> padre = new HashMap<>();
    padre.put(origen, null);
    Queue<Vertice<T>> cola = new LinkedList<>();
    cola.add(inicio);
    while (!cola.isEmpty()) {
        Vertice<T> actual = cola.poll();
        if (actual.getDato().equals(destino)) {
            break;
        }
        for (Arista<T> arista : actual.getAdyacentes()) {
            Vertice<T> vecino = arista.getDestino();
            if (!padre.containsKey(vecino.getDato())) {
                padre.put(vecino.getDato(), actual.getDato());
                cola.add(vecino);
            }
        }
    }
    if (!padre.containsKey(destino)) {
        return null;
    }
    List<T> camino = new ArrayList<>();
    for (T paso = destino; paso != null; paso = padre.get(paso)) {
        camino.add(0, paso);
    }
    return camino;
}`,
  g_modificar: `// Saca del grafo los vértices aislados. Devuelve cuántos sacó.
static <T> int eliminarAislados(Grafo<T> grafo) {
    List<Vertice<T>> vertices = grafo.getVertices();
    int sacados = 0;
    for (int i = vertices.size() - 1; i >= 0; i--) {
        Vertice<T> v = vertices.get(i);
        if (v.getAdyacentes().isEmpty() && !llegaAlguna(grafo, v)) {
            vertices.remove(i);
            sacados++;
        }
    }
    return sacados;
}

` + LLEGA_ALGUNA_JAVA + `

// Invierte el sentido de todas las aristas (grafo transpuesto). En un no dirigido queda igual.
static <T> void invertir(Grafo<T> grafo) {
    List<Vertice<T>> origenes = new ArrayList<>();
    List<Arista<T>> aristas = new ArrayList<>();
    for (Vertice<T> v : grafo.getVertices()) {
        for (Arista<T> arista : v.getAdyacentes()) {
            origenes.add(v);
            aristas.add(arista);
        }
        v.getAdyacentes().clear();
    }
    for (int i = 0; i < aristas.size(); i++) {
        Arista<T> arista = aristas.get(i);
        arista.getDestino().getAdyacentes().add(new Arista<>(origenes.get(i), arista.getPeso()));
    }
}`,
});

const GRAPH_FN_TASK = {
  js: `// Completá las funciones. «grafo» es el grafo dibujado (la clase Grafo ya viene incluida).
// Cada vértice tiene v.dato, v.adyacentes (sus aristas) y v.visitado; cada arista, arista.destino y arista.peso.
// Los vértices y sus aristas están en orden creciente, así que el resultado coincide con el panel de Dibujar.
`,
  java: `// Completá los métodos. «grafo» es el grafo dibujado (la clase Grafo<T> ya viene incluida).
// Vertice<T>: getDato(), getAdyacentes(), isVisitado()/setVisitado(b). Arista<T>: getDestino(), getPeso().
// Los vértices y sus aristas están en orden creciente, así que el resultado coincide con el panel de Dibujar.
import java.util.*;
`,
};

const GRAPH_BLANK = {
  js: `// Escribí tus propias funciones (o clases).
// «grafo» es el grafo dibujado y la clase Grafo ya viene incluida: grafo.getVertices(), grafo.buscarVertice(dato),
// grafo.agregarArista(origen, destino, peso)… Cada Vertice tiene dato, adyacentes y visitado; cada Arista, destino y peso.
// Si definís tu propia clase Grafo, reemplaza a la incluida.

function miFuncion(grafo) {
  // Tu código acá
  throw new Error("No implementado");
}
`,
  java: `// Escribí tus propios métodos (los sueltos van con static) o clases.
// «grafo» es el grafo dibujado y la clase Grafo<T> ya viene incluida: getVertices(), buscarVertice(dato),
// agregarArista(origen, destino, peso)… Vertice<T>: getDato(), getAdyacentes(), isVisitado(). Arista<T>: getDestino(), getPeso().
// Si definís tu propia clase Grafo, reemplaza a la incluida.
import java.util.*;

static int miMetodo(Grafo<Integer> grafo) {
    // Tu código acá
    throw new UnsupportedOperationException("No implementado");
}
`,
};

/*
 * En los grafos, {v} y {w} de las llamadas se reemplazan por el primer y el último vértice del dibujo.
 * «drawing» es el ejemplo del lienzo pensado para probar cada ejercicio (botón «Grafo de ejemplo»).
 */
EXERCISES.push(
  { id: 'grafo', space: 'graph', group: 'Grafos: estructura', name: 'Grafo · lista de adyacencia', kind: 'classes', cls: 'Grafo', tag: 'Grafo', provides: [], drawing: 'ponderado', call: { js: 'grafo.adyacentes({v})', java: 'grafo.adyacentes({v})' } },
  ...[
    ['g-contar', 'Contar vértices y aristas', ['g_contar'], 'contarAristas(grafo)', 'ciclos'],
    ['g-grado', 'Grado y grado máximo', ['g_grado'], 'grado(grafo, {v})', 'ciclos'],
    ['g-vecinos', 'Vecinos y vértices aislados', ['g_vecinos'], 'vecinos(grafo, {v})', 'aislados'],
    ['g-pesos', 'Peso total y arista más liviana', ['g_pesos'], 'pesoTotal(grafo)', 'ponderado'],
    ['g-fuentes', 'Fuentes y sumideros (dirigido)', ['g_fuentes'], 'fuentes(grafo)', 'dag'],
    ['g-completo', '¿Es completo?', ['g_completo'], 'esCompleto(grafo)', 'completo'],
    ['g-bipartito', '¿Es bipartito?', ['g_bipartito'], 'esBipartito(grafo)', 'bipartito'],
    ['g-camino', 'Camino más corto (BFS)', ['g_camino'], 'caminoMasCorto(grafo, {v}, {w})', 'ciclos'],
    ['g-modificar', 'Modificar: quitar aislados e invertir', ['g_modificar'], 'invertir(grafo)', 'aislados'],
  ].map(([id, name, fns, call, drawing]) => ({
    id, space: 'graph', group: 'Grafos: funciones sueltas', name, kind: 'functions', fns, provides: ['Grafo'], drawing, call: { js: call, java: call },
  })),
  ...[
    ['recorridos', 'BFS y DFS', ['bfs', 'dfs'], 'bfs(grafo, {v})', 'ciclos'],
    ['camino', 'Existe camino', ['existeCamino'], 'existeCamino(grafo, {v}, {w})', 'bosque'],
    ['conexo', 'Conexo y componentes', ['conexo', 'componentes'], 'esConexo(grafo)', 'bosque'],
    ['ciclos', 'Tiene ciclo', ['tieneCiclo'], 'tieneCiclo(grafo)', 'dirigido'],
    ['topologico', 'Orden topológico (DAG)', ['ordenTopologico'], 'ordenTopologico(grafo)', 'dag'],
    ['dijkstra', 'Dijkstra (caminos mínimos)', ['dijkstra'], 'dijkstra(grafo, {v})', 'ponderado'],
    ['prim', 'Prim (árbol de expansión mínima)', ['prim'], 'prim(grafo)', 'ponderado'],
  ].map(([id, name, fns, call, drawing]) => ({
    id, space: 'graph', group: 'Grafos: algoritmos', name, kind: 'functions', fns, provides: ['Grafo'], drawing, call: { js: call, java: call },
  })),
  { id: 'blanco-grafo', space: 'graph', group: 'Libre', name: 'Hoja en blanco', kind: 'free', provides: ['Grafo'], drawing: 'ponderado', call: { js: 'miFuncion(grafo)', java: 'miMetodo(grafo)' } },
);
