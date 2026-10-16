/* Game 19 · Block Bump (block bumper). Look and feel ported from the approved video scene
   (../../../arcade-video/scenes/g19_blockbump.js): a pixel shop street, a customer with a need, a row of three ?-blocks.

   Rules (SPEC.md): 8 customers. A customer stops Lau with a need; three ?-blocks carry spec labels; tap a block and Lau
   hops up and bumps it. Right: coins, and the word's buddy (data.js `buddy`) pops out and joins the crew line behind
   Lau. Wrong: the right label turns lime at once, a lag bug drops out and crawls toward Lau (tap JUMP, or anywhere, to
   stomp it; if it reaches Lau a heart goes), then the right block lights up and bumping it gives one fix-it coin.
   After the 3rd and the 6th customer a checkpoint flag opens the Say-it card on a word from those three customers.
   Customer 8 has two needs (an SSD need and a Storage need): both blocks are right and both must be bumped.
   Sparks (the score): +2 per right bump, +1 per fix-it coin, +2 for a clear Say-it (+1 tap check; a clear mic or
   trainer say also gives back a lost heart), +2 when customer 8 gets both blocks with no wrong one, +3 for a run with
   no wrong block. A perfect run = 27 sparks (7 x 2 + 2 x 2 + 2 + 2 x 2 + 3). The learner taps the lit block
   themselves (JUMP only wiggles it). The finish banner and end title follow R.right (right first time, of 9):
   FULL CREW with no wrong block, ALL HELPED from 7 of 9, else STREET DONE. Nothing is timed except the bug's slow
   crawl (about 4 s). */
