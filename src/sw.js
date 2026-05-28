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
import { NetworkFirst } from 'workbox-strategies'
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

// ── Runtime: PDFs — network-first, fall back to cache when offline ────────────
// PDFs are excluded from precaching (too large to bulk-download on install).
// They're cached individually the first time each is opened.
registerRoute(
  ({ url }) => /\/forms\/.*\.pdf$/i.test(url.pathname),
  new NetworkFirst({
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
