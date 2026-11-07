// Бой 4 — бой на удержание: батарею исторически подавили, задача — продержаться.
Levels.add({
  id: 'signal-holds',
  n: 4,
  chapter: 3,
  battery: 'signal',
  title: 'Сигнальная под огнём',
  date: '20 августа (1 сентября) 1854 года',
  history: 'В первый штурм фрегаты President, Pique, Forte и пароход Virago обстреляли батареи № 1, 2 и 4. ' +
    'Сигнальную батарею лейтенанта Гаврилова подавили; к следующему штурму её орудия исправили.',
  briefing: 'Против одной батареи — три фрегата и пароход. Топить всех не обязательно: ' +
    'держитесь, пока эскадра не отойдёт, и не дайте разрушить кладку.',

  config: {
    powderStore: { start: 70 },
  },

  fleet: [
    { t: 1,  type: 'sloop',   stopX: 31, name: 'Virago' },
    { t: 6,  type: 'frigate', stopX: 28, name: 'President', hpMul: 1.2 },
    { t: 14, type: 'frigate', stopX: 34, name: 'Forte', flag: 'france', hpMul: 1.2 },
    { t: 24, type: 'frigate', stopX: 38, name: 'Pique' },
  ],

  win: { type: 'survive', time: 150 },
  stars: { fortress: 0.75, powder: 90 },
});
