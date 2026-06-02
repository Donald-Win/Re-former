/**
 * re-former Service Worker — Workbox edition
 *
 * This file is a TEMPLATE. vite-plugin-pwa injects the full precache
 * manifest (all hashed JS/CSS/HTML/asset filenames from the Vite build)
 * into self.__WB_MANIFEST at build time.
 *
 * The output sw.js in dist/ is a fully-bundled, single-file script —
 * no ES-module issues at runtime.
 *
 * Update flow (manual, user-controlled):
 *   1. New SW installs → stays in "waiting" state (no auto-skipWaiting)
 *   2. App.jsx detects reg.waiting → shows "Update available" banner
 *   3. User clicks "Update now"
 *   4. App.jsx posts { type: 'SKIP_WAITING' } to reg.waiting
 *   5. SW calls self.skipWaiting() → activates
 *   6. controllerchange fires → main.jsx reloads the page
 */

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { clientsClaim } from 'workbox-core'

// ── Take control of all uncontrolled clients on activation ────────────────────
// (First-visit users get the SW immediately without a second page load.)
clientsClaim()

// ── Precache all Vite build output (hashed JS, CSS, HTML, assets) ─────────────
// self.__WB_MANIFEST is injected by vite-plugin-pwa at build time.
// This is the core fix: every hashed filename is now known to the SW
// and pre-fetched during installation, guaranteeing offline availability.
precacheAndRoute(self.__WB_MANIFEST)

// Remove stale Workbox precache caches from previous builds
cleanupOutdatedCaches()

// ── Clean up old manual caches from the pre-Workbox SW versions ───────────────
// Old caches were named e.g. "re-former-v2.12.1-static", "re-former-v2.12.1-pdfs".
// These will never be cleaned by Workbox, so we do it ourselves on activate.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => /^re-former-v\d/.test(name))
          .map((name) => {
            console.log('[re-former SW] Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    )
  )
})

// ── Runtime: PDFs — stale-while-revalidate ────────────────────────────────────
// CHANGED from NetworkFirst to StaleWhileRevalidate.
//
// WHY: NetworkFirst tries the network before serving from cache. In weak 3G
// areas the network attempt can take several seconds before timing out and
// falling back to the cache — the app appears hung while a PDF is "opening".
//
// StaleWhileRevalidate serves the cached PDF INSTANTLY on every subsequent
// open, then fires a background fetch to refresh the cache entry silently.
// The user gets immediate response; the cache stays fresh for next time.
//
// Trade-off: a field tech who opens a form immediately after a PDF is updated
// server-side will see the old version on that first open, and get the new
// version the next time they open it (once the background refresh completes).
// For Powerco form PDFs — which change infrequently and where responsiveness
// matters more than instant propagation — this is the correct trade-off.
registerRoute(
  ({ url }) => /\/forms\/.*\.pdf$/i.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: 're-former-pdfs',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
)

// ── Runtime: manifest.json — network-first ────────────────────────────────────
// Chrome re-checks the manifest for PWA install eligibility on every visit.
// Network-first guarantees it always sees the freshest version.
// This stays on NetworkFirst intentionally — the manifest is tiny (< 1 KB)
// and incorrect PWA metadata (icon, theme colour) is confusing to users.
registerRoute(
  ({ url }) => url.pathname.endsWith('/manifest.json'),
  new NetworkFirst({ cacheName: 're-former-manifest' })
)

// ── Message handler ────────────────────────────────────────────────────────────
// App.jsx's update banner calls:
//   reg.waiting.postMessage('SKIP_WAITING')       → triggers update
//   reg.waiting.postMessage('CHECK_UPDATE')       → triggers registration.update()
self.addEventListener('message', (event) => {
  const msg = event.data?.type ?? event.data
  if (msg === 'SKIP_WAITING') self.skipWaiting()
  if (msg === 'CHECK_UPDATE') self.registration.update()
})
