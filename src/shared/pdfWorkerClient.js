/**
 * pdfWorkerClient.js — Shared Comlink client for the PDF-generation Web
 * Worker (src/workers/pdfGen.worker.js).
 *
 * A single worker instance is created once, at module load, and reused for
 * every PDF generation across every wizard for the lifetime of the app
 * session. This is what actually moves PDF generation off the main thread:
 * the pdf-lib template load, every field draw call, and JPEG
 * re-compression of attached photos now all run on a background thread, so
 * the UI never freezes while a form generates.
 *
 * Previously every wizard's "load generator" thunk (e.g.
 * `() => import('./generators/PolePdfGenerator').then(m => m.generatePolePdf)`)
 * only code-split the generator's *bundle* — the function itself still ran
 * on the main thread once the import resolved, which could visibly stall
 * the app for 500ms-2s on a tablet with several photos attached. The
 * worker scaffold (pdfGen.worker.js) already existed for this but wasn't
 * wired into any wizard — this file is the missing wiring.
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

// One worker, one Comlink proxy, for the whole app session.
const _worker = new PdfGenWorker()
const pdfApi  = Comlink.wrap(_worker)

/**
 * @param {string} generatorKey - Key in the worker's GENERATORS registry (e.g. 'PolePdfGenerator')
 * @param {string} exportName   - Named export in that module (e.g. 'generatePolePdf')
 * @returns {(d: object, photos: Array) => Promise<Uint8Array>}
 */
export function createWorkerGenerator(generatorKey, exportName) {
  return (d, photos) => pdfApi.generate(generatorKey, exportName, d, photos)
}
