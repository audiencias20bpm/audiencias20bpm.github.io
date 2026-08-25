const CACHE_NAME = 'audiencias-shell-v0.2.1';
const APP_SHELL = [
  './',
  './index.html',
  './css/app.css?v=0.2.1',
  './js/config.js?v=0.2.1',
  './js/api.js?v=0.2.1',
  './js/auth.js?v=0.2.1',
  './js/session.js?v=0.2.1',
  './manifest.json'
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) {
          return key !== CACHE_NAME;
        }).map(function (key) {
          return caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then(function (response) {
        return response;
      })
      .catch(function () {
        return caches.match(event.request);
      })
  );
});
