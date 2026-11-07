// Настройки игрока (звук, подсказки) и звук. Звуки синтезируются Web Audio — без файлов.
// Настройки хранятся отдельно от профиля: «Новая кампания» их не стирает.

const SETTINGS_KEY = 'petropavlovsk.settings';

const Settings = {
  data: null,
  defaults: { sound: true, volume: 0.7, hints: true },

  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(SETTINGS_KEY)); } catch (e) { /* нет хранилища или мусор */ }
    this.data = { ...this.defaults, ...(d && typeof d === 'object' ? d : {}) };
    return this.data;
  },

  set(key, value) {
    this.data[key] = value;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.data)); } catch (e) { /* не сохранится — не беда */ }
    Sound.applyVolume();
  },
};

// Sound.play(имя, { x, power }) — звук в точке x мира (панорама слева направо), power 0…1 — громкость.
// Sound.event(...) — то же для событий боя: молчит, когда бой прогоняется без отрисовки
// (бот и проверки ставят Game.paused = true и шагают вручную).
const Sound = {
  ctx: null, master: null, noise: null, amb: null,
  last: {},                       // имя → время последнего запуска (чтобы залп кирпичей не ревел)
  gap: { stone: 0.06, wood: 0.08, earth: 0.06, splash: 0.07, crash: 0.15, spark: 0.1, empty: 0.25 },

  // AudioContext создаётся по первому жесту игрока (иначе браузер его не запустит)
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master = ctx.createGain();
      this.master.connect(comp).connect(ctx.destination);
      // Секунда белого шума — сырьё почти для всех звуков
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      this.noise = buf;
      this.applyVolume();
      this.startAmbient();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  applyVolume() {
    if (!this.master) return;
    const S = Settings.data;
    this.master.gain.setTargetAtTime(S.sound ? S.volume : 0, this.ctx.currentTime, 0.05);
  },

  ready() {
    return this.ctx && this.ctx.state === 'running' && Settings.data.sound;
  },

  event(name, opts) {
    if (!Game.active || Game.paused) return;
    this.play(name, opts);
  },

  play(name, { x = null, power = 1 } = {}) {
    if (!this.ready() || !this.sfx[name]) return;
    const t = this.ctx.currentTime;
    if (this.gap[name] && t - (this.last[name] || -1) < this.gap[name]) return;
    this.last[name] = t;
    // Панорама: левый край мира — левый канал
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = x === null ? 0 : Math.max(-0.8, Math.min(0.8, (x / CFG.world.width) * 1.6 - 0.8));
    pan.connect(this.master);
    this.sfx[name].call(this, pan, t, Math.max(0.05, Math.min(1, power)));
  },

  // ---------- Строительные блоки ----------
  // Шум через фильтр с огибающей громкости: attack, decay — с; f — частота фильтра (или [от, до])
  burst(out, t, { type = 'lowpass', f = 1000, q = 0.7, gain = 1, attack = 0.003, decay = 0.3, offset = 0 }) {
    const ctx = this.ctx, src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise;
    flt.type = type; flt.Q.value = q;
    const [f0, f1] = Array.isArray(f) ? f : [f, f];
    flt.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) flt.frequency.exponentialRampToValueAtTime(f1, t + attack + decay);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(flt).connect(g).connect(out);
    src.start(t, offset || Math.random() * 1.5);
    src.stop(t + attack + decay + 0.05);
  },

  // Тон со спадом частоты: удар, гул, скрип дерева
  tone(out, t, { wave = 'sine', f = 60, f1 = null, gain = 1, attack = 0.005, decay = 0.4 }) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(f, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + attack + decay);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  },

  // ---------- Звуки ----------
  sfx: {
    // Выстрел пушки игрока: power — доля заряда (1–5 мешков)
    shot(out, t, p) {
      this.burst(out, t, { f: [2400 + 2000 * p, 300], gain: 0.55 + 0.45 * p, decay: 0.5 + 0.7 * p });
      this.burst(out, t, { f: 180, gain: 0.7, attack: 0.01, decay: 1.2 + 0.6 * p });
      this.tone(out, t, { f: 70, f1: 32, gain: 0.8 + 0.2 * p, decay: 0.5 });
    },
    // Выстрел корабля — дальше и глуше
    enemyShot(out, t, p) {
      this.burst(out, t, { f: [900, 200], gain: 0.35 * p, decay: 0.9 });
      this.tone(out, t, { f: 55, f1: 30, gain: 0.35 * p, attack: 0.01, decay: 0.6 });
    },
    // Пушка поддержки на крепости — калибр меньше
    fortShot(out, t, p) {
      this.burst(out, t, { f: [3000, 500], gain: 0.35 * p, decay: 0.45 });
      this.tone(out, t, { f: 95, f1: 45, gain: 0.35 * p, decay: 0.3 });
    },
    // Ядро о дерево: корпус, доски, колесо
    wood(out, t, p) {
      this.burst(out, t, { type: 'bandpass', f: [900, 350], q: 1.2, gain: 0.8 * p, decay: 0.18 });
      this.tone(out, t, { wave: 'triangle', f: 160, f1: 70, gain: 0.6 * p, decay: 0.22 });
    },
    // Ядро о камень кладки
    stone(out, t, p) {
      this.burst(out, t, { type: 'bandpass', f: [2600, 900], q: 0.9, gain: 0.6 * p, decay: 0.12 });
      this.tone(out, t, { f: 110, f1: 50, gain: 0.55 * p, decay: 0.2 });
      this.burst(out, t + 0.04, { type: 'highpass', f: 3000, gain: 0.15 * p, decay: 0.35 }); // осыпь
    },
    // Земля: берег, вал
    earth(out, t, p) {
      this.burst(out, t, { f: [500, 150], gain: 0.7 * p, attack: 0.005, decay: 0.3 });
    },
    // Металл: пушка выведена из строя
    metal(out, t, p) {
      this.tone(out, t, { wave: 'square', f: 520, f1: 380, gain: 0.08 * p, decay: 0.5 });
      this.tone(out, t, { wave: 'triangle', f: 1270, f1: 1100, gain: 0.12 * p, decay: 0.7 });
      this.burst(out, t, { type: 'bandpass', f: 1800, q: 2, gain: 0.4 * p, decay: 0.1 });
    },
    splash(out, t, p) {
      this.burst(out, t, { type: 'bandpass', f: [2200, 500], q: 0.8, gain: 0.55 * p, attack: 0.01, decay: 0.35 + 0.3 * p });
      this.burst(out, t + 0.05, { type: 'highpass', f: 2500, gain: 0.18 * p, attack: 0.03, decay: 0.5 });
    },
    // Ломается дерево: мачта, колесо
    crash(out, t, p) {
      for (let i = 0; i < 5; i++) {
        const dt = i * 0.05 + Math.random() * 0.04;
        this.burst(out, t + dt, { type: 'bandpass', f: 600 + Math.random() * 900, q: 3, gain: 0.5 * p, decay: 0.08 });
      }
      this.tone(out, t, { wave: 'sawtooth', f: 90, f1: 55, gain: 0.12 * p, attack: 0.02, decay: 0.5 });
    },
    // Корабль уходит под воду: гул и пузыри
    sink(out, t, p) {
      this.burst(out, t, { f: [400, 120], gain: 0.6 * p, attack: 0.3, decay: 2.5 });
      for (let i = 0; i < 10; i++) {
        const f = 250 + Math.random() * 500;
        this.tone(out, t + 0.3 + Math.random() * 2, { f, f1: f * 1.8, gain: 0.12 * p, attack: 0.01, decay: 0.08 });
      }
    },
    // Вспыхнул пожар
    ignite(out, t, p) {
      this.burst(out, t, { type: 'bandpass', f: [250, 1800], q: 0.8, gain: 0.5 * p, attack: 0.15, decay: 0.6 });
      for (let i = 0; i < 6; i++) this.burst(out, t + 0.2 + Math.random() * 0.8, { type: 'highpass', f: 3500, gain: 0.25 * p, attack: 0.001, decay: 0.02 });
    },
    // Сухой щелчок: не хватает пороха
    empty(out, t) {
      this.burst(out, t, { type: 'highpass', f: 2000, gain: 0.25, attack: 0.001, decay: 0.03 });
      this.tone(out, t, { wave: 'square', f: 180, gain: 0.04, attack: 0.001, decay: 0.05 });
    },
    // Пушка снова в строю
    repaired(out, t) {
      this.tone(out, t, { wave: 'triangle', f: 1400, gain: 0.15, attack: 0.002, decay: 0.15 });
      this.tone(out, t + 0.1, { wave: 'triangle', f: 1900, gain: 0.12, attack: 0.002, decay: 0.2 });
    },
    // Кнопки экранов
    click(out, t) {
      this.tone(out, t, { wave: 'triangle', f: 900, f1: 600, gain: 0.12, attack: 0.001, decay: 0.05 });
    },
    // Подсказка обучения
    hint(out, t) {
      this.tone(out, t, { wave: 'sine', f: 660, gain: 0.12, attack: 0.01, decay: 0.25 });
      this.tone(out, t + 0.12, { wave: 'sine', f: 880, gain: 0.1, attack: 0.01, decay: 0.3 });
    },
    // Конец боя: горн — мажорное трезвучие или нисходящее минорное
    win(out, t) {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(out, t + i * 0.16, { wave: 'triangle', f, gain: 0.22, attack: 0.02, decay: i === 3 ? 0.9 : 0.25 }));
    },
    lose(out, t) {
      [440, 415, 349, 294].forEach((f, i) => this.tone(out, t + i * 0.28, { wave: 'triangle', f, gain: 0.2, attack: 0.03, decay: i === 3 ? 1.1 : 0.35 }));
    },
  },

  // ---------- Волны: непрерывный шум прибоя ----------
  startAmbient() {
    const ctx = this.ctx;
    const mk = (type, f, q) => {
      const src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = this.noise; src.loop = true;
      flt.type = type; flt.frequency.value = f; flt.Q.value = q;
      g.gain.value = 0;
      src.connect(flt).connect(g).connect(this.master);
      src.start();
      return g;
    };
    this.amb = { low: mk('lowpass', 420, 0.5), hiss: mk('bandpass', 1400, 0.6), level: 0 };
  },

  // Каждый кадр: громкость прибоя дышит с волной; level — сила волнения (≈ 1 в обычный день)
  updateAmbient(level) {
    if (!this.amb || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime, ph = Physics.time;
    const swell = 0.55 + 0.45 * Math.sin(ph * 0.9) * Math.sin(ph * 0.37 + 1);
    const k = Math.min(1.6, level);
    this.amb.low.gain.setTargetAtTime(0.11 * k * (0.6 + 0.4 * swell), t, 0.3);
    this.amb.hiss.gain.setTargetAtTime(0.035 * k * swell * swell, t, 0.3);
  },
};

Settings.load();
// Первый жест игрока запускает звук
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => Sound.unlock(), { capture: true });
