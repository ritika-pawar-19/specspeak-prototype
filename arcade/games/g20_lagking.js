/* Game 20 · Lag King (boss fight). Look and feel ported from the approved video scene
   (../../../arcade-video/scenes/g20_lagking.js, STORYBOARD.md "## 20 · Lag King").

   Rules (SPEC.md): three words, Storage, Gigabyte and Processor, one phase each.
     1. Dodge. The King winds up and rolls 2 buffering rings along the floor; tap JUMP (or anywhere) to hop them.
        Lau's flame keeps him floating while a ring is under him, so any press in a wide window clears it (no
        reflex-only play). The very first ring of a run waits in front of Lau, with the hint, until the learner taps.
        A ring that hits knocks Lau back and pays no spark, but never costs a heart: hearts only track sound mistakes.
     2. Build. The word plays; tap the sound coins in order (STOR, then ij). Coin labels share one case, so the case
        never gives the answer away. The slip coin (AGE) cracks with "STOR-ij, not stor-AGE", plays the slow model
        and costs a heart. A right sound tapped out of order bounces, replays the word and counts as wrong (no
        heart); the empty slot's hint only shows after a second mistake. If the word is built without the slip,
        the untouched slip coin still cracks with "not stor-AGE" (the video's teaching beat), free.
     3. Freeze. The Say-it card, "Charge your fireball". A mic or trainer pass = a big fireball and Lau turns Fire;
        a tap check = a small fireball (same hit, weaker visual, no Say-it gate tick); not clear (after the card's own
        slow model + retry) = the fireball fizzles and the word comes back once at the end. A returned word skips
        the rings and the build: "One more try", the slow model, then straight to the Say-it card.
     Each hit drains one of the King's 3 pips and opens a cage (Rami, then Chip, then Pixi). Three hits: the King
     bursts into pixels and the crew is freed. If a word is still not clear on its second visit the King gets away.
   Sparks (= score): +1 per ring hopped, +1 per right sound coin, +1 clean build (no slip, no order mistake),
   +2 per clear say (+1 more on the first try of a word's first visit; a tap check pays +1), +3 crew freed.
   A flawless run = 6 + 8 + 3 + 9 + 3 = 29; a returned word never pays rings, coins or the first-try bonus again.
   R.right counts right sound coins (8 in a full run), R.wrong counts slip coins and order mistakes. */
