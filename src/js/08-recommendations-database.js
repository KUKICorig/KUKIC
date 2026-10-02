// ============================================================
// Контекстные рекомендации полей и браузер базы данных/снарядов/эффектов
// (часть модуля mindustry-studio; оборачивается build.py)
// ============================================================

    // CONTEXT-AWARE RECOMMENDATION ENGINE

    const TYPE_TAXONOMY = {
      unit: {
        label: "🤖 Юнит",
        subtypes: [
          { key: "flying", label: "Летающий (flying)", skeleton: {
              type: "flying", name: "", health: 200, speed: 3, armor: 0,
              hitSize: 10, engineOffset: 6, engineSize: 2, itemCapacity: 0, weapons: []
          }},
          { key: "mech", label: "Шагоход (mech)", skeleton: {
              type: "mech", name: "", health: 400, speed: 1.1, armor: 2,
              hitSize: 13, itemCapacity: 0, weapons: []
          }},
          { key: "legs", label: "Многоножка (legs)", skeleton: {
              type: "legs", name: "", health: 500, speed: 1.0, armor: 3,
              hitSize: 14, legCount: 4, legLength: 10, legSpeed: 0.5, weapons: []
          }},
          { key: "tank", label: "Танк (tank)", skeleton: {
              type: "tank", name: "", health: 700, speed: 0.7, armor: 5,
              hitSize: 16, treadFrames: 3, weapons: []
          }}
        ]
      },
      block: {
        label: "🧱 Блок",
        subtypes: [
          { key: "ItemTurret", label: "Турель на предметах (ItemTurret)", skeleton: {
              type: "ItemTurret", name: "", health: 400, size: 2, category: "turret",
              requirements: [{ item: "copper", amount: 60 }],
              range: 100, reload: 40, ammoTypes: { copper: { damage: 10, speed: 4 } }
          }},
          { key: "PowerTurret", label: "Турель на энергии (PowerTurret)", skeleton: {
              type: "PowerTurret", name: "", health: 400, size: 2, category: "turret",
              requirements: [{ item: "copper", amount: 60 }],
              range: 100, reload: 40, powerCapacity: 40,
              shootType: { type: "LaserBulletType", damage: 40 }
          }},
          { key: "LiquidTurret", label: "Турель на жидкости (LiquidTurret)", skeleton: {
              type: "LiquidTurret", name: "", health: 400, size: 2, category: "turret",
              requirements: [{ item: "copper", amount: 60 }],
              range: 100, reload: 40, liquidCapacity: 40,
              ammoTypes: { water: { damage: 5, speed: 3 } }
          }},
          { key: "GenericCrafter", label: "Завод/переработка (GenericCrafter)", skeleton: {
              type: "GenericCrafter", name: "", health: 300, size: 2, category: "crafting",
              requirements: [{ item: "copper", amount: 40 }],
              craftTime: 60, outputItem: { item: "graphite", amount: 1 }, itemCapacity: 10
          }},
          { key: "Drill", label: "Бур (Drill)", skeleton: {
              type: "Drill", name: "", health: 250, size: 2, category: "production",
              requirements: [{ item: "copper", amount: 40 }],
              tier: 2, drillTime: 300, itemCapacity: 10
          }},
          { key: "PowerGenerator", label: "Электростанция (PowerGenerator)", skeleton: {
              type: "PowerGenerator", name: "", health: 300, size: 2, category: "power",
              requirements: [{ item: "copper", amount: 40 }],
              powerProduction: 1.0, consumes: { item: { item: "coal", amount: 1 } }
          }},
          { key: "Wall", label: "Стена (Wall)", skeleton: {
              type: "Wall", name: "", health: 4000, size: 1, category: "defense",
              requirements: [{ item: "copper", amount: 6 }], armor: 0
          }},
          { key: "Conveyor", label: "Конвейер (Conveyor)", skeleton: {
              type: "Conveyor", name: "", health: 90, size: 1, category: "distribution",
              requirements: [{ item: "copper", amount: 1 }], itemCapacity: 4
          }},
          { key: "StorageBlock", label: "Хранилище (StorageBlock)", skeleton: {
              type: "StorageBlock", name: "", health: 300, size: 2, category: "distribution",
              requirements: [{ item: "copper", amount: 40 }], itemCapacity: 50
          }}
        ]
      }
    };

    const BASE_TURRET_FIELDS = ["health", "size", "category", "requirements", "research", "alwaysUnlocked",
      "range", "reload", "inaccuracy", "rotateSpeed", "shots", "recoil", "restitution",
      "targetAir", "targetGround", "shootCone", "cooldownTime", "minWarmup", "shootEffect", "hitEffect"];

    const BASE_UNIT_FIELDS = ["health", "armor", "speed", "hitSize", "weapons", "itemCapacity", "rotateSpeed",
      "research", "alwaysUnlocked", "controller", "faceTarget", "payloadCapacity", "buildSpeed",
      "mineTier", "mineSpeed", "mineRange", "abilities"];

    const TYPE_FIELD_SETS = {
      "ItemTurret": [...BASE_TURRET_FIELDS, "ammoTypes", "maxAmmo", "ammoPerShot", "ammoUseEffect", "ammoEjectBack"],
      "PowerTurret": [...BASE_TURRET_FIELDS, "shootType", "powerCapacity", "consumes"],
      "LiquidTurret": [...BASE_TURRET_FIELDS, "ammoTypes", "liquidCapacity", "consumeLiquid"],
      "GenericCrafter": ["health", "size", "category", "requirements", "research", "craftTime", "outputItem",
        "outputLiquid", "itemCapacity", "liquidCapacity", "consumes", "craftEffect", "hasItems", "hasLiquids", "hasPower"],
      "Drill": ["health", "size", "category", "requirements", "research", "drillTime", "tier",
        "hardnessDrillMultiplier", "liquidBoostIntensity", "drillMultipliers", "blockedItems", "itemCapacity"],
      "PowerGenerator": ["health", "size", "category", "requirements", "research", "powerProduction",
        "powerCapacity", "consumes", "consumeItem", "consumeLiquid", "hasPower"],
      "Wall": ["health", "size", "category", "requirements", "research", "armor", "solid", "destructible",
        "lightning", "lightningDamage", "lightningLength", "lightningColor", "chanceDeflect"],
      "Conveyor": ["health", "size", "category", "requirements", "itemCapacity"],
      "Duct": ["health", "size", "category", "requirements", "itemCapacity"],
      "Conduit": ["health", "size", "category", "requirements", "liquidCapacity"],
      "StorageBlock": ["health", "size", "category", "requirements", "itemCapacity"],
      "flying": [...BASE_UNIT_FIELDS, "engineOffset", "engineSize", "omniMovement", "hovering", "lowAltitude"],
      "mech": [...BASE_UNIT_FIELDS, "mechFrontSway", "mechSideSway", "mechStride", "mechLegColor"],
      "legs": [...BASE_UNIT_FIELDS, "legCount", "legLength", "legBaseOffset", "legMoveSpace",
        "legForwardScl", "legStraightness", "legSpeed", "legContinuousMove", "hovering", "shadowElevation"],
      "tank": [...BASE_UNIT_FIELDS, "treadRects", "treadPullOffset", "treadFrames", "crushFragile", "treadEffect", "naval"]
    };

    function getTopLevelFieldSet(type) {
      if (TYPE_FIELD_SETS[type]) return TYPE_FIELD_SETS[type];
      if (typeof type === "string" && type) {
        if (type.includes("Turret")) return TYPE_FIELD_SETS["ItemTurret"];
        if (type.includes("Crafter") || type.includes("Factory")) return TYPE_FIELD_SETS["GenericCrafter"];
        if (type.includes("Generator")) return TYPE_FIELD_SETS["PowerGenerator"];
        if (type.includes("Wall")) return TYPE_FIELD_SETS["Wall"];
        if (type.includes("Conveyor") || type.includes("Duct") || type.includes("Router") || type.includes("Bridge")) return TYPE_FIELD_SETS["Conveyor"];
        if (type.includes("Liquid") || type.includes("Conduit") || type.includes("Tank")) return TYPE_FIELD_SETS["Conduit"];
        if (type.includes("Storage") || type.includes("Unloader") || type.includes("Container")) return TYPE_FIELD_SETS["StorageBlock"];
        if (type.includes("Drill")) return TYPE_FIELD_SETS["Drill"];
      }
      return ["name", "description", "size", "health", "requirements", "category", "research"];
    }

    const BULLET_FIELD_SET = ["damage", "speed", "lifetime", "width", "height", "splashDamage", "splashDamageRadius",
      "pierce", "pierceCap", "homingPower", "homingRange", "status", "statusDuration", "hitEffect", "despawnEffect",
      "shootEffect", "smokeEffect", "trailLength", "trailWidth", "trailColor", "trailEffect", "knockback", "lightning",
      "lightningDamage", "lightningLength", "lightningColor", "fragBullets", "fragBullet", "fragSpread",
      "fragVelocityMin", "fragVelocityMax", "buildingDamageMultiplier", "pierceBuilding", "pierceDamageFactor",
      "hitSound", "hitShake", "weaveMag", "weaveScale", "homingDelay", "ammoMultiplier", "reloadMultiplier"];

    const NESTED_FIELD_SETS = {
      "weapons": ["x", "y", "reload", "rotate", "rotateSpeed", "shootCone", "top", "mirror", "alternate",
        "shootX", "shootY", "recoil", "shoot", "shotDelay", "bullet", "shootType", "cooldownTime", "shootSound", "shootSoundVolume"],
      "bullet": BULLET_FIELD_SET,
      "shootType": BULLET_FIELD_SET,
      "fragBullet": BULLET_FIELD_SET,
      "ammoTypes": BULLET_FIELD_SET,
      "requirements": ["item", "amount"],
      "consumes": ["item", "items", "power", "liquid"],
      "outputItem": ["item", "amount"],
      "outputLiquid": ["liquid", "amount"]
    };

    const ARRAY_ELEMENT_TEMPLATES = {
      "weapons": '{ "x": 0, "y": 0, "reload": 30, "bullet": { "type": "BasicBulletType", "damage": 10, "speed": 4 } }',
      "requirements": '{ "item": "copper", "amount": 40 }',
      "fragBullets": '{ "type": "BasicBulletType", "damage": 5, "speed": 3 }'
    };

    function getJsonContextStack(text, caretPos) {
      const src = text.slice(0, caretPos);
      const stack = [];
      let lastString = null;
      let sawColon = false;
      let i = 0;
      const n = src.length;
      while (i < n) {
        const ch = src[i];
        if (ch === '"') {
          let j = i + 1, buf = "";
          while (j < n && src[j] !== '"') {
            if (src[j] === "\\") { buf += src[j] + (src[j + 1] || ""); j += 2; }
            else { buf += src[j]; j++; }
          }
          lastString = buf; sawColon = false; i = j + 1;
          continue;
        }
        if (ch === ":") { sawColon = true; i++; continue; }
        if (ch === "{" || ch === "[") {
          let key = null;
          if (sawColon && lastString !== null) key = lastString;
          else if (stack.length && stack[stack.length - 1].bracket === "[") key = stack[stack.length - 1].key;
          stack.push({ bracket: ch, key });
          lastString = null; sawColon = false; i++;
          continue;
        }
        if (ch === "}" || ch === "]") { stack.pop(); lastString = null; sawColon = false; i++; continue; }
        if (ch === ",") { lastString = null; sawColon = false; i++; continue; }
        i++;
      }
      return stack;
    }

    function insertTypeSkeleton(skeletonObj) {
      editor.value = JSON.stringify(skeletonObj, null, 2);
      editor.selectionStart = editor.selectionEnd = editor.value.length;
      updateEditorLines();
      validateAndAnalyze();
      schedulePersist();
      showToast("Стартовый скелет вставлен — продолжайте дописывать поля");
    }

    function renderTypePicker() {
      let html = '<div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">Файл пуст. Выберите, что вы создаёте — рекомендации подстроятся под выбранный тип:</div>';
      const groupKeys = { unit: TYPE_TAXONOMY.unit, block: TYPE_TAXONOMY.block };
      Object.keys(groupKeys).forEach(gk => {
        const group = groupKeys[gk];
        html += `<div style="font-size: 11px; font-weight:600; margin: 8px 0 4px;">${group.label}</div>`;
        html += '<div style="display:flex; flex-wrap:wrap; gap:6px;">';
        group.subtypes.forEach((st, idx) => {
          html += `<button class="btn suggest-type-btn" data-group="${gk}" data-idx="${idx}" style="font-size:11px; padding:4px 8px;">${st.label}</button>`;
        });
        html += "</div>";
      });
      suggestList.innerHTML = html;
      suggestList.querySelectorAll(".suggest-type-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const gk = btn.getAttribute("data-group");
          const idx = parseInt(btn.getAttribute("data-idx"), 10);
          insertTypeSkeleton(groupKeys[gk].subtypes[idx].skeleton);
        });
      });
    }

    function updateSuggestions(parsed, currentLineText) {
      suggestList.innerHTML = "";

      if (!editor.value.trim()) {
        renderTypePicker();
        return;
      }

      const caretPos = editor.selectionStart;
      const stack = getJsonContextStack(editor.value, caretPos);

      let nestedFound = null;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].key && NESTED_FIELD_SETS[stack[i].key]) { nestedFound = stack[i]; break; }
      }

      let candidateKeys = [];
      let existingKeys = new Set();
      let contextLabel = "";

      if (nestedFound) {
        contextLabel = `Контекст: "${nestedFound.key}"${nestedFound.bracket === "[" ? " (массив)" : " (объект)"}`;

        const top = stack[stack.length - 1];
        if (top.bracket === "[" && ARRAY_ELEMENT_TEMPLATES[top.key]) {
          suggestList.innerHTML = `
            <div style="font-size: 11px; color: var(--accent-cyan); margin-bottom: 8px;">${contextLabel}</div>
            <div class="suggest-item" id="suggestArrayInsert">
              <div>
                <div class="suggest-key">+ Новый элемент</div>
                <div style="font-size: 10px; color: #8b949e;">Вставить шаблон объекта в массив "${top.key}"</div>
              </div>
              <button class="suggest-insert-btn">+ Вставить</button>
            </div>`;
          document.getElementById("suggestArrayInsert").addEventListener("click", () => {
            insertSnippet(ARRAY_ELEMENT_TEMPLATES[top.key]);
          });
          return;
        }

        candidateKeys = NESTED_FIELD_SETS[nestedFound.key];

        const textBefore = editor.value.slice(0, caretPos);
        const lastKeyIdx = textBefore.lastIndexOf(`"${nestedFound.key}"`);
        const scanZone = lastKeyIdx >= 0 ? textBefore.slice(lastKeyIdx) : textBefore;
        const re = /"([a-zA-Z0-9_]+)"\s*:/g;
        let m;
        while ((m = re.exec(scanZone))) existingKeys.add(m[1]);
      } else {

        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          Object.keys(parsed).forEach(k => existingKeys.add(k));
        }
        const type = (parsed && parsed.type) ? parsed.type : "";
        candidateKeys = getTopLevelFieldSet(type);
        contextLabel = type ? `Тип: "${type}"` : "Верхний уровень объекта";
      }

      const filtered = candidateKeys.filter(k => !existingKeys.has(k)).slice(0, 6);

      suggestList.innerHTML = `<div style="font-size: 11px; color: var(--accent-cyan); margin-bottom: 8px;">${contextLabel}</div>`;

      if (filtered.length === 0) {
        suggestList.innerHTML += '<div style="font-size: 12px; color: var(--text-muted); padding: 6px;">Все ключевые поля уже заполнены!</div>';
        return;
      }

      filtered.forEach(key => {
        const itemInfo = DB_FIELDS[key];
        if (!itemInfo) return;

        const row = document.createElement("div");
        row.className = "suggest-item";
        row.innerHTML = `
          <div>
            <div class="suggest-key">"${key}"</div>
            <div style="font-size: 10px; color: #8b949e;">${itemInfo.type}</div>
          </div>
          <button class="suggest-insert-btn">+ Вставить</button>
        `;
        row.addEventListener("click", () => {
          insertSnippet(itemInfo.example);
        });
        suggestList.appendChild(row);
      });
    }

    function insertSnippet(snippet) {
      const pos = editor.selectionStart;
      const val = editor.value;

      let toInsert = snippet;
      if (!toInsert.endsWith(",") && !toInsert.endsWith("}")) {
        toInsert += ",";
      }

      editor.value = val.substring(0, pos) + "\n  " + toInsert + val.substring(pos);
      updateEditorLines();
      validateAndAnalyze();
      schedulePersist();
      showToast("Свойство вставлено в код");
    }

    // DATABASE BROWSER
    function renderDatabase(filter = "") {
      dbSearchResults.innerHTML = "";
      const q = filter.toLowerCase().trim();

      const keys = Object.keys(DB_FIELDS).sort();
      let count = 0;

      keys.forEach(key => {
        const item = DB_FIELDS[key];
        if (q && !key.toLowerCase().includes(q) && !item.desc.toLowerCase().includes(q) && !item.type.toLowerCase().includes(q)) {
          return;
        }
        count++;

        const div = document.createElement("div");
        div.className = "db-item";
        div.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="db-item-key">"${key}"</span>
            <span style="font-size: 10px; color: var(--accent-purple); font-family: var(--font-mono);">${item.type}</span>
          </div>
          <div class="db-item-desc">${item.desc}</div>
          <button class="btn" style="padding: 2px 8px; font-size: 10px; align-self: flex-start; margin-top: 4px;">Вставить в код</button>
        `;
        div.querySelector("button").addEventListener("click", () => {
          insertSnippet(item.example);
        });
        dbSearchResults.appendChild(div);
      });

      if (count === 0) {
        dbSearchResults.innerHTML = '<div style="padding: 16px; color: var(--text-muted); font-size: 12px;">Ничего не найдено по вашему запросу.</div>';
      }
    }

    // BULLET DB RENDER

    function renderBullets(filter = "") {
      bulletSearchResults.innerHTML = "";
      const q = filter.toLowerCase().trim();

      const groups = {};
      Object.keys(BULLET_TYPES).sort().forEach(key => {
        const item = BULLET_TYPES[key];
        if (q && !key.toLowerCase().includes(q) && !item.desc.toLowerCase().includes(q) && !item.category.toLowerCase().includes(q)) {
          return;
        }
        if (!groups[item.category]) groups[item.category] = [];
        groups[item.category].push(key);
      });

      const groupNames = Object.keys(groups).sort();

      if (groupNames.length === 0) {
        bulletSearchResults.innerHTML = '<div style="padding: 16px; color: var(--text-muted); font-size: 12px;">Ничего не найдено по вашему запросу.</div>';
        return;
      }

      groupNames.forEach(groupName => {
        const groupTitle = document.createElement("div");
        groupTitle.className = "fields-type-title";
        groupTitle.style.margin = "6px 10px";
        groupTitle.innerHTML = `<span>${groupName}</span><span>${groups[groupName].length}</span>`;
        bulletSearchResults.appendChild(groupTitle);

        groups[groupName].forEach(key => {
          const item = BULLET_TYPES[key];
          const div = document.createElement("div");
          div.className = "db-item";
          div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="db-item-key">"${key}"</span>
              <span style="font-size: 10px; color: var(--accent-purple); font-family: var(--font-mono);">extends ${item.extends}</span>
            </div>
            <div class="db-item-desc">${item.desc}</div>
            <button class="btn" style="padding: 2px 8px; font-size: 10px; align-self: flex-start; margin-top: 4px;">Вставить в код</button>
          `;
          div.querySelector("button").addEventListener("click", () => {
            insertSnippet(item.example);
          });
          bulletSearchResults.appendChild(div);
        });
      });
    }

    // STATUS DB RENDER

    function renderStatusEffects(filter = "") {
      statusSearchResults.innerHTML = "";
      const q = filter.toLowerCase().trim();

      const groups = {};
      Object.keys(STATUS_EFFECTS).sort().forEach(key => {
        const item = STATUS_EFFECTS[key];
        if (q && !key.toLowerCase().includes(q) && !item.desc.toLowerCase().includes(q) && !item.category.toLowerCase().includes(q)) {
          return;
        }
        if (!groups[item.category]) groups[item.category] = [];
        groups[item.category].push(key);
      });

      const groupNames = Object.keys(groups).sort();

      if (groupNames.length === 0) {
        statusSearchResults.innerHTML = '<div style="padding: 16px; color: var(--text-muted); font-size: 12px;">Ничего не найдено по вашему запросу.</div>';
        return;
      }

      groupNames.forEach(groupName => {
        const groupTitle = document.createElement("div");
        groupTitle.className = "fields-type-title";
        groupTitle.style.margin = "6px 10px";
        groupTitle.innerHTML = `<span>${groupName}</span><span>${groups[groupName].length}</span>`;
        statusSearchResults.appendChild(groupTitle);

        groups[groupName].forEach(key => {
          const item = STATUS_EFFECTS[key];
          const div = document.createElement("div");
          div.className = "db-item";
          div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="db-item-key">"${key}"</span>
              <span style="font-size: 10px; color: var(--accent-purple); font-family: var(--font-mono);">StatusEffect</span>
            </div>
            <div class="db-item-desc">${item.desc}</div>
            <button class="btn" style="padding: 2px 8px; font-size: 10px; align-self: flex-start; margin-top: 4px;">Вставить в код</button>
          `;
          div.querySelector("button").addEventListener("click", () => {
            insertSnippet(item.example);
          });
          statusSearchResults.appendChild(div);
        });
      });
    }

    function refreshKbViews() {
      renderDatabase(dbSearchInput.value);
      renderBullets(bulletSearchInput.value);
      renderStatusEffects(statusSearchInput.value);
    }

    // COLOR/FX DATA & RENDER

    const COLOR_TAGS = {
      "[scarlet]": { hex: "#e55454", desc: "Стандартный «вражеский» красный, используется для урона и угроз." },
      "[crimson]": { hex: "#dc143c", desc: "Насыщенный тёмно-красный, чуть глубже scarlet." },
      "[accent]": { hex: "#ffd37f", desc: "Акцентный тёплый жёлто-оранжевый — основной цвет подсветки UI Mindustry." },
      "[unlaunched]": { hex: "#585858", desc: "Серый — используется для неактивных/недоступных элементов." },
      "[highlight]": { hex: "#8988c7", desc: "Мягкий сиреневый для второстепенного выделения текста." },
      "[stat]": { hex: "#a9d8ff", desc: "Голубой — цвет числовых характеристик (статов) в описаниях." },
      "[health]": { hex: "#fc9295", desc: "Розово-красный — используется для отображения здоровья/урона в тексте." },
      "[negstat]": { hex: "#ff6462", desc: "Красный для отрицательных модификаторов характеристик." },
      "[white]": { hex: "#ffffff", desc: "Чистый белый, нейтральный акцент." },
      "[lightgray]": { hex: "#c1c1c1", desc: "Светло-серый, для второстепенного текста." },
      "[gray]": { hex: "#8f8f8f", desc: "Средне-серый, для приглушённого текста." },
      "[darkgray]": { hex: "#404040", desc: "Тёмно-серый, для теней/фоновых надписей." },
      "[black]": { hex: "#000000", desc: "Чёрный." },
      "[green]": { hex: "#61e156", desc: "Зелёный, обычно значит «безопасно»/«положительно»." },
      "[forest]": { hex: "#228b22", desc: "Лесной зелёный, более тёмный оттенок." },
      "[sky]": { hex: "#87ceeb", desc: "Небесно-голубой." },
      "[royal]": { hex: "#4169e1", desc: "Насыщенный королевский синий." },
      "[blue]": { hex: "#3c78d8", desc: "Стандартный синий, часто применяется для жидкостей/энергии." },
      "[cyan]": { hex: "#00ffff", desc: "Циан — часто для лазерного/электрического оружия." },
      "[teal]": { hex: "#008080", desc: "Сине-зелёный, спокойный акцент." },
      "[purple]": { hex: "#a349a4", desc: "Фиолетовый, часто для урона/аномалий и логики." },
      "[violet]": { hex: "#8b00ff", desc: "Насыщенный фиолетово-синий." },
      "[magenta]": { hex: "#ff00ff", desc: "Пурпурный, редкий яркий акцент." },
      "[pink]": { hex: "#ff69b4", desc: "Розовый." },
      "[orange]": { hex: "#ffa500", desc: "Оранжевый — часто для огня/меди." },
      "[gold]": { hex: "#ffd700", desc: "Золотой — используется для валют/наград." },
      "[yellow]": { hex: "#ffff00", desc: "Жёлтый, привлекает внимание (предупреждения)." },
      "[brown]": { hex: "#8b5a2b", desc: "Коричневый, для земли/дерева/ресурсов." },
      "[tan]": { hex: "#d2b48c", desc: "Бежево-песочный." },
      "[olive]": { hex: "#808000", desc: "Оливковый." },
      "[maroon]": { hex: "#800000", desc: "Тёмно-бордовый." },
      "[coral]": { hex: "#ff7f50", desc: "Коралловый, тёплый розово-оранжевый." },
      "[salmon]": { hex: "#fa8072", desc: "Лососевый." }
    };

    const MISC_FX = {
      "shootSmall": { category: "Стрельба", desc: "Небольшая вспышка/дым у ствола при выстреле лёгким оружием.", example: '"shootEffect": "shootSmall"' },
      "shootBig": { category: "Стрельба", desc: "Крупная вспышка выстрела для тяжёлых орудий/пушек.", example: '"shootEffect": "shootBig"' },
      "shootBigColor": { category: "Стрельба", desc: "Как shootBig, но окрашивается в цвет снаряда/оружия.", example: '"shootEffect": "shootBigColor"' },
      "muzzleSmoke": { category: "Стрельба", desc: "Дымок из дула сразу после выстрела, держится недолго.", example: '"shootEffect": "muzzleSmoke"' },
      "casing1": { category: "Стрельба", desc: "Вылетающая стреляная гильза (лёгкое оружие).", example: '"ejectEffect": "casing1"' },
      "casing2": { category: "Стрельба", desc: "Вылетающая гильза среднего калибра.", example: '"ejectEffect": "casing2"' },
      "casing3": { category: "Стрельба", desc: "Крупная гильза для тяжёлых орудий.", example: '"ejectEffect": "casing3"' },
      "hitBulletSmall": { category: "Попадание", desc: "Небольшая искра/вспышка в точке попадания обычной пули.", example: '"hitEffect": "hitBulletSmall"' },
      "hitBulletColor": { category: "Попадание", desc: "Вспышка попадания, окрашенная в цвет самого снаряда.", example: '"hitEffect": "hitBulletColor"' },
      "hitLaser": { category: "Попадание", desc: "Эффект попадания лазерного луча — яркая линия/вспышка.", example: '"hitEffect": "hitLaser"' },
      "hitLaserColor": { category: "Попадание", desc: "Как hitLaser, но с окраской под цвет луча.", example: '"hitEffect": "hitLaserColor"' },
      "flakExplosion": { category: "Взрывы", desc: "Небольшой воздушный взрыв, типичный для зенитных (flak) снарядов.", example: '"hitEffect": "flakExplosion"' },
      "blastExplosion": { category: "Взрывы", desc: "Средний фугасный взрыв с осколками и вспышкой.", example: '"hitEffect": "blastExplosion"' },
      "massiveExplosion": { category: "Взрывы", desc: "Крупный экранный взрыв — для очень мощных снарядов/боеголовок.", example: '"hitEffect": "massiveExplosion"' },
      "dynamicExplosion": { category: "Взрывы", desc: "Взрыв, масштабирующийся под радиус splashDamageRadius снаряда.", example: '"hitEffect": "dynamicExplosion"' },
      "smokeCloud": { category: "Окружение", desc: "Клуб дыма, часто применяется при разрушении блоков.", example: '"destroyEffect": "smokeCloud"' },
      "sparkExplosion": { category: "Взрывы", desc: "Взрыв с электрическими искрами, характерен для энергетического оружия.", example: '"hitEffect": "sparkExplosion"' },
      "trailFade": { category: "След", desc: "Плавно исчезающий след за снарядом (для полей trailEffect/trailLength).", example: '"trailEffect": "trailFade"' },
      "regenParticle": { category: "Прочее", desc: "Частица восстановления, используется у полей регенерации здоровья/щита.", example: '"healEffect": "regenParticle"' }
    };

    function renderColorsAndFx(filter = "") {
      colorsSearchResults.innerHTML = "";
      const q = filter.toLowerCase().trim();
      let anyRendered = false;

      const colorHeader = document.createElement("div");
      colorHeader.className = "fields-type-title";
      colorHeader.style.margin = "6px 10px";
      colorHeader.innerHTML = `<span>Цветовые теги [tag]</span><span></span>`;

      const colorKeys = Object.keys(COLOR_TAGS).filter(tag => {
        const item = COLOR_TAGS[tag];
        return !q || tag.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q) || item.hex.toLowerCase().includes(q);
      });

      if (colorKeys.length > 0) {
        colorHeader.querySelector("span:last-child").textContent = colorKeys.length;
        colorsSearchResults.appendChild(colorHeader);
        colorKeys.forEach(tag => {
          const item = COLOR_TAGS[tag];
          const row = document.createElement("div");
          row.className = "swatch-row";
          row.innerHTML = `
            <span class="swatch-box" style="background:${item.hex};"></span>
            <span class="swatch-tag">${tag}</span>
            <span class="swatch-desc">${item.desc} — <code>${item.hex}</code></span>
          `;
          row.title = "Клик — скопировать hex-код цвета";
          row.addEventListener("click", () => {
            navigator.clipboard && navigator.clipboard.writeText(item.hex).catch(() => {});
            showToast(`Цвет ${item.hex} скопирован (тег ${tag})`);
          });
          colorsSearchResults.appendChild(row);
        });
        anyRendered = true;
      }

      const fxGroups = {};
      Object.keys(MISC_FX).forEach(key => {
        const item = MISC_FX[key];
        if (q && !key.toLowerCase().includes(q) && !item.desc.toLowerCase().includes(q) && !item.category.toLowerCase().includes(q)) return;
        if (!fxGroups[item.category]) fxGroups[item.category] = [];
        fxGroups[item.category].push(key);
      });

      const fxGroupNames = Object.keys(fxGroups).sort();
      fxGroupNames.forEach(groupName => {
        anyRendered = true;
        const groupTitle = document.createElement("div");
        groupTitle.className = "fields-type-title";
        groupTitle.style.margin = "10px 10px 6px 10px";
        groupTitle.innerHTML = `<span>Fx: ${groupName}</span><span>${fxGroups[groupName].length}</span>`;
        colorsSearchResults.appendChild(groupTitle);

        fxGroups[groupName].forEach(key => {
          const item = MISC_FX[key];
          const div = document.createElement("div");
          div.className = "db-item";
          div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="db-item-key">"${key}"</span>
              <span style="font-size: 10px; color: var(--accent-purple); font-family: var(--font-mono);">Fx</span>
            </div>
            <div class="db-item-desc">${item.desc}</div>
            <button class="btn" style="padding: 2px 8px; font-size: 10px; align-self: flex-start; margin-top: 4px;">Вставить в код</button>
          `;
          div.querySelector("button").addEventListener("click", () => {
            insertSnippet(item.example);
          });
          colorsSearchResults.appendChild(div);
        });
      });

      if (!anyRendered) {
        colorsSearchResults.innerHTML = '<div style="padding: 16px; color: var(--text-muted); font-size: 12px;">Ничего не найдено по вашему запросу.</div>';
      }
    }
