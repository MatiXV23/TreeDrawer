/*
 * Grafos: análisis del dibujo (conexidad, ciclos, bipartición, completitud…), recorridos
 * para el panel (BFS, DFS, Dijkstra, orden topológico), distribución automática y ejemplos.
 * Los vecinos se recorren siempre en orden creciente de su valor, igual que la lista de
 * adyacencia que recibe el código en el modo Programar.
 */

const GRAPH_KIND_INFO = {
  G_EMPTY: { short: '—', title: 'Lienzo vacío', desc: 'Creá vértices y conectalos para armar un grafo.' },
  TREE: { short: 'Árbol', title: 'Árbol', desc: 'Grafo conexo y sin ciclos: tiene exactamente V − 1 aristas.' },
  FOREST: { short: 'Bosque', title: 'Bosque', desc: 'No tiene ciclos pero no es conexo: cada componente es un árbol.' },
  CONN: { short: 'Conexo', title: 'Grafo conexo', desc: 'Todos los vértices están conectados y hay al menos un ciclo.' },
  DISC: { short: 'No conexo', title: 'Grafo no conexo', desc: 'Tiene más de una componente y al menos un ciclo.' },
  DAG: { short: 'DAG', title: 'Dirigido acíclico (DAG)', desc: 'No tiene ciclos dirigidos, así que admite un orden topológico.' },
  STRONG: { short: 'F. conexo', title: 'Dirigido fuertemente conexo', desc: 'Desde cada vértice se llega a todos los demás siguiendo el sentido de las aristas.' },
  DIG: { short: 'Dirigido', title: 'Grafo dirigido', desc: 'Tiene ciclos y no es fuertemente conexo.' },
};

/** Orden de los vértices por su valor (numérico si todos son números); a igual valor, por id. */
function vertexComparator(nodes) {
  const numeric = nodes.length > 0 && nodes.every(n => NUMERIC_RE.test(keyOf(n)));
  const cmp = makeComparator(numeric);
  return { numeric, cmp: (a, b) => cmp(keyOf(a), keyOf(b)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) };
}

/**
 * Listas de adyacencia del dibujo. En un grafo no dirigido cada arista aparece en los dos
 * vértices (como en la lista de adyacencia que se programa).
 */
function graphModel(nodes, edges, directed) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const { numeric, cmp } = vertexComparator(nodes);
  const order = [...nodes].sort(cmp).map(n => n.id);
  const rank = new Map(order.map((id, i) => [id, i]));
  const out = new Map(order.map(id => [id, []]));
  const inc = new Map(order.map(id => [id, []]));
  const weight = new Map();
  for (const e of edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue;
    const w = e.w ?? 1;
    out.get(e.from).push(e.to);
    inc.get(e.to).push(e.from);
    weight.set(`${e.from}>${e.to}`, w);
    if (!directed) {
      out.get(e.to).push(e.from);
      inc.get(e.from).push(e.to);
      weight.set(`${e.to}>${e.from}`, w);
    }
  }
  const byRank = (a, b) => rank.get(a) - rank.get(b);
  out.forEach(l => l.sort(byRank));
  inc.forEach(l => l.sort(byRank));
  return { byId, order, rank, out, inc, weight, numeric, directed };
}

