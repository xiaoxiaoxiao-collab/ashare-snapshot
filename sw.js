/* 五维共振 · Service Worker
   关键修复：index.html / sw.js / stocks.js 改为「网络优先」，
   确保部署新版本后浏览器永远拉取服务端最新文件，不再被旧缓存卡住。
   缓存名升级到 v3：激活时删除所有旧缓存（含 v2 中那份旧 index.html）。 */
const CACHE = 'ashare-v3';
const CORE = ['./manifest.json', './icon.svg', './icon-192.png', './icon-512.png'];
// 这些文件「网络优先」：先请求服务端，失败才退回缓存，避免版本僵死
const NETWORK_FIRST = ['/index.html', '/sw.js', '/stocks.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).catch(function () {})
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
  var nf = NETWORK_FIRST.some(function (p) { return u.pathname === p || u.pathname.endsWith(p); });
  if (nf) {
    // 网络优先：拿到最新即更新缓存，断网才退回旧缓存
    e.respondWith(
      fetch(e.request).then(function (resp) {
        if (resp && resp.status === 200 && (resp.type === 'basic' || resp.type === 'opaque')) {
          var cp = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, cp); });
        }
        return resp;
      }).catch(function () { return caches.match(e.request).then(function (r) { return r || fetch(e.request); }); })
    );
  } else {
    // 其余静态资源：缓存优先（图标等不变更，省流量）
    e.respondWith(
      caches.match(e.request).then(function (r) {
        if (r) return r;
        return fetch(e.request).then(function (resp) {
          if (resp && resp.status === 200 && (resp.type === 'basic' || resp.type === 'opaque')) {
            var cp = resp.clone();
            caches.open(CACHE).then(function (c) { c.put(e.request, cp); });
          }
          return resp;
        }).catch(function () { return r; });
      })
    );
  }
});
