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
  const prefs = Object.assign({ metrics: false, sides: true, degrees: false, theme: null, space: 'tree' }, readJSON(PREFS_KEY));
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
  const isGraph = () => Store.kind === 'graph';

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
    animateTo(isGraph() ? layoutGraph(s.nodes, s.edges) : computeLayout(s.nodes, s.edges));
  }

  // ---------- render ----------
  function render() {
    const s = Store.state;
    if (selection?.type === 'node' && !Store.node(selection.id)) selection = null;
    if (selection?.type === 'edge' && !s.edges.some(e => edgeKey(e) === selection.id)) selection = null;

    analysis = isGraph() ? analyzeGraph(s) : analyzeTree(s.nodes, s.edges);
    emptyState.hidden = s.nodes.length > 0 || !!pending;
    renderEdges();
    renderNodes();
    renderGhost();
    renderResult();
    renderSelection();
    renderStats();
    $('#btnUndo').disabled = locked || !Store.canUndo();
    $('#btnRedo').disabled = locked || !Store.canRedo();
    for (const id of ['#btnAdd', '#btnLayout', '#btnClear', '#btnImport', '#selExample', '#chkDirected', '#chkWeighted']) $(id).disabled = locked;
    document.querySelectorAll('.space-tabs button').forEach(b => { b.disabled = locked; });
    if (isGraph()) {
      $('#chkDirected').checked = !!s.directed;
      $('#chkWeighted').checked = !!s.weighted;
    }
    document.querySelectorAll('#insertForm button').forEach(b => { b.disabled = locked; });
    if (locked) document.querySelectorAll('#selection button').forEach(b => { b.disabled = true; });
  }

  /**
   * Geometría de una arista del grafo: recta, o curva si en un dirigido existe también la
   * opuesta (A→B y B→A). `mid` es donde va el peso.
   */
  function edgeGeom(e, pairs) {
    const p = Store.node(e.from), c = Store.node(e.to);
    if (!p || !c) return null;
    const dx = c.x - p.x, dy = c.y - p.y, len = Math.hypot(dx, dy);
    if (len < R * 2) return null;
    const ux = dx / len, uy = dy / len;
    if (pairs?.has(`${e.to}>${e.from}`)) {
      const bend = 26;
      const cx = (p.x + c.x) / 2 - uy * bend, cy = (p.y + c.y) / 2 + ux * bend;
      const toward = (a, b, r) => { const l = Math.hypot(b.x - a.x, b.y - a.y); return { x: a.x + ((b.x - a.x) / l) * r, y: a.y + ((b.y - a.y) / l) * r }; };
      const s0 = toward(p, { x: cx, y: cy }, R), s1 = toward(c, { x: cx, y: cy }, R + 2);
      return {
        d: `M${s0.x} ${s0.y} Q${cx} ${cy} ${s1.x} ${s1.y}`,
        mid: { x: 0.25 * s0.x + 0.5 * cx + 0.25 * s1.x, y: 0.25 * s0.y + 0.5 * cy + 0.25 * s1.y },
      };
    }
    const x1 = p.x + ux * R, y1 = p.y + uy * R;
    const x2 = c.x - ux * (R + 2), y2 = c.y - uy * (R + 2);
    return { d: `M${x1} ${y1} L${x2} ${y2}`, mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 } };
  }

  function renderGraphEdges() {
    const s = Store.state;
    const ov = document.body.dataset.mode === 'code' && typeof Runner !== 'undefined' ? Runner.overlay() : null;
    const pairs = s.directed ? new Set(s.edges.map(edgeKey)) : null;
    const frag = [];
    for (const e of s.edges) {
      const geo = edgeGeom(e, pairs);
      if (!geo) continue;
      const key = edgeKey(e);
      const sel = selection?.type === 'edge' && selection.id === key;
      const warn = ov?.edgeWarn?.get(key);
      const arrow = s.directed || !!warn?.oneWay;
      const cls = ['edge'];
      if (sel) cls.push('is-selected');
      if (warn) cls.push('x-edge-warn');
      if (ov?.edgeMarks?.has(key)) cls.push('x-edge-current');
      const g = el('g', { class: cls.join(' '), 'data-edge': key });
      if (warn) g.append(el('title', {}, warn.text));
      g.append(
        el('path', { class: 'edge-hit', d: geo.d }),
        el('path', { class: 'edge-line', d: geo.d, 'marker-end': arrow ? (sel ? 'url(#arrowSel)' : warn ? 'url(#arrowWarn)' : 'url(#arrow)') : null }),
      );
      if (s.weighted) {
        const editing = pending?.mode === 'weight' && pending.key === key;
        g.append(el('text', { class: 'edge-weight' + (editing ? ' is-editing' : ''), x: geo.mid.x, y: geo.mid.y, dy: '0.35em' }, String(e.w ?? 1)));
      }
      frag.push(g);
    }
    edgesG.replaceChildren(...frag);
  }

  function renderEdges() {
    if (isGraph()) return renderGraphEdges();
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
        if (ov.queued?.has(n.id)) cls.push('x-queued');
        if (ov.floating.has(n.id)) cls.push('x-floating');
        if (ov.result === n.id) cls.push('x-result');
      }
      if (n.id === analysis.root && !analysis.graph) cls.push('is-root');
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
      if (analysis.graph) {
        if (prefs.degrees && info) {
          const txt = analysis.directed ? `ent ${info.in} · sal ${info.out}` : `grado ${info.deg}`;
          g.append(el('text', { class: 'node-metric', y: -R - 9 }, txt));
        }
      } else if (prefs.metrics && alt) {
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
      if (ov?.order?.has(n.id)) {
        g.append(el('text', { class: 'x-order', x: R - 4, y: -R + 2 }, `${ov.order.get(n.id)}º`));
      }
      const badges = ov?.badges?.get(n.id);
      if (badges?.length) {
        badges.slice(0, 3).forEach((b, i) => g.append(el('text', { class: 'x-badge', y: R + 17 + i * 14 }, b)));
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
      'marker-end': !isGraph() || Store.state.directed ? 'url(#arrowSel)' : null,
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

  function reasonsHtml(list, title, cls = '') {
    if (!list.length) return '';
    const items = list.slice(0, 12).map(r =>
      `<li${r.ids.length ? ` data-focus="${esc(r.ids[0])}" tabindex="0"` : ''} class="${r.level === 'warn' ? 'warn' : ''}">${esc(r.text)}</li>`
    ).join('');
    const more = list.length > 12 ? `<li class="muted">…y ${list.length - 12} más.</li>` : '';
    return `<div class="reasons${cls ? ' ' + cls : ''}"><h4>${title}</h4><ul>${items}${more}</ul></div>`;
  }

  function renderKind(info, kind) {
    const chip = $('#kindChip');
    chip.dataset.kind = kind;
    chip.innerHTML = `<b>${info.short}</b><span>${info.title}</span>`;
    chip.title = isGraph() ? 'Clasificación del grafo' : 'Clasificación del árbol';
  }

  function renderGraphResult() {
    const a = analysis;
    const info = GRAPH_KIND_INFO[a.kind];
    renderKind(info, a.kind);
    const s = Store.state;
    const pills = [a.directed ? 'Dirigido' : 'No dirigido', a.weighted ? 'Ponderado' : 'Sin pesos'];
    if (a.stats) pills.push(`${a.stats.vertices} ${a.stats.vertices === 1 ? 'vértice' : 'vértices'}`, `${a.stats.edges} ${a.stats.edges === 1 ? 'arista' : 'aristas'}`);
    const checks = a.kind === 'G_EMPTY' ? '' : '<ul class="checks">' + a.rows.map(r => {
      const state = r.value === true ? 'ok' : r.value === false ? 'fail' : 'na';
      const icon = r.value === true ? '✓' : r.value === false ? '✕' : '–';
      return `<li class="check ${state}"><span class="ck">${icon}</span><span><b>${r.label}</b><small>${r.hint}</small></span></li>`;
    }).join('') + '</ul>';
    const tags = a.tags.length
      ? `<div class="tags">${a.tags.map(t => `<span class="tag" title="${esc(t.hint)}">${esc(t.label)}</span>`).join('')}</div>` : '';
    const notes = a.notes.map(n => `<p class="note">${esc(n)}</p>`).join('');
    const box = $('#result');
    box.dataset.kind = a.kind;
    box.innerHTML = `
      <div class="result-head">
        <div class="badge${info.short.length > 4 ? ' long' : ''}">${info.short}</div>
        <div>
          <h2>${info.title}</h2>
          <p class="muted">${info.desc}</p>
        </div>
      </div>
      ${s.nodes.length ? `<div class="chain" aria-label="Tipo de grafo">${pills.map(p => `<span class="chain-item on">${p}</span>`).join('')}</div>` : ''}
      ${tags}${checks}${reasonsHtml(a.reasons, 'Detalles', 'info')}${notes}`;
  }

  function renderResult() {
    if (analysis.graph) return renderGraphResult();
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

    const reasons = reasonsHtml(a.reasons, REASON_TITLE[a.kind]);
    const notes = a.notes.map(n => `<p class="note">${esc(n)}</p>`).join('');
    const tags = a.tags.length
      ? `<div class="tags">${a.tags.map(t => `<span class="tag" title="${esc(t.hint)}">${esc(t.label)}</span>`).join('')}</div>` : '';

    renderKind(info, a.kind);

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

  function renderGraphSelection() {
    const box = $('#selection');
    const s = Store.state;
    const m = analysis.model;
    if (selection?.type === 'edge') {
      const e = s.edges.find(x => edgeKey(x) === selection.id);
      const sep = s.directed ? '→' : '—';
      box.innerHTML = `
        <h3>Arista seleccionada</h3>
        <p><b>${esc(display(Store.node(e.from)))}</b> ${sep} <b>${esc(display(Store.node(e.to)))}</b></p>
        ${s.weighted ? `<label class="weight-row">Peso <input type="number" step="1" id="edgeWeight" value="${esc(e.w ?? 1)}" aria-label="Peso de la arista"></label>` : ''}
        <div class="btn-grid">
          ${s.directed ? '<button data-action="reverse">Invertir sentido</button>' : ''}
          <button data-action="delete" class="danger">Eliminar arista</button>
        </div>`;
      return;
    }
    if (selection?.type !== 'node') {
      box.innerHTML = `<h3>Selección</h3><p class="muted small">Tocá un vértice para ver sus datos y usarlo como origen de los recorridos.</p>`;
      return;
    }
    const n = Store.node(selection.id);
    const info = analysis.info.get(n.id);
    const names = ids => ids.map(id => display(m.byId.get(id))).join(', ') || 'ninguno';
    const facts = analysis.directed
      ? [['Entrantes', info.in], ['Salientes', info.out], ['Componente', info.comp + 1]]
      : [['Grado', info.deg], ['Componente', info.comp + 1]];
    const adj = analysis.directed
      ? `<p class="small"><span class="muted">Sale hacia:</span> ${esc(names(m.out.get(n.id)))}<br><span class="muted">Llega desde:</span> ${esc(names(m.inc.get(n.id)))}</p>`
      : `<p class="small"><span class="muted">Adyacentes:</span> ${esc(names(m.out.get(n.id)))}</p>`;
    const linked = m.out.get(n.id).length + m.inc.get(n.id).length > 0;
    box.innerHTML = `
      <h3>Vértice seleccionado</h3>
      <div class="sel-head">
        <span class="sel-dot">${esc(display(n))}</span>
        <dl class="facts">${facts.map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
      </div>
      ${adj}
      <div class="btn-grid">
        <button data-action="edit">Editar valor</button>
        <button data-action="add-adjacent">＋ Adyacente</button>
        <button data-action="isolate" ${linked ? '' : 'disabled'}>Quitar aristas</button>
        <button data-action="delete" class="danger">Eliminar vértice</button>
      </div>`;
  }

  function renderSelection() {
    if (analysis.graph) return renderGraphSelection();
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

  const fmtDist = d => (d === Infinity ? '∞' : String(d));

  function renderGraphStats() {
    const box = $('#stats');
    const a = analysis;
    const st = a.stats;
    if (!st) { box.hidden = true; return; }
    box.hidden = false;
    const rows = a.directed
      ? [['Vértices', st.vertices], ['Aristas', st.edges], ['Comp. fuertes', st.scc], ['Partes', st.components], ['Fuentes', st.sources], ['Sumideros', st.sinks]]
      : [['Vértices', st.vertices], ['Aristas', st.edges], ['Componentes', st.components], ['Grado máx.', st.maxDeg], ['Grado mín.', st.minDeg], ['Densidad', st.vertices > 1 ? (2 * st.edges / (st.vertices * (st.vertices - 1))).toFixed(2) : '—']];
    const origin = selection?.type === 'node' ? selection.id : null;
    const t = graphTraversals(a, origin);
    const joinList = v => v.map(esc).join('<span class="sep">,</span> ');
    const trav = [
      ['BFS (por niveles)', joinList(t.bfs)],
      ['DFS (en profundidad)', joinList(t.dfs)],
      [a.weighted ? 'Distancias (Dijkstra)' : 'Distancias (en aristas)', t.dist.map(([k, d]) => `${esc(k)} <b>${fmtDist(d)}</b>`).join('<span class="sep"> ·</span> ')],
    ];
    if (t.topo) trav.push(['Orden topológico', joinList(t.topo)]);
    if (a.components.length > 1) trav.push(['Componentes', a.components.map(c => `{${c.map(id => esc(display(a.model.byId.get(id)))).join(', ')}}`).join(' ')]);
    box.innerHTML = `
      <h3>Datos del grafo</h3>
      <dl class="stats-grid">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <h4>Desde «${esc(t.originLabel)}»</h4>
      <dl class="travs">${trav.map(([k, v]) => `<div class="trav"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <p class="muted small travs-note">${origin ? '' : 'Tocá un vértice para usarlo como origen. '}Los vecinos se visitan de menor a mayor.</p>`;
  }

  function renderStats() {
    if (analysis.graph) return renderGraphStats();
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
    const e = p.mode === 'weight' ? Store.state.edges.find(x => edgeKey(x) === p.key) : null;
    editor.value = n ? n.value : e ? String(e.w ?? 1) : '';
    editor.placeholder = p.mode === 'create' ? 'valor' : p.mode === 'weight' ? 'peso' : '';
    editor.classList.toggle('weight', p.mode === 'weight');
    editor.hidden = false;
    positionEditor();
    scheduleRender();
    requestAnimationFrame(() => { editor.focus(); editor.select(); });
  }

  function positionEditor() {
    if (!pending) return;
    let n = pending.mode === 'edit' ? Store.node(pending.id) : pending;
    if (pending.mode === 'weight') {
      const e = Store.state.edges.find(x => edgeKey(x) === pending.key);
      const s = Store.state;
      n = e && edgeGeom(e, s.directed ? new Set(s.edges.map(edgeKey)) : null)?.mid;
    }
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
    if (p.mode === 'weight') {
      if (commit) setWeight(p.key, val);
    } else if (commit && p.mode === 'edit') {
      const n = Store.node(p.id);
      if (n && n.value !== val) Store.mutate(s => { s.nodes.find(x => x.id === p.id).value = val; });
    } else if (commit && p.mode === 'create' && val !== '') {
      let key = null;
      Store.mutate(s => {
        const n = Store.addNode(s, p.x, p.y, val);
        if (p.parent && Store.node(p.parent)) {
          Store.link(s, p.parent, n.id);
          key = `${p.parent}>${n.id}`;
        }
        selection = { type: 'node', id: n.id };
      });
      if (key && isGraph() && Store.state.weighted) {
        selection = { type: 'edge', id: key };
        openEditor({ mode: 'weight', key });
      }
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
    // En un grafo ponderado se pide el peso de la arista nueva.
    if (isGraph() && Store.state.weighted) {
      const key = `${from}>${to}`;
      selection = { type: 'edge', id: key };
      openEditor({ mode: 'weight', key });
    }
  }

  function setWeight(key, raw) {
    const val = String(raw).trim();
    if (!/^-?\d{1,5}$/.test(val)) {
      if (val !== '') toast('El peso tiene que ser un número entero (por ejemplo 4 o -2).', 'error');
      return;
    }
    const e = Store.state.edges.find(x => edgeKey(x) === key);
    if (e && e.w !== +val) Store.mutate(s => { s.edges.find(x => edgeKey(x) === key).w = +val; });
  }

  /** Un lugar libre cerca de `n` para un vértice nuevo (sin pisar a los de `others`). */
  function freeSpotNear(n, others = Store.state.nodes) {
    for (let r = 110; r < 600; r += 50) {
      for (let k = 0; k < 12; k++) {
        const t = Math.PI / 2 - (k * Math.PI) / 6;
        const p = { x: Math.round(n.x + r * Math.cos(t) * (k % 2 ? -1 : 1)), y: Math.round(n.y + r * Math.sin(t)) };
        if (!others.some(o => Math.hypot(o.x - p.x, o.y - p.y) < R * 3)) return p;
      }
    }
    return { x: n.x + 90, y: n.y + 90 };
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
      case 'add-adjacent': openEditor({ mode: 'create', parent: id, ...freeSpotNear(Store.node(id)) }); break;
      case 'isolate': Store.mutate(s => { s.edges = s.edges.filter(x => x.from !== id && x.to !== id); }); break;
      case 'reverse': {
        const [from, to] = id.split('>');
        if (Store.state.edges.some(x => x.from === to && x.to === from)) { toast('Ya existe la arista en el otro sentido.', 'error'); break; }
        Store.mutate(s => { const x = s.edges.find(ed => edgeKey(ed) === id); x.from = to; x.to = from; });
        selection = { type: 'edge', id: `${to}>${from}` };
        break;
      }
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
  panel.addEventListener('change', e => {
    if (e.target.id === 'edgeWeight' && selection?.type === 'edge' && !locked) setWeight(selection.id, e.target.value);
  });
  panel.addEventListener('keydown', e => {
    if (e.target.id === 'edgeWeight' && e.key === 'Enter') { e.target.blur(); return; }
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
    if (!val || locked || isGraph()) return false;
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
      const key = edgeEl.dataset.edge;
      select({ type: 'edge', id: key });
      if (isDoubleTap('e:' + key) && isGraph() && Store.state.weighted) openEditor({ mode: 'weight', key });
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
    const s = Store.state;
    Store.replace({ nodes: [], edges: [], nextId: 1, directed: s.directed, weighted: s.weighted });
    selection = null;
    toast('Lienzo vacío. Podés deshacer con Ctrl/⌘+Z.');
  });

  const selExample = $('#selExample');
  const examples = () => (isGraph() ? GRAPH_EXAMPLES : EXAMPLES);
  function renderExamples() {
    selExample.replaceChildren(new Option('Ejemplos…', ''), ...examples().map(ex => new Option(ex.name, ex.id)));
  }
  selExample.addEventListener('change', () => {
    const ex = examples().find(x => x.id === selExample.value);
    selExample.value = '';
    if (!ex) return;
    Store.replace(isGraph() ? buildGraphExample(ex) : buildExample(ex));
    selection = null;
    fitView();
    selExample.blur();
  });

  $('#btnExport').addEventListener('click', () => {
    const { nodes, edges, directed, weighted } = Store.state;
    const extra = isGraph() ? { kind: 'graph', directed, weighted } : { kind: 'tree' };
    const data = JSON.stringify({ format: 'treedrawer', version: 2, ...extra, nodes, edges }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: isGraph() ? 'grafo.json' : 'arbol.json' });
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
      setSpace(data.kind === 'graph' ? 'graph' : 'tree');
      Store.replace(data);
      selection = null;
      fitView();
      toast(`Importados ${Store.state.nodes.length} ${isGraph() ? 'vértices' : 'nodos'}.`, 'ok');
    } catch {
      toast('No se pudo leer el archivo: tiene que ser un JSON exportado por TreeDrawer.', 'error');
    }
  });

  const chkMetrics = $('#chkMetrics'), chkSides = $('#chkSides');
  chkMetrics.checked = prefs.metrics;
  chkSides.checked = prefs.sides;
  chkMetrics.addEventListener('change', () => { prefs.metrics = chkMetrics.checked; savePrefs(); scheduleRender(); });
  chkSides.addEventListener('change', () => { prefs.sides = chkSides.checked; savePrefs(); scheduleRender(); });

  const chkDegrees = $('#chkDegrees');
  chkDegrees.checked = prefs.degrees;
  chkDegrees.addEventListener('change', () => { prefs.degrees = chkDegrees.checked; savePrefs(); scheduleRender(); });
  $('#chkDirected').addEventListener('change', e => {
    if (locked || !isGraph()) return;
    const directed = e.target.checked;
    const merged = Store.mutate(s => Store.setDirected(s, directed));
    toast(directed
      ? 'Ahora es dirigido: cada arista va en el sentido en que la dibujaste.'
      : merged ? `Ahora es no dirigido: se unieron ${merged} ${merged === 1 ? 'par' : 'pares'} de aristas opuestas.` : 'Ahora es no dirigido.');
  });
  $('#chkWeighted').addEventListener('change', e => {
    if (locked || !isGraph()) return;
    const weighted = e.target.checked;
    Store.mutate(s => { s.weighted = weighted; });
    if (weighted) toast('Doble clic en una arista para cambiar su peso.');
  });

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

  // ---------- espacio Árbol / Grafo ----------
  const EMPTY_TEXT = {
    tree: ['Doble clic para crear un nodo', 'Arrastrá desde el punto inferior de un nodo hacia otro para conectarlos,<br>o soltalo en un espacio vacío para crear un hijo.'],
    graph: ['Doble clic para crear un vértice', 'Arrastrá desde el punto inferior de un vértice hacia otro para unirlos con una arista,<br>o soltalo en un espacio vacío para crear un vértice adyacente.'],
  };

  function applySpace() {
    const space = Store.kind;
    document.body.dataset.space = space;
    document.querySelectorAll('.space-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.space === space)));
    const [big, how] = EMPTY_TEXT[space];
    emptyState.querySelector('.big').textContent = big;
    emptyState.querySelector('.how').innerHTML = how;
    svg.setAttribute('aria-label', space === 'graph' ? 'Lienzo del grafo' : 'Lienzo del árbol');
    renderExamples();
  }

  /** Cambia entre el espacio de árboles y el de grafos (cada uno guarda su propio dibujo). */
  function setSpace(space) {
    if (space === Store.kind || locked) return;
    finishEditor(true);
    selection = null;
    Store.setKind(space);
    prefs.space = space;
    savePrefs();
    applySpace();
    render();
    fitView();
    if (typeof Runner !== 'undefined') Runner.onSpaceChange(space);
  }
  document.querySelectorAll('.space-tabs button').forEach(b => b.addEventListener('click', () => setSpace(b.dataset.space)));

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
    setSpace,
    freeSpotNear,
    get space() { return Store.kind; },
    get analysis() { return analysis; },
    viewCenter() {
      const r = svg.getBoundingClientRect();
      return toWorld({ x: r.width / 2, y: r.height / 3 });
    },
  };

  // ---------- inicio ----------
  applyTheme();
  Store.restore();
  Store.setKind(prefs.space === 'graph' ? 'graph' : 'tree');
  applySpace();
  document.body.dataset.mode = 'draw';
  render();
  fitView();
})();
