// Бой 10 — плотный огонь по крепости: главные силы второго штурма.
Levels.add({
  id: 'battery-7',
  n: 10,
  chapter: 4,
  battery: 'nikolsk',
  title: 'У Никольской сопки',
  date: '24 августа (5 сентября) 1854 года',
  history: 'Главный удар второго штурма — President, Forte и Virago — пришёлся на батареи № 3 и 7. ' +
    'Батарею № 7 капитан-лейтенанта Коралова подавили, у неё высадились около 700 человек.',
  briefing: 'Фрегаты стреляют чаще обычного. Не затягивайте бой: ' +
    'чем дольше корабли целы, тем меньше остаётся от батареи.',

  config: {
    powderStore: { start: 80, capacity: 90, resupplyEvery: 5 },
    ships: {
      frigate: { fireDelay: [3.6, 5.0] },
      sloop: { fireDelay: [3.4, 4.8] },
    },
  },

  fleet: [
    { t: 1,  type: 'sloop',   stopX: 31, name: 'Virago' },
    { t: 8,  type: 'frigate', stopX: 27, name: 'President', hpMul: 1.2 },
    { t: 24, type: 'frigate', stopX: 34, name: 'Forte', flag: 'france', hpMul: 1.2 },
  ],

  win: 'sinkAll',
  stars: { fortress: 0.75, powder: 100 },
});
