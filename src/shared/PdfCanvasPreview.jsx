/**
 * PdfCanvasPreview
 *
 * Renders every page of a PDF (supplied as Uint8Array) onto stacked <canvas>
 * elements using pdfjs-dist, bundled locally via npm so the service worker
 * can cache it for offline use.
 *
 * Key change vs the previous version:
 *   - pdfjs-dist is now imported from npm (not loaded dynamically from CDN).
 *   - Vite emits the worker as a hashed asset; the service worker caches it
 *     on first visit, so PDF preview works fully offline thereafter.
 *   - All rendering logic is unchanged.
 */
import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url'

// Configure the worker once at module load time.
// The ?url import tells Vite to copy the worker file to dist/assets/ and
// return its hashed URL — the service worker will cache it automatically.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc

export function PdfCanvasPreview({ pdfBytes }) {
  const containerRef  = useRef(null)
  const [status, setStatus] = useState('idle') // 'idle' | 'rendering' | 'done' | 'error'

  useEffect(() => {
    const container = containerRef.current
    if (!pdfBytes || !container) return

    let cancelled = false
    let pdfDoc    = null

    // ── Immediately clear any canvases from a previous render ───────────────
    container.innerHTML = ''
    setStatus('rendering')

    ;(async () => {
      try {
        // Pass a copy so pdf.js can't accidentally transfer/mutate our bytes
        const task = pdfjsLib.getDocument({ data: pdfBytes.slice() })
        pdfDoc = await task.promise
        if (cancelled) { pdfDoc.destroy(); return }

        const total = pdfDoc.numPages

        for (let pageNum = 1; pageNum <= total; pageNum++) {
          if (cancelled) break

          const page     = await pdfDoc.getPage(pageNum)
          if (cancelled) { page.cleanup(); break }

          // Scale so the canvas width fills the container at ~1x on retina;
          // 1.5 gives a good balance of sharpness vs memory.
          const viewport = page.getViewport({ scale: 1.5 })
          const canvas   = document.createElement('canvas')
          canvas.width   = viewport.width
          canvas.height  = viewport.height

          // Fluid width; height scales proportionally via aspect-ratio trick
          canvas.style.cssText = [
            'width: 100%',
            'display: block',
            'margin-bottom: 8px',
            'border-radius: 4px',
            'box-shadow: 0 1px 6px rgba(0,0,0,0.18)',
          ].join(';')

          if (cancelled) { page.cleanup(); break }
          container.appendChild(canvas)

          await page.render({
            canvasContext: canvas.getContext('2d'),
            viewport,
          }).promise

          page.cleanup()
        }

        if (!cancelled) {
          setStatus('done')
          pdfDoc.destroy()
          pdfDoc = null
        }

      } catch (err) {
        if (!cancelled) {
          console.error('PdfCanvasPreview render error:', err)
          setStatus('error')
        }
      }
    })()

    // ── Cleanup: cancel render, destroy doc, wipe canvases ──────────────────
    return () => {
      cancelled = true
      if (pdfDoc) {
        try { pdfDoc.destroy() } catch (_) {}
        pdfDoc = null
      }
      // Wipe any partially-rendered canvases so the next render starts clean
      container.innerHTML = ''
    }
  }, [pdfBytes])

  return (
    <div style={{ background: '#d1d5db', padding: '8px', minHeight: 40 }}>
      {status === 'rendering' && (
        <div style={{
          textAlign: 'center', padding: '20px 0',
          color: '#6b7280', fontSize: 13, fontWeight: 600,
        }}>
          Rendering pages…
        </div>
      )}
      {status === 'error' && (
        <div style={{
          textAlign: 'center', padding: '20px 0',
          color: '#f87171', fontSize: 13,
        }}>
          Could not render PDF preview.
        </div>
      )}
      <div ref={containerRef} />
    </div>
  )
}
