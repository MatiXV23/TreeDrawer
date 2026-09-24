/*
 * Modal del modo Programar:
 *  - «Estructura a implementar»: clases y métodos (como las interfaces de la materia)
 *    con el estado de cada uno en el código del editor.
 *  - «Ejemplo correcto»: la solución de referencia, solo para leer.
 */
const Guide = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dlg = $('#guideDialog');
  const body = $('#guideBody');
  let ctx = null;
  let tab = 'estructura';

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

  function classMap(program) {
    return new Map((program?.body ?? []).filter(s => s.t === 'classdecl').map(c => [c.name, c]));
  }

  function methodState(classes, clsName, spec) {
    const own = classes.get(clsName);
    if (!own) return { state: 'missing', note: `falta la clase ${clsName}` };
    const m = own.methods.find(x => x.name === spec.name);
    if (m) return { state: isPending(m.fn) ? 'pending' : 'done', line: m.line };
    for (let p = classes.get(own.parent); p; p = classes.get(p.parent)) {
      const pm = p.methods.find(x => x.name === spec.name);
      if (!pm) continue;
      if (spec.override) return { state: 'missing', note: `hereda el de ${p.name}, pero tiene que redefinirse` };
      return { state: isPending(pm.fn) ? 'pending' : 'inherited', note: `heredado de ${p.name}`, line: pm.line };
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
      ${example ? `<button type="button" data-act="example" data-key="${esc(example)}">Ver ejemplo</button>` : ''}
    </div>`;
  }

  // ---------- pestaña «Estructura» ----------
  function nodoCard() {
    const spec = TREE_STRUCTURE.find(c => c.builtin);
    return `<section class="g-class g-builtin">
      <header><code class="g-sig"><span class="t-kw">class</span> <span class="t-type">Nodo</span></code><span class="g-tag">incluida</span></header>
      <p class="g-desc">${esc(spec.desc)}</p>
      <dl class="g-fields">${spec.fields.map(([k, d]) => `<div><dt><code>${esc(k)}</code></dt><dd>${esc(d)}</dd></div>`).join('')}</dl>
      <ul class="g-plain">${spec.methods.map(([sig, d]) => `<li><code>${esc(sig)}</code>${d ? ` <span class="muted">${esc(d)}</span>` : ''}</li>`).join('')}</ul>
    </section>`;
  }

  function classesTab() {
    const classes = classMap(ctx.program);
    let html = '';
    for (const spec of TREE_STRUCTURE.filter(c => !c.builtin)) {
      const rows = spec.methods.map(m => ({ m, st: methodState(classes, spec.name, m) }));
      const ok = rows.filter(r => r.st.state === 'done' || r.st.state === 'inherited').length;
      const head = `<code class="g-sig"><span class="t-kw">class</span> <span class="t-type">${spec.name}</span>${spec.parent ? ` <span class="t-kw">extends</span> <span class="t-type">${spec.parent}</span>` : ''}</code>`;
      html += `<section class="g-class">
        <header>${head}<span class="g-tag">${spec.tag}</span><span class="g-progress${ok === rows.length ? ' full' : ''}">${ok}/${rows.length}</span></header>
        <p class="g-desc">${esc(spec.desc)}</p>
        ${spec.fields ? `<dl class="g-fields">${spec.fields.map(([k, d]) => `<div><dt><code>this.${esc(k)}</code></dt><dd>${esc(d)}</dd></div>`).join('')}</dl>` : ''}
        <ul class="g-methods">${rows.map(({ m, st }) => `
          <li class="g-m" data-state="${st.state}">
            ${stateBadge(st.state)}
            <div class="g-main">
              <code>${esc(m.sig)}</code> <span class="g-ret">→ ${esc(m.ret)}</span>
              ${m.desc || st.note ? `<div class="g-note">${[m.desc, st.note].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
            </div>
            ${actions({ line: st.line, call: structureCall(m), cls: spec.name, example: `m:${spec.name}.${m.name}` })}
            <pre class="g-code" hidden></pre>
          </li>`).join('')}
        </ul>
      </section>`;
    }
    return nodoCard() + html;
  }

  function functionsTab() {
    const ex = ctx.exercise;
    const refs = Reference.functions(ex.solution);
    const mine = new Map((ctx.program?.body ?? []).filter(s => s.t === 'funcdecl').map(f => [f.name, f]));
    const rows = [...refs.keys()].map(name => {
      const f = mine.get(name);
      const state = !f ? 'missing' : isPending(f) ? 'pending' : 'done';
      const sig = refs.get(name).split('\n').find(l => l.startsWith('function')).replace(/^function\s+/, '').replace(/\s*\{\s*$/, '');
      const params = f ? f.params.filter(p => !p.def && !p.rest).map((p, i) => (i === 0 ? 'raiz' : '?')) : [];
      return `<li class="g-m" data-state="${state}">
        ${stateBadge(state)}
        <div class="g-main"><code>${esc(sig)}</code>${!f ? '<div class="g-note">no está definida en el código</div>' : ''}</div>
        ${actions({ line: f?.line, call: f ? `${name}(${params.join(', ')})` : null, example: `f:${name}` })}
        <pre class="g-code" hidden></pre>
      </li>`;
    }).join('');
    return `<section class="g-class">
        <header><b>${esc(ex.name)}</b><span class="g-tag">funciones</span></header>
        <p class="g-desc">Completá cada función. Se prueban con la línea de ejecución, por ejemplo <code>${esc(ex.call)}</code>.</p>
        <ul class="g-methods">${rows}</ul>
      </section>` + nodoCard();
  }

  function helpBlock() {
    return `<details class="g-help">
      <summary>Cómo se ejecuta y qué se puede usar</summary>
      <ul>
        <li><code>arbol</code> es una instancia de la clase elegida en «arbol es un» y <code>arbol.raiz</code> es el árbol dibujado. Por ejemplo: <code>arbol.insertar(35)</code>.</li>
        <li><code>raiz</code> es un atajo de <code>arbol.raiz</code> (sirve para funciones sueltas: <code>altura(raiz)</code>).</li>
        <li>Si un método devuelve la nueva raíz (rotaciones), asignala: <code>arbol.raiz = arbol.rotacionDerecha(arbol.raiz)</code>.</li>
        <li>JavaScript: clases con <code>extends</code>/<code>super</code>, funciones y flechas, <code>let</code>/<code>const</code>, <code>if</code>, <code>while</code>, <code>for</code>, <code>for...of</code>, recursión, arrays (<code>push</code>, <code>shift</code>, <code>map</code>…), <code>Math</code> y <code>console.log</code>.</li>
        <li>Convención de alturas (como <code>Nodo.altura</code>): una hoja mide 1 y el árbol vacío, 0.</li>
        <li>Clic en el número de una línea del editor para poner un breakpoint. Nada se guarda: al recargar, el código vuelve al esqueleto.</li>
      </ul>
    </details>`;
  }

  // ---------- pestaña «Ejemplo correcto» ----------
  function exampleTab() {
    const ex = ctx.exercise;
    if (!ex.solution) {
      return '<p class="g-empty">La hoja en blanco no tiene un ejemplo correcto: elegí un ejercicio en el selector.</p>';
    }
    return `<p class="g-warn">Es <b>una</b> solución posible. Conviene intentarlo antes de mirarla. No se copia en tu código: está solo para leer.</p>
      <pre class="g-code full">${CodeEditor.highlight(ex.solution.trimEnd())}</pre>`;
  }

  function render() {
    dlg.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    let html;
    if (tab === 'ejemplo') html = exampleTab();
    else {
      const warn = ctx.parseErr ? `<p class="g-warn error">El código tiene un error de sintaxis (línea ${ctx.parseErr.line ?? '?'}): el estado de los métodos puede no estar actualizado.</p>` : '';
      const content = ctx.exercise.kind === 'functions' ? functionsTab()
        : ctx.exercise.kind === 'classes' ? classesTab()
        : nodoCard();
      html = warn + content + helpBlock();
    }
    body.innerHTML = html;
    body.scrollTop = 0;
  }

  function exampleFor(key) {
    if (key.startsWith('m:')) {
      const [cls, name] = key.slice(2).split('.');
      return Reference.forMethod(cls, name);
    }
    return Reference.functions(ctx.exercise.solution).get(key.slice(2));
  }

  body.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    if (b.dataset.act === 'goto') {
      dlg.close();
      ctx.goTo(+b.dataset.line);
    } else if (b.dataset.act === 'try') {
      dlg.close();
      ctx.tryCall(b.dataset.call, b.dataset.cls || null);
    } else if (b.dataset.act === 'example') {
      const pre = b.closest('.g-m').querySelector('.g-code');
      if (pre.hidden) {
        const code = exampleFor(b.dataset.key);
        pre.innerHTML = code ? CodeEditor.highlight(code) : 'No hay ejemplo para este método.';
        pre.hidden = false;
        b.textContent = 'Ocultar ejemplo';
      } else {
        pre.hidden = true;
        b.textContent = 'Ver ejemplo';
      }
    }
  });

  dlg.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
  $('#guideClose').addEventListener('click', () => dlg.close());
  // Clic en el fondo (fuera del contenido) cierra.
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  return {
    open(which, context) {
      ctx = context;
      tab = which;
      render();
      if (!dlg.open) dlg.showModal();
    },
  };
})();
