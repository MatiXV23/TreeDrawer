/*
 * Modo Programar: editor, ejecución paso a paso y visualización sobre el árbol.
 * El intérprete trabaja sobre JNode propios; después de cada paso se vuelcan al
 * lienzo (valores, aristas, nodos nuevos o desenganchados) y se animan.
 */
const Runner = (() => {
  const $ = s => document.querySelector(s);
  const { fmt, JNode, RuntimeErr } = JSInterp;
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
  const solutionBanner = $('#solutionBanner');
  const langButtons = document.querySelectorAll('#langSwitch [data-lang]');

  let lang = 'js';
  let program = null;       // código del editor (tuyo o el ejemplo correcto)
  let lastGood = null;      // último código del editor que compiló
  let parseErr = null;
  let parseTimer = 0;
  let exercise = null;
  let session = null;
  let viewingSolution = false;
  const drafts = new Map(); // «ejercicio:lenguaje» → tu código (solo en memoria)

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
    const provided = exercise?.kind === 'classes' ? exercise.provides : [];
    return [...new Set([...provided, ...own])];
  }

  /** Las clases de búsqueda necesitan un dibujo ordenado (ABB o AVL) o vacío. */
  function compatible(name, kind) {
    if (kind === 'AG') return false;
    return !ORDERED.has(name) || ['ABB', 'AVL', 'EMPTY'].includes(kind);
  }

  function autoClass(kind) {
    const names = userClasses();
    if (kind === 'AG' || !names.length) return null;
    if (exercise?.cls && names.includes(exercise.cls) && compatible(exercise.cls, kind)) return exercise.cls;
    return ['ArbolAVL', 'ArbolBinarioBusqueda', 'ArbolBinario'].find(n => names.includes(n) && compatible(n, kind))
      ?? names.find(n => !CLASS_ORDER.includes(n)) ?? null;
  }

  function currentKind() {
    return analyzeTree(Store.state.nodes, Store.state.edges).kind;
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
    treeRow.hidden = !names.length;
    if (!names.length) return;
    const cur = treeClassSel.value || '__auto';
    const auto = autoClass(currentKind());
    treeClassSel.innerHTML =
      `<option value="__auto">Automático${auto ? ` (${auto})` : ' (sin clase)'}</option>` +
      names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('') +
      '<option value="__none">Sin clase (solo raiz)</option>';
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

  function setCall(call) {
    callInput.value = call;
    callInput.focus();
    const q = call.indexOf('?');
    if (q >= 0) callInput.setSelectionRange(q, q + 1);
  }

  function renderFnList() {
    const chips = [];
    const cls = TREE_STRUCTURE.find(c => c.name === resolveTreeClass());
    if (cls) {
      for (const m of cls.methods) {
        const label = lang === 'java' ? `arbol.${m.jsig.replace(/^\S+\s+/, '')}` : `arbol.${m.sig}`;
        chips.push({ label, call: structureCall(m) });
      }
    }
    for (const f of functionsOf(program)) {
      const args = f.params.filter(p => !p.def && !p.rest).map((p, i) => (i === 0 ? 'raiz' : '?'));
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
      const n = it.frameNode(ev.frame);
      if (n) { session.visited.add(n.id); session.returns.delete(n.id); }
    } else if (ev.kind === 'return') {
      const n = it.frameNode(ev.frame);
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
    if (value instanceof JNode) session.resultNode = value.id;
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
      stopTimer();
      unlock();
      session.status = 'stopped';
      if (mutated) Store.undo();
      clearSession();
      App.toast(mutated ? 'Ejecución detenida: el árbol volvió a como estaba.' : 'Ejecución detenida.');
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

  function sync() {
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
          `<div class="var"><span class="k">${esc(k)}</span><span class="v">${v === undefined ? '<i>sin valor</i>' : esc(shortValue(v))}</span></div>`
        ).join('');
        const ret = f.returned ? `<div class="ret">↩ ${esc(shortValue(f.result))}</div>` : '';
        const where = f.lib ? 'incluida' : `L${f.line ?? '?'}`;
        return `<li class="frame${i === 0 ? ' top' : ''}${f.lib ? ' lib' : ''}"><div class="sig"><b>${esc(f.name)}</b>(${args})<span class="ln">${where}</span></div>${locals}${ret}</li>`;
      }).join('') + '</ol>';
      if (frames.length > MAX) html += `<p class="stack-more">… y ${frames.length - MAX} llamadas más abajo</p>`;
    }
    const globals = [];
    if (it.arbol) globals.push(['arbol', it.arbol instanceof JSInterp.JInstance ? it.arbol.cls.name : 'objeto'], ['arbol.raiz', shortValue(it.getRoot())]);
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
      const lost = session.result instanceof JNode && !g.main.has(session.result.id) && !session.assignsRoot;
      if (lost) {
        const target = session.callText.startsWith('arbol.') ? 'arbol.raiz' : 'raiz';
        html += `<div class="c-note">Se devolvió un nodo que no quedó colgado de <b>${target}</b>. Si es la nueva raíz, ejecutá <code>${target} = ${esc(session.callText)}</code>.</div>`;
      }
      if (session.mutated) html += '<div class="c-note">El árbol cambió. Con Ctrl/⌘+Z volvés a como estaba.</div>';
    }
    if (session?.status === 'error') {
      const where = session.errorInCall ? 'en la línea de ejecución'
        : session.errorInLib ? 'dentro de una clase incluida (revisá los datos que le pasás)'
        : `en la línea ${session.error.line ?? '?'}`;
      html += `<div class="c-error"><b>Error ${where}</b><br>${esc(session.error.message)}</div>`;
      if (session.mutated) html += '<div class="c-note">El árbol quedó como estaba al momento del error. Con Ctrl/⌘+Z volvés al original.</div>';
    }
    consoleEl.innerHTML = html || '<div class="c-empty">Acá aparecen los console.log y el resultado.</div>';
    consoleEl.scrollTop = consoleEl.scrollHeight;
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
    langButtons.forEach(b => { b.disabled = active; });
    document.querySelectorAll('.fn-chip').forEach(b => { b.disabled = active; });
    if (!session) runInfo.textContent = '';
    else if (st === 'done') runInfo.textContent = `Terminó en ${session.steps.toLocaleString('es')} pasos`;
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
  for (const group of [...new Set(EXERCISES.map(x => x.group))]) {
    const og = document.createElement('optgroup');
    og.label = group;
    for (const ex of EXERCISES.filter(x => x.group === group)) og.append(new Option(ex.name, ex.id));
    selCode.append(og);
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
    viewingSolution = false;
    selCode.value = ex.id;
    treeClassSel.value = '__auto';
    callInput.value = Exercise.call(ex, lang);
    showCode();
  }
  selCode.addEventListener('change', () => loadExercise(selCode.value));

  function setLang(next) {
    if (next === lang || isActive()) return;
    clearSession();
    saveDraft();
    const prevCall = exercise ? Exercise.call(exercise, lang) : null;
    lang = next;
    langButtons.forEach(b => b.setAttribute('aria-checked', String(b.dataset.lang === lang)));
    if (callInput.value.trim() === prevCall) callInput.value = Exercise.call(exercise, lang);
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

  loadExercise('ab');
  renderConsole();
  renderControls();

  return {
    overlay() {
      if (!session) return null;
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
    onModeChange(mode) {
      if (mode === 'draw' && session) stop();
      if (mode === 'code') {
        parseNow();
        renderTreeClasses();
        editor.setMarks({ error: parseErr?.line ?? null });
      }
    },
  };
})();
