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
  /** ¿La función acepta `n` argumentos? (Java: sobrecarga por cantidad de parámetros). */
  const arityOk = (fn, n) => {
    const ps = fn.decl.params;
    const req = ps.filter(p => !p.def && !p.rest).length;
    return n >= req && (ps.some(p => p.rest) || n <= ps.length);
  };
  const pick = (list, argc) => (argc === null ? list[list.length - 1] : list.find(f => arityOk(f, argc)) ?? null);

  class JClass {
    constructor(decl, parent, env) {
      this.name = decl.name;
      this.decl = decl;
      this.parent = parent;
      this.env = env;
      this.ctors = [];
      this.methods = new Map();   // nombre → [JFunction] (sobrecargas)
      this.statics = new Map();
    }
    /**
     * Método a ejecutar. Los private solo se ven desde su propia clase (`from`) y ahí
     * tienen prioridad, como en Java. Si ninguno acepta `argc` argumentos, devuelve el
     * primero con ese nombre para que la llamada informe el error de cantidad.
     */
    findMethod(name, argc = null, from = null) {
      if (from) {
        const own = from.methods.get(name)?.filter(f => f.isPrivate);
        const m = own?.length ? pick(own, argc) : null;
        if (m) return m;
      }
      let fallback = null;
      for (let c = this; c; c = c.parent) {
        const list = c.methods.get(name)?.filter(f => !f.isPrivate || c === from);
        if (!list?.length) continue;
        fallback ??= list[0];
        const m = pick(list, argc);
        if (m) return m;
      }
      return fallback;
    }
    findStatic(name, argc = null) {
      for (let c = this; c; c = c.parent) {
        const list = c.statics.get(name);
        if (list?.length) return pick(list, argc) ?? list[0];
      }
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
  /** Colección de Java (ArrayList, LinkedList, ArrayDeque, Stack). */
  class JList {
    constructor(kind, items = []) { this.kind = kind; this.items = items; this.readonly = false; this.hijosOf = null; }
  }
  const INT_TYPES = new Set(['int', 'long', 'short', 'byte']);
  const javaDefault = t => (INT_TYPES.has(t) || t === 'double' || t === 'float' ? 0 : t === 'boolean' ? false : t === 'char' ? '\0' : null);
  const startsWithCtorCall = body => {
    const s0 = body.body[0];
    return s0?.t === 'expr' && (s0.expr.t === 'supercall' || s0.expr.t === 'thiscall');
  };
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
    if (v instanceof JList) return fmt(v.items, depth, false);
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
      this.java = program.lang === 'java';
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
      const add = (map, m) => {
        const f = new JFunction(m.fn, env, m.name, cls);
        f.isPrivate = !!m.fn.isPrivate;
        if (!map.has(m.name)) map.set(m.name, []);
        map.get(m.name).push(f);
      };
      d.methods.forEach(m => add(cls.methods, m));
      d.statics.forEach(m => add(cls.statics, m));
      cls.ctors = (d.ctors ?? (d.ctor ? [d.ctor] : [])).map(fn => new JFunction(fn, env, 'constructor', cls, true));
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
      if (f.isMain || f.lib) return;
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
            if (s.decl) itEnv.vars.set(s.name, { v: this.coerce(items[i], s.jtype, s.iter), kind: s.decl, type: s.jtype });
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
        let v = d.init ? yield* this.eval(d.init, env) : undefined;
        if (v instanceof JFunction && !v.name) v.name = d.name;
        if (env.vars.has(d.name) && s.kind !== 'var') {
          throw new RuntimeErr(`SyntaxError: «${d.name}» ya fue declarada en este bloque.`, d.tok, 'SyntaxError');
        }
        if (d.init) v = this.coerce(v, s.jtype, d.init);
        else if (this.java && env === this.global) v = javaDefault(s.jtype);
        env.vars.set(d.name, { v, kind: s.kind, type: s.jtype });
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

    /** Java: un nombre suelto puede ser un campo del objeto actual (this implícito). */
    implicitThis(name, env) {
      if (!this.java) return null;
      const self = this.findEntry('this', env)?.en.v;
      return self instanceof JInstance && self.props.has(name) ? self : null;
    }

    lookup(name, env, node) {
      const found = this.findEntry(name, env);
      if (found) {
        if (this.java && found.en.v === undefined && found.en.kind === 'let') {
          throw new RuntimeErr(`La variable «${name}» todavía no tiene valor: inicializala antes de usarla.`, node, 'Error');
        }
        return found.en.v;
      }
      const self = this.implicitThis(name, env);
      if (self) return self.props.get(name);
      if (name === 'raiz' && this.arbol) return this.arbol.props.get('raiz') ?? null;
      if (this.builtins.has(name)) return this.builtins.get(name);
      throw new RuntimeErr(`ReferenceError: «${name}» no está definida.${this.suggest(name, env)}`, node, 'ReferenceError');
    }

    assignVar(name, v, env, node) {
      const found = this.findEntry(name, env);
      const self = found ? null : this.implicitThis(name, env);
      if (self) {
        this.setProp(self, name, v, node);
        return;
      }
      if (!found && name === 'raiz' && this.arbol) {
        this.setProp(this.arbol, 'raiz', v, node);
        return;
      }
      if (!found) {
        const how = this.java ? 'con su tipo (por ejemplo int x = 0;)' : 'con let (o const)';
        throw new RuntimeErr(`ReferenceError: «${name}» no está declarada. Declarala ${how} antes de usarla.${this.suggest(name, env)}`, node, 'ReferenceError');
      }
      if (found.en.kind === 'const') throw new RuntimeErr(`TypeError: «${name}» es una constante (const): no se puede reasignar. Usá let.`, node, 'TypeError');
      if (found.en.kind === 'function') throw new RuntimeErr(`TypeError: «${name}» es una función: no se puede reasignar.`, node, 'TypeError');
      if (found.en.kind === 'class') throw new RuntimeErr(`TypeError: «${name}» es una clase: no se puede reasignar.`, node, 'TypeError');
      if (found.en.kind === 'this') throw new RuntimeErr('SyntaxError: no se puede asignar a this.', node, 'SyntaxError');
      found.en.v = this.coerce(v, found.en.type, node);
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
          const args = yield* this.evalArgs(e.args, env);
          const m = home.parent?.findMethod(e.name, this.java ? args.length : null, home.parent);
          if (!m) throw new RuntimeErr(`TypeError: la clase madre de ${home.name} no tiene el método «${e.name}».`, e, 'TypeError');
          return yield* this.invoke(m, args, e, self);
        }
        case 'thiscall': {
          const home = this.findEntry('%home', env)?.en.v;
          const ctorFrame = this.findEntry('%ctor', env)?.en.v;
          if (!home || !ctorFrame) throw new RuntimeErr('this(...) solo se puede usar al principio de un constructor.', e, 'SyntaxError');
          const self = this.findEntry('this', env).en.v;
          const args = yield* this.evalArgs(e.args, env);
          const ctor = home.ctors.find(f => arityOk(f, args.length) && f.decl !== ctorFrame.fn.decl);
          if (!ctor) throw new RuntimeErr(`${home.name} no tiene otro constructor con ${args.length} parámetro(s).`, e, 'TypeError');
          yield* this.invoke(ctor, args, e, self);
          ctorFrame.superCalled = true;
          return undefined;
        }
        case 'cast': {
          const v = yield* this.eval(e.arg, env);
          if (INT_TYPES.has(e.type)) return typeof v === 'string' && v.length === 1 ? v.charCodeAt(0) : Math.trunc(this.num(v, e.arg, `(${e.type})`));
          if (e.type === 'double' || e.type === 'float') return this.num(v, e.arg, `(${e.type})`);
          if (e.type === 'char') return typeof v === 'number' ? String.fromCharCode(v) : v;
          return v;
        }
        case 'instanceof': {
          const v = yield* this.eval(e.left, env);
          const tn = e.typeName;
          if (NODE_CLASSES.has(tn)) return v instanceof JNode;
          if (tn === 'String') return typeof v === 'string';
          if (['Integer', 'Double', 'Long', 'Number'].includes(tn)) return typeof v === 'number';
          if (tn === 'Boolean') return typeof v === 'boolean';
          if (tn === 'Object') return v !== null && v !== undefined;
          if (['List', 'ArrayList', 'LinkedList', 'Queue', 'Deque', 'ArrayDeque', 'Stack', 'Collection'].includes(tn)) return v instanceof JList;
          const cls = this.findEntry(tn, env)?.en.v;
          return cls instanceof JClass && v instanceof JInstance && v.cls.extendsFrom(cls);
        }
        case 'newarr': {
          const n = yield* this.eval(e.size, env);
          if (!Number.isInteger(n) || n < 0) throw new RuntimeErr(`NegativeArraySizeException: tamaño de array inválido (${fmt(n, 0, false)}).`, e.size, 'Error');
          return new Array(n).fill(javaDefault(e.elem));
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
          // Java: entre enteros, / y % son división entera.
          if (e.java && (e.op === '/' || e.op === '%') && Number.isInteger(a) && Number.isInteger(b)
            && !this.isDoubleExpr(e.left, env) && !this.isDoubleExpr(e.right, env)) {
            if (b === 0) throw new RuntimeErr('ArithmeticException: división por cero (/ by zero).', e, 'ArithmeticException');
            return e.op === '/' ? Math.trunc(a / b) : a % b;
          }
          if (e.java && e.op === '+' && (typeof a === 'string' || typeof b === 'string')) return this.str(a) + this.str(b);
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
      if (v instanceof JList) return fmt(v, 0, false);
      if (v instanceof JInstance) return this.java ? `${v.cls.name}@${v.cls.name.length.toString(16)}` : `[object ${v.cls.name}]`;
      return '[object Object]';
    }

    /** Java: ¿la expresión es de tipo double? (para decidir la división entera). */
    isDoubleExpr(x, env) {
      switch (x.t) {
        case 'lit': return !!x.isDouble;
        case 'cast': return x.type === 'double' || x.type === 'float';
        case 'name': return ['double', 'float', 'Double', 'Float'].includes(this.findEntry(x.name, env)?.en.type);
        case 'bin': return this.isDoubleExpr(x.left, env) || this.isDoubleExpr(x.right, env);
        case 'unary': return this.isDoubleExpr(x.arg, env);
        case 'cond': return this.isDoubleExpr(x.cons, env) || this.isDoubleExpr(x.alt, env);
        default: return false;
      }
    }

    /** Java: controla (y convierte) un valor según el tipo declarado. */
    coerce(v, type, node) {
      if (!this.java || !type || v === undefined) return v;
      const bad = what => new RuntimeErr(`TypeError: no se puede guardar ${fmt(v, 0, false)} en ${what}.`, node, 'TypeError');
      if (INT_TYPES.has(type)) {
        if (typeof v === 'string' && v.length === 1) return v.charCodeAt(0);
        if (typeof v !== 'number') throw bad(`un ${type}`);
        if (!Number.isInteger(v)) throw new RuntimeErr(`TypeError: ${v} tiene decimales y no entra en un ${type}. Si es a propósito, usá un cast: (int).`, node, 'TypeError');
        return v;
      }
      if (type === 'double' || type === 'float') { if (typeof v !== 'number') throw bad(`un ${type}`); return v; }
      if (type === 'boolean') { if (typeof v !== 'boolean') throw bad('un boolean'); return v; }
      if (type === 'char') { if (typeof v === 'number') return String.fromCharCode(v); if (typeof v !== 'string') throw bad('un char'); return v; }
      if (type === 'String') { if (v !== null && typeof v !== 'string') throw bad('un String'); return v; }
      if (['Integer', 'Long', 'Double'].includes(type)) { if (v !== null && typeof v !== 'number') throw bad(`un ${type}`); return v; }
      if (NODE_CLASSES.has(type)) { if (v !== null && !(v instanceof JNode)) throw bad(`un ${type}`); return v; }
      return v;
    }

    iterable(v, node) {
      if (Array.isArray(v)) return v;
      if (v instanceof JList) return v.items;
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
      const kind = this.java ? 'NullPointerException' : 'TypeError';
      return new RuntimeErr(`${kind}: «${what}» es ${obj === null ? 'null' : 'undefined'}, no se puede ${action}.${hint}`, e, kind);
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
      if (obj instanceof JList) throw new RuntimeErr(`TypeError: las listas no tienen el campo «${key}». ${key === 'length' ? 'Usá size().' : ''}`, e, 'TypeError');
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
        if (this.java) {
          if (this.general) {
            const l = new JList('list', n.hijos);
            l.hijosOf = n;
            return l;
          }
          const l = new JList('list', [n.izq, n.der].filter(x => x !== null));
          l.readonly = true;
          return l;
        }
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
        if (v instanceof JList) v = v.items;
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
      if (key === 'equals') return args[0] === n;
      if (key === 'toString') return this.str(n);
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
        return yield* this.callMethod(obj, key, args, e, this.findEntry('%home', env)?.en.v ?? null);
      }
      if (this.java && e.callee.t === 'name' && !this.findEntry(e.callee.name, env) && !this.builtins.has(e.callee.name)) {
        const args = yield* this.evalArgs(e.args, env);
        return yield* this.callUnqualified(e.callee.name, args, e, env);
      }
      const fn = yield* this.eval(e.callee, env);
      if (e.optional && (fn === null || fn === undefined)) throw SHORT;
      const args = yield* this.evalArgs(e.args, env);
      return yield* this.callFunction(fn, args, e);
    }

    /** Java: metodo(...) sin objeto delante → método del objeto actual o static de la clase. */
    *callUnqualified(name, args, e, env) {
      const self = this.findEntry('this', env)?.en.v;
      const home = this.findEntry('%home', env)?.en.v ?? null;
      if (self instanceof JInstance) {
        const m = self.cls.findMethod(name, args.length, home);
        if (m && arityOk(m, args.length)) return yield* this.invoke(m, args, e, self);
      }
      const st = home?.findStatic(name, args.length);
      if (st) return yield* this.invoke(st, args, e, undefined);
      if (self instanceof JInstance) {
        this.privateCheck(self.cls, name, args, e);
        const m = self.cls.findMethod(name, args.length, home);
        if (m) return yield* this.invoke(m, args, e, self);
      }
      const names = self instanceof JInstance ? self.cls.allMethodNames() : [];
      const best = names.map(n => [n, levenshtein(name.toLowerCase(), n.toLowerCase())]).sort((a, b) => a[1] - b[1])[0];
      const hint = best && best[1] <= 2 ? ` ¿Quisiste decir «${best[0]}»?` : this.suggest(name, env);
      throw new RuntimeErr(`No existe el método «${name}».${hint}`, e, 'ReferenceError');
    }

    /** Si el único método que encaja es private de otra clase, lo explica. */
    privateCheck(cls, name, args, e) {
      for (let c = cls; c; c = c.parent) {
        if (c.methods.get(name)?.some(f => f.isPrivate && arityOk(f, args.length))) {
          throw new RuntimeErr(`«${name}» es private en ${c.name}: solo se puede usar dentro de esa clase. Si lo necesitás en una subclase, declaralo protected.`, e, 'Error');
        }
      }
    }

    *callMethod(obj, key, args, e, home = null) {
      if (Array.isArray(obj)) return yield* this.arrayMethod(obj, key, args, e);
      if (obj instanceof JList) return this.listMethod(obj, key, args, e);
      if (typeof obj === 'string') return this.stringMethod(obj, key, args, e);
      if (typeof obj === 'number') return this.numberMethod(obj, key, args, e);
      if (typeof obj === 'boolean' && this.java && key === 'equals') return obj === args[0];
      if (obj instanceof JNode) return this.nodeMethod(obj, key, args, e);
      if (obj instanceof JInstance) {
        const own = obj.props.get(String(key));
        let m = own instanceof JFunction || own instanceof NativeFn ? own : obj.cls.findMethod(String(key), this.java ? args.length : null, home);
        if (m instanceof JFunction && this.java && !arityOk(m, args.length)) this.privateCheck(obj.cls, String(key), args, e);
        if (!m) {
          const best = obj.cls.allMethodNames().map(n => [n, levenshtein(String(key).toLowerCase(), n.toLowerCase())]).sort((a, b) => a[1] - b[1])[0];
          const hint = best && best[1] <= 2 ? ` ¿Quisiste decir «${best[0]}»?` : '';
          throw new RuntimeErr(`TypeError: ${obj.cls.name} no tiene el método «${key}».${hint}`, e, 'TypeError');
        }
        return yield* this.callFunction(m, args, e, obj);
      }
      if (obj instanceof JClass) {
        const m = obj.findStatic(String(key), this.java ? args.length : null);
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
      if (cls.ctors.length) {
        const ctor = this.java ? cls.ctors.find(f => arityOk(f, args.length)) : cls.ctors[0];
        if (!ctor) throw new RuntimeErr(`TypeError: ${cls.name} no tiene un constructor con ${args.length} parámetro(s).`, e, 'TypeError');
        yield* this.invoke(ctor, args, e, inst);
        return;
      }
      if (this.java && args.length) throw new RuntimeErr(`TypeError: ${cls.name} no tiene un constructor con ${args.length} parámetro(s).`, e, 'TypeError');
      if (cls.parent) yield* this.construct(cls.parent, inst, this.java ? [] : args, e);
      yield* this.initFields(cls, inst);
    }

    *initFields(cls, inst) {
      for (const f of cls.decl.fields) {
        const env = new Env(cls.env);
        env.vars.set('this', { v: inst, kind: 'this' });
        const v = f.init ? this.coerce(yield* this.eval(f.init, env), f.jtype, f.init) : this.java ? javaDefault(f.jtype) : undefined;
        inst.props.set(f.name, v);
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
      if (d.java && args.length !== d.params.length) {
        throw new RuntimeErr(`«${name}» recibe ${d.params.length} parámetro(s) y le pasaste ${args.length}.`, e, 'TypeError');
      }
      const frame = { id: ++this.frameSeq, name, fn, env: penv, baseEnv: penv, line: d.line, callLine: e?.line ?? null, thisVal, lib: !!d.lib };
      if (!d.arrow) penv.vars.set('this', { v: thisVal, kind: 'this' });
      if (fn.home) penv.vars.set('%home', { v: fn.home, kind: 'hidden' });
      if (fn.isCtor) penv.vars.set('%ctor', { v: frame, kind: 'hidden' });
      this.stack.push(frame);
      for (let i = 0; i < d.params.length; i++) {
        const p = d.params[i];
        let v = p.rest ? args.slice(i) : args[i];
        if (v === undefined && p.def) v = yield* this.eval(p.def, penv);
        penv.vars.set(p.name, { v: this.coerce(v, p.jtype, e), kind: 'param', type: p.jtype });
      }
      if (!frame.lib) yield { kind: 'call', frame };
      if (fn.isCtor && !fn.home.parent) yield* this.initFields(fn.home, thisVal);
      else if (fn.isCtor && d.java && !startsWithCtorCall(d.body)) {
        // Java: si el constructor no empieza con super(...) o this(...), llama a super() solo.
        yield* this.construct(fn.home.parent, thisVal, [], e);
        frame.superCalled = true;
        yield* this.initFields(fn.home, thisVal);
      }
      let result;
      try {
        yield* this.execBlock(d.body.body, penv);
        frame.line = d.body.endLine; // terminó sin return: se marca la llave de cierre
        if (d.java && !fn.isCtor && d.ret && d.ret !== 'void') {
          throw new RuntimeErr(`«${name}» terminó sin return: tiene que devolver un ${d.ret}.`, { line: d.body.endLine }, 'Error');
        }
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
      if (!frame.lib) yield { kind: 'return', frame, value: result };
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
      if (this.java) {
        const x = args[0];
        switch (key) {
          case 'length': return s.length;
          case 'equals': return s === x;
          case 'equalsIgnoreCase': return typeof x === 'string' && s.toLowerCase() === x.toLowerCase();
          case 'compareTo': return s < x ? -1 : s > x ? 1 : 0;
          case 'compareToIgnoreCase': return s.toLowerCase() < String(x).toLowerCase() ? -1 : s.toLowerCase() > String(x).toLowerCase() ? 1 : 0;
          case 'isEmpty': return s.length === 0;
          case 'contains': return s.includes(x);
          case 'hashCode': return [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
          case 'toString': return s;
        }
      }
      if (!STRING_METHODS.has(key)) throw new RuntimeErr(`TypeError: los textos no tienen el método «${key}».`, e, 'TypeError');
      if (!args.every(isPrim)) throw new RuntimeErr(`TypeError: .${key}() espera textos o números.`, e, 'TypeError');
      return String.prototype[key].apply(s, args);
    }

    numberMethod(n, key, args, e) {
      if (this.java) {
        const x = args[0];
        switch (key) {
          case 'equals': return typeof x === 'number' && x === n;
          case 'compareTo':
            if (typeof x !== 'number') throw new RuntimeErr(`TypeError: compareTo espera un número (se recibió ${fmt(x, 0, false)}).`, e, 'TypeError');
            return Math.sign(n - x);
          case 'intValue': case 'longValue': return Math.trunc(n);
          case 'doubleValue': case 'floatValue': return n;
          case 'hashCode': return n | 0;
          case 'toString': return String(n);
        }
      }
      if (key === 'toFixed') return n.toFixed(args[0] ?? 0);
      if (key === 'toString') return n.toString(args[0] ?? 10);
      if (key === 'toPrecision') return n.toPrecision(args[0]);
      throw new RuntimeErr(`TypeError: los números no tienen el método «${key}».`, e, 'TypeError');
    }

    /** Métodos de List / Queue / Deque / Stack de Java. */
    listMethod(list, key, args, e) {
      const it = list.items;
      const x = args[0];
      const stack = list.kind === 'stack';
      const mutating = ['add', 'addFirst', 'addLast', 'offer', 'offerFirst', 'offerLast', 'push', 'pop', 'poll', 'pollFirst', 'pollLast',
        'remove', 'removeFirst', 'removeLast', 'set', 'clear', 'addAll'];
      if (mutating.includes(key)) {
        if (list.readonly) throw this.readonlyError(e);
        if (list.hijosOf) {
          if (['add', 'addFirst', 'addLast', 'offer', 'push'].includes(key)) this.checkChild(args[args.length - 1], e);
          this.mut();
        }
      }
      const empty = what => new RuntimeErr(`NoSuchElementException: ${what} de una colección vacía.`, e, 'Error');
      const index = i => {
        if (!Number.isInteger(i) || i < 0 || i >= it.length) throw new RuntimeErr(`IndexOutOfBoundsException: índice ${fmt(i, 0, false)} fuera de rango (tamaño ${it.length}).`, e, 'Error');
        return i;
      };
      switch (key) {
        case 'add':
          if (args.length === 2) { if (!Number.isInteger(x) || x < 0 || x > it.length) index(x); it.splice(x, 0, args[1]); return undefined; }
          it.push(x); return true;
        case 'addLast': case 'offer': case 'offerLast': it.push(x); return key === 'offer' || key === 'offerLast' ? true : undefined;
        case 'addFirst': case 'offerFirst': it.unshift(x); return key === 'offerFirst' ? true : undefined;
        case 'push': if (stack) it.push(x); else it.unshift(x); return x;
        case 'pop': if (!it.length) throw empty('pop'); return stack ? it.pop() : it.shift();
        case 'peek': return it.length ? (stack ? it[it.length - 1] : it[0]) : null;
        case 'peekFirst': return it.length ? it[0] : null;
        case 'peekLast': return it.length ? it[it.length - 1] : null;
        case 'element': case 'getFirst': if (!it.length) throw empty(key); return it[0];
        case 'getLast': if (!it.length) throw empty(key); return it[it.length - 1];
        case 'poll': case 'pollFirst': return it.length ? it.shift() : null;
        case 'pollLast': return it.length ? it.pop() : null;
        case 'removeFirst': if (!it.length) throw empty(key); return it.shift();
        case 'removeLast': if (!it.length) throw empty(key); return it.pop();
        case 'remove':
          if (!args.length) { if (!it.length) throw empty('remove'); return it.shift(); }
          if (Number.isInteger(x) && (list.kind === 'list' || list.kind === 'linked')) return it.splice(index(x), 1)[0];
          { const i = it.indexOf(x); if (i < 0) return false; it.splice(i, 1); return true; }
        case 'get': return it[index(x)];
        case 'set': { const old = it[index(x)]; it[x] = args[1]; return old; }
        case 'size': return it.length;
        case 'isEmpty': return it.length === 0;
        case 'contains': return it.includes(x);
        case 'indexOf': return it.indexOf(x);
        case 'clear': it.length = 0; return undefined;
        case 'addAll': it.push(...this.iterable(x, e.args[0])); return true;
        case 'toString': return fmt(list, 0, false);
        case 'equals': return x instanceof JList && x.items.length === it.length && x.items.every((v, i) => v === it[i]);
      }
      throw new RuntimeErr(`TypeError: las listas no tienen el método «${key}».`, e, 'TypeError');
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
      const JAVA_COLLECTIONS = { ArrayList: 'list', LinkedList: 'linked', Vector: 'list', ArrayDeque: 'deque', Stack: 'stack' };
      if (JAVA_COLLECTIONS[name]) {
        const src = args[0];
        const items = src instanceof JList ? [...src.items] : Array.isArray(src) ? [...src] : [];
        return new JList(JAVA_COLLECTIONS[name], items);
      }
      if (['List', 'Queue', 'Deque', 'Collection'].includes(name)) {
        throw new RuntimeErr(`${name} es una interfaz: creá la colección con ${name === 'List' ? 'new ArrayList<>()' : 'new LinkedList<>()'}.`, e, 'TypeError');
      }
      if (name === 'Array') {
        if (args.length === 1 && typeof args[0] === 'number') return new Array(args[0]).fill(undefined);
        return [...args];
      }
      if (name === 'Object') return new JObject();
      if (/(Error|Exception)$/.test(name)) return new JError(name, args[0] === undefined ? '' : this.str(args[0]));
      throw new RuntimeErr(this.java ? `No se puede usar new ${name}: la clase no existe (¿está bien escrita?).${this.suggest(name, env)}` : `No se puede usar new ${name}: solo Nodo, Array y Error.`, e);
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
      // System.out.print deja la línea abierta; println la cierra.
      const write = (text, close) => {
        const last = I.out[I.out.length - 1];
        if (last?.open) { last.text += text; last.open = !close; } else I.out.push({ text, open: !close });
      };
      const printStream = new JObject([
        ['println', nf('System.out.println', args => { write(args.length ? fmt(args[0]) : '', true); })],
        ['print', nf('System.out.print', args => { write(fmt(args[0]), false); })],
        ['printf', nf('System.out.printf', args => {
          let i = 1;
          write(I.str(args[0]).replace(/%[-\d.]*([dsfn%])/g, (m, c) => (c === 'n' ? '\n' : c === '%' ? '%' : fmt(args[i++]))), false);
        })],
      ]);
      const javaNum = (MAX, MIN, parse) => new JObject([
        ['MAX_VALUE', MAX], ['MIN_VALUE', MIN],
        ['parseInt', nf('parseInt', args => parseInt(I.str(args[0]), 10))],
        ['parseDouble', nf('parseDouble', args => parseFloat(I.str(args[0])))],
        ['valueOf', nf('valueOf', args => parse(args[0]))],
        ['compare', nf('compare', args => Math.sign(args[0] - args[1]))],
        ['max', nf('max', args => Math.max(args[0], args[1]))],
        ['min', nf('min', args => Math.min(args[0], args[1]))],
        ['toString', nf('toString', args => I.str(args[0]))],
      ]);
      const javaBuiltins = this.java ? [
        ['System', new JObject([['out', printStream], ['err', printStream]])],
        ['Integer', javaNum(2147483647, -2147483648, v => parseInt(I.str(v), 10))],
        ['Long', javaNum(Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, v => parseInt(I.str(v), 10))],
        ['Double', javaNum(Number.MAX_VALUE, Number.MIN_VALUE, v => parseFloat(I.str(v)))],
        ['List', new JObject([['of', nf('List.of', args => new JList('list', [...args]))]])],
        ['Arrays', new JObject([['asList', nf('Arrays.asList', args => new JList('list', [...args]))]])],
        ['Objects', new JObject([['equals', nf('Objects.equals', args => args[0] === args[1])], ['isNull', nf('Objects.isNull', args => args[0] === null)]])],
      ] : [];
      return new Map([
        ...javaBuiltins,
        ['Math', math],
        ['Nodo', nf('Nodo', (args, e) => { throw new RuntimeErr('TypeError: Nodo es una clase: se usa con new Nodo(dato).', e, 'TypeError'); })],
        ['console', consoleObj],
        ['Infinity', Infinity],
        ['NaN', NaN],
        ['parseInt', nf('parseInt', args => parseInt(I.str(args[0]), args[1]))],
        ['parseFloat', nf('parseFloat', args => parseFloat(I.str(args[0])))],
        ['isNaN', nf('isNaN', args => Number.isNaN(Number(args[0])))],
        ['String', nf('String', args => I.str(args[0]), { valueOf: nf('String.valueOf', args => I.str(args[0])) })],
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
        else if (v instanceof JList) v.items.forEach(x => collect(x, depth + 1));
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

  return { Interpreter, JNode, JObject, JFunction, JClass, JInstance, JList, NativeFn, RuntimeErr, fmt };
})();
