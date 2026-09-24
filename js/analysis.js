/*
 * Clasificación del grafo dibujado.
 * Jerarquía: AVL ⊂ ABB ⊂ AB ⊂ AG. Se informa la clase más específica
 * y los motivos por los que no alcanza la siguiente.
 */

const NUMERIC_RE = /^[-+]?(\d+(\.\d*)?|\.\d+)(e[-+]?\d+)?$/i;

const KIND_INFO = {
  EMPTY: { short: '—', title: 'Lienzo vacío', desc: 'Creá nodos y conectalos para armar un árbol.' },
  NONE: { short: '✕', title: 'No es un árbol', desc: 'El grafo no cumple la definición de árbol.' },
  AG: { short: 'AG', title: 'Árbol general', desc: 'Es un árbol, pero algún nodo tiene más de dos hijos.' },
  AB: { short: 'AB', title: 'Árbol binario', desc: 'Cada nodo tiene a lo sumo dos hijos, pero no respeta el orden de búsqueda.' },
  ABB: { short: 'ABB', title: 'Árbol binario de búsqueda', desc: 'Respeta izquierda < nodo < derecha, pero no está balanceado en altura.' },
  AVL: { short: 'AVL', title: 'Árbol AVL', desc: 'Es un ABB y en cada nodo las alturas de sus subárboles difieren como mucho en 1.' },
};

function keyOf(node) {
  return String(node?.value ?? '').trim();
}

/** Número con signo tipográfico: +2, −1, 0. */
function signed(n) {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
}

function makeComparator(numeric) {
  return numeric
    ? (a, b) => Number(a) - Number(b)
    : (a, b) => a.localeCompare(b, 'es', { numeric: true });
}

/**
 * Hijos de cada nodo ordenados por posición horizontal, y lado de cada hijo
 * cuando el padre tiene como mucho dos: con un único hijo el lado lo decide
 * su posición respecto del padre; con dos, el de más a la izquierda es el izquierdo.
 */
function childStructure(nodes, edges) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const kids = new Map(nodes.map(n => [n.id, []]));
  const parents = new Map();
  for (const e of edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue;
    kids.get(e.from).push(e.to);
    if (!parents.has(e.to)) parents.set(e.to, []);
    parents.get(e.to).push(e.from);
  }
  const sides = new Map();
  for (const [id, list] of kids) {
    list.sort((a, b) => byId.get(a).x - byId.get(b).x);
    if (list.length === 1) sides.set(list[0], byId.get(list[0]).x < byId.get(id).x ? 'L' : 'R');
    else if (list.length === 2) { sides.set(list[0], 'L'); sides.set(list[1], 'R'); }
  }
  const childOn = (id, side) => (kids.get(id) || []).find(k => sides.get(k) === side) ?? null;
  return { byId, kids, parents, sides, left: id => childOn(id, 'L'), right: id => childOn(id, 'R') };
}

