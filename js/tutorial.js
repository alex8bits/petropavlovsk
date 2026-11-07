// Обучение: подсказки по ходу боя. Шаги — в данных уровня (поле tutorial, см. js/levels.js).
// Подсказки не останавливают бой и идут по одной: шаг появляется, когда выполнено when, и уходит,
// когда выполнено done (но не раньше чем через minTime с). Показываются, пока бой не выигран
// и включены в настройках.
//
// Шаг: { text: строка или (game) => строка, focus?: что подсветить, when?(game), done(game, since), after? }
//   focus — 'cannon' (пушка на берегу) или элемент интерфейса: 'angle', 'store', 'powder', 'ball', 'fire',
//           'status', 'cannonHp', 'fortress', 'fortGuns'
//   since — снимок боя в момент показа шага: { angle, powder, shots, hits, sunk, ballType, time }
//   after — шаг уходит сам через столько секунд (вместо done или вместе с ним: что раньше)

const Tutorial = {
  steps: null, index: 0, shown: false, t: 0, since: null,
  minTime: 1.5,

  start(level) {
    const on = Settings.data.hints && level.tutorial && !Profile.levelRecord(level.id).won;
    this.steps = on ? level.tutorial : null;
    this.index = 0;
    this.shown = false;
  },

  stop() { this.steps = null; },

  // Для when: корабль уже вышел на экран
  shipInView(g) { return g.ships.some(s => s.alive && s.hull.getPosition().x < CFG.world.width - 2); },

  snapshot(g) {
    const c = g.cannon;
    return { angle: c.angle, powder: c.powder, shots: g.shots, hits: g.hits, sunk: g.sunk, ballType: c.ballType, time: g.time };
  },

  update(g, dt) {
    if (!this.steps || this.index >= this.steps.length || g.state !== 'play') return;
    const step = this.steps[this.index];
    if (!this.shown) {
      if (step.when && !step.when(g)) return;
      this.shown = true;
      this.t = 0;
      this.since = this.snapshot(g);
      Sound.event('hint');
      return;
    }
    this.t += dt;
    if (this.t < this.minTime) return;
    const timeUp = step.after !== undefined && this.t >= step.after;
    if (timeUp || (step.done && step.done(g, this.since))) {
      this.index++;
      this.shown = false;
    }
  },

  // Текущая подсказка для отрисовки: { text, focus, n, total } или null
  current(g) {
    if (!this.steps || !this.shown || g.state !== 'play') return null;
    const step = this.steps[this.index];
    return {
      text: typeof step.text === 'function' ? step.text(g) : step.text,
      focus: step.focus || null, n: this.index + 1, total: this.steps.length,
      fade: Math.min(1, this.t / 0.3),
    };
  },
};