function analyzeGraph(s) {
  const nodes = s.nodes, edges = s.edges;
  const directed = !!s.directed, weighted = !!s.weighted;
  const m = graphModel(nodes, edges, directed);
  const show = id => keyOf(m.byId.get(id)) || '∅';
  const list = ids => ids.map(id => `«${show(id)}»`).join(', ');
  const res = {
    graph: true,
    kind: 'G_EMPTY',
    directed,
    weighted,
    rows: [],
    reasons: [],
    notes: [],
    tags: [],
    flagged: new Map(),
    info: new Map(),
    stats: null,
    model: m,
    components: [],
    root: null,
  };
  if (!nodes.length) return res;
  const V = nodes.length, E = edges.length;
  const reason = (text, ids = [], level) => res.reasons.push({ text, ids, level });

  // Valores: para programar, cada vértice necesita un dato propio.
  const byKey = new Map();
  for (const id of m.order) {
    const k = keyOf(m.byId.get(id));
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(id);
  }
  for (const [k, ids] of byKey) {
    if (k === '') {
      reason(`${ids.length === 1 ? 'Hay un vértice' : `Hay ${ids.length} vértices`} sin valor.`, ids, 'warn');
      ids.forEach(id => res.flagged.set(id, 'warn'));
    } else if (ids.length > 1) {
      reason(`«${k}» está repetido en ${ids.length} vértices: cada vértice tiene que tener un valor distinto.`, ids, 'warn');
      ids.forEach(id => res.flagged.set(id, 'warn'));
    }
  }

  // Componentes, ignorando el sentido de las aristas.
  const und = new Map(m.order.map(id => [id, [...new Set([...m.out.get(id), ...m.inc.get(id)])].sort((a, b) => m.rank.get(a) - m.rank.get(b))]));
  const comp = new Map();
  for (const start of m.order) {
    if (comp.has(start)) continue;
    const members = [start];
    comp.set(start, res.components.length);
    for (let i = 0; i < members.length; i++) {
      for (const w of und.get(members[i])) if (!comp.has(w)) { comp.set(w, res.components.length); members.push(w); }
    }
    res.components.push(members);
  }
  const connected = res.components.length === 1;

  // Un ciclo (si hay), como lista de vértices que empieza y termina en el mismo.
  let cycle = null;
  {
    const state = new Map(); // 1 = en curso, 2 = terminado
    const path = [];
    const dfs = (v, parent) => {
      state.set(v, 1);
      path.push(v);
      for (const w of m.out.get(v)) {
        if (!directed && w === parent) continue;
        if (state.get(w) === 1) { cycle = [...path.slice(path.indexOf(w)), w]; return true; }
        if (!state.has(w) && dfs(w, v)) return true;
      }
      path.pop();
      state.set(v, 2);
      return false;
    };
    for (const id of m.order) if (!state.has(id) && dfs(id, null)) break;
  }
  const acyclic = !cycle;
  const arrow = directed ? ' → ' : ' – ';
  const cycleText = cycle ? `Tiene un ciclo: ${cycle.map(show).join(arrow)}.` : '';

  const degree = id => m.out.get(id).length;
  const inDeg = id => m.inc.get(id).length;
  for (const id of m.order) {
    res.info.set(id, directed
      ? { in: inDeg(id), out: degree(id), comp: comp.get(id) }
      : { deg: degree(id), comp: comp.get(id) });
  }

  const componentsText = () => res.components.map(c => `{${c.map(show).join(', ')}}`).join(' ');
  const isolated = m.order.filter(id => und.get(id).length === 0);

  // ¿Completo? Cada par de vértices adyacente (en dirigidos, en los dos sentidos).
  let missing = null;
  for (let i = 0; i < m.order.length && !missing; i++) {
    for (let j = 0; j < m.order.length && !missing; j++) {
      if (i === j || (!directed && j < i)) continue;
      const a = m.order[i], b = m.order[j];
      if (!m.weight.has(`${a}>${b}`)) missing = [a, b];
    }
  }
  const complete = !missing;

  if (directed) {
    // Fuertemente conexo (Kosaraju): cuántas componentes fuertes hay.
    const done = new Set(), finish = [];
    const dfs1 = v => { done.add(v); for (const w of m.out.get(v)) if (!done.has(w)) dfs1(w); finish.push(v); };
    m.order.forEach(v => { if (!done.has(v)) dfs1(v); });
    const scc = new Map();
    let count = 0;
    const dfs2 = v => { scc.set(v, count); for (const w of m.inc.get(v)) if (!scc.has(w)) dfs2(w); };
    for (let i = finish.length - 1; i >= 0; i--) if (!scc.has(finish[i])) { dfs2(finish[i]); count++; }
    const strong = count === 1;
    const reach = (start, adj) => {
      const seen = new Set([start]);
      const st = [start];
      while (st.length) for (const w of adj.get(st.pop())) if (!seen.has(w)) { seen.add(w); st.push(w); }
      return seen;
    };

    // Árbol con raíz (arborescencia): una sola raíz sin entrantes, el resto con una entrante.
    const roots = m.order.filter(id => inDeg(id) === 0);
    const multi = m.order.filter(id => inDeg(id) > 1);
    const fromRoot = roots.length === 1 ? reach(roots[0], m.out) : null;
    const arbo = roots.length === 1 && !multi.length && fromRoot.size === V;
    if (arbo) res.root = roots[0];

    res.rows = [
      { label: 'Débilmente conexo', hint: 'Conexo si se ignora el sentido de las aristas', value: connected },
      { label: 'Fuertemente conexo', hint: 'Hay camino de ida y vuelta entre cada par', value: strong },
      { label: 'Acíclico (DAG)', hint: 'No tiene ciclos dirigidos', value: acyclic },
      { label: 'Árbol con raíz', hint: 'Una raíz sin entrantes; el resto, una entrante cada uno', value: arbo },
      { label: 'Completo', hint: 'Arista en los dos sentidos entre cada par', value: complete },
    ];
    if (!connected) reason(`Tiene ${res.components.length} partes separadas: ${componentsText()}.`, res.components[1]);
    if (connected && !strong) {
      const r = m.order[0];
      const ahead = reach(r, m.out);
      const lost = m.order.find(id => !ahead.has(id));
      if (lost) reason(`Desde «${show(r)}» no se llega a «${show(lost)}» siguiendo las flechas.`, [lost]);
      else {
        const back = reach(r, m.inc);
        const stuck = m.order.find(id => !back.has(id));
        reason(`Desde «${show(stuck)}» no se puede volver a «${show(r)}».`, [stuck]);
      }
    }
    if (cycle) reason(cycleText, cycle.slice(0, -1));
    if (!arbo && V > 1) {
      if (roots.length !== 1) reason(roots.length ? `Para ser un árbol con raíz, un solo vértice puede no tener entrantes; acá hay ${roots.length}: ${list(roots)}.` : 'Ningún vértice está libre de aristas entrantes, así que no hay raíz.', roots);
      else if (multi.length) reason(`${list(multi)} ${multi.length === 1 ? 'tiene' : 'tienen'} más de una arista entrante.`, multi);
    }
    const sources = roots.length, sinks = m.order.filter(id => degree(id) === 0).length;
    res.stats = { vertices: V, edges: E, components: res.components.length, scc: count, sources, sinks };
    res.kind = acyclic ? 'DAG' : strong ? 'STRONG' : 'DIG';
    if (strong && V > 1) res.notes.push('Al ser fuertemente conexo, entre cualquier par de vértices hay camino en los dos sentidos.');
  } else {
    // Bipartito: se pinta con dos colores por BFS.
    const color = new Map();
    let clash = null;
    for (const start of m.order) {
      if (color.has(start) || clash) continue;
      color.set(start, 0);
      const q = [start];
      for (let i = 0; i < q.length && !clash; i++) {
        for (const w of m.out.get(q[i])) {
          if (!color.has(w)) { color.set(w, 1 - color.get(q[i])); q.push(w); }
          else if (color.get(w) === color.get(q[i])) { clash = [q[i], w]; break; }
        }
      }
    }
    const tree = connected && acyclic;
    res.rows = [
      { label: 'Conexo', hint: 'Hay un camino entre cada par de vértices', value: connected },
      { label: 'Acíclico', hint: 'No tiene ciclos', value: acyclic },
      { label: 'Es un árbol', hint: 'Conexo y acíclico (A = V − 1)', value: tree },
      { label: 'Bipartito', hint: 'Se pinta con 2 colores sin vecinos iguales', value: !clash },
      { label: 'Completo', hint: 'Cada par de vértices es adyacente', value: complete },
    ];
    if (!connected) {
      reason(`Tiene ${res.components.length} componentes: ${componentsText()}.`, res.components[1]);
      if (isolated.length) reason(`${list(isolated)} ${isolated.length === 1 ? 'está aislado' : 'están aislados'} (grado 0).`, isolated, 'warn');
    }
    if (cycle) reason(cycleText, cycle.slice(0, -1));
    if (clash) reason(`No es bipartito: «${show(clash[0])}» y «${show(clash[1])}» son vecinos y quedarían del mismo color (hay un ciclo impar).`, clash);
    const degs = m.order.map(degree);
    const maxDeg = Math.max(...degs), minDeg = Math.min(...degs);
    res.stats = { vertices: V, edges: E, components: res.components.length, maxDeg, minDeg };
    if (complete && V > 1) res.tags.push({ label: `K${V}`, hint: `Grafo completo de ${V} vértices: tiene ${V * (V - 1) / 2} aristas.` });
    else if (V > 1 && maxDeg === minDeg) res.tags.push({ label: `Regular de grado ${maxDeg}`, hint: 'Todos los vértices tienen el mismo grado.' });
    if (connected && E > 0) {
      const odd = degs.filter(d => d % 2).length;
      if (odd === 0) res.tags.push({ label: 'Euleriano', hint: 'Tiene un circuito que pasa una sola vez por cada arista: todos los grados son pares.' });
      else if (odd === 2) res.tags.push({ label: 'Camino euleriano', hint: 'Hay un recorrido que usa cada arista una vez, entre los dos vértices de grado impar.' });
    }
    res.kind = tree ? 'TREE' : acyclic ? 'FOREST' : connected ? 'CONN' : 'DISC';
    if (tree) res.notes.push('Si le agregás cualquier arista se forma un ciclo; si le quitás una, deja de ser conexo.');
  }

  if (weighted && edges.some(e => (e.w ?? 1) < 0)) {
    res.notes.push('Hay pesos negativos: Dijkstra no garantiza el camino mínimo (hace falta Bellman-Ford).');
  }
  return res;
}

