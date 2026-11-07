// Бой 11 — финал: вся эскадра против «Смертельной» батареи.
Levels.add({
  id: 'deadly-battery',
  n: 11,
  chapter: 4,
  battery: 'isthmus',
  title: '«Смертельная» батарея',
  date: '24 августа (5 сентября) 1854 года',
  history: 'Батарея № 3 лейтенанта Александра Максутова почти без бруствера стояла против President и Forte, ' +
    'к которым подошли Pique и Eurydice. За потери её прозвали «Смертельной»; Максутов был смертельно ранен. ' +
    'Высадку отбили, и через три дня эскадра ушла из губы.',
  briefing: 'Последний бой. Флагман President прочнее остальных. Кладка низкая — берегите её, ' +
    'выбивайте пушки и топите корабли по одному.',

  config: {
    powderStore: { start: 90 },
  },

  fleet: [
    { t: 1,  type: 'steamer', stopX: 32, name: 'Virago' },
    { t: 6,  type: 'frigate', stopX: 28, name: 'President', hpMul: 1.5 },
    { t: 20, type: 'frigate', stopX: 34, name: 'Forte', flag: 'france', hpMul: 1.2 },
    { t: 40, type: 'sloop',   stopX: 37, name: 'Obligado', flag: 'france' },
    { t: 56, type: 'frigate', stopX: 31, name: 'Pique' },
    { t: 72, type: 'sloop',   stopX: 36, name: 'Eurydice', flag: 'france', hpMul: 1.3 },
  ],

  win: 'sinkAll',
  stars: { fortress: 0.75, powder: 160 },
});
