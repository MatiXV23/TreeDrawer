/*
 * Subconjunto de JavaScript: lexer y parser a AST.
 * Funciones (declaraciones, expresiones y flechas), let/const/var, if/else, while,
 * do-while, for, for...of, for...in, return, break, continue, throw, arrays, objetos,
 * template strings, spread, encadenamiento opcional y punto y coma automático.
 */

/** Nombres de clase que se interpretan como el nodo del árbol dibujado. */
const NODE_CLASSES = new Set(['Nodo', 'NodoArbol', 'NodoAB', 'NodoABB', 'NodoAVL', 'NodoAG', 'Node', 'TreeNode']);

const JSParser = (() => {
  class SyntaxErr extends Error {
    constructor(message, tok) {
      super(message);
      this.name = 'SyntaxError';
      this.line = tok?.line ?? null;
      this.col = tok?.col ?? null;
    }
  }

  const KEYWORDS = new Set([
    'if', 'else', 'while', 'do', 'for', 'return', 'break', 'continue', 'new', 'null', 'true', 'false',
    'function', 'let', 'const', 'var', 'typeof', 'throw', 'this', 'super', 'class', 'extends', 'switch', 'case', 'default',
    'try', 'catch', 'finally', 'instanceof', 'in', 'delete', 'void', 'yield', 'async', 'await', 'import', 'export',
  ]);
  const MULTI_OPS = [
    '>>>=', '===', '!==', '**=', '...', '??=', '||=', '&&=', '>>>', '<<=', '>>=',
    '=>', '?.', '??', '**', '++', '--', '&&', '||', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '<<', '>>',
  ];
  const SINGLE_OPS = '+-*/%=<>!&|^~?:;,.(){}[]';
  const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '**=', '??=', '||=', '&&=']);
  const PREC = [
    ['??'], ['||'], ['&&'], ['|'], ['^'], ['&'],
    ['==', '!=', '===', '!=='], ['<', '>', '<=', '>=', 'instanceof', 'in'], ['<<', '>>', '>>>'], ['+', '-'], ['*', '/', '%'],
  ];
  const ESCAPES = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' };

  /** Tokeniza `src`; `base` desplaza posiciones (para expresiones dentro de template strings). */
  function tokenize(src, base = { line: 1, col: 1, off: 0 }) {
    const toks = [];
    let i = 0, line = base.line, col = base.col;
    let nl = false;
    const adv = n => { for (let k = 0; k < n; k++) { if (src[i] === '\n') { line++; col = 1; nl = true; } else col++; i++; } };

    while (i < src.length) {
      const ch = src[i];
      if (ch === '\n' || ch === ' ' || ch === '\t' || ch === '\r' || ch === '\f' || ch === ' ') { adv(1); continue; }
      if (src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') adv(1); continue; }
      if (src.startsWith('/*', i)) {
        const at = { line, col };
        const end = src.indexOf('*/', i + 2);
        if (end < 0) throw new SyntaxErr('Comentario /* sin cerrar.', at);
        adv(end + 2 - i);
        continue;
      }
      const tok = { line, col, s: i + base.off, nl };
      nl = false;
      if (/[A-Za-z_$]/.test(ch)) {
        let j = i;
        while (j < src.length && /[\w$]/.test(src[j])) j++;
        tok.value = src.slice(i, j);
        tok.type = KEYWORDS.has(tok.value) ? 'kw' : 'id';
        adv(j - i);
      } else if (/\d/.test(ch) || (ch === '.' && /\d/.test(src[i + 1] || ''))) {
        const m = /^(?:0[xX][\da-fA-F]+|(?:\d[\d_]*(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)/.exec(src.slice(i));
        tok.type = 'num';
        tok.value = m[0];
        tok.num = Number(m[0].replace(/_/g, ''));
        adv(m[0].length);
        if (/[A-Za-z_$]/.test(src[i] || '')) throw new SyntaxErr(`Número mal escrito: «${m[0]}${src[i]}».`, tok);
      } else if (ch === '"' || ch === "'") {
        let j = i + 1, out = '';
        while (j < src.length && src[j] !== ch) {
          if (src[j] === '\n') throw new SyntaxErr(`Texto sin cerrar: falta la comilla ${ch}.`, tok);
          if (src[j] === '\\') { const e = src[j + 1]; out += ESCAPES[e] ?? e; j += 2; } else out += src[j++];
        }
        if (j >= src.length) throw new SyntaxErr(`Texto sin cerrar: falta la comilla ${ch}.`, tok);
        tok.type = 'str';
        tok.value = out;
        adv(j + 1 - i);
      } else if (ch === '`') {
        // Template string: partes de texto y expresiones ${...}
        const quasis = [], exprs = [];
        let j = i + 1, cur = '';
        let l = line, c = col + 1;
        const step = () => { if (src[j] === '\n') { l++; c = 1; } else c++; j++; };
        for (;;) {
          if (j >= src.length) throw new SyntaxErr('Template string sin cerrar: falta la comilla `.', tok);
          if (src[j] === '`') { step(); break; }
          if (src[j] === '\\') { const e = src[j + 1]; cur += ESCAPES[e] ?? e; step(); step(); continue; }
          if (src[j] === '$' && src[j + 1] === '{') {
            step(); step();
            const start = j, sl = l, sc = c;
            let depth = 1;
            while (j < src.length && depth > 0) {
              if (src[j] === '{') depth++;
              else if (src[j] === '}') depth--;
              if (depth > 0) step();
            }
            if (j >= src.length) throw new SyntaxErr('Falta cerrar «${» en el template string.', tok);
            quasis.push(cur);
            cur = '';
            exprs.push({ src: src.slice(start, j), base: { line: sl, col: sc, off: start + base.off } });
            step(); // '}'
            continue;
          }
          cur += src[j];
          step();
        }
        quasis.push(cur);
        tok.type = 'template';
        tok.value = src.slice(i, j);
        tok.quasis = quasis;
        tok.exprs = exprs;
        adv(j - i);
      } else {
        let op = MULTI_OPS.find(o => src.startsWith(o, i));
        if (op === '?.' && /\d/.test(src[i + 2] || '')) op = '?';
        op ||= SINGLE_OPS.includes(ch) ? ch : null;
        if (ch === '#') throw new SyntaxErr('Los campos privados (#) no están soportados: usá this._nombre.', tok);
        if (!op) throw new SyntaxErr(`Carácter inesperado: «${ch}».`, tok);
        tok.type = 'op';
        tok.value = op;
        adv(op.length);
      }
      tok.e = i + base.off;
      toks.push(tok);
    }
    toks.push({ type: 'eof', value: '', line, col, s: src.length + base.off, e: src.length + base.off, nl: true });
    return toks;
  }

  function describe(t) {
    if (t.type === 'eof') return 'el final del código';
    if (t.type === 'str') return `el texto "${t.value}"`;
    if (t.type === 'template') return 'un template string';
    return `«${t.value}»`;
  }

  function createParser(src, { base, fullSrc } = {}) {
    const toks = tokenize(src, base);
    const whole = fullSrc ?? src;
    const off = base?.off ?? 0;
    let p = 0;
    let fnDepth = 0;

    const peek = (o = 0) => toks[Math.min(p + o, toks.length - 1)];
    const next = () => toks[Math.min(p++, toks.length - 1)];
    const is = (v, o = 0) => { const t = peek(o); return (t.type === 'op' || t.type === 'kw') && t.value === v; };
    const isId = (o = 0) => peek(o).type === 'id';
    const atEnd = () => peek().type === 'eof';
    const eat = v => (is(v) ? next() : null);
    const prevTok = () => toks[Math.max(0, p - 1)];
    const expect = (v, where = '') => {
      if (is(v)) return next();
      const t = peek();
      // Si lo que sigue está en otra línea, lo más probable es que falte al final de la anterior.
      if (t.nl && p > 0 && (v === ')' || v === ']')) {
        throw new SyntaxErr(`Falta «${v}»${where ? ' ' + where : ''} al final de esta línea.`, prevTok());
      }
      throw new SyntaxErr(`Se esperaba «${v}»${where ? ' ' + where : ''} y se encontró ${describe(t)}.`, t);
    };
    const expectId = what => {
      if (isId()) return next();
      const t = peek();
      if (t.type === 'kw') throw new SyntaxErr(`«${t.value}» es una palabra reservada: no se puede usar como ${what}.`, t);
      throw new SyntaxErr(`Se esperaba ${what} y se encontró ${describe(t)}.`, t);
    };
    /** Punto y coma explícito o insertado automáticamente (fin de línea, «}» o fin del código). */
    const semicolon = (where = 'al final de la instrucción') => {
      if (eat(';')) return;
      if (is('}') || atEnd() || peek().nl) return;
      throw new SyntaxErr(`Se esperaba «;» ${where} y se encontró ${describe(peek())}.`, peek());
    };
    const fin = (n, startTok) => {
      if (startTok) { n.line ??= startTok.line; n.col ??= startTok.col; n.s ??= startTok.s; }
      n.e = prevTok().e;
      n.txt = whole.slice(n.s - (fullSrc ? 0 : off), n.e - (fullSrc ? 0 : off));
      return n;
    };

    // ---------- sentencias ----------
    function parseBlock() {
      const open = expect('{');
      const body = [];
      while (!is('}')) {
        if (atEnd()) throw new SyntaxErr('Falta cerrar una llave «}».', open);
        body.push(parseStatement());
      }
      const close = next();
      return { t: 'block', body, line: open.line, endLine: close.line };
    }

    function parseParams() {
      expect('(', 'para abrir los parámetros');
      const params = [];
      if (!is(')')) {
        do {
          if (is(')')) break;
          if (is('{') || is('[')) throw new SyntaxErr('La desestructuración de parámetros no está soportada.', peek());
          const rest = !!eat('...');
          const nt = expectId('nombre de parámetro');
          if (params.some(x => x.name === nt.value)) throw new SyntaxErr(`El parámetro «${nt.value}» está repetido.`, nt);
          const def = !rest && eat('=') ? parseAssign() : null;
          params.push({ name: nt.value, def, rest });
        } while (eat(','));
      }
      expect(')', 'para cerrar los parámetros');
      return params;
    }

    function parseFunctionRest(nameTok, startTok, isExpr) {
      const params = parseParams();
      if (!is('{')) throw new SyntaxErr('Se esperaba «{» para abrir el cuerpo de la función.', peek());
      fnDepth++;
      const body = parseBlock();
      fnDepth--;
      const fn = { t: isExpr ? 'funcexpr' : 'funcdecl', name: nameTok?.value ?? null, params, body, line: startTok.line, col: startTok.col, s: startTok.s };
      return isExpr ? fin(fn, startTok) : fn;
    }

    function parseVarDecl(kindTok, { inFor = false } = {}) {
      const decls = [];
      do {
        if (is('{') || is('[')) throw new SyntaxErr('La desestructuración no está soportada.', peek());
        const nt = expectId('nombre de variable');
        let init = null;
        if (eat('=')) init = parseAssign({ noIn: inFor });
        else if (kindTok.value === 'const' && !(inFor && (is('of') || (isId() && peek().value === 'of') || is('in')))) {
          throw new SyntaxErr(`Una constante tiene que inicializarse: const ${nt.value} = ...`, nt);
        }
        decls.push({ name: nt.value, init, tok: nt });
      } while (eat(','));
      return { t: 'var', kind: kindTok.value, decls, line: kindTok.line };
    }

    function parseStatement() {
      const tok = peek();
      if (is('{')) return parseBlock();
      if (eat(';')) return { t: 'empty', line: tok.line };

      if (eat('function')) {
        const nameTok = expectId('nombre de la función');
        return parseFunctionRest(nameTok, tok, false);
      }
      if (is('let') || is('const') || is('var')) {
        const d = parseVarDecl(next());
        semicolon('al final de la declaración');
        return d;
      }
      if (eat('if')) {
        expect('(', 'después de if');
        const test = parseExpr();
        expect(')', 'para cerrar la condición del if');
        const cons = parseStatement();
        const alt = eat('else') ? parseStatement() : null;
        return { t: 'if', test, cons, alt, line: tok.line };
      }
      if (eat('while')) {
        expect('(', 'después de while');
        const test = parseExpr();
        expect(')', 'para cerrar la condición del while');
        return { t: 'while', test, body: parseStatement(), line: tok.line };
      }
      if (eat('do')) {
        const body = parseStatement();
        const wt = expect('while', 'al final del do');
        expect('(');
        const test = parseExpr();
        expect(')');
        eat(';');
        return { t: 'do', body, test, line: tok.line, testLine: wt.line };
      }
      if (eat('for')) return parseFor(tok);
      if (eat('return')) {
        if (!fnDepth) throw new SyntaxErr('return solo puede ir dentro de una función.', tok);
        const arg = is(';') || is('}') || atEnd() || peek().nl ? null : parseExpr();
        semicolon('después del return');
        return { t: 'return', arg, line: tok.line };
      }
      if (eat('break')) { semicolon(); return { t: 'break', line: tok.line }; }
      if (eat('continue')) { semicolon(); return { t: 'continue', line: tok.line }; }
      if (eat('throw')) {
        const arg = parseExpr();
        semicolon();
        return { t: 'throw', arg, line: tok.line };
      }
      if (eat('class')) return parseClass(tok);
      if (is('switch')) throw new SyntaxErr('switch no está soportado: usá if / else if.', tok);
      if (is('try')) throw new SyntaxErr('try/catch no está soportado.', tok);
      if (is('else')) throw new SyntaxErr('Hay un else sin su if (revisá las llaves).', tok);
      if (is('import') || is('export')) throw new SyntaxErr('import/export no están soportados: escribí todo en este archivo.', tok);
      if (is('async') || is('await') || is('yield')) throw new SyntaxErr(`«${tok.value}» no está soportado.`, tok);

      const expr = parseExpr();
      semicolon();
      return { t: 'expr', expr, line: tok.line };
    }

    function parseClass(tok) {
      const nameTok = expectId('nombre de la clase');
      let parent = null;
      if (eat('extends')) parent = expectId('nombre de la clase padre').value;
      if (NODE_CLASSES.has(nameTok.value)) {
        // La clase Nodo la provee el entorno (conectada al dibujo): se ignora su definición.
        skipBalanced();
        return { t: 'empty', line: tok.line };
      }
      const open = expect('{', `para abrir la clase ${nameTok.value}`);
      const cls = { t: 'classdecl', name: nameTok.value, parent, ctor: null, methods: [], statics: [], fields: [], line: tok.line };
      const seen = new Set();
      while (!is('}')) {
        if (atEnd()) throw new SyntaxErr(`Falta la llave «}» que cierra la clase ${nameTok.value}.`, open);
        if (eat(';')) continue;
        let isStatic = false;
        if (isId() && peek().value === 'static' && !is('(', 1) && !is('=', 1)) { next(); isStatic = true; }
        const mt = peek();
        if (mt.type !== 'id' && mt.type !== 'kw') throw new SyntaxErr(`Se esperaba un método o un campo de la clase y se encontró ${describe(mt)}.`, mt);
        if ((mt.value === 'get' || mt.value === 'set') && (isId(1) || peek(1).type === 'kw')) {
          throw new SyntaxErr('Los getters y setters (get/set) no están soportados: usá métodos comunes, por ejemplo getRaiz().', mt);
        }
        next();
        if (is('(')) {
          const fn = parseFunctionRest(mt, mt, true);
          fn.name = mt.value;
          fn.method = true;
          if (mt.value === 'constructor' && !isStatic) {
            if (cls.ctor) throw new SyntaxErr(`La clase ${nameTok.value} tiene dos constructores.`, mt);
            cls.ctor = fn;
          } else {
            const key = (isStatic ? 'static ' : '') + mt.value;
            if (seen.has(key)) throw new SyntaxErr(`El método «${mt.value}» está definido dos veces en ${nameTok.value}.`, mt);
            seen.add(key);
            (isStatic ? cls.statics : cls.methods).push({ name: mt.value, fn, line: mt.line });
          }
        } else {
          const init = eat('=') ? parseAssign() : null;
          semicolon('al final del campo');
          if (isStatic) throw new SyntaxErr('Los campos static no están soportados: usá una constante fuera de la clase.', mt);
          cls.fields.push({ name: mt.value, init, line: mt.line });
        }
      }
      cls.endLine = next().line;
      return cls;
    }

    function skipBalanced() {
      const first = expect('{');
      let depth = 1;
      while (depth > 0) {
        const t = next();
        if (t.type === 'eof') throw new SyntaxErr('Falta cerrar una llave «}».', first);
        if (t.type === 'op' && t.value === '{') depth++;
        if (t.type === 'op' && t.value === '}') depth--;
      }
    }

    function parseFor(tok) {
      expect('(', 'después de for');
      let init = null;
      if (is('let') || is('const') || is('var')) {
        const kindTok = next();
        if (isId() && (peek(1).value === 'of' || is('in', 1))) {
          const nt = next();
          const kind = next().value === 'in' ? 'forin' : 'forof';
          const iter = parseExpr();
          expect(')', 'para cerrar el for');
          return { t: kind, decl: kindTok.value, name: nt.value, iter, body: parseStatement(), line: tok.line };
        }
        init = parseVarDecl(kindTok, { inFor: true });
      } else if (isId() && (peek(1).value === 'of' || is('in', 1))) {
        const nt = next();
        const kind = next().value === 'in' ? 'forin' : 'forof';
        const iter = parseExpr();
        expect(')', 'para cerrar el for');
        return { t: kind, decl: null, name: nt.value, iter, body: parseStatement(), line: tok.line };
      } else if (!is(';')) {
        init = { t: 'expr', expr: parseExpr(), line: tok.line };
      }
      expect(';', 'en el for (for (inicio; condición; paso))');
      const test = is(';') ? null : parseExpr();
      expect(';', 'en el for (for (inicio; condición; paso))');
      const update = is(')') ? null : parseExpr();
      expect(')', 'para cerrar el for');
      return { t: 'for', init, test, update, body: parseStatement(), line: tok.line };
    }

    // ---------- expresiones ----------
    function parseExpr() {
      const first = parseAssign();
      if (!is(',')) return first;
      const list = [first];
      while (eat(',')) list.push(parseAssign());
      return fin({ t: 'seq', list, line: first.line, col: first.col, s: first.s });
    }

    function arrowAhead() {
      if (isId() && is('=>', 1)) return true;
      if (!is('(')) return false;
      let depth = 0, k = 0;
      for (;;) {
        const t = peek(k);
        if (t.type === 'eof') return false;
        if (t.type === 'op' && t.value === '(') depth++;
        if (t.type === 'op' && t.value === ')') { depth--; if (depth === 0) return is('=>', k + 1); }
        k++;
      }
    }

    function parseArrow() {
      const startTok = peek();
      let params;
      if (isId()) params = [{ name: next().value, def: null, rest: false }];
      else params = parseParams();
      const arrowTok = expect('=>');
      if (arrowTok.nl) throw new SyntaxErr('La flecha => tiene que estar en la misma línea que los parámetros.', arrowTok);
      fnDepth++;
      let body;
      if (is('{')) body = parseBlock();
      else {
        const e = parseAssign();
        body = { t: 'block', body: [{ t: 'return', arg: e, line: e.line }], line: e.line, endLine: e.line, implicit: true };
      }
      fnDepth--;
      return fin({ t: 'funcexpr', arrow: true, name: null, params, body, line: startTok.line, col: startTok.col, s: startTok.s });
    }

    function parseAssign(opts = {}) {
      if (arrowAhead()) return parseArrow();
      const left = parseTernary(opts);
      const t = peek();
      if (t.type === 'op' && ASSIGN_OPS.has(t.value)) {
        if (!['name', 'member'].includes(left.t) || left.optional) {
          throw new SyntaxErr('Solo se puede asignar a una variable o a una propiedad (por ejemplo nodo.izq).', t);
        }
        next();
        const value = parseAssign(opts);
        return fin({ t: 'assign', op: t.value, target: left, value, line: left.line, col: left.col, s: left.s });
      }
      return left;
    }

    function parseTernary(opts) {
      const test = parseBinary(0, opts);
      if (!is('?')) return test;
      next();
      const cons = parseAssign();
      expect(':', 'en el operador ternario (condición ? a : b)');
      const alt = parseAssign(opts);
      return fin({ t: 'cond', test, cons, alt, line: test.line, col: test.col, s: test.s });
    }

    function parseBinary(level, opts) {
      if (level >= PREC.length) return parseExponent();
      let left = parseBinary(level + 1, opts);
      for (;;) {
        const t = peek();
        if (!((t.type === 'op' || t.type === 'kw') && PREC[level].includes(t.value))) return left;
        if (t.value === 'in' && opts.noIn) return left;
        next();
        const right = parseBinary(level + 1, opts);
        const kind = t.value === '&&' ? 'and' : t.value === '||' ? 'or' : t.value === '??' ? 'nullish' : 'bin';
        left = fin({ t: kind, op: t.value, left, right, line: t.line, col: t.col, s: left.s });
      }
    }

    function parseExponent() {
      const left = parseUnary();
      if (!is('**')) return left;
      const t = next();
      if (left.t === 'unary') throw new SyntaxErr('Poné paréntesis: (-a) ** b', t);
      const right = parseExponent();
      return fin({ t: 'bin', op: '**', left, right, line: t.line, col: t.col, s: left.s });
    }

    function parseUnary() {
      const t = peek();
      if ((t.type === 'op' && ['-', '+', '!', '~'].includes(t.value)) || is('typeof') || is('void')) {
        next();
        return fin({ t: 'unary', op: t.value, arg: parseUnary() }, t);
      }
      if (is('delete')) throw new SyntaxErr('delete no está soportado: asigná null.', t);
      if (t.type === 'op' && (t.value === '++' || t.value === '--')) {
        next();
        const target = parseUnary();
        if (!['name', 'member'].includes(target.t)) throw new SyntaxErr(`${t.value} solo se aplica a variables o propiedades.`, t);
        return fin({ t: 'update', op: t.value, prefix: true, target }, t);
      }
      return parsePostfix();
    }

    function parsePostfix() {
      const e = parseCallChain();
      const t = peek();
      if ((is('++') || is('--')) && !t.nl) {
        if (!['name', 'member'].includes(e.t)) throw new SyntaxErr(`${t.value} solo se aplica a variables o propiedades.`, t);
        next();
        return fin({ t: 'update', op: t.value, prefix: false, target: e, line: e.line, col: e.col, s: e.s });
      }
      return e;
    }

    function parseArgs() {
      expect('(');
      const args = [];
      if (!is(')')) {
        do {
          if (is(')')) break;
          const st = peek();
          if (eat('...')) args.push(fin({ t: 'spread', arg: parseAssign() }, st));
          else args.push(parseAssign());
        } while (eat(','));
      }
      expect(')', 'para cerrar los argumentos');
      return args;
    }

    function parseCallChain() {
      let e;
      let optional = false;
      const st = peek();
      if (eat('super')) {
        if (is('(')) {
          e = fin({ t: 'supercall', args: parseArgs() }, st);
        } else if (eat('.')) {
          const nt = peek();
          if (nt.type !== 'id' && nt.type !== 'kw') throw new SyntaxErr('Se esperaba el nombre de un método después de super.', nt);
          next();
          if (!is('(')) throw new SyntaxErr('Con super solo se pueden llamar métodos: super.metodo(...).', peek());
          e = fin({ t: 'supermethod', name: nt.value, args: parseArgs() }, st);
        } else {
          throw new SyntaxErr('super se usa como super(...) en el constructor o super.metodo(...).', peek());
        }
      } else if (eat('new')) {
        const ct = peek();
        const nameTok = expectId('el nombre de la clase después de new');
        const callee = fin({ t: 'name', name: nameTok.value }, ct);
        const args = is('(') ? parseArgs() : [];
        e = fin({ t: 'new', callee, args }, st);
      } else {
        e = parsePrimary();
      }
      for (;;) {
        const t = peek();
        if (is('.') || is('?.')) {
          const opt = next().value === '?.';
          if (opt && is('(')) {
            optional = true;
            e = fin({ t: 'call', callee: e, args: parseArgs(), optional: true, line: t.line, col: t.col, s: e.s });
            continue;
          }
          if (opt && is('[')) {
            optional = true;
            next();
            const prop = parseExpr();
            expect(']');
            e = fin({ t: 'member', obj: e, prop, computed: true, optional: true, line: t.line, col: t.col, s: e.s });
            continue;
          }
          const nt = peek();
          if (nt.type !== 'id' && nt.type !== 'kw') throw new SyntaxErr(`Se esperaba un nombre después de «${t.value}» y se encontró ${describe(nt)}.`, nt);
          next();
          optional ||= opt;
          e = fin({ t: 'member', obj: e, name: nt.value, optional: opt, line: nt.line, col: nt.col, s: e.s });
        } else if (is('[')) {
          if (t.nl && e.t !== 'member' && e.t !== 'name' && e.t !== 'call') return e;
          next();
          const prop = parseExpr();
          expect(']', 'para cerrar el acceso con corchetes');
          e = fin({ t: 'member', obj: e, prop, computed: true, line: t.line, col: t.col, s: e.s });
        } else if (is('(')) {
          e = fin({ t: 'call', callee: e, args: parseArgs(), line: t.line, col: t.col, s: e.s });
        } else if (peek().type === 'template') {
          throw new SyntaxErr('Los tagged templates no están soportados.', peek());
        } else {
          break;
        }
      }
      return optional ? fin({ t: 'chain', expr: e, line: e.line, col: e.col, s: e.s }) : e;
    }

    function parsePrimary() {
      const t = peek();
      if (t.type === 'num') { next(); return fin({ t: 'lit', v: t.num }, t); }
      if (t.type === 'str') { next(); return fin({ t: 'lit', v: t.value }, t); }
      if (t.type === 'template') {
        next();
        const exprs = t.exprs.map(x => {
          const sub = createParser(x.src, { base: x.base, fullSrc: whole });
          return sub.parseLoneExpr();
        });
        return fin({ t: 'template', quasis: t.quasis, exprs }, t);
      }
      if (eat('true')) return fin({ t: 'lit', v: true }, t);
      if (eat('false')) return fin({ t: 'lit', v: false }, t);
      if (eat('null')) return fin({ t: 'lit', v: null }, t);
      if (eat('this')) return fin({ t: 'this' }, t);
      if (eat('function')) {
        const nameTok = isId() ? next() : null;
        return parseFunctionRest(nameTok, t, true);
      }
      if (is('(')) {
        next();
        const e = parseExpr();
        expect(')', 'para cerrar el paréntesis');
        return e;
      }
      if (is('[')) {
        next();
        const items = [];
        while (!is(']')) {
          const st = peek();
          if (eat('...')) items.push(fin({ t: 'spread', arg: parseAssign() }, st));
          else items.push(parseAssign());
          if (!eat(',')) break;
        }
        expect(']', 'para cerrar el array');
        return fin({ t: 'array', items }, t);
      }
      if (is('{')) {
        next();
        const props = [];
        while (!is('}')) {
          const kt = peek();
          let key;
          if (kt.type === 'id' || kt.type === 'kw' || kt.type === 'str') key = String(next().value);
          else if (kt.type === 'num') key = String(next().num);
          else if (is('...')) throw new SyntaxErr('El spread en objetos no está soportado.', kt);
          else throw new SyntaxErr(`Se esperaba el nombre de una propiedad y se encontró ${describe(kt)}.`, kt);
          if (eat(':')) props.push({ key, value: parseAssign() });
          else if (is('(')) props.push({ key, value: parseFunctionRest({ value: key }, kt, true) });
          else if (kt.type === 'id') props.push({ key, value: fin({ t: 'name', name: key }, kt) });
          else throw new SyntaxErr(`Se esperaba «:» después de «${key}».`, peek());
          if (!eat(',')) break;
        }
        expect('}', 'para cerrar el objeto');
        return fin({ t: 'object', props }, t);
      }
      if (t.type === 'id') {
        next();
        if (t.value === 'undefined') return fin({ t: 'lit', v: undefined }, t);
        return fin({ t: 'name', name: t.value }, t);
      }
      throw new SyntaxErr(`No se esperaba ${describe(t)} acá.`, t);
    }

    return {
      parseProgram() {
        const body = [];
        while (!atEnd()) body.push(parseStatement());
        return { t: 'program', body };
      },
      parseLoneExpr() {
        const e = parseExpr();
        if (!atEnd()) throw new SyntaxErr(`No se esperaba ${describe(peek())} dentro de \${...}.`, peek());
        return e;
      },
      parseLine() {
        fnDepth = 1; // permite return en la línea de ejecución sin sentido; se valida aparte
        const body = [];
        while (!atEnd()) body.push(parseStatement());
        return body;
      },
    };
  }

  /** Programa del editor. Solo admite funciones y declaraciones en el nivel superior. */
  function parseProgram(src) {
    const prog = createParser(src).parseProgram();
    for (const s of prog.body) {
      if (!['funcdecl', 'classdecl', 'var', 'empty'].includes(s.t)) {
        throw new SyntaxErr('En el editor van clases, funciones y constantes. Lo que quieras ejecutar escribilo en la línea «Ejecutar».', { line: s.line, col: 1 });
      }
    }
    return prog;
  }

  /** Línea de ejecución: una o más sentencias; el valor de la última expresión es el resultado. */
  function parseLine(src) {
    const text = src.trim();
    if (!text) throw new SyntaxErr('Escribí qué querés ejecutar, por ejemplo: altura(raiz)', { line: 1, col: 1 });
    const body = createParser(text).parseLine();
    if (body.some(s => s.t === 'return')) throw new SyntaxErr('En la línea de ejecución no va return: escribí directamente la expresión.', { line: 1, col: 1 });
    return body;
  }

  return { parseProgram, parseLine, tokenize, SyntaxErr };
})();
