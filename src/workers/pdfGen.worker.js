/**
 * pdfGen.worker.js — Comlink-based Web Worker for off-main-thread PDF generation.
 *
 * Status: WIRED IN (v2.19.0). Every wizard now generates its PDF through
 * this worker via src/shared/pdfWorkerClient.js — see that file for the
 * client-side half of this. Previously this file existed as scaffolding
 * only and nothing called into it; all 9 generators were still running on
 * the main thread.
 *
 * appendPhotosToPdf already supports running inside a worker (it falls back
 * to OffscreenCanvas / createImageBitmap when running here, detected via
 * `typeof document === 'undefined'`), so the full pipeline — fetch
 * template, draw fields, embed photos — is DOM-free and safe to run here.
 *
 * Usage
 * ─────
 * Don't call this file directly — go through pdfWorkerClient.js:
 *
 *   import { createWorkerGenerator } from '../shared/pdfWorkerClient'
 *   const generateXPdf = createWorkerGenerator('XPdfGenerator', 'generateXPdf')
 *   const { triggerGenerate } = usePdfGenerate(generateXPdf)
 *
 * Terminating the worker
 * ──────────────────────
 * Not currently done — a single long-lived worker per app session is fine
 * for this app's usage pattern (one wizard open at a time). If a future
 * change needs to free worker memory, call `_worker.terminate()` in
 * pdfWorkerClient.js.
 */

import * as Comlink from 'comlink'

// ── Generator registry ────────────────────────────────────────────────────────
// All dynamic imports must be listed explicitly so Vite/Rollup can analyse
// and bundle them into the worker chunk at build time.
const GENERATORS = {
  DistributionTransformerPdfGenerator:
    () => import('../wizards/generators/DistributionTransformerPdfGenerator.js'),
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
