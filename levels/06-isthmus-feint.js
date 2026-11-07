// Бой 6 — французские корабли; низкий бруствер Перешеечной батареи.
Levels.add({
  id: 'isthmus-feint',
  n: 6,
  chapter: 3,
  battery: 'isthmus',
  title: 'Отвлекающий огонь',
  date: '20 августа (1 сентября) 1854 года',
  history: 'Пока главные силы били по батареям № 1, 2 и 4, французские корвет Eurydice и бриг Obligado ' +
    'обстреливали Перешеечную батарею, а через Никольскую сопку — «Аврору» и «Двину».',
  briefing: 'Бруствер у батареи низкий, башни нет — кладка рушится быстрее. Французы держатся далеко ' +
    'и подходят вторым заходом. Не тратьте порох на дальние промахи.',

  config: {
    powderStore: { start: 60 },
  },

  fleet: [
    { t: 1,  type: 'sloop', stopX: 34, name: 'Eurydice', flag: 'france', hpMul: 1.3 },
    { t: 10, type: 'sloop', stopX: 38, name: 'Obligado', flag: 'france' },
  ],

  win: 'sinkAll',
  stars: { fortress: 0.75, powder: 60 },
});
