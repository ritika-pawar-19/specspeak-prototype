/* Play & Learn engine (window.ARC): hub, intro sheet, game screen, loop, input, HUD, Say-it checkpoint, end card,
   chiptune SFX, rewards and persistence. Games live in arcade/games/<id>_<name>.js and call ARC.registerGame(def).
   The game API is documented in arcade/README.md. Nothing here runs until app.js calls ARC.init(host). */
(function () {
  'use strict';
  var ARC = window.ARC = window.ARC || {};
  var C = PX.C;
  var host = null;
  var games = {};
  var STEP = 1 / 60, XP_CAP = 40, XP_RUN = 10;

  /* the six approved games: tiles exist for all of them; a game shows 'Coming soon' until its file registers */
  var LIST = [
    { id: 'g18', num: '18', name: 'Super Lau', sub: 'Power-up jumper', icon: function () { return PX.mushroom({ tone: 'lime' }); }, sc: 4.2 },
    { id: 'g19', num: '19', name: 'Block Bump', sub: 'Block bumper', icon: function () { return PX.qblock(); }, sc: 4 },
    { id: 'g20', num: '20', name: 'Lag King', sub: 'Boss fight', icon: function () { return PX.king({ frame: 0 }); }, sc: 1.45 },
    { id: 'g21', num: '21', name: 'Spec Stack', sub: 'Falling blocks', icon: function () { return PX.icon.stack(); }, sc: 5.6 },
    { id: 'g22', num: '22', name: 'Lau Jump', sub: 'Bounce and climb', icon: function () { return PX.icon.plank(); }, sc: 4.4 },
    { id: 'g23', num: '23', name: 'Echo Invaders', sub: 'Listen and blast', icon: function () { return PX.icon.invader(0); }, sc: 5 }
  ];
  function meta(id) { for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i]; return null; }

  /* ---------------- small utilities (shared with games as ARC.U) ---------------- */
  function clamp(v, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  var E = {
    lin: function (t) { return t; },
    in: function (t) { return t * t * t; },
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    inOut: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    outBack: function (t) { var s = 1.70158; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); },
    outBackBig: function (t) { var s = 2.6; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); },
    inBack: function (t) { var s = 1.70158; return (s + 1) * t * t * t - s * t * t; },
    inOutSine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; }
  };
  function p(t, a, b, e) { return (e || E.lin)(clamp((t - a) / (b - a))); }
  function k(t, keys) {
    if (t <= keys[0][0]) return keys[0][1];
    for (var i = 1; i < keys.length; i++) {
      var t1 = keys[i][0], v1 = keys[i][1], e = keys[i][2], t0 = keys[i - 1][0], v0 = keys[i - 1][1];
      if (t <= t1) return lerp(v0, v1, (e || E.inOut)(t1 === t0 ? 1 : (t - t0) / (t1 - t0)));
    }
    return keys[keys.length - 1][1];
  }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function jiggle(t, t0, amp, freq, decay) { var d = t - t0; if (d < 0) return 0; return amp * Math.sin(d * (freq || 18)) * Math.exp(-d * (decay || 6)); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, u) { var A = rgb(a), B = rgb(b); return '#' + A.map(function (v, i) { var n = Math.round(v + (B[i] - v) * u); return (n < 16 ? '0' : '') + n.toString(16); }).join(''); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  ARC.U = { clamp: clamp, lerp: lerp, E: E, p: p, k: k, hash: hash, jiggle: jiggle, shuffle: shuffle, pick: pick, mix: mix, esc: esc };

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  ARC.reduceMotion = reduceMotion;          // games read this (no flash, speed lines or camera dips when true)
  var ICON = {
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    spk: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5h4l5-4.5v14l-5-4.5H3z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.3 5.8a9 9 0 0 1 0 12.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a3.5 3.5 0 0 0-3.5 3.5v6a3.5 3.5 0 0 0 7 0v-6A3.5 3.5 0 0 0 12 2zM5 11a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2a5 5 0 0 1-10 0H5z" fill="currentColor"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" fill="currentColor"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>'
  };

  /* a canvas showing one pixel sprite, scaled crisp by CSS (hub tiles, pill, sheets) */
  function spriteEl(spr, scale, cls) {
    var c = document.createElement('canvas');
    c.width = spr.width; c.height = spr.height;
    c.getContext('2d').drawImage(spr, 0, 0);
    c.className = 'arc-spr' + (cls ? ' ' + cls : '');
    c.style.width = (spr.width * scale / 16) + 'em'; c.style.height = (spr.height * scale / 16) + 'em';
    c.setAttribute('aria-hidden', 'true');
    return c;
  }
  function putSprite(root, sel, spr, scale, cls) { var slot = root.querySelector(sel); if (slot) slot.appendChild(spriteEl(spr, scale, cls)); }
  /* a button that ignores the tail of a double tap and fires once (same idea as app.js arm). It also ignores clicks
     while a finger is still down on the game canvas, so a held steer or tap never presses a card that opened under it. */
  var cvPointers = {};
  function cvHeld() { for (var k in cvPointers) return true; return false; }
  function arm(btn, fn) { var born = Date.now(); btn.onclick = function (e) { if (btn.disabled || Date.now() - born < 300 || cvHeld()) return; btn.disabled = true; fn(e); }; return btn; }

  /* ---------------- state (st.arcade) and rewards ---------------- */
  function AR() {
    var s = host.state(), a = s.arcade;
    if (!a || typeof a !== 'object' || Array.isArray(a)) a = s.arcade = {};
    if (typeof a.sp !== 'number' || !isFinite(a.sp)) a.sp = 0;
    if (!a.b || typeof a.b !== 'object') a.b = {};
    if (typeof a.d !== 'string') a.d = '';
    if (typeof a.x !== 'number' || !isFinite(a.x)) a.x = 0;
    if (!a.p || typeof a.p !== 'object') a.p = {};
    if (typeof a.hide !== 'string') a.hide = '';
    if (typeof a.w !== 'string') a.w = '';
    return a;
  }
  function xpRoom() { var a = AR(), t = host.today(); if (a.d !== t) { a.d = t; a.x = 0; } return Math.max(0, XP_CAP - a.x); }
  /* Play & Learn XP: capped at 40 a day across all six games */
  function giveXP(n) { var g = Math.min(n, xpRoom()); if (g > 0) { AR().x += g; host.addXP(g); } return g; }

  /* ---------------- chiptune SFX (WebAudio, synthesised; silent when the app is muted) ---------------- */
  var AC = null, master = null, noiseBuf = null, listening = false;
  function audio() {
    if (!AC) {
      try {
        var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return null;
        AC = new Ctx(); master = AC.createGain(); master.gain.value = .55; master.connect(AC.destination);
        noiseBuf = AC.createBuffer(1, AC.sampleRate * .7, AC.sampleRate);
        var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) { AC = null; return null; }
    }
    if (AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
    return AC;
  }
  function tone(type, f0, f1, at, dur, vol) {
    var t0 = AC.currentTime + at, o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + .008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + .02);
  }
  function noise(at, dur, vol, f0, f1, q) {
    var t0 = AC.currentTime + at, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = q || 1.2;
    f.frequency.setValueAtTime(f0, t0); if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + .02);
  }
  function arp(notes, step, len, vol, type) { notes.forEach(function (n, i) { tone(type || 'square', n, n, i * step, len, vol); }); }
  var SFX = {
    jump: function () { tone('square', 290, 640, 0, .15, .07); },
    land: function () { noise(0, .07, .08, 500, 180); },
    coin: function () { tone('square', 988, 988, 0, .06, .06); tone('square', 1319, 1319, .06, .2, .06); },
    right: function () { tone('square', 988, 988, 0, .06, .06); tone('square', 1319, 1319, .06, .2, .06); },
    powerup: function () { arp([523, 659, 784, 1047, 1319, 1568], .05, .09, .055); },
    shrink: function () { arp([784, 622, 523, 415, 330, 262], .055, .1, .055); },
    wrong: function () { tone('square', 196, 185, 0, .13, .07); tone('square', 156, 147, .14, .2, .07); },
    hurt: function () { tone('square', 330, 110, 0, .3, .08); noise(0, .12, .05, 900, 300); },
    bump: function () { tone('square', 170, 90, 0, .09, .09); noise(0, .05, .06, 600, 300); },
    pop: function () { tone('triangle', 480, 960, 0, .09, .1); },
    stomp: function () { tone('square', 420, 110, 0, .12, .08); noise(0, .06, .05, 700, 200); },
    fireball: function () { noise(0, .28, .09, 2200, 380, .8); tone('sawtooth', 320, 110, 0, .22, .035); },
    hit: function () { noise(0, .18, .12, 1200, 200, .7); tone('square', 210, 60, 0, .18, .06); },
    boom: function () { noise(0, .7, .16, 600, 60, .5); tone('square', 120, 40, 0, .5, .06); },
    cage: function () { tone('triangle', 330, 660, 0, .12, .09); tone('triangle', 880, 880, .1, .16, .07); },
    flag: function () { arp([523, 659, 784, 1047], .09, .12, .055); tone('square', 1319, 1319, .36, .3, .05); },
    win: function () { arp([523, 659, 784, 1047, 784, 1047, 1319], .1, .14, .05); },
    pause: function () { tone('square', 660, 660, 0, .07, .05); tone('square', 440, 440, .08, .1, .05); },
    unpause: function () { tone('square', 440, 440, 0, .07, .05); tone('square', 660, 660, .08, .1, .05); },
    mic: function () { tone('sine', 880, 1100, 0, .1, .08); },
    clear: function () { arp([784, 988, 1175, 1568], .06, .12, .055); },
    tap: function () { tone('square', 1200, 1200, 0, .03, .03); },
    whoosh: function () { noise(0, .3, .07, 300, 2400, .6); },
    crack: function () { noise(0, .16, .12, 3000, 900, 1.5); tone('square', 600, 200, 0, .1, .04); },
    spring: function () { tone('triangle', 200, 900, 0, .2, .1); },
    step: function () { tone('square', 620, 620, 0, .04, .03); },
    beam: function () { tone('sawtooth', 1300, 300, 0, .2, .04); }
  };
  function sfx(name) {
    if (!host || host.A.muted || listening || !SFX[name]) return;
    if (!audio()) return;
    try { SFX[name](); } catch (e) {}
  }
  ARC.sfx = sfx;

  /* ---------------- init, home pill, practice card ---------------- */
  ARC.init = function (h) {
    host = h;
    try { AR(); } catch (e) {}
    var m = /[?&]arcade=(g\d\d|hub)\b/.exec(location.search);
    if (m) setTimeout(function () {
      var s = host.state();
      if (!s || !s.name || !document.querySelector('.screen .tabs')) return;   // only from the map (never over the welcome or name screen)
      if (m[1] === 'hub') ARC.menu('home'); else { hubFrom = 'home'; if (!ARC.open(m[1])) ARC.menu('home'); }
    }, 0);
  };
  ARC.games = function () { return LIST.map(function (g) { return { id: g.id, num: g.num, name: g.name, sub: g.sub, ready: !!games[g.id] }; }); };

  /* the small "Play & Learn" pill on the map: never blocking, no sound, x hides it for today */
  ARC.homePill = function (screenEl) {
    if (!host || !screenEl) return;
    var a = AR(), t = host.today();
    if (a.hide === t) return;
    var nav = screenEl.querySelector('.tabs'); if (!nav) return;
    var wig = a.w !== t;
    var wrap = document.createElement('div');
    wrap.className = 'arc-pillwrap';
    wrap.innerHTML = '<div class="arc-pill' + (wig ? ' wig' : '') + '"><button class="arc-pill-go" data-arc-pill aria-label="Play and Learn: six mini games">' +
      '<span class="arc-pill-lau"></span><span class="arc-pill-t">Play &amp; Learn</span></button>' +
      '<button class="arc-pill-x" data-arc-pillx aria-label="Hide Play and Learn for today">' + ICON.x + '</button></div>';
    screenEl.insertBefore(wrap, nav);
    screenEl.classList.add('arc-haspill');
    putSprite(wrap, '.arc-pill-lau', PX.lau({ h: 18, form: 'super', mood: 'joy', look: [0, 0] }), 1.55);
    wrap.querySelector('[data-arc-pill]').onclick = function () { ARC.menu('home'); };
    wrap.querySelector('[data-arc-pillx]').onclick = function () {
      AR().hide = host.today(); host.save();
      wrap.remove(); screenEl.classList.remove('arc-haspill');
      host.toast('Play & Learn is in the Practice tab any time.');
    };
    if (wig) { a.w = t; host.save(); }
  };
  /* the Play & Learn card at the top of the Practice tab */
  ARC.practiceCard = function (screenEl) {
    if (!host || !screenEl) return;
    var head = screenEl.querySelector('.page-h'); if (!head) return;
    var b = document.createElement('button');
    b.className = 'arc-pcard'; b.setAttribute('data-arc-card', '');
    b.setAttribute('aria-label', 'Play and Learn: 6 games, earn sparks');
    b.innerHTML = '<span class="arc-pcard-art"></span><span class="arc-pcard-t"><b>Play &amp; Learn</b><small>6 games · earn sparks</small></span>' +
      '<span class="arc-chip"><span class="arc-chip-em"></span>' + AR().sp + '</span>';
    head.parentNode.insertBefore(b, head.nextSibling);
    putSprite(b, '.arc-pcard-art', PX.lau({ h: 27, form: 'super', mood: 'joy', look: [0, 0] }), 1.7);
    putSprite(b, '.arc-chip-em', PX.ember(), 2);
    b.onclick = function () { ARC.menu('practice'); };
  };

  /* ---------------- the hub (games menu) ---------------- */
  var hubFrom = 'home', hubEl = null;
  ARC.menu = function (from, back) {
    if (!host) return;
    if (from) hubFrom = from;
    stopGame();
    var a = AR();
    var tiles = LIST.map(function (g) {
      var ready = !!games[g.id], best = a.b[g.id], played = best != null || !!a.p[g.id];
      var tag = !ready ? '<span class="arc-tag soon">Coming soon</span>' : played ? '<span class="arc-tag best">Best ' + (best || 0) + '</span>' : '<span class="arc-tag new">New</span>';
      return '<button class="arc-tile' + (ready ? '' : ' soon') + '" data-arc-tile="' + g.id + '" aria-label="' + g.num + ', ' + esc(g.name) + ', ' + g.sub +
        (ready ? (played ? ', best ' + (best || 0) : ', new') : ', coming soon') + '"><span class="arc-tile-art"></span><b>' + esc(g.name) + '</b><small>' + g.sub + '</small>' + tag + '</button>';
    }).join('');
    var el = host.mount('<div class="arc-hd"><button class="arc-back" data-arc-back aria-label="Back">' + ICON.left + '</button>' +
      '<span class="arc-chip" aria-label="' + a.sp + ' sparks"><span class="arc-chip-em"></span>' + a.sp + '</span>' +
      '<span class="arc-hd-lau"></span><h1>Play &amp; Learn</h1><p>Pick a game</p></div>' +
      '<div class="scroll arc-hub-scroll"><div class="arc-grid">' + tiles + '</div>' +
      '<p class="arc-note">Every game teaches the Unit 1 words. Up to ' + XP_CAP + ' XP a day; lessons stay the main way to earn.</p></div>', 'arc-hub', back);
    hubEl = el;
    putSprite(el, '.arc-hd-lau', PX.lau({ h: 27, form: 'super', mood: 'joy', look: [-0.5, 0.5] }), 2.5, 'bob');
    putSprite(el, '.arc-hd .arc-chip-em', PX.ember(), 2);
    LIST.forEach(function (g) {
      var slot = el.querySelector('[data-arc-tile="' + g.id + '"] .arc-tile-art');
      var def = games[g.id], spr = def && def.icon ? def.icon() : g.icon(), sc = def && def.iconScale || g.sc;
      if (slot) slot.appendChild(spriteEl(spr, sc));
    });
    el.querySelector('[data-arc-back]').onclick = function () { leaveHub(false); };
    el.querySelectorAll('[data-arc-tile]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-arc-tile');
        if (!games[id]) { host.toast(meta(id).name + ' is coming soon.'); return; }
        intro(id);
      };
    });
    host.sub(hubBack);
    return el;
  };
  function hubBack(fromPop) {
    if (closeHubSheet()) { if (fromPop) host.sub(hubBack); return; }     // Back closes the intro sheet first
    leaveHub(fromPop);
  }
  function leaveHub(fromPop) {
    hubEl = null;
    if (hubFrom === 'practice' && host.practice) host.practice(); else host.goHome(fromPop);
  }
  function closeHubSheet() { var s = hubEl && hubEl.querySelector('.arc-sheet'); if (s) { s.remove(); return true; } return false; }

  /* intro sheet: icon, name, 3 one-line rules, Play */
  function intro(id) {
    if (!hubEl) return;
    closeHubSheet();
    var def = games[id], m = meta(id);
    var rules = (def.rules || []).slice(0, 3);
    var sh = document.createElement('div');
    sh.className = 'arc-sheet';
    sh.innerHTML = '<div class="arc-sheet-card" role="dialog" aria-modal="true" aria-label="' + esc(m.name) + '">' +
      '<button class="arc-x" data-arc-x aria-label="Close">' + ICON.x + '</button>' +
      '<div class="arc-intro-hd"><span class="arc-intro-art"></span><div><span class="arc-num">' + m.num + '</span><h2>' + esc(m.name) + '</h2><p>' + esc(def.sub || m.sub) + '</p></div></div>' +
      '<ol class="arc-rules">' + rules.map(function (r, i) { return '<li><span>' + (i + 1) + '</span>' + esc(r) + '</li>'; }).join('') + '</ol>' +
      '<button class="btn" data-arc-play>' + ICON.play + 'Play</button></div>';
    hubEl.appendChild(sh);
    var spr = def.icon ? def.icon() : m.icon();
    putSprite(sh, '.arc-intro-art', spr, (def.iconScale || m.sc) * .8);
    sh.addEventListener('click', function (e) { if (e.target === sh) sh.remove(); });
    sh.querySelector('[data-arc-x]').onclick = function () { sh.remove(); };
    arm(sh.querySelector('[data-arc-play]'), function () { ARC.open(id); });
    try { sh.querySelector('[data-arc-play]').focus({ preventScroll: true }); } catch (e) {}
  }

  ARC.registerGame = function (def) {
    if (!def || !def.id) return;
    var m = meta(def.id) || {};
    def.num = def.num || m.num; def.name = def.name || m.name; def.sub = def.sub || m.sub;
    def.controls = def.controls || {};
    def.lives = def.lives || 3;
    games[def.id] = def;
  };

  /* ---------------- the game screen, run and loop ---------------- */
  var run = null, raf = 0, last = 0, acc = 0, speed = 1, playEl = null;

  function Run(def, el, G) {
    var R = this;
    R.id = def.id; R.def = def; R.el = el; R.G = G;
    R.t = 0; R.s = {}; R.phase = 'start';
    R.lives = def.lives; R.hearts = def.lives;
    R.sparks = 0; R.shown = 0; R.right = 0; R.wrong = 0; R.score = 0; R.missed = []; R.sayXP = 0; R.said = [];
    R.over = false; R.dead = false; R.frozen = 0; R.paused = false;
    R.timers = []; R.fx = []; R.embers = []; R.shakeT = -9; R.shakeA = 0; R.flashT = -9; R.flashA = 0; R.hurtT = -9; R.jumpT = -9;
    R.input = { left: false, right: false };
    R.layout = { hudY: 40, top: 0, bot: 0, jump: { x: 318, y: 772, r: 38 } };
  }
  Run.prototype = {
    after: function (sec, fn) { this.timers.push({ at: this.t + sec, fn: fn }); },
    sfx: function (n) { sfx(n); },
    word: function (slug, slow) { var w = host.D.BY[slug]; if (w) return host.A.word(w, slow); },
    /* a right answer: counts, sparks (default 1) fly from (sx, sy) to the HUD */
    good: function (slug, o) {
      o = o || {};
      this.right++;
      var n = o.sparks == null ? 1 : o.sparks;
      if (n) this.addSparks(n, o.from ? o.from[0] : 195, o.from ? o.from[1] : this.G.SH / 2);
      announce('Right: ' + (host.D.BY[slug] ? host.D.BY[slug].word : slug));
    },
    /* a wrong answer: counts and goes on the end card's "to remember" list */
    bad: function (slug, rightText) { this.wrong++; this.miss(slug, rightText); announce('Not quite. ' + (rightText || '')); },
    miss: function (slug, rightText) {
      var w = host.D.BY[slug];
      for (var i = 0; i < this.missed.length; i++) if (this.missed[i].slug === slug) { this.missed[i].n++; return; }
      this.missed.push({ slug: slug, word: w ? w.word : slug, right: rightText || (ARC.bank && ARC.bank.MEAN[slug]) || '', n: 1 });
    },
    addSparks: function (n, sx, sy) {
      var R = this;
      R.sparks += n;
      var hud = R.hudSparks();
      var vis = Math.min(n, 8);
      for (var i = 0; i < vis; i++) R.embers.push({ t0: R.t + i * .05, i: i, n: vis, sx: sx, sy: sy, tx: hud[0], ty: hud[1], val: i === vis - 1 ? n - (vis - 1) : 1 });
    },
    loseHeart: function () {
      if (this.hearts > 0) { this.hearts--; this.hurtT = this.t; }
      return this.hearts;
    },
    gainHeart: function () { if (this.hearts < this.lives) { this.hearts++; return true; } return false; },
    end: function (o) { endRun(this, o || {}); },
    /* ask for one render while the loop is paused (a sheet is open): e.g. the world moving behind the Say-it card */
    redraw: function () { this.dirty = true; },
    say: function (o) { return ARC.say(o); },
    burst: function (gx, gy, n, cols) { this.fx.push({ k: 'b', t0: this.t, x: gx, y: gy, n: n || 14, c: cols || [C.lime, C.gold, C.coral, C.peri, C.mint], seed: Math.random() * 99 }); },
    float: function (str, sx, sy, col) { this.fx.push({ k: 'f', t0: this.t, x: sx, y: sy, s: str, c: col || C.navy }); },
    shake: function (a) { this.shakeT = this.t; this.shakeA = a || 5; },
    flash: function (a) { this.flashT = this.t; this.flashA = a || .45; },
    shakeX: function () { return reduceMotion ? 0 : Math.round(jiggle(this.t, this.shakeT, this.shakeA, 46, 9)); },
    jumpLit: function () { return this.t - this.jumpT < .18 && this.t >= this.jumpT - .02; },
    hudSparks: function () { return [this.hudX.em, this.layout.hudY]; },
    announce: function (m) { announce(m); }
  };

  function hudLayout(R) {
    var G = R.G, top = playEl && playEl.querySelector('[data-arc-quit]');
    var y = 40;
    if (top) { var br = top.getBoundingClientRect(), cr = G.cv.getBoundingClientRect(); y = (br.top + br.height / 2 - cr.top) / G.css; }
    R.layout.hudY = y; R.layout.top = G.top; R.layout.bot = G.bot;
    var jp = R.def.jumpPos ? R.def.jumpPos(R, G) : null;
    R.layout.jump = jp || { x: 318, y: G.SH - G.bot - 72, r: 38 };
    R.hudX = { h0: 50, em: 286 };
    R.hudFit = null;
  }

  ARC.open = function (id) {
    if (!host) return false;
    var def = games[id];
    if (!def) { host.toast((meta(id) ? meta(id).name : 'This game') + ' is coming soon.'); return false; }
    stopGame();
    var el = host.mount('<div class="arc-stage"></div>' +
      '<button class="arc-hbtn arc-quit" data-arc-quit aria-label="Quit game">' + ICON.x + '</button>' +
      '<button class="arc-hbtn arc-pause" data-arc-pause aria-label="Pause">' + ICON.pause + '</button>' +
      '<div class="arc-layer"></div><p class="arc-live" aria-live="polite"></p>', 'arc-play');
    playEl = el;
    var stage = el.querySelector('.arc-stage');
    var G = PX.game(stage);
    var R = run = new Run(def, el, G);
    var pb = AR().b[id];
    R.best = typeof pb === 'number' ? pb : null;    // the best score before this run (null on a first run)
    hudLayout(R);
    el.querySelector('[data-arc-quit]').onclick = function () { askQuit(); };
    el.querySelector('[data-arc-pause]').onclick = function () { pauseSheet(); };
    bindInput(R);
    host.sub(onBackInGame);
    audio();                               // the tap that opened the game unlocks WebAudio on iPhone
    if (document.fonts && document.fonts.load) {
      Promise.all(['800 20px Lexend', '700 20px Lexend', '600 20px Lexend', '600 20px Hind', '700 16px Figtree'].map(function (f) { return document.fonts.load(f); }))
        .then(function () { if (run === R) { G.clearCache(); R.hudFit = null; render(); } }).catch(function () {});   // re-fit the HUD label in the web font
    }
    try { def.init(R); } catch (e) { console.error(e); }
    last = performance.now(); acc = 0;
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    render();
    return true;
  };
  function onBackInGame(fromPop) {
    if (!run) return;
    if (fromPop) host.sub(onBackInGame);          // Back used up our history entry; keep one while the game is open
    if (run.over) { ARC.menu(); return; }
    askQuit();
  }
  function askQuit() {
    if (!run || run.over) { ARC.menu(); return; }
    var R = run;
    R.frozen++;
    host.confirm({ title: 'Quit this game?', text: 'This run won’t count. Your words said so far stay saved.', ok: 'Quit', cancel: 'Keep playing',
      onOk: function () { R.frozen = Math.max(0, R.frozen - 1); quitToHub(); },
      onCancel: function () { R.frozen = Math.max(0, R.frozen - 1); last = performance.now(); } });
  }
  function quitToHub() { stopGame(); ARC.menu(); }
  function stopGame() {
    if (!run) return;
    var R = run; run = null; R.dead = true;
    cancelAnimationFrame(raf);
    try { host.S.cancel(); } catch (e) {}
    try { host.A.stop(); } catch (e) {}
    listening = false;
    if (sayOpen) {                       // quitting from the Say-it card: close it and settle its promise (games check R.dead)
      var so = sayOpen; sayOpen = null;
      try { so.sheet.remove(); } catch (e) {}
      try { so.cancel(); } catch (e) {}
    }
    unbindInput();
    try { R.def.destroy && R.def.destroy(R); } catch (e) {}
    playEl = null;
  }
  function paused() { return !run || run.cardShown || run.frozen > 0 || run.paused || document.hidden; }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    var R = run;
    if (!R) return;
    if (!document.body.contains(R.el)) { stopGame(); return; }
    var dt = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now;
    if (paused()) { if (R.dirty) render(); return; }
    acc += dt * speed;
    var n = 0, max = Math.ceil(6 * Math.max(1, speed));
    while (acc >= STEP && n < max) { stepRun(R, STEP); acc -= STEP; n++; if (R !== run || R.cardShown || R.frozen) { acc = 0; break; } }
    if (n >= max) acc = 0;
    render();
  }
  function stepRun(R, dt) {
    R.t += dt;
    if (R.over && !R.cardShown && R.t >= R.endAt) {
      R.cardShown = true; R.shown = R.sparks; R.embers = []; R.fx = [];     // land every spark before the scene freezes
      endCard(R, R.endOpts); return;
    }
    if (R.timers.length) {
      var due = [];
      for (var i = R.timers.length - 1; i >= 0; i--) if (R.timers[i].at <= R.t) { due.push(R.timers[i]); R.timers.splice(i, 1); }
      due.sort(function (a, b) { return a.at - b.at; });
      for (var j = 0; j < due.length; j++) { try { due[j].fn(); } catch (e) { console.error(e); } if (R.dead) return; }
    }
    try { R.def.update && R.def.update(R, dt); } catch (e) { console.error(e); }
    for (var f = R.fx.length - 1; f >= 0; f--) if (R.t - R.fx[f].t0 > 1.3) R.fx.splice(f, 1);
    for (var m = R.embers.length - 1; m >= 0; m--) {
      var em = R.embers[m];
      if (R.t - em.t0 >= .75) { R.shown += em.val; R.embers.splice(m, 1); R.ringT = R.t; if (em.i === 0) sfx('coin'); }
    }
  }

  /* ---------------- rendering: game draw, fx, HUD, JUMP button ---------------- */
  function render() {
    var R = run; if (!R) return;
    R.dirty = false;
    var G = R.G;
    try { R.def.draw(R, G); } catch (e) { console.error(e); G.clear(C.sky); }
    var ctx = G.ctx;
    ctx.setTransform(G.k, 0, 0, G.k, 0, 0); ctx.globalAlpha = 1;
    drawFx(R, G);
    if (R.def.hud !== false) drawHud(R, G);
    if (R.def.controls.jump) drawJump(R, G);
    if (R.def.drawTop) { try { R.def.drawTop(R, G); } catch (e) { console.error(e); } }
    var fa = R.flashA * (1 - (R.t - R.flashT) / .16);
    if (fa > 0 && !reduceMotion) { ctx.save(); ctx.globalAlpha = fa; ctx.fillStyle = C.white; ctx.fillRect(0, 0, 390, G.SH); ctx.restore(); }
  }
  function drawFx(R, G) {
    for (var i = 0; i < R.fx.length; i++) {
      var f = R.fx[i], d = R.t - f.t0;
      if (f.k === 'b') {
        if (d > 1.2) continue;
        for (var j = 0; j < f.n; j++) {
          var a = hash(j + f.seed * 7) * Math.PI * 2, sp = 18 + hash(j * 3.1 + f.seed) * 30;
          G.rect(f.x + Math.cos(a) * sp * d, f.y + Math.sin(a) * sp * d + 40 * d * d, 2, 2, f.c[j % f.c.length], 1 - d / 1.2);
        }
      } else if (f.k === 'f') {
        if (d > 1.1) continue;
        G.text(f.s, f.x, f.y - 40 * E.out(clamp(d / 1.1)), { size: 22, weight: 800, color: f.c, stroke: C.white, strokeW: 6, alpha: 1 - p(d, .7, 1.1) });
      }
    }
    var ember = PX.ember();
    for (var e = 0; e < R.embers.length; e++) {
      var m = R.embers[e], dd = R.t - m.t0; if (dd < 0) continue;
      var ang = -.25 + (m.i - (m.n - 1) / 2) * .5, ex = m.sx + Math.cos(ang) * 60, ey = m.sy + Math.sin(ang) * 60 - 20, x, y, s;
      if (dd < .25) { var u = E.out(dd / .25); x = m.sx + (ex - m.sx) * u; y = m.sy + (ey - m.sy) * u; s = 1.2; }
      else {
        var w = E.inOut(clamp((dd - .25) / .5)), qx = (ex + m.tx) / 2 + 60, qy = Math.min(ey, m.ty) - 40;
        x = (1 - w) * (1 - w) * ex + 2 * (1 - w) * w * qx + w * w * m.tx; y = (1 - w) * (1 - w) * ey + 2 * (1 - w) * w * qy + w * w * m.ty; s = 1.2 - .3 * w;
      }
      G.sprS(ember, x, y, s);
    }
  }
  function drawHud(R, G) {
    var y = R.layout.hudY, ctx = G.ctx, i;
    var lifeIcon = R.def.lifeIcon || PX.heart;
    for (i = 0; i < R.lives; i++) {
      var spr = lifeIcon(i < R.hearts), cx = R.hudX.h0 + 11 + i * 23, s = 1;
      if (i === R.hearts && R.t - R.hurtT < .5) s = 1 + .6 * (1 - (R.t - R.hurtT) / .5);
      G.sprS(spr, cx, y, s);
    }
    if (R.def.hudLabel !== false) {
      var hx = R.hudX.h0 + R.lives * 23 + 4, ex = R.hudX.em - 14, room = ex - hx - 20;
      var fit = R.hudFit;
      if (!fit || fit.room !== room) {
        fit = R.hudFit = { room: room, label: R.def.label || (R.def.num + ' · ' + R.def.name), size: 15 };
        ctx.save();
        var tries = [[fit.label, 15], [fit.label, 14], [fit.label, 13], [R.def.name, 15], [R.def.name, 13], [R.def.name, 12]];
        for (var q = 0; q < tries.length; q++) {
          ctx.font = '700 ' + tries[q][1] + 'px Lexend, sans-serif';
          if (ctx.measureText(tries[q][0]).width + 24 <= room || q === tries.length - 1) { fit.label = tries[q][0]; fit.size = tries[q][1]; break; }
        }
        ctx.restore();
      }
      G.pill(fit.label, (hx + ex) / 2, y, { size: fit.size, bg: C.navy, color: C.lime, pad: 12, shadow: false });
    }
    var rs = R.ringT != null ? R.t - R.ringT : 9;
    G.sprS(PX.ember(), R.hudX.em, y, 1 + (rs < .2 ? .25 * (1 - rs / .2) : 0));
    G.text(String(R.shown), R.hudX.em + 16, y + 1, { size: 22, weight: 800, color: C.navy, align: 'left', stroke: C.white, strokeW: 6 });
    if (rs < .25 && !reduceMotion) { ctx.save(); ctx.globalAlpha = .8 * (1 - rs / .25); ctx.strokeStyle = C.white; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(R.hudX.em, y, 12 + rs * 70, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  }
  function drawJump(R, G) {
    var j = R.layout.jump, lit = R.jumpLit(), ctx = G.ctx;
    ctx.save();
    if (R.def.jumpAlpha != null) ctx.globalAlpha = typeof R.def.jumpAlpha === 'function' ? R.def.jumpAlpha(R) : R.def.jumpAlpha;
    ctx.fillStyle = 'rgba(11,18,64,.25)'; ctx.beginPath(); ctx.arc(j.x, j.y + 6, j.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = lit ? C.limeDk : C.lime; ctx.beginPath(); ctx.arc(j.x, j.y + (lit ? 4 : 0), j.r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = C.navy; ctx.stroke();
    ctx.fillStyle = C.navy; ctx.font = '800 17px Lexend, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(R.def.jumpText || 'JUMP', j.x, j.y + 1 + (lit ? 4 : 0));
    ctx.restore();
  }

  /* ---------------- input ---------------- */
  var bound = null;
  function bindInput(R) {
    var cv = R.G.cv, holds = {};
    function pt(e) {
      var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / R.G.css, y = (e.clientY - r.top) / R.G.css;
      return { x: x, y: y, gx: x / 3, gy: y / 3 };
    }
    function down(e) {
      cvPointers[e.pointerId] = 1;          // tracked even while paused (see arm)
      if (!run || run !== R || paused() || R.over) return;
      e.preventDefault();
      audio();
      var q = pt(e), j = R.layout.jump;
      if (R.def.controls.jump && Math.hypot(q.x - j.x, q.y - j.y) <= j.r + 12) { R.jumpT = R.t; R.def.jump && R.def.jump(R); return; }
      if (R.def.controls.hold) {
        var dir = q.x < 195 ? 'left' : 'right';
        holds[e.pointerId] = dir; R.input[dir] = true; R.def.hold && R.def.hold(R, dir, true, q);
        if (!R.def.controls.tapToo) return;
      }
      R.def.tap && R.def.tap(R, q);
    }
    function up(e) {
      delete cvPointers[e.pointerId];
      var dir = holds[e.pointerId]; if (!dir) return;
      delete holds[e.pointerId];
      var still = false; for (var k2 in holds) if (holds[k2] === dir) still = true;
      if (!still) { R.input[dir] = false; R.def.hold && R.def.hold(R, dir, false); }
    }
    function key(e) {
      if (!run || run !== R) return;
      var tg = e.target && e.target.tagName;
      if (tg === 'BUTTON' || tg === 'INPUT' || document.querySelector('.overlay')) return;
      if (e.key === 'Escape') { e.preventDefault(); if (!paused()) pauseSheet(); return; }
      if (paused()) return;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        if (e.repeat) return;
        if (R.def.controls.jump) { R.jumpT = R.t; R.def.jump && R.def.jump(R); } else if (R.def.key) R.def.key(R, e.key);
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && R.def.controls.hold) {
        e.preventDefault(); var d = e.key === 'ArrowLeft' ? 'left' : 'right';
        if (!R.input[d]) { R.input[d] = true; R.def.hold && R.def.hold(R, d, true); }
      } else if (R.def.key) R.def.key(R, e.key);
    }
    function keyup(e) {
      if (!run || run !== R || !R.def.controls.hold) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { var d = e.key === 'ArrowLeft' ? 'left' : 'right'; R.input[d] = false; R.def.hold && R.def.hold(R, d, false); }
    }
    function vis() { if (document.hidden && run === R && !R.over && !R.frozen && !R.paused) pauseSheet(true); last = performance.now(); }
    function resize() { if (run !== R) return; R.G.resize(); hudLayout(R); R.dirty = true; render(); }
    /* a touch that starts on the canvas never turns into a click: a card that opened under the finger is not pressed
       when it lifts (the engine only uses pointer events on the canvas) */
    function tend(e) { if (e.cancelable) e.preventDefault(); }
    cv.addEventListener('pointerdown', down, { passive: false });
    cv.addEventListener('touchend', tend, { passive: false });
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    document.addEventListener('keydown', key); document.addEventListener('keyup', keyup);
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('resize', resize);
    bound = function () {
      cv.removeEventListener('pointerdown', down);
      cv.removeEventListener('touchend', tend);
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      document.removeEventListener('keydown', key); document.removeEventListener('keyup', keyup);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('resize', resize);
    };
  }
  function unbindInput() { if (bound) { bound(); bound = null; } cvPointers = {}; }
  function announce(m) { var l = playEl && playEl.querySelector('.arc-live'); if (l) { l.textContent = ''; setTimeout(function () { l.textContent = m; }, 30); } }

  /* ---------------- sheets inside the game screen ---------------- */
  function layer() { return playEl && playEl.querySelector('.arc-layer'); }
  function pauseSheet(auto) {
    var R = run; if (!R || R.over || R.paused) return;
    R.paused = true;
    sfx('pause');
    var L = layer(), sh = document.createElement('div');
    sh.className = 'arc-sheet dim';
    sh.innerHTML = '<div class="arc-sheet-card arc-pausecard" role="dialog" aria-modal="true" aria-label="Paused">' +
      '<h2>Paused</h2><p>' + (auto ? 'The game waited for you.' : 'Take your time.') + '</p>' +
      '<button class="btn" data-arc-resume>Resume</button>' +
      '<button class="btn ghost" data-arc-sound>' + (host.A.muted ? 'Sound: off' : 'Sound: on') + '</button>' +
      '<button class="btn ghost arc-quitbtn" data-arc-q>Quit game</button></div>';
    L.appendChild(sh);
    function resume() { sh.remove(); R.paused = false; last = performance.now(); sfx('unpause'); }
    sh.querySelector('[data-arc-resume]').onclick = resume;
    sh.querySelector('[data-arc-sound]').onclick = function (e) { host.A.setMuted(!host.A.muted); e.currentTarget.textContent = host.A.muted ? 'Sound: off' : 'Sound: on'; };
    sh.querySelector('[data-arc-q]').onclick = function () { sh.remove(); R.paused = false; askQuit(); };
    try { sh.querySelector('[data-arc-resume]').focus({ preventScroll: true }); } catch (e) {}
  }

  /* ---------------- the shared Say-it checkpoint ----------------
     ARC.say({slug, title, sub, tip}) -> Promise {passed, method: 'mic'|'trainer'|'tap', firstTry, heard}
     Same behaviour as the app's Say-it lesson (speech.js): mic in auto mode (2 tries; no-speech/busy/network errors
     don't use a try; a blocked mic switches this sheet to trainer check), trainer check where speech can't run, and a
     tap check (hear the model, tap the right written say-guide). Mic/trainer passes count for the unit (host.markSaid);
     the tap check is a game reward only. The learner's own voice is never played back. */
  var sayOpen = null;
  ARC.say = function (o) {
    return new Promise(function (resolve) {
      var R = run, L = layer();
      var w = host.D.BY[o.slug];
      if (!R || !L || !w) { resolve({ passed: false, method: 'none', firstTry: false, heard: '' }); return; }
      R.frozen++;
      sfx('pause');
      var S = host.S, A = host.A, bank = ARC.bank || {};
      var tries = 0, trainerHere = false, done = false, mode = 'say';
      var sh = document.createElement('div');
      sh.className = 'arc-sheet dim arc-saysheet';
      sh.innerHTML = '<div class="arc-say" role="dialog" aria-modal="true" aria-label="' + esc(o.title || 'Say it clearly') + '">' +
        '<div class="arc-say-hd"><span class="arc-say-bolo"></span><div><h2>' + esc(o.title || 'Say it clearly') + '</h2><p>' + esc(o.sub || 'The game waits for you') + '</p></div></div>' +
        '<div class="arc-say-w"><b>' + esc(w.word) + '</b><small>' + esc(w.say) + ' · <i class="hi" lang="hi">' + w.hi + '</i></small></div>' +
        '<span class="arc-tip">' + esc(o.tip || bank.TIPS && bank.TIPS[w.slug] || ('Say ' + w.say)) + '</span>' +
        '<div class="arc-say-audio"><button class="arc-abtn" data-arc-hear aria-label="Hear the word">' + ICON.spk + 'Hear</button><button class="arc-abtn" data-arc-slow aria-label="Hear it slowly">Slow</button></div>' +
        '<div class="arc-say-act"></div><p class="arc-say-note" aria-live="polite"></p>' +
        '<button class="arc-link" data-arc-tapcheck>Can’t use the mic? Tap check</button></div>';
      L.appendChild(sh);
      var sayTimer = 0;
      sayOpen = { slug: o.slug, sheet: sh, mode: function () { return mode === 'tap' ? 'tap' : (trainerHere || S.mode() === 'trainer') ? 'trainer' : 'auto'; }, tries: function () { return tries; },
        /* stopGame() (quit, Back, hub) while the card is open: settle the promise as a no-say */
        cancel: function () { clearTimeout(sayTimer); if (!done) { done = true; listening = false; resolve({ passed: false, method: 'none', firstTry: false, heard: '' }); } } };
      putSprite(sh, '.arc-say-bolo', PX.bolo({ look: [0, 0] }), 3.2);
      var act = sh.querySelector('.arc-say-act'), note = sh.querySelector('.arc-say-note');
      var hearB = sh.querySelector('[data-arc-hear]'), slowB = sh.querySelector('[data-arc-slow]'), tapLink = sh.querySelector('[data-arc-tapcheck]');
      hearB.onclick = function () { A.word(w); };
      slowB.onclick = function () { A.word(w, true); };
      arm(tapLink, function () { tapCheck(); });
      function audioBtns(on) { hearB.disabled = slowB.disabled = !on; tapLink.disabled = !on; }
      function setBolo(ear) { var s = sh.querySelector('.arc-say-bolo'); s.innerHTML = ''; s.appendChild(spriteEl(PX.bolo({ look: [0, 0], ear: ear }), 3.2)); }

      function finish(res) {
        if (done) return; done = true;
        clearTimeout(sayTimer);
        if (o.retry) res.firstTry = false;                 // a word the game brought back is never a first try (+2 XP, no first-try count)
        if (res.passed && res.method !== 'mic') {          // the same "clear" moment the mic shows
          act.innerHTML = '<span class="arc-mic ok" aria-hidden="true">' + ICON.check + '</span><p class="arc-miclbl ok"><b>✓ ' + (res.method === 'tap' ? 'Right: ' + esc(w.say) : 'Clear') + '</b></p>';
          tapLink.hidden = true;
        }
        if (res.passed && (res.method === 'mic' || res.method === 'trainer')) {
          try { host.markSaid(w.slug, res.method, res.heard || '', res.firstTry, true); } catch (e) { console.error(e); }
          var got = giveXP(res.firstTry ? 3 : 2); R.sayXP += got;
          R.said.push(w.slug);
        }
        sfx(res.passed ? 'clear' : 'unpause');
        setTimeout(function () {
          sh.remove(); if (sayOpen && sayOpen.sheet === sh) sayOpen = null;
          R.frozen = Math.max(0, R.frozen - 1); last = performance.now();
          resolve(res);
        }, res.passed ? 650 : 0);
      }
      function record(passed, method, heard) { if (!passed) { try { host.markSaid(w.slug, method, heard || '', false, false); } catch (e) {} } }
      function micMode() {
        mode = 'say';
        if (trainerHere || S.mode() === 'trainer') return trainerMode();
        act.innerHTML = '<button class="arc-mic" data-arc-mic aria-label="Tap and say ' + esc(w.word) + '">' + ICON.mic + '</button><p class="arc-miclbl">Tap and say it</p>';
        act.querySelector('[data-arc-mic]').onclick = listen;
        tapLink.hidden = false;
      }
      function listen() {
        var mic = act.querySelector('[data-arc-mic]'), lbl = act.querySelector('.arc-miclbl');
        if (!mic || mic.classList.contains('live')) return;
        mic.classList.add('live'); lbl.textContent = 'Starting the mic…'; note.textContent = '';
        audioBtns(false); sfx('mic'); listening = true; setBolo(true);
        S.listen(w, {
          onStart: function () { lbl.textContent = 'Listening…'; },
          onSpeech: function () { lbl.textContent = 'Hearing you…'; }
        }).then(function (r) {
          listening = false; setBolo(false);
          if (done || !document.body.contains(sh)) return;
          audioBtns(true);
          if (r.status === 'pass') {
            mic.classList.remove('live'); mic.classList.add('ok'); mic.innerHTML = ICON.check;
            lbl.innerHTML = 'Heard: “' + esc(r.heard) + '” <b>✓ Clear</b>'; lbl.classList.add('ok');
            finish({ passed: true, method: 'mic', firstTry: tries === 0, heard: r.heard });
            return;
          }
          mic.classList.remove('live'); lbl.textContent = 'Tap and say it';
          if (r.status === 'nospeech') { note.textContent = 'I didn’t hear anything. Tap the mic and speak a little louder.'; return; }
          if (r.status === 'busy') { note.textContent = 'Another app is using the microphone. Close it and tap again.'; return; }
          if (r.status === 'network' || r.status === 'error') { note.textContent = 'Speech check needs mobile data. Check your connection and tap again.'; return; }
          if (r.status === 'denied') { trainerHere = true; return trainerMode(S.why() || 'The microphone is off on this phone.'); }
          tries++; record(false, 'mic', r.heard);
          if (tries < 2) {
            note.innerHTML = (r.heard ? 'We heard “' + esc(r.heard) + '”. ' : '') + 'Hear it slowly, then say <b>' + esc(w.say) + '</b> once more.';
            A.word(w, true);
          } else notClear('We heard “' + esc(r.heard || '…') + '”.');
        });
      }
      function trainerMode(reason) {
        mode = 'say';
        var why = reason ? esc(reason) + ' ' : trainerHere ? '' : (S.why() ? esc(S.why()) + ' ' : '');
        act.innerHTML = '<div class="arc-trainer"><p>' + why + '<b>Trainer check:</b> play the word, ask the APC to say it, and mark it.</p>' +
          '<div class="arc-g2"><button class="btn ghost" data-arc-tn>' + (tries ? 'Not yet' : 'Try again') + '</button><button class="btn" data-arc-ty>Clear</button></div></div>';
        arm(act.querySelector('[data-arc-ty]'), function () { finish({ passed: true, method: 'trainer', firstTry: tries === 0, heard: '' }); });
        arm(act.querySelector('[data-arc-tn]'), function () {
          tries++; record(false, 'trainer', '');
          if (tries < 2) { note.innerHTML = 'Hear it slowly, then say <b>' + esc(w.say) + '</b> once more.'; A.word(w, true); trainerMode(); }
          else notClear('');
        });
        tapLink.hidden = false;
      }
      function notClear(lead) {
        tapLink.hidden = true;
        note.innerHTML = lead + ' Not clear yet. Hear it slowly once more; you can try it again in the Say-it lesson.';
        act.innerHTML = '<button class="btn" data-arc-cont>Keep playing</button>';
        A.word(w, true);
        arm(act.querySelector('[data-arc-cont]'), function () { finish({ passed: false, method: trainerHere || S.mode() === 'trainer' ? 'trainer' : 'mic', firstTry: false, heard: '' }); });
      }
      /* tap check: hear the model voice, tap the right written say-guide (the wrong ones are never played) */
      function tapCheck() {
        mode = 'tap';
        S.cancel(); listening = false;
        tapLink.hidden = true; note.textContent = '';
        var opts = shuffle([w.say].concat((bank.SAYALT && bank.SAYALT[w.slug]) || []));
        act.innerHTML = '<p class="arc-taphd">Listen, then tap how it sounds</p><div class="arc-tapopts">' +
          opts.map(function (s) { return '<button class="arc-topt" data-arc-say="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>';
        A.word(w);
        act.querySelectorAll('[data-arc-say]').forEach(function (b) {
          b.onclick = function () {
            if (done) return;
            var ok = b.getAttribute('data-arc-say') === w.say;
            act.querySelectorAll('[data-arc-say]').forEach(function (x) { x.disabled = true; if (x.getAttribute('data-arc-say') === w.say) x.classList.add('ok'); });
            if (ok) { finish({ passed: true, method: 'tap', firstTry: true, heard: '' }); }
            else {
              b.classList.add('bad'); sfx('wrong');
              note.innerHTML = 'It’s <b>' + esc(w.say) + '</b>. Listen once more.'; A.word(w, true);
              var c = document.createElement('button'); c.className = 'btn'; c.textContent = 'Keep playing'; c.setAttribute('data-arc-cont', '');
              act.appendChild(c);
              arm(c, function () { finish({ passed: false, method: 'tap', firstTry: false, heard: '' }); });
            }
          };
        });
      }
      micMode();
      sayTimer = setTimeout(function () { if (!done && mode !== 'tap' && run === R) A.word(w); }, 350);
      var dlg = sh.querySelector('.arc-say'); dlg.setAttribute('tabindex', '-1');
      try { dlg.focus({ preventScroll: true }); } catch (e) {}
    });
  };

  /* ---------------- end of a run: rewards, persistence, end card ---------------- */
  function endRun(R, o) {
    if (R.over || R.dead) return;
    R.over = true;
    listening = false;
    var a = AR(), today = host.today();
    var score = o.score != null ? o.score : (R.score || R.sparks);
    var prev = a.b[R.id];
    if (typeof prev !== 'number') prev = null;
    /* a finished run (pays the daily +10 XP once per game, and with 5+ right counts as today's practice):
       - at least as many right answers as wrong ones (random tapping never pays), and
       - it reached its end with at least `minRight` right (end option, else def.minRight, else 3), or it lasted to
         5 right answers before the hearts ran out. A run nobody played never pays. */
    var need = o.minRight != null ? o.minRight : R.def.minRight != null ? R.def.minRight : 3;
    var outNeed = Math.max(5, need);
    var finished = R.right >= R.wrong && (o.reason === 'out' ? R.right >= outNeed : R.right >= need), runXP = 0;
    var isBest = score > 0 && (prev == null ? finished : score > prev);    // no "New best" for a first run that didn't count
    if (score > 0 && (prev == null || score > prev)) a.b[R.id] = score;     // never a "Best 0"
    a.sp += R.sparks;
    if (finished && a.p[R.id] !== today) { a.p[R.id] = today; runXP = giveXP(XP_RUN); }
    var grew = false;
    if (finished && R.right >= 5) { try { host.ensureToday(); grew = host.touchStreak(); } catch (e) {} }
    host.save(true);
    R.result = { score: score, best: isBest, prev: prev, xp: runXP + R.sayXP, sparks: R.sparks, right: R.right, wrong: R.wrong, reason: o.reason || 'done', streak: grew, capped: xpRoom() === 0,
      runXP: runXP, finished: finished, unpaid: !finished && a.p[R.id] !== today,
      need: o.reason === 'out' ? outNeed : need };
    sfx(o.reason === 'out' ? 'shrink' : 'win');
    R.endOpts = o; R.endAt = R.t + (o.delay == null ? .6 : o.delay);   // the world keeps moving briefly, then the card
  }
  function endCard(R, o) {
    var L = layer(); if (!L) return;
    var r = R.result, title = o.title || (r.reason === 'out' ? 'Out of hearts' : r.reason === 'time' ? 'Time’s up' : 'Run complete');
    var miss = R.missed;                     // every miss: this list is the learning (the card scrolls, its buttons stay in view)
    /* why today's +10 didn't pay, in the player's terms */
    var lowRight = r.right < r.need, lopsided = r.right < r.wrong;
    var unpaidNote = lowRight && lopsided ? 'Get ' + r.need + ' right, and more right than wrong, to earn today’s +' + XP_RUN + ' XP for this game.' :
      lopsided ? 'Get more right than wrong to earn today’s +' + XP_RUN + ' XP for this game.' :
      'Get ' + r.need + ' right in a run to earn today’s +' + XP_RUN + ' XP for this game.';
    var icon = o.icon ? (typeof o.icon === 'function' ? o.icon() : o.icon) : R.def.icon ? R.def.icon() : meta(R.id).icon();
    var iconSc = o.iconScale || R.def.iconScale || meta(R.id).sc;
    var sh = document.createElement('div');
    sh.className = 'arc-sheet dim arc-endsheet';
    sh.innerHTML = '<div class="arc-end" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<div class="arc-end-hd"><span class="arc-end-art"></span><div><small>' + esc(R.def.num + ' · ' + R.def.name) + '</small><h2>' + esc(title) + '</h2></div></div>' +
      '<div class="arc-score"><b>' + r.score + '</b><span>' + esc(o.scoreLabel || R.def.scoreLabel || 'score') + '</span>' + (r.best ? '<em class="arc-newbest">New best</em>' : '') + '</div>' +
      '<div class="arc-counts"><span class="ok">' + ICON.check + r.right + ' right</span><span class="bad">' + ICON.x + r.wrong + ' wrong</span></div>' +
      (miss.length ? '<div class="arc-learn"><small>To remember</small>' + miss.map(function (m) { return '<div class="arc-lrow"><b>' + esc(m.word) + '</b><span>' + esc(m.right) + '</span></div>'; }).join('') + '</div>' :
        (r.right ? '<p class="arc-perfect">No misses. Every word landed.</p>' : '')) +
      '<div class="arc-earn"><span class="arc-earn-sp"><span class="arc-chip-em"></span>+' + r.sparks + ' sparks</span><span class="arc-earn-xp">' + ICON.bolt + '+' + r.xp + ' XP</span></div>' +
      (r.capped && !r.xp ? '<p class="arc-capnote">Today’s Play &amp; Learn XP is used up. Sparks still count.</p>' :
        r.unpaid ? '<p class="arc-capnote">' + unpaidNote + '</p>' :
        r.streak ? '<p class="arc-capnote">Today’s practice counts for your streak.</p>' : '') +
      '<div class="arc-end-btns"><button class="btn" data-arc-again>Play again</button><button class="btn ghost" data-arc-games>Back to games</button></div></div>';
    L.appendChild(sh);
    /* a "To remember" list taller than its space scrolls: fade its bottom edge until the last row is in view */
    var learn = sh.querySelector('.arc-learn');
    if (learn) {
      var fadeMore = function () { learn.classList.toggle('more', learn.scrollTop + learn.clientHeight < learn.scrollHeight - 4); };
      fadeMore(); learn.addEventListener('scroll', fadeMore, { passive: true });
    }
    putSprite(sh, '.arc-end-art', icon, iconSc * .62);
    putSprite(sh, '.arc-earn .arc-chip-em', PX.ember(), 2);
    arm(sh.querySelector('[data-arc-again]'), function () { ARC.open(R.id); });
    arm(sh.querySelector('[data-arc-games]'), function () { ARC.menu(); });
    try { sh.querySelector('[data-arc-again]').focus({ preventScroll: true }); } catch (e) {}
  }

  /* ---------------- test hooks ---------------- */
  function screenName() {
    if (run) {
      if (playEl && playEl.querySelector('.arc-endsheet')) return 'end';
      if (sayOpen) return 'say';
      if (run.paused) return 'pause';
      if (document.querySelector('.overlay')) return 'confirm';
      return 'play';
    }
    if (hubEl && document.body.contains(hubEl)) return hubEl.querySelector('.arc-sheet') ? 'intro' : 'hub';
    return null;
  }
  function clientRect(el) { if (!el) return null; var r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }
  ARC.debug = {
    info: function () {
      var R = run, o = { screen: screenName(), speed: speed };
      if (sayOpen) o.say = { slug: sayOpen.slug, mode: sayOpen.mode(), tries: sayOpen.tries() };
      if (!R) return o;
      o.game = R.id; o.phase = R.phase; o.t = +R.t.toFixed(2); o.score = R.score || R.sparks; o.hearts = R.hearts; o.lives = R.lives;
      o.sparks = R.sparks; o.right = R.right; o.wrong = R.wrong; o.over = R.over; o.frozen = R.frozen; o.missed = R.missed.map(function (m) { return m.slug; });
      o.result = R.result || null;
      var j = R.layout.jump, c = R.G.toClient(j.x, j.y);
      if (R.def.controls.jump) o.jump = { cx: c.x, cy: c.y, r: j.r * R.G.css };
      o.world = { W: R.G.W, H: +R.G.H.toFixed(1), SH: +R.G.SH.toFixed(1), css: +R.G.css.toFixed(4), hudY: +R.layout.hudY.toFixed(1) };
      o.choices = [];
      if (R.def.info) {
        var gi = {};
        try { gi = R.def.info(R) || {}; } catch (e) { gi = { error: String(e) }; }
        Object.keys(gi).forEach(function (key) { if (key !== 'choices') o[key] = gi[key]; });
        (gi.choices || []).forEach(function (ch) {
          var a = R.G.toClient(ch.x, ch.y), b = R.G.toClient(ch.x + ch.w, ch.y + ch.h), out = {};
          Object.keys(ch).forEach(function (kk) { out[kk] = ch[kk]; });
          out.rect = { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }; out.cx = (a.x + b.x) / 2; out.cy = (a.y + b.y) / 2;
          o.choices.push(out);
        });
      }
      return o;
    },
    speed: function (x) { if (x != null) speed = Math.max(.05, Math.min(20, +x || 1)); return speed; },
    finish: function () { var R = run; if (!R || R.over) return false; if (R.def.finish) R.def.finish(R); else R.end({ reason: 'done' }); return true; },
    advance: function (sec) { var R = run; if (!R) return false; var n = Math.round(sec / STEP); for (var i = 0; i < n && run === R && !paused(); i++) stepRun(R, STEP); render(); return +R.t.toFixed(2); },
    state: function () { return JSON.parse(JSON.stringify(AR())); },
    rect: function (sel) { return clientRect(document.querySelector(sel)); },
    run: function () { return run; }
  };
})();
