// CoordOverlay — click-to-coordinate calibration tool.
//
// Usage: <CoordOverlay pdfBytes={bytes} page={1} />
// Opened via the 📐 button in WizardShell (DEV only).
//
// ── Coordinate convention (the Y-axis fix) ───────────────────────────────────
// Every value this tool reports is the TOP-ORIGIN "cssY" value expected by
// every drawing helper in pdfDrawUtils.js (t, tc, tr, ck, circ, tWrap) — i.e.
// you can paste it straight into a generator's LAYOUT object with NO further
// conversion. (Older versions of this tool reported pdf-lib's raw
// BOTTOM-origin Y, requiring a manual conversion step that was easy to skip
// or get wrong.)
//
// ── Alignment modes ───────────────────────────────────────────────────────────
// Pick a mode before tapping. The snippet you copy is a ready-to-paste entry
// for a FIELDS object (see src/shared/pdfFieldRenderer.js's renderFields()) —
// rename "FIXME" to the real value accessor and drop it straight in:
//   Left     (1 tap)  → { type:'text', align:'left',   x, y, value }
//   Center   (2 taps) → { type:'text', align:'center', x, width, y, value }
//   Right    (1 tap)  → { type:'text', align:'right',  x, y, value }
//   Check    (1 tap)  → { type:'check', x, y, value }
//   Ellipse  (3 taps) → { type:'ellipse', cx, cy, rx, ry, value }
// (Repeating-row tables — circuit grids, variable-length lists — aren't
// single fields and still use the lower-level draw.t/draw.ck primitives
// directly; see DistributionTransformerPdfGenerator.js's GRIDS section.)
//
// ── Zoom ───────────────────────────────────────────────────────────────────────
// The − / 100% / + control in the header re-renders the PDF page at a higher
// resolution (it re-rasterises via pdf.js rather than CSS-scaling the
// existing canvas, so text and lines stay crisp at any zoom level). Native
// pinch-to-zoom also works here — WizardShell unlocks the viewport while the
// calibration overlay is open, the same way it does for the PDF preview.
//
// Every mark is stored in PDF-point space (the same space the LAYOUT objects
// use) and converted to on-screen pixels at render time using the current
// zoom. That means marks placed before zooming stay perfectly pinned to the
// same spot on the form after you zoom in or out — nothing needs re-tapping.

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { pdfjsLib } from './pdfjsInit'
import { APP_ACCENT, APP_YELLOW } from './constants'

// ── Mode definitions ──────────────────────────────────────────────────────────
// `steps` describes the tap sequence — its length is how many taps a mode needs.
// `usage` mirrors the field shape renderFields() expects (see
// src/shared/pdfFieldRenderer.js) — the snippet this tool copies is meant to
// be pasted directly as one entry in a FIELDS object, no translation needed.
const MODE_INFO = {
  left: {
    label: 'Left', color: '#ef4444',
    steps: ['Tap the point — text will be LEFT-aligned, starting here.'],
    usage: "{ type:'text', align:'left', x, y, value }",
  },
  center: {
    label: 'Center', color: '#2563eb',
    steps: [
      'Tap the LEFT edge of the field box.',
      'Tap the RIGHT edge of the field box.',
    ],
    usage: "{ type:'text', align:'center', x, width, y, value }",
  },
  right: {
    label: 'Right', color: '#d97706',
    steps: ['Tap the point — text will be RIGHT-aligned, finishing here.'],
    usage: "{ type:'text', align:'right', x, y, value }",
  },
  checkbox: {
    label: 'Check', color: '#16a34a',
    steps: ['Tap the tick / checkbox mark position.'],
    usage: "{ type:'check', x, y, value }",
  },
  ellipse: {
    label: 'Ellipse', color: '#9333ea',
    steps: [
      'Tap the CENTRE of the circle.',
      'Tap a point on the LEFT or RIGHT edge (sets width).',
      'Tap a point on the TOP or BOTTOM edge (sets height).',
    ],
    usage: "{ type:'ellipse', cx, cy, rx, ry, value }",
  },
}
const MODE_ORDER = ['left', 'center', 'right', 'checkbox', 'ellipse']

// ── Zoom bounds ────────────────────────────────────────────────────────────────
// 100% = fit-to-container-width (the tool's previous, only, behaviour),
// capped internally at 2x the PDF's native size so it never looks blurry on
// a wide desktop window. Zoom multiplies on top of that fit scale.
const ZOOM_MIN  = 50
const ZOOM_MAX  = 400
const ZOOM_STEP = 25

