/* Play & Learn content bank — Unit 1 only, vetted.
   Facts come ONLY from data.js (word meanings, say-guides, Hindi) and the Nitro 5 values below. Nothing else.
   Every single-answer item has exactly one defensible answer among its options:
     - the decoys are hand-picked, and
     - CONFUSE lists the words that must never sit next to a word as a decoy (the banned pairs: RAM-Processor for
       "many apps", SSD-Storage for "space", Processor-Generation for "new/fast", SSD/Storage/RAM among each other
       when the need is speed vs space, Acer-Aspire brand vs range, Gigabyte with RAM/Storage it measures).
   Use ARC.bank.ok(right, [decoys]) to check any new combination.

   ARC.bank = {
     WORDS     the 10 Unit 1 slugs (same order as data.js)
     MEAN      slug -> short meaning (mushrooms, invaders, Spec Stack wave 1)
     DECOY     slug -> 2 safe decoy slugs (used both ways: word -> meanings, meaning -> words)
     NEEDS     slug -> 3 customer needs [{text, decoys:[slug, slug]}] (no need contains its answer word)
     NITRO     Nitro 5 spec values [{v, bin, fix}] (the only spec values allowed in Unit 1)
     SYLL      sound coins for Lag King {parts, slip, note}
     TIPS      slug -> short Say-it tip (the lime pill)
     SAYALT    slug -> 2 WRONG say-guides for the tap check (written only, never played)
     CONFUSE   slug -> slugs that must never be its decoys
     word(slug)   data.js word object {slug, word, say, hi, mean, accept, syl, ...}
     label(slug)  the word as written ("SSD", "Storage")
     ok(right, decoys) -> true when none of the decoys is banned next to right
     fix(slug)    one-line "right answer" text for meanings, e.g. "SSD: Starts in seconds"
     hear(slug)   data.js sound-alike set (first = right)
   } */
