// Бой 5 — мало пороха: обрыв Красного Яра, тяжёлое ядро и экономный заряд.
Levels.add({
  id: 'krasny-yar',
  n: 5,
  chapter: 3,
  battery: 'cemetery',
  title: 'Обрыв Красного Яра',
  date: '20 августа (1 сентября) 1854 года',
  history: 'Кладбищенскую батарею мичмана Попова — три 24-фунтовые пушки — подавили в первый штурм. ' +
    'У неё высадились около 600 французов, но отошли к шлюпкам, не приняв штыкового боя.',
  briefing: 'Батарея стоит высоко: ядро летит сверху вниз, и далеко бить можно малым зарядом. ' +
    'Пороха на складе мало, подвоз медленный. Тяжёлое ядро (Q) бьёт сильнее, но заряжается дольше.',

  config: {
    powderStore: { start: 55, capacity: 60, resupplyEvery: 5.5 },
  },

  fleet: [
    { t: 1,  type: 'sloop',   stopX: 30, name: 'Virago' },
    { t: 12, type: 'frigate', stopX: 27, name: 'President' },
    { t: 30, type: 'frigate', stopX: 33, name: 'Forte', flag: 'france' },
    { t: 48, type: 'frigate', stopX: 36, name: 'Pique' },
  ],

  win: 'sinkAll',
  stars: { fortress: 0.75, powder: 80 },
});
