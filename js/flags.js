// Флаги. Рисунок взят по эталонам с Викимедиа (Commons), чтобы не было отсебятины:
//  • Великобритания — «Flag of the United Kingdom (1-2).svg»: Юнион Джек образца 1801 г.
//    (действовал и в 1854 г.), пропорции 1:2, косой красный крест св. Патрика смещён.
//  • Российская империя — «Flag of Russia.svg»: бело-сине-красный, пропорции 2:3.
//    В 1854 г. это фактический национальный флаг; чёрно-жёлто-белый утвердили только в 1858 г.
//  • Франция — «Flag of France (1794–1815, 1830–1958).svg»: триколор образца Второй империи,
//    вертикальные синяя, белая и красная полосы равной ширины, пропорции 2:3.
// Каждый флаг один раз рисуется в отдельный холст, а в игре выводится полосками с волной.

const Flags = {
  images: {},

  init() {
    this.images.uk = this.make(1200, 600, ctx => {
      ctx.scale(20, 20); // единицы эталонного SVG: viewBox 0 0 60 30
      ctx.beginPath(); ctx.rect(0, 0, 60, 30); ctx.clip();
      ctx.fillStyle = '#012169'; ctx.fillRect(0, 0, 60, 30);
      const diag = new Path2D('M0,0 L60,30 M60,0 L0,30');
      const cross = new Path2D('M30,0 v30 M0,15 h60');
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.stroke(diag);
      ctx.save();
      ctx.clip(new Path2D('M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z'));
      ctx.strokeStyle = '#C8102E'; ctx.lineWidth = 4; ctx.stroke(diag);
      ctx.restore();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; ctx.stroke(cross);
      ctx.strokeStyle = '#C8102E'; ctx.lineWidth = 6; ctx.stroke(cross);
    });
    this.images.russia = this.make(900, 600, ctx => {
      ctx.scale(100, 100); // viewBox 0 0 9 6
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 9, 3);
      ctx.fillStyle = '#d52b1e'; ctx.fillRect(0, 3, 9, 3);
      ctx.fillStyle = '#0039a6'; ctx.fillRect(0, 2, 9, 2);
    });
    this.images.france = this.make(900, 600, ctx => {
      ctx.scale(100, 100); // viewBox 0 0 9 6
      ctx.fillStyle = '#002395'; ctx.fillRect(0, 0, 3, 6);
      ctx.fillStyle = '#fff'; ctx.fillRect(3, 0, 3, 6);
      ctx.fillStyle = '#ED2939'; ctx.fillRect(6, 0, 3, 6);
    });
  },

  make(w, h, paint) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    paint(c.getContext('2d'));
    return c;
  },

  // Флаг на ветру. (x, y) — верх древка/шкаторины в мировых координатах, angle — наклон древка
  // (0 — вертикально), w/h — размер в метрах. Полотнище развевается вправо (ветер с суши).
  draw(R, key, x, y, angle, w, h, phase = 0) {
    const img = this.images[key];
    if (!img) return;
    const ctx = R.ctx, s = R.s, t = Physics.time;
    const N = 16, sw = img.width / N;
    ctx.save();
    ctx.translate(R.X(x), R.Y(y));
    ctx.rotate(-angle);
    for (let i = 0; i < N; i++) {
      const u = i / N;
      // У древка полотнище почти неподвижно, к свободному краю волна сильнее
      const wave = Math.sin(u * 7 - t * 6 + phase) * h * 0.12 * u;
      const shade = 0.88 + 0.12 * Math.cos(u * 7 - t * 6 + phase);
      ctx.globalAlpha = 1;
      ctx.drawImage(img, i * sw, 0, sw + 1, img.height, u * w * s, wave * s, (w / N) * s + 1, h * s);
      // Лёгкая тень в складках
      ctx.globalAlpha = (1 - shade) * 1.5;
      ctx.fillStyle = '#000';
      ctx.fillRect(u * w * s, wave * s, (w / N) * s + 1, h * s);
    }
    ctx.restore();
  },
};
