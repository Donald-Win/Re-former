// re-former Service Worker v2.10.0
const CACHE_VERSION = 're-former-v2.10.1'
const STATIC_CACHE  = CACHE_VERSION + '-static'
const PDF_CACHE     = CACHE_VERSION + '-pdfs'

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== PDF_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // manifest.json — always network-first so Chrome always sees the latest
  // version for PWA installability checks. Fall back to cache if offline.
  if (url.pathname.endsWith('/manifest.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          const clone = response.clone()
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone))
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // PDFs — network-first, fall back to cache when offline
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

  // Everything else — stale-while-revalidate
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

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
  if (event.data === 'CHECK_UPDATE') self.registration.update()
})
