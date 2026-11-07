// Бой 3 — несколько кораблей сразу; впервые помогают пушки поддержки на крепости.
Levels.add({
  id: 'squadron-enters',
  n: 3,
  chapter: 2,
  battery: 'koshka',
  title: 'Эскадра входит в губу',
  date: '18 (30) августа 1854 года',
  history: 'Англо-французская эскадра контр-адмиралов Прайса и Феврье-Депуанта вошла в Авачинскую губу, ' +
    'обменялась выстрелами с батареями и стала на якорь вне досягаемости русских пушек.',
  briefing: 'Корабли входят один за другим. Кошечная батарея — главная: стена широкая, на ней две пушки поддержки. ' +
    'Они бьют сами по ближайшему кораблю, вы выбираете цель.',

  config: {
    powderStore: { start: 80, capacity: 80, resupplyEvery: 5 },
  },

  fleet: [
    { t: 1,  type: 'sloop',   stopX: 30, name: 'Virago' },
    { t: 16, type: 'sloop',   stopX: 35, name: 'Obligado', flag: 'france' },
    { t: 32, type: 'frigate', stopX: 27, name: 'Pique' },
    { t: 50, type: 'sloop',   stopX: 38, name: 'Eurydice', flag: 'france', hpMul: 1.2 },
  ],

  win: 'sinkAll',
  // Бот тратит 92–97 мешков
  stars: { fortress: 0.75, powder: 110 },
});
