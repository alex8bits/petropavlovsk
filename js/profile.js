// Профиль игрока и сохранения.
// Профиль — одна запись в localStorage с номером версии. Старые версии переводятся
// в новую по цепочке MIGRATIONS, поэтому формат можно менять, не теряя прогресс.

const SAVE_KEY = 'petropavlovsk.save';
const SAVE_VERSION = 1;

// Переходы между версиями: MIGRATIONS[n] переводит запись версии n в версию n + 1.
// Пример на будущее: 1: d => { d.settings = { sound: true }; return d; }
const MIGRATIONS = {};

// Улучшения: ключ → { maxLevel, apply(cfg, level) }. apply меняет собранную конфигурацию боя
// (не BASE_CFG). Ветки и их числа появятся на этапе «Мастерская».
const UPGRADES = {};

const Profile = {
  data: null,

  fresh() {
    return {
      version: SAVE_VERSION,
      treasury: 0,   // казна, руб.
      levels: {},    // id уровня → { stars: [bool, bool, bool], won, plays, bestPowder }
      upgrades: {},  // ключ UPGRADES → купленный уровень
      ammo: {},      // тип ядра → купленный запас (восстанавливается к каждому бою)
    };
  },

  load() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { /* хранилище недоступно */ }
    this.data = raw ? this.migrate(raw) : this.fresh();
    return this.data;
  },

  migrate(raw) {
    let d;
    try { d = JSON.parse(raw); } catch (e) { d = null; }
    if (!d || typeof d !== 'object' || typeof d.version !== 'number') {
      console.warn('Сохранение повреждено — начинаем заново');
      return this.fresh();
    }
    if (d.version > SAVE_VERSION) {
      console.warn(`Сохранение из более новой версии игры (${d.version}) — читаем как есть`);
    }
    while (d.version < SAVE_VERSION) {
      const step = MIGRATIONS[d.version];
      if (!step) { console.warn(`Нет перехода с версии ${d.version} — начинаем заново`); return this.fresh(); }
      d = step(d);
      d.version++;
    }
    // Недостающие поля — из свежего профиля
    return { ...this.fresh(), ...d };
  },

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); return true; }
    catch (e) { console.warn('Не удалось сохранить прогресс', e); return false; }
  },

  reset() {
    this.data = this.fresh();
    this.save();
  },

  // Прогресс — только по боям, которые есть в кампании (записи удалённых боёв не считаются)
  hasProgress() {
    return Levels.list.some(l => this.data.levels[l.id]);
  },

  levelRecord(id) {
    return this.data.levels[id] || { stars: [false, false, false], won: false, plays: 0, bestPowder: null };
  },

  starCount(id) {
    return this.levelRecord(id).stars.filter(Boolean).length;
  },

  totalStars() {
    return Levels.list.reduce((n, l) => n + this.starCount(l.id), 0);
  },

  // Бой открыт, если выигран предыдущий; первому бою главы нужно ещё и набрать звёзды главы
  isUnlocked(level) {
    const prev = Levels.prev(level);
    if (prev && !this.levelRecord(prev.id).won) return false;
    return this.starsMissing(level) === 0;
  },

  // Сколько звёзд не хватает, чтобы открыть главу этого боя (0 — хватает или бой не первый в главе)
  starsMissing(level) {
    if (!Levels.isChapterStart(level)) return 0;
    return Math.max(0, Levels.chapters[level.chapter].stars - this.totalStars());
  },

  // Кампания пройдена — выигран последний бой
  campaignDone() {
    const last = Levels.last();
    return !!last && this.levelRecord(last.id).won;
  },

  // Итог боя: звёзды копятся (каждая получена хоть раз — остаётся), записывается и сохраняется
  recordResult(level, res) {
    const r = this.levelRecord(level.id);
    r.plays++;
    if (res.win) {
      r.won = true;
      r.stars = r.stars.map((had, i) => had || res.stars[i]);
      if (r.bestPowder === null || res.powderSpent < r.bestPowder) r.bestPowder = res.powderSpent;
    }
    this.data.levels[level.id] = r;
    this.save();
    return r;
  },

  // Модификаторы профиля поверх собранной конфигурации боя
  applyModifiers(cfg, profile = this.data) {
    for (const [key, lvl] of Object.entries(profile.upgrades)) {
      const up = UPGRADES[key];
      if (up && lvl > 0) up.apply(cfg, Math.min(lvl, up.maxLevel));
    }
    return cfg;
  },
};
