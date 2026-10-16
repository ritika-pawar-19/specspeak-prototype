/* Game 23 · Echo Invaders (listen and blast). Look and feel ported from the approved video scene
   (../../../classic-video/scenes/g23_echoinvaders.js): navy pixel night sky, four chunky invaders carrying meaning
   pills, Lau on a lime launcher with a loudspeaker, three speech-bubble shields, Gigi's saucer.

   Rules (SPEC.md): 10 targets, the Unit 1 words in a random order. A formation of 4 invaders marches side to side on a
   fixed timer and steps down a row only on a wrong hit. Lau's speaker plays the word in the model voice and never
   writes it until after the hit (Replay and Slow sit in the speaker bubble). Tap the matching meaning: Lau slides under
   it and fires a flame shot. The 3 wrong meanings come from every safe word (never a fixed pair), preferring words not
   yet cleared this run, so the meanings on screen can't be ruled out without listening.
     Right: the invader bursts, the bubble reveals the word and its say-guide, the word plays, the rest fly off and the
            next formation drops in.
     Wrong: the shot bounces back and chips one of the 3 shields (the lives), the right invader blinks and the formation
            steps closer; tap the blinking one to clear it and move on.
   Once per run (after target 5) Gigi's saucer crosses: the Say-it card opens; a clear word pulls it down in a tractor
   beam (captured, a shield rebuilt). The run ends when all 10 are cleared, the shields are gone, or the formation
   reaches the counter line (the step size is sized from the screen so the line is only met as the last shield goes).
   A "Sound on?" check before the first run of a visit offers Read mode (the bubble shows the say-guide instead of
   playing the word on its own); a small Read / Hear chip on the bubble switches modes at any time.
   Layout is built from the screen edges with a compact variant for short screens (16:9 phones, in-app browsers).
   Score = sparks: +1 per right first shot, +5 for capturing Gigi (+3 with a tap check), +3 for finishing with all
   3 shields standing. */
