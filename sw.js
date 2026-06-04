/* Pilote Olfacode — Service Worker minimal pour PWA installable */

const CACHE = 'pilote-olfacode-v1';
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
  // Ne JAMAIS cacher les appels API OpenAI (privés, dynamiques)
  if (url.hostname.includes('openai.com')) return;
  // Network-first pour les assets de l'app
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok && e.request.method === 'GET' && url.origin === self.location.origin) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
