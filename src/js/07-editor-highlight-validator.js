// ============================================================
// Подсветка синтаксиса, персистентность редактора, диагностика/валидатор
// (часть модуля mindustry-studio; оборачивается build.py)
// ============================================================

    // SYNTAX HIGHLIGHTING
    function escapeHtml(s) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function highlightSyntax(text) {
      const escaped = escapeHtml(text);
      return escaped.replace(
        /(\/\/(?:\[[\s\S]*?\]\]|[^\n])*?\/\/|\/\/[^\n]*$|#[^\n]*$)|("(?:\\.|[^"\\])*"(?:\s*:)?)|('(?:\\.|[^'\\])*'(?:\s*:)?)|(\btrue\b|\bfalse\b)|(\bnull\b)|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)|([{}\[\],:])|([A-Za-z_][A-Za-z0-9_.\-]*)/gm,
        (match, comment, dq, sq, bool, nul, num, punct, bare) => {
          if (comment) return `<span class="tok-comment">${comment}</span>`;
          if (dq || sq) {
            const str = dq || sq;
            const ci = str.search(/\s*:/);
            if (ci !== -1) {
              const quote = str[0];
              const rawKey = str.slice(1, str.indexOf(quote, 1));
              const typo = findTypoSuggestion(rawKey);
              const cls = typo ? "tok-key tok-typo" : "tok-key";
              const title = typo ? ` title="Возможно, опечатка. Похоже на &quot;${typo.suggestion}&quot;"` : "";
              return `<span class="${cls}"${title}>${str}</span>`;
            }
            return `<span class="tok-string">${str}</span>`;
          }
          if (bool) return `<span class="tok-bool">${bool}</span>`;
          if (nul) return `<span class="tok-null">${nul}</span>`;
          if (num) return `<span class="tok-number">${num}</span>`;
          if (punct) return `<span class="tok-punct">${punct}</span>`;
          if (bare) {
            // голое слово: ключ (перед «:») или значение (после «:» / «{» / «[» / «,»)
            const idx = match.index;
            const before = escaped.slice(0, idx);
            const after = escaped.slice(idx + match.length);
            if (/:\s*$/.test(before) || /[{[,]\s*$/.test(before)) {
              return `<span class="tok-hvalue">${bare}</span>`;
            }
            if (/:\s*$/.test(after)) {
              const typo = findTypoSuggestion(bare);
              const cls = typo ? "tok-key tok-typo" : "tok-hkey";
              const title = typo ? ` title="Возможно, опечатка. Похоже на &quot;${typo.suggestion}&quot;"` : "";
              return `<span class="${cls}"${title}>${bare}</span>`;
            }
            return `<span class="tok-hvalue">${bare}</span>`;
          }
          return match;
        }
      );
    }

    function renderHighlight() {
      codeHighlightContent.innerHTML = highlightSyntax(editor.value);

      syncEditorScroll();
    }

    // ERROR LINE HIGHLIGHTING
    let currentErrorLine = null;
    // FIELD TYPO DETECTION STATE
    let currentTypos = [];

    function getErrorLineNumber(err, text) {
      const msg = err && err.message ? err.message : "";
      const lineMatch = msg.match(/line (\d+)/i);
      if (lineMatch) return parseInt(lineMatch[1], 10);
      const posMatch = msg.match(/position (\d+)/i);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        return text.substring(0, pos).split("\n").length;
      }
      return null;
    }

    function repositionErrorHighlight() {
      if (!currentErrorLine) {
        errorLineHighlight.style.display = "none";
        return;
      }
      errorLineHighlight.style.display = "block";
      errorLineHighlight.style.top =
        (EDITOR_PAD_TOP + (currentErrorLine - 1) * LINE_HEIGHT - editor.scrollTop) + "px";
    }

    function setErrorLine(lineNum) {
      currentErrorLine = lineNum || null;
      repositionErrorHighlight();
    }

    // LOCAL STORAGE PERSISTENCE
    let saveDebounce = null;

    function persistState(showFeedback) {
      try {
        localStorage.setItem(STORAGE_KEY_CODE, editor.value);
        localStorage.setItem(STORAGE_KEY_FILENAME, fileNameDisplay.textContent);
        if (showFeedback) showToast("Код сохранён в браузере");
      } catch (e) {
        if (showFeedback) showToast("Не удалось сохранить: хранилище браузера недоступно");
      }
    }

    function schedulePersist() {
      clearTimeout(saveDebounce);
      saveDebounce = setTimeout(() => persistState(false), 500);
    }

    // LINE NUMBERS & SYNC
    function updateEditorLines() {
      const lines = editor.value.split("\n");
      let html = "";
      const currentLine = getCursorLine();
      // FIELD TYPO DETECTION GUTTER
      const typoLineSet = new Set(currentTypos.map(t => t.line));

      for (let i = 1; i <= lines.length; i++) {
        let cls = "";
        // FIELD TYPO DETECTION GUTTER
        if (typoLineSet.has(i)) cls = "line-typo-warn";

        if (i === currentLine) cls = "line-active-indicator";
        if (i === currentErrorLine) cls = (cls ? cls + " " : "") + "line-error";
        html += cls ? `<div class="${cls}">${i}</div>` : `<div>${i}</div>`;
      }
      lineNumbersInner.innerHTML = html;
      renderHighlight();
    }

    function getCursorLine() {
      const pos = editor.selectionStart;
      const textBefore = editor.value.substring(0, pos);
      return textBefore.split("\n").length;
    }

    function getCursorCol() {
      const pos = editor.selectionStart;
      const textBefore = editor.value.substring(0, pos);
      const lines = textBefore.split("\n");
      return lines[lines.length - 1].length + 1;
    }

    // ADVANCED VALIDATOR

    function jumpToLine(lineNumber) {
      if (!lineNumber) return;
      const lines = editor.value.split("\n");
      let pos = 0;
      for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
        pos += lines[i].length + 1;
      }
      editor.focus();
      editor.setSelectionRange(pos, pos);
      updateEditorLines();
      validateAndAnalyze();
    }

    function scanStructuralDiagnostics(text) {
      const diagnostics = [];
      const stack = [];
      const objectKeyStack = [];
      let inString = false;
      let escape = false;
      let line = 1;
      let stringStartIdx = -1;

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === "\n") { line++; if (inString) {  } continue; }

        if (inString) {
          if (escape) { escape = false; }
          else if (ch === "\\") { escape = true; }
          else if (ch === '"') {
            inString = false;

            let j = i + 1;
            while (j < text.length && /[ \t]/.test(text[j])) j++;
            if (text[j] === ":" ) {
              const top = objectKeyStack[objectKeyStack.length - 1];
              if (top && top instanceof Set) {
                const key = text.slice(stringStartIdx + 1, i);
                if (top.has(key)) {
                  diagnostics.push({ line, type: "warn", message: `Повторяющийся ключ "${key}" в одном объекте — второе значение перезапишет первое` });
                } else {
                  top.add(key);
                }
              }
            }
          }
          continue;
        }

        if (ch === '"') { inString = true; escape = false; stringStartIdx = i; continue; }

        if (ch === "{") {
          stack.push({ char: "{", line });
          objectKeyStack.push(new Set());
        } else if (ch === "[") {
          stack.push({ char: "[", line });
          objectKeyStack.push(null);
        } else if (ch === "}") {
          if (!stack.length || stack[stack.length - 1].char !== "{") {
            diagnostics.push({ line, type: "error", message: 'Лишняя или несовпадающая закрывающая скобка "}"' });
          } else {
            stack.pop();
          }
          objectKeyStack.pop();
        } else if (ch === "]") {
          if (!stack.length || stack[stack.length - 1].char !== "[") {
            diagnostics.push({ line, type: "error", message: 'Лишняя или несовпадающая закрывающая скобка "]"' });
          } else {
            stack.pop();
          }
          objectKeyStack.pop();
        } else if (ch === ",") {
          let j = i + 1;
          let lookaheadLine = line;
          while (j < text.length && /\s/.test(text[j])) {
            if (text[j] === "\n") lookaheadLine++;
            j++;
          }
          if (text[j] === "}" || text[j] === "]") {
            diagnostics.push({ line, type: "error", message: "Висячая запятая перед закрывающей скобкой — удалите лишнюю запятую" });
          }
        }
      }

      if (inString) {
        diagnostics.push({ line, type: "error", message: "Незакрытая строка — не найдена завершающая кавычка \"" });
      }

      stack.forEach(s => {
        diagnostics.push({ line: s.line, type: "error", message: `Незакрытая скобка "${s.char}" — не найдена соответствующая закрывающая скобка` });
      });

      return diagnostics;
    }

    function typeExpectation(typeStr) {
      if (!typeStr) return null;
      if (/^boolean/i.test(typeStr)) return "boolean";
      if (/^int\b/i.test(typeStr) || /^float\b/i.test(typeStr)) return "number";
      if (/^String\b/i.test(typeStr)) return "string";
      return null;
    }

    function scanTypeMismatches(text) {
      const lines = text.split("\n");
      const diagnostics = [];
      lines.forEach((lineText, idx) => {
        const m = lineText.match(/"([A-Za-z_][A-Za-z0-9_]*)"\s*:\s*(.+?),?\s*$/);
        if (!m) return;
        const key = m[1];
        const value = m[2].trim();
        const fieldInfo = DB_FIELDS[key];
        if (!fieldInfo) return;
        const expected = typeExpectation(fieldInfo.type);
        if (!expected) return;
        if (value.startsWith("{") || value.startsWith("[") || value === "") return;

        let actual = null;
        if (/^".*"$/.test(value)) actual = "string";
        else if (/^(true|false)$/.test(value)) actual = "boolean";
        else if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value)) actual = "number";

        if (actual && actual !== expected) {
          const labels = { string: "строка", boolean: "булево значение", number: "число" };
          diagnostics.push({
            line: idx + 1,
            type: "warn",
            message: `Поле "${key}" обычно ожидает ${labels[expected]} (${fieldInfo.type}), но указано ${labels[actual]}`
          });
        }
      });
      return diagnostics;
    }

    function runFullDiagnostics(text) {
      const diags = scanStructuralDiagnostics(text).concat(scanTypeMismatches(text));
      diags.sort((a, b) => a.line - b.line);
      return diags;
    }

    function renderDiagnostics(diags) {
      if (!diags.length) {
        diagCard.style.display = "none";
        diagList.innerHTML = "";
        return;
      }
      diagCard.style.display = "block";
      const errCount = diags.filter(d => d.type === "error").length;
      const warnCount = diags.filter(d => d.type === "warn").length;
      diagCount.textContent = `${errCount} ошиб., ${warnCount} предупр.`;
      diagCount.style.color = errCount > 0 ? "var(--accent-red)" : "var(--accent-mind)";

      diagList.innerHTML = "";
      diags.forEach(d => {
        const row = document.createElement("div");
        row.className = "diag-item " + (d.type === "error" ? "diag-error" : "diag-warn");
        row.innerHTML = `<span class="diag-line-tag">Стр ${d.line}:</span>${d.message}`;
        row.addEventListener("click", () => jumpToLine(d.line));
        diagList.appendChild(row);
      });
    }

    // PARSE & HINTS LOGIC
    function validateAndAnalyze() {
      const val = editor.value;
      const lineNum = getCursorLine();
      const colNum = getCursorCol();
      cursorPosDisplay.textContent = `Стр ${lineNum}, Кол ${colNum}`;

      let parsed = null;
      let isOk = false;
      // ADVANCED VALIDATOR INTEGRATION (комментарии // ... // вырезаются перед сканерами)
      const cleanVal = stripComments(val);
      const fullDiags = runFullDiagnostics(cleanVal);
      const structuralErrorCount = fullDiags.filter(d => d.type === "error").length;

      try {
        parsed = tryParseJson(val);
        isOk = true;
        if (fullDiags.length > 0) {
          statusBadge.textContent = structuralErrorCount > 0
            ? `JSON распознан, но найдено ${fullDiags.length} проблем`
            : `JSON корректен (${fullDiags.length} предупр.)`;
          statusBadge.className = structuralErrorCount > 0 ? "status-badge status-warn" : "status-badge status-warn";
        } else {
          statusBadge.textContent = "JSON корректен";
          statusBadge.className = "status-badge status-ok";
        }
        statusBadge.title = "";
        setErrorLine(fullDiags.length ? fullDiags[0].line : null);
      } catch (err) {
        const errLine = err.hjsonLine || getErrorLineNumber(err, val) || (fullDiags[0] && fullDiags[0].line) || null;
        statusBadge.textContent = errLine ? `Ошибка синтаксиса (строка ${errLine})` : "Ошибка синтаксиса";
        statusBadge.className = "status-badge status-err";
        statusBadge.title = err.message;
        setErrorLine(errLine);
      }
      // ADVANCED VALIDATOR INTEGRATION
      renderDiagnostics(fullDiags);

      const lines = val.split("\n");
      const currentLineTextRaw = lines[lineNum - 1] || "";
      const currentLineText = stripComments(currentLineTextRaw);
      hintLineNum.textContent = `#${lineNum}`;

      // FIELD TYPO DETECTION SCAN

      currentTypos = scanFieldTypos(cleanVal);
      if (currentTypos.length > 0) {
        typoBadge.style.display = "inline-flex";
        typoBadge.textContent = currentTypos.length === 1
          ? "⚠ 1 поле с опечаткой?"
          : `⚠ ${currentTypos.length} полей с опечаткой?`;
      } else {
        typoBadge.style.display = "none";
      }

      // ключ может быть в двойных/одинарных кавычках или без кавычек (HJSON)
      const keyMatch = currentLineText.match(/(?:"([^"]+)"|'([^']+)'|([A-Za-z_][A-Za-z0-9_]*))\s*:/);
      if (keyMatch) {
        const key = keyMatch[1] != null ? keyMatch[1] : (keyMatch[2] != null ? keyMatch[2] : keyMatch[3]);
        if (DB_FIELDS[key]) {
          const info = DB_FIELDS[key];
          hintTag.textContent = "Mindustry API";
          hintTag.style.color = "var(--accent-cyan)";
          hintPropName.textContent = `"${key}"`;
          hintPropType.textContent = info.type;
          hintPropDesc.textContent = info.desc;
          hintExample.textContent = info.example;
        } else {
          // FIELD TYPO DETECTION HINT
          const typo = findTypoSuggestion(key);
          if (typo) {
            hintTag.textContent = "⚠ Возможная опечатка";
            hintTag.style.color = "var(--accent-mind)";
            hintPropName.textContent = `"${key}"`;
            hintPropType.textContent = `Похоже на "${typo.suggestion}"`;
            hintPropDesc.textContent = `Поля "${key}" нет в базе Mindustry API, но оно очень похоже на существующее поле "${typo.suggestion}" (отличие: ${typo.distance} симв.). Возможно, опечатка.`;
            hintExample.textContent = DB_FIELDS[typo.suggestion] ? DB_FIELDS[typo.suggestion].example : `"${typo.suggestion}": ...`;
          } else {
            hintTag.textContent = "Свойство объекта";
            hintTag.style.color = "var(--text-muted)";
            hintPropName.textContent = `"${key}"`;
            hintPropType.textContent = "Пользовательское поле";
            hintPropDesc.textContent = `Поле "${key}" найдено в коде. В Mindustry большинство стандартных свойств соответствуют открытому API v7/v8.`;
            hintExample.textContent = `"${key}": ...`;
          }

        }
      } else {

        const trimmed = currentLineText.trim();
        hintTag.textContent = "Синтаксис";
        hintTag.style.color = "var(--accent-mind)";

        if (trimmed.startsWith("{")) {
          hintPropName.textContent = "{ (Начало объекта)";
          hintPropType.textContent = "Object Block";
          hintPropDesc.textContent = "Открывающая фигурная скобка обозначает создание блока, пули или вложенного объекта параметров.";
          hintExample.textContent = '{\n  "type": "ItemTurret"\n}';
        } else if (trimmed.startsWith("}")) {
          hintPropName.textContent = "} (Конец объекта)";
          hintPropType.textContent = "Object Block";
          hintPropDesc.textContent = "Закрывающая скобка. Убедитесь, что после неё стоит запятая, если далее следует следующее поле.";
          hintExample.textContent = '}\n,';
        } else if (trimmed.startsWith("[")) {
          hintPropName.textContent = "[ (Список элементов)";
          hintPropType.textContent = "Array Block";
          hintPropDesc.textContent = "Массив значений (например список требований requirements, цветов colors или орудий weapons).";
          hintExample.textContent = '[\n  { "item": "copper", "amount": 10 }\n]';
        } else {
          hintPropName.textContent = "Строка " + lineNum;
          hintPropType.textContent = "Текст или разметка";
          hintPropDesc.textContent = "Поставьте курсор на ключ со свойством (например, damage, reload, size), чтобы прочесть документацию.";
          hintExample.textContent = '"reload": 30';
        }
      }

      updateSuggestions(parsed, currentLineText);

      refreshLineNumberMarkers();
    }

    function refreshLineNumberMarkers() {
      const currentLine = getCursorLine();
      // FIELD TYPO DETECTION GUTTER
      const typoLineSet = new Set(currentTypos.map(t => t.line));

      Array.from(lineNumbersInner.children).forEach((el, idx) => {
        const num = idx + 1;
        let cls = "";
        // FIELD TYPO DETECTION GUTTER
        if (typoLineSet.has(num)) cls = "line-typo-warn";

        if (num === currentLine) cls = "line-active-indicator";
        if (num === currentErrorLine) cls = (cls ? cls + " " : "") + "line-error";
        el.className = cls;
      });
    }
