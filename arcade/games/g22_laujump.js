/* Game 22 · Lau Jump (bounce and climb). Look and mechanics ported from the approved video scene
   (../../../classic-video/scenes/g22_laujump.js, storyboard "## 22 · Lau Jump").

   Rules (SPEC.md): a 90 s round in a vertical pixel shopping mall. Lau bounces on his own; hold the left or right half
   of the screen (the two hold buttons at the bottom, or the arrow keys) to steer him. The floor above has 3 narrow
   planks with gaps, each labelled with a spec word, and a customer on its balcony says a need. Land on the plank that
   answers it: it springs, the word plays, Lau is up a floor and the camera scrolls. A wrong plank crumbles: Lau drops
   back, the right plank glows and the planks reshuffle. Miss every plank (his own included) and he falls: Bolo catches
   him, 3 times (= the hearts). Landings: the Say-it card, and a clear word fires a rocket boost (+3 floors with a flame
   trail; +2 for a tap check). Score = the top floor reached; a "Your best" flag marks the previous best floor.
   Sparks: +1 per right plank, +1 per floor the rocket passes.

   Play notes (forgiving controls, no reflex-only play):
   - Hold to steer, let go to land: while a direction is held Lau floats just above the plank row (a flame hover), so
     sliding past a plank never lands him on it; letting go drops him onto the plank under him (or through a gap).
   - The next row always leaves a gap over Lau's spot, so bouncing in place never lands him on a plank by accident. The
     gap is as wide as the layout allows (at least 17 px from every plank centre, 20 to 26 px wherever possible).
   - Landing tolerance 2 px past each plank end; his own narrow plank still catches him 14 px past its ends (he is
     nudged back on). Rows also stay within one hop of his plank for players who never hold through a descent.
   - One floor, one answer. A wrong landing only counts when it was deliberate: the finger left the screen in the last
     0.35 s (he was hovering over the plank, or was let go just before he dropped onto it), or the holds of this hop
     add up to 0.2 s+ (a real steer, 18 px+; a quick tap is 80-150 ms). A quick tap early in the rise that lets him
     drift onto a plank still crumbles it and shows the right one, but is not marked wrong (the word comes back a few
     floors later for a real answer). Once a floor's answer has been shown, landing
     the glowing plank climbs and plays the word but is not a right answer (no spark), like Block Bump's fix-it coin.
   - A Landing's Say-it card, and the end card, wait until no finger is on the hold buttons (so lifting it never presses
     a card button); touchend on the canvas is also cancelled for the same reason.
   - Time's up ends as reason 'time' with minRight 3, so a run that never really answered (fewer than 3 right planks)
     doesn't pay the daily +10 XP.
   - Under prefers-reduced-motion: no white flash on the cut to a Landing, no speed lines, no opening iris, no hover
     bob, a shorter camera rush and no rocket camera dip.
   - LANDING_MODE 'stretch' (default): a Landing 5 floors above where the last stretch began (floor 1, the floor the
     rocket dropped him on, or the last Landing), i.e. floor 5, then 13, 21 with rockets. 'literal' puts Landings on
     every 5th floor (5, 10, 15 ...), which after a +3 rocket leaves only one plank floor between Say-it cards. */
