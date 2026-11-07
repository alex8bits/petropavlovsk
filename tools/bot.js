// Бот для проверки баланса. В игру не подключён: загружается из консоли страницы
//   await new Promise(r => { const s = document.createElement('script'); s.src = 'tools/bot.js'; s.onload = r; document.head.append(s); })
// и прогоняет бой мгновенно, без записи в сохранение:
//   Bot.run('training')                    — бот стреляет, профиль без улучшений
//   Bot.run('training', { passive: true }) — игрок не стреляет (должно кончаться поражением, кроме учебных боёв)
//   Bot.run('krasny-yar', { profile: 'max', ball: 'heavy' }) — всё прокачано; тяжёлые, пока не кончатся
// profile: 'zero' (по умолчанию) — без улучшений и купленных ядер, 'max' — Profile.maxed(), 'save' — текущее
// сохранение, или объект профиля.
// Результат: исход, потоплено, целостность крепости, расход пороха, время и звёзды.
//
// Кампания целиком (асинхронно, вкладка не зависает; итог — в Bot.report):
//   Bot.campaign({ profile: 'zero', runs: 3 }) — каждый бой runs раз; Bot.report — сводка по боям

const Bot = {
  profileOf(p) {
    if (p === 'max') return Profile.maxed();
    if (p === 'save') return Profile.data;
    if (p && typeof p === 'object') return p;
    return Profile.fresh();
  },

  // Цель — ближайший живой корабль на экране; заряд — наименьший, которым ядро долетает
  // (с упреждением на ход корабля). Выстрел — как только пушка готова и хватает пороха.
  aim() {
    const c = Game.cannon, pc = CFG.playerCannon;
    if (c.reload > 0 || c.hp <= 0) return;
    let target = null;
    for (const s of Game.ships) {
      if (!s.alive) continue;
      const x = s.hull.getPosition().x;
      if (x > CFG.world.width - 2) continue;
      if (!target || x < target.hull.getPosition().x) target = s;
    }
    if (!target) return;
    const sp = target.hull.getPosition(), sv = target.hull.getLinearVelocity();
    if (Game.ammoLeft(c.ballType) <= 0) c.ballType = 'iron';
    const B = CFG.balls[c.ballType];
    for (let pw = 1; pw <= MAX_POWDER; pw++) {
      const v = CFG.powderSpeed[pw] * B.speedMul;
      let aim = { x: sp.x, y: sp.y + 0.3 };
      let th = Game.solveFromMuzzle(c.pivot, pc.barrelLength, 1, aim, v);
      if (th === null) continue;
      const tFlight = (aim.x - c.pivot.x) / (v * Math.cos(th));
      th = Game.solveFromMuzzle(c.pivot, pc.barrelLength, 1, { x: sp.x + sv.x * tFlight, y: aim.y }, v);
      if (th === null) continue;
      const deg = th * 180 / Math.PI;
      if (deg < pc.minAngle || deg > pc.maxAngle) continue;
      if (Game.powder < pw) return; // ждём подвоза: заряд не урезаем
      c.angle = deg;
      c.powder = pw;
      Game.playerFire();
      return;
    }
  },

  run(id, { passive = false, maxTime = 600, ball = 'iron', profile = 'zero' } = {}) {
    const level = Levels.get(id);
    if (!level) throw new Error(`Нет уровня ${id}`);
    Game.stop();
    Game.start(level, this.profileOf(profile));
    Game.paused = true;
    Game.cannon.ballType = Game.ammoLeft(ball) > 0 ? ball : 'iron';
    const dt = CFG.world.step;
    while (!Game.endReported && Game.time < maxTime) {
      if (!passive && Game.state === 'play') this.aim();
      Game.step(dt);
    }
    const r = Game.state === 'play' ? { ...Game.results(), message: 'время вышло' } : Game.results();
    const out = {
      id, passive, state: Game.state, sunk: `${r.sunk}/${r.total}`,
      integrity: Math.round(r.integrity * 100), powder: r.powderSpent, time: Math.round(r.time),
      accuracy: Math.round(r.accuracy * 100), stars: r.stars.map(Number).join(''),
      ammoLeft: { ...Game.ammo },
    };
    Game.stop();
    return out;
  },

  // Прогон всех боёв по runs раз. Тяжёлым ядром бот стреляет, пока оно есть.
  // Bot.report: [{ id, wins, runs, results: [...] }]; Bot.done — закончил ли.
  async campaign({ profile = 'zero', runs = 3, passive = false, ids = null } = {}) {
    this.report = [];
    this.done = false;
    for (const level of Levels.list) {
      if (ids && !ids.includes(level.id)) continue;
      const row = { id: level.id, n: level.n, wins: 0, runs, results: [] };
      this.report.push(row);
      for (let i = 0; i < runs; i++) {
        const r = this.run(level.id, { profile, passive, ball: 'heavy' });
        row.results.push(`${r.state} ${r.sunk} к${r.integrity} п${r.powder} ★${r.stars}`);
        if (r.state === 'win') row.wins++;
        await new Promise(res => setTimeout(res, 0)); // дать вкладке подышать
      }
    }
    this.done = true;
    return this.report;
  },
};
