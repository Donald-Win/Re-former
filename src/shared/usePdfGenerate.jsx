/**
 * usePdfGenerate — shared PDF generation hook for all wizards.
 *
 * Usage:
 *   const { pdfBytes, pdfBlobUrl, pdfGenerating, pdfError,
 *           triggerGenerate, clearPdf, buildPreviewContent } = usePdfGenerate(generatorFn)
 *
 * Generator argument — two supported patterns
 * ────────────────────────────────────────────
 * (a) Direct function (original API — fully backward-compatible):
 *       import { generateEEPdf } from './generators/ElecEquipPdfGenerator'
 *       usePdfGenerate(generateEEPdf)
 *
 * (b) Zero-argument thunk returning a Promise that resolves to the generator
 *     function (preferred — enables Vite code-splitting per wizard):
 *       // Define at module scope so the reference is stable across renders:
 *       const loadEEGenerator = () =>
 *         import('./generators/ElecEquipPdfGenerator').then(m => m.generateEEPdf)
 *
 *       usePdfGenerate(loadEEGenerator)
 *
 *     The thunk is resolved on each triggerGenerate call; the browser's
 *     native module cache means the network round-trip only happens once.
 *
 * Detection: a thunk is distinguished from a direct generator by `.length === 0`
 * (zero declared parameters).  All project generators declare at least one
 * parameter (`d`), so the heuristic is reliable for this codebase.
 *
 * Web Worker — Comlink scaffold
 * ──────────────────────────────
 * appendPhotosToPdf now uses OffscreenCanvas/createImageBitmap when running
 * inside a worker, so the full generation pipeline is worker-safe.
 *
 * To offload generation off the main thread:
 *   1. npm i comlink
 *   2. Use src/workers/pdfGen.worker.js (ready-to-use scaffold).
 *   3. In the wizard, wrap the worker call in a thunk and pass it here:
 *
 *       import PdfGenWorker from '../workers/pdfGen.worker.js?worker'
 *       import * as Comlink from 'comlink'
 *
 *       // Create once at module scope:
 *       const _w  = new PdfGenWorker()
 *       const api = Comlink.wrap(_w)
 *
 *       // Thunk passed to the hook (d and photos come from triggerGenerate):
 *       const genThunk = (d, photos) =>
 *         api.generate('ElecEquipPdfGenerator', 'generateEEPdf', d, photos)
 *
 *       usePdfGenerate(genThunk)
 *
 *   Note: when routing through a worker the function receives (d, photos)
 *   directly (length > 0), so the hook treats it as a direct generator and
 *   calls it normally — no changes needed below.
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
