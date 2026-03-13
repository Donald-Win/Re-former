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
 * Props:
 *   onLocation(fields)  — called with { streetRoad, cityTown, district }
 *   accent              — hex colour for the button border/text
 */
import { useState } from 'react'

export function GpsLocationButton({ onLocation, accent = '#6366f1' }) {
  const [status, setStatus] = useState('idle') // 'idle' | 'locating' | 'geocoding' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  const handlePress = () => {
    if (!navigator.geolocation) {
      setStatus('error')
      setErrorMsg('Geolocation is not supported by this browser.')
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
          setStatus('error')
          setErrorMsg('Could not look up address. Check your internet connection.')
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          const isInsecure = location.protocol !== 'https:' && location.hostname !== 'localhost'
          if (isInsecure) {
            setStatus('error')
            setErrorMsg('GPS is only available on the deployed app (HTTPS). It will not work on the local dev server.')
            return
          }
          const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
          const isStandalone = window.matchMedia('(display-mode: standalone)').matches
          let msg
          if (isIOS) {
            msg = 'Location denied. Go to Settings → Safari → Location → Allow.'
          } else if (isStandalone) {
            msg = 'Location was previously blocked. Go to Android Settings → Apps → Chrome → Permissions → Location → Allow.'
          } else {
            msg = 'Location was previously blocked. In Chrome, tap ⋮ (menu) → Settings → Site settings → Location → find this site and allow it.'
          }
          setStatus('error')
          setErrorMsg(msg)
        } else if (err.code === err.TIMEOUT) {
          setStatus('error')
          setErrorMsg('Location timed out. Try again outdoors with a clear sky view.')
        } else {
          setStatus('error')
          setErrorMsg('Could not get location. Try again.')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const loading = status === 'locating' || status === 'geocoding'
  const label = status === 'locating' ? '📡 Getting location…'
              : status === 'geocoding' ? '🗺 Looking up address…'
              : '📍 Use my location'

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        type="button"
        onClick={handlePress}
        disabled={loading}
        style={{
          width: '100%',
          padding: '10px 0',
          borderRadius: 8,
          border: `2px dashed ${accent}`,
          background: loading ? '#f5f5ff' : '#eef2ff',
          color: loading ? '#9ca3af' : accent,
          fontWeight: 700,
          fontSize: 14,
          cursor: loading ? 'default' : 'pointer',
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
