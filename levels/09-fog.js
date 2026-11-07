// Бой 9 — туман и волнение у Красного Яра.
Levels.add({
  id: 'fog-krasny-yar',
  n: 9,
  chapter: 4,
  battery: 'cemetery',
  title: 'Туман над губой',
  date: '24 августа (5 сентября) 1854 года',
  history: 'Отвлекающий отряд обстреливал и Кладбищенскую батарею. Её исправленные пушки ' +
    'снова отвечали с обрыва Красного Яра.',
  briefing: 'Над водой туман: дальние корабли видно плохо. Волна раскачивает их сильнее — ' +
    'ловите момент, когда корабль на гребне.',

  config: {
    powderStore: { start: 55 },
    weather: { fog: 0.8 },
    water: { waves: [[0.45, 11, 1.8], [0.2, 5.3, -1.3], [0.08, 2.1, 2.5]] },
  },

  fleet: [
    { t: 1,  type: 'sloop',   stopX: 33, name: 'Obligado', flag: 'france' },
    { t: 14, type: 'frigate', stopX: 30, name: 'Pique' },
    { t: 34, type: 'sloop',   stopX: 36, name: 'Eurydice', flag: 'france', hpMul: 1.3 },
  ],

  win: 'sinkAll',
  stars: { fortress: 0.75, powder: 80 },
});
