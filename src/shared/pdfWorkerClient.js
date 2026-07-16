/**
 * pdfWorkerClient.js — Shared Comlink client for the PDF-generation Web
 * Worker (src/workers/pdfGen.worker.js).
 *
 * A single worker instance is created lazily and reused for every PDF
 * generation across every wizard for the lifetime of the app session. This
 * is what actually moves PDF generation off the main thread: the pdf-lib
 * template load, every field draw call, and JPEG re-compression of attached
 * photos now all run on a background thread, so the UI never freezes while
 * a form generates.
 *
 * ── Worker crash recovery (v2.20.3) ──────────────────────────────────────
 * A Web Worker can die silently — most commonly from running out of memory
 * while processing a large batch of photo attachments. When that happens:
 *   - The in-flight Comlink call never resolves or rejects on its own.
 *   - No JS exception is thrown on the main thread.
 *   - Every subsequent call to the SAME dead worker instance also hangs,
 *     because Comlink is still waiting on a postMessage reply that will
 *     never arrive.
 * Previously the module-level `_worker`/`pdfApi` were created once and
 * never replaced, so a single crash permanently broke PDF generation for
 * the rest of the session — every later attempt would silently hang until
 * usePdfGenerate's 30-second UI timeout fired, and then hang again on
 * retry, forever, since the same wedged worker was still being used.
 *
 * Two layers of recovery are used together:
 *   1. Proactive: the worker's own 'error' and 'messageerror' events tear
 *      down the current worker/proxy immediately, so the NEXT call starts
 *      fresh rather than reusing a known-bad instance.
 *   2. Reactive: each generate() call races against its own internal
 *      timeout (shorter than the UI's 30s timeout in usePdfGenerate, so it
 *      fires first). If a call times out — which covers the "died silently,
 *      no error event, just never replies" case — the worker is torn down
 *      and recreated so the *next* attempt isn't guaranteed to hang too.
 *      The failed call still surfaces its error to the caller as normal;
 *      usePdfGenerate's existing retry button already lets the tech try
 *      again, and that retry now gets a healthy worker.
 *
 * Usage (see any wizard file for a live example):
 *   import { createWorkerGenerator } from '../shared/pdfWorkerClient'
 *
 *   // Module scope — created once, not per render:
 *   const generatePolePdf = createWorkerGenerator('PolePdfGenerator', 'generatePolePdf')
 *
 *   // Inside the component:
 *   const { triggerGenerate, ... } = usePdfGenerate(generatePolePdf)
 *
 * Why no change was needed in usePdfGenerate.jsx:
 * createWorkerGenerator returns a plain 2-argument function,
 * `(d, photos) => Promise<Uint8Array>`. usePdfGenerate's thunk-detection
 * (`generatorFn.length === 0`) only treats *zero*-argument functions as a
 * lazy-import thunk to be resolved before calling; a 2-argument function is
 * treated as a "direct generator" and called immediately as `fn(d, photos)`
 * — which is exactly what this returns. So this drops in as a straight
 * replacement for the old lazy-import thunks.
 */
import PdfGenWorker from '../workers/pdfGen.worker.js?worker'
import * as Comlink from 'comlink'

// Fires before usePdfGenerate's 30s UI-facing GENERATION_TIMEOUT_MS, so a
// wedged worker is detected and torn down here first, rather than the user
// only ever seeing the generic "Generation timed out" UI message forever.
const WORKER_CALL_TIMEOUT_MS = 25_000

let _worker = null
let _pdfApi = null

function destroyWorker() {
  if (_worker) {
    try { _worker.terminate() } catch (_) { /* already dead — fine */ }
  }
  _worker = null
  _pdfApi = null
}

function getApi() {
  if (_pdfApi) return _pdfApi

  const worker = new PdfGenWorker()

  // Proactive recovery: if the worker throws an uncaught error or sends a
  // message that can't be deserialised, treat it as dead immediately so the
  // next call gets a brand-new instance instead of reusing this one.
  const onFailure = (event) => {
    console.error('[pdfWorkerClient] PDF worker crashed — it will be recreated on the next request', event)
    destroyWorker()
  }
  worker.addEventListener('error', onFailure)
  worker.addEventListener('messageerror', onFailure)

  _worker = worker
  _pdfApi = Comlink.wrap(worker)
  return _pdfApi
}

/**
 * @param {string} generatorKey - Key in the worker's GENERATORS registry (e.g. 'PolePdfGenerator')
 * @param {string} exportName   - Named export in that module (e.g. 'generatePolePdf')
 * @returns {(d: object, photos: Array) => Promise<Uint8Array>}
 */
export function createWorkerGenerator(generatorKey, exportName) {
  return async (d, photos) => {
    const api = getApi()

    let timeoutId = null
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('PDF_WORKER_TIMEOUT')), WORKER_CALL_TIMEOUT_MS)
    })

    try {
      const result = await Promise.race([
        api.generate(generatorKey, exportName, d, photos),
        timeout,
      ])
      clearTimeout(timeoutId)
      return result
    } catch (err) {
      clearTimeout(timeoutId)
      // Whether this was a genuine rejection or our own timeout firing
      // because the worker silently died, the worker can no longer be
      // trusted — tear it down so the NEXT attempt (e.g. the tech tapping
      // "Retry") starts from a clean worker rather than hanging again.
      console.error('[pdfWorkerClient] PDF generation failed or hung — recreating worker', err)
      destroyWorker()
      throw err
    }
  }
}
