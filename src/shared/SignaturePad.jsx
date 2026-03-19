// Multi-stroke signature pad — HiDPI aware & Velocity-based thickness.
// Canvas physical pixels = CSS pixels × devicePixelRatio for crisp output.
import React, { useEffect, useRef } from 'react'
import { APP_ACCENT } from './constants'

export function SignaturePad({ value, onChange, accent = APP_ACCENT }) {
  const canvasRef = useRef(null)
  
  // Drawing state refs
  const drawing   = useRef(false)
  const hasMoved  = useRef(false)
  const lastPos   = useRef(null)
  const lastMid   = useRef(null)
  
  // Physics refs for premium ink effect
  const lastTime  = useRef(null)
  const lastWidth = useRef(2.5)

  // ── Size canvas to physical pixels; re-size on orientation change ───
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const dpr    = window.devicePixelRatio || 1
      const cssW   = canvas.clientWidth  || 750
      const cssH   = canvas.clientHeight || 160
      const newW   = Math.round(cssW * dpr)
      const newH   = Math.round(cssH * dpr)
      if (canvas.width === newW && canvas.height === newH) return

      const snapshot = canvas.toDataURL()

      canvas.width  = newW
      canvas.height = newH
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)

      if (snapshot && snapshot !== 'data:,') {
        const img = new Image()
        img.onload = () => ctx.drawImage(img, 0, 0, cssW, cssH)
        img.src = snapshot
      }
    }

    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // ── Clear when value is reset externally ──────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || value) return
    const dpr = window.devicePixelRatio || 1
    canvas.getContext('2d').clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
  }, [value])

  // ── Pointer helpers ───────────────────────────────────────
  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const src  = e.touches ? e.touches[0] : e
    return {
      x: src.clientX - rect.left,
      y: src.clientY - rect.top,
    }
  }

  const startDraw = e => {
    e.preventDefault()
    drawing.current = true
    hasMoved.current = false
    
    const pos = getPos(e, canvasRef.current)
    lastPos.current = pos
    lastMid.current = pos
    lastTime.current = Date.now()
    lastWidth.current = 2.5 // Starting default thickness
  }

  const draw = e => {
    e.preventDefault()
    if (!drawing.current) return
    
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const pos    = getPos(e, canvas)
    const time   = Date.now()
    
    hasMoved.current = true

    // 1. Calculate Velocity (Distance / Time)
    const dt = time - lastTime.current || 1
    const dx = pos.x - lastPos.current.x
    const dy = pos.y - lastPos.current.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const velocity = distance / dt

    // 2. Map Velocity to Stroke Width (Faster = Thinner, Slower = Thicker)
    const minWidth = 1.0
    const maxWidth = 3.5
    // Normalize velocity so a speed of 3px/ms caps out the thinness
    const vFactor = Math.max(0, Math.min(1, velocity / 3)) 
    const targetWidth = maxWidth - (vFactor * (maxWidth - minWidth))

    // 3. Smooth the width transition so the ink doesn't stutter
    const currentWidth = lastWidth.current + (targetWidth - lastWidth.current) * 0.2

    // 4. Calculate midpoint for the Bézier curve
    const mid = {
      x: (lastPos.current.x + pos.x) / 2,
      y: (lastPos.current.y + pos.y) / 2,
    }

    ctx.beginPath()
    ctx.moveTo(lastMid.current.x, lastMid.current.y)
    ctx.quadraticCurveTo(lastPos.current.x, lastPos.current.y, mid.x, mid.y)
    
    // Premium Ballpoint Blue styling
    ctx.strokeStyle = 'rgba(0, 20, 160, 0.9)' 
    ctx.lineWidth   = currentWidth 
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    
    ctx.stroke()

    // Update refs for the next frame
    lastPos.current = pos
    lastMid.current = mid
    lastTime.current = time
    lastWidth.current = currentWidth
  }

  const endDraw = () => {
    if (!drawing.current) return
    drawing.current = false

    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')

    // Perfect dot for taps
    if (!hasMoved.current && lastPos.current) {
      const { x, y } = lastPos.current
      ctx.beginPath()
      ctx.arc(x, y, lastWidth.current / 2, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0, 20, 160, 0.9)'
      ctx.fill()
    }

    lastPos.current = null
    lastMid.current = null
    hasMoved.current = false

    const dpr  = window.devicePixelRatio || 1
    const W    = canvas.width
    const H    = canvas.height
    const data = canvas.getContext('2d').getImageData(0, 0, W, H).data

    // Tight bounding box crop
    let minX = W, minY = H, maxX = 0, maxY = 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (data[(y * W + x) * 4 + 3] > 0) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }

    if (minX <= maxX && minY <= maxY) {
      const pad = Math.round(4 * dpr)
      const tc  = document.createElement('canvas')
      tc.width  = maxX - minX + pad * 2
      tc.height = maxY - minY + pad * 2
      tc.getContext('2d').drawImage(
        canvas,
        minX - pad, minY - pad, tc.width, tc.height,
        0, 0, tc.width, tc.height
      )
      onChange(tc.toDataURL('image/png'))
    }
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.getContext('2d').clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    onChange('')
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 700, color: '#555',
        marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        Signature
      </label>
      <div style={{
        position: 'relative',
        border: `2px solid ${value ? 'rgba(0, 20, 160, 0.5)' : '#ddd'}`,
        borderRadius: 8, background: '#fff',
        overflow: 'hidden', touchAction: 'none',
      }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: 160, display: 'block', cursor: 'crosshair' }}
          onMouseDown={startDraw} onMouseMove={draw}
          onMouseUp={endDraw}    onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
        />
        {!value && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 13, color: 'rgba(0, 20, 160, 0.35)', fontStyle: 'italic' }}>Sign here</span>
          </div>
        )}
        {value && (
          <button
            onClick={handleClear}
            style={{
              position: 'absolute', top: 6, right: 6,
              background: 'rgba(220,38,38,0.1)', border: '1px solid #fca5a5',
              borderRadius: 6, padding: '3px 8px', fontSize: 11,
              color: '#dc2626', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 600,
            }}
          >
            Clear
          </button>
        )}
        <div style={{
          position: 'absolute', bottom: 0, left: 12, right: 12,
          height: 1, background: 'rgba(0, 20, 160, 0.15)', pointerEvents: 'none',
        }} />
      </div>
    </div>
  )
}
