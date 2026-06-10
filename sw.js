/* Pilote Olfacode — Service Worker minimal pour PWA installable */

const CACHE = 'pilote-olfacode-v5';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).catch(err => console.warn('SW cache partial', err)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // On n'intercepte QUE les GET de MÊME ORIGINE (les assets de l'app).
  // Les requêtes API (POST) et tout ce qui est cross-origin (backend Render,
  // OpenAI, etc.) passent DIRECTEMENT au réseau — sinon le SW peut avorter
  // un POST cross-origin (ex : l'audio TTS) → "operation aborted".
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Network-first pour les assets de l'app, repli sur le cache hors-ligne.
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
