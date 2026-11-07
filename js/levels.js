// Уровни как данные. Каждый бой — отдельный файл в levels/, который вызывает Levels.add({...}).
// Файлы подключаются в index.html после этого скрипта.
//
// Формат уровня:
//   id        — строка, ключ в сохранении (не менять после выпуска: иначе прогресс потеряется)
//   n         — порядковый номер в кампании (1, 2, …); бой n+1 открывается победой в бою n
//   chapter   — номер главы; chapterTitle — её название (достаточно указать в первом бою главы)
//   title, date, battery, briefing — тексты для карты и брифинга
//   config    — переопределения базового конфига (глубокое слияние с BASE_CFG), например
//               { powderStore: { start: 60 }, water: { waves: [...] } }
//   fleet     — эскадра: [{ t, type, stopX }] — когда (с), какой корабль, где встаёт на якорь
//   win       — условие победы: 'sinkAll' (потопить всех)
//   stars     — { fortress: доля целой кладки для 2-й звезды, powder: мешков пороха не больше для 3-й }

const Levels = {
  list: [],

  add(def) {
    for (const k of ['id', 'n', 'chapter', 'title', 'fleet']) {
      if (def[k] === undefined) throw new Error(`Уровень ${def.id || '?'}: нет поля ${k}`);
    }
    if (this.get(def.id)) throw new Error(`Уровень ${def.id} добавлен дважды`);
    for (const e of def.fleet) {
      if (!BASE_CFG.ships[e.type]) throw new Error(`Уровень ${def.id}: неизвестный корабль ${e.type}`);
    }
    def = { win: 'sinkAll', config: {}, ...def, stars: { fortress: 0.75, powder: Infinity, ...def.stars } };
    this.list.push(def);
    this.list.sort((a, b) => a.n - b.n);
  },

  get(id) { return this.list.find(l => l.id === id) || null; },
  next(level) { return this.list.find(l => l.n === level.n + 1) || null; },
  prev(level) { return this.list.find(l => l.n === level.n - 1) || null; },

  // Итоговая конфигурация боя: копия базы + переопределения уровня + модификаторы профиля.
  // BASE_CFG не меняется; бой работает только с собранной копией.
  buildConfig(level, profile) {
    const cfg = structuredClone(BASE_CFG);
    deepMerge(cfg, level.config);
    cfg.fleet = level.fleet.map(e => ({ ...e }));
    cfg.win = level.win;
    Profile.applyModifiers(cfg, profile);
    return cfg;
  },
};

// Слияние: объекты — рекурсивно, массивы и числа — заменой
function deepMerge(dst, src) {
  for (const [k, v] of Object.entries(src || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) {
      deepMerge(dst[k], v);
    } else {
      dst[k] = structuredClone(v);
    }
  }
  return dst;
}
