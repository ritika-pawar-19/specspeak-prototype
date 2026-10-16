/* Play & Learn pixel kit (window.PX) — ported from the approved explainer videos (../arcade-video/kit.js and
   ../classic-video/icons.js) and extended with a runtime canvas that fits any phone.

   Units
     game px (gx, gy)   the pixel-art grid. The world is always 130 game px wide; its height G.H varies by phone
                        (about 260-300). Lay ground and HUD out from the top/bottom edges, never a fixed 281.
     screen px (sp)     3 sp = 1 game px, so the screen is always 390 sp wide and G.SH sp tall. Crisp text, cards and
                        pills are drawn in sp (the same numbers the videos used on their 390x844 phone).
   The canvas backing store is CSS size x devicePixelRatio (cap 2); sprites are scaled nearest-neighbour.

   API
     PX.game(el) -> G            canvas filling el. G.resize() after the container changes size.
       G.W, G.H                  world size in game px;  G.SW (390), G.SH  screen size in sp
       G.top, G.bot              safe-area insets (notch / home bar) in sp
       G.clear(col)              resets the transform and fills the screen
       G.spr(s, gx, gy, {flip, alpha, scale})      sprite at game px (top-left)
       G.sprS(s, sx, sy, scale, alpha)             sprite centred on a sp point (scale 1 = 3 sp per sprite px)
       G.drawSq(s, gcx, gbot, squash, alpha)       sprite anchored bottom-centre with squash (+) / stretch (-)
       G.rect(gx, gy, gw, gh, col, alpha)          block in game px
       G.text(str, sx, sy, {size, weight, color, align, font, base, stroke, strokeW, alpha})
       G.pill(str, cx, cy, {...}) -> box    G.box(sx, sy, w, h, {...})    G.dim(alpha)
       G.tiles(tile, gy, camX, rows)        G.wrap(str, size, maxW, weight) -> {lines, w}
       G.sign(str, cx, bot, {state:'right'|'wrong', s, alpha}) -> box   speech-card with a tail (the meaning sign)
       G.badge(cx, cy, r, ok, scale, alpha)      round check / cross stamp
       G.popText(str, sx, sy, scale, alpha, size, fill)
       G.wordCard({a, word, say, hi, top, speak, speaker, meaning, label})  the word card (speak = 0..1 speaker pulse)
       G.iris(open, cx, cy)                 G.puff(gx, gy, r, alpha)
       G.toClient(sx, sy) -> {x, y}         sp -> CSS px in the viewport (for tests)
     Sprites (cached offscreen canvases): PX.lau, rami, chip, pixi, bolo, customer, bug, king, ground, soil, brick, stone,
       qblock, coin, mushroom, cloud, heart, ember, ring, fireball, cage, flag, torch, disc(r, col), and menu icons
       PX.icon.stack / plank / invader(frame). PX.make, grid, outline build new ones (pass a key to cache).
*/
(function () {
  'use strict';
  var B = 3, GW = 130;
  var C = {
    navy: '#0B1240', navy2: '#232D86', navy3: '#33409F', ink2: '#4B5283',
    lime: '#B5E61D', limeDk: '#83B81A', limeSh: '#97C70F', limeSoft: '#F1FBD3',
    peri: '#8C9EFF', periSh: '#6E81EE', periSoft: '#E9EDFF', periDk: '#5163D6',
    mint: '#4EDEA2', mintSh: '#2FC184', mintSoft: '#DDF8EC',
    coral: '#FF6B4A', coralSh: '#E04E2E', coralSoft: '#FFE7DF',
    gold: '#FFC83D', goldSh: '#EFA51A', goldDk: '#B9740A',
    cream: '#FFF8E7', paper: '#FFFDF6', lilac: '#D4C8F7', lilacSh: '#B3A3EE', pink: '#FF8FC7', peach: '#FFB59A',
    white: '#FFFFFF', skin: '#E2643C', skinSh: '#C94F2A', hair: '#16161A',
    fl1: '#FFE3A3', fl2: '#FFD27A', fl3: '#FF9442', fl4: '#EE5A1E', fl5: '#B83E0E', flMouth: '#7A2608',
    sky: '#DDE4FF', sky2: '#C9D3FF', soil: '#E9C88F', soilDk: '#C99B57', stone: '#3A4690', stoneDk: '#28316F', stoneLt: '#4C59A8',
    grey: '#9AA0B8', greyDk: '#6B7090', bars: '#5B6080'
  };
  function clamp(v, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return Math.min(b, Math.max(a, v)); }

  /* ---------- sprite canvases (bounded cache: cleared when it grows past CAP, sprites rebuild lazily) ---------- */
  var cache = {}, count = 0, CAP = 1200;
  function put(key, c) { if (!cache[key]) { if (++count > CAP) { cache = {}; count = 1; } } cache[key] = c; return c; }
  function make(w, h, draw, key) {
    if (key && cache[key]) return cache[key];
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    var px = function (gx, gy, col) { if (col) { x.fillStyle = col; x.fillRect(gx, gy, 1, 1); } };
    draw(px, x, w, h);
    return key ? put(key, c) : c;
  }
  /* parse a string grid with a char -> colour map ('.' or ' ' = clear) */
  function grid(rows, map, key) {
    if (key && cache[key]) return cache[key];
    var h = rows.length, w = 0; rows.forEach(function (r) { w = Math.max(w, r.length); });
    return make(w, h, function (px) {
      rows.forEach(function (r, y) { for (var i = 0; i < r.length; i++) { var ch = r[i]; if (ch !== '.' && ch !== ' ') px(i, y, map[ch]); } });
    }, key);
  }
  /* outline every opaque pixel's empty 4-neighbours with colour col (1 px) */
  function outline(src, col, key) {
    if (key && cache[key]) return cache[key];
    var w = src.width + 2, h = src.height + 2;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    var d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
    var on = function (i, j) { return i >= 0 && j >= 0 && i < src.width && j < src.height && d[(j * src.width + i) * 4 + 3] > 0; };
    x.fillStyle = col;
    for (var j = -1; j <= src.height; j++) for (var i = -1; i <= src.width; i++) {
      if (on(i, j)) continue;
      if (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1)) x.fillRect(i + 1, j + 1, 1, 1);
    }
    x.drawImage(src, 1, 1);
    return key ? put(key, c) : c;
  }
  function cached(key, build) { return cache[key] || put(key, build()); }
  /* a googly eye centred at (cx, cy): white disc radius r, navy pupil shifted by look [-1..1, -1..1].
     r <= 2 uses hand-made shapes (a 2x2 or 4x4 white with a 1x1 or 2x2 pupil): discs that small turn into crosshairs. */
  function eye(px, cx, cy, r, pr, look, blink, pupil) {
    look = look || [0, 0];
    var lx = Math.max(-1, Math.min(1, look[0])), ly = Math.max(-1, Math.min(1, look[1]));
    if (blink >= 1) { for (var i = -r; i < r; i++) px(Math.round(cx + i), Math.round(cy), C.navy); return; }
    if (r <= 2) {
      var n = 2 * r, x0 = Math.round(cx - r), y0 = Math.round(cy - r), j, k;
      for (j = 0; j < n; j++) for (k = 0; k < n; k++) {
        if (r === 2 && (j === 0 || j === n - 1) && (k === 0 || k === n - 1)) continue;
        px(x0 + k, y0 + j, C.white);
      }
      var p = r, ox = x0 + Math.round((n - p) / 2 + lx * (n - p) / 2), oy = y0 + Math.round((n - p) / 2 + ly * (n - p) / 2);
      ox = Math.max(x0, Math.min(x0 + n - p, ox)); oy = Math.max(y0, Math.min(y0 + n - p, oy));
      for (j = 0; j < p; j++) for (k = 0; k < p; k++) px(ox + k, oy + j, pupil || C.navy);
      return;
    }
    pr = Math.max(2, pr);
    for (var y = -r - 1; y <= r + 1; y++) for (var x = -r - 1; x <= r + 1; x++) {
      if (x * x + y * y <= r * r + r * .6) px(Math.round(cx + x), Math.round(cy + y), C.white);
    }
    var ox2 = cx + lx * (r - pr), oy2 = cy + ly * (r - pr) + .4;
    for (y = -pr; y <= pr; y++) for (x = -pr; x <= pr; x++) {
      if (x * x + y * y <= pr * pr + pr * .5) px(Math.round(ox2 + x), Math.round(oy2 + y), pupil || C.navy);
    }
    px(Math.round(ox2 - pr * .45), Math.round(oy2 - pr * .55), C.white);
  }
  function q2(v) { return Math.round(clamp(v, -1, 1) * 2) / 2; }   // look values snap to halves: keeps the cache small

  /* ---------- Lau, the flame pet ----------
     h: body height in game px (small 18, super 27). form 'fire' swaps to a hotter palette with a lime tip.
     frame: integer for the flicker / run cycle; look: [-1..1, -1..1]; mood 'happy' | 'hurt' | 'joy' */
  function lau(o) {
    o = o || {};
    var h = o.h || 18, form = o.form || 'small', fr = (o.frame || 0) % 4, lk = o.look || [0.5, 0], blink = o.blink ? 1 : 0, mood = o.mood || 'happy';
    var look = [q2(lk[0]), q2(lk[1])];
    var key = 'lau|' + h + '|' + form + '|' + fr + '|' + look[0] + '|' + look[1] + '|' + blink + '|' + mood + '|' + (o.run ? 1 : 0);
    if (cache[key]) return cache[key];
    var w = Math.round(h * 0.92), H = h + 2;
    var pal = form === 'fire' ? [C.white, C.fl1, C.gold, C.fl3, C.coralSh] : [C.fl1, C.fl2, C.fl3, C.fl4, C.fl5];
    var src = make(w, H, function (px) {
      var cx = w / 2, cy = h * 0.66, R = w * 0.45;
      var tipx = cx + w * (0.10 + (fr === 1 ? 0.04 : fr === 3 ? -0.03 : 0));
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var u = x + .5, v = y + .5, inside = false;
        var dx = u - cx, dy = v - cy;
        if (dx * dx + dy * dy * 1.08 <= R * R) inside = true;
        if (!inside && v < cy) {
          var k = (cy - v) / (cy - 0.5);
          var mid = cx + (tipx - cx) * Math.pow(k, 1.6);
          var half = R * Math.pow(1 - k, 1.25) * (1 + 0.18 * Math.sin(k * Math.PI));
          if (Math.abs(u - mid) <= half) inside = true;
        }
        if (!inside) continue;
        var sh = (u - cx) / R * 0.55 + (v - cy) / R * 0.5;
        var core = Math.hypot(u - cx * 0.96, v - cy * 1.04) / R;
        var col = sh < -0.55 ? pal[0] : sh < -0.15 ? pal[1] : sh < 0.42 ? pal[2] : pal[3];
        if (core < 0.32 && sh < 0.3) col = pal[1];
        if (form === 'fire' && v < h * 0.24) col = (y % 2 ? C.lime : C.limeSh);
        px(x, y, col);
      }
      var fy = h, step = o.run ? (fr % 2) : 0;
      var fx1 = Math.round(cx - w * 0.26) - step, fx2 = Math.round(cx + w * 0.10) + step;
      var fw = Math.max(2, Math.round(w * 0.18));
      for (var i = 0; i < fw; i++) { px(fx1 + i, fy - 1 - (o.run && fr % 2 ? 1 : 0), pal[4]); px(fx1 + i, fy - (o.run && fr % 2 ? 1 : 0), pal[4]);
        px(fx2 + i, fy - 1 - (o.run && fr % 2 ? 0 : 1) * (o.run ? 1 : 0), pal[4]); px(fx2 + i, fy - (o.run && fr % 2 ? 0 : 1) * (o.run ? 1 : 0), pal[4]); }
      var er = Math.max(2, Math.round(h * 0.13)), pr = Math.max(1, Math.round(er * 0.55));
      var ey = Math.round(cy - h * 0.02), ex1 = Math.round(cx - w * 0.2), ex2 = Math.round(cx + w * 0.2);
      if (mood === 'hurt') {
        for (var d = 0; d <= er; d++) { px(ex1 - er + d, ey - er + d, C.navy); px(ex1 - er + d, ey + er - d, C.navy); px(ex2 + er - d, ey - er + d, C.navy); px(ex2 + er - d, ey + er - d, C.navy); }
      } else {
        eye(px, ex1, ey, er, pr, look, blink);
        eye(px, ex2, ey, er, pr, look, blink);
      }
      if (h >= 24) {
        for (var b = -er; b <= er - 1; b++) { px(ex1 + b, ey - er - 2 - (b > 0 ? 1 : 0) * (mood === 'joy' ? 1 : 0), pal[4]); px(ex2 + b, ey - er - 2 - (b < 0 ? 1 : 0) * (mood === 'joy' ? 1 : 0), pal[4]); }
      }
      var my = Math.round(cy + h * 0.2), mx = Math.round(cx);
      if (mood === 'joy') { for (var m = -2; m <= 2; m++) px(mx + m, my, C.flMouth); for (m = -1; m <= 1; m++) px(mx + m, my + 1, C.flMouth); px(mx, my + 1, C.pink); }
      else if (mood === 'hurt') { px(mx - 1, my + 1, C.flMouth); px(mx, my, C.flMouth); px(mx + 1, my + 1, C.flMouth); }
      else { px(mx - 1, my, C.flMouth); px(mx, my + 1, C.flMouth); px(mx + 1, my, C.flMouth); }
      px(ex1 - er, my - 1, C.pink); px(ex2 + er, my - 1, C.pink);
    });
    return outline(src, form === 'fire' ? C.coralSh : C.fl5, key);
  }

  /* ---------- the crew ---------- */
  function rami(o) {
    o = o || {}; var fr = (o.frame || 0) % 2, lk = o.look || [0.5, 0], look = [q2(lk[0]), q2(lk[1])];
    var key = 'rami|' + fr + '|' + look.join(',') + '|' + (o.blink ? 1 : 0);
    if (cache[key]) return cache[key];
    var w = 24, h = 13;
    var src = make(w, h, function (px) {
      for (var y = 0; y < 10; y++) for (var x = 0; x < w; x++) px(x, y, y < 2 ? C.periSoft : y > 7 ? C.periSh : C.peri);
      for (var c = 0; c < 4; c++) for (y = 3; y < 8; y++) for (x = 0; x < 3; x++) { if (c === 1 || c === 2) continue; px(2 + c * 6 + x, y, C.navy2); }
      for (x = 1; x < w - 1; x += 2) { px(x, 10, C.gold); px(x, 11, C.goldSh); }
      px(11, 10, null);
      eye(px, 9, 5, 2, 1, look, o.blink); eye(px, 15, 5, 2, 1, look, o.blink);
      px(11, 8, C.navy); px(12, 9 - fr, C.navy); px(13, 8, C.navy);
    });
    return outline(src, C.navy, key);
  }
  function chip(o) {
    o = o || {}; var lk = o.look || [0.5, 0], look = [q2(lk[0]), q2(lk[1])];
    var key = 'chip|' + look.join(',') + '|' + (o.blink ? 1 : 0);
    if (cache[key]) return cache[key];
    var s = 16;
    var src = make(s + 4, s + 4, function (px) {
      for (var i = 3; i < s + 1; i += 3) { px(i, 0, C.gold); px(i, 1, C.gold); px(i, s + 2, C.gold); px(i, s + 3, C.gold); px(0, i, C.gold); px(1, i, C.gold); px(s + 2, i, C.gold); px(s + 3, i, C.gold); }
      for (var y = 2; y < s + 2; y++) for (var x = 2; x < s + 2; x++) px(x, y, (x === 2 || y === 2) ? C.navy3 : C.navy2);
      eye(px, 7, 9, 3, 1, look, o.blink); eye(px, 14, 9, 3, 1, look, o.blink);
      px(9, 14, C.lime); px(10, 15, C.lime); px(11, 15, C.lime); px(12, 14, C.lime);
    });
    return outline(src, C.navy, key);
  }
  function pixi(o) {
    o = o || {}; var lk = o.look || [0.5, 0], look = [q2(lk[0]), q2(lk[1])];
    var key = 'pixi|' + look.join(',');
    if (cache[key]) return cache[key];
    var src = make(20, 18, function (px) {
      for (var y = 0; y < 13; y++) for (var x = 0; x < 20; x++) px(x, y, (y === 0 || x === 0 || x === 19 || y === 12) ? C.mintSh : C.navy);
      for (y = 2; y < 11; y++) for (x = 2; x < 18; x++) px(x, y, C.navy2);
      eye(px, 7, 6, 2, 1, look); eye(px, 13, 6, 2, 1, look);
      px(9, 9, C.lime); px(10, 10, C.lime); px(11, 9, C.lime);
      for (y = 13; y < 16; y++) for (x = 8; x < 12; x++) px(x, y, C.mintSh);
      for (x = 4; x < 16; x++) { px(x, 16, C.mint); px(x, 17, C.mintSh); }
    });
    return outline(src, C.navy, key);
  }
  function bolo(o) {
    o = o || {}; var lk = o.look || [0, 0], look = [q2(lk[0]), q2(lk[1])];
    var key = 'bolo|' + look.join(',') + '|' + (o.ear ? 1 : 0);
    if (cache[key]) return cache[key];
    var src = make(22, 20, function (px) {
      for (var y = 0; y < 16; y++) for (var x = 0; x < 22; x++) {
        var dx = (x + .5 - 11) / 11, dy = (y + .5 - 8) / 8;
        if (dx * dx + dy * dy <= 1) px(x, y, dy < -0.5 ? '#E4DBFA' : dx > 0.55 ? C.lilacSh : C.lilac);
      }
      for (y = 14; y < 20; y++) for (var x2 = 3; x2 < 3 + (20 - y); x2++) if (x2 < 8 - (y - 14)) px(x2, y, C.lilac);
      eye(px, 7, 7, 3, 2, look); eye(px, 14, 7, 3, 2, look);
      px(10, 12, C.navy); px(11, 12, C.navy);
      if (o.ear) { for (y = 4; y < 11; y++) { px(21, y, C.navy); } px(20, 4, C.navy); px(20, 10, C.navy); }
    });
    return outline(src, C.navy, key);
  }

  /* ---------- people and enemies ---------- */
  function customer(o) {
    o = o || {}; var mood = o.mood || 'meh', fr = (o.frame || 0) % 2;
    var key = 'cust|' + mood + '|' + fr + '|' + (o.phone ? 1 : 0) + '|' + (o.thumb ? 1 : 0);
    if (cache[key]) return cache[key];
    var src = make(18, 34, function (px) {
      var y, x;
      for (y = 1; y < 13; y++) for (x = 3; x < 15; x++) { var dx = (x + .5 - 9) / 6, dy = (y + .5 - 7) / 6; if (dx * dx + dy * dy <= 1) px(x, y, C.skin); }
      for (y = 0; y < 5; y++) for (x = 3; x < 15; x++) { var dx2 = (x + .5 - 9) / 6.4, dy2 = (y + .5 - 5) / 5; if (dx2 * dx2 + dy2 * dy2 <= 1) px(x, y, C.hair); }
      var look = mood === 'phone' ? [0, 1] : [-0.6, 0];
      eye(px, 7, 7, 2, 1, look); eye(px, 11, 7, 2, 1, look);
      for (x = 5; x < 9; x++) px(x, 4, C.hair); for (x = 10; x < 14; x++) px(x, 4, C.hair);
      if (mood === 'happy') { px(8, 10, C.white); px(9, 10, C.white); px(10, 10, C.white); px(7, 9, C.hair); px(11, 9, C.hair); }
      else { for (x = 8; x < 11; x++) px(x, 10, C.hair); }
      for (y = 13; y < 26; y++) for (x = 2; x < 16; x++) px(x, y, x < 4 || x > 13 ? C.periSh : C.peri);
      for (y = 13; y < 16; y++) { px(8, y, C.white); px(9, y, C.white); }
      for (y = 26; y < 33; y++) { for (x = 4; x < 8; x++) px(x, y, C.navy2); for (x = 10; x < 14; x++) px(x, y, C.navy2); }
      for (x = 3; x < 8; x++) px(x, 33, C.navy); for (x = 10; x < 15; x++) px(x, 33, C.navy);
      if (o.phone) { for (y = 17; y < 23; y++) for (x = 12; x < 16; x++) px(x, y, y === 17 || y === 22 ? C.navy : C.hair); px(13, 19, C.peri); }
      if (o.thumb) { for (y = 10; y < 16; y++) px(17, y, C.skin); for (x = 15; x < 18; x++) for (y = 14; y < 17; y++) px(x, y, C.skin); px(17, 9, C.skinSh); }
    });
    return outline(src, C.navy, key);
  }
  function bug(o) {
    o = o || {}; var fr = (o.frame || 0) % 2, squash = !!o.squash;
    var key = 'bug|' + fr + '|' + squash;
    if (cache[key]) return cache[key];
    var src = make(16, squash ? 6 : 12, function (px) {
      var H = squash ? 6 : 12, y, x;
      for (y = 0; y < H - 2; y++) for (x = 1; x < 15; x++) { var dx = (x + .5 - 8) / 7, dy = (y + .5 - (H - 2) * .6) / ((H - 2) * .62); if (dx * dx + dy * dy <= 1) px(x, y, dy < -0.3 ? C.grey : C.greyDk); }
      if (!squash) { var dots = [[5, 2], [8, 1], [11, 2]]; dots.forEach(function (d, i) { px(d[0], d[1], i === fr + (fr ? 1 : 0) ? C.white : C.lime); }); }
      if (!squash) { eye(px, 6, 6, 2, 1, [0.5, 0.2]); eye(px, 10, 6, 2, 1, [0.5, 0.2]); px(4, 3, C.navy); px(5, 4, C.navy); px(12, 3, C.navy); px(11, 4, C.navy); }
      else { for (x = 4; x < 12; x++) px(x, 2, C.navy); }
      var lg = fr ? [3, 6, 10, 13] : [2, 5, 11, 14]; lg.forEach(function (lx) { px(lx, H - 2, C.navy); px(lx, H - 1, C.navy); });
    });
    return outline(src, C.navy, key);
  }
  function king(o) {
    o = o || {}; var fr = (o.frame || 0) % 8, hurt = !!o.hurt;
    var key = 'king|' + fr + '|' + hurt;
    if (cache[key]) return cache[key];
    var w = 46, h = 50;
    var src = make(w, h, function (px) {
      var y, x;
      for (y = 14; y < 44; y++) for (x = 2; x < 44; x++) { var dx = (x + .5 - 23) / 21, dy = (y + .5 - 30) / 15; if (dx * dx + dy * dy <= 1) px(x, y, hurt ? C.white : dy < -0.45 ? C.grey : dx > 0.6 ? '#585D78' : C.greyDk); }
      for (y = 30; y < 42; y++) for (x = 13; x < 33; x++) { var dx2 = (x + .5 - 23) / 10, dy2 = (y + .5 - 36) / 6; if (dx2 * dx2 + dy2 * dy2 <= 1) px(x, y, hurt ? C.white : C.coralSoft); }
      for (var i = 0; i < 8; i++) {
        var a = i / 8 * Math.PI * 2 - Math.PI / 2, cx = 23 + Math.cos(a) * 8, cy = 8 + Math.sin(a) * 6.5;
        var on = i === fr, col = on ? C.white : (i === (fr + 7) % 8 ? C.lime : C.limeDk);
        px(Math.round(cx), Math.round(cy), col); px(Math.round(cx) + 1, Math.round(cy), col); px(Math.round(cx), Math.round(cy) + 1, col); px(Math.round(cx) + 1, Math.round(cy) + 1, col);
      }
      for (x = 15; x < 32; x++) { px(x, 15, C.gold); px(x, 16, C.goldSh); }
      eye(px, 16, 25, 4, 2, [0.6, 0.3]); eye(px, 30, 25, 4, 2, [0.6, 0.3]);
      for (i = 0; i < 7; i++) { px(11 + i, 18 + Math.floor(i / 2), C.navy); px(11 + i, 19 + Math.floor(i / 2), C.navy); px(35 - i, 18 + Math.floor(i / 2), C.navy); px(35 - i, 19 + Math.floor(i / 2), C.navy); }
      for (x = 17; x < 30; x++) { px(x, 32, C.navy); px(x, 33, C.navy); }
      for (x = 18; x < 29; x += 3) { px(x, 32, C.white); }
      [8, 14, 31, 37].forEach(function (lx) { for (y = 42; y < 49; y++) { px(lx, y, C.navy); px(lx + 1, y, C.navy); } });
    });
    return outline(src, C.navy, key);
  }

  /* ---------- world tiles and items ---------- */
  function ground() {
    return make(16, 16, function (px) {
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
        var col = y < 2 ? C.lime : y < 4 ? C.limeSh : y === 4 ? C.limeDk : C.soil;
        if (y > 5 && ((x * 7 + y * 13) % 11 === 0)) col = C.soilDk;
        px(x, y, col);
      }
      px(3, 4, C.limeSh); px(10, 4, C.limeSh);
    }, 'ground');
  }
  function soil() {
    return make(16, 16, function (px) {
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) px(x, y, ((x * 7 + (y + 16) * 13) % 11 === 0) ? C.soilDk : C.soil);
    }, 'soil');
  }
  function brick() {
    return make(16, 16, function (px) {
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
        var row = Math.floor(y / 4), off = row % 2 ? 4 : 0, mortar = y % 4 === 3 || (x + off) % 8 === 7;
        px(x, y, mortar ? C.coralSoft : (y % 4 === 0 ? '#FF8A6E' : C.coral));
      }
    }, 'brick');
  }
  function stone() {
    return make(16, 16, function (px) {
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
        var row = Math.floor(y / 8), off = row % 2 ? 8 : 0, mortar = y % 8 === 7 || (x + off) % 16 === 15;
        px(x, y, mortar ? C.stoneDk : (y % 8 === 0 ? C.stoneLt : C.stone));
      }
    }, 'stone');
  }
  function qblock(used, flash) {
    var key = 'q|' + (used ? 1 : 0) + '|' + (flash ? 1 : 0);
    return make(16, 16, function (px) {
      var base = used ? C.goldDk : flash ? C.lime : C.gold, hi = used ? C.goldSh : flash ? '#DDF77A' : '#FFE08A', lo = used ? '#8C5806' : flash ? C.limeDk : C.goldSh;
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
        var col = (x === 0 || y === 0) ? hi : (x === 15 || y === 15) ? lo : base;
        px(x, y, col);
      }
      [[2, 2], [13, 2], [2, 13], [13, 13]].forEach(function (b) { px(b[0], b[1], used ? '#6E4605' : C.navy); });
      if (!used) {
        var q = ['.xxxx.', 'xx..xx', '....xx', '...xx.', '..xx..', '..xx..', '......', '..xx..'];
        q.forEach(function (r, j) { for (var i = 0; i < r.length; i++) if (r[i] === 'x') px(5 + i, 4 + j, C.navy); });
      }
    }, key);
  }
  function coin(frame) {
    var f = (frame || 0) % 4, ws = [8, 6, 2, 6][f];
    return make(8, 12, function (px) {
      var cx = 4;
      for (var y = 0; y < 12; y++) for (var x = 0; x < 8; x++) {
        var dx = (x + .5 - cx) / (ws / 2), dy = (y + .5 - 6) / 6;
        if (dx * dx + dy * dy <= 1) px(x, y, Math.abs(dx) > 0.6 ? C.goldSh : C.gold);
      }
      if (ws > 4) for (var y2 = 3; y2 < 9; y2++) px(cx, y2, '#FFE08A');
    }, 'coin|' + f);
  }
  function mushroom(o) {
    o = o || {}; var tone = o.tone || 'lime', fr = (o.frame || 0) % 2;
    var cap = tone === 'coral' ? [C.coral, C.coralSh] : tone === 'peri' ? [C.peri, C.periSh] : [C.lime, C.limeDk];
    var key = 'mush|' + tone + '|' + fr;
    if (cache[key]) return cache[key];
    var src = make(16, 16, function (px) {
      for (var y = 0; y < 9; y++) for (var x = 0; x < 16; x++) { var dx = (x + .5 - 8) / 8, dy = (y + .5 - 9) / 9; if (dx * dx + dy * dy <= 1) px(x, y, dy > -0.25 && dx > 0.5 ? cap[1] : cap[0]); }
      [[4, 3], [10, 2], [7, 6], [13, 6], [1, 6]].forEach(function (s) { px(s[0], s[1], C.cream); px(s[0] + 1, s[1], C.cream); px(s[0], s[1] + 1, C.cream); px(s[0] + 1, s[1] + 1, C.cream); });
      for (y = 9; y < 16; y++) for (x = 4; x < 12; x++) px(x, y, x === 11 ? '#EADFC4' : C.cream);
      eye(px, 6, 11, 1, 1, [0, 0]); eye(px, 9, 11, 1, 1, [0, 0]);
      if (fr) { px(4, 15, null); }
    });
    return outline(src, C.navy, key);
  }
  function cloud(w) {
    w = w || 24;
    return make(w, 10, function (px) {
      for (var y = 0; y < 10; y++) for (var x = 0; x < w; x++) {
        var a = Math.pow((x + .5 - w * 0.3) / (w * 0.26), 2) + Math.pow((y + .5 - 6) / 4.5, 2) <= 1;
        var b = Math.pow((x + .5 - w * 0.6) / (w * 0.3), 2) + Math.pow((y + .5 - 4.5) / 4.5, 2) <= 1;
        var c = Math.pow((x + .5 - w * 0.5) / (w * 0.5), 2) + Math.pow((y + .5 - 7.5) / 2.6, 2) <= 1;
        if (a || b || c) px(x, y, y > 7 ? C.periSoft : C.white);
      }
    }, 'cloud|' + w);
  }
  function heart(full) {
    var r = ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'];
    return grid(r, { x: full ? C.coral : C.grey }, 'heart|' + (full ? 1 : 0));
  }
  function ember() {
    return cached('ember', function () { return outline(grid(['..y..', '.yoy.', 'yoOoy', 'yoOoy', '.oOo.'], { y: C.fl2, o: C.fl3, O: C.fl4 }), C.fl5); });
  }
  function ring(phase) {
    var f = Math.floor(((phase || 0) % 1) * 8);
    return make(14, 14, function (px) {
      for (var i = 0; i < 8; i++) {
        var a = i / 8 * Math.PI * 2, x = 7 + Math.cos(a) * 5, y = 7 + Math.sin(a) * 5, on = i === f;
        var col = on ? C.white : i === (f + 7) % 8 ? C.lime : C.limeDk;
        px(Math.round(x) - 1, Math.round(y) - 1, col); px(Math.round(x), Math.round(y) - 1, col); px(Math.round(x) - 1, Math.round(y), col); px(Math.round(x), Math.round(y), col);
      }
    }, 'ring|' + f);
  }
  function fireball(frame) {
    var f = (frame || 0) % 2;
    return cached('fb|' + f, function () {
      return outline(grid(f ? ['..yy..', '.yOOy.', 'yOooOy', 'yOooOy', '.yOOy.', '..yy..'] : ['.yyy..', 'yOOOy.', 'yOoOOy', '.yOoOy', '.yOOy.', '..yy..'],
        { y: C.fl1, O: C.fl3, o: C.white }), C.coralSh);
    });
  }
  function cage() {
    return make(26, 26, function (px) {
      for (var x = 0; x < 26; x++) { px(x, 0, C.bars); px(x, 1, C.greyDk); px(x, 24, C.bars); px(x, 25, C.greyDk); }
      for (x = 0; x < 26; x += 5) for (var y = 2; y < 24; y++) px(x, y, C.bars);
    }, 'cage');
  }
  function flag(wave) {
    var f = (wave || 0) % 2;
    return make(14, 40, function (px) {
      for (var y = 2; y < 40; y++) { px(1, y, C.navy); px(2, y, C.navy2); }
      px(1, 0, C.gold); px(2, 0, C.gold); px(1, 1, C.gold); px(2, 1, C.gold);
      for (y = 3; y < 13; y++) for (var x = 3; x < 13 - (f && y > 9 ? 1 : 0); x++) px(x, y, (y === 3 || y === 12) ? C.limeDk : C.lime);
      [[6, 8], [7, 9], [8, 10], [9, 9], [10, 8], [11, 7]].forEach(function (p) { px(p[0], p[1], C.navy); });
    }, 'flag|' + f);
  }
  function torch(frame) {
    var f = (frame || 0) % 3;
    return make(8, 16, function (px) {
      var fl = [['..y...', '.yoy..', 'yoOoy.', '.oOo..'], ['...y..', '..yoy.', '.yoOoy', '..oOo.'], ['..y...', '.yoy..', '.yoOoy', '.oOo..']][f];
      fl.forEach(function (r, j) { for (var i = 0; i < r.length; i++) { var ch = r[i]; if (ch !== '.') px(1 + i, 2 + j, ch === 'y' ? C.fl2 : ch === 'o' ? C.fl3 : C.fl4); } });
      for (var y = 6; y < 16; y++) { px(3, y, C.goldDk); px(4, y, C.goldSh); }
      for (var x = 1; x < 7; x++) px(x, 6, C.goldSh);
    }, 'torch|' + f);
  }
  /* filled disc, radius r (2r+1 square) */
  function disc(r, col) {
    var key = 'disc|' + r + '|' + col;
    return cache[key] || make(2 * r + 1, 2 * r + 1, function (px) {      // cache hit first: no closure per call (G.puff)
      for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * .6) px(x + r, y + r, col);
    }, key);
  }

  /* ---------- menu icons for the classic games (from ../classic-video/icons.js) ---------- */
  var icon = {
    stack: function () {
      return cached('ci-stack', function () {
        return outline(grid(['...ll.....', '...ll.....', '..........', 'pp....gg..', 'pp....gg..', 'ppcclmmggg', 'ppcclmmggg', 'ccccllmmmm', 'ccccllmmmm'],
          { l: C.lime, p: C.peri, g: C.gold, c: C.coral, m: C.mint }), C.navy);
      });
    },
    plank: function () {
      return cached('ci-plank', function () {
        return outline(grid(['gggggggggggggg', 'gGGGGGGGGGGGGg', '.....kkkk.....', '.....k..k.....', '......kk......', '.....k..k.....', '......kk......', '.....kkkk.....'],
          { g: C.lime, G: C.limeDk, k: C.greyDk }), C.navy);
      });
    },
    invader: function (f) {
      f = (f || 0) % 2;
      return cached('ci-inv' + f, function () {
        return outline(grid(f ? ['..p......p..', '...p....p...', '..pppppppp..', '.ppwkppwkpp.', 'pppwkppwkppp', 'pppppppppppp', 'p.pppppppp.p', 'p.p......p.p', '...pp..pp...'] :
          ['..p......p..', 'p..p....p..p', 'p.pppppppp.p', 'pppwkppwkppp', 'pppwkppwkppp', 'pppppppppppp', '.pppppppppp.', '..p......p..', '.p........p.'],
          { p: C.coral, w: C.white, k: C.navy }), C.navy);
      });
    }
  };

  /* ---------- the runtime game canvas ---------- */
  function roundRect(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function insets(el) {
    var d = document.createElement('div');
    d.style.cssText = 'position:absolute;left:0;top:0;width:1px;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
    el.appendChild(d);
    var cs = getComputedStyle(d), t = parseFloat(cs.paddingTop) || 0, b = parseFloat(cs.paddingBottom) || 0;
    d.remove();
    return [t, b];
  }

  function game(el) {
    var cv = document.createElement('canvas');
    cv.className = 'arc-cv';
    cv.setAttribute('aria-hidden', 'true');
    el.appendChild(cv);
    var ctx = cv.getContext('2d');
    var WRAP = {}, wrapN = 0;
    var G = {
      cv: cv, ctx: ctx, B: B, W: GW, H: 281, SW: 390, SH: 844, k: 1, css: 1, dpr: 1, top: 0, bot: 0,
      resize: function () {
        var r = el.getBoundingClientRect(), w = Math.max(200, Math.round(r.width || 390)), h = Math.max(300, Math.round(r.height || 844));
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        cv.style.width = w + 'px'; cv.style.height = h + 'px';
        G.dpr = dpr; G.k = cv.width / 390; G.css = w / 390; G.SH = cv.height / G.k; G.H = G.SH / B;
        var ins = insets(el); G.top = ins[0] / G.css; G.bot = ins[1] / G.css;
        ctx.imageSmoothingEnabled = false;
        WRAP = {}; wrapN = 0;
      },
      clearCache: function () { WRAP = {}; wrapN = 0; },
      clear: function (col) {
        ctx.setTransform(G.k, 0, 0, G.k, 0, 0); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = col || C.sky; ctx.fillRect(0, 0, 390, G.SH + 2);
      },
      spr: function (s, gx, gy, o) {
        var sc = (o && o.scale) || 1, x = Math.round(gx) * B, y = Math.round(gy) * B, w = s.width * B * sc, h = s.height * B * sc;
        if (o && (o.alpha != null || o.flip)) {
          ctx.save();
          if (o.alpha != null) ctx.globalAlpha *= clamp(o.alpha);
          if (o.flip) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(s, 0, 0, w, h); }
          else ctx.drawImage(s, x, y, w, h);
          ctx.restore();
        } else ctx.drawImage(s, x, y, w, h);
      },
      sprS: function (s, sx, sy, sc, a) {
        var w = s.width * B * (sc || 1), h = s.height * B * (sc || 1);
        if (a != null) { ctx.save(); ctx.globalAlpha *= clamp(a); }
        ctx.drawImage(s, Math.round(sx - w / 2), Math.round(sy - h / 2), w, h);
        if (a != null) ctx.restore();
      },
      drawSq: function (s, cx, bot, sq, a, flip) {
        var w = s.width, h = s.height;
        ctx.save(); if (a != null) ctx.globalAlpha *= clamp(a);
        var W = Math.abs(sq || 0) < .025 ? w * B : Math.round(w * B * (1 + sq * .8)), H = Math.abs(sq || 0) < .025 ? h * B : Math.round(h * B * (1 - sq));
        var x = Math.abs(sq || 0) < .025 ? Math.round(cx - w / 2) * B : Math.round(cx * B - W / 2), y = Math.abs(sq || 0) < .025 ? Math.round(bot - h) * B : Math.round(bot * B - H);
        if (flip) { ctx.translate(x + W, y); ctx.scale(-1, 1); ctx.drawImage(s, 0, 0, W, H); } else ctx.drawImage(s, x, y, W, H);
        ctx.restore();
      },
      rect: function (gx, gy, gw, gh, col, alpha) {
        if (alpha != null) { if (alpha <= 0) return; ctx.save(); ctx.globalAlpha *= Math.min(1, alpha); }
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(gx) * B, Math.round(gy) * B, Math.round(gw) * B, Math.round(gh) * B);
        if (alpha != null) ctx.restore();
      },
      text: function (str, sx, sy, o) {
        o = o || {};
        ctx.save();
        if (o.alpha != null) ctx.globalAlpha *= clamp(o.alpha);
        ctx.font = (o.weight || 800) + ' ' + (o.size || 22) + 'px ' + (o.font || 'Lexend, sans-serif');
        ctx.fillStyle = o.color || C.navy; ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'middle';
        if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.strokeW || 6; ctx.strokeStyle = o.stroke; ctx.strokeText(str, sx, sy); }
        ctx.fillText(str, sx, sy);
        ctx.restore();
      },
      pill: function (str, cx, cy, o) {
        o = o || {};
        ctx.save();
        if (o.alpha != null) ctx.globalAlpha *= clamp(o.alpha);
        var size = o.size || 18, pad = o.pad || 12;
        ctx.font = (o.weight || 700) + ' ' + size + 'px ' + (o.font || 'Lexend, sans-serif');
        var w = Math.ceil(ctx.measureText(str).width) + pad * 2, h = Math.round(size * 1.9), r = o.r == null ? h / 2 : o.r;
        var x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
        if (o.scale != null && o.scale !== 1) { ctx.translate(cx, cy); ctx.scale(o.scale, o.scale); ctx.translate(-cx, -cy); }
        if (o.shadow !== false) { ctx.fillStyle = o.shadowCol || 'rgba(11,18,64,.22)'; roundRect(ctx, x, y + 4, w, h, r); ctx.fill(); }
        ctx.fillStyle = o.bg || C.white; roundRect(ctx, x, y, w, h, r); ctx.fill();
        if (o.border) { ctx.lineWidth = o.borderW || 3; ctx.strokeStyle = o.border; roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r); ctx.stroke(); }
        ctx.fillStyle = o.color || C.navy; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(str, cx, cy + 1);
        ctx.restore();
        return { x: x, y: y, w: w, h: h };
      },
      box: function (sx, sy, w, h, o) {
        o = o || {};
        var r = o.r == null ? 22 : o.r;
        ctx.save(); if (o.alpha != null) ctx.globalAlpha *= clamp(o.alpha);
        if (o.shadow !== false) { ctx.fillStyle = 'rgba(11,18,64,.25)'; roundRect(ctx, sx, sy + 6, w, h, r); ctx.fill(); }
        ctx.fillStyle = o.bg || C.white; roundRect(ctx, sx, sy, w, h, r); ctx.fill();
        if (o.border) { ctx.lineWidth = o.borderW || 4; ctx.strokeStyle = o.border; roundRect(ctx, sx + (o.borderW || 4) / 2, sy + (o.borderW || 4) / 2, w - (o.borderW || 4), h - (o.borderW || 4), Math.max(0, r - 2)); ctx.stroke(); }
        ctx.restore();
      },
      dim: function (a) { if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = C.navy; ctx.fillRect(-20, -20, 430, G.SH + 40); ctx.restore(); },
      /* tiled strip of a 16 px tile across the screen at game y, scrolled by camera x (game px) */
      tiles: function (tile, gy, camX, rows) {
        var tw = tile.width; rows = rows || 1;
        var start = -((camX % tw) + tw) % tw - tw;
        var below = tile === ground() ? soil() : tile;
        for (var r = 0; r < rows; r++) for (var x = start; x < GW + 4; x += tw) G.spr(r ? below : tile, x, gy + r * tile.height);
      },
      /* split str into at most 2 balanced lines that fit maxW sp (font weight 700 Lexend unless given) */
      wrap: function (str, size, maxW, weight, font) {
        var key = str + '|' + size + '|' + maxW + '|' + (weight || 700) + '|' + (font || ''); if (WRAP[key]) return WRAP[key];
        var res; ctx.save(); ctx.font = (weight || 700) + ' ' + size + 'px ' + (font || 'Lexend, sans-serif');
        var full = ctx.measureText(str).width;
        if (full <= maxW || str.indexOf(' ') < 0) res = { lines: [str], w: full };
        else {
          var words = str.split(' ');
          for (var i = 1; i < words.length; i++) {
            var a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
            var w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
            if (!res || w < res.w) res = { lines: [a, b], w: w };
          }
        }
        ctx.restore();
        if (++wrapN > 400) { WRAP = {}; wrapN = 1; }
        return (WRAP[key] = res);
      },
      /* the meaning sign: white card with a tail pointing down to (cx, bot); lime when right, coral when wrong */
      sign: function (str, cx, bot, o) {
        o = o || {};
        var size = o.size || 21, lh = Math.round(size * 1.24), info = G.wrap(str, size, o.maxW || 210);
        var w = Math.ceil(info.w) + 34, h = info.lines.length * lh + 20, x = Math.round(cx - w / 2), y = Math.round(bot - 12 - h);
        if (x < 6) { x = 6; } if (x + w > 384) { x = 384 - w; }
        var bg = o.state === 'right' ? C.lime : o.state === 'wrong' ? C.coral : (o.bg || C.white), fg = o.state === 'wrong' ? C.white : C.navy;
        var s = o.s == null ? 1 : o.s; if (s <= 0) return null;
        ctx.save();
        if (o.alpha != null) ctx.globalAlpha *= clamp(o.alpha);
        if (s !== 1) { ctx.translate(cx, bot); ctx.scale(s, s); ctx.translate(-cx, -bot); }
        var tx = clamp(cx, x + 20, x + w - 20);
        ctx.fillStyle = C.navy; ctx.beginPath(); ctx.moveTo(tx - 12, y + h - 4); ctx.lineTo(tx + 12, y + h - 4); ctx.lineTo(tx, bot); ctx.closePath(); ctx.fill();
        G.box(x, y, w, h, { bg: bg, border: o.border || C.navy, borderW: 3.5, r: 16 });
        ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(tx - 7, y + h - 4); ctx.lineTo(tx + 7, y + h - 4); ctx.lineTo(tx, bot - 6); ctx.closePath(); ctx.fill();
        for (var i = 0; i < info.lines.length; i++) G.text(info.lines[i], x + w / 2, y + 10 + lh * (i + .5) + 1, { size: size, weight: 700, color: fg });
        ctx.restore();
        return { x: x, y: y, w: w, h: h };
      },
      badge: function (cx, cy, r, ok, s, a) {
        if (s <= 0) return;
        ctx.save(); ctx.globalAlpha *= clamp(a == null ? 1 : a); ctx.translate(cx, cy); ctx.scale(s, s);
        ctx.fillStyle = 'rgba(11,18,64,.25)'; ctx.beginPath(); ctx.arc(0, 3, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = ok ? C.lime : C.coral; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 3.5; ctx.strokeStyle = C.navy; ctx.stroke();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3.5, r * .25); ctx.strokeStyle = ok ? C.navy : C.white;
        ctx.beginPath();
        if (ok) { ctx.moveTo(-r * .42, r * .02); ctx.lineTo(-r * .1, r * .34); ctx.lineTo(r * .45, -r * .34); }
        else { ctx.moveTo(-r * .33, -r * .33); ctx.lineTo(r * .33, r * .33); ctx.moveTo(r * .33, -r * .33); ctx.lineTo(-r * .33, r * .33); }
        ctx.stroke(); ctx.restore();
      },
      popText: function (str, sx, sy, s, a, size, fill) {
        if (s <= 0 || a <= 0) return;
        ctx.save(); ctx.globalAlpha *= clamp(a); ctx.translate(sx, sy); ctx.scale(s, s);
        G.text(str, 0, 6, { size: size, weight: 800, color: C.navy, stroke: C.navy, strokeW: 13 });
        G.text(str, 0, 0, { size: size, weight: 800, color: fill || C.white, stroke: C.navy, strokeW: 11 });
        ctx.restore();
      },
      /* the word card. o: {a (0..1 appear), word, say, hi, top (sp), speak (0..1 speaker pulse), label, meaning} */
      wordCard: function (o) {
        var a = o.a == null ? 1 : o.a; if (a <= 0) return null;
        var w = 300, h = 112, x = 45, y = o.top;
        ctx.save(); ctx.globalAlpha *= Math.min(1, a * 1.6);
        G.box(x, y, w, h, { bg: C.white, border: C.navy, borderW: 4, r: 24 });
        if (o.meaning) {
          G.text(o.label || 'Which word means', 195, y + 26, { size: 15, weight: 700, color: C.ink2, font: 'Figtree, sans-serif' });
          var info = G.wrap(o.meaning, 26, 236, 800);
          var sz = info.lines.length > 1 ? 22 : 26;
          info = G.wrap(o.meaning, sz, 236, 800);
          for (var i = 0; i < info.lines.length; i++) G.text(info.lines[i], 186, y + (info.lines.length > 1 ? 58 : 70) + i * (sz + 4), { size: sz, weight: 800, color: C.navy });
        } else {
          var ws = 46; ctx.font = '800 46px Lexend, sans-serif'; var tw = ctx.measureText(o.word).width; if (tw > 196) ws = Math.floor(46 * 196 / tw);
          G.text(o.word, 187, y + 46, { size: ws, weight: 800, color: C.navy });
          G.text(o.say + '  ·  ' + o.hi, 195, y + 88, { size: 19, weight: 600, color: C.ink2, font: 'Lexend, Hind, sans-serif' });
        }
        var sp = o.speak || 0;
        if (sp > 0 && sp < 1) {
          ctx.strokeStyle = C.limeDk; ctx.lineWidth = 4; ctx.globalAlpha = (1 - sp) * .9 * Math.min(1, a * 1.6);
          for (var j = 0; j < 2; j++) { ctx.beginPath(); ctx.arc(x + w - 34, y + 30, 6 + sp * 9 + j * 7, -.8, .8); ctx.stroke(); }
          ctx.globalAlpha = Math.min(1, a * 1.6);
        }
        if (o.speaker !== false) { ctx.fillStyle = C.navy; ctx.beginPath(); ctx.moveTo(x + w - 40, y + 25); ctx.lineTo(x + w - 34, y + 25); ctx.lineTo(x + w - 26, y + 18); ctx.lineTo(x + w - 26, y + 42); ctx.lineTo(x + w - 34, y + 35); ctx.lineTo(x + w - 40, y + 35); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        return { x: x, y: y, w: w, h: h };
      },
      iris: function (open, cx, cy) {
        if (open >= 1) return;
        var R = Math.hypot(390, G.SH) * Math.max(0, open);
        ctx.save(); ctx.fillStyle = C.navy; ctx.beginPath(); ctx.rect(-20, -20, 430, G.SH + 40);
        if (R > 0.5) ctx.arc(cx == null ? 195 : cx, cy == null ? G.SH / 2 : cy, R, 0, Math.PI * 2, true);
        ctx.fill('evenodd'); ctx.restore();
      },
      puff: function (gx, gy, r, a) { if (a <= 0) return; r = Math.max(1, Math.min(8, Math.round(r))); G.spr(disc(r, C.white), gx - r, gy - r, { alpha: a }); },
      toClient: function (sx, sy) { var r = cv.getBoundingClientRect(); return { x: r.left + sx * G.css, y: r.top + sy * G.css }; }
    };
    G.resize();
    return G;
  }

  window.PX = {
    B: B, GW: GW, C: C, make: make, grid: grid, outline: outline, roundRect: roundRect, clamp: clamp,
    game: game, lau: lau, rami: rami, chip: chip, pixi: pixi, bolo: bolo, customer: customer, bug: bug, king: king,
    ground: ground, soil: soil, brick: brick, stone: stone, qblock: qblock, coin: coin, mushroom: mushroom, cloud: cloud,
    heart: heart, ember: ember, ring: ring, fireball: fireball, cage: cage, flag: flag, torch: torch, disc: disc, icon: icon,
    cacheSize: function () { return count; }
  };
})();