(function () {
  'use strict';
  var U = ARC.U, C = PX.C, E = U.E, p = U.p, clamp = U.clamp, hash = U.hash, lerp = U.lerp, jiggle = U.jiggle;
  var BK = ARC.bank;
  var N = 8;                                   // customers per run
  var RIGHTS = N + 1;                          // answers per run: one per customer, two for customer 8
  var PRAISE_AT = 7;                           // "ALL HELPED" needs 7 of 9 right first time, else "STREET DONE"
  var BX = [24, 61, 99];                       // block centres on screen while stopped (game px)
  var COL = 19;                                // half width of a block's tap column (game px)
  var CUST_X = 118, LAU_X = 44, CREW_X = 25, CREW_GAP = 15, CREW_MIN = 9;   // crew spacing shrinks 15 -> 9 px as it grows
  var BUG_LAND = 74, CRAWL = 5, REACH = 11;    // the bug lands 30 px in front of Lau and crawls 5 px/s
  var STEP = 112;                              // world px between customer stops; lamps repeat at the same spacing
  var VMAX = 50, ACC = 80, DEC = 90;           // camera run (game px/s, px/s^2)
  var BLOCK_UP = 96;                           // block top = ground - 96 (6 px above the video so two-line needs fit)
  var BUMP_H = BLOCK_UP - 18 - 22 + 2;         // Lau's head reaches 2 px into the block bottom (58)
  var SAY_AT = [2, 5];                         // checkpoint flag after the 3rd and the 6th customer
  var HINT_PICK = 'Tap the block that answers', HINT_STOMP = 'Tap JUMP to stomp the bug', HINT_FIX = 'Bump the lit block';
  var HINT_TWO = 'Two needs: bump both right blocks';
  var CLOUDS = [[18, 204, 30], [92, 220, 22], [150, 176, 36], [60, 158, 26]];

  /* ---------- small helpers (ported from the video scene) ---------- */
  /* parabola from y0 (u=0) to y1 (u=1), up = +, rising hp above y0 at its top */
  function arc(u, y0, y1, hp) {
    var D = y1 - y0; hp = Math.max(hp, D + .5, .5);
    var q = 4 * hp - 2 * D, b = (q + Math.sqrt(Math.max(0, q * q - 4 * D * D))) / 2;
    return y0 + (b + D) * u - b * u * u;
  }
  /* rise to H, still moving up at the end (bumping a block from below) */
  function rise(u, H) { return H * u * (2 - .75 * u) / 1.25; }
  /* landing squash: decaying wobble after t0 */
  function jig(t, t0, amp) { var d = t - t0; if (d < 0 || d > .5) return 0; return amp * Math.exp(-d * 11) * Math.cos(d * 26); }
  /* a sprite anchored at its bottom-centre (cx, by in game px), squash/stretch snapped to game px */
  function put(G, s, cx, by, o) {
    o = o || {};
    var sx = o.sx || 1, sy = o.sy || 1;
    var w = Math.max(1, Math.round(s.width * sx)), h = Math.max(1, Math.round(s.height * sy));
    var x = Math.round(cx - w / 2), y = Math.round(by - h), c = G.ctx;
    c.save(); c.imageSmoothingEnabled = false;
    if (o.alpha != null) c.globalAlpha *= clamp(o.alpha);
    if (o.clipY != null) { c.beginPath(); c.rect(-30, -30, 450, o.clipY * 3 + 30); c.clip(); }
    if (o.flip) { c.translate((x + w) * 3, y * 3); c.scale(-1, 1); c.drawImage(s, 0, 0, w * 3, h * 3); }
    else c.drawImage(s, x * 3, y * 3, w * 3, h * 3);
    c.restore();
  }
  function disc(G, cx, cy, r, col, a) {
    cx = Math.round(cx); cy = Math.round(cy);
    for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r * .6) G.rect(cx + dx, cy + dy, 1, 1, col, a);
  }
  /* a dust puff cluster at (gx, gy) since t0; dir -1/1 biases the spread */
  function dust(G, t, t0, gx, gy, n, spread, life, dir) {
    var d = t - t0; if (d < 0 || d > life) return;
    var u = d / life;
    for (var i = 0; i < n; i++) {
      var f = n === 1 ? 0 : i / (n - 1) * 2 - 1, h = hash(i * 4.1 + t0 * 3.3);
      var x = gx + (f * spread + (dir || 0) * spread * .6) * E.out(u), y = gy - (2 + h * 5) * E.out(u);
      var r = Math.max(0, Math.round((1.2 + h * 1.6) * Math.sin(Math.min(1, u * 1.25) * Math.PI)));
      disc(G, x, y + 1, r, C.soil, (1 - u) * .9);
      disc(G, x, y, r, C.white, 1 - u);
    }
  }
  function sparkle(G, t, t0, gx, gy, col) {
    var d = t - t0; if (d < 0 || d > .3) return;
    var u = d / .3, L = Math.round(1 + 3 * Math.sin(u * Math.PI)), a = 1 - u * .6;
    col = col || C.white;
    G.rect(gx, gy, 1, 1, col, a);
    for (var i = 1; i <= L; i++) { G.rect(gx + i, gy, 1, 1, col, a); G.rect(gx - i, gy, 1, 1, col, a); G.rect(gx, gy + i, 1, 1, col, a); G.rect(gx, gy - i, 1, 1, col, a); }
  }
  function shadow(G, cx, w, lift, gy, am) {
    var s = Math.max(.35, 1 - lift / 70), ww = Math.round(w * s);
    am = am == null ? 1 : am;
    G.rect(Math.round(cx - ww / 2), gy, ww, 1, C.navy, (.16 * s + .04) * am);
    G.rect(Math.round(cx - ww / 2) + 2, gy + 1, Math.max(1, ww - 4), 1, C.navy, (.12 * s + .03) * am);
  }
  function lowerFirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

  /* ---------- sprites made for this game (from the video scene; a small fixed set, cached here) ---------- */
  var cache = {};
  function once(key, fn) { return cache[key] || (cache[key] = fn()); }
  var FONT = {
    A: ['.x.', 'x.x', 'xxx', 'x.x', 'x.x'], C: ['.xx', 'x..', 'x..', 'x..', '.xx'], E: ['xxx', 'x..', 'xx.', 'x..', 'xxx'],
    H: ['x.x', 'x.x', 'xxx', 'x.x', 'x.x'], L: ['x..', 'x..', 'x..', 'x..', 'xxx'], N: ['xx.', 'x.x', 'x.x', 'x.x', 'x.x'],
    O: ['xxx', 'x.x', 'x.x', 'x.x', 'xxx'], P: ['xx.', 'x.x', 'xx.', 'x..', 'x..'], R: ['xx.', 'x.x', 'xx.', 'x.x', 'x.x'],
    S: ['.xx', 'x..', '.x.', '..x', 'xx.'], T: ['xxx', '.x.', '.x.', '.x.', '.x.']
  };
  var SHOPS = [
    { wall: C.sky2, sh: '#B6C1F7', trim: C.periDk, awn: C.lime, awnSh: C.limeDk, sign: 'LAPTOPS', show: 'laptops' },
    { wall: C.cream, sh: '#F0E3C2', trim: C.soilDk, awn: C.coral, awnSh: C.coralSh, sign: 'STORE', show: 'boxes' },
    { wall: C.peach, sh: '#F29C7F', trim: C.coralSh, awn: C.lime, awnSh: C.limeDk, sign: 'PHONES', show: 'phones' },
    { wall: C.periSoft, sh: '#D3DAFB', trim: C.periSh, awn: C.coral, awnSh: C.coralSh, sign: 'TECH', show: 'screen' }
  ];
  var SHOP_SEQ = [0, 1, 2, 3, 1, 0, 2, 3, 0, 2, 1, 3];
  var SHOP_W = 56, SHOP_H = 70;
  function shop(type) {
    return once('shop' + type, function () {
      var s = SHOPS[type];
      return PX.make(SHOP_W, SHOP_H, function (px) {
        var x, y, W = SHOP_W, H = SHOP_H, i, j;
        for (y = 0; y < H; y++) for (x = 0; x < W; x++) px(x, y, s.wall);
        for (y = 0; y < H; y++) { px(0, y, s.sh); px(1, y, s.sh); px(W - 2, y, s.trim); px(W - 1, y, s.trim); }
        for (x = 0; x < W; x++) { px(x, 0, s.trim); px(x, 1, s.trim); px(x, 2, s.sh); }
        var n = s.sign.length, bw = 4 * n - 1 + 4, bx = Math.round((W - bw) / 2);
        for (y = 4; y < 13; y++) for (x = bx; x < bx + bw; x++) px(x, y, (y === 4 || y === 12 || x === bx || x === bx + bw - 1) ? C.navy : C.navy2);
        for (i = 0; i < n; i++) {
          var gl = FONT[s.sign[i]];
          for (y = 0; y < 5; y++) for (x = 0; x < 3; x++) if (gl[y][x] === 'x') px(bx + 2 + i * 4 + x, 6 + y, C.cream);
        }
        for (x = 2; x < W - 2; x++) {
          px(x, 14, s.trim);
          var st = Math.floor((x - 2) / 4), col = st % 2 ? C.white : s.awn, colSh = st % 2 ? C.periSoft : s.awnSh;
          for (y = 15; y < 20; y++) px(x, y, (x - 2) % 4 === 3 ? colSh : col);
          if ((x - 2) % 4 === 1 || (x - 2) % 4 === 2) px(x, 20, col);
          px(x, 21, s.sh); if ((x - 2) % 4 === 1 || (x - 2) % 4 === 2) px(x, 22, s.sh);
        }
        var wx0 = 4, wx1 = 31, wy0 = 26, wy1 = 57;
        for (y = wy0; y <= wy1; y++) for (x = wx0; x <= wx1; x++) {
          var edge = x === wx0 || x === wx1 || y === wy0 || y === wy1;
          px(x, y, edge ? s.trim : (y < 34 ? '#F2F5FF' : '#DCE3FF'));
        }
        for (i = 0; i < 9; i++) { px(wx0 + 4 + i, wy0 + 10 - i, C.white); px(wx0 + 5 + i, wy0 + 10 - i, C.white); px(wx0 + 12 + i, wy0 + 9 - i, C.white); }
        for (x = wx0 + 1; x < wx1; x++) { px(x, 50, s.trim); px(x, 51, s.sh); }
        if (s.show === 'laptops') {
          [7, 19].forEach(function (lx) {
            for (y = 41; y < 49; y++) for (x = lx + 1; x < lx + 10; x++) px(x, y, (y === 41 || y === 48 || x === lx + 1 || x === lx + 9) ? C.navy : (y === 43 && x < lx + 7 ? C.lime : C.peri));
            for (x = lx; x < lx + 11; x++) px(x, 49, C.grey);
          });
        } else if (s.show === 'phones') {
          [7, 13, 19, 25].forEach(function (lx, q) {
            for (y = 41; y < 50; y++) for (x = lx; x < lx + 4; x++) px(x, y, (y === 41 || y === 49 || x === lx || x === lx + 3) ? C.navy : (q % 2 ? C.mint : C.peri));
          });
        } else if (s.show === 'boxes') {
          [[6, 43, C.gold], [14, 43, C.lime], [22, 43, C.coral], [10, 37, C.peri]].forEach(function (b) {
            for (y = b[1]; y < b[1] + 7; y++) for (x = b[0]; x < b[0] + 7; x++) px(x, y, (y === b[1] || y === b[1] + 6 || x === b[0] || x === b[0] + 6) ? C.navy : b[2]);
          });
        } else {
          for (y = 34; y < 46; y++) for (x = 8; x < 28; x++) px(x, y, (y === 34 || y === 45 || x === 8 || x === 27) ? C.navy : (y < 38 ? C.lime : C.peri));
          for (y = 46; y < 50; y++) { px(17, y, C.navy); px(18, y, C.navy); }
          for (x = 14; x < 22; x++) px(x, 49, C.navy);
        }
        var dx0 = 35, dx1 = 50, dy0 = 28;
        for (y = dy0; y < 64; y++) for (x = dx0; x <= dx1; x++) {
          var de = x === dx0 || x === dx1 || y === dy0;
          var pane = x > dx0 + 2 && x < dx1 - 2 && y > dy0 + 2 && y < dy0 + 17;
          px(x, y, de ? s.trim : pane ? C.peri : C.navy2);
        }
        for (j = 0; j < 4; j++) px(dx0 + 5 + j, dy0 + 8 - j, C.periSoft);
        px(dx0 + 3, 46, C.gold); px(dx0 + 3, 47, C.goldSh);
        for (x = 0; x < W; x++) { px(x, 64, s.trim); for (y = 65; y < H; y++) px(x, y, s.sh); }
      });
    });
  }
  function skyline() {
    return once('skyline', function () {
      var W = 210, H = 90;
      return PX.make(W, H, function (px) {
        var x = 0, i = 0;
        while (x < W - 6) {
          var bw = 14 + Math.floor(hash(i * 5.3 + 1) * 18), bh = 34 + Math.floor(hash(i * 2.9 + 4) * 52), top = H - bh;
          for (var yy = top; yy < H; yy++) for (var xx = x; xx < Math.min(W, x + bw); xx++) {
            var win = (xx - x) % 4 === 2 && (yy - top) % 6 === 3 && xx < x + bw - 2;
            px(xx, yy, win ? C.periSoft : C.sky2);
          }
          if (hash(i * 8.1) > .6) for (var a = 0; a < 6; a++) px(x + 3, top - 1 - a, C.sky2);
          x += bw + 2 + Math.floor(hash(i * 7.7) * 5); i++;
        }
      });
    });
  }
  function lamp() {
    return once('lamp', function () {
      return PX.make(9, 58, function (px) {
        var x, y;
        for (x = 1; x < 8; x++) px(x, 1, C.navy);
        for (x = 2; x < 7; x++) px(x, 0, C.navy);
        for (y = 2; y < 8; y++) { px(1, y, C.navy); px(7, y, C.navy); for (x = 2; x < 7; x++) px(x, y, y < 4 ? C.fl1 : C.gold); }
        px(4, 2, C.navy); px(4, 3, C.navy);
        for (x = 1; x < 8; x++) px(x, 8, C.navy);
        for (y = 9; y < 54; y++) { px(3, y, C.navy2); px(4, y, C.navy3); px(5, y, C.navy2); }
        for (y = 54; y < 58; y++) for (x = 2; x < 7; x++) px(x, y, y === 54 ? C.navy3 : C.navy2);
      });
    });
  }
  function walkTile() {
    return once('walk', function () {
      return PX.make(16, 16, function (px) {
        for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
          var col = C.cream;
          if (y === 0) col = C.white;
          else if (y === 15 || x === 15) col = C.soil;
          else if (y === 14 || x === 14) col = '#F7EBCB';
          else if (y === 1 || x === 0) col = C.paper;
          px(x, y, col);
        }
      });
    });
  }
  function roadTile(plain) {
    return once('road' + (plain ? 1 : 0), function () {
      return PX.make(16, 16, function (px) {
        for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
          var col = plain ? ((x * 7 + y * 13) % 17 === 0 ? '#737896' : '#7C819E') : y === 0 ? C.soilDk : y < 3 ? C.grey : y === 3 ? C.greyDk : '#7C819E';
          if (!plain && (y === 9 || y === 10) && x >= 3 && x < 11) col = C.cream;
          px(x, y, col);
        }
      });
    });
  }
  function qb(used, flash) { return once('qb' + (used ? 1 : 0) + (flash ? 1 : 0), function () { return PX.outline(PX.qblock(used, flash), C.navy); }); }
  function coinSpr(f) { f = ((f % 4) + 4) % 4; return once('coin' + f, function () { return PX.outline(PX.coin(f), C.goldDk); }); }
  /* customers: the kit's pixel customer in five shirts (two hair colours); mood 'sad' = the 'meh' face with a frown */
  var CV = [null, { '8C9EFF': C.mint, '6E81EE': C.mintSh, '16161A': '#3A2218' }, { '8C9EFF': C.gold, '6E81EE': C.goldSh },
    { '8C9EFF': C.lilac, '6E81EE': C.lilacSh, '16161A': '#3A2218' }, { '8C9EFF': C.pink, '6E81EE': '#E86FAE' }];
  function custSpr(v, mood, thumb) {
    var key = 'cu' + v + mood + (thumb ? 1 : 0);
    if (cache[key]) return cache[key];
    var sad = mood === 'sad', base = PX.customer({ mood: sad ? 'meh' : mood, thumb: thumb });
    var c = document.createElement('canvas'); c.width = base.width; c.height = base.height;
    var x = c.getContext('2d'); x.drawImage(base, 0, 0);
    if (sad) { x.fillStyle = C.hair; x.fillRect(8, 12, 1, 1); x.fillRect(12, 12, 1, 1); }   // bend the mouth into a frown
    var map = CV[v];
    if (map) {
      var d = x.getImageData(0, 0, c.width, c.height), a = d.data, keys = Object.keys(map).map(function (h) {
        var to = map[h]; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16),
          parseInt(to.slice(1, 3), 16), parseInt(to.slice(3, 5), 16), parseInt(to.slice(5, 7), 16)];
      });
      for (var i = 0; i < a.length; i += 4) for (var m = 0; m < keys.length; m++) {
        var f = keys[m];
        if (a[i] === f[0] && a[i + 1] === f[1] && a[i + 2] === f[2]) { a[i] = f[3]; a[i + 1] = f[4]; a[i + 2] = f[5]; break; }
      }
      x.putImageData(d, 0, 0);
    }
    return (cache[key] = c);
  }
  /* the word's buddy from data.js (bolo_wave -> bolo); the crew sprites come from the kit */
  function buddyOf(slug) { var w = BK.word(slug), b = (w && w.buddy) || 'rami'; if (b.indexOf('bolo') === 0) return 'bolo'; return b === 'chip' || b === 'pixi' ? b : 'rami'; }
  function budSpr(kind, fr, look, blink) {
    if (kind === 'rami') return PX.rami({ frame: fr, look: look, blink: blink });
    if (kind === 'chip') return PX.chip({ look: look, blink: blink });
    if (kind === 'pixi') return PX.pixi({ look: look });
    return PX.bolo({ look: look });
  }
  function budFoot(kind) { return kind === 'rami' ? 2 : 1; }

  /* ---------- layout from the screen edges (never a fixed 281) ---------- */
  function geo(R) {
    var G = R.G, gY = Math.floor(G.H - 31 - G.bot / 3), BY = gY - BLOCK_UP, pillY = BY * 3 - 22;
    return { gY: gY, BY: BY, pillY: pillY, tipY: gY * 3 - 120, custY: gY - 3, ansY: pillY - 48, hintY: pillY - 100,
      stripY: Math.round(R.layout.hudY + 50) };
  }

  /* ---------- the run's customers ---------- */
  function mkCust(i, rights, needs, opts, v) {
    var cu = { i: i, rights: rights, needs: needs, v: v, stopX: (i + 1) * STEP, done: [], wrongs: 0, fixes: 0,
      arriveT: -1, tSay: 1e9, tHappy: 1e9, tTurn: 1e9, tGo: 1e9, sadT: -9, sadUntil: -9, rowT: [] };
    cu.blocks = U.shuffle(opts).map(function (slug, k) {
      return { slug: slug, label: BK.label(slug), right: rights.indexOf(slug) >= 0, k: k, popT: 1e9, bumpT: null, state: 'idle',
        lit: false, litT: -9, hintT: 1e9, wrong: false, fixed: false };
    });
    return cu;
  }
  function makeCustomers() {
    var vs = U.shuffle([0, 1, 2, 3, 4]);
    var pool = U.shuffle(BK.WORDS.filter(function (w) { return w !== 'ssd' && w !== 'storage'; })).slice(0, N - 1);
    var list = pool.map(function (slug, i) {
      var need = U.pick(BK.NEEDS[slug]), dec = BK.ok(slug, need.decoys) ? need.decoys : BK.DECOY[slug];
      return mkCust(i, [slug], [need.text], [slug].concat(dec), vs[i % 5]);
    });
    /* customer 8: an SSD need and a Storage need, so both blocks are right (the one case SPEC.md allows).
       The third block must be a decoy the content author picked for BOTH needs (e.g. never Display next to
       "thousands of photos and movies": a display need teaches movies = Display); Warranty is the fallback,
       which no SSD or Storage need can point to. */
    var a = U.pick(BK.NEEDS.ssd), b = U.pick(BK.NEEDS.storage);
    var both = a.decoys.filter(function (x) { return b.decoys.indexOf(x) >= 0 && BK.ok('ssd', [x]) && BK.ok('storage', [x]); });
    var d = both.length ? U.pick(both) : 'warranty';
    list.push(mkCust(N - 1, ['ssd', 'storage'], [a.text, b.text], ['ssd', 'storage', d], vs[(N - 1) % 5]));
    return list;
  }
  function crewGap(s) { return clamp(CREW_GAP - s.crew.length - (s.newBud ? 1 : 0), CREW_MIN, CREW_GAP); }
  function needFor(cu, slug) { return cu.needs[Math.max(0, cu.rights.indexOf(slug))]; }
  function allDone(cu) { return cu.rights.every(function (r) { return cu.done.indexOf(r) >= 0; }); }
  function slotFor(cu, slug) { return cu.i < N - 1 ? cu.i : N - 1 + (cu.done.indexOf(slug) > 0 ? 1 : 0); }

  /* ---------- run lifecycle ---------- */
  function later(R, sec, fn) { R.after(sec, function () { if (!R.over && !R.dead) fn(); }); }
  function setPhase(R, ph) { R.s.phase = ph; R.phase = ph; }
  function banner(R, big, small, fill, delay, dur) { R.s.banner = { big: big, small: small, fill: fill, t0: R.t + (delay || 0), dur: dur || 1.8 }; }
  function note(R, text, dur) { R.s.note = { text: text, t0: R.t, dur: dur || 1.6 }; }
  function addDust(R, d) { var s = R.s; d.t0 = d.t0 == null ? R.t : d.t0; s.dust.push(d); if (s.dust.length > 18) s.dust.shift(); }

  function init(R) {
    var s = R.s, i;
    s.custs = makeCustomers(); s.cur = -1;
    s.cam = 0; s.v = 0; s.target = null; s.onArrive = null; s.braking = false; s.skidT = -9; s.stepT = 0;
    s.act = null; s.queue = null; s.stompQ = false; s.lands = []; s.mood = 'happy'; s.moodUntil = 0; s.look = [.6, 0]; s.hurtT = -9;
    s.crew = []; s.newBud = null; s.shift = 0; s.bug = null; s.stomp = null;
    s.coins = []; s.dust = []; s.ans = null; s.banner = null; s.note = null; s.flag = null;
    s.slots = []; for (i = 0; i <= N; i++) s.slots.push({ st: 'todo', kind: null, t: -9 });
    s.roundLog = []; s.checked = {}; s.cheerT = -9; s.tapped = false; s.idleT = 0; s.nudgeT = -9;
    setPhase(R, 'intro');
    banner(R, '8 CUSTOMERS', 'Bump the spec they need', C.white, .35, 1.9);
    later(R, .5, function () { goTo(R, 0); });
  }
  function startRun(R, x, fn) {
    var s = R.s;
    s.target = x; s.onArrive = fn || null; s.braking = false;
    setPhase(R, 'run'); s.look = [.6, 0];
  }
  function goTo(R, i) {
    var s = R.s, cu = s.custs[i];
    s.cur = i;
    slotState(R, cu.i < N - 1 ? cu.i : N - 1, 'now');
    if (i === N - 1) { slotState(R, N, 'now'); banner(R, 'LAST CUSTOMER', 'Two needs, two right blocks', C.lime, .2, 2); }
    startRun(R, cu.stopX, function () { arrive(R, cu); });
  }
  function slotState(R, k, st, kind, delay) { var sl = R.s.slots[k]; if (sl) sl.next = { st: st, kind: kind || sl.kind, at: R.t + (delay || 0) }; }
  function arrive(R, cu) {
    var s = R.s;
    cu.arriveT = R.t; cu.tSay = R.t + .25;
    s.lands.push(R.t); R.sfx('land');
    later(R, .25, function () { R.sfx('pop'); });
    cu.blocks.forEach(function (b, k) { b.popT = R.t + .8 + k * .2; later(R, .8 + k * .2, function () { R.sfx('pop'); }); });
    setPhase(R, 'meet'); s.look = [1, -.2];
    R.announce('Customer ' + (cu.i + 1) + ': ' + cu.needs.join(' ') + ' Blocks: ' + cu.blocks.map(function (b) { return b.label; }).join(', '));
    later(R, 1.4, function () {
      if (s.phase !== 'meet') return;
      setPhase(R, 'choose'); s.look = [.2, -1]; s.idleT = R.t;
    });
  }

  /* ---------- input ---------- */
  function blockAt(R, q) {
    var s = R.s, cu = s.custs[s.cur], g = geo(R); if (!cu) return null;
    if (q.y < g.pillY - 34 || q.y > (g.BY + 18) * 3 + 30) return null;
    var best = null, bd = 1e9;
    cu.blocks.forEach(function (b) { var d = Math.abs(q.gx - (cu.stopX + BX[b.k] - s.cam)); if (d <= COL && d < bd) { bd = d; best = b; } });
    return best;
  }
  function canPick(R, b) {
    var s = R.s;
    /* only once its label has popped in fully (the third block pops in just 0.2 s before 'choose' starts) */
    if (s.phase === 'choose' || s.phase === 'meet') return b.state === 'idle' && R.t >= b.popT + .4;
    if (s.phase === 'fix') return b.lit && b.state === 'idle';
    return false;
  }
  function tap(R, q) {
    var s = R.s;
    if (s.phase === 'bug') { stomp(R); return; }
    if (s.phase !== 'choose' && s.phase !== 'meet' && s.phase !== 'fix') return;
    var b = blockAt(R, q);
    if (b && canPick(R, b)) bump(R, b);
    else if (s.phase !== 'meet') nudge(R);
  }
  function jump(R) {
    var s = R.s;
    if (s.phase === 'bug') { stomp(R); return; }
    /* after a stomp the learner taps the lit (right) block themselves: JUMP only wiggles it and shows the hint,
       so mashing JUMP never answers for them */
    if (s.phase === 'choose' || s.phase === 'fix') nudge(R);
    if (!s.act && s.v < 1 && s.phase !== 'say' && s.phase !== 'out') {   // a little hop: the button always answers
      s.act = { k: 'hop', t0: R.t }; R.sfx('jump');
      later(R, .4, function () { if (s.act && s.act.k === 'hop') { s.act = null; s.lands.push(R.t); } });
    }
  }
  function key(R, k) {
    var i = '123'.indexOf(k); if (i < 0) return;
    var s = R.s, cu = s.custs[s.cur]; if (!cu) return;
    var b = cu.blocks.filter(function (x) { return x.k === i; })[0];
    if (b && canPick(R, b)) bump(R, b);
  }
  function nudge(R) { R.s.nudgeT = R.t; }

  /* ---------- bumping a block ---------- */
  function bump(R, b) {
    var s = R.s, cu = s.custs[s.cur];
    if (s.act && s.act.k !== 'hop') { s.queue = b; return; }
    var bx = cu.stopX + BX[b.k] - s.cam, dir = bx >= LAU_X ? 1 : -1, xb = bx - dir, xl = xb - dir * 2;
    s.act = { k: 'bump', t0: R.t, x0: LAU_X, xb: xb, xl: xl };
    var fixing = s.phase === 'fix';
    b.state = 'busy'; b.bumpT = R.t + .37;
    s.tapped = true; s.idleT = R.t;
    setPhase(R, 'bump');
    s.look = [clamp((bx - LAU_X) / 20, -1, 1), -1];
    R.sfx('tap'); later(R, .05, function () { R.sfx('jump'); });
    later(R, .37, function () { bonk(R, cu, b, fixing); });
    later(R, .67, function () { s.lands.push(R.t); R.sfx('land'); addDust(R, { x: s.cam + xl, n: 2, spread: 7, life: .4, dir: 0 }); });
    later(R, 1.2, function () { s.act = null; s.lands.push(R.t); afterAct(R); });
  }
  function afterAct(R) {
    var s = R.s;
    if (s.stompQ && s.bug && s.phase === 'bug') { s.stompQ = false; stomp(R); return; }
    if (s.queue) { var b = s.queue; s.queue = null; if (canPick(R, b)) bump(R, b); }
  }
  function bonk(R, cu, b, fixing) {
    var s = R.s, g = geo(R), wx = cu.stopX + BX[b.k], sx = (wx - s.cam) * 3, sy = g.BY * 3;
    b.state = 'used';
    R.sfx('bump');
    if (b.right && fixing) {                             /* the lit block after a wrong one: one fix-it coin */
      b.lit = false; b.fixed = true; cu.done.push(b.slug); cu.fixes++;
      s.coins.push({ t0: R.t + .05, x: wx, n: 1 });
      later(R, .05, function () { R.sfx('coin'); });
      R.addSparks(1, sx, sy - 20);
      later(R, .25, function () { R.word(b.slug); });
      s.ans = { text: b.label + ': ' + lowerFirst(BK.MEAN[b.slug]), t0: R.t + .1, x: sx };
      slotState(R, slotFor(cu, b.slug), 'fix', buddyOf(b.slug), .5);
      s.roundLog.push({ slug: b.slug, ok: false });
      cu.rowT[cu.rights.indexOf(b.slug)] = R.t;
      if (allDone(cu)) served(R, cu); else { setPhase(R, 'fix'); s.idleT = R.t; }
    } else if (b.right) {                                /* right: coins, the buddy pops out and joins the crew */
      cu.done.push(b.slug);
      R.good(b.slug, { sparks: 2, from: [sx, sy - 10] });
      R.float('+2', sx + 46, sy - 30);
      s.coins.push({ t0: R.t + .05, x: wx, n: 5 });
      later(R, .05, function () { R.sfx('coin'); });
      s.newBud = { kind: buddyOf(b.slug), t0: R.t + .12, x0: wx, slug: b.slug };
      later(R, .12, function () { R.sfx('pop'); });
      later(R, .3, function () { R.word(b.slug); });
      slotState(R, slotFor(cu, b.slug), 'ok', buddyOf(b.slug), .84);
      s.roundLog.push({ slug: b.slug, ok: true });
      s.mood = 'joy'; s.moodUntil = R.t + 1.4;
      cu.rowT[cu.rights.indexOf(b.slug)] = R.t;
      if (allDone(cu)) {
        if (cu.rights.length > 1 && cu.wrongs === 0) { later(R, .4, function () { R.addSparks(2, 195, g.ansY); note(R, 'Two for two  +2', 1.3); }); }
        served(R, cu);
      } else { setPhase(R, 'choose'); s.idleT = R.t; later(R, .5, function () { note(R, 'One more need', 1.5); }); }
    } else {                                             /* wrong: the right label hints, a lag bug drops out */
      b.wrong = true; cu.wrongs++;
      var rem = cu.blocks.filter(function (x) { return x.right && x.state !== 'used'; });
      rem.forEach(function (x, n) {
        x.hintT = R.t + .05;
        if (n === 0) R.bad(x.slug, needFor(cu, x.slug)); else R.miss(x.slug, needFor(cu, x.slug));
      });
      cu.sadT = R.t; cu.sadUntil = 1e9;
      R.sfx('wrong'); later(R, .1, function () { R.sfx('pop'); });
      R.shake(3);
      s.bug = { st: 'out', t0: R.t + .1, from: wx - s.cam, x: wx - s.cam, y: 0, clip: true, air: false, frozen: false, landT: 1e9 };
      setPhase(R, 'bug');
    }
  }
  function served(R, cu) {
    var s = R.s;
    cu.tHappy = R.t + .15; cu.tTurn = cu.tHappy + 1.2; cu.tGo = cu.tHappy + 1.25; cu.sadUntil = R.t;
    setPhase(R, 'served');
    later(R, .15, function () { R.sfx('cage'); });
    later(R, 1.45, function () {
      if (SAY_AT.indexOf(cu.i) >= 0) toFlag(R, cu);
      else if (cu.i + 1 >= N) finishRun(R);
      else goTo(R, cu.i + 1);
    });
  }

  /* ---------- the lag bug ---------- */
  function stomp(R) {
    var s = R.s, b = s.bug;
    if (!b || s.phase !== 'bug') return;
    if (b.st === 'out' || (s.act && s.act.k !== 'hop')) { s.stompQ = true; return; }   // queued: lands as soon as it can
    if (b.st !== 'crawl') return;
    b.frozen = true; s.stompQ = false;
    s.act = { k: 'stomp', t0: R.t, x0: LAU_X, xt: b.x };
    R.jumpT = R.t;
    setPhase(R, 'stomp');
    s.look = [1, .6];
    R.sfx('jump');
    later(R, .52, function () {
      b.st = 'squash'; b.t0 = R.t; s.stomp = { t0: R.t, x: b.x };
      R.sfx('stomp'); R.shake(4); s.mood = 'joy'; s.moodUntil = R.t + .9;
      s.lands.push(R.t);
    });
    later(R, .57, function () { lightRights(R); });
    later(R, .92, function () { s.act = null; s.lands.push(R.t); addDust(R, { x: s.cam + LAU_X, n: 2, spread: 7, life: .4, dir: 0 }); afterAct(R); });
  }
  function bugHits(R) {
    var s = R.s, b = s.bug, g = geo(R);
    b.st = 'hit'; b.t0 = R.t; b.hx = b.x;
    s.hurtT = R.t; s.mood = 'hurt'; s.moodUntil = R.t + 1;
    R.loseHeart(); R.sfx('hurt'); R.shake(6); R.flash(.25);
    R.burst(LAU_X + 6, g.gY - 10, 12, [C.coral, C.coralSh, C.navy, C.white]);
    if (R.hearts <= 0) { setPhase(R, 'out'); later(R, 1.6, function () { R.end({ reason: 'out' }); }); return; }
    setPhase(R, 'stomp');                                // no input until the right block lights up
    later(R, .7, function () { lightRights(R); });
  }
  function lightRights(R) {
    var s = R.s, cu = s.custs[s.cur];
    cu.blocks.forEach(function (b) { if (b.right && b.state !== 'used') { b.lit = true; b.litT = R.t; } });
    cu.sadUntil = R.t;
    setPhase(R, 'fix'); s.idleT = R.t; s.look = [.2, -1];
    R.sfx('cage');
  }
  function updateBug(R, dt) {
    var s = R.s, b = s.bug; if (!b) return;
    var t = R.t, d = t - b.t0, top = BLOCK_UP + 1;     // bug bottom = ground + 1 - y; sitting on the block at y = top
    if (b.st === 'out') {
      if (d < 0) { b.y = top - 14; b.clip = true; }
      else if (d < .2) { b.x = b.from; b.y = top - 14 * (1 - E.out(d / .2)); b.clip = true; }
      else if (d < .25) { b.y = top; b.clip = false; }
      else if (d < .6) { var u = (d - .25) / .35; b.x = lerp(b.from, BUG_LAND, E.in(u)); b.y = arc(u, top, 0, 6); b.air = true; }
      else {
        b.st = 'crawl'; b.x = BUG_LAND; b.y = 0; b.air = false; b.landT = t;
        addDust(R, { x: s.cam + BUG_LAND, n: 2, spread: 7, life: .4, dir: 0 }); R.sfx('land');
        if (!s.act) { s.mood = 'hurt'; s.moodUntil = t + .5; }                 // the bug, not the block, scares him
        s.look = [1, .5];
        if (s.stompQ && !s.act) { s.stompQ = false; stomp(R); }
      }
    } else if (b.st === 'crawl') {
      if (!b.frozen && t - b.landT > .3) b.x -= CRAWL * dt;
      if (!b.frozen && b.x <= LAU_X + REACH) bugHits(R);
    } else if (b.st === 'squash') { if (d > .9) s.bug = null; }
    else if (b.st === 'hit') { if (d > .8) s.bug = null; }
  }

  /* ---------- checkpoint flag + Say-it ---------- */
  function toFlag(R, cu) {
    var s = R.s, fx = cu.stopX + STEP / 2;
    s.flag = { x: fx + LAU_X + 8, hit: false };
    startRun(R, fx, function () { touchFlag(R); });
    setPhase(R, 'flag');
  }
  function touchFlag(R) {
    var s = R.s, g = geo(R);
    s.flag.hit = true; s.lands.push(R.t);
    R.sfx('flag'); R.burst(LAU_X + 8, g.gY - 36, 14, [C.lime, C.gold, C.white, C.mint]);
    setPhase(R, 'flag');
    later(R, .45, function () { checkpoint(R); });
  }
  function pickSay(R) {
    var s = R.s, log = s.roundLog.slice().reverse(), i;
    for (i = 0; i < log.length; i++) if (!log[i].ok && !s.checked[log[i].slug]) return log[i].slug;
    for (i = 0; i < log.length; i++) if (!s.checked[log[i].slug]) return log[i].slug;
    return log.length ? log[0].slug : 'storage';
  }
  function checkpoint(R) {
    var s = R.s, slug = pickSay(R), next = s.cur + 1;
    s.checked[slug] = true; s.roundLog = [];
    setPhase(R, 'say');
    R.say({ slug: slug, title: 'Say it clearly', sub: 'The crew waits for you', tip: BK.TIPS[slug] }).then(function (res) {
      if (R.dead || R.over) return;
      var g = geo(R);
      setPhase(R, 'resume');
      if (res.passed) {
        var n = res.method === 'tap' ? 1 : 2;
        R.addSparks(n, LAU_X * 3, (g.gY - 30) * 3);
        R.float('+' + n, LAU_X * 3 + 50, (g.gY - 40) * 3);
        if (res.method === 'tap') note(R, 'Right sound  +1', 1.6);
        else banner(R, 'CLEAR', R.gainHeart() ? 'A heart back' : s.crew.length ? 'The crew cheers' : 'Well said', C.lime, .15, 1.6);
        s.cheerT = R.t; s.mood = 'joy'; s.moodUntil = R.t + 1.3;
        R.burst(LAU_X, g.gY - 20, 18, [C.lime, C.gold, C.mint, C.white]); R.sfx('powerup');
      } else note(R, 'Keep practising: ' + BK.word(slug).say, 1.8);
      later(R, res.passed ? 1.5 : 1.3, function () { goTo(R, next); });
    });
  }

  /* ---------- the end of the street ---------- */
  function finishRun(R) {
    var s = R.s;
    setPhase(R, 'finish');
    /* praise follows how many answers were right first time (R.right, out of RIGHTS): fixed answers were shown, not known */
    var firstTry = R.right + ' of ' + RIGHTS + ' right first time', title;
    if (R.wrong === 0) { R.addSparks(3, 195, geo(R).ansY); banner(R, 'FULL CREW', 'No lag bugs  +3', C.lime, .35, 2); title = 'Every customer helped'; }
    else if (R.right >= PRAISE_AT) { banner(R, 'ALL HELPED', firstTry, C.white, .35, 2); title = 'Every customer helped'; }
    else { banner(R, 'STREET DONE', firstTry, C.white, .35, 2); title = 'End of the street'; }
    s.cheerT = R.t; R.sfx('flag');
    startRun(R, s.cam + 170, null); setPhase(R, 'finish');
    /* minRight: the daily +10 XP needs 5 right first time even on a finished street (engine end option) */
    later(R, 2.2, function () { R.end({ reason: 'done', title: title, delay: .7, minRight: 5 }); });
  }

  /* ---------- update ---------- */
  function update(R, dt) {
    var s = R.s, t = R.t, i;
    if (s.target != null) {                            // camera: accelerate, cruise, brake to stop exactly on the mark
      var rem = s.target - s.cam, vT = Math.min(VMAX, Math.sqrt(Math.max(0, 2 * DEC * rem)));
      s.v = s.v < vT ? Math.min(vT, s.v + ACC * dt) : vT;
      if (!s.braking && vT < VMAX && s.v > 8) { s.braking = true; s.skidT = t; addDust(R, { x: s.cam + LAU_X + 7, n: 3, spread: 5, life: .5, dir: 1 }); }
      s.cam += s.v * dt;
      if (s.cam >= s.target - .02) {
        s.cam = s.target; s.v = 0; s.target = null; s.braking = false;
        var fn = s.onArrive; s.onArrive = null; if (fn) fn();
      }
    }
    if (s.v > 12 && t - s.stepT > .22) { s.stepT = t; addDust(R, { x: s.cam + LAU_X - 7, n: 1, spread: 2, life: .38, dir: -1 }); }
    updateBug(R, dt);
    var nb = s.newBud;                                  // the buddy hops off the block to the front of the crew
    if (nb) {
      if (t >= nb.t0 + .28) s.shift = 1;
      if (t >= nb.t0 + .72) {
        s.crew.unshift({ kind: nb.kind, x: CREW_X, joinT: t, seed: hash(s.crew.length * 3.7 + 1) });
        s.shift = 0; s.newBud = null;
        addDust(R, { x: s.cam + CREW_X, n: 2, spread: 9, life: .4, dir: 0 });
      }
    }
    var gap = crewGap(s);                               // the line packs tighter as it grows, so the crew stays on screen
    for (i = 0; i < s.crew.length; i++) { var m = s.crew[i], tx = CREW_X - (i + s.shift) * gap; m.x += (tx - m.x) * Math.min(1, dt * 7); }
    for (i = 0; i < s.slots.length; i++) { var sl = s.slots[i]; if (sl.next && t >= sl.next.at) { sl.st = sl.next.st; sl.kind = sl.next.kind; sl.t = t; sl.next = null; } }
    for (i = s.coins.length - 1; i >= 0; i--) if (t - s.coins[i].t0 > 1.3) s.coins.splice(i, 1);
    if (s.lands.length > 6) s.lands.splice(0, s.lands.length - 6);
    if (s.mood !== 'happy' && t >= s.moodUntil) s.mood = 'happy';
    if (s.flag && s.flag.hit && s.flag.x - s.cam < -20) s.flag = null;
  }

  /* ---------- poses ---------- */
  function lauPose(R) {
    var s = R.s, t = R.t, a = s.act, u, v;
    var P = { x: LAU_X, y: 0, sx: 1, sy: 1, run: 0, frame: Math.floor(t * 7) % 4, mood: s.mood, look: s.look, alpha: 1 };
    if (s.v > 1) { P.run = 1; P.frame = Math.floor(s.cam / 4) % 4; P.y = P.frame % 2; }
    if (s.braking && s.target != null && s.target - s.cam < 16) { P.sx = 1.08; P.sy = .92; P.frame = 1; P.y = 0; }
    if (a) {
      var d = t - a.t0;
      if (a.k === 'bump') {
        if (d < .07) { P.sx = 1.14; P.sy = .84; P.x = a.x0; }
        else if (d < .37) { u = (d - .07) / .3; P.x = lerp(a.x0, a.xb, E.out(u)); P.y = rise(u, BUMP_H); P.sx = 1 - .14 * (1 - u); P.sy = 1 + .16 * (1 - u); }
        else if (d < .67) {
          v = (d - .37) / .3; P.x = lerp(a.xb, a.xl, v); P.y = BUMP_H * (1 - v * v);
          if (v < .2) { P.sx = 1.12; P.sy = .86; P.y += 24 - Math.round(24 * P.sy); } else P.sy = 1 + .06 * v;
        } else if (d < .77) P.x = a.xl;
        else if (d < 1.2) { u = (d - .77) / .43; P.x = lerp(a.xl, LAU_X, E.inOut(u)); P.y = 5 * Math.sin(Math.PI * u); P.run = 1; P.frame = Math.floor(u * 4) % 4; }
      } else if (a.k === 'stomp') {
        if (d < .07) { P.sx = 1.14; P.sy = .84; }
        else if (d < .52) { u = (d - .07) / .45; P.x = lerp(a.x0, a.xt, u); P.y = arc(u, 0, 13, 30); P.sx = u < .5 ? .9 : 1; P.sy = u < .5 ? 1.12 : 1; }
        else if (d < .92) { v = (d - .52) / .4; P.x = lerp(a.xt, LAU_X, v); P.y = arc(v, 13, 0, 12); if (v < .15) { P.sx = 1.2; P.sy = .8; } }
      } else if (a.k === 'hop') { u = clamp(d / .4); P.y = 40 * u * (1 - u); }
    }
    var hd = t - s.hurtT;
    if (hd >= 0 && hd < .9) { P.x -= 5 * Math.sin(Math.PI * clamp(hd / .35)) * (hd < .35 ? 1 : 0); P.alpha = Math.floor(hd / .08) % 2 ? .35 : 1; P.mood = 'hurt'; }
    var sq = 0; s.lands.forEach(function (l) { sq += jig(t, l, .16); });
    P.sy *= 1 - sq; P.sx *= 1 + sq * .9;
    P.blink = P.mood === 'happy' && ((t + .4) % 2.9) < .1 ? 1 : 0;
    return P;
  }
  function custX(R, cu) {
    var u = R.t - cu.tGo, w = 0, V = 75, A = .2;
    if (u > 0) w = u < A ? .5 * V / A * u * u : .5 * V * A + V * (u - A);
    return cu.stopX + CUST_X - R.s.cam + w;
  }

  /* ---------- drawing ---------- */
  function draw(R, G) {
    var s = R.s, t = R.t, g = geo(R), c = G.ctx, cam = s.cam, gY = g.gY, i;
    G.clear(C.sky);
    c.save(); c.translate(R.shakeX(), 0);

    /* clouds (slowest), skyline, shopfronts, sidewalk, road, lamps */
    CLOUDS.forEach(function (cl, k) {
      var x = ((cl[0] - cam * (.08 + k * .03) - t * 1.5) % 190 + 190) % 190 - 40;
      G.spr(PX.cloud(cl[2]), x, gY - cl[1]);
    });
    G.tiles(skyline(), gY - 138, cam * .3, 1);
    var cs = cam * .8, i0 = Math.floor(cs / SHOP_W) - 1;
    for (i = i0; i < i0 + 5; i++) G.spr(shop(SHOP_SEQ[((i % 12) + 12) % 12]), i * SHOP_W - cs, gY - SHOP_H);
    G.tiles(walkTile(), gY, cam, 1);
    G.tiles(roadTile(false), gY + 16, cam, 1);
    for (var ry = gY + 32; ry < G.H + 1; ry += 16) G.tiles(roadTile(true), ry, cam, 1);
    for (i = Math.floor((cam - 30) / STEP); i <= Math.floor((cam + 150) / STEP); i++) {
      var lx = 84 + i * STEP - cam;
      if (lx > -12 && lx < 142) put(G, lamp(), lx, gY);
    }

    /* checkpoint flag */
    if (s.flag) { var fxs = s.flag.x - cam; if (fxs > -16 && fxs < 140) { G.spr(PX.flag(Math.floor(t * 4) % 2), fxs - 2, gY - 40); shadow(G, fxs + 1, 6, 0, gY); } }

    /* customers: the current one and the one skipping off, with their speech bubble and thank-you heart.
       The bubble is part of the world (drawn before Lau, the crew and the buddy) so Lau's bump into the middle or
       right-hand block passes in front of it instead of vanishing behind it. */
    for (i = Math.max(0, s.cur - 1); i <= s.cur; i++) drawCustomer(R, G, g, s.custs[i]);
    for (i = Math.max(0, s.cur - 1); i <= s.cur; i++) {
      var cu = s.custs[i]; if (!cu) continue;
      var cx = cu.stopX + CUST_X - cam;                 // the bubble and heart stay where the customer stood
      if (cx > -20 && cx < 150) bubble(R, G, g, cu, cx * 3 - 6, g.tipY);
      var hd = t - cu.tHappy - .1;
      if (hd > 0 && hd < .9) G.spr(PX.heart(true), cx - 6, g.tipY / 3 - 36 - hd * 20, { scale: 2, alpha: 1 - p(hd, .6, .9) });
    }

    /* sprites climbing out of a block go behind it (clipped above the block top) */
    var nb = s.newBud, nbs = nb ? budState(R, g, nb) : null, b = s.bug;
    if (nbs && nbs.clip) put(G, budSpr(nb.kind, 0, [0, -1]), nbs.x, gY + budFoot(nb.kind) - nbs.y, { clipY: g.BY });
    if (b && b.clip && t >= b.t0) put(G, PX.bug({ frame: Math.floor(t * 8) }), b.x, gY + 1 - b.y, { clipY: g.BY, flip: true });

    /* dust (world-anchored) */
    s.dust.forEach(function (d) { dust(G, t, d.t0, d.x - cam, gY - 2, d.n, d.spread, d.life, d.dir); });

    /* the crew line behind Lau (back to front) */
    var running = s.v > 5;
    for (i = s.crew.length - 1; i >= 0; i--) {
      var m = s.crew[i], hy = 0, fr = Math.floor(t * 2.5 + m.seed * 4) % 2, ch = t - s.cheerT;
      if (m.x < -16) continue;
      if (running) { var ph = t / .34 + i * .37; hy = 6 * Math.abs(Math.sin(Math.PI * ph)); fr = Math.floor(ph) % 2; }
      if (ch >= 0 && ch < 1.3) hy = Math.max(hy, 8 * Math.abs(Math.sin(Math.PI * (ch / .32 + i * .5))));
      var lk = running ? [.7, 0] : s.phase === 'bug' || s.phase === 'stomp' ? [1, .3] : [.7, -.5];
      var bl = ((t + m.seed * 3) % 3.3) < .1;
      shadow(G, m.x, 16, hy, gY);
      var sq2 = jig(t, m.joinT, .25);
      put(G, budSpr(m.kind, fr, lk, bl), m.x, gY + budFoot(m.kind) - hy, { sx: 1 + sq2 * .9, sy: 1 - sq2 });
    }

    /* the lag bug on the ground */
    if (b && !b.clip && !b.air) drawBug(R, G, g, b);

    /* Lau */
    var L = lauPose(R);
    shadow(G, L.x, 16, L.y, gY);
    put(G, PX.lau({ h: 20, run: L.run, frame: L.frame, look: L.look, mood: L.mood, blink: L.blink }), L.x, gY + 2 - L.y, { sx: L.sx, sy: L.sy, alpha: L.alpha });

    /* blocks (the previous customer's used ones scroll away with the street) */
    for (i = Math.max(0, s.cur - 1); i <= s.cur; i++) drawBlocks(R, G, g, s.custs[i]);
    if (nbs && !nbs.clip) {                             // the buddy sitting on / hopping off the block
      if (nbs.y < 60) shadow(G, nbs.x, 18, nbs.y, gY);
      put(G, budSpr(nb.kind, 0, nbs.look), nbs.x, gY + budFoot(nb.kind) - nbs.y);
    }
    if (b && !b.clip && b.air) put(G, PX.bug({ frame: Math.floor(t * 8) }), b.x, gY + 1 - b.y, { flip: BUG_LAND < b.from });
    drawCoins(R, G, g);
    drawStompFx(R, G, g);
    c.restore();

    /* UI layer: label pills, the answer pill, banners, the progress strip */
    for (i = Math.max(0, s.cur - 1); i <= s.cur; i++) drawPills(R, G, g, s.custs[i]);
    drawAnswer(R, G, g);
    drawStrip(R, G, g);
    drawBanner(R, G, g);
    R.irisY = (gY + 2 - L.y - 12) * 3;
  }

  function drawCustomer(R, G, g, cu) {
    if (!cu || cu.arriveT < 0 && cu.stopX + CUST_X - R.s.cam > 150) return;
    var t = R.t, x = custX(R, cu); if (x < -14 || x > 144) return;
    var happy = t >= cu.tHappy, walking = t >= cu.tGo, turned = t >= cu.tTurn;
    var hop = happy && !walking ? 3 * Math.max(0, Math.sin(Math.PI * clamp((t - cu.tHappy) / .3))) : 0;
    if (walking) hop = 2 * Math.abs(Math.sin(Math.PI * (t - cu.tGo) / .17));
    var shake = t >= cu.sadT && t < cu.sadT + .55 && Math.floor((t - cu.sadT) / .09) % 2 === 1;   // head shake after a wrong block
    var sad = t >= cu.sadT && t < cu.sadUntil;
    if (shake) x += 1;
    shadow(G, x, 14, hop, g.custY - 1);
    put(G, custSpr(cu.v, happy ? 'happy' : sad ? 'sad' : 'meh', happy && !turned), x, g.custY - Math.round(hop), { flip: shake || turned });
  }
  function budState(R, g, nb) {
    var d = R.t - nb.t0, bx = nb.x0 - R.s.cam, top = BLOCK_UP + budFoot(nb.kind);
    if (d < 0) return null;
    if (d < .22) return { x: bx, y: top - 15 * (1 - E.out(d / .22)), clip: true };
    if (d < .28) return { x: bx, y: top, clip: false, look: [0, -1] };
    var u = clamp((d - .28) / .44);
    return { x: lerp(bx, CREW_X, E.out(u)), y: arc(u, top, 0, 10), clip: false, look: [.6, .6] };
  }
  function drawBug(R, G, g, b) {
    var t = R.t, d = t - b.t0, gY = g.gY;
    if (b.st === 'squash') {
      if (d < .45) put(G, PX.bug({ squash: true }), b.x, gY + 1, { sx: d < .07 ? 1.25 : 1, flip: true });
      dust(G, t, b.t0 + .45, b.x, gY - 4, 4, 6, .4, 0);
      return;
    }
    if (b.st === 'hit') {                                // bounces off Lau and puffs away
      var u = clamp(d / .45);
      if (d < .45) put(G, PX.bug({ frame: 1 }), b.hx + 16 * u, gY + 1 - arc(u, 0, 0, 12), { flip: true, alpha: 1 - p(d, .3, .45) });
      dust(G, t, b.t0 + .4, b.hx + 16, gY - 4, 4, 6, .4, 0);
      return;
    }
    shadow(G, b.x, 14, 0, gY);
    put(G, PX.bug({ frame: b.frozen ? 0 : Math.floor(t * 8) }), b.x, gY + 1, { flip: true });
  }
  function drawStompFx(R, G, g) {
    var s = R.s, t = R.t, st = s.stomp; if (!st) return;
    var su = (t - st.t0) / .5; if (su < 0 || su > 1) return;
    var bx = st.x, gy = g.gY;
    [[-1, -.6], [1, -.6], [-.6, -1.2], [.6, -1.2]].forEach(function (v, i) { sparkle(G, t, st.t0 + i * .03, Math.round(bx + v[0] * (8 + su * 12)), Math.round(gy - 10 + v[1] * (5 + su * 9)), i % 2 ? C.gold : C.coral); });
    if (su < .45) {
      var ru = su / .45;
      for (var ri = 0; ri < 8; ri++) {
        var ang = Math.PI + ri / 7 * Math.PI, r0 = 9 + ru * 9;
        for (var q = 0; q < 4; q++) G.rect(Math.round(bx + Math.cos(ang) * (r0 + q) * 1.3), Math.round(gy - 6 + Math.sin(ang) * (r0 + q) * .8), 1, 1, C.navy, 1 - ru);
      }
    }
  }
  function blockSX(R, cu, b) { return cu.stopX + BX[b.k] - R.s.cam; }
  function drawBlocks(R, G, g, cu) {
    if (!cu) return;
    var t = R.t, s = R.s, BY = g.BY;
    cu.blocks.forEach(function (b) {
      var a = p(t, b.popT, b.popT + .3, E.outBackBig); if (a <= 0) return;
      var x = blockSX(R, cu, b); if (x < -14 || x > 144) return;
      var tb = b.bumpT, used = b.state === 'used' && tb != null && t >= tb + .04;
      var lit = b.lit && Math.floor((t - b.litT) / .15) % 2 === 0;
      var dy = tb != null && t >= tb ? -5 * Math.sin(Math.PI * p(t, tb, tb + .2)) : 0;
      var wig = 0;
      if (t - s.nudgeT < .45 && canPick(R, b)) wig = Math.round(jiggle(t, s.nudgeT, 2, 40, 8));
      if (b.lit) {                                       // soft lime halo behind the lit block
        var hg = (.4 + .25 * Math.sin((t - b.litT) * 20)), hs = 1 + .25 * (1 - p(t, b.litT, b.litT + .25, E.out));
        G.ctx.save(); G.ctx.globalAlpha = hg; G.ctx.fillStyle = C.lime;
        PX.roundRect(G.ctx, (x - 13 * hs) * 3, (BY + 9 - 13 * hs) * 3, 26 * hs * 3, 26 * hs * 3, 18); G.ctx.fill(); G.ctx.restore();
        for (var sk = 0; sk < 6; sk++) {
          var per = .9, s0 = b.litT + ((t - b.litT) - ((t - b.litT) % per)) + sk * .15, ang = hash(sk * 2.7 + 1 + Math.floor((t - b.litT) / per)) * Math.PI * 2;
          sparkle(G, t, s0, Math.round(x + Math.cos(ang) * 14), Math.round(BY + 9 + Math.sin(ang) * 13), sk % 2 ? C.white : C.lime);
        }
      }
      put(G, qb(used, lit), x + wig, BY + 18 + dy, { sx: a, sy: a });
      if (tb != null && t >= tb && t < tb + .07) G.rect(x - 8, BY + 1 + dy, 16, 16, C.white, .7);     // bonk flash
      if (tb != null && t >= tb && t < tb + .22) {
        var u = (t - tb) / .22, al = 1 - u;
        [[-1, -1], [0, -1.3], [1, -1]].forEach(function (v) { for (var q = 0; q < 3; q++) G.rect(x + v[0] * (10 + u * 6 + q), BY - 3 + v[1] * (u * 6 + q), 1, 1, C.navy, al); });
      }
      if (t >= b.popT && t < b.popT + .3) for (var q2 = 0; q2 < 4; q2++) sparkle(G, t, b.popT + .02, x + [-12, 12, -10, 10][q2], BY + [2, 4, 15, 14][q2], C.gold);
    });
  }
  function drawCoins(R, G, g) {
    var s = R.s, t = R.t, BY = g.BY;
    s.coins.forEach(function (cn) {
      var x1 = cn.x - s.cam, d = t - cn.t0; if (d < 0) return;
      if (cn.n > 1) {                                    // a spray of coins out of the block
        for (var i = 0; i < cn.n; i++) {
          var vx = (i - 2) * 44 + (hash(i * 3.3) - .5) * 6, vy = -(160 + hash(i * 1.7) * 20 - Math.abs(i - 2) * 14), life = .66 + hash(i * 9.1) * .2;
          var tt = Math.min(d, life), x = x1 + vx * tt, y = BY - 7 + vy * tt + .5 * 330 * tt * tt;
          if (d < life) put(G, coinSpr(Math.floor(d * 18) + i), x, y + 7);
          else sparkle(G, t, cn.t0 + life, Math.round(x), Math.round(y), C.gold);
        }
      } else {                                           // one fix-it coin
        var dd = Math.min(d, .55), yy = BY - 7 - (190 * dd - 210 * dd * dd);
        if (d < .55) put(G, coinSpr(Math.floor(d * 20)), x1, yy + 7);
        else { sparkle(G, t, cn.t0 + .55, Math.round(x1), Math.round(yy), C.gold); sparkle(G, t, cn.t0 + .59, Math.round(x1) - 5, Math.round(yy) - 4, C.navy); sparkle(G, t, cn.t0 + .62, Math.round(x1) + 5, Math.round(yy) + 2, C.gold); }
      }
    });
  }
  /* label pill size for one customer's row: 17 sp unless two neighbours would come within 8 sp of each other
     (Generation next to Gigabyte / Warranty), then 15 sp. max[k] = how far pill k may grow (pulse) before it
     would reach within 4 sp of a neighbour; spare[k] = its gap to the nearest neighbour (caps the nudge wiggle). */
  function pillSpec(G, cu) {
    var c = G.ctx, n = BX.length, lab = [], k;
    cu.blocks.forEach(function (b) { lab[b.k] = b.label; });
    function widths(size, pad) {
      c.save(); c.font = '700 ' + size + 'px Lexend, sans-serif';
      var w = lab.map(function (l) { return Math.ceil(c.measureText(l || '').width) + pad * 2; });
      c.restore(); return w;
    }
    var size = 17, pad = 10, w = widths(size, pad), max = [], spare = [];
    for (k = 0; k < n - 1; k++) if (w[k] / 2 + w[k + 1] / 2 + 8 > (BX[k + 1] - BX[k]) * 3) { size = 15; pad = 8; w = widths(size, pad); break; }
    for (k = 0; k < n; k++) {
      var room = 9, gap = 99;
      if (k > 0) { room = Math.min(room, ((BX[k] - BX[k - 1]) * 3 - w[k - 1] / 2 - 4) / (w[k] / 2)); gap = Math.min(gap, (BX[k] - BX[k - 1]) * 3 - (w[k - 1] + w[k]) / 2); }
      if (k < n - 1) { room = Math.min(room, ((BX[k + 1] - BX[k]) * 3 - w[k + 1] / 2 - 4) / (w[k] / 2)); gap = Math.min(gap, (BX[k + 1] - BX[k]) * 3 - (w[k + 1] + w[k]) / 2); }
      max[k] = Math.max(1, room); spare[k] = gap;
    }
    return { size: size, pad: pad, max: max, spare: spare };
  }
  function drawPills(R, G, g, cu) {
    if (!cu) return;
    var t = R.t, s = R.s, ps = pillSpec(G, cu);
    cu.blocks.forEach(function (b) {
      var a = p(t, b.popT + .08, b.popT + .38, E.outBack); if (a <= 0) return;
      var x = blockSX(R, cu, b); if (x < -40 || x > 170) return;
      var tb = b.bumpT, dy = tb != null && t >= tb ? -5 * Math.sin(Math.PI * p(t, tb, tb + .2)) : 0;
      // the label hops up out of the way while a buddy / the bug climbs out of the block, then settles back
      var lift = tb != null && !b.fixed ? 72 * (E.outBack(p(t, tb, tb + .25)) - E.inOut(p(t, tb + .6, tb + .95))) : 0;
      var used = b.state === 'used' && tb != null && t >= tb;
      var right = b.right && (used || t >= b.hintT), wrong = b.wrong && used;
      var alpha = Math.min(1, a * 1.5) * (1 - p(t, cu.tGo, cu.tGo + .35));
      if (t >= cu.tHappy - .15 && !b.right) alpha *= 1 - .55 * p(t, cu.tHappy - .15, cu.tHappy + .15);
      if (b.fixed) alpha *= 1 - p(t, tb - .02, tb + .1);  // the answer pill takes over
      if (alpha <= 0) return;
      var pulse = 1;
      if (b.right && used && !b.fixed) pulse += .14 * Math.sin(Math.PI * p(t, tb + .3, tb + .6));      // the app says the word
      if (right && !used && !b.lit) pulse += .04 * Math.sin((t - b.hintT) * 6);
      if (b.lit) pulse += .12 * Math.sin(Math.PI * p(t, b.litT, b.litT + .25)) + .05 * Math.sin((t - b.litT) * 14);
      if (lift < 40) pulse = Math.min(pulse, ps.max[b.k]);   // in the row it never grows over a neighbour
      var wig = t - s.nudgeT < .45 && canPick(R, b) ? jiggle(t, s.nudgeT, clamp(ps.spare[b.k] - 3, 2, 6), 40, 8) : 0;
      G.pill(b.label, x * 3 + wig, g.pillY + dy * 3 - lift, { size: ps.size, weight: 700, pad: ps.pad, scale: a * pulse, alpha: alpha,
        bg: right ? C.lime : wrong ? C.coralSoft : C.white, color: wrong ? C.coralSh : C.navy, border: wrong ? C.coral : C.navy, borderW: 3 });
    });
  }
  function drawAnswer(R, G, g) {
    var s = R.s, A = s.ans; if (!A) return;
    var t = R.t, ba = p(t, A.t0, A.t0 + .3, E.outBack), bo = p(t, A.t0 + 1.9, A.t0 + 2.15, E.in);
    if (ba <= 0) return; if (bo >= 1) { s.ans = null; return; }
    var c = G.ctx; c.save(); c.font = '800 17px Lexend, sans-serif'; var w = c.measureText(A.text).width + 30; c.restore();
    var cx = clamp(A.x, 10 + w / 2, 380 - w / 2);
    G.pill(A.text, cx, g.ansY, { size: 17, weight: 800, pad: 15, bg: C.lime, color: C.navy, border: C.navy, borderW: 3, scale: ba * (1 - bo * .4), alpha: 1 - bo });
  }

  /* the speech bubble: one need, or customer 8's two needs with a tick each */
  function bubbleLayout(G, g, cu) {
    var two = cu.needs.length > 1, avail = (g.tipY - 11) - ((g.BY + 18) * 3 + 8);
    var tries = two ? [[16, 290], [15, 300], [15, 320]] : [[17, 210], [17, 250], [16, 270]], lay = null;
    for (var i = 0; i < tries.length; i++) {
      var size = tries[i][0], maxW = tries[i][1], lh = Math.round(size * 1.24), n = 0, w = 0;
      var rows = cu.needs.map(function (txt) { var r = G.wrap(txt, size, maxW, 700); n += r.lines.length; w = Math.max(w, r.w); return r; });
      var mk = two ? 26 : 0, h = n * lh + 18 + (two ? 6 * (rows.length - 1) : 0);
      lay = { rows: rows, size: size, lh: lh, w: Math.ceil(w) + 30 + mk, h: h, mk: mk };
      if (h <= avail) break;
    }
    return lay;
  }
  function bubble(R, G, g, cu, tipX, tipY) {
    var t = R.t, a = p(t, cu.tSay, cu.tSay + .35, E.outBack), o = p(t, cu.tGo, cu.tGo + .25, E.in);
    if (a <= 0 || o >= 1) return;
    var c = G.ctx, L = bubbleLayout(G, g, cu), w = L.w, h = L.h, r = 16;
    var x = Math.max(6, Math.min(384 - w, tipX + 30 - w)), y = tipY - 11 - h;
    var sc = a * (1 - o * .5);
    c.save();
    c.translate(tipX, tipY); c.scale(sc, sc); c.translate(-tipX, -tipY);
    c.globalAlpha = clamp(Math.min(1, a * 2) * (1 - o));
    function path(oy) {
      var bx0 = tipX - 12, bx1 = tipX + 2;
      c.beginPath();
      c.moveTo(x + r, y + oy); c.lineTo(x + w - r, y + oy); c.arcTo(x + w, y + oy, x + w, y + r + oy, r);
      c.lineTo(x + w, y + h - r + oy); c.arcTo(x + w, y + h + oy, x + w - r, y + h + oy, r);
      c.lineTo(bx1, y + h + oy); c.lineTo(tipX, tipY + oy); c.lineTo(bx0, y + h + oy);
      c.lineTo(x + r, y + h + oy); c.arcTo(x, y + h + oy, x, y + h - r + oy, r);
      c.lineTo(x, y + r + oy); c.arcTo(x, y + oy, x + r, y + oy, r); c.closePath();
    }
    path(5); c.fillStyle = 'rgba(11,18,64,.22)'; c.fill();
    path(0); c.fillStyle = C.white; c.fill(); c.lineWidth = 3; c.lineJoin = 'round'; c.strokeStyle = C.navy; c.stroke();
    var ly = y + 9;
    L.rows.forEach(function (row, k) {
      var tx = L.mk ? x + 15 + L.mk : x + w / 2;
      if (L.mk) {                                        // a tick circle per need (customer 8)
        var done = cu.rowT[k] != null && t >= cu.rowT[k], cy = ly + L.lh * row.lines.length / 2, cxm = x + 15 + 9;
        var pop = done ? 1 + .35 * (1 - p(t, cu.rowT[k], cu.rowT[k] + .25, E.outBack)) : 1;
        c.save(); c.translate(cxm, cy); c.scale(pop, pop);
        c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fillStyle = done ? C.lime : C.white; c.fill(); c.lineWidth = 2.5; c.strokeStyle = C.navy; c.stroke();
        if (done) { c.beginPath(); c.moveTo(-4, 0); c.lineTo(-1, 3.5); c.lineTo(4.5, -3.5); c.lineWidth = 2.6; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
        c.restore();
      }
      row.lines.forEach(function (ln, j) { G.text(ln, tx, ly + L.lh * (j + .5) + 1, { size: L.size, weight: 700, color: C.navy, align: L.mk ? 'left' : 'center' }); });
      ly += L.lh * row.lines.length + 6;
    });
    c.restore();
  }

  /* the progress strip under the HUD: one mini block per answer (customer 8 has two); right = its buddy, fixed = a used block */
  function drawStrip(R, G, g) {
    var s = R.s, t = R.t, y = g.stripY, n = N + 1, gap = 38, x0 = 195 - (n - 1) / 2 * gap - 4, c = G.ctx;
    G.box(x0 - 24, y - 21, (n - 1) * gap + 8 + 48, 42, { bg: 'rgba(255,255,255,.62)', r: 21, shadow: false });
    for (var i = 0; i < n; i++) {
      var sl = s.slots[i], cx = x0 + i * gap + (i >= N - 1 ? 8 : 0), pop = 1 + .45 * (1 - p(t, sl.t, sl.t + .3, E.outBack));
      if (i === N - 1) { c.save(); c.globalAlpha = .35; c.fillStyle = C.navy; c.fillRect(cx - 24, y - 11, 2, 22); c.restore(); }
      if (sl.st === 'ok' || sl.st === 'fix') {
        c.save(); c.translate(cx, y); c.scale(pop, pop);
        c.beginPath(); c.arc(0, 0, 16, 0, Math.PI * 2); c.fillStyle = sl.st === 'ok' ? C.lime : C.coralSoft; c.fill();
        c.lineWidth = 2.5; c.strokeStyle = sl.st === 'ok' ? C.navy : C.coral; c.stroke(); c.restore();
        if (sl.st === 'ok') G.sprS(budSpr(sl.kind, 0, [0, 0]), cx, y, .5 * pop);
        else G.sprS(qb(true, false), cx, y, .5 * pop);
      } else if (sl.st === 'now') G.sprS(qb(false, false), cx, y + Math.round(Math.sin(t * 5 + i) * 2), .5 * pop);
      else G.sprS(qb(false, false), cx, y, .5, .3);
    }
  }
  function drawBanner(R, G, g) {
    /* centred between the progress strip and the hint row, but never closer than 52 sp under the strip
       (on a 360x640 phone the centre would put the big text on the strip; 390x844 is unchanged) */
    var s = R.s, t = R.t, by = Math.max(g.stripY + 52, Math.round((g.stripY + 22 + g.hintY - 16) / 2) - 30), i;
    if (s.banner) {
      var bn = s.banner, bi = p(t, bn.t0, bn.t0 + .4, E.outBackBig), bo = p(t, bn.t0 + bn.dur - .3, bn.t0 + bn.dur, E.in);
      if (bi > 0 && bo < 1) {
        G.popText(bn.big, 195, by, bi * (1 + .12 * bo), 1 - bo, bn.big.length > 10 ? 36 : 42, bn.fill);
        var pi = p(t, bn.t0 + .15, bn.t0 + .45, E.outBack);
        if (bn.small) G.pill(bn.small, 195, by + 58, { size: 17, bg: C.white, color: C.navy, border: C.navy, borderW: 3, pad: 16, alpha: Math.min(1, pi * 1.5) * (1 - bo), scale: .6 + .4 * pi });
      }
    }
    if (s.note) {
      var nd = t - s.note.t0, na = p(nd, 0, .2) * (1 - p(nd, s.note.dur - .3, s.note.dur));
      if (na > 0) G.pill(s.note.text, 195, by + 20, { size: 17, bg: C.navy, color: C.white, pad: 16, alpha: na, scale: .85 + .15 * p(nd, 0, .25, E.outBack) });
    }
  }

  /* drawn after the HUD and JUMP button: hints and the opening iris */
  function drawTop(R, G) {
    var s = R.s, t = R.t, g = geo(R), j = R.layout.jump, c = G.ctx, hint = null, cu = s.custs[s.cur];
    if (s.phase === 'bug' || (s.phase === 'stomp' && s.bug && s.bug.st === 'crawl')) {
      hint = HINT_STOMP;
      var ph = (t % 1);
      c.save(); c.globalAlpha = .85 * (1 - ph); c.strokeStyle = C.white; c.lineWidth = 5; c.beginPath(); c.arc(j.x, j.y, j.r + 6 + ph * 22, 0, Math.PI * 2); c.stroke(); c.restore();
    } else if (s.phase === 'fix' && !s.act) hint = HINT_FIX;
    else if (s.phase === 'choose' && !s.act) {
      if (cu && cu.rights.length > 1 && !cu.done.length && t - cu.arriveT < 6) hint = HINT_TWO;
      else if ((!s.tapped && s.cur === 0) || t - s.idleT > 8 || t - s.nudgeT < 1.6) hint = HINT_PICK;
    }
    if (hint) {
      var ha = p(t, Math.max(s.idleT, cu ? cu.arriveT + 1.4 : 0), Math.max(s.idleT, cu ? cu.arriveT + 1.4 : 0) + .25);
      if (s.phase === 'bug' || s.phase === 'stomp') ha = 1;
      if (t - s.nudgeT < 1.6) ha = 1;
      G.pill(hint, 195, g.hintY, { size: 16, bg: C.navy, color: C.white, pad: 14, alpha: ha, scale: .9 + .1 * ha });
    }
    var io = p(t, 0, .6, E.inOut);
    if (io < 1) {
      var lx = LAU_X * 3, ly = R.irisY || G.SH - 140, Rn = Math.max(Math.hypot(lx, ly), Math.hypot(390 - lx, ly), Math.hypot(lx, G.SH - ly), Math.hypot(390 - lx, G.SH - ly));
      G.iris(io * Rn / Math.hypot(390, G.SH), lx, ly);
    }
  }

  /* ---------- test hooks ---------- */
  function info(R) {
    var s = R.s, g = geo(R), cu = s.custs[s.cur], choices = [];
    if (cu && cu.arriveT >= 0) {
      var top = g.pillY - 34, bot = (g.BY + 18) * 3 + 30;
      cu.blocks.forEach(function (b) {
        var x = blockSX(R, cu, b);
        choices.push({ label: b.label, slug: b.slug, right: b.right, state: b.state, lit: b.lit, pickable: canPick(R, b),
          x: (x - COL) * 3, y: top, w: COL * 6, h: bot - top });
      });
    }
    return {
      customer: s.cur + 1, of: N, needs: cu ? cu.needs : null, rights: cu ? cu.rights : null, done: cu ? cu.done.slice() : null,
      crew: s.crew.map(function (m) { return m.kind; }), bug: s.bug ? { st: s.bug.st, x: +s.bug.x.toFixed(1) } : null,
      checkpoint: s.flag ? (s.flag.hit ? 'hit' : 'ahead') : null, slots: s.slots.map(function (x) { return x.st; }),
      choices: choices
    };
  }

  ARC.registerGame({
    id: 'g19', name: 'Block Bump', sub: 'Block bumper', lives: 3, scoreLabel: 'sparks',
    rules: ['A customer stops Lau with a need', 'Tap the block with the spec that answers it', 'Wrong block: a lag bug. Tap JUMP to stomp it'],
    controls: { jump: true },
    jumpAlpha: function (R) { var ph = R.s.phase; return ph === 'bug' || ph === 'stomp' ? 1 : .5; },
    icon: function () { return qb(false, false); }, iconScale: 3.6,
    init: init, update: update, draw: draw, drawTop: drawTop, tap: tap, jump: jump, key: key, info: info,
    finish: function (R) { R.end({ reason: 'done', delay: .2 }); }
  });
})();