(function () {
  'use strict';
  var U = ARC.U, C = PX.C, B = PX.B, E = U.E, p = U.p, clamp = U.clamp, hash = U.hash, jiggle = U.jiggle, lerp = U.lerp;
  var BK = ARC.bank;
  var ORDER = ['storage', 'gigabyte', 'processor'];
  var LH = 21, HOME = 32, KX = 81, KCX = KX + 24, DAIS = 84, GRAV = 2400, HITX = KX + 8;
  var CAGES = [{ x: 22, who: 'chip', fallX: 12, land: 11 }, { x: 65, who: 'rami', fallX: 65, land: 63 }, { x: 108, who: 'pixi', fallX: 108, land: 98 }];
  var OPEN = [1, 0, 2];                                   // cage opened by hit 1, 2, 3 (Rami, Chip, Pixi, as the video)
  var TORCHES = [22, 108];
  var WX = 47, WW = 36, WH = 58, WR = 18;                 // the arched window (game px)
  var P3 = [[20, 62], [44, 90], [68, 62]], P4 = [[16, 60], [36, 88], [56, 60], [76, 88]];   // coin spots [x, height]
  var RING_V = [[56, 62], [62, 68], [68, 74]];            // ring roll speed per phase (ring 1, ring 2), game px / s
  var HOLD_DX = 30;                                       // the run's first ring waits this far in front of Lau
  var HINT_JUMP = 'Tap JUMP to hop the ring', HINT_COIN = 'Tap the sounds in order';
  var GHOST_COL = '#7F86B4';
  /* burst palettes (constants, so no arrays are built per frame) */
  var COL_HIT = [C.lime, C.white, C.limeDk, C.navy], COL_COININ = [C.white, C.gold, C.fl1], COL_CRACK = [C.coral, C.coralSh, C.white],
      COL_FLY = [C.white, C.gold, C.fl1, C.lime], COL_IGNITE = [C.white, C.fl1, C.gold, C.lime], COL_FIRE = [C.white, C.gold, C.fl3, C.coral],
      COL_FLOAT = [C.fl1, C.fl2, C.fl3, C.gold], COL_TRAIL = [C.fl2, C.fl3, C.gold], COL_CONF = [C.lime, C.gold, C.coral, C.peri, C.mint, C.pink];

  /* ---------- sprites for this game (from the video scene, cached here; a fixed, small set) ---------- */
  var M = {};
  function memo(key, fn) { return M[key] || (M[key] = fn()); }
  function coinSpr(tone) {
    return memo('coin' + tone, function () {
      var pal = tone === 'coral' ? { rim: '#B23A1F', base: C.coral, hi: '#FF9C84', lo: C.coralSh, shine: '#FFE7DF' }
                                 : { rim: C.goldDk, base: C.gold, hi: '#FFE08A', lo: C.goldSh, shine: '#FFFFFF' };
      var src = PX.make(24, 24, function (px) {
        for (var y = 0; y < 24; y++) for (var x = 0; x < 24; x++) {
          var dx = x + .5 - 12, dy = y + .5 - 12, d = Math.sqrt(dx * dx + dy * dy);
          if (d > 12) continue;
          px(x, y, d > 10.7 ? pal.rim : d > 9.3 ? (dx + dy < 0 ? pal.hi : pal.lo) : pal.base);
        }
        [[6, 5], [7, 5], [5, 6], [5, 7], [8, 4]].forEach(function (q) { px(q[0], q[1], pal.shine); });
      });
      return PX.outline(src, C.navy);
    });
  }
  /* buffering ring: 8 dots, a white head and a fading lime tail; ph 0..1 picks the head */
  function ringSpr(ph) {
    var f = ((Math.floor(ph * 8) % 8) + 8) % 8;
    return memo('ring' + f, function () {
      var src = PX.make(28, 28, function (px) {
        for (var i = 0; i < 8; i++) {
          var a = i / 8 * Math.PI * 2 - Math.PI / 2, x0 = Math.round(14 + Math.cos(a) * 9.5 - 2), y0 = Math.round(14 + Math.sin(a) * 9.5 - 2);
          var age = (f - i + 8) % 8, col = ['#FFFFFF', '#E4F99A', C.lime, C.limeSh, C.limeDk, C.limeDk, '#5E8A10', '#5E8A10'][age];
          for (var j = 0; j < 4; j++) for (var q = 0; q < 4; q++) if (!((j === 0 || j === 3) && (q === 0 || q === 3))) px(x0 + q, y0 + j, col);
        }
      });
      return PX.outline(src, C.navy);
    });
  }
  function cageSpr(open) {
    return memo('cage' + (open ? 1 : 0), function () {
      var L = '#D9DDEE', Md = '#A9AFC9', D = '#6B7090';
      var src = PX.make(32, 32, function (px) {
        var x, y;
        [[14, 0], [15, 0], [16, 0], [17, 0], [13, 1], [18, 1], [13, 2], [18, 2]].forEach(function (q) { px(q[0], q[1], Md); });
        for (x = 4; x < 28; x++) px(x, 3, L);
        px(2, 3, Md); px(3, 3, Md); px(28, 3, Md); px(29, 3, Md);
        for (x = 0; x < 32; x++) { px(x, 4, L); px(x, 5, Md); }
        for (y = 6; y < 29; y++) { px(0, y, L); px(1, y, D); px(30, y, L); px(31, y, D); px(8, y, L); px(24, y, L); }
        if (!open) for (x = 0; x < 32; x++) { px(x, 29, L); px(x, 30, D); }
      });
      return PX.outline(src, C.navy);
    });
  }
  function fireSpr(f) {
    return memo('fb' + f, function () {
      var src = PX.make(22, 16, function (px) {
        var hx = 15, hy = 8;
        for (var y = 0; y < 16; y++) for (var x = 0; x < 22; x++) {
          var dx = x + .5 - hx, dy = y + .5 - hy, d = Math.sqrt(dx * dx + dy * dy), col = null;
          if (d <= 6.5) col = d < 2.5 ? C.white : d < 4.2 ? C.fl1 : d < 5.6 ? C.gold : C.fl3;
          else if (dx < 0) {
            var L = 14 + (f === 1 ? 1 : f === 2 ? -1 : 0), q = -dx / L;
            if (q < 1) {
              var half = 6.5 * (1 - q) * (1 - q * .2), wave = Math.sin(q * 7 + f * 2.1) * 2.2 * q;
              if (Math.abs(dy - wave) < half) col = q > .6 ? C.fl4 : q > .3 ? C.fl3 : C.gold;
            }
          }
          if (col) px(x, y, col);
        }
      });
      return PX.outline(src, C.coralSh);
    });
  }
  function starSpr() {
    return memo('star', function () {
      var src = PX.make(17, 17, function (px) {
        for (var y = 0; y < 17; y++) for (var x = 0; x < 17; x++) {
          var dx = x - 8, dy = y - 8, d = Math.sqrt(dx * dx + dy * dy);
          var ray = (dx === 0 || dy === 0) ? d <= 8 : Math.abs(Math.abs(dx) - Math.abs(dy)) < 1 && d <= 6;
          if (d < 2.5) px(x, y, C.white); else if (d < 3.6 || ray) px(x, y, d < 4.5 ? C.fl1 : C.gold);
        }
      });
      return PX.outline(src, C.coralSh);
    });
  }
  function lightSpr(r) {
    return memo('light' + r, function () {
      return PX.make(2 * r, 2 * r, function (px) {
        for (var y = 0; y < 2 * r; y++) for (var x = 0; x < 2 * r; x++) {
          var d = Math.hypot(x + .5 - r, y + .5 - r) / r;
          if (d < .38) px(x, y, 'rgba(255,200,120,.30)'); else if (d < .66) px(x, y, 'rgba(255,186,104,.18)'); else if (d < 1) px(x, y, 'rgba(255,170,90,.09)');
        }
      });
    });
  }
  function torchSpr(f) {
    return memo('torch' + f, function () {
      var fl = [['...y....', '...yy...', '..yoy...', '..yooy..', '.yoOoy..', '.ywwOoy.', '.ywwOoy.', '..yOOy..', '...yy...'],
                ['....y...', '...yy...', '...yoy..', '..yooy..', '..yoOoy.', '.ywwOoy.', '.ywwOoy.', '..yOOy..', '...yy...'],
                ['..y.....', '..yy....', '..yoy...', '.yooy...', '.yoOoy..', '.ywOOoy.', '.ywwOoy.', '..yOOy..', '...yy...']][f];
      var rows = fl.concat(['gGGGGGGg', '.gGGGGg.', '..dGGd..', '...dd...', '...dd...', 'bbbddbbb', 'bbbddbbb', '...dd...', '...dd...', '...dd...', '...dd...']);
      return PX.outline(PX.grid(rows, { y: C.fl2, o: C.fl3, O: C.fl4, w: '#FFF6DA', g: C.goldSh, G: C.gold, d: C.goldDk, b: '#4B5598' }), C.navy);
    });
  }
  function daisSpr() {
    return memo('dais', function () {
      var W = 131 - DAIS + 1, H = 11;
      return PX.make(W, H, function (px) {
        for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
          var dx = x - 1, dy = y - 1;
          px(x, y, x === 0 || y === 0 ? C.navy : dy === 0 ? '#8592DC' : dy === 1 ? '#6572C4' : (dx % 12 === 11 || dy === 6) ? '#1E2660' : dy < 6 ? '#45539F' : '#3A4690');
        }
      });
    });
  }
  function inArch(x, y, grow) {
    var r = WR + grow;
    if (x < -grow || x >= WW + grow || y >= WH + grow) return false;
    if (y >= WR) return true;
    var dx = x + .5 - WW / 2, dy = y + .5 - WR; return dx * dx + dy * dy <= r * r;
  }
  function skySpr() {
    return memo('sky', function () {
      return PX.make(WW, WH, function (px) {
        for (var y = 0; y < WH; y++) for (var x = 0; x < WW; x++) {
          if (!inArch(x, y, 0)) continue;
          px(x, y, y < 18 ? '#151C5C' : y < 34 ? '#1C2468' : y < 48 ? '#242D78' : '#2D3787');
        }
        for (var yy = 0; yy < 9; yy++) for (var xx = 0; xx < 9; xx++) {
          var d = Math.hypot(xx + .5 - 4.5, yy + .5 - 4.5);
          if (d < 4.4) px(22 + xx, 9 + yy, d > 3.4 ? '#E9DDB8' : '#FFF6DA');
        }
        px(24, 12, '#E9DDB8'); px(27, 14, '#E9DDB8'); px(25, 15, '#E9DDB8');
      });
    });
  }
  function frameSpr() {
    return memo('wframe', function () {
      return PX.make(WW + 8, WH + 6, function (px) {
        for (var y = 0; y < WH + 6; y++) for (var x = 0; x < WW + 8; x++) {
          var lx = x - 4, ly = y - 4, inner = inArch(lx, ly, 0);
          if (ly >= WH && ly < WH + 2) { px(x, y, ly === WH ? '#7D8AD6' : C.stoneDk); continue; }
          if (!inner && inArch(lx, ly, 2)) px(x, y, (lx < WW / 2 && ly < WR + 4) ? '#6573C2' : C.stoneLt);
          else if (inner && (lx === 17 || lx === 18) && ly > 4) px(x, y, lx === 17 ? '#5B68B8' : C.stoneDk);
          else if (inner && (ly === 33 || ly === 34)) px(x, y, ly === 33 ? '#5B68B8' : C.stoneDk);
        }
      });
    });
  }
  function floorSpr(top) {
    return memo('floor' + top, function () {
      return PX.make(16, 16, function (px) {
        for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
          var col;
          if (top && y === 0) col = '#8592DC';
          else if (top && y === 1) col = '#6572C4';
          else {
            var yy = y - (top ? 2 : 0) + 16, row = Math.floor(yy / 7), off = row % 2 ? 8 : 0, mort = yy % 7 === 6 || (x + off) % 16 === 15;
            col = mort ? '#1E2660' : (yy % 7 === 0 ? '#45539F' : top ? '#3A4690' : '#323D82');
          }
          px(x, y, col);
        }
      });
    });
  }
  /* the static room (stone wall, night sky, window frame, floor, dais) baked into two layers at 1 canvas px per game
     px and rebuilt only when the layout changes. Per frame: layer a, the clouds and stars (clipped to the window),
     layer b, then the torches and dust on top (the same order the room was drawn in, piece by piece). */
  var ROOM = { key: null, a: null, b: null, h: 0 };
  function roomLayers(G, g) {
    var H = Math.ceil(G.H) + 2, key = g.gY + '|' + g.wy + '|' + H;
    if (ROOM.key === key) return ROOM;
    var a = ROOM.a || document.createElement('canvas'), b = ROOM.b || document.createElement('canvas'), i, j;
    a.width = b.width = 130; a.height = b.height = H;
    var x = a.getContext('2d'), y = b.getContext('2d');
    x.imageSmoothingEnabled = y.imageSmoothingEnabled = false;
    var st = PX.stone(), rows = Math.ceil(g.gY / 16) + 1;
    for (j = 0; j < rows; j++) for (i = 0; i < 130; i += 16) x.drawImage(st, i, j * 16);
    x.drawImage(skySpr(), WX, g.wy);
    y.drawImage(frameSpr(), WX - 4, g.wy - 4);
    y.globalAlpha = .22; y.fillStyle = C.navy; y.fillRect(0, g.gY - 4, 130, 4); y.globalAlpha = 1;
    for (i = 0; i < 130; i += 16) { y.drawImage(floorSpr(1), i, g.gY); for (j = g.gY + 16; j < G.H + 1; j += 16) y.drawImage(floorSpr(0), i, j); }
    y.drawImage(daisSpr(), DAIS - 1, g.kf - 1);
    y.globalAlpha = .4; y.fillRect(DAIS - 1, g.gY, 131 - DAIS + 1, 1); y.globalAlpha = 1;
    ROOM.key = key; ROOM.a = a; ROOM.b = b; ROOM.h = H;
    return ROOM;
  }
  /* one chain as a 2 px wide strip (links + shadow column); a swinging chain is drawn as a few straight pieces */
  var CHAIN_H = 640;
  function chainStrip() {
    return memo('chain', function () {
      return PX.make(2, CHAIN_H, function (px) {
        for (var y = 0; y < CHAIN_H; y++) { var m = y % 4; px(0, y, m === 3 ? '#4B5283' : m === 0 ? '#D9DDEE' : '#A9AFC9'); px(1, y, 'rgba(11,18,64,.45)'); }
      });
    });
  }
  /* the end card's art after a win: Lau, fired up */
  function winSpr() { return memo('win', function () { return PX.lau({ h: LH, form: 'fire', mood: 'joy', look: [0, 0] }); }); }

  /* the King as 2x2 pixel blocks (for the burst), mirrored like the drawn King; y relative to his feet */
  var KP = null;
  function kingPixels() {
    if (KP) return KP;
    var s = PX.king({ frame: 0 }), W = s.width, H = s.height, d = s.getContext('2d').getImageData(0, 0, W, H).data;
    KP = [];
    for (var y = 0; y < H; y += 2) for (var x = 0; x < W; x += 2) {
      var col = null;
      for (var q = 0; q < 4 && !col; q++) {
        var xx = x + (q & 1), yy = y + (q >> 1);
        if (xx < W && yy < H) { var i = (yy * W + xx) * 4; if (d[i + 3] > 0) col = 'rgb(' + d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ')'; }
      }
      if (col) KP.push({ x: KX + (W - 2 - x), dy: -51 + y, col: col });
    }
    return KP;
  }

  /* ---------- small helpers (ported from the video's kit) ---------- */
  function outBounce(x) {
    var n1 = 7.5625, d1 = 2.75;
    if (x < 1 / d1) return n1 * x * x;
    if (x < 2 / d1) { x -= 1.5 / d1; return n1 * x * x + .75; }
    if (x < 2.5 / d1) { x -= 2.25 / d1; return n1 * x * x + .9375; }
    x -= 2.625 / d1; return n1 * x * x + .984375;
  }
  function jumpY(t, t0, dur, h) { var u = (t - t0) / dur; return u <= 0 || u >= 1 ? 0 : 4 * h * u * (1 - u); }
  function burst(G, t, t0, gx, gy, n, cols) {
    var d = t - t0; if (d < 0 || d > 1.2) return;
    for (var i = 0; i < (n || 14); i++) {
      var a = hash(i + t0 * 7) * Math.PI * 2, sp = 18 + hash(i * 3.1 + t0) * 30;
      G.rect(gx + Math.cos(a) * sp * d, gy + Math.sin(a) * sp * d + 40 * d * d, 2, 2, cols[i % cols.length], 1 - d / 1.2);
    }
  }
  function dust(G, t, t0, x, y, spread) {
    var d = t - t0; if (d < 0 || d > .32) return;
    for (var s = -1; s <= 1; s += 2) {
      var r = Math.max(1, Math.round(3 - d * 7));
      G.rect(x + s * (3 + spread * d * 30) - r / 2, y - 1 - d * 12, r, r, '#C9D3FF', .8 * (1 - d / .32));
    }
  }
  function hopLoop(t, t0, period, h) {
    if (t < t0) return { y: 0, sq: 0 };
    var u = ((t - t0) % period) / period, air = .78;
    if (u < air) { var v = u / air; return { y: 4 * h * v * (1 - v), sq: -.07 * Math.sin(v * Math.PI) }; }
    return { y: 0, sq: .2 * Math.sin((u - air) / (1 - air) * Math.PI) };
  }
  /* sprite anchored bottom-centre: canvas row footRow sits on game y footY; sx/sy squash about the feet */
  function sprFoot(G, s, cx, footY, footRow, sx, sy, flip, alpha) {
    sx = sx || 1; sy = sy || 1;
    if (Math.abs(sx - 1) < .01) sx = 1; if (Math.abs(sy - 1) < .01) sy = 1;
    var c = G.ctx, w = s.width * sx * B, h = s.height * sy * B, left, top;
    if (sx === 1 && sy === 1) { left = Math.round(cx - s.width / 2) * B; top = Math.round(footY - footRow) * B; }
    else { left = Math.round((cx - s.width * sx / 2) * B); top = Math.round((footY - footRow * sy) * B); }
    c.save(); c.imageSmoothingEnabled = false; if (alpha != null) c.globalAlpha *= clamp(alpha);
    if (flip) { c.translate(left + w, top); c.scale(-1, 1); c.drawImage(s, 0, 0, w, h); } else c.drawImage(s, left, top, w, h);
    c.restore();
  }
  function crewSpr(who, look, w, blink) {
    look = [Math.round(look[0] * 2) / 2, Math.round(look[1] * 2) / 2];
    if (who === 'chip') return { s: PX.chip({ look: look, blink: blink ? 1 : 0 }), row: 22 };
    if (who === 'rami') return { s: PX.rami({ look: look, frame: Math.floor(w * 4) }), row: 14 };
    return { s: PX.pixi({ look: look }), row: 20 };
  }

  /* ---------- layout from the screen edges (the video's room was built on ground gy 250) ---------- */
  /* Short screens (an LMS frame with a toolbar): the cages never slide under the word builder; they drop to just
     below it, and the torches and window drop with them toward the coins. Memoised per layout (once per frame). */
  var GEO = { key: null, g: null };
  function geo(R) {
    var G = R.G, key = G.H + '|' + G.bot + '|' + R.layout.hudY;
    if (GEO.key === key) return GEO.g;
    var gY = Math.floor(G.H - 31 - G.bot / 3), top = Math.round(R.layout.hudY + 30);
    var cageY = Math.max(gY - 178, Math.ceil((top + 108) / 3)), shift = cageY - (gY - 178);
    GEO.key = key;
    return (GEO.g = { gY: gY, kf: gY - 10, cageY: cageY, wy: gY - 172 + shift, ty: gY - 143 + shift, top: top,
             noteY: Math.max(gY - 118, cageY + 39) * 3, titleY: (gY - 126) * 3 });       // notes stay under the cages
  }
  function coinY(c, g) { return g.gY - c.hy; }          // coins keep their height above the floor (survives a resize)
  function levelAt(g, x) { return x >= DAIS ? g.kf : g.gY; }
  function slotCenters(n, m) {   // builder slot centres (sp); m 0..1 = merging together once the word is built
    var sw = (n === 2 ? 96 : 84) - 26 * m, gap = lerp(n === 2 ? 110 : 100, sw + 4, m), out = [];
    for (var i = 0; i < n; i++) out.push(195 + (i - (n - 1) / 2) * gap);
    return { xs: out, w: sw };
  }

  /* ---------- run setup and phases ---------- */
  function init(R) {
    var s = R.s;
    s.queue = ORDER.map(function (w) { return { slug: w, ret: 0 }; });
    s.pips = 3; s.hits = []; s.open = [null, null, null]; s.crew = [{}, {}, {}];
    s.L = { x: HOME, h: 0, kx: 0, face: 1, form: 'small', mood: 'happy', moodUntil: 0, hurtT: -9, igniteT: -9 };
    s.jp = null; s.mv = null; s.pend = []; s.sqT = -9; s.landT = -9; s.landBig = 1; s.dust = [];
    s.rings = []; s.ringN = 0; s.ringAt = null; s.winds = []; s.rattleT = -9; s.lagT = -9; s.ringHits = 0;
    s.coins = []; s.built = []; s.ghost = []; s.fillT = []; s.builder = null; s.speakT = -9;
    s.fire = null; s.fizzT = null; s.laughT = null; s.boomT = null; s.danceT = null; s.escT = null;
    s.note = null; s.slipNote = null; s.item = null; s.tok = 0; s.phaseN = 0; s.wordN = 0; s.mist = 0; s.memo = {};
    s.tutDone = false; s.tappedCoin = false; s.toldRing = false;
    setState(R, 'intro');
    R.after(2.6, function () { if (!R.over) startPhase(R, s.queue.shift()); });
  }
  /* keep the most useful line per word on the end card's To remember list: slip > order > not clear */
  function remember(R, slug, text, prio) {
    var s = R.s;
    for (var i = 0; i < R.missed.length; i++) if (R.missed[i].slug === slug) {
      if ((s.memo[slug] || 0) < prio) { R.missed[i].right = text; s.memo[slug] = prio; }
      return;
    }
  }
  function setState(R, st) { R.s.state = st; R.phase = st; }
  function note(R, text, dur) { R.s.note = { text: text, t0: R.t, dur: dur || 1.6 }; }
  function mood(R, m, dur) { var L = R.s.L; L.mood = m; L.moodUntil = R.t + dur; }
  function cheer(R) {
    var s = R.s;
    s.crew.forEach(function (cr, i) { if (cr.settle != null && R.t >= cr.settle && !(cr.hopT != null && R.t - cr.hopT < cr.hopD)) { cr.hopT = R.t + i * .07; cr.hopD = .42; cr.hopH = 9; } });
  }

  function startPhase(R, item) {
    var s = R.s;
    s.tok++; s.phaseN++;
    s.item = item; s.ringN = 0; s.coins = []; s.built = []; s.ghost = []; s.fillT = []; s.builder = null;
    s.fire = null; s.fizzT = null; s.pend = []; s.slipNote = null; s.mist = 0;
    if (item.ret) return startRetry(R);
    s.wordN++;
    setState(R, 'rings');
    if (s.tutDone) note(R, 'Word ' + s.wordN + ' of 3 · dodge 2 rings', 1.7);    // the first word shows the JUMP hint instead
    s.ringAt = R.t + 1.15;
    R.announce('Word ' + s.wordN + ' of 3. ' + (s.tutDone ? 'Jump over two rings.' : 'Tap JUMP to hop the ring.'));
  }
  /* a returned word: no rings, no coins (they paid already). The built word, its slow model, then the Say-it card. */
  function startRetry(R) {
    var s = R.s, slug = s.item.slug, sy = BK.SYLL[slug], tok = s.tok;
    setState(R, 'built');
    s.built = sy.parts.map(function (x, i) { return i; });
    s.builder = { t0: R.t, n: sy.parts.length, doneT: R.t - .3, outT: null, retry: true };
    R.announce('One more try: ' + BK.label(slug) + '. Listen, then say it clearly.');
    if (!s.mv && !s.jp) walkHome(R);
    R.after(.7, function () { if (s.tok === tok && !R.over) { s.speakT = R.t; R.word(slug, true); } });
    R.after(2.7, function () { freezeSoon(R, tok); });
  }

  /* ---------- rings ---------- */
  function spawnRing(R, g) {
    var s = R.s, sp = RING_V[Math.min(2, s.phaseN - 1)][s.ringN];
    /* h = height above the floor (survives a resize); hold = the run's first ring waits for the learner's JUMP */
    s.rings.push({ x: KX + 11, h: g.gY - g.kf, vy: 0, v: sp, t0: R.t, spin: 0, down: false, bounced: false, res: null, dust: [], lastDust: R.t,
                   hold: !s.tutDone && s.ringN === 0, wait: false });
    s.winds.push(R.t); if (s.winds.length > 4) s.winds.shift();
    s.ringN++; s.ringAt = null; s.rattleT = R.t;
    R.sfx('whoosh'); R.shake(1.5);
  }
  function ringThreat(R) {
    var L = R.s.L;
    for (var i = 0; i < R.s.rings.length; i++) { var r = R.s.rings[i]; if (!r.res && r.x - L.x > -14 && r.x - L.x < 60) return true; }
    return false;
  }
  function updRings(R, dt, g) {
    var s = R.s, t = R.t, L = s.L;
    if (s.state === 'rings' && s.ringAt != null && t >= s.ringAt) spawnRing(R, g);
    for (var i = s.rings.length - 1; i >= 0; i--) {
      var r = s.rings[i];
      var k = clamp((t - r.t0) / .25), sp = 150 + (r.v - 150) * E.out(k);
      /* the first ring of the run stops short of a grounded Lau and spins in place until he jumps */
      r.wait = false;
      if (r.hold && !r.res && !s.jp && L.h <= 0 && r.x - sp * dt <= L.x + HOLD_DX) { sp = Math.max(0, (r.x - L.x - HOLD_DX) / dt); r.wait = true; }
      r.x -= sp * dt; r.spin -= sp * dt / (Math.PI * 19) + 2.5 * dt; r.sp = sp;
      if (!r.down && (r.x < DAIS + 1 || r.h < g.gY - g.kf)) {
        r.vy += 1400 * dt; r.h -= r.vy * dt;
        if (r.h <= 0) { r.h = 0; if (!r.bounced) { r.bounced = true; r.vy = -110; } else { r.vy = 0; r.down = true; } }
      }
      if (r.down && !r.wait && t - r.lastDust > .08) { r.lastDust = t; r.dust.push({ x: r.x + 12, h: 3, t0: t }); if (r.dust.length > 6) r.dust.shift(); }
      if (!r.res && r.h < 8) {
        var dx = r.x - L.x;
        if (Math.abs(dx) < 12 && L.h < 18 - Math.abs(dx) * .65 && t - L.hurtT > .8) { r.res = 'hit'; ringHit(R, r, g); ringDone(R, r); }
        else if (dx < -13) { r.res = 'dodge'; dodged(R, r, g); ringDone(R, r); }
      }
      if (r.x < -24) s.rings.splice(i, 1);
    }
  }
  function ringDone(R, r) {
    var s = R.s, tok = s.tok;
    if (r.hold) { r.hold = false; s.tutDone = true; }
    if (s.state !== 'rings') return;
    if (s.ringN < 2) s.ringAt = R.t + .8;
    else R.after(.6, function () { if (s.tok === tok && s.state === 'rings' && !R.over) startCoins(R); });
  }
  function dodged(R, r, g) {
    var L = R.s.L;
    R.addSparks(1, L.x * 3, (g.gY - L.h - 24) * 3);
    R.float('+1', L.x * 3 + 44, (g.gY - L.h - 30) * 3);
    mood(R, 'joy', .5);
  }
  function ringHit(R, r, g) {
    var s = R.s, L = s.L;
    /* a knock-back and a "lagging" spinner, no spark, no heart: hearts only track sound mistakes */
    L.hurtT = R.t; L.kx = -6; s.lagT = R.t; s.ringHits++; mood(R, 'hurt', 1);
    R.sfx('bump'); R.shake(4); R.burst(L.x, g.gY - 12, 10, COL_HIT);
    var more = s.ringN < 2;                                   // another ring still comes in this phase
    if (more && !s.toldRing) { s.toldRing = true; note(R, 'Tap JUMP as the ring rolls in', 1.6); }
    else note(R, more ? 'Lau shook it off. Jump the next one' : 'Lau shook it off', more ? 1.6 : 1.1);
  }

  /* ---------- Lau: jump (with a float while a ring is under him) and coin grabs ---------- */
  function jump(R) {
    var s = R.s, L = s.L;
    if (R.over || s.jp || s.mv || L.h > 0) return;
    if (!(s.state === 'rings' || s.state === 'coins' || s.state === 'intro')) return;
    var ringy = s.state === 'rings';
    s.jp = { ph: 'rise', t0: R.t, rise: ringy ? .26 : .22, fall: ringy ? .3 : .24, peak: ringy ? 36 : 16, assist: ringy };
    s.sqT = R.t; R.sfx('jump');
  }
  function startGrab(R, c) {
    var s = R.s, L = s.L, g = geo(R);
    if (c.st !== 'live') return;
    c.target = true;
    var dx = c.x - L.x;
    s.mv = { ph: 'run', t0: R.t, x0: L.x, x1: c.x, run: Math.max(.08, Math.abs(dx) / 110), up: .28, H: Math.max(20, c.hy - 27), coin: c };
    if (Math.abs(dx) > 1) L.face = dx > 0 ? 1 : -1;
  }
  function walkHome(R) {
    var s = R.s, L = s.L;
    if (Math.abs(L.x - HOME) < .5) { L.x = HOME; L.face = 1; return; }
    s.mv = { ph: 'run', t0: R.t, x0: L.x, x1: HOME, run: Math.max(.15, Math.abs(L.x - HOME) / 85), coin: null };
    L.face = HOME > L.x ? 1 : -1;
  }
  function land(R, hf) {
    var s = R.s;
    s.landT = R.t; s.landBig = clamp(hf / 26, .5, 1.4);
    s.dust.push({ t0: R.t, x: s.L.x, big: s.landBig }); if (s.dust.length > 4) s.dust.shift();
    R.sfx('land');
    if (s.state === 'coins') {                                // grab the next tapped coin, in the order they were tapped
      while (s.pend.length) { var c = s.pend.shift(); if (c.st === 'live') { startGrab(R, c); return; } c.target = false; }
    }
    if ((s.state === 'built' || s.state === 'say') && Math.abs(s.L.x - HOME) > .5) walkHome(R);
  }
  function dropPending(R) { R.s.pend.forEach(function (c) { c.target = false; }); R.s.pend = []; }
  function updLau(R, dt, g) {
    var s = R.s, L = s.L, t = R.t;
    if (s.jp) {
      var j = s.jp, d = t - j.t0;
      if (j.ph === 'rise') { var u = clamp(d / j.rise); L.h = j.peak * E.out(u); if (u >= 1) { j.ph = j.assist ? 'float' : 'fall'; j.t0 = t; j.hf = L.h; } }
      else if (j.ph === 'float') { L.h = j.peak + Math.sin(d * 9) * .8; if (d >= 1.1 || !ringThreat(R)) { j.ph = 'fall'; j.t0 = t; j.hf = L.h; } }
      else { var u2 = clamp(d / j.fall); L.h = j.hf * (1 - u2 * u2); if (u2 >= 1) { L.h = 0; s.jp = null; land(R, j.hf); } }
    }
    if (s.mv) {
      var m = s.mv, dm = t - m.t0;
      if (m.ph === 'run') {
        var ur = clamp(dm / m.run); L.x = lerp(m.x0, m.x1, E.inOut(ur));
        if (ur >= 1) {
          L.x = m.x1;
          if (m.coin) { m.ph = 'up'; m.t0 = t; s.sqT = t; R.sfx('jump'); }
          else { s.mv = null; L.face = 1; }
        }
      } else if (m.ph === 'up') {
        var uu = clamp(dm / m.up); L.h = m.H * E.out(uu);
        if (uu >= 1) { m.ph = 'fall'; m.t0 = t; m.hf = L.h; contact(R, m.coin, g); }
      } else {
        var uf = clamp(dm / .3); L.h = m.hf * (1 - uf * uf);
        if (uf >= 1) { L.h = 0; s.mv = null; land(R, m.hf); }
      }
    }
    if (L.kx) { L.kx *= Math.pow(.002, dt); if (Math.abs(L.kx) < .2) L.kx = 0; }
    if (L.mood !== 'happy' && t >= L.moodUntil) L.mood = 'happy';
  }

  /* ---------- sound coins ---------- */
  function startCoins(R) {
    var s = R.s, g = geo(R), slug = s.item.slug, sy = BK.SYLL[slug], tok = s.tok;
    var list = sy.parts.map(function (pt, i) { return { label: pt, kind: 'part', idx: i }; }).concat([{ label: sy.slip, kind: 'slip', idx: -1 }]);
    var spots = list.length === 3 ? P3 : P4;
    list = U.shuffle(list);
    /* one case on every coin (the say-guide's stress capitals would give the slip away); hy = height above the floor */
    s.coins = list.map(function (c, i) {
      return { label: c.label, text: c.label.toUpperCase(), kind: c.kind, idx: c.idx, x: spots[i][0], hy: spots[i][1], tin: R.t + .35 + i * .12,
               st: 'live', tone: 'gold', bumpT: -9, crackT: -9, flyT: -9, target: false, i: i };
    });
    s.clean = true;
    s.builder = { t0: R.t, n: sy.parts.length, doneT: null, outT: null };
    setState(R, 'coins');
    R.sfx('pop');
    R.after(.5, function () { if (s.tok === tok && !R.over) { s.speakT = R.t; R.word(slug); } });
    R.announce('Build the word ' + BK.label(slug) + '. Sound coins: ' + list.map(function (c) { return c.label; }).join(', ') + '.');
  }
  function coinAt(R, q) {
    var s = R.s, g = geo(R), best = null, bd = 48;
    s.coins.forEach(function (c) {
      if (c.st !== 'live' || c.target || R.t < c.tin + .1) return;
      var d = Math.hypot(q.x - c.x * 3, q.y - coinY(c, g) * 3);
      if (d < bd) { bd = d; best = c; }
    });
    return best;
  }
  function pickCoin(R, c) {
    var s = R.s;
    s.tappedCoin = true;
    /* Lau is busy: queue the coin (every tap counts, in order); it shows a waiting ring until he grabs it */
    if (s.mv || s.jp || s.L.h > 0 || s.pend.length) { if (s.pend.indexOf(c) < 0) { s.pend.push(c); c.target = true; } return; }
    startGrab(R, c);
  }
  function contact(R, c, g) {
    var s = R.s, slug = s.item.slug, sy = BK.SYLL[slug], next = s.built.length, w = BK.word(slug), tok = s.tok, i;
    if (s.state !== 'coins') { c.target = false; return; }
    if (c.kind === 'part' && c.idx === next) {
      c.st = 'fly'; c.flyT = R.t; s.built.push(c.idx); s.fillT[c.idx] = R.t + .3;
      R.good(slug, { sparks: 1, from: [c.x * 3, coinY(c, g) * 3] });
      R.sfx('coin'); mood(R, 'joy', .6); cheer(R);
      if (s.built.length === sy.parts.length) R.after(.4, function () { if (s.tok === tok && !R.over) built(R); });
    } else if (c.kind === 'part') {
      /* a real sound, out of order: it bounces, the word plays again, and it counts (no heart, no clean build) */
      c.bumpT = R.t; c.target = false;
      s.mist++; s.clean = false;
      var txt = w.say + ': ' + (next === 0 ? sy.parts[0] + ' comes first' : sy.parts[next] + ' comes after ' + sy.parts[next - 1]);
      R.bad(slug, txt); remember(R, slug, txt, 2);
      if (s.mist >= 2 && s.ghost[next] == null) s.ghost[next] = R.t;       // the slot hint only after a second mistake
      R.sfx('bump'); mood(R, 'hurt', .5);
      note(R, (next === 0 ? 'Which sound comes first?' : 'Which sound comes next?') + ' Listen again', 1.8);
      R.after(.35, function () { if (s.tok === tok && !R.over && s.state === 'coins') { s.speakT = R.t; R.word(slug); } });
    } else {
      c.st = 'crack'; c.crackT = R.t;
      R.sfx('crack');
      s.mist++; s.clean = false;
      var right = w.say + ', ' + sy.note;                                    // "STOR-ij, not stor-AGE"
      s.slipNote = { t0: R.t + .22, c: c, text: right };
      R.bad(slug, right); remember(R, slug, right, 3);
      for (i = next; i < sy.parts.length; i++) if (s.ghost[i] == null) s.ghost[i] = R.t + .3;
      R.after(.22, function () {
        if (R.over) return;
        s.L.hurtT = R.t; mood(R, 'hurt', 1.1); R.sfx('hurt'); R.shake(5);
        R.loseHeart();
        if (R.hearts <= 0) outOfHearts(R);
      });
      R.after(.6, function () { if (!R.dead) { s.speakT = R.t; R.word(slug, true); } });   // the right form, slowly
    }
  }
  function built(R) {
    var s = R.s, slug = s.item.slug, sy = BK.SYLL[slug], tok = s.tok, g = geo(R);
    s.builder.doneT = R.t;
    setState(R, 'built');
    dropPending(R);
    s.coins.forEach(function (c) {
      if (c.st !== 'live') return;
      if (c.kind === 'slip') {                                // the video's beat: the slip still cracks, "not stor-AGE" (free)
        c.st = 'crack'; c.crackT = R.t + .55; c.teach = true;
        s.slipNote = { t0: c.crackT + .22, c: c, text: sy.note };
        R.after(.55, function () { if (s.tok === tok && !R.over) R.sfx('crack'); });
      } else { c.st = 'poof'; c.poofT = R.t; }
    });
    R.sfx('powerup'); mood(R, 'joy', 1.2); cheer(R);
    if (s.clean) { R.addSparks(1, 195, g.top + 64); R.float('+1 clean build', 195, g.top + 146, '#178A5A'); }   // under the builder card
    R.after(.3, function () { if (s.tok === tok && !R.over) { s.speakT = R.t; R.word(slug); } });
    if (!s.mv && !s.jp) walkHome(R);
    R.after(1.7, function () { freezeSoon(R, tok); });
  }
  function freezeSoon(R, tok) {
    var s = R.s;
    if (s.tok !== tok || R.over || s.state !== 'built') return;
    if (s.mv || s.jp || Math.abs(s.L.x - HOME) > .5) { if (!s.mv && !s.jp) walkHome(R); R.after(.1, function () { freezeSoon(R, tok); }); return; }
    setState(R, 'say');
    R.flash(.35);
    R.after(.25, function () { if (s.tok === tok && !R.over) openSay(R); });
  }

  /* ---------- the Say-it freeze and its outcomes ---------- */
  function openSay(R) {
    var s = R.s, item = s.item, slug = item.slug, tok = s.tok;
    /* retry: a returned word's say is never a first try (the engine then pays +2 XP, not +3, and counts no first try) */
    R.say({ slug: slug, title: 'Charge your fireball', sub: 'Say it clearly', tip: BK.TIPS[slug], retry: !!item.ret }).then(function (res) {
      if (R.dead || R.over || s.tok !== tok) return;
      if (res.passed) fire(R, res.method !== 'tap', res.method !== 'tap' && res.firstTry && !item.ret ? 1 : 0);
      else fizzle(R);
    });
  }
  function fire(R, strong, bonus) {
    var s = R.s, L = s.L, g = geo(R), tok = s.tok, slug = s.item.slug;
    setState(R, 'fire');
    s.builder.outT = R.t; s.slipNote = null;
    if (strong && L.form !== 'fire') { L.form = 'fire'; L.igniteT = R.t; }
    var t0 = R.t + (strong ? .3 : .15);
    s.fire = { t0: t0, hit: t0 + .6, strong: strong, label: BK.label(slug), x0: L.x + 10 };
    var n = strong ? 2 + (bonus || 0) : 1;
    R.addSparks(n, L.x * 3, (g.gY - 30) * 3);
    R.float('+' + n, L.x * 3 + 46, (g.gY - 36) * 3);
    mood(R, 'joy', 1.4);
    if (!strong) note(R, 'Say it aloud for a big fireball', 1.8);
    R.after(t0 - R.t, function () { if (s.tok === tok) R.sfx('fireball'); });
    R.after(t0 + .6 - R.t, function () { if (s.tok === tok && !R.over) hit(R); });
  }
  function hit(R) {
    var s = R.s, g = geo(R), tok = s.tok;
    s.pips--; s.hits.push(R.t); s.rattleT = R.t;
    R.sfx('hit'); R.shake(s.fire.strong ? 7 : 4);
    var cage = OPEN[2 - s.pips];
    if (s.pips <= 0) { R.after(.2, function () { if (!R.over) boom(R); }); return; }
    R.after(.3, function () { if (s.tok === tok) openCage(R, cage); });
    R.after(1.9, function () { if (s.tok === tok && !R.over) nextPhase(R); });
  }
  function fizzle(R) {
    var s = R.s, item = s.item, tok = s.tok, w = BK.word(item.slug);
    setState(R, 'fizzle');
    s.builder.outT = R.t; s.slipNote = null; s.fizzT = R.t + .15; s.laughT = R.t + .5;
    R.miss(item.slug, 'Say ' + w.say); remember(R, item.slug, 'Say ' + w.say, 1);
    R.after(.15, function () { if (s.tok === tok) R.sfx('bump'); });
    if (!item.ret) { item.ret = 1; s.queue.push(item); note(R, 'Not clear yet. ' + w.word + ' comes back', 2); }
    else note(R, 'Not clear yet. Practise ' + w.word + ' in the Say-it lesson', 2.2);
    R.after(2.4, function () { if (s.tok === tok && !R.over) nextPhase(R); });
  }
  function nextPhase(R) {
    var s = R.s;
    if (R.over) return;
    if (!s.queue.length) return escape(R);
    startPhase(R, s.queue.shift());
  }
  function openCage(R, i) {
    var s = R.s, g = geo(R), cg = CAGES[i];
    if (s.open[i] != null) return;
    s.open[i] = R.t;
    var dist = levelAt(g, cg.fallX) - (g.cageY + 29), tl = R.t + .05 + Math.sqrt(2 * dist / GRAV);
    s.crew[i] = { settle: tl + .08 + .36 + .2 };
    R.sfx('cage');
  }
  function boom(R) {
    var s = R.s, g = geo(R);
    s.boomT = R.t; s.tok++;
    setState(R, 'win');
    R.flash(.55); R.shake(9); R.sfx('boom');
    R.after(.1, function () { openCage(R, 2); });
    s.danceT = R.t + .45;
    R.after(.45, function () { R.sfx('powerup'); });
    R.addSparks(3, 195, g.titleY);
    R.after(.5, function () { R.float('+3', 195, g.titleY + 96, C.navy); R.announce('Crew freed. The Lag King is beaten.'); });
    /* the end card shows Lau, fired up, at a whole 2x (not the King the hub tile shows) */
    R.after(.5, function () { R.end({ reason: 'done', title: 'Crew freed', delay: 3, icon: winSpr, iconScale: 2 / .62 }); });
  }
  function escape(R) {
    var s = R.s;
    setState(R, 'escape'); s.laughT = R.t; s.escT = R.t;
    note(R, 'The Lag King got away this time', 2.2);
    R.after(1.6, function () { R.end({ reason: 'done', title: 'The King got away', delay: .6 }); });
  }
  function outOfHearts(R) {
    var s = R.s;
    if (s.state === 'out') return;
    setState(R, 'out'); s.tok++; s.laughT = R.t + .2; dropPending(R);
    mood(R, 'hurt', 9);
    R.after(1.3, function () { R.end({ reason: 'out', delay: .5 }); });
  }

  /* ---------- input ---------- */
  function tap(R, q) {
    var s = R.s, g = geo(R);
    if (R.over) return;
    if (s.state === 'coins' || s.state === 'built') {
      if (s.builder && q.x >= 40 && q.x <= 350 && q.y >= g.top && q.y <= g.top + 100) { s.speakT = R.t; R.word(s.item.slug); return; }
      if (s.state !== 'coins') return;
      var c = coinAt(R, q);
      if (c) pickCoin(R, c);
      return;
    }
    jump(R);
  }
  function key(R, k) {
    var s = R.s;
    if (s.state !== 'coins' || !/^[1-4]$/.test(k)) return;
    var live = s.coins.filter(function (c) { return c.st === 'live' && !c.target; }).sort(function (a, b) { return a.x - b.x; });
    var c = live[+k - 1]; if (c) pickCoin(R, c);
  }

  /* ---------- update ---------- */
  function update(R, dt) {
    var s = R.s, g = geo(R), t = R.t;
    updLau(R, dt, g);
    updRings(R, dt, g);
    /* freed crew hop over the rings on their own */
    s.crew.forEach(function (cr, i) {
      if (cr.settle == null || t < cr.settle || s.danceT != null) return;
      if (cr.hopT != null && t - cr.hopT < cr.hopD) return;
      var cx = CAGES[i].land;
      s.rings.forEach(function (r) { var dx = r.x - cx; if (dx > 0 && dx < 10 + r.v * .22) { cr.hopT = t; cr.hopD = .6; cr.hopH = 20; } });
    });
  }

  /* ---------- drawing: the world (game px) ---------- */
  function drawRoom(G, g, w) {
    var c = G.ctx, i, gY = g.gY, wy = g.wy, room = roomLayers(G, g);
    c.imageSmoothingEnabled = false;
    c.drawImage(room.a, 0, 0, 130 * B, room.h * B);            // stone wall + night sky
    c.save();
    c.beginPath(); c.rect(WX * B, (wy + WR) * B, WW * B, (WH - WR) * B); c.arc((WX + WW / 2) * B, (wy + WR) * B, WR * B, Math.PI, 0); c.clip();
    for (i = 0; i < 3; i++) {
      var span = WW + 34, cx = ((i * 23 - w * (2.2 + i * .9)) % span + span) % span - 26;
      G.spr(PX.cloud(20 + i * 4), WX + cx, wy + 26 + i * 9, { alpha: .22 + i * .06 });
    }
    for (i = 0; i < 7; i++) {
      if (Math.sin(w * (2 + hash(i) * 3) + i * 7) > .3) G.rect(WX + 3 + Math.floor(hash(i * 4.7) * 30), wy + 8 + Math.floor(hash(i * 2.3) * 22), 1, 1, '#FFFFFF', .85);
    }
    c.restore();
    c.drawImage(room.b, 0, 0, 130 * B, room.h * B);            // window frame, floor, dais
    for (i = 0; i < 2; i++) {
      var tx = TORCHES[i], f = Math.floor(w * 9 + i * 2) % 3, r = 25 + (Math.floor(w * 7 + i) % 3);
      G.spr(lightSpr(r), tx - r, g.ty + 6 - r);
      G.spr(torchSpr(f), tx - 5, g.ty);
    }
    for (i = 0; i < 14; i++) {
      var sp = 3 + hash(i * 5.3) * 4, span2 = gY - 20, my = gY - 10 - ((w * sp + hash(i * 7.1) * span2) % span2), mx = hash(i * 3.9) * 130 + Math.sin(w * .7 + i) * 4;
      G.rect(mx, my, 1, 1, i % 3 ? '#8C9EFF' : C.fl2, .3 + .25 * Math.sin(w * 3 + i));
    }
  }

  function drawCages(R, G, g) {
    var s = R.s, t = R.t, c = G.ctx, strip = chainStrip();
    for (var i = 0; i < 3; i++) {
      var cg = CAGES[i], sw = 1.8 * Math.sin(t * 1.5 + i * 2.2), op = s.open[i], od = op == null ? -1 : t - op;
      if (od >= 0) sw += 4 * Math.exp(-od * 1.6) * Math.sin(od * 7);
      var rd = t - s.rattleT, rattle = (rd >= 0 && rd < .5 && od < 0) ? ((Math.floor(t * 18) + i) % 2 ? 1 : -1) : 0;
      var cx = Math.round(cg.x + sw), top = Math.min(g.cageY, CHAIN_H), dx = cx - cg.x;
      /* the chain leans from its hook to the swinging cage: one straight piece per 1 px step of lean */
      for (var y0 = 0, off = 0, y = 1; y <= top; y++) {
        var o = y < top ? Math.round(dx * (y / top)) : null;
        if (o !== off) { c.drawImage(strip, 0, y0, 2, y - y0, (cg.x + off) * B, y0 * B, 2 * B, (y - y0) * B); y0 = y; off = o; }
      }
      G.rect(cx - 15, top + 6, 30, 23, '#C9D3FF', .34);
      if (od < .05) {
        var cs = crewSpr(cg.who, [-.8, .5], t, cg.who === 'chip' && ((t + i) % 2.9) < .1);
        sprFoot(G, cs.s, cx + rattle, top + 29, cs.row);
      }
      G.spr(cageSpr(od >= 0), cx - 17, top - 1);
      if (od >= 0) {
        var th = Math.PI / 2 * outBounce(clamp(od / .4));
        c.save(); c.translate((cx - 16) * B, (top + 29) * B); c.rotate(th);
        c.fillStyle = C.navy; c.fillRect(-B, -B, 34 * B, 4 * B);
        c.fillStyle = '#D9DDEE'; c.fillRect(0, 0, 32 * B, B); c.fillStyle = '#6B7090'; c.fillRect(0, B, 32 * B, B);
        c.restore();
      }
    }
  }

  function crewState(R, g, i) {
    var s = R.s, t = R.t, cg = CAGES[i], op = s.open[i];
    if (op == null) return null;
    var d0 = op + .05; if (t < d0) return null;
    var lv0 = levelAt(g, cg.fallX), lv1 = levelAt(g, cg.land), top = g.cageY;
    var dist = lv0 - (top + 29), tl = d0 + Math.sqrt(2 * dist / GRAV), x, foot, sq = 0;
    var look = [s.L.x < cg.land ? -.8 : .8, -.2];
    var h0 = tl + .08, h1 = h0 + .36;
    if (t < tl) { var d = t - d0; foot = top + 29 + .5 * GRAV * d * d; x = cg.x + (cg.fallX - cg.x) * (d / (tl - d0)); sq = -.14; look = [0, 1]; }
    else {
      foot = lv0 + (lv1 - lv0) * p(t, h0, h1) - jumpY(t, h0, .36, 10);
      x = t < h0 ? cg.fallX : t < h1 ? cg.fallX + (cg.land - cg.fallX) * ((t - h0) / .36) : cg.land;
      var ld = t - tl; if (ld < .25) sq += .32 * Math.exp(-ld * 12) * Math.cos(ld * 26);
      var ld2 = t - h1; if (ld2 >= 0 && ld2 < .25) sq += .22 * Math.exp(-ld2 * 12) * Math.cos(ld2 * 26);
      if (t >= h1 + .2) {
        var cr = s.crew[i];
        if (s.danceT != null && t >= s.danceT) {
          var hl = hopLoop(t, s.danceT + i * .12, .5, 3 + 5 * p(t, s.danceT + .3, s.danceT + .6));
          foot -= hl.y; sq += hl.sq; look = [Math.sin((t - s.danceT) * 2.4 + i) > 0 ? .8 : -.8, -.4];
        } else if (cr.hopT != null && t >= cr.hopT && t - cr.hopT < cr.hopD) {
          var u = (t - cr.hopT) / cr.hopD; foot -= 4 * cr.hopH * u * (1 - u); sq -= .08 * Math.sin(u * Math.PI);
        }
      }
    }
    return { x: x, foot: foot, sq: sq, look: look, tl: tl, lv: t < h0 ? lv0 : lv1 };
  }
  function drawCrewFree(R, G, g) {
    var t = R.t;
    CAGES.forEach(function (cg, i) {
      var st = crewState(R, g, i); if (!st) return;
      var cs = crewSpr(cg.who, st.look, t, false);
      G.rect(st.x - 6, st.lv, 12, 1, '#141A4D', .5);
      sprFoot(G, cs.s, st.x, st.foot, cs.row, 1 + st.sq, 1 - st.sq);
      dust(G, t, st.tl, st.x, st.lv - 1, .8);
    });
  }

  function coinBob(i, t) { return Math.round(Math.sin(t * 3.2 + i * 1.3) * 1.2); }
  /* coin at SCREEN px (sx, sy), scale sc; o: {alpha, clip: -1|1 half, rot, crack} */
  function drawCoin(G, sx, sy, sc, cn, o) {
    o = o || {};
    var c = G.ctx, tone = o.tone || cn.tone, s = coinSpr(tone), w = s.width * B;
    var size = cn.text.length >= 4 ? 18 : cn.text.length === 3 ? 20 : 21;
    c.save(); c.translate(sx, sy); if (o.rot) c.rotate(o.rot); c.scale(sc, sc);
    if (o.alpha != null) c.globalAlpha *= clamp(o.alpha);
    if (o.clip) { c.beginPath(); c.rect(o.clip < 0 ? -w / 2 - 2 : 0, -w / 2 - 2, w / 2 + 2, w + 4); c.clip(); }
    c.imageSmoothingEnabled = false; c.drawImage(s, -w / 2, -w / 2, w, w);
    c.font = '900 ' + size + 'px Lexend, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = tone === 'coral' ? '#FFFFFF' : C.navy; c.fillText(cn.text, 0, 2);
    if (o.crack) {
      c.strokeStyle = C.navy; c.lineWidth = 4; c.lineJoin = 'round'; c.beginPath();
      c.moveTo(0, -36); c.lineTo(-6, -20); c.lineTo(5, -7); c.lineTo(-5, 6); c.lineTo(6, 19); c.lineTo(0, 36);
      c.stroke();
    }
    c.restore();
  }
  function drawCoinsWorld(R, G, g) {
    var s = R.s, t = R.t, c = G.ctx, hintOn = s.state === 'coins' && !s.tappedCoin && s.phaseN === 1, i, cn;
    for (i = 0; i < s.coins.length; i++) { cn = s.coins[i]; burst(G, t, cn.tin, cn.x, coinY(cn, g), 8, COL_COININ); }
    for (i = 0; i < s.coins.length; i++) {
      cn = s.coins[i];
      var a = p(t, cn.tin, cn.tin + .4);
      if (a <= 0) continue;
      var cy = coinY(cn, g), sx = cn.x * B, sy = (cy + coinBob(cn.i, t)) * B;
      if (cn.st === 'live' || (cn.st === 'crack' && t < cn.crackT)) {
        sx += jiggle(t, cn.bumpT, 7, 40, 7);
        sy -= Math.max(0, jiggle(t, cn.bumpT, 9, 20, 9));
        if (hintOn && a >= 1 && !cn.target) {                 // a soft pulse ring until the first coin is tapped
          var ph = (t * 1.1 + cn.i * .25) % 1;
          c.save(); c.globalAlpha = .55 * (1 - ph); c.strokeStyle = C.white; c.lineWidth = 4; c.beginPath(); c.arc(sx, sy, 40 + ph * 16, 0, Math.PI * 2); c.stroke(); c.restore();
        }
        if (cn.target && cn.st === 'live') {                  // tapped, waiting for Lau to grab it: a thin lime ring
          c.save(); c.strokeStyle = C.navy; c.lineWidth = 7; c.beginPath(); c.arc(sx, sy, 42, 0, Math.PI * 2); c.stroke();
          c.strokeStyle = C.lime; c.lineWidth = 3.5; c.stroke(); c.restore();
        }
        drawCoin(G, sx, sy, a < 1 ? E.outBackBig(a) : 1, cn, { alpha: Math.min(1, a * 2.5) });
      } else if (cn.st === 'crack') {
        var d = t - cn.crackT;
        if (d < .22) { sx += (Math.floor(t * 26) % 2 ? 3 : -3); drawCoin(G, sx, sy, 1, cn); }
        else if (d < .37) drawCoin(G, sx, sy, 1, cn, { crack: true, tone: 'coral' });
        else if (d < .9) {
          var e = d - .37, al = 1 - p(e, .22, .5);
          for (var k = -1; k <= 1; k += 2) drawCoin(G, sx + k * (6 + 70 * e), sy + .5 * 1100 * e * e, 1, cn, { clip: k, rot: k * 2.2 * e, alpha: al, tone: 'coral' });
        }
        if (d > .22 && d < .7) burst(G, t, cn.crackT + .22, cn.x, cy, 10, COL_CRACK);
      } else if (cn.st === 'poof') {
        var pd = t - cn.poofT; if (pd > .4) continue;
        drawCoin(G, sx, sy - pd * 30, 1 - pd * 1.2, cn, { alpha: 1 - pd / .4 });
        G.puff(cn.x, cy, 3 + pd * 20, 1 - pd / .4);
      } else if (cn.st === 'fly') {
        burst(G, t, cn.flyT, cn.x, cy, 14, COL_FLY);
        var fd = t - cn.flyT;
        if (fd >= 0 && fd < .6) for (var j = 0; j < 3; j++) {
          var x = cn.x + (j - 1) * 30 * fd, y = cy - 4 + (-95 - (j % 2) * 18) * fd + .5 * 380 * fd * fd;
          G.spr(PX.coin(Math.floor(fd * 16) + j), x - 4, y - 6, { alpha: 1 - p(fd, .35, .6) });
        }
      }
    }
  }

  function drawKing(R, G, g) {
    var s = R.s, t = R.t;
    if (s.boomT != null && t >= s.boomT) return;
    var fr = Math.floor(t * 8) % 8, hurt = false, dx = 0, sq = 0, foot = g.kf;
    s.hits.forEach(function (h) {
      var d = t - h; if (d < 0) return;
      if (d < .36 && Math.floor(d / .06) % 2 === 0) hurt = true;
      dx += 3 * Math.exp(-d * 7) + jiggle(t, h, 1.5, 50, 9);
    });
    if (s.pips <= 0 && s.hits.length) { var lh = s.hits[s.hits.length - 1]; hurt = Math.floor((t - lh) / .04) % 2 === 0; dx += Math.floor(t * 40) % 2 ? 1 : -1; sq += .06 * p(t, lh, lh + .2); }
    dx = Math.min(dx, 2);
    if (s.ringAt != null && t > s.ringAt - .45 && t < s.ringAt) sq += .13 * E.inOut(p(t, s.ringAt - .45, s.ringAt));   // wind-up
    s.winds.forEach(function (w0) { sq -= jiggle(t, w0, .14, 28, 8); });
    if (s.laughT != null) { var ld = t - s.laughT; if (ld >= 0 && ld < 1.3) sq += .07 * Math.abs(Math.sin(ld * 11)) * (1 - ld / 1.3); }
    if (s.state === 'intro' && t > .8 && t < 2.4) sq += .05 * Math.abs(Math.sin((t - .8) * 11)) * (1 - p(t, .8, 2.4));
    if (Math.abs(sq) < .006) sq = 0;
    if (s.escT != null) { var ed = t - s.escT; dx = 70 * E.in(p(ed, .9, 1.6)); foot -= jumpY(t, s.escT + .9, .35, 8); }   // the King gets away: a hop off to the right
    sprFoot(G, PX.king({ frame: fr, hurt: hurt }), KCX + Math.round(dx), foot, 51, 1 + sq * .8, 1 - sq, true);
  }

  function drawBurst(R, G, g) {
    var s = R.s, t = R.t; if (s.boomT == null) return;
    var d = t - s.boomT; if (d < 0 || d > 1.7) return;
    var P = kingPixels(), cx = KCX, cy = g.kf - 28;
    P.forEach(function (q, i) {
      var qy = g.kf + q.dy, ax = q.x + 1 - cx, ay = qy + 1 - cy, len = Math.hypot(ax, ay) || 1;
      var sp = 45 + hash(i * 1.37) * 95, vx = ax / len * sp + (hash(i * 2.1) - .5) * 30, vy = ay / len * sp - 55 - hash(i * 3.3) * 55;
      var x = q.x + vx * d, y = Math.min(levelAt(g, x + 1) - 2, qy + vy * d + .5 * 330 * d * d);
      G.rect(x, y, 2, 2, d < .07 ? '#FFFFFF' : q.col, 1 - p(d, .8, 1.7));
    });
    if (d < .42) {
      var r = 6 + d * 120;
      for (var j = 0; j < 44; j++) { var an = j / 44 * Math.PI * 2; G.rect(cx + Math.cos(an) * r, cy + Math.sin(an) * r * .8, 2, 2, '#FFFFFF', 1 - d / .42); }
    }
    var gr = 900, v0 = -80, y0 = g.kf - 43, gl = g.gY - 23, d1 = (-v0 + Math.sqrt(v0 * v0 + 2 * gr * (gl - y0))) / gr, y;
    if (d < d1) y = y0 + v0 * d + .5 * gr * d * d;
    else { var vb = .4 * (v0 + gr * d1), e = d - d1, d2 = 2 * vb / gr; y = e < d2 ? gl - vb * e + .5 * gr * e * e : gl; }
    var x = KX + 23 + 42 * d;
    if (x < 148) G.spr(ringSpr(x / (Math.PI * 19)), x - 15, y - 15);
  }

  function drawRings(R, G, g) {
    var s = R.s, t = R.t;
    for (var i = 0; i < s.rings.length; i++) {
      var r = s.rings[i], ry = g.gY - r.h;
      for (var j = 0; j < r.dust.length; j++) {
        var q = r.dust[j], dd = t - q.t0; if (dd > .34) continue;
        var sz = Math.max(1, Math.round(3 - dd * 6));
        G.rect(q.x + dd * 8, g.gY - q.h - dd * 12, sz, sz, '#AEB8EE', .7 * (1 - dd / .34));
      }
      if (r.x < -18) continue;
      var v = r.sp || 0;
      if (v > 40) for (var k = 0; k < 3; k++) G.rect(r.x + 15 + k * 3, ry - 21 + k * 7, 6 + k * 2, 1, '#C9D3FF', clamp((v - 40) / 50) * .75);
      var sc = .4 + .6 * E.outBack(p(t, r.t0, r.t0 + .14)), bob = r.wait ? Math.round(Math.abs(Math.sin(t * 6)) * -1.5) : 0;
      G.spr(ringSpr(r.spin), r.x - 15 * sc, ry - 28 * sc + bob, { scale: sc });
      dust(G, t, r.t0, KX + 7, g.kf - 1, 1);
    }
  }

  function lauSquash(R) {
    var s = R.s, t = R.t, q = 0, d = t - s.sqT;
    if (d >= 0 && d < .16) q -= .18 * (1 - d / .16);
    q += jiggle(t, s.landT, .26 * s.landBig, 24, 9);
    if (s.fire) { var f = t - s.fire.t0; if (f >= -.12 && f < 0) q += .1 * Math.sin((f + .12) / .12 * Math.PI / 2); if (f >= 0 && f < .28) q -= .14 * (1 - f / .28); }
    q += jiggle(t, s.L.hurtT, .2, 30, 8);
    return q;
  }
  function drawLau(R, G, g) {
    var s = R.s, L = s.L, t = R.t, gY = g.gY, x = L.x + L.kx, foot = gY - L.h, sq = lauSquash(R), flip = L.face < 0;
    var run = !!(s.mv && s.mv.ph === 'run'), look = [.7, .1];
    s.rings.forEach(function (r) { if (!r.res && r.x - x < 90 && r.x - x > -20) look = [clamp((r.x - x) / 24, -1, 1), .7]; });
    if (s.state === 'coins') look = s.mv && s.mv.coin ? [clamp((s.mv.coin.x - x) / 20, -1, 1), -1] : [0, -1];
    if (s.fire && t > s.fire.t0 - .3) look = [1, 0];
    var m = L.mood;
    if (s.fire && t - s.fire.t0 > -.05 && t - s.fire.t0 < .4) m = 'joy';
    if (s.danceT != null && t >= s.danceT) {
      var hl = hopLoop(t, s.danceT + .05, .5, 9); foot -= hl.y; sq += hl.sq; m = 'joy'; look = [.6, -.3];
      x += 5 * p(t, s.danceT + .05, s.danceT + .44, E.inOut);
      flip = t >= s.danceT + .5 && Math.floor((t - s.danceT - .5) / 1.0) % 2 === 1;
    }
    var form = L.form;
    if (t >= L.igniteT && t < L.igniteT + .15) form = Math.floor((t - L.igniteT) / .05) % 2 ? 'small' : 'fire';
    var blink = m === 'happy' && ((t + 1.3) % 3.1) < .1 ? 1 : 0;
    /* shadow, ignite ring and sparks */
    var hgt = gY - foot, sw = Math.max(6, Math.round(14 - hgt * .2));
    G.rect(x - sw / 2, gY, sw, 1, '#141A4D', .55);
    burst(G, t, L.igniteT, x, gY - 12, 12, COL_IGNITE);
    var ig = t - L.igniteT;
    if (ig >= 0 && ig < .3) for (var n = 0; n < 14; n++) {
      var an = n / 14 * Math.PI * 2, rr = 13 + 34 * E.out(ig / .3);
      G.rect(x + Math.cos(an) * rr - 1, gY - 12 + Math.sin(an) * rr * .85 - 1, 2, 2, n % 2 ? C.fl1 : C.gold, 1 - ig / .3);
    }
    /* flame float: little flames hold him up while a ring rolls under */
    if (s.jp && s.jp.ph === 'float') for (var k = 0; k < 4; k++) {
      var ph = (t * 3.2 + k / 4) % 1;
      G.rect(x - 4 + k * 2.5 + Math.sin(t * 20 + k) * 1, foot + 1 + ph * 8, 2, 2, COL_FLOAT[k], 1 - ph);
    }
    var alpha = (t - L.hurtT < .8 && Math.floor((t - L.hurtT) / .07) % 2) ? .45 : 1;
    var spr = PX.lau({ h: LH, form: form, frame: run ? Math.floor(t * 14) : Math.floor(t * 7), look: look, blink: blink, mood: m, run: run });
    sprFoot(G, spr, x, foot, LH + 3, 1 + sq * .8, 1 - sq, flip, alpha);
    /* "lagging": a buffering spinner over his head after a ring hit */
    var lg = t - s.lagT;
    if (lg >= 0 && lg < 1) G.spr(ringSpr(t * 1.6), x - 7, foot - LH - 19, { scale: .48, alpha: 1 - p(lg, .75, 1) });
    s.dust.forEach(function (q) {
      var d = t - q.t0; if (d < 0 || d > .4) return;
      var a = 1 - d / .4, r = (2 + d * 7) * Math.max(.6, q.big);
      G.puff(q.x - 7 - d * 24, gY - 2 - d * 8, r, a * .8); G.puff(q.x + 7 + d * 24, gY - 2 - d * 8, r, a * .8);
    });
    R.irisY = (foot - 12) * 3;
    R.irisX = x * 3;
  }

  function firePos(F, t, g) {
    var t1 = F.t0 + .05, u = clamp((t - t1) / (F.hit - t1));
    var x0 = F.x0, y0 = g.gY - 12, x1 = HITX, y1 = g.gY - 28;
    return { x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u - 16 * Math.sin(Math.PI * u) };
  }
  function drawFire(R, G, g) {
    var s = R.s, t = R.t, F = s.fire; if (!F) return;
    var d = t - F.t0, k = F.strong ? 1 : .6, hy = g.gY - 28;
    if (d < -.05 || d > F.hit - F.t0 + .5) return;
    if (d >= 0 && d < .16) {
      var m = 1 - d / .16, fx = F.x0, fy = g.gY - 12, rr = Math.round((2 + 4 * m) * k);
      G.rect(fx - rr, fy - 1, 2 * rr, 2, C.gold, m); G.rect(fx - 1, fy - rr, 2, 2 * rr, C.gold, m);
      G.rect(fx - 2, fy - 2, 4, 4, C.fl1, m); G.rect(fx - 1, fy - 1, 2, 2, C.white, m);
    }
    for (var j = 0; j < (F.strong ? 14 : 6); j++) {
      var ts = Math.min(t, F.hit) - j * .03; if (ts < F.t0 + .05) break;
      var e = t - ts; if (e > .36) continue;
      var q = firePos(F, ts, g);
      G.rect(q.x - 5 - e * 12 + (hash(j + F.t0) - .5) * 4, q.y + (hash(j * 3 + F.t0) - .5) * 6 - e * 16, 2, 2, COL_TRAIL[j % 3], 1 - e / .36);
    }
    if (t >= F.t0 + .05 && t < F.hit) {
      var P = firePos(F, t, g), sc = (.55 + .45 * E.outBack(p(t, F.t0 + .05, F.t0 + .14))) * k, spr = fireSpr(Math.floor(t * 14) % 3);
      G.spr(spr, P.x - 16 * sc, P.y - 9 * sc, { scale: sc });
      G.pill(F.label, P.x * B, (P.y - 14) * B, { size: 15, bg: C.navy, color: C.lime, pad: 10, shadow: false, weight: 800 });
    }
    if (t >= F.hit && t < F.hit + .2) {
      var PH = firePos(F, F.hit, g), ph = p(t, F.hit, F.hit + .2);
      G.pill(F.label, PH.x * B, (PH.y - 14) * B, { size: 15, bg: C.navy, color: C.lime, pad: 10, shadow: false, weight: 800, alpha: 1 - ph, scale: 1 + .3 * ph });
    }
    var hd = t - F.hit;
    if (hd >= 0 && hd < .22) { var ss = (.6 + .9 * E.out(clamp(hd / .12))) * (F.strong ? 1 : .7); G.spr(starSpr(), HITX - 9.5 * ss, hy - 9.5 * ss, { scale: ss, alpha: 1 - p(hd, .12, .22) }); }
    burst(G, t, F.hit, HITX, hy, F.strong ? 18 : 9, COL_FIRE);
  }
  /* not clear: a little ember sputters out short of the King and the smoke drifts up */
  function drawFizzle(R, G, g) {
    var s = R.s, t = R.t; if (s.fizzT == null) return;
    var d = t - s.fizzT; if (d < 0 || d > 1.2) return;
    var x0 = s.L.x + 10, y0 = g.gY - 12;
    if (d < .5) {
      var x = x0 + 30 * d, y = y0 - 10 * d + .5 * 160 * d * d;
      G.rect(x - 1, y - 1, 3, 3, C.fl3, 1 - d / .5); G.rect(x, y, 1, 1, C.fl1, 1 - d / .5);
    }
    for (var i = 0; i < 4; i++) {
      var dd = d - .3 - i * .08; if (dd < 0 || dd > .8) continue;
      G.puff(x0 + 14 + i * 3 + Math.sin(dd * 6 + i) * 2, y0 + 2 - dd * 26, 2 + dd * 5, .55 * (1 - dd / .8));
    }
  }
  function drawConfetti(R, G, g) {
    var s = R.s, t = R.t; if (s.danceT == null || t < s.danceT) return;
    var cols = COL_CONF;
    for (var i = 0; i < 72; i++) {
      var d = t - s.danceT - hash(i * 1.7) * 2.4; if (d < 0) continue;
      var y = -6 - hash(i * 9.1) * 20 + d * (42 + hash(i * 5.1) * 34); if (y > g.gY - 2) continue;
      var x = hash(i * 3.3) * 130 + Math.sin(d * 3 + i) * 4;
      G.rect(x, y, Math.sin(d * 10 + i) > 0 ? 2 : 1, 2, cols[i % cols.length]);
    }
  }

  /* ---------- drawing: the HUD layer (sp) ---------- */
  function drawBuilder(R, G, g) {
    var s = R.s, t = R.t, b = s.builder; if (!b) return;
    var a = p(t, b.t0, b.t0 + .35), out = b.outT != null ? p(t, b.outT, b.outT + .4) : 0;
    if (a <= 0 || out >= 1) return;
    var c = G.ctx, slug = s.item.slug, sy = BK.SYLL[slug], top = g.top, cy = top + 50, ty = top + 23, sly = top + 64;
    var m = b.doneT != null ? E.inOut(p(t, b.doneT, b.doneT + .25)) : 0, done = b.doneT != null && t >= b.doneT + .25;
    var sc = .7 + .3 * E.outBack(a);
    c.save(); c.globalAlpha = Math.min(1, a * 2) * (1 - out);
    c.translate(195, cy); c.scale(sc, sc); c.translate(-195, -cy);
    if (done) {
      var gl = .5 + .5 * Math.sin((t - b.doneT) * 7);
      c.save(); c.globalAlpha *= .3 + .3 * gl; c.fillStyle = C.lime; PX.roundRect(c, 32, top - 8, 326, 116, 30); c.fill(); c.restore();
    }
    G.box(40, top, 310, 100, { bg: done ? C.limeSoft : C.white, border: done ? C.limeDk : C.navy, borderW: 4, r: 22 });
    var word = BK.label(slug);
    if (done) G.text((b.retry ? 'One more try: ' : 'Built: ') + word, 195, ty, { size: 16, weight: 800, color: b.retry ? C.navy : '#178A5A' });
    else {
      c.save(); c.font = '700 16px Lexend, sans-serif'; var w1 = c.measureText('Build the word ').width; c.font = '800 18px Lexend, sans-serif'; var w2 = c.measureText(word).width; c.restore();
      var x0 = 186 - (w1 + w2) / 2;
      G.text('Build the word ', x0, ty, { size: 16, weight: 700, color: C.ink2, align: 'left' });
      G.text(word, x0 + w1, ty, { size: 18, weight: 800, color: C.navy, align: 'left' });
      /* speaker: tap the card to hear the word again */
      var spx = 318, spy = ty, sp = clamp((t - s.speakT) / 1.2);
      c.fillStyle = C.navy; c.beginPath(); c.moveTo(spx - 9, spy - 4); c.lineTo(spx - 4, spy - 4); c.lineTo(spx + 3, spy - 10); c.lineTo(spx + 3, spy + 10); c.lineTo(spx - 4, spy + 4); c.lineTo(spx - 9, spy + 4); c.closePath(); c.fill();
      if (sp > 0 && sp < 1) { c.save(); c.strokeStyle = C.limeDk; c.lineWidth = 3; c.globalAlpha *= (1 - sp); for (var q = 0; q < 2; q++) { c.beginPath(); c.arc(spx + 4, spy, 5 + sp * 7 + q * 6, -.8, .8); c.stroke(); } c.restore(); }
    }
    if (!done) {
      var sl = slotCenters(b.n, m);
      for (var i = 0; i < b.n - 1; i++) G.text('·', (sl.xs[i] + sl.xs[i + 1]) / 2, sly + 2, { size: 30, weight: 900, color: C.navy, alpha: c.globalAlpha * (1 - m) });
      for (i = 0; i < b.n; i++) {
        var cx = sl.xs[i], sw = sl.w, sh = 46, x = cx - sw / 2, y = sly - sh / 2, ft = s.fillT[i];
        c.save();
        if (ft == null || t < ft) {
          c.fillStyle = '#F1F3FB'; PX.roundRect(c, x, y, sw, sh, 14); c.fill();
          c.setLineDash([7, 5]); c.lineWidth = 3; c.strokeStyle = '#9AA0C8'; PX.roundRect(c, x + 1.5, y + 1.5, sw - 3, sh - 3, 13); c.stroke();
          c.setLineDash([]); c.restore();
          var gh = s.ghost[i];
          if (gh != null && t >= gh) G.text(sy.parts[i].toUpperCase(), cx, sly + 1, { size: 20, weight: 900, color: GHOST_COL, alpha: c.globalAlpha * p(t, gh, gh + .3) });
          continue;
        }
        var u = p(t, ft, ft + .3), ps = 1.3 - .3 * E.outBack(u);
        c.translate(cx, sly); c.scale(ps, ps); c.translate(-cx, -sly);
        c.fillStyle = C.gold; PX.roundRect(c, x, y, sw, sh, 14); c.fill();
        c.lineWidth = 3; c.strokeStyle = C.navy; PX.roundRect(c, x + 1.5, y + 1.5, sw - 3, sh - 3, 13); c.stroke();
        c.fillStyle = C.navy; c.font = '900 ' + (sy.parts[i].length >= 4 ? 20 : 22) + 'px Lexend, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(sy.parts[i].toUpperCase(), cx, sly + 1);
        c.restore();
      }
    } else {
      var u2 = p(t, b.doneT + .25, b.doneT + .55);
      G.pill(sy.parts.join('·'), 195, sly, { size: 26, weight: 900, bg: C.lime, color: C.navy, pad: 24, border: C.navy, borderW: 3, scale: .8 + .2 * E.outBackBig(u2) });
    }
    c.restore();
  }
  function drawFlyingCoins(R, G, g) {
    var s = R.s, t = R.t, b = s.builder; if (!b) return;
    var sl = slotCenters(b.n, 0), ty = g.top + 64;
    s.coins.forEach(function (cn) {
      if (cn.st !== 'fly') return;
      var d = t - cn.flyT; if (d < 0 || d >= .3) return;
      var sx0 = cn.x * B, sy0 = coinY(cn, g) * B, tx = sl.xs[cn.idx], sc, x, y;
      if (d < .06) { sc = 1 + .3 * (d / .06); x = sx0; y = sy0 - 20 * (d / .06); }
      else {
        var u = E.inOut((d - .06) / .24), ctrlX = (sx0 + tx) / 2, ctrlY = Math.min(sy0, ty) - 90, y1 = sy0 - 20;
        x = (1 - u) * (1 - u) * sx0 + 2 * (1 - u) * u * ctrlX + u * u * tx;
        y = (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * ctrlY + u * u * ty;
        sc = 1.3 - .6 * u;
      }
      drawCoin(G, x, y, sc, cn);
    });
  }
  function drawOverlays(R, G, g) {
    var s = R.s, t = R.t, c = G.ctx, a, o, sc;
    /* boss title */
    a = p(t, .3, .75); o = 1 - p(t, 2.2, 2.6);
    if (a > 0 && o > 0) {
      sc = E.outBackBig(a);
      c.save(); c.globalAlpha = Math.min(1, a * 2) * o; c.translate(195, g.titleY - 24 * p(t, 2.2, 2.6, E.in)); c.scale(sc, sc); c.translate(-195, -g.titleY);
      G.pill('Boss fight', 195, g.titleY - 52, { size: 17, bg: C.coral, color: C.white, pad: 16, weight: 800 });
      G.text('LAG KING', 195, g.titleY + 4, { size: 46, weight: 900, color: C.white, stroke: C.navy, strokeW: 10 });
      c.restore();
    }
    /* the slip coin's note */
    var sn = s.slipNote;
    if (sn) {
      a = p(t, sn.t0, sn.t0 + .15); o = 1 - p(t, sn.t0 + 1.9, sn.t0 + 2.2);
      if (a > 0 && o > 0) {
        if (sn.w == null) { c.save(); c.font = '800 16px Lexend, sans-serif'; sn.w = c.measureText(sn.text).width + 24; c.restore(); }
        var ncy = coinY(sn.c, g), nx = clamp(sn.c.x * B, sn.w / 2 + 10, 380 - sn.w / 2);       // under a low coin, over a high one
        G.pill(sn.text, nx, (sn.c.hy < 75 ? ncy + 21 : ncy - 22) * B, { size: 16, bg: C.coral, color: C.white, pad: 12, weight: 800, shadow: false, alpha: Math.min(1, a * 2) * o, scale: .7 + .3 * E.outBackBig(a) });
      }
    }
    /* notes */
    if (s.note) {
      var nd = t - s.note.t0, na = p(nd, 0, .2) * (1 - p(nd, s.note.dur - .3, s.note.dur));
      if (na > 0) {
        var info = G.wrap(s.note.text, 17, 340, 700);
        if (info.lines.length === 1) G.pill(s.note.text, 195, g.noteY, { size: 17, bg: C.navy, color: C.white, pad: 16, alpha: na, scale: .85 + .15 * p(nd, 0, .25, E.outBack) });
        else {
          var bw = Math.ceil(info.w) + 32, bh = 2 * 22 + 18;
          c.save(); c.globalAlpha = na; G.box(195 - bw / 2, g.noteY - bh / 2, bw, bh, { bg: C.navy, r: 18 });
          info.lines.forEach(function (ln, i) { G.text(ln, 195, g.noteY - 11 + i * 22, { size: 17, weight: 700, color: C.white }); });
          c.restore();
        }
      }
    }
    /* win */
    if (s.boomT != null) {
      a = p(t, s.boomT + .4, s.boomT + .85);
      if (a > 0) {
        sc = .5 + .5 * E.outBackBig(a);
        var bob = Math.round(Math.sin((t - s.boomT) * 3.4) * 3);
        c.save(); c.globalAlpha = Math.min(1, a * 2); c.translate(195, g.titleY); c.scale(sc, sc); c.translate(-195, -g.titleY);
        G.text('CREW FREED', 195, g.titleY + bob, { size: 44, weight: 900, color: C.lime, stroke: C.navy, strokeW: 10 });
        c.restore();
      }
    }
  }

  function draw(R, G) {
    var s = R.s, t = R.t, g = geo(R), c = G.ctx;
    G.clear('#28316F');
    c.save(); c.translate(R.shakeX(), 0);
    drawRoom(G, g, t);
    drawCages(R, G, g);
    drawCoinsWorld(R, G, g);
    drawRings(R, G, g);                                       // behind the King: the rings come out from behind him
    drawKing(R, G, g);
    drawBurst(R, G, g);
    drawFizzle(R, G, g);                                      // the smoke stays behind a freed crew member
    drawCrewFree(R, G, g);
    drawLau(R, G, g);
    drawFire(R, G, g);
    drawConfetti(R, G, g);
    c.restore();
    drawBuilder(R, G, g);
    drawFlyingCoins(R, G, g);
    drawOverlays(R, G, g);
  }

  /* the boss bar takes the HUD label's place (between the hearts and the sparks), like the video */
  function bossBar(R, G) {
    var s = R.s, t = R.t, c = G.ctx, y = R.layout.hudY;
    var a = p(t, .5, .9), fade = s.boomT != null ? p(t, s.boomT + .4, s.boomT + .8) : 0;
    if (a <= 0 || fade >= 1) return;
    c.save(); c.font = '800 15px Lexend, sans-serif'; var tw = c.measureText('LAG KING').width; c.restore();
    var L0 = 121, R0 = 273, segW = clamp(Math.floor((R0 - L0 - 20 - tw - 7 - 6) / 3), 10, 33), W = 20 + tw + 7 + 3 * segW + 6, H = 30;
    var cx = (L0 + R0) / 2, x = Math.round(cx - W / 2), scl = .6 + .4 * E.outBackBig(a);
    var shx = 0; s.hits.forEach(function (h) { shx += jiggle(t, h, 5, 60, 10); });
    c.save(); c.globalAlpha = Math.min(1, a * 2) * (1 - fade);
    c.translate(cx + shx, y); c.scale(scl, scl); c.translate(-cx, -y);
    G.box(x, y - H / 2, W, H, { bg: C.navy, r: H / 2, shadow: false });
    G.text('LAG KING', x + 10, y + 1, { size: 15, weight: 800, color: C.lime, align: 'left' });
    for (var i = 0; i < 3; i++) {
      var sx0 = x + 10 + tw + 7 + i * (segW + 3), sy0 = y - 7, sh = 14;
      c.fillStyle = '#2A3170'; c.fillRect(sx0, sy0, segW, sh);
      var ht = s.hits[2 - i], frac = p(t, .9 + i * .15, 1.05 + i * .15, E.out), flash = false;
      if (ht != null) { var d = t - ht; flash = d >= 0 && d < .12; if (d >= 0) frac = flash ? 1 : 1 - p(d, .12, .32, E.out); }
      if (frac > 0) {
        c.fillStyle = flash ? '#FFFFFF' : C.coral; c.fillRect(sx0, sy0, segW * frac, sh);
        c.fillStyle = flash ? '#FFFFFF' : '#FF9C84'; c.fillRect(sx0, sy0, segW * frac, 3);
      }
    }
    c.restore();
  }
  function drawTop(R, G) {
    var s = R.s, t = R.t, j = R.layout.jump, c = G.ctx, g = geo(R);
    bossBar(R, G);
    /* the run's first ring: from the start of word 1 until that ring is cleared, show where to tap (the ring waits) */
    if (s.state === 'rings' && !s.tutDone) {
      var ph = (t % 1) / 1;
      c.save(); c.globalAlpha = .8 * (1 - ph); c.strokeStyle = C.white; c.lineWidth = 5; c.beginPath(); c.arc(j.x, j.y, j.r + 6 + ph * 22, 0, Math.PI * 2); c.stroke(); c.restore();
      if (!(s.note && t - s.note.t0 < s.note.dur)) G.pill(HINT_JUMP, 195, g.noteY, { size: 16, bg: C.navy, color: C.white, pad: 14, shadow: false, scale: 1 + .04 * Math.sin(t * 5) });
    }
    /* first coins: say what to do */
    if (s.state === 'coins' && !s.tappedCoin && s.phaseN === 1 && s.builder && t > s.builder.t0 + .9 && !(s.note && t - s.note.t0 < s.note.dur)) {
      G.pill(HINT_COIN, 195, g.noteY, { size: 16, bg: C.navy, color: C.white, pad: 14, shadow: false, scale: 1 + .04 * Math.sin(t * 5) });
    }
    var io = p(t, 0, .6, E.inOut);
    if (io < 1) {
      var lx = R.irisX || HOME * 3, ly = R.irisY || G.SH - 140;
      var Rn = Math.max(Math.hypot(lx, ly), Math.hypot(390 - lx, ly), Math.hypot(lx, G.SH - ly), Math.hypot(390 - lx, G.SH - ly));
      G.iris(io * Rn / Math.hypot(390, G.SH), lx, ly);
    }
  }

  /* ---------- test hooks ---------- */
  function info(R) {
    var s = R.s, g = geo(R), L = s.L, t = R.t, next = s.built.length, choices = [];
    if (s.state === 'coins') s.coins.forEach(function (c) {
      if (c.st !== 'live' || c.target || t < c.tin + .3) return;
      choices.push({ label: c.label, text: c.text, right: c.kind === 'part' && c.idx === next, slip: c.kind === 'slip', order: c.idx, x: c.x * 3 - 39, y: coinY(c, g) * 3 - 39, w: 78, h: 78 });
    });
    return {
      word: s.item ? s.item.slug : null, pips: s.pips, built: s.built.length, parts: s.item ? BK.SYLL[s.item.slug].parts.length : 0,
      rings: s.rings.filter(function (r) { return r.x > -18; }).map(function (r) { return { x: +r.x.toFixed(1), dx: +(r.x - L.x).toFixed(1), v: r.v, res: r.res, down: r.down, hold: !!r.hold, wait: !!r.wait }; }),
      ringsOut: s.ringN, lau: { x: +L.x.toFixed(1), h: +L.h.toFixed(1), form: L.form, busy: !!(s.mv || s.jp) },
      cages: s.open.filter(function (x) { return x != null; }).length, queue: s.queue.map(function (q) { return q.slug; }),
      ghosts: s.ghost.filter(function (x) { return x != null; }).length, ringHits: s.ringHits, tutDone: s.tutDone, wordN: s.wordN,
      retry: !!(s.item && s.item.ret), clean: !!s.clean, mist: s.mist, pend: s.pend.length, note: s.note && t - s.note.t0 < s.note.dur ? s.note.text : null,
      slipNote: s.slipNote ? s.slipNote.text : null, cageY: g.cageY, gY: g.gY, coins: s.coins.map(function (c) { return { t: c.text, st: c.st, y: coinY(c, g) }; }),
      builder: s.builder ? { x: 40, y: g.top, w: 310, h: 100 } : null, choices: choices
    };
  }

  var DEF = {
    id: 'g20', name: 'Lag King', sub: 'Boss fight', lives: 3, scoreLabel: 'sparks',
    rules: ['Tap JUMP to hop the King’s rings', 'Tap the sound coins in order', 'A clear word becomes a fireball'],
    controls: { jump: true }, hudLabel: false,
    jumpAlpha: function (R) { var st = R.s.state; return st === 'rings' || st === 'intro' ? 1 : (st === 'win' || st === 'out' || st === 'escape') ? 0 : .45; },
    init: init, update: update, draw: draw, drawTop: drawTop, tap: tap, jump: jump, key: key, info: info,
    /* the hub, intro and most end cards show the King; "Crew freed" passes Lau to R.end (see boom) */
    icon: function () { return PX.king({ frame: 0 }); }, iconScale: 1.45,
    finish: function (R) { R.end({ reason: 'done', delay: .2 }); }
  };
  ARC.registerGame(DEF);
})();
