// Экраны поверх канваса: обычная HTML-вёрстка в #ui.
// Каждый экран — функция, которая получает параметры и возвращает HTML; действия — через data-act.
// Переключением и запуском боя управляет App (js/app.js).

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const starsHtml = (got, cls = '') =>
  `<span class="stars ${cls}">${got.map(g => `<span class="star${g ? ' on' : ''}">★</span>`).join('')}</span>`;

// Склонение: plural(3, 'корабль', 'корабля', 'кораблей')
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const flagMark = flag => flag === 'france' ? '<span class="flag fr" title="Франция"></span>' : '<span class="flag uk" title="Великобритания"></span>';

// Состав эскадры: исторические имена с флагом и типом; безымянные — «Учебный щит × 5»
function fleetHtml(level) {
  const named = level.fleet.filter(e => e.name);
  const count = {};
  for (const e of level.fleet) if (!e.name) count[e.type] = (count[e.type] || 0) + 1;
  const items = named.map(e => `<li>${flagMark(e.flag)}<b>${esc(e.name)}</b> <small>${esc(BASE_CFG.ships[e.type].name.toLowerCase())}${e.hpMul > 1 ? ', прочнее обычного' : ''}${e.speedMul > 1 ? ', быстрый' : ''}${e.leaveAt ? `, уйдёт через ${fmtTime(e.leaveAt)}` : ''}</small></li>`);
  for (const [t, n] of Object.entries(count)) items.push(`<li>${esc(BASE_CFG.ships[t].name)} × ${n}</li>`);
  return `<ul class="fleet">${items.join('')}</ul>`;
}

const fmtTime = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

function starConditions(level) {
  const S = level.stars, W = level.win;
  const list = [W.type === 'survive'
    ? `Победа: продержаться ${fmtTime(W.time)} до отхода эскадры`
    : level.fleet.every(e => e.type === 'target') ? 'Победа: потопить все щиты' : 'Победа: потопить все корабли'];
  list.push(`Крепость цела больше чем на ${Math.round(S.fortress * 100)}%`);
  list.push(isFinite(S.powder) ? `Потратить не больше ${S.powder} ${plural(S.powder, 'мешка', 'мешков', 'мешков')} пороха` : 'Без ограничения пороха');
  return list;
}

// Схема Авачинской губы у Петропавловска (условная, без масштаба): берег, полуостров
// Сигнальной и Никольской сопок, коса Кошка, портовый ковш, Култушное озеро и батареи.
function mapSvg(nextLevel) {
  const marks = Object.entries(Batteries).map(([key, b]) => {
    const levels = Levels.list.filter(l => l.battery === key);
    const open = levels.filter(l => Profile.isUnlocked(l));
    const done = levels.length && levels.every(l => Profile.levelRecord(l.id).won);
    const next = nextLevel && nextLevel.battery === key;
    const cls = next ? 'next' : done ? 'done' : open.length ? 'open' : 'locked';
    const nums = levels.map(l => l.n).join(' · ');
    const label = b.name.replace('Батарея ', '');
    const left = (b.map.side || (b.map.x < 300 ? 'left' : 'right')) === 'left';
    const lx = left ? -12 : 12, anchor = left ? 'end' : 'start';
    return `
      <g class="bat ${cls}">
        ${next ? `<circle class="pulse" cx="${b.map.x}" cy="${b.map.y}" r="13"/>` : ''}
        <circle cx="${b.map.x}" cy="${b.map.y}" r="7"/>
        <text x="${b.map.x + lx}" y="${b.map.y - 2}" text-anchor="${anchor}">${esc(label)}</text>
        <text class="nums" x="${b.map.x + lx}" y="${b.map.y + 13}" text-anchor="${anchor}">бои ${nums}</text>
      </g>`;
  }).join('');
  return `
    <svg class="map" viewBox="0 0 600 400" role="img" aria-label="Схема Авачинской губы и батарей Петропавловского порта">
      <rect class="sea" x="0" y="0" width="600" height="400"/>
      <path class="land" d="M120,0 L600,0 L600,400 L472,400 L458,340 L440,300 L420,280 L352,266 L340,257 L348,252 L416,262
        L434,226 L428,184 L402,152 L360,138 L326,152 L330,188 L338,226 L330,246 L318,254 L304,246 L286,224 L270,198
        L258,166 L236,132 L210,102 L186,76 L152,44 Z"/>
      <ellipse class="hill" cx="314" cy="222" rx="16" ry="20"/>
      <ellipse class="hill" cx="262" cy="152" rx="20" ry="28" transform="rotate(-35 262 152)"/>
      <ellipse class="lake" cx="318" cy="104" rx="38" ry="14" transform="rotate(-12 318 104)"/>
      <text class="geo" x="318" y="84" text-anchor="middle">Култушное оз.</text>
      <text class="geo" x="318" y="204" text-anchor="middle">Сигнальная</text>
      <text class="geo" x="244" y="146" text-anchor="end">Никольская</text>
      <text class="geo" x="382" y="196" text-anchor="middle">ковш</text>
      <text class="geo town" x="420" y="128" text-anchor="middle">Петропавловск</text>
      <g class="ship-own"><rect x="364" y="210" width="18" height="6" rx="2"/></g>
      <text class="geo" x="373" y="230" text-anchor="middle">«Аврора»</text>
      <text class="geo bay" x="40" y="290">Авачинская губа</text>
      <g class="squadron">
        <path d="M120,316 l22,0 l-4,6 l-14,0 z"/><path d="M152,334 l22,0 l-4,6 l-14,0 z"/>
        <path d="M104,344 l22,0 l-4,6 l-14,0 z"/><path d="M168,304 l18,0 l-3,5 l-12,0 z"/>
      </g>
      <text class="geo" x="140" y="372" text-anchor="middle">эскадра</text>
      ${marks}
      <text class="geo note" x="592" y="392" text-anchor="end">схема условная</text>
    </svg>`;
}

