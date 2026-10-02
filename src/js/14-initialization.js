// ============================================================
// Инициализация приложения (стартовое состояние)
// (часть модуля mindustry-studio; оборачивается build.py)
// ============================================================

    // INITIALIZATION
    renderTemplates();
    (function initEditorState() {
      let savedCode = null;
      let savedName = null;
      try {
        savedCode = localStorage.getItem(STORAGE_KEY_CODE);
        savedName = localStorage.getItem(STORAGE_KEY_FILENAME);
      } catch (e) {
        savedCode = null;
      }

      if (savedCode) {
        editor.value = savedCode;
        fileNameDisplay.textContent = savedName || "restored.json";
        updateEditorLines();
        validateAndAnalyze();
        showToast("Восстановлен сохранённый код из браузера");
      } else {
        loadTemplate(TEMPLATES[0]);
      }
    })();
    renderDatabase();
    simInit();
