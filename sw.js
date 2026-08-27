const CACHE_NAME = 'audiencias-shell-v0.9.8';
const APP_SHELL = [
  './',
  './index.html',
  './css/app.css?v=0.9.8',
  './js/config.js?v=0.9.8',
  './js/api.js?v=0.9.8',
  './js/audiencias.js?v=0.9.8',
  './js/destinatarios.js?v=0.9.8',
  './js/documentos.js?v=0.9.8',
  './js/dashboard.js?v=0.9.8',
  './js/auth.js?v=0.9.8',
  './js/session.js?v=0.9.8',
  './manifest.json?v=0.9.8',
  './assets/oficios/brasao-estado-para.png',
  './assets/oficios/brasao-pmpa.png',
  './assets/oficios/brasao-20bpm.png',
  './assets/icons/favicon-32.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
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
