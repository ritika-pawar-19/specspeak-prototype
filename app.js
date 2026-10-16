/* SpecSpeak prototype — screens, game engine and progress.
   Progress lives in this phone's localStorage; nothing is sent anywhere. */
(function () {
  'use strict';
  var D = window.SS, A = window.SSAudio, S = window.SSSpeech, CH = window.CH;
  var L = window.SSLMS || { active: false, expected: false };   // SCORM LMS when launched from TrainGram's LMS
  var inLMS = !!(L.active || L.expected);       // inside a SCORM package: progress never touches this phone's storage
  var app = document.getElementById('app');
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------------- icons ---------------- */
  var P = {
    x: '<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>',
    star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/>',
    lock: '<path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h1zm2 0h6V7a3 3 0 0 0-6 0v3z"/>',
    mic: '<path d="M12 2a3.5 3.5 0 0 0-3.5 3.5v6a3.5 3.5 0 0 0 7 0v-6A3.5 3.5 0 0 0 12 2zM5 11a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2a5 5 0 0 1-10 0H5z"/>',
    trophy: '<path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3zm0 4H6v1a2 2 0 0 0 1 1.7V7zm10 0v2.7A2 2 0 0 0 18 8V7h-1z"/>',
    spk: '<path d="M3 9.5h4l5-4.5v14l-5-4.5H3z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.3 5.8a9 9 0 0 1 0 12.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    home: '<path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z"/>',
    dumbbell: '<path d="M2.5 10h2V8h2.5v8H4.5v-2h-2zm19 0h-2V8H17v8h2.5v-2h2zM8 11h8v2H8z"/>',
    shield: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/>',
    user: '<path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm-8 9a8 8 0 0 1 16 0z"/>',
    logout: '<path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10M15 8l4 4-4 4M19 12H9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    book: '<path d="M8 2.5h10.5A1.5 1.5 0 0 1 20 4v13h-2V4.5H8z"/><rect x="4" y="6.5" width="12.5" height="15" rx="2"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
    clock: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 5v5.4l3.6 2.1-1 1.7L11 13.6V7z"/>',
    left: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    lchip: '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="6" y="6" width="12" height="12" rx="2.5"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3"/></g>',
    lram: '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="2" y="7" width="20" height="9" rx="1.5"/><path d="M5 10h3v3H5zM10.5 10h3v3h-3zM16 10h3v3h-3zM4 16v2.5M7 16v2.5M10 16v2.5M14 16v2.5M17 16v2.5M20 16v2.5"/></g>',
    lbox: '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/></g>',
    lscreen: '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4M5 7l3-1"/></g>',
    lshield: '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M12 2.5 4.5 5.5v5.5c0 4.6 3.2 8.4 7.5 10.3 4.3-1.9 7.5-5.7 7.5-10.3V5.5z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></g>',
    lbolt: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    lmic: '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v4M8.5 21.5h7"/></g>'
  };
  function ic(n, cls) { return '<svg class="' + (cls || 'ic') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || '') + '</svg>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function hi(t) { return '<i class="hi" lang="hi">' + t + '</i>'; }
  /* a button that ignores the tail of a double-tap and can only fire once */
  function arm(btn, fn) {
    var born = Date.now();
    btn.onclick = function (e) {
      if (btn.disabled || Date.now() - born < 350) return;
      btn.disabled = true;
      fn(e);
    };
    return btn;
  }
  function select(group, btn) {
    group.forEach(function (x) { x.classList.remove('sel'); x.setAttribute('aria-pressed', 'false'); });
    btn.classList.add('sel'); btn.setAttribute('aria-pressed', 'true');
  }

  /* ---------------- state ---------------- */
  var KEY = 'specspeak.v1';
  function fresh() {
    return { v: 1, name: '', store: '', xp: 0, streak: { n: 0, last: '' }, streakBonus: false, read: false, watch: false, videoMax: 0,
      lessons: { meet: false, match: false, use: false }, said: {}, badge: false, practice: [],
      today: { date: '', lessons: 0, firstTry: 0 }, lessonsDone: 0, homeTip: false,
      arcade: { sp: 0, b: {}, d: '', x: 0, p: {}, hide: '', w: '' } };     // Play & Learn (arcade/engine.js)
  }
  function upgrade(s) {
    var f = fresh();
    if (!s || s.v !== 1) return f;
    Object.keys(f).forEach(function (k) { if (s[k] === undefined || typeof s[k] !== typeof f[k]) s[k] = f[k]; });
    return s;
  }
  var st = (function () {
    if (inLMS) {                          // in the LMS, progress belongs to the learner, never to this (maybe shared) phone
      var s0 = upgrade(L.active ? L.load() : null);
      var nm = L.active ? L.learnerName() : '';
      if (nm) s0.name = nm.split(' ')[0];
      s0.homeTip = true;
      return s0;
    }
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 1) {
        var f = fresh();
        Object.keys(f).forEach(function (k) { if (s[k] === undefined || typeof s[k] !== typeof f[k]) s[k] = f[k]; });
        return s;
      }
    } catch (e) {}
    return fresh();
  })();
  function save(important) {
    if (inLMS) {
      if (!L.active) return;
      // the unit counts as complete the moment every step is done, even before "Claim your badge" is tapped
      var earned = st.badge || unlocked('badge');
      L.save({ state: st, stepsDone: earned ? STEPS.length : STEPS.filter(stepDone).length, stepsTotal: STEPS.length,
        wordsClear: saidCount(), wordsTotal: D.WORDS.length, badge: earned, location: currentStep() || 'complete', important: !!important });
      return;
    }
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
  }
  /* A store phone can be shared: logging out parks this APC's progress under their name,
     and typing (or tapping) the same name later brings it back. Not used in the LMS. */
  var ACCTS = 'specspeak.accounts';
  function nameKey(n) { return (n || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function accounts() { try { var a = JSON.parse(localStorage.getItem(ACCTS)); return a && typeof a === 'object' ? a : {}; } catch (e) { return {}; } }
  function putAccounts(a) { try { localStorage.setItem(ACCTS, JSON.stringify(a)); } catch (e) {} }
  /* local calendar day as a day number, so streaks never shift with time zones */
  function dayNum(d) { d = d || new Date(); return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000); }
  function parseDay(s) { var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s || ''); return m ? dayNum(new Date(+m[1], +m[2] - 1, +m[3])) : null; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function ensureToday() { if (st.today.date !== today()) st.today = { date: today(), lessons: 0, firstTry: 0 }; }
  function touchStreak() {
    var t = today();
    if (st.streak.last === t) return false;
    var last = parseDay(st.streak.last), gap = last === null ? 99 : dayNum() - last;
    st.streak.n = gap === 1 ? st.streak.n + 1 : 1;
    st.streak.last = t;
    if (st.streak.n >= 3 && !st.streakBonus) { st.streakBonus = true; st.xp += 20; }
    save(); return true;
  }
  function streakNow() {
    var last = parseDay(st.streak.last);
    if (last === null) return 0;
    return dayNum() - last <= 1 ? st.streak.n : 0;
  }
  function addXP(n) { st.xp += n; save(); }
  function saidCount() { return D.WORDS.filter(function (w) { return st.said[w.slug]; }).length; }
  function addPractice(slug) { if (D.BY[slug] && st.practice.indexOf(slug) < 0) st.practice.push(slug); save(); }
  function dropPractice(slug) { st.practice = st.practice.filter(function (s) { return s !== slug; }); save(); }

  var STEPS = ['read', 'watch', 'meet', 'match', 'use', 'say', 'badge'];
  var STEP_LABEL = { read: 'Read', watch: 'Watch', meet: 'Meet', match: 'Match', use: 'Use', say: 'Say it', badge: 'Badge' };
  function stepDone(k) {
    if (k === 'read') return st.read; if (k === 'watch') return st.watch;
    if (k === 'say') return saidCount() === D.WORDS.length; if (k === 'badge') return st.badge;
    return !!st.lessons[k];
  }
  function unlocked(k) { var i = STEPS.indexOf(k); return STEPS.slice(0, i).every(stepDone); }
  function currentStep() { for (var i = 0; i < STEPS.length; i++) if (!stepDone(STEPS[i])) return STEPS[i]; return null; }

  /* ---------------- navigation ----------------
     The map is the root. Any other screen owns one extra history entry, so the phone's Back
     button returns to the map (or asks first, in a lesson) instead of leaving the app. */
  var inSub = false, onBack = null, ignorePop = false, openBox = null;
  var framed = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();
  function sub(backFn) { if (!inSub && !framed) { history.pushState({ ss: 1 }, ''); inSub = true; } onBack = backFn || goHome; }
  window.addEventListener('popstate', function () {
    if (ignorePop) { ignorePop = false; return; }
    if (openBox) {                       // Back closes an open dialog first
      var b = openBox; closeBox(b, false);
      if (!framed) { history.pushState({ ss: 1 }, ''); inSub = true; }   // the Back press used up our entry; put it back
      return;
    }
    if (inSub) { inSub = false; var f = onBack; onBack = null; (f || goHome)(true); }
  });
  function leaveSub() { if (inSub) { inSub = false; onBack = null; ignorePop = true; history.back(); } }
  function goHome(fromPop) { S.cancel(); if (!fromPop) leaveSub(); home(true); }

  function mount(html, cls, back) {
    if (openBox) closeBox(openBox, null);
    var el = document.createElement('div');
    el.className = 'screen ' + (cls || '') + (back ? ' back' : '');
    el.innerHTML = html;
    app.innerHTML = '';
    app.appendChild(el);
    // move focus into the new screen so screen readers and keyboards follow along
    var h = el.querySelector('h1, .fin-h, .q, .page-h h1, .tcard .eb');
    var target = h || el;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    try { target.focus({ preventScroll: true }); } catch (e) {}
    return el;
  }
  var tt;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.classList.remove('show'); t.textContent = '';
    requestAnimationFrame(function () { t.textContent = msg; t.classList.add('show'); });
    clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function closeBox(rec, ok) {
    if (!rec || openBox !== rec) return;
    openBox = null;
    rec.el.remove();
    if (rec.prevFocus && document.body.contains(rec.prevFocus)) { try { rec.prevFocus.focus({ preventScroll: true }); } catch (e) {} }
    if (ok === true) { rec.o.onOk && rec.o.onOk(); } else if (ok === false) { rec.o.onCancel && rec.o.onCancel(); }
  }
  function confirmBox(o) {
    if (openBox) closeBox(openBox, null);
    var ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = '<div class="panel" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '">' + CH(o.char || 'bolo_worried', 'p') +
      '<h2>' + o.title + '</h2><p>' + o.text + '</p><button class="btn ' + (o.okCls || 'coral') + '" data-a="ok">' + o.ok + '</button>' +
      '<button class="btn ghost" data-a="no">' + o.cancel + '</button></div>';
    var rec = { el: ov, o: o, prevFocus: document.activeElement };
    openBox = rec;
    app.appendChild(ov);
    ov.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]');
      if (!b && e.target !== ov) return;
      closeBox(rec, !!(b && b.getAttribute('data-a') === 'ok'));
    });
    ov.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeBox(rec, false); }
      if (e.key === 'Tab') {
        var bs = ov.querySelectorAll('button'), first = bs[0], last = bs[bs.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    ov.querySelector('[data-a="no"]').focus();
  }
  function tabs(on) {
    var n = st.practice.length;
    var t = [['home', 'home', 'Learn'], ['practice', 'dumbbell', 'Practice'], ['league', 'shield', 'League'], ['profile', 'user', 'Profile']];
    return '<nav class="tabs" aria-label="Sections">' + t.map(function (x) {
      return '<button class="tab' + (x[0] === on ? ' on' : '') + '" data-tab="' + x[0] + '"' + (x[0] === on ? ' aria-current="page"' : '') + '>' +
        ic(x[1]) + x[2] + (x[0] === 'practice' && n ? '<span class="dot" aria-label="' + n + ' to practise">' + n + '</span>' : '') + '</button>';
    }).join('') + '</nav>';
  }
  function bindTabs(el) {
    el.querySelectorAll('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-tab');
        ({ home: function () { home(); }, practice: practiceTab, league: leagueTab, profile: profileTab })[k]();
      });
    });
  }

  /* ---------------- onboarding ---------------- */
  function welcome() {
    var el = mount(
      '<span class="blob1"></span><span class="blob2"></span><span class="blob3"></span>' +
      '<div class="wtext"><h1>Let’s say it right!</h1><p>Learn the spec words customers hear every day, and say them clearly. Welcome to SpecSpeak.</p></div>' +
      '<div class="wbtns"><button class="btn navy" data-go="name">Get started</button><button class="btn outline" data-go="how">How it works</button></div>' +
      '<div class="peek">' + CH('bolo') + '</div>', 'welcome');
    el.querySelector('[data-go="name"]').onclick = function () { nameScreen(false); };
    el.querySelector('[data-go="how"]').onclick = howItWorks;
  }
  function howItWorks() {
    confirmBox({ char: 'bolo_point', title: 'Three levels per unit',
      text: '<b>Read</b> the TrainGram cards. <b>Watch</b> the training video. <b>Play</b> four short lessons. The unit is done when you can <b>say every word clearly</b> into your phone.',
      ok: 'Got it', okCls: '', cancel: 'Close' });
  }
  function nameScreen(fromProfile) {
    if (fromProfile) sub(function () { profileTab(); });
    var saved = (fromProfile || inLMS) ? {} : accounts(), savedKeys = Object.keys(saved).filter(function (k) { return saved[k] && saved[k].name; });
    var savedChips = savedKeys.length ? '<div class="saved"><p>Played on this phone before? Tap your name.</p><div class="schips">' +
      savedKeys.map(function (k) { return '<button type="button" class="schip" data-saved="' + esc(k) + '">' + esc(saved[k].name) + '</button>'; }).join('') + '</div></div>' : '';
    var el = mount(
      (fromProfile ? '<button class="iconbtn closex" data-x aria-label="Close">' + ic('x') + '</button>' : '') +
      '<div class="eyes">' + CH('bolo') + '</div><h1>' + (fromProfile ? 'Update your details' : 'Ready to learn?') + '</h1>' +
      '<form autocomplete="off" novalidate><label class="flabel" for="nm">Your name</label>' +
      '<input class="field" id="nm" name="nm" placeholder="e.g. Priya" maxlength="30" required autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="next" value="' + esc(st.name) + '">' +
      '<label class="flabel" for="sto">Your store (optional)</label>' +
      '<input class="field" id="sto" name="sto" placeholder="e.g. Store 14" maxlength="40" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="go" value="' + esc(st.store) + '">' +
      '<button class="btn navy" type="submit">' + (fromProfile ? 'Save' : 'Let’s go!') + '</button></form>' + savedChips +
      '<p class="note">' + (inLMS ? 'Your progress is saved to your training record.' : 'Your progress is saved on this phone only.') + '</p>', 'namescr');
    var x = el.querySelector('[data-x]'); if (x) x.onclick = function () { profileTab(); };
    el.querySelectorAll('[data-saved]').forEach(function (b) {
      b.onclick = function () {
        var r = saved[b.getAttribute('data-saved')];
        el.querySelector('#nm').value = r.name; el.querySelector('#sto').value = r.store || '';
        el.querySelector('form').requestSubmit ? el.querySelector('form').requestSubmit() : el.querySelector('[type=submit]').click();
      };
    });
    el.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var nm = el.querySelector('#nm'), n = nm.value.trim();
      if (!n) { nm.focus(); nm.setAttribute('aria-invalid', 'true'); toast('Please type your name.'); return; }
      var store = el.querySelector('#sto').value.trim(), back = false;
      if (!fromProfile && !inLMS) {
        var a = accounts(), k = nameKey(n);
        if (a[k] && a[k].v === 1) { st = upgrade(a[k]); delete a[k]; putAccounts(a); back = true; }
      }
      if (!back) st.name = n;               // a returning APC keeps the name as first saved ("priya" finds "Priya")
      if (store || !back) st.store = store; save();
      if (fromProfile) return profileTab();
      home();
      if (back) setTimeout(function () { toast('Welcome back, ' + st.name + '! Your progress is here.'); }, 300);
      // iPhone Safari keeps a separate copy of progress for the Home Screen app, so suggest adding it now
      if (S.isIOS && !navigator.standalone && !st.homeTip) {
        st.homeTip = true; save();
        setTimeout(function () { toast('Tip: tap Share › Add to Home Screen to keep SpecSpeak like an app.'); }, 900);
      }
    });
  }

  /* ---------------- home: the unit map ---------------- */
  var NODE_X = { read: '0', watch: '-2.6em', meet: '-3.5em', match: '-2.2em', use: '.8em', say: '3em', badge: '1.6em' };
  var NODE_SUB = { read: 'TrainGram cards', watch: 'Training video', meet: 'New words', match: '&amp; listen', use: 'With customers', say: 'Checkpoint', badge: 'Unit 1' };
  var NODE_ICON = { read: 'book', watch: 'play', meet: 'star', match: 'star', use: 'star', say: 'mic', badge: 'trophy' };

  function noLMS() {
    mount('<div class="gb fin"><div class="cheer">' + CH('bolo_worried') + '</div><h1 class="fin-h" style="color:var(--ink)">' +
      (L.ended ? 'This session has ended' : 'Can\u2019t reach your training record') + '</h1>' +
      '<p class="fin-s">Close SpecSpeak and open it again from TrainGram, so your progress is saved.</p></div>', '');
  }
  function home(back) {
    if (inLMS && !L.active) return noLMS();
    if (!st.name) return welcome();
    leaveSub();
    var cur = currentStep(), done = STEPS.filter(stepDone).length, U = D.UNITS[0];
    var nodes = STEPS.map(function (k) {
      var isDone = stepDone(k), open = unlocked(k), isCur = k === cur;
      var cls = 'node' + (k === 'say' ? ' gate' + (open ? ' open' : '') : '') + (k === 'badge' && isDone ? ' done-badge' : '') +
        (!open && k !== 'say' ? ' lock' : '') + (isCur ? ' cur' : '');
      var icon = isDone ? (k === 'badge' ? 'trophy' : 'check') : (open ? NODE_ICON[k] : (k === 'say' ? 'mic' : k === 'badge' ? 'trophy' : 'lock'));
      var right = k === 'say' || k === 'badge';
      var subl = NODE_SUB[k];
      if (k === 'say' && saidCount() > 0 && !isDone) subl = saidCount() + ' of 10 clear';
      var label = STEP_LABEL[k] + ', ' + subl.replace('&amp;', 'and') + (isDone ? ', done' : open ? (isCur ? ', next step' : '') : ', locked');
      return '<button class="' + cls + '" style="--x:' + NODE_X[k] + '" data-step="' + k + '" aria-label="' + label + '">' +
        (isCur ? '<span class="tip" aria-hidden="true">' + (done === 0 ? 'START' : 'NEXT') + '</span>' : '') + ic(icon) +
        '<span class="lbl' + (right ? ' l' : '') + '" aria-hidden="true"><b>' + STEP_LABEL[k] + '</b>' + subl + '</span></button>';
    }).join('');
    var later = D.UNITS.slice(1).map(function (u) {
      return '<button class="unit locked ' + u.color + '" data-unit="' + u.n + '" aria-label="Unit ' + u.n + ', ' + u.name + ', ' + u.sub + ', locked"><div style="text-align:left"><small>Unit ' + u.n + ' · ' + u.name + '</small><b>' + u.sub + '</b></div>' + ic('lock') + '</button>';
    }).join('');
    var el = mount(
      '<div class="status"><span class="course">' + (L.active ? '<button class="iconbtn lmsx" data-exit aria-label="Save and exit">' + ic('x') + '</button>' : '') + CH('bolo') + ' SpecSpeak</span><span class="counts">' +
      '<button class="c-fl" data-go="streak" aria-label="Streak: ' + streakNow() + ' days">' + CH('lau_mini') + streakNow() + '</button>' +
      '<button class="c-xp" data-go="streak" aria-label="' + st.xp + ' XP">' + ic('bolt') + st.xp + '</button></span></div>' +
      '<div class="scroll"><h1 class="unit"><span class="ut"><small>Unit 1</small><b>' + U.name + '</b></span><span class="pct" aria-label="' + done + ' of 7 steps done">' + done + ' / 7</span></h1>' +
      '<div class="trail">' + nodes + CH('chip', 'buddy') + CH('rami', 'buddy2') + '</div>' +
      '<div class="next-units">' + later + '</div></div>' + tabs('home'), '', back);
    bindTabs(el);
    if (window.ARC && ARC.homePill) ARC.homePill(el);
    var ex = el.querySelector('[data-exit]'); if (ex) ex.onclick = askExit;
    el.querySelectorAll('[data-go="streak"]').forEach(function (b) { b.onclick = streakScreen; });
    el.querySelectorAll('[data-unit]').forEach(function (b) { b.onclick = function () { toast('Unit ' + b.getAttribute('data-unit') + ' opens after Unit 1 in the pilot.'); }; });
    el.querySelectorAll('[data-step]').forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-step');
        if (!unlocked(k)) {
          var i = STEPS.indexOf(k), need = STEPS.slice(0, i).filter(function (s) { return !stepDone(s); })[0];
          toast('Finish “' + STEP_LABEL[need] + '” first.');
          return;
        }
        openStep(k);
      };
    });
    var c = el.querySelector('.node.cur'), sc = el.querySelector('.scroll');
    if (c && sc) setTimeout(function () {
      // scroll only the map, never the page (scrollIntoView would move the whole app on phones)
      var top = c.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - sc.clientHeight / 2 + c.offsetHeight / 2;
      sc.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
    }, 60);
  }
  function openStep(k) {
    if (k === 'read') return traingram();
    if (k === 'watch') return video();
    if (k === 'badge') return unitComplete();
    if (k === 'say') {
      var left = D.WORDS.filter(function (w) { return !st.said[w.slug]; });
      if (!left.length) return toast('All 10 words are clear!');
      return lesson('say', left.map(function (w) { return { t: 'say', slug: w.slug }; }));
    }
    lesson(k);
  }

  /* ---------------- streak screen (reference 5) ---------------- */
  function streakScreen() {
    sub();
    var stage = Math.min(3, Math.floor(st.xp / 300)), into = st.xp - stage * 300;
    var pct = stage >= 3 ? 100 : Math.round(into / 300 * 100), left = stage >= 3 ? 0 : 300 - into;
    ensureToday();
    var tasks = [
      [st.today.lessons > 0, 'Finish one lesson today', '+10 XP'],
      [st.today.firstTry > 0, 'Say a checkpoint word right first try', '+3 XP'],
      [st.streakBonus, 'Keep a 3-day streak', st.streakBonus ? '+20 XP earned' : '+20 XP, once']
    ];
    var el = mount(
      '<div class="scroll"><div class="sk-top"><div><small>Streak days</small><h1 class="sk-n">' + streakNow() + '</h1></div><button class="iconbtn" data-x aria-label="Close">' + ic('x') + '</button></div>' +
      '<div class="sk-pet"><span style="transform:scale(' + (1 + stage * 0.12) + ');display:block">' + CH('lau_joy') + '</span></div>' +
      '<p class="sk-name">Lau</p><div class="sk-bar" role="progressbar" aria-label="XP to the next look" aria-valuemin="0" aria-valuemax="300" aria-valuenow="' + Math.min(300, into) + '"><i style="width:' + pct + '%"></i><span>' + (stage >= 3 ? 'Fully grown!' : into + '/300') + '</span></div>' +
      '<p class="sk-note">' + (stage >= 3 ? 'Lau has every look. Legend.' : left + ' XP to grow Lau to the next look') + '</p>' +
      '<div class="sk-card"><h2>Grow your Lau</h2>' + tasks.map(function (t) {
        return '<div class="task"><span class="badge' + (t[0] ? '' : ' off') + '" aria-label="' + (t[0] ? 'Done' : 'Not yet') + '">' + ic('check') + '</span><div><b>' + t[1] + '</b><small>' + t[2] + '</small></div></div>';
      }).join('') + '</div></div>', 'streak');
    el.querySelector('[data-x]').onclick = function () { goHome(); };
  }

  /* ---------------- Level 1: TrainGram viewer ---------------- */
  var CARD_ICON = { mic: 'lmic', chip: 'lchip', ram: 'lram', bolt: 'lbolt', box: 'lbox', screen: 'lscreen', shield: 'lshield' };
  var DWELL = 4000;
  function traingram() {
    var i = 0, dwelled = -1, shownAt = Date.now(), timer, lastSecs = -1;
    var el = mount('<div class="glow"></div><div class="segs" aria-hidden="true">' + D.CARDS.map(function () { return '<i><b></b></i>'; }).join('') + '</div>' +
      '<div class="meta"><span>Unit 1 · TrainGram</span><span class="cnt"></span><button class="iconbtn" data-x aria-label="Close">' + ic('x') + '</button></div>' +
      '<div class="tcard" aria-live="polite"></div><div class="tgfoot"></div>', 'tg');
    var card = el.querySelector('.tcard'), foot = el.querySelector('.tgfoot'), segs = el.querySelectorAll('.segs i');
    function show() {
      var c = D.CARDS[i];
      shownAt = Date.now(); lastSecs = -1;
      segs.forEach(function (s, k) {
        s.className = k < i ? 'f' : '';
        var b = s.querySelector('b'); b.style.transition = 'none'; b.style.width = k < i ? '100%' : '0';
      });
      var cur = segs[i].querySelector('b');
      var need = remaining();
      requestAnimationFrame(function () { requestAnimationFrame(function () { cur.style.transition = 'width ' + (need || 300) + 'ms linear'; cur.style.width = '100%'; }); });
      el.querySelector('.cnt').textContent = (i + 1) + ' / ' + D.CARDS.length;
      if (c.recap) {
        card.innerHTML = '<span class="eb">' + c.eb + '</span><span class="big rt">The words that matter</span><div class="recap">' +
          c.recap.map(function (r) { return '<div><b>' + r[0] + '</b><span>' + r[1] + '</span></div>'; }).join('') + '</div>';
      } else {
        card.innerHTML = ic(CARD_ICON[c.icon], 'ticon') + '<span class="eb">' + c.eb + '</span><span class="big">' + c.big + '</span>' +
          (c.chip ? '<span class="tchip">' + c.chip + '</span>' : '') +
          (c.chips ? '<div class="chips">' + c.chips.map(function (x) { return '<span class="tchip">' + x + '</span>'; }).join('') + '</div>' : '') +
          '<p class="line">' + c.line + '</p>';
      }
      card.scrollTop = 0;
      clearInterval(timer);
      renderFoot(true);
      if (need) timer = setInterval(function () { renderFoot(false); }, 250);
    }
    function remaining() { return i <= dwelled ? 0 : Math.max(0, DWELL - (Date.now() - shownAt)); }
    function renderFoot(force) {
      var r = remaining(), last = i === D.CARDS.length - 1, secs = Math.ceil(r / 1000);
      if (!force && secs === lastSecs) return;
      lastSecs = secs;
      if (r <= 0) {
        clearInterval(timer);
        dwelled = Math.max(dwelled, i);
        foot.innerHTML = '<button class="btn ghost tgback" data-prev aria-label="Previous card"' + (i === 0 ? ' disabled' : '') + '>' + ic('left') + '</button>' +
          (last ? '<button class="btn" data-done>Done reading</button>' : '<button class="btn" data-next>Next</button>');
        foot.querySelector('[data-prev]').onclick = prev;
        var n = foot.querySelector('[data-next]'); if (n) n.onclick = next;
        var d = foot.querySelector('[data-done]'); if (d) arm(d, finish);
      } else {
        foot.innerHTML = '<span class="wait">' + ic('clock') + ' Keep reading · ' + secs + 's</span>';
      }
    }
    function next() {
      if (remaining() > 0) { var w = foot.querySelector('.wait'); if (w) { w.style.animation = 'none'; void w.offsetWidth; w.style.animation = 'shake .35s'; } return; }
      if (i === D.CARDS.length - 1) return;
      i++; show();
    }
    function prev() { if (i > 0) { i--; show(); } }
    function key(e) {
      if (!document.body.contains(el)) return document.removeEventListener('keydown', key);
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    }
    document.addEventListener('keydown', key);
    function cleanup() { clearInterval(timer); document.removeEventListener('keydown', key); }
    function finish() {
      cleanup();
      var first = !st.read;
      st.read = true;
      if (first) addXP(10);
      save(true);
      levelDone({ title: 'TrainGrams done!', sub: 'Level 1 · Read', xp: first ? 10 : 0 });
    }
    // tap the left third to go back, anywhere else to go on (the card itself stays scrollable)
    card.addEventListener('click', function (e) {
      var r = card.getBoundingClientRect();
      if (e.clientX - r.left < r.width * 0.3) prev(); else next();
    });
    el.querySelector('[data-x]').onclick = function () { cleanup(); goHome(); };
    sub(function (fromPop) { cleanup(); goHome(fromPop); });
    show();
  }

  /* ---------------- Level 2: video with locked seeking and pop quizzes ---------------- */
  var vidFails = 0;   // repeated playback failures offer a trainer fallback so the unit can't get stuck
  function fmt(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2); }
  function video() {
    var V = D.VIDEO, answered = V.quizzes.map(function () { return !!st.watch; }), quizOpen = false;
    var el = mount(
      '<div class="vtop"><h1 class="vt">Unit 1 · Training video</h1><button class="iconbtn" data-x aria-label="Close">' + ic('x') + '</button></div>' +
      '<div class="vwrap"><video playsinline webkit-playsinline preload="metadata" poster="' + V.poster + '" src="' + V.src + '"></video>' +
      '<button class="vplay" aria-label="Play">' + '<span>' + ic('play') + '</span></button></div>' +
      '<div class="scrub"><span class="t0" aria-hidden="true">0:00</span><div class="track" aria-hidden="true"><span class="seen"></span><span class="now"></span></div>' +
      (st.watch ? '' : ic('lock', 'ic lock')) + '<span class="t1" aria-hidden="true">--:--</span></div>' +
      '<p class="vnote">' + (st.watch ? 'You’ve watched this once, so you can skip around.' : 'Skipping ahead unlocks after one full watch. Two quick questions will pause the video.') + '</p>', 'vid');
    var v = el.querySelector('video'), playBtn = el.querySelector('.vplay'), track = el.querySelector('.track');
    var maxT = st.videoMax || 0, lastSavedMax = maxT;
    function dur() { return isFinite(v.duration) && v.duration > 0 ? v.duration : 0; }
    function drawMarks() {
      if (!dur()) return;
      el.querySelector('.t1').textContent = fmt(dur());
      track.querySelectorAll('.q').forEach(function (q) { q.remove(); });
      if (st.watch) return;
      V.quizzes.forEach(function (q) {
        var m = document.createElement('span'); m.className = 'q'; m.style.left = Math.min(100, q.at / dur() * 100) + '%'; track.appendChild(m);
      });
    }
    function draw() {
      var d = dur() || 1;
      el.querySelector('.now').style.width = Math.min(100, v.currentTime / d * 100) + '%';
      el.querySelector('.seen').style.width = Math.min(100, maxT / d * 100) + '%';
      el.querySelector('.t0').textContent = fmt(v.currentTime);
    }
    function checkQuiz() {
      if (quizOpen || v.paused) return;
      for (var k = 0; k < V.quizzes.length; k++) if (!answered[k] && v.currentTime >= V.quizzes[k].at) { openQuiz(k); break; }
    }
    v.addEventListener('loadedmetadata', drawMarks);
    v.addEventListener('play', function () { playBtn.hidden = true; });
    v.addEventListener('pause', function () { if (!quizOpen) playBtn.hidden = false; st.videoMax = maxT; save(); });
    v.addEventListener('timeupdate', function () {
      if (!st.watch && v.currentTime > maxT + 1.5) { v.currentTime = maxT; return; }
      if (v.currentTime > maxT) {
        maxT = v.currentTime; st.videoMax = maxT;
        if (maxT - lastSavedMax >= 5) { lastSavedMax = maxT; save(); }
      }
      draw(); checkQuiz();
      if (dur() && maxT >= dur() - 0.6 && answered.every(Boolean) && !st.watch) markWatched(false);
    });
    v.addEventListener('ended', function () { if (answered.every(Boolean)) markWatched(true); });
    // timeupdate only fires ~4x a second; watch the clock every frame so quizzes pause on the scene boundary
    (function tick() { if (!document.body.contains(v)) return; checkQuiz(); requestAnimationFrame(tick); })();
    function onHide() { st.videoMax = maxT; save(); }
    window.addEventListener('pagehide', onHide);
    v.addEventListener('error', function () {
      if (el.querySelector('[data-retry]')) return;
      vidFails++;
      el.insertAdjacentHTML('beforeend', '<div class="pop"><p class="q sm">The video didn’t load.</p><p style="font-family:var(--body);color:var(--ink2)">Check your connection and try again.</p><button class="btn" data-retry>Try again</button>' +
        (vidFails >= 2 ? '<button class="btn ghost" data-trainerwatch>Watched it with my trainer</button>' : '') + '</div>');
      el.querySelector('[data-retry]').onclick = function () { cleanup(); video(); };
      var tw = el.querySelector('[data-trainerwatch]');
      if (tw) tw.onclick = function () { try { L.active && L.interaction('video', true, '', 'trainer'); } catch (e) {} answered = answered.map(function () { return true; }); markWatched(true); };
    });
    playBtn.onclick = function () {
      try { el.querySelector('[data-x]').focus({ preventScroll: true }); } catch (e) {}
      var p = v.play(); if (p && p.catch) p.catch(function () { playBtn.hidden = false; });
    };
    v.addEventListener('click', function () { if (!quizOpen) { if (v.paused) playBtn.onclick(); else v.pause(); } });
    track.addEventListener('click', function (e) {
      if (!dur() || quizOpen) return;
      var r = track.getBoundingClientRect(), t = (e.clientX - r.left) / r.width * dur();
      if (!st.watch && t > maxT) { toast('Skipping ahead unlocks after one full watch.'); return; }
      v.currentTime = Math.max(0, t);
    });
    function openQuiz(k) {
      var q = V.quizzes[k]; quizOpen = true; v.pause(); playBtn.hidden = true;
      var sel = -1;
      var box = document.createElement('div'); box.className = 'pop'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Quick check');
      box.innerHTML = '<span class="tag">Quick check · ' + (k + 1) + ' of ' + V.quizzes.length + '</span><p class="q sm">' + q.q + '</p><div class="g1">' +
        q.opts.map(function (o, i) { return '<button class="opt" data-i="' + i + '" aria-pressed="false">' + o + '</button>'; }).join('') + '</div><div class="qfoot"><button class="btn" data-check disabled>Check</button></div>';
      el.appendChild(box);
      var opts = [].slice.call(box.querySelectorAll('[data-i]'));
      opts.forEach(function (b) { b.onclick = function () { select(opts, b); sel = +b.getAttribute('data-i'); box.querySelector('[data-check]').disabled = false; }; });
      try { opts[0].focus({ preventScroll: true }); } catch (e) {}
      arm(box.querySelector('[data-check]'), function () {
        var ok = sel === q.a, chosen = opts[sel];
        opts.forEach(function (b) { b.disabled = true; });
        chosen.classList.remove('sel'); chosen.classList.add(ok ? 'ok' : 'bad');
        A.sfx(ok ? 'correct' : 'wrong'); if (!ok) A.buzz(60);
        var slot = box.querySelector('.qfoot');
        if (ok) {
          answered[k] = true;
          slot.innerHTML = '<button class="btn">Keep watching</button>';
          arm(slot.querySelector('button'), function () { box.remove(); quizOpen = false; v.play(); });
        } else {
          slot.innerHTML = '<button class="btn coral">Watch that part again</button>';
          arm(slot.querySelector('button'), function () { box.remove(); quizOpen = false; v.currentTime = q.replayFrom; v.play(); });
        }
        try { slot.querySelector('button').focus({ preventScroll: true }); } catch (e) {}
      });
    }
    var marked = false;
    function markWatched(atEnd) {
      if (marked) return; marked = true;
      var first = !st.watch;
      st.watch = true; st.videoMax = maxT; if (first) addXP(10); save(true);
      if (atEnd || first) { v.pause(); cleanup(); levelDone({ title: 'Video watched!', sub: 'Level 2 · Watch', xp: first ? 10 : 0 }); }
    }
    function cleanup() { window.removeEventListener('pagehide', onHide); try { v.pause(); } catch (e) {} st.videoMax = Math.max(st.videoMax || 0, maxT); save(); }
    el.querySelector('[data-x]').onclick = function () { cleanup(); goHome(); };
    sub(function (fromPop) { cleanup(); goHome(fromPop); });
  }

  /* ---------------- Level 3: the lesson engine ---------------- */
  var CHEERS = ['Nice!', 'Great job!', 'Spot on!', 'You got it!', 'Brilliant!'];
  var SPOT_WHY = {
    processor: 'Intel Core i5-14450HX is the processor: the brain.',
    ram: 'RAM decides how many apps stay open at once.',
    storage: 'The 512 GB SSD is where files are kept.',
    display: '16″ is the screen size, measured corner to corner.'
  };

  function lesson(key, custom) {
    var def = D.LESSONS[key] || { title: 'Practice' };
    var items = (custom || def.items).slice(), total = items.length, queue = items.slice();
    var doneN = 0, mistakes = 0, missed = {}, t0 = Date.now(), passed = [], failed = [], sayIndex = 0;
    var isSay = key === 'say' || key === 'practice';
    var el = mount('<div class="ltop"><button class="iconbtn" data-x aria-label="Quit lesson">' + ic('x') + '</button>' +
      '<div class="bar' + (isSay ? ' gold' : '') + '" role="progressbar" aria-label="Lesson progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div></div>' +
      '<div class="gb"></div><div class="gf"></div>', '');
    var gb = el.querySelector('.gb'), gf = el.querySelector('.gf'), bar = el.querySelector('.bar i');
    el.querySelector('[data-x]').onclick = function () { askQuit(false); };
    sub(function (fromPop) { askQuit(fromPop); });

    function askQuit(fromPop) {
      if (fromPop && !framed) { history.pushState({ ss: 1 }, ''); inSub = true; onBack = function (fp) { askQuit(fp); }; }
      confirmBox({ title: 'Quit this lesson?', text: 'You’ll lose your progress in this lesson.', ok: 'Quit', cancel: 'Keep going',
        onOk: function () { S.cancel(); A.stop(); goHome(); } });
    }
    function progress() {
      var pct = Math.min(100, Math.round(doneN / total * 100));
      bar.style.width = pct + '%'; bar.parentNode.setAttribute('aria-valuenow', pct);
    }
    var api = {
      done: function () { doneN++; progress(); next(); },
      miss: function (slug) { mistakes++; if (slug) missed[slug] = true; },
      answer: function (ok, info, item) {
        info = info || {};
        if (ok) { doneN++; progress(); A.sfx('correct'); }
        else { mistakes++; if (item.slug) missed[item.slug] = true; queue.push(item); A.sfx('wrong'); A.buzz(60); }
        lock();
        sheet(ok, ok ? (info.title || pick(CHEERS)) : 'Not quite',
          (ok ? '' : (info.correct ? 'Answer: <b>' + esc(info.correct) + '</b>. ' : '')) + (info.line || ''), next);
      }
    };
    function lock() { gb.querySelectorAll('button').forEach(function (b) { if (!b.hasAttribute('data-spk') && !b.hasAttribute('data-slow')) b.disabled = true; }); }
    function sheet(ok, title, line, onContinue, extraBtns, contLabel) {
      gf.className = 'sheet' + (ok === true ? '' : ok === 'info' ? ' info' : ' bad');
      gf.setAttribute('role', 'status');
      gf.innerHTML = CH(ok === true ? 'bolo_joy' : ok === 'info' ? 'bolo' : 'bolo_worried') + '<div><p class="t">' + title + '</p>' +
        (line ? '<p class="d">' + line + '</p>' : '') + '</div><div class="row">' + (extraBtns || '') + '<button class="btn' + (ok === true || ok === 'info' ? '' : ' coral') + '" data-cont>' + (contLabel || 'Continue') + '</button></div>';
      var c = gf.querySelector('[data-cont]');
      try { c.focus({ preventScroll: true }); } catch (e) {}
      arm(c, function () { onContinue(); });
      return gf;
    }
    function footBtn(label, cls, disabled) {
      gf.className = 'gf'; gf.removeAttribute('role');
      gf.innerHTML = '<button class="btn ' + (cls || '') + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>';
      return gf.querySelector('button');
    }
    function next() {
      gf.className = 'gf'; gf.removeAttribute('role'); gf.innerHTML = '';
      gb.scrollTop = 0;
      if (!queue.length) return finish();
      var item = queue.shift();
      gb.innerHTML = '';
      EX[item.t](item, api);
      var q = gb.querySelector('.q, .word');
      if (q) { q.setAttribute('tabindex', '-1'); try { q.focus({ preventScroll: true }); } catch (e) {} }
    }
    function choiceGroup(sel, onPick) {
      var bs = [].slice.call(gb.querySelectorAll(sel));
      bs.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); b.onclick = function () { select(bs, b); onPick(b); }; });
      return bs;
    }

    /* ---- the seven interactions ---- */
    var EX = {
      meet: function (it) {
        var w = D.BY[it.slug];
        gb.innerHTML = '<span class="tag">New word</span><div class="art">' + CH(w.buddy) + '</div><p class="word">' + w.word + '</p>' +
          '<div class="sayrow">' + spkBtn() + slowBtn() + '<p class="resp">' + w.say + hi(w.hi) + '</p></div>' +
          '<p class="mean">' + w.mean + '</p>' + (w.tip ? '<p class="tipline">' + w.tip + '</p>' : '') +
          (S.mode() === 'auto' ? '<button class="try" data-try>' + ic('mic') + 'Try saying it</button><p class="trynote" aria-live="polite" hidden></p>' : '');
        wireAudio(w);
        var tr = gb.querySelector('[data-try]');
        if (tr) tr.onclick = function () {
          var note = gb.querySelector('.trynote'); note.hidden = false; note.textContent = 'Starting the mic…';
          tr.disabled = true; setAudioBtns(false);
          S.listen(w, { onStart: function () { note.textContent = 'Listening… say “' + w.word + '”'; } }).then(function (r) {
            if (!document.body.contains(tr)) return;
            tr.disabled = false; setAudioBtns(true);
            note.textContent = r.status === 'pass' ? 'Clear! ✔ That’s how a customer should hear it.' :
              r.status === 'miss' ? 'We heard “' + r.heard + '”. Try: ' + w.say + '.' :
              r.status === 'denied' ? 'Speech check is off on this phone. You can still continue.' :
              r.status === 'busy' ? 'Another app is using the microphone.' : 'Didn’t catch that. Tap and try again.';
          });
        };
        A.word(w);
        arm(footBtn('Continue'), function () { api.done(); });
      },
      hear: function (it) {
        var w = D.BY[it.slug], correct = it.opts[0], sel = null;
        gb.innerHTML = '<p class="q">Tap what you hear</p><div class="say">' + CH(w.buddy) +
          '<div class="bubble fit">' + spkBtn('lg') + slowBtn() + '</div></div>' +
          '<div class="g2">' + shuffle(it.opts).map(function (o) { return '<button class="opt center" data-o="' + esc(o) + '">' + o + '</button>'; }).join('') + '</div>';
        wireAudio(w); A.word(w);
        var chk = footBtn('Check', '', true);
        choiceGroup('[data-o]', function (b) { sel = b; chk.disabled = false; });
        arm(chk, function () {
          var ok = sel.getAttribute('data-o') === correct;
          sel.classList.remove('sel'); sel.classList.add(ok ? 'ok' : 'bad');
          if (!ok) gb.querySelector('[data-o="' + esc(correct) + '"]').classList.add('ok');
          api.answer(ok, { correct: correct, line: w.word + ' · ' + w.say + '. ' + w.mean }, it);
        });
      },
      match: function (it) {
        var L = shuffle(it.pairs), R = shuffle(it.pairs), selL = null, selR = null, got = 0;
        gb.innerHTML = '<p class="q">Match the pairs</p><div class="g2 pairs"><div class="g1">' +
          L.map(function (p) { return '<button class="opt" data-side="l" data-k="' + p[2] + '" aria-pressed="false">' + p[0] + '</button>'; }).join('') + '</div><div class="g1">' +
          R.map(function (p) { return '<button class="opt" data-side="r" data-k="' + p[2] + '" aria-pressed="false">' + p[1] + '</button>'; }).join('') + '</div></div>' +
          '<p class="hint" aria-live="polite">0 of ' + it.pairs.length + ' matched</p>';
        gb.querySelectorAll('[data-side]').forEach(function (b) {
          b.onclick = function () {
            if (/\b(ok|gone|bad)\b/.test(b.className) || b.disabled) return;
            var side = b.getAttribute('data-side');
            if (side === 'l') { if (selL) { selL.classList.remove('sel'); selL.setAttribute('aria-pressed', 'false'); } selL = b; A.word(D.BY[b.getAttribute('data-k')]); }
            else { if (selR) { selR.classList.remove('sel'); selR.setAttribute('aria-pressed', 'false'); } selR = b; }
            b.classList.add('sel'); b.setAttribute('aria-pressed', 'true');
            if (selL && selR) {
              var a = selL, c = selR; selL = selR = null;
              a.setAttribute('aria-pressed', 'false'); c.setAttribute('aria-pressed', 'false');
              if (a.getAttribute('data-k') === c.getAttribute('data-k')) {
                a.classList.replace('sel', 'ok'); c.classList.replace('sel', 'ok'); a.disabled = c.disabled = true;
                if (side === 'r') A.sfx('correct');
                setTimeout(function () { a.className = 'opt gone'; c.className = 'opt gone'; }, 380);
                got++; gb.querySelector('.hint').textContent = got + ' of ' + it.pairs.length + ' matched';
                if (got === it.pairs.length) setTimeout(function () { doneN++; progress(); A.sfx('correct'); sheet(true, 'All matched!', 'Five words, five meanings.', next); }, 450);
              } else {
                a.classList.replace('sel', 'bad'); c.classList.replace('sel', 'bad'); A.sfx('wrong'); A.buzz(50);
                api.miss(a.getAttribute('data-k'));
                setTimeout(function () { a.classList.remove('bad'); c.classList.remove('bad'); }, 600);
              }
            }
          };
        });
      },
      spot: function (it) {
        var sel = null;
        gb.innerHTML = '<p class="q">' + it.q + '</p><div class="pcard"><div class="hd"><b>' + D.SPEC.title + '</b><small>' + D.SPEC.sub + '</small></div>' +
          D.SPEC.rows.map(function (r) { return '<button data-r="' + r.id + '"><span>' + r.k + '</span><b>' + r.v + '</b></button>'; }).join('') + '</div>';
        var chk = footBtn('Check', '', true);
        choiceGroup('[data-r]', function (b) { sel = b; chk.disabled = false; });
        arm(chk, function () {
          var ok = sel.getAttribute('data-r') === it.a;
          sel.classList.remove('sel'); sel.classList.add(ok ? 'ok' : 'bad');
          if (!ok) gb.querySelector('[data-r="' + it.a + '"]').classList.add('ok');
          var row = D.SPEC.rows.filter(function (r) { return r.id === it.a; })[0];
          api.answer(ok, { correct: row.k + ': ' + row.v, line: SPOT_WHY[it.a] }, it);
        });
      },
      fill: function (it) {
        var chosen = null;
        gb.innerHTML = '<p class="q">Finish what you’d tell the customer</p><div class="say">' + CH('pixi') + '<div class="bubble">' +
          it.pre + ' <button class="blank" data-blank aria-label="Empty blank">&nbsp;</button> ' + it.post + '</div></div>' +
          '<div class="bank">' + shuffle(it.bank).map(function (o) { return '<button class="cw" data-w="' + esc(o) + '">' + o + '</button>'; }).join('') + '</div>';
        var chk = footBtn('Check', '', true), blank = gb.querySelector('[data-blank]');
        function setBlank(word) {
          gb.querySelectorAll('[data-w]').forEach(function (b) { b.classList.toggle('used', b.getAttribute('data-w') === word); });
          chosen = word;
          blank.innerHTML = word ? '<span class="cw in">' + word + '</span>' : '&nbsp;';
          blank.setAttribute('aria-label', word ? 'Blank filled with ' + word + '. Tap to clear.' : 'Empty blank');
          chk.disabled = !word;
        }
        gb.querySelectorAll('[data-w]').forEach(function (b) { b.onclick = function () { setBlank(b.getAttribute('data-w')); }; });
        blank.onclick = function () { setBlank(null); };
        arm(chk, function () {
          var ok = chosen === it.a, chip = blank.querySelector('.cw');
          chip.style.borderColor = ok ? 'var(--lime-sh)' : 'var(--coral)';
          chip.style.background = ok ? 'var(--lime-soft)' : 'var(--coral-soft)';
          api.answer(ok, { correct: it.pre + ' ' + it.a + ' ' + it.post, line: ok ? '“' + it.pre + ' ' + it.a + ' ' + it.post + '”' : '' }, it);
        });
      },
      cust: function (it) {
        var sel = null;
        gb.innerHTML = '<span class="tag blue">Customer says</span><div class="cust">' + CH('customer') + '<div class="bubble">' + it.said + '</div></div>' +
          '<p class="q sm">You point to…</p><div class="g1">' + shuffle(it.opts).map(function (o) { return '<button class="opt" data-o="' + esc(o) + '">' + o + '</button>'; }).join('') + '</div>';
        var chk = footBtn('Check', '', true);
        choiceGroup('[data-o]', function (b) { sel = b; chk.disabled = false; });
        arm(chk, function () {
          var ok = sel.getAttribute('data-o') === it.a;
          sel.classList.remove('sel'); sel.classList.add(ok ? 'ok' : 'bad');
          if (!ok) gb.querySelector('[data-o="' + esc(it.a) + '"]').classList.add('ok');
          api.answer(ok, { title: ok ? 'Great pitch!' : null, correct: it.a, line: it.why + ' Feature, then benefit.' }, it);
        });
      },
      say: function (it) {
        var w = D.BY[it.slug], tries = 0, listening = false, fails = 0, trainerHere = false;
        sayIndex++;
        var label = key === 'practice' ? 'Practice' : 'Checkpoint · word ' + sayIndex + ' of ' + total;
        gb.innerHTML = '<span class="tag">' + label + '</span><p class="q">Say this word</p>' +
          '<div class="wcard">' + spkBtn() + '<div><b>' + w.word + '</b><small>' + w.say + ' · ' + hi(w.hi) + '</small></div>' + slowBtn() + '</div>' +
          '<div class="syll" hidden>' + w.syl.map(function (s) { return '<span' + (s === s.toUpperCase() && s.length > 1 ? ' class="st"' : '') + '>' + s + '</span>'; }).join('') + '</div>' +
          '<div class="micarea"></div>';
        wireAudio(w);
        var area = gb.querySelector('.micarea');
        function drawMic(note) {
          if (trainerHere || S.mode() === 'trainer') {
            area.innerHTML = '<div class="trainer"><p>' + (trainerHere ? '' : (S.why() ? esc(S.why()) + ' ' : '')) + '<b>Trainer check:</b> play the word, ask the APC to say it, and mark it.</p>' +
              '<div class="g2"><button class="btn ghost" data-tn>Not yet</button><button class="btn" data-ty>Said clearly</button></div></div>' +
              '<div class="tries">' + dots() + '</div>';
            arm(area.querySelector('[data-ty]'), function () { resolve('pass', ''); });
            arm(area.querySelector('[data-tn]'), function () { resolve('miss', ''); });
            return;
          }
          area.innerHTML = '<div class="microw">' + CH('bolo_listen', 'bl') + '<button class="mic" data-mic aria-label="Tap and say ' + w.word + '">' + ic('mic') + '</button></div>' +
            '<p class="micnote" aria-live="polite">' + (note || 'Tap the mic and say “' + w.word + '”') + '</p>' +
            (fails >= 2 ? '<button class="btn ghost sm" data-usetrainer>Use trainer check for this word</button>' : '') +
            '<div class="tries">' + dots() + '</div>';
          area.querySelector('[data-mic]').onclick = listen;
          var ut = area.querySelector('[data-usetrainer]'); if (ut) ut.onclick = function () { trainerHere = true; drawMic(); };
        }
        function dots() { var s = ''; for (var k = 0; k < 3; k++) s += '<i class="' + (k < tries ? 'used' : '') + '"></i>'; return s + ' Try ' + Math.min(tries + 1, 3) + ' of 3'; }
        function listen() {
          if (listening) return;
          listening = true;
          var mic = area.querySelector('[data-mic]'), note = area.querySelector('.micnote');
          note.textContent = 'Starting the mic…';
          setAudioBtns(false);
          S.listen(w, {
            onStart: function () { mic.classList.add('live'); note.textContent = 'Listening… say “' + w.word + '”'; },
            onSpeech: function () { note.textContent = 'Hearing you…'; }
          }).then(function (r) {
            listening = false;
            if (!document.body.contains(area)) return;        // the lesson was closed while listening
            setAudioBtns(true);
            if (r.status === 'nospeech') { fails++; return drawMic('I didn’t hear anything. Tap the mic and speak a little louder.'); }
            if (r.status === 'busy') { fails++; return drawMic('Another app is using the microphone. Close it and tap again.'); }
            if (r.status === 'denied') { toast(S.why()); return drawMic(); }
            if (r.status === 'network' || r.status === 'error') { fails++; return drawMic('Speech check needs mobile data. Check your connection and tap again.'); }
            fails = 0;
            resolve(r.status, r.heard);
          });
        }
        function resolve(status, heard) {
          lock();
          try { L.active && L.interaction(w.slug, status === 'pass', heard, (trainerHere || S.mode() === 'trainer') ? 'trainer' : 'mic'); } catch (e) {}
          if (status === 'pass') {
            A.sfx('correct');
            var firstTry = tries === 0;
            st.said[w.slug] = true; dropPractice(w.slug);
            if (firstTry) { ensureToday(); st.today.firstTry++; }
            addXP(firstTry ? 3 : 2); save();
            passed.push(w.slug); doneN++; progress();
            sheet(true, firstTry ? 'Crystal clear!' : 'Clear!', 'Customers will hear “' + w.word + '” perfectly.', next);
            return;
          }
          tries++; A.buzz(60);
          gb.querySelector('.syll').hidden = false;
          if (tries < 3) {
            var heardTxt = heard ? 'We heard “' + esc(heard) + '”. ' : '';
            var f = sheet(false, 'Not quite', heardTxt + 'Hear it slowly, then say <b>' + w.say + '</b> as one smooth word.',
              function () { gf.className = 'gf'; gf.removeAttribute('role'); gf.innerHTML = ''; unlockBtns(); drawMic(); },
              '<button class="btn ghost" data-sl aria-label="Hear it slowly">Slow</button>', 'Try again');
            f.querySelector('[data-sl]').onclick = function () { A.word(w, true); };
            A.sfx('wrong').then(function () { A.word(w, true); });
          } else {
            A.sfx('wrong');
            addPractice(w.slug); failed.push(w.slug); doneN++; progress();
            sheet(false, 'Let’s practise this one', '“' + w.word + '” moves to your Practice list. You can pass it any day.', next);
          }
        }
        function unlockBtns() { gb.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); }
        drawMic();
        A.word(w);
      }
    };
    function spkBtn(extra) { return '<button class="spk ' + (extra || '') + '" data-spk aria-label="Hear the word">' + ic('spk') + '</button>'; }
    function slowBtn() { return '<button class="slow" data-slow aria-label="Hear it slowly">Slow</button>'; }
    function wireAudio(w) {
      gb.querySelectorAll('[data-spk]').forEach(function (b) { b.onclick = function () { A.word(w); }; });
      gb.querySelectorAll('[data-slow]').forEach(function (b) { b.onclick = function () { A.word(w, true); }; });
    }
    function setAudioBtns(on) { gb.querySelectorAll('[data-spk],[data-slow]').forEach(function (b) { b.disabled = !on; }); }

    function finish() {
      var secs = Math.round((Date.now() - t0) / 1000);
      var missedList = Object.keys(missed);
      if (isSay) return sayDone(passed, failed, key);
      var first = !st.lessons[key];
      st.lessons[key] = true;
      var xp = 10 + (mistakes === 0 ? 5 : 0);
      addXP(xp); st.lessonsDone++; ensureToday(); st.today.lessons++;
      var grew = touchStreak();
      missedList.forEach(addPractice);
      save(true);
      A.sfx('complete');
      var acc = Math.round(total / (total + mistakes) * 100);
      lessonDone({ title: 'Lesson complete!', sub: 'Unit 1 · ' + def.title, xp: xp, acc: acc, time: secs, grew: grew, missed: missedList, first: first });
    }
    next();
  }

  /* ---------------- reward screens ---------------- */
  function confetti() {
    if (reduceMotion) return '';
    var c = ['#FFC83D', '#8C9EFF', '#4EDEA2', '#FF6B4A', '#B5E61D', '#FF8FC7'], s = '';
    for (var i = 0; i < 26; i++) s += '<i style="left:' + Math.round(Math.random() * 100) + '%;background:' + c[i % c.length] + ';animation-duration:' + (1.6 + Math.random() * 1.6).toFixed(2) + 's;animation-delay:' + (Math.random() * .5).toFixed(2) + 's"></i>';
    return '<div class="confetti" aria-hidden="true">' + s + '</div>';
  }
  function statBox(label, value, color, ink) { return '<div class="stat" style="--c:' + color + (ink ? ';--hc:' + ink : '') + '"><span class="h">' + label + '</span><span class="v">' + value + '</span></div>'; }
  function continueHome(el) { arm(el.querySelector('.gf [data-home]'), function () { home(); }); }
  function lessonDone(r) {
    sub(goHome);
    var el = mount(confetti() + '<div class="gb fin"><div class="cheer">' + CH('bolo_cheer') + '</div><h1 class="fin-h">' + r.title + '</h1><p class="fin-s">' + r.sub + '</p>' +
      '<div class="trio">' + statBox('Total XP', ic('bolt') + r.xp, '#FFC83D', '#0B1240') + statBox('Accuracy', r.acc + '%', '#B5E61D', '#0B1240') + statBox('Time', fmt(r.time), '#8C9EFF', '#0B1240') + '</div>' +
      '<p class="streakline">' + CH('lau_mini') + (r.grew ? streakNow() + '-day streak! Lau is growing.' : streakNow() + '-day streak') + '</p>' +
      (r.missed.length ? '<div class="later"><small>Practise later</small>' + r.missed.map(function (s) { return '<span>' + D.BY[s].word + '</span>'; }).join('') + '</div>' : '') +
      '</div><div class="gf"><button class="btn" data-home>Continue</button></div>', '');
    continueHome(el);
  }
  function levelDone(r) {
    sub(goHome);
    A.sfx('complete');
    ensureToday(); var grew = touchStreak(); save();
    var el = mount(confetti() + '<div class="gb fin"><div class="cheer">' + CH('bolo_cheer') + '</div><h1 class="fin-h">' + r.title + '</h1><p class="fin-s">' + r.sub + '</p>' +
      (r.xp ? '<div class="trio" style="grid-template-columns:1fr;max-width:9em">' + statBox('XP earned', ic('bolt') + r.xp, '#FFC83D', '#0B1240') + '</div>' : '') +
      '<p class="streakline">' + CH('lau_mini') + streakNow() + '-day streak' + (grew ? '! Lau is growing.' : '') + '</p>' +
      '</div><div class="gf"><button class="btn" data-home>Continue</button></div>', '');
    continueHome(el);
  }
  function sayDone(passed, failed, key) {
    sub(goHome);
    ensureToday(); st.today.lessons++; var grew = touchStreak(); save(true);
    var all = saidCount() === D.WORDS.length, ready = all && !st.badge && unlocked('badge');
    A.sfx(all ? 'complete' : 'correct');
    var el = mount((passed.length ? confetti() : '') + '<div class="gb fin"><div class="cheer">' + CH(failed.length ? 'bolo' : 'bolo_cheer') + '</div>' +
      '<h1 class="fin-h">' + (key === 'practice' ? (passed.length ? 'Practice done!' : 'Keep practising') : passed.length + ' of ' + (passed.length + failed.length) + ' words clear') + '</h1>' +
      '<p class="fin-s">' + (ready ? 'All 10 Unit 1 words are clear. Your badge is ready!' : saidCount() + ' of 10 Unit 1 words clear so far') + '</p>' +
      '<div class="later">' + passed.map(function (s) { return '<span style="border-color:var(--lime-sh);background:var(--lime-soft)">✔ ' + D.BY[s].word + '</span>'; }).join('') +
      failed.map(function (s) { return '<span style="border-color:#FFC9BA;background:var(--coral-soft)">' + D.BY[s].word + '</span>'; }).join('') + '</div>' +
      '<p class="streakline">' + CH('lau_mini') + streakNow() + '-day streak' + (grew ? '! Lau is growing.' : '') + '</p>' +
      '</div><div class="gf" style="display:grid;gap:.7em">' + (ready ? '<button class="btn" data-badge>Claim your badge</button>' : failed.length ? '<button class="btn" data-prac>Practise these words</button>' : '') +
      '<button class="btn ghost" data-home>Back to the map</button></div>', '');
    var b = el.querySelector('[data-badge]'); if (b) arm(b, unitComplete);
    var p = el.querySelector('[data-prac]'); if (p) arm(p, practiceTab);
    continueHome(el);
  }
  function unitComplete() {
    if (!st.badge && !unlocked('badge')) return home();
    sub(goHome);
    var first = !st.badge;
    st.badge = true; if (first) addXP(50); save(true);
    A.sfx('complete');
    var el = mount(confetti() + '<div class="gb fin"><div class="badgebig">' + CH('bolo_cheer') + '</div><h1 class="fin-h" style="margin-top:.6em">Unit 1 complete!</h1>' +
      '<p class="fin-s">You can say all 10 basics clearly. That’s how an Acer expert sounds.</p>' +
      (first ? '<div class="trio" style="grid-template-columns:1fr;max-width:9em">' + statBox('Bonus XP', ic('bolt') + '50', '#FFC83D', '#0B1240') + '</div>' : '') +
      '</div><div class="gf" style="display:grid;gap:.7em"><button class="btn" data-home>Back to the map</button><button class="btn ghost" data-streak>See Lau grow</button></div>', '');
    continueHome(el);
    el.querySelector('[data-streak]').onclick = streakScreen;
  }

  /* ---------------- logging out (outside the LMS) ---------------- */
  function askLogOut() {
    confirmBox({ char: 'bolo', title: 'Log out, ' + esc(st.name) + '?', text: 'Your progress stays saved on this phone. Next time, type your name or tap it to carry on.',
      ok: 'Log out', okCls: '', cancel: 'Stay', onOk: logOut });
  }
  function logOut() {
    var n = st.name, a = accounts();
    a[nameKey(n)] = st; putAccounts(a);
    try { localStorage.removeItem(KEY); } catch (e) {}
    A.stop(); S.cancel();
    st = fresh(); st.homeTip = true;
    welcome();
    toast('Logged out. See you soon, ' + n + '!');
  }

  /* ---------------- leaving the LMS session ---------------- */
  function askExit() {
    confirmBox({ char: 'bolo', title: 'Save and exit?', text: 'Your progress is saved to your training record. Come back any time to carry on.',
      ok: 'Save and exit', okCls: '', cancel: 'Keep playing', onOk: exitNow });
  }
  function exitNow() {
    save(true); L.exit();
    mount('<div class="gb fin"><div class="cheer">' + CH('bolo_wave') + '</div><h1 class="fin-h">Progress saved</h1>' +
      '<p class="fin-s">' + (framed ? 'Close this lesson with TrainGram\u2019s close button.' : 'You can close this window now.') + ' See you next time, ' + esc(st.name || 'friend') + '!</p></div>', '');
  }

  /* ---------------- tabs: practice, league, profile ---------------- */
  function practiceTab() {
    sub(goHome);
    var due = st.practice.map(function (s) { return D.BY[s]; }).filter(Boolean);
    function row(w, isDue) {
      return '<div class="wrow' + (isDue ? ' due' : '') + '"><button class="spk" data-hear="' + w.slug + '" aria-label="Hear ' + w.word + '">' + ic('spk') + '</button>' +
        '<div class="w"><b>' + w.word + (st.said[w.slug] ? ' <span class="ok" aria-label="clear">✔</span>' : '') + '</b><small>' + w.say + ' · ' + hi(w.hi) + '</small></div>' +
        '<button class="smallbtn" data-say="' + w.slug + '" aria-label="Practise saying ' + w.word + '">' + ic('mic') + '</button></div>';
    }
    var el = mount('<div class="scroll"><div class="page-h"><h1>Practice</h1><p>Words you missed come back here until they stick.</p></div>' +
      (due.length ? '<h2 class="section-t">To practise (' + due.length + ')</h2><div class="list">' + due.map(function (w) { return row(w, true); }).join('') + '</div>' :
        '<div class="empty">' + CH('lau_joy') + '<p>Nothing to practise right now. Nice work!</p></div>') +
      '<h2 class="section-t">All Unit 1 words</h2><div class="list">' + D.WORDS.map(function (w) { return row(w, false); }).join('') + '</div></div>' + tabs('practice'), '');
    bindTabs(el);
    if (window.ARC && ARC.practiceCard) ARC.practiceCard(el);
    el.querySelectorAll('[data-hear]').forEach(function (b) { b.onclick = function () { A.word(D.BY[b.getAttribute('data-hear')]); }; });
    el.querySelectorAll('[data-say]').forEach(function (b) { b.onclick = function () { lesson('practice', [{ t: 'say', slug: b.getAttribute('data-say') }]); }; });
  }
  function leagueTab() {
    sub(goHome);
    var me = { who: st.name || 'You', store: st.store || 'Your store', xp: st.xp, me: true };
    var rows = D.LEAGUE.concat([me]).sort(function (a, b) { return b.xp - a.xp; });
    var el = mount('<div class="scroll"><div class="page-h"><h1>Store league</h1><p>This week · resets on Monday</p></div>' +
      '<p class="samplenote">Sample league for the prototype. In the pilot this shows real APCs and stores in your region.</p>' +
      '<ol class="list" aria-label="League table">' + rows.map(function (r, i) {
        return '<li class="lrow' + (r.me ? ' me' : '') + '"><span class="rk">' + (i + 1) + '</span><div><b>' + esc(r.who) + (r.me ? ' (you)' : '') + '</b><small>' + esc(r.store) + '</small></div><span class="x">' + r.xp + ' XP</span></li>';
      }).join('') + '</ol></div>' + tabs('league'), '');
    bindTabs(el);
  }
  function profileTab() {
    sub(goHome);
    var auto = S.mode() === 'auto';
    var el = mount('<div class="scroll"><div class="page-h"><h1>' + esc(st.name || 'Profile') + '</h1><p>' + esc(st.store || 'Acer Product Consultant') + '</p></div><div class="prof">' +
      '<div class="kv"><div><b>' + st.xp + '</b><small>XP</small></div><div><b>' + streakNow() + '</b><small>Day streak</small></div><div><b>' + saidCount() + '/10</b><small>Words clear</small></div></div>' +
      '<div class="card"><h2 class="h3">Speech check</h2><p>' + (auto ? 'This phone checks each word with speech recognition set to Indian English. It confirms a customer would understand the word; accents are fine.' : esc(S.why()) + ' Words can still be passed with a trainer check.') + '</p></div>' +
      '<div class="card"><button class="toggle" role="switch" aria-checked="' + S.trainerForced + '" data-trainer><span><b>Trainer check</b><br><small style="color:var(--ink2);font-family:var(--body)">A trainer marks words instead of the microphone.</small></span><span class="sw" aria-hidden="true"></span></button></div>' +
      '<div class="card"><button class="toggle" role="switch" aria-checked="' + !A.muted + '" data-sound><span><b>Sound effects</b></span><span class="sw" aria-hidden="true"></span></button></div>' +
      '<div class="card"><h2 class="h3">About this prototype</h2><p>SpecSpeak prototype for Acer APC training, by Channelplay. Unit 1 is playable; Units 2–4 open in the pilot. ' +
      (L.active ? 'Progress is saved to your training record.' : 'Progress is saved on this phone only.') + '</p></div>' +
      (L.active ? '<button class="btn" data-exit>Save and exit</button>' : '') +
      (!L.active || !L.learnerName() ? '<button class="btn ghost" data-edit>Change name or store</button>' : '') +
      (inLMS ? '' : '<button class="btn" data-logout>' + ic('logout') + 'Log out</button>') +
      (inLMS ? '' : '<button class="btn ghost" data-reset style="color:var(--coral-ink)">Reset progress</button>') +
      '</div></div>' + tabs('profile'), '');
    bindTabs(el);
    el.querySelector('[data-trainer]').onclick = function () { S.setTrainer(!S.trainerForced); profileTab(); };
    el.querySelector('[data-sound]').onclick = function () { A.setMuted(!A.muted); profileTab(); };
    var ed = el.querySelector('[data-edit]'); if (ed) ed.onclick = function () { nameScreen(true); };
    var ex2 = el.querySelector('[data-exit]'); if (ex2) ex2.onclick = askExit;
    var lo = el.querySelector('[data-logout]'); if (lo) lo.onclick = askLogOut;
    var rs = el.querySelector('[data-reset]'); if (rs) rs.onclick = function () {
      confirmBox({ title: 'Reset all progress?', text: 'XP, streak and every level go back to the start. This can’t be undone.', ok: 'Reset', cancel: 'Cancel',
        onOk: function () { var n = st.name, s = st.store; st = fresh(); st.name = n; st.store = s; st.homeTip = true; save(); home(); toast('Progress reset.'); } });
    };
  }

  /* ---------------- start ---------------- */
  document.addEventListener('touchstart', function () {}, { passive: true });   // lets :active press states show on iPhone
  if (L.active) {
    L.onBeforeFinish(function () { save(true); });
    if (L.loadFailed) setTimeout(function () { toast('Your saved progress couldn\u2019t be read. Your training record has not been changed.'); }, 800);
  }
  /* Play & Learn (arcade/): a Say-it pass there counts for the unit exactly like the lesson's, minus the lesson XP */
  function markSaid(slug, method, heard, firstTry, passed) {
    if (!D.BY[slug]) return;
    var ok = passed !== false;
    try { L.active && L.interaction(slug, ok, heard || '', method === 'trainer' ? 'trainer' : 'mic'); } catch (e) {}
    if (!ok) return;
    st.said[slug] = true; dropPractice(slug);
    if (firstTry) { ensureToday(); st.today.firstTry++; }
    save(true);
  }
  if (window.ARC && ARC.init) ARC.init({ state: function () { return st; }, save: save, addXP: addXP, touchStreak: touchStreak,
    ensureToday: ensureToday, today: today, toast: toast, confirm: confirmBox, markSaid: markSaid,
    mount: mount, sub: sub, goHome: goHome, home: home, practice: practiceTab, D: D, A: A, S: S, inLMS: inLMS });
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !framed && !L.active && /github\.io$/.test(location.hostname)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  home();
})();