(function () {
  'use strict';
  var U = ARC.U, C = PX.C, B = PX.B, E = U.E, p = U.p, clamp = U.clamp, hash = U.hash, mix = U.mix, jiggle = U.jiggle;
  var BK = ARC.bank;
  var N = 10, SAUCER_AT = 5;
  var COLX = [66, 152, 238, 324], REST = 110;                  // slots 0,2 sit in the top row, 1,3 in the bottom row
  var DT = 9 / 11, ENT = .4, PAT = [2, 4, 2, 0, -2, -4, -2, 0];  // march period (s), entry step (s), side steps (game px)
  var SHX = [105, 195, 285];
  var TONES = ['coral', 'peri', 'mint', 'gold'];
  var TONE = { coral: [C.coral, C.coralSh, C.peach], peri: [C.peri, C.periSh, C.periSoft], mint: [C.mint, C.mintSh, C.mintSoft], gold: [C.gold, C.goldSh, '#FFE08A'] };
  var SKY = [C.navy, mix(C.navy, C.navy2, .35), mix(C.navy, C.navy2, .7), C.navy2, mix(C.navy2, C.navy3, .6)];
  var PILL = { size: 16, lh: 19, padX: 10, padY: 7, maxW: 84 };
  var RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var MODE = null;                                             // 'sound' | 'read': asked once per visit, kept for Play again
  var SPK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5h4l5-4.5v14l-5-4.5H3z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.3 5.8a9 9 0 0 1 0 12.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

  /* ---------- sprites (bounded cache for this game) ---------- */
  var SC = {}, scN = 0;
  function once(key, fn) { var v = SC[key]; if (v) return v; if (++scN > 600) { SC = {}; scN = 1; } return (SC[key] = fn()); }
  /* 5x5 googly eye, corners cut, 3x3 navy pupil (with a glint) at offset lk [0..2, 0..2] */
  function eye5(px, x0, y0, lk) {
    var i, j;
    for (j = 0; j < 5; j++) for (i = 0; i < 5; i++) { if ((i === 0 || i === 4) && (j === 0 || j === 4)) continue; px(x0 + i, y0 + j, C.white); }
    for (j = 0; j < 3; j++) for (i = 0; i < 3; i++) px(x0 + lk[0] + i, y0 + lk[1] + j, C.navy);
    px(x0 + lk[0], y0 + lk[1], C.navy3);
  }
  /* four original invader bodies (21 x 16 before outline), two leg frames, googly eyes that look at Lau */
  var IW = 21, IH = 16;
  function invader(type, tone, fr, lk) {
    return once('inv' + type + tone + fr + lk[0] + lk[1], function () {
      var P = TONE[tone], hi = P[2], base = P[0], sh = P[1];
      var src = PX.make(IW, IH, function (px) {
        var x, y, dx, dy;
        function body(cx, cy, rx, ry, y0, y1) {
          for (y = y0; y <= y1; y++) for (x = 0; x < IW; x++) {
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry;
            if (dx * dx + dy * dy <= 1) px(x, y, dy < -.6 ? hi : (dx > .62 || dy > .6) ? sh : base);
          }
        }
        function pts(list, col) { list.forEach(function (q) { px(q[0], q[1], col); }); }
        if (type === 0) {                      // antenna blob with a toothy grin
          pts([[4, 0], [5, 0], [15, 0], [16, 0]], hi); pts([[5, 1], [6, 2], [15, 1], [14, 2]], base);
          body(10.5, 8.6, 10.5, 6.2, 3, 14);
          eye5(px, 4, 5, lk); eye5(px, 12, 5, lk);
          pts([[8, 12], [9, 12], [10, 12], [11, 12], [12, 12]], C.navy); pts([[9, 12], [11, 12]], C.white);
          pts([[3, 9], [17, 9]], C.pink);
          (fr ? [[3, 14], [2, 15], [7, 14], [7, 15], [13, 14], [13, 15], [17, 14], [18, 15]] : [[4, 14], [5, 15], [7, 14], [8, 15], [13, 14], [12, 15], [16, 14], [15, 15]])
            .forEach(function (q) { px(q[0], q[1], sh); });
        } else if (type === 1) {               // jelly dome with a wavy skirt
          body(10.5, 9.5, 10, 9.5, 0, 10);
          for (x = 1; x < 20; x++) px(x, 11, sh);
          for (x = 1; x < 20; x++) {
            var k2 = (x + fr * 2) % 4;
            if (k2 < 2) { px(x, 12, base); px(x, 13, k2 ? sh : base); if (k2 === 0) { px(x, 14, sh); px(x, 15, sh); } }
          }
          eye5(px, 4, 4, lk); eye5(px, 12, 4, lk);
          pts([[9, 10], [10, 10], [11, 10]], C.navy);
          pts([[2, 3], [3, 2]], C.white);
        } else if (type === 2) {               // box bot with claws (claws up / out) and a lime bulb
          for (y = 4; y < 14; y++) for (x = 3; x < 18; x++) { if ((x === 3 || x === 17) && (y === 4 || y === 13)) continue; px(x, y, y === 4 ? hi : (x === 17 || y === 13) ? sh : base); }
          if (fr) { pts([[0, 1], [1, 1], [0, 2], [0, 3], [1, 4], [2, 5], [20, 1], [19, 1], [20, 2], [20, 3], [19, 4], [18, 5]], base); pts([[1, 2], [19, 2]], sh); }
          else { pts([[0, 7], [1, 7], [0, 8], [0, 9], [1, 10], [2, 9], [20, 7], [19, 7], [20, 8], [20, 9], [19, 10], [18, 9]], base); pts([[1, 8], [19, 8]], sh); }
          pts([[10, 2], [10, 3]], sh); pts([[9, 0], [10, 0], [11, 0], [9, 1], [10, 1], [11, 1]], C.lime); px(9, 0, '#E6FF9A');
          eye5(px, 4, 5, lk); eye5(px, 12, 5, lk);
          for (x = 7; x < 14; x++) px(x, 11, x % 2 ? C.navy : sh);
          (fr ? [[6, 14], [5, 15], [14, 14], [15, 15]] : [[6, 14], [6, 15], [14, 14], [14, 15]]).forEach(function (q) { px(q[0], q[1], sh); });
        } else {                               // round puff with flapping fins
          body(10.5, 7.8, 8.2, 7.8, 0, 15);
          if (fr) { pts([[0, 3], [1, 3], [1, 4], [2, 5], [20, 3], [19, 3], [19, 4], [18, 5]], sh); }
          else { pts([[0, 10], [1, 10], [1, 9], [2, 8], [20, 10], [19, 10], [19, 9], [18, 8]], sh); }
          eye5(px, 5, 4, lk); eye5(px, 11, 4, lk);
          pts([[9, 11], [11, 11], [10, 12]], C.navy);
          pts([[5, 10], [15, 10]], C.pink);
          (fr ? [[7, 15], [10, 15], [13, 15]] : [[6, 15], [10, 15], [14, 15]]).forEach(function (q) { px(q[0], q[1], C.navy3); });
          pts([[6, 1], [7, 1], [5, 2]], C.white);
        }
      });
      return PX.outline(src, C.navy);
    });
  }
  /* white silhouette of a cached sprite (hit / chip / rebuild flashes), keyed by the sprite's own key */
  function whiteOf(spr, key) {
    return once('w' + key, function () {
      var c = document.createElement('canvas'); c.width = spr.width; c.height = spr.height;
      var x = c.getContext('2d'); x.drawImage(spr, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, c.width, c.height);
      return c;
    });
  }
  /* speech-bubble shield (Bolo's bubble silhouette) with three dots; chipped = a bite out of the top-left.
     small = the compact 16 x 12 version for short screens */
  function shield(chip, small) {
    if (small) return shieldS(chip);
    return once('shield' + (chip ? 1 : 0), function () {
      var src = PX.make(20, 16, function (px) {
        var x, y, dx, dy;
        function bitten(x, y) { if (!chip) return false; var bx = x + .5 - 8, by = y + .5 + .4; return bx * bx + by * by < 22 + 8 * hash(x * 3.7 + y * 1.3) || (x === 13 && y === 0); }
        for (y = 0; y < 12; y++) for (x = 0; x < 20; x++) {
          dx = (x + .5 - 10) / 10; dy = (y + .5 - 6) / 6;
          if (dx * dx + dy * dy > 1 || bitten(x, y)) continue;
          px(x, y, dy < -.55 ? '#E4DBFA' : (dx > .62 || dy > .55) ? C.lilacSh : C.lilac);
        }
        for (y = 11; y < 16; y++) for (x = 2; x < 9; x++) if (x >= 2 + (y - 11) && x < 8 - (y - 11) * 1.2) px(x, y, y > 12 ? C.lilacSh : C.lilac);
        [[5, 5], [9, 5], [13, 5]].forEach(function (d) { if (!bitten(d[0], d[1])) { px(d[0], d[1], C.navy3); px(d[0] + 1, d[1], C.navy3); px(d[0], d[1] + 1, C.navy3); px(d[0] + 1, d[1] + 1, C.navy3); } });
        if (chip) { [[8, 4], [7, 5], [7, 6], [8, 7], [8, 8], [11, 4], [12, 3]].forEach(function (q) { if (!bitten(q[0], q[1])) px(q[0], q[1], C.navy); }); }
      });
      return PX.outline(src, C.navy);
    });
  }
  function shieldS(chip) {
    return once('shieldS' + (chip ? 1 : 0), function () {
      var src = PX.make(16, 12, function (px) {
        var x, y, dx, dy;
        function bitten(x, y) { if (!chip) return false; var bx = x + .5 - 6, by = y + .5 + .3; return bx * bx + by * by < 13 + 6 * hash(x * 3.7 + y * 1.3) || (x === 10 && y === 0); }
        for (y = 0; y < 9; y++) for (x = 0; x < 16; x++) {
          dx = (x + .5 - 8) / 8; dy = (y + .5 - 4.5) / 4.5;
          if (dx * dx + dy * dy > 1 || bitten(x, y)) continue;
          px(x, y, dy < -.55 ? '#E4DBFA' : (dx > .62 || dy > .55) ? C.lilacSh : C.lilac);
        }
        for (y = 8; y < 12; y++) for (x = 2; x < 7; x++) if (x >= 2 + (y - 8) && x < 6 - (y - 8)) px(x, y, y > 9 ? C.lilacSh : C.lilac);
        [[3, 4], [7, 4], [11, 4]].forEach(function (d) { if (!bitten(d[0], d[1])) { px(d[0], d[1], C.navy3); px(d[0] + 1, d[1], C.navy3); px(d[0], d[1] + 1, C.navy3); px(d[0] + 1, d[1] + 1, C.navy3); } });
        if (chip) { [[6, 3], [5, 4], [6, 5], [6, 6], [9, 2]].forEach(function (q) { if (!bitten(q[0], q[1])) px(q[0], q[1], C.navy); }); }
      });
      return PX.outline(src, C.navy);
    });
  }
  /* HUD life icon: a 7 x 7 speech-bubble shield (fits the engine's 23 sp life spacing); lost = grey with a bite */
  function lifeIcon(full) {
    return once('life' + (full ? 1 : 0), function () {
      return PX.grid(full ? ['.lllll.', 'lllllll', 'ldldldl', 'lllllll', '.lllll.', '.ll....', '.l.....'] :
        ['.lll...', 'llll.l.', 'lllll..', 'llllll.', '.lllll.', '.ll....', '.l.....'], { l: full ? C.lilac : C.greyDk, d: C.navy3 });
    });
  }
  /* the lime launcher (32 x 10): deck, a lit body, four wheels that turn as it rolls */
  function launcher(fr) {
    return once('launch' + fr, function () {
      var src = PX.make(32, 10, function (px) {
        var x, y;
        for (x = 1; x < 31; x++) { px(x, 0, '#DDF77A'); px(x, 1, C.lime); px(x, 2, C.lime); px(x, 3, C.limeDk); }
        px(0, 1, C.lime); px(0, 2, C.limeDk); px(31, 1, C.lime); px(31, 2, C.limeDk);
        for (y = 4; y < 7; y++) for (x = 2; x < 30; x++) px(x, y, y === 4 ? C.navy3 : C.navy2);
        for (x = 4; x < 28; x += 4) px(x, 5, (x / 4 + fr) % 2 ? C.peri : C.lime);
        [5, 12, 19, 26].forEach(function (wx) {
          for (y = 7; y < 10; y++) for (x = wx - 1; x <= wx + 1; x++) px(x, y, C.greyDk);
          px(wx + (fr ? 1 : -1), 8, C.white); px(wx, fr ? 7 : 9, C.grey);
        });
      });
      return PX.outline(src, C.navy);
    });
  }
  /* loudspeaker horn mounted on the deck, mouth up */
  function horn() {
    return once('horn', function () {
      return PX.outline(PX.grid(['gGGGGGGg', 'gGddddGg', '.gGddGg.', '..gGGg..', '..nNNn..', '..nNNn..', '...nn...', '...nn...'],
        { g: C.goldSh, G: C.gold, d: C.goldDk, n: C.navy3, N: C.peri }), C.navy);
    });
  }
  /* flame shot (7 x 14), two flicker frames; dud = the fizzled ricochet */
  function shot(fr, dud) {
    return once('shot' + fr + (dud ? 'd' : ''), function () {
      var top = ['...w...', '..wWw..', '..wWw..', '.ywWwy.', '.yoWoy.', 'yooWooy', 'yooWooy', '.yoWoy.', '.ooOoo.', '..oOo..', '..oOo..'];
      var rows = top.concat(fr ? ['...O...', '..O....', '...O...'] : ['...O...', '....O..', '...O...']);
      if (dud) rows = rows.slice().reverse();
      var map = dud ? { w: C.white, W: C.white, y: C.grey, o: C.coral, O: C.coralSh } : { w: C.white, W: C.white, y: C.fl1, o: C.fl3, O: C.fl4 };
      return PX.outline(PX.grid(rows, map), dud ? C.navy : C.coralSh);
    });
  }
  /* Gigi: a graphics card built like a flying saucer (46 x 20); its two fans are its eyes, the hubs the pupils,
     the gold card contacts run along its belly like landing lights */
  function saucer(fr, lk, lit) {
    return once('ufo' + fr + lk + lit, function () {
      var src = PX.make(46, 20, function (px) {
        var x, y, dx, dy;
        for (y = 1; y < 8; y++) for (x = 13; x < 33; x++) {
          dx = (x + .5 - 23) / 9; dy = (y + .5 - 8) / 7;
          if (dx * dx + dy * dy <= 1) px(x, y, (x < 20 && y > 1 && y < 5) ? C.white : (dx > .45 ? '#C9D3FF' : C.periSoft));
        }
        px(22, 0, C.lime); px(23, 0, C.lime);
        for (y = 6; y < 18; y++) for (x = 0; x < 46; x++) {
          dx = (x + .5 - 23) / 23; dy = (y + .5 - 12) / 6;
          if (dx * dx + dy * dy <= 1) px(x, y, dy < -.62 ? C.peri : dy < -.3 ? C.periDk : dy < .35 ? C.navy3 : C.navy2);
        }
        [3, 7, 38, 42].forEach(function (lx, i) { px(lx, 12, (i + lit) % 4 === 0 ? C.white : C.lime); px(lx, 13, (i + lit) % 4 === 0 ? C.lime : C.limeDk); });
        [[13, 12], [33, 12]].forEach(function (f, q) {
          for (y = -6; y <= 6; y++) for (x = -6; x <= 6; x++) {
            var r2 = x * x + y * y;
            if (r2 <= 40) px(f[0] + x, f[1] + y, r2 > 27 ? C.navy : (r2 > 20 ? '#C9D3FF' : C.periSoft));
          }
          for (var b = 0; b < 3; b++) {
            var a = (fr * 40 + b * 120 + q * 60) * Math.PI / 180;
            for (var r = 2.2; r <= 4.8; r += .5) px(Math.round(f[0] + Math.cos(a) * r), Math.round(f[1] + Math.sin(a) * r), C.periSh);
          }
          var ox = f[0] - 1 + lk, oy = f[1] - 1;
          for (y = 0; y < 3; y++) for (x = 0; x < 3; x++) px(ox + x, oy + y, C.navy);
          px(ox, oy, C.white);
        });
        [[20, 15], [21, 16], [22, 16], [23, 16], [24, 16], [25, 15]].forEach(function (q) { px(q[0], q[1], C.lime); });
        for (x = 13; x < 34; x += 2) { px(x, 18, C.gold); px(x, 19, C.goldSh); }
      });
      return PX.outline(PX.outline(src, C.navy), C.peri);     // a periwinkle rim so Gigi reads on the navy sky
    });
  }
  function planet() {
    return once('planet', function () {
      return PX.make(32, 22, function (px) {
        var x, y, dx, dy;
        function ring(front) {
          for (x = 0; x < 32; x++) for (y = 0; y < 22; y++) {
            dx = (x + .5 - 16) / 15.5; dy = (y + .5 - 12) / 3.4;
            var d = dx * dx + dy * dy;
            if (d <= 1 && d >= .62 && ((y + .5 > 12) === front)) px(x, y, y > 12 ? C.periSh : C.peri);
          }
        }
        ring(false);
        for (y = 0; y < 22; y++) for (x = 0; x < 32; x++) {
          dx = (x + .5 - 16) / 8.5; dy = (y + .5 - 11) / 8.5;
          if (dx * dx + dy * dy <= 1) px(x, y, (dx + dy) < -.7 ? '#E4DBFA' : (dx + dy) > .55 ? C.lilacSh : (Math.floor(y / 3) % 2 ? C.lilac : '#C8BBF2'));
        }
        ring(true);
      });
    });
  }
  function skyline() {
    return once('skyline', function () {
      var W = 140, H = 30, bld = '#141C58', win = [C.gold, C.peri, '#3A4699'];
      return PX.make(W, H, function (px) {
        var x = 0, i = 0;
        while (x < W) {
          var bw = 9 + Math.floor(hash(i * 5.3 + 2) * 12), bh = 10 + Math.floor(hash(i * 2.9 + 7) * 19), top = H - bh;
          for (var yy = top; yy < H; yy++) for (var xx = x; xx < Math.min(W, x + bw); xx++) {
            var isWin = (xx - x) % 3 === 1 && (yy - top) % 4 === 2 && xx < x + bw - 1 && yy < H - 2;
            px(xx, yy, isWin ? win[Math.floor(hash(xx * 1.7 + yy * 3.1) * 3)] : bld);
          }
          if (hash(i * 8.1) > .55) { px(x + 2, top - 1, bld); px(x + 2, top - 2, bld); px(x + 2, top - 3, C.coral); }
          x += bw + 1 + Math.floor(hash(i * 7.7) * 3); i++;
        }
      });
    });
  }
  /* static background layers for this phone height: sky bands (under the stars) and the ground (over the skyline) */
  function bgSky(G, g) {
    var H = Math.ceil(G.H) + 1;
    return once('bgsky' + g.rail + '|' + H, function () {
      return PX.make(130, H, function (px, x2) {
        x2.fillStyle = SKY[0]; x2.fillRect(0, 0, 130, H);
        [[g.rail - 108, SKY[1]], [g.rail - 62, SKY[2]], [g.rail - 36, SKY[3]], [g.rail - 18, SKY[4]]].forEach(function (b, i) {
          x2.fillStyle = b[1]; x2.fillRect(0, b[0], 130, H - b[0]);
          for (var x = 0; x < 130; x += 2) x2.fillRect(x + (i % 2), b[0] - 1, 1, 1);
          for (x = 1; x < 130; x += 4) x2.fillRect(x, b[0] - 2, 1, 1);
        });
      });
    });
  }
  function bgGround(G, g) {
    var H = Math.ceil(G.H) + 1;
    return once('bgground' + g.rail + '|' + H, function () {
      return PX.make(130, H - g.rail, function (px, x2) {
        function r(x, y, w, h, col) { x2.fillStyle = col; x2.fillRect(x, y, w, h); }
        r(0, 0, 130, 1, C.limeDk); r(0, 1, 130, 2, C.limeSh); r(0, 3, 130, 1, C.limeDk);
        r(0, 4, 130, H, C.navy3);
        for (var bx = 2; bx < 130; bx += 8) { r(bx, 7, 1, 1, C.stoneLt); r(bx + 4, 12, 1, 1, C.navy2); }
        r(0, 16, 130, H, C.navy2);
      });
    });
  }

  /* ---------- drawing helpers (sp) ---------- */
  function put(G, spr, cx, by, o) {
    o = o || {};
    var sx = o.sx == null ? 1 : o.sx, sy = o.sy == null ? 1 : o.sy, sc = o.s == null ? 1 : o.s, c = G.ctx;
    var w = spr.width * B * sc * sx, h = spr.height * B * sc * sy;
    c.save(); c.imageSmoothingEnabled = false;
    if (o.alpha != null) c.globalAlpha *= clamp(o.alpha);
    var x = cx - w / 2, y = by - h;
    if (sx === 1 && sy === 1 && sc === 1) { x = Math.round(x / B) * B; y = Math.round(y / B) * B; }
    else { x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h); }
    if (o.flip) { c.translate(x + w, y); c.scale(-1, 1); c.drawImage(spr, 0, 0, w, h); }
    else c.drawImage(spr, x, y, w, h);
    c.restore();
  }
  function puff(G, sx, sy, r, a, col) { r = Math.max(1, Math.min(9, Math.round(r))); if (a <= 0) return; G.spr(PX.disc(r, col || C.white), sx / B - r, sy / B - r, { alpha: a }); }
  function sparkle(G, t, t0, sx, sy, col, life) {
    life = life || .3; var d = t - t0; if (d < 0 || d > life) return;
    var u = d / life, L = Math.round(1 + 3 * Math.sin(u * Math.PI)), a = 1 - u * .5, gx = Math.round(sx / B), gy = Math.round(sy / B);
    col = col || C.white;
    G.rect(gx, gy, 1, 1, col, a);
    for (var i = 1; i <= L; i++) { G.rect(gx + i, gy, 1, 1, col, a); G.rect(gx - i, gy, 1, 1, col, a); G.rect(gx, gy + i, 1, 1, col, a); G.rect(gx, gy - i, 1, 1, col, a); }
  }
  /* big pixel confetti burst from a screen point, chunky squares with gravity */
  function burst(G, t, t0, sx, sy, cols, n, spd, life, seed) {
    life = life || 1; var d = t - t0; if (d < 0 || d > life) return;
    n = n || 26; spd = spd || 1; seed = seed || 0;
    for (var i = 0; i < n; i++) {
      var a = hash(i * 1.37 + seed * 3.1) * Math.PI * 2, v = (80 + hash(i * 2.91 + seed) * 170) * spd, hz = hash(i * 4.7 + seed), sz = hz > .7 ? 3 : hz > .35 ? 2 : 1;
      var x = sx + Math.cos(a) * v * d, y = sy + Math.sin(a) * v * d * .85 + 260 * d * d;
      G.rect(Math.round(x / B), Math.round(y / B), sz, sz, cols[i % cols.length], 1 - p(d, life * .55, life));
    }
  }
  function ring(G, t, t0, sx, sy, r0, r1, life, col, wd) {
    var d = t - t0; if (d < 0 || d > life) return;
    var u = d / life, c = G.ctx;
    c.save(); c.globalAlpha = .9 * (1 - u); c.strokeStyle = col || C.white; c.lineWidth = (wd || 6) * (1 - u * .6);
    c.beginPath(); c.arc(sx, sy, r0 + (r1 - r0) * E.out(u), 0, Math.PI * 2); c.stroke(); c.restore();
  }
  /* "+N" rising from a screen point: gold with a navy outline so it reads on the night sky */
  function floatPts(G, t, t0, str, sx, sy) {
    var d = t - t0; if (d < 0 || d > 1.1) return;
    var y = sy - 40 * E.out(clamp(d / 1.1)), s = 1 + .25 * Math.sin(Math.PI * clamp(d / .2)), a = 1 - p(d, .7, 1.1), c = G.ctx;
    c.save(); c.globalAlpha = clamp(a); c.translate(sx, y); c.scale(s, s);
    G.text(str, 0, 3, { size: 24, weight: 800, color: C.navy, stroke: C.navy, strokeW: 9 });
    G.text(str, 0, 0, { size: 24, weight: 800, color: C.gold, stroke: C.navy, strokeW: 7 });
    c.restore();
  }
  function speakerGlyph(G, cx, cy, r, waves) {
    var c = G.ctx, u = r / 21;
    c.save();
    c.fillStyle = C.navy; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = C.white; c.beginPath();
    c.moveTo(cx - 10 * u, cy - 5 * u); c.lineTo(cx - 4 * u, cy - 5 * u); c.lineTo(cx + 3 * u, cy - 11 * u); c.lineTo(cx + 3 * u, cy + 11 * u);
    c.lineTo(cx - 4 * u, cy + 5 * u); c.lineTo(cx - 10 * u, cy + 5 * u); c.closePath(); c.fill();
    c.strokeStyle = C.white; c.lineCap = 'round'; c.lineWidth = 2.5 * u;
    for (var i = 0; i < 2; i++) {
      var on = waves == null ? 1 : clamp(waves * 2 - i);
      if (on <= 0) continue;
      c.save(); c.globalAlpha *= on; c.beginPath(); c.arc(cx + 4 * u, cy, (6 + i * 5) * u, -.85, .85); c.stroke(); c.restore();
    }
    c.restore();
  }
  function bubblePath(c, x, y, w, h, r, tx, ty, oy) {
    var b0 = clamp(tx - 11, x + r, x + w - r - 22), b1 = b0 + 20;
    c.beginPath();
    c.moveTo(x + r, y + oy); c.lineTo(x + w - r, y + oy); c.arcTo(x + w, y + oy, x + w, y + r + oy, r);
    c.lineTo(x + w, y + h - r + oy); c.arcTo(x + w, y + h + oy, x + w - r, y + h + oy, r);
    c.lineTo(b1, y + h + oy); c.lineTo(tx, ty + oy); c.lineTo(b0, y + h + oy);
    c.lineTo(x + r, y + h + oy); c.arcTo(x, y + h + oy, x, y + h - r + oy, r);
    c.lineTo(x, y + r + oy); c.arcTo(x, y + oy, x + r, y + oy, r); c.closePath();
  }
  /* text widths (sp), cached per visit; dropped whenever web fonts finish loading so nothing stays sized to a fallback */
  var MS = {}, msN = 0;
  function resetMeasure() { MS = {}; msN = 0; }
  try { if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', resetMeasure); } catch (e) {}
  function measure(G, str, size, weight) {
    var key = str + '|' + size + '|' + weight; if (MS[key] != null) return MS[key];
    var c = G.ctx; c.save(); c.font = weight + ' ' + size + 'px Lexend, sans-serif'; var w = c.measureText(str).width; c.restore();
    if (++msN > 300) { MS = {}; msN = 1; }
    return (MS[key] = w);
  }
  /* four gold corner brackets locking onto an invader centred at (x, y) */
  function reticle(G, x, y, a, t) {
    var c = G.ctx, s = 1.6 - .6 * Math.min(1, a) + .04 * Math.sin(t * 18), hw = 46 * s, hh = 38 * s, L = 15;
    c.save(); c.globalAlpha = clamp(a * 1.5); c.lineCap = 'square';
    [[C.navy, 8], [C.gold, 4]].forEach(function (st) {
      c.strokeStyle = st[0]; c.lineWidth = st[1]; c.beginPath();
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (d) {
        var cx = x + d[0] * hw, cy = y + d[1] * hh;
        c.moveTo(cx - d[0] * L, cy); c.lineTo(cx, cy); c.lineTo(cx, cy - d[1] * L);
      });
      c.stroke();
    });
    c.restore();
  }

  /* ---------- layout from the screen edges (never a fixed 281) ----------
     Bottom cluster anchored on Lau's deck: speaker bubble, shields, then the counter line a little above them.
     Top cluster anchored under the HUD: the two formation rows. What is left between them is room for the steps.
     The spacing eases from the roomy layout (tall phones, as in the video) down to a tighter one; below about 520 sp
     between the HUD and the deck (16:9 phones inside an in-app browser) a compact variant uses smaller shields and a
     shorter bubble. The step is sized so the most steps a run can take (2 wrongs, 3 with Gigi's rebuilt shield) never
     cross the line: the shields always decide the run, the line shows how close it is. */
  function geo(R) {
    var G = R.G, rail = Math.floor(G.H - 23 - G.bot / 3), RS = rail * B, deck = RS - 24, hud = R.layout.hudY;
    var A = deck - hud, tiny = A < 521, u, T, gap, dz, bubH, bd, sb, SHH;
    if (tiny) { u = clamp((A - 456) / 65); bubH = 74; bd = 60; sb = 8; SHH = 42; T = 58 + 12 * u; gap = 88 + 12 * u; dz = 8 + 6 * u; }
    else { u = clamp((A - 521) / 185); bubH = 80; bd = 72; sb = 11; SHH = 54; T = 70 + 38 * u; gap = 100 + 24 * u; dz = 14 + 21 * u; }
    var bubY = deck - bd - bubH, shB = bubY - sb, shTop = shB - SHH, danger = Math.round(shTop - dz);
    var row0 = Math.round(hud + T); gap = Math.round(gap);
    var room = danger - (row0 + gap + 88);                   // from a two-line pill in the bottom row to the counter line
    return { rail: rail, RS: RS, deck: deck, tip: deck - 66, bubY: bubY, bubH: bubH, shB: shB, shTop: shTop, SHH: SHH, tiny: tiny,
      danger: danger, row: [row0, row0 + gap], hud: hud, room: room, step: Math.max(0, Math.min(44, Math.floor((room - 2) / 3))),
      planetY: Math.round(hud / 3) + (tiny ? 9 : 13),        // game px
      banY: clamp(Math.round((row0 + gap + 88 + danger) / 2) - 24, hud + 70, shTop - 84) };
  }
  /* centre y for a note pill of height h in the gap under the formation: just above the counter line when there is
     room, pushed below the lowest pill when there isn't, and never lower than the shields (it may sit over them, never
     over a meaning or the speaker bubble). extra = a step about to land. */
  function lowY(R, g, h, extra) {
    var s = R.s, F = s.F;
    var lo = (F && !F.flyT ? lowest(R, g, F) : g.row[1] + 88 + s.depth) + (extra || 0);
    return Math.round(Math.min(Math.max(g.danger - 24, lo + h / 2 + 6), g.shB - h / 2));
  }

  /* ---------- content: the 10 targets, each with 3 safe decoys ----------
     All 3 wrong meanings come from every word that is safe next to the target (BK.ok: no banned pair), shuffled, with
     the words not yet cleared this run first, then the ones shown least as decoys (so no meaning keeps coming back).
     A fixed decoy pair would turn up in most rounds and could be ruled out without listening; preferring uncleared
     words keeps "I've already blasted that one" from giving answers away (simulated: 3.9 of 10 right for a player who
     never listens and skips cleared meanings, against 6.0 with the fixed pair; pure guessing is 2.5). */
  function decoys(slug, s) {
    var cl = (s && s.cleared) || {}, sh = (s && s.shown) || {};
    var pool = U.shuffle(BK.WORDS.filter(function (w) { return w !== slug && BK.ok(slug, [w]); }));
    pool.sort(function (a, b) { return ((cl[a] ? 1 : 0) - (cl[b] ? 1 : 0)) || ((sh[a] || 0) - (sh[b] || 0)); });   // stable: shuffled order breaks ties
    var d = pool.slice(0, 3);
    if (s && s.shown) d.forEach(function (w) { s.shown[w] = (s.shown[w] || 0) + 1; });
    return d;
  }
  function makeF(R, slug, kind) {
    var opts = [slug].concat(decoys(slug, R.s)), tones = U.shuffle(TONES), types = U.shuffle([0, 1, 2, 3]);
    opts = U.shuffle(opts).map(function (o, i) { return { slug: o, right: o === slug, text: BK.MEAN[o], tone: tones[i], type: types[i] }; });
    return { slug: slug, opts: opts, kind: kind, t0: R.t, land: R.t + (kind === 'march' ? 5 * ENT + .15 : .6),
      hitI: -1, hitT: 0, flyT: 0, fly: [9, 9, 9, 9], wrongs: [], hintT: -1, hitLook: [1, 2], hitFr: 0 };
  }
  function rightI(F) { for (var i = 0; i < F.opts.length; i++) if (F.opts[i].right) return i; return 0; }

  /* ---------- formation motion ---------- */
  function sideDx(s, t) { var u = clamp((t - s.miT) / .13); return s.dxFrom + (s.dxTo - s.dxFrom) * E.out(u); }
  function depthNow(s, t) { var u = clamp((t - s.depthT) / .2); return s.depthFrom + (s.depth - s.depthFrom) * E.outBack(u); }
  function entryY(F, i, t) {
    var d = t - F.t0;
    if (F.kind === 'march') {                                  // the first formation marches down from the sky in 5 steps
      var y = -225;
      for (var j = 0; j < 5; j++) { var ts = (j + 1) * ENT - ENT * .75; if (d < ts) break; y = -225 + 45 * j + 45 * E.outBack(clamp((d - ts) / .13)); }
      return y;
    }
    var d0 = i * .05, u = p(d, d0, d0 + .42, E.outBack);
    return -400 * (1 - u);
  }
  /* one invader: centre (sp), squash, frame, alpha; null once it has left the screen */
  function slot(R, g, F, i, t) {
    var s = R.s, x = COLX[i] + sideDx(s, t), y = g.row[i % 2] + depthNow(s, t) + entryY(F, i, t), sx = 1, sy = 1;
    var since = t - s.miT, th = since < .16 && since >= 0 ? Math.sin(Math.PI * since / .16) : 0;
    sy *= 1 - .14 * th; sx *= 1 + .1 * th;
    if (F.kind === 'drop') {
      var land = F.t0 + i * .05 + .32, dd = t - F.t0 - i * .05;
      if (dd >= 0 && dd < .25) { sy = 1.14; sx = .9; }
      var jl = jiggle(t, land, .2, 26, 9); sy *= 1 - jl; sx *= 1 + jl * .8;
    }
    var flying = false, fo = F.fly[i];
    if (fo < 9 && F.flyT && t >= F.flyT + fo * .08) {
      var df = t - F.flyT - fo * .08;
      y -= 60 * df + 1500 * df * df; sy *= 1 + Math.min(.5, df * 2.2); sx *= 1 - Math.min(.25, df * 1.1); flying = true;
      if (y < -120) return null;
    }
    var dead = F.hitI === i && F.hitT && t >= F.hitT;
    return { x: x, y: y, sx: sx, sy: sy, fr: s.mi % 2, a: clamp((y - (g.hud + 34)) / 18), dead: dead, flying: flying };
  }
  function pillGeom(G, str, x, y) {
    var info = G.wrap(str, PILL.size, PILL.maxW, 700), w = Math.ceil(info.w) + PILL.padX * 2, h = info.lines.length * PILL.lh + PILL.padY * 2;
    var top = y + 36, px0 = clamp(Math.round(x - w / 2), 4, 386 - w);
    return { lines: info.lines, w: w, h: h, x: px0, y: Math.round(top), cx: px0 + w / 2, cy: top + h / 2, bottom: top + h };
  }
  /* the tap target of an invader: its body and its pill together */
  function slotRect(R, g, F, i, t) {
    var q = slot(R, g, F, i, t); if (!q) return null;
    var pg = pillGeom(R.G, F.opts[i].text, q.x, q.y);
    var x0 = Math.min(q.x - 36, pg.x), x1 = Math.max(q.x + 36, pg.x + pg.w);
    return { x: x0, y: q.y - 28, w: x1 - x0, h: pg.bottom - (q.y - 28), q: q, pg: pg };
  }
  function live(R, F, i) { return F && i !== F.hitI && !F.flyT; }
  /* an invader already shot wrong in this formation: dimmed, and taps on it are ignored (it can't cost a second shield) */
  function tried(F, i, t) { for (var j = 0; j < F.wrongs.length; j++) if (F.wrongs[j].i === i && (t == null || t >= F.wrongs[j].t + .9)) return true; return false; }
  /* Lau's x under a column: the launcher (LX - 36 .. LX + 66) and its horn stay fully on screen */
  function aimX(x) { return clamp(x, 38, 322); }
  /* where the lowest pill will sit once the current step has landed (the counter-line check) */
  function lowest(R, g, F) {
    if (!F) return 0;
    var lo = 0;
    for (var i = 0; i < F.opts.length; i++) {
      if (!live(R, F, i)) continue;
      var pg = pillGeom(R.G, F.opts[i].text, COLX[i], g.row[i % 2] + R.s.depth);
      lo = Math.max(lo, pg.bottom);
    }
    return lo;
  }

  /* ---------- Lau and the launcher ---------- */
  function lauX(s, t) { var sl = s.slide; if (!sl) return s.lx; return sl.from + (sl.to - sl.from) * E.inOut(clamp((t - sl.t0) / sl.dur)); }
  function slideTo(R, x, dur) { var s = R.s, from = lauX(s, R.t); s.slide = { from: from, to: x, t0: R.t, dur: dur || clamp(.16 + Math.abs(x - from) / 800, .16, .45) }; s.lx = x; return s.slide.dur; }
  function mood(R, m, dur) { R.s.mood = m; R.s.moodUntil = R.t + dur; }

  /* ---------- the run ---------- */
  function init(R) {
    var s = R.s;
    s.queue = U.shuffle(BK.WORDS).slice(0, N);
    s.done = 0; s.F = null; s.state = 'start'; s.missN = {}; s.lastSlug = null; s.firstTap = false; s.firstWrong = false;
    s.mi = 0; s.miT = -9; s.nextStep = DT; s.dxFrom = 0; s.dxTo = 0;
    s.depth = 0; s.depthFrom = 0; s.depthT = -9; s.stepDownT = -9;
    s.lx = REST; s.slide = null; s.mood = 'happy'; s.moodUntil = 0; s.hopT = -9; s.chipT = -9;
    s.shields = [1, 1, 1]; s.shT = [-9, -9, -9]; s.rebuild = null;
    s.shot = null; s.sel = null; s.speakT = -9; s.speakDur = .85; s.rev = null; s.bubT0 = null; s.bubOut = null;
    s.fx = []; s.floats = []; s.banner = null; s.note = null; s.chipNote = null; s.ufo = null; s.ufoDone = false; s.gigi = false;
    s.captured = null; s.lineT0 = null;
    s.cleared = {}; s.shown = {}; s.replays = 0; s.readT = -9; s.modeT = -9;
    resetMeasure();
    setState(R, MODE ? 'intro' : 'sound');
    if (MODE) begin(R); else soundSheet(R);
  }
  function setState(R, st) { R.s.state = st; R.phase = st; }
  function banner(R, big, small, fill, delay, dur) { R.s.banner = { big: big, small: small, fill: fill, t0: R.t + (delay || 0), dur: dur || 1.8 }; }
  /* a white note pill; at = 'low' puts it in the gap under the formation (placed once, when it is created) */
  function note(R, text, dur, delay, at) {
    var g = geo(R), y = at === 'low' ? lowY(R, g, noteH(R.G, text)) : at === 'mid' ? g.banY + 20 : at;
    R.s.note = { text: text, t0: R.t + (delay || 0), dur: dur || 1.8, y: y == null ? g.banY + 20 : y };
  }

  /* "Sound on?" check (DOM sheet in the engine's layer, styled like the pause sheet): sound, or Read mode */
  function soundSheet(R) {
    var L = R.el && R.el.querySelector('.arc-layer');
    if (!L) { MODE = 'sound'; begin(R); return; }
    var sh = document.createElement('div');
    sh.className = 'arc-sheet dim'; sh.setAttribute('data-g23-sheet', '');
    sh.innerHTML = '<div class="arc-sheet-card arc-pausecard" role="dialog" aria-modal="true" aria-label="Sound on?">' +
      '<h2>Sound on?</h2><p>Lau’s speaker says each word out loud. Turn your sound up, or play in Read mode: the speaker shows how the word is said instead.</p>' +
      '<div class="arc-say-audio" style="justify-content:center"><button class="arc-abtn" data-g23-test aria-label="Test the sound">' + SPK + 'Test sound</button></div>' +
      '<button class="btn" data-g23-on>Sound is on</button>' +
      '<button class="btn ghost" data-g23-read>Read mode</button></div>';
    L.appendChild(sh);
    var born = Date.now();
    function pick(m) { return function () { if (Date.now() - born < 350 || R.dead || !sh.parentNode) return; sh.remove(); MODE = m; begin(R); }; }
    sh.querySelector('[data-g23-test]').onclick = function () { if (Date.now() - born < 350) return; R.word('acer'); };
    sh.querySelector('[data-g23-on]').onclick = pick('sound');
    sh.querySelector('[data-g23-read]').onclick = pick('read');
    try { sh.querySelector('[data-g23-on]').focus({ preventScroll: true }); } catch (e) {}
  }
  function begin(R) {
    if (R.dead) return;
    setState(R, 'intro');
    banner(R, 'LISTEN', MODE === 'read' ? 'Read how it’s said, tap the meaning' : 'Tap the meaning you hear', C.white, .2, 2.0);
    R.announce(MODE === 'read' ? 'Read mode. The speaker shows how each word is said. Tap the meaning that matches.' : 'Listen to the word, then tap the meaning that matches.');
    R.after(.3, function () { spawn(R); });
  }

  function spawn(R) {
    var s = R.s, slug = s.queue[s.done];
    if (!slug) return finishRun(R);
    var F = s.F = makeF(R, slug, s.done === 0 ? 'march' : 'drop');
    if (s.lineT0 == null) s.lineT0 = R.t + .8;
    s.rev = null; s.sel = null; s.shot = null; s.replays = 0;
    if (s.bubT0 == null || s.bubOut != null) { s.bubT0 = R.t + (F.kind === 'march' ? 1.2 : .1); s.bubOut = null; }
    setState(R, 'drop');
    if (F.kind === 'drop') R.sfx('whoosh');
    else for (var j = 0; j < 5; j++) R.after((j + 1) * ENT - ENT * .75, function () { if (s.F === F) R.sfx('step'); });
    R.after(F.land - R.t, function () {
      if (s.F !== F || R.over) return;
      setState(R, 'aim');
      if (MODE === 'read') readNow(R);                         // no sound plays, so no speaker pulse: the text pops instead
      else speak(R, false);
    });
  }
  function readNow(R) { var s = R.s; if (!s.F) return; s.readT = R.t; R.announce('Read: ' + BK.word(s.F.slug).say); }
  function speak(R, slow) {
    var s = R.s; if (!s.F) return;
    s.speakT = R.t; s.speakDur = slow ? 1.3 : .85;
    R.word(s.F.slug, slow);
  }
  function replay(R, slow) {
    var s = R.s;
    if (R.t - s.speakT < .3) return;
    s.replays++;
    speak(R, slow);
  }
  /* the Read / Hear chip: switch modes mid-run (a noisy store, volume down, or sound back on) */
  function toggleMode(R) {
    var s = R.s;
    if (R.t - s.modeT < .3) return;
    MODE = MODE === 'read' ? 'sound' : 'read';
    s.modeT = R.t; s.replays = 0;
    R.sfx('tap');
    if (!s.F || s.state === 'drop') { R.announce(MODE === 'read' ? 'Read mode on.' : 'Sound mode on.'); return; }   // the landing speaks or shows it
    if (MODE === 'read') readNow(R);
    else { R.announce('Sound mode on.'); speak(R, false); }
  }

  /* ---------- input ---------- */
  function inR(q, r) { return r && q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h; }
  function tap(R, q) {
    var s = R.s, g = geo(R);
    if (R.over || q.y < g.hud + 22) return;
    var bub = bubble(R, g);
    if (bub && bub.live) {
      if (inR(q, bub.chipHit)) { toggleMode(R); return; }
      if (inR(q, bub.slow)) { replay(R, true); return; }
      if (inR(q, bub.replay) || inR(q, bub.body)) { replay(R, false); return; }
    }
    if (s.state !== 'aim') return;
    var i = pickSlot(R, g, q);
    if (i >= 0) fire(R, i);
  }
  function pickSlot(R, g, q) {
    var s = R.s, F = s.F, best = -1, bd = 1e9, t = R.t, i, r;
    for (i = 0; i < F.opts.length; i++) {                    // a tap on a greyed-out invader does nothing (never fires its neighbour)
      if (!live(R, F, i) || !tried(F, i)) continue;
      r = slotRect(R, g, F, i, t);
      if (r && inR(q, r)) return -1;
    }
    for (i = 0; i < F.opts.length; i++) {
      if (!live(R, F, i) || tried(F, i)) continue;
      r = slotRect(R, g, F, i, t); if (!r) continue;
      var pad = 10, inside = inR(q, r), near = inR(q, { x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad });
      if (!near) continue;
      var d = Math.hypot(q.x - (r.x + r.w / 2), q.y - (r.y + r.h / 2)) - (inside ? 1000 : 0);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function key(R, k) {
    var s = R.s;
    if (s.state === 'sound' || R.over) return;
    if (k === 'r' || k === 'R' || k === ' ' || k === 'Enter') { replay(R, false); return; }
    if (k === 's' || k === 'S') { replay(R, true); return; }
    if (k === 'm' || k === 'M') { var b = bubble(R, geo(R)); if (b && b.live) toggleMode(R); return; }
    var n = '1234'.indexOf(k);
    if (n >= 0 && s.state === 'aim' && s.F && n < s.F.opts.length && live(R, s.F, n) && !tried(s.F, n)) fire(R, n);
  }

  /* ---------- a shot ---------- */
  function fire(R, i) {
    var s = R.s, F = s.F, g = geo(R), o = F.opts[i];
    setState(R, 'shoot'); s.firstTap = true;
    s.sel = { i: i, t0: R.t };
    s.note = null;                                             // a hint is done once the player shoots again (it would trail the next step)
    R.sfx('tap');
    var q = slot(R, g, F, i, R.t), x = aimX(q.x);
    var dur = slideTo(R, x);
    R.after(dur + .04, function () {
      if (s.F !== F || R.over) return;
      s.shot = { t0: R.t, t1: R.t + .26, x: x, i: i, right: o.right, bounce: null };
      R.sfx('fireball');
      R.after(.26, function () { if (s.F === F && !R.over) impact(R, F, i); });
    });
  }
  function impact(R, F, i) {
    var s = R.s, g = geo(R), t = R.t, o = F.opts[i], q = slot(R, g, F, i, t), pg = pillGeom(R.G, o.text, q.x, q.y);
    var w = BK.word(F.slug);
    s.sel = null;
    if (o.right) {
      var first = !F.wrongs.length;
      F.hitI = i; F.hitT = t; F.flyT = t + .2; F.hitX = q.x; F.hitY = q.y; F.hitFr = s.mi % 2;
      F.hitLook = look(R, q.x, lauX(s, t));
      var ord = U.shuffle([0, 1, 2]), n = 0;
      for (var j = 0; j < F.opts.length; j++) if (j !== i) F.fly[j] = ord[n++];
      setState(R, 'hit');
      s.lastSlug = F.slug; s.cleared[F.slug] = true;
      if (first) {
        R.good(F.slug, { sparks: 1, from: [q.x, q.y] });
        s.floats.push({ t0: t + .05, s: '+1', x: q.x + 48, y: q.y - 30 });
      }
      s.fx.push({ k: 'hit', t0: t, x: q.x, y: q.y + 6, tone: o.tone, seed: Math.random() * 50 });
      s.rev = { word: w.word, say: w.say, t0: t + .1, t1: t + 1.7 };
      R.sfx('hit'); R.shake(4);
      s.hopT = t + .08; mood(R, 'joy', 1.3);
      R.after(.3, function () { R.word(F.slug); });
      R.announce((first ? 'Right. ' : 'That’s it. ') + w.word + ', ' + w.say + ': ' + BK.MEAN[F.slug] + '.');
      R.after(.75, function () { if (s.F === F) slideTo(R, REST, .4); });
      R.after(1.9, function () { if (s.F === F && !R.over) next(R); });
    } else {
      F.wrongs.push({ i: i, t: t });
      R.bad(F.slug, BK.MEAN[F.slug]);
      s.missN[F.slug] = (s.missN[F.slug] || 0) + 1;
      setState(R, 'bounce');
      var k = nearestShield(s, s.shot ? s.shot.x : q.x);
      var sy = g.shB - Math.round(g.SHH * .55);
      if (s.shot) s.shot.bounce = { t0: t, t1: t + .22, x0: s.shot.x, y0: pg.bottom, x: SHX[k], y: sy, k: k };
      s.fx.push({ k: 'zap', t0: t, x: q.x, y: pg.bottom });
      R.sfx('bump');
      R.announce('Not quite. That was ' + o.text + '. The right one is blinking.');
      R.after(.22, function () { chip(R, F, k); });
    }
  }
  function look(R, ix, LX) { var dx = LX - ix; return [dx < -45 ? 0 : dx > 45 ? 2 : 1, 2]; }
  function nearestShield(s, x) {
    var best = 1, bd = 1e9;
    for (var k = 0; k < 3; k++) if (s.shields[k]) { var d = Math.abs(SHX[k] - x); if (d < bd) { bd = d; best = k; } }
    return best;
  }
  function chip(R, F, k) {
    var s = R.s, g = geo(R), t = R.t;
    if (R.over || s.F !== F) return;
    s.shields[k] = 0; s.shT[k] = t; s.chipT = t;
    s.fx.push({ k: 'debris', t0: t, x: SHX[k] - 7, y: g.shB - Math.round(g.SHH * .83) });
    R.loseHeart(); R.sfx('crack'); R.shake(6);
    mood(R, 'hurt', .8);
    F.hintT = t;
    if (R.hearts <= 0) {
      gameOver(R, F, 'Shields down', 'The shields are down.');
      s.chipNote = { k: k, t0: t, y: lowY(R, g, 36, Math.max(0, g.danger - lowest(R, g, F))), text: 'Shields down' };
      R.after(.2, function () {                                 // with the last shield gone they march on to the counter line
        if (s.F !== F) return;
        var d = g.danger - lowest(R, g, F);
        if (d > 3) { s.depthFrom = depthNow(s, R.t); s.depth += d; s.depthT = R.t; s.stepDownT = R.t; R.sfx('step'); }
      });
      return;
    }
    s.chipNote = { k: k, t0: t, y: lowY(R, g, 36, g.step) };   // placed where it clears the formation after its step
    R.after(.2, function () {
      if (R.over || s.F !== F) return;
      s.depthFrom = depthNow(s, R.t); s.depth += g.step; s.depthT = R.t; s.stepDownT = R.t;
      R.sfx('step');
      if (lowest(R, g, F) > g.danger) return gameOver(R, F, 'They reached the counter', 'The invaders reached the counter.');
      R.after(.13, function () {
        if (R.over || s.F !== F) return;
        setState(R, 'aim');
        if (!s.firstWrong) { s.firstWrong = true; note(R, MODE === 'read' ? 'The blinking one matches' : 'Listen again. The blinking one matches', 2.4, 1.0, 'low'); }
        if (MODE !== 'read') R.after(.4, function () { if (s.F === F && s.state === 'aim') speak(R, true); });
      });
    });
  }
  /* out of shields or too close: the right one blinks and the word is revealed (every wrong shows the right one) */
  function gameOver(R, F, title, said) {
    var s = R.s, w = BK.word(F.slug);
    setState(R, 'out');
    F.hintT = R.t;
    s.rev = { word: w.word, say: w.say, t0: R.t + .35, t1: R.t + 99 };
    R.after(.5, function () { R.word(F.slug); });
    R.announce(said + ' The word was ' + w.word + ': ' + BK.MEAN[F.slug] + '.');
    R.end({ reason: 'out', title: title, delay: 2.1 });
  }
  function next(R) {
    var s = R.s;
    s.done++;
    if (s.done >= N) return finishRun(R);
    if (s.done === SAUCER_AT && !s.ufoDone) return saucerIn(R);
    spawn(R);
  }
  function finishRun(R) {
    var s = R.s;
    s.F = null; s.bubOut = R.t;
    setState(R, 'done');
    var held = R.hearts === R.lives;
    var by = geo(R).banY;
    if (held) { R.addSparks(3, 195, by + 58); s.floats.push({ t0: R.t + .3, s: '+3', x: 300, y: by + 40 }); }
    banner(R, 'ALL CLEAR', held ? 'All 10 words, shields held' : 'All 10 words blasted', C.lime, 0, 2.2);
    R.sfx('flag');
    R.end({ reason: 'done', title: R.wrong ? 'All 10 cleared' : 'Perfect defence', delay: 2.0 });
  }

  /* ---------- Gigi's saucer and the Say-it checkpoint ---------- */
  function saucerIn(R) {
    var s = R.s;
    s.ufoDone = true; s.F = null; s.bubOut = R.t;
    s.ufo = { st: 'in', t0: R.t };
    setState(R, 'saucer');
    R.sfx('beam');
    R.announce('Gigi’s saucer flies over. Say the word clearly to capture it.');
    R.after(1.6, function () { if (!R.over) sayCheck(R); });
  }
  function sayWord(R) {
    var s = R.s, best = null, n = 0;
    Object.keys(s.missN).forEach(function (w) { if (s.missN[w] > n) { n = s.missN[w]; best = w; } });
    return best || s.lastSlug || BK.WORDS[2];
  }
  function sayCheck(R) {
    var s = R.s, slug = sayWord(R);
    s.ufo.st = 'say';
    setState(R, 'say');
    R.say({ slug: slug, title: 'Capture the saucer', sub: 'Say it clearly', tip: BK.TIPS[slug] }).then(function (res) {
      if (R.dead || R.over) return;
      if (res.passed) capture(R, res.method === 'tap', slug); else escape(R, slug);
    });
  }
  function ufoPos(R, g) {
    var s = R.s, u = s.ufo, t = R.t; if (!u) return null;
    var uy = g.row[0] + 6, LX = lauX(s, t), d;
    if (u.st === 'in' || u.st === 'say') { d = t - u.t0; return { x: U.k(d, [[0, -70], [1.1, 195, E.out]]), y: uy + 4 * Math.sin(d * 4.2), s: 1, look: d < 1.1 ? 2 : 1 }; }
    if (u.st === 'beam') {
      d = t - u.tb; var w = E.inOut(clamp((d - .12) / .58));
      return { x: u.x0 + (LX - u.x0) * w + 3 * Math.sin(t * 60) * w * (1 - w) * 4, y: u.y0 + (g.tip - 58 - u.y0) * w, s: 1 - w / 3, look: 1 };
    }
    if (u.st === 'caught') { d = t - u.tc; return { x: u.cx, y: u.cy + 3 * Math.sin(d * 5), s: 2 / 3, look: Math.sin(t * 2) > 0 ? 2 : 0 }; }
    if (u.st === 'perch') {
      // parked below the planet, right of the top row, clear of the bottom row's last invader
      d = t - u.tp; var w2 = E.inOut(clamp(d / .8)), px0 = 342, py0 = Math.min(Math.max(g.row[0] + 8, (g.planetY + 23) * B + 20), g.row[1] - 47);
      return { x: u.cx + (px0 - u.cx) * w2, y: u.cy + (py0 - u.cy) * w2 + 3 * Math.sin(t * 2.4) * w2, s: 2 / 3 + (.5 - 2 / 3) * w2, look: LX < px0 - 60 ? 0 : 1 };
    }
    if (u.st === 'escape') {
      d = t - u.te; var x = u.x0 + 60 * d + 380 * d * d;
      if (x > 480) return null;
      return { x: x, y: u.y0 - 50 * d + 6 * Math.sin(d * 18), s: 1, look: 2 };
    }
    return null;
  }
  function capture(R, weak, slug) {
    var s = R.s, g = geo(R), up = ufoPos(R, g);
    s.ufo = { st: 'beam', tb: R.t, x0: up.x, y0: up.y };
    setState(R, 'capture');
    R.sfx('beam');
    R.after(.7, function () {
      if (R.over) return;
      var LX = lauX(s, R.t), cx = LX, cy = g.tip - 58, n = weak ? 3 : 5;
      s.ufo = { st: 'caught', tc: R.t, cx: cx, cy: cy };
      s.captured = { t0: R.t, x: cx, y: cy };
      R.addSparks(n, cx, cy);
      s.floats.push({ t0: R.t + .05, s: '+' + n, x: Math.min(330, cx + 90), y: cy + 10 });
      R.sfx('powerup'); R.shake(4); R.flash(.3);
      s.hopT = R.t; mood(R, 'joy', 1.6);
      s.gigi = true;
      var k = -1; for (var i = 0; i < 3; i++) if (!s.shields[i] && (k < 0 || Math.abs(SHX[i] - 195) < Math.abs(SHX[k] - 195))) k = i;
      if (k >= 0) {
        s.rebuild = { k: k, t0: R.t, t1: R.t + .6 };
        R.after(.6, function () { s.shields[k] = 1; s.shT[k] = -9; R.gainHeart(); R.sfx('cage'); });
        R.announce('Captured. Gigi joins Lau and a shield is rebuilt.');
      } else R.announce('Captured. Gigi joins Lau.');
      R.after(1.1, function () { if (R.over) return; s.ufo = { st: 'perch', tp: R.t, cx: cx, cy: cy }; });
      R.after(2.1, function () { if (!R.over) spawn(R); });
    });
  }
  function escape(R, slug) {
    var s = R.s, g = geo(R), up = ufoPos(R, g);
    s.ufo = { st: 'escape', te: R.t, x0: up.x, y0: up.y };
    setState(R, 'escape');
    R.sfx('whoosh');
    var w = BK.word(slug), lab = BK.label(slug), kp = 'Keep practising ' + lab, same = w.say.toLowerCase() === lab.toLowerCase();
    var txt = 'Gigi flew off\n' + kp + (same ? '' : measure(R.G, kp + ' · ' + w.say, 17, 700) > 340 ? '\n' + w.say : ' · ' + w.say);
    note(R, txt, 2.2, 0, 'mid');
    R.after(2.3, function () { if (!R.over) { s.ufo = null; spawn(R); } });   // the next formation drops in once the note has gone
  }

  /* ---------- update ---------- */
  function update(R, dt) {
    var s = R.s, t = R.t;
    if (t >= s.nextStep) {                                     // the fixed march timer
      s.nextStep += DT; s.mi++;
      s.dxFrom = sideDx(s, t); s.dxTo = PAT[(s.mi - 1) % 8] * B; s.miT = t;
      if (s.F && !s.F.flyT && t >= s.F.land && (s.state === 'aim' || s.state === 'drop' || s.state === 'shoot' || s.state === 'bounce')) R.sfx('step');
    }
    if (s.mood !== 'happy' && t >= s.moodUntil) s.mood = 'happy';
    if (s.shot && t > s.shot.t1 + .8) s.shot = null;
    for (var i = s.fx.length - 1; i >= 0; i--) if (t - s.fx[i].t0 > 1.4) s.fx.splice(i, 1);
    for (i = s.floats.length - 1; i >= 0; i--) if (t - s.floats[i].t0 > 1.2) s.floats.splice(i, 1);
  }

  /* ---------- drawing ---------- */
  var STARS = [];
  (function () {
    for (var i = 0; i < 90; i++) {
      var layer = i < 50 ? 0 : i < 78 ? 1 : 2;
      STARS.push({ x: hash(i * 3.17 + .5) * 130, y: hash(i * 7.31 + 1.2), layer: layer, ph: hash(i * 1.9) * 6.28, f: 1.5 + hash(i * 5.5) * 3,
        col: layer === 0 ? (i % 3 ? C.periSh : C.periDk) : layer === 1 ? (i % 4 ? C.white : C.periSoft) : (i % 2 ? C.white : C.gold) });
    }
  })();
  var SPEED = [2.2, 5.5, 11];
  function drawSky(R, G, g) {
    var t = R.t, H = G.H + 20;
    G.clear(SKY[0]);
    G.spr(bgSky(G, g), 0, 0);
    for (var i = 0; i < STARS.length; i++) {
      var st = STARS[i], y = ((st.y * H + t * SPEED[st.layer]) % H + H) % H - 10, x = Math.floor(st.x);
      if (y > g.rail - 10) continue;
      var tw = .55 + .45 * Math.sin(t * st.f + st.ph), fy = Math.floor(y);
      if (st.layer === 2) {
        var L = tw > .75 ? 2 : 1;
        G.rect(x, fy, 1, 1, st.col, .95);
        for (var q = 1; q <= L; q++) { G.rect(x + q, fy, 1, 1, st.col, .6 * tw); G.rect(x - q, fy, 1, 1, st.col, .6 * tw); G.rect(x, fy + q, 1, 1, st.col, .6 * tw); G.rect(x, fy - q, 1, 1, st.col, .6 * tw); }
      } else G.rect(x, fy, 1, 1, st.col, st.layer === 0 ? .45 + .35 * tw : .6 + .4 * tw);
    }
    G.spr(planet(), 94, g.planetY + Math.round(Math.sin(t * .25) * 1.2));
    var sk = skyline();
    G.spr(sk, -5 + Math.round(Math.sin(t * .2) * 2), g.rail - sk.height);
    G.spr(bgGround(G, g), 0, g.rail);
  }
  function drawDanger(R, G, g) {
    var s = R.s, t = R.t; if (s.lineT0 == null) return;
    var a = p(t, s.lineT0, s.lineT0 + .6);
    var flash = t - s.stepDownT < 1.2 ? (Math.floor((t - s.stepDownT) / .15) % 2 === 0 ? 1 : .35) : 0;
    // on the last shield (or one step from the line) it pulses: the next wrong shot ends the run
    var close = s.F && !s.F.flyT && !R.over && (R.hearts === 1 || lowest(R, g, s.F) + g.step > g.danger);
    var pulse = close ? .5 + .5 * Math.sin(t * 6) : 0;
    var col = flash || pulse ? C.coral : C.periDk, al = a * (flash ? .95 * flash : pulse ? .4 + .5 * pulse : .5);
    for (var x = 4; x < 130; x += 6) G.rect(x, Math.round(g.danger / B), 3, 1, col, al);
  }
  function drawShields(R, G, g) {
    var s = R.s, t = R.t;
    var sm = g.tiny, kk = sm ? 'shieldS' : 'shield';
    for (var k = 0; k < 3; k++) {
      var down = !s.shields[k], jx = jiggle(t, s.shT[k], 6, 50, 9), spr = shield(down, sm);
      put(G, spr, SHX[k] + jx, g.shB, { alpha: down ? .55 : 1 });
      if (t - s.shT[k] >= 0 && t - s.shT[k] < .1) put(G, whiteOf(spr, kk + '1'), SHX[k] + jx, g.shB, { alpha: .85 });
      var rb = s.rebuild;
      if (rb && rb.k === k && t >= rb.t1 - .05 && t < rb.t1 + .25) put(G, whiteOf(shield(false, sm), kk + '0'), SHX[k], g.shB, { alpha: .9 * (1 - p(t, rb.t1, rb.t1 + .25)) });
    }
    var rb2 = s.rebuild;                                       // chunks flying back home into the rebuilt shield
    if (rb2) {
      var BX = SHX[rb2.k] - 7, BY = g.shB - Math.round(g.SHH * .83);
      for (var j = 0; j < 14; j++) {
        var a = Math.PI * (1.05 + hash(j * 2.3) * .9) + (j % 2 ? .4 : -.2);
        var r = p(t, rb2.t0 + j * .02, rb2.t1 - .05, E.inOut);
        if (r > 0 && r < 1) {
          var ox = BX + Math.cos(a) * 70, oy = BY - 40 - hash(j * 3.3) * 50;
          G.rect(Math.round((ox + (BX - ox) * r) / B), Math.round((oy + (BY - oy) * r) / B), 1, 1, j % 2 ? C.lilac : C.white);
        }
      }
      for (var qq = 0; qq < 4; qq++) sparkle(G, t, rb2.t1 - .1 + qq * .05, BX + [-14, 18, -4, 26][qq], BY + [-6, 2, 16, -10][qq], qq % 2 ? C.lime : C.white);
    }
  }
  function drawFormation(R, G, g, LX) {
    var s = R.s, F = s.F, t = R.t, c = G.ctx; if (!F) return;
    var talking = t - s.speakT < s.speakDur + .2;
    for (var i = 0; i < F.opts.length; i++) {
      var q = slot(R, g, F, i, t); if (!q || q.a <= 0) continue;
      var o = F.opts[i];
      if (!q.dead) {
        var dx = LX - q.x, lk = [dx < -45 ? 0 : dx > 45 ? 2 : 1, q.flying ? 0 : 2];
        if (talking) lk = [LX + 45 > q.x + 20 ? 2 : 1, 2];
        var spr = invader(o.type, o.tone, q.fr, lk);
        if (t - s.stepDownT >= 0 && t - s.stepDownT < .25) {          // the step closer: speed lines trail above
          var sa = 1 - p(t, s.stepDownT, s.stepDownT + .25), top = q.y - 24;
          [-15, 0, 15].forEach(function (ox, n) { var len = (n === 1 ? 7 : 5) * B; G.rect(Math.round((q.x + ox) / B), Math.round((top - len - 4) / B), 1, len / B, TONE[o.tone][2], .85 * sa); });
        }
        put(G, spr, q.x, q.y + 27, { sx: q.sx, sy: q.sy, alpha: q.a * (tried(F, i, t) ? .45 : 1) });
      } else {
        var dh = t - F.hitT, hs = invader(o.type, o.tone, F.hitFr, F.hitLook);
        if (dh < .06) { put(G, whiteOf(hs, 'inv' + o.type + o.tone + F.hitFr + F.hitLook[0] + F.hitLook[1]), F.hitX, F.hitY + 31, { sx: 1.3, sy: 1.3 }); continue; }
        if (dh > .6) continue;
        var hw = hs.width / 2, hh = hs.height / 2;
        c.save(); c.imageSmoothingEnabled = false; c.globalAlpha = 1 - p(dh, .35, .6);
        for (var qd = 0; qd < 4; qd++) {
          var qx = qd % 2, qy = qd >> 1, ox2 = (qx ? 1 : -1) * (8 + 170 * dh), oy2 = (qy ? 1 : -1) * (4 + 70 * dh) - 120 * dh + 520 * dh * dh;
          var X = Math.round((F.hitX - hs.width * B / 2 + qx * hw * B + ox2) / B) * B, Y = Math.round((F.hitY - hs.height * B / 2 + qy * hh * B + oy2) / B) * B;
          c.drawImage(hs, qx * hw, qy * hh, hw, hh, X, Y, hw * B, hh * B);
        }
        c.restore();
      }
    }
  }
  function drawPill(G, gm, o) {
    o = o || {};
    var c = G.ctx, s = o.s == null ? 1 : o.s; if (s <= 0 || o.alpha === 0) return;
    var bg = o.bg || C.white, fg = o.fg || C.navy, bd = o.border || C.navy;
    c.save();
    if (o.alpha != null) c.globalAlpha *= clamp(o.alpha);
    if (s !== 1) { c.translate(gm.cx, gm.cy); c.scale(s, s); c.translate(-gm.cx, -gm.cy); }
    if (o.glow) { c.save(); c.globalAlpha *= o.glow; c.fillStyle = o.glowCol || C.lime; PX.roundRect(c, gm.x - 8, gm.y - 8, gm.w + 16, gm.h + 16, 20); c.fill(); c.restore(); }
    G.box(gm.x, gm.y, gm.w, gm.h, { bg: bg, border: bd, borderW: o.borderW || 3, r: 14 });
    for (var i = 0; i < gm.lines.length; i++) G.text(gm.lines[i], gm.cx, gm.y + PILL.padY + PILL.lh * (i + .5) + 1, { size: PILL.size, weight: 700, color: fg });
    c.restore();
  }
  function drawPills(R, G, g) {
    var s = R.s, F = s.F, t = R.t, c = G.ctx; if (!F) return;
    for (var i = 0; i < F.opts.length; i++) {
      var q = slot(R, g, F, i, t); if (!q) continue;
      var o = F.opts[i], gm = pillGeom(G, o.text, q.x, q.y), st = { alpha: q.a * clamp((gm.cy - g.hud - 30) / 40) };
      if (st.alpha <= 0) continue;
      if (!q.dead) {                                           // arms holding the pill, in the invader's shade
        var tone = TONE[o.tone], ay = Math.round((q.y + 18) / B) * B;
        c.save(); c.globalAlpha = st.alpha; c.fillStyle = tone[1];
        [-14, 11].forEach(function (ox) {
          var ax = Math.round((q.x + ox) / B) * B;
          c.fillRect(ax, ay, B, gm.y - ay + 3);
          c.fillStyle = tone[0]; c.fillRect(ax - 3, gm.y - 3, 9, 6); c.fillStyle = tone[1];
        });
        c.restore();
      }
      var wr = null; F.wrongs.forEach(function (w) { if (w.i === i && t >= w.t && t < w.t + .9) wr = w; });
      if (wr) {
        var dw = t - wr.t;
        gm = pillGeom(G, o.text, q.x + jiggle(t, wr.t, 9, 46, 7), q.y);
        st.bg = C.coral; st.fg = C.white; st.s = 1 + .1 * Math.sin(Math.PI * clamp(dw / .2));
        drawPill(G, gm, st);
        G.badge(gm.x + gm.w - 2, gm.y - 4, 17, false, (2.2 - 1.2 * E.out(clamp(dw / .18))) * (1 - p(dw, .7, .9)), Math.min(1, dw / .06) * (1 - p(dw, .7, .9)));
        continue;
      }
      if (tried(F, i, t)) {
        st.bg = '#C9CDE0'; st.fg = C.ink2; st.border = C.greyDk; st.alpha *= .8;
        drawPill(G, gm, st);
        G.badge(gm.x + gm.w - 2, gm.y - 2, 11, false, 1, st.alpha);
        continue;
      }
      if (F.hintT >= 0 && o.right && !q.dead && t >= F.hintT) {   // the right one blinks lime after a wrong shot
        var hd = t - F.hintT, on = hd < 1.8 ? Math.floor(hd / .2) % 2 === 0 : true;
        st.bg = on ? C.lime : C.limeSoft; st.glow = hd < 1.8 ? (on ? .45 : .15) : .25 + .1 * Math.sin(t * 6);
        st.s = 1 + (hd < 1.8 ? .06 * Math.abs(Math.sin(hd * 7.85)) : .03 * Math.abs(Math.sin(t * 4)));
      }
      if (s.sel && s.sel.i === i) {                            // the tapped meaning: gold border + an aim reticle
        var sel = E.outBack(clamp((t - s.sel.t0) / .16));
        st.border = C.gold; st.borderW = 5; st.glow = .7 * Math.min(1, sel); st.glowCol = C.gold; st.s = (st.s || 1) * (1 + .07 * sel);
        reticle(G, q.x, q.y, sel, t);
      }
      if (q.dead) {
        var dh = t - F.hitT, hold = 1.3;
        st.bg = C.lime; st.alpha = 1 - p(dh, hold, hold + .25);
        st.s = 1 + .14 * Math.sin(Math.PI * clamp(dh / .22));
        gm = pillGeom(G, o.text, F.hitX, F.hitY - 26 * E.out(clamp(dh / .6)));
        drawPill(G, gm, st);
        G.badge(gm.x + gm.w - 2, gm.y - 4, 17, true, (2.2 - 1.2 * E.out(clamp(dh / .18))) * (1 - p(dh, hold, hold + .25)), Math.min(1, dh / .06) * st.alpha);
        continue;
      }
      drawPill(G, gm, st);
    }
  }
  function drawFx(R, G) {
    var s = R.s, t = R.t, c = G.ctx;
    s.fx.forEach(function (f) {
      var d = t - f.t0; if (d < 0) return;
      if (f.k === 'hit') {
        var P = TONE[f.tone];
        if (d < .12) { c.save(); c.globalAlpha = .9 * (1 - d / .12); c.fillStyle = C.white; c.beginPath(); c.arc(f.x, f.y, 30 + d * 160, 0, Math.PI * 2); c.fill(); c.restore(); }
        ring(G, t, f.t0, f.x, f.y, 10, 70, .35, C.white, 7);
        ring(G, t, f.t0 + .05, f.x, f.y, 8, 48, .3, P[0], 5);
        burst(G, t, f.t0, f.x, f.y, [P[0], P[1], C.white, C.gold, P[2]], 40, 1.35, 1.15, f.seed);
        for (var q = 0; q < 5; q++) sparkle(G, t, f.t0 + .05 + q * .05, f.x + Math.cos(q * 1.3) * (34 + q * 4), f.y + Math.sin(q * 1.3) * 26, q % 2 ? C.gold : C.white, .3);
      } else if (f.k === 'zap') {
        ring(G, t, f.t0, f.x, f.y, 4, 26, .22, C.coral, 5);
        for (var z = 0; z < 4; z++) sparkle(G, t, f.t0 + z * .02, f.x + [-16, 14, -8, 20][z], f.y + [4, 8, 14, -2][z], z % 2 ? C.white : C.coral, .22);
      } else if (f.k === 'debris') {
        ring(G, t, f.t0, f.x + 7, f.y, 4, 34, .26, C.coral, 6);
        if (d < .3) puff(G, f.x + 7, f.y, 3 + d * 20, 1 - d / .3, C.lilac);
        for (var j = 0; j < 14; j++) {
          if (d >= .8) break;
          var a = Math.PI * (1.05 + hash(j * 2.3) * .9) + (j % 2 ? .4 : -.2), v = 70 + hash(j * 5.1) * 120, sz = j % 3 ? 2 : 3;
          G.rect(Math.round((f.x + Math.cos(a) * v * d) / B), Math.round((f.y + Math.sin(a) * v * d + 300 * d * d) / B), sz, sz, j % 2 ? C.lilac : C.lilacSh, 1 - p(d, .5, .8));
        }
      }
    });
    var cp = s.captured;                                       // the capture pop: flash, two rings, confetti fanning sideways
    if (cp) {
      var dc = t - cp.t0;
      if (dc >= 0 && dc < .8) {
        if (dc < .1) { c.save(); c.globalAlpha = .7 * (1 - dc / .1); c.fillStyle = C.white; c.beginPath(); c.arc(cp.x, cp.y, 26 + dc * 160, 0, Math.PI * 2); c.fill(); c.restore(); }
        ring(G, t, cp.t0, cp.x, cp.y, 12, 58, .32, C.lime, 7);
        ring(G, t, cp.t0 + .06, cp.x, cp.y, 10, 40, .28, C.white, 4);
        var cols = [C.lime, C.gold, C.white, C.peri, C.mint];
        for (var i = 0; i < 20; i++) {
          var side = i % 2 ? 1 : -1, an = (.12 + hash(i * 1.37 + 5.1) * .5) * Math.PI, vv = 150 + hash(i * 2.91 + 1.3) * 140, sz2 = hash(i * 4.7) > .6 ? 3 : 2;
          var x = cp.x + side * Math.sin(an) * vv * dc, y = cp.y - Math.cos(an) * vv * dc * .8 + 120 * dc * dc;
          G.rect(Math.round(x / B), Math.round(y / B), sz2, sz2, cols[i % cols.length], 1 - p(dc, .45, .8));
        }
      }
    }
  }
  function shotY(sh, t, g, yEnd) { var u = clamp((t - sh.t0) / (sh.t1 - sh.t0)); return g.tip - (g.tip - yEnd) * (u * .7 + u * u * .3); }
  function drawShots(R, G, g) {
    var s = R.s, sh = s.shot, t = R.t, c = G.ctx; if (!sh) return;
    var d = t - sh.t0;
    if (d >= 0 && d < .14) { puff(G, sh.x, g.tip - 4, 4 + d * 40, 1 - d / .14, C.fl2); puff(G, sh.x, g.tip - 6, 2 + d * 26, 1 - d / .14, C.white); }
    if (d >= 0 && d < .25) for (var e = 0; e < 5; e++) sparkle(G, t, sh.t0 + e * .02, sh.x + [-18, 16, -10, 22, 0][e], g.tip - [4, 10, 20, 2, 24][e], e % 2 ? C.fl1 : C.fl3, .2);
    var F = s.F, yEnd = g.row[0];
    if (F) { var q = slot(R, g, F, sh.i, Math.min(t, sh.t1)); if (q) yEnd = pillGeom(G, F.opts[sh.i].text, q.x, q.y).bottom; }
    if (t >= sh.t0 && t < sh.t1) {
      var y = shotY(sh, t, g, yEnd), yT = shotY(sh, Math.max(sh.t0, t - .09), g, yEnd) + 40, X = Math.round(sh.x / B) * B;
      c.save(); c.globalAlpha = .35; c.fillStyle = C.fl2; c.fillRect(X - 6, Math.round(y / B) * B, 12, Math.max(0, yT - y));
      c.globalAlpha = .8; c.fillStyle = C.fl1; c.fillRect(X - 3, Math.round(y / B) * B, 6, Math.max(0, yT - y)); c.restore();
      for (var i = 1; i <= 6; i++) {
        var ty = shotY(sh, Math.max(sh.t0, t - i * .02), g, yEnd);
        G.rect(Math.round(sh.x / B) + ((i * 7) % 3) - 1, Math.round((ty + 46) / B), 1, 1, i < 3 ? C.fl2 : C.fl4, .9 - i * .12);
      }
      put(G, shot(Math.floor(t * 24) % 2), sh.x, y + 42);
    }
    var bo = sh.bounce;                                        // the ricochet back down into a shield
    if (bo && t >= bo.t0 && t < bo.t1) {
      var u = (t - bo.t0) / (bo.t1 - bo.t0), bx = bo.x0 + (bo.x - bo.x0) * u, by = bo.y0 + (bo.y - bo.y0) * u;
      for (var j = 1; j <= 4; j++) { var uu = Math.max(0, u - j * .09); G.rect(Math.round((bo.x0 + (bo.x - bo.x0) * uu) / B), Math.round((bo.y0 + (bo.y - bo.y0) * uu) / B), 1, 1, j % 2 ? C.grey : C.coral, .8 - j * .15); }
      put(G, shot(Math.floor(t * 30) % 2, true), bx, by + 21, { flip: Math.floor(t * 20) % 2 === 1 });
    }
  }
  function lauState(R, g, LX) {
    var s = R.s, t = R.t, st = { y: 0, sq: 0, mood: s.mood, look: [0, -1], frame: Math.floor(t * 7) % 4, run: 0, blink: 0, v: 0 };
    var sl = s.slide;
    if (sl && t >= sl.t0 && t < sl.t0 + sl.dur) { st.v = (sl.to - sl.from) / sl.dur; st.run = 1; st.frame = Math.floor((t - sl.t0) * 14) % 4; }
    if (sl) st.sq += jiggle(t, sl.t0 + sl.dur, .16, 30, 10);
    var hd = (t - s.hopT) / .34; if (hd > 0 && hd < 1) st.y = 4 * 6 * hd * (1 - hd);
    st.sq += jiggle(t, s.hopT + .34, .22, 28, 9);
    if (s.shot) { var d = t - s.shot.t0; if (d >= 0 && d < .25) st.sq += .24 * Math.exp(-d * 16); }
    st.sq += jiggle(t, s.chipT, .2, 40, 8);
    if (st.v) st.look = [st.v > 0 ? 1 : -1, -.6];
    else if (t - s.speakT < s.speakDur + .1 && MODE !== 'read') st.look = [1, .3];
    else if (s.ufo && s.ufo.st !== 'perch') { var up = ufoPos(R, g); if (up) st.look = [clamp((up.x - LX) / 70, -1, 1), -1]; }
    if (st.mood === 'happy' && !st.run && ((t + .7) % 3.3) < .1) st.blink = 1;
    return st;
  }
  function drawLauncher(R, G, g, LX, L) {
    var s = R.s, t = R.t;
    if (t - s.speakT < s.speakDur + .3) {                      // gold sound arcs out of the horn while it talks
      var d = t - s.speakT, hx = LX + 42, hy = g.deck - 27, c = G.ctx;
      for (var i = 0; i < 3; i++) {
        var ph = ((d + i * .18) % .54) / .54, al = (1 - ph) * (1 - p(d, s.speakDur, s.speakDur + .3));
        c.save(); c.globalAlpha = al; c.strokeStyle = C.gold; c.lineWidth = 3;
        c.beginPath(); c.arc(hx, hy + 10, 10 + ph * 26, -Math.PI * .78, -Math.PI * .22); c.stroke(); c.restore();
      }
    }
    put(G, launcher(Math.floor(LX / 5) % 2), LX + 15, g.RS);
    var hs = 1, dd = t - s.speakT; if (dd >= 0 && dd < s.speakDur) hs = 1 + .12 * Math.abs(Math.sin(dd * 18));
    put(G, horn(), LX + 42, g.deck + 3, { sx: 1 / hs * (hs > 1 ? 1.06 : 1), sy: hs });
    var lspr = PX.lau({ h: 22, frame: L.frame, run: L.run, look: L.look, mood: L.mood, blink: L.blink });
    put(G, lspr, LX, g.deck + 3 - L.y * B, { sx: 1 + L.sq * .8, sy: 1 - L.sq });
    if (L.v) {                                                 // rolling dust and speed ticks
      for (var j = 0; j < 4; j++) { var q = ((t * 7 + j * .25) % 1); puff(G, LX + 15 - Math.sign(L.v) * (50 + q * 30), g.RS - 6 - q * 10, 2 + q * 3, (1 - q) * .7); }
      for (j = 0; j < 3; j++) G.rect(Math.round((LX - Math.sign(L.v) * (40 + j * 10)) / B), Math.round((g.deck - 50 + j * 18) / B), 4, 1, C.white, .5);
    }
  }
  function drawUfo(R, G, g, LX) {
    var s = R.s, u = s.ufo, t = R.t; if (!u) return;
    var up = ufoPos(R, g); if (!up) return;
    var fr = Math.floor(t * (u.st === 'beam' ? 30 : 14)) % 3, lit = Math.floor(t * 8) % 4, spr = saucer(fr, up.look, lit);
    if (u.st === 'in' || u.st === 'escape') for (var i = 0; i < 6; i++) {
      var ph = ((t * 3 + i / 6) % 1), tx = up.x - 50 - ph * 70, ty = up.y + 8 + Math.sin(i * 2.1) * 10;
      G.rect(Math.round(tx / B), Math.round(ty / B), 1, 1, i % 2 ? C.lime : C.white, (1 - ph) * .8 * (u.st === 'in' ? 1 - p(t - u.t0, .9, 1.2) : 1));
    }
    if (u.st === 'beam') {                                     // tractor beam from Lau's flame tip up to Gigi
      var c = G.ctx, grow = p(t, u.tb, u.tb + .14, E.out), y0 = g.tip + 4, y1 = up.y + 30 * up.s, top = y0 - (y0 - y1) * grow, w0 = 28, w1 = 120 * up.s;
      c.save();
      c.beginPath(); c.moveTo(LX - w0 / 2, y0); c.lineTo(LX + w0 / 2, y0); c.lineTo(up.x + w1 / 2, top); c.lineTo(up.x - w1 / 2, top); c.closePath();
      c.globalAlpha = .22; c.fillStyle = C.lime; c.fill();
      c.globalAlpha = .75; c.strokeStyle = C.lime; c.lineWidth = 3; c.stroke();
      c.clip();
      c.globalAlpha = .28; c.fillStyle = '#E6FF9A';
      c.beginPath(); c.moveTo(LX - w0 / 5, y0); c.lineTo(LX + w0 / 5, y0); c.lineTo(up.x + w1 / 5, top); c.lineTo(up.x - w1 / 5, top); c.closePath(); c.fill();
      c.globalAlpha = .3;
      for (var b = 0; b < 8; b++) { var yy = top + (((t - u.tb) * 300 + b * 90) % 720); if (yy < y0) c.fillRect(0, Math.round(yy / B) * B, 390, 12); }
      c.restore();
      for (var j = 0; j < 8; j++) {
        var q = ((t * 1.8 + j / 8) % 1), py = top + (y0 - top) * q, pxx = LX + (up.x - LX) * (1 - q) + Math.sin(j * 2.3 + t * 9) * 14 * (1 - q * .6);
        G.rect(Math.round(pxx / B), Math.round(py / B), 1, 1, j % 2 ? C.white : C.lime, .9);
      }
    }
    put(G, spr, up.x, up.y + spr.height * B * up.s / 2, { s: up.s });
    if (u.st === 'beam') {
      var c2 = G.ctx; c2.save(); c2.globalAlpha = .55 + .35 * Math.sin(t * 40); c2.strokeStyle = C.lime; c2.lineWidth = 4;
      c2.beginPath(); c2.ellipse(up.x, up.y + 2, 84 * up.s, 42 * up.s, 0, 0, Math.PI * 2); c2.stroke(); c2.restore();
    }
    if (u.st === 'in' || u.st === 'say') {                     // name tag while it glides in and hovers
      var ta = p(t - u.t0, .65, .95, E.outBack);
      if (ta > .002) G.pill('Gigi', up.x, up.y + 52, { size: 16, weight: 800, bg: C.lime, color: C.navy, pad: 12, alpha: Math.min(1, ta * 1.5), scale: .6 + .4 * ta });
    }
  }

  /* ---------- the speaker bubble (geometry shared by drawing, taps and tests) ---------- */
  function bubble(R, g) {
    var s = R.s, t = R.t, G = R.G;
    var show = s.bubT0 != null ? p(t, s.bubT0, s.bubT0 + .35, E.outBackBig) : 0;
    var out = s.bubOut != null ? p(t, s.bubOut, s.bubOut + .25, E.in) : 0;
    if (show <= 0 || out >= 1) return null;
    var m = 0, word = '', say = '';
    if (s.rev) { m = p(t, s.rev.t0, s.rev.t0 + .22) - p(t, s.rev.t1, s.rev.t1 + .22); if (m > 0) { word = s.rev.word; say = s.rev.say; } else m = 0; }
    var asking = s.F && (s.state === 'drop' || s.state === 'aim' || s.state === 'shoot' || s.state === 'bounce');
    var readTxt = null, readSize = 24, idleW = 214;
    if (MODE === 'read' && s.F && (asking || s.state === 'out')) {
      readTxt = BK.word(s.F.slug).say;
      var tw = measure(G, readTxt, readSize, 800);
      if (tw > 190) { readSize = Math.max(17, Math.floor(readSize * 190 / tw)); tw = measure(G, readTxt, readSize, 800); }
      idleW = clamp(Math.ceil(Math.max(tw, measure(G, 'sounds like', 15, 700))) + 72 + 104, 214, 370);
    }
    var revW = word ? clamp(Math.ceil(Math.max(measure(G, word, 28, 800), measure(G, say, 17, 700))) + 96, 170, 370) : idleW;
    var w = idleW + (revW - idleW) * E.inOut(m), h = g.bubH;
    var LX = lauX(s, t), tx = LX + 42, ty = g.deck - 27;
    var x = clamp(LX + 22, 10, 380 - w), y = g.bubY, bx = x + w - 49;
    var off = h >= 80 ? 6 : 5, bh = h >= 80 ? 30 : 28;        // Replay / Slow stacked on the right
    var chipTxt = MODE === 'read' ? 'Hear' : 'Read', cw = Math.ceil(measure(G, chipTxt, 15, 800)) + 26, ccx = x + 42;
    return { x: x, y: y, w: w, h: h, tx: tx, ty: ty, show: show, out: out, m: m, word: word, say: say, readTxt: readTxt, readSize: readSize, bx: bx,
      live: show > .8 && out <= 0 && m <= 0 && asking, bt: [y + off, y + h - off - bh], bh: bh,
      chip: { txt: chipTxt, x: Math.round(ccx - cw / 2), y: y - 12, w: cw, h: 26, cx: ccx, cy: y + 1 },
      chipHit: { x: ccx - 34, y: y - 19, w: 68, h: 40 },
      replay: { x: bx - 47, y: y - 10, w: 96, h: h / 2 + 10 }, slow: { x: bx - 47, y: y + h / 2, w: 96, h: h / 2 + 12 },
      body: { x: x - 8, y: y - 10, w: bx - 47 - x + 8, h: h + 20 } };
  }
  /* the Read / Hear chip on the bubble's top-left edge (names what a tap switches to); after 3 replays of one word in
     sound mode it glows gold, a hint that Read mode is there if the sound can't be heard */
  function drawChip(R, G, b, a) {
    var s = R.s, t = R.t, ch = b.chip, c = G.ctx; if (a <= 0) return;
    var glow = MODE !== 'read' && s.replays >= 3 && b.live, md = t - s.modeT, pop = md >= 0 && md < .3 ? Math.sin(Math.PI * md / .3) : 0;
    var sc = 1 + .15 * pop + (glow && !RM ? .05 * Math.abs(Math.sin(t * 4)) : 0);
    c.save(); c.globalAlpha *= clamp(a);
    c.translate(ch.cx, ch.cy); c.scale(sc, sc); c.translate(-ch.cx, -ch.cy);
    if (glow) { c.save(); c.globalAlpha *= .5 + .3 * Math.sin(t * 6); c.fillStyle = C.gold; PX.roundRect(c, ch.x - 6, ch.y - 6, ch.w + 12, ch.h + 12, (ch.h + 12) / 2); c.fill(); c.restore(); }
    G.box(ch.x, ch.y, ch.w, ch.h, { bg: C.periSoft, border: glow ? C.goldSh : C.navy, borderW: 2.5, r: ch.h / 2, shadow: false });
    G.text(ch.txt, ch.cx, ch.cy + 1, { size: 15, weight: 800, color: C.navy });
    c.restore();
  }
  function drawBubble(R, G, g) {
    var s = R.s, t = R.t, b = bubble(R, g); if (!b) return;
    var c = G.ctx, x = b.x, y = b.y, w = b.w, h = b.h, tx = b.tx, ty = b.ty;
    var amp = 0, spk = 0, sd = 0, d = t - s.speakT;
    if (d >= 0 && d < s.speakDur) amp = Math.abs(Math.sin(d * 14)) * Math.sin(Math.PI * d / s.speakDur);
    spk = p(d, 0, .06) * (1 - p(d, s.speakDur, s.speakDur + .15)); sd = d;
    var sc = b.show * (1 - b.out) * (1 + .1 * amp);
    c.save();
    c.translate(tx, ty); c.scale(sc, sc); c.translate(-tx, -ty);
    var rev = b.m >= .5, bg = b.m > 0 ? mix(C.white, C.lime, E.out(b.m)) : C.white;
    if (spk > 0) { c.save(); c.globalAlpha = .45 * spk; bubblePath(c, x, y, w, h, 18, tx, ty, 0); c.lineWidth = 16; c.lineJoin = 'round'; c.strokeStyle = C.gold; c.stroke(); c.restore(); }
    bubblePath(c, x, y, w, h, 18, tx, ty, 5); c.fillStyle = 'rgba(11,18,64,.35)'; c.fill();
    bubblePath(c, x, y, w, h, 18, tx, ty, 0); c.fillStyle = bg; c.fill(); c.lineWidth = 3.5 + 6 * spk; c.lineJoin = 'round'; c.strokeStyle = C.navy; c.stroke();
    if (spk > 0) {
      c.save(); c.globalAlpha = spk; c.lineWidth = 4.5; c.strokeStyle = C.gold; c.stroke(); c.restore();
      for (var a2 = 0; a2 < 3; a2++) {
        var ph2 = ((sd * 2.6 + a2 / 3) % 1);
        c.save(); c.globalAlpha = spk * (ph2 < .15 ? ph2 / .15 : 1 - (ph2 - .15) / .85); c.lineCap = 'round';
        c.strokeStyle = C.navy; c.lineWidth = 8; c.beginPath(); c.arc(x + w - 6, y + h / 2, 16 + ph2 * 30, -.75, .75); c.stroke();
        c.strokeStyle = C.gold; c.lineWidth = 4.5; c.stroke(); c.restore();
      }
    }
    speakerGlyph(G, x + 35, y + h / 2, 21, amp > 0 ? .5 + amp * .5 : (rev ? 1 : .5));
    if (amp > 0) for (var i = 0; i < 2; i++) {
      var ph = ((t * 2.2 + i * .5) % 1);
      c.save(); c.globalAlpha = (1 - ph) * .8; c.strokeStyle = C.navy; c.lineWidth = 3; c.beginPath(); c.arc(x + 35, y + h / 2, 23 + ph * 9, -.9, .9); c.stroke(); c.restore();
    }
    var cy = y + h / 2, qa = 1 - clamp(b.m * 2), wa = clamp(b.m * 2 - 1);
    if (qa > 0) {
      if (b.readTxt) {                                         // Read mode: the say-guide pops in (no speaker pulse, no sound implied)
        var mx = (x + 62 + b.bx - 47) / 2, rd = t - s.readT, rp = rd >= 0 && rd < .45 ? Math.sin(Math.PI * rd / .45) : 0;
        if (rp > 0) {
          var hw2 = Math.min(measure(G, b.readTxt, b.readSize, 800), b.bx - 47 - x - 62) / 2 + 10;
          c.save(); c.globalAlpha = .55 * rp * qa; c.fillStyle = C.limeSoft || '#EAF7B5'; PX.roundRect(c, mx - hw2, cy - 6, hw2 * 2, b.readSize + 8, 10); c.fill(); c.restore();
        }
        G.text('sounds like', mx, cy - 18, { size: 15, weight: 700, color: C.ink2, alpha: qa, font: 'Figtree, sans-serif' });
        c.save(); c.translate(mx, cy + 10); c.scale(1 + .12 * rp, 1 + .12 * rp); c.translate(-mx, -(cy + 10));
        G.text(b.readTxt, mx, cy + 10, { size: b.readSize, weight: 800, color: C.navy, alpha: qa });
        c.restore();
      } else {
        var qs = (1 + .14 * amp) * E.out(qa);
        c.save(); c.translate(x + 94, cy + 2); c.scale(qs, qs);
        G.text('?', 0, 0, { size: 46, weight: 800, color: C.navy });
        c.restore();
      }
      var live = b.live ? 1 : .55;
      [['Replay', b.bt[0]], ['Slow', b.bt[1]]].forEach(function (bt) {
        G.box(b.bx - 42, bt[1], 84, b.bh, { bg: C.white, border: C.navy, borderW: 2.5, r: b.bh / 2, shadow: false, alpha: qa * live });
        G.text(bt[0], b.bx, bt[1] + b.bh / 2 + 1, { size: 15, weight: 700, color: C.navy, alpha: qa * live });
      });
      drawChip(R, G, b, qa * live);
    }
    if (wa > 0) {
      var ws = E.outBackBig(wa), ax = x + 74;
      c.save(); c.globalAlpha *= Math.min(1, wa * 2); c.translate(ax, cy); c.scale(ws, ws); c.translate(-ax, -cy);
      G.text(b.word, ax, cy - 11, { size: 28, weight: 800, color: C.navy, align: 'left' });
      G.text(b.say, ax + 1, cy + 19, { size: 17, weight: 700, color: '#3A5200', align: 'left' });
      c.restore();
    }
    c.restore();
  }

  function draw(R, G) {
    var s = R.s, t = R.t, g = geo(R), c = G.ctx, LX = lauX(s, t), L = lauState(R, g, LX);
    drawSky(R, G, g);
    c.save();
    var shy = RM ? 0 : Math.round(jiggle(t, s.stepDownT, 2, 40, 10)) * B;
    c.translate(R.shakeX(), shy);
    drawDanger(R, G, g);
    drawShields(R, G, g);
    drawFormation(R, G, g, LX);
    drawUfo(R, G, g, LX);
    drawLauncher(R, G, g, LX, L);
    drawFx(R, G);
    drawPills(R, G, g);
    drawShots(R, G, g);
    c.restore();

    drawBubble(R, G, g);
    if (s.chipNote) {                                          // the shield that took the hit
      var cn = s.chipNote, ca = p(t, cn.t0 + .05, cn.t0 + .3, E.outBack), co = p(t, cn.t0 + 1.05, cn.t0 + 1.25, E.in);
      if (ca > 0 && co < 1) G.pill(cn.text || 'Shield chipped', cn.text ? 195 : clamp(SHX[cn.k], 80, 310), cn.y, { size: 16, weight: 800, bg: C.coral, color: C.white, pad: 13, alpha: Math.min(1, ca * 2) * (1 - co), scale: .6 + .4 * ca });
    }
    s.floats.forEach(function (f) { floatPts(G, t, f.t0, f.s, f.x, f.y); });
    if (s.captured) {
      var cp = s.captured, ci = p(t, cp.t0, cp.t0 + .32, E.outBackBig), cxo = p(t, cp.t0 + 1.5, cp.t0 + 1.75, E.in);
      if (ci > 0 && cxo < 1) {
        G.popText('CAPTURED', 195, g.banY, ci * (1 + .12 * cxo), 1 - cxo, 46, C.lime);
        var gp = p(t, cp.t0 + .15, cp.t0 + .45, E.outBack);
        G.pill('Gigi joins Lau', 195, g.banY + 60, { size: 19, bg: C.white, color: C.navy, border: C.navy, borderW: 3, pad: 16, alpha: Math.min(1, gp * 1.5) * (1 - cxo), scale: .6 + .4 * gp });
      }
    }
    if (s.banner) {
      var bn = s.banner, bi = p(t, bn.t0, bn.t0 + .4, E.outBackBig), bo = p(t, bn.t0 + bn.dur - .3, bn.t0 + bn.dur, E.in);
      if (bi > 0 && bo < 1) {
        var size = bn.big.length > 8 ? 38 : 46;
        G.popText(bn.big, 195, g.banY, bi * (1 + .12 * bo), 1 - bo, size, bn.fill);
        var pi = p(t, bn.t0 + .15, bn.t0 + .45, E.outBack);
        if (bn.small) G.pill(bn.small, 195, g.banY + 58, { size: 18, bg: C.white, color: C.navy, border: C.navy, borderW: 3, pad: 16, alpha: Math.min(1, pi * 1.5) * (1 - bo), scale: .6 + .4 * pi });
      }
    }
    if (s.note) {
      var nd = t - s.note.t0, na = p(nd, 0, .2) * (1 - p(nd, s.note.dur - .3, s.note.dur));
      if (na > 0) notePill(G, s.note.text, s.note.y, na, .85 + .15 * p(nd, 0, .25, E.outBack));
    }
    R.irisX = LX; R.irisY = g.deck - 30;
  }
  /* a white note pill that wraps to two lines when it would not fit inside the 390 sp screen */
  function noteInfo(G, text) {
    return text.indexOf('\n') >= 0 ? { lines: text.split('\n'), w: Math.max.apply(null, text.split('\n').map(function (l) { return measure(G, l, 17, 700); })) } : G.wrap(text, 17, 330, 700);
  }
  function noteH(G, text) { var n = noteInfo(G, text).lines.length; return n === 1 ? 32 : n * 22 + 16; }
  function notePill(G, text, cy, a, sc) {
    var info = noteInfo(G, text), lh = 22, w = Math.ceil(info.w) + 32, h = info.lines.length * lh + 16, c = G.ctx;
    if (info.lines.length === 1) { G.pill(text, 195, cy, { size: 17, bg: C.white, color: C.navy, border: C.navy, borderW: 3, pad: 16, alpha: a, scale: sc }); return; }
    c.save(); c.globalAlpha *= clamp(a); c.translate(195, cy); c.scale(sc, sc); c.translate(-195, -cy);
    G.box(Math.round(195 - w / 2), Math.round(cy - h / 2), w, h, { bg: C.white, border: C.navy, borderW: 3, r: 18 });
    for (var i = 0; i < info.lines.length; i++) G.text(info.lines[i], 195, cy - h / 2 + 8 + lh * (i + .5) + 1, { size: 17, weight: 700, color: C.navy });
    c.restore();
  }
  /* the HUD label pill is navy on a navy sky: give it the video's navy3 rim (reads the engine's HUD fit; skipped if absent) */
  function hudRim(R, G) {
    var f = R.hudFit, hx = R.hudX; if (!f || !hx || R.def.hudLabel === false) return;
    var x0 = hx.h0 + R.lives * 23 + 4, x1 = hx.em - 14, cx = (x0 + x1) / 2, w = Math.ceil(measure(G, f.label, f.size, 700)) + 24, h = Math.round(f.size * 1.9), c = G.ctx;
    var x = Math.round(cx - w / 2), y = Math.round(R.layout.hudY - h / 2);
    c.save(); c.lineWidth = 3; c.strokeStyle = C.navy3; PX.roundRect(c, x + 1.5, y + 1.5, w - 3, h - 3, h / 2); c.stroke(); c.restore();
  }
  /* drawn after the HUD: the first-play hint and the opening iris */
  function drawTop(R, G) {
    var s = R.s, t = R.t, g = geo(R);
    hudRim(R, G);
    if (s.state === 'aim' && s.done === 0 && !s.firstTap && s.F && t - s.F.land > 3 && !(s.note && t - s.note.t0 < s.note.dur)) {
      var b = bubble(R, g), ph = (t % 1.2) / 1.2, c = G.ctx;
      G.pill(MODE === 'read' ? 'Tap the meaning that matches' : 'Tap the meaning you heard', 195, lowY(R, g, 32), { size: 16, bg: C.navy, color: C.white, border: C.gold, borderW: 3, pad: 14, shadow: false });
      if (b && MODE !== 'read') { c.save(); c.globalAlpha = .8 * (1 - ph); c.strokeStyle = C.gold; c.lineWidth = 4; PX.roundRect(c, b.bx - 46 - ph * 10, b.bt[0] - 4 - ph * 10, 92 + ph * 20, b.bh + 8 + ph * 20, (b.bh + 8) / 2 + ph * 10); c.stroke(); c.restore(); }
    }
    var io = p(t, 0, .6, E.inOut);
    if (io < 1) {
      var lx = R.irisX || REST, ly = R.irisY || G.SH - 120, Rn = Math.max(Math.hypot(lx, ly), Math.hypot(390 - lx, ly), Math.hypot(lx, G.SH - ly), Math.hypot(390 - lx, G.SH - ly));
      G.iris(io * Rn / Math.hypot(390, G.SH), lx, ly);
    }
  }

  /* ---------- test hooks ---------- */
  function info(R) {
    var s = R.s, g = geo(R), t = R.t, F = s.F, choices = [];
    if (F && !F.flyT && s.state === 'aim') {                  // only while a tap would fire (not while they drop in or a shot flies)
      for (var i = 0; i < F.opts.length; i++) {
        var r = slotRect(R, g, F, i, t); if (!r || !live(R, F, i) || tried(F, i)) continue;
        choices.push({ label: F.opts[i].text, slug: F.opts[i].slug, right: F.opts[i].right, hinted: F.opts[i].right && F.hintT >= 0, i: i, x: r.x, y: r.y, w: r.w, h: r.h });
      }
    }
    var b = bubble(R, g), btn = null;
    function cl(rc) { var a = R.G.toClient(rc.x + rc.w / 2, rc.y + rc.h / 2); return { cx: a.x, cy: a.y }; }
    if (b) btn = { live: b.live, replay: cl({ x: b.bx - 42, y: b.bt[0], w: 84, h: b.bh }), slow: cl({ x: b.bx - 42, y: b.bt[1], w: 84, h: b.bh }),
      chip: cl(b.chip), chipText: b.chip.txt, chipGlow: MODE !== 'read' && s.replays >= 3, shows: b.m > 0 ? b.word : (b.readTxt || '?') };
    return {
      mode: MODE, state: s.state, done: s.done, n: N, shields: s.shields.slice(), depth: s.depth, step: g.step, room: g.room,
      danger: g.danger, lowest: F ? lowest(R, g, F) : null, saucer: s.ufo ? s.ufo.st : null, gigi: s.gigi, tiny: g.tiny, shTop: g.shTop, bubY: g.bubY,
      replays: s.replays, cleared: Object.keys(s.cleared || {}).length, opts: F ? F.opts.map(function (o) { return o.slug; }) : null,
      note: s.note && t - s.note.t0 >= 0 && t - s.note.t0 < s.note.dur ? { text: s.note.text, y: s.note.y } : null,
      target: F ? { slug: F.slug, word: BK.label(F.slug), wrongs: F.wrongs.length } : null,
      speak: { ago: +(t - s.speakT).toFixed(2), slow: s.speakDur > 1 }, bubble: btn, sheet: !!(R.el && R.el.querySelector('[data-g23-sheet]')), choices: choices
    };
  }

  ARC.registerGame({
    id: 'g23', name: 'Echo Invaders', sub: 'Listen and blast', lives: 3, scoreLabel: 'sparks',
    rules: ['Lau’s speaker says a spec word, but doesn’t show it', 'Tap the meaning that matches and Lau blasts it', 'A wrong shot chips a shield and they step closer'],
    lifeIcon: lifeIcon,
    icon: function () { return invader(0, 'coral', 0, [1, 2]); }, iconScale: 3.2,
    init: init, update: update, draw: draw, drawTop: drawTop, tap: tap, key: key, info: info,
    finish: function (R) { R.end({ reason: 'done', delay: .2 }); },
    destroy: function (R) { var sh = R.el && R.el.querySelector('[data-g23-sheet]'); if (sh) sh.remove(); }
  });
})();
