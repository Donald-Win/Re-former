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
 * maximumAge
 * ──────────
 * getCurrentPosition is called with maximumAge: 30000 (30 seconds) rather
 * than 0. Requesting a brand-new fix on every tap forces the device's GPS
 * hardware to reacquire a satellite lock from cold, which in rural or
 * low-signal areas frequently exceeds the 15-second timeout below and
 * surfaces as a spurious TIMEOUT error. Accepting a fix up to 30 seconds
 * old lets the OS return an already-locked, still field-accurate position
 * instantly in the common case.
 *
 * Cleanup on unmount (v2.20.3)
 * ─────────────────────────────
 * The Nominatim fetch() is now issued with an AbortController tied to this
 * component's lifetime. If the wizard/step is closed (or this button is
 * otherwise unmounted) while a geocode request is still in flight, the
 * fetch is aborted and the eventual settle/reject is ignored — previously
 * the request ran to completion regardless, and its `.then`/`.catch` still
 * called setState on an unmounted component (a React warning, and a
 * needless network request kept alive after the user had already moved on).
 * A `mountedRef` guard additionally covers the geolocation callback itself,
 * since `getCurrentPosition` has no native cancellation and could still
 * resolve after unmount even with the network layer aborted.
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

  // Tracks whether this component is still mounted, and the AbortController
  // for any in-flight Nominatim fetch, so both can be torn down together.
  const mountedRef        = useRef(true)
  const abortControllerRef = useRef(null)

  // Clear any pending cooldown / abort any in-flight request when the
  // component unmounts, so we never call setState on an unmounted
  // component (avoids a React state update warning) and never leave a
  // network request running after the user has navigated away.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (cooldownRef.current) clearTimeout(cooldownRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [])

  /**
   * Transition into the error state and start the 2-second cooldown.
   * Clears any existing cooldown first (defensive — shouldn't be running,
   * but safe if handlePress is somehow called while a cooldown is active).
   */
  const enterError = (msg) => {
    if (!mountedRef.current) return
    setStatus('error')
    setErrorMsg(msg)

    if (cooldownRef.current) clearTimeout(cooldownRef.current)

    setIsCooldown(true)
    cooldownRef.current = setTimeout(() => {
      if (mountedRef.current) setIsCooldown(false)
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
        // The device could take a while to get a fix; if the tech has
        // since closed this step/wizard, don't touch state or start a
        // network request on their behalf.
        if (!mountedRef.current) return

        setStatus('geocoding')
        const { latitude, longitude } = pos.coords

        const controller = new AbortController()
        abortControllerRef.current = controller

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' }, signal: controller.signal }
          )
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          if (!mountedRef.current) return

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
          if (err.name === 'AbortError') return // component unmounted — expected, not an error
          if (!mountedRef.current) return
          console.error('GpsLocationButton: reverse geocode failed', err)
          // Network / Nominatim error — apply cooldown to avoid 429 on rapid retry
          enterError('Could not look up address. Check your internet connection.')
        } finally {
          if (abortControllerRef.current === controller) abortControllerRef.current = null
        }
      },
      (err) => {
        if (!mountedRef.current) return
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
            msg = 'Location was previously blocked. In Android Settings → Apps, find the browser you installed this app from, then go to Permissions → Location → Allow.'
          } else {
            msg = 'Location was previously blocked. In your browser settings, find this site under Location permissions and change it to Allow.'
          }
          enterError(msg)
        } else if (err.code === err.TIMEOUT) {
          enterError('Location timed out. Try again outdoors with a clear sky view.')
        } else {
          enterError('Could not get location. Try again.')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
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
