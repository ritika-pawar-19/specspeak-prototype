/* Game 21 · Spec Stack (falling blocks). Look and feel ported from the approved video scene
   (../../../classic-video/scenes/g21_specstack.js): a pixel spec card fills the phone; a navy header strip, a drop zone
   where Lau rides the falling block (plus a Next box), then 4 tall columns, each with a bin at the bottom (crew icon +
   label). The whole column is the tap target.

   Rules (SPEC.md): 75 s, 3 waves x 25 s, fixed bins per wave: wave 1 meanings, wave 2 the Nitro 5 spec card values,
   wave 3 customer lines. Every block has exactly one right bin on screen (the bin sets below are vetted against the
   content bank's banned pairs, and every run's wave 1 + wave 3 sets cover all 10 Unit 1 words between them). One block
   falls at a time (wave 1 and 2: 6 s / 5.5 s speeding up to a 4 s cap; wave 3's long customer lines: 7 s to a 5 s cap;
   the speed-up restarts each wave); Lau rides it. Tap a column: Lau zips over and slams it down. Right: it dissolves into
   the bin, the crew icon pops out, the word plays, the value stays as a ghost tag over the bin. The ghost tags never show
   while a block is falling (no text matching): they come back for the slam, FULL SPEC CARD, the pitch and the read-through
   (the one exception is the video's GB beat: the RAM tag stays lit while the first 512 GB SSD falls). Wrong: a grey jam
   block stays in that column and a one-line fix shows the right row (the next block waits for the fix to finish); 4 jams
   in one column cost a heart and flush it. A right drop on a jammed column clears its jams in a cascade. Each wave starts
   on a fresh card (leftover jams crumble away when the bins change).
   Filling every bin in a wave: FULL SPEC CARD +5 (the wave clock waits while it shows). Wave 1 has only 4 meanings, so it
   ends early once every bin has been filled twice; its leftover seconds go to wave 3. A block that reaches the line
   untapped costs nothing: the right row lights up and the block comes back later in the wave. Two untapped blocks in a
   row: the game waits ("Still there?") with the wave clock stopped until the next tap (an APC pulled away by a customer).
   End: "Pitch the card", the Say-it card on the most-jammed row word (else Storage); a clear say doubles that row's sparks
   (a tap check adds half).
   Sparks: +1 per right drop, +5 per full card, the pitch bonus (clearing a jam pays nothing extra: a wrong drop always
   costs). Score = sparks. */
