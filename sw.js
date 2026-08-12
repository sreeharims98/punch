const CACHE = 'punch-v2';
const FILES = ['.', 'index.html', 'punch.js', 'manifest.webmanifest', 'icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
});

// Cache first: offline is the only job, and the files only change when I redeploy
// (bump CACHE to ship an update).
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((hit) => hit ?? fetch(e.request)));
});
