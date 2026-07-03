/**
 * ZoneSubPdfGenerator.js — PDF generator for 360S014EF
 * (AS-Built Zone Substation Equipment Record).
 *
 * This form spans 2 pages:
 *   Page 1 — header, maintenance/modification section, new/replacement section.
 *   Page 2 — additional equipment table (up to 11 rows, see GRIDS).
 *
 * Two whole sections on page 1 (maintenance, replacement) are only filled in
 * when their "applies" toggle is on — each field's value() function checks
 * that toggle itself and returns '' otherwise, so a leftover value from a
 * toggle the user switched off again never bleeds onto the PDF (matching the
 * original's `if (d.xApplies) { ... }` block guard).
 *
 * Coordinate convention
 * ─────────────────────
 * All Y values are TOP-ORIGIN (CSS / screen style). renderFields converts
 * them to pdf-lib bottom-origin internally.
 *
 * @param {object} d      - Wizard form state (see ZoneSubWizard.jsx)
 * @param {Array}  photos - Array of { dataUrl: string, name?: string }
 * @returns {Promise<Uint8Array>}
 */

import { PDFDocument, StandardFonts } from 'pdf-lib'
import { fetchPdfTemplate, createPageDrawer, DEFAULT_INK, A4_HEIGHT } from '../../shared/pdfDrawUtils'
import { renderFields, renderGridRow } from '../../shared/pdfFieldRenderer'
import { appendPhotosToPdf } from '../../shared/appendPhotosToPdf'

const getTemplateUrl = () =>
  `${import.meta.env.BASE_URL}forms/360S014EF.pdf`

// The original generator used 8pt throughout.
const FS = 8

// ─────────────────────────────────────────────────────────────────────────────
// FIELDS
// ─────────────────────────────────────────────────────────────────────────────

export const FIELDS = {

  // ── Page 1 — Header ──────────────────────────────────────────────────────────
  p1: {
    substation:            { type: 'text', align: 'left', x:  50, y:  87, size: FS, value: d => d.substation },
    streetRoad:            { type: 'text', align: 'left', x:  50, y: 105, size: FS, value: d => d.streetRoad },
    contractor:            { type: 'text', align: 'left', x: 310, y: 105, size: FS, value: d => d.contractor },
    cityTown:              { type: 'text', align: 'left', x:  50, y: 120, size: FS, value: d => d.cityTown },
    district:              { type: 'text', align: 'left', x: 200, y: 120, size: FS, value: d => d.district },
    dateWorkCompleted:     { type: 'text', align: 'left', x: 310, y: 120, size: FS, value: d => d.dateWorkCompleted },
    pcoWONo:               { type: 'text', align: 'left', x:  50, y: 135, size: FS, value: d => d.pcoWONo },
    ciwrNo:                { type: 'text', align: 'left', x: 185, y: 135, size: FS, value: d => d.ciwrNo },
    contractorJobCostCode: { type: 'text', align: 'left', x:  90, y: 150, size: FS, value: d => d.contractorJobCostCode },
    namePrint:             { type: 'text', align: 'left', x: 310, y: 150, size: FS, value: d => d.namePrint },
    signed:                { type: 'signature', x: 310, y: 130, maxW: 120, maxH: 22, value: d => d.signed },

    // ── Maintenance / Modification — only drawn when d.maintenanceApplies ────
    maintenanceEquipmentId:          { type: 'text', align: 'left', x:  90, y: 210, size: FS, value: d => (d.maintenanceApplies ? d.maintenanceEquipmentId : '') },
    maintenanceParentEquipmentId:    { type: 'text', align: 'left', x: 235, y: 210, size: FS, value: d => (d.maintenanceApplies ? d.maintenanceParentEquipmentId : '') },
    maintenanceEquipmentDescription: { type: 'text', align: 'left', x: 415, y: 210, size: FS, value: d => (d.maintenanceApplies ? d.maintenanceEquipmentDescription : '') },
    maintenanceDescription: {
      type: 'wrap', x: 50, y: 249, maxWidth: 495, size: FS, lineHeight: 12, maxLines: 5,
      value: d => (d.maintenanceApplies ? d.maintenanceDescription : ''),
    },

    // ── New / Replacement — only drawn when d.replacementApplies ─────────────
    newEquipmentId:     { type: 'text', align: 'left', x:  90, y: 340, size: FS, value: d => (d.replacementApplies ? d.newEquipmentId : '') },
    oldEquipmentId:     { type: 'text', align: 'left', x: 235, y: 340, size: FS, value: d => (d.replacementApplies ? d.oldEquipmentId : '') },
    drawingReferenceNo: { type: 'text', align: 'left', x: 415, y: 340, size: FS, value: d => (d.replacementApplies ? d.drawingReferenceNo : '') },
    manufacturer:       { type: 'text', align: 'left', x:  90, y: 365, size: FS, value: d => (d.replacementApplies ? d.manufacturer : '') },
    model:              { type: 'text', align: 'left', x: 235, y: 365, size: FS, value: d => (d.replacementApplies ? d.model : '') },
    serialNo:           { type: 'text', align: 'left', x: 415, y: 365, size: FS, value: d => (d.replacementApplies ? d.serialNo : '') },
    replacementDescription: {
      type: 'wrap', x: 50, y: 402, maxWidth: 495, size: FS, lineHeight: 12, maxLines: 5,
      value: d => (d.replacementApplies ? d.replacementDescription : ''),
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// GRIDS — Page 2 additional equipment table (up to 11 rows).
// ─────────────────────────────────────────────────────────────────────────────

export const GRIDS = {
  additionalItems: {
    rowStart:  492,
    rowHeight:  24,
    maxRows:    11,
    // Each column has its own x + alignment — change `align` to 'center' or
    // 'right' to match how that column should sit on the printed form
    // (center alignment also needs a `width`).
    cols: {
      installedOrRemoved: { x:  45, align: 'left' },
      equipmentId:         { x: 130, align: 'left' },
      serialNo:            { x: 200, align: 'left' },
      manufacturerModel:   { x: 233, align: 'left' },
      description:         { x: 368, align: 'left' },
      drawingRef:          { x: 503, align: 'left' },
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function generateEfPdf(d, photos = []) {
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const [p1, p2]      = pdfDoc.getPages()
  const draw1         = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)
  const draw2         = createPageDrawer(p2, font, DEFAULT_INK, A4_HEIGHT)

  await renderFields({ pdfDoc, page: p1, draw: draw1 }, FIELDS.p1, d)

  // ── Page 2: Additional Equipment table ───────────────────────────────────
  // Blank rows are filtered out before the maxRows clip, exactly as before.
  const rows = (d.additionalItems || []).filter(row =>
    row.installedOrRemoved || row.equipmentId || row.serialNo ||
    row.manufacturerModel  || row.description || row.drawingRef,
  )

  const { rowStart, rowHeight, maxRows, cols } = GRIDS.additionalItems
  rows.slice(0, maxRows).forEach((row, i) => {
    renderGridRow(draw2, cols, rowStart + i * rowHeight, row, FS)
  })

  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}
