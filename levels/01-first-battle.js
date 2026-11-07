// Бой 1 — бой прототипа, перенесённый из config.js без изменений баланса.
// На этапе «Кампания» его заменят исторические бои.
Levels.add({
  id: 'first-battle',
  n: 1,
  chapter: 1,
  chapterTitle: 'Подготовка',
  title: 'Первый бой',
  date: 'Лето 1854 года',
  battery: 'Береговая батарея',
  briefing: 'К Петропавловскому порту подходят британские корабли: сначала шлюпы, за ними фрегаты. ' +
    'Пушка батареи и две пушки на стене должны отбить их, пока кладка крепости держится.',

  config: {
    powderStore: { start: 80, capacity: 80, resupplyEvery: 5 },
  },

  fleet: [
    { t: 1,  type: 'sloop',   stopX: 30 },
    { t: 16, type: 'sloop',   stopX: 35 },
    { t: 32, type: 'frigate', stopX: 27 },
    { t: 50, type: 'sloop',   stopX: 38 },
    { t: 62, type: 'frigate', stopX: 33 },
  ],

  win: 'sinkAll',
  // Бот с наименьшим достаточным зарядом тратит 96–103 мешка; человеку — запас на промахи
  stars: { fortress: 0.75, powder: 120 },
});
