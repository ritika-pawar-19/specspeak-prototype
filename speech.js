/* Audio playback and the speech check.
   Speech check = the browser's own speech recognition (Chrome on Android, Safari on iPhone),
   set to Indian English. It confirms the word was understood; it does not grade accents. */
(function () {
  /* ---------- audio ---------- */
  var player = new Audio();
  player.preload = 'auto';
  player.setAttribute('playsinline', '');
  var unlocked = false;

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    // iOS only lets a page play sound after a tap; play a silent blip once inside the first tap
    try {
      player.src = 'assets/audio/silence.mp3';
      var p = player.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
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

  function play(src, fallbackText, slow, vol) {
    if (muted && !fallbackText) return Promise.resolve();
    return new Promise(function (resolve) {
      try {
        player.pause();
        player.src = src;
        player.volume = vol == null ? 1 : vol;
        player.currentTime = 0;
        var done = function () { player.onended = player.onerror = null; resolve(); };
        player.onended = done;
        player.onerror = function () { if (fallbackText) speakTTS(fallbackText, slow); done(); };
        var p = player.play();
        if (p && p.catch) p.catch(function () { if (fallbackText) speakTTS(fallbackText, slow); done(); });
      } catch (e) { if (fallbackText) speakTTS(fallbackText, slow); resolve(); }
    });
  }

  var Audio_ = {
    word: function (w, slow) { return play('assets/audio/' + w.slug + (slow ? '-slow' : '') + '.mp3', w.word, slow); },
    sfx: function (name) { if (muted) return; play('assets/audio/' + name + '.mp3', null, false, 0.6); },
    buzz: function (ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 40); } catch (e) {} },
    get muted() { return muted; },
    setMuted: function (m) { muted = !!m; try { localStorage.setItem('specspeak.muted', m ? '1' : '0'); } catch (e) {} }
  };

  /* ---------- speech check ---------- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var forcedTrainer = false;
  try { forcedTrainer = localStorage.getItem('specspeak.trainer') === '1'; } catch (e) {}
  var deniedThisLoad = false;

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

  var Speech = {
    /* 'auto' when the phone can check speech itself, otherwise 'trainer' */
    mode: function () {
      if (forcedTrainer || deniedThisLoad) return 'trainer';
      return (SR && window.isSecureContext) ? 'auto' : 'trainer';
    },
    why: function () {
      if (forcedTrainer) return 'Trainer check is switched on in Profile.';
      if (deniedThisLoad) return 'The microphone is blocked for this page.';
      if (!window.isSecureContext) return 'Speech check needs a secure (https) link.';
      if (!SR) return 'This browser can’t check speech. Use Chrome on Android or Safari on iPhone.';
      return '';
    },
    setTrainer: function (on) { forcedTrainer = !!on; try { localStorage.setItem('specspeak.trainer', on ? '1' : '0'); } catch (e) {} },
    get trainerForced() { return forcedTrainer; },
    matches: matches,
    /* listen once for word w. Resolves {status, heard}.
       status: pass | miss | nospeech | denied | network | error */
    listen: function (w, hooks) {
      hooks = hooks || {};
      return new Promise(function (resolve) {
        var rec, finished = false, gotResult = false, timer;
        function finish(r) {
          if (finished) return; finished = true; clearTimeout(timer);
          try { rec && rec.abort(); } catch (e) {}
          resolve(r);
        }
        try {
          rec = new SR();
          rec.lang = 'en-IN';
          rec.interimResults = false;
          rec.continuous = false;
          rec.maxAlternatives = 5;
        } catch (e) { return finish({ status: 'error', heard: '' }); }
        rec.onstart = function () { hooks.onStart && hooks.onStart(); };
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
          if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
            deniedThisLoad = true;
            return finish({ status: 'denied', heard: '', code: code });
          }
          if (code === 'network') return finish({ status: 'network', heard: '' });
          finish({ status: 'error', heard: '', code: code });
        };
        rec.onend = function () { setTimeout(function () { if (!gotResult) finish({ status: 'nospeech', heard: '' }); }, 250); };
        timer = setTimeout(function () { try { rec.stop(); } catch (e) {} }, 7000);
        try { rec.start(); } catch (e) { finish({ status: 'error', heard: '' }); }
      });
    }
  };

  window.SSAudio = Audio_;
  window.SSSpeech = Speech;
})();
