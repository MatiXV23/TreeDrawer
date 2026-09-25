/*
 * Estado del lienzo con historial (deshacer/rehacer) y persistencia local.
 * Hay dos espacios de trabajo independientes, cada uno con su dibujo e historial:
 * «tree» (árboles: aristas padre → hijo) y «graph» (grafos: dirigidos o no, con pesos opcionales).
 */

const Store = (() => {
  const KEYS = { tree: 'treedrawer:state:v1', graph: 'treedrawer:graph:v1' };
  const LIMIT = 200;

  const blank = kind => (kind === 'graph'
    ? { nodes: [], edges: [], nextId: 1, directed: false, weighted: false }
    : { nodes: [], edges: [], nextId: 1 });

  const spaces = {
    tree: { state: blank('tree'), undo: [], redo: [] },
    graph: { state: blank('graph'), undo: [], redo: [] },
  };
  let kind = 'tree';
  let ws = spaces.tree;
  let listener = () => {};

  const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  function sanitize(raw, k = kind) {
    const nodes = [];
    const ids = new Set();
    for (const n of Array.isArray(raw?.nodes) ? raw.nodes : []) {
      const id = String(n?.id ?? '');
      if (!id || ids.has(id)) continue;
      ids.add(id);
      nodes.push({
        id,
        value: String(n.value ?? '').slice(0, 12),
        x: Number.isFinite(+n.x) ? +n.x : 0,
        y: Number.isFinite(+n.y) ? +n.y : 0,
      });
    }
    const graph = k === 'graph';
    const directed = graph && !!raw?.directed;
    const seen = new Set();
    const edges = [];
    for (const e of Array.isArray(raw?.edges) ? raw.edges : []) {
      const from = String(e?.from ?? ''), to = String(e?.to ?? '');
      // En un grafo no dirigido A–B y B–A son la misma arista.
      const key = graph && !directed ? pairKey(from, to) : `${from}>${to}`;
      if (from === to || !ids.has(from) || !ids.has(to) || seen.has(key)) continue;
      seen.add(key);
      if (graph) edges.push({ from, to, w: Number.isFinite(+e.w) ? Math.trunc(+e.w) : 1 });
      else edges.push({ from, to });
    }
    const maxId = Math.max(0, ...nodes.map(n => parseInt(n.id.replace(/\D/g, ''), 10) || 0));
    const out = { nodes, edges, nextId: Math.max(maxId + 1, +raw?.nextId || 1) };
    if (graph) Object.assign(out, { directed, weighted: !!raw?.weighted });
    return out;
  }

  function persist() {
    try { localStorage.setItem(KEYS[kind], JSON.stringify(ws.state)); } catch { /* sin almacenamiento */ }
  }

  function restore() {
    for (const k of Object.keys(spaces)) {
      try {
        const raw = localStorage.getItem(KEYS[k]);
        if (raw) spaces[k].state = sanitize(JSON.parse(raw), k);
      } catch { /* datos corruptos o sin acceso */ }
    }
  }

  /** Cambia de espacio de trabajo (árbol o grafo); cada uno conserva su dibujo e historial. */
  function setKind(k) {
    if (!spaces[k] || k === kind) return;
    kind = k;
    ws = spaces[k];
    listener();
  }

  function checkpoint() {
    ws.undo.push(JSON.stringify(ws.state));
    if (ws.undo.length > LIMIT) ws.undo.shift();
    ws.redo = [];
  }

  /** Aplica un cambio guardando un punto de deshacer. */
  function mutate(fn) {
    checkpoint();
    const out = fn(ws.state);
    commit();
    return out;
  }

  /** Notifica un cambio intermedio (arrastre, animación) sin persistir. */
  function touch() { listener(); }

  function commit() { persist(); listener(); }

  function undo() {
    if (!ws.undo.length) return false;
    ws.redo.push(JSON.stringify(ws.state));
    ws.state = JSON.parse(ws.undo.pop());
    commit();
    return true;
  }

  function redo() {
    if (!ws.redo.length) return false;
    ws.undo.push(JSON.stringify(ws.state));
    ws.state = JSON.parse(ws.redo.pop());
    commit();
    return true;
  }

  function replace(next) {
    checkpoint();
    ws.state = sanitize(next);
    commit();
  }

  // ---- operaciones sobre un estado ----

  function addNode(s, x, y, value) {
    const n = { id: 'n' + s.nextId++, value: String(value).slice(0, 12), x, y };
    s.nodes.push(n);
    return n;
  }

  function removeNodes(s, ids) {
    const set = new Set(ids);
    s.nodes = s.nodes.filter(n => !set.has(n.id));
    s.edges = s.edges.filter(e => !set.has(e.from) && !set.has(e.to));
  }

  /** ¿`a` es ancestro de `b` (o el mismo nodo)? */
  function isAncestor(s, a, b) {
    const seen = new Set();
    const stack = [b];
    while (stack.length) {
      const cur = stack.pop();
      if (cur === a) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const e of s.edges) if (e.to === cur) stack.push(e.from);
    }
    return false;
  }

  /** Devuelve un mensaje de error si no se puede conectar, o null. */
  function linkError(s, from, to) {
    if (kind === 'graph') {
      if (from === to) return 'Un vértice no puede conectarse consigo mismo (no se admiten lazos).';
      const dup = s.edges.some(e => (e.from === from && e.to === to) || (!s.directed && e.from === to && e.to === from));
      return dup ? 'Esa arista ya existe.' : null;
    }
    if (from === to) return 'Un nodo no puede ser hijo de sí mismo.';
    if (s.edges.some(e => e.from === from && e.to === to)) return 'Esa conexión ya existe.';
    if (isAncestor(s, to, from)) return 'Esa conexión formaría un ciclo.';
    return null;
  }

  /**
   * Árbol: conecta padre → hijo; si el hijo ya tenía padre, lo reemplaza (devuelve true).
   * Grafo: agrega la arista con peso 1.
   */
  function link(s, from, to) {
    if (kind === 'graph') {
      s.edges.push({ from, to, w: 1 });
      return false;
    }
    const replaced = s.edges.some(e => e.to === to);
    s.edges = s.edges.filter(e => e.to !== to);
    s.edges.push({ from, to });
    return replaced;
  }

  /** Grafo: pasa a dirigido o a no dirigido. Al quitar el sentido, A→B y B→A se unen. Devuelve cuántas se unieron. */
  function setDirected(s, directed) {
    s.directed = directed;
    if (directed) return 0;
    const seen = new Set();
    const before = s.edges.length;
    s.edges = s.edges.filter(e => {
      const k = pairKey(e.from, e.to);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return before - s.edges.length;
  }

  function descendants(s, id) {
    const out = [];
    const stack = [id];
    const seen = new Set();
    while (stack.length) {
      const cur = stack.pop();
      if (seen.has(cur)) continue;
      seen.add(cur);
      out.push(cur);
      for (const e of s.edges) if (e.from === cur) stack.push(e.to);
    }
    return out;
  }

  return {
    get state() { return ws.state; },
    get kind() { return kind; },
    node: id => ws.state.nodes.find(n => n.id === id) || null,
    setListener(fn) { listener = fn; },
    canUndo: () => ws.undo.length > 0,
    canRedo: () => ws.redo.length > 0,
    restore, setKind, checkpoint, mutate, touch, commit, undo, redo, replace,
    addNode, removeNodes, linkError, link, setDirected, descendants,
  };
})();
