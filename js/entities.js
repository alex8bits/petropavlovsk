// Игровые объекты: берег, крепость, пушка игрока, корабли, ядра, частицы.

const Entities = {
  // ---------- Берег и дно ----------
  createGround() {
    const S = CFG.shore, W = CFG.water;
    const body = Physics.world.createBody({ type: 'static' });
    // Плоская часть берега
    body.createFixture(new pl.Polygon([V(-3, -10), V(S.edgeX, -10), V(S.edgeX, S.topY), V(-3, S.topY)]), { friction: 0.9 });
    // Склон
    body.createFixture(new pl.Polygon([V(S.edgeX, -10), V(S.slopeEndX, -10), V(S.slopeEndX, W.seabedY), V(S.edgeX, S.topY)]), { friction: 0.9 });
    // Дно
    body.createFixture(new pl.Polygon([V(S.slopeEndX, -10), V(90, -10), V(90, W.seabedY), V(S.slopeEndX, W.seabedY)]), { friction: 0.9 });
    body.setUserData({ kind: 'ground' });
    return body;
  },

  // ---------- Крепость ----------
  // Размеры берутся из CFG.fortress (у каждой батареи своя кладка)
  createFortress(ground) {
    const m = CFG.brick.stone, top = CFG.shore.topY, F = CFG.fortress;
    const rects = [];
    const x0 = F.x0;
    const addRow = (row, xFrom, cols, offset) => {
      const y = top + m.h / 2 + row * m.h;
      if (offset) {
        rects.push({ x: xFrom + m.w / 4, y, w: m.w / 2, h: m.h });
        for (let c = 0; c < cols - 1; c++) rects.push({ x: xFrom + m.w / 2 + c * m.w + m.w / 2, y, w: m.w, h: m.h });
        rects.push({ x: xFrom + cols * m.w - m.w / 4, y, w: m.w / 2, h: m.h });
      } else {
        for (let c = 0; c < cols; c++) rects.push({ x: xFrom + c * m.w + m.w / 2, y, w: m.w, h: m.h });
      }
    };
    // Основная стена с перевязкой
    const wallRows = F.wallRows, wallCols = F.wallCols;
    for (let r = 0; r < wallRows; r++) addRow(r, x0, wallCols, r % 2 === 1);
    // Зубцы стены (на чётных столбцах начиная со второго)
    for (let c = 2; c < wallCols; c += 2) {
      rects.push({ x: x0 + c * m.w + m.w / 2, y: top + m.h / 2 + wallRows * m.h, w: m.w, h: m.h });
    }
    // Башня слева
    const towerRows = F.towerRows, towerCols = F.towerCols;
    for (let r = 0; r < towerRows; r++) addRow(wallRows + r, x0, towerCols, r % 2 === 1);
    if (towerRows > 0) {
      // Зубцы башни
      const ty = top + m.h / 2 + (wallRows + towerRows) * m.h;
      rects.push({ x: x0 + m.w / 4, y: ty, w: m.w / 2, h: m.h });
      rects.push({ x: x0 + towerCols * m.w - m.w / 4, y: ty, w: m.w / 2, h: m.h });
    }

    // Места для автоматических пушек: стена (в последнем промежутке между зубцами) и верх башни.
    // CFG.fortGuns.count = 1 — только на стене.
    let gap = wallCols - 1;
    if (gap % 2 === 0) gap--;
    this.fortGunSpots = [{ x: x0 + (gap + 0.5) * m.w, y: top + wallRows * m.h }];
    if (towerRows > 0) this.fortGunSpots.push({ x: x0 + towerCols * m.w / 2, y: top + (wallRows + towerRows) * m.h });
    this.fortGunSpots = this.fortGunSpots.slice(0, CFG.fortGuns.count);

    return Physics.buildBricks({
      rects, material: m, frame: null, anchorBody: ground,
      onBase: r => Math.abs(r.y - r.h / 2 - top) < 0.01, owner: 'fortress',
    });
  },

  // ---------- Автоматическая пушка на крепости ----------
  // Обычное тело, стоящее на кладке: рухнет кладка — пушка упадёт вместе с ней.
  createFortGun(x, baseY) {
    const hw = 0.33, hh = 0.17;
    const body = Physics.world.createBody({ type: 'dynamic', position: V(x, baseY + hh + 0.005), angularDamping: 0.5 });
    body.createFixture(new pl.Box(hw, hh), { density: 4, friction: 0.9, restitution: 0 });
    const gun = {
      kind: 'fortGun', body, alive: true, hw, hh,
      pivotLocal: { x: 0, y: hh + 0.12 },
      angle: 0.3, targetAngle: 0.3,           // мировой угол ствола, рад
      reload: 1 + Math.random() * 2, aimPending: null, recoil: 0,
      homeY: baseY + hh,
    };
    body.setUserData(gun);
    return gun;
  },

  fortGunPivot(gun) {
    return gun.body.getWorldPoint(V(gun.pivotLocal.x, gun.pivotLocal.y));
  },

  // ---------- Пушка игрока ----------
  createPlayerCannon() {
    const c = CFG.playerCannon, top = CFG.shore.topY;
    const body = Physics.world.createBody({ type: 'static', position: V(c.x, top + 0.4) });
    body.createFixture(new pl.Box(0.75, 0.4), { friction: 0.8 });
    const cannon = {
      kind: 'cannon', owner: 'player', body,
      pivot: { x: c.x, y: top + 0.85 },
      angle: 25, powder: 2, ballType: 'iron',
      reload: 0, hp: c.hp, maxHp: c.hp, recoil: 0,
      repair: 0, repairTotal: 0, // > 0 — пушка разбита и её чинят
    };
    body.setUserData(cannon);
    return cannon;
  },

  // ---------- Корабль ----------
  // opts — из записи эскадры в уровне: name (историческое имя), flag ('uk' | 'france'),
  // speedMul, hpMul — множители скорости и прочности этого корабля, leaveAt — когда он уходит
  createShip(typeKey, x, stopX, opts = {}) {
    const T = CFG.ships[typeKey], s = T.scale;
    const hw = 3.5 * s, bw = 2.6 * s, hh = 0.85 * s; // высокие борта — запас от заливания на обычной волне
    const y = CFG.water.level + 0.15;
    const hull = Physics.world.createBody({ type: 'dynamic', position: V(x, y), angularDamping: 0.3 });
    const verts = [V(-bw, -hh), V(bw, -hh), V(hw, hh), V(-hw, hh)];
    // Корпус открыт сверху, как ванна: днище и два борта. Ядро, упавшее сверху, остаётся внутри.
    const W = y => bw + (hw - bw) * ((y + hh) / (2 * hh)); // полуширина корпуса на высоте y
    const t = 0.2 * s, y1 = -hh + t;
    const hullFix = { density: T.hullDensity, friction: 0.6 };
    hull.createFixture(new pl.Polygon([V(-bw, -hh), V(bw, -hh), V(W(y1), y1), V(-W(y1), y1)]), hullFix);
    hull.createFixture(new pl.Polygon([V(-W(y1), y1), V(-W(y1) + t, y1), V(-hw + t, hh), V(-hw, hh)]), hullFix);
    hull.createFixture(new pl.Polygon([V(W(y1) - t, y1), V(W(y1), y1), V(hw, hh), V(hw - t, hh)]), hullFix);

    // Точки плавучести: сетка внутри трапеции
    const rows = 5, cols = 12, cellH = (2 * hh) / rows;
    const points = [];
    for (let r = 0; r < rows; r++) {
      const ly = -hh + cellH * (r + 0.5);
      const halfW = bw + (hw - bw) * ((ly + hh) / (2 * hh));
      const cw = (2 * halfW) / cols;
      for (let c = 0; c < cols; c++) points.push({ x: -halfW + cw * (c + 0.5), y: ly, a: cw * cellH });
    }

    const ship = {
      kind: 'hull', type: typeKey, T, hull, points, cellH, verts, wall: t, hh, halfWidthAt: W,
      // Трюм (внутренний контур корпуса) и вода в нём, м²
      hold: [{ x: -W(y1) + t, y: y1 }, { x: W(y1) - t, y: y1 }, { x: W(hh) - t, y: hh }, { x: -W(hh) + t, y: hh }],
      water: 0, waterPoly: null,
      hp: T.hp * (opts.hpMul || 1), maxHp: T.hp * (opts.hpMul || 1), alive: true, deadTime: 0, stopX,
      name: opts.name || T.name, flag: opts.flag || 'uk', speedMul: opts.speedMul || 1, retreat: false,
      leaveAt: opts.leaveAt ?? null, // с от начала боя: тогда корабль уходит (не потопили — бой проигран)
      cannons: [], bricks: [], removed: false,
    };
    ship.holdArea = Physics.polyArea(ship.hold);
    hull.setUserData(ship);

    // Пушки: у каждой свой фикстур на корпусе — по нему ловим попадания
    T.cannons.forEach((cx, i) => {
      const gun = {
        kind: 'shipGun', ship, alive: true, hp: CFG.ships.gunHp, maxHp: CFG.ships.gunHp,
        local: { x: cx * s, y: hh + 0.32 * s },
        barrelRel: Math.PI - 0.4,      // угол ствола относительно корпуса
        barrelTarget: Math.PI - 0.4,
        fireTimer: 2 + i * 1.5 + Math.random() * 2,
        aimPending: null, recoil: 0,
      };
      gun.fixture = hull.createFixture(new pl.Box(0.5 * s, 0.3 * s, V(gun.local.x, hh + 0.28 * s), 0), {
        density: 3, friction: 0.6, userData: gun,
      });
      ship.cannons.push(gun);
    });

    // Надстройка из досок на корме (справа, корабль плывёт влево)
    const m = CFG.brick.wood;
    const rects = [];
    // Доски масштабируются вместе с кораблём
    const bw_ = m.w * s, bh_ = m.h * s;
    const deck = hh + bh_ / 2;
    // Рубка — на корме; у учебного щита (cabinCenter) — посередине плота
    const cabinX0 = T.cabinCenter ? -T.cabinCols * bw_ / 2 : hw - 0.4 * s - T.cabinCols * bw_;
    for (let r = 0; r < T.cabinRows; r++) {
      for (let c = 0; c < T.cabinCols; c++) rects.push({ x: cabinX0 + bw_ * (c + 0.5), y: deck + r * bh_, w: bw_, h: bh_, tag: 'cabin' });
    }
    // Мачта из узких брусков
    const mh = 0.6 * s;
    for (let r = 0; r < T.mastHeight; r++) rects.push({ x: T.mastX * s, y: hh + mh / 2 + r * mh, w: 0.22 * s, h: mh, tag: 'mast' });
    // Фальшборт у носовой пушки
    if (T.cannons.length) rects.push({ x: Math.min(...T.cannons) * s - 0.75 * s, y: deck, w: 0.3 * s, h: bh_, tag: 'bulwark' });

    ship.bricks = Physics.buildBricks({
      rects, material: m, frame: hull, anchorBody: hull,
      onBase: r => Math.abs(r.y - r.h / 2 - hh) < 0.01, owner: ship,
    });
    ship.mastBricks = ship.bricks.filter(b => b.tag === 'mast');
    for (const b of ship.mastBricks) b.initJoints = b.joints.size; // для проверки, цела ли мачта
    ship.cabinBricks = ship.bricks.filter(b => b.tag === 'cabin');
    ship.mastBroken = false;
    ship.crew = 1; // доля команды: от неё зависят откачка воды и ремонт пушек

    // Балласт: смещаем центр масс корпуса вниз и так, чтобы уравновесить надстройку
    let bm = 0, bx = 0;
    for (const b of ship.bricks) {
      const m = b.body.getMass();
      bm += m;
      bx += m * hull.getLocalPoint(b.body.getWorldCenter()).x;
    }
    const md = { mass: 0, center: V(0, 0), I: 0 };
    hull.getMassData(md);
    // Масса — как у сплошного корпуса (тяжёлый киль и трюм с грузом), иначе пустой корпус слишком лёгкий
    const mass = (hw + bw) * 2 * hh * T.hullDensity;
    const newC = V(-bx / mass, -hh * 0.55);
    // I в planck задаётся относительно начала координат тела
    const Ic = (md.I - md.mass * (md.center.x ** 2 + md.center.y ** 2)) * (mass / md.mass);
    hull.setMassData({ mass, center: newC, I: Ic + mass * (newC.x ** 2 + newC.y ** 2) });
    return ship;
  },

  cannonWorld(ship, gun) {
    const p = ship.hull.getWorldPoint(V(gun.local.x, gun.local.y));
    return { x: p.x, y: p.y, angle: ship.hull.getAngle() + gun.barrelRel };
  },

  // ---------- Ядро ----------
  createBall(typeKey, owner, x, y, vx, vy) {
    const B = CFG.balls[typeKey];
    const body = Physics.world.createBody({ type: 'dynamic', position: V(x, y), bullet: true });
    body.createFixture(new pl.Circle(B.radius), { density: B.density, friction: 0.4, restitution: 0.25 });
    body.setLinearVelocity(V(vx, vy));
    const ball = { kind: 'ball', type: typeKey, B, owner, body, hits: 0, age: 0, inWater: false, alive: true };
    body.setUserData(ball);
    return ball;
  },
};