/** Recorridos desde `origin` para el panel. */
function graphTraversals(a, origin) {
  const m = a.model;
  const show = id => keyOf(m.byId.get(id)) || '∅';
  if (!m.order.length) return null;
  const start = m.byId.has(origin) ? origin : m.order[0];

  const bfs = [start], level = new Map([[start, 0]]);
  for (let i = 0; i < bfs.length; i++) {
    for (const w of m.out.get(bfs[i])) if (!level.has(w)) { level.set(w, level.get(bfs[i]) + 1); bfs.push(w); }
  }
  const dfs = [], seen = new Set();
  (function visit(v) {
    seen.add(v);
    dfs.push(v);
    for (const w of m.out.get(v)) if (!seen.has(w)) visit(w);
  })(start);

  let dist = null;
  if (a.weighted) {
    const d = new Map(m.order.map(id => [id, Infinity]));
    const done = new Set();
    d.set(start, 0);
    for (;;) {
      let best = null;
      for (const id of m.order) if (!done.has(id) && d.get(id) < Infinity && (best === null || d.get(id) < d.get(best))) best = id;
      if (best === null) break;
      done.add(best);
      for (const w of m.out.get(best)) {
        const nd = d.get(best) + m.weight.get(`${best}>${w}`);
        if (nd < d.get(w)) d.set(w, nd);
      }
    }
    dist = m.order.map(id => [show(id), d.get(id)]);
  } else {
    dist = m.order.map(id => [show(id), level.has(id) ? level.get(id) : Infinity]);
  }

  let topo = null;
  if (a.directed && a.kind === 'DAG') {
    const indeg = new Map(m.order.map(id => [id, m.inc.get(id).length]));
    const q = m.order.filter(id => indeg.get(id) === 0);
    topo = [];
    for (let i = 0; i < q.length; i++) {
      topo.push(q[i]);
      for (const w of m.out.get(q[i])) {
        indeg.set(w, indeg.get(w) - 1);
        if (indeg.get(w) === 0) q.push(w);
      }
    }
  }
  return {
    origin: start,
    originLabel: show(start),
    bfs: bfs.map(show),
    dfs: dfs.map(show),
    dist,
    topo: topo && topo.map(show),
  };
}

