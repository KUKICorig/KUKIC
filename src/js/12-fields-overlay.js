// ============================================================
// Оверлей «Все поля»
// (часть модуля mindustry-studio; оборачивается build.py)
// ============================================================

// ALL FIELDS OVERLAY
const fieldsOverlay = document.getElementById("fieldsOverlay");
const fieldsOverlayBody = document.getElementById("fieldsOverlayBody");
const fieldsOverlaySearch = document.getElementById("fieldsOverlaySearch");

document.getElementById("btnAllFields").addEventListener("click", () => {
  fieldsOverlay.style.display = "flex";
  fieldsOverlaySearch.value = "";
  renderFieldsOverlay();
  fieldsOverlaySearch.focus();
});

document.getElementById("closeFieldsOverlayBtn").addEventListener("click", () => {
  fieldsOverlay.style.display = "none";
});

fieldsOverlay.addEventListener("click", (e) => {
  if (e.target === fieldsOverlay) {
    fieldsOverlay.style.display = "none";
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && fieldsOverlay.style.display === "flex") {
    fieldsOverlay.style.display = "none";
  }
});

fieldsOverlaySearch.addEventListener("input", (e) => {
  renderFieldsOverlay(e.target.value);
});

function renderFieldsOverlay(filter = "") {
  fieldsOverlayBody.innerHTML = "";
  const q = filter.toLowerCase().trim();

  const groups = {};
  Object.keys(DB_FIELDS).sort().forEach(key => {
    const item = DB_FIELDS[key];
    const desc = item.desc || "";
    const type = item.type || "Другое";
    if (q && !key.toLowerCase().includes(q) && !desc.toLowerCase().includes(q) && !type.toLowerCase().includes(q)) {
      return;
    }
    if (!groups[type]) groups[type] = [];
    groups[type].push(key);
  });

  const typeNames = Object.keys(groups).sort();

  if (typeNames.length === 0) {
    fieldsOverlayBody.innerHTML = '<div style="padding: 16px; color: var(--text-muted); font-size: 12px;">Ничего не найдено по вашему запросу.</div>';
    return;
  }

  typeNames.forEach(typeName => {
    const groupDiv = document.createElement("div");
    groupDiv.className = "fields-type-group";

    const title = document.createElement("div");
    title.className = "fields-type-title";
    title.innerHTML = `<span>${typeName}</span><span>${groups[typeName].length}</span>`;
    groupDiv.appendChild(title);

    groups[typeName].forEach(key => {
      const keyEl = document.createElement("div");
      keyEl.className = "fields-key-item";
      keyEl.textContent = `"${key}"`;
      keyEl.addEventListener("click", () => {
        openFieldInDatabase(key);
      });
      groupDiv.appendChild(keyEl);
    });

    fieldsOverlayBody.appendChild(groupDiv);
  });
}

function openFieldInDatabase(key) {
  fieldsOverlay.style.display = "none";
  dbSearchInput.value = key;
  switchTab("db");
  showToast(`Поле "${key}" открыто в базе данных`);
}