(function () {
  'use strict';
  var U = ARC.U, C = PX.C, E = U.E, p = U.p, clamp = U.clamp, hash = U.hash, lerp = U.lerp;
  var BK = ARC.bank;
  var RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var WAVE_LEN = 25, FALL0 = [6, 5.5, 7], FALL_MIN = [4, 4, 5], FALL_STEP = .2;
  /* seconds to the next block: after a right landing (the model word, ~0.6-0.9 s from +0.2 s, and its spark coin play
     out first), after a wrong landing and after an untapped block (the fix pill and the lime row finish first), and after
     a 4-jam flush (the "4 jams = lose a heart" pill finishes first) */
  var NEXT_OK = 1.15, NEXT_BAD = 2.4, NEXT_SLOW = 2.2, NEXT_FLUSH = 2.8, FULL_SHOW = 1.6;
  var BW = 31, COLX = [1, 33, 65, 97], HXC = 50;           // column left edges (31 wide + 1 px separator); Lau's hover x
  function colCx(i) { return COLX[i] + BW / 2; }
  var PALS = ['peri', 'mint', 'lilac', 'peach', 'gold'];
  var PAL = {
    peri: [C.peri, C.periSoft, C.periSh], mint: [C.mint, C.mintSoft, C.mintSh], lilac: [C.lilac, '#ECE6FC', C.lilacSh],
    peach: [C.peach, C.coralSoft, '#EE8E70'], gold: [C.gold, '#FFE3A0', C.goldSh], grey: [C.grey, '#C2C6D6', C.greyDk],
    white: [C.white, C.white, C.white]
  };
  /* a soft tint per row word: column, column dots, bin, bin floor */
  var TINT = {
    gold: ['#FFFBEE', '#FFF0C9', '#FFEFC4', '#FADF97'], peri: ['#F5F7FF', '#E3E8FF', '#E1E7FF', '#C9D2FF'],
    mint: ['#F2FCF7', '#D8F5E7', '#D5F5E5', '#AEE9CC'], lilac: ['#F9F6FF', '#ECE5FC', '#ECE4FC', '#D9CCF7'],
    peach: ['#FFF6F2', '#FFE3D8', '#FFE2D6', '#FFC4AE'], lime: ['#F8FDEB', '#E8F7C4', '#E6F6BE', '#CDEB86'],
    sky: ['#F1FAFE', '#D9F0FB', '#D6EEFA', '#AEDDF3']
  };
  var WTINT = { processor: 'gold', ram: 'peri', storage: 'mint', display: 'lilac', warranty: 'peach', acer: 'lime',
    aspire: 'sky', ssd: 'gold', generation: 'gold', gigabyte: 'peri' };

  /* ---------- the waves (bin sets vetted: no banned pair, one defensible answer per block) ---------- */
  var CARD = ['processor', 'ram', 'storage', 'display'];   // wave 2: the spec card rows, in card order
  /* wave 1 (meanings) and wave 3 (customer lines) bin sets, chosen as a pair per run. Wave 2 always drills the card rows
     (Processor, RAM, Storage, Display), so each pair puts the other six words (SSD, Gigabyte, Acer, Aspire, Generation,
     Warranty) across waves 1 and 3 (SSD/Gigabyte and Acer/Aspire are banned pairs, so they split between the waves)
     and rotates the two filler bins: every run drills all 10 words. Wave 3 lists the allowed BK.NEEDS indexes per word:
     a need is left out when another bin on screen could be argued ("How big is it, corner to corner?" next to Gigabyte;
     "daily home and office work" next to Display; "My old laptop takes ages to start" next to Aspire). SSD and
     Generation never share a wave 3 set (a slow old laptop could be argued as either). */
  var PAIRS = [
    { w1: ['ssd', 'acer', 'generation', 'warranty'], w3: { bins: ['gigabyte', 'aspire', 'display', 'processor'], needs: { display: [0, 1], aspire: [0, 1] } } },
    { w1: ['ssd', 'generation', 'aspire', 'display'], w3: { bins: ['gigabyte', 'acer', 'warranty', 'processor'], needs: {} } },
    { w1: ['gigabyte', 'acer', 'generation', 'warranty'], w3: { bins: ['ssd', 'aspire', 'display', 'warranty'], needs: { aspire: [0, 1], ssd: [1, 2] } } },
    { w1: ['ssd', 'aspire', 'warranty', 'generation'], w3: { bins: ['gigabyte', 'acer', 'display', 'processor'], needs: { display: [0, 1] } } },
    { w1: ['ssd', 'acer', 'display', 'warranty'], w3: { bins: ['gigabyte', 'aspire', 'generation', 'warranty'], needs: {} } }
  ];
  var lastPair = -1;
  /* Nitro 5 values (BK.NITRO is the only source): how each one breaks into lines while falling, in a column, as a tag,
     and on a jam. Unknown values fall back to a plain wrap. */
  var VAL = {
    'Intel Core i5-14450HX': { fall: ['Intel Core', 'i5-14450HX'], col: ['Intel Core', 'i5-14450HX'], tag: ['Intel Core', 'i5-14450HX'], jam: 'i5-14450HX' },
    'Up to 32 GB': { fall: ['Up to 32 GB'], col: ['Up to', '32 GB'], tag: ['Up to', '32 GB'], jam: 'Up to 32 GB' },
    'Up to 64 GB · 73 build': { fall: ['Up to 64 GB', '· 73 build'], col: ['Up to', '64 GB', '· 73 build'], tag: ['Up to 64 GB', '· 73 build'], jam: 'Up to 64 GB' },
    '512 GB SSD': { fall: ['512 GB SSD'], col: ['512 GB', 'SSD'], tag: ['512 GB SSD'], jam: '512 GB SSD' },
    '16″ FHD+ 165Hz': { fall: ['16″ FHD+ 165Hz'], col: ['16″ FHD+', '165Hz'], tag: ['16″ FHD+', '165Hz'], jam: '16″ FHD+' }
  };
  var TITLE = ['Wave 1 · What each word means', 'Acer Nitro 5 · sample spec card', 'Wave 3 · What the customer says'];
  var BANNER = ['Match the meaning to its word', 'Real values from the Nitro 5 card', 'Which word answers the customer'];
  var KIND = ['mean', 'value', 'need'];

  function needsFor(set, slug) {
    var all = BK.NEEDS[slug] || [], idx = set.needs[slug];
    return all.filter(function (n, i) { return !idx || idx.indexOf(i) >= 0; });
  }
  /* self-check on load: loud during development, never at a learner */
  (function check() {
    try {
      function lab(s) { return BK.label(s).toLowerCase(); }
      PAIRS.forEach(function (pr, k) {
        var b1 = pr.w1, set = pr.w3, b = set.bins, cover = {};
        b1.forEach(function (s) { if (!BK.ok(s, b1.filter(function (o) { return o !== s; }))) throw new Error('g21: banned pair in wave 1 set ' + k); });
        if (b.indexOf('ssd') >= 0 && b.indexOf('generation') >= 0) throw new Error('g21: SSD with Generation in wave 3 set ' + k);
        b.forEach(function (s) {
          var others = b.filter(function (o) { return o !== s; });
          if (!BK.ok(s, others)) throw new Error('g21: banned pair in wave 3 set ' + k);
          var ns = needsFor(set, s); if (!ns.length) throw new Error('g21: no needs for ' + s);
          ns.forEach(function (n) { b.forEach(function (o) { if (n.text.toLowerCase().indexOf(lab(o)) >= 0) throw new Error('g21: need names a bin: ' + n.text); }); });
        });
        b1.concat(b, CARD).forEach(function (s) { cover[s] = 1; });
        BK.WORDS.forEach(function (w) { if (!cover[w]) throw new Error('g21: pair ' + k + ' leaves out ' + w); });
      });
      BK.NITRO.forEach(function (n) { if (CARD.indexOf(n.bin) < 0) throw new Error('g21: Nitro value without a row: ' + n.v); });
    } catch (e) { if (window.console) console.warn(e.message); }
  })();

  /* ---------- small helpers (from the video scene) ---------- */
  function jig(t, t0, amp) { var d = t - t0; if (d < 0 || d > .5) return 0; return amp * Math.exp(-d * 11) * Math.cos(d * 26); }
  function bobY(t) { return Math.round(Math.sin(t * 3.1) * 1.2); }
  function jumpY(t, t0, dur, h) { var u = (t - t0) / dur; return u <= 0 || u >= 1 ? 0 : 4 * h * u * (1 - u); }
  var SPR = {}, SPRN = 0;
  function once(key, fn) { if (SPR[key]) return SPR[key]; if (++SPRN > 160) { SPR = {}; SPRN = 1; } return (SPR[key] = fn()); }
  var Gc = null;          // the current canvas API (set at the top of draw)
  /* sprite anchored at bottom-centre (cx, by) in game px, squash/stretch snapped to whole game px */
  function put(s, cx, by, o) {
    o = o || {};
    var sx = o.sx || 1, sy = o.sy || 1, w = Math.max(1, Math.round(s.width * sx)), h = Math.max(1, Math.round(s.height * sy));
    var x = Math.round(cx - w / 2), y = Math.round(by - h), c = Gc.ctx;
    c.save(); c.imageSmoothingEnabled = false;
    if (o.alpha != null) c.globalAlpha *= clamp(o.alpha);
    if (o.flip) { c.translate((x + w) * 3, y * 3); c.scale(-1, 1); c.drawImage(s, 0, 0, w * 3, h * 3); }
    else c.drawImage(s, x * 3, y * 3, w * 3, h * 3);
    c.restore();
  }
  function disc(cx, cy, r, col, a) {
    cx = Math.round(cx); cy = Math.round(cy);
    for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r * .6) Gc.rect(cx + dx, cy + dy, 1, 1, col, a);
  }
  function puffs(t, t0, gx, gy, n, spread, life, dir) {
    var d = t - t0; if (d < 0 || d > life) return;
    var u = d / life;
    for (var i = 0; i < n; i++) {
      var f = n === 1 ? 0 : i / (n - 1) * 2 - 1, h = hash(i * 4.1 + t0 * 3.3);
      var x = gx + (f * spread + (dir || 0) * spread * .7) * E.out(u), y = gy - (2 + h * 5) * E.out(u);
      var r = Math.max(0, Math.round((1.2 + h * 1.6) * Math.sin(Math.min(1, u * 1.25) * Math.PI)));
      disc(x, y + 1, r, C.periSh, (1 - u) * .5);
      disc(x, y, r, C.white, 1 - u);
    }
  }
  function sparkle(t, t0, gx, gy, col, life) {
    life = life || .3;
    var d = t - t0; if (d < 0 || d > life) return;
    var u = d / life, L = Math.round(1 + 3 * Math.sin(u * Math.PI)), a = 1 - u * .6;
    col = col || C.white; gx = Math.round(gx); gy = Math.round(gy);
    Gc.rect(gx, gy, 1, 1, col, a);
    for (var i = 1; i <= L; i++) { Gc.rect(gx + i, gy, 1, 1, col, a); Gc.rect(gx - i, gy, 1, 1, col, a); Gc.rect(gx, gy + i, 1, 1, col, a); Gc.rect(gx, gy - i, 1, 1, col, a); }
  }
  function pround(x, y, w, h, col, a) {
    Gc.rect(x + 2, y, w - 4, 1, col, a); Gc.rect(x + 1, y + 1, w - 2, 1, col, a); Gc.rect(x, y + 2, w, h - 4, col, a);
    Gc.rect(x + 1, y + h - 2, w - 2, 1, col, a); Gc.rect(x + 2, y + h - 1, w - 4, 1, col, a);
  }
  /* crisp text lines centred at screen (cx, cy). o: size, weight, font, lh, color, maxW (squeeze to fit), alpha,
     sx/sy (follow a block's squash), hi + hiA (a gold glow behind that substring) */
  function lines(L, cx, cy, o) {
    var c = Gc.ctx, size = o.size, lh = o.lh || Math.round(size * 1.15);
    c.save();
    if (o.alpha != null) c.globalAlpha *= clamp(o.alpha);
    c.translate(cx, cy); c.scale(o.sx || 1, o.sy || 1);
    c.font = (o.weight || 800) + ' ' + size + 'px ' + (o.font || 'Lexend, sans-serif');
    if (o.font && o.font.indexOf('Figtree') === 0) c.letterSpacing = '-0.4px';
    c.textAlign = 'left'; c.textBaseline = 'middle';
    for (var i = 0; i < L.length; i++) {
      var ln = L[i], w = c.measureText(ln).width, f = o.maxW && w > o.maxW ? o.maxW / w : 1, y = (i - (L.length - 1) / 2) * lh;
      c.save(); c.translate(0, y); c.scale(f, 1);
      if (o.hi && o.hiA > 0) {
        var j = ln.indexOf(o.hi);
        if (j >= 0) {
          var a = c.measureText(ln.slice(0, j)).width, bw = c.measureText(o.hi).width, ga = c.globalAlpha, gx = -w / 2 + a;
          c.globalAlpha = ga * clamp(o.hiA) * .4; c.fillStyle = C.gold; PX.roundRect(c, gx - 7, -size * .78, bw + 14, size * 1.56, 10); c.fill();
          c.globalAlpha = ga * clamp(o.hiA); c.fillStyle = C.gold; PX.roundRect(c, gx - 3, -size * .62, bw + 6, size * 1.24, 6); c.fill();
          c.lineWidth = 2; c.strokeStyle = C.goldDk; c.stroke();
          c.globalAlpha = ga;
        }
      }
      c.fillStyle = o.color || C.navy; c.fillText(ln, -w / 2, 1);
      c.restore();
    }
    c.restore();
  }
  /* where pill() puts a one-line pill: {x, w} in sp */
  function pillBox(str, cx, size, ic) {
    var icw = ic ? ic.width * 3 + 8 : 0, w = Math.ceil(Gc.wrap(str, size, 330 - icw, 800).w + icw + 32), x = Math.round(cx - w / 2);
    if (x < 6) x = 6; if (x + w > 384) x = 384 - w;
    return { x: x, w: w };
  }
  /* pill with an optional pixel sprite on its left, scaled about its centre (2 lines when it would not fit) */
  function pill(str, cx, cy, o) {
    var s = o.s == null ? 1 : o.s, a = o.alpha == null ? 1 : o.alpha; if (s <= 0 || a <= 0) return;
    var c = Gc.ctx, size = o.size || 18, ic = o.icon, icw = ic ? ic.width * 3 + 8 : 0;
    var info = Gc.wrap(str, size, 330 - icw, 800), tw = info.w, L = info.lines, lh = Math.round(size * 1.2);
    var w = Math.ceil(tw + icw + 32), h = Math.round(size * 1.95 + (L.length - 1) * lh), x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
    if (x < 6) { x = 6; cx = x + w / 2; } if (x + w > 384) { x = 384 - w; cx = x + w / 2; }
    c.save(); c.globalAlpha *= clamp(a); c.translate(cx, cy); c.scale(s, s); c.translate(-cx, -cy);
    Gc.box(x, y, w, h, { bg: o.bg, border: C.navy, borderW: 3, r: Math.min(h / 2, 26) });
    if (ic) { c.imageSmoothingEnabled = false; c.drawImage(ic, x + 16, Math.round(cy - ic.height * 1.5), ic.width * 3, ic.height * 3); }
    for (var i = 0; i < L.length; i++) Gc.text(L[i], x + 16 + icw + tw / 2, cy + 1 + (i - (L.length - 1) / 2) * lh, { size: size, weight: 800, color: o.color || C.navy });
    c.restore();
  }

  /* ---------- sprites made for this game ---------- */
  function eye3(px, x, y, lx, ly) {
    var i, j;
    for (j = 0; j < 3; j++) for (i = 0; i < 3; i++) px(x + i, y + j, C.white);
    for (j = 0; j < 2; j++) for (i = 0; i < 2; i++) px(x + lx + i, y + ly + j, C.navy);
  }
  function lq(look) { return [look && look[0] > .25 ? 1 : 0, look && look[1] < -.25 ? 0 : 1]; }
  /* the SSD drive from the video (Storage, mint label) and a gold-label twin with a bolt (SSD: the fast one) */
  function driveSpr(look, gold) {
    var l = lq(look);
    return once('drv' + l[0] + l[1] + (gold ? 'g' : 'm'), function () {
      var lab = gold ? [C.gold, '#FFE3A0', C.goldSh] : [C.mint, C.mintSoft, C.mintSh];
      return PX.outline(PX.make(22, 13, function (px) {
        var x, y;
        for (y = 0; y < 13; y++) for (x = 0; x < 19; x++) px(x, y, y === 0 ? C.stoneLt : (y >= 11 || x === 18) ? C.stoneDk : C.stone);
        for (y = 3; y < 10; y++) { px(19, y, C.navy2); px(20, y, y % 2 ? C.gold : C.goldSh); if (y % 2) px(21, y, C.gold); }
        for (y = 2; y < 11; y++) for (x = 3; x < 16; x++) px(x, y, y === 2 ? lab[1] : y === 10 ? lab[2] : lab[0]);
        eye3(px, 5, 4, l[0], l[1]); eye3(px, 10, 4, l[0], l[1]);
        px(8, 8, C.navy); px(9, 9, C.navy); px(10, 9, C.navy); px(11, 8, C.navy);
        if (gold) { px(14, 3, C.navy); px(13, 4, C.navy); px(14, 4, C.navy); px(13, 5, C.navy); }
        px(1, 1, C.grey); px(16, 1, C.grey); px(1, 11, C.grey); px(16, 11, C.grey);
      }), C.navy);
    });
  }
  /* Warranty: a peach shield with a lime check */
  function shieldSpr(look) {
    var l = lq(look);
    return once('shd' + l[0] + l[1], function () {
      return PX.outline(PX.make(17, 20, function (px) {
        for (var y = 0; y < 20; y++) {
          var half = y < 11 ? 8.5 : 8.5 * (1 - Math.pow((y - 10) / 10.2, 1.5));
          for (var x = 0; x < 17; x++) {
            var dx = Math.abs(x + .5 - 8.5); if (dx > half) continue;
            px(x, y, dx > half - 1.4 || y === 0 ? C.coral : y < 3 ? C.coralSoft : x > 11 ? '#F79D80' : C.peach);
          }
        }
        eye3(px, 4, 4, l[0], l[1]); eye3(px, 10, 4, l[0], l[1]);
        px(7, 9, C.navy); px(8, 10, C.navy); px(9, 9, C.navy);
        [[5, 14], [6, 15], [7, 16], [8, 15], [9, 14], [10, 13], [11, 12]].forEach(function (q) { px(q[0], q[1], C.limeDk); px(q[0], q[1] - 1, C.lime); });
      }), C.navy);
    });
  }
  /* Acer (lime screen) and Aspire (sky screen): a little open laptop with a face on the screen. No logos. */
  function laptopSpr(look, tone) {
    var l = lq(look);
    return once('lap' + tone + l[0] + l[1], function () {
      var scr = tone === 'lime' ? [C.lime, C.limeSh] : ['#9ED8F5', '#7FC4EA'];
      return PX.outline(PX.make(22, 15, function (px) {
        var x, y;
        for (y = 0; y < 11; y++) for (x = 3; x < 19; x++) px(x, y, (x === 3 || x === 18 || y === 0 || y === 10) ? C.navy2 : y === 9 ? scr[1] : scr[0]);
        eye3(px, 6, 3, l[0], l[1]); eye3(px, 12, 3, l[0], l[1]);
        px(9, 7, C.navy); px(10, 8, C.navy); px(11, 8, C.navy); px(12, 7, C.navy);
        for (x = 1; x < 21; x++) px(x, 11, C.navy3);
        for (y = 12; y < 15; y++) for (x = 0; x < 22; x++) px(x, y, y === 12 ? '#C2C6D6' : y === 14 ? C.greyDk : C.grey);
        for (x = 9; x < 13; x++) px(x, 13, '#B4B9CC');
      }), C.navy);
    });
  }
  /* Generation: Chip with a lime sparkle (how new the chip is) */
  function genSpr(look, blink) {
    var lk = [Math.round(clamp(look[0], -1, 1)), look[1] < 0 ? -1 : 1];
    return once('gen' + lk[0] + lk[1] + (blink ? 'b' : ''), function () {
      var chip = PX.chip({ look: lk, blink: blink });
      var star = PX.outline(PX.grid(['..l..', '..l..', 'llwll', '..l..', '..l..'], { l: C.lime, w: C.white }), C.navy);
      return PX.make(chip.width + 4, chip.height + 4, function (px, x) { x.drawImage(chip, 0, 4); x.drawImage(star, chip.width - 3, 0); });
    });
  }
  /* Gigabyte: a gold ruler with tick marks (how memory is measured) */
  function rulerSpr(look) {
    var l = lq(look);
    return once('rul' + l[0] + l[1], function () {
      return PX.outline(PX.make(24, 12, function (px) {
        var x, y;
        for (y = 0; y < 12; y++) for (x = 0; x < 24; x++) px(x, y, y === 0 ? '#FFE08A' : (y === 11 || x === 23) ? C.goldSh : C.gold);
        for (x = 2; x < 23; x += 3) { px(x, 1, C.navy); px(x, 2, C.navy); if ((x - 2) % 6 === 0) px(x, 3, C.navy); }
        eye3(px, 7, 5, l[0], l[1]); eye3(px, 14, 5, l[0], l[1]);
        px(10, 9, C.navy); px(11, 10, C.navy); px(12, 10, C.navy); px(13, 9, C.navy);
      }), C.navy);
    });
  }
  function crewSpr(slug, look, t) {
    var lk = [Math.round(look[0] * 2) / 2, Math.round(look[1] * 2) / 2], blink = ((t + 1.3) % 3.3) < .1 ? 1 : 0;
    switch (slug) {
      case 'processor': return PX.chip({ look: lk, blink: blink });
      case 'ram': return PX.rami({ frame: Math.floor(t * 2.5) % 2, look: lk });
      case 'storage': return driveSpr(lk, false);
      case 'display': return PX.pixi({ look: lk });
      case 'ssd': return driveSpr(lk, true);
      case 'warranty': return shieldSpr(lk);
      case 'acer': return laptopSpr(lk, 'lime');
      case 'aspire': return laptopSpr(lk, 'sky');
      case 'generation': return genSpr(lk, blink);
      default: return rulerSpr(lk);
    }
  }
  function arrowSpr() {
    return once('arrow', function () {
      return PX.outline(PX.grid(['..lll..', '..lll..', '..lll..', 'lllllll', '.lllll.', '..lll..', '...l...'], { l: C.lime }), C.navy);
    });
  }
  /* a chunky block W x H (game px) drawn with rects (no canvas per size): navy outline with rounded corners, light
     top-left bevel, 2 px shade at the bottom; jam = cracks and corner bolts */
  function blockRect(x, y, W, H, pal, jam, a) {
    var P = PAL[pal], R = function (gx, gy, w, h, col) { Gc.rect(x + gx, y + gy, w, h, col, a); };
    if (W < 4 || H < 4) return;
    R(1, 0, W - 2, 1, C.navy); R(1, H - 1, W - 2, 1, C.navy); R(0, 1, 1, H - 2, C.navy); R(W - 1, 1, 1, H - 2, C.navy);
    R(1, 1, W - 2, H - 2, P[0]);
    R(2, 1, W - 4, 1, P[1]); R(1, 2, 1, H - 5, P[1]);
    R(1, H - 3, W - 2, 2, P[2]); R(W - 2, 2, 1, H - 4, P[2]);
    R(1, 1, 1, 1, C.navy); R(W - 2, 1, 1, 1, C.navy); R(1, H - 2, 1, 1, C.navy); R(W - 2, H - 2, 1, 1, C.navy);
    if (pal !== 'white') { R(2, 2, 1, 1, C.white); R(3, 2, 1, 1, P[1]); R(2, 3, 1, 1, P[1]); }
    if (jam) {
      [0, 1, 1, 2].forEach(function (o, i) { R(W - 4 - o, 1 + i, 1, 1, C.navy2); });
      R(W - 7, 4, 1, 1, C.navy2); R(W - 8, 5, 1, 1, C.navy2);
      if (jam !== 2) for (var k = 0; k < 4; k++) R(2 + k + (k > 1 ? 1 : 0), H - 4 - k, 1, 1, C.navy2);   // 2: label on 2 lines
      [[3, 3], [W - 5, H - 5]].forEach(function (b) { R(b[0], b[1], 1, 1, C.greyDk); R(b[0] + 1, b[1], 1, 1, '#565B78'); });
    }
  }
  /* the static card for one wave (tints) and one phone height: outline, header strip, dotted drop zone, columns, bins */
  var CARDS = {}, CARDN = 0;
  function cardSpr(g, tints) {
    var key = g.key + '|' + tints.join(',');
    if (CARDS[key]) return CARDS[key];
    if (++CARDN > 8) { CARDS = {}; CARDN = 1; }
    var H = g.cardB - g.cardT, o = g.cardT, HEAD_B = g.headB, TOP = g.top, FLOOR = g.floor, CB = g.cardB, SLOT = g.slot;
    return (CARDS[key] = PX.make(130, H, function (px, x) {
      function f(col, a, b, w, h) { x.fillStyle = col; x.fillRect(a, b - o, w, h); }
      f(C.navy, 2, o, 126, 1); f(C.navy, 1, o + 1, 128, 1); f(C.navy, 0, o + 2, 130, H - 4); f(C.navy, 1, CB - 2, 128, 1); f(C.navy, 2, CB - 1, 126, 1);
      f(C.periSoft, 1, HEAD_B, 128, TOP - HEAD_B);
      for (var gy = HEAD_B + 4; gy < TOP - 2; gy += 6) for (var gx = 4; gx < 128; gx += 6) f(C.white, gx, gy, 1, 1);
      f(C.paper, 1, TOP, 128, FLOOR - TOP);
      f('#E7EBFB', 1, FLOOR, 128, CB - 2 - FLOOR);
      for (var i = 0; i < 4; i++) {
        var T = TINT[tints[i]];
        f(T[0], COLX[i], TOP, BW, FLOOR - TOP);
        for (var gy2 = TOP + 2; gy2 < FLOOR - 1; gy2 += 4) for (var gx2 = COLX[i] + 2 + ((gy2 >> 2) % 2) * 2; gx2 < COLX[i] + BW - 1; gx2 += 4) f(T[1], gx2, gy2, 1, 1);
        f(T[2], COLX[i], FLOOR, BW, CB - 2 - FLOOR);
        f(T[3], COLX[i], CB - 6, BW, 3);
        for (var j = 1; j < 4; j++) for (var dx = 1; dx < BW - 1; dx += 3) f('#D2D8EE', COLX[i] + dx, FLOOR - j * SLOT, 2, 1);
        if (i < 3) f('#C9D0EA', COLX[i] + BW, TOP, 1, CB - 2 - TOP);
        f(C.navy2, COLX[i] + 2, FLOOR, BW - 4, 2); f(C.navy3, COLX[i] + 2, FLOOR + 2, BW - 4, 1);
      }
      f('#D3D9F2', 1, FLOOR - 1, 128, 1);
    }));
  }

  /* ---------- layout from the screen edges (never a fixed 281) ---------- */
  var GEO = null;
  function geo(R) {
    var G = R.G, key = G.H.toFixed(2) + '|' + R.layout.hudY.toFixed(1) + '|' + G.bot.toFixed(1);
    if (GEO && GEO.key === key) return GEO;
    var cardT = Math.max(14, Math.round((R.layout.hudY + 30) / 3));
    var cardB = Math.floor(G.H - 5 - G.bot / 3);
    var headB = cardT + 10, floor = cardB - 53, slot = 28;
    if (floor - 4 * slot - headB < 62) slot = Math.max(20, Math.floor((floor - headB - 62) / 4));
    var top = floor - 4 * slot;
    GEO = { key: key, cardT: cardT, cardB: cardB, headB: headB, floor: floor, slot: slot, bh: slot - 1, top: top,
      spawnTop: headB + 29, hf: headB + 22, crewB: cardB - 13, labelY: (cardB - 6.3) * 3, tagY: (floor + 1.3) * 3,
      next: { x: 101, y: headB + 3, w: 27, h: 31 } };
    return GEO;
  }

  /* ---------- content per wave ---------- */
  function valueOf(it) { return VAL[it.v] || null; }
  function itemsFor(wd) {
    if (wd.kind === 'value') return BK.NITRO.map(function (n) { return { slug: n.bin, kind: 'value', v: n.v, fix: n.fix, key: n.v }; });
    if (wd.kind === 'mean') return wd.bins.map(function (s) { return { slug: s, kind: 'mean', text: BK.MEAN[s], key: 'm' + s }; });
    var out = [];
    wd.bins.forEach(function (s) { needsFor(wd.set, s).forEach(function (n) { out.push({ slug: s, kind: 'need', text: n.text, key: n.text }); }); });
    return out;
  }
  function buildQueue(wd) {
    var pool = itemsFor(wd), q = [];
    U.shuffle(wd.bins).forEach(function (b) { q.push(U.pick(pool.filter(function (it) { return it.slug === b; }))); });
    for (var r = 0; r < 4; r++) U.shuffle(pool).forEach(function (it) { if (q[q.length - 1].key !== it.key) q.push(it); });
    var last = null;
    return q.map(function (it) { var pal = U.pick(PALS.filter(function (x) { return x !== last; })); last = pal; return { it: it, pal: pal }; });
  }
  function fixText(it) { return it.kind === 'value' ? it.fix : BK.fix(it.slug); }
  /* the end card's "To remember" line: always the word's meaning (the learning), never a spec value ("RAM: Up to 32 GB"
     reads as a definition, and long values wrap mid-token on the card) */
  function remember(it) { return BK.MEAN[it.slug]; }
  /* greedy wrap into at most 2 lines of maxW sp in Figtree 700 at `size`; a longer text ends in "…" on line 2.
     (G.wrap balances 2 lines but never truncates, and its cache key leaves out the font.) */
  var WR = {}, WRN = 0;
  function wrap2(str, size, maxW) {
    var key = str + '|' + size + '|' + maxW; if (WR[key]) return WR[key];
    var c = Gc.ctx; c.save(); c.font = '700 ' + size + 'px Figtree, sans-serif';
    if (c.letterSpacing != null) c.letterSpacing = '-0.4px';
    function W(s) { return c.measureText(s).width; }
    var words = str.split(' '), L = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var tryS = cur ? cur + ' ' + words[i] : words[i];
      if (!cur || W(tryS) <= maxW) { cur = tryS; continue; }
      L.push(cur); cur = words[i];
      if (L.length === 2) break;
    }
    if (L.length < 2) L.push(cur); else {                    // ran out of room: end line 2 with an ellipsis
      var l2 = L[1].replace(/[.,?”]+$/, '');
      while (l2.indexOf(' ') > 0 && W(l2 + '…”') > maxW) l2 = l2.slice(0, l2.lastIndexOf(' ')).replace(/[.,?]+$/, '');
      L[1] = l2 + (str.charAt(0) === '“' ? '…”' : '…');
    }
    L = L.filter(function (x) { return x; });
    c.restore();
    if (++WRN > 120) { WR = {}; WRN = 1; }
    return (WR[key] = L);
  }
  function fallLines(it) {
    if (it.kind === 'value') { var v = valueOf(it); if (v) return { L: v.fall, size: 22, lh: 25 }; return { L: Gc.wrap(it.v, 22, 250, 800).lines, size: 22, lh: 25 }; }
    if (it.kind === 'mean') return { L: Gc.wrap(it.text, 22, 250, 800).lines, size: 22, lh: 25 };
    return { L: Gc.wrap('“' + it.text + '”', 19, 262, 800).lines, size: 19, lh: 23 };
  }
  function colLines(it) {
    if (it.kind === 'value') { var v = valueOf(it); return v ? v.col : Gc.wrap(it.v, 15, 83, 700, 'Figtree, sans-serif').lines; }
    if (it.kind === 'mean') return Gc.wrap(it.text, 15, 83, 700, 'Figtree, sans-serif').lines;
    return jamLines(it);
  }
  function tagLines(it) {
    if (it.kind === 'value') { var v = valueOf(it); return v ? v.tag : Gc.wrap(it.v, 15, 85, 700, 'Figtree, sans-serif').lines; }
    return Gc.wrap(BK.MEAN[it.slug], 15, 85, 700, 'Figtree, sans-serif').lines;
  }
  /* a jam's label: one short line (short phones) or up to 2 lines of 15 sp in the 82 sp the jam block leaves */
  function jamLabel(it) {
    if (it.kind === 'value') { var v = valueOf(it); return v ? v.jam : it.v; }
    if (it.kind === 'mean') return it.text;
    var w = it.text.split(' '); return '“' + w.slice(0, 2).join(' ') + '…”';
  }
  function jamLines(it) {
    if (it.kind === 'value') { var v = valueOf(it); return v ? v.tag : wrap2(it.v, 15, 82); }
    return wrap2(it.kind === 'mean' ? it.text : '“' + it.text + '”', 15, 82);
  }
  /* block size while it falls (game px) */
  function fallWH(it) {
    var fl = fallLines(it), c = Gc.ctx, w = 0;
    c.save(); c.font = '800 ' + fl.size + 'px Lexend, sans-serif'; fl.L.forEach(function (l) { w = Math.max(w, c.measureText(l).width); }); c.restore();
    return [Math.min(96, Math.ceil((w + 38) / 3)), fl.L.length > 1 ? 26 : 18];
  }

  /* ---------- run ---------- */
  function init(R) {
    var s = R.s, pi;
    do { pi = Math.floor(Math.random() * PAIRS.length); } while (pi === lastPair && PAIRS.length > 1);
    lastPair = pi;
    var w1 = PAIRS[pi].w1, w3 = PAIRS[pi].w3;
    s.pair = pi;
    s.waves = [
      { n: 0, kind: 'mean', bins: U.shuffle(w1) },
      { n: 1, kind: 'value', bins: CARD.slice() },
      { n: 2, kind: 'need', bins: U.shuffle(w3.bins), set: w3 }
    ];
    s.waves.forEach(function (w) { w.tints = w.bins.map(function (b) { return WTINT[b] || 'peri'; }); w.title = TITLE[w.n]; w.banner = BANNER[w.n]; });
    s.wave = -1; s.bins = s.waves[0].bins; s.tints = s.waves[0].tints; s.title = s.waves[0].title;
    s.prev = null; s.binsT = -9; s.titleT = -9; s.prevTitle = null;
    s.jams = [[], [], [], []]; s.tags = [null, null, null, null]; s.tagsBy = {}; s.filled = [false, false, false, false]; s.full = {};
    s.rowSp = {}; s.jamN = {}; s.jamT = {}; s.nBlocks = 0; s.waveBlocks = 0; s.blk = null; s.queue = []; s.fx = []; s.pops = [[], [], [], []];
    s.hiCol = null; s.fix = null; s.note = null; s.banner = null; s.mood = 'happy'; s.moodUntil = 0; s.hopT = -9;
    s.firstDone = false; s.hint = null; s.pan = { from: 0, to: 0, t0: -9, dur: .6 }; s.pitch = null; s.read = null;
    s.fullT = -9; s.hotT = -9; s.x2 = null; s.waveLeft = WAVE_LEN; s.waveLen = WAVE_LEN; s.sayWord = null; s.thudT = -9; s.thudA = 0; s.gbT = -9; s.gbSeen = false;
    s.fillN = [0, 0, 0, 0]; s.carry = 0; s.early = false; s.idleN = 0; s.idle = null;
    s.queue = buildQueue(s.waves[0]);
    setPhase(R, 'intro');
    R.after(.35, function () { startWave(R, 0); });
  }
  function setPhase(R, ph) { R.s.phase = ph; R.phase = ph; }
  /* end the one-line fix and the right-row highlight early (a new drop, a new wave, the pitch) */
  function clearHints(R) {
    var s = R.s, t = R.t;
    if (s.fix && t - s.fix.t0 < s.fix.dur) s.fix.dur = Math.max(.25, t - s.fix.t0 + .2);
    if (s.hiCol && t - s.hiCol.t0 < s.hiCol.dur) s.hiCol.dur = Math.max(.3, t - s.hiCol.t0 + .25);
  }
  /* the bins are about to change: every live jam crumbles down into its bin (a jam must never sit under a new word) */
  function crumbleJams(R, delay) {
    R.s.jams.forEach(function (J) {
      J.forEach(function (jm, k) { if (jm.flush == null && jm.shatter == null) { jm.flush = R.t + delay + k * .06; jm.gone = jm.flush + .6; } });
    });
  }
  function banner(R, big, small, fill, dur) { R.s.banner = { big: big, small: small, fill: fill || C.white, t0: R.t, dur: dur || 1.8 }; }
  function note(R, text, dur, col) { R.s.note = { text: text, t0: R.t, dur: dur || 1.8, bg: col || C.navy }; }
  function fx(R, o) { o.t0 = o.t0 == null ? R.t : o.t0; R.s.fx.push(o); if (R.s.fx.length > 80) R.s.fx.shift(); }
  function pop(R, col, t0, h) { var L = R.s.pops[col]; L.push([t0, h]); if (L.length > 3) L.shift(); }

  function setBins(R, wd, tags) {
    var s = R.s;
    s.prev = { bins: s.bins, tints: s.tints, tags: s.tags };
    s.bins = wd.bins; s.tints = wd.tints; s.binsT = R.t;
    if (s.title !== wd.title) { s.prevTitle = s.title; s.title = wd.title; s.titleT = R.t; }
    s.tags = tags ? tags.map(function (g) { return g ? { L: g.L, t0: R.t + .45 + Math.random() * .1, hi: g.hi } : null; }) : [null, null, null, null];
    for (var i = 0; i < 4; i++) pop(R, i, R.t + .2 + i * .07, 13);
    R.sfx('pop');
  }
  function startWave(R, w) {
    var s = R.s, wd = s.waves[w];
    if (R.over) return;
    if (s.wave >= 0) s.tagsBy[s.wave] = s.tags.slice();
    s.wave = w; s.filled = [false, false, false, false]; s.fillN = [0, 0, 0, 0]; s.blk = null; s.waveBlocks = 0;
    s.waveLen = WAVE_LEN + (w === 2 ? s.carry : 0); s.waveLeft = s.waveLen;   // wave 3 gets the seconds an early wave 1 left
    clearHints(R);
    crumbleJams(R, .1);                                   // a fresh card each wave: old jams crumble into the bins
    if (w > 0) setBins(R, wd, null); else { s.binsT = R.t; for (var i = 0; i < 4; i++) pop(R, i, R.t + .25 + i * .07, 13); }
    if (w > 0 || !s.queue.length) s.queue = buildQueue(wd);
    setPhase(R, 'banner');
    banner(R, 'WAVE ' + (w + 1), wd.banner, w === 1 ? C.lime : C.white, 1.9);
    s.hopT = R.t + .1;
    R.sfx(w ? 'flag' : 'pop');
    R.announce('Wave ' + (w + 1) + '. ' + wd.banner);
    R.after(2.0, function () { if (R.over) return; setPhase(R, 'wave'); spawn(R); });
  }
  function spawn(R) {
    var s = R.s, g = geo(R);
    if (R.over || R.hearts <= 0 || s.phase !== 'wave') return;
    clearHints(R);                                        // the last block's fix and lime row never sit over a new block
    if (s.waveLeft <= 0) return endWave(R);
    if (!s.queue.length) s.queue = buildQueue(s.waves[s.wave]);
    var e = s.queue.shift(), it = e.it, wh = fallWH(it), first = !s.firstDone, w = s.wave;
    var spawnTop = g.spawnTop, D = (g.top - 1) - (spawnTop - 3 + wh[1]);
    s.blk = { it: it, pal: e.pal, ts: R.t, wh: wh, spawnTop: spawnTop, D: Math.max(4, D), first: first,
      fall: Math.max(FALL_MIN[w], FALL0[w] - FALL_STEP * s.waveBlocks), state: 'fall' };
    s.nBlocks++; s.waveBlocks++;
    /* the video's GB beat: the first 512 GB SSD falls while the RAM tag (Up to … GB) is lit; both GBs glow */
    var ri = s.bins.indexOf('ram');
    if (it.kind === 'value' && it.slug === 'storage' && !s.gbSeen && ri >= 0 && s.tags[ri] && s.tags[ri].hi) { s.gbSeen = true; s.gbT = R.t; s.blk.gb = true; }
    R.sfx('pop');
    R.announce(it.kind === 'value' ? it.v : it.text);
  }
  function endWave(R) {
    var s = R.s;
    s.blk = null;
    if (s.wave < 2) { setPhase(R, 'break'); R.after(.35, function () { startWave(R, s.wave + 1); }); }
    else pitch(R);
  }

  /* ---------- the falling block ---------- */
  function fallS(b, t) {
    var t0 = b.ts + .34, dt = t - t0; if (dt <= 0) return 0;
    var A = .5, v = b.D / (b.fall - A / 2), s = dt < A ? v * dt * dt / (2 * A) : v * (dt - A / 2);
    return b.first ? Math.min(s, b.D - 3) : Math.min(s, b.D);
  }
  function driftTop(b, t) {
    var lift = 3 * E.out(p(t, b.ts + .12, b.ts + .32));
    return t <= b.ts + .34 ? b.spawnTop - lift : b.spawnTop - 3 + fallS(b, t);
  }
  function tappable(R) { var b = R.s.blk; return !!(b && b.state === 'fall' && R.s.phase === 'wave' && !R.over && R.t >= b.ts + .15); }
  /* where the block is at time t: {cx, bot, w, h, sx, sy, form 0..1, white, clip, alpha} or null */
  function blockAt(b, t, g) {
    if (t < b.ts) return null;
    var wh = b.wh, o = { pal: b.pal, sx: 1, sy: 1, form: 0, white: 0, clip: null, alpha: 1 };
    if (b.tapT == null || t < b.tapT) {
      var sc = .3 + .7 * E.outBackBig(p(t, b.ts, b.ts + .28)), top = driftTop(b, t);
      o.cx = HXC; o.w = wh[0]; o.h = wh[1]; o.sx = sc; o.sy = sc * (1 - jig(t, b.ts + .1, .08));
      o.white = .8 * (1 - p(t, b.ts, b.ts + .12));
      if (b.fizzT != null && t >= b.fizzT) {
        var d = t - b.fizzT; if (d > .55) return null;
        top = driftTop(b, b.fizzT) - 3 * Math.sin(Math.PI * clamp(d / .2));
        o.pal = d > .12 ? 'grey' : b.pal; o.white = d < .1 ? .7 : 0; o.alpha = 1 - p(d, .3, .55);
        o.sx = o.sy = 1 - .25 * p(d, .25, .55);
      }
      o.bot = top + wh[1] * o.sy;
      return o;
    }
    var tt = b.tapT, tl = b.tl, y0 = driftTop(b, tt), u = E.out(p(t, tt, tt + .12)), sl = p(t, tt + .25, tl);
    o.cx = HXC + (colCx(b.col) - HXC) * u; o.w = wh[0] + (BW - wh[0]) * u; o.h = wh[1] + (g.bh - wh[1]) * u; o.form = u;
    var topY = y0 + (b.land - g.bh - y0) * sl * sl;
    o.bot = topY + o.h;
    if (t >= tl) {
      var dl = t - tl, q = .3 * Math.exp(-dl * 13) * Math.cos(dl * 30);
      o.bot = b.land; o.sy = 1 - q; o.sx = 1 + q * .8; o.white = dl < .05 ? .6 : 0;
      if (b.ok) {
        var s0 = b.n ? tl + .12 + .09 * b.n : tl + .12, s1 = s0 + (b.n ? .28 : .18), sk = E.in(p(t, s0, s1));
        if (sk >= 1) return null;
        o.bot = b.land + (g.floor + g.bh + 1 - b.land) * sk; o.clip = g.floor; o.white = Math.max(o.white, sk * .75);
      } else if (dl >= .1) return null;
    }
    return o;
  }
  function blockTop(b, t, g) { var o = blockAt(b, t, g); return o ? o.bot - Math.round(o.h * o.sy) : b.land - g.bh; }
  function drawBlock(b, o, g, t) {
    var W = Math.max(4, Math.round(o.w * o.sx)), H = Math.max(4, Math.round(o.h * o.sy));
    if (o.form < .5) W = Math.min(W, 98);                   // in the drop zone it never runs into the Next box
    var x = Math.max(1, Math.min((o.form < .5 ? 99 : 129) - W, Math.round(o.cx - W / 2))), y = Math.round(o.bot - H), c = Gc.ctx, A = o.alpha;
    c.save();
    if (o.clip != null) { c.beginPath(); c.rect(-60, -2000, 520, o.clip * 3 + 2000); c.clip(); }
    blockRect(x, y, W, H, o.pal, false, A);
    var tx = (x + W / 2) * 3, ty = (y + (H - 2) / 2) * 3 + 1, fa = 1 - clamp(o.form * 2), ca = clamp(o.form * 2 - 1);
    var gb = b.it.kind === 'value' && b.it.slug === 'storage' && t >= b.ts ? glowGB(R0, t) : 0;
    if (fa > 0) { var fl = fallLines(b.it); lines(fl.L, tx, ty, { size: fl.size, weight: 800, lh: fl.lh, maxW: o.w * 3 - 24, alpha: A * fa, sx: o.sx, sy: o.sy, hi: 'GB', hiA: gb }); }
    if (ca > 0) lines(colLines(b.it), tx, ty, { size: 15, weight: 700, font: 'Figtree, sans-serif', lh: 17, maxW: o.w * 3 - 10, alpha: A * ca, sx: o.sx, sy: o.sy });
    if (o.white > 0) blockRect(x, y, W, H, 'white', false, A * clamp(o.white));
    c.restore();
  }
  var R0 = null;
  function glowGB(R, t) { var s = R.s; return p(t, s.gbT + .05, s.gbT + .35) * (1 - p(t, s.gbT + 2.6, s.gbT + 2.8)) * (.75 + .25 * Math.sin((t - s.gbT) * 7)); }

  /* ---------- input ---------- */
  function tap(R, q) {
    var s = R.s, g = geo(R);
    if (s.phase === 'idle') return wake(R);
    if (!tappable(R)) return;
    if (q.gy < g.top - 8) { s.hint = { t0: R.t, text: 'Tap a row below' }; R.sfx('tap'); return; }
    drop(R, clamp(Math.floor((q.gx - 1) / 32), 0, 3), q);
  }
  function key(R, k) {
    if (!/^[1-4]$/.test(k)) return;
    if (R.s.phase === 'idle') return wake(R);
    if (tappable(R)) drop(R, +k - 1, null);
  }
  /* two untapped blocks in a row: nobody is playing (an APC pulled away by a customer, or just watching). Stop the
     blocks and the wave clock until the next tap, so doing nothing never runs the card out to a "finished" run. */
  function goIdle(R) {
    var s = R.s;
    setPhase(R, 'idle');
    s.idle = { t0: R.t + NEXT_SLOW - .2, ok: R.t + .5 };
    R.after(NEXT_SLOW - .2, function () { if (!R.over && s.phase === 'idle') R.announce('Still there? Tap a row to go on.'); });
  }
  function wake(R) {
    var s = R.s;
    if (R.over || !s.idle || R.t < s.idle.ok) return;
    s.idle = null; s.idleN = 0;
    setPhase(R, 'wave');
    clearHints(R);
    R.sfx('tap');
    s.hopT = R.t; s.mood = 'joy'; s.moodUntil = R.t + .5;
    R.after(.45, function () { spawn(R); });
  }
  function drop(R, col, q) {
    var s = R.s, g = geo(R), b = s.blk, t = R.t;
    var n = s.jams[col].length;
    b.state = 'slam'; b.tapT = t; b.col = col; b.ok = s.bins[col] === b.it.slug; b.n = n; b.land = g.floor - n * g.slot; b.tl = t + .4;
    s.firstDone = true; s.hint = null; s.idleN = 0;
    clearHints(R);
    fx(R, { k: 'cflash', col: col, c: C.white, a: .55, life: .45 });
    fx(R, { k: 'cframe', col: col, c: C.navy, life: .45, grow: 7 });
    fx(R, { k: 'tap', x: q ? q.x : colCx(col) * 3, y: q ? q.y : (g.top + 40) * 3, life: .6 });
    R.sfx('tap'); R.after(.05, function () { R.sfx('whoosh'); });
  }

  /* ---------- outcomes ---------- */
  function update(R, dt) {
    var s = R.s, t = R.t, b = s.blk;
    R0 = R;
    if (s.phase === 'wave' && !R.over && s.firstDone) s.waveLeft = Math.max(0, s.waveLeft - dt);
    if (b && b.state === 'fall' && !b.first && !R.over && s.phase === 'wave' && fallS(b, t) >= b.D) timeout(R, b);
    if (b && b.state === 'slam' && t >= b.tl) land(R, b);
    for (var i = s.fx.length - 1; i >= 0; i--) if (t - s.fx[i].t0 > (s.fx[i].life || 1)) s.fx.splice(i, 1);
    for (var c = 0; c < 4; c++) {
      var J = s.jams[c];
      for (var j = J.length - 1; j >= 0; j--) if (J[j].gone != null && t >= J[j].gone) J.splice(j, 1);
    }
    if (s.mood !== 'happy' && t >= s.moodUntil) s.mood = 'happy';
  }
  function timeout(R, b) {
    var s = R.s, it = b.it, rc = s.bins.indexOf(it.slug);
    b.state = 'fizz'; b.fizzT = R.t;
    R.miss(it.slug, remember(it));
    s.jamN[it.slug] = (s.jamN[it.slug] || 0) + .5; s.jamT[it.slug] = R.t;
    s.fix = { text: fixText(it), t0: R.t + .15, dur: NEXT_SLOW - .2, bg: C.navy, color: C.white };
    if (rc >= 0) s.hiCol = { col: rc, t0: R.t + .1, dur: NEXT_SLOW - .15 };
    s.queue.splice(Math.min(2, s.queue.length), 0, { it: it, pal: b.pal });
    s.mood = 'hurt'; s.moodUntil = R.t + .9;
    R.sfx('wrong'); R.announce('Too slow. ' + fixText(it));
    s.idleN++;
    if (s.idleN >= 2 && s.waveLeft > 0) goIdle(R);       // the fix still plays out; then the game waits for a tap
    else R.after(NEXT_SLOW, function () { spawn(R); });
  }
  function land(R, b) {
    var s = R.s, g = geo(R), t = R.t, it = b.it, col = b.col, slug = it.slug, cx = colCx(col);
    b.state = b.ok ? 'sink' : 'jammed';
    R.sfx('bump'); R.shake(b.ok ? 2.5 : 4); s.thudT = t; s.thudA = b.ok ? 1.4 : 2.2;
    fx(R, { k: 'impact', col: col, bot: b.land, life: .5 });
    fx(R, { k: 'badge', col: col, ok: b.ok, y: (b.land - g.bh) * 3 - 6, life: .7 });
    if (b.ok) {
      var sy = (b.land - g.bh) * 3, nd = .09 * b.n;
      R.good(slug, { sparks: 0 });
      R.after(.35, function () { if (!R.over) R.addSparks(1, cx * 3, sy); });   // its coin lands after the model word
      R.float('+1', cx * 3, sy - 14);
      s.rowSp[slug] = (s.rowSp[slug] || 0) + 1;
      fx(R, { k: 'cflash', col: col, c: C.lime, a: .5, life: .6 });
      fx(R, { k: 'mouth', col: col, t0: t + .08, life: .7 });
      fx(R, { k: 'spark', col: col, pal: b.pal, t0: t + .12 + nd, life: .8 });
      pop(R, col, t + .1 + nd, 13);
      if (!b.n) R.after(.12, function () { R.sfx('pop'); });          // a cascade has its crack; no pop over the word
      R.after(.2, function () { R.word(slug); });                      // every right answer plays the word once
      s.tags[col] = { L: tagLines(it), t0: t + .35 + nd, hi: it.kind === 'value' && it.v.indexOf('GB') >= 0 };
      if (b.n) cascade(R, col, b);
      s.mood = 'joy'; s.moodUntil = t + .8;
      s.filled[col] = true; s.fillN[col]++;
      /* wave 1 has only 4 meanings: once every bin has been filled twice, end it early; wave 3 gets the seconds left */
      if (s.wave === 0 && !s.early && s.fillN.every(function (n2) { return n2 >= 2; }) && s.waveLeft > 0) { s.early = true; s.carry = Math.round(s.waveLeft); s.waveLeft = 0; }
      if (!s.full[s.wave] && s.filled.every(Boolean)) { s.full[s.wave] = true; R.after(1.0 + nd, function () { fullCard(R); }); }
      else R.after(NEXT_OK + nd, function () { spawn(R); });
    } else {
      var rc = s.bins.indexOf(slug);
      s.jams[col].push({ it: it, t0: t + .07 });
      R.bad(slug, remember(it));
      s.jamN[slug] = (s.jamN[slug] || 0) + 1; s.jamT[slug] = t;
      s.fix = { text: fixText(it), t0: t + .2, dur: NEXT_BAD - .2, bg: C.coral, color: C.white };
      if (rc >= 0) s.hiCol = { col: rc, t0: t + .2, dur: NEXT_BAD - .2 };
      fx(R, { k: 'cflash', col: col, c: C.coral, a: .45, blink: true, life: .6 });
      R.after(.05, function () { R.sfx('hurt'); });
      s.mood = 'hurt'; s.moodUntil = t + 1.0;
      if (s.jams[col].length >= 4) { R.after(.5, function () { overflow(R, col); }); R.after(NEXT_FLUSH, function () { spawn(R); }); }
      else R.after(NEXT_BAD, function () { spawn(R); });
    }
  }
  /* a right drop on a jammed column: the jams shatter top to bottom and the block drops through into the bin */
  function cascade(R, col, b) {
    var s = R.s, g = geo(R), t = R.t, J = s.jams[col], n = J.length, slug = b.it.slug;
    for (var k = n - 1, i = 0; k >= 0; k--, i++) { J[k].shatter = t + .06 + i * .09; J[k].gone = J[k].shatter + .02; fx(R, { k: 'shatter', col: col, slot: k, t0: J[k].shatter, life: .9 }); }
    R.after(.08, function () { R.sfx('crack'); });
    /* no sparks for the cleared jams: the wrong drops that made them must still cost (the score tracks right answers) */
    s.cleared = { col: col, n: n, t0: t + .2 };
    for (var j = 0; j < 3; j++) R.burst(colCx(col), g.floor - 20 + j * 9, 12, [C.lime, C.white, C.gold, j ? C.mint : C.grey]);
  }
  function overflow(R, col) {
    var s = R.s, t = R.t, J = s.jams[col];
    if (R.dead) return;
    R.sfx('crack'); R.after(.06, function () { R.sfx('hurt'); });
    var left = R.loseHeart();
    s.hotT = t; s.danger = { t0: t, col: col };
    R.shake(5);
    J.forEach(function (jm, k) { jm.flush = t + .35 + k * .06; jm.gone = jm.flush + .6; });
    R.announce('Four jams. You lose a heart.');
    if (left <= 0) { setPhase(R, 'out'); if (s.blk) s.blk = null; R.after(1.6, function () { R.end({ reason: 'out' }); }); }
  }
  /* every bin filled: the banner, and all 4 ghost tags show the whole card for FULL_SHOW s (the wave clock waits) */
  function fullCard(R) {
    var s = R.s;
    if (R.over) return;
    if (s.phase !== 'wave') return spawn(R);
    setPhase(R, 'full');
    s.fullT = R.t; s.hopT = R.t + .05;
    R.sfx('powerup'); R.flash(.35);
    R.addSparks(5, 195, bannerY(R) + 60);
    R.announce('Full spec card. Plus 5 sparks.');
    R.after(FULL_SHOW, function () { if (R.over || s.phase !== 'full') return; setPhase(R, 'wave'); spawn(R); });
  }

  /* ---------- the end: pitch the card (Say-it on the most-jammed row word, else Storage) ---------- */
  function sayWord(s) {
    var best = null, n = 0;
    Object.keys(s.jamN).forEach(function (w) { var v = s.jamN[w]; if (v > n || (v === n && best && s.jamT[w] > s.jamT[best])) { n = v; best = w; } });
    return best || 'storage';
  }
  function pitch(R) {
    var s = R.s, g = geo(R), slug = sayWord(s), wait = .25;
    setPhase(R, 'pitch');
    s.endT = R.t;
    clearHints(R);
    s.tagsBy[s.wave] = s.tags.slice();
    s.sayWord = slug;
    rememberFirst(R, slug);
    if (s.bins.indexOf(slug) < 0) {                       // show the card the word lives on (the Nitro 5 card first)
      var wi = s.waves[1].bins.indexOf(slug) >= 0 ? 1 : s.waves[0].bins.indexOf(slug) >= 0 ? 0 : 2;
      crumbleJams(R, .05);                                // wave 3's jams must not sit under the other card's words
      setBins(R, s.waves[wi], s.tagsBy[wi]);
      wait = .8;
    }
    var col = Math.max(0, s.bins.indexOf(slug));
    s.pitch = { col: col, t0: R.t + wait };
    s.pan = { from: 0, to: panFor(R, g, R.G.SH - estSay(R)), t0: R.t + wait, dur: .6 };
    R.sfx('pause');
    R.after(wait + .85, function () { openSay(R); });
  }
  /* the end card lists only the first 6 misses: put the pitch word first, then the most-missed words */
  function rememberFirst(R, slug) {
    var m = R.missed; if (!m || m.length < 2) return;
    var order = m.map(function (x, i) { return [x.slug === slug ? 1 : 0, x.n || 1, -i, x]; });
    order.sort(function (a, b) { return (b[0] - a[0]) || (b[1] - a[1]) || (b[2] - a[2]); });
    for (var i = 0; i < m.length; i++) m[i] = order[i][3];
  }
  /* the Say-it card's height in sp (measured on 360/390/430 phones; corrected once it is open) */
  function estSay(R) { return 500 + R.G.bot; }
  function panFor(R, g, sayTop) {
    var need = g.cardB + 2 - (sayTop - 8) / 3, clip = (R.layout.hudY + 24) / 3;
    var short = need - (g.floor - 37 - clip), extra = clamp(short, 0, 8);
    R.s.pointOff = 15 - extra;                              // Lau's feet above the bin while he points (lower on short phones)
    var tip = clamp(short - 8, 0, 3);                       // very short phones: up to 3 px of his flame tip slips under the
    var most = g.floor - (R.s.pointOff + 22 - tip) - clip;  // HUD line, so the bin labels clear the Say-it card's top
    return Math.max(0, Math.min(Math.ceil(need), Math.floor(most)));
  }
  /* when the pitched row lets go of its lime frame: when the card slides away, or after the bonus pill has shown */
  function pitchOut(s) { return s.pitch.out == null ? null : s.x2 ? s.x2.t0 + 1.5 : s.pitch.out; }
  function panNow(s, t) { var u = E.inOut(p(t, s.pan.t0, s.pan.t0 + s.pan.dur)); return s.pan.from + (s.pan.to - s.pan.from) * u; }
  function openSay(R) {
    var s = R.s, g = geo(R), slug = s.sayWord;
    if (R.over || R.dead) return;
    setPhase(R, 'say');
    var pr = R.say({ slug: slug, title: 'Pitch the card', sub: 'Say the row word', tip: BK.TIPS[slug] });
    try {                                                   // the card is open now: line the bins up just above it
      var el = R.el.querySelector('.arc-say'), cv = R.G.cv;
      if (el && el.offsetParent) {
        var top = (el.offsetParent.getBoundingClientRect().top + el.offsetTop - cv.getBoundingClientRect().top) / R.G.css;
        var to = panFor(R, g, top);
        if (Math.abs(to - s.pan.to) >= 1) { s.pan = { from: to, to: to, t0: R.t - 1, dur: .6 }; R.dirty = true; }
      }
    } catch (e) {}
    pr.then(function (res) {
      if (R.dead) return;
      var col = Math.max(0, s.bins.indexOf(slug));
      s.pan = { from: panNow(s, R.t), to: 0, t0: R.t, dur: .5 };
      setPhase(R, 'cheer');
      s.pitch.out = R.t;
      if (res.passed) {
        var base = s.rowSp[slug] || 0, full = Math.max(2, base), bonus = res.method === 'tap' ? Math.max(1, Math.ceil(full / 2)) : full;
        s.mood = 'joy'; s.moodUntil = R.t + 2;
        R.after(.55, function () {
          s.x2 = { t0: R.t, col: col, text: labelFor(slug) + ' row ' + (res.method !== 'tap' && base >= 2 ? '×2 · +' : '+') + bonus };
          var xb = pillBox(s.x2.text, colCx(col) * 3, 18, PX.ember());     // the sparks leave from the pill's "+N" end,
          R.addSparks(bonus, xb.x + xb.w - 22, (g.floor - 13) * 3);          // up and away from its text
          s.rowSp[slug] = base + bonus;
          R.sfx('powerup');
          s.read = { t0: R.t + .7 };
          R.end({ reason: 'done', delay: 3.0 });
        });
      } else {
        note(R, 'Keep practising: ' + BK.word(slug).say, 2);
        R.after(.5, function () { R.end({ reason: 'done', delay: 1.8 }); });
      }
    });
  }

  /* ---------- Lau ---------- */
  function lauState(R, t) {
    var s = R.s, g = geo(R), b = s.blk, hov = g.hf + bobY(t);
    var st = { x: HXC, feet: hov, sq: 0, look: [.3, .6], mood: s.mood, zip: false };
    var jh = jumpY(t, s.hopT, .42, 6);                     // a low hop (the header strip clips him anyway)
    if (jh > 0) { st.feet -= jh; st.mood = 'joy'; st.look = [0, -.5]; }
    st.sq += jig(t, s.hopT + .42, .2);
    if (b) {
      if (b.tapT == null) {
        if (t >= b.ts && t < b.ts + .1) { st.feet = lerp(hov, b.spawnTop, E.in(p(t, b.ts, b.ts + .1))); st.sq = -.08; }
        else if (t >= b.ts + .1 && (b.fizzT == null || t < b.fizzT)) {
          st.feet = driftTop(b, t); st.look = [t > b.ts + .8 ? .7 * Math.sin((t - b.ts - .8) * 1.3) : 0, 1];
          st.sq = t < b.ts + .34 ? jig(t, b.ts + .1, .26) - .12 * Math.sin(Math.PI * p(t, b.ts + .14, b.ts + .34)) : 0;
        } else if (b.fizzT != null && t >= b.fizzT && t < b.fizzT + .45) {
          var fu = p(t, b.fizzT, b.fizzT + .45);
          st.feet = lerp(driftTop(b, b.fizzT), hov, E.out(fu)) - 6 * Math.sin(Math.PI * fu); st.mood = 'hurt';
        }
      } else {
        var tt = b.tapT, tl = b.tl, cx = colCx(b.col), y0 = driftTop(b, tt);
        if (t >= tt && t < tt + .25) {
          st.x = blockAt(b, t, g).cx; st.feet = y0; st.zip = t < tt + .16;
          st.sq = t < tt + .12 ? -.12 : -.2 * E.out(p(t, tt + .12, tt + .25)); st.look = t < tt + .12 ? [cx > HXC ? 1 : -1, .5] : [0, 1];
        } else if (t >= tt + .25 && t < tl + .04) {
          st.x = cx; st.feet = blockTop(b, t, g); st.sq = t < tl ? -.2 : .32; st.look = [0, 1];
        } else if (t >= tl + .04 && t < tl + (b.ok ? .38 : .52)) {
          var dur = b.ok ? .34 : .48, u = p(t, tl + .04, tl + .04 + dur);
          st.x = lerp(cx, HXC, E.inOut(u)) + (b.ok ? 0 : Math.round(Math.sin(u * 18) * 2 * (1 - u)));
          st.feet = lerp(b.land - g.bh, hov, E.out(u)) - 8 * Math.sin(Math.PI * u); st.sq = -.22 * (1 - u); st.look = b.ok ? [0, -.6] : [0, 0];
        }
        if (t >= tl && t < tl + .7) st.mood = b.ok ? 'joy' : 'hurt';
        if (t >= tl + .38 && t < tl + .52 && b.ok) st.sq += jig(t, tl + .38, .2);
      }
    }
    if (s.danger && t >= s.danger.t0 && t < s.danger.t0 + .6) { st.mood = 'hurt'; st.x += (Math.floor(t * 30) % 2) ? 1 : -1; }
    if (s.pitch) {                                         // fly over the row and point at it
      var pc = colCx(s.pitch.col), px = pc, pf = g.floor - (s.pointOff || 15) + bobY(t);
      var go = E.inOut(p(t, s.pitch.t0, s.pitch.t0 + .6)), back = s.pitch.out != null ? E.inOut(p(t, s.pitch.out, s.pitch.out + .5)) : 0;
      st.x = lerp(lerp(HXC, px, go), HXC, back);
      st.feet = lerp(lerp(hov, pf, go), hov, back) - 8 * Math.sin(Math.PI * go) * (1 - back) - 8 * Math.sin(Math.PI * back);
      st.look = [0, 1]; st.sq = 0;
    }
    if (s.read) {                                          // read the card row by row
      var r0 = s.read.t0, path = [[r0 - .2, HXC]];
      for (var i = 0; i < 4; i++) path.push([r0 + i * .45, colCx(i)]);
      path.push([r0 + 4 * .45 + .2, HXC]);
      for (var j = 1; j < path.length; j++) {
        var A = path[j - 1], B2 = path[j];
        if (t >= A[0] && t < B2[0]) { var ru = p(t, A[0], B2[0]); st.x = lerp(A[1], B2[1], E.inOut(ru)); st.feet = hov + 3 - 7 * Math.sin(Math.PI * ru); st.sq = jig(t, A[0], .2); st.mood = 'joy'; st.look = [0, 1]; break; }
      }
    }
    st.blink = (st.mood === 'happy' && ((t + .3) % 2.7) < .1) ? 1 : 0;
    st.look = [Math.round(st.look[0] * 10) / 10, Math.round(st.look[1] * 10) / 10];
    return st;
  }
  function lauSpr(st, t) { return PX.lau({ h: 18, frame: Math.floor(t * 8) % 4, look: st.look, mood: st.mood, blink: st.blink }); }
  function drawLau(R, t, st, g) {
    var c = Gc.ctx;
    c.save(); c.beginPath(); c.rect(-60, g.headB * 3, 520, 4000); c.clip();   // he never covers the header title
    if (st.zip) [.05, .025].forEach(function (dt, j) { var q = lauState(R, t - dt); put(lauSpr(q, t), q.x, q.feet, { alpha: j ? .4 : .2 }); });
    put(lauSpr(st, t), st.x, st.feet, { sx: 1 + st.sq * .8, sy: 1 - st.sq });
    c.restore();
  }

  /* ---------- drawing ---------- */
  function bannerY(R) { var g = geo(R); return Math.round(((g.top + 34) * 3)); }
  function drawBackdrop(G, t, g) {
    [[14, 3, 26, 1.2], [92, 7, 20, 2], [150, 2, 30, .8]].forEach(function (q) {
      var x = ((q[0] - t * q[3]) % 170 + 170) % 170 - 34;
      G.spr(PX.cloud(q[2]), x, q[1], { alpha: .9 });
    });
    for (var i = 0; i < 6; i++) G.rect(((hash(i * 9.3) * 140 - t * (2 + i)) % 140 + 140) % 140 - 4, g.cardB + 2 + (i % 3) * 2, 2, 1, C.white, .7);
  }
  function drawDropZone(G, t, g) {
    var c = G.ctx, i, HB = g.headB, TL = g.top;
    c.save(); c.beginPath(); c.rect(3, HB * 3, 384, (TL - HB) * 3); c.clip();
    for (i = 0; i < 5; i++) {
      var sp = 1.2 + (i % 2) * 1.4, bw = i % 2 ? 10 : 7, bh = i % 2 ? 5 : 4, P = 150, bc = i % 2 ? C.white : '#DCE2FF', ba = i % 2 ? .75 : .9;
      var tx = Math.round(((hash(i * 5.3 + 2) * P - t * sp) % P + P) % P - 12), ty = HB + 5 + Math.floor(hash(i * 2.7) * (TL - HB - 14)) + Math.round(Math.sin(t * .7 + i * 2) * 2);
      G.rect(tx + 1, ty, bw - 2, 1, bc, ba); G.rect(tx, ty + 1, bw, bh - 2, bc, ba); G.rect(tx + 1, ty + bh - 1, bw - 2, 1, bc, ba);
    }
    for (i = 0; i < 10; i++) {
      var dep = i % 3, v = [2.5, 5, 9][dep], bx = ((hash(i * 3.1) * 136 - t * v) % 136 + 136) % 136 - 3;
      var by = HB + 3 + Math.floor(hash(i * 7.7) * (TL - HB - 8)) + Math.round(Math.sin(t * 1.3 + i) * 1.5);
      G.rect(bx, by, dep === 2 ? 2 : 1, dep === 2 ? 2 : 1, dep === 0 ? C.peri : C.white, dep === 0 ? .45 : .95);
    }
    c.restore();
  }
  function drawHeader(R, G, t, g) {
    var s = R.s, ty = (g.cardT + 5.2) * 3;
    var to = p(t, s.titleT, s.titleT + .15), ti = p(t, s.titleT + .15, s.titleT + .35);   // the old title out, then the new one in
    if (s.prevTitle && to < 1) G.text(s.prevTitle, 195, ty, { size: 15, weight: 700, color: C.white, alpha: 1 - to });
    else G.text(s.title, 195, ty, { size: 15, weight: 700, color: C.white, alpha: s.prevTitle ? ti : 1 });
    var y = g.headB - 2, frac = /^(wave|banner|intro|full|idle)$/.test(s.phase) ? s.waveLeft / s.waveLen : 0;
    if (s.phase === 'pitch' || s.phase === 'say' || s.phase === 'cheer') return;
    G.rect(3, y, 124, 1, C.navy2);
    var low = s.waveLeft < 5 && s.phase === 'wave', fc = low && Math.floor(t * 4) % 2 ? C.coral : C.lime;
    if (frac > 0) G.rect(3, y, Math.max(1, Math.round(124 * frac)), 1, fc);
  }
  function colFlash(G, g, i, col, a) { if (a > 0) G.rect(COLX[i], g.top, BW, g.cardB - 2 - g.top, col, clamp(a)); }
  function colFrame(G, g, i, col, a, grow) {
    if (a <= 0) return;
    var c = G.ctx, gr = grow || 0; c.save(); c.globalAlpha *= clamp(a); c.strokeStyle = col; c.lineWidth = 5;
    PX.roundRect(c, COLX[i] * 3 + 3 - gr, g.top * 3 + 3 - gr, BW * 3 - 6 + 2 * gr, (g.cardB - 2 - g.top) * 3 - 6 + 2 * gr, 12); c.stroke(); c.restore();
  }
  function drawColumnFX(R, G, t, g) {
    var s = R.s, i;
    s.fx.forEach(function (f) {
      var d = t - f.t0; if (d < 0) return;
      if (f.k === 'cflash') { var u = d / f.life; colFlash(G, g, f.col, f.c, (f.blink ? (Math.floor(d / .1) % 2 ? .3 : 1) : 1) * f.a * (1 - u)); }
      else if (f.k === 'cframe') { var u2 = d / f.life; colFrame(G, g, f.col, f.c, 1 - u2, f.grow * (1 - E.out(clamp(d / .15)))); }
    });
    if (s.hiCol) { var h = s.hiCol, hd = t - h.t0; if (hd >= 0 && hd < h.dur) colFrame(G, g, h.col, C.limeDk, (.55 + .45 * Math.sin(hd * 9)) * (1 - p(hd, h.dur - .3, h.dur))); }
    var f0 = p(t, s.fullT, s.fullT + .1) * (1 - p(t, s.fullT + .6, s.fullT + .9));
    for (i = 0; i < 4; i++) {
      var ff = p(t, s.fullT + i * .08, s.fullT + .1 + i * .08) * (1 - p(t, s.fullT + .5 + i * .05, s.fullT + .85));
      if (ff > 0 && f0 >= 0) colFlash(G, g, i, C.lime, .32 * ff);
      if (s.read) { var r = t - (s.read.t0 + i * .45); if (r >= 0 && r < .55) { var ru = r / .55; colFlash(G, g, i, C.lime, .3 * Math.sin(Math.PI * ru)); colFrame(G, g, i, C.limeDk, Math.sin(Math.PI * ru)); } }
    }
    /* "tap a row" hints pulse all 4 columns together, so a hint never looks like it frames the answer */
    if (s.hint && s.hint.text && t - s.hint.t0 < 1.6) { var hp = (t - s.hint.t0) / .6; if (hp > 0 && hp < 2) for (i = 0; i < 4; i++) colFrame(G, g, i, C.navy, Math.sin(Math.PI * (hp % 1)) * .7); }
    var b = s.blk;
    if (b && b.first && b.state === 'fall' && t > b.ts + 1.4) { var ph = ((t - b.ts - 1.4) * .8) % 1.4; if (ph < 1) for (i = 0; i < 4; i++) colFrame(G, g, i, C.navy, Math.sin(Math.PI * ph) * .5); }
    if (s.phase === 'idle' && s.idle && t > s.idle.t0) { var ip = ((t - s.idle.t0) * .8) % 1.4; if (ip < 1) for (i = 0; i < 4; i++) colFrame(G, g, i, C.navy, Math.sin(Math.PI * ip) * .5); }
  }
  function drawTopLine(R, G, t, g) {
    var s = R.s, TL = g.top;
    for (var i = 0; i < 4; i++) {
      var warm = s.jams[i].length >= 3 && !s.jams[i].some(function (j) { return j.shatter != null || j.flush != null; });
      var pu = .5 + .5 * Math.sin(t * 8);
      for (var x = COLX[i] + 1; x < COLX[i] + BW; x += 4) G.rect(x, TL - 1, 2, 1, warm ? C.coral : C.navy, warm ? .55 + .45 * pu : .22);
      if (warm) G.rect(COLX[i], TL - 3, BW, 2, C.coral, .15 + .2 * pu);
    }
    var hot = p(t, s.hotT, s.hotT + .1) * (1 - p(t, s.hotT + .9, s.hotT + 1.3));
    if (hot > 0) { var pu2 = .5 + .5 * Math.sin((t - s.hotT) * 16); G.rect(1, TL - 2, 128, 2, C.coral, hot * (.45 + .55 * pu2)); G.rect(1, TL - 4, 128, 2, C.coral, hot * .18 * pu2); }
  }
  function drawMouths(R, G, t, g) {
    R.s.fx.forEach(function (f) {
      if (f.k !== 'mouth') return;
      var d = t - f.t0; if (d < 0) return;
      var a = p(d, 0, .06) * (1 - p(d, .32, .62)), x = COLX[f.col] + 2;
      if (a > 0) { G.rect(x, g.floor, BW - 4, 2, C.lime, a); G.rect(x, g.floor - 2, BW - 4, 2, C.lime, a * .35); G.rect(x + 2, g.floor - 4, BW - 8, 2, C.lime, a * .15); }
    });
  }
  function labelFor(slug) { return BK.label(slug); }
  function drawLabels(R, G, t, g) {
    var s = R.s, c = G.ctx, swapIn = s.binsT;
    for (var i = 0; i < 4; i++) {
      var on = false, sc = 1, slug = s.bins[i], tIn = swapIn + .18 + i * .07;
      if (s.prev && t < tIn) { slug = s.prev.bins[i]; sc = 1 - E.in(p(t, swapIn, swapIn + .15)); }
      else if (t < tIn + .3) sc = E.outBack(p(t, tIn, tIn + .3));
      if (s.hiCol && s.hiCol.col === i) { var hd = t - s.hiCol.t0; if (hd >= 0 && hd < s.hiCol.dur) { on = hd < 1 ? Math.floor(hd / .2) % 2 === 0 : true; sc *= 1 + .12 * Math.sin(Math.PI * p(hd, 0, .25)); } }
      if (s.read) { var r = t - (s.read.t0 + i * .45); if (r >= 0 && r < .55) { on = true; sc *= 1 + .1 * Math.sin(Math.PI * r / .55); } }
      if (s.pitch && s.pitch.col === i && t >= s.pitch.t0 && (pitchOut(s) == null || t < pitchOut(s) + .3)) on = true;
      if (sc <= .02) continue;
      var lab = labelFor(slug); c.save(); c.font = '800 15px Lexend, sans-serif'; var tw = c.measureText(lab).width; c.restore();
      G.pill(lab, colCx(i) * 3, g.labelY, { size: 15, weight: 800, pad: tw > 80 ? 4 : 6, bg: on ? C.lime : C.white, color: C.navy, border: C.navy, borderW: 2.5, shadow: false, scale: sc });
    }
  }
  function crewLift(R, i, t) {
    var y = 0, sq = 0, sc = 1;
    R.s.pops[i].forEach(function (q) {
      var big = q[1] > 10, dur = big ? .5 : .34, u = (t - q[0]) / dur;
      if (u > 0 && u < 1) { y = Math.max(y, 4 * q[1] * u * (1 - u)); sq = big ? -.14 * (1 - u) : 0; if (big) sc = 1 + .32 * Math.sin(Math.PI * u); }
      if (t >= q[0] - .07 && t < q[0]) sq = .22;
      sq += jig(t, q[0] + dur, big ? .3 : .16);
    });
    return { y: y, sq: sq, sc: sc };
  }
  function drawCrew(R, G, t, g, lauX) {
    var s = R.s;
    for (var i = 0; i < 4; i++) {
      var slug = s.bins[i], tIn = s.binsT + .18 + i * .07, sc0 = 1;
      if (s.prev && t < tIn) { slug = s.prev.bins[i]; sc0 = 1 - E.in(p(t, s.binsT, s.binsT + .15)); if (sc0 <= .05) continue; }
      var L = crewLift(R, i, t), look = [clamp((lauX - colCx(i)) / 40, -1, 1), -1];
      if (L.y > 2) look = [0, -1];
      var spr = crewSpr(slug, look, t);
      put(spr, colCx(i), g.crewB - L.y, { sx: (1 + L.sq * .8) * L.sc * sc0, sy: (1 - L.sq) * L.sc * sc0 });
      s.pops[i].forEach(function (q) { if (q[1] > 10) { var d = t - q[0]; if (d >= 0 && d < .7) burstAt(G, d, colCx(i), g.crewB - 12, 16, q[0]); } });
    }
  }
  /* a pure-of-time burst (like the video's AV.burst) so it follows the card's pan */
  function burstAt(G, d, gx, gy, n, seed, cols) {
    cols = cols || [C.lime, C.gold, C.white, C.peri, C.mint];
    var u = d / .7;
    for (var j = 0; j < n; j++) {
      var a = hash(j + seed * 7) * Math.PI * 2, sp = 14 + hash(j * 3.1 + seed) * 22;
      G.rect(gx + Math.cos(a) * sp * u, gy + Math.sin(a) * sp * u + 10 * u * u, 1, 1, cols[j % cols.length], 1 - u);
    }
  }
  /* how much the ghost tag over bin i shows (0..1). Never while a block is falling: a tag printed over its bin would
     let every later block be answered by text matching ("The screen" falls, "The screen" sits over Display). They fade
     out as a block appears and come back for the slam / sink, the fix after a miss, FULL SPEC CARD (the wave waits
     FULL_SHOW s while all 4 show), the pitch and the read-through. Exception: the video's GB beat, the RAM tag
     (Up to … GB) while the first 512 GB SSD falls, until its glow ends. */
  function tagVis(R, t, i) {
    var s = R.s, b = s.blk;
    if (s.pitch || s.read || !b || t < b.ts) return 1;
    if (b.tapT != null) return p(t, b.tapT, b.tapT + .2);
    if (b.fizzT != null) return p(t, b.fizzT + .3, b.fizzT + .5);
    if (b.gb && s.bins[i] === 'ram') return 1 - p(t, s.gbT + 2.6, s.gbT + 2.9);
    return 1 - p(t, b.ts, b.ts + .12);                    // gone before the block can be tapped (ts + .15)
  }
  function drawTags(R, G, t, g) {
    var s = R.s, c = G.ctx, gb = glowGB(R, t);
    for (var i = 0; i < 4; i++) {
      var tg = s.tags[i], out = 0, vis = tagVis(R, t, i);
      if (s.prev && t < s.binsT + .25) { tg = s.prev.tags ? s.prev.tags[i] : null; out = p(t, s.binsT, s.binsT + .2); }
      if (!tg || vis <= 0) continue;
      var a = E.outBack(p(t, tg.t0, tg.t0 + .25)) * vis; if (a <= 0 || out >= 1) continue;
      var L = tg.L, h = L.length * 17 + 11, w = 91, x = COLX[i] * 3 + 1, y = g.tagY - Math.round(Math.max(0, crewLift(R, i, t).y - 2) * 3), cx = x + w / 2, cy = y + h / 2;
      var r = s.read ? t - (s.read.t0 + i * .45) : -1, pul = r >= 0 && r < .55 ? .04 * Math.sin(Math.PI * r / .55) : 0;
      var sc = (.4 + .6 * a) * (1 - out * .6) + pul;
      c.save(); c.globalAlpha *= clamp(Math.min(1, a * 2) * (1 - out)); c.translate(cx, cy); c.scale(sc, sc); c.translate(-cx, -cy);
      G.box(x, y, w, h, { bg: C.white, border: C.navy, borderW: 2.5, r: 9, shadow: false });
      lines(L, cx, cy, { size: 15, weight: 700, font: 'Figtree, sans-serif', lh: 17, maxW: w - 6, hi: tg.hi ? 'GB' : null, hiA: gb });
      c.restore();
    }
  }
  function drawNext(R, G, t, g) {
    var s = R.s, N = g.next, c = G.ctx;
    var show = /^(wave|banner|break|intro|full|idle)$/.test(s.phase);
    var fade = show ? 1 : 1 - p(t, s.endT || t, (s.endT || t) + .2); if (fade <= 0) return;
    c.save(); c.globalAlpha *= fade;
    pround(N.x, N.y, N.w, N.h, C.navy); pround(N.x + 1, N.y + 1, N.w - 2, N.h - 2, C.white);
    G.text('Next', (N.x + N.w / 2) * 3, (N.y + 6) * 3 + 1, { size: 15, weight: 800, color: C.navy });
    var nx = s.queue[0], b = s.blk, inn = b ? E.outBackBig(p(t, b.ts + .12, b.ts + .36)) : 1;
    if (nx && s.phase !== 'break' && !(s.phase === 'wave' && s.waveLeft <= 0)) {
      var sc = inn, W = Math.max(4, Math.round(17 * sc)), H = Math.max(4, Math.round(11 * sc)), x = Math.round(N.x + N.w / 2 - W / 2), y = Math.round(N.y + 20 - H / 2);
      blockRect(x, y, W, H, nx.pal, false);
      if (sc > .8) { G.rect(x + 3, y + 3, W - 7, 1, C.white, .85); G.rect(x + 3, y + 5, W - 10, 1, C.white, .85); }
    }
    c.restore();
  }
  function drawJams(R, G, t, g) {
    var s = R.s, c = G.ctx;
    for (var col = 0; col < 4; col++) {
      var J = s.jams[col];
      for (var k = 0; k < J.length; k++) {
        var jm = J[k]; if (t < jm.t0) continue;
        if (jm.shatter != null && t >= jm.shatter) continue;
        var d = t - jm.t0, q = .25 * Math.exp(-d * 12) * Math.cos(d * 28), sh = d < .4 && !RM ? Math.round(U.jiggle(t, jm.t0, 1.6, 70, 9)) : 0;
        if (s.danger && s.danger.col === col && t >= s.danger.t0 && t < s.danger.t0 + .35) sh += Math.floor(t * 30) % 2 ? 1 : -1;
        var bot = g.floor - k * g.slot, a = 1;
        if (jm.flush != null && t >= jm.flush) { var fu = (t - jm.flush) / .6; bot += 40 * fu * fu; a = 1 - fu; }
        var W = Math.round(BW * (1 + q * .6)), H = Math.round(g.bh * (1 - q)), x = Math.round(colCx(col) - W / 2) + sh, y = Math.round(bot - H);
        c.save();
        if (jm.flush != null) { c.beginPath(); c.rect(-60, -2000, 520, g.floor * 3 + 2000 + 6); c.clip(); }
        var tx = (x + W / 2) * 3, ty = (y + (H - 2) / 2) * 3, JL = jamLines(jm.it), two = JL.length > 1 && g.bh * 3 >= 72;
        blockRect(x, y, W, H, 'grey', two ? 2 : true, a);
        if (two) {                                         // "jam" + 2 lines of 15 sp (needs a 24+ px slot)
          lines(['jam'], tx, ty - 21, { size: 18, weight: 800, color: C.navy, alpha: a });
          lines(JL, tx, ty + 8, { size: 15, weight: 700, font: 'Figtree, sans-serif', lh: 17, color: C.navy2, maxW: 84, alpha: a });
        } else {
          lines(['jam'], tx, ty - 10, { size: 18, weight: 800, color: C.navy, alpha: a });
          lines([JL.length > 1 ? jamLabel(jm.it) : JL[0]], tx, ty + 12, { size: 15, weight: 700, font: 'Figtree, sans-serif', color: C.navy2, maxW: 84, alpha: a });
        }
        var wf = 1 - d / .16; if (wf > 0) blockRect(x, y, W, H, 'white', false, clamp(wf) * a);
        c.restore();
      }
      /* the count badge on the top jam: 4 jams cost a heart */
      var live = J.filter(function (j) { return t >= j.t0 && j.shatter == null && j.flush == null; }).length;
      if (live >= 1) {
        var lt = J[live - 1].t0, sb = E.outBackBig(p(t, lt + .05, lt + .25)), show = live >= 2 || t - lt < 1.6;
        if (show && sb > 0) {
          var bx = COLX[col] * 3 + 79, by = (g.floor - (live - 1) * g.slot - g.bh) * 3 + 16;
          c.save(); c.translate(bx, by); c.scale(sb, sb);
          c.fillStyle = live >= 3 ? C.coral : C.navy; c.beginPath(); c.arc(0, 0, 12, 0, Math.PI * 2); c.fill();
          c.lineWidth = 2.5; c.strokeStyle = C.white; c.stroke();
          G.text(String(live), 0, 1, { size: 16, weight: 800, color: C.white });
          c.restore();
        }
      }
    }
  }
  function drawShatter(R, G, t, g) {
    R.s.fx.forEach(function (f) {
      if (f.k !== 'shatter') return;
      var d = t - f.t0; if (d < 0 || d > .9) return;
      var x0 = COLX[f.col], y0 = g.floor - f.slot * g.slot - g.bh;
      for (var i = 0; i < 16; i++) {
        var hx = hash(i * 1.7 + 3 + f.slot), hy = hash(i * 2.9 + 1 + f.slot), sz = 2 + Math.floor(hash(i * 4.3) * 2);
        var sx = x0 + 3 + hx * (BW - 6), sy = y0 + 3 + hy * (g.bh - 6), vx = (hx - .5) * 110, vy = -40 - hash(i * 6.1) * 60;
        G.rect(sx + vx * d, sy + vy * d + 160 * d * d, sz, sz, [C.grey, C.greyDk, C.white, '#C2C6D6'][i % 4], 1 - p(d, .55, .9));
      }
      if (d < .12) G.rect(x0, y0, BW, g.bh, C.white, .9 * (1 - d / .12));
      var ring = d / .35;
      if (ring < 1) { var c = G.ctx; c.save(); c.globalAlpha *= 1 - ring; c.strokeStyle = C.lime; c.lineWidth = 5; c.beginPath(); c.arc(colCx(f.col) * 3, (y0 + g.bh / 2) * 3, 20 + ring * 70, 0, Math.PI * 2); c.stroke(); c.restore(); }
    });
  }
  function drawImpacts(R, G, t, g) {
    var s = R.s, b = s.blk;
    s.fx.forEach(function (f) {
      var d = t - f.t0; if (d < 0) return;
      if (f.k === 'impact') {
        var cx = colCx(f.col), bot = f.bot;
        puffs(t, f.t0, cx - 13, bot - 1, 3, 7, .45, -1); puffs(t, f.t0, cx + 13, bot - 1, 3, 7, .45, 1);
        if (d < .2) { var u = d / .2; [-1, 1].forEach(function (sd) { for (var q = 0; q < 3; q++) G.rect(cx + sd * (18 + u * 6 + q), bot - 4 - q - u * 4, 1, 1, C.navy, 1 - u); }); }
      } else if (f.k === 'spark') {
        for (var n = 0; n < 7; n++) {
          var t0 = f.t0 + n * .045, sx = COLX[f.col] + 4 + hash(n * 2.3 + f.t0) * (BW - 8);
          sparkle(t, t0, sx, g.floor - 3 - (t - t0) * 30, n % 2 ? C.white : PAL[f.pal][0], .35);
        }
      }
    });
    /* speed lines over the slam */
    if (b && b.tapT != null && t >= b.tapT + .27 && t < b.tl + .06) {
      var top = t < b.tl ? blockTop(b, t, g) : b.land - g.bh, y0 = driftTop(b, b.tapT) - 4;
      for (var j = 0; j < 4; j++) {
        var lx = COLX[b.col] + 3 + j * 8 + (j > 1 ? 1 : 0), len = Math.min(top - 26 - y0, 14 + hash(j * 3.3 + b.tapT) * 22);
        if (len > 2) G.rect(lx, top - 26 - len, 1, len, C.navy, .35 * (1 - p(t, b.tl, b.tl + .06)));
      }
    }
  }

  function draw(R, G) {
    var s = R.s, t = R.t, g = geo(R), c = G.ctx, i;
    Gc = G; R0 = R;
    var pan = Math.round(panNow(s, t));
    var thud = RM ? 0 : Math.round(U.jiggle(t, s.thudT, s.thudA, 55, 13));
    var lau = lauState(R, t);
    G.clear(C.sky);
    drawBackdrop(G, t, g);
    c.save(); c.translate(R.shakeX(), (thud - pan) * 3);
    if (pan > 0) { c.beginPath(); c.rect(-20, R.layout.hudY + 24 + pan * 3, 430, 3000); c.clip(); }
    var ca = s.prev ? p(t, s.binsT, s.binsT + .3) : 1;
    if (s.prev && ca < 1) G.spr(cardSpr(g, s.prev.tints), 0, g.cardT);
    G.spr(cardSpr(g, s.tints), 0, g.cardT, ca < 1 ? { alpha: ca } : null);
    drawHeader(R, G, t, g);
    drawDropZone(G, t, g);
    drawColumnFX(R, G, t, g);
    drawTopLine(R, G, t, g);
    drawMouths(R, G, t, g);
    drawLabels(R, G, t, g);
    drawNext(R, G, t, g);
    drawJams(R, G, t, g);
    drawShatter(R, G, t, g);
    var b = s.blk, bo = b ? blockAt(b, t, g) : null;
    if (bo) drawBlock(b, bo, g, t);
    if (b && b.fizzT != null) puffs(t, b.fizzT + .3, HXC, driftTop(b, b.fizzT) + b.wh[1] / 2, 5, 14, .5, 0);
    drawImpacts(R, G, t, g);
    drawCrew(R, G, t, g, lau.x);
    drawTags(R, G, t, g);
    drawLau(R, t, lau, g);
    if (s.pitch && t >= s.pitch.t0 + .5) {
      var aa = p(t, s.pitch.t0 + .5, s.pitch.t0 + .7) * (s.pitch.out != null ? 1 - p(t, s.pitch.out, s.pitch.out + .2) : 1);
      if (aa > 0) put(arrowSpr(), lau.x, lau.feet + 11 + Math.round(Math.abs(Math.sin(t * 5)) * 2), { alpha: aa });
      var frOut = pitchOut(s), fr = E.out(p(t, s.pitch.t0 + .3, s.pitch.t0 + .6)) * (frOut != null ? 1 - p(t, frOut, frOut + .3) : 1);
      if (fr > 0) { c.save(); c.globalAlpha *= clamp(fr * (.7 + .3 * Math.sin(t * 6))); c.strokeStyle = C.lime; c.lineWidth = 5; PX.roundRect(c, COLX[s.pitch.col] * 3 + 1, g.floor * 3 + 1, BW * 3 - 2, (g.cardB - 2 - g.floor) * 3 - 2, 10); c.stroke(); c.restore(); }
    }
    if (s.x2) {                                            // the pitch bonus, over the lime-framed row it doubled
      var xi = p(t, s.x2.t0, s.x2.t0 + .3, E.outBackBig), xo = p(t, s.x2.t0 + 1.5, s.x2.t0 + 1.8, E.in);
      if (xi > 0 && xo < 1) pill(s.x2.text, colCx(s.x2.col) * 3, (g.floor - 13) * 3 - 24 * xo, { size: 18, bg: C.lime, color: C.navy, icon: PX.ember(), s: .5 + .5 * xi, alpha: Math.min(1, xi * 1.5) * (1 - xo) });
    }
    c.restore();

    /* ---- UI over the game (screen sp) ---- */
    s.fx.forEach(function (f) {
      var d = t - f.t0; if (d < 0) return;
      if (f.k === 'badge') {
        var r = f.ok ? 20 : 22, bx = Math.min(COLX[f.col] * 3 + 84, 390 - r - 5);
        G.badge(bx, f.y, r, f.ok, (1.8 - .8 * E.outBack(clamp(d / .24))) * (1 - p(d, .5, .7, E.inBack)), Math.min(1, d / .06));
      } else if (f.k === 'tap') {
        var rip = clamp(d / .5);
        c.save(); c.globalAlpha = .85 * (1 - rip); c.fillStyle = C.white; c.beginPath(); c.arc(f.x, f.y, 22 - 5 * (d < .12 ? 1 : 0), 0, Math.PI * 2); c.fill();
        c.strokeStyle = C.navy; c.lineWidth = 3; c.stroke();
        c.globalAlpha = .7 * (1 - rip); c.strokeStyle = C.white; c.lineWidth = 4; c.beginPath(); c.arc(f.x, f.y, 24 + rip * 34, 0, Math.PI * 2); c.stroke(); c.restore();
      }
    });
    var midY = Math.round((g.top + 2 * g.slot) * 3);
    if (s.fix) {                                           // the one-line fix: what it should have been
      var fd = t - s.fix.t0, fi = p(fd, 0, .3, E.outBack), fo = p(fd, s.fix.dur - .25, s.fix.dur, E.in);
      if (fi > 0 && fo < 1) pill(s.fix.text, 195, midY + 30, { size: 18, bg: s.fix.bg, color: s.fix.color, s: (.6 + .4 * fi) * (1 - .3 * fo), alpha: Math.min(1, fi * 1.5) * (1 - fo) });
    }
    if (s.cleared) {
      var cd = t - s.cleared.t0, ci = p(cd, 0, .25, E.outBackBig), co = p(cd, .85, 1.05, E.in);
      if (ci > 0 && co < 1) pill(s.cleared.n > 1 ? s.cleared.n + ' jams cleared' : 'Jam cleared', clamp(colCx(s.cleared.col) * 3, 100, 290), (g.floor - s.cleared.n * g.slot - 6) * 3, { size: 18, bg: C.lime, color: C.navy, s: (.5 + .5 * ci) * (1 - .3 * co), alpha: Math.min(1, ci * 1.5) * (1 - co) });
    }
    if (s.danger) {
      var dd = t - s.danger.t0, di = p(dd, .1, .4, E.outBack), dout = p(dd, 2.0, 2.25, E.in);
      if (di > 0 && dout < 1) {
        var broke = dd < .8 && Math.floor(dd / .1) % 2 === 0;
        pill('4 jams = lose a heart', 195, g.top * 3 - 36, { size: 18, bg: C.white, color: C.navy, icon: PX.heart(!broke), s: (.6 + .4 * di) * (1 - .3 * dout) * (1 + .1 * Math.sin(Math.PI * p(dd, 0, .2))), alpha: Math.min(1, di * 1.5) * (1 - dout) });
      }
    }
    if (s.hint && s.hint.text) {
      var hd = t - s.hint.t0, ha = p(hd, 0, .15) * (1 - p(hd, 1.3, 1.6));
      if (ha > 0) G.pill(s.hint.text, 195, midY - 20, { size: 17, bg: C.navy, color: C.white, pad: 16, alpha: ha });
    }
    if (b && b.first && b.state === 'fall' && t > b.ts + 1.2 && !(s.hint && s.hint.text && t - s.hint.t0 < 1.6)) {
      var fa = p(t, b.ts + 1.2, b.ts + 1.5);
      G.pill('Tap the row it belongs to', 195, midY - 20, { size: 17, bg: C.navy, color: C.white, pad: 16, alpha: fa, scale: .9 + .1 * fa });
    }
    if (s.phase === 'idle' && s.idle && t > s.idle.t0) {
      var ia = p(t, s.idle.t0, s.idle.t0 + .3, E.outBack);
      G.pill('Still there? Tap a row to go on', 195, midY - 20, { size: 18, bg: C.navy, color: C.white, pad: 16, alpha: Math.min(1, ia * 1.5), scale: (.85 + .15 * ia) * (1 + .03 * Math.sin((t - s.idle.t0) * 4)) });
    }
    var by = bannerY(R);
    if (s.banner) {
      var bn = s.banner, bi = p(t, bn.t0, bn.t0 + .4, E.outBackBig), bo2 = p(t, bn.t0 + bn.dur - .3, bn.t0 + bn.dur, E.in);
      if (bi > 0 && bo2 < 1) {
        G.popText(bn.big, 195, by, bi * (1 + .12 * bo2), 1 - bo2, 46, bn.fill);
        var pi = p(t, bn.t0 + .15, bn.t0 + .45, E.outBack);
        if (bn.small) G.pill(bn.small, 195, by + 64, { size: 18, bg: C.white, color: C.navy, border: C.navy, borderW: 3, pad: 16, alpha: Math.min(1, pi * 1.5) * (1 - bo2), scale: .6 + .4 * pi });
      }
    }
    var fi2 = p(t, s.fullT, s.fullT + .3, E.outBackBig), fo2 = p(t, s.fullT + .9, s.fullT + 1.2, E.in);
    if (fi2 > 0 && fo2 < 1) {
      G.popText('FULL SPEC CARD', 195, by, fi2 * (1 + .1 * fo2), 1 - fo2, 34, C.white);
      G.popText('+5', 195, by + 62, p(t, s.fullT + .1, s.fullT + .35, E.outBackBig) * (1 + .1 * fo2), 1 - fo2, 46, C.lime);
      for (i = 0; i < 4; i++) { var ang = i / 4 * Math.PI * 2 + .6; sparkle(t, s.fullT + .05 + i * .07, (195 + Math.cos(ang) * 170) / 3, (by + 20 + Math.sin(ang) * 60) / 3, i % 2 ? C.gold : C.white, .5); }
    }
    if (s.note) {
      var nd = t - s.note.t0, na = p(nd, 0, .2) * (1 - p(nd, s.note.dur - .3, s.note.dur));
      if (na > 0) G.pill(s.note.text, 195, by + 10, { size: 17, bg: s.note.bg, color: C.white, pad: 16, alpha: na, scale: .85 + .15 * p(nd, 0, .25, E.outBack) });
    }
    R.lauSY = (lau.feet - 11 + thud - pan) * 3; R.lauSX = lau.x * 3;
  }
  /* drawn after the HUD: the opening iris on Lau */
  function drawTop(R, G) {
    var t = R.t, io = p(t, 0, .6, E.inOut);
    if (io < 1) {
      var lx = R.lauSX || 150, ly = R.lauSY || 200, Rn = Math.max(Math.hypot(lx, ly), Math.hypot(390 - lx, ly), Math.hypot(lx, G.SH - ly), Math.hypot(390 - lx, G.SH - ly));
      G.iris(io * Rn / Math.hypot(390, G.SH), lx, ly);
    }
  }

  /* ---------- test hooks ---------- */
  function info(R) {
    var s = R.s, g = geo(R), b = s.blk, pan = panNow(s, R.t), ok = tappable(R);
    var choices = s.bins.map(function (slug, i) {
      return { label: BK.label(slug), slug: slug, col: i, right: !!(b && ok && b.it.slug === slug), tappable: ok,
        x: COLX[i] * 3, y: (g.top - pan) * 3, w: BW * 3, h: (g.cardB - 2 - g.top) * 3 };
    });
    return {
      wave: s.wave + 1, waveLeft: +s.waveLeft.toFixed(2), kind: s.waves[Math.max(0, s.wave)].kind, bins: s.bins.slice(),
      block: b ? { text: b.it.kind === 'value' ? b.it.v : b.it.text, slug: b.it.slug, kind: b.it.kind, state: b.state, first: b.first, tappable: ok, fall: b.fall } : null,
      jams: s.jams.map(function (J) { return J.filter(function (j) { return j.shatter == null && j.flush == null; }).length; }),
      filled: s.filled.slice(), full: Object.keys(s.full).length, blocks: s.nBlocks, waveBlocks: s.waveBlocks, sayWord: s.sayWord, pan: Math.round(pan),
      waveLen: s.waveLen, carry: s.carry, early: s.early, idle: s.phase === 'idle', idleN: s.idleN, pair: s.pair,
      fillN: s.fillN.slice(), gbBeat: !!(b && b.gb),
      tagsShown: s.tags.map(function (tg, i) { return tg && R.t >= tg.t0 ? +tagVis(R, R.t, i).toFixed(2) : 0; }),
      hint: { fix: !!(s.fix && R.t - s.fix.t0 < s.fix.dur && R.t >= s.fix.t0), hiCol: s.hiCol && R.t - s.hiCol.t0 < s.hiCol.dur && R.t >= s.hiCol.t0 ? s.hiCol.col : null },
      rowSparks: JSON.parse(JSON.stringify(s.rowSp)), layout: { cardT: g.cardT, cardB: g.cardB, top: g.top, floor: g.floor, slot: g.slot },
      choices: choices
    };
  }

  ARC.registerGame({
    id: 'g21', name: 'Spec Stack', sub: 'Falling blocks', lives: 3, scoreLabel: 'sparks',
    minRight: 5,                                       // the daily +10 XP needs 5 right (and no more wrong than right)
    rules: ['Spec values, meanings and customer lines fall one at a time', 'Tap the row it belongs to and Lau slams it in', 'A wrong row jams up. 4 jams in one row cost a heart'],
    controls: {},
    init: init, update: update, draw: draw, drawTop: drawTop, tap: tap, key: key, info: info,
    finish: function (R) { R.end({ reason: 'done', delay: .2 }); }
  });
})();
