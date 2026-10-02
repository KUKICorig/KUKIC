// ============================================================
// Поиск опечаток в названиях полей (Левенштейн + подсказки)
// (часть модуля mindustry-studio; оборачивается build.py)
// ============================================================

    // FIELD TYPO DETECTION

    let KNOWN_FIELD_NAMES = Object.keys(DB_FIELDS);

    function levenshtein(a, b) {
      const m = a.length, n = b.length;
      if (m === 0) return n;
      if (n === 0) return m;
      let prev = new Array(n + 1);
      let curr = new Array(n + 1);
      for (let j = 0; j <= n; j++) prev[j] = j;
      for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          curr[j] = Math.min(
            prev[j] + 1,
            curr[j - 1] + 1,
            prev[j - 1] + cost
          );
        }
        [prev, curr] = [curr, prev];
      }
      return prev[n];
    }

    function findTypoSuggestion(key) {
      if (!key || DB_FIELDS[key]) return null;
      let best = null;
      let bestDist = Infinity;
      for (const known of KNOWN_FIELD_NAMES) {

        if (Math.abs(known.length - key.length) > 2) continue;
        const dist = levenshtein(key, known);
        if (dist < bestDist) {
          bestDist = dist;
          best = known;
        }
        if (bestDist === 1) break;
      }
      if (!best) return null;

      const threshold = key.length <= 4 ? 1 : (key.length <= 8 ? 2 : 3);
      if (bestDist > 0 && bestDist <= threshold) {
        return { suggestion: best, distance: bestDist };
      }
      return null;
    }

    function scanFieldTypos(text) {
      const lines = text.split("\n");
      const results = [];
      lines.forEach((lineText, idx) => {
        // ключи в кавычках и без кавычек (HJSON)
        const keyMatch = lineText.match(/(?:"|')?([A-Za-z_][A-Za-z0-9_]*)(?:"|')?\s*:/);
        if (!keyMatch) return;
        const key = keyMatch[1];
        const hit = findTypoSuggestion(key);
        if (hit) {
          results.push({ line: idx + 1, key, suggestion: hit.suggestion, distance: hit.distance });
        }
      });
      return results;
    }
