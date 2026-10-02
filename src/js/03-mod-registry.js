// ============================================================
// Реестр модов с GitHub: индекс, кэш, нормализация
// (часть модуля mindustry-studio; оборачивается build.py)
// ============================================================

    // MOD REGISTRY

    const MODS_INDEX_URL = "https://raw.githubusercontent.com/Anuken/MindustryMods/master/mods.json";
    const MODS_INDEX_CACHE_KEY = "mindustryStudio.modsIndex.v1";
    const MODS_INDEX_CACHE_TTL = 2 * 60 * 60 * 1000;

    const MOD_REGISTRY_FALLBACK = [{
      id: "fallback",
      name: "MindustryMods",
      author: "Anuken",
      description: "Резервная запись. При доступности GitHub список заменится содержимым mods.json.",
      tags: ["fallback"],
      repo: "Anuken/MindustryMods",
      ref: "master",
      path: ""
    }];

    let MOD_REGISTRY = [];
    let MODS_INDEX_STATE = { loaded: false, fromCache: false, updatedAt: 0, error: null };

    function normalizeModRegistryItem(m) {
      if (!m || typeof m !== "object" || !m.repo) return null;
      const repo = String(m.repo).trim();
      if (!/^[^/]+\/[^/]+$/.test(repo)) return null;
      return {
        ...m,
        id: m.internalName || repo.replace("/", "-"),
        name: String(m.name || m.internalName || repo),
        author: String(m.author || "Неизвестно"),
        description: String(m.description || "Описание отсутствует."),
        repo,
        ref: m.ref || "",
        path: m.path || "",
        tags: Array.isArray(m.tags) ? m.tags : [],
        stars: Number(m.stars) || 0,
        version: m.version == null ? "" : String(m.version),
        minGameVersion: m.minGameVersion == null ? "" : String(m.minGameVersion),
        hasIcon: !!m.hasIcon,
        hasScripts: !!m.hasScripts,
        hasJava: !!m.hasJava,
        lastUpdated: m.lastUpdated || ""
      };
    }

    function readModsIndexCache() {
      try {
        const cached = JSON.parse(localStorage.getItem(MODS_INDEX_CACHE_KEY) || "null");
        return cached && Array.isArray(cached.mods) ? cached : null;
      } catch (_) {
        return null;
      }
    }

    function writeModsIndexCache(mods) {
      try {
        localStorage.setItem(MODS_INDEX_CACHE_KEY, JSON.stringify({
          savedAt: Date.now(),
          mods
        }));
      } catch (_) {}
    }

    function updateModsIndexStatus() {
      const el = document.getElementById("modsIndexStatus");
      if (!el) return;

      if (MODS_INDEX_STATE.error) {
        el.textContent = MODS_INDEX_STATE.loaded
          ? "🟡 GitHub недоступен — используется кэш"
          : "🔴 Не удалось загрузить mods.json";
        el.title = MODS_INDEX_STATE.error.message || String(MODS_INDEX_STATE.error);
        return;
      }

      if (!MODS_INDEX_STATE.loaded) {
        el.textContent = "⏳ Загрузка списка модов…";
        return;
      }

      el.textContent =
        `🟢 ${MOD_REGISTRY.length} модов · ` +
        (MODS_INDEX_STATE.fromCache ? "кэш" : "GitHub") +
        (MODS_INDEX_STATE.updatedAt ? " · " + new Date(MODS_INDEX_STATE.updatedAt).toLocaleString() : "");
      el.title = "Источник: Anuken/MindustryMods/mods.json";
    }

    async function fetchModsIndex() {
      const response = await fetch(MODS_INDEX_URL, {
        cache: "no-store",
        headers: { "Accept": "application/json" }
      });
      if (!response.ok) throw new Error(`MindustryMods: HTTP ${response.status}`);

      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("mods.json имеет неверный формат");

      const normalized = data.map(normalizeModRegistryItem).filter(Boolean);
      if (!normalized.length) throw new Error("mods.json не содержит подходящих модов");

      MOD_REGISTRY = normalized;
      writeModsIndexCache(normalized);
      MODS_INDEX_STATE = { loaded: true, fromCache: false, updatedAt: Date.now(), error: null };
      updateModsIndexStatus();
      return normalized;
    }

    async function loadModsRegistry(forceRefresh = false) {
      if (!forceRefresh && MODS_INDEX_STATE.loaded) return MOD_REGISTRY;

      const cached = readModsIndexCache();
      const cacheAge = cached ? Date.now() - Number(cached.savedAt || 0) : Infinity;
      const hasCache = cached && Array.isArray(cached.mods);

      if (hasCache && !forceRefresh) {
        MOD_REGISTRY = cached.mods.map(normalizeModRegistryItem).filter(Boolean);
        MODS_INDEX_STATE = {
          loaded: true,
          fromCache: true,
          updatedAt: Number(cached.savedAt || 0),
          error: null
        };
        updateModsIndexStatus();

        if (cacheAge >= MODS_INDEX_CACHE_TTL) {
          fetchModsIndex().catch(error => {
            MODS_INDEX_STATE.error = error;
            updateModsIndexStatus();
          });
        }
        return MOD_REGISTRY;
      }

      if (hasCache) {
        MOD_REGISTRY = cached.mods.map(normalizeModRegistryItem).filter(Boolean);
      } else if (!MOD_REGISTRY.length) {
        MOD_REGISTRY = MOD_REGISTRY_FALLBACK.slice();
      }
      updateModsIndexStatus();

      try {
        await fetchModsIndex();
      } catch (error) {
        MODS_INDEX_STATE.error = error;
        updateModsIndexStatus();
      }
      return MOD_REGISTRY;
    }
