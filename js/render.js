// Отрисовка на Canvas: небо, берег, кирпичи, корабли, вода, интерфейс.

const Render = {
  canvas: null, ctx: null, s: 30, ox: 0, buttons: [], clouds: [],
  // Шрифты канваса — те же, что в css/ui.css (грузятся с Google Fonts)
  FONT: "'PT Serif', Georgia, serif", TITLE: "'Old Standard TT', Georgia, serif",

  init(canvas) {
    Flags.init();
    // Канвас сам шрифты не подгружает: просим заранее, чтобы интерфейс боя не мигал запасным
    if (document.fonts) [`14px ${this.FONT}`, `bold 48px ${this.TITLE}`].forEach(f => document.fonts.load(f).catch(() => {}));
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = CFG.world.width, H = CFG.world.height;
      const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
      canvas.style.width = (W * scale) + 'px';
      canvas.style.height = (H * scale) + 'px';
      canvas.style.marginTop = ((window.innerHeight - H * scale) / 2) + 'px';
      canvas.width = Math.round(W * scale * dpr);
      canvas.height = Math.round(H * scale * dpr);
      this.s = scale * dpr;
      this.dpr = dpr;
    };
    window.addEventListener('resize', resize);
    resize();
    for (let i = 0; i < 6; i++) this.clouds.push({ x: Math.random() * 60, y: 14 + Math.random() * 6, w: 3 + Math.random() * 4, sp: 0.2 + Math.random() * 0.3 });
    canvas.addEventListener('click', e => this.onClick(e));
    // Касания: протяжка по полю — угол, зажатые ▲ ▼ — как клавиши ↑ ↓
    this.touch = !!(window.matchMedia && matchMedia('(any-pointer: coarse)').matches);
    canvas.addEventListener('pointerdown', e => this.onPointerDown(e));
    canvas.addEventListener('pointermove', e => this.onPointerMove(e));
    for (const t of ['pointerup', 'pointercancel']) canvas.addEventListener(t, e => this.onPointerUp(e));
  },

  // мир → экран
  X(x) { return x * this.s; },
  Y(y) { return (CFG.world.bottom + CFG.world.height - y) * this.s; },

  // Точка события → пиксели канваса и кнопка под ней из списка
  hitTest(e, list) {
    const r = this.canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * this.dpr, y = (e.clientY - r.top) * this.dpr;
    return list.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;
  },

  onClick(e) {
    const b = this.hitTest(e, this.buttons);
    if (b) b.fn();
  },

  // ---------- Касания ----------
  AIM_PX_PER_DEG: 8, // протяжка пальцем: CSS-пикселей на градус ствола
  holds: [],         // кнопки ▲ ▼ (рисуются только на сенсорном экране)
  pointers: new Map(), // pointerId → { key } (зажата ▲/▼) или { lastY } (наводка протяжкой)

  aiming() { return App.screen === 'battle' && Game.active && !Game.paused && Game.state === 'play'; },

  onPointerDown(e) {
    if (e.pointerType !== 'mouse') this.touch = true;
    if (!this.aiming()) return;
    const h = this.hitTest(e, this.holds);
    if (h) {
      Game.keys[h.key] = true;
      this.pointers.set(e.pointerId, { key: h.key });
    } else if (e.pointerType === 'mouse' || this.hitTest(e, this.buttons)) {
      return; // мышь наводит колесом и клавишами, как прежде; кнопки панели срабатывают по click
    } else {
      this.pointers.set(e.pointerId, { lastY: e.clientY });
    }
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) {}
  },

  onPointerMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p || p.key) return;
    const dy = p.lastY - e.clientY; // вверх — ствол выше
    p.lastY = e.clientY;
    if (!this.aiming()) return;
    const pc = CFG.playerCannon, c = Game.cannon;
    c.angle = Math.max(pc.minAngle, Math.min(pc.maxAngle, c.angle + dy / this.AIM_PX_PER_DEG));
  },

  onPointerUp(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    if (p.key) Game.keys[p.key] = false;
    this.pointers.delete(e.pointerId);
  },

  // game = null — боя нет (меню и прочие экраны): только берег, небо и вода
  draw(game) {
    const ctx = this.ctx, s = this.s;
    const Wpx = this.canvas.width, Hpx = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Небо
    const sky = ctx.createLinearGradient(0, 0, 0, this.Y(CFG.water.level));
    sky.addColorStop(0, '#5b8fc7');
    sky.addColorStop(1, '#cfe3f0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, Wpx, Hpx);
    // Солнце
    ctx.fillStyle = 'rgba(255, 244, 200, 0.9)';
    ctx.beginPath(); ctx.arc(this.X(38), this.Y(17), 1.4 * s, 0, Math.PI * 2); ctx.fill();
    // Облака
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const c of this.clouds) {
      const x = ((c.x + Physics.time * c.sp) % 64) - 8;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(this.X(x + i * c.w * 0.25), this.Y(c.y + Math.sin(i * 2) * 0.3), c.w * 0.3 * s, c.w * 0.18 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Дальний берег
    ctx.fillStyle = '#9fb8c4';
    ctx.beginPath();
    ctx.moveTo(this.X(14), this.Y(CFG.water.level));
    for (let x = 14; x <= 50; x += 1) {
      const rise = Math.min(1, (x - 14) / 6); // плавно поднимается из воды, без уступа
      ctx.lineTo(this.X(x), this.Y(CFG.water.level + rise * (0.6 + Math.sin(x * 0.7) * 0.3 + Math.sin(x * 0.23) * 0.5)));
    }
    ctx.lineTo(this.X(50), this.Y(CFG.water.level));
    ctx.fill();

    this.drawGround();
    this.drawFlagpole();
    if (!game) {
      this.buttons = [];
      this.drawWater();
      return;
    }
    for (const b of game.fortress) if (b.alive) this.drawBrick(b);
    if (game.rampart) this.drawRampart(game.rampart);
    this.drawPlayerCannon(game.cannon);
    for (const g of game.fortGuns) if (g.alive) this.drawFortGun(g);
    for (const sh of game.ships) this.drawShip(sh);
    for (const b of game.balls) this.drawBall(b);
    this.drawParticles(false);
    this.drawWater();
    this.drawParticles(true);
    this.drawFog();
    this.drawHUD(game);
  },

  // Цвета берега по виду: песчаная коса, скала, глинистый обрыв, задернованный склон
  groundColors: {
    sand:  { soil: '#c9b07a', grass: '#6f9a4a', layer: 'rgba(120, 95, 60, 0.35)' },
    rock:  { soil: '#8c8577', grass: '#5f7f45', layer: 'rgba(50, 45, 40, 0.4)' },
    cliff: { soil: '#a8714a', grass: '#62873f', layer: 'rgba(80, 45, 25, 0.4)' },
    grass: { soil: '#9c8a62', grass: '#5d8c3e', layer: 'rgba(80, 65, 40, 0.35)' },
  },

  drawGround() {
    const ctx = this.ctx, S = CFG.shore, W = CFG.water;
    const C = this.groundColors[S.kind] || this.groundColors.sand;
    ctx.fillStyle = C.soil;
    ctx.beginPath();
    ctx.moveTo(this.X(-1), this.Y(S.topY));
    ctx.lineTo(this.X(S.edgeX), this.Y(S.topY));
    ctx.lineTo(this.X(S.slopeEndX), this.Y(W.seabedY));
    ctx.lineTo(this.X(60), this.Y(W.seabedY));
    ctx.lineTo(this.X(60), this.Y(-20));
    ctx.lineTo(this.X(-1), this.Y(-20));
    ctx.closePath();
    ctx.fill();
    // Трава
    ctx.fillStyle = C.grass;
    ctx.fillRect(this.X(-1), this.Y(S.topY), this.X(S.edgeX - 0.3) - this.X(-1), 0.25 * this.s);
    // Слои грунта
    ctx.strokeStyle = C.layer;
    ctx.lineWidth = 2;
    for (let y = S.topY - 1.2; y > W.seabedY; y -= 1.4) {
      ctx.beginPath();
      ctx.moveTo(this.X(-1), this.Y(y));
      const xEnd = S.edgeX + (S.topY - y) / (S.topY - W.seabedY) * (S.slopeEndX - S.edgeX);
      ctx.lineTo(this.X(xEnd - 0.2), this.Y(y + 0.15));
      ctx.stroke();
    }
  },

  // Земляной вал: насыпь с дёрном на гребне; на высшем уровне — фашины (связки хвороста) по откосу
  drawRampart(r) {
    const ctx = this.ctx, C = this.groundColors[CFG.shore.kind] || this.groundColors.sand;
    const v = r.verts;
    ctx.fillStyle = '#7a6848';
    ctx.beginPath();
    v.forEach((p, i) => i ? ctx.lineTo(this.X(p.x), this.Y(p.y)) : ctx.moveTo(this.X(p.x), this.Y(p.y)));
    ctx.closePath();
    ctx.fill();
    // Слои утрамбованной земли
    ctx.strokeStyle = 'rgba(60, 45, 25, 0.35)';
    ctx.lineWidth = 1.5;
    const h = v[2].y - v[0].y;
    for (let k = 0.25; k < 1; k += 0.25) {
      const y = v[0].y + h * k, xr = v[1].x + (v[2].x - v[1].x) * k;
      ctx.beginPath(); ctx.moveTo(this.X(v[0].x), this.Y(y)); ctx.lineTo(this.X(xr - 0.05), this.Y(y)); ctx.stroke();
    }
    // Дёрн на гребне и по откосу
    ctx.strokeStyle = C.grass;
    ctx.lineWidth = 0.12 * this.s;
    ctx.beginPath();
    ctx.moveTo(this.X(v[3].x), this.Y(v[3].y)); ctx.lineTo(this.X(v[2].x), this.Y(v[2].y)); ctx.lineTo(this.X(v[1].x), this.Y(v[1].y));
    ctx.stroke();
    if (r.level >= CFG.rampart.fascines) {
      // Фашины — круглые связки хвороста рядами вдоль откоса
      const n = Math.max(3, Math.round(h / 0.32));
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n, x = v[1].x + (v[2].x - v[1].x) * k - 0.12, y = v[1].y + h * k;
        ctx.fillStyle = '#6b4a2a';
        ctx.beginPath(); ctx.arc(this.X(x), this.Y(y), 0.15 * this.s, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3e2a16'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(this.X(x), this.Y(y), 0.08 * this.s, 0, Math.PI * 2); ctx.stroke();
      }
    }
  },

  rgb(c, k = 1, a = 1) {
    return `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${a})`;
  },

  drawBrick(b) {
    const ctx = this.ctx, s = this.s;
    const p = b.body.getPosition(), a = b.body.getAngle();
    const dmg = 1 - b.hp / b.maxHp;
    ctx.save();
    ctx.translate(this.X(p.x), this.Y(p.y));
    ctx.rotate(-a);
    const w = b.w * s, h = b.h * s;
    ctx.fillStyle = this.rgb(b.material.color, b.shade * (1 - dmg * 0.45));
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = 'rgba(40, 30, 20, 0.55)';
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    // Трещины
    if (dmg > 0.25) {
      ctx.strokeStyle = 'rgba(30,20,10,0.7)';
      ctx.beginPath();
      ctx.moveTo(-w * 0.3, -h / 2); ctx.lineTo(-w * 0.05, 0); ctx.lineTo(-w * 0.15, h / 2);
      if (dmg > 0.55) { ctx.moveTo(w * 0.35, -h / 2); ctx.lineTo(w * 0.1, h * 0.1); ctx.lineTo(w * 0.3, h / 2); }
      ctx.stroke();
    }
    ctx.restore();
  },

  drawBarrel(x, y, angle, len, thick, recoil, color, backLen = 0.35) {
    const ctx = this.ctx, s = this.s;
    ctx.save();
    ctx.translate(this.X(x), this.Y(y));
    ctx.rotate(-angle);
    const back = -backLen * s - recoil * 0.25 * s;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(back, -thick * 0.6 * s);
    ctx.lineTo(back + len * s, -thick * 0.4 * s);
    ctx.lineTo(back + len * s, thick * 0.4 * s);
    ctx.lineTo(back, thick * 0.6 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(back + len * s - 0.12 * s, -thick * 0.5 * s, 0.12 * s, thick * s);
    ctx.beginPath(); ctx.arc(back, 0, thick * 0.6 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },

  // Предпросмотр траектории: та же баллистика, что у настоящего ядра (в воздухе сопротивления нет).
  // Длина задаётся CFG.playerCannon.trajectoryPreview — доля полёта (1 = до падения).
  drawTrajectory(c, a) {
    const ctx = this.ctx, s = this.s;
    const L = CFG.playerCannon.barrelLength, g = CFG.world.gravity;
    const v = CFG.powderSpeed[c.powder] * CFG.balls[c.ballType].speedMul;
    let x = c.pivot.x + Math.cos(a) * L, y = c.pivot.y + Math.sin(a) * L;
    let vx = Math.cos(a) * v, vy = Math.sin(a) * v;
    const dt = 1 / 60, pts = [];
    let hit = null;
    for (let t = 0; t < 8; t += dt) {
      vy -= g * dt; x += vx * dt; y += vy * dt;
      if (x > CFG.world.width + 1) break;
      const floor = x < CFG.shore.edgeX ? CFG.shore.topY : Physics.waterY(x);
      if (y < floor) { hit = { x, y: floor }; break; }
      pts.push({ x, y });
    }
    const frac = CFG.playerCannon.trajectoryPreview;
    const n = Math.floor(pts.length * frac);
    if (frac < 1) hit = null;
    const ready = c.reload <= 0;
    for (let i = 0; i < n; i += 6) {
      const alpha = (ready ? 0.85 : 0.35) * (1 - (i / n) * (frac < 1 ? 1 : 0.5));
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(this.X(pts[i].x), this.Y(pts[i].y), Math.max(1.5, 0.07 * s), 0, Math.PI * 2);
      ctx.fill();
    }
    if (hit) {
      ctx.strokeStyle = `rgba(255,255,255,${ready ? 0.8 : 0.35})`;
      ctx.lineWidth = Math.max(1, 0.05 * s);
      const r = 0.3 * s;
      ctx.beginPath();
      ctx.moveTo(this.X(hit.x) - r, this.Y(hit.y)); ctx.lineTo(this.X(hit.x) + r, this.Y(hit.y));
      ctx.moveTo(this.X(hit.x), this.Y(hit.y) - r); ctx.lineTo(this.X(hit.x), this.Y(hit.y) + r);
      ctx.stroke();
    }
  },

  drawPlayerCannon(c) {
    const ctx = this.ctx, s = this.s;
    const top = CFG.shore.topY;
    const a = c.angle * Math.PI / 180;
    if (c.hp > 0) this.drawTrajectory(c, a);
    // Разбитая пушка: ствол сбит с лафета и уткнулся вниз, над ней — ход ремонта
    const broken = c.repair > 0;
    this.drawBarrel(c.pivot.x, c.pivot.y - (broken ? 0.15 : 0), broken ? -0.25 : a, CFG.playerCannon.barrelLength + 0.35, 0.32, c.recoil, broken ? '#55504a' : '#2c2f33');
    if (broken) {
      const done = 1 - c.repair / c.repairTotal;
      const bw = 1.4 * s, bh = 0.16 * s, bx = this.X(c.pivot.x) - bw / 2, by = this.Y(c.pivot.y + 1.0);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#f0b040'; ctx.fillRect(bx, by, bw * done, bh);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = Math.max(1, 0.02 * s); ctx.strokeRect(bx, by, bw, bh);
    }
    // Лафет
    ctx.fillStyle = '#6b4a2b';
    ctx.beginPath();
    ctx.moveTo(this.X(c.pivot.x - 0.75), this.Y(top + 0.15));
    ctx.lineTo(this.X(c.pivot.x + 0.6), this.Y(top + 0.15));
    ctx.lineTo(this.X(c.pivot.x + 0.25), this.Y(c.pivot.y));
    ctx.lineTo(this.X(c.pivot.x - 0.5), this.Y(c.pivot.y));
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3d2a18';
    for (const dx of [-0.45, 0.35]) {
      ctx.beginPath(); ctx.arc(this.X(c.pivot.x + dx), this.Y(top + 0.25), 0.27 * s, 0, Math.PI * 2); ctx.fill();
    }
  },

  // Флагшток за крепостью с флагом Российской империи (декорация, в физике не участвует)
  drawFlagpole() {
    const ctx = this.ctx, s = this.s, F = CFG.flagpole;
    ctx.strokeStyle = '#3b2b1d';
    ctx.lineWidth = Math.max(2, 0.12 * s);
    ctx.beginPath(); ctx.moveTo(this.X(F.x), this.Y(CFG.shore.topY)); ctx.lineTo(this.X(F.x), this.Y(F.top)); ctx.stroke();
    ctx.fillStyle = '#c8a24a';
    ctx.beginPath(); ctx.arc(this.X(F.x), this.Y(F.top + 0.1), 0.13 * s, 0, Math.PI * 2); ctx.fill();
    Flags.draw(this, 'andrew', F.x + 0.06, F.top - 0.1, 0, F.flagW, F.flagW * 2 / 3, 0);
  },

  drawFortGun(g) {
    const ctx = this.ctx, s = this.s;
    const p = g.body.getPosition(), a = g.body.getAngle();
    const pv = Entities.fortGunPivot(g);
    this.drawBarrel(pv.x, pv.y, g.angle, CFG.fortGuns.barrelLength + 0.25, 0.24, g.recoil, '#2c2f33', 0.25);
    // Лафет
    ctx.save();
    ctx.translate(this.X(p.x), this.Y(p.y));
    ctx.rotate(-a);
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(-g.hw * s, -g.hh * s, 2 * g.hw * s, 2 * g.hh * s);
    ctx.fillStyle = '#3d2a18';
    for (const dx of [-0.2, 0.2]) {
      ctx.beginPath(); ctx.arc(dx * s, g.hh * 0.6 * s, 0.13 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },

  // Труба парохода над колесом (только рисунок, ядра её не задевают)
  drawFunnel(sh) {
    const ctx = this.ctx, s = this.s, F = sh.T.funnel, k = sh.T.scale;
    const p = sh.hull.getPosition(), a = sh.hull.getAngle();
    ctx.save();
    ctx.translate(this.X(p.x), this.Y(p.y));
    ctx.rotate(-a);
    const x = F.x * k * s, w = F.w * k * s, y0 = -sh.hh * s, h = F.h * k * s;
    ctx.fillStyle = sh.alive ? '#2a2a2c' : '#1c1c1d';
    ctx.fillRect(x - w / 2, y0 - h, w, h);
    ctx.fillStyle = '#8a2a20'; // красный поясок у верха
    ctx.fillRect(x - w / 2, y0 - h + 0.12 * k * s, w, 0.14 * k * s);
    ctx.fillStyle = '#111';
    ctx.fillRect(x - w * 0.6, y0 - h, w * 1.2, 0.08 * k * s);
    ctx.restore();
  },

  // Гребное колесо в полукруглом кожухе; разбитое — без кожуха, с обломанными плицами
  drawWheel(sh) {
    const ctx = this.ctx, s = this.s, w = sh.wheel;
    const c = sh.hull.getWorldPoint(V(w.local.x, w.local.y)), a = sh.hull.getAngle();
    const r = w.r * s;
    ctx.save();
    ctx.translate(this.X(c.x), this.Y(c.y));
    ctx.rotate(-a);
    ctx.lineWidth = Math.max(1, 0.05 * s);
    ctx.strokeStyle = w.alive ? '#3b2412' : '#24170c';
    // Обод и спицы с плицами
    ctx.beginPath(); ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2); ctx.stroke();
    const n = 10;
    for (let i = 0; i < n; i++) {
      if (!w.alive && i % 3 !== 0) continue; // у разбитого колеса уцелели лишь несколько плиц
      const ang = w.angle + i * Math.PI * 2 / n; // идёт влево — вращается против часовой
      const cx = Math.cos(ang), cy = Math.sin(ang);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(cx * r, cy * r); ctx.stroke();
      ctx.save(); ctx.translate(cx * r * 0.85, cy * r * 0.85); ctx.rotate(ang);
      ctx.fillStyle = w.alive ? '#5a3a1f' : '#33220f';
      ctx.fillRect(-r * 0.15, -r * 0.08, r * 0.3, r * 0.16);
      ctx.restore();
    }
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2); ctx.fill();
    // Кожух над колесом: пока цел; повреждённый темнеет
    if (w.alive) {
      const dmg = 1 - w.hp / w.maxHp;
      ctx.fillStyle = `rgb(${120 - dmg * 50 | 0},${84 - dmg * 35 | 0},${48 - dmg * 20 | 0})`;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.08, Math.PI, 0); ctx.lineTo(r * 1.08, 0); ctx.lineTo(r * 0.95, 0);
      ctx.arc(0, 0, r * 0.95, 0, Math.PI, true); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c8a24a';
      ctx.fillRect(-r * 1.08, -r * 0.04, r * 2.16, r * 0.08);
    }
    ctx.restore();
  },

  drawShip(sh) {
    const ctx = this.ctx, s = this.s;
    const p = sh.hull.getPosition(), a = sh.hull.getAngle();
    // Корпус
    ctx.save();
    ctx.translate(this.X(p.x), this.Y(p.y));
    ctx.rotate(-a);
    ctx.fillStyle = sh.alive ? '#6e4526' : '#4b3220';
    ctx.beginPath();
    sh.verts.forEach((v, i) => i ? ctx.lineTo(v.x * s, -v.y * s) : ctx.moveTo(v.x * s, -v.y * s));
    ctx.closePath(); ctx.fill();
    // Доски обшивки
    ctx.strokeStyle = 'rgba(30,18,8,0.5)';
    ctx.lineWidth = Math.max(1, 0.03 * s);
    const hh = sh.verts[2].y;
    for (let k = 1; k < 4; k++) {
      const y = -hh + (2 * hh) * k / 4;
      const t = (y + hh) / (2 * hh);
      const half = sh.verts[1].x + (sh.verts[2].x - sh.verts[1].x) * t;
      ctx.beginPath(); ctx.moveTo(-half * s, -y * s); ctx.lineTo(half * s, -y * s); ctx.stroke();
    }
    // Трюм (корпус открыт сверху): рисуем разрезом, чтобы было видно, что внутри
    const t = sh.wall, y1 = -hh + t, W = sh.halfWidthAt;
    ctx.fillStyle = '#4a2e18';
    ctx.beginPath();
    ctx.moveTo((-W(y1) + t) * s, -y1 * s); ctx.lineTo((W(y1) - t) * s, -y1 * s);
    ctx.lineTo((W(hh) - t) * s, -hh * s); ctx.lineTo((-W(hh) + t) * s, -hh * s);
    ctx.closePath(); ctx.fill();
    // Шпангоуты внутри
    ctx.strokeStyle = 'rgba(110, 70, 38, 0.6)';
    for (let k = 1; k < 6; k++) {
      const x = -W(hh) + t + (2 * (W(hh) - t)) * k / 6;
      ctx.beginPath(); ctx.moveTo(x * s, -hh * s); ctx.lineTo(x * 0.85 * s, -y1 * s); ctx.stroke();
    }
    // Планширь — только по верху бортов
    ctx.fillStyle = '#c8a24a';
    ctx.fillRect(-W(hh) * s, -hh * s, t * s, 0.1 * s);
    ctx.fillRect((W(hh) - t) * s, -hh * s, t * s, 0.1 * s);
    // Пробоины
    const dmg = 1 - sh.hp / sh.maxHp;
    ctx.fillStyle = '#1d120a';
    const holes = Math.floor(dmg * 6);
    for (let i = 0; i < holes; i++) {
      const hx = Math.sin(i * 12.9898 + sh.maxHp) * sh.verts[1].x * 0.8;
      const hy = Math.cos(i * 7.233) * hh * 0.4;
      ctx.beginPath(); ctx.arc(hx * s, -hy * s, 0.16 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Вода в трюме — горизонтальная, переливается к нижнему борту
    if (sh.waterPoly && sh.waterPoly.length > 2) {
      ctx.fillStyle = 'rgba(50, 120, 165, 0.85)';
      ctx.beginPath();
      sh.waterPoly.forEach((v, i) => i ? ctx.lineTo(this.X(v.x), this.Y(v.y)) : ctx.moveTo(this.X(v.x), this.Y(v.y)));
      ctx.closePath(); ctx.fill();
      // Поверхность — только пока трюм не залит целиком и она выше уровня моря
      // (иначе блик рисуется прямо в толще воды и мерцает)
      let top = -Infinity; for (const v of sh.waterPoly) top = Math.max(top, v.y);
      const surf = sh.waterPoly.filter(v => Math.abs(v.y - top) < 1e-3);
      const full = sh.water >= sh.holdArea * 0.999;
      const midX = surf.length ? (surf[0].x + surf[surf.length - 1].x) / 2 : 0;
      if (!full && surf.length >= 2 && top > Physics.waterY(midX)) {
        ctx.strokeStyle = 'rgba(210, 240, 255, 0.8)';
        ctx.lineWidth = Math.max(1, 0.04 * s);
        ctx.beginPath(); ctx.moveTo(this.X(surf[0].x), this.Y(top)); ctx.lineTo(this.X(surf[surf.length - 1].x), this.Y(top)); ctx.stroke();
      }
    }
    // Струи через борт: только пока кромка чуть ниже поверхности моря (переливается),
    // а не когда корабль уже целиком под водой
    if (sh.alive && sh.inflow > 0.02 && sh.water < sh.holdArea * 0.999) {
      const half = sh.halfWidthAt(sh.hh);
      for (let k = 0; k < 2; k++) {
        const lx = (Math.random() * 2 - 1) * half;
        const wp = sh.hull.getWorldPoint(V(lx, sh.hh));
        const surf = Physics.waterY(wp.x), depth = surf - wp.y;
        if (depth > 0 && depth < 0.15) Particles.spawn({ type: 'pour', x: wp.x, y: surf + 0.02, vx: (Math.random() - 0.5), vy: -1,
          g: -9.8, size: 0.07, life: 0.25, max: 0.25, color: [200, 230, 255] });
      }
    }

    if (sh.T.funnel) this.drawFunnel(sh);
    for (const b of sh.bricks) if (b.alive) this.drawBrick(b);
    if (sh.wheel) this.drawWheel(sh);

    // Очаги пожара: зарево на корпусе
    for (const f of sh.fires) {
      const w = sh.hull.getWorldPoint(V(f.x, f.y)), r = (0.5 + f.power * 0.9) * s;
      const flick = 0.85 + Math.random() * 0.15;
      const g = ctx.createRadialGradient(this.X(w.x), this.Y(w.y), 0, this.X(w.x), this.Y(w.y), r);
      g.addColorStop(0, `rgba(255, 200, 80, ${0.75 * flick * Math.min(1, f.power * 2)})`);
      g.addColorStop(0.5, `rgba(240, 90, 20, ${0.4 * flick * Math.min(1, f.power * 2)})`);
      g.addColorStop(1, 'rgba(200, 40, 0, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(this.X(w.x), this.Y(w.y), r, 0, Math.PI * 2); ctx.fill();
    }

    // Флаг (британский или французский) на топе мачты: держится за верхний брусок и падает вместе с ним
    const top = sh.mastBricks[sh.mastBricks.length - 1];
    if (top && top.alive) {
      const k = sh.T.scale, ang = top.body.getAngle();
      const tp = top.body.getWorldPoint(V(top.w / 2, top.h / 2));
      const fw = sh.flag === 'uk' ? 1.1 : 0.85; // Юнион Джек 1:2, триколор 2:3
      Flags.draw(this, sh.flag, tp.x, tp.y, ang, fw * k, 0.55 * k, sh.hull.getPosition().x);
    }

    // Пушки корабля (выбитая — обломок лафета, пока её чинят)
    for (const gun of sh.cannons) {
      const cw = Entities.cannonWorld(sh, gun);
      const k = sh.T.scale;
      // Повреждённая пушка рыжеет от окалины
      const dmg = 1 - gun.hp / gun.maxHp;
      const barrelColor = `rgb(${36 + dmg * 90 | 0},${39 + dmg * 30 | 0},${43 - dmg * 20 | 0})`;
      if (gun.alive) this.drawBarrel(cw.x, cw.y, cw.angle, 1.25 * k, 0.24 * k, gun.recoil, barrelColor, 0.35 * k);
      ctx.save();
      ctx.translate(this.X(cw.x), this.Y(cw.y));
      ctx.rotate(-a);
      ctx.fillStyle = gun.alive ? '#4a2f18' : '#2a1d12';
      if (gun.alive) ctx.fillRect(-0.35 * k * s, 0, 0.7 * k * s, 0.32 * k * s);
      else {
        ctx.beginPath();
        ctx.moveTo(-0.35 * k * s, 0.32 * k * s); ctx.lineTo(-0.2 * k * s, 0.05 * k * s);
        ctx.lineTo(0.05 * k * s, 0.18 * k * s); ctx.lineTo(0.3 * k * s, 0.02 * k * s);
        ctx.lineTo(0.35 * k * s, 0.32 * k * s); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      // Ход ремонта выбитой пушки
      if (!gun.alive && sh.alive && gun.repairTotal) {
        const done = 1 - Math.max(0, gun.repair) / gun.repairTotal;
        const bw = 0.9 * s, bh = 0.12 * s;
        const bx = this.X(cw.x) - bw / 2, by = this.Y(cw.y + 0.75);
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = '#f0b040'; ctx.fillRect(bx, by, bw * done, bh);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = Math.max(1, 0.02 * s);
        ctx.strokeRect(bx, by, bw, bh);
      }
    }

    // Полоска воды в трюме (до уровня, при котором корабль тонет)
    if (sh.alive && sh.water > 0.01) {
      const k = sh.water / (sh.holdArea * CFG.flood.sinkFraction);
      const bx = this.X(p.x - 1.5), by = this.Y(p.y + 4.6 * sh.T.scale) + 0.3 * s;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, 3 * s, 0.16 * s);
      ctx.fillStyle = '#4aa8e0'; ctx.fillRect(bx, by, 3 * s * Math.min(1, k), 0.16 * s);
    }
    // Полоска HP
    if (sh.alive && sh.hp < sh.maxHp) {
      const bx = this.X(p.x - 1.5), by = this.Y(p.y + 4.6 * sh.T.scale);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, 3 * s, 0.22 * s);
      ctx.fillStyle = '#e05040'; ctx.fillRect(bx, by, 3 * s * sh.hp / sh.maxHp, 0.22 * s);
    }
  },

  drawBall(b) {
    const ctx = this.ctx, p = b.body.getPosition();
    ctx.fillStyle = b.B.color;
    // Калёное ядро светится, пока не остыло, и темнеет до чугунного
    if (b.B.ignite) {
      const k = b.heat;
      ctx.fillStyle = `rgb(${43 + 207 * k | 0}, ${43 + 77 * k | 0}, ${43 - 13 * k | 0})`;
      if (k > 0) {
        const r = b.B.radius * this.s * 2.6;
        const g = ctx.createRadialGradient(this.X(p.x), this.Y(p.y), 0, this.X(p.x), this.Y(p.y), r);
        g.addColorStop(0, `rgba(255, 140, 40, ${0.5 * k})`); g.addColorStop(1, 'rgba(255, 80, 0, 0)');
        const keep = ctx.fillStyle;
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.X(p.x), this.Y(p.y), r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = keep;
      }
    }
    ctx.beginPath(); ctx.arc(this.X(p.x), this.Y(p.y), b.B.radius * this.s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = Math.max(1, 0.025 * this.s);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.arc(this.X(p.x - b.B.radius * 0.3), this.Y(p.y + b.B.radius * 0.3), b.B.radius * 0.35 * this.s, 0, Math.PI * 2); ctx.fill();
  },

  // Высота берега/дна в точке x (тот же профиль, что у физического тела берега)
  groundY(x) {
    const S = CFG.shore, W = CFG.water;
    if (x <= S.edgeX) return S.topY;
    if (x >= S.slopeEndX) return W.seabedY;
    return S.topY + (W.seabedY - S.topY) * (x - S.edgeX) / (S.slopeEndX - S.edgeX);
  },

  drawWater() {
    const ctx = this.ctx, s = this.s, W = CFG.water, S = CFG.shore;
    const x1 = CFG.world.width + 1;
    // Где поверхность воды встречается со склоном берега (волна набегает — точка гуляет)
    let xi = S.edgeX;
    while (xi < S.slopeEndX && this.groundY(xi) > Physics.waterY(xi)) xi += 0.02;
    const yi = this.groundY(xi);

    // Вода: от уреза по волне вправо, вниз до дна, по дну и склону обратно
    ctx.beginPath();
    ctx.moveTo(this.X(xi), this.Y(yi));
    for (let x = Math.ceil(xi * 4) / 4; x <= x1; x += 0.25) ctx.lineTo(this.X(x), this.Y(Physics.waterY(x)));
    ctx.lineTo(this.X(x1), this.Y(W.seabedY));
    ctx.lineTo(this.X(S.slopeEndX), this.Y(W.seabedY));
    ctx.closePath();
    const g = ctx.createLinearGradient(0, this.Y(W.level + 0.5), 0, this.Y(W.seabedY));
    g.addColorStop(0, 'rgba(40, 110, 150, 0.72)');
    g.addColorStop(1, 'rgba(10, 40, 70, 0.92)');
    ctx.fillStyle = g;
    ctx.fill();

    // Мокрый песок у уреза
    ctx.strokeStyle = 'rgba(120, 100, 60, 0.35)';
    ctx.lineWidth = Math.max(1, 0.12 * s);
    ctx.beginPath();
    ctx.moveTo(this.X(xi), this.Y(yi));
    ctx.lineTo(this.X(xi - 0.25), this.Y(this.groundY(xi - 0.25)));
    ctx.stroke();

    // Пена на гребнях и у берега
    ctx.strokeStyle = 'rgba(230, 245, 255, 0.7)';
    ctx.lineWidth = Math.max(1, 0.06 * s);
    ctx.beginPath();
    ctx.moveTo(this.X(xi), this.Y(yi));
    for (let x = Math.ceil(xi * 4) / 4; x <= x1; x += 0.25) ctx.lineTo(this.X(x), this.Y(Physics.waterY(x)));
    ctx.stroke();
    ctx.fillStyle = 'rgba(240, 250, 255, 0.6)';
    for (let i = 0; i < 4; i++) {
      const fx = xi + 0.1 + i * 0.18 + Math.sin(Physics.time * 3 + i) * 0.05;
      ctx.beginPath(); ctx.arc(this.X(fx), this.Y(Physics.waterY(fx) + 0.03), (0.07 + 0.03 * Math.sin(Physics.time * 4 + i * 2)) * s, 0, Math.PI * 2); ctx.fill();
    }
  },

  // Туман: у берега ясно, к горизонту всё плотнее (CFG.weather.fog — плотность вдали)
  drawFog() {
    const f = CFG.weather.fog;
    if (!f) return;
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(this.X(13), 0, this.X(CFG.world.width), 0);
    g.addColorStop(0, 'rgba(215, 222, 226, 0)');
    g.addColorStop(0.35, `rgba(215, 222, 226, ${0.45 * f})`);
    g.addColorStop(1, `rgba(215, 222, 226, ${0.92 * f})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  },

  drawParticles(front) {
    const ctx = this.ctx, s = this.s;
    for (const p of Particles.list) {
      // 'pour' (вода, затекающая в трюм) рисуется под слоем моря: ниже поверхности её не видно
      const isFront = p.type === 'smoke' || p.type === 'drop' || p.type === 'flame';
      if (isFront !== front) continue;
      const a = Math.max(0, p.life / p.max);
      if (p.type === 'flame') {
        // Язык пламени: желтеет и тает к концу жизни
        ctx.fillStyle = this.rgb([p.color[0], p.color[1] + (1 - a) * 60, p.color[2]], 1, Math.min(1, a * 1.4));
        ctx.beginPath(); ctx.arc(this.X(p.x), this.Y(p.y), p.size * s * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'smoke') {
        ctx.fillStyle = this.rgb(p.color, 1, a * 0.5);
        ctx.beginPath(); ctx.arc(this.X(p.x), this.Y(p.y), p.size * s, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = this.rgb(p.color, 1, Math.min(1, a * 1.5));
        const sz = p.size * s;
        ctx.fillRect(this.X(p.x) - sz / 2, this.Y(p.y) - sz / 2, sz, sz);
      }
    }
  },

  // ---------- Интерфейс ----------
  drawHUD(game) {
    const ctx = this.ctx, d = this.dpr, c = game.cannon;
    const u = this.s / 30; // базовая единица интерфейса
    this.buttons = [];
    ctx.font = `${13 * u}px ${this.FONT}`;
    ctx.textBaseline = 'middle';

    // Левая панель: пушка
    const px = 12 * u, py = 12 * u, pw = 300 * u, ph = 144 * u;
    const rw = 250 * u, rx = this.canvas.width - rw - 12 * u, ry = 12 * u;
    // Области интерфейса — для подсветки в подсказках обучения
    const box = (x, y, w, h) => ({ x, y, w, h });
    this.hud = {
      angle: box(px + 4 * u, py + 5 * u, 100 * u, 26 * u), store: box(px + 104 * u, py + 5 * u, 192 * u, 26 * u),
      powder: box(px + 74 * u, py + 29 * u, 214 * u, 38 * u), ball: box(px + 10 * u, py + 70 * u, 184 * u, 30 * u),
      fire: box(px + 198 * u, py + 70 * u, 92 * u, 30 * u),
      status: box(rx + 4 * u, ry + 5 * u, rw - 8 * u, 26 * u), cannonHp: box(rx + 4 * u, ry + 33 * u, rw - 8 * u, 26 * u),
      fortress: box(rx + 4 * u, ry + 59 * u, rw - 8 * u, 26 * u), fortGuns: box(rx + 4 * u, ry + 87 * u, rw - 8 * u, 26 * u),
    };
    ctx.fillStyle = 'rgba(15, 25, 35, 0.72)';
    this.roundRect(px, py, pw, ph, 8 * u); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(`Угол: ${Math.round(c.angle)}°`, px + 12 * u, py + 18 * u);
    // Склад пороха и ход подвоза следующего мешка
    const PS = CFG.powderStore;
    const enough = game.canAffordShot();
    ctx.fillStyle = enough ? '#fff' : '#ff8a7a';
    ctx.fillText(`Склад: ${game.powder} / ${PS.capacity} меш.`, px + 104 * u, py + 18 * u);
    if (game.powder < PS.capacity) {
      const k = game.powderTimer / PS.resupplyEvery;
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(px + 240 * u, py + 14 * u, 48 * u, 8 * u);
      ctx.fillStyle = '#c99a52'; ctx.fillRect(px + 240 * u, py + 14 * u, 48 * u * k, 8 * u);
    }
    ctx.fillStyle = '#fff';
    ctx.fillText('Порох:', px + 12 * u, py + 48 * u);
    for (let i = 1; i <= MAX_POWDER; i++) {
      const bx = px + 80 * u + (i - 1) * 42 * u, by = py + 32 * u, bw = 36 * u, bh = 32 * u;
      ctx.fillStyle = i <= c.powder ? '#c99a52' : 'rgba(255,255,255,0.12)';
      this.roundRect(bx, by, bw, bh, 6 * u); ctx.fill();
      ctx.fillStyle = i <= c.powder ? '#2a1c0c' : 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'center';
      ctx.fillText(String(i), bx + bw / 2, by + bh / 2);
      ctx.textAlign = 'left';
      this.buttons.push({ x: bx, y: by, w: bw, h: bh, fn: () => { c.powder = i; } });
    }
    const B = CFG.balls[c.ballType];
    const tb = { x: px + 12 * u, y: py + 72 * u, w: 180 * u, h: 26 * u };
    const choice = game.ballTypes().length > 1;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    this.roundRect(tb.x, tb.y, tb.w, tb.h, 6 * u); ctx.fill();
    ctx.fillStyle = '#fff';
    const left = game.ammoLeft(c.ballType);
    ctx.fillText(`Ядро: ${B.name}${isFinite(left) ? ` × ${left}` : ''}${choice ? '  (Q)' : ''}`, tb.x + 8 * u, tb.y + tb.h / 2);
    if (choice) this.buttons.push({ ...tb, fn: () => game.cycleBall() });
    // Перезарядка
    const fb = { x: px + 200 * u, y: py + 72 * u, w: 88 * u, h: 26 * u };
    const reloaded = c.reload <= 0;
    const ready = reloaded && enough && c.repair <= 0;
    ctx.fillStyle = ready ? '#c0392b' : 'rgba(255,255,255,0.12)';
    this.roundRect(fb.x, fb.y, fb.w, fb.h, 6 * u); ctx.fill();
    if (!reloaded) {
      ctx.fillStyle = 'rgba(192,57,43,0.6)';
      const k = 1 - c.reload / B.reload;
      this.roundRect(fb.x, fb.y, fb.w * k, fb.h, 6 * u); ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(c.repair > 0 ? 'Ремонт' : !reloaded ? 'Заряжаем' : enough ? 'Огонь!' : 'Мало пороха', fb.x + fb.w / 2, fb.y + fb.h / 2);
    ctx.textAlign = 'left';
    this.buttons.push({ ...fb, fn: () => game.playerFire() });
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `${11 * u}px ${this.FONT}`;
    ctx.fillText('↑↓ / колесо — угол · ←→ — порох', px + 12 * u, py + 113 * u);
    ctx.fillText('Пробел — выстрел · Q — ядро · Esc — пауза', px + 12 * u, py + 129 * u);

    // Сенсорный экран: внизу под большими пальцами — ▲ ▼ слева, «Огонь!» справа (не меньше 40 CSS-пикселей)
    this.holds = [];
    if (this.touch) {
      const bs = Math.max(56 * u, 40 * d), m = Math.max(12 * u, 10 * d);
      const W = this.canvas.width, H = this.canvas.height, bx = m, gap = 6 * d;
      const fw = bs * 2.2, fx = W - m - fw, fy = H - m - bs;
      ctx.fillStyle = ready ? '#c0392b' : 'rgba(15, 25, 35, 0.72)';
      this.roundRect(fx, fy, fw, bs, 8 * u); ctx.fill();
      if (!reloaded) {
        ctx.fillStyle = 'rgba(192,57,43,0.6)';
        this.roundRect(fx, fy, fw * (1 - c.reload / B.reload), bs, 8 * u); ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.font = `${bs * 0.36}px ${this.FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(c.repair > 0 ? 'Ремонт' : !reloaded ? 'Заряжаем' : enough ? 'Огонь!' : 'Мало пороха', fx + fw / 2, fy + bs / 2);
      ctx.textAlign = 'left';
      this.buttons.push({ x: fx, y: fy, w: fw, h: bs, fn: () => game.playerFire() });
      [['ArrowUp', '▲', H - m - 2 * bs - gap], ['ArrowDown', '▼', H - m - bs]].forEach(([key, label, by]) => {
        ctx.fillStyle = game.keys[key] ? '#c99a52' : 'rgba(15, 25, 35, 0.72)';
        this.roundRect(bx, by, bs, bs, 8 * u); ctx.fill();
        ctx.fillStyle = game.keys[key] ? '#2a1c0c' : '#fff';
        ctx.font = `${bs * 0.45}px ${this.FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(label, bx + bs / 2, by + bs / 2);
        ctx.textAlign = 'left';
        this.holds.push({ x: bx, y: by, w: bs, h: bs, key });
      });
    }

    // Правая панель: состояние
    ctx.font = `${13 * u}px ${this.FONT}`;
    ctx.fillStyle = 'rgba(15, 25, 35, 0.72)';
    this.roundRect(rx, ry, rw, 120 * u, 8 * u); ctx.fill();
    ctx.fillStyle = '#fff';
    const remain = game.surviveLeft(), leave = game.leaveLeft();
    const mmss = t => { const n = Math.ceil(t); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
    const status = `Потоплено: ${game.sunk} / ${CFG.fleet.length}`;
    if (leave !== null) ctx.fillStyle = leave < 15 ? '#ff8a7a' : '#fff';
    ctx.fillText(remain !== null ? `${status} · держаться ${mmss(remain)}` : leave !== null ? `${status} · уйдёт ${mmss(leave)}` : status,
      rx + 12 * u, ry + 18 * u);
    const bar = (label, k, y, color) => {
      ctx.fillStyle = '#fff';
      ctx.fillText(label, rx + 12 * u, y);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(rx + 90 * u, y - 7 * u, 145 * u, 14 * u);
      ctx.fillStyle = color;
      ctx.fillRect(rx + 90 * u, y - 7 * u, 145 * u * Math.max(0, k), 14 * u);
    };
    // Пока пушку чинят, шкала показывает ход ремонта (серым)
    if (c.repair > 0) bar('Ремонт', 1 - c.repair / c.repairTotal, ry + 46 * u, '#9a9a9a');
    else bar('Пушка', c.hp / c.maxHp, ry + 46 * u, '#e0a040');
    const integ = game.fortressIntegrity();
    bar('Крепость', integ, ry + 72 * u, integ < CFG.lose.fortressMinIntegrity + 0.15 ? '#e05040' : '#7bc36a');
    // Отметка порога поражения
    ctx.fillStyle = '#fff';
    ctx.fillRect(rx + 90 * u + 145 * u * CFG.lose.fortressMinIntegrity, ry + 63 * u, 2 * u, 18 * u);
    ctx.fillStyle = '#fff';
    ctx.fillText(`Пушки крепости: ${game.fortGuns.filter(g => g.alive).length} / ${game.fortGuns.length}`, rx + 12 * u, ry + 100 * u);

    this.drawHint(game, u);

    // Итог
    if (game.state !== 'play') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = game.state === 'win' ? '#9be37f' : '#ff7b6b';
      ctx.font = `bold ${48 * u}px ${this.TITLE}`;
      ctx.fillText(game.state === 'win' ? 'Победа' : 'Поражение', this.canvas.width / 2, this.canvas.height / 2 - 30 * u);
      ctx.fillStyle = '#fff';
      ctx.font = `${20 * u}px ${this.FONT}`;
      ctx.fillText(game.message, this.canvas.width / 2, this.canvas.height / 2 + 20 * u);
      ctx.textAlign = 'left';
    }
  },

  // Подсказка обучения: плашка сверху между панелями и пульсирующая рамка вокруг того, о чём речь
  drawHint(game, u) {
    const h = Tutorial.current(game);
    if (!h) return;
    const ctx = this.ctx, W = this.canvas.width;
    const pulse = 0.65 + 0.35 * Math.sin(Physics.time * 6);
    ctx.save();
    ctx.globalAlpha = h.fade;
    if (h.focus) {
      ctx.strokeStyle = `rgba(240, 192, 96, ${pulse})`;
      ctx.lineWidth = 3 * u;
      if (h.focus === 'cannon') {
        const p = game.cannon.pivot;
        ctx.beginPath(); ctx.arc(this.X(p.x + 0.4), this.Y(p.y + 0.3), 2.2 * this.s, 0, Math.PI * 2); ctx.stroke();
      } else if (this.hud[h.focus]) {
        const r = this.hud[h.focus];
        this.roundRect(r.x, r.y, r.w, r.h, 6 * u); ctx.stroke();
      }
    }
    // Плашка: в промежутке между левой и правой панелями
    const left = 324 * u, right = W - 274 * u, bw = Math.min(560 * u, right - left), bx = (left + right - bw) / 2, by = 12 * u;
    ctx.font = `${15 * u}px ${this.FONT}`;
    const lines = this.wrap(h.text, bw - 28 * u);
    const bh = 34 * u + lines.length * 21 * u;
    ctx.fillStyle = 'rgba(15, 25, 35, 0.86)';
    this.roundRect(bx, by, bw, bh, 8 * u); ctx.fill();
    ctx.strokeStyle = 'rgba(201, 154, 82, 0.8)'; ctx.lineWidth = 1.5 * u;
    this.roundRect(bx, by, bw, bh, 8 * u); ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#c99a52';
    ctx.font = `${12 * u}px ${this.FONT}`;
    ctx.fillText(`Подсказка ${h.n} из ${h.total}`, bx + 14 * u, by + 15 * u);
    ctx.fillStyle = '#fff';
    ctx.font = `${15 * u}px ${this.FONT}`;
    lines.forEach((l, i) => ctx.fillText(l, bx + 14 * u, by + 37 * u + i * 21 * u));
    ctx.restore();
  },

  // Перенос строки по ширине (в пикселях канваса при текущем шрифте)
  wrap(text, maxW) {
    const out = [];
    let line = '';
    for (const w of text.split(' ')) {
      const t = line ? `${line} ${w}` : w;
      if (line && this.ctx.measureText(t).width > maxW) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
    return out;
  },

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },
};
