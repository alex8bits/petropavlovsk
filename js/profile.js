// Профиль игрока, сохранения и мастерская (улучшения, покупка ядер, казна).
// Профиль — одна запись в localStorage с номером версии. Старые версии переводятся
// в новую по цепочке MIGRATIONS, поэтому формат можно менять, не теряя прогресс.

const SAVE_KEY = 'petropavlovsk.save';
const SAVE_VERSION = 2;

// Переходы между версиями: MIGRATIONS[n] переводит запись версии n в версию n + 1.
const MIGRATIONS = {
  // 2 — мастерская: за уже полученные звёзды начисляется казна, место пушки поддержки — на стене
  1: d => {
    let stars = 0;
    for (const r of Object.values(d.levels || {})) stars += (r.stars || []).filter(Boolean).length;
    d.treasury = (d.treasury || 0) + stars * BASE_CFG.economy.starReward;
    d.fortSpot = 'wall';
    return d;
  },
};

// Линейный шаг между значениями уровня 0 и высшего уровня
const lerp = (a, b, lvl, max) => a + (b - a) * lvl / max;
const fmtNum = (x, digits = 1) => String(+x.toFixed(digits)).replace('.', ',');

// Ветки мастерской (порядок — как на экране)
const BRANCHES = [
  { key: 'cannon', name: 'Пушка', note: 'Ваше орудие: куда ляжет ядро и как быстро его чинят' },
  { key: 'powder', name: 'Пороховой склад', note: 'Сколько пороха под рукой и как часто его подвозят' },
  { key: 'support', name: 'Пушки поддержки', note: 'Автоматические пушки на крепости: без прокачки их нет' },
  { key: 'fortress', name: 'Крепость', note: 'Кладка и земляной вал перед ней' },
];

// Сколько всего звёзд нужно, чтобы купить уровень 1…5 любого улучшения
const UPGRADE_STARS = [0, 0, 0, 4, 9, 15];

// Улучшения: ключ → { branch, name, maxLevel, prices[уровень-1], hint, value(lvl) — текст значения,
// apply(cfg, lvl) — меняет собранную конфигурацию боя (не BASE_CFG), вызывается и для уровня 0;
// requires — { ключ: уровень }, без которого улучшение не покупается }.
// Промежуточные уровни — равными шагами между уровнем 0 и высшим.
const UPGRADES = {
  accuracy: {
    branch: 'cannon', name: 'Точность', maxLevel: 5, prices: [80, 140, 220, 320, 450],
    hint: 'Разброс угла и скорости ядра. Совсем точной пушка не станет: ядро круглое',
    value: l => `±${fmtNum(lerp(2.5, 1.0, l, 5), 2)}° и ±${fmtNum(lerp(6, 2.5, l, 5), 1)}%`,
    apply(cfg, l) { cfg.playerCannon.spread = lerp(2.5, 1.0, l, 5); cfg.playerCannon.speedSpread = lerp(0.06, 0.025, l, 5); },
  },
  repair: {
    branch: 'cannon', name: 'Ремонт', maxLevel: 5, prices: [50, 90, 140, 200, 280],
    hint: 'Сколько расчёт чинит разбитую пушку',
    value: l => `${fmtNum(lerp(12, 8, l, 5))} с`,
    apply(cfg, l) { cfg.playerCannon.repairTime = lerp(12, 8, l, 5); },
  },
  capacity: {
    branch: 'powder', name: 'Вместимость', maxLevel: 5, prices: [60, 100, 150, 210, 290],
    hint: 'Больше склад не вмещает; стартовый запас задаёт бой',
    value: l => `${Math.round(lerp(60, 110, l, 5))} мешков`,
    apply(cfg, l) { cfg.powderStore.capacity = Math.round(lerp(60, 110, l, 5)); },
  },
  resupply: {
    branch: 'powder', name: 'Подвоз', maxLevel: 5, prices: [70, 120, 180, 260, 350],
    hint: 'Как часто на батарею подвозят мешок пороха',
    value: l => `мешок за ${fmtNum(lerp(5.5, 3, l, 5))} с`,
    apply(cfg, l) { cfg.powderStore.resupplyEvery = lerp(5.5, 3, l, 5); },
  },
  supportCount: {
    branch: 'support', name: 'Количество', maxLevel: 2, prices: [150, 300],
    hint: 'Сколько пушек ставят на крепость (если у батареи хватает мест)',
    value: l => l ? `${l} ${l === 1 ? 'пушка' : 'пушки'}` : 'нет',
    apply(cfg, l) { cfg.fortGuns.count = Math.min(cfg.fortGuns.count, l); },
  },
  supportRange: {
    branch: 'support', name: 'Дальность', maxLevel: 5, prices: [50, 90, 140, 200, 280], requires: { supportCount: 1 },
    hint: 'Дальше этого пушки поддержки не стреляют',
    value: l => `${fmtNum(lerp(32, 40, l, 5))} м`,
    apply(cfg, l) { cfg.fortGuns.maxRange = lerp(32, 40, l, 5); },
  },
  supportReload: {
    branch: 'support', name: 'Перезарядка', maxLevel: 5, prices: [60, 110, 170, 240, 330], requires: { supportCount: 1 },
    hint: 'Пауза между выстрелами пушки поддержки',
    value: l => `${fmtNum(lerp(2.8, 2.0, l, 5), 2)} с`,
    apply(cfg, l) { cfg.fortGuns.reload = lerp(2.8, 2.0, l, 5); },
  },
  masonry: {
    branch: 'fortress', name: 'Прочность кладки', maxLevel: 5, prices: [60, 110, 170, 240, 330],
    hint: 'Какую нагрузку выдерживает раствор между кирпичами',
    value: l => `× ${fmtNum(lerp(1, 2, l, 5))}`,
    apply(cfg, l) { const k = lerp(1, 2, l, 5); cfg.brick.jointBreakForce *= k; cfg.brick.jointBreakTorque *= k; },
  },
  rampart: {
    branch: 'fortress', name: 'Земляной вал', maxLevel: 3, prices: [120, 220, 350],
    hint: 'Насыпь перед стеной принимает ядра на себя и не рушится',
    value: l => ['нет', 'низкий вал', 'вал повыше', 'высокий вал с фашинами'][l],
    apply(cfg, l) { cfg.rampart.level = l; },
  },
};

