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
    'Пороха на складе мало. На батарею выдали девять тяжёлых ядер (Q): они бьют сильнее, но заряжаются дольше. ' +
    'Ещё тяжёлых можно купить в мастерской.',

  config: {
    powderStore: { start: 55 },
    ammo: { heavy: 9 },
  },

  fleet: [
    { t: 1,  type: 'steamer', stopX: 30, name: 'Virago' },
    { t: 12, type: 'frigate', stopX: 27, name: 'President' },
    { t: 36, type: 'frigate', stopX: 33, name: 'Forte', flag: 'france' },
    { t: 60, type: 'frigate', stopX: 36, name: 'Pique' },
  ],

  tutorial: [
    { focus: 'ball', when: g => g.ballTypes().length > 1,
      text: 'Q или кнопка ядра — сменить ядро. Тяжёлое бьёт сильнее и ложится точнее, но летит медленнее и заряжается дольше.',
      done: (g, s) => g.cannon.ballType !== s.ballType, after: 15 },
    { when: Tutorial.shipInView, text: 'Батарея стоит высоко: ядро падает сверху, и далеко бьёт даже малый заряд — берегите порох.', after: 8 },
  ],

  win: 'sinkAll',
  stars: { fortress: 0.75, powder: 95 },
});
