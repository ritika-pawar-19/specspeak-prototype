/* SpecSpeak prototype content — Unit 1 "The basics" is fully playable.
   Product facts come from the Acer Nitro 5 training module (spec card) only. */
(function () {
  var W = [
    { slug: 'acer', word: 'Acer', say: 'AY-ser', hi: 'एसर', syl: ['AY', 'ser'], buddy: 'bolo_wave',
      mean: 'Our brand. The first word every APC says.', accept: ['acer', 'acers', 'acer s', 'aser'] },
    { slug: 'aspire', word: 'Aspire', say: 'uh-SPY-er', hi: 'अस्पायर', syl: ['uh', 'SPY', 'er'], buddy: 'pixi',
      mean: "Acer's everyday laptop range.", accept: ['aspire', 'aspires', 'aspired', 'acer aspire'] },
    { slug: 'processor', word: 'Processor', say: 'PRO-ses-er', hi: 'प्रोसेसर', syl: ['PRO', 'ses', 'er'], buddy: 'chip',
      mean: 'The brain of the laptop. It decides how fast everything runs.', accept: ['processor', 'processors', 'processer'] },
    { slug: 'generation', word: 'Generation', say: 'jen-uh-RAY-shun', hi: 'जनरेशन', syl: ['jen', 'uh', 'RAY', 'shun'], buddy: 'chip',
      mean: '“14th Gen” tells you how new the processor is. Newer is faster.', accept: ['generation', 'generations'] },
    { slug: 'ram', word: 'RAM', say: 'ram', hi: 'रैम', syl: ['ram'], buddy: 'rami',
      mean: 'Short-term memory. More RAM keeps more apps open at once.', tip: 'Say it as one word, not R-A-M.',
      accept: ['ram', 'rams', 'ram s'] },
    { slug: 'gigabyte', word: 'Gigabyte', say: 'GIG-uh-byte', hi: 'गिगाबाइट', syl: ['GIG', 'uh', 'byte'], buddy: 'rami',
      mean: 'How RAM and storage are measured. Written GB.', tip: 'Hard G, as in “give”.',
      accept: ['gigabyte', 'gigabytes', 'giga byte', 'giga bytes'] },
    { slug: 'ssd', word: 'SSD', say: 'es-es-DEE', hi: 'एसएसडी', syl: ['es', 'es', 'DEE'], buddy: 'rami',
      mean: 'Fast storage. The laptop starts in seconds.', accept: ['ssd', 's s d', 'ssds'] },
    { slug: 'storage', word: 'Storage', say: 'STOR-ij', hi: 'स्टोरिज', syl: ['STOR', 'ij'], buddy: 'rami',
      mean: 'Space for files, photos and games.', tip: 'It ends in “ij”, not “age”.', accept: ['storage', 'storages'] },
    { slug: 'display', word: 'Display', say: 'dis-PLAY', hi: 'डिस्प्ले', syl: ['dis', 'PLAY'], buddy: 'pixi',
      mean: 'The screen. Its size is measured corner to corner.', accept: ['display', 'displays'] },
    { slug: 'warranty', word: 'Warranty', say: 'WOR-un-tee', hi: 'वॉरंटी', syl: ['WOR', 'un', 'tee'], buddy: 'bolo',
      mean: "Acer's promise to fix manufacturing faults for a set period.", accept: ['warranty', 'warranties', 'warrantee'] }
  ];
  var BY = {}; W.forEach(function (w) { BY[w.slug] = w; });

  /* Level 1 — TrainGram cards (15-20 words, story arc, no mascot on cards) */
  var CARDS = [
    { eb: 'THE BASICS', big: 'AY-ser', icon: 'mic', line: 'It starts with our name. Say <mark>Acer</mark> right, and every spec after it sounds sure.' },
    { eb: 'THE BRAIN', big: 'Processor', icon: 'chip', chip: 'PRO-ses-er', line: 'The processor decides how fast every app <mark>opens and runs</mark>. It is the laptop’s brain.' },
    { eb: 'HOW NEW', big: '14th Gen', icon: 'chip', line: 'A bigger generation number means a <mark>newer, faster</mark> processor. Point to it on the spec card.' },
    { eb: 'SHORT-TERM MEMORY', big: 'RAM', icon: 'ram', chips: ['8 GB', '16 GB', '32 GB'], line: 'More RAM keeps <mark>more apps open</mark> at once, so switching between them stays smooth for the customer.' },
    { eb: 'SAY IT RIGHT', big: 'GB', icon: 'ram', chip: 'GIG-uh-byte', line: 'Gigabytes measure both RAM and storage. Say it with a <mark>hard G</mark>, as in “give”.' },
    { eb: 'SPEED', big: 'Seconds', icon: 'bolt', line: 'An SSD is fast storage. The laptop <mark>wakes up in seconds</mark> and files open instantly.' },
    { eb: 'SPACE', big: '512 GB → 2 TB', icon: 'box', line: 'Storage is space for files, photos and games. <mark>Ask customers</mark> what they plan to keep.' },
    { eb: 'THE SCREEN', big: '16″', icon: 'screen', line: 'Screen size is measured <mark>corner to corner</mark>. Let customers feel the size, then name it.' },
    { eb: 'PEACE OF MIND', big: 'Warranty', icon: 'shield', chip: 'WOR-un-tee', line: 'Warranty is Acer’s promise to fix manufacturing faults for a set period. It makes a big purchase <mark>feel safe</mark>.' },
    { eb: 'WHAT TO REMEMBER', recap: [['Processor', 'the brain'], ['Gen', 'how new'], ['RAM', 'apps at once'], ['SSD', 'speed'], ['Storage', 'space'], ['Display', 'corner to corner'], ['Warranty', 'peace of mind']] }
  ];

  /* Level 2 — video. Quiz at the end of the "ram" and "warranty" scenes (video-src/timeline.json end); replay from vo_start, when the slide is fully on. */
  var VIDEO = {
    src: 'assets/video/unit1-basics.mp4', poster: 'assets/video/unit1-poster.jpg',
    quizzes: [
      { at: 34.78, replayFrom: 26.87, q: 'More RAM lets you…', opts: ['Keep more apps open at once', 'Charge the battery faster'], a: 0 },
      { at: 57.71, replayFrom: 50.4, q: 'What does a warranty mean?', opts: ['Acer fixes manufacturing faults for a set period', 'A faster processor'], a: 0 }
    ]
  };

  /* Nitro 5 store spec card — values from the Nitro 5 training module */
  var SPEC = {
    title: 'Acer Nitro 5', sub: 'AN516-74G1 · sample spec card',
    rows: [
      { id: 'processor', k: 'Processor', v: 'Intel Core i5-14450HX' },
      { id: 'generation', k: 'Generation', v: '14th Gen Intel' },
      { id: 'graphics', k: 'Graphics', v: 'NVIDIA RTX 5050 8GB' },
      { id: 'ram', k: 'RAM', v: 'Up to 32 GB' },
      { id: 'storage', k: 'Storage', v: '512 GB SSD' },
      { id: 'display', k: 'Display', v: '16″ FHD+ 165Hz' }
    ]
  };

  var HEAR = {
    acer: ['Acer', 'Racer', 'Aster', 'Ace'],
    processor: ['Processor', 'Professor', 'Producer', 'Protector'],
    gigabyte: ['Gigabyte', 'Gigahertz', 'Megabyte', 'Gigabit'],
    warranty: ['Warranty', 'Warrant', 'Variety', 'Guarantee'],
    aspire: ['Aspire', 'Inspire', 'Expire', 'Aspen'],
    generation: ['Generation', 'Generator', 'Operation', 'Celebration'],
    ram: ['RAM', 'Rum', 'Rim', 'Ran'],
    ssd: ['SSD', 'HDD', 'USB', 'CPU'],
    storage: ['Storage', 'Shortage', 'Stoppage', 'Story'],
    display: ['Display', 'Displace', 'Dismay', 'Replay']
  };
  function hear(slug) { return { t: 'hear', slug: slug, opts: HEAR[slug] }; }
  function meet(slug) { return { t: 'meet', slug: slug }; }

  var LESSONS = {
    meet: { title: 'Meet the words', items: [
      meet('acer'), meet('aspire'), hear('acer'), meet('processor'), meet('generation'), hear('processor'),
      meet('ram'), meet('gigabyte'), hear('gigabyte'), meet('ssd'), meet('storage'), meet('display'), meet('warranty'), hear('warranty')] },
    match: { title: 'Match & listen', items: [
      { t: 'match', pairs: [['RAM', 'Apps open at once', 'ram'], ['SSD', 'Starts in seconds', 'ssd'], ['Processor', 'The brain', 'processor'], ['Display', 'The screen', 'display'], ['Warranty', 'Repair promise', 'warranty']] },
      hear('aspire'), hear('ram'),
      { t: 'spot', q: 'Tap the processor.', a: 'processor', slug: 'processor' },
      hear('generation'),
      { t: 'spot', q: 'Which line tells you how many apps it can keep open?', a: 'ram', slug: 'ram' },
      { t: 'match', pairs: [['Generation', 'How new it is', 'generation'], ['Gigabyte', 'Unit for memory', 'gigabyte'], ['Storage', 'Space for files', 'storage'], ['Aspire', 'Everyday range', 'aspire'], ['Acer', 'Our brand', 'acer']] },
      hear('ssd'),
      { t: 'spot', q: 'Tap the line that shows where files are kept.', a: 'storage', slug: 'storage' },
      hear('storage'), hear('display'),
      { t: 'spot', q: 'Which line gives the screen size?', a: 'display', slug: 'display' }] },
    use: { title: 'Use it', items: [
      { t: 'fill', pre: 'The', post: 'is the brain of the laptop.', a: 'processor', bank: ['processor', 'display', 'warranty', 'storage'], slug: 'processor' },
      { t: 'cust', said: 'I keep 30 Chrome tabs open for work.', a: 'RAM', opts: ['RAM', 'Display', 'Warranty'], why: 'More RAM keeps 30 tabs running smoothly.', slug: 'ram' },
      { t: 'fill', pre: 'It has a 14th', post: 'Intel processor, so it’s newer and faster.', a: 'generation', bank: ['generation', 'gigabyte', 'storage', 'display'], slug: 'generation' },
      { t: 'cust', said: 'I have thousands of photos and movies.', a: 'Storage', opts: ['Storage', 'Processor', 'Generation'], why: 'More storage means room for all of them.', slug: 'storage' },
      { t: 'fill', pre: 'With 16', post: 'of RAM, all your apps stay open.', a: 'gigabytes', bank: ['gigabytes', 'generations', 'displays', 'warranties'], slug: 'gigabyte' },
      { t: 'cust', said: 'My old laptop takes ages to start.', a: 'SSD', opts: ['SSD', 'Display', 'Warranty'], why: 'An SSD starts the laptop in seconds.', slug: 'ssd' },
      { t: 'fill', pre: 'The', post: 'wakes the laptop up in seconds.', a: 'SSD', bank: ['SSD', 'display', 'warranty', 'Acer'], slug: 'ssd' },
      { t: 'cust', said: 'What happens if it stops working next month?', a: 'Warranty', opts: ['Warranty', 'RAM', 'Storage'], why: 'The warranty covers manufacturing faults, so the purchase is protected.', slug: 'warranty' },
      { t: 'fill', pre: 'Measured corner to corner, this', post: 'is 16 inches.', a: 'display', bank: ['display', 'processor', 'SSD', 'warranty'], slug: 'display' },
      { t: 'cust', said: 'Is this processor the latest one?', a: 'Generation', opts: ['Generation', 'Gigabyte', 'Display'], why: 'Check the Gen number: a higher generation is newer.', slug: 'generation' },
      { t: 'fill', pre: 'Acer’s', post: 'covers manufacturing faults for a set period.', a: 'warranty', bank: ['warranty', 'storage', 'RAM', 'display'], slug: 'warranty' },
      { t: 'cust', said: 'I watch movies on my laptop every night.', a: 'Display', opts: ['Display', 'SSD', 'Generation'], why: 'A big, sharp display makes every movie better.', slug: 'display' }] },
    say: { title: 'Say it checkpoint', items: W.map(function (w) { return { t: 'say', slug: w.slug }; }) }
  };

  var UNITS = [
    { n: 1, name: 'The basics', sub: 'Spec words every APC needs', color: 'lime', open: true },
    { n: 2, name: 'Swift', sub: 'Thin and light', color: 'peri' },
    { n: 3, name: 'Nitro 5', sub: 'Gaming starts here', color: 'gold' },
    { n: 4, name: 'Predator', sub: 'Premium gaming', color: 'mint' }
  ];

  /* Sample league — invented rows so the screen has something to show */
  var LEAGUE = [
    { who: 'Priya S.', store: 'Store 14', xp: 410 }, { who: 'Arjun M.', store: 'Store 03', xp: 365 },
    { who: 'Neha K.', store: 'Store 22', xp: 290 }, { who: 'Rahul D.', store: 'Store 09', xp: 210 },
    { who: 'Sana A.', store: 'Store 17', xp: 145 }, { who: 'Vikram P.', store: 'Store 05', xp: 90 }
  ];

  window.SS = { WORDS: W, BY: BY, CARDS: CARDS, VIDEO: VIDEO, SPEC: SPEC, LESSONS: LESSONS, UNITS: UNITS, LEAGUE: LEAGUE };
})();
