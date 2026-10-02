// ============================================================
// Движок симулятора оружия/юнитов (canvas)
// (часть модуля mindustry-studio; оборачивается build.py)
// ============================================================

    // SIMULATOR ENGINE

    const TARGET_BASE_HP = 1000;
    const SIM_CENTER = { x: 170, y: 170 };
    const SIM_SCALE = 0.55;

    const SIM = {
      canvas: null, ctx: null,
      running: false,
      targetDragMode: false,
      speed: 1,
      showRadii: true,
      scene: null,
      bullets: [],
      effects: [],
      weaponState: [],
      abilityState: [],
      unitState: { x: 0, y: 0, angle: -90, vx: 0, vy: 0, legPhase: 0, turretAngle: -90 },
      crafterState: { progress: 0 },
      wallState: { hp: 100, maxHp: 100, timer: 100, flash: 0, dead: false, deathTimer: 0, shield: 0, shieldMax: 0, status: null, statusTimer: 0, statusMaxTimer: 0, statusDps: 0, statusColor: null, immuneFlash: 0 },
      target: { x: 110, y: -70, hp: TARGET_BASE_HP, maxHp: TARGET_BASE_HP, size: 14, status: null, statusTimer: 0, statusMaxTimer: 0, statusDps: 0, statusColor: null },
      lastFrameTime: null,
      rafId: null,
      tick: 0,
      _debounce: null,

      mode: "combat",
      autoFire: true,
      autoRespawn: false,
      kb: { up: false, down: false, left: false, right: false, fire: false },
      pad: { up: false, down: false, left: false, right: false, fire: false },
      enemyDamage: null
    };
    const SIM_MANUAL_LIMIT = 290;
    function simCtl(name) { return !!(SIM.kb[name] || SIM.pad[name]); }
    function simAutoEnemyDamage(s) { return Math.max(5, ((s && s.body && s.body.health) || 400) * 0.04); }
    function simEnemyDamageValue(s) { return SIM.enemyDamage != null ? SIM.enemyDamage : simAutoEnemyDamage(s); }

    function simNum(v, d) { return (typeof v === "number" && isFinite(v)) ? v : d; }

    const STATUS_TABLE = {
      burning:   { dps: 0.045, color: "#ff9b54" },
      melting:   { dps: 0.09,  color: "#ff6b3d" },
      corroded:  { dps: 0.025, color: "#8bc34a" },
      toxic:     { dps: 0.03,  color: "#7bd142" },
      napalm:    { dps: 0.045, color: "#ff9b54" },
      irradiated:{ dps: 0.03,  color: "#a5f34e" },
      blasted:   { dps: 0.015, color: "#ffb3b3" },
      shocked:   { dps: 0,     color: "#f6e35c" },
      wet:       { dps: 0,     color: "#5cc6f6" },
      freezing:  { dps: 0,     color: "#9be7ff" },
      tarred:    { dps: 0,     color: "#4b3b2a" },
      sporeslowed:{ dps: 0,    color: "#bb7de0" },
      disarmed:  { dps: 0,     color: "#8b949e" },
      overclock: { dps: 0,     color: "#ffd76a" }
    };
    function simStatusInfo(name) {
      if (!name) return null;
      const key = String(name).toLowerCase().replace(/[^a-z]/g, "");
      for (const k in STATUS_TABLE) if (key.includes(k)) return STATUS_TABLE[k];

      return { dps: 0.02, color: "#bc8cff" };
    }

    function simW2S(x, y) { return { x: SIM_CENTER.x + x * SIM_SCALE, y: SIM_CENTER.y + y * SIM_SCALE }; }
    function simS2W(x, y) { return { x: (x - SIM_CENTER.x) / SIM_SCALE, y: (y - SIM_CENTER.y) / SIM_SCALE }; }

    function simAngleLerp(cur, target, maxDelta) {
      let diff = ((target - cur + 540) % 360) - 180;
      if (Math.abs(diff) < maxDelta || maxDelta <= 0) return target;
      return cur + Math.sign(diff) * maxDelta;
    }
    function simAngleLerpRad(cur, target, maxDelta) {
      let diff = ((target - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      if (Math.abs(diff) < maxDelta || maxDelta <= 0) return target;
      return cur + Math.sign(diff) * maxDelta;
    }

    // --- ЦВЕТА ---

    function simColor(value, fallback) {
      if (typeof value !== "string") return fallback;
      const c = value.trim();
      if (!c) return fallback;
      if (/^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c)) return c[0] === "#" ? c : "#" + c;
      try { if (typeof CSS !== "undefined" && CSS.supports && CSS.supports("color", c)) return c; } catch (e) {}
      return fallback;
    }
    function simFirstColor(list, fallback) {
      for (const v of list) { const c = simColor(v, null); if (c) return c; }
      return fallback;
    }

    function simStop(grad, pos, color) {
      try { grad.addColorStop(pos, color); }
      catch (e) { try { grad.addColorStop(pos, "#ffcd75"); } catch (e2) {} }
    }

    function simParseBullet(b) {
      const src = b || {};
      const typeName = String(src.type || "BasicBulletType");
      let category = "basic";
      if (/Laser/i.test(typeName)) category = "laser";
      else if (/Missile/i.test(typeName)) category = "missile";
      else if (/Artillery|Flak/i.test(typeName)) category = "artillery";
      else if (/Lightning/i.test(typeName)) category = "lightning";
      else if (/Continuous|Liquid/i.test(typeName)) category = "continuous";
      return {
        typeName, category,
        damage: simNum(src.damage, 5),
        speed: simNum(src.speed, category === "laser" ? 9 : 3),
        lifetime: simNum(src.lifetime, category === "laser" ? 12 : 40),
        width: simNum(src.width, 3), height: simNum(src.height, 9),
        splashDamage: simNum(src.splashDamage, 0),
        splashDamageRadius: simNum(src.splashDamageRadius, 0),
        homingPower: simNum(src.homingPower, 0),
        homingRange: simNum(src.homingRange, 50),
        pierce: !!src.pierce || category === "laser",
        pierceCap: simNum(src.pierceCap, -1),
        pierceDamageFactor: simNum(src.pierceDamageFactor, 0.6),
        gravity: !!src.gravity || category === "artillery",
        lightningChance: simNum(src.lightningChance, category === "lightning" ? 1 : 0),
        lightningDamage: simNum(src.lightningDamage, simNum(src.damage, 10) * 0.5),
        lightningLength: simNum(src.lightningLength, 7),
        status: src.status || null,
        statusDuration: simNum(src.statusDuration, 60),

        reflectable: src.reflectable !== false,
        color: simFirstColor([src.hitColor, src.backColor, src.frontColor, src.trailColor], category === "laser" ? "#a6fffa" : "#ffcd75"),
        frag: src.fragBullet ? simParseBullet(src.fragBullet) : null,
        fragBullets: Math.max(1, Math.round(simNum(src.fragBullets, 3))),
        fragSpread: simNum(src.fragSpread, 18),
        fragVelocityMin: simNum(src.fragVelocityMin, 0.2),
        fragVelocityMax: simNum(src.fragVelocityMax, 1)
      };
    }

    function simParseWeapon(w, body, topLevel) {
      const src = w || {};
      let bulletSrc = src.bullet;
      if (!bulletSrc && src.ammoTypes && typeof src.ammoTypes === "object" && !Array.isArray(src.ammoTypes)) {
        const firstKey = Object.keys(src.ammoTypes)[0];
        const val = firstKey != null ? src.ammoTypes[firstKey] : null;
        if (val && typeof val === "object") bulletSrc = val;
      }
      if (!bulletSrc && src.shootType && typeof src.shootType === "object") bulletSrc = src.shootType;
      return {
        x: simNum(src.x, 0), y: simNum(src.y, 0),
        shootY: simNum(src.shootY, 4),
        reload: simNum(src.reload, 60),
        range: simNum(src.range, body.range || 120) || 120,
        rotate: src.rotate !== false,
        rotateSpeed: simNum(src.rotateSpeed, 3),
        shootCone: simNum(src.shootCone, 6),
        inaccuracy: simNum(src.inaccuracy, 0),
        shots: Math.max(1, Math.round(simNum((src.shoot && src.shoot.shots), simNum(src.shots, 1)))),
        recoil: simNum(src.recoil, 1.5),
        recoilTime: simNum(src.recoilTime, simNum(src.reload, 60)),
        firstShotDelay: simNum(src.firstShotDelay, 0),
        mirror: src.mirror !== false,
        alternate: !!src.alternate,
        top: !!topLevel,

        shootPattern: (() => {
          const t = String((src.shoot && src.shoot.type) || src.shootPattern || "").toLowerCase();
          if (t.includes("spread")) return "spread";
          if (t.includes("alternate")) return "alternate";
          if (t.includes("helix")) return "helix";
          if (t.includes("sine")) return "sine";
          if (t.includes("multi")) return "multi";
          return "default";
        })(),
        shotDelay: simNum((src.shoot && src.shoot.shotDelay), simNum(src.shotDelay, 0)),
        spread: simNum((src.shoot && src.shoot.spread), simNum(src.spread, 10)),
        shootMag: simNum((src.shoot && src.shoot.mag), 3),
        shootScl: simNum((src.shoot && src.shoot.scl), 2),

        minRange: simNum(src.minRange, 0),

        hasWarmup: !!(src.warmup || src.minWarmup || src.shootWarmupSpeed || src.linearWarmup),
        minWarmup: simNum(src.minWarmup, 0),
        shootWarmupSpeed: simNum(src.shootWarmupSpeed, 0.08),
        linearWarmup: !!src.linearWarmup,
        warmupMaintainTime: simNum(src.warmupMaintainTime, 0),
        bullet: simParseBullet(bulletSrc || {})
      };
    }

    function simParseAbility(a) {
      if (!a || typeof a !== "object") return null;
      const t = String(a.type || "");
      if (/ForceField/i.test(t)) return { kind: "forcefield", radius: simNum(a.radius, 60), max: simNum(a.max, 900), regen: simNum(a.regen, 4), cur: simNum(a.max, 900) };
      if (/RepairField/i.test(t)) return { kind: "repair", reload: simNum(a.reload, 200), range: simNum(a.range, 60), amount: simNum(a.amount, 50) };
      if (/Regen/i.test(t)) return { kind: "regen", percentAmount: simNum(a.percentAmount, 0.05) };
      return { kind: "other" };
    }

    function simParseScene(text) {
      let json;
      try { json = tryParseJson(text); } catch (e) { return null; }
      if (!json || typeof json !== "object" || Array.isArray(json)) return null;

      const type = String(json.type || "");
      let kind = "generic";
      if (/Turret/i.test(type)) kind = "turret";
      else if (/Wall/i.test(type)) kind = "wall";
      else if (/Crafter|Drill|Pump/i.test(type)) kind = "crafter";
      else if (/Conveyor|Duct|Router|Sorter/i.test(type)) kind = "conveyor";
      else if (Array.isArray(json.weapons) || json.hitSize != null || /Unit/i.test(type) || json.flying != null || json.legCount != null) kind = "unit";

      let unitSub = "flying";
      if (kind === "unit") {
        if (/Mech/i.test(type)) unitSub = "mech";
        else if (/Legs/i.test(type)) unitSub = "legs";
        else if (/Tank/i.test(type)) unitSub = "tank";
        else if (/Flying|Hover|Copter|Ship/i.test(type)) unitSub = "flying";
        else if (json.legCount) unitSub = "legs";
        else if (json.treadRects || json.trackRects) unitSub = "tank";
        else if (json.mechFrontSway != null || json.mechStride != null) unitSub = "mech";
        else unitSub = (json.flying === false) ? "mech" : "flying";
      }

      const body = {
        size: simNum(json.size, 1),
        health: simNum(json.health, kind === "wall" ? 600 : (kind === "unit" ? 200 : 100)),
        armor: simNum(json.armor, 0),
        hitSize: simNum(json.hitSize, kind === "unit" ? simNum(json.size, 1) * 8 + 6 : simNum(json.size, 1) * 8),
        speed: simNum(json.speed, kind === "unit" ? 1.1 : 0),
        accel: simNum(json.accel, 0.5),
        drag: simNum(json.drag, 0.4),
        rotateSpeed: simNum(json.rotateSpeed, 5),
        range: simNum(json.range, 0),

        immunities: Array.isArray(json.immunities) ? json.immunities.map(x => String(x).toLowerCase()) : []
      };

      let weapons = [];
      if (kind === "turret") {
        if (Array.isArray(json.weapons) && json.weapons.length) {
          weapons = json.weapons.map(w => simParseWeapon(w, body));
        } else if (json.weapon && typeof json.weapon === "object") {
          weapons = [simParseWeapon(json.weapon, body)];
        } else {
          weapons = [simParseWeapon(json, body, true)];
        }
      } else if (kind === "unit" && Array.isArray(json.weapons) && json.weapons.length) {
        weapons = json.weapons.map(w => simParseWeapon(w, body));
      }

      const abilities = Array.isArray(json.abilities) ? json.abilities.map(simParseAbility).filter(Boolean) : [];

      return {
        kind, unitSub, type, name: json.name || type || "объект",
        body, weapons, abilities,
        craftTime: simNum(json.craftTime, 90),
        outputItem: json.outputItem || null,
        outputLiquid: json.outputLiquid || null,
        chanceDeflect: simNum(json.chanceDeflect, 0),

        absorbLasers: !!json.absorbLasers,
        lightningChance: simNum(json.lightningChance, 0),
        lightningLength: simNum(json.lightningLength, 14),
        color: simFirstColor([json.color, json.hitColor, json.frontColor], "#ffcd75")
      };
    }

    // --- РУНТАЙМ-СОСТОЯНИЕ ---
    function simBuildRuntime() {
      const s = SIM.scene;
      SIM.bullets = [];
      SIM.effects = [];
      SIM.weaponState = (s ? s.weapons : []).map(() => ({ cooldown: 0, angle: -90, recoilAmt: 0, charge: 0, warmup: 0, warmupHold: 0, queue: [] }));
      SIM.abilityState = (s ? s.abilities : []).map(a => Object.assign({ timer: 0 }, a));
      SIM.crafterState = { progress: 0 };
      const maxHp = s ? s.body.health : 100;
      const shieldAbility = (s ? s.abilities : []).find(a => a.kind === "forcefield");
      SIM.wallState = {
        hp: maxHp, maxHp, timer: 100, flash: 0,
        dead: false, deathTimer: 0,
        shield: shieldAbility ? shieldAbility.cur : 0,
        shieldMax: shieldAbility ? shieldAbility.max : 0,
        status: null, statusTimer: 0, statusMaxTimer: 0, statusDps: 0, statusColor: null, immuneFlash: 0
      };
      SIM.unitState = { x: 0, y: 0, angle: -90, vx: 0, vy: 0, legPhase: 0, turretAngle: -90, strafeDir: 1, strafeTimer: 0 };
      SIM.target.hp = SIM.target.maxHp;
      SIM.target.status = null;
      SIM.target.statusDps = 0;
      simSyncTargetHpInputs();
    }

    function simSyncTargetHpInputs() {
      const hpInput = document.getElementById("simTargetHp");
      const maxInput = document.getElementById("simTargetMaxHp");
      if (hpInput) { hpInput.max = SIM.target.maxHp; hpInput.value = Math.round(SIM.target.hp); }
      if (maxInput) maxInput.value = Math.round(SIM.target.maxHp);
    }

    function simRebuildFromEditor() {
      const scene = simParseScene(editor.value);
      SIM.scene = scene;
      simBuildRuntime();
      const kindNames = { turret: "Турель", unit: "Юнит", wall: "Стена", crafter: "Фабрика/добыча", conveyor: "Логистика", generic: "Обычный блок" };
      const tagEl = document.getElementById("simKindTag");
      const hintEl = document.getElementById("simEmptyHint");
      if (!tagEl || !hintEl) return;
      if (scene) {
        tagEl.textContent = (kindNames[scene.kind] || scene.kind) + (scene.kind === "unit" ? " · " + scene.unitSub : "") + " — " + scene.name;
        hintEl.style.display = "none";
      } else {
        tagEl.textContent = "—";
        hintEl.style.display = "block";
      }
      if (typeof simUpdateModeUI === "function") { simUpdateModeUI(); simSyncEnemyDamageUI(); }
    }

    // SIM MODES JS
    function simClearControls() {
      Object.keys(SIM.kb).forEach(k => { SIM.kb[k] = false; SIM.pad[k] = false; });
      document.querySelectorAll("#simControlsCard [data-ctl], #simControlsCard [data-k]").forEach(b => b.classList.remove("active"));
    }

    function simUpdateModeUI() {
      const manual = SIM.mode === "manual";
      const isUnit = !!(SIM.scene && SIM.scene.kind === "unit");
      const bc = document.getElementById("btnSimModeCombat"), bm = document.getElementById("btnSimModeManual");
      if (!bc || !bm) return;
      bc.classList.toggle("btn-mind", !manual);
      bm.classList.toggle("btn-mind", manual);
      document.getElementById("simControlsCard").style.display = manual ? "" : "none";
      document.getElementById("simModeHint").textContent = manual
        ? "Враг не атакует, юнитом управляете вы."
        : "Враг стреляет по объекту, юнит действует сам.";

      const hasWeapons = !!(SIM.scene && SIM.scene.weapons && SIM.scene.weapons.length);
      document.querySelectorAll("#simDpad button").forEach(el => { el.disabled = manual && !isUnit; });
      document.getElementById("btnSimFire").disabled = manual && !hasWeapons;
      document.getElementById("simAutoFire").disabled = manual && !hasWeapons;
      const hint = document.getElementById("simControlsHint");
      hint.classList.remove("sim-hint-kb");
      hint.textContent = isUnit ? "" : hasWeapons
        ? "Двигаться могут только юниты. «Огонь» стреляет независимо от дальности, авто-огонь можно отключить."
        : "У этого объекта нет оружия и движения — управлять нечем.";
      hint.style.display = hint.textContent ? "" : "none";

      const kbd = (k, t) => '<kbd data-k="' + k + '">' + t + '</kbd>';
      document.getElementById("simKeysHint").innerHTML = isUnit
        ? "⌨️ " + kbd("up", "W") + kbd("left", "A") + kbd("down", "S") + kbd("right", "D") + " / стрелки — движение · " + kbd("fire", "Пробел") + " — стрелять"
        : hasWeapons ? "⌨️ " + kbd("fire", "Пробел") + " — стрелять" : "";
      const enemyCard = document.getElementById("simEnemyCard");
      enemyCard.classList.toggle("sim-card-disabled", manual);
      enemyCard.querySelectorAll("input, button").forEach(el => { el.disabled = manual; });
      document.getElementById("simEnemyHint").textContent = manual
        ? "В ручном режиме враг не атакует — урон не используется. Переключитесь на «Бой»."
        : "Враг (красная цель) стреляет по вашему объекту раз в ~100 тиков. Статусы на его снарядах остаются.";
    }

    function simSetMode(mode) {
      if (mode !== "combat" && mode !== "manual") return;
      if (SIM.mode === mode) return;
      SIM.mode = mode;
      simClearControls();
      simBuildRuntime();
      if (mode === "manual") SIM.running = true;
      simUpdateModeUI();
    }

    function simSyncEnemyDamageUI() {
      const num = document.getElementById("simEnemyDamage"), rng = document.getElementById("simEnemyDamageRange");
      const tag = document.getElementById("simEnemyAutoTag");
      if (!num || !rng || !tag) return;
      const auto = simAutoEnemyDamage(SIM.scene);
      const val = simEnemyDamageValue(SIM.scene);
      const shown = Math.round(val * 10) / 10;
      if (document.activeElement !== num) num.value = shown;
      rng.max = Math.max(200, Math.ceil(auto * 5), Math.ceil(val));
      rng.value = val;
      tag.textContent = SIM.enemyDamage == null ? "авто" : "вручную · авто " + (Math.round(auto * 10) / 10);
    }

    function simSetEnemyDamage(v) {
      if (v == null || !isFinite(v)) SIM.enemyDamage = null;
      else SIM.enemyDamage = Math.max(0, v);
      simSyncEnemyDamageUI();
    }

    function simInitModes() {
      document.getElementById("btnSimModeCombat").addEventListener("click", () => simSetMode("combat"));
      document.getElementById("btnSimModeManual").addEventListener("click", () => simSetMode("manual"));
      document.getElementById("simAutoFire").addEventListener("change", (e) => { SIM.autoFire = e.target.checked; });
      document.getElementById("simAutoRespawn").addEventListener("change", (e) => { SIM.autoRespawn = e.target.checked; });
      document.getElementById("btnSimStop").addEventListener("click", () => { SIM.kb.up = SIM.kb.down = SIM.kb.left = SIM.kb.right = false; SIM.pad.up = SIM.pad.down = SIM.pad.left = SIM.pad.right = false; SIM.unitState.vx = 0; SIM.unitState.vy = 0; });

      document.querySelectorAll("#simControlsCard [data-ctl]").forEach(btn => {
        const name = btn.dataset.ctl;
        const press = (e) => {
          e.preventDefault();
          if (btn.disabled) return;
          SIM.pad[name] = true; btn.classList.add("active");
          try { btn.setPointerCapture(e.pointerId); } catch (err) {}
        };
        const release = () => { SIM.pad[name] = false; if (!SIM.kb[name]) btn.classList.remove("active"); };
        btn.addEventListener("pointerdown", press);
        btn.addEventListener("pointerup", release);
        btn.addEventListener("pointercancel", release);
        btn.addEventListener("lostpointercapture", release);
        btn.addEventListener("contextmenu", (e) => e.preventDefault());
      });

      const KEYMAP = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "fire" };
      const simTabVisible = () => document.getElementById("tabSimContent").style.display !== "none";
      const typing = (t) => t && (t.tagName === "INPUT" && t.type !== "checkbox" && t.type !== "range" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      const keyActive = (e) => SIM.mode === "manual" && simTabVisible() && !typing(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey;
      window.addEventListener("keydown", (e) => {
        const name = KEYMAP[e.code];
        if (!name || !keyActive(e)) return;
        e.preventDefault();
        SIM.kb[name] = true;
        document.querySelectorAll('#simControlsCard [data-ctl="' + name + '"], #simControlsCard [data-k="' + name + '"]').forEach(el => el.classList.add("active"));
      });
      window.addEventListener("keyup", (e) => {
        const name = KEYMAP[e.code];
        if (!name) return;
        if (SIM.kb[name]) e.preventDefault();
        SIM.kb[name] = false;
        document.querySelectorAll('#simControlsCard [data-ctl="' + name + '"], #simControlsCard [data-k="' + name + '"]').forEach(el => { if (!SIM.pad[name]) el.classList.remove("active"); });
      });
      window.addEventListener("blur", simClearControls);
      document.addEventListener("visibilitychange", () => { if (document.hidden) simClearControls(); });

      const num = document.getElementById("simEnemyDamage"), rng = document.getElementById("simEnemyDamageRange");
      num.addEventListener("input", () => {
        const v = parseFloat(num.value);
        if (num.value === "" || !isFinite(v)) return;
        simSetEnemyDamage(v);
      });
      num.addEventListener("blur", () => simSyncEnemyDamageUI());
      rng.addEventListener("input", () => simSetEnemyDamage(parseFloat(rng.value)));
      document.getElementById("btnEnemyDmgHalf").addEventListener("click", () => simSetEnemyDamage(Math.round(simEnemyDamageValue(SIM.scene) * 5) / 10));
      document.getElementById("btnEnemyDmgDouble").addEventListener("click", () => simSetEnemyDamage(Math.round(simEnemyDamageValue(SIM.scene) * 20) / 10));
      document.getElementById("btnEnemyDmgAuto").addEventListener("click", () => simSetEnemyDamage(null));

      simUpdateModeUI();
      simSyncEnemyDamageUI();
    }

    function simOnEditorChange() {
      clearTimeout(SIM._debounce);
      SIM._debounce = setTimeout(simRebuildFromEditor, 300);
    }

    function simOnTabOpen() {
      simRebuildFromEditor();
    }

    function simResetSim() {
      simClearControls();
      simBuildRuntime();

      SIM.running = SIM.mode === "manual";
    }

    // --- ЭФФЕКТЫ И СНАРЯДЫ ---

    const MAX_BULLETS = 500;
    function simPushBullet(b) {
      if (SIM.bullets.length >= MAX_BULLETS) {

        if (SIM._inBulletLoop) return;

        SIM.bullets.shift();
      }
      SIM.bullets.push(b);
    }

    function simSpawnEffect(x, y, type, dur, color, radius, angle) {
      SIM.effects.push({ x, y, type, t: 0, dur: dur || 14, color: color || "#ffcd75", radius: radius || 0, angle: angle || 0 });
    }

    function simSpawnBurst(x, y, color, count, speed) {
      count = count || 6;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (speed || 1.4) * (0.5 + Math.random() * 0.8);
        SIM.effects.push({
          type: "spark", x, y, t: 0, dur: 10 + Math.random() * 6,
          color, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp
        });
      }
    }

    function simSpawnLightning(x, y, len, color) {
      let angle = Math.random() * Math.PI * 2;
      let cx = x, cy = y;
      const points = [{ x: cx, y: cy }];
      const segs = 4;
      for (let i = 0; i < segs; i++) {
        angle += (Math.random() - 0.5) * 1.3;
        cx += Math.cos(angle) * (len / segs);
        cy += Math.sin(angle) * (len / segs);
        points.push({ x: cx, y: cy });
      }
      SIM.effects.push({ type: "lightning", points, t: 0, dur: 12, color: color || "#8be9fd" });
    }

    function simSpawnBulletObj(bt, x, y, angle) {
      return { x, y, vx: Math.cos(angle) * bt.speed, vy: Math.sin(angle) * bt.speed, life: bt.lifetime, bt, pierced: 0 };
    }

    function simQueueShots(w, st, wx, wy, angle) {
      st.queue = st.queue || [];
      for (let i = 0; i < w.shots; i++) {
        st.queue.push({ t: i * w.shotDelay, i, wx, wy, angle });
      }
    }

    function simFireQueuedShot(w, shot) {
      const { wx, wy, angle, i } = shot;
      const rad = angle * Math.PI / 180;
      const n = w.shots;
      let angleOffsetDeg = 0, lateralOffset = 0;
      switch (w.shootPattern) {
        case "spread":

          angleOffsetDeg = (i - (n - 1) / 2) * w.spread;
          break;
        case "alternate":

          lateralOffset = (i % 2 === 0 ? 1 : -1) * (w.shootY || 4);
          break;
        case "helix":

          lateralOffset = Math.sin(i * w.shootScl) * w.shootMag;
          angleOffsetDeg = Math.cos(i * w.shootScl) * w.shootMag * 3;
          break;
        case "sine":

          lateralOffset = Math.sin(i * w.shootScl) * w.shootMag;
          break;
        case "multi":

          angleOffsetDeg = (i % 2 === 0 ? 1 : -1) * w.spread * 0.6;
          break;
        default:
          break;
      }
      const sides = w.mirror ? [1, -1] : [1];
      sides.forEach((side, si) => {
        if (w.alternate && sides.length > 1 && (i % 2) !== si) return;
        const inaccuracy = (Math.random() * 2 - 1) * w.inaccuracy * Math.PI / 180;
        const a = rad + inaccuracy + angleOffsetDeg * Math.PI / 180;
        const sideOffset = (w.mirror ? side * 4 : 0) + lateralOffset * side;
        const sx = wx + Math.cos(rad + Math.PI / 2) * sideOffset;
        const sy = wy + Math.sin(rad + Math.PI / 2) * sideOffset;
        simPushBullet(simSpawnBulletObj(w.bullet, sx, sy, a));
      });
      simSpawnEffect(wx, wy, "shoot", 8, w.bullet.color, 0, rad);
    }

    function simApplyDamage(tgt, dmg) {
      tgt.hp = Math.max(0, tgt.hp - Math.max(0, dmg));
    }

    function simApplyHit(b, bt, tgt, directHit) {
      if (directHit) {
        let dmg = bt.damage;
        if (b.pierced) dmg *= Math.pow(bt.pierceDamageFactor, b.pierced);
        simApplyDamage(tgt, dmg);
        simSpawnEffect(b.x, b.y, "hit", 14, bt.color);
        simSpawnBurst(b.x, b.y, bt.color, 5, 1.2);
      }
      if (bt.splashDamageRadius > 0 && bt.splashDamage > 0) {
        const d = Math.hypot(tgt.x - b.x, tgt.y - b.y);
        if (d <= bt.splashDamageRadius) {

          const falloff = 1 - (d / bt.splashDamageRadius) * 0.75;
          simApplyDamage(tgt, bt.splashDamage * Math.max(0.15, falloff));
        }
        simSpawnEffect(b.x, b.y, "splash", 16, bt.color, bt.splashDamageRadius);
      }
      if (bt.status && tgt.hp > 0) {
        tgt.status = bt.status;
        tgt.statusTimer = bt.statusDuration;
        tgt.statusMaxTimer = bt.statusDuration;
        const info = simStatusInfo(bt.status);
        tgt.statusColor = info.color;

        tgt.statusDps = Math.max(tgt.statusDps, bt.damage * info.dps);
      }
      if (bt.frag) {
        const baseAngle = Math.atan2(b.vy, b.vx);
        for (let i = 0; i < bt.fragBullets; i++) {
          const spread = (Math.random() * 2 - 1) * bt.fragSpread * Math.PI / 180;
          const a = baseAngle + spread;
          const velMul = bt.fragVelocityMin + Math.random() * (bt.fragVelocityMax - bt.fragVelocityMin);
          const fb = simSpawnBulletObj(bt.frag, b.x, b.y, a);
          fb.vx *= velMul; fb.vy *= velMul;
          simPushBullet(fb);
        }
      }
      if (bt.lightningChance > 0 && Math.random() < bt.lightningChance) {
        simSpawnLightning(b.x, b.y, bt.lightningLength, bt.color);
        simApplyDamage(tgt, bt.lightningDamage);
      }
    }

    function simTickBullet(dt, idx) {
      const b = SIM.bullets[idx];
      if (!b) return;
      const bt = b.bt;

      if (bt.category !== "laser" && bt.category !== "continuous") {
        (b.trail || (b.trail = [])).push({ x: b.x, y: b.y });
        if (b.trail.length > 6) b.trail.shift();
      }

      if (b.incoming) {

        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        const s = SIM.scene;
        const selfSize = s ? s.body.size * 4 : 8;
        const selfX = (s && s.kind === "unit") ? SIM.unitState.x : 0;
        const selfY = (s && s.kind === "unit") ? SIM.unitState.y : 0;
        const ws = SIM.wallState;
        if (!ws.dead && Math.hypot(b.x - selfX, b.y - selfY) <= selfSize) {
          if (bt.category === "laser" && s.absorbLasers) {

            simSpawnEffect(b.x, b.y, "deflect", 12, "#a6fffa");
          } else if (bt.reflectable !== false && Math.random() * 100 < s.chanceDeflect) {

            const nx = (b.x - selfX) / (selfSize || 1), ny = (b.y - selfY) / (selfSize || 1);
            const dot = b.vx * nx + b.vy * ny;
            b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny;
            b.x += b.vx * dt * 2; b.y += b.vy * dt * 2;
            b.incoming = false;
            b.reflected = true;
            b.life = bt.lifetime;
            simSpawnEffect(b.x, b.y, "deflect", 14, "#8be9fd");
            return;
          } else {
            let dmg = bt.damage;
            if (ws.shieldMax > 0 && ws.shield > 0) {
              const absorbed = Math.min(ws.shield, dmg);
              ws.shield -= absorbed;
              dmg -= absorbed;
              simSpawnEffect(b.x, b.y, "deflect", 10, "#38bdf8");
            }
            if (dmg > 0) {
              ws.hp = Math.max(0, ws.hp - dmg);
              ws.flash = 1;
              simSpawnEffect(b.x, b.y, "hit", 14, bt.color);
            }

            if (bt.status) {
              const key = String(bt.status).toLowerCase();
              if (s.body.immunities.some(im => key.includes(im) || im.includes(key))) {
                ws.immuneFlash = 1;
                simSpawnEffect(b.x, b.y, "deflect", 10, "#9be7ff");
              } else {
                const info = simStatusInfo(bt.status);
                ws.status = bt.status;
                ws.statusTimer = bt.statusDuration;
                ws.statusMaxTimer = bt.statusDuration;
                ws.statusColor = info.color;
                ws.statusDps = Math.max(ws.statusDps, bt.damage * info.dps);
              }
            }
            if (s.lightningChance > 0 && Math.random() < s.lightningChance) {
              simSpawnLightning(b.x, b.y, s.lightningLength, "#8be9fd");
            }
            if (ws.hp <= 0 && !ws.dead) {
              ws.dead = true; ws.deathTimer = 0;
              simStopWeapons();
              simSpawnEffect(selfX, selfY, "explosion", 26, "#f85149", selfSize * 1.6);
              simSpawnBurst(selfX, selfY, "#ffb17a", 8, 1.8);
            }
          }
          SIM.bullets.splice(idx, 1);
        } else if (b.life <= 0) {
          SIM.bullets.splice(idx, 1);
        }
        return;
      }

      if (bt.homingPower > 0) {
        const tgt = SIM.target;
        const dx = tgt.x - b.x, dy = tgt.y - b.y, d = Math.hypot(dx, dy);
        if (d < bt.homingRange && d > 1) {
          const desired = Math.atan2(dy, dx);
          const cur = Math.atan2(b.vy, b.vx);
          const na = simAngleLerpRad(cur, desired, bt.homingPower * dt * 0.6);
          const sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
        }
      }
      if (bt.gravity) b.vy += dt * 0.06;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.life -= dt;

      const tgt = SIM.target;
      const hitDist = Math.hypot(b.x - tgt.x, b.y - tgt.y);
      const hit = tgt.hp > 0 && hitDist <= (tgt.size + bt.width / 2);

      const nearSplash = !hit && tgt.hp > 0 && bt.splashDamageRadius > 0 && hitDist <= bt.splashDamageRadius && b.life <= 0;

      if (hit || nearSplash) {
        simApplyHit(b, bt, tgt, hit);
        if (hit && bt.pierce && (bt.pierceCap < 0 || b.pierced < bt.pierceCap)) {
          b.pierced = (b.pierced || 0) + 1;
        } else {
          SIM.bullets.splice(idx, 1);
        }
      } else if (b.life <= 0) {
        simSpawnEffect(b.x, b.y, "despawn", 10, bt.color);
        SIM.bullets.splice(idx, 1);
      }
    }

    function simTickWeapon(w, idx, dt, originX, originY, baseAngle) {
      const st = SIM.weaponState[idx];
      const tgt = SIM.target;
      const wx = originX + w.x, wy = originY + w.y;
      const dx = tgt.x - wx, dy = tgt.y - wy;
      const dist = Math.hypot(dx, dy);
      const angToTarget = Math.atan2(dy, dx) * 180 / Math.PI;

      if (w.rotate) st.angle = simAngleLerp(st.angle, angToTarget, w.rotateSpeed * dt * 2);
      else st.angle = baseAngle;

      st.recoilAmt = Math.max(0, st.recoilAmt - dt / (w.recoilTime || 30) * 4);
      if (st.cooldown > 0) st.cooldown -= dt;

      const withinRange = dist <= w.range && dist >= w.minRange;
      const angDiff = Math.abs(((angToTarget - st.angle + 540) % 360) - 180);
      const withinCone = !w.rotate || angDiff <= w.shootCone;

      const manual = SIM.mode === "manual";
      const forcedFire = manual && simCtl("fire");
      const autoAllowed = !manual || SIM.autoFire;
      const canEngage = forcedFire || (autoAllowed && withinRange && withinCone && tgt.hp > 0);

      if (SIM.wallState.dead) { st.charge = 0; st.warmup = 0; st.queue = []; return; }

      if (st.queue && st.queue.length) {
        for (let qi = st.queue.length - 1; qi >= 0; qi--) {
          const shot = st.queue[qi];
          shot.t -= dt;
          if (shot.t <= 0) {
            simFireQueuedShot(w, shot);
            st.queue.splice(qi, 1);
          }
        }
      }

      if (w.hasWarmup) {
        if (canEngage) {
          st.warmupHold = w.warmupMaintainTime;
          st.warmup = Math.min(1, st.warmup + w.shootWarmupSpeed * dt);
        } else if (st.warmupHold > 0) {
          st.warmupHold -= dt;
        } else {
          st.warmup = Math.max(0, st.warmup - w.shootWarmupSpeed * dt);
        }
      } else {
        st.warmup = canEngage ? 1 : 0;
      }

      if (canEngage && st.cooldown <= 0 && st.warmup >= w.minWarmup) {
        if (w.firstShotDelay > 0 && st.charge < w.firstShotDelay) { st.charge += dt; return; }
        st.charge = 0;
        simQueueShots(w, st, wx, wy, st.angle);
        st.cooldown = w.reload;
        st.recoilAmt = 1;
      } else if (!canEngage) {
        st.charge = 0;
      }
    }

    function simTickUnit(s, dt) {
      const u = SIM.unitState, tgt = SIM.target, b = s.body;
      if (SIM.wallState.dead) { u.vx *= 0.9; u.vy *= 0.9; return; }
      const dx = tgt.x - u.x, dy = tgt.y - u.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (SIM.mode === "manual") {

        let cx = (simCtl("right") ? 1 : 0) - (simCtl("left") ? 1 : 0);
        let cy = (simCtl("down") ? 1 : 0) - (simCtl("up") ? 1 : 0);
        const cl = Math.hypot(cx, cy);
        if (cl > 0) { cx /= cl; cy /= cl; }
        const maxSpM = Math.max(0.6, b.speed * 2);
        const k = Math.min(1, (0.08 + b.accel * 0.2) * dt);
        u.vx += (cx * maxSpM - u.vx) * k;
        u.vy += (cy * maxSpM - u.vy) * k;
        u.x += u.vx * dt; u.y += u.vy * dt;
        u.x = Math.max(-SIM_MANUAL_LIMIT, Math.min(SIM_MANUAL_LIMIT, u.x));
        u.y = Math.max(-SIM_MANUAL_LIMIT, Math.min(SIM_MANUAL_LIMIT, u.y));
      } else {
      const desiredRange = s.weapons[0] ? s.weapons[0].range * 0.75 : 80;
      let ax = 0, ay = 0;

      if (dist > desiredRange) { ax += dx / dist; ay += dy / dist; }
      else if (dist < desiredRange * 0.6) { ax -= dx / dist; ay -= dy / dist; }
      else {

        u.strafeTimer -= dt;
        if (u.strafeTimer <= 0) { u.strafeTimer = 90 + Math.random() * 120; u.strafeDir *= -1; }
        const perpX = -dy / dist, perpY = dx / dist;
        ax += perpX * u.strafeDir * 0.8;
        ay += perpY * u.strafeDir * 0.8;
      }
      u.vx += ax * b.accel * dt;
      u.vy += ay * b.accel * dt;
      const dragMul = Math.max(0, 1 - b.drag * dt * 0.1);
      u.vx *= dragMul; u.vy *= dragMul;
      const sp = Math.hypot(u.vx, u.vy);
      const maxSp = Math.max(0.2, b.speed * 30);
      if (sp > maxSp) { u.vx = u.vx / sp * maxSp; u.vy = u.vy / sp * maxSp; }
      u.x += u.vx * dt; u.y += u.vy * dt;
      }

      const newDist = Math.hypot(tgt.x - u.x, tgt.y - u.y) || 1;
      const minGap = tgt.size + (b.hitSize || 8) * 0.5;
      if (newDist < minGap) {
        const push = (minGap - newDist);
        u.x -= (tgt.x - u.x) / newDist * push;
        u.y -= (tgt.y - u.y) / newDist * push;
        u.vx *= 0.3; u.vy *= 0.3;
      }
      const sp2 = Math.hypot(u.vx, u.vy);
      if (sp2 > 0.05) {
        const targetAngle = Math.atan2(u.vy, u.vx) * 180 / Math.PI;
        u.angle = simAngleLerp(u.angle, targetAngle, b.rotateSpeed * dt * 2);
      }
      u.turretAngle = simAngleLerp(u.turretAngle, Math.atan2(dy, dx) * 180 / Math.PI, (s.weapons[0] ? s.weapons[0].rotateSpeed : 4) * dt * 2);
      u.legPhase += dt * (sp2 > 0.05 ? 6 : 1.5);
    }

    function simStopWeapons() {
      SIM.weaponState.forEach(w => { w.queue = []; w.charge = 0; w.warmup = 0; w.warmupHold = 0; });
    }

    function simTickSelfDamage(s, dt) {
      const ws = SIM.wallState;
      ws.flash = Math.max(0, ws.flash - dt / 10);
      if (ws.dead) {

        if (!SIM.autoRespawn) return;
        ws.deathTimer += dt;
        if (ws.deathTimer > 90) {

          ws.hp = ws.maxHp; ws.dead = false; ws.deathTimer = 0;
          ws.status = null; ws.statusDps = 0; ws.statusTimer = 0;
          const shieldAbility = s.abilities.find(a => a.kind === "forcefield");
          if (shieldAbility) ws.shield = shieldAbility.max * 0.5;
        }
        return;
      }
      ws.timer -= dt;
      if (ws.timer <= 0 && ws.hp > 0) {
        ws.timer = 100;
        const tgt = SIM.target;
        if (tgt.hp <= 0) return;
        if (SIM.mode === "manual") return;
        const selfX = s.kind === "unit" ? SIM.unitState.x : 0;
        const selfY = s.kind === "unit" ? SIM.unitState.y : 0;
        const ang = Math.atan2(selfY - tgt.y, selfX - tgt.x);

        const demoStatuses = ["burning", "corroded", "melting"];
        const withStatus = Math.random() < 0.4 ? demoStatuses[Math.floor(Math.random() * demoStatuses.length)] : null;
        simPushBullet({
          x: tgt.x, y: tgt.y, vx: Math.cos(ang) * 4, vy: Math.sin(ang) * 4, life: 200, pierced: 0, incoming: true,
          bt: { damage: simEnemyDamageValue(s), color: "#ff6b6b", status: withStatus, statusDuration: 180 }
        });
      }
    }

    function simTick(dt) {
      const s = SIM.scene;
      if (!s) return;

      if (s.kind === "unit") simTickUnit(s, dt);
      if (s.kind === "turret" || s.kind === "wall" || s.kind === "unit") simTickSelfDamage(s, dt);

      const originX = s.kind === "unit" ? SIM.unitState.x : 0;
      const originY = s.kind === "unit" ? SIM.unitState.y : 0;
      const baseAngle = s.kind === "unit" ? SIM.unitState.angle : -90;
      if (!SIM.wallState.dead) s.weapons.forEach((w, i) => simTickWeapon(w, i, dt, originX, originY, baseAngle));
      else simStopWeapons();

      SIM._inBulletLoop = true;
      try { for (let i = SIM.bullets.length - 1; i >= 0; i--) simTickBullet(dt, i); }
      finally { SIM._inBulletLoop = false; }
      for (let i = SIM.effects.length - 1; i >= 0; i--) {
        const fx = SIM.effects[i];
        fx.t += dt;
        if (fx.type === "spark") { fx.x += fx.vx * dt; fx.y += fx.vy * dt; fx.vx *= 0.92; fx.vy *= 0.92; }
        if (fx.t >= fx.dur) SIM.effects.splice(i, 1);
      }

      if (s.kind === "crafter") {
        SIM.crafterState.progress += dt;
        if (SIM.crafterState.progress >= s.craftTime) {
          SIM.crafterState.progress = 0;
          simSpawnEffect(0, -s.body.size * 4 - 4, "craft", 20, "#a3f7b5");
        }
      }

      const ws = SIM.wallState;
      SIM.abilityState.forEach(ab => {
        if (ab.kind === "forcefield" && !ws.dead) {
          ab.cur = Math.min(ab.max, ab.cur + ab.regen * dt * 0.15);
          ws.shield = ab.cur; ws.shieldMax = ab.max;
        }
        if (ab.kind === "repair" && !ws.dead && ws.hp < ws.maxHp) {
          ab.timer = (ab.timer || 0) + dt;
          if (ab.timer >= ab.reload) {
            ab.timer = 0;
            ws.hp = Math.min(ws.maxHp, ws.hp + ab.amount);
            simSpawnEffect(0, 0, "repair", 24, "#69f0ae");
          }
        }
        if (ab.kind === "regen" && !ws.dead && ws.hp < ws.maxHp) {
          ws.hp = Math.min(ws.maxHp, ws.hp + ab.percentAmount * ws.maxHp * 0.01 * dt);
        }
      });

      if (SIM.target.statusTimer > 0) {
        SIM.target.statusTimer -= dt;
        if (SIM.target.statusDps > 0 && SIM.target.hp > 0) simApplyDamage(SIM.target, SIM.target.statusDps * dt);
        if (SIM.target.statusTimer <= 0) { SIM.target.status = null; SIM.target.statusDps = 0; }
      }

      SIM.wallState.immuneFlash = Math.max(0, SIM.wallState.immuneFlash - dt / 12);
      if (SIM.wallState.statusTimer > 0) {
        SIM.wallState.statusTimer -= dt;
        if (SIM.wallState.statusDps > 0 && SIM.wallState.hp > 0 && !SIM.wallState.dead) {
          SIM.wallState.hp = Math.max(0, SIM.wallState.hp - SIM.wallState.statusDps * dt);
        }
        if (SIM.wallState.statusTimer <= 0) { SIM.wallState.status = null; SIM.wallState.statusDps = 0; }
      }

      SIM.tick++;
    }

    // --- ОТРИСОВКА ---
    function simDrawGrid(ctx) {
      ctx.save();
      ctx.strokeStyle = "rgba(148,163,184,0.08)";
      ctx.lineWidth = 1;
      const step = 8 * SIM_SCALE;
      for (let x = SIM_CENTER.x % step; x < 340; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 340); ctx.stroke(); }
      for (let y = SIM_CENTER.y % step; y < 340; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(340, y); ctx.stroke(); }
      ctx.restore();
    }

    function simDrawRadii(ctx, s, originX, originY) {
      if (!SIM.showRadii || !s.weapons.length) return;
      s.weapons.forEach((w, i) => {
        const st = SIM.weaponState[i];
        const p = simW2S(originX + w.x, originY + w.y);
        const r = w.range * SIM_SCALE;
        ctx.save();
        ctx.strokeStyle = "rgba(245,158,11,0.35)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
        if (w.rotate && st) {
          ctx.setLineDash([]);
          ctx.fillStyle = "rgba(245,158,11,0.08)";
          const a0 = (st.angle - w.shootCone) * Math.PI / 180;
          const a1 = (st.angle + w.shootCone) * Math.PI / 180;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.arc(p.x, p.y, r, a0, a1); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      });
    }

    function simDrawBody(ctx, s, originX, originY, angle) {
      const p = simW2S(originX, originY);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((angle || 0) * Math.PI / 180);

      if (s.kind === "turret" || s.kind === "generic") {
        const size = Math.max(10, s.body.size * 8 * SIM_SCALE);
        ctx.fillStyle = "#2b3342"; ctx.strokeStyle = "#4b5568"; ctx.lineWidth = 2;
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.strokeRect(-size / 2, -size / 2, size, size);
      } else if (s.kind === "wall") {
        const size = Math.max(12, s.body.size * 8 * SIM_SCALE);
        const flash = SIM.wallState.flash || 0;
        ctx.fillStyle = flash > 0 ? `rgba(255,107,107,${0.3 + flash * 0.5})` : "#394253";
        ctx.strokeStyle = s.color || "#6b7688"; ctx.lineWidth = 2;
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.strokeRect(-size / 2, -size / 2, size, size);
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.beginPath(); ctx.moveTo(-size / 2, 0); ctx.lineTo(size / 2, 0); ctx.moveTo(0, -size / 2); ctx.lineTo(0, size / 2); ctx.stroke();
      } else if (s.kind === "crafter") {
        const size = Math.max(14, s.body.size * 8 * SIM_SCALE);
        ctx.fillStyle = "#2f3b2e"; ctx.strokeStyle = "#5c7a52"; ctx.lineWidth = 2;
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.strokeRect(-size / 2, -size / 2, size, size);
        const pct = Math.min(1, SIM.crafterState.progress / (s.craftTime || 90));
        ctx.fillStyle = "#1b2330"; ctx.fillRect(-size / 2 + 3, size / 2 - 8, size - 6, 5);
        ctx.fillStyle = "#8be07a"; ctx.fillRect(-size / 2 + 3, size / 2 - 8, (size - 6) * pct, 5);
      } else if (s.kind === "conveyor") {
        const size = Math.max(12, s.body.size * 8 * SIM_SCALE);
        ctx.fillStyle = "#2b3342"; ctx.strokeStyle = "#4b5568"; ctx.lineWidth = 2;
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.strokeRect(-size / 2, -size / 2, size, size);
        ctx.fillStyle = "#38bdf8";
        ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(6, 0); ctx.lineTo(-4, 6); ctx.closePath(); ctx.fill();
        const items = 3;
        for (let i = 0; i < items; i++) {
          const t = ((SIM.tick * 0.02 + i / items) % 1);
          const ix = -size / 2 + t * size;
          ctx.fillStyle = "#f5a742";
          ctx.fillRect(ix - 2, -2, 4, 4);
        }
      } else if (s.kind === "unit") {
        simDrawUnitBody(ctx, s);
      }
      ctx.restore();
    }

    function simDrawUnitBody(ctx, s) {
      const u = SIM.unitState;
      const hitR = Math.max(6, s.body.hitSize * SIM_SCALE * 0.5);
      ctx.fillStyle = "#3b4252"; ctx.strokeStyle = "#7c8db5"; ctx.lineWidth = 2;

      if (s.unitSub === "flying") {
        ctx.beginPath(); ctx.arc(0, 0, hitR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath(); ctx.moveTo(hitR, 0); ctx.lineTo(-hitR * 0.4, -hitR * 0.5); ctx.lineTo(-hitR * 0.4, hitR * 0.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(56,189,248,0.6)";
        ctx.beginPath(); ctx.arc(-hitR * 0.7, -hitR * 0.35, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-hitR * 0.7, hitR * 0.35, 2, 0, Math.PI * 2); ctx.fill();
      } else if (s.unitSub === "mech") {
        ctx.fillRect(-hitR * 0.7, -hitR * 0.6, hitR * 1.4, hitR * 1.2);
        ctx.strokeRect(-hitR * 0.7, -hitR * 0.6, hitR * 1.4, hitR * 1.2);
        ctx.strokeStyle = "#5b6675";
        const phase = Math.sin(u.legPhase);
        [-1, 1].forEach(side => {
          ctx.beginPath();
          ctx.moveTo(side * hitR * 0.5, hitR * 0.4);
          ctx.lineTo(side * hitR * 0.8 + phase * side * 2, hitR * 1.1);
          ctx.stroke();
        });
      } else if (s.unitSub === "legs") {
        ctx.beginPath(); ctx.arc(0, 0, hitR * 0.75, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        const legCount = 6;
        for (let i = 0; i < legCount; i++) {
          const a = (i / legCount) * Math.PI * 2;
          const phase = Math.sin(u.legPhase + i * 1.3) * 0.3 + 1;
          const lx = Math.cos(a) * hitR * 1.4 * phase;
          const ly = Math.sin(a) * hitR * 1.4 * phase;
          ctx.strokeStyle = "#7c8db5";
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * hitR * 0.6, Math.sin(a) * hitR * 0.6); ctx.lineTo(lx, ly); ctx.stroke();
        }
      } else if (s.unitSub === "tank") {
        ctx.fillRect(-hitR * 0.8, -hitR * 0.6, hitR * 1.6, hitR * 1.2);
        ctx.strokeRect(-hitR * 0.8, -hitR * 0.6, hitR * 1.6, hitR * 1.2);
        ctx.fillStyle = "#22262f";
        const treadOffset = (u.legPhase * 3) % 6;
        [-1, 1].forEach(side => {
          ctx.fillRect(-hitR * 0.9, side * hitR * 0.75 - 3, hitR * 1.8, 6);
          ctx.strokeStyle = "#12151b";
          for (let t = -hitR; t < hitR; t += 6) {
            ctx.beginPath();
            ctx.moveTo(t + treadOffset, side * hitR * 0.75 - 3);
            ctx.lineTo(t + treadOffset, side * hitR * 0.75 + 3);
            ctx.stroke();
          }
        });
      }
    }

    function simDrawWeapons(ctx, s, originX, originY) {
      s.weapons.forEach((w, i) => {
        const st = SIM.weaponState[i];
        const p = simW2S(originX + w.x, originY + w.y);
        const rad = st.angle * Math.PI / 180;
        const len = (14 + s.body.size * 3) * SIM_SCALE - st.recoilAmt * 6;
        const offsets = w.mirror ? [1, -1] : [0];
        offsets.forEach(side => {
          const perp = rad + Math.PI / 2;
          const sx = p.x + Math.cos(perp) * side * 3;
          const sy = p.y + Math.sin(perp) * side * 3;
          ctx.strokeStyle = "#c8ced9"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(rad) * len, sy + Math.sin(rad) * len); ctx.stroke();
        });
        if (w.firstShotDelay > 0 && st.charge > 0) {
          ctx.strokeStyle = "rgba(188,140,255,0.6)";
          ctx.beginPath(); ctx.arc(p.x, p.y, 4 + (st.charge / w.firstShotDelay) * 8, 0, Math.PI * 2); ctx.stroke();
        }
      });
    }

    function simDrawBullets(ctx) {
      SIM.bullets.forEach(b => {
        const bt = b.bt;
        const color = bt.color || "#ffcd75";

        if (b.trail && b.trail.length > 1) {
          ctx.save();
          ctx.lineCap = "round";
          for (let i = 1; i < b.trail.length; i++) {
            const a = simW2S(b.trail[i - 1].x, b.trail[i - 1].y);
            const bb = simW2S(b.trail[i].x, b.trail[i].y);
            ctx.globalAlpha = (i / b.trail.length) * 0.35;
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(1, (bt.width || 3) * SIM_SCALE * 0.6 * (i / b.trail.length));
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bb.x, bb.y); ctx.stroke();
          }
          ctx.restore();
        }

        const p = simW2S(b.x, b.y);
        const rad = Math.atan2(b.vy, b.vx);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(rad);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = bt.category === "laser" ? 6 : 9;
        if (b.incoming) {
          ctx.fillRect(-4, -1.5, 8, 3);
        } else if (bt.category === "laser" || bt.category === "continuous") {
          ctx.strokeStyle = color; ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
          ctx.shadowBlur = 12; ctx.lineWidth = 1; ctx.globalAlpha = 0.8;
          ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
        } else if (bt.category === "missile") {
          const h = bt.height * SIM_SCALE, w = bt.width * SIM_SCALE;
          ctx.fillRect(-h / 2, -w / 2, h, w);
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.beginPath(); ctx.moveTo(h / 2, 0); ctx.lineTo(h / 2 - 3, -w / 2); ctx.lineTo(h / 2 - 3, w / 2); ctx.fill();
          ctx.shadowBlur = 14; ctx.fillStyle = "rgba(255,180,120,0.6)";
          ctx.beginPath(); ctx.arc(-h / 2 - 3, 0, 2.5, 0, Math.PI * 2); ctx.fill();
        } else {
          const w = Math.max(2, bt.width * SIM_SCALE), h = Math.max(3, bt.height * SIM_SCALE);

          ctx.fillRect(-h / 2, -w / 2, h, w);
          ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1; ctx.strokeRect(-h / 2, -w / 2, h, w);
          ctx.shadowBlur = 0;
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.fillRect(-h / 2 + 1, -w / 2 + 0.5, h - 2, Math.max(1, w * 0.3));
        }
        ctx.restore();
      });
    }

    function simDrawEffects(ctx) {
      SIM.effects.forEach(fx => {
        const alpha = Math.max(0, 1 - fx.t / fx.dur);
        if (fx.type === "lightning") {
          ctx.save();
          ctx.strokeStyle = fx.color; ctx.globalAlpha = alpha; ctx.lineWidth = 2;
          ctx.beginPath();
          fx.points.forEach((pt, i) => {
            const sp = simW2S(pt.x, pt.y);
            if (i === 0) ctx.moveTo(sp.x, sp.y); else ctx.lineTo(sp.x, sp.y);
          });
          ctx.stroke();
          ctx.restore();
          return;
        }
        const p = simW2S(fx.x, fx.y);
        ctx.save();
        ctx.globalAlpha = alpha;
        if (fx.type === "spark") {
          ctx.strokeStyle = fx.color; ctx.lineWidth = 1.6; ctx.lineCap = "round";
          ctx.shadowColor = fx.color; ctx.shadowBlur = 5;
          const tail = simW2S(fx.x - fx.vx * 1.4, fx.y - fx.vy * 1.4);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tail.x, tail.y); ctx.stroke();
        } else if (fx.type === "shoot") {

          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 7 + fx.t * 1.4);
          simStop(grad, 0, "#fff7e0"); simStop(grad, 0.4, fx.color); simStop(grad, 1, "rgba(0,0,0,0)");
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(p.x, p.y, 7 + fx.t * 1.4, 0, Math.PI * 2); ctx.fill();
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(fx.angle);
          ctx.strokeStyle = "#fff7e0"; ctx.lineWidth = 1.5;
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath(); ctx.moveTo(0, 0);
            ctx.lineTo((10 + fx.t * 2) * Math.cos(i * 0.35), (10 + fx.t * 2) * Math.sin(i * 0.35));
            ctx.stroke();
          }
          ctx.restore();
        } else if (fx.type === "hit" || fx.type === "despawn") {
          const r = (fx.type === "hit" ? 3 : 2) + fx.t * 1.3;
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          simStop(grad, 0, fx.color); simStop(grad, 1, "rgba(0,0,0,0)");
          ctx.fillStyle = grad; ctx.globalAlpha = alpha * 0.6;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = alpha; ctx.strokeStyle = fx.color; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
        } else if (fx.type === "splash") {
          ctx.strokeStyle = fx.color; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5;
          const r = fx.radius * SIM_SCALE * Math.min(1, fx.t / (fx.dur * 0.6));
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
        } else if (fx.type === "deflect") {
          ctx.strokeStyle = fx.color; ctx.lineWidth = 2;
          ctx.shadowColor = fx.color; ctx.shadowBlur = 6;
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + fx.t * 0.3;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(a) * (5 + fx.t), p.y + Math.sin(a) * (5 + fx.t)); ctx.stroke();
          }
        } else if (fx.type === "explosion") {
          const r = (fx.radius || 20) * SIM_SCALE * Math.min(1, fx.t / (fx.dur * 0.5));
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          simStop(grad, 0, "#fff7e0"); simStop(grad, 0.35, fx.color); simStop(grad, 1, "rgba(0,0,0,0)");
          ctx.fillStyle = grad; ctx.globalAlpha = alpha * 0.7;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = alpha; ctx.strokeStyle = "#ffcd75"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
        } else if (fx.type === "craft") {
          ctx.fillStyle = fx.color;
          ctx.beginPath(); ctx.arc(p.x, p.y - fx.t, 3, 0, Math.PI * 2); ctx.fill();
        } else if (fx.type === "repair") {
          ctx.strokeStyle = fx.color; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, fx.t * 4, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      });
    }

    function simDrawHpBar(ctx, sx, sy, w, hp, maxHp, color) {
      ctx.save();
      ctx.fillStyle = "rgba(10,12,16,0.8)";
      ctx.fillRect(sx - w / 2, sy, w, 5);
      const pct = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
      ctx.fillStyle = color || (pct > 0.5 ? "#3fb950" : pct > 0.2 ? "#f59e0b" : "#f85149");
      ctx.fillRect(sx - w / 2, sy, w * pct, 5);
      ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.strokeRect(sx - w / 2, sy, w, 5);
      ctx.restore();
    }

    function simDrawTarget(ctx, s) {
      const tgt = SIM.target;
      const p = simW2S(tgt.x, tgt.y);
      const r = tgt.size * SIM_SCALE;
      ctx.save();
      ctx.fillStyle = tgt.hp > 0 ? "rgba(248,81,73,0.35)" : "rgba(90,90,90,0.25)";
      ctx.strokeStyle = tgt.hp > 0 ? "#f85149" : "#6b7280";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (SIM.targetDragMode) {
        ctx.strokeStyle = "#38bdf8"; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2); ctx.stroke();
      }
      if (tgt.status) {
        ctx.fillStyle = tgt.statusColor || "#bc8cff";
        ctx.beginPath(); ctx.arc(p.x + r - 2, p.y - r + 2, 3, 0, Math.PI * 2); ctx.fill();

        const barW = Math.max(28, r * 2);
        const barY = p.y - r - 4;
        ctx.font = "9px var(--font-mono, monospace)";
        ctx.textAlign = "left";
        ctx.fillStyle = tgt.statusColor || "#bc8cff";
        ctx.fillText(tgt.status, p.x - barW / 2, barY + 10);
        const dur = simNum(tgt.statusMaxTimer, tgt.statusTimer) || 1;
        const pct = Math.max(0, Math.min(1, tgt.statusTimer / dur));
        ctx.fillStyle = "rgba(10,12,16,0.7)"; ctx.fillRect(p.x - barW / 2, barY + 13, barW, 3);
        ctx.fillStyle = tgt.statusColor || "#bc8cff"; ctx.fillRect(p.x - barW / 2, barY + 13, barW * pct, 3);
      }
      ctx.restore();
      simDrawHpBar(ctx, p.x, p.y - r - 10, Math.max(28, r * 2), tgt.hp, tgt.maxHp);
    }

    function simDrawCooldowns(ctx, s) {
      let y = 330;
      s.weapons.forEach((w, i) => {
        const st = SIM.weaponState[i];
        const pct = w.reload > 0 ? Math.max(0, 1 - st.cooldown / w.reload) : 1;
        ctx.fillStyle = "rgba(10,12,16,0.7)"; ctx.fillRect(6, y - 10 * i - 6, 60, 4);
        ctx.fillStyle = pct >= 1 ? "#3fb950" : "#5b6675"; ctx.fillRect(6, y - 10 * i - 6, 60 * pct, 4);
      });
    }

    function simRender() {
      const ctx = SIM.ctx;
      if (!ctx) return;
      ctx.clearRect(0, 0, 340, 340);
      simDrawGrid(ctx);

      ctx.save();
      ctx.strokeStyle = "rgba(148,163,184,0.3)"; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(SIM_CENTER.x - 6, SIM_CENTER.y); ctx.lineTo(SIM_CENTER.x + 6, SIM_CENTER.y);
      ctx.moveTo(SIM_CENTER.x, SIM_CENTER.y - 6); ctx.lineTo(SIM_CENTER.x, SIM_CENTER.y + 6); ctx.stroke();
      ctx.restore();

      const s = SIM.scene;
      if (!s) return;

      const originX = s.kind === "unit" ? SIM.unitState.x : 0;
      const originY = s.kind === "unit" ? SIM.unitState.y : 0;
      const bodyAngle = s.kind === "unit" ? SIM.unitState.angle : 0;

      simDrawRadii(ctx, s, originX, originY);
      if (SIM.wallState.dead) ctx.globalAlpha = 0.35;
      simDrawBody(ctx, s, originX, originY, bodyAngle);
      if (SIM.wallState.shieldMax > 0 && !SIM.wallState.dead) {
        const p = simW2S(originX, originY);
        const r = Math.max(14, s.body.size * 8 * SIM_SCALE) * 0.9;
        ctx.save();
        ctx.globalAlpha = 0.15 + 0.3 * (SIM.wallState.shield / SIM.wallState.shieldMax);
        ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      if (!SIM.wallState.dead && s.weapons.length) simDrawWeapons(ctx, s, originX, originY);
      ctx.globalAlpha = 1;
      simDrawBullets(ctx);
      simDrawEffects(ctx);

      if (s.kind === "wall" || s.kind === "turret" || s.kind === "unit") {
        const p = simW2S(originX, originY);
        const barY = p.y - (s.body.size * 4 * SIM_SCALE) - 12 - (s.kind === "unit" ? s.body.hitSize * SIM_SCALE * 0.5 : 0);
        simDrawHpBar(ctx, p.x, barY, 50, SIM.wallState.hp, SIM.wallState.maxHp, SIM.wallState.dead ? "#6b7280" : null);
        if (SIM.wallState.status) {
          ctx.save();
          ctx.font = "9px var(--font-mono, monospace)";
          ctx.textAlign = "center";
          ctx.fillStyle = SIM.wallState.statusColor || "#bc8cff";
          ctx.fillText(SIM.wallState.status, p.x, barY - 4);
          const dur = simNum(SIM.wallState.statusMaxTimer, SIM.wallState.statusTimer) || 1;
          const pct = Math.max(0, Math.min(1, SIM.wallState.statusTimer / dur));
          ctx.fillStyle = "rgba(10,12,16,0.7)"; ctx.fillRect(p.x - 25, barY - 2, 50, 3);
          ctx.fillStyle = SIM.wallState.statusColor || "#bc8cff"; ctx.fillRect(p.x - 25, barY - 2, 50 * pct, 3);
          ctx.restore();
        }
        if (SIM.wallState.immuneFlash > 0) {
          ctx.save();
          ctx.globalAlpha = SIM.wallState.immuneFlash;
          ctx.font = "bold 9px var(--font-mono, monospace)";
          ctx.textAlign = "center";
          ctx.fillStyle = "#9be7ff";
          ctx.fillText("ИММУНИТЕТ", p.x, barY - 14);
          ctx.restore();
        }
      }
      if (s.kind !== "wall") simDrawTarget(ctx, s);
      if (s.weapons.length) simDrawCooldowns(ctx, s);
      if (SIM.wallState.dead && !SIM.autoRespawn) {
        ctx.save();
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(248,81,73,0.95)";
        const dp = simW2S(originX, originY);
        ctx.fillText("ПОГИБ · нажмите «Сброс»", Math.max(90, Math.min(250, dp.x)), Math.max(30, dp.y - 26));
        ctx.restore();
      }
      if (SIM.mode === "manual") {
        ctx.save();
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(245,158,11,0.9)";
        ctx.fillText("РУЧНОЙ РЕЖИМ · враг не атакует", 8, 14);
        ctx.restore();
      }
    }

    function simReportError(stage, err) {
      const msg = String((err && err.message) || err);
      if (SIM._lastErr === msg) return;
      SIM._lastErr = msg;
      console.error("[Симулятор] ошибка (" + stage + "):", err);
      if (typeof showToast === "function") showToast("Симулятор: ошибка (" + stage + ") — " + msg);
    }

    function simLoop(ts) {
      if (SIM.lastFrameTime == null) SIM.lastFrameTime = ts;
      let elapsed = Math.min(ts - SIM.lastFrameTime, 100);
      SIM.lastFrameTime = ts;

      if (SIM.running && SIM.scene) {
        try {
          const ticks = (elapsed / 1000) * 60 * SIM.speed;
          simTick(ticks);
        } catch (err) {
          SIM.running = false;
          simReportError("расчёт", err);
        }
      }
      try { simRender(); } catch (err) { simReportError("отрисовка", err); }
      SIM.rafId = requestAnimationFrame(simLoop);
    }

    function simInit() {
      SIM.canvas = document.getElementById("simCanvas");
      if (!SIM.canvas) return;
      SIM.ctx = SIM.canvas.getContext("2d");

      document.getElementById("btnSimPlay").addEventListener("click", () => { SIM.running = true; });
      document.getElementById("btnSimPause").addEventListener("click", () => { SIM.running = false; });
      document.getElementById("btnSimReset").addEventListener("click", simResetSim);
      const btnTarget = document.getElementById("btnSimTarget");
      btnTarget.addEventListener("click", () => {
        SIM.targetDragMode = !SIM.targetDragMode;
        btnTarget.classList.toggle("btn-mind", SIM.targetDragMode);
        SIM.canvas.style.cursor = SIM.targetDragMode ? "crosshair" : "default";
      });
      document.getElementById("simSpeedSelect").addEventListener("change", (e) => { SIM.speed = parseFloat(e.target.value) || 1; });
      document.getElementById("simShowRadii").addEventListener("change", (e) => { SIM.showRadii = e.target.checked; });
      document.getElementById("simTargetHp").addEventListener("input", (e) => {
        let hp = parseFloat(e.target.value);
        if (!isFinite(hp)) hp = 0;
        hp = Math.max(0, Math.min(hp, SIM.target.maxHp));
        SIM.target.hp = hp;
      });
      document.getElementById("simTargetMaxHp").addEventListener("input", (e) => {
        let maxHp = parseFloat(e.target.value);
        if (!isFinite(maxHp) || maxHp < 1) maxHp = 1;
        const wasFull = SIM.target.hp >= SIM.target.maxHp;
        SIM.target.maxHp = maxHp;
        SIM.target.hp = wasFull ? maxHp : Math.min(SIM.target.hp, maxHp);
        const hpInput = document.getElementById("simTargetHp");
        hpInput.max = maxHp;
        hpInput.value = Math.round(SIM.target.hp);
      });
      document.getElementById("simTargetSize").addEventListener("change", (e) => { SIM.target.size = parseFloat(e.target.value) || 14; });
      SIM.canvas.addEventListener("click", (e) => {
        if (!SIM.targetDragMode) return;
        const rect = SIM.canvas.getBoundingClientRect();
        const scaleX = SIM.canvas.width / rect.width, scaleY = SIM.canvas.height / rect.height;
        const cx = (e.clientX - rect.left) * scaleX, cy = (e.clientY - rect.top) * scaleY;
        const w = simS2W(cx, cy);
        SIM.target.x = w.x; SIM.target.y = w.y;
      });

      simInitModes();
      simRebuildFromEditor();
      SIM.lastFrameTime = null;
      SIM.rafId = requestAnimationFrame(simLoop);
    }
