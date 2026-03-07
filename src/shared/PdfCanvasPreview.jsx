import React, { useEffect, useRef } from 'react'

const PDFJS_VERSION = '3.11.174'

const loadScript = src => new Promise((res, rej) => {
  if (document.querySelector(`script[src="${src}"]`)) { res(); return }
  const s = document.createElement('script')
  s.src = src; s.onload = res; s.onerror = rej
  document.head.appendChild(s)
})

export function PdfCanvasPreview({ pdfBytes }) {
  const containerRef = useRef(null)
  const renderingRef = useRef(false)

  useEffect(() => {
    if (!pdfBytes || !containerRef.current) return
    if (renderingRef.current) return
    renderingRef.current = true
    const container = containerRef.current
    container.innerHTML = '';
    (async () => {
      try {
        await loadScript(`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`)
        const lib = window['pdfjs-dist/build/pdf']
        lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`
        const pdf   = await lib.getDocument({ data: pdfBytes.slice() }).promise
        const scale = window.devicePixelRatio >= 2 ? 2 : 1.5
        for (let n = 1; n <= Math.min(pdf.numPages, 3); n++) {
          const page  = await pdf.getPage(n)
          const vp    = page.getViewport({ scale })
          const wrap  = document.createElement('div')
          wrap.style.cssText = `width:100%;background:#fff;${n > 1 ? 'marginTop:8px;' : ''}`
          const canvas = document.createElement('canvas')
          canvas.width = vp.width; canvas.height = vp.height
          canvas.style.cssText = 'width:100%;display:block;'
          wrap.appendChild(canvas); container.appendChild(wrap)
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
        }
        renderingRef.current = false
      } catch (err) { console.error('pdf.js render failed:', err); renderingRef.current = false }
    })()
    return () => { renderingRef.current = false }
  }, [pdfBytes])

  return <div ref={containerRef} style={{ width: '100%' }} />
}