// ---------- Частицы (только визуальные) ----------
const Particles = {
  list: [],
  spawn(p) { this.list.push(Object.assign({ life: 1, max: 1, g: -9.8, size: 0.1, alpha: 1 }, p)); },
  smoke(x, y, dirX, dirY, n = 12) {
    for (let i = 0; i < n; i++) {
      const sp = 1 + Math.random() * 3;
      this.spawn({ type: 'smoke', x, y, vx: dirX * sp + (Math.random() - 0.5), vy: dirY * sp + Math.random() * 0.8,
        g: 0.6, size: 0.25 + Math.random() * 0.35, life: 1.2 + Math.random(), max: 2.2, color: [220, 220, 215] });
    }
    for (let i = 0; i < 6; i++) {
      this.spawn({ type: 'spark', x, y, vx: dirX * (6 + Math.random() * 6) + (Math.random() - 0.5) * 3, vy: dirY * (6 + Math.random() * 6) + (Math.random() - 0.5) * 3,
        g: 0, size: 0.07, life: 0.15 + Math.random() * 0.1, max: 0.25, color: [255, 200, 90] });
    }
  },
  splash(x, y, power) {
    const n = Math.min(40, 8 + power * 2);
    for (let i = 0; i < n; i++) {
      this.spawn({ type: 'drop', x: x + (Math.random() - 0.5) * 0.4, y, vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * Math.min(9, 2 + power * 0.5), size: 0.06 + Math.random() * 0.08,
        life: 0.6 + Math.random() * 0.6, max: 1.2, color: [220, 240, 255] });
    }
  },
  debris(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) {
      this.spawn({ type: 'chip', x, y, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 6,
        size: 0.06 + Math.random() * 0.1, life: 0.8 + Math.random() * 0.8, max: 1.6, color, rot: Math.random() * 6 });
    }
    for (let i = 0; i < 4; i++) {
      this.spawn({ type: 'smoke', x, y, vx: (Math.random() - 0.5) * 1.5, vy: Math.random(), g: 0.3,
        size: 0.2 + Math.random() * 0.3, life: 0.8 + Math.random() * 0.6, max: 1.4, color: [180, 170, 155] });
    }
  },
  update(dt) {
    for (const p of this.list) {
      p.vy += p.g * dt;
      if (p.type === 'smoke') { p.vx *= 0.97; p.vy *= 0.97; p.size += dt * 0.5; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
      if (p.type === 'drop' && p.vy < 0 && p.y < Physics.waterY(p.x)) p.life = 0;
    }
    this.list = this.list.filter(p => p.life > 0);
  },
};
