// Бой 8 — второй штурм: отвлекающий удар по Сигнальной, корабли стоят дальше.
Levels.add({
  id: 'second-feint',
  n: 8,
  chapter: 4,
  battery: 'signal',
  title: 'Ложная атака',
  date: '24 августа (5 сентября) 1854 года',
  history: 'Во второй штурм Pique, Eurydice и Obligado снова атаковали батареи № 1 и 4, чтобы отвлечь ' +
    'защитников. Орудия этих батарей мастеровые порта к тому времени полностью исправили.',
  briefing: 'Корабли держатся на большой дистанции. Дальний выстрел требует полного заряда — ' +
    'рассчитывайте порох.',

  config: {
    powderStore: { start: 70 },
  },

  fleet: [
    { t: 1,  type: 'sloop',   stopX: 37, name: 'Obligado', flag: 'france' },
    { t: 10, type: 'frigate', stopX: 34, name: 'Pique' },
    { t: 26, type: 'sloop',   stopX: 39, name: 'Eurydice', flag: 'france', hpMul: 1.3 },
  ],

  win: 'sinkAll',
  stars: { fortress: 0.75, powder: 90 },
});
