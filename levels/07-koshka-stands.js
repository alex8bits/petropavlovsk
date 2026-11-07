// Бой 7 — вся эскадра против главной батареи.
Levels.add({
  id: 'koshka-stands',
  n: 7,
  chapter: 3,
  battery: 'koshka',
  title: 'Кошечная стоит',
  date: '20 августа (1 сентября) 1854 года',
  history: 'Батарея № 2 лейтенанта Дмитрия Максутова — десять 36-фунтовых пушек на косе — ' +
    'весь первый штурм держалась под огнём эскадры и не была разрушена.',
  briefing: 'Против вас все шесть кораблей эскадры. Пороха больше обычного, но и целей много: ' +
    'выбивайте пушки ближних кораблей, пока они не разобрали кладку.',

  config: {
    powderStore: { start: 90 },
    // Шесть кораблей без пушек поддержки (нулевая прокачка) разбирают кладку слишком быстро:
    // эскадра стреляет реже обычного
    ships: {
      frigate: { fireDelay: [5.8, 8.0] },
      sloop: { fireDelay: [5.2, 7.4] },
    },
  },

  fleet: [
    { t: 1,  type: 'steamer', stopX: 32, name: 'Virago' },
    { t: 8,  type: 'frigate', stopX: 27, name: 'President' },
    { t: 26, type: 'sloop',   stopX: 37, name: 'Obligado', flag: 'france' },
    { t: 46, type: 'frigate', stopX: 30, name: 'Forte', flag: 'france' },
    { t: 68, type: 'sloop',   stopX: 35, name: 'Eurydice', flag: 'france' },
    { t: 88, type: 'frigate', stopX: 33, name: 'Pique' },
  ],

  win: 'sinkAll',
  stars: { fortress: 0.75, powder: 150 },
});
