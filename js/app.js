// Приложение: переключатель экранов, ввод, игровой цикл.
// Экраны: menu → map → briefing → battle (⇄ pause) → results → map …

const App = {
  screen: null,
  root: null,

  init() {
    this.root = document.getElementById('ui');
    this.root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (b && !b.disabled) this.act(b.dataset.act, b.dataset);
    });
    Profile.load();
    this.show('menu');
  },

  // Показать экран; 'battle' — без HTML поверх канваса
  show(name, params = {}) {
    this.screen = name;
    if (name === 'battle') {
      this.root.innerHTML = '';
      this.root.classList.add('hidden');
      if (document.activeElement) document.activeElement.blur(); // иначе Пробел «нажмёт» кнопку
      return;
    }
    this.root.innerHTML = Screens[name](params);
    this.root.classList.remove('hidden');
    this.root.classList.toggle('dim', Game.active); // поверх боя — полупрозрачная подложка
  },

  act(a, data) {
    switch (a) {
      case 'menu': return this.show('menu');
      case 'map': return this.show('map');
      case 'newCampaign': return Profile.hasProgress() ? this.show('confirmNew') : (Profile.reset(), this.show('map'));
      case 'confirmNew': Profile.reset(); return this.show('map');
      case 'briefing': {
        Game.stop();
        const level = Levels.get(data.id);
        if (!level || !Profile.isUnlocked(level)) return this.show('map');
        CFG = Levels.buildConfig(level, Profile.data); // фоном брифинга — берег этой батареи
        return this.show('briefing', { level });
      }
      case 'start': return this.startBattle(Levels.get(data.id));
      case 'resume': return this.resume();
      case 'restart': return this.startBattle(Game.level);
      case 'quit': Game.stop(); return this.show('map');
    }
  },

  startBattle(level) {
    if (!level) return this.show('map');
    Game.stop();
    Game.start(level);
    Game.onEnd = res => {
      const next = Levels.next(level);
      const wasOpen = next && Profile.isUnlocked(next);
      const record = Profile.recordResult(level, res);
      // Бой, который открылся этим результатом, и конец кампании — для сообщения на экране итогов
      const unlocked = next && !wasOpen && Profile.isUnlocked(next) ? next : null;
      const finished = res.win && !next;
      // Бой идёт дальше за экраном итогов (ввод выключен) и уничтожается, когда игрок с него уйдёт
      this.show('results', { level, res, record, unlocked, finished });
    };
    this.show('battle');
  },

  pause() {
    if (this.screen !== 'battle' || Game.state !== 'play') return;
    Game.paused = true;
    Game.keys = {};
    this.show('pause');
  },

  resume() {
    if (this.screen !== 'pause') return;
    Game.paused = false;
    this.show('battle');
  },
};

// ---------- Ввод в бою ----------
window.addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    if (App.screen === 'battle') App.pause();
    else if (App.screen === 'pause') App.resume();
    else if (App.screen === 'briefing') App.show('map');
    return;
  }
  if (App.screen !== 'battle' || !Game.active || Game.paused) return;
  Game.keys[e.code] = true;
  const c = Game.cannon;
  if (e.code === 'Space') { e.preventDefault(); Game.playerFire(); }
  // Порох: ← меньше, → больше (1–5 мешков)
  if (e.code === 'ArrowRight') c.powder = Math.min(MAX_POWDER, c.powder + 1);
  if (e.code === 'ArrowLeft') c.powder = Math.max(1, c.powder - 1);
  if (e.code === 'KeyQ' || e.code === 'Tab') { e.preventDefault(); c.ballType = c.ballType === 'iron' ? 'heavy' : 'iron'; }
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', e => { Game.keys[e.code] = false; });
window.addEventListener('wheel', e => {
  if (App.screen !== 'battle' || !Game.active || Game.paused) return;
  const pc = CFG.playerCannon, c = Game.cannon;
  c.angle = Math.max(pc.minAngle, Math.min(pc.maxAngle, c.angle - Math.sign(e.deltaY)));
}, { passive: true });
// Ушли из вкладки посреди боя — пауза
window.addEventListener('blur', () => App.pause());

// ---------- Запуск ----------
App.init();
Render.init(document.getElementById('game'));
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  const dt = CFG.world.step;
  while (acc >= dt) {
    if (Game.active && !Game.paused) Game.step(dt);
    else if (!Game.active) Physics.time += dt; // волны на фоне меню
    acc -= dt;
  }
  Render.draw(Game.active ? Game : null);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
