/**
 * HVInspectionPdfGenerator.js — PDF generator for 220F028A
 * (Pre-Commissioning HV Inspection Certificate).
 *
 * EQUIP_TYPES and all check-row arrays are exported so HVInspectionWizard.jsx
 * can import them directly, avoiding duplicate definitions.
 *
 * This form is mostly one big tick-grid (13 equipment-type columns × ~40
 * check rows across two pages), which is exactly the case that doesn't
 * benefit from the single-field FIELDS model — there's no calibration win
 * to be had naming 500+ individual cells when the whole grid only needs a
 * handful of shared column positions and per-section row positions. Those
 * stay as small loops reading from GRIDS, structured the same way as every
 * other generator's repeating tables.
 *
 * The few genuinely simple, individually-positioned fields (the page 1
 * title, the page 3 signature block, and the three "Other (Specify)"
 * labels) are declared in FIELDS as usual.
 *
 * PERF_ROW_OFFSET (v2.20.4)
 * ──────────────────────────
 * Operation and Performance checks share one combined row array
 * (GRIDS.operationPerformance.rowY) — Operation occupies the first N rows,
 * Performance starts right after. PERF_ROW_OFFSET used to be a hardcoded
 * `4`, matched by hand to OPERATION_CHECKS' length (which happens to be 4).
 * That's the same silent index-coupling trap that VISUAL_NA/OPERATION_NA/
 * PERFORMANCE_NA were rewritten to avoid in HVInspectionChecks.js: if
 * OPERATION_CHECKS ever gained or lost a row, every Performance tick would
 * silently land one row off from its intended equipment column, with
 * nothing to catch it. PERF_ROW_OFFSET is now derived directly from
 * OPERATION_CHECKS.length, so it can never drift out of sync with the
 * array it depends on.
 *
 * Coordinate convention
 * ─────────────────────
 * All Y values are TOP-ORIGIN (CSS / screen style). renderFields converts
 * them to pdf-lib bottom-origin internally.
 *
 * @param {object} d      – Wizard form state (see HVInspectionWizard.jsx)
 * @param {Array}  photos – Array of { dataUrl: string, name?: string }
 * @returns {Promise<Uint8Array>}
 */

import { PDFDocument, StandardFonts } from 'pdf-lib'
import { fetchPdfTemplate, createPageDrawer, DEFAULT_INK, A4_HEIGHT } from '../../shared/pdfDrawUtils'
import { renderFields } from '../../shared/pdfFieldRenderer'
import { appendPhotosToPdf } from '../../shared/appendPhotosToPdf'
import {
  EQUIP_TYPES,
  VISUAL_CHECKS,
  OPERATION_CHECKS,
  PERFORMANCE_CHECKS,
  QA_CHECKS,
  DOC_CHECKS,
  OTHER_CHECKS,
} from './HVInspectionChecks'

const getTemplateUrl = () =>
  `${import.meta.env.BASE_URL}forms/220F028A.pdf`

// Performance rows occupy the lower portion of the combined p2 rowY array,
// immediately after Operation's rows. Derived from OPERATION_CHECKS.length
// (rather than hardcoded) so this can never drift out of sync with that
// array — see the file header for the bug this fixes.
const PERF_ROW_OFFSET = OPERATION_CHECKS.length

// ─────────────────────────────────────────────────────────────────────────────
// FIELDS — the handful of individually-positioned fields on this form.
// ─────────────────────────────────────────────────────────────────────────────

