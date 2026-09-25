/*
 * Modal «Estructura a implementar»: las clases y métodos del ejercicio (como las interfaces
 * de la materia), en JavaScript o en Java, con el estado de cada uno en tu código.
 * Sirve para árboles (Nodo incluido) y para grafos (Vertice y Arista incluidos).
 * «Ver en el ejemplo» abre el ejemplo correcto en el editor, en ese método.
 */
const Guide = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dlg = $('#guideDialog');
  const body = $('#guideBody');
  let ctx = null;

  const STATE = {
    done: ['✓', 'implementado'],
    inherited: ['↑', 'heredado'],
    pending: ['○', 'pendiente'],
    missing: ['✕', 'falta'],
  };

  const isPending = fn => {
    const b = fn.body.body;
    return b.length === 0 || (b.length === 1 && b[0].t === 'throw');
  };

  /** Clases de tu código más las que el ejercicio trae incluidas. */
  function classMap() {
    const map = new Map();
    const pre = Exercise.prelude(ctx.exercise, ctx.lang);
    for (const c of pre?.body ?? []) if (c.t === 'classdecl') map.set(c.name, { decl: c, provided: true });
    for (const c of ctx.program?.body ?? []) if (c.t === 'classdecl') map.set(c.name, { decl: c, provided: false });
    return map;
  }

  function findIn(decl, name, arity) {
    const ms = decl.methods.filter(x => x.name === name);
    return ms.find(m => m.fn.params.length === arity) ?? ms[0] ?? null;
  }

  function methodState(classes, clsName, spec) {
    const own = classes.get(clsName);
    if (!own) return { state: 'missing', note: `falta la clase ${clsName}` };
    const arity = structureArity(spec);
    const m = findIn(own.decl, spec.name, arity);
    if (m) return { state: isPending(m.fn) ? 'pending' : 'done', line: own.provided ? null : m.line };
    for (let p = classes.get(own.decl.parent); p; p = classes.get(p.decl.parent)) {
      const pm = findIn(p.decl, spec.name, arity);
      if (!pm) continue;
      if (spec.override) return { state: 'missing', note: `hereda el de ${p.decl.name}, pero tiene que redefinirse` };
      return {
        state: isPending(pm.fn) ? 'pending' : 'inherited',
        note: `heredado de ${p.decl.name}${p.provided ? ' (incluida)' : ''}`,
        line: p.provided ? null : pm.line,
      };
    }
    return { state: 'missing', note: 'no está definido en el código' };
  }

  function stateBadge(state) {
    const [icon, label] = STATE[state];
    return `<span class="g-state" data-state="${state}" title="${label}">${icon}</span>`;
  }

  function actions({ line, call, cls, example }) {
    return `<div class="g-actions">
      ${line ? `<button type="button" data-act="goto" data-line="${line}" title="Ir a la línea ${line} del editor">Ir</button>` : ''}
      ${call ? `<button type="button" data-act="try" data-call="${esc(call)}" data-cls="${esc(cls ?? '')}" title="Poner la llamada en la línea de ejecución">Probar</button>` : ''}
      ${example ? `<button type="button" data-act="example" data-name="${esc(example.name)}" data-arity="${example.arity ?? ''}" title="Abrir el ejemplo correcto en este método (tu código queda guardado)">Ver en el ejemplo</button>` : ''}
    </div>`;
  }

  const sigOf = m => (ctx.lang === 'java' ? m.jsig : `${m.sig} → ${m.ret}`);
  const graph = () => ctx.space === 'graph';
  const obj = () => (graph() ? 'grafo' : 'arbol');
  const specOf = name => [...TREE_STRUCTURE, ...GRAPH_STRUCTURE].find(c => c.name === name && !c.builtin);

  function classHead(spec) {
    if (ctx.lang === 'java') {
      return `<code class="g-sig">${CodeEditor.highlight(spec.jheader, 'java')}</code>`;
    }
    return `<code class="g-sig"><span class="t-kw">class</span> <span class="t-type">${spec.name}</span>${spec.parent ? ` <span class="t-kw">extends</span> <span class="t-type">${spec.parent}</span>` : ''}</code>`;
  }

  // ---------- tarjetas ----------
  /** Clases que vienen con el entorno: Nodo (árboles), o Vertice y Arista (grafos). */
  function builtinCards() {
    const specs = graph() ? GRAPH_STRUCTURE.filter(c => c.builtin) : TREE_STRUCTURE.filter(c => c.builtin);
    return specs.map(spec => `<section class="g-class g-builtin">
      <header><code class="g-sig"><span class="t-kw">class</span> <span class="t-type">${spec.name}${ctx.lang === 'java' ? '&lt;T&gt;' : ''}</span></code><span class="g-tag">incluida</span></header>
      <p class="g-desc">${esc(spec.desc)}</p>
      <dl class="g-fields">${spec.fields[ctx.lang].map(([k, d]) => `<div><dt><code>${esc(k)}</code></dt><dd>${esc(d)}</dd></div>`).join('')}</dl>
      <ul class="g-plain">${spec.methods[ctx.lang].map(([sig, d]) => `<li><code>${esc(sig)}</code>${d ? ` <span class="muted">${esc(d)}</span>` : ''}</li>`).join('')}</ul>
    </section>`).join('');
  }

  function providedCard(spec) {
    return `<section class="g-class g-builtin">
      <header>${classHead(spec)}${spec.tag !== spec.name ? `<span class="g-tag">${spec.tag}</span>` : ''}<span class="g-tag">incluida</span></header>
      <p class="g-desc">${esc(spec.desc)} Ya viene resuelta: podés usar sus métodos.</p>
      <ul class="g-plain">${spec.methods.map(m => `<li><code>${esc(sigOf(m))}</code></li>`).join('')}</ul>
    </section>`;
  }

  function classCard(spec, classes) {
    const rows = spec.methods.map(m => ({ m, st: methodState(classes, spec.name, m) }));
    const ok = rows.filter(r => r.st.state === 'done' || r.st.state === 'inherited').length;
    const fields = spec.fields?.[ctx.lang];
    return `<section class="g-class">
      <header>${classHead(spec)}${spec.tag !== spec.name ? `<span class="g-tag">${spec.tag}</span>` : ''}<span class="g-progress${ok === rows.length ? ' full' : ''}">${ok}/${rows.length}</span></header>
      <p class="g-desc">${esc(spec.desc)}</p>
      ${fields ? `<dl class="g-fields">${fields.map(([k, d]) => `<div><dt><code>${esc(k)}</code></dt><dd>${esc(d)}</dd></div>`).join('')}</dl>` : ''}
      <ul class="g-methods">${rows.map(({ m, st }) => `
        <li class="g-m" data-state="${st.state}">
          ${stateBadge(st.state)}
          <div class="g-main">
            <code>${esc(sigOf(m))}</code>
            ${m.desc || st.note ? `<div class="g-note">${[m.desc, st.note].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
          </div>
          ${actions({ line: st.line, call: ctx.fillCall(structureCall(m, obj())), cls: spec.name, example: { name: m.name, arity: structureArity(m) } })}
        </li>`).join('')}
      </ul>
    </section>`;
  }

  function classesView() {
    const ex = ctx.exercise;
    const classes = classMap();
    const chain = CLASS_ORDER.includes(ex.cls) ? CLASS_ORDER.slice(0, CLASS_ORDER.indexOf(ex.cls) + 1) : [ex.cls];
    return chain.map(name => {
      const spec = specOf(name);
      return ex.provides.includes(name) ? providedCard(spec) : classCard(spec, classes);
    }).reverse().join('') + builtinCards();
  }

  function functionsView() {
    const ex = ctx.exercise;
    const sol = Exercise.solution(ex, ctx.lang);
    const lines = sol.split('\n');
    const refs = LANGS[ctx.lang].parser().parseProgram(sol).body.filter(d => d.t === 'funcdecl');
    const mine = new Map((ctx.program?.body ?? []).filter(s => s.t === 'funcdecl').map(f => [f.name, f]));
    const rows = refs.map(ref => {
      const f = mine.get(ref.name);
      const state = !f ? 'missing' : isPending(f) ? 'pending' : 'done';
      const sig = lines[ref.line - 1].trim().replace(/^function\s+/, '').replace(/\s*\{\s*$/, '');
      const GRAPH_ARG = { grafo: 'grafo', dato: '{v}', origen: '{v}', destino: '{w}' };
      const params = (f ?? ref).params.filter(p => !p.def && !p.rest).map((p, i) => (graph() ? GRAPH_ARG[p.name] ?? (i === 0 ? 'grafo' : '?') : i === 0 ? 'raiz' : '?'));
      return `<li class="g-m" data-state="${state}">
        ${stateBadge(state)}
        <div class="g-main"><code>${esc(sig)}</code>${!f ? '<div class="g-note">no está definida en el código</div>' : ''}</div>
        ${actions({ line: f?.line, call: ctx.fillCall(`${ref.name}(${params.join(', ')})`), example: { name: ref.name } })}
      </li>`;
    }).join('');
    return `<section class="g-class">
        <header><b>${esc(ex.name)}</b><span class="g-tag">${ctx.lang === 'java' ? 'métodos static' : 'funciones'}</span></header>
        <p class="g-desc">Completá cada una. Se prueban con la línea de ejecución, por ejemplo <code>${esc(ctx.fillCall(Exercise.call(ex, ctx.lang)))}</code>.</p>
        <ul class="g-methods">${rows}</ul>
      </section>` + (ex.provides ?? []).map(name => providedCard(specOf(name))).join('') + builtinCards();
  }

  function graphHelp() {
    const java = ctx.lang === 'java';
    return `<details class="g-help">
      <summary>Cómo se ejecuta y qué se puede usar</summary>
      <ul>
        <li><code>grafo</code> es una instancia de la clase elegida en «grafo es un» con el grafo dibujado: <code>grafo.vertices</code> tiene un <code>Vertice</code> por vértice y cada uno guarda sus aristas en <code>adyacentes</code>. Todo en orden creciente, igual que los recorridos del panel.</li>
        <li>Si el grafo no es dirigido, cada arista está en las listas de sus dos vértices. Si en el dibujo aparece con flecha naranja, quedó en un solo sentido.</li>
        <li>Mientras corre se marca el vértice actual, los visitados (campo <code>visitado</code> o un conjunto llamado <code>visitados</code>), los que están en una cola o pila, y los mapas y listas del frame actual como etiquetas bajo cada vértice (<code>dist 4</code>, <code>cola[0]</code>…).</li>
        ${java
          ? '<li>Java: clases, sobrecarga, genéricos (se aceptan y se ignoran), <code>List</code>/<code>ArrayList</code>, <code>Queue</code>/<code>LinkedList</code>, <code>Stack</code>, <code>HashMap</code>/<code>TreeMap</code>/<code>LinkedHashMap</code>, <code>HashSet</code>/<code>TreeSet</code>, <code>Map.Entry</code>, <code>Collections.sort</code>/<code>reverse</code> e <code>Integer.MAX_VALUE</code>. No hay <code>PriorityQueue</code> ni lambdas: el mínimo se busca recorriendo.</li>'
          : '<li>JavaScript: clases, funciones y flechas, arrays, <code>Map</code> y <code>Set</code> (<code>set</code>/<code>get</code>/<code>has</code>/<code>add</code>, <code>size</code>), <code>Infinity</code>, <code>Math</code> y <code>console.log</code>.</li>'}
        <li>«Ver ejemplo correcto» cambia el editor a una solución que podés ejecutar paso a paso; «Volver a mi código» te devuelve lo tuyo tal como estaba. Nada se guarda al recargar la página.</li>
      </ul>
    </details>`;
  }

  function helpBlock() {
    if (graph()) return graphHelp();
    const java = ctx.lang === 'java';
    return `<details class="g-help">
      <summary>Cómo se ejecuta y qué se puede usar</summary>
      <ul>
        <li><code>arbol</code> es una instancia de la clase elegida en «arbol es un» y <code>arbol.raiz</code> es el árbol dibujado. Por ejemplo: <code>arbol.insertar(35)</code>.</li>
        <li><code>raiz</code> es un atajo de <code>arbol.raiz</code> (sirve para ${java ? 'métodos sueltos' : 'funciones sueltas'}: <code>altura(raiz)</code>).</li>
        <li>Si un método devuelve la nueva raíz (rotaciones), asignala: <code>arbol.raiz = arbol.rotacionDerecha(arbol.raiz)</code>.</li>
        ${java
          ? '<li>Java: clases con <code>extends</code>, constructores y métodos sobrecargados, <code>private</code>/<code>protected</code>, tipos (<code>int</code> divide como entero), <code>if</code>, <code>while</code>, <code>for</code>, for-each, <code>List</code>/<code>ArrayList</code>, <code>Queue</code>/<code>LinkedList</code>, <code>Stack</code>, <code>compareTo</code>, <code>equals</code>, <code>Math</code> y <code>System.out.println</code>. Los genéricos, anotaciones e <code>implements</code> se aceptan y se ignoran.</li>'
          : '<li>JavaScript: clases con <code>extends</code>/<code>super</code>, funciones y flechas, <code>let</code>/<code>const</code>, <code>if</code>, <code>while</code>, <code>for</code>, <code>for...of</code>, arrays (<code>push</code>, <code>shift</code>, <code>map</code>…), <code>Math</code> y <code>console.log</code>.</li>'}
        <li>Convención de alturas (como <code>Nodo.altura</code>): una hoja mide 1 y el árbol vacío, 0.</li>
        <li>«Ver ejemplo correcto» cambia el editor a una solución que podés ejecutar paso a paso; «Volver a mi código» te devuelve lo tuyo tal como estaba. Nada se guarda al recargar la página.</li>
      </ul>
    </details>`;
  }

  function render() {
    const warn = ctx.parseErr ? `<p class="g-warn error">Tu código tiene un error de sintaxis (línea ${ctx.parseErr.line ?? '?'}): el estado de los métodos puede no estar actualizado.</p>` : '';
    const kind = ctx.exercise.kind;
    const provided = () => (ctx.exercise.provides ?? []).map(name => providedCard(specOf(name))).join('');
    const content = kind === 'classes' ? classesView() : kind === 'functions' ? functionsView() : provided() + builtinCards();
    $('#guideTitle').textContent = `Estructura a implementar · ${LANGS[ctx.lang].name}`;
    body.innerHTML = warn + content + helpBlock();
    body.scrollTop = 0;
  }

  body.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    dlg.close();
    if (b.dataset.act === 'goto') ctx.goTo(+b.dataset.line);
    else if (b.dataset.act === 'try') ctx.tryCall(b.dataset.call, b.dataset.cls || null);
    else if (b.dataset.act === 'example') ctx.showExample(b.dataset.name, b.dataset.arity === '' ? null : +b.dataset.arity);
  });

  $('#guideClose').addEventListener('click', () => dlg.close());
  // Clic en el fondo (fuera del contenido) cierra.
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  return {
    open(context) {
      ctx = context;
      render();
      if (!dlg.open) dlg.showModal();
    },
  };
})();
