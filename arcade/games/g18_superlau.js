/* Game 18 · Super Lau (power-up jumper) — the reference implementation of the Play & Learn game API.
   Look and feel ported from the approved video scene (../../../arcade-video/scenes/g18_superlau.js).

   Rules (SPEC.md): 10 Unit 1 words. A word card pops up and the word plays in the model voice. Three mushrooms carrying
   meanings hop in one at a time and hover over Lau for about 2 s each; tap JUMP (or anywhere) to catch the one overhead.
   Right: Lau grows small -> Super -> Fire. Wrong: he shrinks (a heart goes only when he is already small) and the right
   mushroom floats past. Catching none costs nothing: the word comes back later with two mushrooms (if it is the last
   word, the right one is shown straight away). A checkpoint flag after word 5 and at the end opens the Say-it card on the
   most-missed word (or the last word); a clear word makes Fire Lau, who burns lag bugs. Round 2 (unlocks at 6 of 10
   right) flips it: the meaning shows, the mushrooms carry words. Score = sparks.
   Sparks: +1 per right catch (+2 as Fire Lau), +2 for a clear Say-it (+1 tap check), +1 per lag bug burned, +3 for a
   Round 2 with every word caught right (no wrong catch, no skipped word). One lag bug walks in after each right catch as
   Fire Lau and after each clear Say-it, never on a timer: idling earns nothing and the same play always scores the same.
   Controls are forgiving: a tap up to 0.35 s before a mushroom can be caught is remembered, and a tap with a mushroom
   overhead always wins over a small no-catch hop already in the air. */
