var CACHE_NAME = 'has-field-v1';
var APP_SHELL = ['./', './index.html', './manifest.json'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(function (res) {
        var resClone = res.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(e.request, resClone);
        });
        return res;
      })
      .catch(function () {
        return caches.match(e.request).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
  );
});
