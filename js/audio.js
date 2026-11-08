// Настройки игрока (звук, подсказки) и звук. Гибрид: выстрелы, удар о дерево, всплеск и треск мачты —
// записи из sounds/, остальное (и запасной вариант при незагруженной записи) — синтез Web Audio.
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
// Слушатель — зритель перед серединой поля (вид сбоку): панорама по x, к краям поля звук чуть глуше
// и с большей долей эха; задержки по расстоянию нет. Эхо губы — общий ConvolverNode (reverb).
const Sound = {
  ctx: null, master: null, noise: null, amb: null, reverb: null,
  last: {},                       // имя → время последнего запуска (чтобы залп кирпичей не ревел)
  gap: { blast: 0.05, stone: 0.06, wood: 0.08, earth: 0.06, splash: 0.07, crash: 0.15, spark: 0.1, empty: 0.25 },
  // Доля эха у звука (посыл в reverb); нет в списке — сухой (интерфейс, подсказки)
  wet: {
    shot: 0.55, enemyShot: 0.7, fortShot: 0.55,
    wood: 0.3, stone: 0.3, earth: 0.25, metal: 0.35, splash: 0.3,
    crash: 0.35, blast: 0.65, sink: 0.4, ignite: 0.25, win: 0.3, lose: 0.3,
  },
  edge: { cutoff: 7000, wet: 0.5 }, // у края поля: срез высоких, Гц, и прибавка к доле эха (× wet)

  // Записи (sounds/*.mp3, источники — sounds/CREDITS.md). Вариант — [файл, начало, с; длина, с; громкость?]:
  // файлы не обрезаны, нужный кусок вырезается при проигрывании. Нет записи (не загрузилась) — синтез sfx.
  // Начало — за 10 мс до удара (иначе звук отстаёт от вспышки); громкость выравнивает варианты
  // по первым 300 мс удара. Новый вариант выстрела — сверять с этими по тембру: глухая запись
  // (мало высоких) на фоне остальных кажется пропавшей.
  recordings: {
    shot:   [['cannon-shot', 0.145, 4.4, 0.51], ['cannon-shot', 6.38, 4.4, 0.53],
             ['cannon-naval', 0.255, 5.0, 2.0],  // долгий гул: громкость — между выравниванием по 0,3 и по 1 с
             ['cannon-field', 0.37, 3.2, 0.64]], // до 0,37 с — ветер полевой записи
    wood:   [['wood-crate-smash', 0, 1.15]],
    splash: [['splash-big', 0, 2.17]],
    crash:  [['tree-fall', 4.2, 3.3], ['tree-fall', 1.6, 2.4]],
  },
  // Событие → набор записей и обработка: громкость от power, высота (rate), срез высоких (lowpass, Гц)
  recordingUse: {
    shot:      { set: 'shot', gain: p => 0.5 + 0.4 * p, rate: 1 },
    enemyShot: { set: 'shot', gain: p => 0.45 * p, rate: 0.92, lowpass: 1600 }, // дальше и глуше
    fortShot:  { set: 'shot', gain: p => 0.4 * p, rate: 1.18, lowpass: 5000 },  // калибр меньше
    wood:      { set: 'wood', gain: p => 0.85 * p, rate: 1 },
    splash:    { set: 'splash', gain: p => 0.7 * p, rate: 1 },
    crash:     { set: 'crash', gain: p => 0.8 * p, rate: 1 },
    blast:     { set: 'shot', gain: p => 0.55 * p, rate: 0.8, lowpass: 2600 }, // взрыв бомбы — ниже и глуше выстрела
  },
  variation: { rate: 0.06, gain: 0.1 }, // случайный разброс высоты и громкости записи (±доля)
  buffers: {},                          // файл → AudioBuffer (что загрузилось)
  lastVariant: {},                      // событие → номер последнего варианта (не повторять подряд)

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
      // Эхо губы: отклик синтезирован, возврат — в общий master (громкость и компрессор те же)
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.makeImpulse();
      const ret = ctx.createGain();
      ret.gain.value = 0.7;
      this.reverb.connect(ret).connect(this.master);
      this.applyVolume();
      this.startAmbient();
      this.loadRecordings();
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
    const ctx = this.ctx;
    // Место на экране: u — от -1 (левый край мира) до 1 (правый), off — удалённость от середины 0…1
    const u = x === null ? 0 : Math.max(-1, Math.min(1, (x / CFG.world.width) * 2 - 1));
    const off = Math.abs(u);
    // Вход — моно: панорама одинакова для моно- и стерео-записей и синтеза (иначе стерео-запись у края
    // поля выходит на ~5 дБ громче моно)
    const input = ctx.createGain();
    input.channelCount = 1; input.channelCountMode = 'explicit'; input.channelInterpretation = 'speakers';
    // Прямой звук: к краям чуть глуше; панорама — левый край мира в левом канале
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.5;
    lp.frequency.value = 20000 * Math.pow(this.edge.cutoff / 20000, off);
    const pan = ctx.createStereoPanner();
    pan.pan.value = 0.8 * u;
    input.connect(lp).connect(pan).connect(this.master);
    // Посыл в эхо — до панорамы: отражения от склонов приходят со всех сторон
    const wet = (this.wet[name] || 0) * (1 + this.edge.wet * off);
    if (wet > 0 && this.reverb) {
      const send = ctx.createGain();
      send.gain.value = wet;
      input.connect(send).connect(this.reverb);
    }
    const p = Math.max(0.05, Math.min(1, power));
    if (!this.playRecording(name, input, t, p)) this.sfx[name].call(this, input, t, p);
  },

  // Загрузка записей в фоне (после первого жеста): меню не ждёт, ошибка — просто останется синтез
  loadRecordings() {
    const files = new Set();
    for (const set of Object.values(this.recordings)) for (const [f] of set) files.add(f);
    for (const f of files) {
      fetch(`sounds/${f}.mp3`)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(ab => new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej))) // колбэки — для старого Safari
        .then(buf => { this.buffers[f] = buf; })
        .catch(() => { /* нет файла или не декодировался — событие звучит синтезом */ });
    }
  },

  // Кусок записи для события; false — записи нет, играть синтез
  playRecording(name, out, t, p) {
    const use = this.recordingUse[name];
    if (!use) return false;
    const ready = this.recordings[use.set].map((v, i) => [v, i]).filter(([[f]]) => this.buffers[f]);
    if (!ready.length) return false;
    let pick = ready[Math.floor(Math.random() * ready.length)];
    if (ready.length > 1 && pick[1] === this.lastVariant[name]) pick = ready[(ready.indexOf(pick) + 1) % ready.length];
    this.lastVariant[name] = pick[1];
    const [[file, start, len, level = 1]] = pick, V = this.variation, ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.buffers[file];
    src.playbackRate.value = use.rate * (1 + (Math.random() * 2 - 1) * V.rate);
    const dur = len / src.playbackRate.value; // длина куска в реальном времени
    // × √2: вход play — моно, а моно в середине панорамы делится на каналы по 0,707 (−3 дБ); стерео-запись
    // до сведения в моно звучала без этой потери
    const g = ctx.createGain(), vol = Math.SQRT2 * level * use.gain(p) * (1 + (Math.random() * 2 - 1) * V.gain);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.setValueAtTime(vol, t + Math.max(0.005, dur - 0.15));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = src;
    if (use.lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = use.lowpass; lp.Q.value = 0.5;
      node = node.connect(lp);
    }
    node.connect(g).connect(out);
    src.start(t, start, len);
    return true;
  },

  // Отклик губы для ConvolverNode, стерео ~3 с: плотный хвост, темнеющий со временем (воздух и склоны
  // глушат высокие), и несколько поздних эхо от сопок — каждое глуше и тише предыдущего.
  makeImpulse() {
    const ctx = this.ctx, sr = ctx.sampleRate, len = Math.floor(sr * 3);
    const buf = ctx.createBuffer(2, len, sr);
    const echoes = [[0.32, 0.45], [0.55, 0.3], [0.85, 0.2]]; // [время, с; громкость]
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lpState = 0;
      for (let i = 0; i < len; i++) {
        const s = i / sr;
        // Хвост: экспоненциальный спад (≈ −60 дБ за 2,6 с), фильтр темнеет со временем
        const env = Math.exp(-s * 2.65) * Math.min(1, s / 0.012);
        const k = Math.max(0.04, 0.6 * Math.exp(-s * 1.4)); // коэффициент однополюсного lowpass
        lpState += k * ((Math.random() * 2 - 1) - lpState);
        d[i] = lpState * env * 0.6;
      }
      // Поздние эхо: короткие тёмные всплески, в каналах чуть разнесены по времени
      for (const [at, g] of echoes) {
        const start = Math.floor((at + (c ? 0.013 : 0)) * sr), n = Math.floor(0.25 * sr);
        let st = 0;
        for (let j = 0; j < n && start + j < len; j++) {
          st += 0.08 * ((Math.random() * 2 - 1) - st);
          d[start + j] += st * g * Math.exp(-j / sr * 14) * 2.2;
        }
      }
    }
    return buf;
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
    // Взрыв бомбы: глухой удар, треск осколков
    blast(out, t, p) {
      this.burst(out, t, { f: [1400, 160], gain: 0.7 * p, attack: 0.004, decay: 0.9 });
      this.tone(out, t, { f: 60, f1: 26, gain: 0.9 * p, attack: 0.005, decay: 0.7 });
      this.burst(out, t + 0.03, { type: 'highpass', f: 2800, gain: 0.2 * p, decay: 0.3 });
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
