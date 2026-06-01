/**
 * ZoneSubPdfGenerator.js — PDF generator for 360S014EF
 * (AS-Built Zone Substation Equipment Record).
 *
 * Extracted from ZoneSubWizard.jsx. The React component now only handles UI
 * state; all PDF logic lives here.
 *
 * The template is fetched once per session and cached in memory via
 * fetchPdfTemplate(), so repeat previews cost no network I/O.
 *
 * This form spans 2 pages:
 *   Page 1 — header, maintenance/modification section, new/replacement section.
 *   Page 2 — additional equipment table (up to 11 rows).
 *
 * Coordinate convention
 * ─────────────────────
 * All LAYOUT Y values are top-origin (CSS/screen style).
 * createPageDrawer converts them to pdf-lib bottom-origin internally.
 *
 * Conversion from the original wizard's raw Y values:
 *   cssY = original_y − FS
 *
 * where FS = 8 (the font size used in the original generator).
 *
 * Usage inside the wizard:
 *   import { generateEfPdf } from './generators/ZoneSubPdfGenerator'
 *   const { pdfBytes, ... } = usePdfGenerate(generateEfPdf)
 *
 * @param {object} d      - Wizard form state (see ZoneSubWizard.jsx)
 * @param {Array}  photos - Array of { dataUrl: string, name?: string }
 * @returns {Promise<Uint8Array>}
 */

import { PDFDocument, StandardFonts } from 'pdf-lib'
import {
  fetchPdfTemplate,
  createPageDrawer,
  drawSignature,
  DEFAULT_INK,
  A4_HEIGHT,
} from '../../shared/pdfDrawUtils'
import { appendPhotosToPdf } from '../../shared/appendPhotosToPdf'

// ── Template URL ──────────────────────────────────────────────────────────────
const getTemplateUrl = () =>
  `${import.meta.env.BASE_URL}forms/360S014EF.pdf`

// ── Font size ─────────────────────────────────────────────────────────────────
// The original generator used 8pt throughout. Named here so every draw.t()
// call is explicit and can be changed in one place if needed.
const FS = 8

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT — all Y values are top-origin (CSS/screen style).
// The createPageDrawer helpers convert to pdf-lib bottom-origin internally.
// ─────────────────────────────────────────────────────────────────────────────

