/*
 * Modo Programar: editor, ejecución paso a paso y visualización sobre el árbol o el grafo.
 * El intérprete trabaja sobre JNode (árboles) o Vertice/Arista (grafos) propios; después de
 * cada paso se vuelcan al lienzo (valores, aristas, nodos nuevos o sueltos).
 */
const Runner = (() => {
  const $ = s => document.querySelector(s);
  const { fmt, JNode, JVertex, JEdge, JMap, JSet, JList, RuntimeErr } = JSInterp;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MAX_STEPS = 2_000_000;
  const MUTATOR_NAME = /insert|elimin|borr|agreg|quitar|rotar|espejo|reempl|podar|remove|delete|add/i;

  const editor = CodeEditor.create($('#codeEditor'), { onChange: onCodeChange });
  const callInput = $('#callInput');
  const statusEl = $('#codeStatus');
  const fnList = $('#fnList');
  const consoleEl = $('#console');
  const stackCard = $('#stackCard');
  const runInfo = $('#runInfo');
  const btnRun = $('#btnRun'), btnStep = $('#btnStep'), btnEnd = $('#btnEnd'), btnStop = $('#btnStop');
  const speed = $('#speed');
  const selCode = $('#codeExample');
  const treeRow = $('#treeRow');
  const treeClassSel = $('#treeClass');
  const btnExample = $('#btnExample');
  const btnDrawing = $('#btnDrawing');
  const solutionBanner = $('#solutionBanner');
  const langButtons = document.querySelectorAll('#langSwitch [data-lang]');
  const objNameEl = $('#objName');
  // Nombres de variables que suelen guardar un vértice (o su dato), para marcarlos en el dibujo.
  const VERTEX_VAR = /^(v|u|w|vertice|vert|actual|vecino|ady|adyacente|origen|destino|desde|hasta|inicio|fin|nodo|siguiente|sig|previo|anterior|padre|hijo|dato|elegido|mejor|cur|current|next|src|dst|dest)\d*$/i;
  const VISITED_VAR = /visit|marcad/i;
  const QUEUE_VAR = /cola|queue|pila|stack|frontera|pendiente|abierto|porVisitar/i;
  const CURRENT_VAR = /^(actual|act|cur|current|u|v|vertice)$/i;

  let lang = 'js';
  let program = null;       // código del editor (tuyo o el ejemplo correcto)
  let lastGood = null;      // último código del editor que compiló
  let parseErr = null;
  let parseTimer = 0;
  let exercise = null;
  let session = null;
  let viewingSolution = false;
  const drafts = new Map(); // «ejercicio:lenguaje» → tu código (solo en memoria)
  const lastExercise = { tree: 'ab', graph: 'grafo' };

  const space = () => (typeof App !== 'undefined' ? App.space : 'tree');
  const isGraphSpace = () => space() === 'graph';
  const objName = () => (isGraphSpace() ? 'grafo' : 'arbol');

  const parser = () => LANGS[lang].parser();
  const draftKey = () => `${exercise.id}:${lang}`;
  const userCode = () => (viewingSolution ? drafts.get(draftKey()) ?? Exercise.starter(exercise, lang) : editor.value);

  // ---------- código ----------
  function parseNow() {
    clearTimeout(parseTimer);
    try {
      program = parser().parseProgram(editor.value);
      program.lang = lang;
      lastGood = program;
      parseErr = null;
    } catch (err) {
      program = null;
      parseErr = err;
      if (!(err instanceof JSParser.SyntaxErr)) console.error(err);
    }
    renderStatus();
    renderTreeClasses();
    renderFnList();
    if (!session) editor.setMarks({ error: parseErr?.line ?? null });
    return !parseErr;
  }

  /** Programa a ejecutar: las clases incluidas del ejercicio + el código del editor. */
  function runnableProgram() {
    const pre = Exercise.prelude(exercise, lang);
    if (!pre) return program;
    const mine = new Set(program.body.filter(d => d.t === 'classdecl').map(d => d.name));
    return { t: 'program', lang, body: [...pre.body.filter(d => !(d.t === 'classdecl' && mine.has(d.name))), ...program.body] };
  }

  // ---------- clase de «arbol» ----------
  const ORDERED = new Set(['ArbolBinarioBusqueda', 'ArbolAVL']);

  /** Clases disponibles: las incluidas por el ejercicio y las del editor. */
  function userClasses() {
    const own = (lastGood?.body ?? []).filter(s => s.t === 'classdecl').map(s => s.name);
    const provided = exercise?.provides ?? [];
    return [...new Set([...provided, ...own])];
  }

  /** Las clases de búsqueda necesitan un dibujo ordenado (ABB o AVL) o vacío. */
  function compatible(name, kind) {
    if (kind === 'AG') return false;
    return !ORDERED.has(name) || ['ABB', 'AVL', 'EMPTY'].includes(kind);
  }

  function autoClass(kind) {
    const names = userClasses();
    if (isGraphSpace()) {
      if (exercise?.cls && names.includes(exercise.cls)) return exercise.cls;
      return names.includes('Grafo') ? 'Grafo' : names.find(n => !CLASS_ORDER.includes(n)) ?? null;
    }
    if (kind === 'AG' || !names.length) return null;
    if (exercise?.cls && names.includes(exercise.cls) && compatible(exercise.cls, kind)) return exercise.cls;
    return ['ArbolAVL', 'ArbolBinarioBusqueda', 'ArbolBinario'].find(n => names.includes(n) && compatible(n, kind))
      ?? names.find(n => !CLASS_ORDER.includes(n)) ?? null;
  }

  function currentKind() {
    return isGraphSpace() ? analyzeGraph(Store.state).kind : analyzeTree(Store.state.nodes, Store.state.edges).kind;
  }

  /** Clase con la que se crea «arbol» (o null: objeto simple con raiz). */
  function resolveTreeClass(kind = currentKind()) {
    const v = treeClassSel.value;
    if (v === '__none') return null;
    if (v && v !== '__auto' && userClasses().includes(v)) return v;
    return autoClass(kind);
  }

  function renderTreeClasses() {
    const names = userClasses();
    objNameEl.textContent = objName();
    treeClassSel.setAttribute('aria-label', `Clase de ${objName()}`);
    treeRow.hidden = !names.length;
    if (!names.length) return;
    const cur = treeClassSel.value || '__auto';
    const auto = autoClass(currentKind());
    treeClassSel.innerHTML =
      `<option value="__auto">Automático${auto ? ` (${auto})` : ' (sin clase)'}</option>` +
      names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('') +
      `<option value="__none">${isGraphSpace() ? 'Sin clase (objeto con vertices)' : 'Sin clase (solo raiz)'}</option>`;
    treeClassSel.value = [...treeClassSel.options].some(o => o.value === cur) ? cur : '__auto';
  }
  treeClassSel.addEventListener('pointerdown', renderTreeClasses);
  treeClassSel.addEventListener('focus', renderTreeClasses);
  treeClassSel.addEventListener('change', renderFnList);

  function onCodeChange() {
    if (session && !isActive()) clearSession();
    clearTimeout(parseTimer);
    parseTimer = setTimeout(parseNow, 350);
  }

  function functionsOf(prog) {
    const out = [];
    for (const s of prog?.body ?? []) {
      if (s.t === 'funcdecl') out.push({ name: s.name, params: s.params });
      if (s.t === 'var') for (const d of s.decls) if (d.init?.t === 'funcexpr') out.push({ name: d.name, params: d.init.params });
    }
    return out;
  }

  function renderStatus() {
    if (viewingSolution && !parseErr) {
      statusEl.dataset.state = 'ok';
      statusEl.textContent = 'Ejemplo correcto · solo lectura · podés ejecutarlo';
      return;
    }
    if (parseErr) {
      statusEl.dataset.state = 'error';
      statusEl.textContent = `Línea ${parseErr.line ?? '?'}: ${parseErr.message}`;
      return;
    }
    const onlyThrows = fn => fn.body.body.length === 0 || (fn.body.body.length === 1 && fn.body.body[0].t === 'throw');
    const classes = program.body.filter(x => x.t === 'classdecl');
    const fns = program.body.filter(x => x.t === 'funcdecl');
    const pending = classes.reduce((acc, c) => acc + c.methods.filter(m => onlyThrows(m.fn)).length, 0) + fns.filter(onlyThrows).length;
    const parts = [];
    if (classes.length) parts.push(`${classes.length} ${classes.length === 1 ? 'clase' : 'clases'}`);
    if (fns.length) parts.push(`${fns.length} ${fns.length === 1 ? 'función' : 'funciones'}`);
    parts.push(pending ? `${pending} por implementar` : 'todo implementado');
    statusEl.dataset.state = 'ok';
    statusEl.textContent = `Sin errores · ${parts.join(' · ')}`;
  }

  /**
   * Valor de un vértice escrito como en el código: 3 o "A". Los datos son números solo si
   * todos los vértices lo son (si hay una letra, "3" también es un String).
   */
  function vertexLiteral(n, numeric) {
    const k = keyOf(n);
    return numeric ? String(Number(k)) : JSON.stringify(k);
  }

  /** Reemplaza {v} y {w} por el primer y el último vértice del dibujo (en orden). */
  function fillCall(call) {
    if (!/\{[vw]\}/.test(call)) return call;
    const nodes = [...Store.state.nodes].sort(vertexComparator(Store.state.nodes).cmp);
    const numeric = nodes.every(n => NUMERIC_RE.test(keyOf(n)));
    const v = nodes.length ? vertexLiteral(nodes[0], numeric) : '1';
    const w = nodes.length > 1 ? vertexLiteral(nodes[nodes.length - 1], numeric) : '2';
    return call.replaceAll('{v}', v).replaceAll('{w}', w);
  }

  /** Pone la llamada sugerida del ejercicio; mientras no la edites, sigue a los vértices del dibujo. */
  let autoCall = null;
  function setDefaultCall() {
    autoCall = fillCall(Exercise.call(exercise, lang));
    callInput.value = autoCall;
  }
  function refreshDefaultCall() {
    if (exercise && callInput.value.trim() === autoCall) setDefaultCall();
  }

  function setCall(call) {
    callInput.value = fillCall(call);
    callInput.focus();
    const q = callInput.value.indexOf('?');
    if (q >= 0) callInput.setSelectionRange(q, q + 1);
  }

  const structureOf = name => [...TREE_STRUCTURE, ...GRAPH_STRUCTURE].find(c => c.name === name && !c.builtin);

  function renderFnList() {
    const chips = [];
    const obj = objName();
    const cls = structureOf(resolveTreeClass());
    // En los ejercicios de funciones la clase viene incluida: las fichas son solo tus funciones.
    const provided = exercise?.kind === 'functions' && exercise.provides?.includes(cls?.name);
    if (cls && !provided) {
      for (const m of cls.methods) {
        const label = lang === 'java' ? `${obj}.${m.jsig.replace(/^\S+\s+/, '')}` : `${obj}.${m.sig}`;
        chips.push({ label, call: structureCall(m, obj) });
      }
    }
    const GRAPH_ARG = { grafo: 'grafo', g: 'grafo', dato: '{v}', origen: '{v}', inicio: '{v}', desde: '{v}', v: '{v}', destino: '{w}', hasta: '{w}', fin: '{w}', w: '{w}' };
    for (const f of functionsOf(program)) {
      const args = f.params.filter(p => !p.def && !p.rest).map((p, i) => (isGraphSpace() ? GRAPH_ARG[p.name] ?? (i === 0 ? 'grafo' : '?') : i === 0 ? 'raiz' : '?'));
      const call = `${f.name}(${args.join(', ')})`;
      chips.push({
        label: `${f.name}(${f.params.map(p => p.name).join(', ')})`,
        call: MUTATOR_NAME.test(f.name) && args[0] === 'raiz' && f.name !== 'espejo' ? `raiz = ${call}` : call,
      });
    }
    fnList.innerHTML = chips.map((c, i) =>
      `<button type="button" class="fn-chip" data-i="${i}" title="Usar en la línea de ejecución">${esc(c.label)}</button>`
    ).join('');
    fnList.onclick = e => {
      const b = e.target.closest('.fn-chip');
      if (b && !isActive()) setCall(chips[+b.dataset.i].call);
    };
  }

  // ---------- sesión ----------
  const isActive = () => !!session && ['running', 'paused', 'fast'].includes(session.status);

  function startSession() {
    clearSession();
    refreshDefaultCall();
    if (!parseNow()) {
      App.toast('Hay un error en el código: corregilo antes de ejecutar.', 'error');
      return false;
    }
    let line;
    try {
      line = parser().parseLine(callInput.value);
      callInput.classList.remove('has-error');
    } catch (err) {
      callInput.classList.add('has-error');
      App.toast(`Línea de ejecución: ${err.message}`, 'error');
      return false;
    }
    if (isGraphSpace()) return startGraphSession(line);
    const { nodes, edges } = Store.state;
    const a = analyzeTree(nodes, edges);
    if (a.kind === 'NONE') {
      App.toast('Para ejecutar, el lienzo tiene que ser un único árbol (o estar vacío). Revisá el panel de Dibujar.', 'error');
      return false;
    }
    const keys = nodes.map(n => keyOf(n));
    if (keys.some(k => k === '')) {
      App.toast('Hay nodos sin valor: completalos antes de ejecutar.', 'error');
      return false;
    }
    const numeric = keys.every(k => NUMERIC_RE.test(k));
    const general = a.kind === 'AG';
    const heap = new Map(nodes.map(n => [n.id, new JNode(n.id, numeric ? Number(keyOf(n)) : keyOf(n), general)]));
    for (const [id, jn] of heap) {
      jn.altura = a.info.get(id)?.height ?? 1;
      if (general) jn.hijos.push(...a.structure.kids.get(id).map(k => heap.get(k)));
      else {
        const l = a.structure.left(id), r = a.structure.right(id);
        jn.izq = l === null ? null : heap.get(l);
        jn.der = r === null ? null : heap.get(r);
      }
    }
    const rootStore = a.root ? Store.node(a.root) : null;
    session = {
      space: 'tree',
      status: 'paused',
      general,
      mutated: false,
      anchor: rootStore ? { x: rootStore.x, y: rootStore.y } : App.viewCenter(),
      visited: new Set(),
      returns: new Map(),
      result: undefined,
      resultNode: null,
      error: null,
      errorInCall: false,
      lastEvent: null,
      steps: 0,
      timer: 0,
      callText: callInput.value.trim(),
      assignsRoot: /(^|[;\n])\s*(arbol\.)?raiz\s*=[^=]/.test(callInput.value),
      treeClass: resolveTreeClass(a.kind),
      lang,
    };
    const interp = new JSInterp.Interpreter(runnableProgram(), {
      root: a.root ? heap.get(a.root) : null,
      general,
      treeClass: session.treeClass,
      allocId: () => 'n' + Store.state.nextId++,
      onMutate: markMutated,
    });
    if (general) heap.forEach(n => interp.trackHijos(n));
    session.interp = interp;
    session.gen = interp.run(line);
    session.graph = interp.graph();
    session.sig = graphSig(session.graph);
    App.setLocked(true);
    editor.setReadOnly(true);
    callInput.readOnly = true;
    return true;
  }

  /** Grafo: los vértices (en orden creciente) con sus aristas, también en orden, como listas de adyacencia. */
  function startGraphSession(line) {
    const st = Store.state;
    const a = analyzeGraph(st);
    const keys = st.nodes.map(n => keyOf(n));
    if (keys.some(k => k === '')) {
      App.toast('Hay vértices sin valor: completalos antes de ejecutar.', 'error');
      return false;
    }
    const dup = keys.find((k, i) => keys.indexOf(k) !== i);
    if (dup !== undefined) {
      App.toast(`«${dup}» está en más de un vértice: cada vértice necesita un valor distinto para poder buscarlo.`, 'error');
      return false;
    }
    const m = a.model;
    const dato = id => (m.numeric ? Number(keyOf(m.byId.get(id))) : keyOf(m.byId.get(id)));
    const spec = {
      directed: !!st.directed,
      vertices: m.order.map(id => ({ id, dato: dato(id), ady: m.out.get(id).map(to => ({ to, w: m.weight.get(`${id}>${to}`) })) })),
    };
    session = {
      space: 'graph',
      status: 'paused',
      directed: spec.directed,
      mutated: false,
      anchor: App.viewCenter(),
      visited: new Set(),
      returns: new Map(),
      result: undefined,
      resultNode: null,
      error: null,
      errorInCall: false,
      lastEvent: null,
      steps: 0,
      timer: 0,
      callText: callInput.value.trim(),
      treeClass: resolveTreeClass(a.kind),
      lang,
      sig: null,
      edgeWarn: new Map(),
      edgeOf: new Map(),
      datoIndex: new Map(),
    };
    const interp = new JSInterp.Interpreter(runnableProgram(), {
      graph: spec,
      treeClass: session.treeClass,
      allocId: () => 'n' + Store.state.nextId++,
      onMutate: markMutated,
    });
    session.interp = interp;
    session.gen = interp.run(line);
    // Antes del primer paso el grafo es el dibujado (el intérprete lo arma al arrancar).
    session.graph = {
      nodes: spec.vertices.map(v => ({ id: v.id, dato: v.dato })),
      edges: spec.vertices.flatMap(v => v.ady.map(a => ({ from: v.id, to: a.to, w: a.w, edge: null }))),
      main: new Set(spec.vertices.map(v => v.id)),
    };
    session.sig = graphViewOf(session.graph).sig;
    App.setLocked(true);
    editor.setReadOnly(true);
    callInput.readOnly = true;
    return true;
  }

  function markMutated() {
    if (session && !session.mutated) {
      Store.checkpoint();
      session.mutated = true;
    }
  }

  function unlock() {
    App.setLocked(false);
    editor.setReadOnly(viewingSolution);
    callInput.readOnly = false;
  }

  function stopTimer() {
    if (session) clearTimeout(session.timer);
  }

  function clearSession() {
    if (!session) return;
    stopTimer();
    if (isActive()) unlock();
    session = null;
    callInput.classList.remove('has-error');
    editor.setMarks({ error: parseErr?.line ?? null });
    stackCard.hidden = true;
    renderConsole();
    renderControls();
    App.render();
  }

  /** Avanza un evento. Devuelve 'event', 'done' o 'error'. */
  function advance() {
    let r;
    try {
      r = session.gen.next();
    } catch (err) {
      fail(err);
      return 'error';
    }
    session.steps++;
    if (r.done) {
      finish(r.value);
      return 'done';
    }
    const ev = r.value;
    session.lastEvent = ev;
    const it = session.interp;
    if (ev.kind === 'call') {
      const n = focusOf(ev.frame);
      if (n) { session.visited.add(n.id); session.returns.delete(n.id); }
    } else if (ev.kind === 'return') {
      const n = focusOf(ev.frame);
      if (n && ev.value !== undefined) session.returns.set(n.id, shortValue(ev.value));
    }
    return 'event';
  }

  /** Resultado final: en Java un método void no devuelve nada. */
  function resultText(v) {
    return v === undefined && session?.lang === 'java' ? 'void (no devuelve nada)' : fmt(v, 0, false);
  }

  function shortValue(v) {
    const s = v instanceof JNode ? `«${v.valor}»` : fmt(v, 1, false);
    return s.length > 16 ? s.slice(0, 15) + '…' : s;
  }

  /** Variables locales: las colecciones (colas, mapas de distancias…) se muestran más largas. */
  function localValue(v) {
    if (!(v instanceof JList || v instanceof JMap || v instanceof JSet || Array.isArray(v))) return shortValue(v);
    const s = fmt(v, 1, false);
    return s.length > 60 ? s.slice(0, 59) + '…' : s;
  }

  /** Clave para buscar un vértice por su dato (3 y "3" son distintos). */
  const datoKey = v => `${typeof v}:${v}`;

  /** El vértice que corresponde a un valor: el propio Vertice o el vértice con ese dato. */
  function vertexFor(v) {
    if (v instanceof JVertex) return v;
    if (typeof v === 'number' || typeof v === 'string') return session.datoIndex.get(datoKey(v)) ?? null;
    return null;
  }

  /**
   * Nodo (o vértice) en foco de una llamada: su primer parámetro que sea un nodo o un vértice;
   * en los grafos también el primer parámetro con nombre de vértice (origen, v, actual…) que
   * tenga el dato de un vértice.
   */
  function focusOf(f) {
    if (!f || f.isMain) return null;
    const direct = session.interp.frameNode(f);
    if (direct || session.space !== 'graph' || !f.fn) return direct;
    for (const p of f.fn.decl.params) {
      if (!VERTEX_VAR.test(p.name)) continue;
      const hit = vertexFor(f.baseEnv.vars.get(p.name)?.v);
      if (hit) return hit;
    }
    return null;
  }

  function topFrame() {
    const st = session?.interp.stack;
    return st?.[st.length - 1] ?? null;
  }

  function hitBreakpoint() {
    const ev = session.lastEvent;
    return ev?.kind === 'step' && editor.breakpoints.has(ev.line);
  }

  function finish(value) {
    stopTimer();
    session.status = 'done';
    session.result = value;
    if (value instanceof JNode || value instanceof JVertex) session.resultNode = value.id;
    unlock();
  }

  function fail(err) {
    stopTimer();
    const top = topFrame();
    let e = err;
    if (err instanceof RangeError && /call stack/i.test(err.message)) {
      e = new RuntimeErr('RangeError: la recursión es demasiado profunda (se llenó la pila). ¿Falta el caso base o no se acerca a él?', { line: top?.line }, 'RangeError');
    } else if (!(err instanceof RuntimeErr)) {
      console.error(err);
      e = new RuntimeErr(`Error interno del intérprete: ${err.message}`, { line: top?.line });
    }
    if (lang === 'java') e.message = e.message.replace(/^(TypeError|ReferenceError|SyntaxError): /, '');
    session.status = 'error';
    session.error = e;
    session.errorInCall = !!top?.isMain;
    session.errorInLib = !!top?.lib;
    unlock();
  }

  // ---------- controles ----------
  function delay() {
    const v = +speed.value;
    return Math.round(1100 * Math.pow(1 - v / 100, 2)) + 15;
  }

  function play() {
    if (!isActive() && !startSession()) return;
    session.status = 'running';
    renderControls();
    tick();
  }

  function pause() {
    if (!session) return;
    stopTimer();
    if (isActive()) session.status = 'paused';
    refresh();
  }

  function tick() {
    if (!session || session.status !== 'running') return;
    const r = advance();
    refresh();
    if (r !== 'event') return;
    if (hitBreakpoint()) {
      session.status = 'paused';
      refresh();
      App.toast(`Pausa en el breakpoint de la línea ${session.lastEvent.line}.`);
      return;
    }
    session.timer = setTimeout(tick, delay());
  }

  function stepOnce() {
    if (!isActive()) {
      if (!startSession()) return;
    } else if (session.status !== 'paused') {
      return;
    }
    advance();
    refresh();
  }

  function runToEnd() {
    if (!isActive() && !startSession()) return;
    stopTimer();
    session.status = 'fast';
    renderControls();
    let first = true;
    const chunk = () => {
      if (!session || session.status !== 'fast') return;
      const t0 = performance.now();
      while (performance.now() - t0 < 25) {
        const r = advance();
        if (r !== 'event') { refresh(); return; }
        if (!first && hitBreakpoint()) {
          session.status = 'paused';
          refresh();
          App.toast(`Pausa en el breakpoint de la línea ${session.lastEvent.line}.`);
          return;
        }
        first = false;
        if (session.steps > MAX_STEPS) {
          session.status = 'paused';
          refresh();
          App.toast(`Van ${MAX_STEPS.toLocaleString('es')} pasos y no terminó: ¿hay un bucle infinito? Quedó en pausa.`, 'error');
          return;
        }
      }
      runInfo.textContent = `Ejecutando… ${session.steps.toLocaleString('es')} pasos`;
      session.timer = setTimeout(chunk, 0);
    };
    chunk();
  }

  function stop() {
    if (!session) return;
    if (isActive()) {
      const mutated = session.mutated;
      const noun = session.space === 'graph' ? 'el grafo' : 'el árbol';
      stopTimer();
      unlock();
      session.status = 'stopped';
      if (mutated) Store.undo();
      clearSession();
      App.toast(mutated ? `Ejecución detenida: ${noun} volvió a como estaba.` : 'Ejecución detenida.');
    } else {
      clearSession();
    }
  }

  btnRun.addEventListener('click', () => (session?.status === 'running' ? pause() : play()));
  btnStep.addEventListener('click', stepOnce);
  btnEnd.addEventListener('click', runToEnd);
  btnStop.addEventListener('click', stop);
  callInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); if (!isActive()) play(); }
  });
  editor.textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (!isActive()) play(); }
  });

  // ---------- sincronización con el lienzo ----------
  function graphSig(g) {
    return g.edges.map(e => `${e.from}>${e.to}${e.side ?? ''}`).sort().join('|') + '#' + g.nodes.map(n => n.id).sort().join(',');
  }

  function spawnPoint() {
    const f = topFrame();
    const n = f && !f.isMain ? session.interp.frameNode(f) : null;
    const s = n && Store.node(n.id);
    return s ? { x: s.x + 46, y: s.y + 64 } : { ...session.anchor };
  }

  /**
   * Cómo se dibuja el estado del grafo. En un no dirigido, A→B y B→A (las dos entradas de la
   * lista de adyacencia) son una sola línea; si falta una de las dos, o los pesos no coinciden,
   * la arista queda marcada.
   */
  function graphViewOf(g) {
    const label = id => { const v = g.nodes.find(x => x.id === id); return v ? fmt(v.dato) : '?'; };
    const edges = [], warn = new Map(), edgeOf = new Map();
    if (session.directed) {
      for (const e of g.edges) {
        const key = `${e.from}>${e.to}`;
        edgeOf.set(e.edge, key);
        if (edges.some(x => x.from === e.from && x.to === e.to)) {
          warn.set(key, { text: `La arista ${label(e.from)} → ${label(e.to)} está repetida en la lista de adyacentes.` });
          continue;
        }
        edges.push({ from: e.from, to: e.to, w: e.w });
      }
    } else {
      const pairs = new Map();
      for (const e of g.edges) {
        const k = e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`;
        let p = pairs.get(k);
        if (!p) { p = { from: e.from, to: e.to, w: e.w, fwd: 0, back: 0, wBack: null }; pairs.set(k, p); }
        if (e.from === p.from) p.fwd++;
        else { p.back++; p.wBack = e.w; }
        edgeOf.set(e.edge, `${p.from}>${p.to}`);
      }
      for (const p of pairs.values()) {
        const key = `${p.from}>${p.to}`;
        const [a, b] = [label(p.from), label(p.to)];
        if (!p.back) warn.set(key, { oneWay: true, text: `Solo está ${a} → ${b}: en un grafo no dirigido falta la arista de vuelta (${b} → ${a}).` });
        else if (p.fwd > 1 || p.back > 1) warn.set(key, { text: `La arista ${a} — ${b} está repetida en la lista de adyacentes.` });
        else if (p.wBack !== p.w) warn.set(key, { text: `Los pesos de ida y vuelta no coinciden (${a} → ${b}: ${p.w}, ${b} → ${a}: ${p.wBack}).` });
        edges.push({ from: p.from, to: p.to, w: p.w });
      }
    }
    const sig = g.nodes.map(v => `${v.id}=${datoKey(v.dato)}`).join(',') + '#' + edges.map(e => `${e.from}>${e.to}/${e.w}`).join(',');
    return { edges, warn, edgeOf, sig };
  }

  /** Dónde aparecen los vértices nuevos: cerca del vértice en foco, o del centro de la vista. */
  function graphSpawnNear() {
    const f = focusOf(topFrame());
    return (f && Store.node(f.id)) || session.anchor;
  }

  function syncGraph() {
    const g = session.interp.graphState();
    session.graph = g;
    session.datoIndex = new Map();
    for (const v of g.nodes) if (!session.datoIndex.has(datoKey(v.dato))) session.datoIndex.set(datoKey(v.dato), v);
    const view = graphViewOf(g);
    session.edgeWarn = view.warn;
    session.edgeOf = view.edgeOf;
    if (view.sig === session.sig) { Store.touch(); return; }
    // Primer cambio: se guarda el dibujo original para poder volver (Detener o Ctrl+Z).
    markMutated();
    session.sig = view.sig;
    const st = Store.state;
    const old = new Map(st.nodes.map(n => [n.id, n]));
    const taken = g.nodes.filter(v => old.has(v.id)).map(v => old.get(v.id));
    const near = graphSpawnNear();
    st.nodes = g.nodes.map(v => {
      const value = String(v.dato);
      const o = old.get(v.id);
      if (!o) {
        // Los vértices nuevos se ubican de a uno, sin pisar a los demás.
        const n = { id: v.id, value, ...App.freeSpotNear(near, taken) };
        taken.push(n);
        return n;
      }
      if (keyOf(o) !== value && !(typeof v.dato === 'number' && Number(keyOf(o)) === v.dato)) o.value = value;
      return o;
    });
    st.edges = view.edges;
    Store.touch();
  }

  function sync() {
    if (session.space === 'graph') return syncGraph();
    const it = session.interp;
    const g = it.graph();
    const st = Store.state;
    const old = new Map(st.nodes.map(n => [n.id, n]));
    const spawn = spawnPoint();
    const byId = new Map(g.nodes.map(n => [n.id, n]));
    st.nodes = g.nodes.map(jn => {
      const value = String(jn.valor);
      const o = old.get(jn.id);
      if (!o) return { id: jn.id, value, x: spawn.x, y: spawn.y };
      const same = keyOf(o) === value || (typeof jn.valor === 'number' && Number(keyOf(o)) === jn.valor);
      if (!same) o.value = value;
      return o;
    });
    st.edges = g.edges.map(({ from, to }) => ({ from, to }));
    session.graph = g;
    const sig = graphSig(g);
    if (sig !== session.sig) {
      session.sig = sig;
      const kidsOf = id => {
        const jn = byId.get(id);
        if (!jn) return [];
        return session.general ? jn.hijos.map(c => c.id) : [jn.izq?.id ?? null, jn.der?.id ?? null];
      };
      const roots = [g.rootId, ...g.floatingRoots].filter(Boolean);
      App.animateTo(layoutExplicit(roots, kidsOf, !session.general, session.anchor), { checkpoint: false });
    } else {
      Store.touch();
    }
  }

  function refresh() {
    if (!session) return;
    sync();
    renderStack();
    renderConsole();
    renderControls();
    renderMarks();
    App.render();
    if (session.status === 'done' && session.resultNode) App.ensureVisible(session.resultNode);
  }

  // ---------- paneles ----------
  function renderMarks() {
    if (!session) return;
    const it = session.interp;
    const frames = it.stack.filter(f => !f.isMain && !f.lib);
    if (session.status === 'error') {
      const hidden = session.errorInCall || session.errorInLib;
      editor.setMarks({ error: hidden ? null : session.error.line, stack: frames.map(f => f.line) });
      callInput.classList.toggle('has-error', session.errorInCall);
      return;
    }
    if (session.status === 'done') {
      editor.setMarks({});
      return;
    }
    const top = frames[frames.length - 1];
    editor.setMarks({
      active: top?.line ?? null,
      stack: frames.slice(0, -1).map(f => f.line),
      returning: session.lastEvent?.kind === 'return',
    });
  }

  function varList(f) {
    return session.interp.frameVars(f);
  }

  function renderStack() {
    if (!session) { stackCard.hidden = true; return; }
    const it = session.interp;
    const frames = it.stack.filter(f => !f.isMain).reverse();
    stackCard.hidden = false;
    const MAX = 10;
    const shown = frames.slice(0, MAX);
    let html = `<button type="button" class="stack-head" aria-expanded="${!stackCard.classList.contains('collapsed')}"><b>Pila de llamadas</b><span>${frames.length ? `${frames.length} ${frames.length === 1 ? 'llamada' : 'llamadas'}` : ''}</span></button>`;
    if (session.status === 'done') {
      html += `<div class="stack-result"><span>Resultado</span><code>${esc(resultText(session.result))}</code></div>`;
    } else if (session.status === 'error') {
      html += `<div class="stack-error">${esc(session.error.message)}</div>`;
    } else if (!frames.length) {
      html += '<p class="stack-empty">Todavía no se llamó a ninguna función.</p>';
    }
    if (shown.length) {
      html += '<ol class="frames">' + shown.map((f, i) => {
        const params = new Set(f.fn.decl.params.map(p => p.name));
        const vars = varList(f);
        const args = vars.filter(([k]) => params.has(k)).map(([k, v]) => `<span class="k">${esc(k)}</span>=<span class="v">${esc(shortValue(v))}</span>`).join(', ');
        const locals = vars.filter(([k]) => !params.has(k)).map(([k, v]) =>
          `<div class="var"><span class="k">${esc(k)}</span><span class="v">${v === undefined ? '<i>sin valor</i>' : esc(localValue(v))}</span></div>`
        ).join('');
        const ret = f.returned ? `<div class="ret">↩ ${esc(shortValue(f.result))}</div>` : '';
        const where = f.lib ? 'incluida' : `L${f.line ?? '?'}`;
        return `<li class="frame${i === 0 ? ' top' : ''}${f.lib ? ' lib' : ''}"><div class="sig"><b>${esc(f.name)}</b>(${args})<span class="ln">${where}</span></div>${locals}${ret}</li>`;
      }).join('') + '</ol>';
      if (frames.length > MAX) html += `<p class="stack-more">… y ${frames.length - MAX} llamadas más abajo</p>`;
    }
    const globals = [];
    if (it.arbol) globals.push(['arbol', it.arbol instanceof JSInterp.JInstance ? it.arbol.cls.name : 'objeto'], ['arbol.raiz', shortValue(it.getRoot())]);
    if (it.grafo) {
      const list = it.grafo.props.get('vertices');
      const n = list instanceof JList ? list.items.length : Array.isArray(list) ? list.length : '?';
      globals.push(['grafo', it.grafo instanceof JSInterp.JInstance ? it.grafo.cls.name : 'objeto'], ['vértices', n]);
    }
    for (const [k, en] of it.stack[0]?.env.vars ?? []) {
      if (!['function', 'class', 'this', 'hidden'].includes(en.kind)) globals.push([k, shortValue(en.v)]);
    }
    html += `<div class="globals">${globals.map(([k, v]) => `<span><span class="k">${esc(k)}</span> = <span class="v">${esc(v)}</span></span>`).join('')}</div>`;
    stackCard.innerHTML = html;
  }

  function renderConsole() {
    const out = session?.interp.out ?? [];
    let html = out.slice(-300).map(o => `<div class="c-line">${esc(o.text)}</div>`).join('');
    if (out.length > 300) html = `<div class="c-note">(se muestran las últimas 300 líneas)</div>` + html;
    if (session?.status === 'done') {
      html += `<div class="c-result"><span class="c-call">› ${esc(session.callText)}</span><span class="c-val">← ${esc(resultText(session.result))}</span></div>`;
      const g = session.graph;
      const lost = session.space === 'tree' && session.result instanceof JNode && !g.main.has(session.result.id) && !session.assignsRoot;
      if (lost) {
        const target = session.callText.startsWith('arbol.') ? 'arbol.raiz' : 'raiz';
        html += `<div class="c-note">Se devolvió un nodo que no quedó colgado de <b>${target}</b>. Si es la nueva raíz, ejecutá <code>${target} = ${esc(session.callText)}</code>.</div>`;
      }
      html += graphNotes();
      if (session.mutated) html += `<div class="c-note">${session.space === 'graph' ? 'El grafo' : 'El árbol'} cambió. Con Ctrl/⌘+Z volvés a como estaba.</div>`;
    }
    if (session?.status === 'error') {
      const where = session.errorInCall ? 'en la línea de ejecución'
        : session.errorInLib ? 'dentro de una clase incluida (revisá los datos que le pasás)'
        : `en la línea ${session.error.line ?? '?'}`;
      html += `<div class="c-error"><b>Error ${where}</b><br>${esc(session.error.message)}</div>`;
      if (session.mutated) html += `<div class="c-note">${session.space === 'graph' ? 'El grafo' : 'El árbol'} quedó como estaba al momento del error. Con Ctrl/⌘+Z volvés al original.</div>`;
    }
    consoleEl.innerHTML = html || '<div class="c-empty">Acá aparecen los console.log y el resultado.</div>';
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  /** Avisos sobre el grafo que quedó: aristas de un solo sentido, vértices fuera de la lista. */
  function graphNotes() {
    if (session.space !== 'graph') return '';
    let html = '';
    const oneWay = [...session.edgeWarn.values()].filter(w => w.oneWay).length;
    const other = session.edgeWarn.size - oneWay;
    if (oneWay) html += `<div class="c-note">${oneWay === 1 ? 'Una arista quedó' : `${oneWay} aristas quedaron`} en un solo sentido (con flecha naranja): en un grafo no dirigido cada arista va en la lista de adyacentes de sus dos vértices.</div>`;
    if (other) html += `<div class="c-note">Hay aristas repetidas o con pesos distintos de ida y vuelta (en naranja): pasá el mouse por encima para ver el detalle.</div>`;
    const lostV = session.graph.nodes.filter(v => !session.graph.main.has(v.id));
    if (lostV.length) html += `<div class="c-note">${lostV.map(v => `«${esc(fmt(v.dato))}»`).join(', ')} ${lostV.length === 1 ? 'no está' : 'no están'} en <b>grafo.vertices</b>, pero todavía hay aristas que llegan ${lostV.length === 1 ? 'a él' : 'a ellos'} (línea punteada).</div>`;
    return html;
  }

  function renderControls() {
    const st = session?.status;
    const active = isActive();
    btnRun.textContent = st === 'running' ? '⏸ Pausa' : st === 'paused' ? '▶ Continuar' : '▶ Ejecutar';
    btnRun.disabled = st === 'fast';
    btnStep.disabled = st === 'running' || st === 'fast';
    btnEnd.disabled = st === 'fast';
    btnStop.disabled = !session;
    btnStop.textContent = active ? '⏹ Detener' : '✕ Limpiar';
    btnStop.title = active ? 'Detener y volver al árbol original' : 'Borrar las marcas de la ejecución';
    selCode.disabled = active;
    treeClassSel.disabled = active;
    btnExample.disabled = active || !exercise || exercise.kind === 'free';
    btnDrawing.disabled = active || !exercise?.drawing;
    langButtons.forEach(b => { b.disabled = active; });
    document.querySelectorAll('.fn-chip').forEach(b => { b.disabled = active; });
    if (!session) runInfo.textContent = '';
    else if (st === 'done') runInfo.textContent = `Terminó en ${session.steps.toLocaleString('es')} ${session.steps === 1 ? 'paso' : 'pasos'}`;
    else if (st === 'error') runInfo.textContent = 'Terminó con error';
    else if (st !== 'fast') {
      const top = topFrame();
      runInfo.textContent = `Paso ${session.steps.toLocaleString('es')}${top && !top.isMain ? ` · ${top.name}, línea ${top.line}` : ''}`;
    }
  }

  stackCard.addEventListener('click', e => {
    const head = e.target.closest('.stack-head');
    if (!head) return;
    stackCard.classList.toggle('collapsed');
    head.setAttribute('aria-expanded', String(!stackCard.classList.contains('collapsed')));
  });

  // ---------- ejercicios ----------
  /** El selector muestra los ejercicios del espacio actual (árbol o grafo). */
  function renderExerciseOptions() {
    const list = EXERCISES.filter(x => Exercise.space(x) === space());
    selCode.replaceChildren(...[...new Set(list.map(x => x.group))].map(group => {
      const og = document.createElement('optgroup');
      og.label = group;
      for (const ex of list.filter(x => x.group === group)) og.append(new Option(ex.name, ex.id));
      return og;
    }));
    callInput.placeholder = isGraphSpace() ? 'bfs(grafo, 1)' : 'arbol.altura()';
  }

  /** Guarda tu código del ejercicio actual antes de cambiar de ejercicio, lenguaje o vista. */
  function saveDraft() {
    if (exercise && !viewingSolution) drafts.set(draftKey(), editor.value);
  }

  /** Muestra en el editor tu código (o el esqueleto) o el ejemplo correcto, según la vista. */
  function showCode() {
    const code = viewingSolution ? Exercise.solution(exercise, lang) : drafts.get(draftKey()) ?? Exercise.starter(exercise, lang);
    editor.setLang(lang);
    editor.setValue(code);
    editor.setReadOnly(viewingSolution);
    solutionBanner.hidden = !viewingSolution;
    document.body.classList.toggle('viewing-solution', viewingSolution);
    btnExample.textContent = viewingSolution ? 'Volver a mi código' : 'Ver ejemplo correcto';
    btnExample.classList.toggle('primary', viewingSolution);
    btnExample.title = viewingSolution ? 'Volver a tu código (queda como lo dejaste)' : 'Abrir una solución correcta para leerla y ejecutarla (tu código no se pierde)';
    parseNow();
  }

  /** Carga un ejercicio: tu borrador si ya lo empezaste, si no el esqueleto (nunca la solución). */
  function loadExercise(id) {
    const ex = EXERCISES.find(x => x.id === id);
    if (!ex) return;
    clearSession();
    saveDraft();
    exercise = ex;
    lastExercise[Exercise.space(ex)] = ex.id;
    viewingSolution = false;
    selCode.value = ex.id;
    treeClassSel.value = '__auto';
    renderDrawingButton();
    ensureDrawing();
    setDefaultCall();
    showCode();
    renderControls();
  }
  selCode.addEventListener('change', () => loadExercise(selCode.value));

  // ---------- dibujo de ejemplo del ejercicio ----------
  function renderDrawingButton() {
    const name = exercise?.drawing && App.exampleName(exercise.drawing);
    const what = isGraphSpace() ? 'un grafo' : 'un árbol';
    btnDrawing.title = name ? `Cargar en el lienzo ${what} para probar este ejercicio: «${name}» (se puede deshacer)` : '';
  }

  function loadDrawing() {
    if (isActive() || !exercise?.drawing) return;
    clearSession();
    const wasDefault = callInput.value.trim() === autoCall;
    const ex = App.loadExample(exercise.drawing);
    if (!ex) return;
    if (wasDefault) setDefaultCall();
    renderTreeClasses();
    App.toast(`Cargué «${ex.name}». Con Ctrl/⌘+Z volvés al dibujo anterior.`);
  }
  btnDrawing.addEventListener('click', loadDrawing);

  /** En Programar, un grafo vacío no muestra nada: se carga el grafo sugerido del ejercicio. */
  function ensureDrawing() {
    if (document.body.dataset.mode !== 'code' || !isGraphSpace() || Store.state.nodes.length || !exercise?.drawing || isActive()) return;
    const ex = App.loadExample(exercise.drawing);
    if (ex) App.toast(`El grafo estaba vacío: cargué «${ex.name}» para que tengas con qué probar.`);
  }

  function setLang(next) {
    if (next === lang || isActive()) return;
    clearSession();
    saveDraft();
    const wasDefault = callInput.value.trim() === autoCall;
    lang = next;
    langButtons.forEach(b => b.setAttribute('aria-checked', String(b.dataset.lang === lang)));
    if (wasDefault) setDefaultCall();
    showCode();
  }
  langButtons.forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));

  /** «Ver ejemplo correcto»: cambia el editor a la solución (ejecutable); tu código queda guardado. */
  function toggleSolution(line = null) {
    if (isActive() || !exercise?.kind || exercise.kind === 'free') return;
    clearSession();
    saveDraft();
    viewingSolution = !viewingSolution;
    showCode();
    if (viewingSolution) {
      App.toast('Ejemplo correcto: ejecutalo para ver cómo funciona. Tu código quedó guardado.');
      if (line) requestAnimationFrame(() => editor.goToLine(line));
    }
  }
  btnExample.addEventListener('click', () => toggleSolution());

  function guideContext() {
    let mine = lastGood;
    if (viewingSolution) {
      try { mine = parser().parseProgram(userCode()); } catch { mine = null; }
    }
    return {
      exercise,
      lang,
      space: space(),
      fillCall,
      program: mine,
      parseErr: viewingSolution ? null : parseErr,
      goTo: line => {
        if (viewingSolution) toggleSolution();
        requestAnimationFrame(() => editor.goToLine(line));
      },
      showExample: (name, arity) => {
        const line = Exercise.solutionLine(exercise, lang, name, arity);
        if (viewingSolution) { if (line) editor.goToLine(line); } else toggleSolution(line);
      },
      tryCall: (call, cls) => {
        if (isActive()) return;
        if (cls && userClasses().includes(cls)) {
          renderTreeClasses();
          treeClassSel.value = cls;
          renderFnList();
        }
        setCall(call);
      },
    };
  }
  $('#btnGuide').addEventListener('click', () => { if (!viewingSolution) parseNow(); Guide.open(guideContext()); });

  renderExerciseOptions();
  loadExercise(lastExercise[space()]);
  renderConsole();
  renderControls();

  /** Valor corto para las etiquetas del dibujo (∞ para Infinity o Integer.MAX_VALUE). */
  function badgeValue(v) {
    if (v === Infinity || v === 2147483647) return '∞';
    if (v === null) return '—';
    if (v instanceof JVertex) return fmt(v.dato);
    const s = typeof v === 'string' ? v : fmt(v, 1, false);
    return s.length > 10 ? s.slice(0, 9) + '…' : s;
  }

  /**
   * Lo que se marca sobre el grafo: el vértice en foco y los de llamadas pendientes, los visitados
   * (campo visitado, o un conjunto llamado «visitados»), los que están en una cola o pila, y las
   * colecciones del frame actual como etiquetas (dist 3, cola[0], ∈ enCurso…).
   */
  function graphOverlay() {
    const it = session.interp;
    const g = session.graph;
    const running = session.status !== 'done';
    const top = topFrame();
    // Vértice actual: el que el código está procesando (actual, v, vertice…) o, si no hay, el de la llamada.
    let cur = null;
    if (running && top && !top.isMain) {
      for (const [k, v] of it.frameVars(top)) if (CURRENT_VAR.test(k)) cur = vertexFor(v) ?? cur;
      cur ??= focusOf(top);
    }
    const stack = new Set();
    if (running) for (const f of it.stack.slice(0, -1)) { const v = focusOf(f); if (v) stack.add(v.id); }
    // Visitado = lo que el algoritmo marcó (campo visitado o un conjunto «visitados»), no por dónde pasó cada llamada.
    const visited = new Set();
    for (const v of g.nodes) if (v.visitado) visited.add(v.id);
    const pointers = new Map(), badges = new Map(), queued = new Set(), edgeMarks = new Set();
    const push = (map, id, text) => {
      if (!map.has(id)) map.set(id, []);
      if (!map.get(id).includes(text)) map.get(id).push(text);
    };
    const collection = (name, v) => {
      if (v instanceof JMap) {
        if (v.map.size > 200) return;
        for (const [k, x] of v.map) {
          const hit = vertexFor(k);
          if (hit) push(badges, hit.id, `${name} ${badgeValue(x)}`);
        }
        return;
      }
      const items = v instanceof JList ? v.items : Array.isArray(v) ? v : v instanceof JSet ? [...v.set] : null;
      if (!items || items.length > 200) return;
      items.forEach((x, i) => {
        const hit = vertexFor(x);
        if (!hit) return;
        if (VISITED_VAR.test(name)) visited.add(hit.id);
        else if (v instanceof JSet) push(badges, hit.id, `∈ ${name}`);
        else push(badges, hit.id, `${name}[${i}]`);
        if (QUEUE_VAR.test(name)) queued.add(hit.id);
      });
    };
    if (running && top && !top.isMain) {
      for (const [k, v] of it.frameVars(top)) {
        if (v instanceof JVertex) push(pointers, v.id, k);
        else if (v instanceof JEdge) { const key = session.edgeOf.get(v); if (key) edgeMarks.add(key); }
        else if ((typeof v === 'number' || typeof v === 'string') && VERTEX_VAR.test(k)) { const hit = vertexFor(v); if (hit) push(pointers, hit.id, k); }
        else collection(k, v);
      }
    }
    // Al terminar: si devolvió vértices en orden (un recorrido), se numeran; si devolvió un mapa, se muestra.
    let order = null;
    const res = session.status === 'done' ? session.result : undefined;
    if (res instanceof JMap) {
      for (const [k, x] of res.map) { const hit = vertexFor(k); if (hit) push(badges, hit.id, `↩ ${badgeValue(x)}`); }
    } else if (res instanceof JList || Array.isArray(res)) {
      const items = res instanceof JList ? res.items : res;
      const hits = items.map(vertexFor);
      if (items.length && hits.every(Boolean) && new Set(hits).size === hits.length) order = new Map(hits.map((h, i) => [h.id, i + 1]));
    }
    const floating = new Set(g.nodes.filter(v => !g.main.has(v.id)).map(v => v.id));
    return {
      // Los ↩ de cada llamada sirven mientras corre; al final el resultado ya está en la consola.
      current: cur?.id ?? null, stack, visited, queued, returns: running ? session.returns : new Map(), pointers, badges, order, floating,
      result: session.resultNode, edgeWarn: session.edgeWarn, edgeMarks,
    };
  }

  return {
    overlay() {
      if (!session) return null;
      if (session.space === 'graph') return graphOverlay();
      const it = session.interp;
      const running = session.status !== 'done';
      const top = topFrame();
      const cur = running && top && !top.isMain ? it.frameNode(top) : null;
      const stack = new Set();
      if (running) for (const f of it.stack.slice(0, -1)) { const n = f.isMain ? null : it.frameNode(f); if (n) stack.add(n.id); }
      const pointers = new Map();
      const add = (id, name) => {
        if (!pointers.has(id)) pointers.set(id, []);
        if (!pointers.get(id).includes(name)) pointers.get(id).push(name);
      };
      const raiz = it.getRoot();
      if (raiz) add(raiz.id, 'raiz');
      if (running && top && !top.isMain) for (const [k, v] of it.frameVars(top)) if (v instanceof JNode) add(v.id, k);
      const floating = new Set();
      for (const n of session.graph?.nodes ?? []) if (!session.graph.main.has(n.id)) floating.add(n.id);
      // Altura guardada en cada nodo (campo altura) comparada con la real.
      const alturas = new Map();
      const real = new Map();
      const h = n => {
        if (!n) return 0;
        if (real.has(n.id)) return real.get(n.id);
        real.set(n.id, 0); // corta ciclos transitorios
        const v = 1 + Math.max(0, ...it.childrenOf(n).map(h));
        real.set(n.id, v);
        return v;
      };
      for (const n of session.graph?.nodes ?? []) alturas.set(n.id, { stored: n.altura, real: h(n) });
      return { current: cur?.id ?? null, stack, visited: session.visited, returns: session.returns, pointers, floating, result: session.resultNode, alturas };
    },
    onSpaceChange() {
      if (session) stop();
      clearSession();
      saveDraft();
      renderExerciseOptions();
      viewingSolution = false;
      exercise = null;
      loadExercise(lastExercise[space()]);
      renderControls();
    },
    onModeChange(mode) {
      if (mode === 'draw' && session) stop();
      if (mode === 'code') {
        ensureDrawing();
        refreshDefaultCall();
        parseNow();
        renderTreeClasses();
        editor.setMarks({ error: parseErr?.line ?? null });
      }
    },
  };
})();