// Следующий бой, который стоит сыграть: первый открытый и ещё не выигранный
function nextToPlay() {
  return Levels.list.find(l => Profile.isUnlocked(l) && !Profile.levelRecord(l.id).won) || null;
}

const Screens = {
  menu() {
    const cont = Profile.hasProgress();
    return `
      <div class="panel menu">
        <h1>Петропавловск</h1>
        <p class="sub">Оборона порта · 1854</p>
        <div class="col">
          ${cont ? `<button class="primary" data-act="map">Продолжить</button>` : ''}
          <button class="${cont ? '' : 'primary'}" data-act="newCampaign">Новая кампания</button>
        </div>
        ${cont ? `<p class="note">Звёзд: ${Profile.totalStars()} из ${Levels.list.length * 3}${Profile.campaignDone() ? ' · кампания пройдена' : ''}</p>` : ''}
      </div>`;
  },

  confirmNew() {
    return `
      <div class="panel">
        <h2>Начать заново?</h2>
        <p>Звёзды и весь прогресс кампании будут стёрты.</p>
        <div class="row">
          <button class="danger" data-act="confirmNew">Стереть и начать</button>
          <button data-act="menu">Отмена</button>
        </div>
      </div>`;
  },

  // Карта кампании: схема губы с батареями и список боёв по главам
  map() {
    const next = nextToPlay();
    let html = '', chapter = null;
    for (const l of Levels.list) {
      if (l.chapter !== chapter) {
        if (chapter !== null) html += '</div>';
        chapter = l.chapter;
        const ch = Levels.chapters[chapter], missing = Profile.starsMissing(l);
        html += `<h3>Глава ${chapter} · ${esc(ch.title)}${missing ? ` <small class="gate">нужно ещё ${missing} ★</small>` : ''}</h3><div class="levels">`;
      }
      const open = Profile.isUnlocked(l), rec = Profile.levelRecord(l.id);
      html += `
        <button class="level${open ? '' : ' locked'}${next === l ? ' next' : ''}" ${open ? `data-act="briefing" data-id="${esc(l.id)}"` : 'disabled'}>
          <span class="num">${l.n}</span>
          <span class="info"><b>${esc(l.title)}</b><small>${esc(l.date || '')} · ${esc(Levels.batteryOf(l).name.replace('Батарея ', ''))}</small></span>
          ${open ? starsHtml(rec.stars) : '<span class="lock">закрыт</span>'}
        </button>`;
    }
    if (chapter !== null) html += '</div>';
    const done = Profile.campaignDone();
    return `
      <div class="panel campaign">
        <div class="head">
          <h2>Кампания</h2>
          <span class="total">${starsHtml([true], 'one')} ${Profile.totalStars()} из ${Levels.list.length * 3}</span>
        </div>
        ${done ? '<p class="win-note">Кампания пройдена: эскадра ушла из Авачинской губы. Бои можно переигрывать ради звёзд.</p>' : ''}
        <div class="campaign-body">
          <div class="map-wrap">${mapSvg(next)}</div>
          <div class="list">${html}</div>
        </div>
        <div class="row">
          ${next ? `<button class="primary" data-act="briefing" data-id="${esc(next.id)}">Бой ${next.n}: ${esc(next.title)}</button>` : ''}
          <button disabled title="Появится на этапе «Мастерская»">Мастерская</button>
          <button data-act="menu">В меню</button>
        </div>
      </div>`;
  },

  briefing({ level }) {
    const rec = Profile.levelRecord(level.id), bat = Levels.batteryOf(level);
    const cfg = Levels.buildConfig(level, Profile.data);
    const fog = cfg.weather.fog, PS = cfg.powderStore;
    const support = cfg.fortGuns.count;
    return `
      <div class="panel wide">
        <p class="sub">Глава ${level.chapter} · бой ${level.n} · ${esc(level.date || '')}</p>
        <h2>${esc(level.title)}</h2>
        ${level.history ? `<p class="history">${esc(level.history)}</p>` : ''}
        ${level.briefing ? `<p>${esc(level.briefing)}</p>` : ''}
        <dl>
          <dt>Батарея</dt><dd>${esc(bat.name)} — ${esc(bat.place)}. Командир — ${esc(bat.commander)}; ${esc(bat.guns)}</dd>
          <dt>Эскадра</dt><dd>${fleetHtml(level)}</dd>
          <dt>Поддержка</dt><dd>${support ? `${support} ${plural(support, 'пушка', 'пушки', 'пушек')} на крепости` : 'нет — стреляете только вы'}</dd>
          <dt>Порох</dt><dd>${PS.start} ${plural(PS.start, 'мешок', 'мешка', 'мешков')} на складе (вмещает ${PS.capacity}), подвоз — мешок за ${String(PS.resupplyEvery).replace('.', ',')} с</dd>
          ${fog ? `<dt>Погода</dt><dd>туман и волнение</dd>` : ''}
        </dl>
        <ul class="conds">${starConditions(level).map((c, i) => `<li>${starsHtml([rec.stars[i]], 'one')} ${c}</li>`).join('')}</ul>
        <div class="row">
          <button class="primary" data-act="start" data-id="${esc(level.id)}">В бой</button>
          <button data-act="map">На карту</button>
        </div>
      </div>`;
  },

  pause() {
    return `
      <div class="panel">
        <h2>Пауза</h2>
        <div class="col">
          <button class="primary" data-act="resume">Продолжить</button>
          <button data-act="restart">Начать бой заново</button>
          <button data-act="quit">Выйти на карту</button>
        </div>
        <p class="note">Esc — продолжить</p>
      </div>`;
  },

  // unlocked — бой, который открылся этой победой (или null); missing — сколько звёзд не хватает до главы
  results({ level, res, record, unlocked, finished }) {
    const next = Levels.next(level);
    const conds = starConditions(level);
    const missing = next && !unlocked && record.won ? Profile.starsMissing(next) : 0;
    let note = '';
    if (finished) note = '<p class="win-note">Кампания пройдена! Эскадра ушла из Авачинской губы, Петропавловск отстоял порт.</p>';
    else if (unlocked && unlocked.chapter !== level.chapter) note = `<p class="win-note">Открыта глава ${unlocked.chapter} · ${esc(Levels.chapters[unlocked.chapter].title)}</p>`;
    else if (missing) note = `<p class="gate-note">Для главы ${next.chapter} нужно ещё ${missing} ★ — переиграйте бои ради звёзд.</p>`;
    const canNext = res.win && next && Profile.isUnlocked(next);
    return `
      <div class="panel wide">
        <h2 class="${res.win ? 'win' : 'lose'}">${res.win ? 'Победа' : 'Поражение'}</h2>
        <p class="sub">${esc(level.title)} · ${esc(res.message)}</p>
        ${starsHtml(res.stars, 'big')}
        ${note}
        <ul class="conds">${conds.map((c, i) => `<li>${starsHtml([res.stars[i]], 'one')} ${c}</li>`).join('')}</ul>
        <dl>
          <dt>Потоплено</dt><dd>${res.sunk} из ${res.total}</dd>
          <dt>Крепость</dt><dd>${Math.round(res.integrity * 100)}%</dd>
          <dt>Порох</dt><dd>${res.powderSpent} ${plural(res.powderSpent, 'мешок', 'мешка', 'мешков')}</dd>
          <dt>Точность</dt><dd>${res.shots ? `${Math.round(res.accuracy * 100)}% (${res.hits} из ${res.shots})` : 'не стреляли'}</dd>
          <dt>Время</dt><dd>${fmtTime(res.time)}</dd>
        </dl>
        ${record.won ? `<p class="note">Звёзды за все попытки:${starsHtml(record.stars, 'one')}</p>` : ''}
        <div class="row">
          ${canNext ? `<button class="primary" data-act="briefing" data-id="${esc(next.id)}">Следующий бой</button>` : ''}
          <button class="${canNext ? '' : 'primary'}" data-act="start" data-id="${esc(level.id)}">Ещё раз</button>
          <button data-act="map">На карту</button>
        </div>
      </div>`;
  },
};
