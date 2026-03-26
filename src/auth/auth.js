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
export const WORKER_URL = 'https://re-former-auth.donald-c-win-2a0.workers.dev'

// Identifies this app to the Worker. Must match a key in APP_COLUMN_MAP.
export const APP_ID = 'reformer'

const DEVICE_ID_KEY  = 'dcw-device-id'
const AUTH_CACHE_KEY = 're-former-auth-cache'
const POLL_MS        = 300_000  // 5 minutes — ~288 req/day per user
const CHECK_COOLDOWN = 120_000  // 2 minutes — minimum gap between visibility/online checks

let _lastCheckedAt = 0  // timestamp of most recent successful network check

// ── DEVICE ID ─────────────────────────────────────────────────────────────────
// Uses crypto.randomUUID() for a truly stable, unpredictable device identity.
// Stored in localStorage so it survives app restarts but is unique per device/browser.
// Format: DCW-XXXX-XXXX-XXXX

function generateDeviceId() {
  const uuid = (crypto.randomUUID ? crypto.randomUUID() : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16))).replace(/-/g, '').toUpperCase()
  return `DCW-${uuid.slice(0, 4)}-${uuid.slice(4, 8)}-${uuid.slice(8, 12)}`
}

function isValidId(id) {
  return typeof id === 'string' && /^DCW-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(id)
}

// Read device ID from cookie (backup store)
function readIdFromCookie() {
  const match = document.cookie.match(/(?:^|;\s*)dcw-device-id=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

// Write device ID to a 10-year cookie (backup store)
function writeIdToCookie(id) {
  const expires = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `dcw-device-id=${encodeURIComponent(id)};expires=${expires};path=/;SameSite=Strict`
}

export function getDeviceId() {
  // Request persistent storage so Chrome won't evict localStorage under pressure
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist()
  }

  let id = localStorage.getItem(DEVICE_ID_KEY)

  // localStorage was cleared — try restoring from cookie backup
  if (!isValidId(id)) {
    const cookieId = readIdFromCookie()
    if (isValidId(cookieId)) {
      console.log('[re-former auth] Restored device ID from cookie backup')
      id = cookieId
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
  }

  // Still no valid ID — generate a new one
  if (!isValidId(id)) {
    id = generateDeviceId()
    console.log('[re-former auth] Generated new device ID:', id)
  }

  // Always write to both stores
  localStorage.setItem(DEVICE_ID_KEY, id)
  writeIdToCookie(id)

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
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Worker responded ${res.status}`)
  const result = await res.json()
  _lastCheckedAt = Date.now()
  // Cache all results including denied — so offline behaviour is correct.
  // Denied cache is cleared immediately after the lock screen is shown,
  // so it never persists to block a user who has since been granted access.
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
 * A cooldown prevents hammering the API when the user switches apps rapidly.
 */
export function addVisibilityListener() {
  if (_listeningVisible) return
  _listeningVisible = true
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return
    if (!navigator.onLine || !_onRevoked) return
    if (Date.now() - _lastCheckedAt < CHECK_COOLDOWN) return  // checked recently — skip
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
    if (Date.now() - _lastCheckedAt < CHECK_COOLDOWN) return  // checked recently — skip
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