/**
 * Format a finalised entry as a ready-to-paste FIELDS entry (see
 * renderFields() in src/shared/pdfFieldRenderer.js). Rename "FIXME" to the
 * real value accessor — e.g. `d => d.streetRoad` — and drop it straight
 * into a FIELDS.p1/p2/p3 object as `fieldName: { ...this... }`.
 */
function formatSnippet(e) {
  switch (e.mode) {
    case 'left':
      return `{ type: 'text', align: 'left', x: ${e.x}, y: ${e.y}, value: d => d.FIXME }`
    case 'right':
      return `{ type: 'text', align: 'right', x: ${e.fieldRight}, y: ${e.y}, value: d => d.FIXME }`
    case 'center':
      return `{ type: 'text', align: 'center', x: ${e.fieldLeft}, width: ${e.fieldWidth}, y: ${e.y}, value: d => d.FIXME }`
    case 'checkbox':
      return `{ type: 'check', x: ${e.x}, y: ${e.y}, value: d => d.FIXME }`
    case 'ellipse':
      return `{ type: 'ellipse', cx: ${e.cx}, cy: ${e.cy}, rx: ${e.rx}, ry: ${e.ry}, value: d => d.FIXME }`
    default:
      return ''
  }
}

export function CoordOverlay({ pdfBytes, page = 1 }) {
  const containerRef = useRef(null)
  const canvasRef    = useRef(null)

  // PDF document / page handles — loaded once per (pdfBytes, page), then
  // re-rendered at different scales as the user zooms (no re-parsing).
  const pdfDocRef    = useRef(null)
  const pdfPageRef   = useRef(null)
  const natRef       = useRef({ width: 0, height: 0 })

  const renderingRef      = useRef(false)
  const pendingRedrawRef  = useRef(false)
  const cancelledRef      = useRef(false)
  const zoomRef           = useRef(100)

  const [mode, setMode]                   = useState('left')
  const [zoom, setZoom]                   = useState(100)
  const [scale, setScale]                 = useState(1)   // current render scale (PDF pts → canvas px)
  const [pendingPoints, setPendingPoints] = useState([])  // taps collected so far for a multi-tap mode
  const [clicks, setClicks]               = useState([])
  const [lastClick, setLastClick]         = useState(null)
  const [copied, setCopied]               = useState(null)
  const [label, setLabel]                 = useState('')

  // ── Render the currently-loaded page at the current zoom level ────────────
  // Stable across renders (empty deps) — always reads the latest zoom via
  // zoomRef so it can be called directly from the load effect without being
  // recreated every time zoom changes.
  const drawAtZoom = useCallback(async () => {
    const canvas    = canvasRef.current
    const container = containerRef.current
    const pg        = pdfPageRef.current
    if (!canvas || !container || !pg) return

    if (renderingRef.current) { pendingRedrawRef.current = true; return }
    renderingRef.current = true
    pendingRedrawRef.current = false
    const zoomUsed = zoomRef.current

    try {
      const nat = natRef.current
      const containerW = container.clientWidth || window.innerWidth
      const fitScale = Math.min((containerW - 8) / nat.width, 2.0)
      const effectiveScale = Math.min(fitScale * (zoomUsed / 100), 8)

      const vp = pg.getViewport({ scale: effectiveScale })
      canvas.width  = Math.round(vp.width)
      canvas.height = Math.round(vp.height)
      canvas.style.width  = canvas.width  + 'px'
      canvas.style.height = canvas.height + 'px'

      await pg.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
      if (!cancelledRef.current) setScale(effectiveScale)
    } catch (err) {
      if (!cancelledRef.current) console.error('CoordOverlay render failed:', err)
    } finally {
      renderingRef.current = false
      // A newer zoom request arrived while this render was in flight — run
      // it now rather than leaving the canvas one step behind.
      if (pendingRedrawRef.current || zoomRef.current !== zoomUsed) {
        drawAtZoom()
      }
    }
  }, [])

  // ── Load the PDF document + page once per (pdfBytes, page) ────────────────
  useEffect(() => {
    cancelledRef.current = false

    ;(async () => {
      if (!pdfBytes) return
      try {
        if (pdfPageRef.current) { try { pdfPageRef.current.cleanup() } catch (_) {} ; pdfPageRef.current = null }
        if (pdfDocRef.current)  { try { pdfDocRef.current.destroy() } catch (_) {} ; pdfDocRef.current = null }

        const pdf = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise
        if (cancelledRef.current) { pdf.destroy(); return }
        pdfDocRef.current = pdf

        const pg = await pdf.getPage(page)
        if (cancelledRef.current) { pg.cleanup(); pdf.destroy(); return }
        pdfPageRef.current = pg

        const nat = pg.getViewport({ scale: 1.0 })
        natRef.current = { width: nat.width, height: nat.height }

        await drawAtZoom()
      } catch (err) {
        if (!cancelledRef.current) console.error('CoordOverlay load failed:', err)
      }
    })()

    return () => {
      cancelledRef.current = true
      renderingRef.current = false
      if (pdfPageRef.current) { try { pdfPageRef.current.cleanup() } catch (_) {} ; pdfPageRef.current = null }
      if (pdfDocRef.current)  { try { pdfDocRef.current.destroy() } catch (_) {} ; pdfDocRef.current = null }
    }
  }, [pdfBytes, page, drawAtZoom])

  // ── Re-draw whenever the zoom level changes ────────────────────────────────
  useEffect(() => {
    zoomRef.current = zoom
    drawAtZoom()
  }, [zoom, drawAtZoom])

  // ── Re-fit on container resize (e.g. iPad orientation change) ──────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => drawAtZoom())
    ro.observe(container)
    return () => ro.disconnect()
  }, [drawAtZoom])

  // A partially-completed multi-tap mark belongs to whichever page it was
  // started on — discard it if the page changes underneath it, since the
  // next tap would land on a different raster and produce a meaningless
  // measurement.
  useEffect(() => { setPendingPoints([]) }, [page])

  const zoomIn    = useCallback(() => setZoom(z => Math.min(ZOOM_MAX, z + ZOOM_STEP)), [])
  const zoomOut   = useCallback(() => setZoom(z => Math.max(ZOOM_MIN, z - ZOOM_STEP)), [])
  const zoomReset = useCallback(() => setZoom(100), [])

  const finalizeEntry = useCallback((points) => {
    const id         = Date.now()
    const entryLabel = label.trim() || `Click ${clicks.length + 1}`
    // Stored in PDF-point space (same space as the LAYOUT objects) so marks
    // stay correctly positioned regardless of the current zoom level.
    const dots = points.map(p => ({ x: p.ptX, y: p.ptY }))
    let extra = {}

    if (mode === 'left' || mode === 'checkbox') {
      extra = { x: Math.round(points[0].ptX), y: Math.round(points[0].ptY) }
    } else if (mode === 'right') {
      extra = { fieldRight: Math.round(points[0].ptX), y: Math.round(points[0].ptY) }
    } else if (mode === 'center') {
      const left  = Math.min(points[0].ptX, points[1].ptX)
      const right = Math.max(points[0].ptX, points[1].ptX)
      extra = {
        fieldLeft:  Math.round(left),
        fieldWidth: Math.round(right - left),
        y:          Math.round(points[0].ptY),
      }
    } else if (mode === 'ellipse') {
      extra = {
        cx: Math.round(points[0].ptX),
        cy: Math.round(points[0].ptY),
        rx: Math.round(Math.abs(points[1].ptX - points[0].ptX)),
        ry: Math.round(Math.abs(points[2].ptY - points[0].ptY)),
      }
    }

    const entry = { id, mode, label: entryLabel, dots, ...extra }
    console.log(`COORD [${MODE_INFO[mode].label}] ${entry.label} →`, formatSnippet(entry))
    setLastClick(entry)
    setClicks(prev => [...prev, entry])
    setLabel('')
  }, [mode, label, clicks.length])

  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const cssX = e.clientX - rect.left
    const cssY = e.clientY - rect.top

    // Top-origin PDF-point coordinates — this IS the "cssY" every drawing
    // helper expects. No flipping, no further conversion.
    const point = { ptX: cssX / scale, ptY: cssY / scale }

    const steps = MODE_INFO[mode].steps
    const next  = [...pendingPoints, point]

    if (next.length >= steps.length) {
      finalizeEntry(next)
      setPendingPoints([])
    } else {
      setPendingPoints(next)
    }
  }, [mode, pendingPoints, finalizeEntry, scale])

  const cancelPending = useCallback(() => setPendingPoints([]), [])

  const copyEntry = useCallback((entry) => {
    const text = `// ${entry.label}\n${formatSnippet(entry)}`
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(entry.id)
    setTimeout(() => setCopied(null), 1500)
  }, [])

  const copyAll = useCallback(() => {
    const lines = clicks.map(e => `  // ${e.label} (${MODE_INFO[e.mode].label})\n  ${formatSnippet(e)},`)
    navigator.clipboard?.writeText(lines.join('\n')).catch(() => {})
    setCopied('all')
    setTimeout(() => setCopied(null), 1500)
  }, [clicks])

  const removeEntry = useCallback((id) => {
    setClicks(prev => prev.filter(c => c.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setClicks([])
    setLastClick(null)
    setPendingPoints([])
  }, [])

  const modeInfo = MODE_INFO[mode]
  const stepIdx  = pendingPoints.length
  const stepHint = modeInfo.steps[stepIdx] || modeInfo.steps[0]

  const zoomBtnStyle = (disabled) => ({
    width: 30, height: 30, borderRadius: 7, border: 'none',
    background: disabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.18)',
    color: disabled ? '#6b7280' : '#fff',
    fontSize: 16, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center',
  })

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header bar */}
      <div style={{ background: '#1e1b4b', color: '#fff', padding: '8px 14px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: APP_YELLOW }}>
            🎯 CALIBRATION — page {page}
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={clearAll} style={{
            padding: '5px 10px', borderRadius: 6, border: 'none',
            background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, cursor: 'pointer',
          }}>
            Clear all
          </button>
        </div>

        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Zoom
          </span>
          <button onClick={zoomOut} disabled={zoom <= ZOOM_MIN} style={zoomBtnStyle(zoom <= ZOOM_MIN)}>−</button>
          <button
            onClick={zoomReset}
            title="Tap to reset to 100%"
            style={{
              minWidth: 54, padding: '5px 8px', borderRadius: 7, border: 'none',
              background: 'rgba(255,255,255,0.1)', color: '#fff',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
            }}
          >
            {zoom}%
          </button>
          <button onClick={zoomIn} disabled={zoom >= ZOOM_MAX} style={zoomBtnStyle(zoom >= ZOOM_MAX)}>+</button>
          <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>
            Pinch-to-zoom also works
          </span>
        </div>

        {/* Alignment / mark-type selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {MODE_ORDER.map(m => {
            const info = MODE_INFO[m]
            const sel  = mode === m
            return (
              <button key={m}
                onClick={() => { setMode(m); setPendingPoints([]) }}
                style={{
                  padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `2px solid ${info.color}`,
                  background: sel ? info.color : 'rgba(255,255,255,0.06)',
                  color: sel ? '#fff' : info.color,
                  fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                {info.label}
              </button>
            )
          })}
        </div>

        {/* Label input */}
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Label next mark (optional)"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '5px 10px', borderRadius: 6, border: 'none',
            fontSize: 12, fontFamily: 'monospace',
            background: 'rgba(255,255,255,0.12)', color: '#fff',
          }}
        />

        {/* Step hint */}
        <div style={{ fontSize: 11, color: '#c4b5fd', marginTop: 6, lineHeight: 1.4 }}>
          {modeInfo.steps.length > 1
            ? `Tap ${stepIdx + 1} of ${modeInfo.steps.length}: ${stepHint}`
            : stepHint}
          {' '}<span style={{ opacity: 0.7 }}>({modeInfo.usage})</span>
        </div>
      </div>

      {/* Last-mark / in-progress readout */}
      {(lastClick || pendingPoints.length > 0) && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: '#111827', color: '#fff',
          padding: '8px 14px',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          {pendingPoints.length > 0 ? (
            <>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: modeInfo.color }}>
                {pendingPoints.length} of {modeInfo.steps.length} taps marked — {stepHint}
              </span>
              <button onClick={cancelPending} style={{
                padding: '4px 12px', borderRadius: 6, border: 'none',
                background: '#374151', color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                ✕ Cancel
              </button>
            </>
          ) : (
            <>
              <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
                <span style={{ color: MODE_INFO[lastClick.mode].color, fontWeight: 700 }}>
                  {MODE_INFO[lastClick.mode].label}:
                </span>{' '}
                {formatSnippet(lastClick)}
                {'   '}
                <span style={{ color: '#94a3b8', fontSize: 12 }}>{lastClick.label}</span>
              </span>
              <button
                onClick={() => copyEntry(lastClick)}
                style={{
                  padding: '4px 12px', borderRadius: 6, border: 'none',
                  background: copied === lastClick.id ? '#16a34a' : APP_ACCENT,
                  color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {copied === lastClick.id ? '✓ Copied' : '📋 Copy'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Canvas container — horizontally scrollable once zoomed past the
          available width; vertical scrolling is handled by WizardShell's
          outer body. */}
      <div
        ref={containerRef}
        style={{
          background: '#e5e7eb', padding: 4, position: 'relative',
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <canvas
            ref={canvasRef}
            onClick={handleClick}
            style={{ display: 'block', cursor: 'crosshair' }}
          />

          {/* In-progress taps for the current multi-tap mark */}
          {pendingPoints.map((p, idx) => (
            <div key={idx} style={{
              position: 'absolute', left: p.ptX * scale, top: p.ptY * scale,
              width: 12, height: 12, borderRadius: '50%',
              background: modeInfo.color, border: '2px solid #fff',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none', zIndex: 12,
              boxShadow: `0 0 0 4px ${modeInfo.color}55`,
            }} />
          ))}

          {/* Finalised marks — recomputed from PDF-point space on every
              render, so they stay pinned to the right spot at any zoom. */}
          {clicks.map((c, i) => {
            const info = MODE_INFO[c.mode]

            if (c.mode === 'center') {
              const [d1, d2] = c.dots
              const x1 = Math.min(d1.x, d2.x) * scale
              const x2 = Math.max(d1.x, d2.x) * scale
              const y1 = d1.y * scale
              return (
                <React.Fragment key={c.id}>
                  <div style={{
                    position: 'absolute', left: x1, top: y1 - 8,
                    width: x2 - x1, height: 16,
                    border: `2px dashed ${info.color}`, borderRadius: 3,
                    pointerEvents: 'none', zIndex: 10,
                  }} />
                  <NumberBadge x={x1} y={y1 - 8} n={i + 1} color={info.color} />
                </React.Fragment>
              )
            }

            if (c.mode === 'ellipse') {
              const [center, hEdge, vEdge] = c.dots
              const cxPx = center.x * scale
              const cyPx = center.y * scale
              const rxPx = Math.abs(hEdge.x - center.x) * scale
              const ryPx = Math.abs(vEdge.y - center.y) * scale
              return (
                <React.Fragment key={c.id}>
                  <div style={{
                    position: 'absolute',
                    left: cxPx - rxPx, top: cyPx - ryPx,
                    width: rxPx * 2, height: ryPx * 2,
                    border: `2px dashed ${info.color}`, borderRadius: '50%',
                    pointerEvents: 'none', zIndex: 10,
                  }} />
                  <div style={{
                    position: 'absolute', left: cxPx, top: cyPx,
                    width: 6, height: 6, borderRadius: '50%',
                    background: info.color, border: '1px solid #fff',
                    transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 11,
                  }} />
                  <NumberBadge x={cxPx} y={cyPx - ryPx} n={i + 1} color={info.color} />
                </React.Fragment>
              )
            }

            // left / right / checkbox — single dot
            const d  = c.dots[0]
            const dx = d.x * scale
            const dy = d.y * scale
            return (
              <React.Fragment key={c.id}>
                <div style={{
                  position: 'absolute', left: dx, top: dy,
                  width: 10, height: 10, borderRadius: '50%',
                  background: info.color, border: '2px solid #fff',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none', zIndex: 10,
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                }} />
                <NumberBadge x={dx + 7} y={dy - 9} n={i + 1} color={info.color} />
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Mark history panel */}
      {clicks.length > 0 && (
        <div style={{ background: '#0f172a', padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>
              {clicks.length} mark{clicks.length !== 1 ? 's' : ''} — paste directly as a FIELDS entry
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
          {clicks.map((c, i) => {
            const info = MODE_INFO[c.mode]
            return (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 8px',
                background: i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent',
                borderRadius: 6, marginBottom: 2,
              }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: info.color, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, flexShrink: 0,
                }}>{i + 1}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: info.color,
                  flexShrink: 0, width: 42,
                }}>{info.label}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#e2e8f0', flex: 1.4 }}>
                  {formatSnippet(c)}
                </span>
                <span style={{ fontSize: 11, color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.label}
                </span>
                <button
                  onClick={() => copyEntry(c)}
                  style={{
                    padding: '3px 8px', borderRadius: 5, border: 'none',
                    background: copied === c.id ? '#16a34a' : '#1e40af',
                    color: '#fff', fontSize: 11, cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  {copied === c.id ? '✓' : 'Copy'}
                </button>
                <button
                  onClick={() => removeEntry(c.id)}
                  title="Remove this mark"
                  style={{
                    padding: '3px 7px', borderRadius: 5, border: 'none',
                    background: '#7f1d1d', color: '#fff', fontSize: 11, cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Small numbered badge rendered above a marker on the canvas overlay. */
function NumberBadge({ x, y, n, color }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      fontSize: 9, fontWeight: 700, color: '#fff',
      background: color, borderRadius: 4, padding: '1px 4px',
      pointerEvents: 'none', zIndex: 11, whiteSpace: 'nowrap',
      transform: 'translate(0, -100%)',
    }}>
      {n}
    </div>
  )
}
