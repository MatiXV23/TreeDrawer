/*
 * Subconjunto de Java → el mismo AST que produce JSParser, para usar un único intérprete.
 * Clases con extends / implements (ignorado), constructores y métodos sobrecargados,
 * campos, modificadores y anotaciones (ignorados), genéricos (ignorados), variables con
 * tipo, if / while / do / for / for-each, return, break, continue, throw, casts
 * primitivos, arrays simples y métodos sueltos (static) fuera de una clase.
 */
const JavaParser = (() => {
  const SyntaxErr = JSParser.SyntaxErr;

  const KEYWORDS = new Set([
    'if', 'else', 'while', 'do', 'for', 'return', 'break', 'continue', 'new', 'null', 'true', 'false',
    'class', 'interface', 'enum', 'extends', 'implements', 'public', 'private', 'protected', 'static',
    'final', 'abstract', 'synchronized', 'native', 'transient', 'volatile', 'throw', 'throws', 'this',
    'super', 'instanceof', 'import', 'package', 'switch', 'case', 'default', 'try', 'catch', 'finally',
  ]);
  const MODIFIERS = new Set(['public', 'private', 'protected', 'static', 'final', 'abstract', 'synchronized', 'native', 'transient', 'volatile', 'default']);
  const PRIMITIVES = new Set(['int', 'long', 'short', 'byte', 'double', 'float', 'boolean', 'char']);
  // Sin '>>' ni '>>>': chocan con los genéricos (List<List<T>>).
  const MULTI_OPS = ['<<=', '...', '->', '::', '++', '--', '&&', '||', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<'];
  const SINGLE_OPS = '+-*/%=<>!&|^~?:;,.(){}[]@';
  const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=']);
  const PREC = [['||'], ['&&'], ['|'], ['^'], ['&'], ['==', '!='], ['<', '>', '<=', '>=', 'instanceof'], ['<<'], ['+', '-'], ['*', '/', '%']];
  const ESCAPES = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', 0: '\0', s: ' ' };

  function tokenize(src) {
    const toks = [];
    let i = 0, line = 1, col = 1;
    const adv = n => { for (let k = 0; k < n; k++) { if (src[i] === '\n') { line++; col = 1; } else col++; i++; } };
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch)) { adv(1); continue; }
      if (src.startsWith('//', i)) { while (i < src.length && src[i] !== '\n') adv(1); continue; }
      if (src.startsWith('/*', i)) {
        const at = { line, col };
        const end = src.indexOf('*/', i + 2);
        if (end < 0) throw new SyntaxErr('Comentario /* sin cerrar.', at);
        adv(end + 2 - i);
        continue;
      }
      const tok = { line, col, s: i };
      if (/[A-Za-z_$]/.test(ch)) {
        let j = i;
        while (j < src.length && /[\w$]/.test(src[j])) j++;
        tok.value = src.slice(i, j);
        tok.type = KEYWORDS.has(tok.value) ? 'kw' : 'id';
        adv(j - i);
      } else if (/\d/.test(ch) || (ch === '.' && /\d/.test(src[i + 1] || ''))) {
        const m = /^(?:0[xX][\da-fA-F_]+|(?:\d[\d_]*(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?)[lLfFdD]?/.exec(src.slice(i));
        const text = m[0];
        tok.type = 'num';
        tok.value = text;
        tok.isDouble = !/^0[xX]/.test(text) && (/[.eE]/.test(text) || /[fFdD]$/.test(text));
        tok.num = Number(text.replace(/_/g, '').replace(/[lLfFdD]$/, ''));
        adv(text.length);
        if (/[A-Za-z_]/.test(src[i] || '')) throw new SyntaxErr(`Número mal escrito: «${text}${src[i]}».`, tok);
      } else if (ch === '"' || ch === "'") {
        let j = i + 1, out = '';
        while (j < src.length && src[j] !== ch) {
          if (src[j] === '\n') throw new SyntaxErr(ch === '"' ? 'String sin cerrar: falta la comilla ".' : "char sin cerrar: falta la comilla '.", tok);
          if (src[j] === '\\') { const e = src[j + 1]; out += ESCAPES[e] ?? e; j += 2; } else out += src[j++];
        }
        if (j >= src.length) throw new SyntaxErr('Falta cerrar una comilla.', tok);
        tok.type = ch === '"' ? 'str' : 'char';
        tok.value = out;
        if (tok.type === 'char' && out.length !== 1) throw new SyntaxErr(`Un char tiene un solo carácter: '${out}'. Para textos usá comillas dobles.`, tok);
        adv(j + 1 - i);
      } else {
        const op = MULTI_OPS.find(o => src.startsWith(o, i)) || (SINGLE_OPS.includes(ch) ? ch : null);
        if (!op) throw new SyntaxErr(`Carácter inesperado: «${ch}».`, tok);
        tok.type = 'op';
        tok.value = op;
        adv(op.length);
      }
      tok.e = i;
      toks.push(tok);
    }
    toks.push({ type: 'eof', value: '', line, col, s: src.length, e: src.length });
    return toks;
  }

  function describe(t) {
    if (t.type === 'eof') return 'el final del código';
    if (t.type === 'str') return `el texto "${t.value}"`;
    return `«${t.value}»`;
  }

  function createParser(src, { line: lineMode = false } = {}) {
    const toks = tokenize(src);
    let p = 0;

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
      // Si falta al final de una línea, el error se marca en esa línea.
      if ((v === ';' || v === ')') && p > 0 && t.line > prevTok().line) {
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
    const fin = (n, startTok) => {
      if (startTok) { n.line ??= startTok.line; n.col ??= startTok.col; n.s ??= startTok.s; }
      n.e = prevTok().e;
      n.txt = src.slice(n.s, n.e);
      return n;
    };

    function skipBalanced(open, close) {
      const first = peek();
      let depth = 0;
      do {
        const t = next();
        if (t.type === 'eof') throw new SyntaxErr(`Falta cerrar «${open}».`, first);
        if (t.type === 'op' && t.value === open) depth++;
        else if (t.type === 'op' && t.value === close) depth--;
      } while (depth > 0);
    }

    function parseModifiers() {
      const mods = new Set();
      for (;;) {
        if (is('@')) {
          next();
          expectId('el nombre de la anotación');
          while (eat('.')) expectId('el nombre de la anotación');
          if (is('(')) skipBalanced('(', ')');
          continue;
        }
        const t = peek();
        if (t.type === 'kw' && MODIFIERS.has(t.value)) { mods.add(next().value); continue; }
        return mods;
      }
    }

    // ---------- tipos ----------
    function parseType() {
      const t = peek();
      if (!isId()) throw new SyntaxErr(`Se esperaba un tipo y se encontró ${describe(t)}.`, t);
      let name = next().value;
      while (is('.') && isId(1)) { next(); name = next().value; } // java.util.List → List
      if (is('<')) {
        next();
        if (!is('>')) {
          do {
            if (eat('?')) { if (eat('extends') || eat('super')) parseType(); }
            else parseType();
          } while (eat(','));
        }
        expect('>', 'para cerrar el tipo genérico');
      }
      let dims = 0;
      while (is('[') && is(']', 1)) { next(); next(); dims++; }
      if (eat('...')) dims++;
      return { name: name + '[]'.repeat(dims), base: name, dims, tok: t };
    }

    function skipTypeParams() {
      if (is('<')) skipBalanced('<', '>');
    }

    function looksLikeDecl() {
      if (!isId()) return false;
      const save = p;
      try {
        parseType();
        return isId() && (is('=', 1) || is(';', 1) || is(',', 1) || is(':', 1) || is(')', 1));
      } catch {
        return false;
      } finally {
        p = save;
      }
    }

    // ---------- nivel superior ----------
    const body = [];
    const topNames = new Map();

    function parseTop() {
      while (!atEnd()) {
        if (eat(';')) continue;
        if (is('package') || is('import')) {
          while (!is(';') && !atEnd()) next();
          expect(';');
          continue;
        }
        const startTok = peek();
        const mods = parseModifiers();
        if (is('class')) { body.push(parseClass(next())); continue; }
        if (is('interface') || is('enum')) {
          next();
          expectId('un nombre');
          while (!is('{') && !atEnd()) next();
          skipBalanced('{', '}');
          continue;
        }
        if (!isId() && !is('<')) {
          throw new SyntaxErr(`Se esperaba una clase o un método y se encontró ${describe(peek())}. Las instrucciones sueltas van en la línea «Ejecutar».`, peek());
        }
        skipTypeParams();
        const type = parseType();
        const nameTok = expectId('el nombre del método');
        if (!is('(')) {
          // campo global (por ejemplo, un contador static)
          const decls = parseDeclarators(nameTok);
          expect(';', 'al final de la declaración');
          body.push({ t: 'var', kind: 'let', decls, jtype: type.name, line: startTok.line });
          continue;
        }
        const fn = parseMethodRest(nameTok, nameTok.value, type, startTok);
        if (!fn) continue;
        if (topNames.has(nameTok.value)) {
          throw new SyntaxErr(`El método «${nameTok.value}» está definido dos veces. Fuera de una clase no hay sobrecarga: usá otro nombre.`, nameTok);
        }
        topNames.set(nameTok.value, true);
        body.push({ t: 'funcdecl', name: nameTok.value, params: fn.params, body: fn.body, ret: fn.ret, line: startTok.line, java: true, mods: [...mods] });
      }
    }

    function parseClass(tok) {
      const nameTok = expectId('el nombre de la clase');
      skipTypeParams();
      let parent = null;
      if (eat('extends')) parent = parseType().base;
      if (eat('implements')) { do { parseType(); } while (eat(',')); }
      if (NODE_CLASSES.has(nameTok.value)) {
        // La clase Nodo la provee el entorno (conectada al dibujo).
        skipBalanced('{', '}');
        return { t: 'empty', line: tok.line };
      }
      const open = expect('{', `para abrir la clase ${nameTok.value}`);
      const cls = { t: 'classdecl', name: nameTok.value, parent, ctor: null, ctors: [], methods: [], statics: [], fields: [], line: tok.line, java: true };
      const sigs = new Set();
      while (!is('}')) {
        if (atEnd()) throw new SyntaxErr(`Falta la llave «}» que cierra la clase ${nameTok.value}.`, open);
        if (eat(';')) continue;
        const startTok = peek();
        const mods = parseModifiers();
        if (is('class') || is('interface') || is('enum')) throw new SyntaxErr('Las clases internas no están soportadas.', peek());
        if (is('{')) throw new SyntaxErr('Los bloques de inicialización no están soportados: usá el constructor.', peek());
        skipTypeParams();
        if (isId() && peek().value === nameTok.value && is('(', 1)) {
          const t = next();
          const fn = parseMethodRest(t, 'constructor', null, startTok);
          const key = `constructor/${fn.params.length}`;
          if (sigs.has(key)) throw new SyntaxErr(`Hay dos constructores de ${nameTok.value} con ${fn.params.length} parámetro(s).`, t);
          sigs.add(key);
          fn.method = true;
          cls.ctors.push(fn);
          continue;
        }
        const type = parseType();
        const mt = expectId('el nombre del método o del campo');
        if (is('(')) {
          const fn = parseMethodRest(mt, mt.value, type, startTok);
          if (!fn) continue; // abstracto
          const key = `${mods.has('static') ? 'static ' : ''}${mt.value}/${fn.params.length}`;
          if (sigs.has(key)) throw new SyntaxErr(`El método «${mt.value}» con ${fn.params.length} parámetro(s) está definido dos veces.`, mt);
          sigs.add(key);
          fn.method = true;
          fn.isPrivate = mods.has('private');
          (mods.has('static') ? cls.statics : cls.methods).push({ name: mt.value, fn, line: mt.line });
        } else {
          if (mods.has('static')) throw new SyntaxErr('Los campos static no están soportados: usá un campo común o una variable fuera de la clase.', mt);
          for (const d of parseDeclarators(mt)) cls.fields.push({ name: d.name, init: d.init, jtype: type.name, line: d.tok.line });
          expect(';', 'al final del campo');
        }
      }
      cls.endLine = next().line;
      cls.ctor = cls.ctors[0] ?? null;
      return cls;
    }

    function parseDeclarators(firstTok) {
      const decls = [];
      let nt = firstTok;
      for (;;) {
        while (is('[') && is(']', 1)) { next(); next(); }
        const init = eat('=') ? (is('{') ? parseArrayInit() : parseExpr()) : null;
        decls.push({ name: nt.value, init, tok: nt });
        if (!eat(',')) break;
        nt = expectId('el nombre de la variable');
      }
      return decls;
    }

    function parseMethodRest(nameTok, name, retType, startTok) {
      expect('(', 'para abrir los parámetros');
      const params = [];
      if (!is(')')) {
        do {
          parseModifiers();
          const type = parseType();
          const pt = expectId('el nombre del parámetro');
          while (is('[') && is(']', 1)) { next(); next(); }
          if (params.some(x => x.name === pt.value)) throw new SyntaxErr(`El parámetro «${pt.value}» está repetido.`, pt);
          params.push({ name: pt.value, def: null, rest: false, jtype: type.name });
        } while (eat(','));
      }
      expect(')', 'para cerrar los parámetros');
      while (is('[') && is(']', 1)) { next(); next(); }
      if (eat('throws')) { do { parseType(); } while (eat(',')); }
      if (eat(';')) return null;
      if (!is('{')) throw new SyntaxErr(`Se esperaba «{» para abrir el cuerpo de «${name}».`, peek());
      const block = parseBlock();
      const fn = { t: 'funcexpr', name, params, body: block, ret: retType ? retType.name : null, java: true, line: nameTok.line, col: nameTok.col, s: (startTok ?? nameTok).s };
      return fin(fn);
    }

    // ---------- sentencias ----------
    function parseBlock() {
      const open = expect('{');
      const stmts = [];
      while (!is('}')) {
        if (atEnd()) throw new SyntaxErr('Falta cerrar una llave «}».', open);
        stmts.push(parseStatement());
      }
      const close = next();
      return { t: 'block', body: stmts, line: open.line, endLine: close.line };
    }

    function parseVarDecl() {
      const type = parseType();
      const decls = [];
      do {
        const nt = expectId('el nombre de la variable');
        while (is('[') && is(']', 1)) { next(); next(); }
        const init = eat('=') ? (is('{') ? parseArrayInit() : parseExpr()) : null;
        decls.push({ name: nt.value, init, tok: nt });
      } while (eat(','));
      return { t: 'var', kind: 'let', decls, jtype: type.name === 'var' ? null : type.name, line: type.tok.line };
    }

    function parseArrayInit() {
      const open = expect('{');
      const items = [];
      while (!is('}')) {
        items.push(is('{') ? parseArrayInit() : parseExpr());
        if (!eat(',')) break;
      }
      expect('}');
      return fin({ t: 'array', items }, open);
    }

    function exprList() {
      const first = parseExpr();
      if (!is(',')) return first;
      const list = [first];
      while (eat(',')) list.push(parseExpr());
      return fin({ t: 'seq', list, line: first.line, col: first.col, s: first.s });
    }

    function parseStatement() {
      const tok = peek();
      if (is('{')) return parseBlock();
      if (eat(';')) return { t: 'empty', line: tok.line };
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
        const b = parseStatement();
        const wt = expect('while', 'al final del do');
        expect('(');
        const test = parseExpr();
        expect(')');
        expect(';', 'después del do-while');
        return { t: 'do', body: b, test, line: tok.line, testLine: wt.line };
      }
      if (eat('for')) {
        expect('(', 'después de for');
        eat('final');
        if (looksLikeDecl()) {
          const save = p;
          const type = parseType();
          const nt = expectId('el nombre de la variable');
          if (eat(':')) {
            const iter = parseExpr();
            expect(')', 'para cerrar el for');
            return { t: 'forof', decl: 'let', name: nt.value, jtype: type.name, iter, body: parseStatement(), line: tok.line };
          }
          p = save;
        }
        let init = null;
        if (!is(';')) init = looksLikeDecl() ? parseVarDecl() : { t: 'expr', expr: exprList(), line: tok.line };
        expect(';', 'en el for (inicio; condición; paso)');
        const test = is(';') ? null : parseExpr();
        expect(';', 'en el for (inicio; condición; paso)');
        const update = is(')') ? null : exprList();
        expect(')', 'para cerrar el for');
        return { t: 'for', init, test, update, body: parseStatement(), line: tok.line };
      }
      if (eat('return')) {
        const arg = is(';') ? null : parseExpr();
        expect(';', 'después del return');
        return { t: 'return', arg, line: tok.line };
      }
      if (eat('break')) { expect(';'); return { t: 'break', line: tok.line }; }
      if (eat('continue')) { expect(';'); return { t: 'continue', line: tok.line }; }
      if (eat('throw')) {
        const arg = parseExpr();
        expect(';');
        return { t: 'throw', arg, line: tok.line };
      }
      if (is('switch')) throw new SyntaxErr('switch no está soportado: usá if / else if.', tok);
      if (is('try')) throw new SyntaxErr('try/catch no está soportado.', tok);
      if (is('else')) throw new SyntaxErr('Hay un else sin su if (revisá las llaves).', tok);
      if (is('class')) throw new SyntaxErr('Las clases se declaran en el nivel superior, no dentro de un método.', tok);

      eat('final');
      if (looksLikeDecl()) {
        const d = parseVarDecl();
        if (lineMode && atEnd()) return d;
        expect(';', 'al final de la declaración');
        return d;
      }
      const expr = parseExpr();
      if (lineMode && atEnd()) return { t: 'expr', expr, line: tok.line };
      expect(';', 'al final de la instrucción');
      if (!lineMode && !['assign', 'update', 'call', 'new', 'supercall', 'thiscall', 'supermethod'].includes(expr.t)) {
        throw new SyntaxErr('Esto no es una instrucción válida en Java: ¿te faltó asignarlo a una variable o ponerlo en un return?', tok);
      }
      return { t: 'expr', expr, line: tok.line };
    }

    // ---------- expresiones ----------
    function parseExpr() {
      const left = parseTernary();
      const t = peek();
      if (t.type === 'op' && ASSIGN_OPS.has(t.value)) {
        if (!['name', 'member'].includes(left.t)) throw new SyntaxErr('Solo se puede asignar a una variable, un campo o una posición de un array.', t);
        next();
        const value = parseExpr();
        return fin({ t: 'assign', op: t.value, target: left, value, line: left.line, col: left.col, s: left.s });
      }
      if (t.type === 'op' && (t.value === '->' || t.value === '::')) throw new SyntaxErr('Las lambdas y referencias a métodos no están soportadas.', t);
      return left;
    }

    function parseTernary() {
      const test = parseBinary(0);
      if (!is('?')) return test;
      next();
      const cons = parseExpr();
      expect(':', 'en el operador ternario (condición ? a : b)');
      const alt = parseTernary();
      return fin({ t: 'cond', test, cons, alt, line: test.line, col: test.col, s: test.s });
    }

    function parseBinary(level) {
      if (level >= PREC.length) return parseUnary();
      let left = parseBinary(level + 1);
      for (;;) {
        const t = peek();
        if (!((t.type === 'op' || t.type === 'kw') && PREC[level].includes(t.value))) return left;
        next();
        if (t.value === 'instanceof') {
          const type = parseType();
          left = fin({ t: 'instanceof', left, typeName: type.base, line: left.line, col: left.col, s: left.s });
          continue;
        }
        const right = parseBinary(level + 1);
        if (t.value === '&&' || t.value === '||') {
          left = fin({ t: t.value === '&&' ? 'and' : 'or', op: t.value, left, right, line: t.line, col: t.col, s: left.s });
        } else {
          const op = t.value === '==' ? '===' : t.value === '!=' ? '!==' : t.value;
          left = fin({ t: 'bin', op, left, right, java: true, line: t.line, col: t.col, s: left.s });
        }
      }
    }

    /** (tipo) expr: casts primitivos o de clase seguidos de un operando. */
    function tryCast() {
      if (!is('(') || !isId(1)) return null;
      const save = p;
      const startTok = next();
      try {
        const type = parseType();
        if (!is(')')) { p = save; return null; }
        next();
        const n = peek();
        const operandStarts = n.type === 'id' || n.type === 'num' || n.type === 'str' || n.type === 'char'
          || is('(') || is('this') || is('new') || is('null') || is('true') || is('false') || is('!') || is('~') || is('super');
        const primitive = PRIMITIVES.has(type.base) && !type.dims;
        if (primitive ? (operandStarts || is('-') || is('+')) : (/^[A-Z]/.test(type.base) && operandStarts)) {
          return fin({ t: 'cast', type: type.base, arg: parseUnary() }, startTok);
        }
      } catch { /* no era un cast */ }
      p = save;
      return null;
    }

    function parseUnary() {
      const t = peek();
      if (t.type === 'op' && ['-', '+', '!', '~'].includes(t.value)) {
        next();
        return fin({ t: 'unary', op: t.value, arg: parseUnary() }, t);
      }
      if (t.type === 'op' && (t.value === '++' || t.value === '--')) {
        next();
        const target = parseUnary();
        if (!['name', 'member'].includes(target.t)) throw new SyntaxErr(`${t.value} solo se aplica a variables.`, t);
        return fin({ t: 'update', op: t.value, prefix: true, target }, t);
      }
      const cast = tryCast();
      if (cast) return cast;
      let e = parsePostfix();
      const pt = peek();
      if (pt.type === 'op' && (pt.value === '++' || pt.value === '--')) {
        if (!['name', 'member'].includes(e.t)) throw new SyntaxErr(`${pt.value} solo se aplica a variables.`, pt);
        next();
        e = fin({ t: 'update', op: pt.value, prefix: false, target: e, line: e.line, col: e.col, s: e.s });
      }
      return e;
    }

    function parseArgs() {
      expect('(');
      const args = [];
      if (!is(')')) { do { args.push(parseExpr()); } while (eat(',')); }
      expect(')', 'para cerrar los argumentos');
      return args;
    }

    function parsePostfix() {
      let e = parsePrimary();
      for (;;) {
        const t = peek();
        if (is('.')) {
          next();
          skipTypeParams();
          const nt = peek();
          if (nt.type !== 'id') throw new SyntaxErr(`Se esperaba un nombre después del punto y se encontró ${describe(nt)}.`, nt);
          next();
          if (is('(')) {
            const callee = fin({ t: 'member', obj: e, name: nt.value, line: nt.line, col: nt.col, s: e.s });
            e = fin({ t: 'call', callee, args: parseArgs(), line: nt.line, col: nt.col, s: e.s });
          } else {
            e = fin({ t: 'member', obj: e, name: nt.value, line: nt.line, col: nt.col, s: e.s });
          }
        } else if (is('[')) {
          next();
          const prop = parseExpr();
          expect(']', 'para cerrar el índice');
          e = fin({ t: 'member', obj: e, prop, computed: true, line: t.line, col: t.col, s: e.s });
        } else {
          return e;
        }
      }
    }

    function parsePrimary() {
      const t = peek();
      if (t.type === 'num') { next(); return fin({ t: 'lit', v: t.num, isDouble: t.isDouble }, t); }
      if (t.type === 'str') { next(); return fin({ t: 'lit', v: t.value }, t); }
      if (t.type === 'char') { next(); return fin({ t: 'lit', v: t.value, chr: true }, t); }
      if (eat('true')) return fin({ t: 'lit', v: true }, t);
      if (eat('false')) return fin({ t: 'lit', v: false }, t);
      if (eat('null')) return fin({ t: 'lit', v: null }, t);
      if (eat('this')) {
        if (is('(')) return fin({ t: 'thiscall', args: parseArgs() }, t);
        return fin({ t: 'this' }, t);
      }
      if (eat('super')) {
        if (is('(')) return fin({ t: 'supercall', args: parseArgs() }, t);
        expect('.', 'después de super');
        const nt = expectId('el nombre de un método');
        if (!is('(')) throw new SyntaxErr('Con super solo se pueden llamar métodos: super.metodo(...).', peek());
        return fin({ t: 'supermethod', name: nt.value, args: parseArgs() }, t);
      }
      if (is('(')) {
        next();
        const e = parseExpr();
        expect(')', 'para cerrar el paréntesis');
        return e;
      }
      if (eat('new')) {
        const type = parseType();
        if (is('[')) {
          next();
          const size = parseExpr();
          expect(']');
          if (is('[')) throw new SyntaxErr('Los arrays de varias dimensiones no están soportados.', peek());
          return fin({ t: 'newarr', elem: type.base, size }, t);
        }
        if (is('{') && type.dims) return parseArrayInit();
        const ct = type.tok;
        const callee = fin({ t: 'name', name: type.base, line: ct.line, col: ct.col, s: ct.s });
        const args = parseArgs();
        if (is('{')) throw new SyntaxErr('Las clases anónimas no están soportadas.', peek());
        return fin({ t: 'new', callee, args }, t);
      }
      if (t.type === 'id') {
        next();
        if (is('(')) {
          const callee = fin({ t: 'name', name: t.value }, t);
          return fin({ t: 'call', callee, args: parseArgs() }, t);
        }
        return fin({ t: 'name', name: t.value }, t);
      }
      throw new SyntaxErr(`No se esperaba ${describe(t)} acá.`, t);
    }

    return {
      parseProgram() {
        parseTop();
        return { t: 'program', body, lang: 'java' };
      },
      parseLine() {
        const stmts = [];
        while (!atEnd()) {
          if (eat(';')) continue;
          stmts.push(parseStatement());
        }
        return stmts;
      },
    };
  }

  function parseProgram(src) {
    return createParser(src).parseProgram();
  }

  function parseLine(src) {
    const text = src.trim();
    if (!text) throw new SyntaxErr('Escribí qué querés ejecutar, por ejemplo: arbol.altura()', { line: 1, col: 1 });
    const stmts = createParser(text, { line: true }).parseLine();
    if (stmts.some(s => s.t === 'return')) throw new SyntaxErr('En la línea de ejecución no va return: escribí directamente la expresión.', { line: 1, col: 1 });
    return stmts;
  }

  return { parseProgram, parseLine, tokenize };
})();
