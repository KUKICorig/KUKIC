// ============================================================
// Toast, кнопки, настройки, вкладки, тема, переключатель раскладки
// (часть модуля mindustry-studio; оборачивается build.py)
// ============================================================

    // TOAST
    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add("show");
      setTimeout(() => {
        toast.classList.remove("show");
      }, 2000);
    }

    // BUTTON HANDLERS
    document.getElementById("btnFormat").addEventListener("click", () => {
      try {
        const parsed = tryParseJson(editor.value);
        editor.value = JSON.stringify(parsed, null, 2);
        updateEditorLines();
        validateAndAnalyze();
        schedulePersist();
        showToast("JSON успешно выровнен!");
      } catch (err) {
        alert("Невозможно выровнять: в коде есть синтаксическая ошибка:\n" + err.message);
      }
    });

    document.getElementById("btnCollapse").addEventListener("click", () => {
      try {
        const parsed = tryParseJson(editor.value);
        let collapsed;
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
          const keys = Object.keys(parsed);
          const lines = ["{"];
          keys.forEach((k, i) => {
            const v = JSON.stringify(parsed[k]);
            lines.push("  \"" + k + "\": " + v + (i < keys.length - 1 ? "," : ""));
          });
          lines.push("}");
          collapsed = lines.join("\n");
        } else {
          collapsed = JSON.stringify(parsed);
        }
        editor.value = collapsed;
        updateEditorLines();
        validateAndAnalyze();
        schedulePersist();
        showToast("Свёрнуто");
      } catch (err) {
        alert("Невозможно свернуть: в коде есть синтаксическая ошибка:\n" + err.message);
      }
    });

    document.getElementById("btnValidate").addEventListener("click", () => {
      try {
        tryParseJson(editor.value);
        alert("Синтаксис JSON/HJSON корректен! Ошибок нет.");
      } catch (err) {
        const lineInfo = err.hjsonLine ? "\nСтрока: " + err.hjsonLine : "";
        alert("Обнаружена ошибка в JSON/HJSON:\n" + err.message + lineInfo);
      }
    });

    document.getElementById("btnCopy").addEventListener("click", () => {
      navigator.clipboard.writeText(editor.value).then(() => {
        showToast("Код скопирован в буфер обмена!");
      }).catch(() => {
        editor.select();
        document.execCommand("copy");
        showToast("Код скопирован!");
      });
    });

    document.getElementById("btnDownload").addEventListener("click", () => {
      const filename = fileNameDisplay.textContent || "mindustry-mod.json";
      const encoded = encodeURIComponent(editor.value);
      const a = document.createElement("a");
      a.setAttribute("href", "data:application/json;charset=utf-8," + encoded);
      a.setAttribute("download", filename);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Файл " + filename + " скачан!");
    });

    document.getElementById("btnHelp").addEventListener("click", () => {
      helpModal.style.display = "flex";
    });
    document.getElementById("closeModalBtn").addEventListener("click", () => {
      helpModal.style.display = "none";
    });
    document.getElementById("btnModalOk").addEventListener("click", () => {
      helpModal.style.display = "none";
    });

    // SETTINGS MODAL JS

    function openSettingsModal() {
      settingsModal.style.display = "flex";
    }
    function closeSettingsModal() {
      settingsModal.style.display = "none";
    }
    btnSettings.addEventListener("click", openSettingsModal);
    document.getElementById("closeSettingsBtn").addEventListener("click", closeSettingsModal);
    document.getElementById("closeSettingsBtn2").addEventListener("click", closeSettingsModal);
    settingsModal.addEventListener("click", (e) => {
      if (e.target === settingsModal) closeSettingsModal();
    });

    btnRefreshData.addEventListener("click", async () => {
      btnRefreshData.disabled = true;
      const originalLabel = btnRefreshData.textContent;
      btnRefreshData.textContent = "⏳ Обновление…";
      dataRefreshStatus.style.display = "block";
      dataRefreshStatus.textContent = "Обновление базы знаний и рецептов…";
      try {
        await Promise.all([
          fetchKnowledgeBase(),
          fetchRecipesFromSource()
        ]);
        refreshFieldCaches();
        refreshKbViews();
        dataRefreshStatus.textContent = "Обновлено: " + new Date().toLocaleTimeString();
        showToast("База знаний и рецепты обновлены");
      } catch (error) {
        dataRefreshStatus.textContent = "Не удалось обновить: " + error.message;
        showToast("Не удалось обновить данные: " + error.message);
      } finally {
        btnRefreshData.disabled = false;
        btnRefreshData.textContent = originalLabel;
      }
    });

    // TABS
    // BULLET DB TAB SWITCH

    function switchTab(tab) {
      tabInspectBtn.classList.toggle("active", tab === "inspect");
      tabDbBtn.classList.toggle("active", tab === "db");
      tabBulletsBtn.classList.toggle("active", tab === "bullets");
      tabStatusBtn.classList.toggle("active", tab === "status");
      tabColorsBtn.classList.toggle("active", tab === "colors");
      tabAiBtn.classList.toggle("active", tab === "ai");
      tabSimBtn.classList.toggle("active", tab === "sim");
      tabRecipesBtn.classList.toggle("active", tab === "recipes");
      tabModsBtn.classList.toggle("active", tab === "mods");
      tabInspectContent.style.display = tab === "inspect" ? "flex" : "none";
      tabDbContent.style.display = tab === "db" ? "flex" : "none";
      tabBulletsContent.style.display = tab === "bullets" ? "flex" : "none";
      tabStatusContent.style.display = tab === "status" ? "flex" : "none";
      tabColorsContent.style.display = tab === "colors" ? "flex" : "none";
      tabAiContent.style.display = tab === "ai" ? "flex" : "none";
      tabSimContent.style.display = tab === "sim" ? "flex" : "none";
      tabRecipesContent.style.display = tab === "recipes" ? "flex" : "none";
      tabModsContent.style.display = tab === "mods" ? "flex" : "none";
      if (tab === "db") renderDatabase(dbSearchInput.value);
      if (tab === "bullets") renderBullets(bulletSearchInput.value);
      if (tab === "status") renderStatusEffects(statusSearchInput.value);
      if (tab === "colors") renderColorsAndFx(colorsSearchInput.value);
      if (tab === "sim" && typeof simOnTabOpen === "function") simOnTabOpen();
      if (tab === "recipes") renderRecipes(recipesSearchInput.value);
      if (tab === "mods") {
        if (!MODS_INDEX_STATE.loaded) {
          modsResults.innerHTML = '<div class="file-empty-hint">⏳ Загружаю официальный список модов Mindustry…</div>';
        }
        loadModsRegistry().then(() => renderMods(modsSearchInput.value));
      }
    }

    tabInspectBtn.addEventListener("click", () => switchTab("inspect"));
    tabDbBtn.addEventListener("click", () => switchTab("db"));
    tabBulletsBtn.addEventListener("click", () => switchTab("bullets"));
    tabStatusBtn.addEventListener("click", () => switchTab("status"));
    tabColorsBtn.addEventListener("click", () => switchTab("colors"));
    tabAiBtn.addEventListener("click", () => switchTab("ai"));
    tabSimBtn.addEventListener("click", () => switchTab("sim"));
    tabRecipesBtn.addEventListener("click", () => switchTab("recipes"));
    tabModsBtn.addEventListener("click", () => switchTab("mods"));

    dbSearchInput.addEventListener("input", (e) => {
      renderDatabase(e.target.value);
    });

    modsSearchInput.addEventListener("input", (e) => {
      renderMods(e.target.value);
    });

    const btnRefreshModsIndex = document.getElementById("btnRefreshModsIndex");
    if (btnRefreshModsIndex) {
      btnRefreshModsIndex.addEventListener("click", async () => {
        btnRefreshModsIndex.disabled = true;
        btnRefreshModsIndex.textContent = "⏳ Обновление…";
        try {
          await loadModsRegistry(true);
          renderMods(modsSearchInput.value);
          showToast(`Список модов обновлён: ${MOD_REGISTRY.length}`);
        } catch (e) {
          showToast("Не удалось обновить список модов: " + e.message);
        } finally {
          btnRefreshModsIndex.disabled = false;
          btnRefreshModsIndex.textContent = "🔄 Обновить";
        }
      });
    }

    recipesSearchInput.addEventListener("input", (e) => {
      renderRecipes(e.target.value);
    });

    bulletSearchInput.addEventListener("input", (e) => {
      renderBullets(e.target.value);
    });

    statusSearchInput.addEventListener("input", (e) => {
      renderStatusEffects(e.target.value);
    });

    colorsSearchInput.addEventListener("input", (e) => {
      renderColorsAndFx(e.target.value);
    });

    // KEYBOARD & CURSOR EVENTS
    editor.addEventListener("input", () => {
      updateEditorLines();
      validateAndAnalyze();
      schedulePersist();
      if (typeof simOnEditorChange === "function") simOnEditorChange();
    });

    editor.addEventListener("scroll", () => {
      syncEditorScroll();
      repositionErrorHighlight();
    });

    editor.addEventListener("click", () => {
      updateEditorLines();
      validateAndAnalyze();
    });

    editor.addEventListener("keyup", () => {
      updateEditorLines();
      validateAndAnalyze();
    });

    statusBadge.addEventListener("click", () => {
      if (!currentErrorLine) return;
      const lines = editor.value.split("\n");
      let pos = 0;
      for (let i = 0; i < currentErrorLine - 1 && i < lines.length; i++) {
        pos += lines[i].length + 1;
      }
      editor.focus();
      editor.setSelectionRange(pos, pos);
      updateEditorLines();
      validateAndAnalyze();
    });

    // FIELD TYPO DETECTION CLICK

    typoBadge.addEventListener("click", () => {
      if (!currentTypos.length) return;
      const target = currentTypos[0];
      const lines = editor.value.split("\n");
      let pos = 0;
      for (let i = 0; i < target.line - 1 && i < lines.length; i++) {
        pos += lines[i].length + 1;
      }
      editor.focus();
      editor.setSelectionRange(pos, pos);
      updateEditorLines();
      validateAndAnalyze();
      showToast(`Строка ${target.line}: "${target.key}" — похоже на "${target.suggestion}"?`);
    });

    editor.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + "  " + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 2;
        updateEditorLines();
        validateAndAnalyze();
        schedulePersist();
      }
    });

    document.addEventListener("keydown", (e) => {
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      if (!ctrlOrCmd) return;

      if (!e.shiftKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        persistState(true);
        // MOD FOLDER SAVE-ON-CTRLS
        if (activeModFileIndex >= 0) {
          saveActiveModFileToDisk();
        }

      } else if (e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        document.getElementById("btnFormat").click();
      }
    });

    // UPLOAD JSON FILE
    document.getElementById("btnUpload").addEventListener("click", () => {
      fileUploadInput.click();
    });

    fileUploadInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        editor.value = evt.target.result;
        fileNameDisplay.textContent = file.name;
        updateEditorLines();
        validateAndAnalyze();
        schedulePersist();
        showToast(`Файл "${file.name}" загружен`);
      };
      reader.onerror = () => {
        alert("Не удалось прочитать выбранный файл.");
      };
      reader.readAsText(file, "UTF-8");
      fileUploadInput.value = "";
    });

    // THEME TOGGLE JS

    const THEME_STORAGE_KEY = "mindustryStudio.theme";
    const btnThemeToggle = document.getElementById("btnThemeToggle");

    function applyTheme(theme) {
      if (theme === "light") {
        document.documentElement.setAttribute("data-theme", "light");
        btnThemeToggle.textContent = "☀️";
        btnThemeToggle.title = "Переключить на тёмную тему";
      } else {
        document.documentElement.removeAttribute("data-theme");
        btnThemeToggle.textContent = "🌙";
        btnThemeToggle.title = "Переключить на светлую тему";
      }
    }

    btnThemeToggle.addEventListener("click", () => {
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      const next = isLight ? "dark" : "light";
      applyTheme(next);
      try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch (e) {}
    });

    (function initTheme() {
      let saved = null;
      try { saved = localStorage.getItem(THEME_STORAGE_KEY); } catch (e) {}
      applyTheme(saved || "dark");
    })();

    // LAYOUT SWITCH JS

    (function initLayoutSwitch() {
      const root = document.documentElement;
      const LAYOUT = window.MS_LAYOUT;
      if (!LAYOUT) return;

      const btn = document.getElementById("btnLayoutToggle");
      const iconEl = document.getElementById("layoutToggleIcon");
      const labelEl = document.getElementById("layoutToggleLabel");
      const switchWrap = document.getElementById("layoutSwitch");
      const toolbar = document.querySelector(".toolbar-actions");
      const themeBtn = document.getElementById("btnThemeToggle");
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      const navBtns = Array.from(document.querySelectorAll(".mobile-nav-btn"));

      const INFO = {
        auto:    { icon: "🔄",  label: "Авто",    title: "Вид интерфейса: подбирается автоматически по экрану. Нажмите, чтобы выбрать вручную" },
        mobile:  { icon: "📱",  label: "Телефон", title: "Вид интерфейса: для телефона. Нажмите, чтобы сменить" },
        desktop: { icon: "🖥️", label: "ПК",      title: "Вид интерфейса: для компьютера. Нажмите, чтобы сменить" }
      };

      function getMode() {
        let m = "auto";
        try { m = localStorage.getItem(LAYOUT.key) || "auto"; } catch (e) {}
        return (m === "mobile" || m === "desktop") ? m : "auto";
      }

      function nextMode(mode) {
        const autoLayout = LAYOUT.auto();
        const other = autoLayout === "mobile" ? "desktop" : "mobile";
        const seq = [other, autoLayout, "auto"];
        return seq[(seq.indexOf(mode) + 1) % seq.length];
      }

      function setPane(pane) {
        root.setAttribute("data-pane", pane);
        navBtns.forEach(b => b.classList.toggle("active", b.dataset.pane === pane));
      }

      function paintButton(mode) {
        const info = INFO[mode];
        iconEl.textContent = info.icon;
        labelEl.textContent = info.label;
        btn.title = info.title;
      }

      function applyLayout(mode, force) {
        const eff = LAYOUT.resolve(mode);
        const changed = root.getAttribute("data-layout") !== eff;
        paintButton(mode);

        if (!changed && !force) return;
        root.setAttribute("data-layout", eff);

        if (themeBtn && switchWrap && toolbar) {
          if (eff === "mobile") {
            if (themeBtn.parentNode !== switchWrap) switchWrap.appendChild(themeBtn);
          } else if (themeBtn.parentNode !== toolbar) {
            toolbar.appendChild(themeBtn);
          }
        }

        if (viewportMeta) {
          viewportMeta.setAttribute("content", eff === "mobile"
            ? "width=device-width, initial-scale=1.0, maximum-scale=1.0, interactive-widget=resizes-content"
            : "width=device-width, initial-scale=1.0, interactive-widget=resizes-content");
        }

        if (eff === "mobile") setPane(root.getAttribute("data-pane") || "editor");
        window.dispatchEvent(new Event("resize"));
      }

      btn.addEventListener("click", () => {
        const next = nextMode(getMode());
        try { localStorage.setItem(LAYOUT.key, next); } catch (e) {}
        applyLayout(next, true);
        const eff = LAYOUT.resolve(next);
        const effText = eff === "mobile" ? "телефон" : "компьютер";
        if (typeof showToast === "function") {
          showToast(next === "auto" ? `Интерфейс: авто (сейчас — ${effText})` : `Интерфейс: ${effText}`);
        }
      });

      navBtns.forEach(b => b.addEventListener("click", () => setPane(b.dataset.pane)));

      document.addEventListener("click", (e) => {
        if (root.getAttribute("data-layout") !== "mobile") return;
        const t = e.target;
        if (!t || !t.closest) return;
        if (t.closest(".file-item-delete-btn")) return;
        if (t.closest(".file-item, .tpl-item, .diag-item, #btnFormat, #btnUpload, #btnNewModFile")) setPane("editor");
      }, true);

      let resizeTimer = null;
      window.addEventListener("resize", () => {
        if (getMode() !== "auto") return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => applyLayout("auto"), 120);
      });

      applyLayout(getMode(), true);
    })();
