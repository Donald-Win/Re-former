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
 *
 * Race-condition guard
 * ────────────────────
 * If the user reaches the preview step, then quickly navigates back and
 * forward again before the first generation completes, two concurrent
 * generator Promises are in flight.  Without a guard the slower one could
 * resolve last and overwrite the results from the newer call.
 *
 * We use a generation-counter ref (genIdRef).  Each triggerGenerate call
 * stamps its own id.  When the Promise resolves it checks whether its id
 * still matches the current counter — if not, the result is silently
 * discarded and the stale blob URL is immediately revoked.
 *
 * Unmount safety
 * ──────────────
 * The same counter is incremented in the cleanup returned by a useEffect,
 * so any in-flight generation that completes after the wizard is closed
 * will also find its id stale and discard cleanly.
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { PdfCanvasPreview } from './PdfCanvasPreview'

export function usePdfGenerate(generatorFn) {
  const [pdfBytes,      setPdfBytes]      = useState(null)
  const [pdfBlobUrl,    setPdfBlobUrl]    = useState(null)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [pdfError,      setPdfError]      = useState(null)

  // Tracks the most recent generation attempt.
  // Incremented on every triggerGenerate call and on unmount.
  const genIdRef   = useRef(0)
  // Holds the blob URL so it can be revoked without reading from state
  // (reading state inside an async callback captures a stale closure).
  const blobUrlRef = useRef(null)

  // ── Unmount cleanup ───────────────────────────────────────────────────────
  // Invalidate any in-flight generation when the wizard unmounts so it cannot
  // update state on an already-unmounted component.
  useEffect(() => {
    return () => {
      genIdRef.current += 1   // mark all outstanding generations as stale
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [])

  const triggerGenerate = useCallback((d, photos = []) => {
    // Stamp this generation attempt with a unique id
    const myGenId = ++genIdRef.current

    setPdfBytes(null)
    setPdfBlobUrl(null)
    setPdfGenerating(true)
    setPdfError(null)

    // Revoke the previous blob URL synchronously before starting the new gen
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }

    Promise.resolve(generatorFn(d, photos))
      .then(result => {
        // Discard if a newer generation has already started (or unmounted)
        if (myGenId !== genIdRef.current) return

        const bytes = result instanceof Uint8Array ? result : new Uint8Array(result)
        const blob  = new Blob([bytes], { type: 'application/pdf' })
        const url   = URL.createObjectURL(blob)
        blobUrlRef.current = url

        setPdfBytes(bytes)
        setPdfBlobUrl(url)
        setPdfGenerating(false)
      })
      .catch(err => {
        // Discard if stale
        if (myGenId !== genIdRef.current) return

        console.error('PDF generation failed:', err)
        setPdfError('Could not generate PDF — please try again.')
        setPdfGenerating(false)
      })
  }, [generatorFn])

  const clearPdf = useCallback(() => {
    // Increment counter so any in-flight generation treats itself as stale
    genIdRef.current += 1
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
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '100%', color: '#9ca3af',
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Generating PDF…</div>
      </div>
    )
    if (pdfError) return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '100%',
      }}>
        <div style={{ fontSize: 14, color: '#f87171', marginBottom: 12 }}>{pdfError}</div>
        <button
          onClick={onRetry}
          style={{
            padding: '10px 20px', borderRadius: 8, border: 'none',
            background: accent, color: '#fff',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
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
