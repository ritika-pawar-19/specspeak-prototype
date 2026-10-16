# Play & Learn: the game API

Six mini games for SpecSpeak Unit 1. The spec is `../../arcade-dev/SPEC.md`. **Read it first**, then this file.
`games/g18_superlau.js` is the reference game: copy its structure.

```
arcade/kit.js        window.PX   pixel kit + runtime canvas (sprites, G drawing API)
arcade/content.js    ARC.bank    the vetted Unit 1 content bank (the ONLY facts a game may use)
arcade/engine.js     window.ARC  hub, intro, game screen, loop, input, HUD, Say-it, end card, SFX, rewards, debug
arcade/arcade.css                pill, Practice card, hub, sheets, Say-it card, end card
arcade/games/<id>_<name>.js      one file per game: ARC.registerGame({...})
```
Script order (index.html and artifact.html): kit, content, engine, games, then app.js. All six games are built and
loaded. A game whose file registers nothing shows **Coming soon** in the hub. Nothing else needs wiring: index.html,
artifact.html and sw.js list every arcade file, and scorm/build_scorm.py packages every .js/.css under arcade/.

## Units and layout
- **game px** (`gx, gy`): the pixel grid. World width is always `G.W = 130`; height `G.H` varies by phone (about 260
  to 300). **Lay everything out from the edges**, never a fixed 281: e.g. ground `gY = Math.floor(G.H - 31 - G.bot / 3)`.
- **sp** (screen px): `3 sp = 1 game px`, the screen is `390` sp wide and `G.SH` tall. Text, cards, pills and choice
  rects use sp. These are the same numbers the videos used, so video drawing code ports as is.
- `G.top` / `G.bot`: safe-area insets (notch, home bar) in sp. `R.layout.hudY`: the HUD row centre (sp). Keep game
  text below `hudY + 26`. `R.layout.jump`: `{x, y, r}` of the JUMP button (sp; default bottom-right).
- Text minimum 15 sp; every label must fit inside 390 sp (use `G.wrap`). No exclamation marks in on-screen copy.

## registerGame(def)
| field | meaning |
|---|---|
| `id` | `'g19'` … must match the hub list (`g18`..`g23`) |
| `name`, `sub` | defaults from the hub list (neutral subtitles only: `Block bumper`, `Boss fight`, …) |
| `rules` | **3** one-line rules for the intro sheet |
| `lives` | hearts (default 3). Echo Invaders: 3 shields |
| `lifeIcon(full)` | optional sprite for a life (default `PX.heart`); e.g. a shield sprite |
| `controls` | `{ jump: true }` draws the JUMP button and routes taps on it to `jump`; `{ hold: true }` makes the left/right half of the screen hold controls (`R.input.left/right`, `hold(R, dir, on)`); add `tapToo: true` to also get `tap` |
| `jumpPos(R, G)` | optional `{x, y, r}` for the JUMP button; `jumpText`, `jumpAlpha` (number or `fn(R)`) |
| `icon()`, `iconScale` | hub/intro/end-card sprite and its CSS scale (defaults exist for all six) |
| `label` | HUD pill text (default `"19 · Block Bump"`, auto-shrinks); `hudLabel: false` hides it; `hud: false` hides the whole HUD |
| `scoreLabel` | word under the score on the end card (`sparks`, `floors`, …). Score = `R.score` or, if 0, `R.sparks` |
| `minRight` | right answers a run that reaches its end needs to pay the daily +10 XP (default 3; see Rewards). `R.end({minRight})` overrides it per run |
| `init(R)` | start a run: set up `R.s` (free state bag). Called on every Play / Play again |
| `update(R, dt)` | fixed step, `dt = 1/60` s (times the debug speed). Not called while frozen / paused / hidden |
| `draw(R, G)` | render the whole frame (call `G.clear` first). Called every animation frame while running |
| `drawTop(R, G)` | optional, drawn after the HUD and JUMP button (hints, iris) |
| `tap(R, q)` | `q = {x, y}` in sp and `{gx, gy}` in game px |
| `jump(R)` | JUMP button, Space / ArrowUp / Enter. The engine lights the button (`R.jumpT`) |
| `hold(R, dir, on, q)` | `dir` `'left'`/`'right'`; also ArrowLeft/ArrowRight |
| `key(R, key)` | any other key |
| `info(R)` | **required for tests**, see Debug |
| `finish(R)` | what `ARC.debug.finish()` does (default `R.end({reason:'done'})`) |
| `destroy(R)` | optional cleanup when the run is torn down |

