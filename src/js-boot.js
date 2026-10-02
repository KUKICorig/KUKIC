// ============================================================
// Обёртка запуска приложения.
// Содержимое src/js/*.js (по алфавиту) подставляется на место
// маркера /*__APP_JS__*/ сборщиком build.py.
// Не удаляйте маркер!
// ============================================================
  (async function () {
/*__APP_JS__*/
  })().catch(error => {
    console.error("[Mindustry Studio] Критическая ошибка запуска:", error);
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = "Ошибка загрузки базы знаний: " + (error?.message || error);
      toast.classList.add("show");
    }
  });
