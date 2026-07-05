/**
 * ElecDistributionPdfGenerator.js — PDF generator for 360S014EB
 * (AS-Built Electrical Distribution Record).
 *
 * Every field is declared in FIELDS; the one repeating table (up to 3 cable
 * circuit rows) stays as a small loop reading from GRIDS, since it's a
 * handful of shared column positions applied across however many rows exist
 * — see DistributionTransformerPdfGenerator.js for more on this split.
 *
 * Coordinate convention
 * ─────────────────────
 * All Y values are TOP-ORIGIN (CSS / screen style). renderFields converts
 * them to pdf-lib bottom-origin internally.
 *
 * @param {object} d      - Wizard form state (see ElecDistributionWizard.jsx)
 * @param {Array}  photos - Array of { dataUrl: string, name?: string }
 * @returns {Promise<Uint8Array>}
 */

import { PDFDocument, StandardFonts } from 'pdf-lib'
import { fetchPdfTemplate, createPageDrawer, DEFAULT_INK, A4_HEIGHT } from '../../shared/pdfDrawUtils'
import { renderFields, renderGridRow } from '../../shared/pdfFieldRenderer'
import { appendPhotosToPdf } from '../../shared/appendPhotosToPdf'

const getTemplateUrl = () =>
  `${import.meta.env.BASE_URL}forms/360S014EB.pdf`

// ─────────────────────────────────────────────────────────────────────────────
// FIELDS — every simple, named field.
// ─────────────────────────────────────────────────────────────────────────────

