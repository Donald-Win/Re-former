/**
 * GpsCoordButton
 *
 * A button that reads the device's GPS position and fills in NZTM2000
 * North / East co-ordinates (plus Altitude, when the device reports one) —
 * for use in the "GPS Co-ordinates" section of the Pole Record wizard (and
 * any future wizard step that asks for NZTM North/East rather than a
 * street address).
 *
 * Unlike GpsLocationButton (which reverse-geocodes a GPS fix to a street
 * address via Nominatim), this button does a local WGS84 → NZTM2000
 * conversion (see src/shared/nztm.js) and makes no network request — it
 * works fully offline once the device has a GPS fix.
 *
 * Rate-limit / rapid-retap protection mirrors GpsLocationButton: a strict
 * 2-second cooldown is applied after any error, during which the button is
 * disabled and shows a "Please wait…" label.
 *
 * maximumAge
 * ──────────
 * getCurrentPosition is called with maximumAge: 30000 (30 seconds) rather
 * than 0. Requesting a brand-new fix on every tap forces the device's GPS
 * hardware to reacquire a satellite lock from cold, which in rural or
 * low-signal areas frequently exceeds the 15-second timeout below and
 * surfaces as a spurious TIMEOUT error. Accepting a fix up to 30 seconds
 * old lets the OS return an already-locked, still field-accurate position
 * instantly in the common case, while still being fresh enough for as-built
 * pole co-ordinates.
 *
 * Props:
 *   onCoords(fields) — called with { gpsNorth, gpsEast, altitude? }.
 *                      `altitude` is only included when the device reports
 *                      one, so a caller spreading this into existing form
 *                      state never blanks out a value the user typed in
 *                      manually.
 *   accent           — hex colour for the button border/text
 */
import { useState, useRef, useEffect } from 'react'
import { latLonToNztm } from './nztm'

const COOLDOWN_MS = 2000

export function GpsCoordButton({ onCoords, accent = '#6366f1' }) {
  const [status,     setStatus]     = useState('idle') // 'idle' | 'locating' | 'error'
  const [errorMsg,   setErrorMsg]   = useState('')
  const [isCooldown, setIsCooldown] = useState(false)

  // Holds the cooldown timer so we can clear it on unmount
  const cooldownRef = useRef(null)

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearTimeout(cooldownRef.current)
    }
  }, [])

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
    if (status === 'locating' || isCooldown) return

    if (!navigator.geolocation) {
      enterError('Geolocation is not supported by this browser.')
      return
    }

    setStatus('locating')
    setErrorMsg('')

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, altitude } = pos.coords
        try {
          const { northing, easting } = latLonToNztm(latitude, longitude)
          const hasAltitude = altitude !== null && altitude !== undefined

          onCoords({
            gpsNorth: String(northing),
            gpsEast:  String(easting),
            // Only included when the device actually reports one — many
            // phones/tablets return null for altitude without a strong fix.
            ...(hasAltitude ? { altitude: `${Math.round(altitude)}m` } : {}),
          })
          setStatus('idle')
        } catch (err) {
          console.error('GpsCoordButton: NZTM conversion failed', err)
          enterError('Could not calculate co-ordinates. Try again.')
        }
      },
      (err) => {
        // Mirrors GpsLocationButton's error handling for consistency.
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

  const disabled = status === 'locating' || isCooldown

  const label = status === 'locating' ? '📡 Getting GPS fix…'
              : isCooldown            ? '⏳ Please wait…'
              : '📍 Use my GPS for North / East'

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
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, lineHeight: 1.4 }}>
        Fills North / East from your device's GPS, converted to NZTM2000. Works offline.
        {' '}Altitude is filled too when your device reports one.
      </div>
    </div>
  )
}