(function () {
  'use strict';
  var SS = window.SS || { WORDS: [], BY: {} };
  var WORDS = ['acer', 'aspire', 'processor', 'generation', 'ram', 'gigabyte', 'ssd', 'storage', 'display', 'warranty'];

  var MEAN = {
    ram: 'Apps open at once', ssd: 'Starts in seconds', storage: 'Space for files', display: 'The screen',
    warranty: 'Fixes faults', processor: 'The brain', generation: 'How new the chip is',
    gigabyte: 'How memory is measured', acer: 'Our brand', aspire: 'Everyday laptop range'
  };

  var CONFUSE = {
    ram: ['processor', 'ssd', 'storage', 'gigabyte', 'generation'],
    ssd: ['storage', 'ram', 'processor', 'gigabyte'],
    storage: ['ssd', 'ram', 'gigabyte'],
    processor: ['generation', 'ram', 'ssd'],
    generation: ['processor'],
    gigabyte: ['ram', 'storage', 'ssd'],
    acer: ['aspire'],
    aspire: ['acer'],
    display: [],
    warranty: []
  };

  var DECOY = {
    acer: ['display', 'gigabyte'],
    aspire: ['processor', 'warranty'],
    processor: ['display', 'warranty'],
    generation: ['gigabyte', 'display'],
    ram: ['display', 'warranty'],
    gigabyte: ['warranty', 'display'],
    ssd: ['display', 'warranty'],
    storage: ['processor', 'generation'],
    display: ['ssd', 'warranty'],
    warranty: ['ram', 'storage']
  };

  /* reworded customer needs, built only from the data.js meaning lines */
  var NEEDS = {
    ram: [
      { text: 'I keep lots of apps open at once.', decoys: ['display', 'warranty'] },
      { text: 'I switch between many apps all day.', decoys: ['display', 'acer'] },
      { text: 'I run video calls and spreadsheets together.', decoys: ['warranty', 'display'] }],
    ssd: [
      { text: 'My old laptop takes ages to start.', decoys: ['display', 'warranty'] },
      { text: 'I want it to wake up in seconds.', decoys: ['display', 'warranty'] },
      { text: 'I hate waiting for files to open.', decoys: ['display', 'acer'] }],
    storage: [
      { text: 'I have thousands of photos and movies.', decoys: ['processor', 'generation'] },
      { text: 'I need room for all my games.', decoys: ['display', 'warranty'] },
      { text: 'I keep running out of space for my files.', decoys: ['processor', 'display'] }],
    display: [
      { text: 'I watch movies on my laptop every night.', decoys: ['ssd', 'warranty'] },
      { text: 'I want a big screen for my work.', decoys: ['processor', 'warranty'] },
      { text: 'How big is it, corner to corner?', decoys: ['ram', 'warranty'] }],
    warranty: [
      { text: 'What happens if it stops working next month?', decoys: ['ram', 'storage'] },
      { text: 'Who fixes it if a part is faulty?', decoys: ['display', 'processor'] },
      { text: 'Will it be repaired if it has a fault?', decoys: ['ram', 'display'] }],
    processor: [
      { text: 'Which part is the brain of the laptop?', decoys: ['display', 'warranty'] },
      { text: 'What decides how fast everything runs?', decoys: ['display', 'warranty'] },
      { text: 'I want every app to run quickly.', decoys: ['display', 'warranty'] }],
    generation: [
      { text: 'Is this processor the latest one?', decoys: ['gigabyte', 'display'] },
      { text: 'How new is the chip inside?', decoys: ['warranty', 'display'] },
      { text: 'Is this chip newer than my old one?', decoys: ['gigabyte', 'warranty'] }],
    gigabyte: [
      { text: 'What does GB stand for?', decoys: ['generation', 'display'] },
      { text: 'How is memory measured?', decoys: ['warranty', 'display'] },
      { text: 'Which unit is used for RAM and storage?', decoys: ['warranty', 'generation'] }],
    acer: [
      { text: 'Which brand is this laptop?', decoys: ['display', 'warranty'] },
      { text: 'Who makes this laptop?', decoys: ['processor', 'display'] },
      { text: 'Which brand do you work for?', decoys: ['display', 'gigabyte'] }],
    aspire: [
      { text: 'I want a simple laptop for everyday use.', decoys: ['warranty', 'gigabyte'] },
      { text: 'Which Acer range is for everyday laptops?', decoys: ['warranty', 'display'] },
      { text: 'I need a laptop for daily home and office work.', decoys: ['generation', 'warranty'] }]
  };

  /* Nitro 5: the only spec values allowed (graphics and thermals wait for Unit 3) */
  var NITRO = [
    { v: 'Intel Core i5-14450HX', bin: 'processor', fix: 'Intel Core i5-14450HX is the Processor' },
    { v: 'Up to 32 GB', bin: 'ram', fix: 'Up to 32 GB is RAM' },
    { v: 'Up to 64 GB · 73 build', bin: 'ram', fix: 'Up to 64 GB · 73 build is RAM' },
    { v: '512 GB SSD', bin: 'storage', fix: '512 GB SSD is Storage' },
    { v: '16″ FHD+ 165Hz', bin: 'display', fix: '16″ FHD+ 165Hz is the Display' }
  ];

  /* Lag King sound coins: build the word in order; the slip coin is the common mistake */
  var SYLL = {
    storage: { parts: ['STOR', 'ij'], slip: 'AGE', note: 'not stor-AGE' },
    gigabyte: { parts: ['GIG', 'uh', 'byte'], slip: 'JIG', note: 'not JIG-uh-byte' },
    processor: { parts: ['PRO', 'ses', 'er'], slip: 'FES', note: 'not PRO-fes-er' }
  };

  var TIPS = {
    acer: 'Two beats: AY-ser', aspire: 'Stress the SPY', processor: 'Stress the PRO', generation: 'Stress the RAY',
    ram: 'One word, not R-A-M', gigabyte: 'Hard G, as in give', ssd: 'Three letters, stress the DEE',
    storage: 'Ends in ij, not age', display: 'Stress the PLAY', warranty: 'Stress the WOR'
  };

  /* WRONG say-guides for the tap check. Written on screen only; the model audio plays the right one. */
  var SAYALT = {
    acer: ['uh-SER', 'ACK-er'], aspire: ['ASP-eer', 'uh-SPEER'], processor: ['pro-SES-er', 'PRO-fes-er'],
    generation: ['GEN-er-ay-shun', 'jen-ER-ay-shun'], ram: ['ARR-ay-em', 'rum'], gigabyte: ['JIG-uh-byte', 'gig-AH-bit'],
    ssd: ['SUS-dee', 'ES-es-dee'], storage: ['stor-AGE', 'STOR-ee'], display: ['DIS-play', 'dis-PLY'],
    warranty: ['wuh-RAN-tee', 'WAR-un']
  };

  function word(slug) { return SS.BY[slug]; }
  function label(slug) { var w = SS.BY[slug]; return w ? w.word : slug; }
  function ok(right, decoys) {
    var bad = CONFUSE[right] || [];
    for (var i = 0; i < decoys.length; i++) {
      var d = decoys[i];
      if (d === right || bad.indexOf(d) >= 0 || (CONFUSE[d] || []).indexOf(right) >= 0) return false;
    }
    return true;
  }
  function fix(slug) { return label(slug) + ': ' + MEAN[slug]; }
  /* the sound-alike sets live in data.js inside the lessons' "hear" items (first option = right) */
  function hear(slug) {
    var L = SS.LESSONS || {}, found = null;
    Object.keys(L).forEach(function (k) { (L[k].items || []).forEach(function (it) { if (!found && it.t === 'hear' && it.slug === slug) found = it.opts.slice(); }); });
    return found;
  }

  var bank = { WORDS: WORDS, MEAN: MEAN, DECOY: DECOY, NEEDS: NEEDS, NITRO: NITRO, SYLL: SYLL, TIPS: TIPS, SAYALT: SAYALT,
    CONFUSE: CONFUSE, word: word, label: label, ok: ok, fix: fix, hear: hear };

  /* self-check on load: a broken bank should be loud during development, never at a learner */
  try {
    WORDS.forEach(function (s) {
      if (!SS.BY[s]) throw new Error('content: unknown word ' + s);
      if (!ok(s, DECOY[s])) throw new Error('content: banned decoy for ' + s);
      NEEDS[s].forEach(function (n) {
        if (!ok(s, n.decoys)) throw new Error('content: banned decoy in need "' + n.text + '"');
        if (n.text.toLowerCase().indexOf(label(s).toLowerCase()) >= 0) throw new Error('content: need contains its answer: ' + n.text);
      });
    });
  } catch (e) { if (window.console) console.warn(e.message); }

  (window.ARC = window.ARC || {}).bank = bank;
})();
