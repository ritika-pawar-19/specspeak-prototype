# SpecSpeak prototype

A Duolingo-style training game for Acer APCs. Unit 1 ("The basics") is fully playable:
Read (10 TrainGram cards) → Watch (training video with two quick checks) → Meet → Match → Use → Say-it checkpoint → Badge.

It is a plain static site: no build step, no server code. Open `index.html` over **https** (or `localhost`).

## Phones
- **Android:** Chrome. **iPhone:** Safari (iOS 15+). Add to Home Screen works on both.
- The say-it check uses the browser's own speech recognition (Indian English). It needs https, the microphone permission, and mobile data.
  On iPhone, Siri & Dictation must be on (Settings › General › Keyboard › Enable Dictation).
- Where speech recognition isn't available, the app switches to **trainer check**: a trainer listens and marks the word.

## Files
- `app.js` screens and game engine · `speech.js` audio + speech check · `data.js` all content (words, cards, lessons, quiz times)
- `chars.js` characters (generated from `../chars.py` by `../gen_chars_js.py`) · `assets/` word audio, UI sounds, Unit 1 video
- `artifact.html` the same app as a claude.ai page (no microphone there, so it uses trainer check)

Progress is saved in the phone's browser (localStorage) only.
