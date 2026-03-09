/**
 * AuthGate — wraps the entire app and controls access.
 *
 * Drop into App.jsx:
 *   import { AuthGate } from './auth/AuthGate'
 *   // then wrap your return:
 *   return <AuthGate> ... rest of app JSX ... </AuthGate>
 */

import React, { useState, useEffect } from 'react'
import {
  getDeviceId,
  getCachedResult,
  checkAccessOnline,
  setRevokedCallback,
  startPolling,
  stopPolling,
  addVisibilityListener,
  addOnlineListener,
} from './auth'

// ── LOCK SCREEN ───────────────────────────────────────────────────────────────

function LockScreen({ deviceId }) {
  const subject = encodeURIComponent('re-former Access Request')
  const body = encodeURIComponent(
    `Hi Donald,\n\nPlease grant me access to re-former.\n\nMy Device ID is: ${deviceId}\n\nThanks.`
  )
  const mailtoHref = `mailto:donald.c.win@gmail.com?subject=${subject}&body=${body}`

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      boxSizing: 'border-box',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 24,
        padding: '2.5rem 2rem',
        maxWidth: 420,
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🔐</div>

        <h1 style={{
          fontSize: '1.6rem', fontWeight: 900, color: '#111827',
          margin: '0 0 0.75rem',
        }}>
          Access Restricted
        </h1>

        <p style={{
          color: '#6b7280', lineHeight: 1.6,
          margin: '0 0 1.75rem', fontSize: '0.95rem',
        }}>
          Your device isn't authorised to use re&#8209;former.
          Send your Device ID to Donald to request access.
        </p>

        {/* Device ID display */}
        <div style={{
          background: '#f3f4f6', borderRadius: 14,
          padding: '1.25rem', marginBottom: '1.5rem',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 8,
          }}>
            Your Device ID
          </div>
          <div style={{
            fontSize: '1.3rem', fontWeight: 900, fontFamily: 'monospace',
            letterSpacing: '0.08em', color: '#111827',
            background: 'white', borderRadius: 10, padding: '0.75rem',
            border: '2px solid #e5e7eb',
            // Allow user to tap-to-select and copy
            userSelect: 'all', WebkitUserSelect: 'all', cursor: 'text',
          }}>
            {deviceId}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
            Tap the ID above to select it, then copy
          </div>
        </div>

        {/* Email button */}
        <a
          href={mailtoHref}
          style={{
            display: 'block', background: '#4f46e5', color: 'white',
            textDecoration: 'none', borderRadius: 12,
            padding: '0.875rem 1rem', fontWeight: 700, fontSize: '0.95rem',
            marginBottom: '0.75rem', boxSizing: 'border-box',
          }}
        >
          ✉️ Email Access Request
        </a>

        {/* Retry button */}
        <button
          onClick={() => window.location.reload()}
          style={{
            width: '100%', background: 'transparent',
            border: '2px solid #e5e7eb', borderRadius: 12,
            padding: '0.75rem', color: '#6b7280',
            fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem',
            boxSizing: 'border-box',
          }}
        >
          Check Again
        </button>
      </div>
    </div>
  )
}

// ── LOADING SCREEN ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#f4f4f8',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{ textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Checking access…</div>
      </div>
    </div>
  )
}

// ── AUTH GATE ─────────────────────────────────────────────────────────────────

export function AuthGate({ children }) {
  // 'loading' → checking
  // 'allowed' → show app
  // 'denied'  → show lock screen
  const [status, setStatus]   = useState('loading')
  const [deviceId, setDeviceId] = useState('')

  useEffect(() => {
    const id = getDeviceId()
    setDeviceId(id)

    // Callback that polling/event listeners call when access is revoked
    const handleRevoked = (revokedId) => {
      console.warn('[re-former auth] Access revoked — showing lock screen')
      setDeviceId(revokedId)
      setStatus('denied')
    }

    setRevokedCallback(handleRevoked)

    // Always register listeners — they'll fire at the right time
    addVisibilityListener()
    addOnlineListener()

    // ── Check logic ─────────────────────────────────────────────────────────

    const cached = getCachedResult()

    if (navigator.onLine) {
      // Online: show cached result immediately (only if allowed) to avoid
      // a flash of the loading screen on repeat visits, then always
      // verify fresh. Denied is never cached so can never block a legitimate user.
      if (cached !== null) {
        setStatus(cached.allowed ? 'allowed' : 'denied')
        if (cached.allowed) startPolling()
      }

      // Live check — always runs regardless of cache
      checkAccessOnline()
        .then(result => {
          setStatus(result.allowed ? 'allowed' : 'denied')
          if (result.allowed) {
            startPolling()
          } else {
            stopPolling()
          }
        })
        .catch(() => {
          // Network error — trust cache if available, else fail open
          if (cached !== null) {
            setStatus(cached.allowed ? 'allowed' : 'denied')
            if (cached.allowed) startPolling()
          } else {
            console.warn('[re-former auth] No cache and network failed — failing open')
            setStatus('allowed')
          }
        })
        .catch(() => {
          // Network error — keep allowed if already shown from cache, else fail open
          if (cached === null || !cached.allowed) {
            console.warn('[re-former auth] No valid cache and network failed — failing open')
            setStatus('allowed')
          }
        })
        .catch(() => {
          // Network error during check — trust cache if available, else fail open
          if (cached !== null) {
            setStatus(cached.allowed ? 'allowed' : 'denied')
            if (cached.allowed) startPolling()
          } else {
            console.warn('[re-former auth] No cache and network failed — failing open')
            setStatus('allowed')
          }
        })
    } else {
      // Offline: use cached result only
      if (cached !== null) {
        console.log('[re-former auth] Offline — using cached result:', cached.allowed ? 'allowed' : 'denied')
        setStatus(cached.allowed ? 'allowed' : 'denied')
      } else {
        // No cache at all (fresh install with no connection) — fail open
        console.warn('[re-former auth] Offline with no cache — failing open')
        setStatus('allowed')
      }
      // addOnlineListener() above will re-check as soon as connectivity returns
    }

    return () => {
      // Clean up polling when component unmounts (shouldn't normally happen in a PWA
      // since AuthGate wraps the whole app, but good practice)
      stopPolling()
    }
  }, [])

  if (status === 'loading') return <LoadingScreen />
  if (status === 'denied')  return <LockScreen deviceId={deviceId} />
  return children
}
