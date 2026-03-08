// Multi-stroke signature pad — HiDPI aware.
// Canvas physical pixels = CSS pixels × devicePixelRatio for crisp output.
import React, { useEffect, useRef } from 'react'
import { APP_ACCENT } from './constants'

export function SignaturePad({ value, onChange, accent = APP_ACCENT }) {
  const canvasRef = useRef(null)
  const drawing   = useRef(false)
  const lastPos   = useRef(null)

  // ── Size canvas to physical pixels; re-size on orientation change ───
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      // Preserve any existing drawing before resize
      const dpr    = window.devicePixelRatio || 1
      const cssW   = canvas.clientWidth  || 750
      const cssH   = canvas.clientHeight || 160
      const newW   = Math.round(cssW * dpr)
      const newH   = Math.round(cssH * dpr)
      if (canvas.width === newW && canvas.height === newH) return

      // Snapshot current content
      const snapshot = canvas.toDataURL()

      canvas.width  = newW
      canvas.height = newH
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)

      // Restore previous drawing (if any) so strokes survive rotation
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
    // Return CSS-space coordinates (ctx is already scaled)
    return {
      x: src.clientX - rect.left,
      y: src.clientY - rect.top,
    }
  }

  const startDraw = e => {
    e.preventDefault()
    drawing.current = true
    lastPos.current = getPos(e, canvasRef.current)
  }

  const draw = e => {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    const pos    = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1a1aff'
    ctx.lineWidth   = 2
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.stroke()
    lastPos.current = pos
  }

  const endDraw = () => {
    if (!drawing.current) return
    drawing.current = false
    lastPos.current = null

    const canvas = canvasRef.current
    const dpr    = window.devicePixelRatio || 1
    const W      = canvas.width   // physical pixels
    const H      = canvas.height
    const data   = canvas.getContext('2d').getImageData(0, 0, W, H).data

    // Find tight bounding box in physical pixels
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

    if (maxX > minX && maxY > minY) {
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
        border: `2px solid ${value ? accent : '#ddd'}`,
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
            <span style={{ fontSize: 13, color: '#bbb', fontStyle: 'italic' }}>Sign here</span>
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
          height: 1, background: '#ddd', pointerEvents: 'none',
        }} />
      </div>
    </div>
  )
}
