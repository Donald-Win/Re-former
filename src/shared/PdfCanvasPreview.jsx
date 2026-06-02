/**
 * PdfCanvasPreview
 *
 * Renders every page of a PDF (supplied as Uint8Array) onto stacked <canvas>
 * elements using pdfjs-dist, bundled locally via npm so the service worker
 * can cache it for offline use.
 *
 * pdfjs-dist v5+ uses .mjs worker — imported via Vite's ?url modifier so the
 * file is emitted to dist/assets/ and cached by the service worker.
 *
 * Layout-shift fix
 * ────────────────
 * The original code set `width: 100%` on each canvas but left height
 * unspecified. Before pdf.js rendered the page content, the canvas had zero
 * intrinsic height, so the scroll container collapsed and then snapped to
 * its full height when rendering completed — a jarring layout shift on every
 * page, particularly visible on multi-page forms.
 *
 * The fix sets `aspect-ratio: <width> / <height>` on each canvas element
 * immediately after the viewport is computed, before rendering begins.
 * The browser can then reserve the correct vertical space as soon as the
 * canvas is appended, so the container height is stable for the entire
 * render duration regardless of how long each page takes to paint.
 */
import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Configure the worker once at module load time.
// Vite resolves ?url to a hashed asset path the service worker will cache.
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

          const page = await pdfDoc.getPage(pageNum)
          if (cancelled) { page.cleanup(); break }

          // Scale so the canvas width fills the container at ~1x on retina;
          // 1.5 gives a good balance of sharpness vs memory.
          const viewport = page.getViewport({ scale: 1.5 })

          const canvas  = document.createElement('canvas')
          canvas.width  = viewport.width
          canvas.height = viewport.height

          // ── Aspect-ratio reservation ──────────────────────────────────────
          // Set aspect-ratio BEFORE appending to the DOM so the browser
          // reserves the correct height immediately. Without this the canvas
          // has zero intrinsic height until pdf.js finishes painting — causing
          // the scroll container to collapse and snap on each page, producing
          // a visible layout shift on multi-page documents.
          //
          // width: 100% makes the canvas fluid; aspect-ratio then drives the
          // height proportionally. The explicit canvas.width / canvas.height
          // values are the physical pixel dimensions (already scaled by 1.5),
          // so the ratio is always exact regardless of the PDF page size.
          canvas.style.cssText = [
            'width: 100%',
            `aspect-ratio: ${viewport.width} / ${viewport.height}`,
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