/** Distribución automática por fuerzas (Fruchterman–Reingold), determinística. */
function layoutGraph(nodes, edges) {
  const pos = new Map();
  const n = nodes.length;
  if (!n) return pos;
  const { cmp } = vertexComparator(nodes);
  const sorted = [...nodes].sort(cmp);
  const k = 120;
  const radius = Math.max(k, (k * n) / (2 * Math.PI));
  const P = sorted.map((_, i) => {
    const t = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return { x: radius * Math.cos(t), y: radius * Math.sin(t) };
  });
  const idx = new Map(sorted.map((nd, i) => [nd.id, i]));
  const links = edges.filter(e => idx.has(e.from) && idx.has(e.to)).map(e => [idx.get(e.from), idx.get(e.to)]);
  const ITER = 320;
  for (let it = 0; it < ITER; it++) {
    const D = P.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = P[i].x - P[j].x, dy = P[i].y - P[j].y;
        let d = Math.hypot(dx, dy);
        if (d < 0.01) { dx = 0.01 * (i - j); dy = 0.01; d = Math.hypot(dx, dy); }
        const f = (k * k) / d;
        D[i].x += (dx / d) * f; D[i].y += (dy / d) * f;
        D[j].x -= (dx / d) * f; D[j].y -= (dy / d) * f;
      }
    }
    for (const [a, b] of links) {
      const dx = P[a].x - P[b].x, dy = P[a].y - P[b].y;
      const d = Math.max(Math.hypot(dx, dy), 0.01);
      const f = (d * d) / k;
      D[a].x -= (dx / d) * f; D[a].y -= (dy / d) * f;
      D[b].x += (dx / d) * f; D[b].y += (dy / d) * f;
    }
    const temp = 60 * (1 - it / ITER) + 1;
    for (let i = 0; i < n; i++) {
      D[i].x -= P[i].x * 0.05;
      D[i].y -= P[i].y * 0.05;
      const d = Math.hypot(D[i].x, D[i].y);
      if (d > 0) {
        P[i].x += (D[i].x / d) * Math.min(d, temp);
        P[i].y += (D[i].y / d) * Math.min(d, temp);
      }
    }
  }
  // Se conserva el centro del dibujo actual.
  const cx = (Math.min(...nodes.map(p => p.x)) + Math.max(...nodes.map(p => p.x))) / 2;
  const cy = (Math.min(...nodes.map(p => p.y)) + Math.max(...nodes.map(p => p.y))) / 2;
  const nx = (Math.min(...P.map(p => p.x)) + Math.max(...P.map(p => p.x))) / 2;
  const ny = (Math.min(...P.map(p => p.y)) + Math.max(...P.map(p => p.y))) / 2;
  sorted.forEach((nd, i) => pos.set(nd.id, { x: Math.round(P[i].x - nx + cx), y: Math.round(P[i].y - ny + cy) }));
  return pos;
}