export const FIELDS = {

  // ── Header ───────────────────────────────────────────────────────────────────
  streetRoad:        { type: 'text', align: 'left', x: 120, y:  86, value: d => d.streetRoad },
  contractor:        { type: 'text', align: 'left', x: 450, y:  86, value: d => d.contractor },
  cityTown:          { type: 'text', align: 'left', x: 120, y: 103, value: d => d.cityTown },
  district:          { type: 'text', align: 'left', x: 255, y: 103, value: d => d.district },
  dateWorkCompleted: { type: 'text', align: 'left', x: 450, y: 103, value: d => d.dateWorkCompleted },
  pcoWONo:           { type: 'text', align: 'left', x: 120, y: 120, value: d => d.pcoWONo },
  ciwrNo:            { type: 'text', align: 'left', x: 255, y: 120, value: d => d.ciwrNo },
  npJobNumber:       { type: 'text', align: 'left', x: 160, y: 137, value: d => d.npJobNumber },
  namePrint:         { type: 'text', align: 'left', x: 450, y: 137, value: d => d.namePrint },
  signed:            { type: 'signature', x: 448, y: 111, maxW: 110, maxH: 20, value: d => d.signed },

  // ── Distribution Main type ──────────────────────────────────────────────────
  distributionMainOverhead:    { type: 'check', x: 134, y: 181, value: d => d.distributionMain === 'Overhead' },
  distributionMainUnderground: { type: 'check', x: 212, y: 181, value: d => d.distributionMain === 'Underground' },
  undergroundDepthText: {
    type: 'text', align: 'left', x: 500, y: 182,
    value: d => (d.distributionMain === 'Underground' ? d.undergroundCableDepth : ''),
  },

  // ── Ownership ────────────────────────────────────────────────────────────────
  ownershipPowerco:  { type: 'check', x: 113, y: 270, value: d => d.ownership === 'Powerco' },
  ownershipCustomer: { type: 'check', x: 213, y: 270, value: d => d.ownership === 'Customer' },
  ownershipOther:    { type: 'check', x: 321, y: 270, value: d => d.ownership === 'Other' },
  ownershipOtherText: {
    type: 'text', align: 'left', x: 400, y: 272,
    value: d => (d.ownership === 'Other' ? d.ownershipOther : ''),
  },

  // ── Underground cable details ───────────────────────────────────────────────
  ductUsedYes:      { type: 'check', x: 135, y: 318, value: d => d.cableDuctUsed === 'Yes' },
  ductUsedNo:       { type: 'check', x: 199, y: 318, value: d => d.cableDuctUsed === 'No' },
  ductTypeNew:      { type: 'check', x: 270, y: 318, value: d => d.cableDuctUsed === 'Yes' && d.cableDuctType === 'New' },
  ductTypeExisting: { type: 'check', x: 327, y: 318, value: d => d.cableDuctUsed === 'Yes' && d.cableDuctType === 'Existing' },
  cappedYes:        { type: 'check', x: 441, y: 318, value: d => d.capped === 'Yes' },
  cappedNo:         { type: 'check', x: 505, y: 318, value: d => d.capped === 'No' },
  numberOfDucts:    { type: 'text', align: 'left', x: 130, y: 338, value: d => d.numberOfDucts },
  ductSize:         { type: 'text', align: 'left', x: 270, y: 338, value: d => d.ductSize },
  drawWireYes:      { type: 'check', x: 441, y: 337, value: d => d.drawWire === 'Yes' },
  drawWireNo:       { type: 'check', x: 505, y: 337, value: d => d.drawWire === 'No' },

  // ── Other services in trench ────────────────────────────────────────────────
  otherServicesGas:      { type: 'check', x: 158, y: 356, value: d => (d.otherServicesInTrench || []).includes('Gas') },
  otherServicesTelecom:  { type: 'check', x: 215, y: 356, value: d => (d.otherServicesInTrench || []).includes('Telecom') },
  otherServicesWater:    { type: 'check', x: 315, y: 356, value: d => (d.otherServicesInTrench || []).includes('Water') },
  otherServicesOtherText: {
    type: 'text', align: 'left', x: 430, y: 357,
    value: d => ((d.otherServicesInTrench || []).includes('Other') ? d.otherServicesOther : ''),
  },

  // ── GPS required ─────────────────────────────────────────────────────────────
  gpsYes:   { type: 'check', x: 158, y: 381, value: d => d.gpsRequired === 'Yes' },
  gpsNo:    { type: 'check', x: 215, y: 381, value: d => d.gpsRequired === 'No' },
  gpsFiles: { type: 'text', align: 'left', x: 425, y: 383, value: d => (d.gpsRequired === 'Yes' ? d.gpsFiles : '') },

  // ── Comments (multi-line wrapped text) ──────────────────────────────────────
  comments: { type: 'wrap', x: 195, y: 701, maxWidth: 370, lineHeight: 14, maxLines: 4, value: d => d.comments },
}

// ─────────────────────────────────────────────────────────────────────────────
// GRIDS — the one repeating table on this form.
// ─────────────────────────────────────────────────────────────────────────────

export const GRIDS = {
  // Cable circuit table — up to 3 rows. rowY[i] is the row's top-origin Y;
  // each column has its own x position AND alignment — change `align` to
  // 'center' or 'right' to match how that column should sit on the printed
  // form (center alignment also needs a `width`).
  cableRows: {
    rowY: [233, 246, 259],
    cols: {
      voltage:        { x: 55,  align: 'left' },
      phase:          { x: 125, align: 'left' },
      cableSize:      { x: 175, align: 'left' },
      material:       { x: 250, align: 'left' },
      insulation:     { x: 350, align: 'left' },
      numberOfCables: { x: 420, align: 'left' },
      numberOfCores:  { x: 485, align: 'left' },
      circuitLength:  { x: 538, align: 'left' },
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function generateEbPdf(d, photos = []) {
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const [p1]          = pdfDoc.getPages()
  const draw          = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)

  await renderFields({ pdfDoc, page: p1, draw }, FIELDS, d)

  // ── Cable circuit rows ────────────────────────────────────────────────────
  const { rowY, cols } = GRIDS.cableRows
  ;(d.cableRows || []).slice(0, 3).forEach((row, i) => {
    renderGridRow(draw, cols, rowY[i], row)
  })

  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}