export const FIELDS = {
  p1: {
    // Composite project title — npJobNumber, projectName, streetRoad, cityTown, siteId
    title: {
      type: 'text', align: 'left', x: 135, y: 107, size: 10,
      value: d => [d.npJobNumber, d.projectName, d.streetRoad, d.cityTown, d.siteId].filter(Boolean).join(' — '),
    },
  },
  p2: {
    // "Other (Specify)" row labels — fixed 3 rows, ticks for these rows live in GRIDS.other
    otherLabel1: { type: 'text', align: 'left', x: 135, y: 639, size: 9, value: d => d.other1 },
    otherLabel2: { type: 'text', align: 'left', x: 135, y: 657, size: 9, value: d => d.other2 },
    otherLabel3: { type: 'text', align: 'left', x: 135, y: 676, size: 9, value: d => d.other3 },
  },
  p3: {
    wtlName:   { type: 'text', align: 'left', x: 193, y: 115, size: 10, value: d => d.wtlName },
    wtlCertNo: { type: 'text', align: 'left', x: 193, y: 141, size: 10, value: d => d.wtlCertNo },
    date:      { type: 'text', align: 'left', x: 383, y: 141, size: 10, value: d => d.dateWorkCompleted },
    fsName:    { type: 'text', align: 'left', x: 173, y: 192, size: 10, value: d => d.fsName },
    sinNapa:   { type: 'text', align: 'left', x: 140, y: 229, size: 10, value: d => d.fsSinNapa },
    wtlSig:    { type: 'signature', x: 383, y: 106, maxW: 100, maxH: 22, value: d => d.wtlSigned },
    fsSig:     { type: 'signature', x: 383, y: 182, maxW: 100, maxH: 22, value: d => d.fsSigned },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// GRIDS — the equipment-type × check-row tables (pages 1 and 2).
// colX positions are shared across every row in a table; rowY positions are
// shared across every equipment-type column.
// ─────────────────────────────────────────────────────────────────────────────

export const GRIDS = {
  // Page 1 — Visual Checks (15 rows × 13 columns)
  visual: {
    colX: [226, 251, 276, 302, 327, 352, 378, 403, 428, 453, 479, 504, 530],
    rowY: [404, 428, 451, 479, 501, 525, 546, 563, 580, 597, 615, 632, 647, 666, 686],
  },

  // Page 2 — Operation (rows 0–3) and Performance (rows 4–16) share one
  // column layout and one combined row array.
  operationPerformance: {
    colX: [244, 268, 292, 316, 340, 364, 388, 412, 436, 460, 484, 508, 532],
    rowY: [241, 259, 276, 296, 314, 333, 351, 370, 388, 407, 425, 444, 462, 481, 499, 518, 541],
  },

  // Page 2 — QA (2 rows), Documentation (2 rows) — same columns as above.
  qa:  { rowY: [565, 584] },
  doc: { rowY: [602, 621] },

  // Page 2 — "Other (Specify)" tick marks (labels are in FIELDS.p2).
  other: {
    colX: [244, 268, 292, 316, 340, 364, 388, 412, 435, 459, 483, 508, 532],
    rowY: [640, 658, 677],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function generateHvPdf(d, photos = []) {
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const [p1, p2, p3] = pdfDoc.getPages()
  const draw1 = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)
  const draw2 = createPageDrawer(p2, font, DEFAULT_INK, A4_HEIGHT)
  const draw3 = createPageDrawer(p3, font, DEFAULT_INK, A4_HEIGHT)

  await renderFields({ pdfDoc, page: p1, draw: draw1 }, FIELDS.p1, d)
  await renderFields({ pdfDoc, page: p2, draw: draw2 }, FIELDS.p2, d)
  await renderFields({ pdfDoc, page: p3, draw: draw3 }, FIELDS.p3, d)

  // ── Page 1 — Visual Checks (15 rows × 13 columns) ───────────────────────
  const visual = GRIDS.visual
  VISUAL_CHECKS.forEach((check, rowIdx) => {
    const equipCols = d.visualChecks?.[check.id] || {}
    EQUIP_TYPES.forEach((equip, colIdx) => {
      draw1.ck(visual.colX[colIdx], visual.rowY[rowIdx], equipCols[equip.id])
    })
  })

  // ── Page 2 — Operation Checks (rows 0–3) ─────────────────────────────────
  const op = GRIDS.operationPerformance
  OPERATION_CHECKS.forEach((check, rowIdx) => {
    const equipCols = d.operationChecks?.[check.id] || {}
    EQUIP_TYPES.forEach((equip, colIdx) => {
      draw2.ck(op.colX[colIdx], op.rowY[rowIdx], equipCols[equip.id])
    })
  })

  // ── Page 2 — Performance Tests (rows 4–16) ───────────────────────────────
  PERFORMANCE_CHECKS.forEach((check, rowIdx) => {
    const equipCols = d.performanceChecks?.[check.id] || {}
    EQUIP_TYPES.forEach((equip, colIdx) => {
      draw2.ck(op.colX[colIdx], op.rowY[rowIdx + PERF_ROW_OFFSET], equipCols[equip.id])
    })
  })

  // ── Page 2 — QA Checks ────────────────────────────────────────────────────
  QA_CHECKS.forEach((check, rowIdx) => {
    const equipCols = d.qaChecks?.[check.id] || {}
    EQUIP_TYPES.forEach((equip, colIdx) => {
      draw2.ck(op.colX[colIdx], GRIDS.qa.rowY[rowIdx], equipCols[equip.id])
    })
  })

  // ── Page 2 — Documentation Checks ────────────────────────────────────────
  DOC_CHECKS.forEach((check, rowIdx) => {
    const equipCols = d.docChecks?.[check.id] || {}
    EQUIP_TYPES.forEach((equip, colIdx) => {
      draw2.ck(op.colX[colIdx], GRIDS.doc.rowY[rowIdx], equipCols[equip.id])
    })
  })

  // ── Page 2 — Other / Specify tick marks (labels rendered via FIELDS.p2) ─
  const other = GRIDS.other
  OTHER_CHECKS.forEach((check, rowIdx) => {
    const equipCols = d.otherChecks?.[check.id] || {}
    EQUIP_TYPES.forEach((equip, colIdx) => {
      draw2.ck(other.colX[colIdx], other.rowY[rowIdx], equipCols[equip.id])
    })
  })

  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}
