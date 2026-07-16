// FoHS FIELD SYSTEM - Service Worker
//
// What this does:
// - Caches ONLY same-origin GET requests (the app shell itself: index.html, manifest.json,
//   and anything else served from this same site).
// - NEVER intercepts POST, PUT, PATCH, or DELETE requests, and NEVER caches cross-origin
//   requests (Appwrite API calls, CDN scripts, fonts, etc). Those always go straight to
//   the network. This guarantees it can never break or serve stale data for any Appwrite
//   call (login, createDocument, updateDocument, deleteDocument, listDocuments, etc).
// - Uses a "stale-while-revalidate" strategy for the cached files: it answers instantly
//   from cache when available (fast + works offline), while quietly refreshing the cache
//   in the background whenever the network is reachable.

var CACHE_NAME = 'fohs-field-system-v1';
var PRECACHE_URLS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS).catch(function () {
        // If one of these isn't reachable at install time, don't fail the whole install.
      });
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;

  // Only ever handle GET requests. Everything else (POST/PUT/PATCH/DELETE) is left
  // completely alone so it always goes straight to the network untouched.
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Only handle requests to this site's own origin. Appwrite API calls and any other
  // cross-origin requests (CDN libraries, fonts, storage files, etc) are intentionally
  // left alone and always fetched fresh from the network.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(req).then(function (cached) {
        var networkFetch = fetch(req)
          .then(function (networkRes) {
            if (networkRes && networkRes.status === 200) {
              cache.put(req, networkRes.clone());
            }
            return networkRes;
          })
          .catch(function () {
            return cached;
          });
        return cached || networkFetch;
      });
    })
  );
});
