// Бот для проверки баланса. В игру не подключён: загружается из консоли страницы
//   await new Promise(r => { const s = document.createElement('script'); s.src = 'tools/bot.js'; s.onload = r; document.head.append(s); })
// и прогоняет бой мгновенно, без записи в сохранение:
//   Bot.run('training')                    — бот стреляет
//   Bot.run('training', { passive: true }) — игрок не стреляет (должно кончаться поражением, кроме учебных боёв)
// Результат: исход, потоплено, целостность крепости, расход пороха, время и звёзды.

const Bot = {
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

  run(id, { passive = false, maxTime = 600, ball = 'iron' } = {}) {
    const level = Levels.get(id);
    if (!level) throw new Error(`Нет уровня ${id}`);
    Game.stop();
    Game.start(level);
    Game.paused = true;
    Game.cannon.ballType = ball;
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
    };
    Game.stop();
    return out;
  },
};