(function () {
  'use strict';
  var U = ARC.U, C = PX.C, E = U.E, p = U.p, clamp = U.clamp, hash = U.hash, mix = U.mix, jiggle = U.jiggle;
  var BK = ARC.bank;
  var LCX = 40, MW = 22, MH = 21;                    // Lau's centre x (game px); the meaning mushroom's size
  var HOP = .55, HOVER = 2.0, LEAD = .9;             // hop in/out, hover over Lau, card lead before the first mushroom
  var CATCH0 = HOP * .82, CATCH1 = HOP * .2;         // catchable from 82% of the hop in until 20% into the hop out
  var BUF = .35;                                     // an early tap is remembered this long
  var BUGX = 116;                                    // lag bugs pop in here (a puff), not behind the screen edge
  var FORMS = [{ h: 18, form: 'small' }, { h: 27, form: 'super' }, { h: 27, form: 'fire' }];
  var TONES = ['peri', 'lime', 'coral'], TONE_I = { peri: 0, lime: 1, coral: 2 };
  var FORM_I = { small: 0, super: 1, fire: 2 }, MOOD_I = { happy: 0, hurt: 1, joy: 2 };
  var FLOWERS = [C.coral, C.peri, C.white, C.gold];
  var SPR = null, MC = {}, LAU = {}, LAUN = 0, PUFF = [];
  var HINT = 'Tap when the meaning fits';
  var CLOUDS = [[16, 154, 30, .1], [96, 176, 22, .16], [150, 122, 34, .2], [214, 162, 26, .13], [268, 110, 20, .26]];
  /* scratch option objects reused every frame (no per-frame allocations in draw) */
  var AO = { alpha: 1 }, FLIP = { flip: true }, SO = { alpha: 1, size: 21, s: 1, maxW: 210 }, RO = { state: 'right', s: 1, size: 21, maxW: 210 }, SL = { a: 1, s: 1, shift: 0, lit: 1 };
  var PO = { size: 18, bg: C.white, color: C.navy, border: C.navy, borderW: 3, pad: 16, alpha: 1, scale: 1 };
  var NO = { size: 17, bg: C.navy, color: C.white, pad: 16, alpha: 1, scale: 1 };
  var HO = { size: 15, bg: C.navy, color: C.white, pad: 12, shadow: false, alpha: 1 };
  var W1 = { a: 1, word: '', say: '', hi: '', top: 0, speak: 0 }, W2 = { a: 1, meaning: '', label: 'Which word means', top: 0, speaker: false };

  /* ---------- sprites made for this game (from the video scene) ---------- */
  function sprites() {
    if (SPR) return SPR;
    SPR = {};
    var farC = mix(C.sky, C.mint, .2), farHi = mix(C.sky, C.white, .6), farDot = mix(C.sky, C.mint, .28);
    SPR.skyMid = mix(C.sky2, C.sky, .5);
    SPR.far = PX.make(160, 70, function (px) {
      for (var x = 0; x < 160; x++) {
        var u = x / 160 * Math.PI * 2;
        var top = Math.round(30 - 13 * Math.sin(u + .6) - 7 * Math.sin(2 * u + 2.1) - 3 * Math.sin(3 * u + .4));
        for (var y = Math.max(0, top); y < 70; y++) px(x, y, y <= top + 1 ? farHi : ((x * 5 + y * 9) % 29 === 0 && y > top + 4 ? farDot : farC));
      }
    }, 'g18far');
    var nC = mix(C.white, C.mint, .48), nHi = mix(C.white, C.mint, .22), nSh = mix(C.white, C.mintSh, .62), nEdge = mix(C.mintSh, C.navy, .15);
    SPR.near = PX.make(112, 46, function (px) {
      for (var x = 0; x < 112; x++) {
        var u = x / 112 * Math.PI * 2;
        var top = Math.round(21 - 10 * Math.sin(u + 1.3) - 5 * Math.sin(2 * u + .2));
        for (var y = Math.max(0, top); y < 46; y++) {
          var col = y === top ? nEdge : y <= top + 2 ? nHi : nC;
          if (y > top + 4 && ((x * 7 + y * 5) % 23 === 0 || (x * 3 + y * 11) % 31 === 0)) col = nSh;
          px(x, y, col);
        }
      }
    }, 'g18near');
    var bA = mix(C.mint, C.lime, .35), bHi = mix(C.white, bA, .45), bSh = C.mintSh;
    SPR.bush = [0, 1].map(function (v) {
      var w = v ? 26 : 17, h = v ? 10 : 8;
      var lumps = v ? [[.2, .68, .55], [.45, .42, .62], [.7, .5, .6], [.88, .75, .45]] : [[.28, .62, .6], [.62, .45, .68], [.85, .78, .45]];
      return PX.outline(PX.make(w, h, function (px) {
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
          var on = y >= h * .7;
          lumps.forEach(function (l) { var dx = (x + .5 - l[0] * w) / (l[2] * h), dy = (y + .5 - l[1] * h) / (l[2] * h); if (dx * dx + dy * dy <= 1) on = true; });
          if (on) px(x, y, y < h * .32 ? bHi : y > h * .72 ? bSh : bA);
        }
      }), mix(C.mintSh, C.navy, .35), 'g18bush' + v);
    });
    SPR.glow = [PX.disc(17, C.lime), PX.disc(13, C.limeSoft)];
    SPR.fire = PX.outline(PX.grid(['...yyyy...', '..yOOOOy..', '.yOooooOy.', 'yOoowwooOy', 'yOowwwwoOy',
      'yOowwwwoOy', 'yOoowwooOy', '.yOooooOy.', '..yOOOOy..', '...yyyy...'], { y: C.fl2, O: C.fl3, o: C.fl1, w: C.white }), C.coralSh, 'g18fire');
    SPR.star = PX.grid(['..w..', '..w..', 'wwyww', '..w..', '..w..'], { w: C.white, y: C.gold }, 'g18star');
    /* kit sprites held here, so drawing a frame never builds a cache key or a closure */
    SPR.ground = PX.ground(); SPR.soil = PX.soil();
    SPR.cloud = {}; CLOUDS.forEach(function (q) { SPR.cloud[q[2]] = PX.cloud(q[2]); });
    SPR.coin = [0, 1, 2, 3].map(function (f) { return PX.coin(f); });
    SPR.bug = [PX.bug({ frame: 0 }), PX.bug({ frame: 1 })];
    SPR.flag = [PX.flag(0), PX.flag(1)];
    return SPR;
  }
  /* the meaning mushroom: tone cap with one big spot, a wide stem with rimmed googly eyes that look at Lau.
     Deliberately unlike the classic red-cap power-up. Pupil offset lx 0..2, ly 0..1 */
  function mushroom(tone, fr, lx, ly) {
    fr = ((fr % 2) + 2) % 2;
    var key = ((TONE_I[tone] * 2 + fr) * 3 + lx) * 2 + ly; if (MC[key]) return MC[key];
    var cap = tone === 'coral' ? [C.coral, C.coralSh, C.peach] : tone === 'peri' ? [C.peri, C.periSh, C.periSoft] : [C.lime, C.limeDk, mix(C.lime, C.white, .5)];
    var stemSh = mix(C.cream, C.soilDk, .3);
    var src = PX.make(20, 19, function (px) {
      var x, y, i, j;
      for (y = 0; y < 11; y++) for (x = 0; x < 20; x++) {
        var dx = (x + .5 - 10) / 10, dy = (y + .5 - 11) / 11;
        if (dx * dx + dy * dy > 1) continue;
        px(x, y, y >= 10 ? cap[1] : (dx > .5 && dy > -.5) ? cap[1] : (dy < -.72 && dx < .1) ? cap[2] : cap[0]);
      }
      ['.xx.', 'xxxx', 'xxxx', '.xx.'].forEach(function (r, j2) { for (var i2 = 0; i2 < 4; i2++) if (r[i2] === 'x') px(3 + i2, 3 + j2, C.cream); });
      [[12, 2], [15, 6]].forEach(function (q) { px(q[0], q[1], C.cream); px(q[0] + 1, q[1], C.cream); px(q[0], q[1] + 1, C.cream); px(q[0] + 1, q[1] + 1, C.cream); });
      for (y = 11; y < 19; y++) for (x = 3; x < 17; x++) {
        if (y === 18 && (x === 3 || x === 16 || (fr ? x === 4 : x === 15))) continue;
        px(x, y, x >= 15 ? stemSh : C.cream);
      }
      [[5, 13], [12, 13]].forEach(function (e) {
        for (j = -1; j <= 3; j++) for (i = -1; i <= 3; i++) { if ((i === -1 || i === 3) && (j === -1 || j === 3)) continue; px(e[0] + i, e[1] + j, C.navy); }
        for (j = 0; j < 3; j++) for (i = 0; i < 3; i++) px(e[0] + i, e[1] + j, C.white);
        px(e[0] + lx, e[1] + ly, C.navy); px(e[0] + lx, e[1] + ly + 1, C.navy);
      });
      px(4, 17, C.pink); px(15, 17, C.pink);
    });
    return (MC[key] = PX.outline(src, C.navy));
  }
  function lookX(mcx) { return Math.round(1 + clamp((LCX - mcx) / 20, -1, 1)); }
  function lookY(mcx) { return Math.abs(LCX - mcx) < 34 ? 1 : 0; }
  /* Lau through a small numeric-keyed cache (the kit builds a string key per call); bounded */
  function q2i(v) { return Math.round(clamp(v, -1, 1) * 2) + 2; }        // look snaps to halves, as in the kit: 0..4
  function lauSpr(h, form, frame, run, lx, ly, mood, blink) {
    var key = (((((((h === 27 ? 1 : 0) * 3 + FORM_I[form]) * 4 + frame % 4) * 5 + q2i(lx)) * 5 + q2i(ly)) * 2 + (blink ? 1 : 0)) * 3 + MOOD_I[mood]) * 2 + (run ? 1 : 0);
    var spr = LAU[key];
    if (!spr) {
      if (++LAUN > 240) { LAU = {}; LAUN = 1; }
      spr = LAU[key] = PX.lau({ h: h, form: form, frame: frame, run: run, look: [lx, ly], mood: mood, blink: blink });
    }
    return spr;
  }
  function puff(G, gx, gy, r, a) {
    if (a <= 0) return;
    r = Math.max(1, Math.min(8, Math.round(r)));
    var d = PUFF[r] || (PUFF[r] = PX.disc(r, C.white));
    AO.alpha = a; G.spr(d, gx - r, gy - r, AO);
  }

  /* ---------- layout from the screen edges (never a fixed 281); cached until the screen size changes ---------- */
  function geo(R) {
    var G = R.G, s = R.s, g = s.geo, hudY = R.layout.hudY;
    if (g && g.H === G.H && g.bot === G.bot && g.hudY === hudY) return g;
    var gY = Math.floor(G.H - 31 - G.bot / 3), HX = LCX - MW / 2, SB = (gY - 66) * 3, cardTop = Math.round(hudY + 30);
    /* very short frames (a desktop LMS iframe 480 px wide and ~640 tall): no room for a 2-line sign plus its badge under
       the card. Compact: signs on one line, the result badge on the sign's corner, the hover line up to 6 px lower and
       the word card a little smaller; banners and notes then sit over the card */
    var compact = SB - (cardTop + 118) < 128, drop = 0, cs = 1;
    if (compact) {
      drop = clamp(Math.ceil((cardTop + 118 * .85 + 76 - SB) / 3), 0, 6); SB += drop * 3;
      cs = clamp((SB - 76 - cardTop) / 118, .78, 1);
    }
    g = s.geo = { H: G.H, bot: G.bot, hudY: hudY, gY: gY, HY: gY - 63 + drop, HX: HX, SB: SB, cardTop: cardTop, drop: drop,
      compact: compact, cardS: cs, signW: compact ? 320 : 210,
      cardBot: cardTop + Math.round(118 * cs),                   // the word card and its shadow
      by0: Math.round((cardTop + 112 + SB - 90) / 2),            // the roomy banner line from the video
      cloudTop: Math.ceil((hudY + 30) / 3),                      // clouds stay below the HUD row
      revK: [[0, 136], [.9, HX + 5, E.out], [1.5, HX - 3, E.lin], [2.1, -28, E.in]] };
    g.noteY = compact ? Math.round(cardTop + 112 * cs + 6) : clamp(g.by0 + 20, g.cardBot + 18, SB - 100);
    return g;
  }
  function catchH(R) { return 44 - lau(R.s).h - geo(R).drop; }     // jump height that brings Lau's head to the mushroom
  /* where a banner goes: between the word card and the caught sign's badge. Roomy: 44 sp title + 18 sp pill (the video).
     Short screens (below ~680 CSS px, the LMS frame): 36 sp title + 16 sp pill, or the title alone when even that won't fit */
  function bannerFit(R) {
    var s = R.s, g = geo(R), top = g.cardBot, lines = 0;
    if (g.compact) return { by: g.cardTop + Math.round(34 * g.cardS), big: 36, off: 46, ps: 16 };     // over the card
    if (s.res && R.t - s.res.t0 < s.res.hold + .3) lines = R.G.wrap(s.res.text, s.round === 2 ? 24 : 21, g.signW).lines.length;
    var bot = g.SB - (lines === 2 ? 120 : lines === 1 ? 94 : 64), by = g.by0;
    if (by - 22 >= top && by + 83 <= bot) return { by: by, big: 44, off: 62, ps: 18 };
    if (bot - top >= 105) return { by: clamp(by, top + 22, bot - 83), big: 44, off: 62, ps: 18 };
    if (bot - top >= 84) return { by: clamp(by, top + 19, bot - 65), big: 36, off: 46, ps: 16 };
    return { by: Math.round(Math.max(top + 19, Math.min((top + bot) / 2 - 3, bot - 25))), big: 36, off: 0, ps: 0 };
  }

  /* ---------- items ---------- */
  function makeItem(slug, round) {
    var opts = [slug].concat(BK.DECOY[slug]), tones = U.shuffle(TONES);
    opts = U.shuffle(opts).map(function (o, i) {
      return { slug: o, right: o === slug, tone: tones[i], text: round === 1 ? BK.MEAN[o] : BK.label(o) };
    });
    return { slug: slug, round: round, opts: opts, returns: 0 };
  }
  /* a returning word comes back with two mushrooms: the right one and one of its decoys, new colours and order */
  function comeback(it) {
    var right = null, wrong = [], tones = U.shuffle(TONES);
    it.opts.forEach(function (o) { if (o.right) right = o; else wrong.push(o); });
    return U.shuffle([right, U.pick(wrong)]).map(function (o, i) { return { slug: o.slug, right: o.right, tone: tones[i], text: o.text }; });
  }
  function newMush(o, sIn, hover, state) { return { opt: o, sIn: sIn, hover: hover, state: state, reveal: state === 'reveal', p: { x: 0, y: 0, dy: 0, a: 1 } }; }
  function lau(s) { return FORMS[s.form]; }

  function init(R) {
    sprites();
    var s = R.s;
    s.round = 1; s.queue = U.shuffle(BK.WORDS).map(function (w) { return makeItem(w, 1); });
    s.done = 0; s.seen = 0; s.missN = {}; s.checked = {}; s.midDone = false; s.r2wrong = 0; s.r2miss = 0;
    s.form = 0; s.formFrom = 0; s.formT = -9; s.mood = 'happy'; s.moodUntil = 0; s.everSuper = false; s.everFire = false;
    s.jumpT = -9; s.jumpDur = .6; s.jumpH = 16; s.jumpA = 16; s.jumpB = 0; s.landed = true; s.recoilT = -9; s.jumped = false; s.buf = null;
    s.cm = 0; s.v = 18; s.vT = 18; s.runPh = 0;
    s.muss = []; s.ms = []; s.catching = null; s.res = null; s.item = null; s.card = null; s.oldCard = null; s.speakT = -9;
    s.flag = null; s.bugs = []; s.fb = null; s.coins = []; s.dust = []; s.banner = null; s.note = null;
    s.state = 'intro'; s.bugQ = 0; s.nextBug = Infinity; s.lastSlug = null; s.geo = null;
    R.phase = 'intro';
    banner(R, 'ROUND 1', 'Catch the meaning', C.white, .35, 1.6);
    R.after(1.7, function () { nextItem(R); });
  }
  function setState(R, st) { R.s.state = st; R.phase = st; }
  function banner(R, big, small, fill, delay, dur) { R.s.banner = { big: big, small: small, fill: fill, t0: R.t + (delay || 0), dur: dur || 1.8, fit: bannerFit(R) }; }
  function note(R, text, dur, col) { R.s.note = { text: text, t0: R.t, dur: dur || 1.6, col: col }; }

  function nextItem(R) {
    var s = R.s;
    if (R.over) return;
    var it = s.queue.shift();
    if (!it) return roundOver(R);
    if (!it.returns) s.seen++;
    s.item = it; s.res = null; s.catching = null; s.buf = null;
    if (s.card) s.oldCard = { c: s.card, out: R.t };
    s.card = { slug: it.slug, round: it.round, t0: R.t + (s.oldCard ? .15 : 0) };
    var hover = HOVER + (s.seen === 1 && !it.returns && it.round === 1 && !s.jumped ? .9 : 0);     // the very first word waits a little longer
    var t0 = R.t + LEAD;
    s.muss = it.opts.map(function (o, i) { return newMush(o, t0 + i * (HOP + hover), hover, 'live'); });
    setState(R, 'mush');
    R.sfx('pop');
    if (it.round === 1) R.after(.45, function () { if (s.item === it && !R.over) { s.speakT = R.t; R.word(it.slug); } });
  }

  /* where a mushroom is at time t (top-left, game px), or null when off screen. Writes into the mushroom's own p object */
  function mPos(m, t, g) {
    var o = m.p, x, dy = 0, a = 1;
    if (m.state === 'leave') { x = m.lx - (t - m.lt) * 150; if (x < -30) return null; dy = m.ly; a = 1 - clamp((t - m.lt) / .4); }
    else if (m.state === 'reveal') {
      var d = t - m.sIn; if (d < 0 || d > 2.1) return null;
      x = U.k(d, g.revK);
      dy = -2 * Math.pow(Math.sin(d * 3), 2);
    } else if (m.state === 'catch') {
      var w = clamp((t - m.pressT) / (m.catchT - m.pressT));
      o.x = U.lerp(m.px, g.HX, E.out(w)); o.y = U.lerp(m.py, g.HY, w); o.dy = 0; o.a = 1;
      return o;
    } else if (m.state === 'live') {
      var u = t - m.sIn;
      if (u < 0) return null;
      if (u < HOP) { var k = u / HOP, s1 = Math.sin(Math.PI * k * 3); x = 136 + (g.HX - 136) * k; dy = -7 * s1 * s1; }
      else if (u < HOP + m.hover) { x = g.HX; dy = -2 * Math.pow(Math.sin((u - HOP) * 2.8), 2); }
      else if (u < 2 * HOP + m.hover) { var k2 = (u - HOP - m.hover) / HOP, s2 = Math.sin(Math.PI * k2 * 3); x = g.HX + (-28 - g.HX) * k2; dy = -7 * s2 * s2; }
      else return null;
    } else return null;
    o.x = x; o.y = g.HY + dy; o.dy = dy; o.a = a;
    return o;
  }
  /* catchable = hovering, or nearly arrived / just leaving (forgiving for slow taps) */
  function overhead(m, t) {
    if (m.state !== 'live') return false;
    var u = t - m.sIn;
    return u >= CATCH0 && u <= HOP + m.hover + CATCH1;
  }
  function catchable(R) {
    var s = R.s;                       // the hop timings never let two mushrooms be overhead at once
    for (var i = 0; i < s.muss.length; i++) if (overhead(s.muss[i], R.t)) return s.muss[i];
    return null;
  }

  /* ---------- input ---------- */
  function jump(R) {
    var s = R.s;
    if (R.over || s.state === 'say' || s.state === 'intro') return;
    R.jumpT = R.t;
    if (s.catching) return;                                       // a catch jump is in flight: one catch at a time
    var target = s.state === 'mush' ? catchable(R) : null;
    if (target) { hop(R, catchH(R), target); return; }        // a catch always wins over a small hop in the air
    armBuffer(R);
    if (s.landed) hop(R, 14, null);                               // nothing overhead: a small hop says the tap landed
  }
  /* an early tap: when a mushroom is visibly arriving and will be catchable within BUF s, catch it the moment it is.
     Not when the mushroom that just left is nearer to Lau: that was a late tap for it, and it must never catch the next one */
  function armBuffer(R) {
    var s = R.s, t = R.t, g = geo(R), arr = null, lv = null;
    if (s.state !== 'mush') return;
    for (var i = 0; i < s.muss.length; i++) {
      var m = s.muss[i]; if (m.state !== 'live') continue;
      var u = t - m.sIn;
      if (u >= 0 && u < CATCH0) arr = m;
      else if (u > HOP + m.hover + CATCH1 && u < 2 * HOP + m.hover) lv = m;
    }
    if (!arr || CATCH0 - (t - arr.sIn) > BUF) return;
    var qa = mPos(arr, t, g), da = Math.abs(qa.x + MW / 2 - LCX);
    if (lv) { var ql = mPos(lv, t, g); if (ql && Math.abs(ql.x + MW / 2 - LCX) <= da) return; }
    s.buf = { m: arr, until: t + BUF };
  }
  /* jump of nominal height H. From mid-air (a catch overriding a small hop) the arc starts at the current height and is
     shaped so Lau's head meets the mushroom at the same moment and height as a jump from the ground */
  function hop(R, H, target) {
    var s = R.s, t = R.t, base = s.landed ? 0 : jumpY(s, t), uc = .45, kk = 4 * uc * (1 - uc);
    s.jumpB = base; s.jumpH = H; s.jumpA = base ? Math.max(0, (kk * H - base * (1 - uc)) / kk) : H;
    s.jumpT = t; s.jumpDur = .6; s.landed = false; s.jumped = true;
    R.sfx('jump');
    if (target) {
      s.buf = null;
      var pos = mPos(target, t, geo(R));
      target.state = 'catch'; target.pressT = t; target.catchT = t + .27; target.px = pos.x; target.py = pos.y;
      s.catching = target;
    }
  }
  function tap(R, q) {
    var s = R.s, g = geo(R);
    if (s.card && Math.abs(q.x - 195) <= 150 * g.cardS && q.y >= g.cardTop && q.y <= g.cardTop + 112 * g.cardS) {   // the word card replays the word
      if (s.card.round === 1) { s.speakT = R.t; R.word(s.card.slug); }
      return;
    }
    jump(R);
  }

  /* ---------- outcomes ---------- */
  function grow(R, to) {
    var s = R.s;
    if (to === s.form) return;
    s.formFrom = s.form; s.form = to; s.formT = R.t;
    if (to < 2) s.bugQ = 0;                                         // only Fire Lau meets lag bugs
  }
  /* one lag bug for Fire Lau to burn, `delay` s from now (queued ones keep their place, 1.2 s apart) */
  function queueBug(R, delay) {
    var s = R.s;
    if (s.form !== 2 || R.over) return;
    if (s.bugQ++ === 0) s.nextBug = R.t + delay;
  }
  function resolveCatch(R, m) {
    var s = R.s, it = s.item, g = geo(R), o = m.opt;
    s.catching = null; m.state = 'gone'; s.buf = null;
    s.muss.forEach(function (x) { if (x !== m && (x.state === 'live')) { var pp = mPos(x, R.t, g); if (pp) { x.state = 'leave'; x.lx = pp.x; x.ly = pp.dy; x.lt = R.t; } else x.state = 'gone'; } });
    var headY = (g.gY - lau(s).h - s.jumpH) * 3;
    s.lastSlug = it.slug;
    setState(R, 'after');
    if (o.right) {
      var bonus = s.form === 2 ? 2 : 1;
      R.good(it.slug, { sparks: bonus, from: [LCX * 3, headY] });
      R.float('+' + bonus, LCX * 3 + 52, headY + 10);
      s.res = { text: o.text, ok: true, t0: R.t, hold: 1.1 };
      var was = s.form;
      grow(R, Math.min(2, s.form + 1));
      s.mood = 'joy'; s.moodUntil = R.t + 1.3;
      R.burst(LCX, g.gY - 45, 18); R.flash(.4); R.sfx('powerup');
      if (was === 0 && !s.everSuper) { s.everSuper = true; banner(R, 'SUPER LAU', BK.label(it.slug) + ': ' + BK.MEAN[it.slug].toLowerCase(), C.lime, .25, 1.7); }
      else if (was === 1 && !s.everFire) { s.everFire = true; banner(R, 'FIRE LAU', 'He burns lag bugs', C.gold, .25, 1.6); }
      queueBug(R, .7);                                              // a right catch as Fire Lau: a lag bug walks in
      R.after(.35, function () { if (!R.over) R.word(it.slug); });
      R.after(1.6, function () { advance(R); });
    } else {
      R.bad(it.slug, BK.MEAN[it.slug]);
      s.missN[it.slug] = (s.missN[it.slug] || 0) + 1;
      if (it.round === 2) s.r2wrong++;
      s.res = { text: o.text, ok: false, t0: R.t, hold: .7 };
      s.mood = 'hurt'; s.moodUntil = R.t + 1.6;
      R.shake(5); R.burst(LCX, g.gY - 42, 12, [C.coral, C.coralSh, C.navy, C.white]);
      if (s.form > 0) { grow(R, s.form - 1); R.sfx('shrink'); }
      else { R.loseHeart(); R.sfx('hurt'); }
      reveal(R, it, .75);
      if (R.hearts <= 0) { setState(R, 'out'); R.after(2.4, function () { R.end({ reason: 'out' }); }); return; }
      R.after(3.0, function () { advance(R); });
    }
  }
  /* the right mushroom floats past with a lime glow and a check: every wrong answer shows the right one */
  function reveal(R, it, delay) {
    var o = null; it.opts.forEach(function (x) { if (x.right) o = x; });
    R.s.muss.push(newMush(o, R.t + delay, 0, 'reveal'));
  }
  function skipped(R) {
    var s = R.s, it = s.item;
    s.missN[it.slug] = (s.missN[it.slug] || 0) + 1;
    s.lastSlug = it.slug; s.buf = null;
    if (it.round === 2) s.r2miss++;                                // a skipped word is not a perfect round
    setState(R, 'after');
    if (it.returns < 1 && s.queue.length) {                         // it comes back once, later, with two mushrooms
      it.returns++; it.opts = comeback(it); s.queue.push(it);
      note(R, 'No catch. That word comes back later', 1.7);
      R.after(1.2, function () { advance(R, true); });
    } else {                                                        // second skip, or nothing left to come back after
      R.miss(it.slug, BK.MEAN[it.slug]);
      reveal(R, it, .1);
      note(R, 'Here’s the right one', 1.6);
      R.after(2.4, function () { advance(R); });
    }
  }
  function advance(R, returning) {
    var s = R.s;
    if (R.over) return;
    if (!returning) s.done++;
    if (s.round === 1 && !s.midDone && s.seen >= 5) { s.midDone = true; return startFlag(R, 'mid'); }    // after word 5 was shown
    if (!s.queue.length) return roundOver(R);
    nextItem(R);
  }
  function roundOver(R) {
    var s = R.s;
    if (R.over) return;
    if (s.round === 1 && R.right >= 6) {
      s.round = 2; s.done = 0; s.seen = 0; s.r2wrong = 0; s.r2miss = 0;
      var pool = U.shuffle(BK.WORDS), missed = pool.filter(function (w) { return s.missN[w]; }), rest = pool.filter(function (w) { return !s.missN[w]; });
      s.queue = U.shuffle(missed.concat(rest).slice(0, 5)).map(function (w) { return makeItem(w, 2); });
      if (s.card) { s.oldCard = { c: s.card, out: R.t }; s.card = null; }
      setState(R, 'banner');
      banner(R, 'ROUND 2', 'Now catch the word', C.lime, 0, 1.9);
      R.sfx('flag');
      R.after(2.1, function () { nextItem(R); });
      return;
    }
    if (s.round === 2 && s.r2wrong === 0 && s.r2miss === 0) { R.addSparks(3, 195, R.G.SH * .4); note(R, 'Perfect round +3', 1.6); }
    startFlag(R, 'end');
  }

  /* ---------- checkpoint flag + Say-it ---------- */
  function startFlag(R, kind) {
    var s = R.s;
    if (s.card) { s.oldCard = { c: s.card, out: R.t }; s.card = null; }
    s.flag = { x: s.cm + 138, kind: kind, hit: false };
    s.vT = 62;
    setState(R, 'flag');
  }
  function touchFlag(R) {
    var s = R.s, g = geo(R);
    s.flag.hit = true; s.vT = 0; s.v = Math.min(s.v, 12);
    R.sfx('flag'); R.burst(s.flag.x - s.cm + 8, g.gY - 36, 12, [C.lime, C.gold, C.white, C.mint]);
    R.after(.45, function () { checkpoint(R); });
  }
  function sayWord(R) {
    var s = R.s, best = null, n = 0;
    Object.keys(s.missN).forEach(function (w) { if (!s.checked[w] && s.missN[w] > n) { n = s.missN[w]; best = w; } });
    if (!best) best = s.lastSlug && !s.checked[s.lastSlug] ? s.lastSlug : (s.lastSlug || BK.WORDS[0]);
    return best;
  }
  function checkpoint(R) {
    var s = R.s, slug = sayWord(R), kind = s.flag.kind;
    if (R.over) return;
    s.checked[slug] = true;
    setState(R, 'say');
    R.say({ slug: slug, title: 'Say it clearly', sub: 'The game waits for you', tip: BK.TIPS[slug] }).then(function (res) {
      if (R.dead || R.over) return;
      s.vT = 18;
      setState(R, 'resume');
      if (res.passed) {
        var g = geo(R), n = res.method === 'tap' ? 1 : 2;
        R.addSparks(n, LCX * 3, (g.gY - 30) * 3);
        R.float('+' + n, LCX * 3 + 52, (g.gY - 40) * 3);
        if (s.form !== 2) { grow(R, 2); s.everFire = true; banner(R, 'FIRE LAU', 'A clear word lights him up', C.gold, .2, 1.6); }
        else note(R, 'Clear. Fire Lau stays lit', 1.4);
        s.mood = 'joy'; s.moodUntil = R.t + 1.2;
        R.burst(LCX, g.gY - 20, 18, [C.fl2, C.fl3, C.gold, C.lime]); R.sfx('powerup');
        queueBug(R, 1.1);                                            // a lag bug walks in for Fire Lau to burn
      } else {
        note(R, 'Keep practising: ' + BK.word(slug).say, 1.8);
      }
      R.after(res.passed ? 3.1 : 1.9, function () {
        if (kind === 'end') finishRun(R, 0);
        else nextItem(R);
      });
    });
  }
  /* the end checkpoint: wait for a lag bug still on its way to burn, so its spark lands before the result is saved */
  function finishRun(R, waited) {
    var s = R.s;
    if (R.over) return;
    if ((s.bugQ > 0 || walkingBug(s) || s.fb) && waited < 3) { R.after(.2, function () { finishRun(R, waited + .2); }); return; }
    setState(R, 'done'); R.end({ reason: 'done' });
  }

  /* ---------- lag bugs (only for Fire Lau, who burns them: a reward, never a threat) ---------- */
  function walkingBug(s) { for (var i = 0; i < s.bugs.length; i++) if (s.bugs[i].st === 'walk') return true; return false; }
  function updateBugs(R, dt) {
    var s = R.s, g = geo(R), t = R.t;
    if (s.form < 2) s.bugQ = 0;
    if (!R.over && s.bugQ > 0 && t >= s.nextBug && !walkingBug(s) && s.state !== 'say' && s.state !== 'out' && s.state !== 'done') {
      s.bugs.push({ x: BUGX, st: 'walk', born: t });
      s.bugQ--; s.nextBug = t + 1.2;
      R.sfx('pop');
    }
    for (var i = s.bugs.length - 1; i >= 0; i--) {
      var b = s.bugs[i];
      if (b.st === 'walk') {
        b.x -= (s.v + 14) * dt;
        if (s.form < 2) b.st = 'flee';
        else if (!s.fb && b.x - LCX < 40 && b.x > LCX + 4) { s.fb = { t0: t, b: b, x0: LCX + 12, y0: g.gY - 14 }; s.recoilT = t; R.sfx('fireball'); }
        if (b.st === 'walk' && b.x <= LCX + 6) burn(R, b);
      } else if (b.st === 'flee') { b.x += (30 - s.v * .3) * dt; if (b.x > 140) s.bugs.splice(i, 1); }
      else if (b.st === 'burn' && t - b.bt > .8) s.bugs.splice(i, 1);
    }
    if (s.fb && t - s.fb.t0 >= .4) { var f = s.fb; s.fb = null; if (f.b.st === 'walk') burn(R, f.b); }
  }
  function burn(R, b) {
    var s = R.s, g = geo(R);
    b.st = 'burn'; b.bt = R.t;
    var hx = b.x + 8;
    R.burst(hx, g.gY - 7, 14, [C.fl2, C.fl3, C.gold, C.white]); R.sfx('hit');
    s.coins.push({ t0: R.t + .1, x: hx });
    if (R.over) return;                                             // after the result is saved: the coin is only a picture
    R.addSparks(1, hx * 3, (g.gY - 16) * 3);
    R.float('+1', hx * 3 + 6, (g.gY - 26) * 3);
  }
  function fbPos(f, t, gY, out) {
    var d = t - f.t0, tx = f.b.x + 8, x = f.x0 + (tx - f.x0) * clamp(d / .4), y;
    if (d < .16) { var w = clamp(d / .16); y = f.y0 + 8 * w - 14 * 4 * w * (1 - w); }
    else { var w2 = clamp((d - .16) / .24); y = f.y0 + 8 - 1 * w2 - 13 * 4 * w2 * (1 - w2); }
    out[0] = x; out[1] = y; return out;
  }
  var FBP = [0, 0];
  /* the JUMP button fades back while a lag bug walks under it (as in the video), only when nothing can be caught */
  function jumpAlpha(R) {
    var s = R.s, under = 0;
    if (!s || !s.bugs) return 1;
    for (var i = 0; i < s.bugs.length; i++) { var b = s.bugs[i]; if (b.st === 'walk' && b.x > 74 && b.x < 124) under = 1; }
    if (!under) return 1;
    if (s.state === 'mush') for (var j = 0; j < s.muss.length; j++) { var m = s.muss[j]; if (m.state === 'live' && R.t >= m.sIn - .2) return 1; }
    return .4;
  }

  /* ---------- update ---------- */
  function update(R, dt) {
    var s = R.s, t = R.t, i;
    s.v += (s.vT - s.v) * Math.min(1, dt * (s.vT < s.v ? 9 : 4));
    if (Math.abs(s.v - s.vT) < .2) s.v = s.vT;
    s.cm += s.v * dt; s.runPh += Math.min(s.v, 40) * dt;
    if (!s.landed && t - s.jumpT >= s.jumpDur) { s.landed = true; s.dust.push({ t0: t, big: s.jumpH / 26 }); R.sfx('land'); if (s.dust.length > 4) s.dust.shift(); }
    if (!R.over) {                                                 // after the end the world only keeps moving
      if (s.catching && t >= s.catching.catchT) resolveCatch(R, s.catching);
      if (s.buf) {
        var bm = s.buf.m;
        if (s.state !== 'mush' || s.catching || bm.state !== 'live' || t > s.buf.until) s.buf = null;
        else if (overhead(bm, t)) hop(R, catchH(R), bm);          // the remembered early tap catches it now
      }
      if (s.state === 'mush' && !s.catching) {
        var live = false;
        for (i = 0; i < s.muss.length; i++) if (s.muss[i].state === 'live' || s.muss[i].state === 'catch') live = true;
        var lastM = s.muss[s.item.opts.length - 1];
        if (!live || (lastM.state === 'live' && t >= lastM.sIn + 2 * HOP + lastM.hover)) skipped(R);
      }
      if (s.state === 'flag' && s.flag && !s.flag.hit && s.flag.x - s.cm <= LCX + 7) touchFlag(R);
    }
    updateBugs(R, dt);
    for (i = s.coins.length - 1; i >= 0; i--) if (t - s.coins[i].t0 > .8) s.coins.splice(i, 1);
    if (s.mood !== 'happy' && t >= s.moodUntil) s.mood = 'happy';
    if (s.flag && s.flag.hit && s.flag.x - s.cm < -20) s.flag = null;
  }

  /* ---------- drawing (ported from the video scene) ---------- */
  function shadow(G, gY, cx, w, a) { G.rect(cx - w / 2, gY, w, 1, C.navy, a); G.rect(cx - w / 2 + 1, gY + 1, Math.max(1, w - 2), 1, C.navy, a * .6); }
  function band(G, spr, gy, off) { var w = spr.width, x0 = -((off % w) + w) % w - w; for (var x = x0; x < 134; x += w) G.spr(spr, x, gy); }
  function formNow(s, t) { if (t >= s.formT + .9) return FORMS[s.form]; return FORMS[Math.floor((t - s.formT) / .1) % 2 === 0 ? s.form : s.formFrom]; }
  function jumpY(s, t) { var u = (t - s.jumpT) / s.jumpDur; return u < 0 || u >= 1 ? 0 : s.jumpB * (1 - u) + 4 * s.jumpA * u * (1 - u); }
  function squash(s, t) {
    var q = 0, d = t - s.jumpT, big = s.jumpH / 26;
    if (d >= 0 && d < .16 && !s.jumpB) q -= .16 * big * (1 - d / .16);
    q += jiggle(t, s.jumpT + s.jumpDur, .3 * Math.max(.5, big), 24, 9);
    q += jiggle(t, s.recoilT, .12, 30, 12);
    return q;
  }
  /* a meaning sign rides with its mushroom: boxed where it sits over Lau, shifted rigidly by how far the mushroom is
     from there (so it never sticks at a screen edge). Live signs fade in at the right edge and out at the left, and stay
     dim and a little smaller until their mushroom can be caught: the bright sign is the one JUMP catches now. */
  function signLook(m, q, t) {
    var a = q.a, lit = 1;
    if (m.state === 'live') {
      var u = t - m.sIn, end = HOP + m.hover + CATCH1;
      lit = u < HOP ? p(u, CATCH0 - .08, CATCH0, E.out) : 1 - p(u, end, end + .1);
      a *= Math.min(clamp((136 - q.x) / 16), clamp((q.x + MW) / 20));
    } else if (m.state === 'leave') lit = 0;
    SL.a = a * (.45 + .55 * lit); SL.s = .9 + .1 * lit; SL.shift = (q.x + MW / 2 - LCX) * 3; SL.lit = lit;
    return SL;
  }

  function draw(R, G) {
    var s = R.s, t = R.t, g = geo(R), c = G.ctx, i, m, q, cm = s.cm, gY = g.gY, ms = s.ms;
    G.clear(C.sky);
    G.rect(0, 0, 130, 46, C.sky2); G.rect(0, 46, 130, 12, SPR.skyMid);
    for (i = 0; i < 130; i += 2) { G.rect(i, 58, 1, 1, SPR.skyMid); G.rect(i + 1, 45, 1, 1, SPR.skyMid); }
    c.save(); c.translate(R.shakeX(), 0);

    /* parallax: clouds (kept below the HUD row), far hills, near hills, bushes, ground (soil down to the bottom edge) */
    for (i = 0; i < CLOUDS.length; i++) {
      var cl = CLOUDS[i], cx0 = ((cl[0] - cm * cl[3]) % 300 + 300) % 300 - 40;
      G.spr(SPR.cloud[cl[2]], cx0, Math.max(gY - cl[1], g.cloudTop));
    }
    band(G, SPR.far, gY - 68, cm * .22);
    band(G, SPR.near, gY - 45, cm * .5);
    for (i = Math.floor((cm - 40) / 64); i <= Math.floor((cm + 150) / 64); i++) {
      var bsp = SPR.bush[hash(i * 3.3) > .45 ? 1 : 0], bx = i * 64 + Math.floor(hash(i * 1.7) * 26) - cm;
      G.spr(bsp, bx, gY + 3 - bsp.height);
    }
    var gx0 = -((cm % 16) + 16) % 16 - 16;
    for (var gx = gx0; gx < 134; gx += 16) { G.spr(SPR.ground, gx, gY); for (var gyy = gY + 16; gyy < G.H + 1; gyy += 16) G.spr(SPR.soil, gx, gyy); }
    for (i = Math.floor((cm - 10) / 23); i <= Math.floor((cm + 140) / 23); i++) {
      if (hash(i * 5.7) < .45) continue;
      var fx = i * 23 + Math.floor(hash(i * 2.9) * 12) - cm, fc = FLOWERS[Math.floor(hash(i * 9.1) * 4)];
      G.rect(fx, gY - 2, 1, 2, C.limeDk); G.rect(fx - 1, gY - 4, 3, 1, fc); G.rect(fx, gY - 5, 1, 3, fc); G.rect(fx, gY - 4, 1, 1, C.gold === fc ? C.white : C.gold);
    }
    /* dash speed lines */
    var sa = clamp((s.v - 26) / 40);
    if (sa > 0) for (i = 0; i < 10; i++) {
      var ly = gY - 140 + Math.floor(hash(i * 5.1) * 132), lx = ((hash(i * 2.3) * 190 - cm * 1.5) % 190 + 190) % 190 - 30;
      G.rect(lx, ly, 10 + Math.floor(hash(i * 1.3) * 14), 1, C.white, .85 * sa);
    }

    /* mushroom positions this frame (one reused array; each mushroom owns its position object) */
    ms.length = 0;
    for (i = 0; i < s.muss.length; i++) { q = mPos(s.muss[i], t, g); ms.push(q); if (q) shadow(G, gY, q.x + MW / 2, 12, .13); }

    /* checkpoint flag */
    if (s.flag) { var fxs = s.flag.x - cm; if (fxs > -16 && fxs < 132) { G.spr(SPR.flag[Math.floor(cm / 4) % 2], fxs, gY - 40); shadow(G, gY, fxs + 2, 6, .15); } }

    /* lag bugs (each pops in with a puff) */
    for (i = 0; i < s.bugs.length; i++) {
      var b = s.bugs[i]; if (b.st === 'burn') continue;
      shadow(G, gY, b.x + 9, 12, .15);
      G.spr(SPR.bug[Math.floor(t * 12) % 2], b.x, gY - 13, b.st !== 'flee' ? FLIP : null);
      var db = t - b.born;
      if (db < .35) for (var k1 = 0; k1 < 4; k1++) { var an1 = k1 / 4 * Math.PI * 2 + .8; puff(G, b.x + 9 + Math.cos(an1) * (3 + db * 24), gY - 7 + Math.sin(an1) * (2 + db * 12), 4 - db * 6, 1 - db / .35); }
    }

    /* mushrooms (the reveal one glows) */
    for (i = 0; i < s.muss.length; i++) {
      m = s.muss[i]; q = ms[i]; if (!q) continue;
      var mcx = q.x + MW / 2;
      if (m.reveal) {
        var gp = .5 + .5 * Math.sin(t * 7);
        AO.alpha = .28 + .14 * gp; G.spr(SPR.glow[0], mcx - 17, q.y + MH / 2 - 17, AO);
        AO.alpha = .55 + .2 * gp; G.spr(SPR.glow[1], mcx - 13, q.y + MH / 2 - 13, AO);
      }
      G.drawSq(mushroom(m.opt.tone, Math.floor(t * 5), lookX(mcx), lookY(mcx)), mcx, q.y + MH, 0, q.a);
    }

    /* Lau */
    var f = formNow(s, t), jy = jumpY(s, t), air = jy > .01, fr = Math.floor(s.runPh / 2.2) % 4, lkx = .5, lky = 0;
    for (i = 0; i < ms.length; i++) { q = ms[i]; if (q && Math.abs(q.x + MW / 2 - LCX) < 40) { lkx = clamp((q.x + MW / 2 - LCX) / 22, -1, 1); lky = -1; } }
    if (s.fb || s.bugs.length) { lkx = 1; lky = .3; }
    var bl = (!air && ((t + 1.3) % 2.9) < .1) ? 1 : 0;
    var lspr = lauSpr(f.h, f.form, air ? 1 : fr, air || s.v < 1 ? 0 : 1, lkx, lky, s.mood, bl);
    var bob = (!air && s.v > 1 && fr % 2 === 1) ? 1 : 0;
    shadow(G, gY, LCX, Math.max(6, 14 - jy * .25), .18);
    G.drawSq(lspr, LCX, gY + 3 - jy - bob, squash(s, t));
    var lauSY = (gY + 3 - jy - lspr.height / 2) * 3;

    /* fire transform embers */
    if (f.form === 'fire' && t - s.formT < 1.4) for (i = 0; i < 12; i++) {
      var ph = ((t - s.formT) * 1.6 + hash(i * 3.7)) % 1;
      G.rect(LCX - 12 + Math.floor(hash(i * 7.1) * 24), gY - 1 - ph * 34, 1, 1, i % 3 === 0 ? C.lime : i % 3 === 1 ? C.fl2 : C.fl3, (1 - ph) * (1 - p(t, s.formT + 1.1, s.formT + 1.4)));
    }
    /* fireball with a short trail */
    if (s.fb) {
      for (i = 3; i >= 1; i--) { var qf = fbPos(s.fb, Math.max(s.fb.t0, t - i * .035), gY, FBP); puff(G, qf[0], qf[1], 4 - i, .35 * (1 - i / 4)); G.rect(qf[0] - 1, qf[1] - 1, 2, 2, C.fl3, .6 * (1 - i / 4)); }
      var fb = fbPos(s.fb, t, gY, FBP);
      G.spr(SPR.fire, fb[0] - 6, fb[1] - 6, Math.floor(t * 20) % 2 === 1 ? FLIP : null);
      if (t - s.fb.t0 < .12) puff(G, LCX + 15, gY - 14, 3 + (t - s.fb.t0) * 30, 1 - (t - s.fb.t0) / .12);
    }
    /* burned bugs: poof, then a coin */
    for (i = 0; i < s.bugs.length; i++) {
      var bb = s.bugs[i]; if (bb.st !== 'burn') continue;
      var dh = t - bb.bt, hx = bb.x + 8, hy = gY - 7;
      if (dh < .6) { for (var k2 = 0; k2 < 6; k2++) { var an = k2 / 6 * Math.PI * 2 + .3; puff(G, hx + Math.cos(an) * dh * 30, hy + Math.sin(an) * dh * 18 - dh * 10, 3 + dh * 9, 1 - dh / .6); } puff(G, hx, hy - 2, 5 + dh * 6, 1 - dh / .45); }
    }
    for (i = 0; i < s.coins.length; i++) {
      var cn = s.coins[i], d = t - cn.t0; if (d < 0) continue;
      var cy = gY - 14 - 26 * E.out(clamp(d / .3));
      AO.alpha = 1 - p(d, .45, .75); G.spr(SPR.coin[Math.floor(t * 16) % 4], cn.x - 4, cy - 6, AO);
    }
    /* landing dust */
    for (i = 0; i < s.dust.length; i++) {
      var L = s.dust[i], dd0 = t - L.t0; if (dd0 < 0 || dd0 > .4) continue;
      var la = 1 - dd0 / .4, lr = (2 + dd0 * 7) * Math.max(.6, L.big);
      puff(G, LCX - 8 - dd0 * 26, gY - 2 - dd0 * 8, lr, la); puff(G, LCX + 8 + dd0 * 26, gY - 2 - dd0 * 8, lr, la);
    }
    if (s.v > 30) for (i = 0; i < 4; i++) { var dd = (t % .07) + i * .07; puff(G, LCX - 9 - dd * 40, gY - 2 - dd * 14, 1.5 + dd * 9, (1 - dd / .35) * clamp((s.v - 30) / 30)); }

    /* meaning signs over the mushrooms, then the caught one's result over Lau */
    SO.size = s.round === 2 ? 24 : 21; SO.maxW = RO.maxW = g.signW;
    for (i = 0; i < s.muss.length; i++) {
      m = s.muss[i]; q = ms[i]; if (!q || q.a <= 0) continue;
      var sl = signLook(m, q, t); if (sl.a <= .01) continue;
      SO.alpha = sl.a; SO.s = sl.s;
      c.save(); c.translate(sl.shift, 0);
      var r = G.sign(m.opt.text, LCX * 3, g.SB + q.dy * 3 * .35, SO);
      if (r && m.reveal) G.badge(r.x + r.w - 6, r.y + 4, 16, true, p(t, m.sIn + .3, m.sIn + .55, E.outBackBig));
      c.restore();
    }
    if (s.res) {
      var d0 = t - s.res.t0, ok = s.res.ok;
      if (d0 < s.res.hold + .25) {
        var sx = LCX * 3 + jiggle(t, s.res.t0, ok ? 0 : 9, 42, 7);
        var sc = (1 + .1 * Math.sin(clamp(d0 / .2) * Math.PI)) * (1 - p(t, s.res.t0 + s.res.hold, s.res.t0 + s.res.hold + .22, E.inBack));
        RO.state = ok ? 'right' : 'wrong'; RO.s = sc; RO.size = s.round === 2 ? 24 : 21;
        var rr = G.sign(s.res.text, sx, g.SB, RO);
        if (rr) {
          var bx = g.compact ? Math.min(rr.x + rr.w + 4, 366) : rr.x + rr.w + 10, byy = g.compact ? rr.y + 2 : rr.y - 10;   // compact: on the corner
          G.badge(sx + (bx - sx) * sc, g.SB + (byy - g.SB) * sc, g.compact ? 20 : 24, ok, (2.4 - 1.4 * E.out(clamp(d0 / .18))) * sc, Math.min(1, d0 / .08));
        }
      }
    }
    c.restore();   // end shake

    if (!g.compact) bannerNote(R, G, g);
    /* the word card (the old one shrinks away as the new one pops in) */
    var ck = g.compact ? 1 - bannerVis(s, t) : 1;          // compact: a banner over the card fades the card it covers
    if (s.oldCard) { var oa = 1 - p(t, s.oldCard.out, s.oldCard.out + .18); if (oa > 0) card(R, G, s.oldCard.c, ck, 1 - oa); }
    if (s.card) card(R, G, s.card, p(t, s.card.t0, s.card.t0 + .35, E.outBack) * ck, 0);
    if (g.compact) bannerNote(R, G, g);

    R.irisY = lauSY;
  }
  function bannerVis(s, t) {
    var bn = s.banner; if (!bn) return 0;
    return clamp(p(t, bn.t0 - .2, bn.t0 + .05) * (1 - p(t, bn.t0 + bn.dur - .3, bn.t0 + bn.dur)));
  }
  /* banners and notes, in the sky between the card and the signs (compact: over the card) */
  function bannerNote(R, G, g) {
    var s = R.s, t = R.t, i;
    if (s.banner) {
      var bn = s.banner, bf = bn.fit, bi = p(t, bn.t0, bn.t0 + .4, E.outBackBig), bo = p(t, bn.t0 + bn.dur - .3, bn.t0 + bn.dur, E.in);
      if (bi > 0 && bo < 1) {
        G.popText(bn.big, 195, bf.by, bi * (1 + .12 * bo), 1 - bo, bf.big, bn.fill);
        if (bn.small && bf.ps) {
          var pi = p(t, bn.t0 + .15, bn.t0 + .45, E.outBack);
          PO.size = bf.ps; PO.alpha = Math.min(1, pi * 1.5) * (1 - bo); PO.scale = .6 + .4 * pi;
          G.pill(bn.small, 195, bf.by + bf.off, PO);
        }
        if (bn.big !== 'ROUND 1' && bn.big !== 'ROUND 2') for (i = 0; i < 4; i++) {
          var tw = (Math.sin(t * 14 + i * 1.9) + 1) / 2, ang = i / 4 * Math.PI * 2 + .6;
          G.sprS(SPR.star, 195 + Math.cos(ang) * 165, bf.by + Math.sin(ang) * 42 * bf.big / 44, .8 + .5 * tw, bi * (1 - bo) * (.4 + .6 * tw));
        }
      }
    }
    if (s.note) {
      var nd = t - s.note.t0, na = p(nd, 0, .2) * (1 - p(nd, s.note.dur - .3, s.note.dur));
      if (na > 0) { NO.alpha = na; NO.size = g.compact ? 15 : 17; NO.scale = .85 + .15 * p(nd, 0, .25, E.outBack); G.pill(s.note.text, 195, g.noteY, NO); }
    }
  }
  function card(R, G, cd, a, out) {
    if (a <= 0 || out >= 1) return;
    var c = G.ctx, g = geo(R), s = R.s, cy = g.cardTop + 56, sc = out > 0 ? 1 - .12 * out : .85 + .15 * Math.min(a, 1.1);
    c.save();
    if (g.cardS !== 1) { c.translate(195, g.cardTop); c.scale(g.cardS, g.cardS); c.translate(-195, -g.cardTop); }   // compact: smaller, same top
    c.translate(195, cy); c.scale(sc, sc); c.translate(-195, -cy);
    var w = BK.word(cd.slug), sp = clamp((R.t - s.speakT) / 1.2);
    if (cd.round === 1) { W1.a = out > 0 ? 1 - out : a; W1.word = w.word; W1.say = w.say; W1.hi = w.hi; W1.top = g.cardTop; W1.speak = cd === s.card && sp > 0 && sp < 1 ? sp : 0; G.wordCard(W1); }
    else { W2.a = out > 0 ? 1 - out : a; W2.meaning = BK.MEAN[cd.slug]; W2.top = g.cardTop; G.wordCard(W2); }
    c.restore();
  }
  /* the first-play hint: a quiet pill over JUMP for the first two words until the first tap. No pulsing ring: it must
     never read as "tap now" while a wrong mushroom is overhead */
  function hintOn(R) { var s = R.s; return s.state === 'mush' && !s.jumped && s.round === 1 && s.seen <= 2 && !!s.card; }
  /* drawn after the HUD and JUMP button: first-play hint and the opening iris */
  function drawTop(R, G) {
    var s = R.s, t = R.t, j = R.layout.jump, c = G.ctx;
    if (hintOn(R)) {
      HO.alpha = p(t, s.card.t0 + .25, s.card.t0 + .55);
      if (HO.alpha > 0) {
        c.save(); c.font = '700 15px Lexend, sans-serif'; var hw = c.measureText(HINT).width + 24; c.restore();
        G.pill(HINT, Math.min(j.x - 10, 384 - hw / 2), j.y - j.r - 30, HO);
      }
    }
    var io = p(t, 0, .6, E.inOut);
    if (io < 1) {
      var lx = LCX * 3, ly = R.irisY || G.SH - 140, Rn = Math.max(Math.hypot(lx, ly), Math.hypot(390 - lx, ly), Math.hypot(lx, G.SH - ly), Math.hypot(390 - lx, G.SH - ly));
      G.iris(io * Rn / Math.hypot(390, G.SH), lx, ly);
    }
  }

  /* ---------- test hooks ---------- */
  function info(R) {
    var s = R.s, g = geo(R), t = R.t, it = s.item, G = R.G;
    var choices = [];
    s.muss.forEach(function (m) {
      var q = mPos(m, t, g); if (!q || m.state === 'leave' || m.state === 'gone') return;
      var sl = signLook(m, q, t), sz = s.round === 2 ? 24 : 21, wi = G.wrap(m.opt.text, sz, g.signW), sw = Math.ceil(wi.w) + 34;
      var sxl = clamp(Math.round(LCX * 3 - sw / 2), 6, 384 - sw) + sl.shift, sh = wi.lines.length * Math.round(sz * 1.24) + 20;
      choices.push({ label: m.opt.text, slug: m.opt.slug, right: m.opt.right, overhead: overhead(m, t), state: m.state, x: q.x * 3, y: q.y * 3, w: MW * 3, h: MH * 3,
        sign: { x: Math.round(sxl), y: Math.round(g.SB - 12 - sh), w: sw, h: sh, a: +sl.a.toFixed(2), lit: +sl.lit.toFixed(2) } });
    });
    return {
      round: s.round, form: FORMS[s.form].form, done: s.done, seen: s.seen, queue: s.queue.length,
      item: it ? { slug: it.slug, word: BK.label(it.slug), round: it.round, returns: it.returns, n: it.opts.length } : null,
      card: s.card ? { x: Math.round(195 - 150 * g.cardS), y: g.cardTop, w: Math.round(300 * g.cardS), h: Math.round(112 * g.cardS) } : null,
      bugs: s.bugs.length, bugQ: s.bugQ, checkpoint: s.flag ? s.flag.kind : null, r2wrong: s.r2wrong, r2miss: s.r2miss,
      buffered: !!s.buf, hint: hintOn(R), jumpAlpha: +jumpAlpha(R).toFixed(2), landed: s.landed,
      banner: s.banner && t < s.banner.t0 + s.banner.dur ? { big: s.banner.big, by: s.banner.fit.by, size: s.banner.fit.big, pill: s.banner.fit.ps ? s.banner.fit.by + s.banner.fit.off : null } : null,
      layout: { gY: g.gY, SB: g.SB, cardTop: g.cardTop, cardBot: g.cardBot, noteY: g.noteY, compact: g.compact, cardS: +g.cardS.toFixed(3), drop: g.drop },
      choices: choices
    };
  }

  ARC.registerGame({
    id: 'g18', name: 'Super Lau', sub: 'Power-up jumper', lives: 3, scoreLabel: 'sparks',
    rules: ['A spec word pops up and you hear how it’s said', 'Tap JUMP when the mushroom with its meaning is over Lau', 'Right: Lau grows. Wrong: he shrinks'],
    controls: { jump: true }, jumpAlpha: jumpAlpha,
    icon: function () { return mushroom('lime', 0, 1, 1); }, iconScale: 3.8,
    init: init, update: update, draw: draw, drawTop: drawTop, tap: tap, jump: jump, info: info,
    finish: function (R) { R.end({ reason: 'done', delay: .2 }); }
  });
})();