/*
 * Grafos de ejemplo: vértices [valor, x, y] y aristas [origen, destino, peso?].
 */
const GRAPH_EXAMPLES = [
  {
    id: 'ponderado', name: 'Ponderado (caminos mínimos)', directed: false, weighted: true,
    nodes: [['A', 0, 80], ['B', 160, 0], ['C', 160, 170], ['D', 330, 0], ['E', 330, 170], ['F', 480, 85]],
    edges: [['A', 'B', 4], ['A', 'C', 2], ['B', 'C', 1], ['B', 'D', 5], ['C', 'D', 8], ['C', 'E', 10], ['D', 'E', 2], ['D', 'F', 6], ['E', 'F', 3]],
  },
  {
    id: 'ciclos', name: 'No dirigido con ciclos', directed: false, weighted: false,
    nodes: [[1, 0, 0], [2, -130, 100], [3, 130, 100], [4, -200, 220], [5, -70, 220], [6, 70, 220], [7, 200, 220]],
    edges: [[1, 2], [1, 3], [2, 4], [2, 5], [3, 6], [3, 7], [5, 6], [6, 7]],
  },
  {
    id: 'arbol', name: 'Árbol (conexo y acíclico)', directed: false, weighted: false,
    nodes: [[1, 0, 0], [2, -120, 100], [3, 120, 100], [4, -190, 210], [5, -60, 210], [6, 120, 210]],
    edges: [[1, 2], [1, 3], [2, 4], [2, 5], [3, 6]],
  },
  {
    id: 'bosque', name: 'No conexo (dos componentes)', directed: false, weighted: false,
    nodes: [[1, 0, 0], [2, -90, 110], [3, 90, 110], [4, 0, 220], [5, 260, 30], [6, 260, 170], [7, 380, 100]],
    edges: [[1, 2], [1, 3], [2, 4], [3, 4], [5, 6], [6, 7]],
  },
  {
    id: 'dag', name: 'Dirigido acíclico (DAG)', directed: true, weighted: false,
    nodes: [['A', 0, 0], ['B', 0, 160], ['C', 160, 0], ['D', 160, 160], ['E', 320, 40], ['F', 320, 200], ['G', 480, 110]],
    edges: [['A', 'C'], ['B', 'C'], ['B', 'D'], ['C', 'E'], ['D', 'E'], ['D', 'F'], ['E', 'G'], ['F', 'G']],
  },
  {
    id: 'dirigido', name: 'Dirigido con ciclos', directed: true, weighted: true,
    nodes: [[1, 0, 90], [2, 150, 0], [3, 150, 180], [4, 320, 180], [5, 470, 180], [6, 470, 20]],
    edges: [[1, 2, 7], [2, 3, 2], [3, 1, 4], [3, 4, 3], [4, 5, 1], [5, 4, 6], [5, 6, 2], [2, 6, 9]],
  },
  {
    id: 'aislados', name: 'Dirigido con vértices aislados', directed: true, weighted: false,
    nodes: [['A', 0, 90], ['B', 150, 0], ['C', 150, 180], ['D', 300, 90], ['E', 450, 90], ['F', 90, 300], ['G', 330, 300]],
    edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D'], ['D', 'E']],
  },
  {
    id: 'bipartito', name: 'Bipartito (K3,3)', directed: false, weighted: false,
    nodes: [[1, 0, 0], [2, 150, 0], [3, 300, 0], [4, 0, 180], [5, 150, 180], [6, 300, 180]],
    edges: [[1, 4], [1, 5], [1, 6], [2, 4], [2, 5], [2, 6], [3, 4], [3, 5], [3, 6]],
  },
  {
    id: 'completo', name: 'Completo (K5)', directed: false, weighted: false,
    nodes: [1, 2, 3, 4, 5].map((v, i) => {
      const t = -Math.PI / 2 + (2 * Math.PI * i) / 5;
      return [v, Math.round(150 * Math.cos(t)), Math.round(150 * Math.sin(t))];
    }),
    edges: [[1, 2], [1, 3], [1, 4], [1, 5], [2, 3], [2, 4], [2, 5], [3, 4], [3, 5], [4, 5]],
  },
];

function buildGraphExample(ex) {
  const ids = new Map();
  const nodes = ex.nodes.map(([v, x, y], i) => {
    const id = 'n' + (i + 1);
    ids.set(String(v), id);
    return { id, value: String(v), x, y };
  });
  const edges = ex.edges.map(([a, b, w]) => ({ from: ids.get(String(a)), to: ids.get(String(b)), w: w ?? 1 }));
  return { nodes, edges, nextId: nodes.length + 1, directed: ex.directed, weighted: ex.weighted };
}
