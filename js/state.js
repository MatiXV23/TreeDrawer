/* Estado del lienzo con historial (deshacer/rehacer) y persistencia local. */

const Store = (() => {
  const KEY = 'treedrawer:state:v1';
  const LIMIT = 200;

  let state = { nodes: [], edges: [], nextId: 1 };
  let undoStack = [];
  let redoStack = [];
  let listener = () => {};

  function sanitize(raw) {
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
    const seen = new Set();
    const edges = [];
    for (const e of Array.isArray(raw?.edges) ? raw.edges : []) {
      const from = String(e?.from ?? ''), to = String(e?.to ?? '');
      const key = `${from}>${to}`;
      if (from === to || !ids.has(from) || !ids.has(to) || seen.has(key)) continue;
      seen.add(key);
      edges.push({ from, to });
    }
    const maxId = Math.max(0, ...nodes.map(n => parseInt(n.id.replace(/\D/g, ''), 10) || 0));
    return { nodes, edges, nextId: Math.max(maxId + 1, +raw?.nextId || 1) };
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sin almacenamiento */ }
  }

  function restore() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = sanitize(JSON.parse(raw));
    } catch { /* datos corruptos o sin acceso */ }
  }

  function checkpoint() {
    undoStack.push(JSON.stringify(state));
    if (undoStack.length > LIMIT) undoStack.shift();
    redoStack = [];
  }

  /** Aplica un cambio guardando un punto de deshacer. */
  function mutate(fn) {
    checkpoint();
    const out = fn(state);
    commit();
    return out;
  }

  /** Notifica un cambio intermedio (arrastre, animación) sin persistir. */
  function touch() { listener(); }

  function commit() { persist(); listener(); }

  function undo() {
    if (!undoStack.length) return false;
    redoStack.push(JSON.stringify(state));
    state = JSON.parse(undoStack.pop());
    commit();
    return true;
  }

  function redo() {
    if (!redoStack.length) return false;
    undoStack.push(JSON.stringify(state));
    state = JSON.parse(redoStack.pop());
    commit();
    return true;
  }

  function replace(next) {
    checkpoint();
    state = sanitize(next);
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
    if (from === to) return 'Un nodo no puede ser hijo de sí mismo.';
    if (s.edges.some(e => e.from === from && e.to === to)) return 'Esa conexión ya existe.';
    if (isAncestor(s, to, from)) return 'Esa conexión formaría un ciclo.';
    return null;
  }

  /** Conecta padre → hijo; si el hijo ya tenía padre, lo reemplaza. */
  function link(s, from, to) {
    const replaced = s.edges.some(e => e.to === to);
    s.edges = s.edges.filter(e => e.to !== to);
    s.edges.push({ from, to });
    return replaced;
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
    get state() { return state; },
    node: id => state.nodes.find(n => n.id === id) || null,
    setListener(fn) { listener = fn; },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    restore, checkpoint, mutate, touch, commit, undo, redo, replace,
    addNode, removeNodes, linkError, link, descendants,
  };
})();
