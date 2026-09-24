/*
 * Árboles de ejemplo.
 * binary:  [valor, izquierdo, derecho]  (null = sin hijo)
 * general: [valor, [hijos...]]
 */
const EXAMPLES = [
  { id: 'avl', name: 'AVL', binary: [40, [20, [10], [30, [25]]], [60, [50], [70, null, [80]]]] },
  { id: 'perfect', name: 'AVL perfecto', binary: [4, [2, [1], [3]], [6, [5], [7]]] },
  { id: 'abb', name: 'ABB no balanceado', binary: [50, [30, [20, [10]], [40]], [70]] },
  { id: 'degenerate', name: 'ABB degenerado', binary: [10, null, [20, null, [30, null, [40]]]] },
  { id: 'ab', name: 'AB (no es ABB)', binary: [8, [3, [1], [12]], [10, null, [14]]] },
  { id: 'ag', name: 'Árbol general', general: ['A', [['B', [['E'], ['F']]], ['C'], ['D', [['G'], ['H'], ['I']]]]] },
];

function buildExample(ex) {
  const nodes = [], edges = [];
  let next = 1;
  const make = (value, x, y, parent) => {
    const n = { id: 'n' + next++, value: String(value), x, y };
    nodes.push(n);
    if (parent) edges.push({ from: parent.id, to: n.id });
    return n;
  };

  if (ex.binary) {
    (function rec(spec, x, y, parent) {
      if (!spec) return;
      const n = make(spec[0], x, y, parent);
      rec(spec[1], x - 1, y + 1, n);
      rec(spec[2], x + 1, y + 1, n);
    })(ex.binary, 0, 0, null);
  } else {
    (function rec(spec, x, y, parent) {
      const n = make(spec[0], x, y, parent);
      (spec[1] || []).forEach((c, i) => rec(c, x + i, y + 1, n));
    })(ex.general, 0, 0, null);
  }

  const pos = computeLayout(nodes, edges);
  for (const n of nodes) Object.assign(n, pos.get(n.id));
  return { nodes, edges, nextId: next };
}
