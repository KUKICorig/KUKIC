// ============================================================
// DOM-элементы, автодополнение полей, константы вкладок
// (часть модуля mindustry-studio; оборачивается build.py)
// ============================================================

    // DOM ELEMENTS
    const editor = document.getElementById("codeEditor");

    // FIELD AUTOCOMPLETE

    let FIELD_AC_KEYS = Object.keys(DB_FIELDS).sort();

    function refreshFieldCaches() {
      KNOWN_FIELD_NAMES = Object.keys(DB_FIELDS);
      FIELD_AC_KEYS = Object.keys(DB_FIELDS).sort();
    }

    const fieldAcBox = document.createElement("div");
    fieldAcBox.className = "field-ac-box";
    fieldAcBox.id = "fieldAcBox";
    document.body.appendChild(fieldAcBox);

    let fieldAcVisible = false;
    let fieldAcItems = [];
    let fieldAcSelected = 0;
    let fieldAcRange = null;
    let fieldAcCharWidth = 7.8;

    function measureFieldAcCharWidth() {
      const probe = document.createElement("span");
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.style.whiteSpace = "pre";
      probe.style.fontFamily = getComputedStyle(editor).fontFamily;
      probe.style.fontSize = getComputedStyle(editor).fontSize;
      probe.textContent = "0123456789";
      document.body.appendChild(probe);
      const w = probe.getBoundingClientRect().width;
      document.body.removeChild(probe);
      if (w > 0) fieldAcCharWidth = w / 10;
    }
    measureFieldAcCharWidth();

    function hideFieldAutocomplete() {
      if (!fieldAcVisible) return;
      fieldAcVisible = false;
      fieldAcBox.style.display = "none";
      fieldAcBox.innerHTML = "";
      fieldAcRange = null;
    }

    function fieldAcLineStart(text, pos) {
      return text.lastIndexOf("\n", pos - 1) + 1;
    }

    function detectFieldKeyContext() {
      if (editor.selectionStart !== editor.selectionEnd) return null;
      const pos = editor.selectionStart;
      const text = editor.value;
      const lineStart = fieldAcLineStart(text, pos);
      const beforeCursor = text.slice(lineStart, pos);
      const m = beforeCursor.match(/"([A-Za-z_][A-Za-z0-9_]*)$/);
      if (!m) return null;
      const preQuote = beforeCursor.slice(0, m.index);
      if (!/^\s*$/.test(preQuote) && !/,\s*$/.test(preQuote)) return null;
      return {
        partial: m[1],
        keyStart: lineStart + m.index + 1,
        keyEnd: pos
      };
    }

    function fieldAcSetActive(i) {
      fieldAcSelected = i;
      Array.from(fieldAcBox.querySelectorAll(".field-ac-item")).forEach((el, idx) => {
        el.classList.toggle("active", idx === i);
      });
      const activeEl = fieldAcBox.querySelectorAll(".field-ac-item")[i];
      if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
    }

    function positionFieldAcBox(charPos) {
      const text = editor.value;
      const lineStart = fieldAcLineStart(text, charPos);
      const lineIndex = text.slice(0, lineStart).split("\n").length - 1;
      const col = charPos - lineStart;
      const rect = editor.getBoundingClientRect();
      const paddingTop = 10, paddingLeft = 12, lineHeight = 20;

      let top = rect.top - editor.scrollTop + paddingTop + (lineIndex + 1) * lineHeight;
      let left = rect.left - editor.scrollLeft + paddingLeft + col * fieldAcCharWidth;

      const boxWidth = 300;
      const maxLeft = window.innerWidth - boxWidth - 8;
      if (left > maxLeft) left = Math.max(8, maxLeft);
      if (left < 8) left = 8;

      const estimatedHeight = Math.min(260, fieldAcItems.length * 46 + 4);
      if (top + estimatedHeight > window.innerHeight - 8) {
        top = rect.top - editor.scrollTop + paddingTop + lineIndex * lineHeight - estimatedHeight - 4;
      }
      if (top < 8) top = 8;

      fieldAcBox.style.top = top + "px";
      fieldAcBox.style.left = left + "px";
    }

    function renderFieldAutocomplete() {
      const ctx = detectFieldKeyContext();
      if (!ctx) { hideFieldAutocomplete(); return; }

      const q = ctx.partial.toLowerCase();
      let matches;
      if (!q) {
        matches = FIELD_AC_KEYS.slice(0, 40);
      } else {
        const starts = FIELD_AC_KEYS.filter(k => k.toLowerCase().startsWith(q));
        const contains = FIELD_AC_KEYS.filter(k => !k.toLowerCase().startsWith(q) && k.toLowerCase().includes(q));
        matches = starts.concat(contains).slice(0, 30);
      }

      if (!matches.length) { hideFieldAutocomplete(); return; }

      fieldAcItems = matches;
      fieldAcSelected = 0;
      fieldAcRange = ctx;
      fieldAcVisible = true;

      fieldAcBox.innerHTML = "";
      matches.forEach((key, i) => {
        const item = DB_FIELDS[key] || {};
        const row = document.createElement("div");
        row.className = "field-ac-item" + (i === 0 ? " active" : "");
        row.innerHTML = `
          <div class="field-ac-row-top">
            <span class="field-ac-key">"${key}"</span>
            <span class="field-ac-type">${item.type ? item.type.split("(")[0].trim() : ""}</span>
          </div>
          <div class="field-ac-desc">${item.desc ? item.desc : ""}</div>
        `;
        row.addEventListener("mousedown", (e) => {
          e.preventDefault();
          acceptFieldAutocomplete(i);
        });
        row.addEventListener("mouseenter", () => fieldAcSetActive(i));
        fieldAcBox.appendChild(row);
      });

      const footer = document.createElement("div");
      footer.className = "field-ac-hint-footer";
      footer.textContent = "↑↓ выбрать · Tab/Enter вставить · Esc закрыть";
      fieldAcBox.appendChild(footer);

      positionFieldAcBox(ctx.keyStart);
      fieldAcBox.style.display = "block";
    }

    function acceptFieldAutocomplete(index) {
      if (!fieldAcVisible || !fieldAcRange) return;
      const key = fieldAcItems[index !== undefined ? index : fieldAcSelected];
      if (!key) return;

      const text = editor.value;
      const before = text.slice(0, fieldAcRange.keyStart);
      const after = text.slice(fieldAcRange.keyEnd);
      const needsClosingQuote = after.charAt(0) !== '"';
      const insertion = key + (needsClosingQuote ? '"' : "");
      const newCursorPos = fieldAcRange.keyStart + insertion.length;

      editor.value = before + insertion + after;
      editor.selectionStart = editor.selectionEnd = newCursorPos;
      hideFieldAutocomplete();
      updateEditorLines();
      validateAndAnalyze();
      schedulePersist();
      editor.focus();
    }

    editor.addEventListener("input", () => {
      renderFieldAutocomplete();
    });

    editor.addEventListener("keydown", (e) => {
      if (!fieldAcVisible) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        fieldAcSetActive(Math.min(fieldAcSelected + 1, fieldAcItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        fieldAcSetActive(Math.max(fieldAcSelected - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        acceptFieldAutocomplete(fieldAcSelected);
      } else if (e.key === "Escape") {
        e.preventDefault();
        hideFieldAutocomplete();
      }
    });

    editor.addEventListener("click", () => hideFieldAutocomplete());

    editor.addEventListener("blur", () => {

      setTimeout(hideFieldAutocomplete, 150);
    });

    editor.addEventListener("scroll", () => {
      if (fieldAcVisible && fieldAcRange) positionFieldAcBox(fieldAcRange.keyStart);
    });

    window.addEventListener("resize", () => {
      if (fieldAcVisible) hideFieldAutocomplete();
    });

    const lineNumbers = document.getElementById("lineNumbers");
    const lineNumbersInner = document.getElementById("lineNumbersInner");
    const cursorPosDisplay = document.getElementById("cursorPosDisplay");
    const statusBadge = document.getElementById("statusBadge");
    // FIELD TYPO DETECTION DOM
    const typoBadge = document.getElementById("typoBadge");

    const fileNameDisplay = document.getElementById("fileNameDisplay");
    const codeHighlight = document.getElementById("codeHighlight");
    const codeHighlightContent = document.getElementById("codeHighlightContent");
    const errorLineHighlight = document.getElementById("errorLineHighlight");
    const fileUploadInput = document.getElementById("fileUploadInput");

    // SCROLL SYNC FIX (v2.10)

    function syncEditorScroll() {
      const top = editor.scrollTop;
      const left = editor.scrollLeft;
      lineNumbersInner.style.transform = `translateY(${-top}px)`;
      codeHighlightContent.style.transform = `translate(${-left}px, ${-top}px)`;
    }

    const LINE_HEIGHT = 20;
    const EDITOR_PAD_TOP = 10;
    const STORAGE_KEY_CODE = "mindustryStudio.code";
    const STORAGE_KEY_FILENAME = "mindustryStudio.fileName";

    const hintLineNum = document.getElementById("hintLineNum");
    const hintTag = document.getElementById("hintTag");
    const hintPropName = document.getElementById("hintPropName");
    const hintPropType = document.getElementById("hintPropType");
    const hintPropDesc = document.getElementById("hintPropDesc");
    const hintExample = document.getElementById("hintExample");
    const suggestList = document.getElementById("suggestList");

    const templateList = document.getElementById("templateList");
    const tabInspectBtn = document.getElementById("tabInspectBtn");
    const tabDbBtn = document.getElementById("tabDbBtn");
    const tabInspectContent = document.getElementById("tabInspectContent");
    const tabDbContent = document.getElementById("tabDbContent");
    // BULLET DB CONST
    const tabBulletsBtn = document.getElementById("tabBulletsBtn");
    const tabBulletsContent = document.getElementById("tabBulletsContent");
    const bulletSearchInput = document.getElementById("bulletSearchInput");
    const bulletSearchResults = document.getElementById("bulletSearchResults");

    // STATUS DB CONST
    const tabStatusBtn = document.getElementById("tabStatusBtn");
    const tabStatusContent = document.getElementById("tabStatusContent");
    const statusSearchInput = document.getElementById("statusSearchInput");
    const statusSearchResults = document.getElementById("statusSearchResults");

    // COLOR/FX CONST
    const tabColorsBtn = document.getElementById("tabColorsBtn");
    const tabColorsContent = document.getElementById("tabColorsContent");
    const colorsSearchInput = document.getElementById("colorsSearchInput");
    const colorsSearchResults = document.getElementById("colorsSearchResults");

    // AI TAB CONST
    const tabAiBtn = document.getElementById("tabAiBtn");
    const tabAiContent = document.getElementById("tabAiContent");
    // SIMULATOR TAB REFS
    const tabSimBtn = document.getElementById("tabSimBtn");
    const tabSimContent = document.getElementById("tabSimContent");

    // RECIPES TAB REFS
    const tabRecipesBtn = document.getElementById("tabRecipesBtn");
    const tabRecipesContent = document.getElementById("tabRecipesContent");
    const btnLoadRecipes = document.getElementById("btnLoadRecipes");
    const btnLoadRecipesLegacy = document.getElementById("btnLoadRecipesLegacy");
    const recipesUploadInputLegacy = document.getElementById("recipesUploadInputLegacy");
    const btnSaveRecipe = document.getElementById("btnSaveRecipe");
    const recipesFolderName = document.getElementById("recipesFolderName");
    const recipesSearchInput = document.getElementById("recipesSearchInput");
    const recipesResults = document.getElementById("recipesResults");

    // MODS TAB REFS
    const tabModsBtn = document.getElementById("tabModsBtn");
    const tabModsContent = document.getElementById("tabModsContent");
    const modsSearchInput = document.getElementById("modsSearchInput");
    const modsResults = document.getElementById("modsResults");
    const modDetailCard = document.getElementById("modDetailCard");
    const modDetailName = document.getElementById("modDetailName");
    const modDetailDesc = document.getElementById("modDetailDesc");
    const btnModCloseDetail = document.getElementById("btnModCloseDetail");
    const btnModLoad = document.getElementById("btnModLoad");
    const btnModDownloadZip = document.getElementById("btnModDownloadZip");
    const btnModCopyLink = document.getElementById("btnModCopyLink");
    const modFilesTree = document.getElementById("modFilesTree");

    const aiModelSelect = document.getElementById("aiModelSelect");
    const aiPromptInput = document.getElementById("aiPromptInput");
    const aiIncludeCode = document.getElementById("aiIncludeCode");
    const btnAiSend = document.getElementById("btnAiSend");
    const aiResponseBox = document.getElementById("aiResponseBox");
    const aiStatusTag = document.getElementById("aiStatusTag");
    const btnAiInsert = document.getElementById("btnAiInsert");
    const btnAiCopy = document.getElementById("btnAiCopy");

    // MOD FILES CONST
    const sidebarModeFiles = document.getElementById("sidebarModeFiles");
    const sidebarModeTemplates = document.getElementById("sidebarModeTemplates");
    const sidebarFilesPane = document.getElementById("sidebarFilesPane");
    const sidebarTemplatesPane = document.getElementById("sidebarTemplatesPane");
    const btnLoadFolder = document.getElementById("btnLoadFolder");
    const btnLoadFolderLegacy = document.getElementById("btnLoadFolderLegacy");
    const folderUploadInputLegacy = document.getElementById("folderUploadInputLegacy");
    const modFolderName = document.getElementById("modFolderName");
    const fileList = document.getElementById("fileList");
    const btnNewModFile = document.getElementById("btnNewModFile");

    // VALIDATOR DIAGNOSTICS CONST
    const diagCard = document.getElementById("diagCard");
    const diagCount = document.getElementById("diagCount");
    const diagList = document.getElementById("diagList");

    const dbSearchInput = document.getElementById("dbSearchInput");
    const dbSearchResults = document.getElementById("dbSearchResults");

    const toast = document.getElementById("toast");
    const helpModal = document.getElementById("helpModal");
    // SETTINGS MODAL CONST
    const settingsModal = document.getElementById("settingsModal");
    const btnSettings = document.getElementById("btnSettings");
    const btnRefreshData = document.getElementById("btnRefreshData");
    const dataRefreshStatus = document.getElementById("dataRefreshStatus");

    // RENDER TEMPLATES LIST
    function renderTemplates() {
      templateList.innerHTML = "";
      let currentGroup = "";

      TEMPLATES.forEach((tpl, idx) => {
        if (tpl.group !== currentGroup) {
          currentGroup = tpl.group;
          const grp = document.createElement("div");
          grp.className = "tpl-group-title";
          grp.textContent = currentGroup;
          templateList.appendChild(grp);
        }

        const item = document.createElement("div");
        item.className = "tpl-item" + (idx === 0 ? " active" : "");
        item.innerHTML = `
          <div class="tpl-item-title">${tpl.title}</div>
          <div class="tpl-item-sub">${tpl.sub}</div>
        `;
        item.addEventListener("click", () => {
          document.querySelectorAll(".tpl-item").forEach(el => el.classList.remove("active"));
          item.classList.add("active");
          loadTemplate(tpl);
        });
        templateList.appendChild(item);
      });
    }

    function loadTemplate(tpl) {
      editor.value = tpl.code;
      fileNameDisplay.textContent = tpl.file;
      updateEditorLines();
      validateAndAnalyze();
      schedulePersist();
    }
