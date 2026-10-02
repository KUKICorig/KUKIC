// ============================================================
// Удалённая база знаний (Knowledge Base): загрузка, кэш, применение
// (часть модуля mindustry-studio; оборачивается build.py)
// ============================================================

    // REMOTE KNOWLEDGE BASE LOADER

    const KNOWLEDGE_BASE_URL = "https://raw.githubusercontent.com/KUKICorig/-/main/mindustry-kb-data.json";
    const KNOWLEDGE_BASE_CACHE_KEY = "mindustryStudio.knowledgeBase.v1";

    let DB_FIELDS = {};
    let BULLET_TYPES = {};
    let STATUS_EFFECTS = {};

    window.MS_KB = {
      loaded: false,
      source: KNOWLEDGE_BASE_URL,
      fromCache: false,
      updated: false,
      error: null
    };

    function applyKnowledgeBase(data) {
      if (!data || typeof data !== "object") throw new Error("База имеет неверный формат");

      const fields = data.DB_FIELDS || data.dbFields || data.fields;
      const bullets = data.BULLET_TYPES || data.bulletTypes || data.bullets || {};
      const statuses = data.STATUS_EFFECTS || data.statusEffects || data.statuses || {};

      if (!fields || typeof fields !== "object") {
        throw new Error("В базе отсутствует DB_FIELDS");
      }

      DB_FIELDS = fields;
      BULLET_TYPES = bullets && typeof bullets === "object" ? bullets : {};
      STATUS_EFFECTS = statuses && typeof statuses === "object" ? statuses : {};
      window.MS_KB.loaded = true;
    }

    function parseKnowledgeBaseText(text) {
      const raw = String(text || "").replace(/^\uFEFF/, "").trim();
      if (!raw) throw new Error("Файл базы пустой");

      try {
        return JSON.parse(raw);
      } catch (_) {}

      const source = `"use strict";\n${raw}\n;\nreturn { DB_FIELDS, BULLET_TYPES, STATUS_EFFECTS };`;
      return Function(source)();
    }

    function readKnowledgeBaseCache() {
      try {
        const cached = localStorage.getItem(KNOWLEDGE_BASE_CACHE_KEY);
        if (!cached) return null;
        const data = JSON.parse(cached);
        if (!data || !data.payload) return null;
        return data;
      } catch (_) {
        return null;
      }
    }

    function writeKnowledgeBaseCache(data) {
      try {
        localStorage.setItem(KNOWLEDGE_BASE_CACHE_KEY, JSON.stringify({
          savedAt: Date.now(),
          payload: data
        }));
      } catch (_) {}
    }

    async function fetchKnowledgeBase() {
      const response = await fetch(KNOWLEDGE_BASE_URL, {
        cache: "no-store",
        headers: { "Accept": "application/json, text/plain, */*" }
      });
      if (!response.ok) throw new Error(`GitHub: HTTP ${response.status}`);

      const text = await response.text();
      const data = parseKnowledgeBaseText(text);
      applyKnowledgeBase(data);
      writeKnowledgeBaseCache({
        DB_FIELDS,
        BULLET_TYPES,
        STATUS_EFFECTS
      });
      window.MS_KB.updated = true;
      return data;
    }

    async function loadKnowledgeBase() {
      const cached = readKnowledgeBaseCache();

      if (cached && cached.payload) {
        try {
          applyKnowledgeBase(cached.payload);
          window.MS_KB.fromCache = true;

        fetchKnowledgeBase().then(() => {
            if (typeof refreshFieldCaches === "function") refreshFieldCaches();
            if (typeof refreshKbViews === "function") refreshKbViews();
          }).catch(error => {
            window.MS_KB.error = error;
            console.warn("[Mindustry Studio] Не удалось обновить базу:", error);
          });
          return;
        } catch (error) {
          console.warn("[Mindustry Studio] Кэш базы повреждён:", error);
        }
      }

      await fetchKnowledgeBase();
    }

    await loadKnowledgeBase();
