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

// Состав эскадры: «Шлюп × 3, Фрегат × 2»
function fleetSummary(level) {
  const count = {};
  for (const e of level.fleet) count[e.type] = (count[e.type] || 0) + 1;
  return Object.entries(count).map(([t, n]) => `${esc(BASE_CFG.ships[t].name)} × ${n}`).join(', ');
}

function starConditions(level) {
  const S = level.stars;
  const list = ['Победа: потопить все корабли', `Крепость цела больше чем на ${Math.round(S.fortress * 100)}%`];
  list.push(isFinite(S.powder) ? `Потратить не больше ${S.powder} ${plural(S.powder, 'мешка', 'мешков', 'мешков')} пороха` : 'Без ограничения пороха');
  return list;
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
        ${cont ? `<p class="note">Звёзд: ${Profile.totalStars()} из ${Levels.list.length * 3}</p>` : ''}
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

  // Карта кампании. Пока — список боёв по главам; схема Авачинской губы появится на этапе «Кампания».
  map() {
    let html = '', chapter = null;
    for (const l of Levels.list) {
      if (l.chapter !== chapter) {
        if (chapter !== null) html += '</div>';
        chapter = l.chapter;
        const title = Levels.list.find(x => x.chapter === chapter && x.chapterTitle)?.chapterTitle;
        html += `<h3>Глава ${chapter}${title ? ` · ${esc(title)}` : ''}</h3><div class="levels">`;
      }
      const open = Profile.isUnlocked(l), rec = Profile.levelRecord(l.id);
      html += `
        <button class="level${open ? '' : ' locked'}" ${open ? `data-act="briefing" data-id="${esc(l.id)}"` : 'disabled'}>
          <span class="num">${l.n}</span>
          <span class="info"><b>${esc(l.title)}</b><small>${esc(l.date || '')}${l.battery ? ' · ' + esc(l.battery) : ''}</small></span>
          ${open ? starsHtml(rec.stars) : '<span class="lock">закрыт</span>'}
        </button>`;
    }
    if (chapter !== null) html += '</div>';
    return `
      <div class="panel wide">
        <h2>Кампания</h2>
        ${html}
        <div class="row">
          <button disabled title="Появится на этапе «Мастерская»">Мастерская</button>
          <button data-act="menu">В меню</button>
        </div>
      </div>`;
  },

  briefing({ level }) {
    const rec = Profile.levelRecord(level.id);
    return `
      <div class="panel wide">
        <p class="sub">Бой ${level.n} · ${esc(level.date || '')}</p>
        <h2>${esc(level.title)}</h2>
        ${level.battery ? `<p class="battery">${esc(level.battery)}</p>` : ''}
        ${level.briefing ? `<p>${esc(level.briefing)}</p>` : ''}
        <dl>
          <dt>Эскадра</dt><dd>${fleetSummary(level)}</dd>
          <dt>Порох</dt><dd>${Levels.buildConfig(level, Profile.data).powderStore.start} мешков на складе</dd>
        </dl>
        <ul class="conds">${starConditions(level).map((c, i) => `<li>${starsHtml([rec.stars[i]], 'one')} ${c}</li>`).join('')}</ul>
        <div class="row">
          <button class="primary" data-act="start" data-id="${esc(level.id)}">В бой</button>
          <button data-act="map">Назад</button>
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

  results({ level, res, record }) {
    const next = Levels.next(level);
    const conds = starConditions(level);
    return `
      <div class="panel wide">
        <h2 class="${res.win ? 'win' : 'lose'}">${res.win ? 'Победа' : 'Поражение'}</h2>
        <p class="sub">${esc(level.title)} · ${esc(res.message)}</p>
        ${starsHtml(res.stars, 'big')}
        <ul class="conds">${conds.map((c, i) => `<li>${starsHtml([res.stars[i]], 'one')} ${c}</li>`).join('')}</ul>
        <dl>
          <dt>Потоплено</dt><dd>${res.sunk} из ${res.total}</dd>
          <dt>Крепость</dt><dd>${Math.round(res.integrity * 100)}%</dd>
          <dt>Порох</dt><dd>${res.powderSpent} ${plural(res.powderSpent, 'мешок', 'мешка', 'мешков')}</dd>
          <dt>Точность</dt><dd>${res.shots ? `${Math.round(res.accuracy * 100)}% (${res.hits} из ${res.shots})` : 'не стреляли'}</dd>
          <dt>Время</dt><dd>${Math.floor(res.time / 60)}:${String(Math.floor(res.time % 60)).padStart(2, '0')}</dd>
        </dl>
        ${record.won ? `<p class="note">Звёзды за все попытки:${starsHtml(record.stars, 'one')}</p>` : ''}
        <div class="row">
          ${res.win && next ? `<button class="primary" data-act="briefing" data-id="${esc(next.id)}">Следующий бой</button>` : ''}
          <button class="${res.win && next ? '' : 'primary'}" data-act="start" data-id="${esc(level.id)}">Ещё раз</button>
          <button data-act="map">На карту</button>
        </div>
      </div>`;
  },
};