## Lifecycle
Hub tile → intro sheet → `ARC.open(id)` mounts the game screen (canvas + DOM quit × and pause) → `init` →
loop (`requestAnimationFrame`, fixed 1/60 s steps; frozen while a sheet is open, the tab is hidden, or paused) →
the game calls `R.end({...})` → the world keeps moving `delay` s (default 0.6) → end card → **Play again** (`ARC.open`)
or **Back to games** (`ARC.menu`). Quit × / phone Back ask first (`host.confirm`); quitting saves nothing from the run
(Say-it passes already counted stay). Quitting while the Say-it card is open closes it and resolves its promise
with `{passed: false, method: 'none'}` (check `R.dead`). Hiding the tab opens the pause sheet. A touch that starts on
the canvas never becomes a click, and card buttons ignore clicks while a finger is still down on the canvas.

Use game time `R.t` for every animation (`R.t - eventT` with `ARC.U.p / E / k / jiggle`), never `Date.now()`.
`R.after(sec, fn)` schedules in game time (it waits while frozen). Check `R.dead` after any `await`/`then`.

## Run API (`R`)
| | |
|---|---|
| `R.t`, `R.G`, `R.s`, `R.phase` | game time (s), canvas API, your state, a phase string for tests |
| `R.hearts`, `R.lives`, `R.sparks`, `R.right`, `R.wrong`, `R.score`, `R.missed` | run counters |
| `R.good(slug, {sparks = 1, from: [sx, sy]})` | a right answer: `right++`, sparks fly from `from` to the HUD counter |
| `R.bad(slug, rightText)` | a wrong answer: `wrong++`, adds to the end card's **To remember** list (`word: rightText`) |
| `R.miss(slug, rightText)` | adds to To remember without counting wrong (a skipped word) |
| `R.addSparks(n, sx, sy)` | bonus sparks (also animated) |
| `R.loseHeart()` → hearts left, `R.gainHeart()` | lives (the HUD pops the lost one). At 0 call `R.end({reason:'out'})` |
| `R.end({reason, title, score, scoreLabel, delay, minRight, icon, iconScale})` | `reason`: `'done'` / `'out'` / `'time'`; rewards are paid here. `icon` (sprite or function) and `iconScale` replace the end card's art for this run only |
| `R.say({slug, title, sub, tip, retry})` → Promise | the shared Say-it checkpoint (below). The game is frozen while it is open. `retry: true` = a word the game brought back: never a first try (+2 XP) |
| `R.best` | the best score before this run (`null` on a first run) |
| `R.redraw()` (or `R.dirty = true`) | render one frame while the loop is paused, e.g. to move the world behind an open Say-it card |
| `R.word(slug, slow)` | the model voice (`SSAudio.word`). **Every right answer plays the word once** |
| `R.sfx(name)` | chiptune: `jump land coin right powerup shrink wrong hurt bump pop stomp fireball hit boom cage flag win pause unpause mic clear tap whoosh crack spring step beam` (silent when the app is muted) |
| `R.burst(gx, gy, n, cols)`, `R.float(str, sx, sy, col)`, `R.flash(a)` | engine effects (drawn after `draw`) |
| `R.shake(amp)` + `R.shakeX()` | translate your world by `R.shakeX()` sp (0 under reduced motion) |
| `R.announce(text)` | screen-reader live region |
| `ARC.reduceMotion` | `prefers-reduced-motion` at load: skip flashes, speed lines, camera dips and bobs when true |

## Say-it checkpoint: `R.say({slug, title, sub, tip})`
Resolves `{passed, method: 'mic' | 'trainer' | 'tap', firstTry, heard}`. Matches the app's Say-it lesson:
auto mode = mic (2 tries; no-speech / busy / network errors don't use a try; a blocked mic switches this sheet to
trainer check), trainer mode = `Try again` / `Clear` buttons, and a `Can't use the mic? Tap check` link (hear the
model, tap the right written say-guide from `ARC.bank.SAYALT`). The engine does the bookkeeping: a mic or trainer pass
calls `host.markSaid` (counts for the unit's Say-it gate) and pays +3 XP first try / +2 second try (inside the daily
cap); a tap pass pays nothing and ticks no gate. **Your game only adds its own reward** (sparks, Fire Lau, a fireball;
a weaker one for `method === 'tap'`). `tip` defaults to `ARC.bank.TIPS[slug]`.

