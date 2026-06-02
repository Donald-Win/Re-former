/**
 * GpsLocationButton
 *
 * A single button that:
 *  1. Calls navigator.geolocation.getCurrentPosition
 *  2. Reverse-geocodes the result via OpenStreetMap Nominatim
 *  3. Calls onLocation({ streetRoad, cityTown, district }) with the result
 *
 * Shows inline loading and error states. Does nothing silently on AbortError.
 *
 * Rate-limit protection
 * ─────────────────────
 * Nominatim's usage policy bans IPs that send more than ~1 request/second.
 * On a failed request a user might rapidly re-tap the button, firing
 * multiple reverse-geocode requests in quick succession and triggering a
 * temporary HTTP 429 ban.
 *
 * A strict 2-second cooldown is applied after ANY error (geolocation or
 * network). During the cooldown the button is disabled and shows a
 * "Please wait…" label. The error message remains visible below.
 *
 * Props:
 *   onLocation(fields)  — called with { streetRoad, cityTown, district }
 *   accent              — hex colour for the button border/text
 */
import { useState, useRef, useEffect } from 'react'

const COOLDOWN_MS = 2000

export function GpsLocationButton({ onLocation, accent = '#6366f1' }) {
  const [status,     setStatus]     = useState('idle') // 'idle' | 'locating' | 'geocoding' | 'error'
  const [errorMsg,   setErrorMsg]   = useState('')
  const [isCooldown, setIsCooldown] = useState(false)

  // Holds the cooldown timer so we can clear it on unmount
  const cooldownRef = useRef(null)

  // Clear any pending cooldown when the component unmounts so we never call
  // setIsCooldown on an unmounted component (avoids a React state update warning)
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearTimeout(cooldownRef.current)
    }
  }, [])

  /**
   * Transition into the error state and start the 2-second cooldown.
   * Clears any existing cooldown first (defensive — shouldn't be running,
   * but safe if handlePress is somehow called while a cooldown is active).
   */
  const enterError = (msg) => {
    setStatus('error')
    setErrorMsg(msg)

    if (cooldownRef.current) clearTimeout(cooldownRef.current)

    setIsCooldown(true)
    cooldownRef.current = setTimeout(() => {
      setIsCooldown(false)
      cooldownRef.current = null
    }, COOLDOWN_MS)
  }

  const handlePress = () => {
    // Double-guard: the button is visually disabled during loading and
    // cooldown, but explicit checks here prevent any edge-case double-tap.
    if (loading || isCooldown) return

    if (!navigator.geolocation) {
      enterError('Geolocation is not supported by this browser.')
      return
    }

    setStatus('locating')
    setErrorMsg('')

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setStatus('geocoding')
        const { latitude, longitude } = pos.coords
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          )
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          const a = data.address || {}

          // Build street: "12 Example Road" or just "Example Road"
          const streetParts = [a.house_number, a.road || a.pedestrian || a.footway].filter(Boolean)
          const streetRoad  = streetParts.join(' ')

          // City/town: prefer city, fall back through smaller place types
          const cityTown = a.city || a.town || a.village || a.hamlet || a.suburb || ''

          // District: use NZ regional council (state), strip " Region" suffix
          const district = (a.state || a.county || a.state_district || '').replace(/ Region$/i, '')

          onLocation({ streetRoad, cityTown, district })
          setStatus('idle')
        } catch (err) {
          console.error('GpsLocationButton: reverse geocode failed', err)
          // Network / Nominatim error — apply cooldown to avoid 429 on rapid retry
          enterError('Could not look up address. Check your internet connection.')
        }
      },
      (err) => {
        // Geolocation errors do not hit Nominatim, but we still apply the
        // cooldown for consistency — it prevents UI flicker from rapid taps
        // and covers the edge case where the user hammers retry on a timeout.
        if (err.code === err.PERMISSION_DENIED) {
          const isInsecure = location.protocol !== 'https:' && location.hostname !== 'localhost'
          if (isInsecure) {
            enterError('GPS is only available on the deployed app (HTTPS). It will not work on the local dev server.')
            return
          }
          const isIOS        = /iphone|ipad|ipod/i.test(navigator.userAgent)
          const isStandalone = window.matchMedia('(display-mode: standalone)').matches
          let msg
          if (isIOS) {
            msg = 'Location denied. Go to Settings → Safari → Location → Allow.'
          } else if (isStandalone) {
            msg = 'Location was previously blocked. Go to Android Settings → Apps → Chrome → Permissions → Location → Allow.'
          } else {
            msg = 'Location was previously blocked. In Chrome, tap ⋮ (menu) → Settings → Site settings → Location → find this site and allow it.'
          }
          enterError(msg)
        } else if (err.code === err.TIMEOUT) {
          enterError('Location timed out. Try again outdoors with a clear sky view.')
        } else {
          enterError('Could not get location. Try again.')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const loading  = status === 'locating' || status === 'geocoding'
  const disabled = loading || isCooldown

  const label = status === 'locating'  ? '📡 Getting location…'
              : status === 'geocoding' ? '🗺 Looking up address…'
              : isCooldown             ? '⏳ Please wait…'
              : '📍 Use my location'

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        type="button"
        onClick={handlePress}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '10px 0',
          borderRadius: 8,
          border: `2px dashed ${accent}`,
          background: disabled ? '#f5f5ff' : '#eef2ff',
          color: disabled ? '#9ca3af' : accent,
          fontWeight: 700,
          fontSize: 14,
          cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'inherit',
          transition: 'opacity 0.15s',
        }}
      >
        {label}
      </button>
      {status === 'error' && (
        <div style={{
          marginTop: 6,
          padding: '8px 12px',
          background: '#fff1f2',
          border: '1px solid #fecaca',
          borderRadius: 6,
          fontSize: 12,
          color: '#dc2626',
        }}>
          {errorMsg}
        </div>
      )}
    </div>
  )
}
