/**
 * LvBoxPdfGenerator.js — PDF generator for 360S014ED
 * (AS-Built LV Box Record).
 *
 * Header fields live in FIELDS; the box-entry table (up to 20 rows) stays
 * as a small loop reading from GRIDS — see
 * DistributionTransformerPdfGenerator.js for more on this split.
 *
 * Coordinate convention
 * ─────────────────────
 * All Y values are TOP-ORIGIN (CSS / screen style). renderFields converts
 * them to pdf-lib bottom-origin internally.
 *
 * @param {object} d      - Full wizard form state
 * @param {Array}  photos - Photo attachments
 * @returns {Promise<Uint8Array>}
 */

import { PDFDocument, StandardFonts } from 'pdf-lib'
import { fetchPdfTemplate, createPageDrawer, DEFAULT_INK, A4_HEIGHT } from '../../shared/pdfDrawUtils'
import { renderFields, renderGridRow } from '../../shared/pdfFieldRenderer'
import { appendPhotosToPdf } from '../../shared/appendPhotosToPdf'

const getTemplateUrl = () =>
  `${import.meta.env.BASE_URL}forms/360S014ED.pdf`

// This form uses 7pt for all header text (smaller than the 8.5pt default).
const HEADER_FS = 7

// ─────────────────────────────────────────────────────────────────────────────
// FIELDS — header fields.
// ─────────────────────────────────────────────────────────────────────────────

export const FIELDS = {
  streetRoad: { type: 'text', align: 'left', x: 120, y: 150, size: HEADER_FS, value: d => d.streetRoad },
  // cityTown and district are joined into a single combined string.
  cityTownDistrict: {
    type: 'text', align: 'left', x: 120, y: 160, size: HEADER_FS,
    value: d => [d.cityTown, d.district].filter(Boolean).join(', '),
  },
  pcoWONo:           { type: 'text', align: 'left', x: 120, y: 170, size: HEADER_FS, value: d => d.pcoWONo },
  ciwrNo:            { type: 'text', align: 'left', x: 120, y: 180, size: HEADER_FS, value: d => d.ciwrNo },
  contractor:        { type: 'text', align: 'left', x: 460, y: 150, size: HEADER_FS, value: d => d.contractor },
  dateWorkCompleted: { type: 'text', align: 'left', x: 460, y: 160, size: HEADER_FS, value: d => d.dateWorkCompleted },
  npJobNumber:       { type: 'text', align: 'left', x: 460, y: 170, size: HEADER_FS, value: d => d.npJobNumber },
  signed:            { type: 'signature', x: 460, y: 175, maxW: 90, maxH: 15, value: d => d.signed },

  // ── Comments (multi-line wrapped text) ──────────────────────────────────────
  comments: { type: 'wrap', x: 45, y: 455, maxWidth: 700, size: 7, lineHeight: 10, maxLines: 5, value: d => d.comments },
}

// ─────────────────────────────────────────────────────────────────────────────
// GRIDS — the box-entry table (up to 20 rows).
// ─────────────────────────────────────────────────────────────────────────────

export const GRIDS = {
  boxRows: {
    rowStartY: 249,
    rowHeight: 9.8,
    maxRows:   20,
    fontSize:  6.5,
    // Each column has its own x + alignment — change `align` to 'center' or
    // 'right' to match how that column should sit on the printed form
    // (center alignment also needs a `width`).
    cols: {
      equipIdNew:           { x: 59,  align: 'left' },
      equipIdOld:           { x: 115, align: 'left' },
      address:              { x: 169, align: 'left' },
      manufacturer:         { x: 290, align: 'left' },
      model:                { x: 347, align: 'left' },
      serviceOrDist:        { x: 452, align: 'left' },  // value is 'Service' | 'Distribution' | ''
      numberOfDisconnects:  { x: 498, align: 'left' },
      fuseHolders:          { x: 520, align: 'left' },
      typeOfChange:         { x: 595, align: 'left' },
      reasonForRemoval:     { x: 640, align: 'left' },
      owner:                { x: 695, align: 'left' },
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function generateEdPdf(d, photos = []) {
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const [p1]                 = pdfDoc.getPages()
  const { height: p1Height } = p1.getSize()
  const draw                 = createPageDrawer(p1, font, DEFAULT_INK, p1Height)

  await renderFields({ pdfDoc, page: p1, draw }, FIELDS, d)

  // ── Box entry rows ────────────────────────────────────────────────────────
  const { rowStartY, rowHeight, maxRows, fontSize: rowFs, cols } = GRIDS.boxRows
  ;(d.boxRows || []).slice(0, maxRows).forEach((row, i) => {
    renderGridRow(draw, cols, rowStartY + i * rowHeight, row, rowFs)
  })

  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}
