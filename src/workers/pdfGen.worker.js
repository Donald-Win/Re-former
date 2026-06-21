/**
 * pdfGen.worker.js — Comlink-based Web Worker for off-main-thread PDF generation.
 *
 * Prerequisites
 * ─────────────
 *   npm i comlink
 *
 * Vite bundles this file as a separate worker chunk (via the ?worker suffix
 * on the import in the calling module). All generator dynamic imports listed
 * in GENERATORS are statically visible to Rollup so they are included in the
 * worker chunk at build time.
 *
 * appendPhotosToPdf uses OffscreenCanvas / createImageBitmap when running
 * inside a worker (detected via `typeof document === 'undefined'`), so the
 * full pipeline — fetch template, draw fields, embed photos — is DOM-free.
 *
 * Usage in a wizard
 * ─────────────────
 * Replace the direct generator import with a worker-backed thunk.
 * Create both objects at module scope (outside the component) so they are
 * only initialised once:
 *
 *   import PdfGenWorker from '../workers/pdfGen.worker.js?worker'
 *   import * as Comlink  from 'comlink'
 *
 *   const _worker = new PdfGenWorker()
 *   const pdfApi  = Comlink.wrap(_worker)
 *
 *   // Inside the component, pass a stable thunk to usePdfGenerate.
 *   // d and photos are NOT captured here — they are forwarded by
 *   // triggerGenerate(d, photos) at call time:
 *   const { triggerGenerate, ... } = usePdfGenerate(
 *     (d, photos) => pdfApi.generate('ElecEquipPdfGenerator', 'generateEEPdf', d, photos)
 *   )
 *
 * The generate() function returns a Comlink-transferred Uint8Array (zero-copy
 * transfer of the underlying ArrayBuffer from worker to main thread).
 *
 * Terminating the worker
 * ──────────────────────
 * Call `_worker.terminate()` (and `pdfApi[Comlink.releaseProxy]()`) in the
 * wizard's cleanup / unmount effect if you want to free worker memory when
 * the wizard closes. For this app's usage pattern (one wizard open at a time)
 * a single long-lived worker per wizard type is acceptable.
 */

import * as Comlink from 'comlink'

// ── Generator registry ────────────────────────────────────────────────────────
// All dynamic imports must be listed explicitly so Vite/Rollup can analyse
// and bundle them into the worker chunk at build time.
const GENERATORS = {
  ElecEquipPdfGenerator:
    () => import('../wizards/generators/ElecEquipPdfGenerator.js'),
  ElecDistributionPdfGenerator:
    () => import('../wizards/generators/ElecDistributionPdfGenerator.js'),
  HVInspectionPdfGenerator:
    () => import('../wizards/generators/HVInspectionPdfGenerator.js'),
  LvBoxPdfGenerator:
    () => import('../wizards/generators/LvBoxPdfGenerator.js'),
  LvConnectionPdfGenerator:
    () => import('../wizards/generators/LvConnectionPdfGenerator.js'),
  PolePdfGenerator:
    () => import('../wizards/generators/PolePdfGenerator.js'),
  TransformerPdfGenerator:
    () => import('../wizards/generators/TransformerPdfGenerator.js'),
  ZoneSubPdfGenerator:
    () => import('../wizards/generators/ZoneSubPdfGenerator.js'),
}

// ── Exposed API ───────────────────────────────────────────────────────────────

Comlink.expose({
  /**
   * Load a generator module, run it, and return the PDF bytes.
   *
   * @param {string} generatorKey  - Key in GENERATORS (e.g. 'ElecEquipPdfGenerator')
   * @param {string} exportName    - Named export in the module  (e.g. 'generateEEPdf')
   * @param {object} d             - Wizard form state
   * @param {Array}  photos        - Photo attachments [{ dataUrl, name? }]
   * @returns {Promise<Uint8Array>}  Transferred zero-copy to the main thread
   */
  async generate(generatorKey, exportName, d, photos) {
    const loader = GENERATORS[generatorKey]
    if (!loader) {
      throw new Error(`[pdfGen.worker] Unknown generator: "${generatorKey}". ` +
        `Valid keys: ${Object.keys(GENERATORS).join(', ')}`)
    }

    const mod = await loader()
    const fn  = mod[exportName]
    if (typeof fn !== 'function') {
      throw new Error(
        `[pdfGen.worker] Export "${exportName}" is not a function in ${generatorKey}`
      )
    }

    const bytes = await fn(d, photos)

    // Transfer the underlying ArrayBuffer zero-copy back to the main thread.
    // After this call the worker's copy of `bytes` is detached / unusable.
    return Comlink.transfer(bytes, [bytes.buffer])
  },
})
