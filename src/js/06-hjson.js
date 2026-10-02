// ============================================================
// HJSON-парсер (поддержка "нестрогого" JSON Mindustry)
// (часть модуля mindustry-studio; оборачивается build.py)
// ============================================================

    // ================= HJSON SUPPORT (v3.0) =================
    // Принимает JSON/HJSON вперемешку: ключи и значения без кавычек, без запятых,
    // комментарии вида // ... // (в том числе многострочные), #..., одинарные кавычки,
    // ключ в кавычках — значение без кавычек и наоборот.
    function hjsonParse(text) {
      let i = 0;
      const n = text.length;
      const isPunct = c => c === '{' || c === '}' || c === '[' || c === ']' || c === ',' || c === ':';

      function err(msg) { const e = new Error(msg); e.hjsonLine = lineAt(i); return e; }
      function lineAt(pos) { let l = 1; for (let k = 0; k < pos && k < n; k++) if (text[k] === "\n") l++; return l; }

      function skipWs() {
        while (i < n) {
          const c = text[i];
          if (c === " " || c === "\t" || c === "\r" || c === "\n") { i++; continue; }
          if (c === "/" && text[i + 1] === "/") {
            const lineStart = text.lastIndexOf("\n", i - 1) + 1;
            const onlyWsBefore = /^\s*$/.test(text.slice(lineStart, i));
            i += 2;
            if (text[i] === "[") {
              const end = text.indexOf("]]", i + 2);
              i = end === -1 ? n : end + 2;
            } else if (onlyWsBefore) {
              // многострочный блок // ... // (закрывающие // могут быть на своей строке)
              let closed = false;
              while (i < n) {
                if (text[i] === "/" && text[i + 1] === "/") { i += 2; closed = true; break; }
                if (text[i] === "\n") { i++; continue; }
                i++;
              }
              if (!closed) { /* дошли до конца — блок съел всё, это допустимо */ }
            } else {
              // строчный комментарий: до закрывающих // на этой же строке или до конца строки
              while (i < n) {
                if (text[i] === "/" && text[i + 1] === "/") { i += 2; break; }
                if (text[i] === "\n") { i++; break; }
                i++;
              }
            }
            continue;
          }
          if (c === "#") { while (i < n && text[i] !== "\n") i++; continue; }
          break;
        }
      }

      function readQuoted(q) {
        let out = "";
        i++;
        while (i < n) {
          const c = text[i];
          if (c === "\\") {
            const nx = text[i + 1];
            if (nx === "n") out += "\n";
            else if (nx === "t") out += "\t";
            else if (nx === "r") out += "\r";
            else if (nx === "u") { out += String.fromCharCode(parseInt(text.substr(i + 2, 4), 16) || 0); i += 4; }
            else out += (nx == null ? "" : nx);
            i += 2;
            continue;
          }
          if (c === q) { i++; return out; }
          out += c; i++;
        }
        throw err("Незакрытая строка — не найдена завершающая кавычка");
      }

      function unescapeKey(k) {
        if (k.length >= 2 && (k[0] === '"' || k[0] === "'") && k[k.length - 1] === k[0]) {
          try { return JSON.parse('"' + k.slice(1, -1).replace(/"/g, '\\"') + '"'); } catch (_) { return k.slice(1, -1); }
        }
        return k;
      }

      function parseValue() {
        skipWs();
        if (i >= n) throw err("Неожиданный конец данных");
        const c = text[i];
        if (c === "{") return parseObject();
        if (c === "[") return parseArray();
        if (c === '"' || c === "'") {
          const str = readQuoted(c);
          skipWs();
          if (text[i] === ":") { i++; const o = {}; o[str] = parseValue(); return o; }
          return str;
        }
        const start = i;
        while (i < n) {
          const ch = text[i];
          if (ch === "\n") break;
          if (ch === ":" && /^\s*[A-Za-z_][A-Za-z0-9_.\-]*\s*:/.test(text.slice(i + 1))) break; // «ключ: значение ключ2: ...»
          if (isPunct(ch)) break;
          if (ch === "/" && text[i + 1] === "/") break;
          if (ch === "#") break;
          i++;
        }
        let raw = text.slice(start, i).trim();
        if (!raw) throw err("Ожидалось значение, но найдено: \"" + (text.slice(i, i + 12) || "конец файла") + "\"");
        if (raw === "true") return true;
        if (raw === "false") return false;
        if (raw === "null") return null;
        if (/^[-+]?(0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?$/.test(raw)) return parseFloat(raw);
        return raw;
      }

      function readKeyToken() {
        skipWs();
        if (i >= n) throw err("Ожидался ключ объекта");
        const c = text[i];
        if (c === '"' || c === "'") {
          const start = i;
          readQuoted(c);
          return text.slice(start, i);
        }
        const start = i;
        while (i < n) {
          const ch = text[i];
          if (ch === ":") break;
          if (ch === "\n") break;
          if (/[{}\[\],]/.test(ch)) break;
          if (ch === "/" && text[i + 1] === "/") break;
          if (ch === "#") break;
          i++;
        }
        let raw = text.slice(start, i).trim();
        if (!raw.includes(":")) {
          const sp = raw.indexOf(" ");
          if (sp > 0) raw = raw.slice(0, sp);
        }
        if (!raw) throw err("Ожидался ключ объекта или \"}\", но найдено: \"" + (text.slice(i, i + 12) || "конец файла") + "\"");
        return raw;
      }

      function restOfLineFrom(pos) {
        let e = pos;
        while (e < n && text[e] !== "\n") e++;
        return text.slice(pos, e);
      }

      function isQuotedAt(pos) {
        const q = text[pos];
        if (q !== '"' && q !== "'") return false;
        let j = pos + 1;
        while (j < n) {
          if (text[j] === "\\") { j += 2; continue; }
          if (text[j] === q) return true;
          if (text[j] === "\n") return false;
          j++;
        }
        return false;
      }

      // «ключ: значение» на одной строке (двойные/одинарные кавычки или без кавычек)
      function looksLikeKeyValue() {
        let p = i;
        if (isQuotedAt(p)) {
          const q = text[p]; p++;
          while (p < n && text[p] !== q) { if (text[p] === "\\") p++; p++; }
          p++;
        } else {
          while (p < n && /[A-Za-z0-9_.$\-]/.test(text[p])) p++;
        }
        while (p < n && (text[p] === " " || text[p] === "\t")) p++;
        return text[p] === ":";
      }

      function parseObject() {
        i++; // consume {
        const obj = {};
        while (true) {
          skipWs();
          if (i >= n) throw err("Незакрытая скобка \"{\" — не найдена соответствующая закрывающая скобка");
          if (text[i] === "}") { i++; return obj; }
          const keyTok = readKeyToken();
          const key = unescapeKey(keyTok);
          skipWs();
          let value;
          if (text[i] === ":") { i++; value = parseValue(); }
          else if (text[i] === "{") { value = parseObject(); }
          else if (text[i] === "[") { value = parseArray(); }
          else if (keyTok[0] === '"' || keyTok[0] === "'") {
            // ключ в кавычках без двоеточия — строка-значение до конца строки
            const ls = i; while (i < n && text[i] !== "\n") i++; value = text.slice(ls, i).trim();
          } else {
            // HJSON shorthand: «ключ значение» на одной строке, иначе — флаг true
            const rest = restOfLineFrom(i).trim();
            if (!rest || /^["']?[A-Za-z_][A-Za-z0-9_.\-]*["']?\s*:/.test(rest)) {
              value = true; // голый ключ или сразу следующая пара «ключ: ...» — это флаг
            } else {
              const segStart = i + (restOfLineFrom(i).length - rest.length);
              i = segStart;
              value = parseValue();
            }
          }
          obj[key] = value;
          skipWs();
          if (text[i] === ",") { i++; continue; }
          if (text[i] === "}") { i++; return obj; }
          if (i >= n) throw err("Незакрытая скобка \"{\" — не найдена соответствующая закрывающая скобка");
        }
      }

      function parseArray() {
        i++; // consume [
        const arr = [];
        while (true) {
          skipWs();
          if (i >= n) throw err("Незакрытая скобка \"[\" — не найдена соответствующая закрывающая скобка");
          if (text[i] === "]") { i++; return arr; }
          if (text[i] === ",") { i++; continue; }
          // элементы могут быть в форме "key value" (HJSON shorthand)
          if (text[i] === '"' || text[i] === "'") {
            const save = i;
            const qt = text[i];
            readQuoted(qt);
            skipWs();
            if (text[i] === ":") {
              i++;
              const keyTokRaw = text.slice(save, i - 1).trim();
              const k = unescapeKey(keyTokRaw);
              const o = {}; o[k] = parseValue(); arr.push(o);
              skipWs();
              if (text[i] === ",") { i++; }
              continue;
            }
            i = save;
          }
          if (looksLikeKeyValue()) {
            const kTok = readKeyToken();
            skipWs();
            if (text[i] === ":") i++;
            const o = {}; o[unescapeKey(kTok)] = parseValue();
            arr.push(o);
          } else {
            arr.push(parseValue());
          }
          skipWs();
          if (text[i] === ",") { i++; }
        }
      }

      skipWs();
      if (i >= n) return undefined;
      const result = parseValue();
      skipWs();
      if (i < n) throw err("Лишние данные после конца документа: \"" + text.slice(i, i + 12) + "\"");
      return result;
    }

    // Попытка парсинга: сначала строгий JSON, затем HJSON. Бросает ошибку последней попытки.
    function tryParseJson(text) {
      try { return JSON.parse(text); } catch (strictErr) {
        const val = hjsonParse(text);
        if (val === undefined) throw strictErr;
        return val;
      }
    }

    // Убирает комментарии // ... // и #... из текста (для сканеров диагностики/опечаток)
    function stripComments(text) {
      let out = "", i = 0; const n = text.length; let inStr = false, esc = false;
      while (i < n) {
        const c = text[i];
        if (inStr) {
          out += c;
          if (esc) esc = false;
          else if (c === "\\") esc = true;
          else if (c === '"') inStr = false;
          i++; continue;
        }
        if (c === '"') { inStr = true; out += c; i++; continue; }
        if (c === "/" && text[i + 1] === "/") {
          i += 2;
          if (text[i] === "[") { const e = text.indexOf("]]", i + 2); i = e === -1 ? n : e + 2; continue; }
          while (i < n && text[i] !== "\n" && !(text[i] === "/" && text[i + 1] === "/")) i++;
          if (text[i] === "/" && text[i + 1] === "/") i += 2;
          continue;
        }
        if (c === "#") { while (i < n && text[i] !== "\n") i++; continue; }
        out += c; i++;
      }
      return out;
    }
