// re-former Service Worker
// Bump CACHE_VERSION whenever deploying a new build.
const CACHE_VERSION = 're-former-v2.6.0'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const PDF_CACHE    = `${CACHE_VERSION}-pdfs`

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
]

// ── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate — purge old caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== PDF_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // PDFs — network-first so technicians always get the latest version,
  // fall back to cache when offline.
  if (/\/forms\/.*\.pdf$/.test(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone()
          caches.open(PDF_CACHE).then(cache => cache.put(event.request, clone))
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Everything else — stale-while-revalidate.
  event.respondWith(
    caches.open(STATIC_CACHE).then(cache =>
      cache.match(event.request).then(cached => {
        const fetched = fetch(event.request).then(response => {
          cache.put(event.request, response.clone())
          return response
        })
        return cached || fetched
      })
    )
  )
})

// ── Messages from app ──────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
  if (event.data === 'CHECK_UPDATE') {
    self.registration.update()
  }
})
