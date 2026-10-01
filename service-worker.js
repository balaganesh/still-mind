const CACHE = 'still-mind-v9';
const ASSETS = [
  '/', '/index.html', '/styles.css?v=9', '/app.js?v=9', '/manifest.webmanifest',
  '/public/audio/flowing-water.mp3', '/public/icons/favicon.svg',
  '/public/icons/still-mind-180.png', '/public/icons/still-mind-192.png', '/public/icons/still-mind-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  })).catch(() => caches.match('/index.html')));
});
