// Click-to-calibrate PDF overlay — used in dev mode by any wizard.
// Set SHOW_OVERLAY = true in the wizard to enable the calibrate tab.
// Supports multi-page PDFs (e.g. landscape page 2) by reading actual page dimensions.
import React, { useState, useEffect, useRef } from 'react'
import { APP_ACCENT, APP_YELLOW } from './constants'

const PDFJS_VERSION = '3.11.174'

const loadScript = src => new Promise((res, rej) => {
  if (document.querySelector(`script[src="${src}"]`)) { res(); return }
  const s = document.createElement('script')
  s.src = src; s.onload = res; s.onerror = rej
  document.head.appendChild(s)
})

export function CoordOverlay({ pdfBytes, page = 1 }) {
  const canvasRef    = useRef(null)
  const renderingRef = useRef(false)
  const [coord, setCoord]   = useState(null)
  const [clicks, setClicks] = useState([])

  useEffect(() => {
    if (!pdfBytes || !canvasRef.current) return
    if (renderingRef.current) return
    renderingRef.current = true
    ;(async () => {
      try {
        await loadScript(`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`)
        const lib = window['pdfjs-dist/build/pdf']
        lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`
        const pdf    = await lib.getDocument({ data: pdfBytes.slice() }).promise
        const pg     = await pdf.getPage(page)
        const vp     = pg.getViewport({ scale: 1.0 })
        const canvas = canvasRef.current
        canvas.width = vp.width; canvas.height = vp.height
        canvas.style.width = vp.width + 'px'; canvas.style.height = vp.height + 'px'
        await pg.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
        renderingRef.current = false
      } catch (err) { console.error('Overlay render failed:', err); renderingRef.current = false }
    })()
  }, [pdfBytes, page])

  const handleClick = e => {
    const rect  = canvasRef.current.getBoundingClientRect()
    const pdfW  = canvasRef.current.width
    const pdfH  = canvasRef.current.height
    const cssX  = Math.round((e.clientX - rect.left) * (pdfW / rect.width))
    const cssY  = Math.round((e.clientY - rect.top)  * (pdfH / rect.height))
    const pdfY  = pdfH - cssY - 8
    const entry = { cssX, cssY, pdfY, id: Date.now() }
    console.log(`COORD CLICK → x:${cssX}, cssY:${cssY}  (pdfY = ${pdfY})`)
    setCoord(entry)
    setClicks(prev => [...prev.slice(-19), entry])
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block', background: '#fff' }}>
      <canvas ref={canvasRef} onClick={handleClick} style={{ display: 'block', cursor: 'crosshair' }} />
      {clicks.map(c => (
        <div key={c.id} style={{ position: 'absolute', left: `${(c.cssX / canvasRef.current?.width) * 100}%`, top: `${(c.cssY / canvasRef.current?.height) * 100}%`, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', border: '1.5px solid #fff', transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 5 }} />
      ))}
      {coord && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: '#1e1b4b', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontFamily: 'monospace', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 100, whiteSpace: 'nowrap' }}>
          <span style={{ color: APP_YELLOW }}>x:</span> {coord.cssX}{'  '}
          <span style={{ color: APP_YELLOW }}>cssY:</span> {coord.cssY}{'  '}
          <span style={{ color: '#86efac' }}>pdfY:</span> {coord.pdfY}
          <button onClick={e => { e.stopPropagation(); setClicks([]); setCoord(null) }} style={{ marginLeft: 14, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 12 }}>clear</button>
        </div>
      )}
      <div style={{ position: 'absolute', top: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ background: `${APP_ACCENT}dd`, color: '#fff', borderRadius: 8, padding: '5px 14px', fontSize: 12, fontWeight: 600 }}>
          🎯 CALIBRATION MODE (page {page}) — click any field, read coords from console
        </div>
      </div>
    </div>
  )
}
