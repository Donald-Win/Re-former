// ⬆️ Bump this version string on every deployment to force cache refresh
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `re-former-${CACHE_VERSION}`;

// App shell — Vite assets use content hashes so they auto-bust cache
const APP_SHELL = [
  '/re-former/',
  '/re-former/index.html',
  '/re-former/manifest.json',
];

// Always fetch PDFs fresh from network (network-first)
const FORMS_PATTERN = /\/forms\/.*\.pdf$/;

// Install — cache app shell, activate immediately
self.addEventListener('install', event => {
  console.log('[SW] Installing:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate — delete old caches, take control immediately
self.addEventListener('activate', event => {
  console.log('[SW] Activating:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(n => n.startsWith('re-former-') && n !== CACHE_NAME)
          .map(n => { console.log('[SW] Deleting old cache:', n); return caches.delete(n); })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Don't intercept CDN requests (pdf.js worker etc.)
  if (!request.url.startsWith(self.location.origin)) return;

  // Network-first for PDF forms — always serve latest
  if (FORMS_PATTERN.test(request.url)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Stale-while-revalidate for everything else —
  // return cache immediately for speed, fetch fresh copy in background
  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {});

      return cached || networkFetch;
    })
  );
});

// Message handler — lets the app trigger updates programmatically
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING');
    self.skipWaiting();
  }
  if (event.data?.type === 'CHECK_UPDATE') {
    console.log('[SW] Checking for updates...');
    self.registration.update();
  }
});