## Rewards (engine, same for all six; nothing to do in the game)
At `R.end`: sparks added to `st.arcade.sp`, best score in `st.arcade.b[id]` (only a score above 0: never "Best 0");
+10 XP for the first **finished** run of each game per day; Play & Learn XP capped at 40 a day; a finished run with
5+ right answers calls `touchStreak()`. A run is **finished** when it has at least as many right answers as wrong ones
**and** either reached its end (`reason` `'done'`/`'time'`) with at least `minRight` right (default 3), or lasted to 5
right before the hearts ran out (`'out'`). So doing nothing, or tapping at random, never pays; the end card tells the
player what was missing. "New best" shows on a first run only if it counted. State is tiny (`st.arcade`, saved with
`save(true)`; SCORM suspend_data is 4096 chars for the whole state). Never store per-run data in `st`.

## Content (`ARC.bank`)
`WORDS`, `MEAN` (short meanings), `DECOY[slug]` (2 safe decoys), `NEEDS[slug]` (3 customer needs with decoys),
`NITRO` (`{v, bin, fix}`, the only spec values), `SYLL` (Lag King coins), `TIPS`, `SAYALT`, `CONFUSE`, and helpers
`word(slug)` (data.js word: `word, say, hi, mean, accept`), `label(slug)`, `fix(slug)`, `hear(slug)`, `ok(right, decoys)`.
Use only these. If you need a new combination, check it with `ok()`; never put a banned pair on screen.
Give choices random colours/positions so the colour never gives the answer away.

## Drawing (`G`, see the header of kit.js)
`G.clear, spr, sprS, drawSq, rect, text, pill, box, dim, tiles, wrap, sign, badge, popText, wordCard, iris, puff,
toClient`. Sprites: `PX.lau({h, form:'small'|'super'|'fire', frame, run, look, mood, blink})`, `rami/chip/pixi/bolo`,
`customer`, `bug`, `king`, `ground/soil/brick/stone`, `qblock`, `coin`, `mushroom`, `cloud`, `heart`, `ember`, `ring`,
`fireball`, `cage`, `flag`, `torch`, `disc`, `PX.icon.stack/plank/invader`. Build your own with `PX.make / grid /
outline` and **pass a cache key** (or cache in your file). No canvases created per frame; keep caches bounded.
Palette: `PX.C`. Port art and drawing code from the video scene files freely; original art only.

## Debug hooks and testing
`ARC.debug.info()` → `{screen: 'hub'|'intro'|'play'|'say'|'pause'|'confirm'|'end', game, phase, t, score, hearts,
sparks, right, wrong, missed, result, jump: {cx, cy, r}, say: {slug, mode, tries}, world, choices: [...], ...}`.
Your `info(R)` returns extra fields plus `choices: [{label, right, x, y, w, h (sp), ...}]`; the engine adds `rect`,
`cx`, `cy` in CSS px so a test can `ph.tap(c.cx, c.cy)`. Also `ARC.debug.speed(x)` (time scale), `finish()`,
`advance(sec)` (step synchronously), `state()` (st.arcade), `rect(selector)`.

Test with `../../arcade-dev/drive.py` (headless phone). Force trainer mode with
`Phone(extra_storage={'specspeak.trainer': '1'})` (headless Chrome otherwise blocks the mic, which also drops into
trainer check). Open `index.html?arcade=g19` to start a game directly (`?arcade=hub` for the hub).
```python
from drive import Phone
ph = Phone(state=STATE, extra_storage={'specspeak.trainer': '1'})
ph.open('index.html?arcade=g18'); ph.eval("ARC.debug.speed(2)")
i = ph.eval("ARC.debug.info()")                      # wait for a choice you want, then tap it / tap JUMP
ph.tap(i['jump']['cx'], i['jump']['cy'])
# Say-it: wait for info().screen == 'say', then tap '[data-arc-ty]' (Clear) or '[data-arc-tn]' (Try again)
# end card: '[data-arc-again]' / '[data-arc-games]'; state: JSON.parse(localStorage['specspeak.v1']).arcade
ph.shot('/tmp/x.png'); print(ph.console())           # LOOK at screenshots; console must be empty
```
Check every game at 390x844, 360x740 and 430x932, right and wrong answers, a Say-it checkpoint, a finished run, the
end card, persisted state, and that home / lessons / logout still work.
DOM hooks: `[data-arc-pill]`, `[data-arc-pillx]`, `[data-arc-card]`, `[data-arc-tile="g18"]`, `[data-arc-play]`,
`[data-arc-back]`, `[data-arc-quit]`, `[data-arc-pause]`, `[data-arc-resume]`, `[data-arc-mic]`, `[data-arc-hear]`,
`[data-arc-slow]`, `[data-arc-tapcheck]`, `[data-arc-say="..."]`, `[data-arc-cont]`.