(function () {
  'use strict';
  var U = ARC.U, C = PX.C, E = U.E, p = U.p, clamp = U.clamp, hash = U.hash, mix = U.mix, jiggle = U.jiggle, lerp = U.lerp;
  var BK = ARC.bank;

  /* ---------- tuning ---------- */
  var FH = 84, BAL = 31, PW = 26, HW = 13;          // floor height, customer balcony height, plank width (game px)
  var ROUND = 90;                                   // seconds of play (frozen while a sheet is open)
  var HOP_H = 108, HOP_T = 1.2;                     // Lau's own bounce: apex above his plank (the next row is 84 up), period
  var GRAV = 8 * HOP_H / (HOP_T * HOP_T), V0 = 4 * HOP_H / HOP_T;
  var V_SPRING = Math.sqrt(2 * GRAV * 140), V_SUPER = Math.sqrt(2 * GRAV * 230);
  var VX = 92, XMIN = 7, XMAX = 123;                // steering speed (game px/s), walls
  var TOL = 2, HOME_TOL = 14, GAP = 17, REACH = 88;
  var GAPS = [26, 23, 20, GAP];                     // preferred clear gaps over Lau's spot, widest first (GAP is the floor)
  var SP_MIN = 34, SP_MAX = 58, SP_EASY = 38;       // plank centre spacing; SP_EASY+ preferred for the widest gap tier
  var REL_WIN = .35, STEER_MIN = .2;                // deliberate: landed within REL_WIN s of the lift, or STEER_MIN s+ of holds this hop
  var CONTACT = .068, HOVER = 7;
  var LANDING_MODE = 'stretch', STRETCH = 5;
  var ROCKET = 3, ROCKET_TAP = 2, RK_IGN = .14, RK_DUR = 1.35, RK_FALL = .49, RX = 11;
  var LX = 68;                                      // Lau's x on a Landing (the customer steps up on his right)

  function FY(n) { return (n - 1) * FH; }

  var G = null, S = null, SPR = null, BANDC = {}, BANDN = 0, CC = {}, TWC = {}, TWN = 0, WARM = null;
  function reduceMotion() {
    if (ARC.reduceMotion != null) return !!ARC.reduceMotion;          // the engine's flag, once it is shared
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  var RM = false;                                                     // read at each run's start

  /* ======================================================================================================
     sprites (ported from the video scene)
     ====================================================================================================== */
  function rgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function disc(r, col) {
    return PX.make(2 * r + 1, 2 * r + 1, function (px) {
      for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * .6) px(x + r, y + r, col);
    });
  }
  var FONT = {
    A: ['.x.', 'x.x', 'xxx', 'x.x', 'x.x'], B: ['xx.', 'x.x', 'xx.', 'x.x', 'xx.'], C: ['.xx', 'x..', 'x..', 'x..', '.xx'],
    D: ['xx.', 'x.x', 'x.x', 'x.x', 'xx.'], E: ['xxx', 'x..', 'xx.', 'x..', 'xxx'], F: ['xxx', 'x..', 'xx.', 'x..', 'x..'],
    G: ['.xx', 'x..', 'x.x', 'x.x', '.xx'], H: ['x.x', 'x.x', 'xxx', 'x.x', 'x.x'], I: ['xxx', '.x.', '.x.', '.x.', 'xxx'],
    K: ['x.x', 'x.x', 'xx.', 'x.x', 'x.x'], L: ['x..', 'x..', 'x..', 'x..', 'xxx'], N: ['xx.', 'x.x', 'x.x', 'x.x', 'x.x'],
    O: ['xxx', 'x.x', 'x.x', 'x.x', 'xxx'], P: ['xx.', 'x.x', 'xx.', 'x..', 'x..'], R: ['xx.', 'x.x', 'xx.', 'x.x', 'x.x'],
    S: ['.xx', 'x..', '.x.', '..x', 'xx.'], T: ['xxx', '.x.', '.x.', '.x.', '.x.'], U: ['x.x', 'x.x', 'x.x', 'x.x', 'xxx'],
    Y: ['x.x', 'x.x', '.x.', '.x.', '.x.']
  };
  var SHOP = {
    peri: { wall: '#CBD4FB', sh: '#B6C1F7', trim: C.periSh, awn: C.lime, awnSh: C.limeDk },
    cream: { wall: C.cream, sh: '#F0E3C2', trim: C.soilDk, awn: C.coral, awnSh: C.coralSh },
    peach: { wall: '#FFD3C2', sh: '#F7B9A2', trim: C.coralSh, awn: C.lime, awnSh: C.limeDk },
    soft: { wall: C.periSoft, sh: '#D3DAFB', trim: C.periSh, awn: C.gold, awnSh: C.goldSh },
    mint: { wall: C.mintSoft, sh: '#BDEFD8', trim: C.mintSh, awn: C.peri, awnSh: C.periSh }
  };
  var BANDS = [
    [['LAPTOPS', 'peri', 'laptops'], ['CAFE', 'cream', 'cups'], 'plantL'],
    [['PHONES', 'peach', 'phones'], ['AUDIO', 'soft', 'audio'], 'plantR'],
    [['TECH', 'mint', 'screen'], ['BOOKS', 'cream', 'books'], 'plantL'],
    [['GADGETS', 'soft', 'boxes'], ['TOYS', 'peach', 'toys'], 'plantR']
  ];
  var FACE1 = '#C3CCF8', FACE2 = '#B3BEF4', FACE3 = '#9DAAEE', CEIL = '#CDD5FC';
  var WASH = .68, WASH_ON = .1;

  function showItems(px, type, x0, x1, base) {
    var x, y, i;
    if (type === 'laptops') {
      [x0 + 2, x0 + 13].forEach(function (lx) {
        for (y = base - 7; y < base - 1; y++) for (x = lx + 1; x < lx + 9; x++) px(x, y, (y === base - 7 || y === base - 2 || x === lx + 1 || x === lx + 8) ? C.navy : (y === base - 5 && x < lx + 6 ? C.lime : C.peri));
        for (x = lx; x < lx + 10; x++) px(x, base - 1, C.grey);
      });
    } else if (type === 'phones') {
      [2, 7, 12, 17].forEach(function (o, q) { for (y = base - 8; y < base; y++) for (x = x0 + o; x < x0 + o + 4; x++) px(x, y, (y === base - 8 || y === base - 1 || x === x0 + o || x === x0 + o + 3) ? C.navy : (q % 2 ? C.mint : C.peri)); });
    } else if (type === 'cups') {
      [3, 9, 15].forEach(function (o, q) {
        for (y = base - 4; y < base; y++) for (x = x0 + o; x < x0 + o + 4; x++) px(x, y, y === base - 4 ? C.white : [C.coral, C.gold, C.peri][q]);
        px(x0 + o + 4, base - 3, C.navy2); px(x0 + o + 1, base - 6, C.white); px(x0 + o + 2, base - 7, C.white);
      });
    } else if (type === 'audio') {
      for (i = 0; i < 2; i++) { var sx = x0 + 3 + i * 12; for (y = base - 9; y < base; y++) for (x = sx; x < sx + 7; x++) px(x, y, (y === base - 9 || x === sx || x === sx + 6 || y === base - 1) ? C.navy : C.navy2); px(sx + 3, base - 6, C.peri); px(sx + 3, base - 3, C.lime); px(sx + 2, base - 3, C.lime); px(sx + 4, base - 3, C.lime); }
    } else if (type === 'screen') {
      for (y = base - 11; y < base - 3; y++) for (x = x0 + 3; x < x0 + 20; x++) px(x, y, (y === base - 11 || y === base - 4 || x === x0 + 3 || x === x0 + 19) ? C.navy : (y < base - 7 ? C.lime : C.peri));
      for (y = base - 3; y < base; y++) px(x0 + 11, y, C.navy);
      for (x = x0 + 8; x < x0 + 15; x++) px(x, base - 1, C.navy);
    } else if (type === 'books') {
      [C.coral, C.peri, C.gold, C.mint, C.lime, C.coral].forEach(function (col, q) { var hh = 6 + (q % 3); for (y = base - hh; y < base; y++) { px(x0 + 3 + q * 3, y, col); px(x0 + 4 + q * 3, y, col); } px(x0 + 3 + q * 3, base - hh, C.navy2); });
    } else if (type === 'boxes') {
      [[3, 0, C.gold], [10, 0, C.lime], [6, 6, C.coral]].forEach(function (b) { for (y = base - 6 - b[1]; y < base - b[1]; y++) for (x = x0 + b[0]; x < x0 + b[0] + 6; x++) px(x, y, (y === base - 6 - b[1] || y === base - b[1] - 1 || x === x0 + b[0] || x === x0 + b[0] + 5) ? C.navy : b[2]); });
    } else if (type === 'toys') {
      for (y = -3; y <= 3; y++) for (x = -3; x <= 3; x++) if (x * x + y * y <= 10) px(x0 + 7 + x, base - 4 + y, x + y < 0 ? C.coral : C.gold);
      for (y = base - 6; y < base; y++) for (x = x0 + 13; x < x0 + 19; x++) px(x, y, (y === base - 6 || x === x0 + 13) ? C.periSh : C.peri);
    }
  }
  function shopInto(px, x0, w, def) {
    var s = SHOP[def[1]], yT = 34, yB = 77, x, y, i;
    for (y = yT; y <= yB; y++) for (x = x0; x < x0 + w; x++) px(x, y, s.wall);
    for (x = x0; x < x0 + w; x++) { px(x, yT, s.trim); px(x, yT + 1, s.sh); }
    for (y = yT; y <= yB; y++) { px(x0, y, s.sh); px(x0 + w - 1, y, s.trim); }
    var sign = def[0], n = sign.length, bw = 4 * n + 3, bx = x0 + Math.round((w - bw) / 2);
    for (y = yT + 3; y < yT + 12; y++) for (x = bx; x < bx + bw; x++) px(x, y, (y === yT + 3 || y === yT + 11 || x === bx || x === bx + bw - 1) ? C.navy : C.navy2);
    for (i = 0; i < n; i++) { var g = FONT[sign[i]]; for (y = 0; y < 5; y++) for (x = 0; x < 3; x++) if (g[y][x] === 'x') px(bx + 2 + i * 4 + x, yT + 5 + y, C.cream); }
    for (x = x0 + 1; x < x0 + w - 1; x++) {
      var q = (x - x0 - 1) % 4, st = Math.floor((x - x0 - 1) / 4), col = st % 2 ? C.white : s.awn, colSh = st % 2 ? C.periSoft : s.awnSh;
      px(x, yT + 13, s.trim);
      for (y = yT + 14; y < yT + 18; y++) px(x, y, q === 3 ? colSh : col);
      if (q === 1 || q === 2) px(x, yT + 18, col);
    }
    var wx0 = x0 + 3, wx1 = x0 + Math.round(w * .56), wy0 = yT + 21, wy1 = yB - 1;
    for (y = wy0; y <= wy1; y++) for (x = wx0; x <= wx1; x++) px(x, y, (x === wx0 || x === wx1 || y === wy0 || y === wy1) ? s.trim : (y < wy0 + 6 ? '#F4F6FF' : '#E1E7FF'));
    for (i = 0; i < 5; i++) { px(wx0 + 3 + i, wy0 + 6 - i, C.white); px(wx0 + 4 + i, wy0 + 6 - i, C.white); }
    for (x = wx0 + 1; x < wx1; x++) px(x, wy1 - 4, s.trim);
    showItems(px, def[2], wx0, wx1, wy1 - 4);
    var dx0 = wx1 + 3, dx1 = x0 + w - 4, dy0 = yT + 22;
    for (y = dy0; y <= yB; y++) for (x = dx0; x <= dx1; x++) {
      var edge = x === dx0 || x === dx1 || y === dy0, pane = x > dx0 + 1 && x < dx1 - 1 && y > dy0 + 1 && y < dy0 + 11;
      px(x, y, edge ? s.trim : pane ? C.peri : C.navy2);
    }
    px(dx0 + 2, yT + 34, C.gold);
  }
  /* one floor of the mall: 130 x 84. Row 84 is floor n's surface (the plank row), row 0 is floor n+1's surface.
     walk: floor n is solid (the ground, a Landing); face: floor n+1 is solid (its underside shows); bal: a balcony for
     the customer; wash: how far the shops fade into the sky. Cached here (at most 32 variants). */
  function bandSprite(v, o) {
    var key = v + '|' + (o.bal ? 1 : 0) + (o.walk ? 1 : 0) + (o.face ? 1 : 0) + '|' + Math.round(o.wash * 100);
    if (BANDC[key]) return BANDC[key];
    if (++BANDN > 48) { BANDC = {}; BANDN = 1; }
    return (BANDC[key] = PX.make(130, 84, function (px, ctx) {
      var B = BANDS[v], x, y;
      shopInto(px, 1, 49, B[0]);
      shopInto(px, 54, 48, B[1]);
      [[50, 54], [102, 105]].forEach(function (pl) { for (y = o.face ? 6 : 0; y < (o.walk ? 78 : 84); y++) for (x = pl[0]; x < pl[1]; x++) px(x, y, x === pl[0] ? '#E2E7FF' : x === pl[1] - 1 ? '#B9C3F4' : '#CBD3FA'); });
      for (y = 18; y < 78; y++) for (x = 105; x < 130; x++) px(x, y, y === 18 ? '#B9C3F4' : '#DCE2FD');
      for (y = 26; y < 53; y++) for (x = 110; x < 125; x++) {
        var e = x === 110 || x === 124 || y === 26, pane = x > 111 && x < 123 && y > 27 && y < 40;
        px(x, y, e ? C.periDk : pane ? C.peri : C.navy3);
      }
      for (x = 112; x < 123; x++) { px(x, 22, C.lime); px(x, 23, C.limeDk); }
      for (y = 62; y < 72; y++) for (x = 113; x < 124; x++) px(x, y, (y === 62 || y === 71 || x === 113 || x === 123) ? C.periSh : '#EEF1FF');
      var plx = B[2] === 'plantL' ? 44 : 95;
      for (y = 73; y < 78; y++) for (x = plx; x < plx + 6; x++) px(x, y, y === 73 ? C.coralSh : C.coral);
      [[2, 66], [1, 68], [3, 68], [0, 70], [2, 70], [4, 70], [1, 71], [3, 71], [5, 69], [2, 64], [4, 66]].forEach(function (l) {
        px(plx + l[0], l[1], C.mintSh); px(plx + l[0] + 1, l[1], C.mint); px(plx + l[0], l[1] + 1, C.limeDk);
      });
      if (!o.walk) for (x = 0; x < 130; x++) px(x, 78, '#AEB9F2');
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(221,228,255,' + o.wash + ')'; ctx.fillRect(0, 0, 130, 84);
      ctx.globalCompositeOperation = 'source-over';
      if (o.walk) for (x = 0; x < 130; x++) {
        px(x, 78, C.white);
        for (y = 79; y < 83; y++) px(x, y, x % 10 === 9 ? '#EADFC4' : (Math.floor(x / 10) % 2 ? C.cream : '#FBF1D8'));
        px(x, 83, '#E2D3B0');
      }
      if (o.face) for (x = 0; x < 130; x++) { px(x, 0, C.white); px(x, 1, FACE1); px(x, 2, FACE1); px(x, 3, FACE2); px(x, 4, FACE3); px(x, 5, CEIL); }
      if (o.bal) {
        for (x = 99; x < 130; x++) { px(x, 53, C.white); px(x, 54, C.periSh); px(x, 55, C.periSh); px(x, 56, C.periDk); }
        px(99, 53, C.periSh);
        for (var i = 0; i < 5; i++) { px(103 + i, 57 + i, C.periDk); px(120 + i, 57 + i, C.periDk); }
      }
    }));
  }
  function farSprite() {
    return PX.make(130, 56, function (px, ctx) {
      var x, y, i;
      for (y = 0; y < 56; y++) for (x = 0; x < 130; x++) px(x, y, C.sky);
      for (x = 0; x < 130; x++) { px(x, 0, '#EEF1FF'); px(x, 1, '#C9D2FB'); px(x, 2, '#C9D2FB'); px(x, 3, '#D6DDFD'); }
      for (x = 0; x < 130; x++) if (x % 7 === 3) for (y = 4; y < 9; y++) px(x, y, '#D2DAFD');
      for (x = 0; x < 130; x++) px(x, 9, '#D2DAFD');
      for (i = 0; i < 7; i++) {
        var bx = i * 19 + 2;
        for (y = 22; y < 50; y++) for (x = bx; x < bx + 15; x++) px(x, y, (y === 22 || x === bx || x === bx + 14) ? '#C6CFF9' : y < 26 ? '#CFD7FC' : '#E8ECFF');
        px(bx + 4, 30, '#FFF1CC'); px(bx + 10, 34, '#FFF1CC');
      }
      for (i = 0; i < 26; i++) { var ex = 6 + i, ey = 53 - i * 2; px(ex, ey, '#BAC4F5'); px(ex + 1, ey, '#BAC4F5'); px(ex, ey + 1, '#C6CFF9'); px(ex + 2, ey - 1, '#AAB6F0'); }
      [64, 127].forEach(function (cx) { for (y = 10; y < 56; y++) { px(cx, y, '#CDD5FD'); px(cx + 1, y, '#C3CCF9'); } });
      [[20, 12, C.lime], [32, 12, C.coral], [44, 12, C.gold], [86, 13, C.peri], [98, 13, C.lime], [110, 13, C.coral]].forEach(function (b) {
        var col = mix(b[2], C.sky, .55);
        for (y = 0; y < 4; y++) for (x = -2 + y / 2; x <= 2 - y / 2; x++) px(Math.round(b[0] + x), b[1] + y, col);
      });
      for (x = 14; x < 120; x++) if (x < 50 || x > 80) px(x, 11 + Math.round(Math.sin((x - 14) / 9) * .6), '#C1CBF7');
      ctx.fillStyle = 'rgba(221,228,255,0.5)'; ctx.fillRect(0, 0, 130, 56);
    });
  }
  function slabSprite(kind) {
    var H = kind === 'ground' ? 60 : 18;
    return PX.make(130, H, function (px) {
      var x, y;
      for (x = 0; x < 130; x++) {
        px(x, 0, C.white);
        for (y = 1; y < 4; y++) px(x, y, x % 10 === 9 ? '#E6D8B4' : (Math.floor(x / 10) % 2 ? C.cream : C.paper));
        px(x, 4, '#E2D3B0'); px(x, 5, C.lime); px(x, 6, C.limeDk);
        for (y = 7; y < Math.min(H, 16); y++) px(x, y, x % 16 === 15 ? C.navy3 : C.navy2);
        if (x % 26 === 12) { px(x, 10, C.fl1); px(x + 1, 10, C.fl1); px(x, 11, C.fl2); px(x + 1, 11, C.fl2); }
        for (y = 16; y < H; y++) px(x, y, ((x * 3 + y * 7) % 19 === 0) ? C.navy2 : C.navy);
      }
      if (kind === 'landing') for (x = 0; x < 130; x++) px(x, 16, C.navy);
    });
  }
  function plankSpr(kind) {
    var pal = { gold: ['#FFE08A', C.gold, C.goldSh, C.goldDk], lime: ['#E4F99C', C.lime, C.limeSh, C.limeDk],
      coral: ['#FFB59A', C.coral, C.coralSh, '#B23A20'], flash: [C.white, C.white, C.limeSoft, C.lime] }[kind];
    return PX.outline(PX.make(PW, 6, function (px) {
      for (var y = 0; y < 6; y++) for (var x = 0; x < PW; x++) {
        if ((x === 0 || x === PW - 1) && (y === 0 || y === 5)) continue;
        px(x, y, y === 0 ? pal[0] : y < 4 ? pal[1] : y === 4 ? pal[2] : pal[3]);
      }
      px(2, 2, pal[3]); px(PW - 3, 2, pal[3]);
      for (var gx = 6; gx < PW - 6; gx += 6) { px(gx, 2, pal[2]); px(gx + 1, 2, pal[2]); }
    }), C.navy);
  }
  function sprites() {
    if (SPR) return SPR;
    SPR = {};
    SPR.far = farSprite();
    SPR.ground = slabSprite('ground'); SPR.landing = slabSprite('landing');
    SPR.plank = { gold: plankSpr('gold'), lime: plankSpr('lime'), coral: plankSpr('coral'), flash: plankSpr('flash') };
    SPR.puff = []; for (var r = 1; r <= 8; r++) SPR.puff[r] = disc(r, C.white);
    SPR.dust = []; for (r = 1; r <= 6; r++) SPR.dust[r] = disc(r, '#E9DDBD');
    SPR.star = PX.grid(['..w..', '..w..', 'wwyww', '..w..', '..w..'], { w: C.white, y: C.gold });
    /* a little rocket (nose cone, porthole, lime band, two fins, nozzle); Lau wears two, one on each side */
    SPR.rocket = PX.outline(PX.grid([
      '...nN...', '..nnNN..', '..nnNN..', '.nnnnNN.', '.brrrrB.', '.brhprB.', '.brpprB.', '.brrrrB.',
      '.bbbbbB.', '.sssssS.', '.bbbbbB.', 'fbbbbbBF', 'fbbbbbBF', 'ff.kk.FF', 'f..kk..F'
    ], { n: C.coral, N: C.coralSh, b: C.white, B: '#C9D0EE', r: C.navy, h: C.white, p: C.peri, s: C.lime, S: C.limeDk,
      f: C.coral, F: C.coralSh, k: C.greyDk }), C.navy);
    SPR.sweat = PX.grid(['..n...', '.nbn..', '.nbbn.', 'nbwbbn', 'nbwbbn', 'nbbbbn', '.nnnn.'], { n: C.navy, b: '#8FD0FF', w: C.white });
    SPR.pennant = [0, 1].map(function (f) {
      return PX.outline(PX.grid(f ? ['ggggggg.', 'gGGGGGgg', 'ggggggg.', 'gggg....'] : ['gggggg..', 'gGGGGGGg', 'gggggggg', 'ggg.....'], { g: C.gold, G: C.goldSh }), C.navy);
    });
    SPR.bolo = PX.bolo({ look: [0, -1] }); SPR.boloFwd = PX.bolo({ look: [0, 0] });
    return SPR;
  }
  /* customers: 0 the kit's peri shirt, 1 mint shirt + brown hair, 2 gold shirt. mood 'sad' = 'meh' with a frown */
  var CPAL = [null, [[0x8C, 0x9E, 0xFF, C.mint], [0x6E, 0x81, 0xEE, C.mintSh], [0x16, 0x16, 0x1A, '#3A2218']],
    [[0x8C, 0x9E, 0xFF, C.gold], [0x6E, 0x81, 0xEE, C.goldSh]]];
  function cust(which, mood, thumb) {
    var key = which + '|' + mood + '|' + (thumb ? 1 : 0);
    if (CC[key]) return CC[key];
    var sad = mood === 'sad', base = PX.customer({ mood: sad ? 'meh' : mood, thumb: thumb });
    var cv = document.createElement('canvas'); cv.width = base.width; cv.height = base.height;
    var x = cv.getContext('2d'); x.drawImage(base, 0, 0);
    if (sad) { x.fillStyle = C.hair; x.fillRect(8, 12, 1, 1); x.fillRect(12, 12, 1, 1); }
    var pal = CPAL[which];
    if (pal) {
      var d = x.getImageData(0, 0, cv.width, cv.height), a = d.data;
      for (var i = 0; i < a.length; i += 4) for (var m = 0; m < pal.length; m++) {
        var f = pal[m];
        if (a[i] === f[0] && a[i + 1] === f[1] && a[i + 2] === f[2]) { var to = rgb(f[3]); a[i] = to[0]; a[i + 1] = to[1]; a[i + 2] = to[2]; break; }
      }
      x.putImageData(d, 0, 0);
    }
    return (CC[key] = cv);
  }
  /* warm-up: every mall band variant, the 3 customers in each mood and Lau's usual poses are built a couple per frame
     during the opening iris (once per page load), so no floor stalls the first time it scrolls into view */
  function warmList() {
    var L = [], v, k, w, m;
    for (v = 0; v < 4; v++) for (k = 0; k < 2; k++) for (var f = 0; f < 2; f++) for (w = 0; w < 2; w++)
      L.push(bandSprite.bind(null, v, { bal: !k, walk: !!k, face: !!f, wash: w ? WASH_ON : WASH }));
    var moods = [['meh', false], ['sad', false], ['happy', true], ['happy', false]];
    for (v = 0; v < 3; v++) for (m = 0; m < moods.length; m++) L.push(cust.bind(null, v, moods[m][0], moods[m][1]));
    var looks = [[.2, -.6], [.1, .6], [.2, -.8], [1, -.3], [-1, -.3], [1, 0]], lm = [['happy', 0], ['happy', 1], ['joy', 0], ['hurt', 0]];
    looks.forEach(function (lk) {
      lm.forEach(function (mb) { L.push(function () { for (var fr = 0; fr < 4; fr++) PX.lau({ h: 20, frame: fr, look: lk, mood: mb[0], blink: mb[1] }); }); });
    });
    return L;
  }
  function warmStep(n) {
    if (!WARM) return;
    for (var i = 0; i < n && WARM.length; i++) { try { WARM.shift()(); } catch (e) {} }
    if (!WARM.length) WARM = false;
  }

  /* ======================================================================================================
     layout: everything from the screen edges
     ====================================================================================================== */
  function geo(R) {
    var Gg = R.G, s = R.s, key = Gg.SH + '|' + Gg.bot + '|' + R.layout.hudY;
    if (s.geo && s.geo.key === key) return s.geo;
    var stripH = Gg.SH < 760 ? 84 : 96, stripTop = Gg.SH - Gg.bot - stripH;
    var cTop = Math.round(R.layout.hudY + 26);
    s.geo = { key: key, stripH: stripH, stripTop: stripTop, BASE: Math.floor(stripTop / 3) - 23, cTop: cTop,
      landGy: Math.round(clamp(Gg.SH - 512, cTop + 130, 345) / 3), bubTop: cTop + 46, grad: null };   // the Landing sits above the Say-it card
    return s.geo;
  }
  function gyOf(Y) { return S.geo.BASE - (Y - S.cam); }
  function standardCam(n) { return FY(n); }
  function landingCam(R, n) { var g = geo(R); return FY(n) - (g.BASE - g.landGy); }

  /* every layout of 3 planks (centres 14..116, 34..58 apart); a row keeps Lau's spot clear and stays in reach.
     The clear gap over Lau is as wide as the layout allows: with 3 planks of 26 px in a 130 px tower, a Lau standing
     dead centre only leaves room for 17 px (the planks either side must be 34+ apart from the third), but anywhere
     else 20 to 26 px fit, so a short brush of a hold button rarely carries him onto a plank by itself. */
  var TRIPLES = null;
  function triples() {
    if (TRIPLES) return TRIPLES;
    TRIPLES = [];
    for (var a = 14; a <= 116; a += 2) for (var d1 = SP_MIN; d1 <= SP_MAX; d1 += 2) for (var d2 = SP_MIN; d2 <= SP_MAX; d2 += 2) {
      if (a + d1 + d2 <= 116) TRIPLES.push([a, a + d1, a + d1 + d2]);
    }
    return TRIPLES;
  }
  function layout(hx, solid) {
    var all = triples(), i, gi, best = null;
    function clearOf(t) { var m = 999; for (var k = 0; k < 3; k++) m = Math.min(m, Math.abs(t[k] - hx)); return m; }
    function reach(t) { for (var k = 0; k < 3; k++) if (Math.abs(t[k] - hx) > REACH) return false; return true; }
    var tiers = GAPS.map(function () { return []; }), loose = [];
    for (i = 0; i < all.length; i++) {
      var t = all[i], c = clearOf(t);
      if (c < GAP) continue;
      if (!solid && !reach(t)) { loose.push(t); continue; }
      for (gi = 0; gi < GAPS.length; gi++) if (c >= GAPS[gi] && (gi > 0 || Math.min(t[1] - t[0], t[2] - t[1]) >= SP_EASY)) { tiers[gi].push(t); break; }
    }
    for (gi = 0; gi < tiers.length && !best; gi++) if (tiers[gi].length) best = tiers[gi];
    if (!best) best = loose.length ? loose : all;
    return U.pick(best).slice();
  }

  /* ======================================================================================================
     the run
     ====================================================================================================== */
  function setPhase(R, ph) { R.s.phase = ph; R.phase = ph; }
  function ended(R) { return R.over || !!(R.s && R.s.endGate); }      // the run is over (or ending once the finger lifts)
  function note(R, text, dur, col) { R.s.note = { text: text, t0: R.t, dur: dur || 1.6, col: col || C.navy }; }
  function banner(R, text, fill, dur) { R.s.banner = { text: text, fill: fill || C.gold, t0: R.t, dur: dur || 1.2 }; }
  function isLanding(s, n) {
    if (s.fl[n] && s.fl[n].type === 'landing') return true;
    return n === s.nextLanding;
  }
  function solidFloor(s, n) { return n === 1 || isLanding(s, n); }
  function nextLandingFrom(base) {
    if (LANDING_MODE === 'literal') return (Math.floor(base / 5) + 1) * 5;
    return base === 1 ? 5 : base + STRETCH;
  }

  function init(R) {
    sprites();
    var s = R.s = {};
    S = s; G = R.G;
    s.phase = 'intro'; R.phase = 'intro';
    s.floor = 1; s.top = 1; R.score = 1;
    s.cam = 0; s.camA = null;
    s.home = { solid: true, kind: 'ground', x: null };
    s.fl = { 1: { type: 'ground' } };
    s.nextLanding = nextLandingFrom(1);
    s.lau = { x: 35, Y: 0, vy: 0, mode: 'contact', ct0: 0, until: .3, sq: 0, nextV: V0, center: null, nudge: null,
      after: null, falling: false, bounces: 0, mood: 'happy', moodUntil: 0, face: 1, steerT: -9, stand: false };
    s.row = null; s.prevRow = null; s.custN = 0; s.queue = []; s.usedNeed = {}; s.missN = {}; s.said = {}; s.lastRight = null;
    s.left = ROUND; s.clockOn = false; s.steered = false; s.holdT = { left: -9, right: -9 };
    s.dust = []; s.rings = []; s.note = null; s.banner = null; s.drop = null; s.bolo = null; s.cut = null; s.rk = null;
    s.lcust = null; s.homeDipT = -9; s.stunT = -9; s.ctrT = -9; s.ctr = 'Floor 1'; s.sat = { n: 1, prev: 0, t0: -9 };
    s.newBest = false; s.geo = null;
    s.relT = -9; s.hopT = -9; s.hopHold = 0; s.sayGate = null; s.endGate = null; s.flList = [1]; s.slipT = -9; s.slips = 0;
    s.prevBest = null;
    if (typeof R.best === 'number') s.prevBest = R.best;               // the engine's previous best, once it is shared
    else try { var st = ARC.debug && ARC.debug.state ? ARC.debug.state() : null; if (st && st.b && typeof st.b.g22 === 'number') s.prevBest = st.b.g22; } catch (e) {}
    RM = reduceMotion();
    if (WARM === null) WARM = warmList();
    /* a finger still down when a card opens must not press the card's button when it lifts: cancel the click that a
       touch on the canvas would turn into (the engine's pointer handlers do not need it) */
    if (!guardFn) guardFn = function (e) { if (e.cancelable) e.preventDefault(); };
    try { R.G.cv.addEventListener('touchend', guardFn, { passive: false }); } catch (e) {}
    geo(R);
    R.after(.9, function () { s.clockOn = true; buildRow(R, 2); });
  }
  var guardFn = null;
  function setFl(s, n, f) { if (!s.fl[n]) s.flList.push(n); s.fl[n] = f; }

  /* ---------- the words: each floor takes the next word and one of its customer needs ---------- */
  function refill(s) {
    var missed = U.shuffle(BK.WORDS.filter(function (w) { return s.missN[w]; }));
    var rest = U.shuffle(BK.WORDS.filter(function (w) { return !s.missN[w]; }));
    var q = missed.concat(rest);
    if (q[0] === s.lastSlug && q.length > 1) { var t = q[0]; q[0] = q[1]; q[1] = t; }
    return q;
  }
  function nextNeed(s) {
    if (!s.queue.length) s.queue = refill(s);
    var slug = s.queue.shift(); s.lastSlug = slug;
    var needs = BK.NEEDS[slug], unused = needs.filter(function (n) { return !s.usedNeed[n.text]; });
    var n = U.pick(unused.length ? unused : needs); s.usedNeed[n.text] = 1;
    return { slug: slug, text: n.text, decoys: n.decoys.slice() };
  }
  function requeue(s, slug) {
    var i = s.queue.indexOf(slug); if (i >= 0 && i < 3) return;
    if (i >= 0) s.queue.splice(i, 1);
    s.queue.splice(Math.min(2, s.queue.length), 0, slug);     // a missed word comes back 3 floors later
  }

  function buildRow(R, floor) {
    var s = R.s; if (ended(R)) return;
    var it = nextNeed(s), xs = layout(s.home.solid ? s.lau.x : s.home.x, s.home.solid), opts = U.shuffle([it.slug].concat(it.decoys));
    var row = { floor: floor, slug: it.slug, need: it.text, t0: R.t, live: false, lock: false, wrong: 0, hintT: -9, done: false, tHit: -9, wordT: -9,
      planks: opts.map(function (o, i) { return { slug: o, label: BK.label(o), right: o === it.slug, x: xs[i], x0: xs[i], x1: xs[i], mT: -9, tp: R.t + i * .07, st: 'live', tS: -9, wT: -9 }; }),
      cust: { which: s.custN++ % 3, tIn: R.t, tHappy: -9, tSad: -9, tOut: -9 } };
    s.row = row;
    R.after(.12, function () { if (s.row === row && !ended(R)) row.live = true; });
    R.sfx('pop');
    if (s.phase === 'catch') row.lock = true;
    else if (s.phase !== 'over') setPhase(R, 'climb');
    R.announce('Floor ' + floor + '. The customer says: ' + it.text + ' Planks: ' + row.planks.map(function (q) { return q.label; }).join(', ') + '.');
  }

  /* ---------- Lau's physics ---------- */
  function canSteer(s) {
    var L = s.lau;
    if (L.mode === 'script' || L.stand || L.center != null) return false;
    if (s.phase === 'wait') return !!s.home.solid;          // between rows on a narrow plank: no drifting off it
    return s.phase === 'climb' || s.phase === 'intro';
  }
  function contact(R, Y, o) {
    var L = R.s.lau; o = o || {};
    L.mode = 'contact'; L.hover = false; L.Y = Y; L.vy = 0; L.ct0 = R.t; L.until = R.t + (o.dur || CONTACT); L.sq = o.sq == null ? .2 : o.sq;
    L.nextV = o.v || V0; L.stun = !!o.stun; L.spring = !!o.spring;
  }
  function launch(R) {
    var L = R.s.lau;
    L.mode = 'air'; L.vy = L.nextV || V0; L.nextV = 0; L.stun = false; L.spring = false;
  }
  function stepLau(R, dt) {
    var s = R.s, L = s.lau;
    if (L.mode === 'script') return;
    var dir = canSteer(s) && !ended(R) ? (R.input.right ? 1 : 0) - (R.input.left ? 1 : 0) : 0;
    if (dir) { L.x = clamp(L.x + dir * VX * dt, XMIN, XMAX); L.face = dir; L.steerT = R.t; L.nudge = null; }
    if (L.nudge != null) { L.x += (L.nudge - L.x) * Math.min(1, dt * 22); if (Math.abs(L.x - L.nudge) < .2) { L.x = L.nudge; L.nudge = null; } }
    if (L.center != null) { L.x += (L.center - L.x) * Math.min(1, dt * 7); if (Math.abs(L.x - L.center) < .25) L.x = L.center; }
    if (L.mode === 'contact') { if (!L.stand && R.t >= L.until) launch(R); return; }
    /* hold to steer, let go to land: while a direction is held Lau floats just above the next row (a flame hover),
       so passing over a plank never lands him on it; letting go drops him onto whatever is under him */
    var row = s.row, hov = dir && row && row.live && !row.lock && !L.falling ? FY(row.floor) + HOVER : null;
    if (L.hover && hov != null) { L.vy = 0; L.Y += (hov - L.Y) * Math.min(1, dt * 14); return; }
    if (L.hover) { L.hover = false; L.vy = 0; }
    var y0 = L.Y; L.vy -= GRAV * dt; L.Y += L.vy * dt;
    if (hov != null && L.vy < 0 && y0 >= hov - .5 && L.Y < hov) { L.Y = hov; L.vy = 0; L.hover = true; L.hoverT = R.t; return; }
    if (L.vy < 0) collide(R, y0);
  }
  function collide(R, y0) {
    var s = R.s, L = s.lau, row = s.row;
    if (row && row.live && !row.lock && !ended(R) && !L.falling) {
      var Yr = FY(row.floor);
      if (y0 >= Yr && L.Y < Yr) {
        var hit = null, best = 99;
        row.planks.forEach(function (q) { if (q.st !== 'live') return; var d = Math.abs(L.x - q.x); if (d <= HW + TOL && d < best) { best = d; hit = q; } });
        if (hit) { L.Y = Yr; landRow(R, hit); return; }
      }
    }
    var h = s.home, Yh = FY(s.floor);
    if (!L.falling && y0 >= Yh && L.Y < Yh) {
      if (h.solid || ended(R) || Math.abs(L.x - h.x) <= HW + HOME_TOL) {
        if (!h.solid) { var nx = clamp(L.x, h.x - HW + 3, h.x + HW - 3); if (nx !== L.x) L.nudge = nx; }
        landHome(R);
        return;
      }
      L.falling = true; L.mood = 'hurt'; L.moodUntil = R.t + 2;
    }
    if (L.falling && L.Y < Yh - 3) {
      if (!ended(R)) { boloCatch(R); return; }
      L.falling = false; L.Y = Yh;                            // the clock ran out mid-fall: no heart lost after the end
      if (!h.solid) L.nudge = clamp(L.x, h.x - HW + 3, h.x + HW - 3);
      landHome(R);
    }
  }
  function landHome(R) {
    var s = R.s, L = s.lau, after = L.after;
    L.after = null;
    var big = L.vy < -V0 * 1.05;
    contact(R, FY(s.floor), { sq: big ? .26 : .18, dur: big ? .1 : CONTACT });
    s.homeDipT = R.t;
    L.bounces++;
    if (L.bounces % 2 === 0 || big) R.sfx('land');
    s.dust.push({ t0: R.t, x: L.x, Y: FY(s.floor), big: big ? 1.3 : (s.home.solid ? 1 : .7), dusty: !!s.home.solid });
    if (s.dust.length > 5) s.dust.shift();
    if (after) after();
  }
  function landRow(R, q) {
    var row = R.s.row;
    row.live = false; R.s.lau.hover = false;
    if (q.right) rightPlank(R, q); else wrongPlank(R, q);
  }

  /* ---------- a right plank: spring, word, up a floor ---------- */
  function rightPlank(R, q) {
    var s = R.s, row = s.row, L = s.lau, t = R.t;
    q.st = 'hit'; q.tS = t; row.done = true; row.tHit = t;
    row.cust.tHappy = t; row.cust.tOut = t + .9;
    var sy = gyOf(FY(row.floor)) * 3;
    if (row.wrong > 0) R.announce(BK.label(row.slug) + '. Up a floor.');   // the answer was shown: a fix, not a right answer
    else {
      R.good(row.slug, { sparks: 1, from: [q.x * 3, sy - 24] });
      R.float('+1', clamp(q.x * 3 + 60, 30, 360), sy - 26, C.navy);
    }
    R.burst(q.x, gyOf(FY(row.floor)), 18, [C.lime, C.gold, C.white, C.mint]);
    R.sfx('spring');
    s.rings.push({ t0: t, x: q.x, Y: FY(row.floor) });
    R.after(.5, function () { if (!R.dead) { R.word(row.slug); row.wordT = R.t; } });
    L.mood = 'joy'; L.moodUntil = t + 1.1; L.nudge = null;
    s.lastRight = row.slug;
    s.floor = row.floor; s.home = { solid: false, x: q.x, kind: 'lime' };
    setFl(s, row.floor, { type: 'plank', x: q.x, kind: 'lime' });
    s.prevRow = row; s.row = null;
    setTop(R, row.floor); counter(R); satTo(R, row.floor);
    if (isLanding(s, row.floor + 1)) { toLanding(R, q); return; }
    contact(R, FY(row.floor), { sq: .28, dur: .13, v: V_SPRING, spring: true });
    L.center = q.x;
    L.after = function () { L.center = null; if (ended(R)) return; setPhase(R, 'wait'); R.after(.15, function () { buildRow(R, s.floor + 1); }); };
    camTo(R, standardCam(row.floor), .8);
    setPhase(R, 'spring');
  }

  /* ---------- a wrong plank: crumble, drop back, the right one glows, reshuffle ---------- */
  function wrongPlank(R, q) {
    var s = R.s, row = s.row, L = s.lau, t = R.t;
    q.st = 'crack'; q.tS = t; q.wT = t; q.wx = q.x;
    row.wrong++; if (row.hintT < 0) row.hintT = t + .12;
    row.cust.tSad = t;
    var right = null; row.planks.forEach(function (x) { if (x.right) right = x; });
    /* only the first deliberate answer on a floor is marked wrong: the finger let go over this plank (or just before
       he dropped onto it). A brush early in the rise that lets him drift onto a plank is exploring, not an answer. */
    var deliberate = R.t - s.relT <= REL_WIN || (s.hopT === L.ct0 && s.hopHold >= STEER_MIN);   // this hop's steering
    if (row.wrong === 1) {
      if (deliberate) {
        R.bad(row.slug, row.need);
        s.missN[row.slug] = (s.missN[row.slug] || 0) + 1;
      } else s.slips = (s.slips || 0) + 1;
      requeue(s, row.slug);                                   // either way the word comes back for a real answer
    }
    note(R, right.label + ' answers it', 1.8, C.navy);
    if (row.wrong === 1 && !deliberate) s.slipT = t;          // re-show the "let go over a plank" hint
    R.announce('Not that one. ' + right.label + ' answers it.');
    R.sfx('crack'); R.shake(4);
    R.burst(q.x, gyOf(FY(row.floor)) + 2, 12, [C.coral, C.coralSh, C.navy, C.white]);
    L.mood = 'hurt'; L.moodUntil = t + 1.4; L.nudge = null;
    row.lock = true;
    setPhase(R, 'wrong');
    L.mode = 'script'; L.Y = FY(row.floor); L.vy = 0;
    s.drop = { t0: t, tx: s.home.solid ? L.x : s.home.x, air: false };
    R.after(.1, function () { if (q.st === 'crack') { q.st = 'crumble'; q.tS = R.t; } });
  }
  function stepDrop(R, dt) {
    var s = R.s, L = s.lau, d = s.drop, u = R.t - d.t0;
    if (u < .1) return;                                       // stands on the cracking plank for a beat
    if (!d.air) { d.air = true; L.vy = Math.sqrt(2 * GRAV * 10); }
    L.vy -= GRAV * dt; L.Y += L.vy * dt; L.x += (d.tx - L.x) * Math.min(1, dt * 7);
    var Yh = FY(s.floor);
    if (L.vy < 0 && L.Y <= Yh) {
      L.x = Math.abs(L.x - d.tx) < 2 ? d.tx : L.x;
      s.drop = null;
      contact(R, Yh, { sq: .25, dur: .24, stun: true });
      s.stunT = R.t; s.homeDipT = R.t;
      s.dust.push({ t0: R.t, x: L.x, Y: Yh, big: 1.4, dusty: !!s.home.solid });
      R.sfx('land'); R.shake(3);
      R.after(.3, function () { reshuffle(R); });
    }
  }
  function reshuffle(R) {
    var s = R.s, row = s.row; if (!row || ended(R)) return;
    var xs = layout(s.home.solid ? s.lau.x : s.home.x, s.home.solid);
    var order = [0, 1, 2], ri = 0;
    row.planks.forEach(function (q, i) { if (q.right) ri = i; });
    for (var k = 0; k < 6; k++) { order = U.shuffle([0, 1, 2]); if (Math.abs(xs[order[ri]] - row.planks[ri].x) > 6) break; }
    row.planks.forEach(function (q, i) {
      var nx = xs[order[i]];
      if (q.st === 'crumble' || q.st === 'crack') { q.st = 'reform'; q.tS = R.t; q.x0 = nx; q.x1 = nx; q.x = nx; }
      else { q.x0 = q.x; q.x1 = nx; q.mT = R.t; }
    });
    R.sfx('step');
    setPhase(R, 'shuffle');
    R.after(.55, function () {
      if (s.row !== row || ended(R)) return;
      row.planks.forEach(function (q) { q.x = q.x1; q.x0 = q.x1; if (q.st === 'reform') q.st = 'live'; });
      row.lock = false; row.live = true;
      if (s.phase === 'shuffle') setPhase(R, 'climb');
    });
  }
  function plankX(q, t) { return q.mT > 0 && t < q.mT + .5 ? lerp(q.x0, q.x1, E.inOut(clamp((t - q.mT) / .5))) : q.x; }

  /* ---------- a miss: Lau falls past his plank and Bolo catches him (= a heart) ---------- */
  function boloCatch(R) {
    var s = R.s, L = s.lau, t = R.t;
    L.falling = false; L.mode = 'script'; L.nudge = null; L.hover = false;
    s.bolo = { t0: t, x0: L.x, Y0: FY(s.floor) - 3, hx: s.home.x, side: L.x < 65 ? -1 : 1, done: false };
    L.Y = s.bolo.Y0;
    var left = R.loseHeart();
    R.sfx('hurt'); R.shake(4);
    L.mood = 'hurt'; L.moodUntil = t + 1.3;
    note(R, left > 0 ? 'Bolo caught you' : 'Bolo caught you. Out of hearts', 1.6, C.navy);
    if (s.row) s.row.lock = true;
    setPhase(R, 'catch');
    R.announce('Lau fell. Bolo caught him. ' + left + (left === 1 ? ' heart' : ' hearts') + ' left.');
  }
  function stepBolo(R) {
    var s = R.s, L = s.lau, b = s.bolo, u = R.t - b.t0, Yh = FY(s.floor);
    if (b.done) { if (u > 1.7) s.bolo = null; return; }
    if (u < .25) { L.x = b.x0; L.Y = b.Y0 - 3 * Math.sin(Math.PI * clamp(u / .25)); }
    else if (u < .95) { var w = E.inOut((u - .25) / .7); L.x = lerp(b.x0, b.hx, w); L.Y = lerp(b.Y0, Yh + 16, w) + 2 * Math.sin((u - .25) * 18); }
    else if (u < 1.2) { var w2 = (u - .95) / .25; L.x = b.hx; L.Y = Yh + 16 * (1 - w2) + 26 * w2 * (1 - w2); }
    else {
      b.done = true;
      contact(R, Yh, { sq: .22, dur: .1 });
      s.homeDipT = R.t; R.sfx('land');
      if (R.hearts <= 0) { if (!R.over) { setPhase(R, 'over'); endRun(R, { reason: 'out', score: s.top, scoreLabel: floorsLabel(s.top), delay: 1.1 }); } return; }
      if (s.row) { s.row.lock = false; setPhase(R, 'climb'); } else setPhase(R, 'wait');
    }
  }
  function boloPos(R) {
    var s = R.s, b = s.bolo; if (!b) return null;
    var u = R.t - b.t0, L = s.lau;
    if (u < .95) return { x: L.x, Y: L.Y, sc: E.outBackBig(clamp(u / .14)), a: 1, under: true };
    var d = Math.max(0, u - 1.0);
    return { x: b.hx + b.side * d * 90, Y: FY(s.floor) + 16 + d * 60 + 30 * d * d, sc: 1, a: 1 - clamp((d - .35) / .35), under: false };
  }

  /* ---------- Landings: the super spring and cut, the Say-it card, the rocket ---------- */
  function toLanding(R, q) {
    var s = R.s, L = s.lau, Lf = s.floor + 1;
    setPhase(R, 'landing');
    contact(R, FY(s.floor), { sq: .3, dur: .13, v: V_SUPER, spring: true });
    L.center = q.x;
    s.cut = { t0: R.t + .13, floor: Lf, cam0: s.cam, done: false };
    R.after(.13, function () { R.sfx('whoosh'); });
  }
  function stepCut(R) {
    var s = R.s, c = s.cut, L = s.lau, u = R.t - c.t0;
    if (c.done) { if (u > 1.2) s.cut = null; return; }
    if (u < 0) return;
    if (c.camS == null) { c.camS = s.cam; c.Y0 = L.Y; L.mode = 'script'; L.vy = 0; s.camA = null; }
    var rush = RM ? .12 : .26;                                // a shorter rush under reduced motion (and no flash)
    if (u < rush) {
      var w = clamp(u / rush);
      s.cam = lerp(c.camS, standardCam(s.floor) + 120, E.in(w));
      L.Y = c.Y0 + (s.cam - c.camS) + 70 * E.out(w);
      return;
    }
    /* the cut (under the white flash): Lau is on the Landing */
    c.done = true;
    var Lf = c.floor;
    s.floor = Lf; s.home = { solid: true, kind: 'landing', x: null };
    setFl(s, Lf, { type: 'landing' });
    setTop(R, Lf); counter(R); satTo(R, Lf);
    s.prevRow = null;
    L.center = null; L.nudge = null; L.x = LX; L.mode = 'air'; L.vy = -60; L.Y = FY(Lf) + 24;
    var camL = landingCam(R, Lf);
    s.cam = camL + 12; camTo(R, camL, .22, E.out);
    L.after = function () { arriveLanding(R); };
    R.after(.02, function () { R.sfx('bump'); });
  }
  function arriveLanding(R) {
    var s = R.s, L = s.lau;
    L.stand = true; L.mode = 'contact'; L.until = R.t + 9; L.sq = .25; L.ct0 = R.t;
    R.shake(3);
    s.lcust = { t0: R.t + .1, which: s.custN++ % 3, x1: Math.min(L.x + 22, 116), happyT: -9, outT: -9, floor: s.floor };
    s.sayGate = { at: R.t + .85, free: -1, t0: R.t, told: false };       // opened from update once no finger is down
  }
  /* the Say-it card opens 0.25 s after the last finger leaves the hold buttons (its tap-check link sits right where the
     right-hand button is). A finger held for 3 s more opens it anyway: a long press never becomes a click on a phone. */
  function stepSayGate(R) {
    var s = R.s, g = s.sayGate; if (!g || ended(R)) return;
    var held = R.input.left || R.input.right;
    if (held) g.free = -1; else if (g.free < 0) g.free = R.t;
    if (R.t < g.at) return;
    if (held && !g.told && R.t > g.at + .4) { g.told = true; note(R, 'Let go to talk to the customer', 2.4, C.navy); }
    if ((g.free >= 0 && R.t >= g.free + .25) || R.t > g.at + 3) { s.sayGate = null; landingSay(R); }
  }
  /* end the run, but only once no finger is on the hold buttons (the end card's buttons sit there); the card still
     comes up `delay` s after the call, so it never appears under a finger that is lifting */
  function endRun(R, o) {
    var s = R.s;
    if (R.over || s.endGate) return;
    s.endGate = { o: o, t0: R.t };
    stepEndGate(R);
  }
  function stepEndGate(R) {
    var s = R.s, g = s.endGate; if (!g || R.over) return;
    var held = R.input.left || R.input.right, waited = R.t - g.t0;
    if (held && waited < 3) return;
    var o = g.o; o.delay = Math.max(.6, (o.delay == null ? .6 : o.delay) - waited);
    R.end(o);
  }
  function sayWord(s) {
    var best = null, n = 0;
    Object.keys(s.missN).forEach(function (w) { if (!s.said[w] && s.missN[w] > n) { n = s.missN[w]; best = w; } });
    if (!best) best = s.lastRight && !s.said[s.lastRight] ? s.lastRight : null;
    if (!best) { var pool = BK.WORDS.filter(function (w) { return !s.said[w]; }); best = pool.length ? U.pick(pool) : (s.lastRight || 'ssd'); }
    return best;
  }
  function landingSay(R) {
    var s = R.s, slug = sayWord(s);
    s.said[slug] = 1;
    setPhase(R, 'say');
    var asked = R.say({ slug: slug, title: 'Tell the customer', sub: 'Say it clearly for a rocket', tip: BK.TIPS[slug] });
    frameAboveCard(R);
    asked.then(function (res) {
      if (R.dead) return;
      if (res.passed) {
        s.lcust.happyT = R.t;
        R.after(.25, function () { rocket(R, res.method === 'tap' ? ROCKET_TAP : ROCKET); });
        setPhase(R, 'rocket');
      } else {
        note(R, 'Keep practising: ' + BK.word(slug).say, 1.9, C.navy);
        s.lcust.outT = R.t + .4;
        resumeFromLanding(R);
      }
    });
  }
  /* the card is open (the game is frozen): keep Lau and the customer in view just above its top edge */
  function frameAboveCard(R) {
    try {
      var s = R.s, g = geo(R), card = R.el.querySelector('.arc-say'); if (!card) return;
      var top = card.offsetTop / R.G.css;                       // offsetTop ignores the slide-up animation
      var want = clamp(Math.floor((top - 10) / 3), Math.ceil((g.cTop + 130) / 3), g.BASE);
      var cur = gyOf(FY(s.floor));
      if (Math.abs(cur - want) < 2) return;
      s.cam = FY(s.floor) - (g.BASE - want); s.camA = null;
      R.dirty = true;
    } catch (e) {}
  }
  function resumeFromLanding(R) {
    var s = R.s, L = s.lau;
    setPhase(R, 'wait');
    L.stand = false; L.until = R.t + .05;
    camTo(R, standardCam(s.floor), .7);
    s.nextLanding = nextLandingFrom(s.floor);
    R.after(.9, function () { buildRow(R, s.floor + 1); });
  }
  function decorXs(n) { var a = 18 + Math.floor(hash(n * 3.7) * 22); return [a, a + 58 + Math.floor(hash(n * 1.3) * 22)]; }
  function rocket(R, k) {
    var s = R.s, L = s.lau, Lf = s.floor;
    setPhase(R, 'rocket');
    L.stand = false; L.mode = 'script'; L.vy = 0;
    s.rk = { t0: R.t, k: k, from: Lf, to: Lf + k, Y0: FY(Lf), x0: L.x, cam0: s.cam, passed: 0, landed: false, tap: k < ROCKET };
    for (var i = 1; i < k; i++) setFl(s, Lf + i, { type: 'decor', xs: decorXs(Lf + i) });
    setFl(s, Lf + k, { type: 'gold', x: 65 });
    s.nextLanding = nextLandingFrom(Lf + k);
    s.camA = null;
    R.sfx('powerup'); R.after(.1, function () { R.sfx('whoosh'); });
    banner(R, 'ROCKET', C.gold, 1.15);
    R.burst(L.x - RX, gyOf(FY(Lf) + 6) - 6, 10, [C.fl2, C.fl3, C.gold, C.lime]);
    R.burst(L.x + RX, gyOf(FY(Lf) + 6) - 6, 10, [C.fl2, C.fl3, C.gold, C.lime]);
    s.lcust.happyT = s.lcust.happyT > 0 ? s.lcust.happyT : R.t;
  }
  function rkR(u) { return (1 - Math.cos(Math.PI * u)) / 2; }
  function rkFeet(rk, t) {
    var u = t - rk.t0;
    if (u < .08) return rk.Y0 + 12 * E.out(clamp(u / .08));
    if (u < RK_IGN) return rk.Y0 + 12;
    var w = clamp((u - RK_IGN) / RK_DUR), top = FY(rk.to) + 92;
    if (w < 1) return rk.Y0 + 12 + (top - rk.Y0 - 12) * rkR(w);
    return top - (top - FY(rk.to)) * E.in(clamp((u - RK_IGN - RK_DUR) / RK_FALL));
  }
  function stepRocket(R) {
    var s = R.s, rk = s.rk, L = s.lau, t = R.t, u = t - rk.t0;
    if (rk.landed) { if (u > RK_IGN + RK_DUR + 1.5) s.rk = null; return; }
    L.Y = rkFeet(rk, t);
    var w = clamp((u - RK_IGN) / RK_DUR);
    L.x = lerp(rk.x0, 65, E.inOut(w));
    var fly = u >= RK_IGN && u < RK_IGN + RK_DUR;
    if (u < RK_IGN + RK_DUR) { var sn = RM ? 0 : Math.sin(Math.PI * w); s.cam = rk.cam0 + (standardCam(rk.to) - 34 - rk.cam0) * rkR(w) - 38 * sn * sn; }
    else s.cam = lerp(standardCam(rk.to) - 34, standardCam(rk.to), E.inOut(clamp((u - RK_IGN - RK_DUR) / RK_FALL)));
    /* floors passed: the counter flips, +1 spark each */
    while (rk.passed < rk.k && L.Y >= FY(rk.from + rk.passed + 1) && fly) {
      rk.passed++;
      var n = rk.from + rk.passed;
      s.floor = n; setTop(R, n); counter(R); satTo(R, n);
      R.addSparks(1, L.x * 3, gyOf(L.Y) * 3 - 30);
    }
    if (u >= RK_IGN + RK_DUR + RK_FALL) {
      rk.landed = true;
      while (rk.passed < rk.k) { rk.passed++; s.floor = rk.from + rk.passed; setTop(R, s.floor); counter(R); R.addSparks(1, L.x * 3, gyOf(L.Y) * 3 - 30); }
      s.floor = rk.to; s.cam = standardCam(rk.to);
      s.home = { solid: false, x: 65, kind: 'gold' };
      L.x = 65; L.vy = -V0 * 1.3; L.Y = FY(rk.to);
      landHome(R);
      L.mood = 'joy'; L.moodUntil = t + .8;
      R.shake(3);
      setPhase(R, 'wait');
      R.after(.45, function () { buildRow(R, s.floor + 1); });
    }
  }

  /* ---------- camera, counter, colour of the floor Lau is on, best floor ---------- */
  function camTo(R, to, dur, ease) { var s = R.s; s.camA = { from: s.cam, to: to, t0: R.t, dur: dur, e: ease || E.inOut }; }
  function camUpdate(R) {
    var s = R.s, a = s.camA; if (!a) return;
    var w = clamp((R.t - a.t0) / a.dur);
    s.cam = lerp(a.from, a.to, a.e(w));
    if (w >= 1) s.camA = null;
  }
  function counter(R) { var s = R.s; s.ctr = 'Floor ' + s.floor + (isLanding(s, s.floor) && s.fl[s.floor] && s.fl[s.floor].type === 'landing' ? ' · Landing' : ''); s.ctrT = R.t; }
  function satTo(R, n) { var s = R.s; if (s.sat.n === n) return; s.sat = { n: n, prev: s.sat.n, t0: R.t }; }
  function satOf(s, n, t) {
    var w = clamp((t - s.sat.t0) / .8), v = 0;
    if (n === s.sat.n) v = Math.max(v, w);
    if (n === s.sat.prev) v = Math.max(v, 1 - w);
    return v;
  }
  function setTop(R, n) {
    var s = R.s;
    if (n <= s.top) return;
    s.top = n; R.score = n;
    if (!s.newBest && s.prevBest != null && s.prevBest >= 3 && n > s.prevBest) {
      s.newBest = true;
      R.after(.3, function () { note(R, 'New best floor', 1.5, C.goldDk); R.sfx('flag'); });
    }
  }
  function stable(s) { return s.phase === 'climb' || s.phase === 'wait'; }
  function floorsLabel(n) { return n === 1 ? 'floor' : 'floors'; }
  var MIN_RIGHT = 3;                                          // right planks a timed run needs to count as finished
  function timeUp(R) {
    var s = R.s, L = s.lau, row = s.row;
    setPhase(R, 'over');
    /* hovering over a plank when the clock runs out: he steps down onto it (no answer) instead of dropping 84 px */
    if (row && L.hover) {
      var on = null; row.planks.forEach(function (q) { if (q.st === 'live' && Math.abs(L.x - q.x) <= HW + TOL) on = q; });
      if (on) { L.hover = false; L.nudge = clamp(L.x, Math.max(on.x - 7, 11), Math.min(on.x + 7, 119)); contact(R, FY(row.floor), { sq: .18, dur: .1 }); L.stand = true; L.until = R.t + 99; }
    }
    if (row) { row.lock = true; row.live = false; }
    banner(R, 'Time’s up', C.white, 1.6);
    /* a run that never really answered (e.g. nobody touched the screen: the gap over Lau keeps him bouncing safely for
       90 s) must not pay the daily +10 XP: the engine's minRight end option needs MIN_RIGHT right planks */
    endRun(R, { reason: 'time', minRight: MIN_RIGHT, title: 'Time’s up', score: s.top, scoreLabel: floorsLabel(s.top), delay: 1.5 });
  }

  /* ---------- update ---------- */
  function update(R, dt) {
    var s = R.s, t = R.t;
    S = s; G = R.G; geo(R);
    if (WARM) warmStep(2);
    if (s.sayGate) stepSayGate(R);
    if (s.endGate) stepEndGate(R);
    if (s.clockOn && !R.over && s.left > 0) s.left = Math.max(0, s.left - dt);
    if (R.input.left || R.input.right) s.steered = true;
    camUpdate(R);
    if (s.cut) stepCut(R);
    if (s.drop) stepDrop(R, dt);
    if (s.bolo) stepBolo(R);
    if (s.rk) stepRocket(R);
    stepLau(R, dt);
    if (s.row) for (var j = 0; j < 3; j++) { var q = s.row.planks[j]; if (q.mT > 0) q.x = plankX(q, t); }
    if (s.prevRow && t - s.prevRow.tHit > 2.2) s.prevRow = null;
    if (s.lau.mood !== 'happy' && t >= s.lau.moodUntil && !s.lau.falling) s.lau.mood = 'happy';
    for (var i = s.rings.length - 1; i >= 0; i--) if (t - s.rings[i].t0 > .4) s.rings.splice(i, 1);
    if (s.left <= 0 && !R.over && stable(s)) timeUp(R);
    R.score = s.top;
  }

  /* ======================================================================================================
     drawing (ported from the video scene)
     ====================================================================================================== */
  function put(spr, cx, bot, o) {
    o = o || {};
    var sx = o.sx == null ? 1 : o.sx, sy = o.sy == null ? 1 : o.sy, w = Math.max(1, Math.round(spr.width * sx)), h = Math.max(1, Math.round(spr.height * sy));
    if (sx <= .02 || sy <= .02) return;
    var x = Math.round(cx - w / 2), y = Math.round(bot - h), c = G.ctx;
    c.save(); c.imageSmoothingEnabled = false;
    if (o.alpha != null) c.globalAlpha *= clamp(o.alpha);
    if (o.flip) { c.translate((x + w) * 3, y * 3); c.scale(-1, 1); c.drawImage(spr, 0, 0, w * 3, h * 3); }
    else c.drawImage(spr, x * 3, y * 3, w * 3, h * 3);
    c.restore();
  }
  function puff(gx, gy, r, a, dusty) {
    if (a <= 0) return;
    var arr = dusty ? SPR.dust : SPR.puff, mx = dusty ? 6 : 8;
    r = Math.max(1, Math.min(mx, Math.round(r))); G.spr(arr[r], gx - r, gy - r, { alpha: a });
  }
  function sparkle(t, t0, gx, gy, col, life) {
    life = life || .3; var d = t - t0; if (d < 0 || d > life) return;
    var u = d / life, L = Math.round(1 + 3 * Math.sin(u * Math.PI)), a = 1 - u * .6;
    col = col || C.white; gx = Math.round(gx); gy = Math.round(gy);
    G.rect(gx, gy, 1, 1, col, a);
    for (var i = 1; i <= L; i++) { G.rect(gx + i, gy, 1, 1, col, a); G.rect(gx - i, gy, 1, 1, col, a); G.rect(gx, gy + i, 1, 1, col, a); G.rect(gx, gy - i, 1, 1, col, a); }
  }
  function textW(str, font) {
    var key = font + '|' + str; if (TWC[key]) return TWC[key];
    var c = G.ctx; c.save(); c.font = font; var w = c.measureText(str).width; c.restore();
    if (++TWN > 200) { TWC = {}; TWN = 1; }
    return (TWC[key] = w);
  }
  function hudFade(gy) { return clamp((gy * 3 - (S.geo.cTop + 40)) / 42); }

  function drawFar() {
    var fh = SPR.far.height, off = S.cam * .45, start = ((off % fh) + fh) % fh - fh;
    for (var y = start; y < G.H + 1; y += fh) G.spr(SPR.far, 0, y);
  }
  function bandFor(n) { return n === 1 ? 0 : (n + 1) % 4; }
  function bandSpr(n, on) { var s = S; return bandSprite(bandFor(n), { bal: !solidFloor(s, n), walk: solidFloor(s, n), face: solidFloor(s, n + 1), wash: on ? WASH_ON : WASH }); }
  function drawBands(t) {
    var g = S.geo, nTop = Math.floor((S.cam + g.BASE) / FH) + 2, nBot = Math.max(1, Math.floor((S.cam + g.BASE - G.H) / FH));
    for (var n = nBot; n <= nTop; n++) {
      var top = gyOf(FY(n) + FH);
      if (top > G.H || top + FH < -2) continue;
      var sv = satOf(S, n, t);
      if (sv < 1) G.spr(bandSpr(n, false), 0, top);
      if (sv > 0) G.spr(bandSpr(n, true), 0, top, { alpha: sv });
    }
  }
  function drawSlabs() {
    var g1 = gyOf(0); if (g1 < G.H + 1) G.spr(SPR.ground, 0, g1);
    for (var i = 0; i < S.flList.length; i++) {
      var k = S.flList[i], f = S.fl[k]; if (f.type !== 'landing') continue;
      var gy = gyOf(FY(k)); if (gy < G.H + 1 && gy > -20) G.spr(SPR.landing, 0, gy);
    }
  }
  /* the "Your best" marker: a dashed line with a pennant at the previous best floor */
  function drawBest(t) {
    var s = S; if (s.prevBest == null || s.prevBest < 2) return;
    var Yb = FY(s.prevBest) + 48, gy = Math.round(gyOf(Yb)), fa = hudFade(gy - 16);   // pill clears the next row's labels
    if (gy < 20 || gy > G.H || fa <= 0) return;
    var hit = s.bestHitT != null ? t - s.bestHitT : 9, fl = hit < .5 ? 1 - hit / .5 : 0;
    if (s.lau.Y >= Yb && s.bestSide === -1) s.bestHitT = t;
    s.bestSide = s.lau.Y >= Yb ? 1 : -1;
    var c = G.ctx; c.save(); c.globalAlpha *= fa;
    for (var x = 18; x < 130; x += 6) { G.rect(x, gy, 4, 1, fl > 0 ? mix(C.white, C.gold, fl) : C.white, .95); G.rect(x, gy + 1, 4, 1, C.navy, .22); }
    G.rect(5, gy - 15, 1, 16, C.navy); G.rect(6, gy - 15, 1, 16, C.navy2);
    G.spr(SPR.pennant[Math.floor(t * 5 + (hit < .6 ? hit * 20 : 0)) % 2], 6, gy - 16);
    var ps = 1 + .25 * Math.max(0, Math.sin(Math.PI * clamp(hit / .35)));
    G.pill('Your best', 78, gy * 3 - 26, { size: 15, weight: 800, bg: C.navy, color: C.gold, pad: 11, shadow: false, scale: ps });
    for (var i = 0; i < 4; i++) sparkle(t, (s.bestHitT || -9) + i * .04, s.lau.x + [-9, 9, -5, 6][i], gy - [1, 0, 4, 3][i], i % 2 ? C.gold : C.white, .35);
    c.restore();
  }

  /* planks */
  function homeDip(t) { var e = t - S.homeDipT; return e > -.01 && e < .3 ? 1.6 * Math.exp(-Math.max(0, e) * 14) : 0; }
  function plankDip(row, q, t) {
    if (q.right && row.done) {
      var d = t - (row.tHit - .05), dip = 0;
      if (d >= 0 && d < .13) dip = 4 * Math.sin(Math.PI * d / .13);
      else if (d >= .13) dip = jiggle(t, row.tHit + .08, -3, 32, 9);
      if (S.floor === row.floor && t > row.tHit + .4) dip += homeDip(t);
      return dip;
    }
    if (q.st === 'crack') return 2 * p(t, q.tS - .03, q.tS + .05);
    return 0;
  }
  function drawCoil(cx, base, len) {
    if (len < 1) return;
    var N = 5, pts = [], i, s;
    for (i = 0; i <= N; i++) pts.push([cx + (i % 2 ? 4 : -4), base - 2 - (len - 1) * i / N]);
    var front = [], back = [];
    for (i = 0; i < N; i++) for (s = 0; s <= 8; s++) (i % 2 ? back : front).push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * s / 8, Math.round(pts[i][1] + (pts[i + 1][1] - pts[i][1]) * s / 8)]);
    G.rect(cx - 5, base - 2, 10, 2, C.navy); G.rect(cx - 4, base - 2, 8, 1, C.greyDk);
    back.forEach(function (w) { G.rect(w[0], w[1], 1, 1, C.navy3); });
    front.forEach(function (w) { G.rect(w[0] - 1, w[1] - 1, 3, 3, C.navy); });
    front.forEach(function (w, j) { G.rect(w[0], w[1], 1, 1, j % 9 < 4 ? C.white : '#C9CEE2'); });
    var top = Math.round(base - 2 - (len - 1)) - 1;
    G.rect(cx - 6, top - 2, 12, 3, C.navy); G.rect(cx - 5, top - 2, 10, 1, C.lime); G.rect(cx - 5, top - 1, 10, 1, C.limeDk);
  }
  function coilLen(t, tHit) {
    var d = t - tHit;
    if (d < -.05 || d > .75) return 0;
    if (d < .03) return 1;
    if (d < .1) return 1 + 9 * E.outBack((d - .03) / .07);
    return Math.max(0, (10 + jiggle(t, .1 + tHit, 3, 34, 7)) * (1 - E.in(p(d, .45, .75))));
  }
  function drawHistory(t) {
    for (var i = 0; i < S.flList.length; i++) {
      var n = S.flList[i], f = S.fl[n];
      if (f.type !== 'plank' && f.type !== 'decor' && f.type !== 'gold') continue;
      if (S.prevRow && S.prevRow.floor === n) continue;              // still drawn by its row (spring, falling planks)
      var gy = gyOf(FY(n)); if (gy < -12 || gy > G.H + 4) continue;
      var fa = hudFade(gy); if (fa <= 0) continue;
      if (f.type === 'decor') { put(SPR.plank.gold, f.xs[0], gy + 7, { alpha: fa }); put(SPR.plank.gold, f.xs[1], gy + 7, { alpha: fa }); continue; }
      var dip = S.floor === n ? homeDip(t) : 0;
      put(SPR.plank[f.type === 'gold' ? 'gold' : 'lime'], f.x, gy + 7 + dip, { alpha: fa });
    }
  }
  function drawRow(row, t) {
    var c = G.ctx, gy0 = gyOf(FY(row.floor));
    if (gy0 < -20 || gy0 > G.H + 10) return;
    row.planks.forEach(function (q, i) {
      var a = p(t, q.tp, q.tp + .32, E.outBackBig);
      if (q.st === 'reform') a = p(t, q.tS + .1, q.tS + .42, E.outBackBig);
      if (a <= 0 || q.st === 'crumble') return;
      var x = plankX(q, t), gy = gy0 + plankDip(row, q, t), alpha = 1, drop = 0;
      if (row.done && !q.right) { var u = t - row.tHit - .25; if (u > 0) { drop = 150 * u * u; alpha = 1 - p(t, row.tHit + .3, row.tHit + .75); } }
      if (alpha <= 0) return;
      var hop = q.mT > 0 && t < q.mT + .5 ? 4 * Math.sin(Math.PI * clamp((t - q.mT) / .5)) : 0;
      /* the hint glow on the right plank after a wrong landing */
      if (q.right && row.hintT > 0 && !row.done && t >= row.hintT) {
        var ga = p(t, row.hintT, row.hintT + .18), gp = .5 + .5 * Math.sin((t - row.hintT) * 9);
        c.save(); c.globalAlpha = (.3 + .25 * gp) * ga; c.fillStyle = C.lime;
        var gx0 = Math.max(2, (x - 18) * 3), gx1 = Math.min(388, (x + 18) * 3);       // kept on screen at the walls
        PX.roundRect(c, gx0, (gy - 6 - hop) * 3, gx1 - gx0, 18 * 3, 24); c.fill();
        c.globalAlpha = (.5 + .3 * gp) * ga; c.lineWidth = 4; c.strokeStyle = C.limeDk; c.stroke(); c.restore();
      }
      var kind = 'gold';
      if (q.right && row.done) kind = t < row.tHit + .06 ? 'flash' : 'lime';
      else if (q.right && row.hintT > 0 && t >= row.hintT && Math.floor((t - row.hintT) / .22) % 2 === 0) kind = 'lime';
      if (q.st === 'crack') kind = 'coral';
      put(SPR.plank[kind], x, gy + 7 + drop - hop, { sx: a, sy: a, alpha: alpha });
      if (q.right && row.done) drawCoil(x, gy, Math.round(coilLen(t, row.tHit)));
      if (q.st === 'crack') [[-9, 1], [-8, 2], [-7, 1], [-6, 3], [-5, 4], [2, 1], [3, 2], [3, 3], [4, 4], [9, 2], [10, 3]].forEach(function (w) { G.rect(x + w[0], gy + w[1], 1, 1, C.navy); });
      var tp = q.st === 'reform' ? q.tS + .1 : q.tp;
      if (t >= tp && t < tp + .35) for (var k = 0; k < 4; k++) sparkle(t, tp + .03, x + [-15, 15, -11, 12][k], gy + [-2, 0, 7, 8][k], C.gold);
    });
    /* crumble chunks + dust */
    row.planks.forEach(function (q) {
      if (q.wT < 0) return;
      var d = t - q.wT - .1; if (d < 0 || d > .8) return;
      var gy = gy0 + 2, x0 = q.wx;
      for (var i = 0; i < 12; i++) {
        var xi = x0 - 13 + i * 2.2, vx = (hash(i * 3.7) - .5) * 26 + (i - 5.5) * 4, vy = 18 + hash(i * 1.9) * 30;
        var x = xi + vx * d, y = gy - vy * d + 170 * d * d, sz = 3 + (i % 3 === 0 ? 1 : 0) - (d > .4 ? 1 : 0), a = 1 - p(d, .5, .8);
        G.rect(x - 1, y - 1, sz + 2, sz + 2, C.navy, a); G.rect(x, y, sz, sz, [C.coral, C.gold, C.goldSh, C.coralSh][i % 4], a);
        G.rect(x, y, sz, 1, i % 2 ? C.peach : '#FFE08A', a);
      }
      for (var j = 0; j < 7; j++) { var ang = j / 6 * Math.PI + Math.PI; puff(x0 + Math.cos(ang) * (5 + d * 34), gy + 3 + Math.sin(ang) * (4 + d * 12) + d * 10, 2.5 + d * 8, (1 - d / .65), j % 2 === 0); }
    });
  }
  /* label pills under the planks (and their check / cross badges); neighbours never overlap */
  function drawPills(row, t) {
    var gy0 = gyOf(FY(row.floor)), font = '800 16px Lexend, sans-serif';
    var items = row.planks.map(function (q, i) {
      var w = textW(q.label, font) + 18;
      return { q: q, i: i, w: w, cx: clamp(plankX(q, t) * 3, w / 2 + 4, 386 - w / 2) };
    }).sort(function (a, b) { return a.cx - b.cx; });
    for (var pass = 0; pass < 3; pass++) for (var k = 0; k < items.length - 1; k++) {
      var A = items[k], B = items[k + 1], o = (A.w + B.w) / 2 + 4 - (B.cx - A.cx);
      if (o > 0) { A.cx = clamp(A.cx - o / 2, A.w / 2 + 4, 386 - A.w / 2); B.cx = clamp(B.cx + o / 2, B.w / 2 + 4, 386 - B.w / 2); }
    }
    items.forEach(function (it) {
      var q = it.q, tp = q.tp + .08, a = p(t, tp, tp + .3, E.outBack);
      if (q.st === 'reform') a = p(t, q.tS + .15, q.tS + .45, E.outBack);
      if (a <= 0 || (q.st === 'crumble' && t > q.wT + .75)) return;
      var gy = gy0 + plankDip(row, q, t), alpha = Math.min(1, a * 1.5), dy = 0, sx = it.cx, sc = a;
      var right = q.right && row.done, wrong = (q.st === 'crack' || q.st === 'crumble');
      if (row.done && !q.right) alpha *= 1 - p(t, row.tHit + .05, row.tHit + .3);
      if (right) {
        var wt = row.wordT > 0 ? row.wordT : row.tHit + .5;
        alpha *= 1 - p(t, wt + .6, wt + .85);
        sc *= 1 + .14 * Math.sin(Math.PI * p(t, row.tHit, row.tHit + .25)) + .2 * Math.sin(Math.PI * p(t, wt, wt + .35));
      }
      if (wrong) {
        var d = t - q.wT;
        sx += jiggle(t, q.wT, 9, 46, 8);
        if (d > .25) dy = 780 * (d - .25) * (d - .25);
        alpha *= 1 - p(t, q.wT + .45, q.wT + .7);
        sc *= 1 + .12 * Math.sin(Math.PI * p(t, q.wT, q.wT + .2));
      }
      var hint = q.right && row.hintT > 0 && t >= row.hintT && !right;
      if (hint) sc *= 1 + .06 * Math.sin((t - row.hintT) * 9);
      var hop = q.mT > 0 && t < q.mT + .5 ? 4 * Math.sin(Math.PI * clamp((t - q.mT) / .5)) : 0;
      if (alpha <= 0) return;
      var r = G.pill(q.label, sx, (gy - hop) * 3 + 25 + dy, { size: 16, weight: 800, pad: 9, scale: sc, alpha: alpha, shadow: false,
        bg: right ? C.lime : wrong ? C.coral : C.white, color: wrong ? C.white : C.navy, border: hint ? C.limeDk : C.navy, borderW: hint ? 4 : 3 });
      var bx = Math.min(sx + Math.max(r.w / 2 * sc + 4, 44), 372);
      if (right) G.badge(bx, gy * 3 - 2, 15, true, (1.4 - .4 * E.out(p(t, row.tHit, row.tHit + .2))) * (1 - p(t, (row.wordT > 0 ? row.wordT : row.tHit + .5) + .6, (row.wordT > 0 ? row.wordT : row.tHit + .5) + .85)), Math.min(1, (t - row.tHit) / .06));
      if (wrong) G.badge(bx, gy * 3 - 2 + dy, 15, false, (1.4 - .4 * E.out(p(t, q.wT, q.wT + .2))), Math.min(1, (t - q.wT) / .06) * alpha);
    });
  }

  /* customers */
  function custXY(cu, floor, t) {
    var x = 114, hop = 0, flip = false, a = 1, sc = 1;
    if (t < cu.tIn + .3) { var u = p(t, cu.tIn, cu.tIn + .3, E.outBackBig); sc = u; a = Math.min(1, u * 2); }
    if (cu.tHappy > 0 && t >= cu.tHappy && (cu.tOut < 0 || t < cu.tOut)) hop = 3 * Math.max(0, Math.sin(Math.PI * clamp((t - cu.tHappy) / .3)));
    if (cu.tOut > 0 && t >= cu.tOut) { var w = t - cu.tOut; flip = true; x += w < .25 ? 100 * w * w : 6.25 + 50 * (w - .25); hop = 2 * Math.abs(Math.sin(Math.PI * w / .17)); }
    return { x: x, y: gyOf(FY(floor) + BAL) - hop, flip: flip, a: a, sc: sc };
  }
  function drawCust(row, t) {
    var cu = row.cust; if (t < cu.tIn) return;
    var s = custXY(cu, row.floor, t); if (s.x > 145 || s.y < -10 || s.y > G.H + 40) return;
    var happy = cu.tHappy > 0 && t >= cu.tHappy, sad = cu.tSad > 0 && t >= cu.tSad && t < cu.tSad + 1.3;
    var shake = cu.tSad > 0 && t >= cu.tSad + .05 && t < cu.tSad + .6 && Math.floor((t - cu.tSad) / .09) % 2 === 1;
    put(cust(cu.which, happy ? 'happy' : sad ? 'sad' : 'meh', happy && (cu.tOut < 0 || t < cu.tOut)), s.x + (shake ? 1 : 0), s.y, { flip: s.flip || shake, alpha: s.a, sx: s.sc, sy: s.sc });
    if (cu.tSad > 0 && t >= cu.tSad && t < cu.tSad + 1.0) {
      var ds = t - cu.tSad, dp = E.outBackBig(p(t, cu.tSad, cu.tSad + .2));
      G.sprS(SPR.sweat, (s.x + 10) * 3, (s.y - 29 + 3 * p(ds, .2, 1)) * 3, 1.25 * dp, 1 - p(ds, .8, 1));
    }
    if (t >= cu.tIn && t < cu.tIn + .3) for (var q = 0; q < 4; q++) sparkle(t, cu.tIn + .05, s.x + [-12, 12, -9, 10][q], s.y - [30, 26, 8, 12][q], C.gold);
    var d = t - cu.tHappy - .1;
    if (cu.tHappy > 0 && d > 0 && d < .9) G.spr(PX.heart(true), s.x - 7, s.y - 46 - d * 20, { scale: 2, alpha: 1 - p(d, .6, .9) });
  }
  function drawLandingCust(t) {
    var lc = S.lcust; if (!lc || t < lc.t0) return;
    var u = t - lc.t0, x = lerp(140, lc.x1, E.inOut(clamp(u / .45))), h = u < .45 ? 3 * Math.abs(Math.sin(Math.PI * u / .15)) : 0, flip = false;
    if (lc.happyT > 0 && t >= lc.happyT && t < lc.happyT + .6) h = 3 * Math.max(0, Math.sin(Math.PI * clamp((t - lc.happyT) / .3)));
    if (lc.outT > 0 && t >= lc.outT) { var w = t - lc.outT; x = lc.x1 + (w < .25 ? 100 * w * w : 6.25 + 50 * (w - .25)); h = 2 * Math.abs(Math.sin(Math.PI * w / .17)); flip = true; }
    if (x > 146) return;
    var gy = gyOf(FY(lc.floor)); if (gy > G.H + 40 || gy < -10) return;
    var happy = lc.happyT > 0 && t >= lc.happyT;
    put(cust(lc.which, happy ? 'happy' : 'meh', happy && !(lc.outT > 0)), x, gy - h, { flip: flip });
    var d = t - lc.happyT - .05;
    if (lc.happyT > 0 && d > 0 && d < .9) G.spr(PX.heart(true), x - 7, gy - 46 - d * 20, { scale: 2, alpha: 1 - p(d, .6, .9) });
  }
  /* the customer's speech bubble: tail pointing down-right at the customer (or right, on a short screen) */
  function bubble(row, t) {
    var cu = row.cust, tSay = cu.tIn + .15, sayOut = cu.tHappy > 0 ? cu.tHappy : 1e9;
    var a = p(t, tSay, tSay + .35, E.outBack), o = p(t, sayOut, sayOut + .22, E.in);
    if (a <= 0 || o >= 1) return;
    var cs = custXY(cu, row.floor, t), tipX = cs.x * 3 - 30, tipY = (cs.y - 30) * 3;
    var c = G.ctx, size = 18, info = G.wrap(row.need, size, 250, 700);
    if (info.w > 300) { size = 16; info = G.wrap(row.need, size, 280, 700); }
    var lh = Math.round(size * 1.28), padX = 16, padY = 10;
    var w = Math.ceil(info.w) + padX * 2, h = info.lines.length * lh + padY * 2;
    var x = Math.max(6, Math.min(384 - w, tipX + 30 - w)), y = tipY - 12 - h, side = false, r = 16;
    if (y < S.geo.bubTop) {                                    // short screen: beside the customer, tail to the right
      side = true; x = Math.max(6, cs.x * 3 - 40 - w); y = Math.max(S.geo.bubTop, tipY - h / 2); tipX = cs.x * 3 - 28; tipY = Math.min(y + h - 10, Math.max(y + 12, (cs.y - 28) * 3));
    }
    var s = a * (1 - o * .5);
    var no = cu.tSad > 0 && t >= cu.tSad && t < cu.tSad + 1.0 ? 1 - p(t, cu.tSad + .8, cu.tSad + 1.0) : 0;
    c.save();
    if (no > 0) c.translate(jiggle(t, cu.tSad, 7, 42, 6), 0);
    c.translate(tipX, tipY); c.scale(s, s); c.translate(-tipX, -tipY);
    c.globalAlpha *= clamp(Math.min(1, a * 2) * (1 - o));
    function path(oy) {
      c.beginPath();
      c.moveTo(x + r, y + oy); c.lineTo(x + w - r, y + oy); c.arcTo(x + w, y + oy, x + w, y + r + oy, r);
      if (side) { var ty = clamp(tipY, y + 10, y + h - 10); c.lineTo(x + w, ty - 9 + oy); c.lineTo(tipX, tipY + oy); c.lineTo(x + w, ty + 7 + oy); }
      c.lineTo(x + w, y + h - r + oy); c.arcTo(x + w, y + h + oy, x + w - r, y + h + oy, r);
      if (!side) { var bx0 = tipX - 14, bx1 = tipX + 2; c.lineTo(bx1, y + h + oy); c.lineTo(tipX + 6, tipY + oy); c.lineTo(bx0, y + h + oy); }
      c.lineTo(x + r, y + h + oy); c.arcTo(x, y + h + oy, x, y + h - r + oy, r);
      c.lineTo(x, y + r + oy); c.arcTo(x, y + oy, x + r, y + oy, r); c.closePath();
    }
    path(5); c.fillStyle = 'rgba(11,18,64,.22)'; c.fill();
    path(0); c.fillStyle = no > 0 ? mix(C.white, C.coralSoft, no) : C.white; c.fill();
    c.lineWidth = no > 0 ? 3 + 2 * no : 3; c.lineJoin = 'round'; c.strokeStyle = no > 0 ? mix(C.navy, C.coralSh, no) : C.navy; c.stroke();
    info.lines.forEach(function (l, i) { G.text(l, x + w / 2, y + padY + lh * (i + .5) + 1, { size: size, weight: 700, color: C.navy }); });
    c.restore();
  }

  /* Lau (with his rockets, and Bolo when he is caught) */
  function lauLook(s, t) {
    var L = s.lau;
    if (s.lcust && L.stand) return [1, 0];
    if (t - L.steerT < .15) return [L.face, -.3];
    if (L.vy > 60) return [.2, -.8];
    if (L.vy < -60) return [.1, .6];
    return [.2, -.6];
  }
  function lauSquash(s, t) {
    var L = s.lau;
    if (s.rk && !s.rk.landed) {
      var u = t - s.rk.t0, w = clamp((u - RK_IGN) / RK_DUR);
      if (u < .08) return -.14 * Math.sin(Math.PI * u / .08);
      if (u < RK_IGN) return .18 * p(u, .08, RK_IGN);
      if (u < RK_IGN + RK_DUR) return -.24 * Math.sin(Math.PI * Math.min(1, w * 1.6));
      return -.12;
    }
    if (L.mode === 'contact') {
      if (L.stand) return .25 * Math.exp(-(t - L.ct0) * 14) * Math.cos((t - L.ct0) * 30);
      var w2 = clamp((t - L.ct0) / Math.max(.01, L.until - L.ct0));
      if (L.stun) return L.sq * (w2 < .2 ? w2 / .2 : 1 - .75 * (w2 - .2) / .8) + jiggle(t, L.until - .05, .1, 30, 10);
      return L.sq * Math.sin(Math.PI * w2);
    }
    if (s.cut && !s.cut.done) return -.28;
    if (L.hover) return -.06 + .04 * Math.sin(t * 14);
    return -.17 * clamp(Math.abs(L.vy) / 420);
  }
  function drawLau(R, t) {
    var s = S, L = s.lau, c = G.ctx, i;
    var dipY = L.mode === 'contact' && L.spring ? 4 * Math.sin(Math.PI * clamp((t - L.ct0) / Math.max(.01, L.until - L.ct0))) : 0;
    var bot = gyOf(L.Y) + dipY;
    /* shadow on his own plank / floor when he is low over it */
    var hY = FY(s.floor), hgt = L.Y - hY;
    if (!(s.rk && !s.rk.landed) && !s.bolo && hgt >= 0 && (s.home.solid || Math.abs(L.x - s.home.x) < HW + 2)) {
      var sw = Math.round(Math.max(4, 14 - hgt * .12)), sa = .2 * clamp(1 - hgt / 90);
      if (sa > .01) { var sg = gyOf(hY); G.rect(L.x - sw / 2, sg, sw, 1, C.navy, sa); G.rect(L.x - sw / 2 + 1, sg + 1, Math.max(1, sw - 2), 1, C.navy, sa * .6); }
    }
    /* Bolo under him while he is carried */
    var bp = boloPos(R);
    if (bp && bp.a > 0) G.sprS(bp.under ? SPR.bolo : SPR.boloFwd, bp.x * 3, (gyOf(bp.Y) + 11) * 3, bp.sc, bp.a);
    /* twin rockets on his sides, flame trails out of their nozzles */
    if (s.rk) {
      var rk = s.rk, u = t - rk.t0, nz = bot + 2;
      if (u < RK_IGN + RK_DUR) {
        var bS = E.outBackBig(p(u, .04, .16));
        if (u >= RK_IGN - .02) {
          var fl = u < RK_IGN + .1 ? (u - RK_IGN + .02) / .12 : 1, fr = Math.floor(t * 30), FL = Math.round(26 * fl);
          [-1, 1].forEach(function (sd) {
            var nx = L.x + sd * RX;
            for (var j = 0; j < FL; j++) {
              var fy = nz + j, u2 = j / 26, wig = (hash(fr + j * 7 + sd * 13) - .5) * 1.2;
              var hw = Math.max(0, (3.6 - 3.1 * Math.pow(u2, .8)) * (.8 + .2 * fl) + wig);
              var xo = Math.round(Math.sin(fr * .9 + j * .35 + sd) * u2 * 1.5);
              if (hw < .6) continue;
              G.rect(nx - Math.round(hw) + xo, fy, Math.round(hw) * 2, 1, u2 < .55 ? C.fl4 : C.coralSh);
              if (hw > 1.6) G.rect(nx - Math.round(hw - 1) + xo, fy, Math.round(hw - 1) * 2, 1, u2 < .5 ? C.fl2 : C.fl3);
              if (hw > 2.4 && u2 < .4) G.rect(nx - 1 + xo, fy, 2, 1, u2 < .2 ? C.white : C.fl1);
            }
            for (var e2 = 0; e2 < 6; e2++) {
              var ph = ((u - RK_IGN) * 2.2 + hash(e2 * 3.3 + sd)) % 1;
              G.rect(nx + sd * (1 + ph * 8 * hash(e2 * 1.7 + sd)), nz + 4 + ph * 30, 1, 1, e2 % 3 ? C.fl2 : C.fl3, (1 - ph) * fl);
            }
          });
        }
        if (bS > .03) { put(SPR.rocket, L.x - RX, nz + 1, { sx: bS, sy: bS }); put(SPR.rocket, L.x + RX, nz + 1, { sx: bS, sy: bS, flip: true }); }
      } else if (u < RK_IGN + RK_DUR + .4) {
        var fd = u - RK_IGN - RK_DUR, ra = 1 - p(fd, .2, .35);
        [-1, 1].forEach(function (sd) {
          var rx = (L.x + sd * (RX + 40 * fd)) * 3, ry = (gyOf(L.Y + 6 - 60 * fd - 200 * fd * fd) - 7) * 3, w = SPR.rocket.width * 3, h = SPR.rocket.height * 3;
          c.save(); c.imageSmoothingEnabled = false; c.globalAlpha *= clamp(ra);
          c.translate(rx, ry); c.rotate(sd * fd * 5); if (sd > 0) c.scale(-1, 1);
          c.drawImage(SPR.rocket, -w / 2, -h / 2, w, h); c.restore();
        });
      }
    }
    if (L.hover) {                                            // the flame hover: embers drip from his feet
      if (!RM) bot += Math.round(Math.sin((t - L.hoverT) * 6));
      var hin = clamp((t - L.hoverT) / .12);
      puff(L.x, bot + 1, 3 + Math.round(Math.sin(t * 23)), .3 * hin);
      for (i = 0; i < 9; i++) {
        var ph = ((t - L.hoverT) * 2.4 + hash(i * 2.7)) % 1, ex = L.x - 5 + Math.floor(hash(i * 5.3) * 11) + Math.round(Math.sin(t * 9 + i) * ph * 2);
        var ez = ph < .45 && i % 2 === 0 ? 2 : 1;
        G.rect(ex, bot + ph * 11, ez, ez, i % 3 === 0 ? C.fl1 : i % 3 === 1 ? C.fl2 : C.fl3, (1 - ph) * hin);
      }
    }
    var blink = L.mood === 'happy' && (t % 3.3) < .1 ? 1 : 0;
    var spr = PX.lau({ h: 20, frame: Math.floor(t * 8), look: lauLook(s, t), mood: L.mood, blink: blink });
    G.drawSq(spr, L.x, bot, lauSquash(s, t));
    /* dizzy stars after a crumble */
    if (t - s.stunT < .8) {
      var dz = t - s.stunT;
      for (i = 0; i < 3; i++) { var an = dz * 9 + i * 2.09; sparkle(t, s.stunT, L.x + Math.cos(an) * 9, bot - 26 + Math.sin(an) * 3, i % 2 ? C.gold : C.white, .8); }
    }
    if (bp && bp.under) {                                    // motion lines while Bolo carries him
      var bu = t - s.bolo.t0;
      if (bu > .25 && bu < .95) for (i = 0; i < 3; i++) G.rect(bp.x + (s.bolo.hx > s.bolo.x0 ? -16 - i * 2 : 14 + i * 2), gyOf(bp.Y) + 6 + i * 5, 4, 1, C.white, .8);
    }
    return { sx: L.x * 3, sy: (bot - 12) * 3 };
  }
  function drawSmoke(t) {
    var rk = S.rk; if (!rk) return;
    var u = t - rk.t0, T0 = rk.t0 + RK_IGN, T1 = T0 + RK_DUR;
    if (u < RK_IGN || t > T1 + .6) return;
    for (var j = 0; j < 30; j++) {
      var ts = T0 + j * .045; if (ts > T1 || ts > t) break;
      var d = t - ts; if (d > .55) continue;
      var x = lerp(rk.x0, 65, E.inOut(clamp((ts - T0) / RK_DUR))) + (j % 2 ? RX : -RX) + (hash(j * 2.3) - .5) * 4, Y = rkFeet(rk, ts) - 16;
      puff(x + (hash(j * 5.1) - .5) * d * 20, gyOf(Y) + d * 8, 2 + d * 9, (1 - d / .55) * .85);
    }
    var dk = t - T1;
    if (dk >= 0 && dk < .45) [-1, 1].forEach(function (sd) {
      for (var q = 0; q < 3; q++) puff(65 + sd * (RX + 2 + q * 3 + dk * 14), gyOf(rkFeet(rk, T1) - 4 - q * 2) + dk * 6, 2 + dk * 12 - q, (1 - dk / .45) * .9);
    });
    for (var k2 = 0; k2 < 14; k2++) {
      var t0 = T0 + .08 + k2 * .09; if (t0 > T1) break;
      var d2 = t - t0; if (d2 < 0 || d2 > .45) continue;
      var sx2 = lerp(rk.x0, 65, E.inOut(clamp((t0 - T0) / RK_DUR))) + (hash(k2 * 3.1) > .5 ? 1 : -1) * (12 + hash(k2 * 1.3) * 16), sY = rkFeet(rk, t0) + 4 + hash(k2 * 7.7) * 18;
      var w = d2 / .45;
      G.sprS(SPR.star, sx2 * 3, gyOf(sY) * 3, (.6 + .9 * Math.sin(w * Math.PI)), 1 - w * .5);
    }
  }
  function drawSpeedLines(t) {
    var s = S, spd = (s.cam - (s.lastCam == null ? s.cam : s.lastCam)) / Math.max(1e-3, t - (s.lastCamT == null ? t - 1 : s.lastCamT));
    if (t !== s.lastCamT) { s.camSpd = isFinite(spd) ? spd : 0; s.lastCam = s.cam; s.lastCamT = t; }
    var a = clamp(((s.camSpd || 0) - 70) / 220); if (a <= 0 || RM) return;
    for (var i = 0; i < 16; i++) {
      var x = 3 + Math.floor(hash(i * 7.3) * 124), len = 8 + Math.floor(hash(i * 2.1) * 14 + Math.min(30, s.camSpd * .05));
      var y = ((hash(i * 5.7) * (G.H + 50) + s.cam * (1.3 + hash(i) * .7)) % (G.H + 50)) - 40;
      G.rect(x, y, 1, len, C.white, a * (.45 + .5 * hash(i * 9.1)));
    }
  }
  function drawDust(t) {
    S.dust.forEach(function (n) {
      var d = t - n.t0; if (d < 0 || d > .4) return;
      var gy = gyOf(n.Y) - 1, a = 1 - d / .4, big = n.big;
      puff(n.x - 6 - d * 26 * big, gy - d * 7, (1.5 + d * 6) * big, a, n.dusty); puff(n.x + 6 + d * 26 * big, gy - d * 7, (1.5 + d * 6) * big, a, n.dusty);
    });
    S.rings.forEach(function (r) {
      var dr = t - r.t0; if (dr < 0 || dr > .3) return;
      var c = G.ctx; c.save(); c.globalAlpha = .9 * (1 - dr / .3); c.strokeStyle = C.limeDk; c.lineWidth = 5;
      c.beginPath(); c.ellipse(r.x * 3, gyOf(r.Y) * 3 + 4, 34 + dr * 160, 9 + dr * 40, 0, 0, Math.PI * 2); c.stroke(); c.restore();
    });
  }

  /* UI: the floor counter, the clock, the hold buttons */
  function floorCounter(R, t) {
    var s = S, g = s.geo, txt = s.ctr, d = s.ctrT > 0 ? t - s.ctrT : 9, fresh = d < .4;
    var tw = textW(txt, '800 17px Lexend, sans-serif'), w = Math.ceil(tw) + 50, h = 34, x = 380 - w, y = g.cTop;
    var sc = RM ? 1 : 1 + .22 * Math.exp(-d * 9) * Math.cos(d * 22) * (d < .6 ? 1 : 0), c = G.ctx;
    c.save();
    c.translate(x + w, y + h / 2); c.scale(sc, sc); c.translate(-(x + w), -(y + h / 2));
    G.box(x, y, w, h, { bg: fresh ? C.lime : C.white, border: C.navy, borderW: 3, r: 17, shadow: false });
    c.fillStyle = fresh ? C.navy : C.limeDk; c.beginPath(); c.moveTo(x + 15, y + 23); c.lineTo(x + 31, y + 23); c.lineTo(x + 23, y + 11); c.closePath(); c.fill();
    G.text(txt, x + 38, y + h / 2 + 1, { size: 17, weight: 800, color: C.navy, align: 'left' });
    c.restore();
  }
  function clock(R, t) {
    var s = S, g = s.geo, left = Math.ceil(s.left), m = Math.floor(left / 60), sec = left % 60, txt = m + ':' + (sec < 10 ? '0' : '') + sec;
    var low = s.left <= 10 && s.clockOn, x = 10, y = g.cTop, w = Math.ceil(textW(txt, '800 17px Lexend, sans-serif')) + 46, h = 34, c = G.ctx;
    var pulse = low ? 1 + .08 * Math.max(0, Math.sin((s.left % 1) * Math.PI * 2)) : 1;
    c.save(); c.translate(x, y + h / 2); c.scale(pulse, pulse); c.translate(-x, -(y + h / 2));
    G.box(x, y, w, h, { bg: low ? C.coralSoft : C.white, border: low ? C.coralSh : C.navy, borderW: 3, r: 17, shadow: false });
    var cx = x + 19, cy = y + h / 2;
    c.lineWidth = 2.5; c.strokeStyle = low ? C.coralSh : C.navy; c.beginPath(); c.arc(cx, cy, 8, 0, Math.PI * 2); c.stroke();
    var fr = 1 - s.left / ROUND;
    c.fillStyle = low ? C.coral : C.lime; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - fr), false); c.closePath(); c.fill();
    G.text(txt, x + 33, cy + 1, { size: 17, weight: 800, color: low ? C.coralSh : C.navy, align: 'left' });
    c.restore();
  }
  function zones(R, t) {
    var s = S, g = s.geo, c = G.ctx, y0 = g.stripTop;
    c.save();
    c.fillStyle = 'rgba(11,18,64,.22)'; c.fillRect(0, y0 - 6, 390, 6);
    c.fillStyle = C.navy; c.fillRect(0, y0, 390, G.SH - y0 + 2);
    c.restore();
    var first = !s.steered && s.row && s.floor === 1 && t > s.row.t0 + .6;
    var slip = !first && s.slipT > 0 && s.slips <= 2 && t > s.slipT + .5 && t < s.slipT + 3.4;   // after a drift onto a plank
    var hint = first || slip, h0 = first ? s.row.t0 + .6 : s.slipT + .5;
    var ha = slip ? p(t, h0, h0 + .3) * (1 - p(t, s.slipT + 3.1, s.slipT + 3.4)) : first ? p(t, h0, h0 + .3) : 0;
    [-1, 1].forEach(function (side) {
      var on = side < 0 ? R.input.left : R.input.right, x = side < 0 ? 12 : 201, w = 177, hh = Math.min(60, g.stripH - 30), y = y0 + 14 + (on ? 3 : 0);
      c.save();
      c.fillStyle = 'rgba(0,0,0,.25)'; PX.roundRect(c, x, y0 + 18, w, hh, 24); c.fill();
      c.fillStyle = on ? C.lime : C.white; PX.roundRect(c, x, y, w, hh, 24); c.fill();
      c.lineWidth = 3; c.strokeStyle = on ? C.navy : 'rgba(11,18,64,.3)'; PX.roundRect(c, x + 1.5, y + 1.5, w - 3, hh - 3, 23); c.stroke();
      var col = on ? C.navy : 'rgba(11,18,64,.72)', cx = x + w / 2, cy = y + hh / 2;
      c.fillStyle = col; c.beginPath();
      if (side < 0) { c.moveTo(cx - 44, cy + 1); c.lineTo(cx - 30, cy - 9); c.lineTo(cx - 30, cy + 11); }
      else { c.moveTo(cx + 44, cy + 1); c.lineTo(cx + 30, cy - 9); c.lineTo(cx + 30, cy + 11); }
      c.closePath(); c.fill();
      G.text('hold', cx + (side < 0 ? 10 : -10), cy + 1, { size: 18, weight: 800, color: col });
      if (hint && !RM) { var ph = ((t - h0) % 1); c.globalAlpha = .8 * (1 - ph) * ha; c.strokeStyle = C.lime; c.lineWidth = 4; PX.roundRect(c, x - ph * 8, y - ph * 8, w + ph * 16, hh + ph * 16, 24 + ph * 8); c.stroke(); }
      c.restore();
    });
    if (hint && ha > 0) G.pill('Hold to steer. Let go over a plank', 195, y0 - 28, { size: 15, bg: C.white, color: C.navy, border: C.navy, borderW: 3, pad: 14, alpha: ha });
  }

  function draw(R, Gg) {
    var s = R.s, t = R.t, c = Gg.ctx, i;
    G = Gg; S = s; var g = geo(R);
    G.clear(C.sky);
    c.save(); c.translate(R.shakeX(), 0);
    drawFar();
    drawBands(t);
    drawBest(t);
    drawSlabs();
    drawHistory(t);
    if (s.prevRow) drawRow(s.prevRow, t);
    if (s.row) drawRow(s.row, t);
    if (s.prevRow) drawCust(s.prevRow, t);
    if (s.row) drawCust(s.row, t);
    drawLandingCust(t);
    drawSmoke(t);
    var lp = drawLau(R, t);
    drawDust(t);
    drawSpeedLines(t);
    if (s.prevRow) drawPills(s.prevRow, t);
    if (s.row) drawPills(s.row, t);
    if (s.prevRow) bubble(s.prevRow, t);
    if (s.row) bubble(s.row, t);
    c.restore();
    s.lp = lp;

    /* the top wash so the HUD reads, then the counter and the clock */
    var gh = g.cTop + 60;
    if (!g.grad || g.gradH !== gh) {
      g.grad = c.createLinearGradient(0, 0, 0, gh); g.gradH = gh;
      g.grad.addColorStop(0, 'rgba(221,228,255,0.96)'); g.grad.addColorStop(.55, 'rgba(221,228,255,0.8)'); g.grad.addColorStop(1, 'rgba(221,228,255,0)');
    }
    c.save(); c.fillStyle = g.grad; c.fillRect(0, 0, 390, gh); c.restore();
    /* on a short screen the Say-it card pushes the Landing up under the floor counter: the card is the focus then, so
       the counter steps aside rather than sit on the customer's head */
    var cramped = s.phase === 'say' && s.lcust && gyOf(FY(s.floor)) * 3 - 106 < g.cTop + 38;
    if (!cramped) floorCounter(R, t);
    clock(R, t);
    zones(R, t);

    /* notes and banners */
    if (s.note) {
      var nd = t - s.note.t0, na = p(nd, 0, .2) * (1 - p(nd, s.note.dur - .3, s.note.dur));
      if (na > 0) G.pill(s.note.text, 195, Math.max(g.cTop + 90, (g.BASE - 46) * 3), { size: 17, bg: s.note.col, color: C.white, pad: 16, alpha: na, scale: .85 + .15 * p(nd, 0, .25, E.outBack) });
    }
    if (s.banner) {
      var bn = s.banner, bi = p(t, bn.t0, bn.t0 + .28, E.outBackBig), bo = p(t, bn.t0 + bn.dur - .25, bn.t0 + bn.dur, E.in);
      if (bi > 0 && bo < 1) G.popText(bn.text, 195, Math.round(G.SH * .6), bi * (1 + .12 * bo), 1 - bo, 46, bn.fill);
    }
    /* the white flash of the cut to a Landing */
    if (s.cut && !RM) {
      var cu = t - s.cut.t0, fa = cu < .26 ? p(cu, .1, .26) : 1 - p(cu, .26, .44);
      if (fa > 0) { c.save(); c.globalAlpha = .82 * fa; c.fillStyle = C.white; c.fillRect(0, 0, 390, G.SH + 2); c.restore(); }
    }
  }
  /* after the HUD: the opening iris on Lau */
  function drawTop(R, Gg) {
    var t = R.t, io = p(t, 0, .6, E.inOut);
    if (io < 1 && R.s.lp && !RM) {
      var lx = R.s.lp.sx, ly = R.s.lp.sy, Rn = Math.max(Math.hypot(lx, ly), Math.hypot(390 - lx, ly), Math.hypot(lx, Gg.SH - ly), Math.hypot(390 - lx, Gg.SH - ly));
      Gg.iris(io * Rn / Math.hypot(390, Gg.SH), lx, ly);
    }
  }

  /* ---------- input ---------- */
  function hold(R, dir, on) {
    var s = R.s;
    if (on) { s.steered = true; s.holdT[dir] = R.t; }
    else {                                                   // the finger lifts (see wrongPlank: deliberate)
      var L = s.lau;
      if (s.hopT !== L.ct0) { s.hopT = L.ct0; s.hopHold = 0; }   // holds add up within one hop (inching with taps)
      s.relT = R.t; s.hopHold += Math.max(0, R.t - s.holdT[dir]);
    }
  }

  /* ---------- test hooks ---------- */
  function info(R) {
    var s = R.s, t = R.t, L = s.lau, row = s.row, choices = [];
    S = s; geo(R);
    if (row) row.planks.forEach(function (q) {
      if (q.st === 'crumble') return;
      var gy = gyOf(FY(row.floor)), x = plankX(q, t);
      choices.push({ label: q.label, slug: q.slug, right: q.right, gx: +x.toFixed(1), state: q.st, x: (x - HW) * 3, y: gy * 3 - 3, w: PW * 3, h: 48 });
    });
    return {
      floor: s.floor, top: s.top, left: +s.left.toFixed(2), clock: s.clockOn, nextLanding: s.nextLanding,
      onLanding: !!(s.fl[s.floor] && s.fl[s.floor].type === 'landing'), counter: s.ctr,
      lau: { x: +L.x.toFixed(1), Y: +L.Y.toFixed(1), vy: Math.round(L.vy), mode: L.mode, falling: L.falling, gy: +gyOf(L.Y).toFixed(1) },
      home: { solid: !!s.home.solid, x: s.home.solid ? null : s.home.x, kind: s.home.kind },
      row: row ? { floor: row.floor, slug: row.slug, need: row.need, live: !!(row.live && !row.lock), wrong: row.wrong, hint: row.hintT > 0 } : null,
      bolo: !!s.bolo, rocket: s.rk ? s.rk.k : 0, prevBest: s.prevBest, geo: { BASE: s.geo.BASE, stripTop: s.geo.stripTop, cTop: s.geo.cTop },
      slips: s.slips, sayWaiting: !!s.sayGate, endWaiting: !!s.endGate, reduceMotion: RM, warm: WARM ? WARM.length : 0,
      choices: choices
    };
  }

  ARC.registerGame({
    id: 'g22', name: 'Lau Jump', sub: 'Bounce and climb', lives: 3, scoreLabel: 'floors',
    rules: ['Hold left or right to steer Lau as he bounces', 'Let go over the plank that answers the customer', 'On a Landing, say the word clearly for a rocket'],
    controls: { hold: true },
    init: init, update: update, draw: draw, drawTop: drawTop, hold: hold, info: info,
    finish: function (R) { setPhase(R, 'over'); R.end({ reason: 'done', score: R.s.top, scoreLabel: floorsLabel(R.s.top), delay: .2 }); },
    destroy: function (R) { try { if (guardFn && R && R.G) R.G.cv.removeEventListener('touchend', guardFn); } catch (e) {} S = null; }
  });
})();
