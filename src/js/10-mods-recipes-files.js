// ============================================================
// Моды: импорт ZIP/папки, библиотека рецептов, файлы мода
// (часть модуля mindustry-studio; оборачивается build.py)
// ============================================================

    // MOD FOLDER / FILE LIST JS

    let modFiles = [];
    let activeModFileIndex = -1;
    let modDirHandle = null;
    let modCacheDirHandle = null;

    function isModRelevantFile(name) {
      return /\.(json|hjson|json5)$/i.test(name);
    }

    async function collectFilesFromDirHandle(dirHandle, pathPrefix, out) {
      for await (const [name, handle] of dirHandle.entries()) {
        if (name.startsWith(".")) continue;
        const fullPath = pathPrefix ? pathPrefix + "/" + name : name;
        if (handle.kind === "directory") {
          await collectFilesFromDirHandle(handle, fullPath, out);
        } else if (handle.kind === "file" && isModRelevantFile(name)) {
          const file = await handle.getFile();
          const content = await file.text();
          out.push({ path: fullPath, name, content, dirty: false, handle, parentHandle: dirHandle });
        }
      }
    }

    btnLoadFolder.addEventListener("click", async () => {
      if (!window.showDirectoryPicker) {
        showToast("Ваш браузер не поддерживает выбор папки напрямую — используйте кнопку рядом ('все браузеры')");
        return;
      }
      let dirHandle = null;
      let readOnlyFallback = false;
      try {
        dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      } catch (err) {
        if (!err || err.name === "AbortError") {

          try {
            dirHandle = await window.showDirectoryPicker();
            readOnlyFallback = true;
          } catch (err2) {
            return;
          }
        } else {
          showToast("Не удалось открыть папку: " + err.message);
          return;
        }
      }

      modDirHandle = readOnlyFallback ? null : dirHandle;

      if (!readOnlyFallback) {
        try {
          modCacheDirHandle = await dirHandle.getDirectoryHandle(".mindustry-studio-cache", { create: true });
        } catch (e) {
          modCacheDirHandle = null;
        }
      } else {
        modCacheDirHandle = null;
      }

      const collected = [];
      await collectFilesFromDirHandle(dirHandle, "", collected);
      modFiles = collected;
      activeModFileIndex = -1;
      modFolderName.textContent = "📁 " + dirHandle.name + (modCacheDirHandle ? " (кэш подключён)" : (readOnlyFallback ? " (только чтение — папка защищена браузером)" : ""));
      modFolderName.style.display = "block";
      renderFileList();
      if (modFiles.length > 0) {
        openModFile(0);
      }
      if (readOnlyFallback) {
        showToast(`Папка "${dirHandle.name}" открыта только для чтения: браузер не даёт запись в системные/защищённые папки (Рабочий стол, Документы, Загрузки, корень диска). Перенесите папку мода в обычное место, чтобы сохранять на диск — пока доступно «Скачать .json»`);
      } else {
        showToast(`Папка "${dirHandle.name}" загружена: файлов — ${modFiles.length}`);
      }
    });

    btnLoadFolderLegacy.addEventListener("click", () => {
      folderUploadInputLegacy.click();
    });

    folderUploadInputLegacy.addEventListener("change", (e) => {
      const files = Array.from(e.target.files || []).filter(f => isModRelevantFile(f.name));
      if (!files.length) {
        showToast("В выбранной папке не найдено .json файлов");
        return;
      }
      modDirHandle = null;
      modCacheDirHandle = null;
      let rootName = "папка мода";
      const firstPath = files[0].webkitRelativePath || files[0].name;
      if (firstPath.includes("/")) rootName = firstPath.split("/")[0];

      let loadedCount = 0;
      modFiles = [];
      files.forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          modFiles.push({
            path: file.webkitRelativePath || file.name,
            name: file.name,
            content: evt.target.result,
            dirty: false,
            handle: null
          });
          loadedCount++;
          if (loadedCount === files.length) {
            modFiles.sort((a, b) => a.path.localeCompare(b.path));
            activeModFileIndex = -1;
            modFolderName.textContent = "📁 " + rootName + " (без доступа к диску — только скачивание)";
            modFolderName.style.display = "block";
            renderFileList();
            if (modFiles.length > 0) openModFile(0);
            showToast(`Папка "${rootName}" загружена: файлов — ${modFiles.length}`);
          }
        };
        reader.readAsText(file, "UTF-8");
      });
      folderUploadInputLegacy.value = "";
    });

    // RECIPES LIBRARY

    let recipeFiles = [];
    let recipeDirHandle = null;

    async function collectRecipes(dirHandle, pathPrefix, out) {
      for await (const [name, handle] of dirHandle.entries()) {
        if (name.startsWith(".")) continue;
        const fullPath = pathPrefix ? pathPrefix + "/" + name : name;
        if (handle.kind === "directory") {
          await collectRecipes(handle, fullPath, out);
        } else if (handle.kind === "file" && name.toLowerCase().endsWith(".json")) {
          const file = await handle.getFile();
          const content = await file.text();
          let meta = null;
          try {
            const parsed = tryParseJson(content);
            meta = parsed._meta || null;
          } catch (e) {
            meta = null;
          }
          out.push({
            path: fullPath,
            name: name.replace(/\.json$/i, ""),
            content,
            meta: meta || { name: fullPath, description: "(нет описания)", tags: [], kind: "whole", target: null },
            handle
          });
        }
      }
    }

    btnLoadRecipes.addEventListener("click", async () => {
      if (!window.showDirectoryPicker) {
        showToast("Прямой доступ к диску не поддерживается — используйте «Загрузить папку (все браузеры)» рядом");
        return;
      }
      let dirHandle = null;
      let readOnlyFallback = false;
      try {
        dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      } catch (err) {
        if (!err || err.name === "AbortError") {

          try {
            dirHandle = await window.showDirectoryPicker();
            readOnlyFallback = true;
          } catch (err2) {
            return;
          }
        } else if (err.name === "SecurityError" || err.name === "NotAllowedError") {
          showToast("Браузер заблокировал доступ к диску (в Brave: brave://flags/#file-system-access-api) — используйте «Загрузить папку (все браузеры)»");
          return;
        } else {
          showToast("Не удалось открыть папку: " + err.message);
          return;
        }
      }

      recipeDirHandle = readOnlyFallback ? null : dirHandle;
      const collected = [];
      await collectRecipes(dirHandle, "", collected);
      recipeFiles = collected;
      recipesFolderName.textContent = "📁 " + dirHandle.name + (readOnlyFallback ? " (только чтение — папка защищена браузером, сохранение недоступно)" : "");
      recipesFolderName.style.display = "block";
      recipesSearchInput.value = "";
      renderRecipes("");
      if (readOnlyFallback) {
        showToast(`Библиотека "${dirHandle.name}" открыта только для чтения: браузер не даёт запись в системные/защищённые папки. Перенесите папку рецептов в обычное место, чтобы сохранять новые рецепты`);
      } else {
        showToast(`Библиотека "${dirHandle.name}" загружена: рецептов — ${recipeFiles.length}`);
      }
    });

    btnLoadRecipesLegacy.addEventListener("click", () => {
      recipesUploadInputLegacy.click();
    });

    recipesUploadInputLegacy.addEventListener("change", (e) => {
      const files = Array.from(e.target.files || []).filter(f => /\.json$/i.test(f.name));
      if (!files.length) {
        showToast("В выбранной папке не найдено .json файлов");
        return;
      }
      recipeDirHandle = null;
      let rootName = "папка рецептов";
      const firstPath = files[0].webkitRelativePath || files[0].name;
      if (firstPath.includes("/")) rootName = firstPath.split("/")[0];

      let loadedCount = 0;
      const collected = [];
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const content = evt.target.result;
          let meta = null;
          try {
            const parsed = JSON.parse(content);
            meta = parsed._meta || null;
          } catch (err) {
            meta = null;
          }
          collected.push({
            path: file.webkitRelativePath || file.name,
            name: file.name.replace(/\.json$/i, ""),
            content,
            meta: meta || { name: file.name.replace(/\.json$/i, ""), description: "(нет описания)", tags: [], kind: "whole", target: null },
            handle: null
          });
          loadedCount++;
          if (loadedCount === files.length) {
            collected.sort((a, b) => a.path.localeCompare(b.path));
            recipeFiles = collected;
            recipesFolderName.textContent = "📁 " + rootName + " (без доступа к диску — сохранение рецептов недоступно)";
            recipesFolderName.style.display = "block";
            recipesSearchInput.value = "";
            renderRecipes("");
            showToast(`Библиотека "${rootName}" загружена: рецептов — ${recipeFiles.length}`);
          }
        };
        reader.readAsText(file, "UTF-8");
      });
      recipesUploadInputLegacy.value = "";
    });

    // RECIPES SOURCE

    const RECIPES_SOURCE_REPO = "KUKICorig/-";
    const RECIPES_SOURCE_REF = "main";
    const RECIPES_CACHE_KEY = "mindustryStudio.recipesCache.v1";
    const RECIPES_CACHE_TTL = 2 * 60 * 60 * 1000;

    let RECIPES_STATE = { loaded: false, fromCache: false, updatedAt: 0, error: null };

    function readRecipesCache() {
      try {
        const cached = JSON.parse(localStorage.getItem(RECIPES_CACHE_KEY) || "null");
        return cached && Array.isArray(cached.recipes) ? cached : null;
      } catch (_) {
        return null;
      }
    }

    function writeRecipesCache(recipes) {
      try {
        localStorage.setItem(RECIPES_CACHE_KEY, JSON.stringify({
          savedAt: Date.now(),
          recipes
        }));
      } catch (_) {}
    }

    function updateRecipesStatus() {
      if (RECIPES_STATE.error) {
        recipesFolderName.textContent = RECIPES_STATE.loaded
          ? "🟡 GitHub недоступен — используется кэш"
          : "🔴 Не удалось загрузить библиотеку рецептов";
        recipesFolderName.style.display = "block";
        return;
      }
      if (!RECIPES_STATE.loaded) {
        recipesFolderName.textContent = "⏳ Загрузка библиотеки рецептов…";
        recipesFolderName.style.display = "block";
        return;
      }
      recipesFolderName.textContent =
        `🟢 ${recipeFiles.length} рецептов · ` +
        (RECIPES_STATE.fromCache ? "кэш" : "GitHub") +
        (RECIPES_STATE.updatedAt ? " · " + new Date(RECIPES_STATE.updatedAt).toLocaleString() : "");
      recipesFolderName.style.display = "block";
    }

    async function loadRecipesFromGithub(repo, branch, path) {
      const treeUrl = `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
      const treeResp = await fetch(treeUrl);
      if (!treeResp.ok) {
        if (treeResp.status === 404) throw new Error("Репозиторий или ветка не найдены");
        if (treeResp.status === 403) throw new Error("GitHub API временно недоступен (лимит запросов) — попробуйте чуть позже");
        throw new Error("GitHub API вернул ошибку " + treeResp.status);
      }
      const data = await treeResp.json();
      const normPath = path ? path.replace(/^\/+|\/+$/g, "") + "/" : "";
      const jsonEntries = (data.tree || []).filter(item =>
        item.type === "blob" &&
        item.path.toLowerCase().endsWith(".json") &&
        (normPath === "" || item.path.indexOf(normPath) === 0) &&
        !item.path.split("/").some(seg => seg.startsWith("."))
      );
      if (!jsonEntries.length) throw new Error("В репозитории не найдено .json файлов по указанному пути");

      const collected = [];
      for (const entry of jsonEntries) {
        const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${entry.path}`;
        const fileResp = await fetch(rawUrl);
        if (!fileResp.ok) continue;
        const content = await fileResp.text();
        const relPath = normPath ? entry.path.slice(normPath.length) : entry.path;
        let meta = null;
        try {
          const parsed = tryParseJson(content);
          meta = parsed._meta || null;
        } catch (e) {
          meta = null;
        }
        collected.push({
          path: relPath,
          name: relPath.replace(/\.json$/i, "").split("/").pop(),
          content,
          meta: meta || { name: relPath, description: "(нет описания)", tags: [], kind: "whole", target: null },
          handle: null
        });
      }
      collected.sort((a, b) => a.path.localeCompare(b.path));
      return collected;
    }

    function makeRecipeEntry(relPath, content) {
      let meta = null;
      try { meta = tryParseJson(content)._meta || null; } catch (e) { meta = null; }
      return {
        path: relPath,
        name: relPath.replace(/\.json$/i, "").split("/").pop(),
        content,
        meta: meta || { name: relPath, description: "(нет описания)", tags: [], kind: "whole", target: null },
        handle: null
      };
    }

    async function readZipJsonEntries(buf) {
      const dv = new DataView(buf);
      const u8 = new Uint8Array(buf);
      let eocd = -1;
      for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
        if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      }
      if (eocd < 0) throw new Error("Файл релиза не похож на ZIP-архив");
      const count = dv.getUint16(eocd + 10, true);
      let p = dv.getUint32(eocd + 16, true);
      const dec = new TextDecoder("utf-8");
      const out = [];
      for (let n = 0; n < count; n++) {
        if (dv.getUint32(p, true) !== 0x02014b50) break;
        const method = dv.getUint16(p + 10, true);
        const csize = dv.getUint32(p + 20, true);
        const nameLen = dv.getUint16(p + 28, true);
        const extraLen = dv.getUint16(p + 30, true);
        const commentLen = dv.getUint16(p + 32, true);
        const localOff = dv.getUint32(p + 42, true);
        const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
        p += 46 + nameLen + extraLen + commentLen;
        if (name.endsWith("/") || !name.toLowerCase().endsWith(".json")) continue;
        if (/(^|\/)manifest\.json$/i.test(name)) continue;
        if (name.split("/").some(seg => seg.startsWith(".") || seg === "__MACOSX")) continue;
        const dataStart = localOff + 30 + dv.getUint16(localOff + 26, true) + dv.getUint16(localOff + 28, true);
        const raw = u8.subarray(dataStart, dataStart + csize);
        let bytes;
        if (method === 0) {
          bytes = raw;
        } else if (method === 8) {
          if (typeof DecompressionStream === "undefined") throw new Error("Браузер не умеет распаковывать ZIP — обновите его");
          const ds = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
          bytes = new Uint8Array(await new Response(ds).arrayBuffer());
        } else {
          continue;
        }
        out.push({ path: name, content: dec.decode(bytes) });
      }

      if (out.length && out.every(e => e.path.includes("/"))) {
        const top = out[0].path.split("/")[0] + "/";
        if (out.every(e => e.path.indexOf(top) === 0)) out.forEach(e => { e.path = e.path.slice(top.length); });
      }
      return out;
    }

    async function fetchReleaseAsset(asset) {
      try {
        const r = await fetch(asset.url, { headers: { Accept: "application/octet-stream" } });
        if (r.ok) return r;
      } catch (e) {}
      const r2 = await fetch(asset.browser_download_url);
      if (!r2.ok) throw new Error("Не удалось скачать файл релиза " + asset.name);
      return r2;
    }

    // MODS TAB LOGIC
    let currentMod = null;
    let currentModFiles = null;
    let currentSubModName = null;

    function renderMods(filter = "") {
      const q = (filter || "").toLowerCase().trim();
      modsResults.innerHTML = "";
      const list = MOD_REGISTRY.filter(m =>
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.author.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.repo.toLowerCase().includes(q) ||
        String(m.internalName || "").toLowerCase().includes(q) ||
        String(m.version || "").toLowerCase().includes(q) ||
        String(m.minGameVersion || "").toLowerCase().includes(q) ||
        (m.tags || []).join(" ").toLowerCase().includes(q)
      );
      if (!list.length) {
        modsResults.innerHTML = '<div style="padding: 16px; color: var(--text-muted); font-size: 12px;">Ничего не найдено.</div>';
        return;
      }
      list.forEach(m => {
        const div = document.createElement("div");
        div.className = "db-item";
        div.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="db-item-key">${m.name}${m.type === "compilation" ? ' <span style="font-size:10px; color: var(--text-muted);">(сборник)</span>' : ""}</span>
            <span style="font-size: 10px; color: var(--accent-purple); font-family: var(--font-mono);">${m.author}</span>
          </div>
          <div class="db-item-desc">${m.description}</div>
          <div style="font-size:10px; color:var(--text-muted); margin-top:4px; display:flex; gap:8px; flex-wrap:wrap;">
            ${m.version ? `<span>v${m.version}</span>` : ""}
            ${m.minGameVersion ? `<span>от ${m.minGameVersion}</span>` : ""}
            ${m.stars ? `<span>★ ${m.stars}</span>` : ""}
            ${m.hasJava ? `<span>☕ Java</span>` : ""}
            ${m.hasScripts ? `<span>JS</span>` : ""}
          </div>
          <div style="font-size:9px; color:var(--text-muted); margin-top:2px; font-family:var(--font-mono);">${m.repo}</div>
          ${(m.tags || []).length ? `<div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">${(m.tags || []).map(t => "#" + t).join(" ")}</div>` : ""}
        `;
        div.addEventListener("click", () => openModDetail(m));
        modsResults.appendChild(div);
      });
    }

    function openModDetail(mod) {
      currentMod = mod;
      currentModFiles = null;
      currentSubModName = null;
      modDetailName.textContent = mod.name;
      modDetailDesc.textContent =
        mod.description + " — " + mod.repo +
        (mod.version ? " · v" + mod.version : "") +
        (mod.minGameVersion ? " · Mindustry " + mod.minGameVersion + "+" : "");
      modDetailCard.style.display = "";
      modDetailCard.scrollIntoView({ behavior: "smooth", block: "nearest" });

      if (mod.type === "compilation") {

        btnModLoad.style.display = "none";
        btnModDownloadZip.style.display = "none";
        modFilesTree.innerHTML = '<div style="font-size: 11px; color: var(--text-muted); padding: 4px 0;">Ищу .zip с модами в репозитории...</div>';
        listCompilationZips(mod)
          .then(zips => renderCompilationList(mod, zips))
          .catch(e => {
            modFilesTree.innerHTML = '<div style="font-size: 11px; color: var(--text-muted); padding: 4px 0;">Ошибка: ' + e.message + '</div>';
          });
      } else {
        btnModLoad.style.display = "";
        btnModDownloadZip.style.display = "";
        modFilesTree.innerHTML = '<div style="font-size: 11px; color: var(--text-muted); padding: 4px 0;">Нажмите «Загрузить в студию», чтобы увидеть файлы.</div>';
      }
    }

    btnModCloseDetail.addEventListener("click", () => {
      modDetailCard.style.display = "none";
      currentMod = null;
      currentModFiles = null;
      currentSubModName = null;
    });

    const GITHUB_DEFAULT_BRANCH_CACHE = new Map();

    async function resolveGithubRef(mod) {
      if (mod.ref) return mod.ref;
      if (GITHUB_DEFAULT_BRANCH_CACHE.has(mod.repo)) {
        return GITHUB_DEFAULT_BRANCH_CACHE.get(mod.repo);
      }

      const response = await fetch(`https://api.github.com/repos/${mod.repo}`, {
        headers: { "Accept": "application/vnd.github+json" }
      });
      if (!response.ok) throw new Error("Не удалось определить ветку GitHub: HTTP " + response.status);

      const info = await response.json();
      const ref = info.default_branch || "main";
      GITHUB_DEFAULT_BRANCH_CACHE.set(mod.repo, ref);
      mod.ref = ref;
      return ref;
    }

    async function listCompilationZips(mod) {
      const ref = await resolveGithubRef(mod);
      const treeUrl = `https://api.github.com/repos/${mod.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
      const treeResp = await fetch(treeUrl);
      if (!treeResp.ok) {
        if (treeResp.status === 404) throw new Error("Репозиторий или ветка не найдены");
        if (treeResp.status === 403) throw new Error("GitHub API временно недоступен (лимит запросов) — попробуйте чуть позже");
        throw new Error("GitHub API вернул ошибку " + treeResp.status);
      }
      const data = await treeResp.json();
      const normPath = mod.path ? mod.path.replace(/^\/+|\/+$/g, "") + "/" : "";
      const zips = (data.tree || []).filter(item =>
        item.type === "blob" &&
        item.path.toLowerCase().endsWith(".zip") &&
        (normPath === "" || item.path.indexOf(normPath) === 0) &&
        !item.path.split("/").some(seg => seg.startsWith("."))
      );
      if (!zips.length) throw new Error("В репозитории не найдено .zip файлов");
      return zips
        .map(item => {
          const rel = normPath ? item.path.slice(normPath.length) : item.path;
          return { fullPath: item.path, relPath: rel, name: rel.replace(/\.zip$/i, ""), size: item.size || 0 };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    function renderCompilationList(mod, zips) {
      modFilesTree.innerHTML = "";
      const title = document.createElement("div");
      title.className = "fields-type-title";
      title.style.margin = "6px 0";
      title.innerHTML = `<span>Моды в архиве</span><span>${zips.length}</span>`;
      modFilesTree.appendChild(title);
      zips.forEach(z => {
        const row = document.createElement("div");
        row.className = "db-item";
        const sizeKb = Math.max(1, Math.round((z.size || 0) / 1024));
        row.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="db-item-key" style="font-size: 11px;">${z.name}</span>
            <span style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">${sizeKb} КБ</span>
          </div>
          <div style="display:flex; gap:6px; margin-top:4px;">
            <button class="btn btn-mind" style="padding:2px 8px; font-size:10px;" data-act="load">📥 Загрузить</button>
            <button class="btn" style="padding:2px 8px; font-size:10px;" data-act="dl">💾 Скачать .zip</button>
          </div>
        `;
        row.querySelector('[data-act="load"]').addEventListener("click", () => loadCompilationModIntoStudio(mod, z));
        row.querySelector('[data-act="dl"]').addEventListener("click", () => downloadCompilationZipRaw(mod, z));
        modFilesTree.appendChild(row);
      });
    }

    async function loadCompilationModIntoStudio(mod, z) {
      showToast("Загрузка «" + z.name + "»...");
      try {
        const ref = await resolveGithubRef(mod);
        const rawUrl = `https://raw.githubusercontent.com/${mod.repo}/${ref}/${z.fullPath}`;
        const r = await fetch(rawUrl);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const entries = await readZipAllEntries(await r.arrayBuffer());
        if (!entries.length) throw new Error("Архив пуст");
        currentModFiles = entries;
        currentSubModName = z.name;
        modFiles = entries
          .filter(f => !f.isBinary)
          .map(f => ({ path: f.path, name: f.path.split("/").pop(), content: f.content, dirty: false, handle: null }));
        modDirHandle = null;
        modCacheDirHandle = null;
        modFolderName.textContent = "🌐 " + z.name + " (из сборника, только чтение)";
        modFolderName.style.display = "block";
        renderFileList();
        if (modFiles.length) openModFile(0);
        showToast(`Загружено файлов: ${entries.length}`);
      } catch (e) {
        showToast("Ошибка загрузки «" + z.name + "»: " + e.message);
      }
    }

    async function downloadCompilationZipRaw(mod, z) {
      try {
        const ref = await resolveGithubRef(mod);
        const rawUrl = `https://raw.githubusercontent.com/${mod.repo}/${ref}/${z.fullPath}`;
        const r = await fetch(rawUrl);
        if (!r.ok) throw new Error("HTTP " + r.status);
        const blob = await r.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = z.name + ".zip";
        a.click();
        URL.revokeObjectURL(a.href);
        showToast("Скачан " + a.download);
      } catch (e) {
        showToast("Не удалось скачать «" + z.name + "»: " + e.message);
      }
    }

    async function readZipAllEntries(buf) {
      const dv = new DataView(buf);
      const u8 = new Uint8Array(buf);
      let eocd = -1;
      for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
        if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
      }
      if (eocd < 0) throw new Error("Файл не похож на ZIP-архив");
      const count = dv.getUint16(eocd + 10, true);
      let p = dv.getUint32(eocd + 16, true);
      const dec = new TextDecoder("utf-8");
      const out = [];
      for (let n = 0; n < count; n++) {
        if (dv.getUint32(p, true) !== 0x02014b50) break;
        const method = dv.getUint16(p + 10, true);
        const csize = dv.getUint32(p + 20, true);
        const nameLen = dv.getUint16(p + 28, true);
        const extraLen = dv.getUint16(p + 30, true);
        const commentLen = dv.getUint16(p + 32, true);
        const localOff = dv.getUint32(p + 42, true);
        const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
        p += 46 + nameLen + extraLen + commentLen;
        if (name.endsWith("/")) continue;
        if (name.split("/").some(seg => seg.startsWith(".") || seg === "__MACOSX")) continue;
        const dataStart = localOff + 30 + dv.getUint16(localOff + 26, true) + dv.getUint16(localOff + 28, true);
        const raw = u8.subarray(dataStart, dataStart + csize);
        let bytes;
        if (method === 0) {
          bytes = raw;
        } else if (method === 8) {
          if (typeof DecompressionStream === "undefined") throw new Error("Браузер не поддерживает распаковку ZIP (нет DecompressionStream) — обновите браузер");
          const ds = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
          bytes = new Uint8Array(await new Response(ds).arrayBuffer());
        } else {
          continue;
        }
        const isBinary = /\.(png|jpg|jpeg|gif|ogg|mp3|wav|ttf|otf|zip|jar)$/i.test(name);
        out.push({
          path: name,
          isBinary,
          content: isBinary ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : dec.decode(bytes)
        });
      }

      if (out.length && out.every(e => e.path.includes("/"))) {
        const top = out[0].path.split("/")[0] + "/";
        if (out.every(e => e.path.indexOf(top) === 0)) out.forEach(e => { e.path = e.path.slice(top.length); });
      }
      return out;
    }

    async function loadModFromGithub(mod) {
      const ref = await resolveGithubRef(mod);
      const treeUrl = `https://api.github.com/repos/${mod.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
      const treeResp = await fetch(treeUrl);
      if (!treeResp.ok) {
        if (treeResp.status === 404) throw new Error("Репозиторий или ветка не найдены");
        if (treeResp.status === 403) throw new Error("GitHub API временно недоступен (лимит запросов) — попробуйте чуть позже");
        throw new Error("GitHub API вернул ошибку " + treeResp.status);
      }
      const data = await treeResp.json();
      const normPath = mod.path ? mod.path.replace(/^\/+|\/+$/g, "") + "/" : "";
      const entries = (data.tree || []).filter(item =>
        item.type === "blob" &&
        (normPath === "" || item.path.indexOf(normPath) === 0) &&
        !item.path.split("/").some(seg => seg.startsWith("."))
      );
      if (!entries.length) throw new Error("В репозитории нет файлов по указанному пути");

      const files = [];
      for (const entry of entries) {
        const rawUrl = `https://raw.githubusercontent.com/${mod.repo}/${ref}/${entry.path}`;
        const r = await fetch(rawUrl);
        if (!r.ok) continue;
        const relPath = normPath ? entry.path.slice(normPath.length) : entry.path;
        const isBinary = /\.(png|jpg|jpeg|gif|ogg|mp3|wav|ttf|otf|zip|jar)$/i.test(relPath);
        if (isBinary) {
          files.push({ path: relPath, content: await r.arrayBuffer(), isBinary: true });
        } else {
          files.push({ path: relPath, content: await r.text(), isBinary: false });
        }
      }
      files.sort((a, b) => a.path.localeCompare(b.path));
      return files;
    }

    function renderModFilesTree(files) {
      const groups = {};
      files.forEach(f => {
        const group = f.path.includes("/") ? f.path.split("/").slice(0, -1).join("/") : "/";
        if (!groups[group]) groups[group] = [];
        groups[group].push(f);
      });
      const names = Object.keys(groups).sort();
      modFilesTree.innerHTML = "";
      names.forEach(g => {
        const title = document.createElement("div");
        title.className = "fields-type-title";
        title.style.margin = "6px 0";
        title.innerHTML = `<span>${g}</span><span>${groups[g].length}</span>`;
        modFilesTree.appendChild(title);
        groups[g].forEach(f => {
          const row = document.createElement("div");
          row.className = "db-item";
          row.style.padding = "4px 8px";
          row.innerHTML = `<span class="db-item-key" style="font-size: 11px;">${f.path.split("/").pop()}</span>${f.isBinary ? '<span style="font-size: 10px; color: var(--text-muted); margin-left: 6px;">(бинарь)</span>' : ""}`;
          modFilesTree.appendChild(row);
        });
      });
    }

    btnModLoad.addEventListener("click", async () => {
      if (!currentMod || currentMod.type === "compilation") return;
      btnModLoad.disabled = true;
      btnModLoad.textContent = "⏳ Загрузка...";
      try {
        currentModFiles = await loadModFromGithub(currentMod);
        renderModFilesTree(currentModFiles);

        modFiles = currentModFiles
          .filter(f => !f.isBinary)
          .map(f => ({ path: f.path, name: f.path.split("/").pop(), content: f.content, dirty: false, handle: null }));
        modDirHandle = null;
        modCacheDirHandle = null;
        modFolderName.textContent = "🌐 " + currentMod.name + " (загружено с GitHub, только чтение)";
        modFolderName.style.display = "block";
        renderFileList();
        if (modFiles.length) openModFile(0);
        showToast(`Загружено файлов: ${currentModFiles.length}`);
      } catch (e) {
        showToast("Ошибка загрузки мода: " + e.message);
      } finally {
        btnModLoad.disabled = false;
        btnModLoad.textContent = "📥 Загрузить в студию";
      }
    });

    btnModCopyLink.addEventListener("click", async () => {
      if (!currentMod) return;
      const url = `https://github.com/${currentMod.repo}`;
      try {
        await navigator.clipboard.writeText(url);
        showToast("Ссылка на репозиторий скопирована");
      } catch (_) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    });

    btnModDownloadZip.addEventListener("click", async () => {
      if (!currentMod || currentMod.type === "compilation") return;
      if (!currentModFiles) {
        showToast("Сначала нажмите «Загрузить в студию»");
        return;
      }
      if (typeof JSZip === "undefined") {
        showToast("Библиотека JSZip не загрузилась — проверьте подключение к интернету");
        return;
      }
      btnModDownloadZip.disabled = true;
      try {
        const zip = new JSZip();
        currentModFiles.forEach(f => {
          zip.file(f.path, f.content, f.isBinary ? { binary: true } : {});
        });
        const blob = await zip.generateAsync({ type: "blob" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = currentMod.id + ".zip";
        a.click();
        URL.revokeObjectURL(a.href);
        showToast("Скачан " + a.download);
      } catch (e) {
        showToast("Не удалось собрать .zip: " + e.message);
      } finally {
        btnModDownloadZip.disabled = false;
      }
    });

    btnModCopyLink.addEventListener("click", () => {
      if (!currentMod) return;
      const url = `https://github.com/${currentMod.repo}`;
      navigator.clipboard.writeText(url).then(() => {
        showToast("Ссылка скопирована: " + url);
      }).catch(() => {
        showToast("Не удалось скопировать — вот ссылка: " + url);
      });
    });

    async function loadRecipesFromRelease(repo, tag, path) {
      const resp = await fetch(`https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`);
      if (!resp.ok) throw new Error("Релиз не найден (" + resp.status + ")");
      const rel = await resp.json();
      const normPath = path ? path.replace(/^\/+|\/+$/g, "") + "/" : "";
      const collected = [];
      for (const asset of (rel.assets || [])) {
        const lower = asset.name.toLowerCase();
        if (lower.endsWith(".json")) {
          const content = await (await fetchReleaseAsset(asset)).text();
          collected.push(makeRecipeEntry(asset.name, content));
        } else if (lower.endsWith(".zip")) {
          const buf = await (await fetchReleaseAsset(asset)).arrayBuffer();
          for (const e of await readZipJsonEntries(buf)) {
            if (normPath && e.path.indexOf(normPath) !== 0) continue;
            collected.push(makeRecipeEntry(normPath ? e.path.slice(normPath.length) : e.path, e.content));
          }
        }
      }
      if (!collected.length) throw new Error("В файлах релиза нет рецептов (.json или .zip)");
      collected.sort((a, b) => a.path.localeCompare(b.path));
      return collected;
    }

    async function loadRecipesFromRepoZip(repo, ref, path) {
      const names = ["recipes.zip", "рецепты.zip"];
      let lastErr = null;
      for (const nm of names) {
        try {
          const r = await fetch(`https://raw.githubusercontent.com/${repo}/${encodeURIComponent(ref)}/${encodeURIComponent(nm)}`);
          if (!r.ok) { lastErr = new Error(nm + ": " + r.status); continue; }
          const entries = await readZipJsonEntries(await r.arrayBuffer());
          const normPath = path ? path.replace(/^\/+|\/+$/g, "") + "/" : "";
          const list = entries
            .filter(e => !normPath || e.path.indexOf(normPath) === 0)
            .map(e => makeRecipeEntry(normPath ? e.path.slice(normPath.length) : e.path, e.content));
          if (!list.length) { lastErr = new Error(nm + ": нет рецептов"); continue; }
          list.sort((x, y) => x.path.localeCompare(y.path));
          return list;
        } catch (e) { lastErr = e; }
      }
      throw new Error("ZIP в репозитории не найден (" + (lastErr ? lastErr.message : "?") + ")");
    }

    async function loadRecipesSmart(repo, ref, path) {
      const errs = [];
      const clean = list => list.filter(r => !/(^|\/)manifest\.json$/i.test(r.path));
      try { return clean(await loadRecipesFromRepoZip(repo, ref, path)); } catch (e) { errs.push(e.message); }
      try { return clean(await loadRecipesFromGithub(repo, ref, path)); } catch (e) { errs.push(e.message); }
      try { return clean(await loadRecipesFromRelease(repo, ref, path)); } catch (e) { errs.push("релиз: " + e.message); }
      throw new Error(errs[0] + " | " + errs.slice(1).join(" | "));
    }

    async function fetchRecipesFromSource() {
      const collected = await loadRecipesSmart(RECIPES_SOURCE_REPO, RECIPES_SOURCE_REF, "");
      recipeFiles = collected;
      recipeDirHandle = null;
      writeRecipesCache(collected);
      RECIPES_STATE = { loaded: true, fromCache: false, updatedAt: Date.now(), error: null };
      updateRecipesStatus();
      renderRecipes(recipesSearchInput.value);
      return collected;
    }

    async function loadRecipesAuto(forceRefresh = false) {
      if (!forceRefresh && RECIPES_STATE.loaded) return recipeFiles;

      const cached = readRecipesCache();
      const cacheAge = cached ? Date.now() - Number(cached.savedAt || 0) : Infinity;
      const hasCache = cached && Array.isArray(cached.recipes);

      if (hasCache && !forceRefresh) {
        recipeFiles = cached.recipes;
        recipeDirHandle = null;
        RECIPES_STATE = {
          loaded: true,
          fromCache: true,
          updatedAt: Number(cached.savedAt || 0),
          error: null
        };
        updateRecipesStatus();
        renderRecipes(recipesSearchInput.value);

        if (cacheAge >= RECIPES_CACHE_TTL) {
          fetchRecipesFromSource().catch(error => {
            RECIPES_STATE.error = error;
            updateRecipesStatus();
          });
        }
        return recipeFiles;
      }

      if (hasCache) {
        recipeFiles = cached.recipes;
        recipeDirHandle = null;
      }
      updateRecipesStatus();

      try {
        await fetchRecipesFromSource();
      } catch (error) {
        RECIPES_STATE.error = error;
        updateRecipesStatus();
      }
      return recipeFiles;
    }

    loadRecipesAuto();

    function renderRecipes(filter = "") {
      recipesResults.innerHTML = "";
      const q = filter.toLowerCase().trim();

      if (!recipeFiles.length) {
        recipesResults.innerHTML = `<div class="file-empty-hint">
          Папка с рецептами ещё не загружена. Нажмите «Загрузить папку рецептов», чтобы открыть библиотеку
          JSON-заготовок (units/, blocks/, weapons/, bullets/, abilities/, status/) — файлы читаются локально,
          никуда не отправляются.
        </div>`;
        return;
      }

      const groups = {};
      recipeFiles.forEach(r => {
        const meta = r.meta;
        const haystack = (meta.name + " " + meta.description + " " + (meta.tags || []).join(" ")).toLowerCase();
        if (q && !haystack.includes(q)) return;
        const group = r.path.includes("/") ? r.path.split("/")[0] : "root";
        if (!groups[group]) groups[group] = [];
        groups[group].push(r);
      });

      const groupNames = Object.keys(groups).sort();
      if (groupNames.length === 0) {
        recipesResults.innerHTML = '<div style="padding: 16px; color: var(--text-muted); font-size: 12px;">Ничего не найдено по вашему запросу.</div>';
        return;
      }

      groupNames.forEach(groupName => {
        const groupTitle = document.createElement("div");
        groupTitle.className = "fields-type-title";
        groupTitle.style.margin = "6px 10px";
        groupTitle.innerHTML = `<span>${groupName}/</span><span>${groups[groupName].length}</span>`;
        recipesResults.appendChild(groupTitle);

        groups[groupName].forEach(r => {
          const meta = r.meta;
          const div = document.createElement("div");
          div.className = "db-item";
          const tagsHtml = (meta.tags || []).map(t => `#${t}`).join(" ");
          div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="db-item-key">${meta.name}</span>
              <span style="font-size: 10px; color: var(--accent-purple); font-family: var(--font-mono);">${meta.kind === "fragment" ? "фрагмент → " + (meta.target || "?") : "целиком"}</span>
            </div>
            <div class="db-item-desc">${meta.description}</div>
            ${tagsHtml ? `<div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">${tagsHtml}</div>` : ""}
            <button class="btn btn-insert" style="padding: 2px 8px; font-size: 10px; align-self: flex-start; margin-top: 4px;">
              ${meta.kind === "fragment" ? "Вставить фрагмент" : "Вставить целиком"}
            </button>
          `;
          div.querySelector(".btn-insert").addEventListener("click", () => {
            if (meta.kind === "fragment") {
              insertRecipeFragment(r);
            } else {
              insertRecipeWhole(r);
            }
          });
          recipesResults.appendChild(div);
        });
      });
    }

    function insertRecipeWhole(recipe) {
      let obj;
      try {
        obj = tryParseJson(recipe.content);
      } catch (e) {
        showToast("Рецепт содержит невалидный JSON: " + e.message);
        return;
      }
      delete obj._meta;
      editor.value = JSON.stringify(obj, null, 2);
      fileNameDisplay.textContent = recipe.name + ".json";
      updateEditorLines();
      validateAndAnalyze();
      schedulePersist();
      showToast(`Загружен рецепт: ${recipe.meta.name}`);
    }

    function findJsonKeyRange(text, key) {
      const re = new RegExp('"' + key + '"\\s*:\\s*([\\[{])');
      const m = re.exec(text);
      if (!m) return null;
      const openChar = m[1];
      const closeChar = openChar === "[" ? "]" : "}";
      const openIdx = m.index + m[0].length - 1;
      let depth = 0;
      for (let i = openIdx; i < text.length; i++) {
        if (text[i] === openChar) depth++;
        else if (text[i] === closeChar) {
          depth--;
          if (depth === 0) return { openIdx, closeIdx: i };
        }
      }
      return null;
    }

    function indentLines(str, spaces) {
      const pad = " ".repeat(spaces);
      return str.split("\n").map((l, i) => (i === 0 ? l : pad + l)).join("\n");
    }

    function insertRecipeFragment(recipe) {
      let frag;
      try {
        frag = tryParseJson(recipe.content);
      } catch (e) {
        showToast("Рецепт содержит невалидный JSON: " + e.message);
        return;
      }
      delete frag._meta;
      const target = recipe.meta.target || "";
      const text = editor.value;

      function insertIntoContainer(key, entryText) {
        const range = findJsonKeyRange(text, key);
        if (!range) {
          showToast(`Не найден ключ "${key}" в текущем коде — сначала добавьте его вручную (пустой [] или {})`);
          return false;
        }
        const inner = text.slice(range.openIdx + 1, range.closeIdx);
        const isEmpty = inner.trim() === "";
        const insertion = (isEmpty ? "\n  " : ",\n  ") + indentLines(entryText, 2) + "\n";
        editor.value = text.slice(0, range.closeIdx) + insertion + text.slice(range.closeIdx);
        return true;
      }

      let ok = false;
      if (target === "weapons[]") {
        ok = insertIntoContainer("weapons", JSON.stringify(frag, null, 2));
      } else if (target === "abilities[]") {
        ok = insertIntoContainer("abilities", JSON.stringify(frag, null, 2));
      } else if (target === "bullet") {
        const range = findJsonKeyRange(text, "bullet");
        if (range) {

          editor.value = text.slice(0, range.openIdx) + JSON.stringify(frag, null, 2) + text.slice(range.closeIdx + 1);
          ok = true;
        } else {

          const pos = editor.selectionStart;
          editor.value = text.slice(0, pos) + `"bullet": ${JSON.stringify(frag, null, 2)},\n  ` + text.slice(pos);
          ok = true;
        }
      } else if (target === "consumes") {
        const entries = Object.keys(frag).map(k => `"${k}": ${JSON.stringify(frag[k], null, 2)}`).join(",\n  ");
        ok = insertIntoContainer("consumes", entries);
      } else if (target.indexOf("ammoTypes.") === 0) {
        const itemName = target.slice("ammoTypes.".length);
        ok = insertIntoContainer("ammoTypes", `"${itemName}": ${JSON.stringify(frag, null, 2)}`);
      } else {
        showToast(`Неизвестная цель вставки фрагмента: "${target}"`);
        return;
      }

      if (ok) {
        updateEditorLines();
        validateAndAnalyze();
        schedulePersist();
        showToast(`Фрагмент вставлен: ${recipe.meta.name}`);
      }
    }

    async function saveCurrentAsRecipe() {
      if (!recipeDirHandle) {
        showToast("Сохранение недоступно: папка загружена без доступа к диску. Загрузите её через «📂 Загрузить папку рецептов»");
        return;
      }

      try {
        const perm = await recipeDirHandle.queryPermission({ mode: "readwrite" });
        if (perm !== "granted") {
          const requested = await recipeDirHandle.requestPermission({ mode: "readwrite" });
          if (requested !== "granted") {
            showToast("Нет разрешения на запись в папку рецептов — разрешите доступ или загрузите папку заново");
            return;
          }
        }
      } catch (e) {

      }
      let obj;
      try {
        obj = tryParseJson(editor.value);
      } catch (e) {
        showToast("Текущий код — невалидный JSON, нельзя сохранить как рецепт");
        return;
      }
      const name = prompt("Имя рецепта:");
      if (!name) return;
      const description = prompt("Описание:") || "";
      let kind = (prompt("Тип (whole/fragment):", "whole") || "whole").trim().toLowerCase();
      if (kind !== "fragment") kind = "whole";
      let target = null;
      if (kind === "fragment") {
        target = prompt("Куда вставлять (weapons[] / bullet / abilities[] / consumes / ammoTypes.<item>):", "weapons[]");
        if (!target) {
          showToast("Отменено: не указана цель фрагмента");
          return;
        }
      }
      const tagsInput = prompt("Теги через запятую (необязательно):", "") || "";
      const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
      const subdir = prompt("Подпапка (units/blocks/weapons/bullets/abilities/status):", kind === "fragment" ? "weapons" : "units") || "units";

      obj._meta = { name, description, tags, kind, target };

      try {
        const dir = await recipeDirHandle.getDirectoryHandle(subdir, { create: true });
        const fileName = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "") + ".json";
        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(obj, null, 2));
        await writable.close();
        showToast(`Рецепт сохранён: ${name}`);
        const collected = [];
        await collectRecipes(recipeDirHandle, "", collected);
        recipeFiles = collected;
        renderRecipes(recipesSearchInput.value);
      } catch (err) {
        showToast("Не удалось сохранить рецепт: " + err.message);
      }
    }

    btnSaveRecipe.addEventListener("click", saveCurrentAsRecipe);

    function renderFileList() {
      fileList.innerHTML = "";
      if (!modFiles.length) {
        fileList.innerHTML = `<div class="file-empty-hint">
          Папка мода ещё не загружена. Нажмите «Загрузить папку мода», чтобы открыть содержимое вашего мода
          (mod.json, content/blocks, content/units, sprites и т.д.) прямо здесь — файлы читаются локально,
          никуда не отправляются. Либо нажмите «🆕 Новый файл» и начните с чистого листа без загрузки папки.
        </div>`;
        return;
      }

      let currentGroup = null;
      modFiles.forEach((f, idx) => {
        const group = f.path.includes("/") ? f.path.substring(0, f.path.lastIndexOf("/")) : "/";
        if (group !== currentGroup) {
          currentGroup = group;
          const grp = document.createElement("div");
          grp.className = "file-group-title";
          grp.textContent = group;
          fileList.appendChild(grp);
        }
        const item = document.createElement("div");
        item.className = "file-item" + (idx === activeModFileIndex ? " active" : "") + (f.dirty ? " dirty" : "");
        item.innerHTML = `<span class="file-dirty-dot" title="Есть несохранённые изменения"></span><span class="file-item-name">${f.name}</span><button type="button" class="file-item-delete-btn" title="Удалить файл" aria-label="Удалить файл ${f.name}">✕</button>`;
        item.addEventListener("click", () => openModFile(idx));
        const delBtn = item.querySelector(".file-item-delete-btn");
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteModFile(idx);
        });
        fileList.appendChild(item);
      });
    }

    function syncEditorIntoActiveModFile() {
      if (activeModFileIndex < 0 || !modFiles[activeModFileIndex]) return;
      modFiles[activeModFileIndex].content = editor.value;
    }

    function openModFile(idx) {
      if (!modFiles[idx]) return;
      syncEditorIntoActiveModFile();
      activeModFileIndex = idx;
      const f = modFiles[idx];
      editor.value = f.content;
      fileNameDisplay.textContent = f.path;
      updateEditorLines();
      validateAndAnalyze();
      renderFileList();
    }

    async function saveActiveModFileToDisk() {
      if (activeModFileIndex < 0 || !modFiles[activeModFileIndex]) return false;
      const f = modFiles[activeModFileIndex];
      f.content = editor.value;
      if (f.handle && f.handle.createWritable) {
        try {
          const writable = await f.handle.createWritable();
          await writable.write(f.content);
          await writable.close();
          f.dirty = false;
          renderFileList();
          showToast(`Сохранено на диск: ${f.path}`);
          return true;
        } catch (err) {
          showToast("Не удалось сохранить на диск: " + err.message);
          return false;
        }
      }
      f.dirty = false;
      renderFileList();
      return false;
    }

    // MOD FILE CREATE/DELETE JS

    async function createNewModFile() {
      let rawPath = prompt("Путь и имя нового файла (например: content/blocks/new-block.json):", "new-file.json");
      if (!rawPath) return;
      rawPath = rawPath.trim().replace(/^[\/]+/, "").replace(/\\/g, "/");
      if (!rawPath || rawPath.endsWith("/")) {
        showToast("Не указано имя файла");
        return;
      }
      if (!isModRelevantFile(rawPath)) rawPath += ".json";
      if (modFiles.some(f => f.path.toLowerCase() === rawPath.toLowerCase())) {
        showToast(`Файл "${rawPath}" уже есть в списке`);
        return;
      }

      const content = "{\n  \n}\n";
      const newFile = { path: rawPath, name: rawPath.split("/").pop(), content, dirty: true, handle: null, parentHandle: null };

      if (modDirHandle) {
        try {
          try {
            const perm = await modDirHandle.queryPermission({ mode: "readwrite" });
            if (perm !== "granted") {
              const requested = await modDirHandle.requestPermission({ mode: "readwrite" });
              if (requested !== "granted") throw new Error("Нет разрешения на запись");
            }
          } catch (permErr) {
            if (permErr && permErr.message === "Нет разрешения на запись") throw permErr;

          }
          const segments = rawPath.split("/");
          const fileName = segments.pop();
          let dir = modDirHandle;
          for (const seg of segments) {
            dir = await dir.getDirectoryHandle(seg, { create: true });
          }
          const fileHandle = await dir.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(content);
          await writable.close();
          newFile.handle = fileHandle;
          newFile.parentHandle = dir;
          newFile.dirty = false;
          showToast(`Файл создан на диске: ${rawPath}`);
        } catch (err) {
          showToast("Не удалось создать файл на диске (" + err.message + ") — создан только в памяти студии");
        }
      } else {
        showToast(`Файл создан: ${rawPath} (только в памяти — доступ к диску не открыт, сохраните через «Скачать .json»)`);
      }

      modFiles.push(newFile);
      modFiles.sort((a, b) => a.path.localeCompare(b.path));
      renderFileList();
      openModFile(modFiles.indexOf(newFile));
    }

    btnNewModFile.addEventListener("click", createNewModFile);

    async function deleteModFile(idx) {
      const f = modFiles[idx];
      if (!f) return;
      if (!confirm(`Удалить файл "${f.path}"? Это действие нельзя отменить.`)) return;

      if (f.parentHandle && f.parentHandle.removeEntry) {
        try {
          try {
            const perm = await f.parentHandle.queryPermission({ mode: "readwrite" });
            if (perm !== "granted") {
              const requested = await f.parentHandle.requestPermission({ mode: "readwrite" });
              if (requested !== "granted") throw new Error("Нет разрешения на запись");
            }
          } catch (permErr) {
            if (permErr && permErr.message === "Нет разрешения на запись") throw permErr;
          }
          await f.parentHandle.removeEntry(f.name);
          showToast(`Удалено с диска: ${f.path}`);
        } catch (err) {
          showToast("Не удалось удалить с диска (" + err.message + ") — файл убран только из списка");
        }
      } else {
        showToast(`Файл убран из списка: ${f.path} (доступ к диску не открыт — на диске не менялся)`);
      }

      removeModFileFromList(idx);
    }

    function removeModFileFromList(idx) {
      modFiles.splice(idx, 1);
      if (activeModFileIndex === idx) {
        activeModFileIndex = -1;
        if (modFiles.length) {
          openModFile(Math.min(idx, modFiles.length - 1));
        } else {
          editor.value = "";
          fileNameDisplay.textContent = "Файл не выбран";
          updateEditorLines();
          validateAndAnalyze();
        }
      } else if (activeModFileIndex > idx) {
        activeModFileIndex--;
      }
      renderFileList();
    }

    editor.addEventListener("input", () => {
      if (activeModFileIndex >= 0 && modFiles[activeModFileIndex]) {
        modFiles[activeModFileIndex].content = editor.value;
        modFiles[activeModFileIndex].dirty = true;
        renderFileList();
      }
    });

    sidebarModeFiles.addEventListener("click", () => {
      sidebarModeFiles.classList.add("active");
      sidebarModeTemplates.classList.remove("active");
      sidebarFilesPane.style.display = "flex";
      sidebarTemplatesPane.style.display = "none";
    });

    sidebarModeTemplates.addEventListener("click", () => {
      sidebarModeTemplates.classList.add("active");
      sidebarModeFiles.classList.remove("active");
      sidebarTemplatesPane.style.display = "flex";
      sidebarFilesPane.style.display = "none";
    });
