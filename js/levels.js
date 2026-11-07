// Уровни как данные. Каждый бой — отдельный файл в levels/, который вызывает Levels.add({...}).
// Файлы подключаются в index.html после этого скрипта.
//
// Формат уровня:
//   id        — строка, ключ в сохранении (не менять после выпуска: иначе прогресс потеряется)
//   n         — порядковый номер в кампании (1, 2, …); бой n+1 открывается победой в бою n
//   chapter   — номер главы (описание глав — в Levels.chapters ниже)
//   battery   — ключ из Batteries: рельеф берега, кладка, пушки крепости, точка на карте
//   title, date, briefing — тексты для карты и брифинга; history — историческая справка (2–3 строки)
//   config    — переопределения поверх базы и батареи (глубокое слияние), например
//               { powderStore: { start: 60 }, water: { waves: [...] }, weather: { fog: 0.6 } }
//   fleet     — эскадра: [{ t, type, stopX, name?, flag?, speedMul?, hpMul?, leaveAt? }] — когда (с), какой
//               корабль, где встаёт на якорь; name — историческое имя, flag — 'uk' (по умолчанию) или 'france';
//               leaveAt — на какой секунде боя корабль уходит: ушёл живым — бой проигран
//   win       — условие победы: 'sinkAll' (потопить всех) или { type: 'survive', time: с } —
//               продержаться столько секунд (потопить всех — тоже победа)
//   stars     — { fortress: доля целой кладки для 2-й звезды, powder: мешков пороха не больше для 3-й }

// Батареи Петропавловского порта (по статье «Петропавловская оборона»).
// config — рельеф и кладка батареи; map — точка на схеме карты кампании (viewBox 600×400),
// side — с какой стороны от точки подпись (по умолчанию: левее середины схемы — слева).
const Batteries = {
  signal: {
    name: 'Батарея № 1 «Сигнальная»',
    place: 'скала на Сигнальном мысу, у входа во внутренний рейд',
    commander: 'лейтенант П. Ф. Гаврилов',
    guns: '3 пушки 36-фунтовые и 2 двухпудовые бомбические',
    map: { x: 322, y: 244, side: 'left' },
    config: {
      shore: { topY: 6.5, edgeX: 10.5, slopeEndX: 12.6, kind: 'rock' },
      fortress: { wallCols: 6, wallRows: 8, towerRows: 5 },
      fortGuns: { count: 2 },
    },
  },
  koshka: {
    name: 'Батарея № 2 «Кошечная»',
    place: 'низкая песчаная коса Кошка, перед портовым ковшом',
    commander: 'лейтенант князь Д. П. Максутов',
    guns: '10 пушек 36-фунтовых и одна 24-фунтовая',
    map: { x: 382, y: 266 },
    config: {
      shore: { topY: 3.5, edgeX: 11, slopeEndX: 16.5, kind: 'sand' },
      fortress: { wallCols: 8, wallRows: 9, towerRows: 6 },
      fortGuns: { count: 2 },
    },
  },
  isthmus: {
    name: 'Батарея № 3 «Перешеечная»',
    place: 'перешеек между Сигнальной и Никольской сопками',
    commander: 'лейтенант князь А. П. Максутов',
    guns: '5 пушек 24-фунтовых',
    map: { x: 272, y: 190 },
    config: {
      // Бруствер был низким — кладка ниже и без башни
      shore: { topY: 4.6, edgeX: 10.5, slopeEndX: 14, kind: 'grass' },
      fortress: { wallCols: 7, wallRows: 6, towerRows: 0 },
      fortGuns: { count: 1 },
    },
  },
  cemetery: {
    name: 'Батарея № 4 «Кладбищенская»',
    place: 'обрыв Красного Яра, южнее Кошки',
    commander: 'мичман В. И. Попов',
    guns: '3 пушки 24-фунтовые',
    map: { x: 446, y: 318 },
    config: {
      shore: { topY: 8, edgeX: 10.5, slopeEndX: 12, kind: 'cliff' },
      fortress: { wallCols: 6, wallRows: 8, towerRows: 4 },
      fortGuns: { count: 1 },
    },
  },
  nikolsk: {
    name: 'Батарея № 7',
    place: 'берег Авачинской губы у северной оконечности Никольской сопки',
    commander: 'капитан-лейтенант В. К. Коралов',
    guns: '5 пушек 24-фунтовых',
    map: { x: 212, y: 104 },
    config: {
      shore: { topY: 5, edgeX: 10.5, slopeEndX: 13.5, kind: 'grass' },
      fortress: { wallCols: 7, wallRows: 7, towerRows: 3 },
      fortGuns: { count: 1 },
    },
  },
};

const Levels = {
  list: [],

  // Главы: название и сколько звёзд всего нужно, чтобы открыть первый бой главы
  chapters: {
    1: { title: 'Подготовка', stars: 0 },
    2: { title: 'Подход эскадры', stars: 2 },
    3: { title: 'Первый штурм', stars: 4 },
    4: { title: 'Второй штурм', stars: 10 },
  },

  add(def) {
    for (const k of ['id', 'n', 'chapter', 'title', 'fleet', 'battery']) {
      if (def[k] === undefined) throw new Error(`Уровень ${def.id || '?'}: нет поля ${k}`);
    }
    if (this.get(def.id)) throw new Error(`Уровень ${def.id} добавлен дважды`);
    if (!Batteries[def.battery]) throw new Error(`Уровень ${def.id}: неизвестная батарея ${def.battery}`);
    if (!this.chapters[def.chapter]) throw new Error(`Уровень ${def.id}: нет главы ${def.chapter}`);
    for (const e of def.fleet) {
      const T = BASE_CFG.ships[e.type];
      if (!T || typeof T !== 'object') throw new Error(`Уровень ${def.id}: неизвестный корабль ${e.type}`);
    }
    let win = def.win || 'sinkAll';
    if (typeof win === 'string') win = { type: win };
    if (!['sinkAll', 'survive'].includes(win.type)) throw new Error(`Уровень ${def.id}: неизвестное условие победы ${win.type}`);
    if (win.type === 'survive' && !(win.time > 0)) throw new Error(`Уровень ${def.id}: у боя на удержание нет time`);
    def = { config: {}, ...def, win, stars: { fortress: 0.75, powder: Infinity, ...def.stars } };
    this.list.push(def);
    this.list.sort((a, b) => a.n - b.n);
  },

  get(id) { return this.list.find(l => l.id === id) || null; },
  next(level) { return this.list.find(l => l.n === level.n + 1) || null; },
  prev(level) { return this.list.find(l => l.n === level.n - 1) || null; },
  last() { return this.list[this.list.length - 1] || null; },
  batteryOf(level) { return Batteries[level.battery]; },
  // Первый бой главы — к нему привязан порог звёзд
  isChapterStart(level) { const p = this.prev(level); return !p || p.chapter !== level.chapter; },

  // Итоговая конфигурация боя: копия базы + батарея + переопределения уровня + модификаторы профиля.
  // BASE_CFG не меняется; бой работает только с собранной копией.
  buildConfig(level, profile) {
    const cfg = structuredClone(BASE_CFG);
    deepMerge(cfg, Batteries[level.battery].config);
    deepMerge(cfg, level.config);
    cfg.fleet = level.fleet.map(e => ({ ...e })).sort((a, b) => a.t - b.t);
    cfg.win = { ...level.win };
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
