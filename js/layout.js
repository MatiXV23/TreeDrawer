/* Distribución automática de nodos. */

const LAYOUT_H = 64;
const LAYOUT_V = 90;

/**
 * Calcula posiciones para todos los árboles del lienzo.
 * Si todos los nodos tienen ≤ 2 hijos se usa un recorrido inorden (respeta
 * izquierda/derecha); si no, cada padre queda centrado sobre sus hijos.
 * Mantiene la esquina superior izquierda del dibujo actual.
 */
function computeLayout(nodes, edges) {
  const { byId, kids, parents, left, right } = childStructure(nodes, edges);
  const binary = [...kids.values()].every(k => k.length <= 2);
  const pos = new Map();
  const visited = new Set();
  let cursor = 0;

  function inorder(id, d) {
    if (visited.has(id)) return;
    visited.add(id);
    const l = left(id), r = right(id);
    if (l !== null) inorder(l, d + 1);
    pos.set(id, { x: cursor++ * LAYOUT_H, y: d * LAYOUT_V });
    if (r !== null) inorder(r, d + 1);
  }

  function tidy(id, d) {
    visited.add(id);
    const ks = kids.get(id).filter(k => !visited.has(k));
    ks.forEach(k => { if (!visited.has(k)) tidy(k, d + 1); });
    const xs = ks.filter(k => pos.has(k)).map(k => pos.get(k).x);
    if (!xs.length) pos.set(id, { x: cursor++ * LAYOUT_H, y: d * LAYOUT_V });
    else pos.set(id, { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: d * LAYOUT_V });
  }

  const roots = nodes.filter(n => !parents.has(n.id)).sort((a, b) => a.x - b.x);
  for (const r of roots) {
    binary ? inorder(r.id, 0) : tidy(r.id, 0);
    cursor += 1; // separación entre árboles
  }

  const placed = [...pos.keys()].map(id => byId.get(id));
  if (placed.length) {
    const oldX = Math.min(...placed.map(n => n.x)), oldY = Math.min(...placed.map(n => n.y));
    const newX = Math.min(...[...pos.values()].map(p => p.x)), newY = Math.min(...[...pos.values()].map(p => p.y));
    for (const p of pos.values()) { p.x += oldX - newX; p.y += oldY - newY; }
  }
  return pos;
}

/** Posiciones para una estructura binaria explícita {id, l, r}, con la raíz en `anchor`. */
function layoutBinaryStruct(root, anchor) {
  const pos = new Map();
  let cursor = 0;
  (function walk(t, d) {
    if (!t) return;
    walk(t.l, d + 1);
    pos.set(t.id, { x: cursor++ * LAYOUT_H, y: d * LAYOUT_V });
    walk(t.r, d + 1);
  })(root, 0);
  if (root && anchor) {
    const r = pos.get(root.id);
    const dx = anchor.x - r.x, dy = anchor.y - r.y;
    for (const p of pos.values()) { p.x += dx; p.y += dy; }
  }
  return pos;
}

/**
 * Posiciones para estructuras explícitas (usado mientras corre un programa).
 * `roots[0]` es la raíz principal y queda en `anchor`; las demás (nodos sueltos)
 * se ubican a su derecha. Tolera ciclos y nodos con dos padres.
 */
function layoutExplicit(roots, kidsOf, binary, anchor) {
  const pos = new Map();
  const seen = new Set();
  let cursor = 0;

  function bin(id, d) {
    if (id == null || seen.has(id)) return;
    seen.add(id);
    const [l, r] = kidsOf(id);
    bin(l, d + 1);
    pos.set(id, { x: cursor++ * LAYOUT_H, y: d * LAYOUT_V });
    bin(r, d + 1);
  }

  function gen(id, d) {
    seen.add(id);
    const ks = kidsOf(id).filter(k => k != null && !seen.has(k));
    ks.forEach(k => { if (!seen.has(k)) gen(k, d + 1); });
    const xs = ks.filter(k => pos.has(k)).map(k => pos.get(k).x);
    pos.set(id, { x: xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : cursor++ * LAYOUT_H, y: d * LAYOUT_V });
  }

  roots.forEach((r, i) => {
    if (seen.has(r)) return;
    if (i > 0) cursor += 1;
    binary ? bin(r, 0) : gen(r, 0);
  });

  if (roots.length && pos.has(roots[0]) && anchor) {
    const r = pos.get(roots[0]);
    const dx = anchor.x - r.x, dy = anchor.y - r.y;
    for (const p of pos.values()) { p.x += dx; p.y += dy; }
  }
  return pos;
}