function analyzeTree(nodes, edges) {
  const structure = childStructure(nodes, edges);
  const { byId, kids, parents, left, right } = structure;
  const show = id => keyOf(byId.get(id)) || '∅';

  const res = {
    kind: 'EMPTY',
    checks: { tree: null, ab: null, abb: null, balanced: null },
    reasons: [],
    notes: [],
    flagged: new Map(),
    info: new Map(),
    tags: [],
    stats: null,
    traversals: null,
    structure,
    root: null,
    numeric: true,
  };
  if (!nodes.length) return res;

  const finish = (kind, reasons) => {
    res.kind = kind;
    res.reasons = reasons;
    for (const r of reasons) for (const id of r.ids) res.flagged.set(id, r.level || 'error');
    return res;
  };

  // 1. ¿Es un árbol? Una sola raíz, un solo padre por nodo, todo alcanzable.
  const treeReasons = [];
  for (const [id, ps] of parents) {
    if (ps.length > 1) {
      treeReasons.push({ text: `«${show(id)}» tiene ${ps.length} padres (${ps.map(show).join(', ')}); en un árbol cada nodo tiene uno solo.`, ids: [id] });
    }
  }
  const roots = nodes.filter(n => !parents.has(n.id)).map(n => n.id);
  if (!roots.length) {
    treeReasons.push({ text: 'No hay raíz: todos los nodos tienen padre, así que hay un ciclo.', ids: [] });
  } else if (roots.length > 1) {
    treeReasons.push({
      text: `Hay ${roots.length} nodos sin padre (${roots.map(show).join(', ')}). Un árbol tiene una única raíz: conectalos o eliminá los que sobran.`,
      ids: roots,
      level: 'warn',
    });
  }

  const depth = new Map();
  const order = []; // BFS
  if (roots.length === 1 && !treeReasons.length) {
    depth.set(roots[0], 0);
    order.push(roots[0]);
    for (let i = 0; i < order.length; i++) {
      for (const k of kids.get(order[i])) {
        if (depth.has(k)) continue;
        depth.set(k, depth.get(order[i]) + 1);
        order.push(k);
      }
    }
    const lost = nodes.filter(n => !depth.has(n.id)).map(n => n.id);
    if (lost.length) {
      treeReasons.push({ text: `${lost.map(id => `«${show(id)}»`).join(', ')} forman un ciclo desconectado de la raíz.`, ids: lost });
    }
  }

  res.checks.tree = treeReasons.length === 0;
  if (!res.checks.tree) {
    res.stats = { nodes: nodes.length, edges: edges.length };
    return finish('NONE', treeReasons);
  }

  const root = roots[0];
  res.root = root;

  const height = new Map();
  for (let i = order.length - 1; i >= 0; i--) {
    const ks = kids.get(order[i]);
    height.set(order[i], ks.length ? 1 + Math.max(...ks.map(k => height.get(k))) : 1);
  }
  // Misma convención que Nodo.altura: una hoja tiene altura 1 y el árbol vacío, 0.
  const h = id => (id === null ? 0 : height.get(id));

  // 2. ¿Binario?
  const abReasons = [];
  for (const id of order) {
    const k = kids.get(id).length;
    if (k > 2) abReasons.push({ text: `«${show(id)}» tiene ${k} hijos; en un árbol binario cada nodo tiene como máximo 2.`, ids: [id] });
  }
  const isAB = abReasons.length === 0;
  res.checks.ab = isAB;

  for (const id of order) {
    res.info.set(id, {
      depth: depth.get(id),
      height: height.get(id),
      children: kids.get(id).length,
      side: structure.sides.get(id) ?? null,
      bf: isAB ? h(left(id)) - h(right(id)) : null,
    });
  }

  const pre = [], post = [], inorder = [];
  (function walk(id) {
    pre.push(show(id));
    if (isAB) {
      const l = left(id), r = right(id);
      if (l !== null) walk(l);
      inorder.push(show(id));
      if (r !== null) walk(r);
    } else {
      kids.get(id).forEach(walk);
    }
    post.push(show(id));
  })(root);
  res.traversals = { pre, in: isAB ? inorder : null, post, level: order.map(show) };

  const leaves = order.filter(id => !kids.get(id).length).length;
  res.stats = {
    nodes: nodes.length,
    edges: edges.length,
    height: height.get(root),
    leaves,
    internal: nodes.length - leaves,
    degree: Math.max(...order.map(id => kids.get(id).length)),
    root: show(root),
  };

  if (!isAB) return finish('AG', abReasons);

  // 3. ¿ABB? Cada nodo acotado por sus ancestros.
  const abbReasons = [];
  const empties = order.filter(id => keyOf(byId.get(id)) === '');
  if (empties.length) {
    abbReasons.push({ text: `${empties.length === 1 ? 'Hay un nodo' : `Hay ${empties.length} nodos`} sin valor; para comparar claves todos necesitan uno.`, ids: empties });
  }
  const numeric = order.every(id => NUMERIC_RE.test(keyOf(byId.get(id))));
  res.numeric = numeric;
  if (!numeric && !empties.length) res.notes.push('Los valores no son todos numéricos: se comparan como texto.');
  if (!empties.length) {
    const cmp = makeComparator(numeric);
    const stack = [[root, null, null]];
    while (stack.length) {
      const [id, lo, hi] = stack.pop();
      const v = keyOf(byId.get(id));
      let problem = null;
      if (lo !== null) {
        const c = cmp(v, keyOf(byId.get(lo)));
        if (c === 0) problem = `«${v}» está repetido (también aparece como ancestro); un ABB no admite claves repetidas.`;
        else if (c < 0) problem = `«${v}» está en el subárbol derecho de «${show(lo)}», pero es menor.`;
      }
      if (!problem && hi !== null) {
        const c = cmp(v, keyOf(byId.get(hi)));
        if (c === 0) problem = `«${v}» está repetido (también aparece como ancestro); un ABB no admite claves repetidas.`;
        else if (c > 0) problem = `«${v}» está en el subárbol izquierdo de «${show(hi)}», pero es mayor.`;
      }
      if (problem) abbReasons.push({ text: problem, ids: [id] });
      const l = left(id), r = right(id);
      if (r !== null) stack.push([r, id, hi]);
      if (l !== null) stack.push([l, lo, id]);
    }
  }
  const isABB = abbReasons.length === 0;
  res.checks.abb = isABB;

  // 4. ¿Balanceado en altura?
  const balReasons = [];
  for (const id of order) {
    const bf = res.info.get(id).bf;
    if (Math.abs(bf) > 1) {
      balReasons.push({
        text: `«${show(id)}» tiene factor de balance ${signed(bf)} (altura izq ${h(left(id))}, der ${h(right(id))}); debe estar entre −1 y +1.`,
        ids: [id],
      });
    }
  }
  const balanced = balReasons.length === 0;
  res.checks.balanced = balanced;

  // Propiedades adicionales de árboles binarios.
  const full = order.every(id => kids.get(id).length !== 1);
  const leafDepths = new Set(order.filter(id => !kids.get(id).length).map(id => depth.get(id)));
  let complete = true;
  {
    const q = [root];
    let gap = false;
    for (let i = 0; i < q.length; i++) {
      if (q[i] === null) { gap = true; continue; }
      if (gap) { complete = false; break; }
      q.push(left(q[i]), right(q[i]));
    }
  }
  if (full && leafDepths.size === 1) res.tags.push({ label: 'Perfecto', hint: 'Todas las hojas al mismo nivel y cada nodo interno con 2 hijos.' });
  else {
    if (complete) res.tags.push({ label: 'Completo', hint: 'Todos los niveles llenos salvo el último, que se llena de izquierda a derecha.' });
    if (full) res.tags.push({ label: 'Lleno', hint: 'Cada nodo tiene 0 o 2 hijos.' });
  }
  if (nodes.length >= 3 && order.every(id => kids.get(id).length <= 1)) {
    res.tags.push({ label: 'Degenerado', hint: 'Cada nodo tiene a lo sumo un hijo: es una lista.' });
  }

  if (!isABB) {
    if (balanced) res.notes.push('Está balanceado en altura: si respetara el orden de búsqueda, sería AVL.');
    return finish('AB', abbReasons);
  }
  if (!balanced) return finish('ABB', balReasons);
  return finish('AVL', []);
}