// Покупные ядра: пачками по pack штук, не больше maxPacks пачек; открываются с главы chapter.
// Купленное остаётся навсегда: каждый бой начинается с полным запасом.
const AMMO = {
  bomb: { pack: 3, price: 90, maxPacks: 4, chapter: 2, hint: 'Рвётся через полсекунды после удара о корабль или берег: взрыв и осколки бьют корпус, пушки, колесо и рубку вокруг. ' +
    'Упавшее в воду мимо корабля не рвётся. Легче чугунного, летит чуть медленнее и заряжается дольше' },
  heavy: { pack: 3, price: 80, maxPacks: 4, chapter: 3, hint: 'Бьёт сильнее и точнее, но летит медленнее и заряжается дольше' },
  hot: { pack: 3, price: 100, maxPacks: 4, chapter: 4, hint: 'Поджигает корабль: огонь ест корпус, рубку и мачту, пока команда его не потушит. ' +
    'Попавшее в трюм горит изнутри. Греется в печи — заряжается дольше чугунного' },
};

const Profile = {
  data: null,

  fresh() {
    return {
      version: SAVE_VERSION,
      treasury: 0,   // казна, руб.
      levels: {},    // id уровня → { stars: [bool, bool, bool], won, plays, bestPowder }
      upgrades: {},  // ключ UPGRADES → купленный уровень
      ammo: {},      // тип ядра → купленный запас (восстанавливается к каждому бою)
      fortSpot: 'wall', // где стоит единственная пушка поддержки на батарее с двумя местами
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
  // Казна: за каждый потопленный корабль (и в проигранном бою) и за каждую впервые полученную звезду.
  recordResult(level, res) {
    const r = this.levelRecord(level.id);
    const reward = this.rewardFor(r, res);
    r.plays++;
    if (res.win) {
      r.won = true;
      r.stars = r.stars.map((had, i) => had || res.stars[i]);
      if (r.bestPowder === null || res.powderSpent < r.bestPowder) r.bestPowder = res.powderSpent;
    }
    this.data.levels[level.id] = r;
    this.data.treasury += reward.total;
    this.save();
    return { record: r, reward };
  },

  // Награда за бой: { ships, stars, newStars, total } (record — запись боя до этого результата)
  rewardFor(record, res) {
    const E = BASE_CFG.economy;
    const newStars = res.win ? res.stars.filter((got, i) => got && !record.stars[i]).length : 0;
    const ships = Object.entries(res.sunkTypes || {}).reduce((sum, [t, n]) => sum + (E.shipReward[t] || 0) * n, 0);
    return { ships, stars: newStars * E.starReward, newStars, total: ships + newStars * E.starReward };
  },

  // ---------- Мастерская ----------
  upgradeLevel(key, profile = this.data) {
    const up = UPGRADES[key];
    return Math.max(0, Math.min(up.maxLevel, (profile.upgrades || {})[key] || 0));
  },

  // Можно ли купить следующий уровень: { lvl, max, price, stars, ok, reason }
  upgradeStatus(key) {
    const up = UPGRADES[key], lvl = this.upgradeLevel(key);
    if (lvl >= up.maxLevel) return { lvl, max: up.maxLevel, price: null, ok: false, reason: 'максимум' };
    const st = { lvl, max: up.maxLevel, price: up.prices[lvl], stars: UPGRADE_STARS[lvl + 1] || 0, ok: false };
    for (const [k, need] of Object.entries(up.requires || {})) {
      if (this.upgradeLevel(k) < need) return { ...st, reason: `сначала — ${BRANCHES.find(b => b.key === UPGRADES[k].branch).name.toLowerCase()}` };
    }
    if (this.totalStars() < st.stars) return { ...st, reason: `нужно ${st.stars} ★` };
    if (this.data.treasury < st.price) return { ...st, reason: 'не хватает казны' };
    return { ...st, ok: true, reason: '' };
  },

  buyUpgrade(key) {
    const st = this.upgradeStatus(key);
    if (!st.ok) return false;
    this.data.treasury -= st.price;
    this.data.upgrades[key] = st.lvl + 1;
    this.save();
    return true;
  },

  // Ядра открываются, когда открыт хоть один бой их главы (или дальше)
  ammoOpen(type) {
    return Levels.list.some(l => l.chapter >= AMMO[type].chapter && this.isUnlocked(l));
  },

  ammoStatus(type) {
    const A = AMMO[type], have = this.data.ammo[type] || 0, packs = Math.floor(have / A.pack);
    const st = { have, packs, max: A.maxPacks, price: A.price, ok: false };
    if (!this.ammoOpen(type)) return { ...st, reason: `откроется в главе ${A.chapter}` };
    if (packs >= A.maxPacks) return { ...st, reason: 'максимум' };
    if (this.data.treasury < A.price) return { ...st, reason: 'не хватает казны' };
    return { ...st, ok: true, reason: '' };
  },

  buyAmmo(type) {
    const st = this.ammoStatus(type);
    if (!st.ok) return false;
    this.data.treasury -= st.price;
    this.data.ammo[type] = st.have + AMMO[type].pack;
    this.save();
    return true;
  },

  setFortSpot(spot) {
    this.data.fortSpot = spot === 'tower' ? 'tower' : 'wall';
    this.save();
  },

  // Профиль со всеми улучшениями и полным запасом ядер (для бота; в сохранение не пишется)
  maxed() {
    const p = this.fresh();
    for (const [k, up] of Object.entries(UPGRADES)) p.upgrades[k] = up.maxLevel;
    for (const [k, A] of Object.entries(AMMO)) p.ammo[k] = A.pack * A.maxPacks;
    return p;
  },

  // Модификаторы профиля поверх собранной конфигурации боя: каждое улучшение (и на уровне 0),
  // купленные ядра — к тем, что выдал уровень, и выбранное место пушки поддержки
  applyModifiers(cfg, profile = this.data) {
    for (const key of Object.keys(UPGRADES)) UPGRADES[key].apply(cfg, this.upgradeLevel(key, profile));
    for (const [type, n] of Object.entries(profile.ammo || {})) {
      if (AMMO[type] && n > 0) cfg.ammo[type] = (cfg.ammo[type] || 0) + n;
    }
    cfg.fortGuns.spot = profile.fortSpot === 'tower' ? 'tower' : 'wall';
    return cfg;
  },
};
