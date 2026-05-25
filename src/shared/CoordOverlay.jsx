// CoordOverlay — accurate click-to-coordinate calibration tool.
//
// Improvements over original:
//   - Renders PDF scaled to fit screen width (no overflow/clipping)
//   - Coordinate math uses the actual render scale — no fudge factors
//   - Crosshair marker shows exactly where you clicked on the canvas
//   - Click history panel shows all clicks with labels and copy buttons
//   - One-click copy of the coordinate pair as a code snippet
//   - Pinch/zoom on mobile works naturally (canvas scales with CSS)
//   - pdfY is always correct: pageHeight - (clickY / renderScale)
//
// pdfjs-dist is now imported from npm (not loaded from CDN) so the service
// worker can cache it and the calibration tool works fully offline.
//
// Usage: <CoordOverlay pdfBytes={bytes} page={1} />
// Set SHOW_OVERLAY = true in the wizard to reveal the calibrate tab.

import React, { useState, useEffect, useRef, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url'
import { APP_ACCENT, APP_YELLOW } from './constants'

// Configure the worker once at module load time.
// The ?url import tells Vite to emit the worker as a hashed asset in dist/assets/
// so the service worker caches it automatically on first visit.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc

export function CoordOverlay({ pdfBytes, page = 1 }) {
  const containerRef = useRef(null)
  const canvasRef    = useRef(null)
  const scaleRef     = useRef(1)   // actual render scale — used for coordinate math
  const renderingRef = useRef(false)
  const cancelledRef = useRef(false)

  const [clicks, setClicks]         = useState([])
  const [lastClick, setLastClick]   = useState(null)
  const [copied, setCopied]         = useState(null)   // id of recently copied item
  const [label, setLabel]           = useState('')      // label input for next click

  const render = useCallback(async () => {
    const canvas    = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !pdfBytes) return
    if (renderingRef.current) return

    cancelledRef.current = false
    renderingRef.current = true

    try {
      if (cancelledRef.current) return

      const pdf = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise
      if (cancelledRef.current) { pdf.destroy(); return }

      const pg   = await pdf.getPage(page)
      const nat  = pg.getViewport({ scale: 1.0 })

      // Scale to fit the container width with a small margin
      const containerW = container.clientWidth || window.innerWidth
      const fitScale   = Math.min((containerW - 8) / nat.width, 2.0)
      scaleRef.current = fitScale

      const vp = pg.getViewport({ scale: fitScale })
      canvas.width  = Math.round(vp.width)
      canvas.height = Math.round(vp.height)

      // CSS size matches physical pixels — no DPR scaling here
      // (we want click coords in the same space as canvas pixels)
      canvas.style.width  = canvas.width  + 'px'
      canvas.style.height = canvas.height + 'px'

      await pg.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
      renderingRef.current = false
      pdf.destroy()
    } catch (err) {
      if (!cancelledRef.current) console.error('CoordOverlay render failed:', err)
      renderingRef.current = false
    }
  }, [pdfBytes, page])

  useEffect(() => {
    render()
    return () => { cancelledRef.current = true; renderingRef.current = false }
  }, [render])

  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scale = scaleRef.current

    // CSS pixels relative to canvas top-left
    const cssX = e.clientX - rect.left
    const cssY = e.clientY - rect.top

    // PDF point coordinates (pdf-lib origin is bottom-left)
    // Divide by scale to convert from rendered pixels → PDF points
    const pdfX = Math.round(cssX / scale)
    const pdfY = Math.round((canvas.height / scale) - (cssY / scale))

    // Canvas pixel position for the dot marker
    const dotX = Math.round(cssX)
    const dotY = Math.round(cssY)

    const id = Date.now()
    const entry = {
      id,
      label: label.trim() || `Click ${clicks.length + 1}`,
      pdfX,
      pdfY,
      dotX,
      dotY,
    }

    console.log(`COORD → x:${pdfX}  pdfY:${pdfY}  (label: ${entry.label})`)
    setLastClick(entry)
    setClicks(prev => [...prev, entry])
    setLabel('')
  }, [clicks.length, label])

  const copyCoord = useCallback((entry) => {
    const text = `x: ${entry.pdfX},  y: ${entry.pdfY}  // ${entry.label}`
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(entry.id)
    setTimeout(() => setCopied(null), 1500)
  }, [])

  const copyAll = useCallback(() => {
    const lines = clicks.map(c => `  // ${c.label}: x=${c.pdfX}, y=${c.pdfY}`)
    navigator.clipboard?.writeText(lines.join('\n')).catch(() => {})
    setCopied('all')
    setTimeout(() => setCopied(null), 1500)
  }, [clicks])

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* Header bar */}
      <div style={{
        background: '#1e1b4b', color: '#fff',
        padding: '8px 14px',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: APP_YELLOW }}>
          🎯 CALIBRATION — page {page}
        </span>
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Label next click (optional)"
          style={{
            flex: 1, minWidth: 140,
            padding: '5px 10px', borderRadius: 6, border: 'none',
            fontSize: 12, fontFamily: 'monospace',
            background: 'rgba(255,255,255,0.12)', color: '#fff',
          }}
        />
        <button
          onClick={() => { setClicks([]); setLastClick(null) }}
          style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, cursor: 'pointer' }}
        >
          Clear all
        </button>
      </div>

      {/* Last-click readout — sticky at top so visible while scrolling */}
      {lastClick && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: '#111827', color: '#fff',
          padding: '8px 14px',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: 'monospace', fontSize: 14 }}>
            <span style={{ color: APP_YELLOW }}>x:</span> {lastClick.pdfX}
            {'   '}
            <span style={{ color: '#86efac' }}>y:</span> {lastClick.pdfY}
            {'   '}
            <span style={{ color: '#94a3b8', fontSize: 12 }}>{lastClick.label}</span>
          </span>
          <button
            onClick={() => copyCoord(lastClick)}
            style={{
              padding: '4px 12px', borderRadius: 6, border: 'none',
              background: copied === lastClick.id ? '#16a34a' : APP_ACCENT,
              color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {copied === lastClick.id ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>
      )}

      {/* Canvas container */}
      <div
        ref={containerRef}
        style={{ background: '#e5e7eb', padding: 4, position: 'relative', overflowX: 'hidden' }}
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <canvas
            ref={canvasRef}
            onClick={handleClick}
            style={{ display: 'block', cursor: 'crosshair' }}
          />

          {/* Click dot markers on canvas */}
          {clicks.map((c, i) => (
            <React.Fragment key={c.id}>
              {/* Dot */}
              <div style={{
                position: 'absolute',
                left: c.dotX,
                top:  c.dotY,
                width: 10, height: 10,
                borderRadius: '50%',
                background: '#ef4444',
                border: '2px solid #fff',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                zIndex: 10,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
              }} />
              {/* Number label next to dot */}
              <div style={{
                position: 'absolute',
                left: c.dotX + 7,
                top:  c.dotY - 9,
                fontSize: 9,
                fontWeight: 700,
                color: '#fff',
                background: '#ef4444',
                borderRadius: 4,
                padding: '1px 4px',
                pointerEvents: 'none',
                zIndex: 11,
                whiteSpace: 'nowrap',
              }}>
                {i + 1}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Click history panel */}
      {clicks.length > 0 && (
        <div style={{ background: '#0f172a', padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>
              {clicks.length} click{clicks.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={copyAll}
              style={{
                padding: '4px 12px', borderRadius: 6, border: 'none',
                background: copied === 'all' ? '#16a34a' : '#334155',
                color: '#fff', fontSize: 12, cursor: 'pointer',
              }}
            >
              {copied === 'all' ? '✓ Copied all' : '📋 Copy all'}
            </button>
          </div>

          {clicks.map((c, i) => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 8px',
              background: i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent',
              borderRadius: 6, marginBottom: 2,
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%',
                background: '#ef4444', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, flexShrink: 0,
              }}>{i + 1}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#e2e8f0', flex: 1 }}>
                <span style={{ color: APP_YELLOW }}>x:</span>{c.pdfX}
                {'  '}
                <span style={{ color: '#86efac' }}>y:</span>{c.pdfY}
              </span>
              <span style={{ fontSize: 11, color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.label}
              </span>
              <button
                onClick={() => copyCoord(c)}
                style={{
                  padding: '3px 8px', borderRadius: 5, border: 'none',
                  background: copied === c.id ? '#16a34a' : '#1e40af',
                  color: '#fff', fontSize: 11, cursor: 'pointer', flexShrink: 0,
                }}
              >
                {copied === c.id ? '✓' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
