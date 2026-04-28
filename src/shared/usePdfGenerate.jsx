/**
 * usePdfGenerate — shared PDF generation hook for all wizards.
 *
 * Usage:
 *   const { pdfBytes, pdfBlobUrl, pdfGenerating, pdfError,
 *           triggerGenerate, clearPdf, buildPreviewContent } = usePdfGenerate(generateMyPdf)
 *
 *   // Trigger generation (e.g. when navigating to preview step):
 *   triggerGenerate(d, photos)
 *
 *   // Build the preview panel:
 *   previewContent={buildPreviewContent(() => triggerGenerate(d, photos), accent)}
 *
 *   // Close preview:
 *   onClosePreview={() => { setStep(s => s - 1); clearPdf() }}
 */
import { useState, useRef, useCallback } from 'react'
import { PdfCanvasPreview } from './PdfCanvasPreview'

export function usePdfGenerate(generatorFn) {
  const [pdfBytes,       setPdfBytes]       = useState(null)
  const [pdfBlobUrl,     setPdfBlobUrl]     = useState(null)
  const [pdfGenerating,  setPdfGenerating]  = useState(false)
  const [pdfError,       setPdfError]       = useState(null)
  const blobUrlRef = useRef(null)

  const triggerGenerate = useCallback((d, photos = []) => {
    setPdfBytes(null); setPdfBlobUrl(null)
    setPdfGenerating(true); setPdfError(null)

    Promise.resolve(generatorFn(d, photos))
      .then(result => {
        // Accept both Uint8Array and ArrayBuffer from different generators
        const bytes = result instanceof Uint8Array ? result : new Uint8Array(result)
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        const blob = new Blob([bytes], { type: 'application/pdf' })
        const url  = URL.createObjectURL(blob)
        blobUrlRef.current = url
        setPdfBytes(bytes); setPdfBlobUrl(url); setPdfGenerating(false)
      })
      .catch(err => {
        console.error('PDF generation failed:', err)
        setPdfError('Could not generate PDF — please try again.')
        setPdfGenerating(false)
      })
  }, [generatorFn])

  const clearPdf = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setPdfBytes(null)
    setPdfBlobUrl(null)
  }, [])

  /**
   * Returns the standard spinner / error / canvas preview node.
   * Pass onRetry (a fn that calls triggerGenerate) and the wizard accent colour.
   */
  const buildPreviewContent = useCallback((onRetry, accent) => {
    if (pdfGenerating) return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Generating PDF…</div>
      </div>
    )
    if (pdfError) return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ fontSize: 14, color: '#f87171', marginBottom: 12 }}>{pdfError}</div>
        <button
          onClick={onRetry}
          style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    )
    if (pdfBytes) return <PdfCanvasPreview pdfBytes={pdfBytes} />
    return null
  }, [pdfGenerating, pdfError, pdfBytes])

  return {
    pdfBytes,
    pdfBlobUrl,
    pdfGenerating,
    pdfError,
    triggerGenerate,
    clearPdf,
    buildPreviewContent,
  }
}
