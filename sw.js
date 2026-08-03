/* Budget 2026 + Nexus service worker
   v2: navigations are NETWORK-FIRST so new uploads show up on next load;
   cache is only the offline fallback. Other GETs stay cache-first. */
const CACHE = 'andre-pages-v2-1';
const SHELL = ['./', './index.html', './nexus.html', './manifest.webmanifest', './icon.svg', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u)))) // a missing file must not block install
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Pages: try the network so updates are seen; fall back to cache offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      }).catch(() =>
        caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))
      )
    );
    return;
  }

  // Everything else: cache-first, with runtime caching of same-origin + the CDN libraries.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        const url = new URL(req.url);
        const cacheable = res.ok && (url.origin === location.origin ||
          url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net' ||
          url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com');
        if (cacheable) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      });
    })
  );
});