const LAYOUT = {

  // ── Page 1 — Header ──────────────────────────────────────────────────────────
  header: {
    substation:            { x:  50, y:  87 },   // orig y=95
    streetRoad:            { x:  50, y: 105 },   // orig y=113
    contractor:            { x: 310, y: 105 },
    cityTown:              { x:  50, y: 120 },   // orig y=128
    district:              { x: 200, y: 120 },
    dateWorkCompleted:     { x: 310, y: 120 },
    pcoWONo:               { x:  50, y: 135 },   // orig y=143
    ciwrNo:                { x: 185, y: 135 },
    contractorJobCostCode: { x:  90, y: 150 },   // orig y=158
    namePrint:             { x: 310, y: 150 },
    // cssY is the TOP of the 120×22 bounding box (top-origin).
    // Original: drawImage({ x:310, y: 842-152 }) → bottom at 690, top at 712 → cssY = 842-712 = 130
    signature:             { x: 310, y: 130, maxW: 120, maxH: 22 },
  },

  // ── Page 1 — Maintenance / Modification ──────────────────────────────────────
  maintenance: {
    equipmentId:          { x:  90, y: 210 },    // orig y=218
    parentEquipmentId:    { x: 235, y: 210 },
    equipmentDescription: { x: 415, y: 210 },
    description: {
      x: 50, y: 249, maxWidth: 495, lineHeight: 12, maxLines: 5,  // orig y=257
    },
  },

  // ── Page 1 — New / Replacement ────────────────────────────────────────────────
  replacement: {
    newEquipmentId:      { x:  90, y: 340 },    // orig y=348
    oldEquipmentId:      { x: 235, y: 340 },
    drawingReferenceNo:  { x: 415, y: 340 },
    manufacturer:        { x:  90, y: 365 },    // orig y=373
    model:               { x: 235, y: 365 },
    serialNo:            { x: 415, y: 365 },
    description: {
      x: 50, y: 402, maxWidth: 495, lineHeight: 12, maxLines: 5,  // orig y=410
    },
  },

  // ── Page 2 — Additional Equipment table ──────────────────────────────────────
  // rowStart: cssY of the first data row.
  // Conversion: orig ROW_START=500 → cssY = 500 − FS = 492
  additionalItems: {
    rowStart:  492,
    rowHeight:  24,    // same as original ROW_H
    maxRows:    11,
    cols: {
      installedOrRemoved:  45,
      equipmentId:        130,
      serialNo:           200,
      manufacturerModel:  233,
      description:        368,
      drawingRef:         503,
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} d      - Full wizard form state
 * @param {Array}  photos - Photo attachments
 * @returns {Promise<Uint8Array>}
 */
export async function generateEfPdf(d, photos = []) {
  // ── Load template (cached after first call) ──────────────────────────────
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const [p1, p2]      = pdfDoc.getPages()
  const draw1         = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)
  const draw2         = createPageDrawer(p2, font, DEFAULT_INK, A4_HEIGHT)

  // ── Page 1: Header ───────────────────────────────────────────────────────
  const h = LAYOUT.header
  draw1.t(h.substation.x,            h.substation.y,            d.substation,            FS)
  draw1.t(h.streetRoad.x,            h.streetRoad.y,            d.streetRoad,            FS)
  draw1.t(h.contractor.x,            h.contractor.y,            d.contractor,            FS)
  draw1.t(h.cityTown.x,              h.cityTown.y,              d.cityTown,              FS)
  draw1.t(h.district.x,              h.district.y,              d.district,              FS)
  draw1.t(h.dateWorkCompleted.x,     h.dateWorkCompleted.y,     d.dateWorkCompleted,     FS)
  draw1.t(h.pcoWONo.x,               h.pcoWONo.y,               d.pcoWONo,               FS)
  draw1.t(h.ciwrNo.x,                h.ciwrNo.y,                d.ciwrNo,                FS)
  draw1.t(h.contractorJobCostCode.x, h.contractorJobCostCode.y, d.contractorJobCostCode, FS)
  draw1.t(h.namePrint.x,             h.namePrint.y,             d.namePrint,             FS)

  await drawSignature(
    pdfDoc, p1, d.signed,
    h.signature.x, h.signature.y,
    h.signature.maxW, h.signature.maxH,
    A4_HEIGHT,
  )

  // ── Page 1: Maintenance / Modification ──────────────────────────────────
  if (d.maintenanceApplies) {
    const m = LAYOUT.maintenance
    draw1.t(m.equipmentId.x,          m.equipmentId.y,          d.maintenanceEquipmentId,          FS)
    draw1.t(m.parentEquipmentId.x,    m.parentEquipmentId.y,    d.maintenanceParentEquipmentId,    FS)
    draw1.t(m.equipmentDescription.x, m.equipmentDescription.y, d.maintenanceEquipmentDescription, FS)
    draw1.tWrap(
      m.description.x,   m.description.y,
      d.maintenanceDescription,
      m.description.maxWidth, FS, m.description.lineHeight, m.description.maxLines,
    )
  }

  // ── Page 1: New / Replacement ────────────────────────────────────────────
  if (d.replacementApplies) {
    const r = LAYOUT.replacement
    draw1.t(r.newEquipmentId.x,     r.newEquipmentId.y,     d.newEquipmentId,     FS)
    draw1.t(r.oldEquipmentId.x,     r.oldEquipmentId.y,     d.oldEquipmentId,     FS)
    draw1.t(r.drawingReferenceNo.x, r.drawingReferenceNo.y, d.drawingReferenceNo, FS)
    draw1.t(r.manufacturer.x,       r.manufacturer.y,       d.manufacturer,       FS)
    draw1.t(r.model.x,              r.model.y,              d.model,              FS)
    draw1.t(r.serialNo.x,           r.serialNo.y,           d.serialNo,           FS)
    draw1.tWrap(
      r.description.x,   r.description.y,
      d.replacementDescription,
      r.description.maxWidth, FS, r.description.lineHeight, r.description.maxLines,
    )
  }

  // ── Page 2: Additional Equipment table ──────────────────────────────────
  const rows = (d.additionalItems || []).filter(row =>
    row.installedOrRemoved || row.equipmentId  || row.serialNo ||
    row.manufacturerModel  || row.description  || row.drawingRef,
  )

  const { rowStart, rowHeight, maxRows, cols } = LAYOUT.additionalItems
  rows.slice(0, maxRows).forEach((row, i) => {
    const y = rowStart + i * rowHeight
    draw2.t(cols.installedOrRemoved, y, row.installedOrRemoved, FS)
    draw2.t(cols.equipmentId,        y, row.equipmentId,        FS)
    draw2.t(cols.serialNo,           y, row.serialNo,           FS)
    draw2.t(cols.manufacturerModel,  y, row.manufacturerModel,  FS)
    draw2.t(cols.description,        y, row.description,        FS)
    draw2.t(cols.drawingRef,         y, row.drawingRef,         FS)
  })

  // ── Photos ───────────────────────────────────────────────────────────────
  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}
