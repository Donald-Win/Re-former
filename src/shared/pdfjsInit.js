/**
 * pdfjsInit.js — Single-point initialisation for pdfjs-dist's web worker.
 *
 * pdfjs-dist v5+ requires its worker to be loaded via a URL so the browser
 * can spawn it as a separate thread. Vite's `?url` modifier resolves the
 * worker import to a hashed, service-worker-friendly asset path at build time.
 *
 * Why this file exists
 * ────────────────────
 * Previously both PdfCanvasPreview.jsx and CoordOverlay.jsx independently
 * imported pdfjs-dist and assigned GlobalWorkerOptions.workerSrc. Vite
 * deduplicates the module so only one assignment runs in practice, but having
 * two files that both "own" global worker configuration is fragile — adding a
 * third PDF-rendering component would silently require another duplicate.
 *
 * Centralising here makes the initialisation explicit and adds a guard so the
 * assignment only fires once even in unusual test or SSR contexts.
 *
 * Usage
 * ─────
 *   import { pdfjsLib } from '../shared/pdfjsInit'
 *   // pdfjsLib is the fully-configured pdfjs-dist namespace object.
 *   const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
 */

import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Only assign if not already set so this module is idempotent even if
// multiple hot-reload cycles re-evaluate it during development.
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc
}

export { pdfjsLib }
