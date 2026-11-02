const CACHE = 'ashare-v2';
const ASSETS = ['./index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).catch(function () {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  // 行情数据接口（腾讯/新浪）始终走网络，不缓存——保证实时行情新鲜
  if (/finance\.qq\.com|gtimg\.cn|sina\.com\.cn/.test(u.hostname)) return;
  // 本应用的自有 API（持久化键值存储等）一律走网络，禁止缓存，保证读写最新
  if (u.pathname.indexOf('/api/') === 0) return;
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (r) {
      if (r) return r;
      return fetch(e.request).then(function (resp) {
        if (resp && resp.status === 200 && (resp.type === 'basic' || resp.type === 'opaque')) {
          var cp = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, cp); });
          return resp;
        }
        return resp;
      }).catch(function () { return r; });
    })
  );
});
