/*
 * Intérprete paso a paso del subconjunto de JavaScript.
 * Cada método es un generador: `yield` entrega eventos (step / call / return)
 * para que la interfaz pueda pausar, avanzar y mostrar el estado en cualquier punto.
 * Los nodos del árbol son objetos JNode que se sincronizan con el lienzo.
 */

const JSInterp = (() => {
  class RuntimeErr extends Error {
    constructor(message, node, kind = 'Error') {
      super(message);
      this.name = kind;
      this.line = node?.line ?? null;
      this.col = node?.col ?? null;
    }
  }
  class ReturnSig {
    constructor(value) { this.value = value; }
  }
  const BREAK = { signal: 'break' };
  const CONTINUE = { signal: 'continue' };
  const SHORT = { signal: 'optional-chain' };

  class JNode {
    constructor(id, valor, general) {
      this.id = id;
      this.valor = valor;
      this.izq = null;
      this.der = null;
      this.altura = 1;
      this.hijos = general ? [] : null;
    }
  }
  class JObject {
    constructor(entries = []) { this.props = new Map(entries); }
  }
  class JFunction {
    constructor(decl, env, name, home = null, isCtor = false) {
      this.decl = decl;
      this.env = env;
      this.name = name || decl.name || null;
      this.home = home;     // clase donde está definido el método (para super)
      this.isCtor = isCtor;
    }
  }
  class JClass {
    constructor(decl, parent, env) {
      this.name = decl.name;
      this.decl = decl;
      this.parent = parent;
      this.env = env;
      this.ctor = null;
      this.methods = new Map();
      this.statics = new Map();
    }
    findMethod(name) {
      for (let c = this; c; c = c.parent) if (c.methods.has(name)) return c.methods.get(name);
      return null;
    }
    findStatic(name) {
      for (let c = this; c; c = c.parent) if (c.statics.has(name)) return c.statics.get(name);
      return null;
    }
    allMethodNames() {
      const out = new Set();
      for (let c = this; c; c = c.parent) c.methods.forEach((_, k) => out.add(k));
      return [...out];
    }
    extendsFrom(other) {
      for (let c = this; c; c = c.parent) if (c === other) return true;
      return false;
    }
  }
  class JInstance {
    constructor(cls) { this.cls = cls; this.props = new Map(); }
  }
  class NativeFn {
    constructor(name, impl, { gen = false, props = null } = {}) {
      this.name = name;
      this.impl = impl;
      this.gen = gen;
      this.props = props ? new Map(Object.entries(props)) : null;
    }
  }
  class JError {
    constructor(name, message) { this.name = name; this.message = message; }
  }
  class Env {
    constructor(parent) { this.vars = new Map(); this.parent = parent; }
  }

  const FIELD = {
    valor: 'valor', dato: 'valor', info: 'valor', clave: 'valor', key: 'valor', value: 'valor', val: 'valor', data: 'valor', elem: 'valor', elemento: 'valor',
    izq: 'izq', izquierdo: 'izq', hijoIzq: 'izq', hijoIzquierdo: 'izq', left: 'izq',
    der: 'der', derecho: 'der', hijoDer: 'der', hijoDerecho: 'der', right: 'der',
    hijos: 'hijos', children: 'hijos',
    altura: 'altura', height: 'altura',
  };
  const FIELD_HELP = 'dato, izq, der y altura (también valor/clave, izquierdo/left, derecho/right; hijos para árboles generales)';
  const NODE_METHODS = {
    getDato: 'valor', getValor: 'valor', getIzq: 'izq', getDer: 'der', getAltura: 'altura', getHijos: 'hijos',
    setDato: 'valor', setValor: 'valor', setIzq: 'izq', setDer: 'der', setAltura: 'altura',
  };
  const HIDDEN_KINDS = new Set(['function', 'this', 'hidden', 'class']);
  const MUTATING = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'reverse', 'sort', 'fill']);
  const ARRAY_METHODS = new Set([...MUTATING, 'includes', 'indexOf', 'lastIndexOf', 'join', 'slice', 'concat', 'at', 'flat',
    'map', 'filter', 'forEach', 'some', 'every', 'find', 'findIndex', 'reduce']);
  const STRING_METHODS = new Set(['charAt', 'charCodeAt', 'includes', 'indexOf', 'lastIndexOf', 'slice', 'substring', 'toUpperCase',
    'toLowerCase', 'split', 'trim', 'trimStart', 'trimEnd', 'startsWith', 'endsWith', 'repeat', 'padStart', 'padEnd',
    'localeCompare', 'concat', 'at', 'replace', 'replaceAll']);

  const isPrim = v => v === null || v === undefined || typeof v !== 'object' && typeof v !== 'function';
  const truthy = v => (isPrim(v) ? !!v : true);
  const typeOf = v => {
    if (v instanceof JFunction || v instanceof NativeFn || v instanceof JClass) return 'function';
    if (isPrim(v)) return v === null ? 'object' : typeof v;
    return 'object';
  };

  function levenshtein(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[a.length][b.length];
  }

  /** Formato para mostrar valores (consola, pila, resultados). */
  function fmt(v, depth = 0, top = true) {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'string') return top ? v : JSON.stringify(v);
    if (typeof v === 'number') return Object.is(v, -0) ? '0' : String(v);
    if (typeof v === 'boolean') return String(v);
    if (v instanceof JNode) return `Nodo(${fmt(v.valor, 0, false)})`;
    if (v instanceof JFunction) return `ƒ ${v.name || 'anónima'}`;
    if (v instanceof NativeFn) return `ƒ ${v.name}`;
    if (v instanceof JError) return `${v.name}: ${v.message}`;
    if (v instanceof JClass) return `class ${v.name}`;
    if (v instanceof JInstance && depth > 1) return v.cls.name;
    if (v instanceof JInstance) {
      const items = [...v.props].slice(0, 8).map(([k, x]) => `${k}: ${fmt(x, depth + 1, false)}`);
      return `${v.cls.name} {${items.length ? ' ' + items.join(', ') + ' ' : ''}}`;
    }
    if (depth > 2) return Array.isArray(v) ? '[…]' : '{…}';
    if (Array.isArray(v)) {
      const items = v.slice(0, 30).map(x => fmt(x, depth + 1, false));
      if (v.length > 30) items.push(`… ${v.length - 30} más`);
      return `[${items.join(', ')}]`;
    }
    if (v instanceof JObject) {
      const items = [...v.props].slice(0, 12).map(([k, x]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${fmt(x, depth + 1, false)}`);
      return items.length ? `{ ${items.join(', ')} }` : '{}';
    }
    return String(v);
  }

  class Interpreter {
    constructor(program, { root, general, allocId, onMutate, treeClass = null, maxDepth = 200 }) {
      this.program = program;
      this.general = general;
      this.allocId = allocId;
      this.onMutate = onMutate;
      this.treeClass = treeClass;
      this.maxDepth = maxDepth;
      this.initialRoot = root;
      this.arbol = null;
      this.silent = false;
      this.global = new Env(null);
      this.stack = [];
      this.out = [];
      this.inflight = [];
      this.frameSeq = 0;
      this.readonlyArrays = new WeakSet();
      this.hijosArrays = new WeakSet();
      this.builtins = this.makeBuiltins();
    }

    /** Avisa que el árbol va a cambiar (salvo mientras se construye `arbol` en silencio). */
    mut() {
      if (!this.silent) this.onMutate();
    }

    /** La raíz del árbol que se muestra: arbol.raiz (raiz es un alias). */
    getRoot() {
      const r = this.arbol?.props.get('raiz');
      return r instanceof JNode ? r : null;
    }

    /** Registra el array de hijos de un nodo general (para detectar cambios en el árbol). */
    trackHijos(node) {
      if (node.hijos) this.hijosArrays.add(node.hijos);
    }

    top() { return this.stack[this.stack.length - 1]; }

    // ---------- ejecución ----------
    *run(lineStmts) {
      const main = { id: 0, name: 'main', isMain: true, env: this.global, baseEnv: this.global, line: null };
      this.stack.push(main);
      this.hoist(this.program.body, this.global);
      this.defineClasses(this.program.body.filter(s => s.t === 'classdecl'), this.global);
      for (const s of this.program.body) if (s.t === 'var') yield* this.execVar(s, this.global);
      this.createArbol();
      const env = new Env(this.global);
      main.env = env;
      main.baseEnv = env;
      this.hoist(lineStmts, env);
      let last;
      for (const s of lineStmts) {
        if (s.t === 'expr') last = yield* this.eval(s.expr, env);
        else { yield* this.exec(s, env); last = undefined; }
      }
      return last;
    }

    /** Define las clases del nivel superior en orden de herencia (la madre antes que la hija). */
    defineClasses(decls, env) {
      const pending = [...decls];
      while (pending.length) {
        const i = pending.findIndex(d => !d.parent || this.findEntry(d.parent, env) || !pending.some(o => o.name === d.parent));
        if (i < 0) throw new RuntimeErr(`Herencia circular entre ${pending.map(d => d.name).join(' y ')}.`, pending[0], 'SyntaxError');
        this.defineClass(pending.splice(i, 1)[0], env);
      }
    }

    defineClass(d, env) {
      let parent = null;
      if (d.parent) {
        const found = this.findEntry(d.parent, env);
        if (!found) throw new RuntimeErr(`ReferenceError: la clase «${d.parent}» (extends ${d.parent}) no está definida.${this.suggest(d.parent, env)}`, d, 'ReferenceError');
        parent = found.en.v;
        if (!(parent instanceof JClass)) throw new RuntimeErr(`TypeError: «${d.parent}» no es una clase, no se puede extender.`, d, 'TypeError');
      }
      if (env.vars.has(d.name)) throw new RuntimeErr(`SyntaxError: «${d.name}» ya está definida.`, d, 'SyntaxError');
      const cls = new JClass(d, parent, env);
      for (const m of d.methods) cls.methods.set(m.name, new JFunction(m.fn, env, m.name, cls));
      for (const m of d.statics) cls.statics.set(m.name, new JFunction(m.fn, env, m.name, cls));
      if (d.ctor) cls.ctor = new JFunction(d.ctor, env, 'constructor', cls, true);
      env.vars.set(d.name, { v: cls, kind: 'class' });
      return cls;
    }

    /** Crea `arbol` (instancia de la clase elegida) y le cuelga la raíz dibujada. */
    createArbol() {
      const cls = this.treeClass ? this.findEntry(this.treeClass, this.global)?.en.v : null;
      let arbol;
      if (cls instanceof JClass) {
        arbol = new JInstance(cls);
        this.silent = true;
        try {
          const g = this.construct(cls, arbol, [], { line: cls.decl.line, txt: `new ${cls.name}()` });
          while (!g.next().done);
        } finally {
          this.silent = false;
        }
        this.stack.length = 1;
      } else {
        arbol = new JObject();
      }
      arbol.props.set('raiz', this.initialRoot);
      this.arbol = arbol;
      this.global.vars.set('arbol', { v: arbol, kind: 'const' });
    }

    hoist(stmts, env) {
      for (const s of stmts) {
        if (s.t === 'funcdecl') env.vars.set(s.name, { v: new JFunction(s, env, s.name), kind: 'function' });
      }
    }

    *step(line) {
      const f = this.top();
      if (f.isMain) return;
      f.line = line;
      yield { kind: 'step', line };
    }

    *execBlock(body, env) {
      const f = this.top();
      const inner = new Env(env);
      const prev = f.env;
      f.env = inner;
      this.hoist(body, inner);
      try {
        for (const st of body) yield* this.exec(st, inner);
      } finally {
        f.env = prev;
      }
    }

    *loopBody(body, env) {
      try {
        yield* this.exec(body, env);
      } catch (sig) {
        if (sig === BREAK || sig === CONTINUE) return sig;
        throw sig;
      }
      return null;
    }

    *exec(s, env) {
      if (s.t === 'block') return yield* this.execBlock(s.body, env);
      if (s.t === 'empty' || s.t === 'funcdecl') return;
      if (s.t === 'classdecl') { this.defineClass(s, env); return; }
      yield* this.step(s.line);
      const f = this.top();

      switch (s.t) {
        case 'var':
          return yield* this.execVar(s, env);
        case 'expr':
          yield* this.eval(s.expr, env);
          return;
        case 'if':
          if (truthy(yield* this.eval(s.test, env))) yield* this.exec(s.cons, env);
          else if (s.alt) yield* this.exec(s.alt, env);
          return;
        case 'while':
          for (let first = true; ; first = false) {
            if (!first) yield* this.step(s.line);
            if (!truthy(yield* this.eval(s.test, env))) break;
            if ((yield* this.loopBody(s.body, env)) === BREAK) break;
          }
          return;
        case 'do':
          for (;;) {
            if ((yield* this.loopBody(s.body, env)) === BREAK) break;
            yield* this.step(s.testLine);
            if (!truthy(yield* this.eval(s.test, env))) break;
          }
          return;
        case 'for': {
          const loopEnv = new Env(env);
          const prev = f.env;
          f.env = loopEnv;
          try {
            if (s.init) {
              if (s.init.t === 'var') yield* this.execVar(s.init, loopEnv);
              else yield* this.eval(s.init.expr, loopEnv);
            }
            for (let first = true; ; first = false) {
              if (!first) yield* this.step(s.line);
              if (s.test && !truthy(yield* this.eval(s.test, loopEnv))) break;
              if ((yield* this.loopBody(s.body, loopEnv)) === BREAK) break;
              if (s.update) yield* this.eval(s.update, loopEnv);
            }
          } finally {
            f.env = prev;
          }
          return;
        }
        case 'forof':
        case 'forin': {
          const coll = yield* this.eval(s.iter, env);
          let items;
          if (s.t === 'forof') items = this.iterable(coll, s.iter);
          else if (coll instanceof JObject) items = [...coll.props.keys()];
          else if (Array.isArray(coll) || typeof coll === 'string') items = Object.keys([...coll]);
          else throw new RuntimeErr(`TypeError: no se puede recorrer ${fmt(coll)} con for...in.`, s.iter, 'TypeError');
          for (let i = 0; i < items.length; i++) {
            if (i > 0) yield* this.step(s.line);
            const itEnv = new Env(env);
            if (s.decl) itEnv.vars.set(s.name, { v: items[i], kind: s.decl });
            else this.assignVar(s.name, items[i], env, s);
            const prev = f.env;
            f.env = itEnv;
            let r;
            try { r = yield* this.loopBody(s.body, itEnv); } finally { f.env = prev; }
            if (r === BREAK) break;
          }
          return;
        }
        case 'return':
          throw new ReturnSig(s.arg ? yield* this.eval(s.arg, env) : undefined);
        case 'break':
          throw BREAK;
        case 'continue':
          throw CONTINUE;
        case 'throw': {
          const v = yield* this.eval(s.arg, env);
          if (v instanceof JError && /no implementad/i.test(v.message) && f.fn) {
            throw new RuntimeErr(`«${f.name}» todavía no está implementado: completalo en el editor.`, s, 'Pendiente');
          }
          throw new RuntimeErr(v instanceof JError ? `${v.name}: ${v.message}` : `Se lanzó ${fmt(v, 0, false)}`, s, 'Excepción');
        }
      }
      throw new RuntimeErr(`Sentencia no soportada: ${s.t}`, s);
    }

    *execVar(s, env) {
      for (const d of s.decls) {
        const v = d.init ? yield* this.eval(d.init, env) : undefined;
        if (v instanceof JFunction && !v.name) v.name = d.name;
        if (env.vars.has(d.name) && s.kind !== 'var') {
          throw new RuntimeErr(`SyntaxError: «${d.name}» ya fue declarada en este bloque.`, d.tok, 'SyntaxError');
        }
        env.vars.set(d.name, { v, kind: s.kind });
      }
    }

    // ---------- variables ----------
    findEntry(name, env) {
      for (let s = env; s; s = s.parent) {
        const en = s.vars.get(name);
        if (en) return { en, scope: s };
      }
      return null;
    }

    has(name, env) {
      return !!this.findEntry(name, env) || this.builtins.has(name);
    }

    suggest(name, env) {
      const names = new Set(this.builtins.keys());
      for (let s = env; s; s = s.parent) for (const k of s.vars.keys()) names.add(k);
      let best = null, bestD = 3;
      for (const k of names) {
        const d = levenshtein(name.toLowerCase(), k.toLowerCase());
        if (d < bestD) { best = k; bestD = d; }
      }
      return best && best !== name ? ` ¿Quisiste decir «${best}»?` : '';
    }

    lookup(name, env, node) {
      const found = this.findEntry(name, env);
      if (found) return found.en.v;
      if (name === 'raiz' && this.arbol) return this.arbol.props.get('raiz') ?? null;
      if (this.builtins.has(name)) return this.builtins.get(name);
      throw new RuntimeErr(`ReferenceError: «${name}» no está definida.${this.suggest(name, env)}`, node, 'ReferenceError');
    }

    assignVar(name, v, env, node) {
      const found = this.findEntry(name, env);
      if (!found && name === 'raiz' && this.arbol) {
        this.setProp(this.arbol, 'raiz', v, node);
        return;
      }
      if (!found) {
        throw new RuntimeErr(`ReferenceError: «${name}» no está declarada. Declarala con let (o const) antes de usarla.${this.suggest(name, env)}`, node, 'ReferenceError');
      }
      if (found.en.kind === 'const') throw new RuntimeErr(`TypeError: «${name}» es una constante (const): no se puede reasignar. Usá let.`, node, 'TypeError');
      if (found.en.kind === 'function') throw new RuntimeErr(`TypeError: «${name}» es una función: no se puede reasignar.`, node, 'TypeError');
      if (found.en.kind === 'class') throw new RuntimeErr(`TypeError: «${name}» es una clase: no se puede reasignar.`, node, 'TypeError');
      if (found.en.kind === 'this') throw new RuntimeErr('SyntaxError: no se puede asignar a this.', node, 'SyntaxError');
      found.en.v = v;
    }

    // ---------- expresiones ----------
    *eval(e, env) {
      switch (e.t) {
        case 'lit':
          return e.v;
        case 'name':
          return this.lookup(e.name, env, e);
        case 'template': {
          let s = e.quasis[0];
          for (let i = 0; i < e.exprs.length; i++) s += this.str(yield* this.eval(e.exprs[i], env)) + e.quasis[i + 1];
          return s;
        }
        case 'array': {
          const out = [];
          for (const it of e.items) {
            if (it.t === 'spread') out.push(...this.iterable(yield* this.eval(it.arg, env), it.arg));
            else out.push(yield* this.eval(it, env));
          }
          return out;
        }
        case 'object': {
          const o = new JObject();
          for (const p of e.props) {
            const v = yield* this.eval(p.value, env);
            if (v instanceof JFunction && !v.name) v.name = p.key;
            o.props.set(p.key, v);
          }
          return o;
        }
        case 'funcexpr':
          return new JFunction(e, env, e.name);
        case 'this': {
          const found = this.findEntry('this', env);
          return found ? found.en.v : undefined;
        }
        case 'supercall':
          return yield* this.evalSuperCall(e, env);
        case 'supermethod': {
          const home = this.findEntry('%home', env)?.en.v;
          const self = this.findEntry('this', env)?.en.v;
          if (!home) throw new RuntimeErr('SyntaxError: super.metodo() solo se puede usar dentro de un método de una clase.', e, 'SyntaxError');
          const m = home.parent?.findMethod(e.name);
          if (!m) throw new RuntimeErr(`TypeError: la clase madre de ${home.name} no tiene el método «${e.name}».`, e, 'TypeError');
          const args = yield* this.evalArgs(e.args, env);
          return yield* this.invoke(m, args, e, self);
        }
        case 'member': {
          const obj = yield* this.eval(e.obj, env);
          if (e.optional && (obj === null || obj === undefined)) throw SHORT;
          const key = e.computed ? yield* this.eval(e.prop, env) : e.name;
          return this.getProp(obj, key, e);
        }
        case 'chain':
          try {
            return yield* this.eval(e.expr, env);
          } catch (sig) {
            if (sig === SHORT) return undefined;
            throw sig;
          }
        case 'call':
          return yield* this.evalCall(e, env);
        case 'new':
          return yield* this.evalNew(e, env);
        case 'assign':
          return yield* this.evalAssign(e, env);
        case 'update': {
          const ref = yield* this.ref(e.target, env);
          const old = ref.get();
          const n = this.num(old, e.target, e.op);
          const nv = e.op === '++' ? n + 1 : n - 1;
          ref.set(nv);
          return e.prefix ? nv : n;
        }
        case 'unary': {
          if (e.op === 'typeof' && e.arg.t === 'name' && !this.has(e.arg.name, env)) return 'undefined';
          const v = yield* this.eval(e.arg, env);
          switch (e.op) {
            case '!': return !truthy(v);
            case '-': return -this.num(v, e.arg, '-');
            case '+': return +this.num(v, e.arg, '+');
            case '~': return ~this.num(v, e.arg, '~');
            case 'typeof': return typeOf(v);
            case 'void': return undefined;
          }
          break;
        }
        case 'bin': {
          const a = yield* this.eval(e.left, env);
          const b = yield* this.eval(e.right, env);
          return this.binop(e.op, a, b, e);
        }
        case 'and': {
          const a = yield* this.eval(e.left, env);
          return truthy(a) ? yield* this.eval(e.right, env) : a;
        }
        case 'or': {
          const a = yield* this.eval(e.left, env);
          return truthy(a) ? a : yield* this.eval(e.right, env);
        }
        case 'nullish': {
          const a = yield* this.eval(e.left, env);
          return a === null || a === undefined ? yield* this.eval(e.right, env) : a;
        }
        case 'cond':
          return truthy(yield* this.eval(e.test, env)) ? yield* this.eval(e.cons, env) : yield* this.eval(e.alt, env);
        case 'seq': {
          let v;
          for (const x of e.list) v = yield* this.eval(x, env);
          return v;
        }
        case 'spread':
          throw new RuntimeErr('SyntaxError: ... solo se puede usar dentro de un array o de los argumentos de una llamada.', e, 'SyntaxError');
      }
      throw new RuntimeErr(`Expresión no soportada: ${e.t}`, e);
    }

    *ref(t, env) {
      if (t.t === 'name') {
        return { get: () => this.lookup(t.name, env, t), set: v => this.assignVar(t.name, v, env, t) };
      }
      const obj = yield* this.eval(t.obj, env);
      const key = t.computed ? yield* this.eval(t.prop, env) : t.name;
      return { get: () => this.getProp(obj, key, t), set: v => this.setProp(obj, key, v, t) };
    }

    *evalAssign(e, env) {
      const ref = yield* this.ref(e.target, env);
      let v;
      if (e.op === '=') {
        v = yield* this.eval(e.value, env);
      } else if (e.op === '||=' || e.op === '&&=' || e.op === '??=') {
        const cur = ref.get();
        const go = e.op === '||=' ? !truthy(cur) : e.op === '&&=' ? truthy(cur) : cur === null || cur === undefined;
        if (!go) return cur;
        v = yield* this.eval(e.value, env);
      } else {
        const cur = ref.get();
        const rhs = yield* this.eval(e.value, env);
        v = this.binop(e.op.slice(0, -1), cur, rhs, e);
      }
      if (v instanceof JFunction && !v.name && e.target.t === 'name') v.name = e.target.name;
      ref.set(v);
      return v;
    }

    num(v, node, op) {
      if (v instanceof JNode) throw new RuntimeErr(`TypeError: «${node.txt}» es un nodo, no un número (operador ${op}). ¿Quisiste usar ${node.txt}.valor?`, node, 'TypeError');
      if (!isPrim(v)) throw new RuntimeErr(`TypeError: no se puede usar ${fmt(v, 0, false)} como número (operador ${op}).`, node, 'TypeError');
      return Number(v);
    }

    binop(op, a, b, e) {
      if (isPrim(a) && isPrim(b)) {
        switch (op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return a / b;
          case '%': return a % b;
          case '**': return a ** b;
          case '<': return a < b;
          case '>': return a > b;
          case '<=': return a <= b;
          case '>=': return a >= b;
          case '==': return a == b; // eslint-disable-line eqeqeq
          case '!=': return a != b; // eslint-disable-line eqeqeq
          case '===': return a === b;
          case '!==': return a !== b;
          case '&': return a & b;
          case '|': return a | b;
          case '^': return a ^ b;
          case '<<': return a << b;
          case '>>': return a >> b;
          case '>>>': return a >>> b;
          case 'in': throw new RuntimeErr(`TypeError: no se puede usar «in» con ${fmt(b, 0, false)}.`, e, 'TypeError');
          case 'instanceof': return false;
        }
      }
      switch (op) {
        case '===': case '==': return a === b;
        case '!==': case '!=': return a !== b;
        case 'in':
          if (b instanceof JObject) return b.props.has(this.str(a));
          if (Array.isArray(b)) return Number(a) >= 0 && Number(a) < b.length;
          if (b instanceof JNode) return a in FIELD;
          throw new RuntimeErr('TypeError: «in» solo funciona con objetos y arrays.', e, 'TypeError');
        case 'instanceof':
          if (b instanceof JClass) return a instanceof JInstance && a.cls.extendsFrom(b);
          if (b instanceof NativeFn && b.name === 'Nodo') return a instanceof JNode;
          if (b instanceof NativeFn && b.name === 'Array') return Array.isArray(a);
          throw new RuntimeErr('instanceof no está soportado.', e);
        case '+':
          if (typeof a === 'string' || typeof b === 'string') return this.str(a) + this.str(b);
          if (Array.isArray(a) || Array.isArray(b)) {
            throw new RuntimeErr('TypeError: + no une arrays. Usá [...a, ...b] o a.concat(b).', e, 'TypeError');
          }
      }
      const side = !isPrim(a) ? e.left : e.right;
      const val = !isPrim(a) ? a : b;
      if (val instanceof JNode) {
        throw new RuntimeErr(`TypeError: «${side.txt}» es un nodo, no se puede operar con ${op}. ¿Quisiste usar ${side.txt}.valor?`, e, 'TypeError');
      }
      throw new RuntimeErr(`TypeError: no se puede aplicar ${op} a ${fmt(val, 0, false)}.`, e, 'TypeError');
    }

    str(v) {
      if (v === null) return 'null';
      if (v === undefined) return 'undefined';
      if (isPrim(v)) return String(v);
      if (Array.isArray(v)) return v.map(x => (x === null || x === undefined ? '' : this.str(x))).join(',');
      if (v instanceof JNode) return `Nodo(${this.str(v.valor)})`;
      if (v instanceof JError) return `${v.name}: ${v.message}`;
      if (v instanceof JFunction || v instanceof NativeFn) return `function ${v.name || ''}`;
      if (v instanceof JClass) return `class ${v.name}`;
      if (v instanceof JInstance) return `[object ${v.cls.name}]`;
      return '[object Object]';
    }

    iterable(v, node) {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') return [...v];
      if (v instanceof JNode) throw new RuntimeErr(`TypeError: un nodo no se puede recorrer. ¿Quisiste usar ${node.txt}.hijos?`, node, 'TypeError');
      throw new RuntimeErr(`TypeError: «${node.txt}» (${fmt(v, 0, false)}) no se puede recorrer.`, node, 'TypeError');
    }

    // ---------- propiedades ----------
    nullError(obj, e, action) {
      const what = e.obj?.txt ?? 'el valor';
      const f = this.top();
      const isParam = e.obj?.t === 'name' && f?.fn?.decl.params.some(p => p.name === e.obj.name);
      const hint = isParam && obj === null ? ` ¿Falta el caso base para cuando «${what}» es null?` : '';
      return new RuntimeErr(`TypeError: «${what}» es ${obj === null ? 'null' : 'undefined'}, no se puede ${action}.${hint}`, e, 'TypeError');
    }

    getProp(obj, key, e) {
      if (obj === null || obj === undefined) throw this.nullError(obj, e, `leer .${key}`);
      if (obj instanceof JNode) return this.nodeGet(obj, key, e);
      if (Array.isArray(obj)) {
        if (key === 'length') return obj.length;
        if (typeof key === 'number' || /^\d+$/.test(key)) return obj[Number(key)];
        if (ARRAY_METHODS.has(key)) return new NativeFn(key, function* (args, ce) { return yield* this.arrayMethod(obj, key, args, ce); }, { gen: true });
        return undefined;
      }
      if (typeof obj === 'string') {
        if (key === 'length') return obj.length;
        if (typeof key === 'number' || /^\d+$/.test(key)) return obj[Number(key)];
        return undefined;
      }
      if (obj instanceof JInstance) {
        const k = String(key);
        if (obj.props.has(k)) return obj.props.get(k);
        const m = obj.cls.findMethod(k);
        if (m) return m;
        const names = [...obj.props.keys(), ...obj.cls.allMethodNames()];
        const best = names.map(n => [n, levenshtein(k.toLowerCase(), n.toLowerCase())]).sort((a, b) => a[1] - b[1])[0];
        const hint = best && best[1] <= 2 ? ` ¿Quisiste decir «${best[0]}»?` : '';
        throw new RuntimeErr(`TypeError: ${obj.cls.name} no tiene la propiedad ni el método «${k}».${hint}`, e, 'TypeError');
      }
      if (obj instanceof JClass) return obj.findStatic(String(key)) ?? undefined;
      if (obj instanceof JObject) return obj.props.get(String(key));
      if (obj instanceof NativeFn) return obj.props?.get(String(key));
      if (obj instanceof JError) return key === 'message' ? obj.message : key === 'name' ? obj.name : undefined;
      if (obj instanceof JFunction) return key === 'name' ? obj.name : key === 'length' ? obj.decl.params.length : undefined;
      return undefined;
    }

    setProp(obj, key, v, e) {
      if (obj === null || obj === undefined) throw this.nullError(obj, e, `asignar .${key}`);
      if (obj instanceof JNode) return this.nodeSet(obj, key, v, e);
      if (Array.isArray(obj)) {
        if (this.readonlyArrays.has(obj)) throw this.readonlyError(e);
        if (key === 'length') { obj.length = this.num(v, e, '='); return; }
        const i = Number(key);
        if (!Number.isInteger(i) || i < 0) throw new RuntimeErr(`TypeError: índice inválido ${fmt(key, 0, false)}.`, e, 'TypeError');
        if (this.hijosArrays.has(obj)) { this.checkChild(v, e); this.mut(); }
        obj[i] = v;
        return;
      }
      if (obj instanceof JInstance || obj instanceof JObject) {
        if (key === 'raiz' && obj === this.arbol) {
          if (v !== null && !(v instanceof JNode)) {
            throw new RuntimeErr(`TypeError: la raíz tiene que ser un nodo o null, pero recibió ${fmt(v, 0, false)}.${v === undefined ? ' ¿La función que llamaste se olvidó del return?' : ''}`, e, 'TypeError');
          }
          if (obj.props.get('raiz') !== v) this.mut();
        }
        obj.props.set(String(key), v);
        return;
      }
      throw new RuntimeErr(`TypeError: no se pueden asignar propiedades a ${fmt(obj, 0, false)}.`, e, 'TypeError');
    }

    readonlyError(e) {
      return new RuntimeErr('TypeError: en un árbol binario nodo.hijos es solo de lectura. Modificá nodo.izq o nodo.der.', e, 'TypeError');
    }

    checkChild(v, e) {
      if (!(v instanceof JNode)) throw new RuntimeErr(`TypeError: los hijos tienen que ser nodos (se recibió ${fmt(v, 0, false)}).`, e, 'TypeError');
    }

    nodeGet(n, key, e) {
      const f = FIELD[key];
      if (f === 'valor') return n.valor;
      if (f === 'altura') return n.altura;
      if (f === 'izq' || f === 'der') {
        if (this.general) throw new RuntimeErr(`TypeError: el árbol es general (AG), sus nodos no tienen .${key}. Recorré nodo.hijos.`, e, 'TypeError');
        return n[f];
      }
      if (f === 'hijos') {
        if (this.general) return n.hijos;
        const arr = [n.izq, n.der].filter(x => x !== null);
        this.readonlyArrays.add(arr);
        return arr;
      }
      throw new RuntimeErr(`TypeError: los nodos no tienen la propiedad «${key}». Tienen ${FIELD_HELP}.`, e, 'TypeError');
    }

    nodeSet(n, key, v, e) {
      const f = FIELD[key];
      if (!f) throw new RuntimeErr(`TypeError: los nodos no tienen la propiedad «${key}». Tienen ${FIELD_HELP}.`, e, 'TypeError');
      if (f === 'valor') {
        if (typeof v !== 'number' && typeof v !== 'string') {
          throw new RuntimeErr(`TypeError: el valor de un nodo tiene que ser un número o un texto (se recibió ${fmt(v, 0, false)}).`, e, 'TypeError');
        }
        this.mut();
        n.valor = v;
        return;
      }
      if (f === 'altura') {
        if (typeof v !== 'number' || Number.isNaN(v)) {
          throw new RuntimeErr(`TypeError: la altura de un nodo tiene que ser un número (se recibió ${fmt(v, 0, false)}).`, e, 'TypeError');
        }
        n.altura = v;
        return;
      }
      if (f === 'hijos') {
        if (!this.general) throw new RuntimeErr('TypeError: en un árbol binario no se asigna nodo.hijos: usá nodo.izq y nodo.der.', e, 'TypeError');
        if (!Array.isArray(v)) throw new RuntimeErr('TypeError: nodo.hijos tiene que ser un array de nodos.', e, 'TypeError');
        v.forEach(x => this.checkChild(x, e));
        this.mut();
        n.hijos = v;
        this.hijosArrays.add(v);
        return;
      }
      if (this.general) throw new RuntimeErr(`TypeError: el árbol es general (AG), sus nodos no tienen .${key}. Usá nodo.hijos.`, e, 'TypeError');
      if (v !== null && !(v instanceof JNode)) {
        const hint = v === undefined ? ' ¿La función que llamaste se olvidó del return?' : '';
        throw new RuntimeErr(`TypeError: ${e.txt} tiene que ser un nodo o null, pero recibió ${fmt(v, 0, false)}.${hint}`, e, 'TypeError');
      }
      this.mut();
      n[f] = v;
    }

    /** Métodos de la clase Nodo: getters/setters y esHoja(). */
    nodeMethod(n, key, args, e) {
      if (key === 'esHoja') return this.general ? n.hijos.length === 0 : n.izq === null && n.der === null;
      const f = NODE_METHODS[key];
      if (!f) {
        const extra = FIELD[key] ? ` (${e.callee.txt} es un campo: se usa sin paréntesis)` : '';
        throw new RuntimeErr(`TypeError: los nodos no tienen el método «${key}»${extra}. Tienen getDato/setDato, getIzq/setIzq, getDer/setDer, getAltura/setAltura y esHoja().`, e, 'TypeError');
      }
      if (key.startsWith('get')) return this.nodeGet(n, f, e);
      if (args.length !== 1) throw new RuntimeErr(`TypeError: ${key} recibe un argumento.`, e, 'TypeError');
      this.nodeSet(n, f, args[0], e);
      return undefined;
    }

    // ---------- llamadas ----------
    *evalArgs(list, env) {
      const out = [];
      for (const a of list) {
        if (a.t === 'spread') out.push(...this.iterable(yield* this.eval(a.arg, env), a.arg));
        else out.push(yield* this.eval(a, env));
      }
      return out;
    }

    *evalCall(e, env) {
      if (e.callee.t === 'member') {
        const c = e.callee;
        const obj = yield* this.eval(c.obj, env);
        if (c.optional && (obj === null || obj === undefined)) throw SHORT;
        const key = c.computed ? yield* this.eval(c.prop, env) : c.name;
        if (obj === null || obj === undefined) throw this.nullError(obj, c, `llamar a .${key}()`);
        const args = yield* this.evalArgs(e.args, env);
        return yield* this.callMethod(obj, key, args, e);
      }
      const fn = yield* this.eval(e.callee, env);
      if (e.optional && (fn === null || fn === undefined)) throw SHORT;
      const args = yield* this.evalArgs(e.args, env);
      return yield* this.callFunction(fn, args, e);
    }

    *callMethod(obj, key, args, e) {
      if (Array.isArray(obj)) return yield* this.arrayMethod(obj, key, args, e);
      if (typeof obj === 'string') return this.stringMethod(obj, key, args, e);
      if (typeof obj === 'number') return this.numberMethod(obj, key, args, e);
      if (obj instanceof JNode) return this.nodeMethod(obj, key, args, e);
      if (obj instanceof JInstance) {
        const own = obj.props.get(String(key));
        const m = own instanceof JFunction || own instanceof NativeFn ? own : obj.cls.findMethod(String(key));
        if (!m) {
          const best = obj.cls.allMethodNames().map(n => [n, levenshtein(String(key).toLowerCase(), n.toLowerCase())]).sort((a, b) => a[1] - b[1])[0];
          const hint = best && best[1] <= 2 ? ` ¿Quisiste decir «${best[0]}»?` : '';
          throw new RuntimeErr(`TypeError: ${obj.cls.name} no tiene el método «${key}».${hint}`, e, 'TypeError');
        }
        return yield* this.callFunction(m, args, e, obj);
      }
      if (obj instanceof JClass) {
        const m = obj.findStatic(String(key));
        if (!m) throw new RuntimeErr(`TypeError: ${obj.name} no tiene el método static «${key}».`, e, 'TypeError');
        return yield* this.callFunction(m, args, e, obj);
      }
      if (obj === this.arbol && obj instanceof JObject) {
        throw new RuntimeErr(`TypeError: «arbol» no es de ninguna clase (el árbol dibujado es general o se eligió «Sin clase»), así que no tiene ${key}(). Usá funciones sueltas con raiz.`, e, 'TypeError');
      }
      const fn = this.getProp(obj, key, e.callee);
      if (!(fn instanceof JFunction) && !(fn instanceof NativeFn)) {
        const extra = obj instanceof JNode && FIELD[key] ? ` (${e.callee.txt} es una propiedad, se usa sin paréntesis)` : '';
        throw new RuntimeErr(`TypeError: «${e.callee.txt}» no es una función${extra}.`, e, 'TypeError');
      }
      return yield* this.callFunction(fn, args, e);
    }

    *callFunction(fn, args, e, thisVal) {
      if (fn instanceof NativeFn) return fn.gen ? yield* fn.impl.call(this, args, e) : fn.impl.call(this, args, e);
      if (fn instanceof JClass) throw new RuntimeErr(`TypeError: ${fn.name} es una clase: se usa con new ${fn.name}(...).`, e, 'TypeError');
      if (!(fn instanceof JFunction)) {
        throw new RuntimeErr(`TypeError: «${e.callee?.txt ?? fmt(fn)}» no es una función (vale ${fmt(fn, 0, false)}).`, e, 'TypeError');
      }
      if (fn.isCtor) throw new RuntimeErr('TypeError: el constructor se llama con new.', e, 'TypeError');
      return yield* this.invoke(fn, args, e, thisVal);
    }

    /** Ejecuta la cadena de constructores de `cls` sobre la instancia `inst`. */
    *construct(cls, inst, args, e) {
      if (cls.ctor) {
        yield* this.invoke(cls.ctor, args, e, inst);
        return;
      }
      if (cls.parent) yield* this.construct(cls.parent, inst, args, e);
      yield* this.initFields(cls, inst);
    }

    *initFields(cls, inst) {
      for (const f of cls.decl.fields) {
        const env = new Env(cls.env);
        env.vars.set('this', { v: inst, kind: 'this' });
        inst.props.set(f.name, f.init ? yield* this.eval(f.init, env) : undefined);
      }
    }

    *evalSuperCall(e, env) {
      const home = this.findEntry('%home', env)?.en.v;
      const ctorFrame = this.findEntry('%ctor', env)?.en.v;
      if (!home || !ctorFrame) throw new RuntimeErr('SyntaxError: super(...) solo se puede usar dentro de un constructor.', e, 'SyntaxError');
      if (!home.parent) throw new RuntimeErr(`SyntaxError: ${home.name} no extiende a otra clase, así que no lleva super().`, e, 'SyntaxError');
      if (ctorFrame.superCalled) throw new RuntimeErr('ReferenceError: super() ya se llamó en este constructor.', e, 'ReferenceError');
      const self = this.findEntry('this', env).en.v;
      const args = yield* this.evalArgs(e.args, env);
      yield* this.construct(home.parent, self, args, e);
      ctorFrame.superCalled = true;
      yield* this.initFields(home, self);
      return undefined;
    }

    *invoke(fn, args, e, thisVal) {
      if (this.stack.length > this.maxDepth) {
        throw new RuntimeErr(`RangeError: se superaron ${this.maxDepth} llamadas anidadas (se llenó la pila). ¿Falta el caso base o la recursión no se acerca a él?`, e, 'RangeError');
      }
      const d = fn.decl;
      const penv = new Env(fn.env);
      const name = fn.home ? `${fn.home.name}.${fn.name}` : fn.name || '(anónima)';
      const frame = { id: ++this.frameSeq, name, fn, env: penv, baseEnv: penv, line: d.line, callLine: e?.line ?? null, thisVal };
      if (!d.arrow) penv.vars.set('this', { v: thisVal, kind: 'this' });
      if (fn.home) penv.vars.set('%home', { v: fn.home, kind: 'hidden' });
      if (fn.isCtor) penv.vars.set('%ctor', { v: frame, kind: 'hidden' });
      this.stack.push(frame);
      for (let i = 0; i < d.params.length; i++) {
        const p = d.params[i];
        let v = p.rest ? args.slice(i) : args[i];
        if (v === undefined && p.def) v = yield* this.eval(p.def, penv);
        penv.vars.set(p.name, { v, kind: 'param' });
      }
      yield { kind: 'call', frame };
      if (fn.isCtor && !fn.home.parent) yield* this.initFields(fn.home, thisVal);
      let result;
      try {
        yield* this.execBlock(d.body.body, penv);
        frame.line = d.body.endLine; // terminó sin return: se marca la llave de cierre
      } catch (sig) {
        if (sig instanceof ReturnSig) result = sig.value;
        else if (sig === BREAK || sig === CONTINUE) throw new RuntimeErr(`SyntaxError: ${sig.signal} fuera de un bucle.`, { line: frame.line }, 'SyntaxError');
        else throw sig;
      }
      if (fn.isCtor) {
        if (fn.home.parent && !frame.superCalled) {
          throw new RuntimeErr(`ReferenceError: el constructor de ${fn.home.name} tiene que llamar a super() porque extiende a ${fn.home.parent.name}.`, { line: d.line }, 'ReferenceError');
        }
        result = undefined;
      }
      frame.returned = true;
      frame.result = result;
      this.inflight = result === undefined ? [] : [result];
      yield { kind: 'return', frame, value: result };
      this.stack.pop();
      return result;
    }

    fnArg(v, e, name) {
      if (v instanceof JFunction || v instanceof NativeFn) return v;
      throw new RuntimeErr(`TypeError: .${name}() necesita una función como argumento, recibió ${fmt(v, 0, false)}.`, e, 'TypeError');
    }

    *arrayMethod(arr, key, args, e) {
      if (MUTATING.has(key)) {
        if (this.readonlyArrays.has(arr)) throw this.readonlyError(e);
        if (this.hijosArrays.has(arr)) {
          if (key === 'push' || key === 'unshift') args.forEach(x => this.checkChild(x, e));
          if (key === 'splice') args.slice(2).forEach(x => this.checkChild(x, e));
          if (key === 'fill') this.checkChild(args[0], e);
          this.mut();
        }
      }
      const call = (fn, xs) => this.callFunction(fn, xs, e);
      switch (key) {
        case 'push': arr.push(...args); return arr.length;
        case 'pop': return arr.pop();
        case 'shift': return arr.shift();
        case 'unshift': arr.unshift(...args); return arr.length;
        case 'splice': return arr.splice(...args.map((x, i) => (i < 2 ? Number(x) : x)));
        case 'reverse': return arr.reverse();
        case 'fill': return arr.fill(args[0], args[1], args[2]);
        case 'includes': return arr.some(x => x === args[0] || (Number.isNaN(x) && Number.isNaN(args[0])));
        case 'indexOf': return arr.indexOf(args[0]);
        case 'lastIndexOf': return arr.lastIndexOf(args[0]);
        case 'join': return arr.map(x => (x === null || x === undefined ? '' : this.str(x))).join(args[0] === undefined ? ',' : this.str(args[0]));
        case 'slice': return arr.slice(args[0], args[1]);
        case 'concat': return arr.concat(...args.map(a => (Array.isArray(a) ? a : [a])));
        case 'at': return arr.at(Number(args[0]));
        case 'flat': return arr.flat(args[0] ?? 1);
        case 'map': {
          const fn = this.fnArg(args[0], e, key);
          const out = [];
          for (let i = 0; i < arr.length; i++) out.push(yield* call(fn, [arr[i], i, arr]));
          return out;
        }
        case 'filter': {
          const fn = this.fnArg(args[0], e, key);
          const out = [];
          for (let i = 0; i < arr.length; i++) if (truthy(yield* call(fn, [arr[i], i, arr]))) out.push(arr[i]);
          return out;
        }
        case 'forEach': {
          const fn = this.fnArg(args[0], e, key);
          for (let i = 0; i < arr.length; i++) yield* call(fn, [arr[i], i, arr]);
          return undefined;
        }
        case 'some': {
          const fn = this.fnArg(args[0], e, key);
          for (let i = 0; i < arr.length; i++) if (truthy(yield* call(fn, [arr[i], i, arr]))) return true;
          return false;
        }
        case 'every': {
          const fn = this.fnArg(args[0], e, key);
          for (let i = 0; i < arr.length; i++) if (!truthy(yield* call(fn, [arr[i], i, arr]))) return false;
          return true;
        }
        case 'find':
        case 'findIndex': {
          const fn = this.fnArg(args[0], e, key);
          for (let i = 0; i < arr.length; i++) if (truthy(yield* call(fn, [arr[i], i, arr]))) return key === 'find' ? arr[i] : i;
          return key === 'find' ? undefined : -1;
        }
        case 'reduce': {
          const fn = this.fnArg(args[0], e, key);
          let i = 0, acc;
          if (args.length > 1) acc = args[1];
          else {
            if (!arr.length) throw new RuntimeErr('TypeError: reduce de un array vacío sin valor inicial.', e, 'TypeError');
            acc = arr[0];
            i = 1;
          }
          for (; i < arr.length; i++) acc = yield* call(fn, [acc, arr[i], i, arr]);
          return acc;
        }
        case 'sort': {
          const fn = args[0] === undefined ? null : this.fnArg(args[0], e, key);
          const cmp = function* (a, b) {
            if (fn) return Number(yield* call(fn, [a, b]));
            const x = this.str(a), y = this.str(b);
            return x < y ? -1 : x > y ? 1 : 0;
          }.bind(this);
          const sorted = yield* this.mergeSort(arr.slice(), cmp);
          sorted.forEach((x, i) => { arr[i] = x; });
          return arr;
        }
      }
      throw new RuntimeErr(`TypeError: los arrays no tienen el método «${key}».`, e, 'TypeError');
    }

    *mergeSort(a, cmp) {
      if (a.length < 2) return a;
      const mid = a.length >> 1;
      const l = yield* this.mergeSort(a.slice(0, mid), cmp);
      const r = yield* this.mergeSort(a.slice(mid), cmp);
      const out = [];
      let i = 0, j = 0;
      while (i < l.length && j < r.length) out.push((yield* cmp(l[i], r[j])) <= 0 ? l[i++] : r[j++]);
      return out.concat(l.slice(i), r.slice(j));
    }

    stringMethod(s, key, args, e) {
      if (!STRING_METHODS.has(key)) throw new RuntimeErr(`TypeError: los textos no tienen el método «${key}».`, e, 'TypeError');
      if (!args.every(isPrim)) throw new RuntimeErr(`TypeError: .${key}() espera textos o números.`, e, 'TypeError');
      return String.prototype[key].apply(s, args);
    }

    numberMethod(n, key, args, e) {
      if (key === 'toFixed') return n.toFixed(args[0] ?? 0);
      if (key === 'toString') return n.toString(args[0] ?? 10);
      if (key === 'toPrecision') return n.toPrecision(args[0]);
      throw new RuntimeErr(`TypeError: los números no tienen el método «${key}».`, e, 'TypeError');
    }

    *evalNew(e, env) {
      const name = e.callee.name;
      const userCls = this.findEntry(name, env)?.en.v;
      const args = yield* this.evalArgs(e.args, env);
      if (userCls instanceof JClass) {
        const inst = new JInstance(userCls);
        yield* this.construct(userCls, inst, args, e);
        return inst;
      }
      if (NODE_CLASSES.has(name)) {
        const [valor, a, b] = args;
        if (typeof valor !== 'number' && typeof valor !== 'string') {
          throw new RuntimeErr(`TypeError: new ${name}(valor) necesita un número o un texto (se recibió ${fmt(valor, 0, false)}).`, e, 'TypeError');
        }
        this.mut();
        const node = new JNode(this.allocId(), valor, this.general);
        if (this.general) {
          this.trackHijos(node);
          if (Array.isArray(a)) { a.forEach(x => this.checkChild(x, e)); node.hijos.push(...a); }
        } else {
          for (const [side, v] of [['izq', a], ['der', b]]) {
            if (v === undefined || v === null) continue;
            if (!(v instanceof JNode)) throw new RuntimeErr(`TypeError: el ${side === 'izq' ? 'segundo' : 'tercer'} argumento de new ${name} tiene que ser un nodo o null.`, e, 'TypeError');
            node[side] = v;
          }
        }
        return node;
      }
      if (name === 'Array') {
        if (args.length === 1 && typeof args[0] === 'number') return new Array(args[0]).fill(undefined);
        return [...args];
      }
      if (name === 'Object') return new JObject();
      if (/Error$/.test(name)) return new JError(name, args[0] === undefined ? '' : this.str(args[0]));
      throw new RuntimeErr(`No se puede usar new ${name}: solo Nodo, Array y Error.`, e);
    }

    makeBuiltins() {
      const I = this;
      const nf = (name, impl, props) => new NativeFn(name, impl, { props });
      const nums = (args, e, fname) => args.map((v, i) => I.num(v, e.args?.[i] ?? e, fname));
      const math = new JObject([
        ['PI', Math.PI], ['E', Math.E],
        ...['abs', 'floor', 'ceil', 'round', 'trunc', 'sqrt', 'cbrt', 'sign', 'log', 'log2', 'log10', 'exp', 'sin', 'cos', 'tan']
          .map(k => [k, nf(`Math.${k}`, (args, e) => Math[k](...nums(args, e, `Math.${k}`)))]),
        ...['max', 'min', 'pow', 'hypot']
          .map(k => [k, nf(`Math.${k}`, (args, e) => Math[k](...nums(args, e, `Math.${k}`)))]),
        ['random', nf('Math.random', () => Math.random())],
      ]);
      const log = nf('console.log', args => { I.out.push({ text: args.map(a => fmt(a)).join(' ') }); return undefined; });
      const consoleObj = new JObject([['log', log], ['info', log], ['warn', log], ['error', log]]);
      return new Map([
        ['Math', math],
        ['Nodo', nf('Nodo', (args, e) => { throw new RuntimeErr('TypeError: Nodo es una clase: se usa con new Nodo(dato).', e, 'TypeError'); })],
        ['console', consoleObj],
        ['Infinity', Infinity],
        ['NaN', NaN],
        ['parseInt', nf('parseInt', args => parseInt(I.str(args[0]), args[1]))],
        ['parseFloat', nf('parseFloat', args => parseFloat(I.str(args[0])))],
        ['isNaN', nf('isNaN', args => Number.isNaN(Number(args[0])))],
        ['String', nf('String', args => I.str(args[0]))],
        ['Boolean', nf('Boolean', args => truthy(args[0]))],
        ['Number', nf('Number', args => (isPrim(args[0]) ? Number(args[0]) : NaN), {
          MAX_SAFE_INTEGER: Number.MAX_SAFE_INTEGER,
          MIN_SAFE_INTEGER: Number.MIN_SAFE_INTEGER,
          MAX_VALUE: Number.MAX_VALUE,
          POSITIVE_INFINITY: Infinity,
          NEGATIVE_INFINITY: -Infinity,
          isInteger: nf('Number.isInteger', args => Number.isInteger(args[0])),
          isNaN: nf('Number.isNaN', args => Number.isNaN(args[0])),
          parseInt: nf('Number.parseInt', args => parseInt(I.str(args[0]), args[1])),
          parseFloat: nf('Number.parseFloat', args => parseFloat(I.str(args[0]))),
        })],
        ['Array', nf('Array', args => [...args], {
          isArray: nf('Array.isArray', args => Array.isArray(args[0])),
          of: nf('Array.of', args => [...args]),
        })],
      ]);
    }

    // ---------- estado para la visualización ----------
    childrenOf(n) {
      if (this.general) return (n.hijos || []).filter(c => c instanceof JNode);
      return [n.izq, n.der].filter(c => c !== null);
    }

    /** Nodos alcanzables desde raiz y desde cualquier variable viva, con sus aristas. */
    graph() {
      const candidates = [];
      const seenVals = new Set();
      const collect = (v, depth = 0) => {
        if (v instanceof JNode) { candidates.push(v); return; }
        if (depth > 4 || isPrim(v) || seenVals.has(v)) return;
        seenVals.add(v);
        if (Array.isArray(v)) v.forEach(x => collect(x, depth + 1));
        else if (v instanceof JObject || v instanceof JInstance) v.props.forEach(x => collect(x, depth + 1));
      };
      const seenEnvs = new Set();
      for (const f of this.stack) {
        for (let s = f.env; s && !seenEnvs.has(s); s = s.parent) {
          seenEnvs.add(s);
          s.vars.forEach(en => collect(en.v));
        }
      }
      this.inflight.forEach(v => collect(v));

      const raiz = this.getRoot();
      const nodes = [], seen = new Set(), main = new Set(), floatingRoots = [];
      const walk = (start, isMain) => {
        const st = [start];
        while (st.length) {
          const n = st.pop();
          if (seen.has(n)) continue;
          seen.add(n);
          nodes.push(n);
          if (isMain) main.add(n.id);
          const kids = this.childrenOf(n);
          for (let i = kids.length - 1; i >= 0; i--) st.push(kids[i]);
        }
      };
      if (raiz instanceof JNode) walk(raiz, true);
      for (const c of candidates) {
        if (!seen.has(c)) { floatingRoots.push(c.id); walk(c, false); }
      }
      const edges = [];
      const keys = new Set();
      for (const n of nodes) {
        const pairs = this.general
          ? this.childrenOf(n).map(c => [c, null])
          : [[n.izq, 'L'], [n.der, 'R']].filter(([c]) => c);
        for (const [c, side] of pairs) {
          const k = `${n.id}>${c.id}`;
          if (keys.has(k)) continue;
          keys.add(k);
          edges.push({ from: n.id, to: c.id, side });
        }
      }
      return { nodes, edges, rootId: raiz instanceof JNode ? raiz.id : null, floatingRoots, main };
    }

    /** Variables visibles de un frame (de la más interna a los parámetros). */
    frameVars(f) {
      const out = new Map();
      for (let s = f.env; s; s = s.parent) {
        for (const [k, en] of s.vars) if (!out.has(k) && !HIDDEN_KINDS.has(en.kind)) out.set(k, en.v);
        if (s === f.baseEnv) break;
      }
      return [...out].reverse();
    }

    /** Nodo "en foco" de un frame: su primer parámetro que sea un nodo. */
    frameNode(f) {
      if (!f.fn) return null;
      for (const p of f.fn.decl.params) {
        const v = f.baseEnv.vars.get(p.name)?.v;
        if (v instanceof JNode) return v;
      }
      return null;
    }
  }

  return { Interpreter, JNode, JObject, JFunction, JClass, JInstance, NativeFn, RuntimeErr, fmt };
})();
