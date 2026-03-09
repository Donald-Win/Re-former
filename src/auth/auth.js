/**
 * re-former Auth Module
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles device identity, Cloudflare Worker calls, caching, polling, and
 * event-driven revocation detection.
 *
 * Usage (see AuthGate.jsx for the React integration):
 *   import { getDeviceId, checkAccessOnline, ... } from './auth'
 */

// ── CONFIG ────────────────────────────────────────────────────────────────────
// Replace with your actual Cloudflare Worker URL after deployment.
export const WORKER_URL = 'https://re-former-auth.YOUR_SUBDOMAIN.workers.dev'

// Identifies this app to the Worker. Must match a key in APP_COLUMN_MAP.
export const APP_ID = 'reformer'

const DEVICE_ID_KEY  = 'dcw-device-id'
const AUTH_CACHE_KEY = 're-former-auth-cache'
const POLL_MS        = 45_000   // 45 seconds — ~1,920 req/day per user, well under free 100k limit

// ── DEVICE ID ─────────────────────────────────────────────────────────────────
// Uses crypto.randomUUID() for a truly stable, unpredictable device identity.
// Stored in localStorage so it survives app restarts but is unique per device/browser.
// Format: DCW-XXXX-XXXX-XXXX

function generateDeviceId() {
  const uuid = crypto.randomUUID().replace(/-/g, '').toUpperCase()
  return `DCW-${uuid.slice(0, 4)}-${uuid.slice(4, 8)}-${uuid.slice(8, 12)}`
}

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id || !/^DCW-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(id)) {
    id = generateDeviceId()
    localStorage.setItem(DEVICE_ID_KEY, id)
    console.log('[re-former auth] Generated new device ID:', id)
  }
  return id
}

// ── CACHE ─────────────────────────────────────────────────────────────────────

function cacheResult(result) {
  try {
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
      ...result,
      cachedAt: Date.now(),
    }))
  } catch { /* storage full — not critical */ }
}

export function getCachedResult() {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// ── NETWORK CHECK ─────────────────────────────────────────────────────────────

export async function checkAccessOnline() {
  const deviceId = getDeviceId()
  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, app: APP_ID }),
    // Ensure this is never served from HTTP cache
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Worker responded ${res.status}`)
  const result = await res.json()
  cacheResult(result)
  return result
}

// ── POLLING & EVENT LISTENERS ─────────────────────────────────────────────────
// A single module-level callback is set by AuthGate and shared across
// polling, online events, and visibility events.

let _onRevoked        = null
let _pollTimer        = null
let _listeningOnline  = false
let _listeningVisible = false

export function setRevokedCallback(fn) {
  _onRevoked = fn
}

export function startPolling() {
  stopPolling()
  _pollTimer = setInterval(async () => {
    if (!navigator.onLine || !_onRevoked) return
    try {
      const result = await checkAccessOnline()
      if (!result.allowed) {
        stopPolling()
        _onRevoked(getDeviceId())
      }
    } catch {
      // Network hiccup — don't penalise user, just try next interval
    }
  }, POLL_MS)
}

export function stopPolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer)
    _pollTimer = null
  }
}

/**
 * Re-checks immediately when the browser tab comes back into view.
 * This catches revocations that happened while the tab was backgrounded.
 */
export function addVisibilityListener() {
  if (_listeningVisible) return
  _listeningVisible = true
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return
    if (!navigator.onLine || !_onRevoked) return
    try {
      const result = await checkAccessOnline()
      if (!result.allowed) {
        stopPolling()
        _onRevoked(getDeviceId())
      }
    } catch { /* network error — ignore */ }
  })
}

/**
 * Re-checks immediately when the device regains a network connection.
 * This is how offline→online transitions are handled.
 */
export function addOnlineListener() {
  if (_listeningOnline) return
  _listeningOnline = true
  window.addEventListener('online', async () => {
    if (!_onRevoked) return
    try {
      const result = await checkAccessOnline()
      if (result.allowed) {
        // Still allowed — kick off polling now that we have a connection
        startPolling()
      } else {
        stopPolling()
        _onRevoked(getDeviceId())
      }
    } catch { /* network error — ignore */ }
  })
}

// ── DEBUG HELPERS (available in browser console) ─────────────────────────────

window.__reformerAuth = {
  getDeviceId,
  getCachedResult,
  checkAccessOnline,
  clearCache: () => {
    localStorage.removeItem(AUTH_CACHE_KEY)
    console.log('[re-former auth] Cache cleared. Reload to re-check.')
  },
  resetDeviceId: () => {
    localStorage.removeItem(DEVICE_ID_KEY)
    localStorage.removeItem(AUTH_CACHE_KEY)
    console.log('[re-former auth] Device ID and cache cleared. Reload to generate new ID.')
  },
}
