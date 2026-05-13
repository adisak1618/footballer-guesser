// Minimal cache-first service worker for the iOS audio spike.
// The point is to test whether SW activation kills in-flight audio playback,
// not to be a production-grade SW. Pre-caches the 5 cue MP3s.

const CACHE = 'audio-spike-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/cues/cue1-game-start.mp3',
  '/cues/cue2-role-reveal.mp3',
  '/cues/cue3-wolves-wake.mp3',
  '/cues/cue4-dawn-death.mp3',
  '/cues/cue5-vote-open.mp3',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
