/**
 * PdfCanvasPreview
 *
 * Renders every page of a PDF (supplied as Uint8Array) onto stacked <canvas>
 * elements using pdf.js loaded from CDN.
 *
 * Fixes vs previous version:
 *   - No page cap — all pages rendered regardless of count
 *   - Container cleared before every new render; no canvas accumulation
 *   - In-flight renders cancelled when pdfBytes changes or component unmounts
 *   - Single pdf.js load — cached on window.pdfjsLib after first use
 */
import { useEffect, useRef, useState } from 'react'

const PDFJS_VERSION = '3.11.174'
const PDFJS_CDN     = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`

/** Load pdf.js once; subsequent calls return immediately. */
function ensurePdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib)

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `${PDFJS_CDN}/pdf.min.js`
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        `${PDFJS_CDN}/pdf.worker.min.js`
      resolve(window.pdfjsLib)
    }
    script.onerror = () => reject(new Error('Failed to load pdf.js'))
    document.head.appendChild(script)
  })
}

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
        const pdfjsLib = await ensurePdfJs()
        if (cancelled) return

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
