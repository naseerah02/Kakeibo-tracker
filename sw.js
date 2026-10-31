/* Service worker (Android): keeps the app available offline and sends waiting entries in the background.
   Bump CACHE whenever you change any app file so phones pick up the new version. */
importScripts('core.js');

const CACHE = 'expense-app-v6';
const SHELL = ['./', './index.html', './core.js', './app.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

// Page loads: try the network for up to 3 seconds (so updates arrive), otherwise use the saved copy.
function pageNetworkFirst(req) {
  return new Promise(function (resolve) {
    var done = false;
    var timer = setTimeout(function () {
      caches.match('./index.html').then(function (hit) { if (hit && !done) { done = true; resolve(hit); } });
    }, 3000);
    fetch(req).then(function (res) {
      clearTimeout(timer);
      if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put('./index.html', copy); }); }
      if (!done) { done = true; resolve(res); }
    }).catch(function () {
      clearTimeout(timer);
      caches.match('./index.html').then(function (hit) { if (!done) { done = true; resolve(hit || Response.error()); } });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  var url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;   // never touch calls to Google
  if (req.mode === 'navigate') { e.respondWith(pageNetworkFirst(req)); return; }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    })
  );
});

// Android Chrome wakes this up when the connection returns, even if the app is closed.
self.addEventListener('sync', function (e) {
  if (e.tag !== 'sync-expenses') return;
  e.waitUntil(Core.syncQueue().then(function (r) { if (r.retry) throw new Error('retry later'); }));   // throwing asks Chrome to try again (not when the phone must sign in again: that needs the app)
});
