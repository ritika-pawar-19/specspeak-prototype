/* SCORM runtime adapter for SpecSpeak.
   Finds the LMS (SCORM 2004 API_1484_11 or SCORM 1.2 API) in the parent frames or the window that opened
   this pop-up, and makes it the place progress is saved and results are reported:
     - progress (suspend_data) so each learner resumes where they left off, on any device
     - learner name from the LMS (no name screen)
     - location = current step, progress = steps done / 7
     - score = share of the 10 Unit 1 words said clearly
     - complete + passed once every step is done
     - one interaction per say-it attempt (word, pass/fail, mic or trainer, what the phone heard)
   With no LMS, SSLMS.active is false and the app keeps using this phone's localStorage.
   In a SCORM package (window.SS_SCORM, set by build_scorm.py) a missing or broken LMS connection is
   reported to the app (SSLMS.expected && !SSLMS.active) so it never falls back to the phone silently. */
(function () {
  'use strict';
  var api = null, ver = null, via = '', active = false, finished = false, terminating = false, started = Date.now();
  var lastSaved = '', commitTimer = null, lastCommit = 0, reportedDone = false, loadFailed = false, hooks = [];
  var expected = !!window.SS_SCORM || /[?&]scorm=1\b/.test(location.search);

  function findIn(win, how) {
    for (var n = 0; win && n < 12; n++) {
      try {
        if (win.API_1484_11) return { api: win.API_1484_11, ver: '2004', via: how };
        if (win.API) return { api: win.API, ver: '1.2', via: how };
      } catch (e) { /* cross-origin frame: keep climbing */ }
      var up;
      try { up = win.parent; } catch (e) { up = null; }
      if (!up || up === win) break;
      win = up;
    }
    return null;
  }
  function discover() {
    var r = findIn(window, 'frame');
    if (!r) { try { if (window.opener) r = findIn(window.opener, 'opener'); } catch (e) {} }
    if (!r) { try { if (window.top && window.top.opener) r = findIn(window.top.opener, 'opener'); } catch (e) {} }
    return r;
  }
  function ok(v) { return v === true || String(v) === 'true'; }
  function call(m12, m04, a, b) {
    try {
      var fn = ver === '2004' ? api[m04] : api[m12];
      return fn.apply(api, b === undefined ? (a === undefined ? [''] : [a]) : [a, b]);
    } catch (e) { return ''; }
  }
  function get(k12, k04) { var v = call('LMSGetValue', 'GetValue', ver === '2004' ? k04 : k12); return v == null ? '' : String(v); }
  function set(k12, k04, v) { if (!active || finished) return false; return ok(call('LMSSetValue', 'SetValue', ver === '2004' ? k04 : k12, String(v))); }
  function lastError() { return String(call('LMSGetLastError', 'GetLastError')); }

  function commitNow() {
    if (!active || finished) return;
    clearTimeout(commitTimer); commitTimer = null;
    call('LMSCommit', 'Commit'); lastCommit = Date.now();
  }
  /* routine saves commit at most every 4 s; important ones commit just after the next screen paints */
  function commitSoon(delay) {
    if (!active || finished) return;
    if (delay != null) { clearTimeout(commitTimer); commitTimer = setTimeout(commitNow, delay); return; }
    if (commitTimer) return;
    commitTimer = setTimeout(commitNow, Math.max(0, 4000 - (Date.now() - lastCommit)));
  }

  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function sessionTime() {
    var s = Math.max(0, Math.round((Date.now() - started) / 1000));
    if (ver === '2004') return 'PT' + Math.floor(s / 3600) + 'H' + Math.floor(s % 3600 / 60) + 'M' + (s % 60) + 'S';
    return pad(Math.floor(s / 3600), 4) + ':' + pad(Math.floor(s % 3600 / 60), 2) + ':' + pad(s % 60, 2);
  }
  function stamp() {
    var d = new Date();
    if (ver === '2004') return d.toISOString().slice(0, 19) + 'Z';
    return pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2);
  }
  function runHooks() { hooks.forEach(function (fn) { try { fn(); } catch (e) {} }); }

  function finish(userExit) {
    if (!active || finished || terminating) return;
    terminating = true;
    runHooks();                                   // let the app write its very latest state first
    set('cmi.core.session_time', 'cmi.session_time', sessionTime());
    set('cmi.core.exit', 'cmi.exit', 'suspend');   // the learner can always reopen the unit and carry on
    if (userExit && ver === '2004') set('', 'adl.nav.request', 'suspendAll');   // ask a 2004 player to close
    commitNow();
    finished = true;
    call('LMSFinish', 'Terminate');
  }

  var found = discover();
  if (found) {
    api = found.api; ver = found.ver; via = found.via;
    var res = call('LMSInitialize', 'Initialize');
    if (ok(res)) active = true;
    else {
      // "already initialised" (1.2: 101, 2004: 103) is usable only if the LMS still answers reads
      var e = lastError();
      if ((ver === '1.2' && e === '101') || (ver === '2004' && e === '103')) {
        get('cmi.core.lesson_status', 'cmi.completion_status');
        active = lastError() === '0';
      }
    }
  }
  if (active) {
    var status = ver === '2004' ? get('', 'cmi.completion_status') : get('cmi.core.lesson_status', '');
    var success = ver === '2004' ? get('', 'cmi.success_status') : '';
    reportedDone = status === 'passed' || status === 'completed' || success === 'passed';
    if (ver === '2004') { if (status === 'not attempted' || status === 'unknown' || !status) set('', 'cmi.completion_status', 'incomplete'); }
    else if (status === 'not attempted' || !status) set('cmi.core.lesson_status', '', 'incomplete');
    set('cmi.core.score.min', 'cmi.score.min', '0');
    set('cmi.core.score.max', 'cmi.score.max', '100');
    // set suspend from the start, so a session killed without warning (app swiped away) still resumes next time
    set('cmi.core.exit', 'cmi.exit', 'suspend');
    commitNow();
    window.addEventListener('pagehide', function () { finish(false); });
    window.addEventListener('unload', function () { finish(false); });
    window.addEventListener('beforeunload', function () { runHooks(); commitNow(); });   // the learner may still cancel leaving
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'hidden' || !active || finished) return;
      runHooks();
      if (ver === '2004') set('', 'cmi.session_time', sessionTime());   // 1.2 LMSs may add session time on every commit
      commitNow();
    });
  }

  window.SSLMS = {
    get active() { return active && !finished; },
    get version() { return ver; },
    /* this page is a SCORM package (or an LMS API exists) — never fall back to phone storage */
    get expected() { return expected || !!found; },
    get ended() { return finished; },
    get loadFailed() { return loadFailed; },
    onBeforeFinish: function (fn) { hooks.push(fn); },
    /* learner's name, "First Last", from "Last, First", an email address or a plain name */
    learnerName: function () {
      if (!active) return '';
      var n = (ver === '2004' ? get('', 'cmi.learner_name') : get('cmi.core.student_name', '')).replace(/^\{lang=[^}]*\}/, '').trim();
      if (!n) return '';
      if (n.indexOf('@') > 0) n = n.split('@')[0].replace(/[._-]+/g, ' ');
      if (n.indexOf(',') >= 0) { var parts = n.split(','); n = (parts[1] || '').trim() + ' ' + parts[0].trim(); }
      return n.trim().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    },
    /* saved progress object, or null on a first launch */
    load: function () {
      if (!active) return null;
      var raw = ver === '2004' ? get('', 'cmi.suspend_data') : get('cmi.suspend_data', '');
      if (!raw) return null;
      try { lastSaved = raw; return JSON.parse(raw); } catch (e) {}
      try { var r = JSON.parse(raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&')); lastSaved = raw; return r; } catch (e) {}
      loadFailed = true;           // never overwrite a record we could not read
      return null;
    },
    /* r: {state, stepsDone, stepsTotal, wordsClear, wordsTotal, badge, location, important} */
    save: function (r) {
      if (!active || finished) return;
      var raw = JSON.stringify(r.state);
      if (!loadFailed && raw !== lastSaved && set('cmi.suspend_data', 'cmi.suspend_data', raw)) lastSaved = raw;
      set('cmi.core.lesson_location', 'cmi.location', r.location || '');
      var pct = Math.round(100 * r.wordsClear / r.wordsTotal);
      set('cmi.core.score.raw', 'cmi.score.raw', String(pct));
      if (ver === '2004') {
        set('', 'cmi.score.scaled', (pct / 100).toFixed(2));
        set('', 'cmi.progress_measure', (r.stepsDone / r.stepsTotal).toFixed(2));
      }
      if (r.badge && !reportedDone) {
        if (ver === '2004') { set('', 'cmi.completion_status', 'completed'); set('', 'cmi.success_status', 'passed'); }
        else set('cmi.core.lesson_status', '', 'passed');
        reportedDone = true;
        commitSoon(50);
      } else if (r.important) commitSoon(50);
      else commitSoon();
    },
    /* one say-it attempt. method: 'mic' | 'trainer' */
    interaction: function (slug, passed, heard, method) {
      if (!active || finished) return;
      try {
        var n = parseInt(ver === '2004' ? get('', 'cmi.interactions._count') : get('cmi.interactions._count', ''), 10) || 0;
        if (n >= 200) return;
        var p = 'cmi.interactions.' + n + '.', trainer = method === 'trainer';
        var resp = trainer ? 'trainer' : String(heard || '').replace(/[^\p{L}\p{M}\p{N} '-]/gu, '').trim().slice(0, 200);
        if (ver === '2004') {
          set('', p + 'id', 'urn:acer:specspeak:u1:say:' + slug);
          set('', p + 'type', 'fill-in');
          set('', p + 'timestamp', stamp());
          set('', p + 'description', (trainer ? 'Say-it check (trainer): ' : 'Say-it check (mic): ') + slug);
          if (resp) set('', p + 'learner_response', resp);
          set('', p + 'result', passed ? 'correct' : 'incorrect');
        } else {
          set(p + 'id', '', 'say_' + slug);
          set(p + 'type', '', 'fill-in');
          set(p + 'time', '', stamp());
          if (resp) set(p + 'student_response', '', resp.replace(/[^\x20-\x7e]/g, '') || 'hi-script');
          set(p + 'result', '', passed ? 'correct' : 'wrong');
        }
        commitSoon();
      } catch (e) {}
    },
    /* "Save and exit": save everything, end the session, and close the player where we safely can */
    exit: function () {
      finish(true);
      // only a window the LMS opened for us is ours to close; never the LMS page itself
      if (via === 'opener') {
        setTimeout(function () { try { (window.top && window.top !== window ? window.top : window).close(); } catch (e) {} }, 900);
      }
    },
    commit: commitNow
  };
})();
