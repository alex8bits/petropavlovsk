// Физика: мир planck.js, вода (волны и плавучесть), сборка конструкций из кирпичей.
const pl = planck;
const V = (x, y) => new pl.Vec2(x, y);

const Physics = {
  world: null,
  time: 0,

  create() {
    this.world = new pl.World({ gravity: V(0, -CFG.world.gravity) });
    this.time = 0;
    return this.world;
  },

  // ---------- Вода ----------
  waterY(x, t = this.time) {
    let y = CFG.water.level;
    for (const [a, len, speed] of CFG.water.waves) {
      const k = (Math.PI * 2) / len;
      y += a * Math.sin(k * x - k * speed * t);
    }
    return y;
  },

  // Плавучесть по набору точек, привязанных к телу.
  // points: [{x, y, a}] — локальная точка и площадь кусочка корпуса; cellH — высота кусочка.
  applyBuoyancyPoints(body, points, cellH, mul = 1) {
    const g = CFG.world.gravity, rho = CFG.water.density;
    let submerged = 0;
    for (const p of points) {
      const wp = body.getWorldPoint(V(p.x, p.y));
      const surface = this.waterY(wp.x);
      const frac = Math.min(1, Math.max(0, (surface - wp.y) / cellH + 0.5));
      if (frac <= 0) continue;
      const area = p.a * frac;
      submerged += area;
      const v = body.getLinearVelocityFromWorldPoint(wp);
      const k = CFG.water.drag * area * rho;
      body.applyForce(V(-v.x * k * CFG.water.dragX / CFG.water.drag, rho * g * area * mul - v.y * k), wp, true);
    }
    if (submerged > 0) {
      body.applyTorque(-body.getAngularVelocity() * CFG.water.angularDrag * body.getInertia() * 2, true);
    }
    return submerged;
  },

  // Упрощённая плавучесть для мелких тел (кирпич, ядро): одна точка.
  applyBuoyancySimple(body, area, halfH) {
    const p = body.getPosition();
    const surface = this.waterY(p.x);
    const frac = Math.min(1, Math.max(0, (surface - p.y) / (halfH * 2) + 0.5));
    if (frac <= 0) return false;
    const a = area * frac, rho = CFG.water.density;
    const v = body.getLinearVelocity();
    body.applyForceToCenter(V(
      -v.x * CFG.water.drag * 4 * a * rho,
      rho * CFG.world.gravity * a - v.y * CFG.water.drag * 4 * a * rho
    ), true);
    body.setAngularVelocity(body.getAngularVelocity() * 0.97);
    return true;
  },

  // ---------- Геометрия многоугольников (для воды в трюме) ----------
  // Часть выпуклого многоугольника ниже горизонтали y = L (отсечение Сазерленда–Ходжмана)
  clipBelow(poly, L) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ain = a.y <= L, bin = b.y <= L;
      if (ain) out.push(a);
      if (ain !== bin) {
        const t = (L - a.y) / (b.y - a.y);
        out.push({ x: a.x + (b.x - a.x) * t, y: L });
      }
    }
    return out;
  },

  polyArea(poly) {
    let s = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s) / 2;
  },

  polyCentroid(poly) {
    let cx = 0, cy = 0, s = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const c = a.x * b.y - b.x * a.y;
      s += c; cx += (a.x + b.x) * c; cy += (a.y + b.y) * c;
    }
    if (Math.abs(s) < 1e-9) return poly[0];
    return { x: cx / (3 * s), y: cy / (3 * s) };
  },

  // Горизонтальный уровень жидкости объёмом area в сосуде poly (мировые координаты).
  // Возвращает многоугольник воды или null.
  fillVessel(poly, area) {
    if (area <= 1e-4) return null;
    let lo = Infinity, hi = -Infinity;
    for (const v of poly) { lo = Math.min(lo, v.y); hi = Math.max(hi, v.y); }
    if (area >= this.polyArea(poly)) return poly;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (this.polyArea(this.clipBelow(poly, mid)) < area) lo = mid; else hi = mid;
    }
    return this.clipBelow(poly, (lo + hi) / 2);
  },

  // ---------- Конструкции из кирпичей ----------
  // opts.rects: [{x, y, w, h}] — центры кирпичей. Если задан opts.frame (тело),
  // координаты локальные относительно него, иначе — мировые.
  // Касающиеся кирпичи свариваются ломкими соединениями; кирпичи, для которых
  // opts.onBase(rect) == true, привариваются к opts.anchorBody.
  buildBricks(opts) {
    const { rects, material, frame, anchorBody, onBase, owner } = opts;
    const world = this.world;
    const bricks = [];
    const toWorld = (x, y) => frame ? frame.getWorldPoint(V(x, y)) : V(x, y);
    const angle = frame ? frame.getAngle() : 0;

    for (const r of rects) {
      const body = world.createBody({ type: 'dynamic', position: toWorld(r.x, r.y), angle });
      body.createFixture(new pl.Box(r.w / 2, r.h / 2), {
        density: material.density, friction: material.friction, restitution: 0.05,
      });
      const brick = {
        kind: 'brick', body, w: r.w, h: r.h, material,
        hp: material.hp, maxHp: material.hp, owner, joints: new Set(),
        alive: true, shade: 0.85 + Math.random() * 0.3, home: toWorld(r.x, r.y),
        tag: r.tag || null,                         // роль кирпича: 'mast', 'cabin', ...
        localHome: frame ? { x: r.x, y: r.y } : null, // место относительно корпуса
      };
      body.setUserData(brick);
      bricks.push(brick);
    }

    const addWeld = (a, bBody, b, anchor) => {
      const j = world.createJoint(new pl.WeldJoint({}, a.body, bBody, anchor));
      if (!j) return;
      j.setUserData({ a, b });
      a.joints.add(j);
      if (b) b.joints.add(j);
    };

    const eps = 0.02;
    for (let i = 0; i < rects.length; i++) {
      const A = rects[i];
      for (let k = i + 1; k < rects.length; k++) {
        const B = rects[k];
        const left = Math.max(A.x - A.w / 2, B.x - B.w / 2), right = Math.min(A.x + A.w / 2, B.x + B.w / 2);
        const bot = Math.max(A.y - A.h / 2, B.y - B.h / 2), top = Math.min(A.y + A.h / 2, B.y + B.h / 2);
        const ovX = right - left, ovY = top - bot;
        const touchV = Math.abs(Math.abs(A.y - B.y) - (A.h + B.h) / 2) < eps && ovX > 0.1;
        const touchH = Math.abs(Math.abs(A.x - B.x) - (A.w + B.w) / 2) < eps && ovY > 0.1;
        if (touchV) addWeld(bricks[i], bricks[k].body, bricks[k], toWorld(left + ovX / 2, (A.y + B.y) / 2));
        else if (touchH) addWeld(bricks[i], bricks[k].body, bricks[k], toWorld((A.x + B.x) / 2, bot + ovY / 2));
      }
      if (onBase && onBase(A)) addWeld(bricks[i], anchorBody, null, toWorld(A.x, A.y - A.h / 2));
    }
    return bricks;
  },

  breakJoint(j) {
    const d = j.getUserData();
    if (!d || d.broken) return;
    d.broken = true;
    if (d.a) d.a.joints.delete(j);
    if (d.b && d.b.joints) d.b.joints.delete(j);
    this.world.destroyJoint(j);
  },

  breakAllJoints(brick) {
    for (const j of [...brick.joints]) this.breakJoint(j);
  },

  // Разрыв перегруженных соединений (например, когда кусок стены повис)
  checkJointStress(invDt) {
    const F = CFG.brick.jointBreakForce, T = CFG.brick.jointBreakTorque;
    const toBreak = [];
    for (let j = this.world.getJointList(); j; j = j.getNext()) {
      const d = j.getUserData();
      if (!d) continue;
      const f = j.getReactionForce(invDt).length();
      const t = Math.abs(j.getReactionTorque(invDt));
      const m = d.a.material;
      const scale = m.density * m.w * m.h; // крупные кирпичи держатся сильнее
      if (f > F * scale * 4 || t > T * scale * 4) toBreak.push(j);
    }
    for (const j of toBreak) this.breakJoint(j);
  },
};
