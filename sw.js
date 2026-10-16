/* Offline cache for the SpecSpeak prototype: network first, cache as fallback. */
const CACHE = 'specspeak-v4';
const WORDS = ['acer', 'aspire', 'processor', 'generation', 'ram', 'gigabyte', 'ssd', 'storage', 'display', 'warranty'];
const AUDIO = WORDS.flatMap(w => ['assets/audio/' + w + '.mp3', 'assets/audio/' + w + '-slow.mp3'])
  .concat(['correct', 'wrong', 'complete', 'silence'].map(n => 'assets/audio/' + n + '.mp3'));
const ARCADE = ['arcade/arcade.css', 'arcade/kit.js', 'arcade/content.js', 'arcade/engine.js'].concat(
  ['g18_superlau', 'g19_blockbump', 'g20_lagking', 'g21_specstack', 'g22_laujump', 'g23_echoinvaders'].map(g => 'arcade/games/' + g + '.js'));
const CORE = ['./', 'index.html', 'styles.css', 'chars.js', 'data.js', 'speech.js', 'lms.js', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'assets/video/unit1-poster.jpg'].concat(ARCADE, AUDIO);
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok && new URL(req.url).origin === location.origin) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req)));
});
