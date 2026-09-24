/* TreeDrawer — lienzo interactivo y panel de clasificación. */
(() => {
  'use strict';

  const R = 24;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const $ = sel => document.querySelector(sel);

  const svg = $('#canvas');
  const world = $('#world');
  const edgesG = $('#edges');
  const nodesG = $('#nodes');
  const ghostG = $('#ghost');
  const gridPattern = $('#gridPattern');
  const editor = $('#nodeEditor');
  const emptyState = $('#emptyState');
  const panel = $('#panel');

  // ---------- preferencias ----------
  const PREFS_KEY = 'treedrawer:prefs:v1';
  const prefs = Object.assign({ metrics: false, sides: true, theme: null }, readJSON(PREFS_KEY));
  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
  }
  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignorar */ }
  }

  // ---------- estado de la UI ----------
  let view = { x: 0, y: 0, k: 1 };
  let selection = null;   // { type: 'node' | 'edge', id }
  let analysis = analyzeTree([], []);
  let drag = null;
  let pending = null;     // editor abierto: { mode: 'create' | 'edit', id?, x, y, parent? }
  let lastTap = { t: 0, key: null };
  let spaceDown = false;
  let frame = 0;
  let locked = false;     // mientras corre un programa el árbol no se edita a mano

  // ---------- utilidades ----------
  function el(tag, attrs = {}, ...children) {
    const node = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) node.setAttribute(k, v);
    node.append(...children);
    return node;
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const edgeKey = e => `${e.from}>${e.to}`;
  const display = n => keyOf(n) || '∅';

  function screenPoint(e) {
    const r = svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  const toWorld = p => ({ x: (p.x - view.x) / view.k, y: (p.y - view.y) / view.k });
  const toScreen = p => ({ x: p.x * view.k + view.x, y: p.y * view.k + view.y });

  function nodeAt(w, slack = 6) {
    let best = null, bestD = Infinity;
    for (const n of Store.state.nodes) {
      const d = Math.hypot(n.x - w.x, n.y - w.y);
      if (d <= R + slack && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  function isDoubleTap(key) {
    const now = performance.now();
    const dbl = lastTap.key === key && now - lastTap.t < 350;
    lastTap = dbl ? { t: 0, key: null } : { t: now, key };
    return dbl;
  }

  let toastTimer = 0;
  function toast(msg, kind = 'info') {
    const t = $('#toast');
    t.textContent = msg;
    t.dataset.kind = kind;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  function scheduleRender() {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; render(); });
  }
  Store.setListener(scheduleRender);

  // ---------- vista ----------
  function applyView() {
    const t = `translate(${view.x} ${view.y}) scale(${view.k})`;
    world.setAttribute('transform', t);
    gridPattern.setAttribute('patternTransform', t);
    positionEditor();
  }

  function zoomAt(sp, factor) {
    const k = clamp(view.k * factor, 0.2, 3);
    view.x = sp.x - (sp.x - view.x) * (k / view.k);
    view.y = sp.y - (sp.y - view.y) * (k / view.k);
    view.k = k;
    applyView();
  }

  function fitView() {
    const r = svg.getBoundingClientRect();
    const ns = Store.state.nodes;
    if (!ns.length) {
      view = { x: r.width / 2, y: r.height / 3, k: 1 };
      return applyView();
    }
    const pad = R + 48;
    // En modo Programar se deja libre el lado derecho para la pila de llamadas.
    const inset = document.body.dataset.mode === 'code' && r.width > 700 ? 300 : 0;
    const w = r.width - inset;
    const minX = Math.min(...ns.map(n => n.x)) - pad, maxX = Math.max(...ns.map(n => n.x)) + pad;
    const minY = Math.min(...ns.map(n => n.y)) - pad, maxY = Math.max(...ns.map(n => n.y)) + pad;
    const k = clamp(Math.min(w / (maxX - minX), r.height / (maxY - minY)), 0.25, 1.4);
    view = { k, x: w / 2 - ((minX + maxX) / 2) * k, y: r.height / 2 - ((minY + maxY) / 2) * k };
    applyView();
  }

  function centerInView() {
    const r = svg.getBoundingClientRect();
    const c = toWorld({ x: r.width / 2, y: r.height / 2 });
    while (nodeAt(c, R)) { c.x += R * 2.5; }
    return c;
  }

  // ---------- animación de posiciones ----------
  let anim = 0;
  function animateTo(targets, { checkpoint = true } = {}) {
    cancelAnimationFrame(anim);
    const ns = Store.state.nodes.filter(n => targets.has(n.id));
    if (!ns.length) return;
    if (checkpoint) Store.checkpoint();
    const from = new Map(ns.map(n => [n.id, { x: n.x, y: n.y }]));
    const t0 = performance.now(), dur = 320;
    const step = now => {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      for (const n of ns) {
        const a = from.get(n.id), b = targets.get(n.id);
        n.x = a.x + (b.x - a.x) * e;
        n.y = a.y + (b.y - a.y) * e;
      }
      if (t < 1) { Store.touch(); anim = requestAnimationFrame(step); }
      else Store.commit();
    };
    anim = requestAnimationFrame(step);
  }

  function autoLayout() {
    const s = Store.state;
    if (!s.nodes.length) return;
    animateTo(computeLayout(s.nodes, s.edges));
  }

  // ---------- render ----------
  function render() {
    const s = Store.state;
    if (selection?.type === 'node' && !Store.node(selection.id)) selection = null;
    if (selection?.type === 'edge' && !s.edges.some(e => edgeKey(e) === selection.id)) selection = null;

    analysis = analyzeTree(s.nodes, s.edges);
    emptyState.hidden = s.nodes.length > 0 || !!pending;
    renderEdges();
    renderNodes();
    renderGhost();
    renderResult();
    renderSelection();
    renderStats();
    $('#btnUndo').disabled = locked || !Store.canUndo();
    $('#btnRedo').disabled = locked || !Store.canRedo();
    for (const id of ['#btnAdd', '#btnLayout', '#btnClear', '#btnImport', '#selExample']) $(id).disabled = locked;
    document.querySelectorAll('#insertForm button').forEach(b => { b.disabled = locked; });
    if (locked) document.querySelectorAll('#selection button').forEach(b => { b.disabled = true; });
  }

  function renderEdges() {
    const { sides } = analysis.structure;
    const frag = [];
    for (const e of Store.state.edges) {
      const p = Store.node(e.from), c = Store.node(e.to);
      if (!p || !c) continue;
      const dx = c.x - p.x, dy = c.y - p.y, len = Math.hypot(dx, dy);
      if (len < R * 2) continue;
      const ux = dx / len, uy = dy / len;
      const x1 = p.x + ux * R, y1 = p.y + uy * R;
      const x2 = c.x - ux * (R + 2), y2 = c.y - uy * (R + 2);
      const key = edgeKey(e);
      const sel = selection?.type === 'edge' && selection.id === key;
      const g = el('g', { class: 'edge' + (sel ? ' is-selected' : ''), 'data-edge': key });
      g.append(
        el('line', { class: 'edge-hit', x1, y1, x2, y2 }),
        el('line', { class: 'edge-line', x1, y1, x2, y2, 'marker-end': sel ? 'url(#arrowSel)' : 'url(#arrow)' }),
      );
      const side = sides.get(e.to);
      if (prefs.sides && side) {
        const mx = x1 + (x2 - x1) * 0.4, my = y1 + (y2 - y1) * 0.4;
        const lx = mx + (side === 'L' ? -10 : 10);
        g.append(el('text', { class: 'edge-side', x: lx, y: my - 5, dy: '0.35em' }, side === 'L' ? 'I' : 'D'));
      }
      frag.push(g);
    }
    edgesG.replaceChildren(...frag);
  }

  function renderNodes() {
    const hoverTarget = drag?.type === 'connect' ? drag.hover : null;
    const ov = document.body.dataset.mode === 'code' && typeof Runner !== 'undefined' ? Runner.overlay() : null;
    const frag = Store.state.nodes.map(n => {
      const info = analysis.info.get(n.id);
      const flag = ov ? null : analysis.flagged.get(n.id);
      const cls = ['node'];
      if (selection?.type === 'node' && selection.id === n.id) cls.push('is-selected');
      if (flag) cls.push(flag === 'warn' ? 'is-warn' : 'is-bad');
      if (ov) {
        if (ov.current === n.id) cls.push('x-current');
        else if (ov.stack.has(n.id)) cls.push('x-stack');
        if (ov.visited.has(n.id)) cls.push('x-visited');
        if (ov.floating.has(n.id)) cls.push('x-floating');
        if (ov.result === n.id) cls.push('x-result');
      }
      if (n.id === analysis.root) cls.push('is-root');
      if (n.id === hoverTarget) cls.push('is-target');
      if (pending?.mode === 'edit' && pending.id === n.id) cls.push('is-editing');
      if (drag?.type === 'move' && drag.id === n.id && drag.moved) cls.push('is-dragging');

      const raw = keyOf(n);
      const text = raw.length > 6 ? raw.slice(0, 5) + '…' : raw;
      const size = [18, 18, 17, 15, 13, 12, 11][text.length] ?? 11;

      const g = el('g', { class: cls.join(' '), 'data-node': '', 'data-id': n.id, transform: `translate(${n.x} ${n.y})` });
      g.append(
        el('title', {}, raw || 'Nodo sin valor'),
        el('circle', { class: 'node-halo', r: R + 7 }),
        el('circle', { class: 'node-body', r: R }),
        el('text', { class: 'node-label' + (raw ? '' : ' empty'), 'font-size': size, dy: '0.35em' }, text || '∅'),
      );
      const alt = ov?.alturas?.get(n.id);
      if (prefs.metrics && alt) {
        // En Programar se muestra el campo altura del Nodo; en rojo si no coincide con la real.
        const stale = alt.stored !== alt.real;
        g.append(el('text', { class: 'node-metric' + (stale ? ' bad' : ''), y: -R - 9 },
          el('title', {}, stale ? `nodo.altura vale ${alt.stored}, pero la altura real es ${alt.real}` : 'nodo.altura'),
          `altura ${alt.stored}${stale ? ` ≠ ${alt.real}` : ''}`));
      } else if (prefs.metrics && info) {
        const bf = info.bf;
        const txt = bf === null ? `h${info.height}` : `h${info.height} · FB ${signed(bf)}`;
        g.append(el('text', { class: 'node-metric' + (bf !== null && Math.abs(bf) > 1 ? ' bad' : ''), y: -R - 9 }, txt));
      }
      if (ov?.returns.has(n.id)) {
        g.append(el('text', { class: 'x-return', x: R + 6, y: -R + 6 }, '↩ ' + ov.returns.get(n.id)));
      }
      if (ov?.pointers.has(n.id)) {
        g.append(el('text', { class: 'x-pointer', x: -R - 7, y: 4 }, ov.pointers.get(n.id).join(', ') + ' →'));
      }
      if (!locked) {
        g.append(
          el('circle', { class: 'port-hit', cy: R + 3, r: 11, 'data-port': '', 'data-id': n.id }),
          el('circle', { class: 'port', cy: R + 3, r: 5 }),
        );
      }
      return g;
    });
    nodesG.replaceChildren(...frag);
  }

  function renderGhost() {
    ghostG.replaceChildren();
    let from = null, to = null;
    if (drag?.type === 'connect') {
      from = Store.node(drag.from);
      to = drag.hover ? Store.node(drag.hover) : drag.to;
    } else if (pending?.mode === 'create') {
      from = pending.parent ? Store.node(pending.parent) : null;
      to = pending;
      ghostG.append(el('circle', { class: 'ghost-node', cx: to.x, cy: to.y, r: R }));
    }
    if (!from || !to) return;
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy);
    if (len < R) return;
    const ux = dx / len, uy = dy / len;
    const end = drag?.hover || pending ? R + 2 : 0;
    ghostG.prepend(el('line', {
      class: 'ghost-line',
      x1: from.x + ux * R, y1: from.y + uy * R,
      x2: to.x - ux * end, y2: to.y - uy * end,
      'marker-end': 'url(#arrowSel)',
    }));
  }

  // ---------- panel ----------
  const REASON_TITLE = {
    NONE: 'Por qué no es un árbol',
    AG: 'Por qué no es AB',
    AB: 'Por qué no es ABB',
    ABB: 'Por qué no es AVL',
  };
  const CHECK_ROWS = [
    ['tree', 'Es un árbol', 'Una raíz, sin ciclos, un padre por nodo'],
    ['ab', 'Binario', 'Cada nodo tiene como máximo 2 hijos'],
    ['abb', 'Orden de búsqueda', 'izq < nodo < der en cada subárbol'],
    ['balanced', 'Balanceado en altura', '|FB| ≤ 1 en cada nodo'],
  ];

  function renderResult() {
    const a = analysis;
    const info = KIND_INFO[a.kind];
    const chain = ['AVL', 'ABB', 'AB', 'AG'];
    const idx = chain.indexOf(a.kind);
    const chainHtml = chain.map((k, i) =>
      `<span class="chain-item${idx >= 0 && i >= idx ? ' on' : ''}${i === idx ? ' current' : ''}">${k}</span>`
    ).join('<span class="chain-sep">⊂</span>');

    const also = idx >= 0 && idx < chain.length - 1
      ? `<p class="also">Por lo tanto también es ${chain.slice(idx + 1).join(', ').replace(/, ([^,]*)$/, ' y $1')}.</p>` : '';

    let checks = '';
    if (a.kind !== 'EMPTY') {
      checks = '<ul class="checks">' + CHECK_ROWS.map(([key, label, hint]) => {
        const v = a.checks[key];
        const state = v === true ? 'ok' : v === false ? 'fail' : 'na';
        const icon = v === true ? '✓' : v === false ? '✕' : '–';
        return `<li class="check ${state}"><span class="ck">${icon}</span><span><b>${label}</b><small>${hint}</small></span></li>`;
      }).join('') + '</ul>';
    }

    let reasons = '';
    if (a.reasons.length) {
      const items = a.reasons.slice(0, 12).map(r =>
        `<li${r.ids.length ? ` data-focus="${esc(r.ids[0])}" tabindex="0"` : ''} class="${r.level === 'warn' ? 'warn' : ''}">${esc(r.text)}</li>`
      ).join('');
      const more = a.reasons.length > 12 ? `<li class="muted">…y ${a.reasons.length - 12} más.</li>` : '';
      reasons = `<div class="reasons"><h4>${REASON_TITLE[a.kind]}</h4><ul>${items}${more}</ul></div>`;
    }
    const notes = a.notes.map(n => `<p class="note">${esc(n)}</p>`).join('');
    const tags = a.tags.length
      ? `<div class="tags">${a.tags.map(t => `<span class="tag" title="${esc(t.hint)}">${esc(t.label)}</span>`).join('')}</div>` : '';

    const chip = $('#kindChip');
    chip.dataset.kind = a.kind;
    chip.innerHTML = `<b>${info.short}</b><span>${info.title}</span>`;

    const box = $('#result');
    box.dataset.kind = a.kind;
    box.innerHTML = `
      <div class="result-head">
        <div class="badge">${info.short}</div>
        <div>
          <h2>${info.title}</h2>
          <p class="muted">${info.desc}</p>
        </div>
      </div>
      <div class="chain" aria-label="Jerarquía de clases">${chainHtml}</div>
      ${also}${tags}${checks}${reasons}${notes}`;
  }

  function renderSelection() {
    const box = $('#selection');
    const s = Store.state;
    if (selection?.type === 'edge') {
      const e = s.edges.find(x => edgeKey(x) === selection.id);
      const side = analysis.structure.sides.get(e.to);
      box.innerHTML = `
        <h3>Arista seleccionada</h3>
        <p><b>${esc(display(Store.node(e.from)))}</b> → <b>${esc(display(Store.node(e.to)))}</b>
          ${side ? `<span class="muted">(hijo ${side === 'L' ? 'izquierdo' : 'derecho'})</span>` : ''}</p>
        <div class="btn-grid"><button data-action="delete" class="danger">Eliminar arista</button></div>`;
      return;
    }
    if (selection?.type !== 'node') {
      box.innerHTML = `<h3>Selección</h3><p class="muted small">Tocá un nodo para ver sus datos y agregarle hijos.</p>`;
      return;
    }
    const n = Store.node(selection.id);
    const info = analysis.info.get(n.id);
    const { kids, left, right, parents } = analysis.structure;
    const k = kids.get(n.id).length;
    const hasParent = parents.has(n.id);
    const canL = k < 2 && left(n.id) === null;
    const canR = k < 2 && right(n.id) === null;
    const facts = [];
    if (info) {
      facts.push(['Profundidad', info.depth], ['Altura', info.height], ['Hijos', info.children]);
      if (info.bf !== null) facts.push(['FB', signed(info.bf)]);
      if (info.side) facts.push(['Lado', info.side === 'L' ? 'Izquierdo' : 'Derecho']);
    } else {
      facts.push(['Hijos', k], ['Padre', hasParent ? parents.get(n.id).map(id => display(Store.node(id))).join(', ') : 'ninguno']);
    }
    box.innerHTML = `
      <h3>Nodo seleccionado</h3>
      <div class="sel-head">
        <span class="sel-dot">${esc(display(n))}</span>
        <dl class="facts">${facts.map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
      </div>
      <div class="btn-grid">
        <button data-action="edit">Editar valor</button>
        <button data-action="add-child">＋ Hijo</button>
        <button data-action="add-left" ${canL ? '' : 'disabled'}>＋ Hijo izq.</button>
        <button data-action="add-right" ${canR ? '' : 'disabled'}>＋ Hijo der.</button>
        <button data-action="detach" ${hasParent ? '' : 'disabled'}>Desconectar</button>
        <button data-action="delete-subtree" ${k ? '' : 'disabled'}>Borrar subárbol</button>
        <button data-action="delete" class="danger wide">Eliminar nodo</button>
      </div>`;
  }

  function renderStats() {
    const box = $('#stats');
    const st = analysis.stats;
    if (!st || analysis.kind === 'NONE') {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const rows = [
      ['Nodos', st.nodes], ['Altura', st.height], ['Hojas', st.leaves],
      ['Internos', st.internal], ['Grado', st.degree], ['Raíz', st.root],
    ];
    const t = analysis.traversals;
    const trav = [['Preorden', t.pre], ['Inorden', t.in], ['Postorden', t.post], ['Por niveles', t.level]]
      .filter(([, v]) => v)
      .map(([k, v]) => `<div class="trav"><dt>${k}</dt><dd>${v.map(esc).join('<span class="sep">,</span> ')}</dd></div>`).join('');
    box.innerHTML = `
      <h3>Datos del árbol</h3>
      <dl class="stats-grid">${rows.map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
      <h4>Recorridos</h4>
      <dl class="travs">${trav}</dl>`;
  }

  // ---------- editor de valores ----------
  function openEditor(p) {
    finishEditor(true);
    pending = p;
    const n = p.mode === 'edit' ? Store.node(p.id) : null;
    editor.value = n ? n.value : '';
    editor.placeholder = p.mode === 'create' ? 'valor' : '';
    editor.hidden = false;
    positionEditor();
    scheduleRender();
    requestAnimationFrame(() => { editor.focus(); editor.select(); });
  }

  function positionEditor() {
    if (!pending) return;
    const n = pending.mode === 'edit' ? Store.node(pending.id) : pending;
    if (!n) return;
    const p = toScreen(n);
    editor.style.left = p.x + 'px';
    editor.style.top = p.y + 'px';
  }

  function finishEditor(commit) {
    const p = pending;
    if (!p) return;
    pending = null;
    editor.hidden = true;
    const val = editor.value.trim();
    if (commit && p.mode === 'edit') {
      const n = Store.node(p.id);
      if (n && n.value !== val) Store.mutate(s => { s.nodes.find(x => x.id === p.id).value = val; });
    } else if (commit && p.mode === 'create' && val !== '') {
      Store.mutate(s => {
        const n = Store.addNode(s, p.x, p.y, val);
        if (p.parent && Store.node(p.parent)) Store.link(s, p.parent, n.id);
        selection = { type: 'node', id: n.id };
      });
    }
    scheduleRender();
  }

  editor.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); finishEditor(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finishEditor(false); }
    e.stopPropagation();
  });
  editor.addEventListener('blur', () => finishEditor(true));

  // ---------- acciones ----------
  function select(sel) {
    selection = sel;
    scheduleRender();
  }

  function connect(from, to) {
    const err = Store.linkError(Store.state, from, to);
    if (err) return toast(err, 'error');
    const replaced = Store.mutate(s => Store.link(s, from, to));
    if (replaced) toast(`Se reasignó el padre de «${display(Store.node(to))}».`);
  }

  function deleteSelection() {
    if (!selection) return;
    if (selection.type === 'node') {
      const id = selection.id;
      Store.mutate(s => Store.removeNodes(s, [id]));
    } else {
      const key = selection.id;
      Store.mutate(s => { s.edges = s.edges.filter(e => edgeKey(e) !== key); });
    }
    selection = null;
  }

  function childSlot(id, where) {
    const n = Store.node(id);
    const kids = analysis.structure.kids.get(id).map(Store.node);
    const y = n.y + LAYOUT_V;
    if (where === 'L') return { x: n.x - 70, y };
    if (where === 'R') return { x: n.x + 70, y };
    if (!kids.length) return { x: n.x, y };
    return { x: Math.max(...kids.map(k => k.x)) + LAYOUT_H, y: Math.max(...kids.map(k => k.y)) };
  }

  panel.addEventListener('click', e => {
    const focus = e.target.closest('[data-focus]');
    if (focus) {
      select({ type: 'node', id: focus.dataset.focus });
      return;
    }
    const btn = e.target.closest('button[data-action]');
    if (!btn || !selection || locked) return;
    const id = selection.id;
    switch (btn.dataset.action) {
      case 'edit': openEditor({ mode: 'edit', id }); break;
      case 'add-child': openEditor({ mode: 'create', parent: id, ...childSlot(id) }); break;
      case 'add-left': openEditor({ mode: 'create', parent: id, ...childSlot(id, 'L') }); break;
      case 'add-right': openEditor({ mode: 'create', parent: id, ...childSlot(id, 'R') }); break;
      case 'detach': Store.mutate(s => { s.edges = s.edges.filter(x => x.to !== id); }); break;
      case 'delete-subtree': {
        Store.mutate(s => Store.removeNodes(s, Store.descendants(s, id)));
        selection = null;
        break;
      }
      case 'delete': deleteSelection(); break;
    }
  });
  panel.addEventListener('keydown', e => {
    const focus = e.target.closest('[data-focus]');
    if (focus && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      select({ type: 'node', id: focus.dataset.focus });
    }
  });

  // ---------- inserción ABB / AVL ----------
  function toStruct() {
    const { byId, left, right } = analysis.structure;
    const build = id => {
      if (id === null) return null;
      const t = { id, v: keyOf(byId.get(id)), l: build(left(id)), r: build(right(id)) };
      t.h = 1 + Math.max(t.l ? t.l.h : -1, t.r ? t.r.h : -1);
      return t;
    };
    return build(analysis.root);
  }

  function insertValue(raw, mode) {
    const val = raw.trim().slice(0, 12);
    if (!val || locked) return false;
    const s = Store.state;
    const r = svg.getBoundingClientRect();

    if (!s.nodes.length) {
      const c = toWorld({ x: r.width / 2, y: r.height / 3 });
      Store.mutate(st => { Store.addNode(st, c.x, c.y, val); });
      return true;
    }
    const needed = mode === 'avl' ? ['AVL'] : ['ABB', 'AVL'];
    if (!needed.includes(analysis.kind)) {
      toast(mode === 'avl'
        ? 'Para insertar como AVL, el árbol actual tiene que ser un AVL.'
        : 'Para insertar como ABB, el árbol actual tiene que ser un ABB.', 'error');
      return false;
    }
    const numeric = analysis.numeric;
    if (numeric && !NUMERIC_RE.test(val)) {
      toast('El árbol tiene claves numéricas: ingresá un número.', 'error');
      return false;
    }
    const cmp = makeComparator(numeric);
    const oldRoot = Store.node(analysis.root);
    const anchor = { x: oldRoot.x, y: oldRoot.y };
    const ht = t => (t ? t.h : -1);
    const upd = t => { t.h = 1 + Math.max(ht(t.l), ht(t.r)); };
    const rotations = [];
    const rotR = y => { const x = y.l; y.l = x.r; x.r = y; upd(y); upd(x); return x; };
    const rotL = x => { const y = x.r; x.r = y.l; y.l = x; upd(x); upd(y); return y; };

    let dup = false;
    let parentId = null;
    const fresh = { id: null, v: val, l: null, r: null, h: 0 };
    const ins = (t, parent) => {
      if (!t) { parentId = parent; return fresh; }
      const c = cmp(val, t.v);
      if (c === 0) { dup = true; return t; }
      if (c < 0) t.l = ins(t.l, t.id); else t.r = ins(t.r, t.id);
      upd(t);
      if (mode !== 'avl' || dup) return t;
      const bf = ht(t.l) - ht(t.r);
      if (bf > 1) {
        if (cmp(val, t.l.v) > 0) { rotations.push(`doble izquierda-derecha en «${t.v}»`); t.l = rotL(t.l); }
        else rotations.push(`simple a derecha en «${t.v}»`);
        return rotR(t);
      }
      if (bf < -1) {
        if (cmp(val, t.r.v) < 0) { rotations.push(`doble derecha-izquierda en «${t.v}»`); t.r = rotR(t.r); }
        else rotations.push(`simple a izquierda en «${t.v}»`);
        return rotL(t);
      }
      return t;
    };

    const root = ins(toStruct(), null);
    if (dup) {
      toast(`«${val}» ya está en el árbol; un ABB no admite claves repetidas.`, 'error');
      return false;
    }

    let newId = null;
    Store.mutate(st => {
      const p = Store.node(parentId);
      const n = Store.addNode(st, p.x, p.y + LAYOUT_V, val);
      newId = n.id;
      fresh.id = n.id;
      const edges = [];
      (function walk(t) {
        for (const c of [t.l, t.r]) if (c) { edges.push({ from: t.id, to: c.id }); walk(c); }
      })(root);
      st.edges = edges;
      // posiciones finales ya aplicadas para que los lados queden bien desde el primer render
      const pos = layoutBinaryStruct(root, anchor);
      for (const nd of st.nodes) if (pos.has(nd.id)) Object.assign(nd, pos.get(nd.id));
      selection = { type: 'node', id: n.id };
    });
    toast(rotations.length ? `Insertado «${val}». Rotación ${rotations.join('; ')}.` : `Insertado «${val}».`, 'ok');
    ensureVisible(newId);
    return true;
  }

  function ensureVisible(id) {
    const n = Store.node(id);
    if (!n) return;
    const p = toScreen(n);
    const r = svg.getBoundingClientRect();
    if (p.x < R || p.y < R || p.x > r.width - R || p.y > r.height - R) fitView();
  }

  let insertMode = 'avl';
  $('#insertForm').addEventListener('click', e => {
    const b = e.target.closest('button[data-mode]');
    if (b) insertMode = b.dataset.mode;
  });
  $('#insertForm').addEventListener('submit', e => {
    e.preventDefault();
    const mode = e.submitter?.dataset.mode || insertMode;
    const input = $('#insertValue');
    if (insertValue(input.value, mode)) { input.value = ''; }
    input.focus();
  });

  // ---------- eventos del lienzo ----------
  svg.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    e.preventDefault();
    if (pending) finishEditor(true);
    const sp = screenPoint(e), wp = toWorld(sp);
    const portEl = e.target.closest('[data-port]');
    const nodeEl = e.target.closest('[data-node]');
    const edgeEl = e.target.closest('[data-edge]');
    svg.setPointerCapture(e.pointerId);

    if (e.button === 1 || spaceDown) {
      drag = { type: 'pan', sx: sp.x, sy: sp.y, vx: view.x, vy: view.y, moved: true };
      return;
    }
    if (locked) {
      if (nodeEl) select({ type: 'node', id: nodeEl.dataset.id });
      drag = { type: 'pan', sx: sp.x, sy: sp.y, vx: view.x, vy: view.y, moved: !!nodeEl };
      return;
    }
    if (portEl || (nodeEl && e.shiftKey)) {
      const id = (portEl || nodeEl).dataset.id;
      drag = { type: 'connect', from: id, to: wp, hover: null };
      select({ type: 'node', id });
      return;
    }
    if (nodeEl) {
      const id = nodeEl.dataset.id;
      if (isDoubleTap(id)) { drag = null; openEditor({ mode: 'edit', id }); return; }
      const n = Store.node(id);
      drag = { type: 'move', id, dx: wp.x - n.x, dy: wp.y - n.y, sx: sp.x, sy: sp.y, moved: false };
      select({ type: 'node', id });
      return;
    }
    if (edgeEl) {
      drag = null;
      select({ type: 'edge', id: edgeEl.dataset.edge });
      return;
    }
    if (isDoubleTap('bg')) {
      drag = null;
      openEditor({ mode: 'create', x: wp.x, y: wp.y });
      return;
    }
    drag = { type: 'pan', sx: sp.x, sy: sp.y, vx: view.x, vy: view.y, moved: false };
  });

  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    const sp = screenPoint(e), wp = toWorld(sp);
    if (drag.type === 'move') {
      if (!drag.moved) {
        if (Math.hypot(sp.x - drag.sx, sp.y - drag.sy) < 3) return;
        Store.checkpoint();
        drag.moved = true;
        lastTap = { t: 0, key: null };
      }
      const n = Store.node(drag.id);
      n.x = wp.x - drag.dx;
      n.y = wp.y - drag.dy;
      Store.touch();
    } else if (drag.type === 'connect') {
      drag.to = wp;
      const t = nodeAt(wp);
      drag.hover = t && t.id !== drag.from ? t.id : null;
      scheduleRender();
    } else if (drag.type === 'pan') {
      if (!drag.moved && Math.hypot(sp.x - drag.sx, sp.y - drag.sy) > 3) drag.moved = true;
      if (drag.moved) {
        view.x = drag.vx + sp.x - drag.sx;
        view.y = drag.vy + sp.y - drag.sy;
        applyView();
        svg.classList.add('panning');
      }
    }
  });

  function endDrag(e, cancelled) {
    const d = drag;
    drag = null;
    svg.classList.remove('panning');
    if (!d) return;
    const wp = toWorld(screenPoint(e));
    if (d.type === 'connect' && !cancelled) {
      const target = nodeAt(wp);
      const src = Store.node(d.from);
      if (target && target.id !== d.from) connect(d.from, target.id);
      else if (!target && src && Math.hypot(wp.x - src.x, wp.y - src.y) > R * 2) {
        openEditor({ mode: 'create', x: wp.x, y: wp.y, parent: d.from });
      }
    } else if (d.type === 'move' && d.moved) {
      Store.commit();
    } else if (d.type === 'pan' && !d.moved && !cancelled) {
      select(null);
    }
    scheduleRender();
  }
  svg.addEventListener('pointerup', e => endDrag(e, false));
  svg.addEventListener('pointercancel', e => endDrag(e, true));

  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const speed = e.ctrlKey ? 0.01 : 0.0015;
    zoomAt(screenPoint(e), Math.exp(-e.deltaY * speed));
  }, { passive: false });

  svg.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('keydown', e => {
    if (e.target.closest?.('input, textarea, select')) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (locked) {
      if (key === 'f' && !mod) fitView();
      else if (e.key === 'Escape') select(null);
      else if (e.key === ' ') { spaceDown = true; svg.classList.add('grab'); e.preventDefault(); }
      return;
    }
    if (mod && key === 'z') { e.preventDefault(); e.shiftKey ? Store.redo() : Store.undo(); return; }
    if (mod && key === 'y') { e.preventDefault(); Store.redo(); return; }
    if (mod) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); }
    else if (e.key === 'Enter' && selection?.type === 'node') { e.preventDefault(); openEditor({ mode: 'edit', id: selection.id }); }
    else if (e.key === 'Escape') select(null);
    else if (key === 'l') autoLayout();
    else if (key === 'f') fitView();
    else if (key === 'n') { e.preventDefault(); openEditor({ mode: 'create', ...centerInView() }); }
    else if (e.key === ' ') { spaceDown = true; svg.classList.add('grab'); e.preventDefault(); }
  });
  window.addEventListener('keyup', e => {
    if (e.key === ' ') { spaceDown = false; svg.classList.remove('grab'); }
  });

  new ResizeObserver(() => positionEditor()).observe(svg);

  // ---------- barra superior ----------
  $('#btnAdd').addEventListener('click', () => openEditor({ mode: 'create', ...centerInView() }));
  $('#btnLayout').addEventListener('click', autoLayout);
  $('#btnFit').addEventListener('click', fitView);
  $('#btnUndo').addEventListener('click', () => Store.undo());
  $('#btnRedo').addEventListener('click', () => Store.redo());
  $('#btnZoomIn').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt({ x: r.width / 2, y: r.height / 2 }, 1.2); });
  $('#btnZoomOut').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt({ x: r.width / 2, y: r.height / 2 }, 1 / 1.2); });

  $('#btnClear').addEventListener('click', () => {
    if (!Store.state.nodes.length) return;
    Store.replace({ nodes: [], edges: [], nextId: 1 });
    selection = null;
    toast('Lienzo vacío. Podés deshacer con Ctrl/⌘+Z.');
  });

  const selExample = $('#selExample');
  for (const ex of EXAMPLES) selExample.append(new Option(ex.name, ex.id));
  selExample.addEventListener('change', () => {
    const ex = EXAMPLES.find(x => x.id === selExample.value);
    selExample.value = '';
    if (!ex) return;
    Store.replace(buildExample(ex));
    selection = null;
    fitView();
    selExample.blur();
  });

  $('#btnExport').addEventListener('click', () => {
    const { nodes, edges } = Store.state;
    const data = JSON.stringify({ format: 'treedrawer', version: 1, nodes, edges }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'arbol.json' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const fileInput = $('#fileInput');
  $('#btnImport').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.nodes)) throw new Error('formato');
      Store.replace(data);
      selection = null;
      fitView();
      toast(`Importados ${Store.state.nodes.length} nodos.`, 'ok');
    } catch {
      toast('No se pudo leer el archivo: tiene que ser un JSON exportado por TreeDrawer.', 'error');
    }
  });

  const chkMetrics = $('#chkMetrics'), chkSides = $('#chkSides');
  chkMetrics.checked = prefs.metrics;
  chkSides.checked = prefs.sides;
  chkMetrics.addEventListener('change', () => { prefs.metrics = chkMetrics.checked; savePrefs(); scheduleRender(); });
  chkSides.addEventListener('change', () => { prefs.sides = chkSides.checked; savePrefs(); scheduleRender(); });

  function applyTheme() {
    if (prefs.theme) document.documentElement.dataset.theme = prefs.theme;
    else delete document.documentElement.dataset.theme;
  }
  $('#btnTheme').addEventListener('click', () => {
    const dark = prefs.theme ? prefs.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    prefs.theme = dark ? 'light' : 'dark';
    savePrefs();
    applyTheme();
  });

  // ---------- modo Dibujar / Programar ----------
  function setMode(mode) {
    document.body.dataset.mode = mode;
    document.querySelectorAll('.mode-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
    if (mode === 'code') finishEditor(true);
    scheduleRender();
    requestAnimationFrame(fitView);
    if (typeof Runner !== 'undefined') Runner.onModeChange(mode);
  }
  document.querySelectorAll('.mode-tabs button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

  function setLocked(v) {
    locked = v;
    document.body.classList.toggle('is-locked', v);
    if (v) {
      finishEditor(false);
      drag = null;
    }
    scheduleRender();
  }

  window.App = {
    render: scheduleRender,
    animateTo,
    toast,
    fitView,
    ensureVisible,
    setLocked,
    get analysis() { return analysis; },
    viewCenter() {
      const r = svg.getBoundingClientRect();
      return toWorld({ x: r.width / 2, y: r.height / 3 });
    },
  };

  // ---------- inicio ----------
  applyTheme();
  Store.restore();
  document.body.dataset.mode = 'draw';
  render();
  fitView();
})();
