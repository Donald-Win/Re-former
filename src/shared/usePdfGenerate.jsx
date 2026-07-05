/**
 * usePdfGenerate — shared PDF generation hook for all wizards.
 *
 * Usage:
 *   const { pdfBytes, pdfBlobUrl, pdfGenerating, pdfError,
 *           triggerGenerate, clearPdf, buildPreviewContent } = usePdfGenerate(generatorFn)
 *
 * Generator argument — two supported patterns
 * ────────────────────────────────────────────
 * (a) Direct function — called immediately as `fn(d, photos)`. This covers
 *     both a plain synchronous/async generator function AND the worker-backed
 *     wrapper every wizard now uses by default (see below):
 *       import { createWorkerGenerator } from '../shared/pdfWorkerClient'
 *       const generatePolePdf = createWorkerGenerator('PolePdfGenerator', 'generatePolePdf')
 *       usePdfGenerate(generatePolePdf)
 *
 * (b) Zero-argument thunk returning a Promise that resolves to the generator
 *     function (kept for any generator that still wants plain main-thread
 *     code-splitting without the worker):
 *       const loadEEGenerator = () =>
 *         import('./generators/ElecEquipPdfGenerator').then(m => m.generateEEPdf)
 *       usePdfGenerate(loadEEGenerator)
 *
 * Detection: a thunk is distinguished from a direct generator by `.length === 0`
 * (zero declared parameters). Every worker-backed generator created via
 * createWorkerGenerator() declares 2 parameters (d, photos), so it is always
 * treated as pattern (a) and called directly — no change was needed here
 * when wizards were switched over to the worker.
 *
 * Web Worker — off-main-thread generation (v2.19.0: now the default path)
 * ──────────────────────────────────────────────────────────────────────
 * Every wizard generates its PDF via src/workers/pdfGen.worker.js through
 * src/shared/pdfWorkerClient.js's createWorkerGenerator(). appendPhotosToPdf
 * already supports running inside a worker (it falls back to
 * OffscreenCanvas/createImageBitmap when `document` is undefined), so the
 * full generation pipeline — fetch template, draw fields, embed photos — is
 * DOM-free and runs entirely off the main thread.
 *
 * Race-condition guard
 * ────────────────────
 * genIdRef increments on every triggerGenerate call and on unmount. A
 * resolved Promise that finds its id stale discards its result silently.
 *
 * Generation timeout
 * ──────────────────
 * A 30-second timeout races against the generator. On expiry the user sees
 * a distinct "timed out" message instead of an infinite spinner.
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { PdfCanvasPreview } from './PdfCanvasPreview'

const GENERATION_TIMEOUT_MS = 30_000

export function usePdfGenerate(generatorFn) {
  const [pdfBytes,      setPdfBytes]      = useState(null)
  const [pdfBlobUrl,    setPdfBlobUrl]    = useState(null)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [pdfError,      setPdfError]      = useState(null)

  const genIdRef   = useRef(0)
  const blobUrlRef = useRef(null)

  // ── Unmount cleanup ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      genIdRef.current += 1
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [])

  const triggerGenerate = useCallback((d, photos = []) => {
    const myGenId = ++genIdRef.current

    setPdfBytes(null)
    setPdfBlobUrl(null)
    setPdfGenerating(true)
    setPdfError(null)

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }

    // ── Timeout race ──────────────────────────────────────────────────────────
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('GENERATION_TIMEOUT')),
        GENERATION_TIMEOUT_MS,
      )
    )

    // ── Generator resolution ──────────────────────────────────────────────────
    // A thunk (length === 0) is a lazy import factory: () => Promise<generatorFn>.
    // A direct generator (length >= 1) is called immediately with (d, photos).
    const runGeneration = async () => {
      let fn = generatorFn
      if (typeof generatorFn === 'function' && generatorFn.length === 0) {
        fn = await generatorFn()
      }
      return fn(d, photos)
    }

    Promise.race([runGeneration(), timeoutPromise])
      .then(result => {
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
        if (myGenId !== genIdRef.current) return

        console.error('PDF generation failed:', err)

        const isTimeout = err.message === 'GENERATION_TIMEOUT'
        setPdfError(
          isTimeout
            ? 'Generation timed out — check your connection and try again.'
            : 'Could not generate PDF — please try again.',
        )
        setPdfGenerating(false)
      })
  }, [generatorFn])

  const clearPdf = useCallback(() => {
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
   * Pass onRetry (calls triggerGenerate) and the wizard accent colour.
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
        <div style={{ fontSize: 14, color: '#f87171', marginBottom: 12, textAlign: 'center', padding: '0 24px' }}>
          {pdfError}
        </div>
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
