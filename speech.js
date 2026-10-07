/* Audio playback and the speech check.
   Speech check = the browser's own speech recognition (Chrome on Android, Safari on iPhone),
   set to Indian English. It confirms the word was understood; it does not grade accents. */
(function () {
  var isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var framed = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();

  /* ---------- audio ---------- */
  var player = new Audio();
  player.preload = 'auto';
  player.setAttribute('playsinline', '');
  var unlocked = false, seq = 0;

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    // iOS only lets a page make sound after a tap: play silence once inside the first tap,
    // and prime speech synthesis the same way so the fallback voice works later
    try { player.src = 'assets/audio/silence.mp3'; var p = player.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    try { if (window.speechSynthesis) speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) {}
  }
  ['touchend', 'click', 'keydown'].forEach(function (ev) { document.addEventListener(ev, unlock, { once: true, capture: true }); });

  var muted = false;
  try { muted = localStorage.getItem('specspeak.muted') === '1'; } catch (e) {}

  function speakTTS(text, slow) {
    try {
      var s = window.speechSynthesis; if (!s) return;
      s.cancel();
      var u = new SpeechSynthesisUtterance(text);
      var v = s.getVoices().filter(function (x) { return /en[-_]IN/i.test(x.lang); })[0];
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'en-IN'; }
      u.rate = slow ? 0.6 : 0.9;
      s.speak(u);
    } catch (e) {}
  }

  function stop() {
    seq++;
    try { player.pause(); } catch (e) {}
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
  }

  /* Each call gets an id; a newer call cancels older ones cleanly (no stray fallback voice). */
  function play(src, fallbackText, slow) {
    var id = ++seq;
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    return new Promise(function (resolve) {
      function done() { if (id === seq) { player.onended = player.onerror = null; } resolve(); }
      function fail(err) {
        if (id !== seq || (err && err.name === 'AbortError')) return resolve();
        if (fallbackText) speakTTS(fallbackText, slow);
        done();
      }
      try {
        player.pause();
        player.src = src;
        player.currentTime = 0;
        player.onended = done;
        player.onerror = function () { fail(); };
        var p = player.play();
        if (p && p.catch) p.catch(fail);
      } catch (e) { fail(e); }
    });
  }

  var Audio_ = {
    word: function (w, slow) { return play('assets/audio/' + w.slug + (slow ? '-slow' : '') + '.mp3', w.word, slow); },
    sfx: function (name) { if (muted) return Promise.resolve(); return play('assets/audio/' + name + '.mp3'); },
    stop: stop,
    buzz: function (ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 40); } catch (e) {} },
    get muted() { return muted; },
    setMuted: function (m) { muted = !!m; try { localStorage.setItem('specspeak.muted', m ? '1' : '0'); } catch (e) {} }
  };

  /* ---------- speech check ---------- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var forcedTrainer = false;
  try { forcedTrainer = localStorage.getItem('specspeak.trainer') === '1'; } catch (e) {}
  var denied = '';          // error code that blocked speech for this page load
  var active = null;        // the running recognizer, so a quit can abort it

  function norm(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9ऀ-ॿ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function matches(alts, accept) {
    for (var i = 0; i < alts.length; i++) {
      var n = norm(alts[i]), squashed = n.replace(/ /g, '');
      for (var j = 0; j < accept.length; j++) {
        var a = norm(accept[j]);
        if (n === a || squashed === a.replace(/ /g, '') || (' ' + n + ' ').indexOf(' ' + a + ' ') >= 0) return true;
      }
    }
    return false;
  }
  var DICTATION = 'On iPhone, turn on Settings › General › Keyboard › Enable Dictation, allow the microphone, then reload.';

  var Speech = {
    /* 'auto' when the phone can check speech itself, otherwise 'trainer' */
    mode: function () {
      if (forcedTrainer || denied || framed) return 'trainer';
      return (SR && window.isSecureContext) ? 'auto' : 'trainer';
    },
    why: function () {
      if (forcedTrainer) return 'Trainer check is switched on in Profile.';
      if (framed) return 'The microphone can’t be used inside this preview page. Open the SpecSpeak web link on your phone for the live speech check.';
      if (denied === 'service-not-allowed' || (denied && isIOS)) return 'Speech check is off on this phone. ' + DICTATION;
      if (denied) return 'The microphone is blocked for this page. Allow it in the browser’s site settings, then reload.';
      if (!window.isSecureContext) return 'Speech check needs a secure (https) link.';
      if (!SR) return 'This browser can’t check speech. Use Chrome on Android or Safari on iPhone.';
      return '';
    },
    setTrainer: function (on) { forcedTrainer = !!on; try { localStorage.setItem('specspeak.trainer', on ? '1' : '0'); } catch (e) {} },
    get trainerForced() { return forcedTrainer; },
    get isIOS() { return isIOS; },
    matches: matches,
    cancel: function () { if (active) { try { active.abort(); } catch (e) {} active = null; } },
    /* listen once for word w. Resolves {status, heard}.
       status: pass | miss | nospeech | denied | busy | network | error */
    listen: function (w, hooks) {
      hooks = hooks || {};
      stop();                                   // never let the mic hear the app's own audio
      return new Promise(function (resolve) {
        var rec, finished = false, gotResult = false, stopTimer, startGuard, backstop;
        function finish(r) {
          if (finished) return; finished = true;
          clearTimeout(stopTimer); clearTimeout(startGuard); clearTimeout(backstop);
          try { rec && rec.abort(); } catch (e) {}
          if (active === rec) active = null;
          resolve(r);
        }
        try {
          rec = new SR();
          rec.lang = 'en-IN';
          rec.interimResults = false;
          rec.continuous = false;
          rec.maxAlternatives = 5;
        } catch (e) { return finish({ status: 'error', heard: '' }); }
        active = rec;
        rec.onstart = function () {
          clearTimeout(startGuard);
          // the 7 s window starts when the mic is actually open, not at the tap (iOS permission prompts)
          stopTimer = setTimeout(function () {
            try { rec.stop(); } catch (e) {}
            backstop = setTimeout(function () { finish({ status: 'nospeech', heard: '' }); }, 4000);
          }, 7000);
          hooks.onStart && hooks.onStart();
        };
        rec.onspeechstart = function () { hooks.onSpeech && hooks.onSpeech(); };
        rec.onresult = function (e) {
          gotResult = true;
          var alts = [];
          for (var i = 0; i < e.results.length; i++)
            for (var j = 0; j < e.results[i].length; j++) alts.push(e.results[i][j].transcript);
          finish({ status: matches(alts, w.accept) ? 'pass' : 'miss', heard: (alts[0] || '').trim() });
        };
        rec.onerror = function (e) {
          var code = e && e.error;
          if (code === 'no-speech' || code === 'aborted') return finish({ status: 'nospeech', heard: '' });
          if (code === 'audio-capture') return finish({ status: 'busy', heard: '' });
          if (code === 'not-allowed' || code === 'service-not-allowed') { denied = code; return finish({ status: 'denied', heard: '', code: code }); }
          if (code === 'network') return finish({ status: 'network', heard: '' });
          finish({ status: 'error', heard: '', code: code });
        };
        rec.onend = function () { setTimeout(function () { if (!gotResult) finish({ status: 'nospeech', heard: '' }); }, 300); };
        startGuard = setTimeout(function () { finish({ status: 'error', heard: '' }); }, 15000);
        try { rec.start(); } catch (e) { finish({ status: 'error', heard: '' }); }
      });
    }
  };

  window.SSAudio = Audio_;
  window.SSSpeech = Speech;
})();
