// Игровой цикл, ввод, обработка попаданий, ИИ кораблей, условия победы и поражения.

// Наибольший заряд — по числу скоростей в CFG.powderSpeed
const MAX_POWDER = CFG.powderSpeed.length - 1;

const Game = {
  state: 'play', // play | win | lose
  active: false, // идёт ли бой (false — меню и прочие экраны)
  paused: false,
  level: null,   // данные текущего уровня (см. js/levels.js)
  onEnd: null,   // вызывается с итогами боя, когда бой кончился и прошла пауза endDelay
  endDelay: 2.5, // с: дать досмотреть, как тонет последний корабль
  time: 0,
  ground: null, rampart: null, fortress: [], cannon: null, fortGuns: [], ships: [], balls: [], looseBricks: [],
  ammo: {},      // запас покупных ядер на этот бой: тип → штук (чугунное — без счёта)
  spawnIndex: 0, sunk: 0, impacts: [], message: '',
  keys: {},

  // Начать бой: собрать конфигурацию из базы, уровня и профиля и построить мир заново
  start(level, profile = Profile.data) {
    this.level = level;
    CFG = Levels.buildConfig(level, profile);
    this.reset();
    this.active = true;
    this.paused = false;
  },

  // Уничтожить бой целиком: ничего не переходит в следующий
  stop() {
    this.active = false;
    this.paused = false;
    this.level = null;
    this.onEnd = null;
    Physics.world = null;
    Particles.list = [];
    this.ground = null; this.cannon = null; this.rampart = null; this.ammo = {};
    this.fortress = []; this.fortGuns = []; this.ships = []; this.balls = []; this.impacts = [];
    this.keys = {};
  },

  reset() {
    Physics.create();
    Particles.list = [];
    this.state = 'play';
    this.time = 0;
    this.ships = [];
    this.balls = [];
    this.impacts = [];
    this.spawnIndex = 0;
    this.sunk = 0;
    this.sunkTypes = {};   // потоплено по типам кораблей — для награды в казну
    this.ammo = { ...CFG.ammo };
    this.escaped = 0;      // кораблей, ушедших живыми (запись эскадры с leaveAt)
    this.endTimer = 0;
    this.endReported = false;
    this.shots = 0;        // выстрелов игрока
    this.hits = 0;         // из них попало в корабль (корпус, надстройка, пушка)
    this.powderSpent = 0;  // мешков
    this.powder = CFG.powderStore.start; // мешков на складе
    this.powderTimer = 0;                  // сколько прошло с последнего подвоза
    this.ground = Entities.createGround();
    this.fortress = Entities.createFortress(this.ground);
    this.rampart = Entities.createRampart();
    this.cannon = Entities.createPlayerCannon();
    this.fortGuns = Entities.fortGunSpots.map(p => Entities.createFortGun(p.x, p.y));
    Physics.world.on('begin-contact', c => this.onContact(c));
    Physics.world.on('pre-solve', c => this.onPreSolve(c));
  },

  // ---------- Попадания ----------
  // Разбор контакта: ядро и то, во что оно попало (фикстур пушки корабля или тело)
  ballContact(contact) {
    const fa = contact.getFixtureA(), fb = contact.getFixtureB();
    const da = fa.getBody().getUserData(), db = fb.getBody().getUserData();
    if (da && da.kind === 'ball') return { ball: da, fix: fb, body: fb.getBody() };
    if (db && db.kind === 'ball') return { ball: db, fix: fa, body: fa.getBody() };
    return null;
  },

  // Корабль, которому принадлежит тело (корпус или доска надстройки)
  shipOf(ud) {
    if (!ud) return null;
    if (ud.kind === 'hull') return ud;
    if (ud.kind === 'brick' && ud.owner && ud.owner.kind === 'hull') return ud.owner;
    return null;
  },

  // Своё ядро не задевает своих: ядро корабля — сам корабль (иначе кормовая пушка бьёт по носовой),
  // ядро пушки крепости — кладку крепости и наши пушки (ствол торчит над зубцами)
  ownHit(ball, ud) {
    if (!ud) return false;
    if (ball.fromFort) return (ud.kind === 'brick' && ud.owner === 'fortress') || ud.kind === 'fortGun' || ud.kind === 'cannon' || ud.kind === 'rampart';
    return ball.owner !== 'player' && this.shipOf(ud) === ball.owner;
  },

  // Ядро и мачта: задевает с вероятностью mastHitChance. Решение принимается один раз
  // для пары «ядро — мачта корабля» и держится, пока ядро пролетает сквозь все её бруски.
  passesMast(ball, ud) {
    if (!ud || ud.kind !== 'brick' || ud.tag !== 'mast') return false;
    if (!ball.mastRolls) ball.mastRolls = new Map();
    let pass = ball.mastRolls.get(ud.owner);
    if (pass === undefined) {
      pass = Math.random() >= CFG.ships.mastHitChance;
      ball.mastRolls.set(ud.owner, pass);
    }
    return pass;
  },

  onPreSolve(contact) {
    const bc = this.ballContact(contact);
    if (!bc) {
      // Корабли проходят друг мимо друга (в глубине сцены они на разных линиях): разные корабли не сталкиваются
      const sa = this.shipOf(contact.getFixtureA().getBody().getUserData());
      const sb = this.shipOf(contact.getFixtureB().getBody().getUserData());
      if (sa && sb && sa !== sb) contact.setEnabled(false);
      return;
    }
    const ud = bc.body.getUserData();
    if (this.ownHit(bc.ball, ud) || this.passesMast(bc.ball, ud)) contact.setEnabled(false);
  },

  onContact(contact) {
    const bc = this.ballContact(contact);
    if (!bc || !bc.ball.alive || bc.fix.isSensor()) return;
    const { ball, fix, body: otherBody } = bc;
    const other = fix.getUserData() || otherBody.getUserData();
    if (this.ownHit(ball, otherBody.getUserData()) || this.passesMast(ball, otherBody.getUserData())) return;

    const wm = contact.getWorldManifold(null);
    const pt = wm && wm.points && wm.points[0] ? wm.points[0] : ball.body.getPosition();
    const vb = ball.body.getLinearVelocity();
    const vo = otherBody.getLinearVelocityFromWorldPoint(pt);
    const rel = Math.hypot(vb.x - vo.x, vb.y - vo.y);
    // Каждый следующий отскок наносит меньше урона
    const hitFactor = Math.pow(0.5, ball.hits);
    ball.hits++;
    if (rel < CFG.brick.minImpactSpeed || !other) return;
    const energy = 0.5 * ball.body.getMass() * rel * rel * hitFactor;
    this.impacts.push({ ball, target: other, energy, x: pt.x, y: pt.y });
  },

  processImpacts() {
    for (const imp of this.impacts) {
      const { ball, target, x, y } = imp;
      // Точность игрока: ядро его пушки задело корабль (считается один раз на ядро)
      if (ball.owner === 'player' && !ball.fromFort && !ball.scored &&
          (target.kind === 'shipGun' || this.shipOf(target))) { ball.scored = true; this.hits++; }
      // Вражеские ядра бьют по кладке сильнее на CFG.ships.shellPower (по пушке — как раньше)
      const boost = ball.owner !== 'player' && target.kind === 'brick';
      const energy = boost ? imp.energy * CFG.ships.shellPower : imp.energy;
      if (target.kind === 'brick' && target.alive) {
        this.damageBrick(target, energy * CFG.brick.damagePerJoule * ball.B.damage);
        this.shockwave(x, y, energy);
        Particles.debris(x, y, target.material.color, 5);
      } else if (target.kind === 'shipGun' && target.alive && target.ship.alive && !ball.hitGun) {
        // Одно ядро повреждает не больше одной пушки
        ball.hitGun = true;
        target.hp -= energy * CFG.ships.gunDamagePerJoule * ball.B.damage;
        Particles.debris(x, y, [70, 70, 70], 6);
        if (target.hp <= 0) this.destroyShipGun(target, x, y);
      } else if (target.kind === 'hull' && target.alive) {
        target.hp -= energy * CFG.ships.damagePerJoule * ball.B.hullDamage;
        this.shockwave(x, y, energy * 0.7);
        Particles.debris(x, y, CFG.brick.wood.color, 10);
        if (target.hp <= 0) this.killShip(target);
      } else if (target.kind === 'fortGun' && target.alive && ball.owner !== 'player') {
        this.destroyFortGun(target);
      } else if (target.kind === 'cannon' && target.owner === 'player' && ball.owner !== 'player') {
        if (target.repair <= 0) {
          target.hp -= energy * 0.08;
          if (target.hp <= 0) this.breakPlayerCannon(target);
        }
        Particles.debris(x, y, [80, 80, 80], 10);
      } else if (target.kind === 'ground') {
        Particles.debris(x, y, [190, 170, 120], 6);
      } else if (target.kind === 'rampart') {
        // Земля принимает ядро: только комья и пыль
        Particles.debris(x, y, [122, 104, 70], 10);
        Particles.smoke(x, y, 0, 1, 3);
      }
    }
    this.impacts.length = 0;
  },

  // ---------- Пушки крепости ----------
  destroyFortGun(gun) {
    if (!gun.alive) return;
    gun.alive = false;
    const p = gun.body.getPosition();
    Particles.debris(p.x, p.y, [60, 60, 60], 16);
    Particles.debris(p.x, p.y, [107, 74, 43], 8);
    Particles.smoke(p.x, p.y, 0, 1, 10);
    Physics.world.destroyBody(gun.body);
  },

  fortGunAI(gun, dt) {
    const F = CFG.fortGuns;
    // Упала вместе с кладкой — разбилась
    const a = gun.body.getAngle(), p = gun.body.getPosition();
    if (Math.abs(a) > F.fallTilt * Math.PI / 180 || p.y < gun.homeY - F.fallDrop) { this.destroyFortGun(gun); return; }

    gun.angle += (gun.targetAngle - gun.angle) * Math.min(1, dt * 4);
    gun.recoil = Math.max(0, gun.recoil - dt * 3);
    gun.reload -= dt;
    if (this.state !== 'play') return;

    if (gun.aimPending) {
      gun.aimPending.t -= dt;
      if (gun.aimPending.t > 0) return;
      const pv = Entities.fortGunPivot(gun);
      const ang = gun.angle + (Math.random() - 0.5) * 2 * F.aimError * Math.PI / 180;
      const L = F.barrelLength;
      const ball = this.fireBall('player', F.ball, pv.x + Math.cos(ang) * L, pv.y + Math.sin(ang) * L, ang, gun.aimPending.powder);
      ball.fromFort = true;
      gun.recoil = 1;
      gun.aimPending = null;
      gun.reload = F.reload;
      return;
    }
    if (gun.reload > 0) return;

    // Цель — ближайший живой корабль в пределах экрана
    let target = null;
    for (const s of this.ships) {
      if (!s.alive) continue;
      const sp = s.hull.getPosition();
      if (sp.x > CFG.world.width - 1) continue;
      if (sp.x - gun.body.getPosition().x > CFG.fortGuns.maxRange) continue; // далеко — не достанем
      if (!target || sp.x < target.hull.getPosition().x) target = s;
    }
    if (!target) { gun.reload = 0.5; return; }

    const pv = Entities.fortGunPivot(gun);
    const sp = target.hull.getPosition(), sv = target.hull.getLinearVelocity();
    // Подходящие заряды; берём случайный. Упреждение на ход корабля — по настройке.
    const options = [];
    for (let powder = 1; powder <= MAX_POWDER; powder++) {
      const v = CFG.powderSpeed[powder];
      let aim = { x: sp.x, y: sp.y + 0.2 }, th = this.solveFromMuzzle(pv, F.barrelLength, 1, aim, v);
      if (th !== null && F.leadTarget) {
        const tFlight = (aim.x - pv.x) / (v * Math.cos(th));
        th = this.solveFromMuzzle(pv, F.barrelLength, 1, { x: sp.x + sv.x * tFlight, y: aim.y }, v);
      }
      if (th !== null && th > -0.25 && th < 1.1) options.push({ powder, th });
    }
    if (options.length) {
      const pick = options[(Math.random() * options.length) | 0];
      gun.targetAngle = pick.th;
      gun.aimPending = { t: F.aimTime, powder: pick.powder };
      return;
    }
    gun.reload = 0.5; // не достаёт
  },

  // Пушка корабля выведена из строя и уходит в ремонт.
  destroyShipGun(gun, x, y) {
    gun.alive = false;
    gun.aimPending = null;
    gun.fixture.setSensor(true); // больше не мешает ядрам; масса корпуса не меняется
    // Команда чинит пушку: время ремонта = время перезарядки × repairMultiplier
    gun.repairTotal = this.gunReloadTime(gun.ship.T) * CFG.ships.repairMultiplier;
    gun.repair = gun.repairTotal;
    Particles.debris(x, y, [60, 60, 60], 14);
    Particles.smoke(x, y, 0, 1, 6);
  },

  // Время перезарядки корабельной пушки — середина интервала fireDelay
  gunReloadTime(T) {
    return (T.fireDelay[0] + T.fireDelay[1]) / 2;
  },

  repairGun(ship, gun, dt) {
    gun.repair -= dt * ship.crew; // меньше команды — дольше чинят
    if (gun.repair > 0) {
      // Искры от работы ремонтников
      if (Math.random() < dt * 4) {
        const cw = Entities.cannonWorld(ship, gun);
        Particles.spawn({ type: 'spark', x: cw.x + (Math.random() - 0.5) * 0.4, y: cw.y, vx: (Math.random() - 0.5) * 2,
          vy: 1 + Math.random() * 2, g: -9.8, size: 0.05, life: 0.3, max: 0.3, color: [255, 210, 120] });
      }
      return;
    }
    gun.alive = true;
    gun.hp = gun.maxHp;
    gun.repair = 0;
    gun.fixture.setSensor(false);
    gun.fireTimer = 1 + Math.random(); // сразу после ремонта — короткая пауза и снова в бой
  },

  damageBrick(brick, dmg) {
    brick.hp -= dmg;
    if (brick.hp <= 0) this.destroyBrick(brick);
  },

  destroyBrick(brick) {
    if (!brick.alive) return;
    brick.alive = false;
    const p = brick.body.getPosition();
    Particles.debris(p.x, p.y, brick.material.color, 12);
    for (const j of [...brick.joints]) Physics.breakJoint(j);
    Physics.world.destroyBody(brick.body);
  },

  // Удар расшатывает кладку вокруг: рвутся соединения в радиусе, зависящем от энергии
  shockwave(x, y, energy) {
    const W = CFG.brick.shockwave;
    const radius = Math.min(W.maxRadius, Math.sqrt(energy) * W.radiusPerSqrtJ);
    if (radius < 0.3) return;
    const all = this.allBricks();
    for (const br of all) {
      if (!br.alive) continue;
      if (br.tag === 'mast') continue; // мачту ломает только прямое попадание
      const p = br.body.getPosition();
      const d = Math.hypot(p.x - x, p.y - y);
      if (d > radius) continue;
      const chance = 1 - d / radius;
      for (const j of [...br.joints]) if (Math.random() < chance * W.breakChance) Physics.breakJoint(j);
      // Небольшой урон соседям
      if (d > 0.3) this.damageBrick(br, energy * CFG.brick.damagePerJoule * 0.15 * chance);
    }
  },

  allBricks() {
    const out = this.fortress.slice();
    for (const s of this.ships) out.push(...s.bricks);
    return out;
  },

  killShip(ship) {
    if (!ship.alive) return;
    ship.alive = false;
    ship.hp = 0;
    ship.deadTime = 0;
    this.sunk++;
    this.sunkTypes[ship.type] = (this.sunkTypes[ship.type] || 0) + 1;
    // Надстройка разваливается
    for (const br of ship.bricks) for (const j of [...br.joints]) if (Math.random() < 0.5) Physics.breakJoint(j);
  },

  // ---------- Стрельба ----------
  // acc — множители разброса { angle, speed } (у пушки игрока — от прокачки точности)
  fireBall(owner, typeKey, x, y, angle, powder, acc = { angle: 1, speed: 1 }) {
    const B = CFG.balls[typeKey];
    // Разброс: ядро неровное, порох горит неодинаково. Сумма двух случайных — чаще ближе к центру.
    const r = () => Math.random() + Math.random() - 1; // от -1 до 1
    angle += r() * B.spread * acc.angle * Math.PI / 180;
    const v = CFG.powderSpeed[powder] * B.speedMul * (1 + r() * B.speedSpread * acc.speed);
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const ball = Entities.createBall(typeKey, owner, x, y, dx * v, dy * v);
    this.balls.push(ball);
    Particles.smoke(x, y, dx, dy, 6 + powder * 4);
    return ball;
  },

  // Пушка игрока разбита: не стреляет, пока расчёт её не починит
  breakPlayerCannon(c) {
    c.hp = 0;
    c.repairTotal = CFG.playerCannon.repairTime ?? CFG.balls.iron.reload * CFG.ships.repairMultiplier;
    c.repair = c.repairTotal;
    Particles.smoke(c.pivot.x, c.pivot.y, 0, 1, 12);
  },

  // Хватает ли пороха на выстрел с выбранным зарядом
  canAffordShot() {
    return this.powder >= this.cannon.powder;
  },

  // Разброс пушки игрока: прокачка задаёт его для чугунного ядра, остальные — в той же пропорции
  playerAccuracy() {
    const pc = CFG.playerCannon, I = CFG.balls.iron;
    return { angle: pc.spread / I.spread, speed: pc.speedSpread / I.speedSpread };
  },

  // Сколько ядер этого типа можно выпустить (Infinity — чугунное)
  ammoLeft(type) {
    return type === 'iron' ? Infinity : this.ammo[type] || 0;
  },

  // Типы ядер, которыми можно стрелять сейчас: чугунное и покупные, пока не кончились
  ballTypes() {
    return ['iron', ...Object.keys(AMMO).filter(t => this.ammoLeft(t) > 0)];
  },

  // Следующий тип ядра (Q): по кругу среди доступных
  cycleBall() {
    const list = this.ballTypes(), c = this.cannon;
    c.ballType = list[(list.indexOf(c.ballType) + 1) % list.length];
  },

  playerFire() {
    const c = this.cannon;
    if (this.state !== 'play' || c.reload > 0 || c.hp <= 0) return;
    if (!this.canAffordShot()) return; // мало пороха — не стреляем, заряд не урезаем
    if (this.ammoLeft(c.ballType) <= 0) c.ballType = 'iron';
    this.powder -= c.powder;
    this.powderSpent += c.powder;
    this.shots++;
    const a = c.angle * Math.PI / 180;
    const L = CFG.playerCannon.barrelLength;
    const type = c.ballType;
    this.fireBall('player', type, c.pivot.x + Math.cos(a) * L, c.pivot.y + Math.sin(a) * L, a, c.powder, this.playerAccuracy());
    if (type !== 'iron') {
      this.ammo[type]--;
      if (this.ammo[type] <= 0) c.ballType = 'iron'; // кончились — дальше чугунными
    }
    c.reload = CFG.balls[type].reload;
    c.recoil = 1;
  },

  // Решение баллистической задачи: угол возвышения для попадания в цель (низкая траектория)
  // Угол возвышения с учётом того, что ядро стартует из дула (на расстоянии L от оси).
  // dir: +1 — стрельба вправо, -1 — влево. Несколько итераций сходятся быстро.
  solveFromMuzzle(pivot, L, dir, target, v) {
    let th = this.solveAngle(dir * (target.x - pivot.x), target.y - pivot.y, v);
    for (let k = 0; k < 4 && th !== null; k++) {
      const mx = pivot.x + dir * Math.cos(th) * L, my = pivot.y + Math.sin(th) * L;
      th = this.solveAngle(dir * (target.x - mx), target.y - my, v);
    }
    return th;
  },

  solveAngle(dx, dy, v) {
    const g = CFG.world.gravity;
    const v2 = v * v;
    const disc = v2 * v2 - g * (g * dx * dx + 2 * dy * v2);
    if (disc < 0) return null;
    return Math.atan2(v2 - Math.sqrt(disc), g * dx);
  },

  shipAI(ship, dt) {
    for (const gun of ship.cannons) if (!gun.alive) this.repairGun(ship, gun, dt);
    if (ship.hull.getPosition().x > CFG.world.width - 2) return; // ещё за краем экрана
    for (const gun of ship.cannons) if (gun.alive) this.gunAI(ship, gun, dt);
  },

  gunAI(ship, gun, dt) {
    const T = ship.T;
    // Плавно поворачиваем ствол к нужному углу (относительно корпуса)
    gun.barrelRel += (gun.barrelTarget - gun.barrelRel) * Math.min(1, dt * 3);
    gun.recoil = Math.max(0, gun.recoil - dt * 2);

    if (gun.aimPending) {
      gun.aimPending.t -= dt;
      if (gun.aimPending.t <= 0) {
        // Стреляем под тем углом к корпусу, что выставили — но корпус уже качнулся
        const cw = Entities.cannonWorld(ship, gun);
        const err = (Math.random() - 0.5) * 2 * T.aimError * Math.PI / 180;
        const a = cw.angle + err;
        const L = 1.0 * T.scale;
        this.fireBall(ship, 'iron', cw.x + Math.cos(a) * L, cw.y + Math.sin(a) * L, a, gun.aimPending.powder);
        gun.recoil = 1;
        gun.aimPending = null;
        gun.fireTimer = T.fireDelay[0] + Math.random() * (T.fireDelay[1] - T.fireDelay[0]);
      }
      return;
    }

    gun.fireTimer -= dt;
    if (gun.fireTimer > 0) return;

    // Выбор цели: пушка игрока, пушка крепости или случайный кирпич крепости
    let target;
    const standing = this.fortress.filter(b => b.alive);
    const fortGuns = this.fortGuns.filter(g => g.alive);
    const roll = Math.random();
    if (roll < 0.4 || standing.length === 0) target = { x: this.cannon.pivot.x, y: this.cannon.pivot.y - 0.2 };
    else if (roll < 0.6 && fortGuns.length) { const g = fortGuns[(Math.random() * fortGuns.length) | 0].body.getPosition(); target = { x: g.x, y: g.y }; }
    else { const b = standing[(Math.random() * standing.length) | 0].body.getPosition(); target = { x: b.x, y: b.y }; }

    const cw = Entities.cannonWorld(ship, gun);
    const L = 1.0 * T.scale; // ядро вылетает из дула, а не из оси пушки
    // Подходящие заряды; враг предпочитает самые сильные (настильный, мощный выстрел)
    const options = [];
    for (let powder = 1; powder <= MAX_POWDER; powder++) {
      const th = this.solveFromMuzzle(cw, L, -1, target, CFG.powderSpeed[powder]);
      if (th !== null && th > 0.05 && th < 1.1) options.push({ powder, th });
    }
    if (options.length) {
      const top = options.slice(-2);
      const pick = top[(Math.random() * top.length) | 0];
      gun.barrelTarget = (Math.PI - pick.th) - ship.hull.getAngle();
      gun.aimPending = { t: CFG.ships.aimToFire, powder: pick.powder };
      return;
    }
    gun.fireTimer = 1; // не достаёт — подождём, пока подплывёт
  },

  // ---------- Обновление ----------
  step(dt) {
    if (this.state === 'play') this.time += dt;
    Physics.time += dt;

    // Появление кораблей
    const lvl = CFG.fleet;
    while (this.spawnIndex < lvl.length && this.time >= lvl[this.spawnIndex].t) {
      const e = lvl[this.spawnIndex++];
      this.ships.push(Entities.createShip(e.type, CFG.world.width + 6, e.stopX, e));
    }

    // Пушка игрока
    const c = this.cannon, pc = CFG.playerCannon;
    if (this.state === 'play' && c.hp > 0) {
      if (this.keys.ArrowUp || this.keys.KeyW) c.angle = Math.min(pc.maxAngle, c.angle + pc.turnSpeed * dt);
      if (this.keys.ArrowDown || this.keys.KeyS) c.angle = Math.max(pc.minAngle, c.angle - pc.turnSpeed * dt);
    }
    c.reload = Math.max(0, c.reload - dt);
    c.recoil = Math.max(0, c.recoil - dt * 3);
    if (c.repair > 0) {
      c.repair -= dt;
      if (Math.random() < dt * 5) Particles.spawn({ type: 'spark', x: c.pivot.x + (Math.random() - 0.5) * 0.8, y: c.pivot.y,
        vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2, g: -9.8, size: 0.06, life: 0.3, max: 0.3, color: [255, 210, 120] });
      if (c.repair <= 0) { c.repair = 0; c.hp = c.maxHp; }
    }

    // Подвоз пороха: 1 мешок раз в resupplyEvery секунд, пока склад не полон
    const PS = CFG.powderStore;
    if (this.powder < PS.capacity) {
      this.powderTimer += dt;
      if (this.powderTimer >= PS.resupplyEvery) { this.powderTimer -= PS.resupplyEvery; this.powder++; }
    } else this.powderTimer = 0;

    // Пушки крепости
    for (const g of this.fortGuns) if (g.alive) this.fortGunAI(g, dt);

    // Корабли: плавучесть, ход, ИИ
    for (const s of this.ships) {
      if (s.removed) continue;
      let mul = 1;
      if (!s.alive) {
        s.deadTime += dt;
        mul = Math.max(0.15, 1 - s.deadTime * 0.25);
      } else {
        mul = 0.85 + 0.15 * (s.hp / s.maxHp); // пробоины — корабль садится ниже
      }
      if (s.alive) this.updateShipDamage(s);
      const sub = Physics.applyBuoyancyPoints(s.hull, s.points, s.cellH, mul);
      this.updateFlooding(s, dt);
      if (s.alive && sub > 0) {
        const v = s.hull.getLinearVelocity();
        const x = s.hull.getPosition().x;
        const speed = s.T.speed * s.speedMul * (s.mastBroken ? CFG.ships.mastBrokenSpeed : 1);
        // После боя на удержание уцелевшие корабли уходят из губы
        const targetV = s.retreat ? speed : x > s.stopX ? -speed : 0;
        // Тяга: компенсируем сопротивление воды на целевой скорости + подруливаем к ней
        const dragAtTarget = targetV * CFG.water.dragX * sub * CFG.water.density;
        s.hull.applyForceToCenter(V((targetV - v.x) * s.hull.getMass() * 3 + dragAtTarget, 0), true);
        if (this.state === 'play') this.shipAI(s, dt);
      }
      // Время корабля вышло (leaveAt) — разворачивается и уходит
      if (s.alive && s.leaveAt !== null && this.time >= s.leaveAt && this.state === 'play') s.retreat = true;
      if (s.retreat && s.alive && s.hull.getPosition().x > CFG.world.width + 8) {
        if (this.state === 'play') this.escaped++;
        this.removeShip(s);
      }
      if (!s.alive && (s.deadTime > 14 || s.hull.getPosition().y < CFG.water.seabedY + 0.5 && s.deadTime > 6)) {
        this.removeShip(s);
      }
    }

    // Плавучесть и уборка кирпичей
    for (const br of this.allBricks()) {
      if (!br.alive) continue;
      if (this.insideHull(br.body.getPosition())) continue; // лежит в трюме — сухо
      const inWater = Physics.applyBuoyancySimple(br.body, br.w * br.h, br.h / 2);
      if (inWater) {
        br.wet = (br.wet || 0) + dt;
        const p = br.body.getPosition();
        if ((br.wet > 8 && p.y < CFG.water.level - 2) || br.wet > 25) this.destroyBrickQuiet(br);
      }
      if (br.body.getPosition().y < CFG.water.seabedY - 3) this.destroyBrickQuiet(br);
    }

    // Ядра
    for (const b of this.balls) {
      if (!b.alive) continue;
      b.age += dt;
      const p = b.body.getPosition(), v = b.body.getLinearVelocity();
      const surf = Physics.waterY(p.x);
      // Ядро в трюме корабля — сухое и остаётся там (утяжеляет корабль)
      const inHold = this.insideHull(p);
      const inWater = !inHold && p.y < surf;
      if (inWater && !b.inWater) {
        if (!b.wasWet) b.hits += 2; // в воде ядро теряет силу
        b.wasWet = true;
        Particles.splash(p.x, surf, Math.abs(v.y));
      }
      b.inWater = inWater;
      if (inWater) Physics.applyBuoyancySimple(b.body, Math.PI * b.B.radius * b.B.radius, b.B.radius);
      const resting = !inHold && ((b.age > 3 && Math.hypot(v.x, v.y) < 0.3) || b.age > 12);
      if (resting || p.y < CFG.water.seabedY + 0.4 || p.x > CFG.world.width + 15 || p.x < -5) {
        b.alive = false;
        Physics.world.destroyBody(b.body);
      }
    }
    this.balls = this.balls.filter(b => b.alive);

    Physics.world.step(dt, 8, 3);
    Physics.checkJointStress(1 / dt);
    this.processImpacts();
    Particles.update(dt);
    this.checkEnd();
    if (this.state !== 'play' && !this.endReported) {
      this.endTimer += dt;
      if (this.endTimer >= this.endDelay) {
        this.endReported = true;
        if (this.onEnd) this.onEnd(this.results());
      }
    }
  },

  // Доска надстройки потеряна: уничтожена или сбита со своего места на корпусе
  brickLost(s, b) {
    if (!b.alive) return true;
    const l = s.hull.getLocalPoint(b.body.getPosition());
    return Math.hypot(l.x - b.localHome.x, l.y - b.localHome.y) > CFG.ships.lostOffset;
  },

  // Мачта ломается навсегда, если уничтожен хоть один брусок или порвано хоть одно крепление
  // (по смещению не смотрим: высокая мачта пружинит на волне). Команда — по доскам рубки.
  updateShipDamage(s) {
    if (!s.mastBroken && s.mastBricks.some(b => !b.alive || b.joints.size < b.initJoints)) s.mastBroken = true;
    const total = s.cabinBricks.length;
    const intact = s.cabinBricks.filter(b => !this.brickLost(s, b)).length;
    s.crew = Math.max(CFG.ships.crewMin, total ? intact / total : 1);
  },

  // Вода в трюме: заливается через борт, ушедший под воду, команда её откачивает.
  // Вода переливается к нижнему борту (центр тяжести — у реального многоугольника воды).
  updateFlooding(s, dt) {
    const F = CFG.flood, hull = s.hull;
    // Сколько кромки борта под водой и насколько глубоко
    const half = s.halfWidthAt(s.hh), N = 14, seg = (2 * half) / N;
    let inflow = 0;
    for (let k = 0; k < N; k++) {
      const p = hull.getWorldPoint(V(-half + seg * (k + 0.5), s.hh));
      const depth = Physics.waterY(p.x) - p.y;
      if (depth > 0) inflow += depth * seg;
    }
    s.inflow = inflow * F.inflowRate;
    s.water += s.inflow * dt;
    if (s.alive) s.water -= s.holdArea * F.pumpFraction * s.crew * dt; // откачивает оставшаяся команда
    s.water = Math.max(0, Math.min(s.holdArea, s.water));

    const poly = s.hold.map(v => hull.getWorldPoint(V(v.x, v.y)));
    s.waterPoly = Physics.fillVessel(poly, s.water);
    if (s.waterPoly) {
      const c = Physics.polyCentroid(s.waterPoly);
      hull.applyForce(V(0, -CFG.water.density * CFG.world.gravity * s.water), V(c.x, c.y), true);
    }
    if (s.alive && s.water >= s.holdArea * F.sinkFraction) { s.floodSunk = true; this.killShip(s); }
  },

  // Корабль, в трюме (внутри корпуса) которого находится точка, или null
  insideHull(p) {
    for (const s of this.ships) {
      if (s.removed) continue;
      const l = s.hull.getLocalPoint(p);
      if (l.y > -s.hh && l.y < s.hh + 0.05 && Math.abs(l.x) < s.halfWidthAt(Math.min(l.y, s.hh))) return s;
    }
    return null;
  },

  destroyBrickQuiet(br) {
    if (!br.alive) return;
    br.alive = false;
    for (const j of [...br.joints]) Physics.breakJoint(j);
    Physics.world.destroyBody(br.body);
  },

  removeShip(s) {
    s.removed = true;
    for (const br of s.bricks) this.destroyBrickQuiet(br);
    Physics.world.destroyBody(s.hull);
    this.ships = this.ships.filter(x => x !== s);
  },

  fortressIntegrity() {
    let ok = 0;
    for (const b of this.fortress) {
      if (!b.alive) continue;
      const p = b.body.getPosition();
      if (Math.hypot(p.x - b.home.x, p.y - b.home.y) < 0.6) ok++;
    }
    return ok / this.fortress.length;
  },

  checkEnd() {
    if (this.state !== 'play') return;
    if (this.fortressIntegrity() < CFG.lose.fortressMinIntegrity) { this.state = 'lose'; this.message = 'Крепость разрушена'; return; }
    if (this.escaped > 0 && this.spawnIndex >= CFG.fleet.length && this.sunk + this.escaped >= CFG.fleet.length) {
      this.state = 'lose'; this.message = this.escaped > 1 ? 'Корабли ушли' : 'Корабль ушёл';
      return;
    }
    if (this.spawnIndex >= CFG.fleet.length && this.sunk >= CFG.fleet.length) {
      this.state = 'win'; this.message = 'Все корабли потоплены!';
      return;
    }
    // Бой на удержание: батарея продержалась до отхода эскадры
    if (CFG.win.type === 'survive' && this.time >= CFG.win.time) {
      this.state = 'win'; this.message = 'Батарея выстояла — эскадра отходит';
      for (const s of this.ships) if (s.alive) s.retreat = true;
    }
  },

  // Сколько секунд осталось продержаться (только в бою на удержание), иначе null
  surviveLeft() {
    return CFG.win.type === 'survive' ? Math.max(0, CFG.win.time - this.time) : null;
  },

  // Итоги боя и звёзды: 1 — победа, 2 — крепость цела больше чем на stars.fortress,
  // 3 — пороха потрачено не больше stars.powder. Без победы звёзд нет.
  results() {
    const S = this.level.stars, win = this.state === 'win';
    const integrity = this.fortressIntegrity();
    return {
      win, message: this.message,
      sunk: this.sunk, total: CFG.fleet.length, sunkTypes: { ...this.sunkTypes },
      shots: this.shots, hits: this.hits,
      accuracy: this.shots ? this.hits / this.shots : 0,
      powderSpent: this.powderSpent, integrity, time: this.time,
      stars: [win, win && integrity > S.fortress, win && this.powderSpent <= S.powder],
    };
  },
};
