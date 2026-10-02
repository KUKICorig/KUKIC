// ============================================================
// Шаблоны JSON для новых файлов мода (TEMPLATES)
// (часть модуля mindustry-studio; оборачивается build.py)
// ============================================================

    // TEMPLATES
    const TEMPLATES = [
      {
        id: "item-turret",
        group: "Турели",
        title: "ItemTurret (Орудие)",
        sub: "Стреляет предметами",
        file: "heavy-duo.json",
        code: JSON.stringify({
          "type": "ItemTurret",
          "name": "Тяжелый Дуо",
          "description": "Модернизированная сдвоенная турель увеличенной мощности и дальности.",
          "size": 2,
          "health": 950,
          "reload": 18,
          "range": 190,
          "inaccuracy": 2.5,
          "rotateSpeed": 5.0,
          "ammoTypes": {
            "copper": {
              "speed": 6.0,
              "damage": 26,
              "lifetime": 32,
              "width": 7,
              "height": 9
            },
            "graphite": {
              "speed": 7.5,
              "damage": 44,
              "lifetime": 26,
              "reloadMultiplier": 0.8
            },
            "silicon": {
              "speed": 6.5,
              "damage": 30,
              "homingPower": 0.1,
              "homingRange": 80
            }
          },
          "requirements": [
            { "item": "copper", "amount": 85 },
            { "item": "lead", "amount": 60 },
            { "item": "graphite", "amount": 35 }
          ],
          "category": "turret",
          "research": "duo"
        }, null, 2)
      },
      {
        id: "power-turret",
        group: "Турели",
        title: "PowerTurret (Лазер)",
        sub: "Энергетический луч",
        file: "laser-turret.json",
        code: JSON.stringify({
          "type": "PowerTurret",
          "name": "Ионный Излучатель",
          "description": "Стреляет мощным ионным лучом, пробивающим ряды противника.",
          "size": 3,
          "health": 1400,
          "reload": 70,
          "range": 230,
          "shootType": {
            "type": "LaserBulletType",
            "damage": 180,
            "length": 230,
            "width": 24,
            "colors": ["5c82ff", "8cb0ff", "ffffff"]
          },
          "consumes": {
            "power": 7.5
          },
          "requirements": [
            { "item": "titanium", "amount": 120 },
            { "item": "silicon", "amount": 90 }
          ],
          "category": "turret",
          "research": "lancer"
        }, null, 2)
      },
      {
        id: "liquid-turret",
        group: "Турели",
        title: "LiquidTurret (Огнемёт)",
        sub: "Стреляет жидкостями",
        file: "flame-cannon.json",
        code: JSON.stringify({
          "type": "LiquidTurret",
          "name": "Пиро-Фонтан",
          "description": "Заливает территорию горящим шлаком, поджигая врагов и постройки.",
          "size": 2,
          "health": 800,
          "reload": 6,
          "range": 110,
          "shootCone": 20,
          "ammoTypes": {
            "slag": {
              "speed": 3.2,
              "damage": 18,
              "lifetime": 30,
              "status": "burning",
              "statusDuration": 240
            },
            "oil": {
              "speed": 2.8,
              "damage": 12,
              "lifetime": 26,
              "status": "burning",
              "statusDuration": 180
            }
          },
          "requirements": [
            { "item": "graphite", "amount": 45 },
            { "item": "titanium", "amount": 30 }
          ],
          "category": "turret",
          "research": "hail"
        }, null, 2)
      },
      {
        id: "crafter",
        group: "Производство",
        title: "GenericCrafter (Завод)",
        sub: "Переработка ресурсов",
        file: "advanced-smelter.json",
        code: JSON.stringify({
          "type": "GenericCrafter",
          "name": "Титан-Кремниевый Завод",
          "description": "Синтезирует высокопрочные кремниевые пластины.",
          "size": 3,
          "health": 400,
          "craftTime": 40,
          "itemCapacity": 25,
          "consumes": {
            "power": 3.5,
            "items": {
              "items": [
                { "item": "sand", "amount": 3 },
                { "item": "coal", "amount": 2 }
              ]
            }
          },
          "outputItem": {
            "item": "silicon",
            "amount": 3
          },
          "requirements": [
            { "item": "copper", "amount": 110 },
            { "item": "lead", "amount": 90 },
            { "item": "titanium", "amount": 50 }
          ],
          "category": "crafting",
          "research": "silicon-smelter"
        }, null, 2)
      },
      {
        id: "drill",
        group: "Производство",
        title: "Drill (Бур)",
        sub: "Добыча руды",
        file: "titanium-drill.json",
        code: JSON.stringify({
          "type": "Drill",
          "name": "Титановый Экскаватор",
          "description": "Механический бур повышенной мощности для добычи плотных руд.",
          "size": 2,
          "health": 300,
          "tier": 3,
          "drillTime": 280,
          "liquidBoostIntensity": 1.6,
          "itemCapacity": 20,
          "consumes": {
            "liquids": { "liquid": "water", "amount": 0.05 }
          },
          "requirements": [
            { "item": "copper", "amount": 40 },
            { "item": "titanium", "amount": 20 }
          ],
          "category": "production",
          "research": "laser-drill"
        }, null, 2)
      },
      {
        id: "conveyor",
        group: "Логистика",
        title: "Conveyor (Конвейер)",
        sub: "Транспортировка предметов",
        file: "fast-conveyor.json",
        code: JSON.stringify({
          "type": "Conveyor",
          "name": "Ускоренный Конвейер",
          "description": "Быстро перемещает предметы между блоками производства и хранения.",
          "size": 1,
          "health": 90,
          "speed": 0.08,
          "displayedSpeed": 10,
          "itemCapacity": 4,
          "requirements": [
            { "item": "titanium", "amount": 2 },
            { "item": "silicon", "amount": 1 }
          ],
          "category": "distribution",
          "research": "conveyor"
        }, null, 2)
      },
      {
        id: "solar-generator",
        group: "Энергетика",
        title: "SolarGenerator (Панель)",
        sub: "Возобновляемая энергия",
        file: "solar-panel-mk2.json",
        code: JSON.stringify({
          "type": "SolarGenerator",
          "name": "Солнечная Панель Мк2",
          "description": "Улучшенная фотопанель с повышенной эффективностью преобразования света.",
          "size": 1,
          "health": 60,
          "powerProduction": 0.07,
          "basePowerGeneration": 0.07,
          "requirements": [
            { "item": "silicon", "amount": 7 },
            { "item": "lead", "amount": 6 }
          ],
          "category": "power",
          "research": "solar-panel"
        }, null, 2)
      },
      {
        id: "unit-fly",
        group: "Юниты",
        title: "Flying Unit (Дрон)",
        sub: "Воздушный боевой дрон",
        file: "falcon-unit.json",
        code: JSON.stringify({
          "type": "flying",
          "name": "Сокол",
          "description": "Скоростной легкий перехватчик с самонаводящимися ракетами.",
          "speed": 3.6,
          "accel": 0.08,
          "drag": 0.03,
          "flying": true,
          "health": 380,
          "hitSize": 13,
          "armor": 2,
          "engineOffset": 6,
          "engineSize": 3,
          "itemCapacity": 30,
          "weapons": [
            {
              "name": "falcon-blaster",
              "reload": 16,
              "x": 4,
              "y": 2,
              "bullet": {
                "type": "MissileBulletType",
                "speed": 5.5,
                "damage": 22,
                "lifetime": 35,
                "homingPower": 0.12,
                "homingRange": 70
              }
            }
          ]
        }, null, 2)
      },
      {
        id: "unit-factory",
        group: "Юниты",
        title: "UnitFactory (Фабрика)",
        sub: "Производство юнитов",
        file: "falcon-factory.json",
        code: JSON.stringify({
          "type": "UnitFactory",
          "name": "Ангар Сокола",
          "description": "Собирает лёгкие боевые дроны прямо на линии фронта.",
          "size": 3,
          "health": 400,
          "itemCapacity": 40,
          "plans": [
            {
              "unit": "falcon-unit",
              "time": 900,
              "requirements": [
                { "item": "silicon", "amount": 30 },
                { "item": "titanium", "amount": 20 }
              ]
            }
          ],
          "requirements": [
            { "item": "copper", "amount": 150 },
            { "item": "lead", "amount": 130 },
            { "item": "silicon", "amount": 80 }
          ],
          "category": "units",
          "research": "ground-factory"
        }, null, 2)
      },
      {
        id: "wall-def",
        group: "Оборона",
        title: "Wall (Стена)",
        sub: "Защитное укрепление",
        file: "shield-wall.json",
        code: JSON.stringify({
          "type": "Wall",
          "name": "Энергетическая стена",
          "description": "Отражает часть снарядов и испускает молнии при получении повреждений.",
          "size": 2,
          "health": 3800,
          "chanceDeflect": 25,
          "lightningChance": 0.12,
          "lightningDamage": 25,
          "requirements": [
            { "item": "titanium", "amount": 24 },
            { "item": "silicon", "amount": 16 }
          ],
          "category": "defense",
          "research": "titanium-wall"
        }, null, 2)
      },
      {
        id: "mod-manifest",
        group: "Манифест",
        title: "mod.json (Манифест)",
        sub: "Главный файл мода",
        file: "mod.json",
        code: JSON.stringify({
          "name": "epic-expansion",
          "displayName": "Epic Expansion Mod",
          "author": "Mindustry Fan",
          "description": "Новый набор турелей, заводов и боевых дронов для расширения геймплея.",
          "version": "1.0.0",
          "minGameVersion": "146",
          "hidden": false
        }, null, 2)
      }
    ];
