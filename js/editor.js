/*
 * Editor de código liviano: textarea transparente sobre un <pre> resaltado.
 * Números de línea, breakpoints (clic en el número), línea activa, líneas de la
 * pila de llamadas y línea con error. Tab indenta y Enter mantiene la sangría.
 */
const CodeEditor = (() => {
  const LINE_H = 20;
  const PAD = 10;
  const INDENT = '  ';
  const KEYWORDS = new Set(['function', 'return', 'if', 'else', 'while', 'do', 'for', 'of', 'in', 'let', 'const', 'var',
    'new', 'break', 'continue', 'throw', 'typeof', 'class', 'extends', 'super', 'this', 'static', 'instanceof']);
  const LITERALS = new Set(['null', 'undefined', 'true', 'false', 'NaN', 'Infinity']);

  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function highlight(code) {
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(\s*\()?|([\s\S])/g;
    let out = '';
    let m;
    while ((m = re.exec(code))) {
      const [all, com, str, num, word, paren, other] = m;
      if (com) out += `<span class="t-com">${esc(com)}</span>`;
      else if (str) out += `<span class="t-str">${esc(str)}</span>`;
      else if (num) out += `<span class="t-num">${num}</span>`;
      else if (word) {
        let cls = '';
        if (KEYWORDS.has(word)) cls = 't-kw';
        else if (LITERALS.has(word)) cls = 't-lit';
        else if (word === 'raiz') cls = 't-root';
        else if (paren) cls = 't-fn';
        else if (/^[A-Z]/.test(word)) cls = 't-type';
        out += cls ? `<span class="${cls}">${word}</span>` : word;
        if (paren) out += esc(paren);
      } else out += esc(other ?? all);
    }
    return out;
  }

  function create(root, { onChange, onToggleBreakpoint } = {}) {
    root.classList.add('ed');
    root.innerHTML = `
      <div class="ed-scroll">
        <div class="ed-inner">
          <div class="ed-gutter" aria-hidden="true"></div>
          <div class="ed-code">
            <div class="ed-marks" aria-hidden="true"></div>
            <pre class="ed-hl" aria-hidden="true"></pre>
            <textarea class="ed-input" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="Código"></textarea>
          </div>
        </div>
      </div>`;
    const scroll = root.querySelector('.ed-scroll');
    const gutter = root.querySelector('.ed-gutter');
    const marksEl = root.querySelector('.ed-marks');
    const hl = root.querySelector('.ed-hl');
    const ta = root.querySelector('.ed-input');

    let breakpoints = new Set();
    let marks = { active: null, stack: [], error: null, returning: false };
    let lineCount = 0;

    function refresh() {
      const code = ta.value;
      hl.innerHTML = highlight(code) + '\n ';
      const n = code.split('\n').length;
      if (n !== lineCount) {
        lineCount = n;
        breakpoints = new Set([...breakpoints].filter(l => l <= n));
      }
      renderGutter();
    }

    function renderGutter() {
      let html = '';
      for (let i = 1; i <= lineCount; i++) {
        const cls = ['ed-ln'];
        if (breakpoints.has(i)) cls.push('bp');
        if (marks.active === i) cls.push('active');
        if (marks.error === i) cls.push('error');
        html += `<div class="${cls.join(' ')}" data-line="${i}">${i}</div>`;
      }
      gutter.innerHTML = html;
      let m = '';
      const band = (line, cls) => `<div class="ed-band ${cls}" style="top:${PAD + (line - 1) * LINE_H}px"></div>`;
      for (const l of marks.stack) if (l && l !== marks.active) m += band(l, 'stack');
      if (marks.active) m += band(marks.active, marks.returning ? 'active returning' : 'active');
      if (marks.error) m += band(marks.error, 'error');
      marksEl.innerHTML = m;
    }

    function revealLine(line) {
      if (!line) return;
      const top = PAD + (line - 1) * LINE_H;
      if (top < scroll.scrollTop + LINE_H || top > scroll.scrollTop + scroll.clientHeight - LINE_H * 2) {
        scroll.scrollTo({ top: Math.max(0, top - scroll.clientHeight / 3) });
      }
    }

    function insert(text) {
      ta.focus();
      // execCommand conserva el deshacer nativo del textarea.
      if (!document.execCommand('insertText', false, text)) ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
      refresh();
      onChange?.(ta.value);
    }

    ta.addEventListener('input', () => {
      ta.scrollTop = 0;
      ta.scrollLeft = 0;
      refresh();
      onChange?.(ta.value);
    });
    ta.addEventListener('scroll', () => { ta.scrollTop = 0; ta.scrollLeft = 0; });

    ta.addEventListener('keydown', e => {
      if (ta.readOnly) return;
      const { selectionStart: s, selectionEnd: end, value } = ta;
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const line = value.slice(lineStart, s);
      if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (e.shiftKey) {
          if (value.startsWith(INDENT, lineStart)) {
            ta.setSelectionRange(lineStart, lineStart + INDENT.length);
            insert('');
            ta.setSelectionRange(Math.max(lineStart, s - INDENT.length), Math.max(lineStart, end - INDENT.length));
          }
        } else if (s !== end && value.slice(s, end).includes('\n')) {
          const block = value.slice(lineStart, end);
          ta.setSelectionRange(lineStart, end);
          insert(block.replace(/^/gm, INDENT));
        } else {
          insert(INDENT);
        }
      } else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const indent = /^\s*/.exec(line)[0];
        const before = value[s - 1], after = value[end];
        if ((before === '{' || before === '[' || before === '(') && (after === '}' || after === ']' || after === ')')) {
          insert(`\n${indent}${INDENT}\n${indent}`);
          const pos = s + 1 + indent.length + INDENT.length;
          ta.setSelectionRange(pos, pos);
        } else {
          insert('\n' + indent + (/[{[(]\s*$/.test(line) ? INDENT : ''));
        }
      } else if (e.key === '}' && /^\s+$/.test(line) && line.length >= INDENT.length) {
        e.preventDefault();
        ta.setSelectionRange(s - INDENT.length, end);
        insert('}');
      }
    });

    gutter.addEventListener('click', e => {
      const ln = e.target.closest('.ed-ln');
      if (!ln) return;
      const line = +ln.dataset.line;
      if (breakpoints.has(line)) breakpoints.delete(line); else breakpoints.add(line);
      renderGutter();
      onToggleBreakpoint?.(line, breakpoints.has(line));
    });

    refresh();

    return {
      get value() { return ta.value; },
      setValue(v) {
        ta.value = v;
        breakpoints.clear();
        refresh();
        scroll.scrollTo({ top: 0, left: 0 });
      },
      setReadOnly(ro) {
        ta.readOnly = ro;
        root.classList.toggle('readonly', ro);
      },
      setMarks(m) {
        marks = { active: null, stack: [], error: null, returning: false, ...m };
        renderGutter();
        revealLine(marks.error || marks.active);
      },
      get breakpoints() { return breakpoints; },
      /** Selecciona el contenido de una línea y la trae a la vista. */
      goToLine(line) {
        const lines = ta.value.split('\n');
        if (line < 1 || line > lines.length) return;
        let pos = 0;
        for (let i = 0; i < line - 1; i++) pos += lines[i].length + 1;
        const indent = /^\s*/.exec(lines[line - 1])[0].length;
        ta.focus({ preventScroll: true });
        ta.setSelectionRange(pos + indent, pos + lines[line - 1].length);
        const top = PAD + (line - 1) * LINE_H;
        scroll.scrollTo({ top: Math.max(0, top - scroll.clientHeight / 3), left: 0 });
      },
      focus: () => ta.focus(),
      textarea: ta,
    };
  }

  return { create, highlight };
})();
