const CACHE_NAME = 'bfm-v1';
const STATIC_ASSETS = [
  '/BFM/',
  '/BFM/index.html',
  '/BFM/manifest.json',
  '/BFM/css/style.css',
  '/BFM/js/app.js',
  '/BFM/js/api.js',
  '/BFM/js/auth.js',
  '/BFM/js/charts.js',
  '/BFM/icons/icon-192.png',
  '/BFM/icons/icon-512.png'
];

// Install — cache static assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — Network first for API, Cache first for static
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // API calls (Google Apps Script) — network only
  if (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com') {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ success: false, error: 'ออฟไลน์ — ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' }),
          { headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // Static assets — cache first, then network
  e.respondWith(
    caches.match(e.request).then((cached) => {
      return cached || fetch(e.request).then((response) => {
        // Cache new requests dynamically
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      });
    }).catch(() =>
      caches.match('/BFM/index.html')
    )
  );
});
