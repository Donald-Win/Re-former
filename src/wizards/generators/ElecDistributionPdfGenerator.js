/**
 * ElecDistributionPdfGenerator.js — PDF generator for 360S014EB
 * (AS-Built Electrical Distribution Record).
 *
 * Extracted from ElecDistributionWizard.jsx. The React component now only
 * handles UI state; all PDF logic lives here.
 *
 * The template is fetched once per session and cached in memory via
 * fetchPdfTemplate(), so repeat previews cost no network I/O.
 *
 * Usage inside the wizard:
 *   import { generateEbPdf } from './generators/ElecDistributionPdfGenerator'
 *   const { pdfBytes, ... } = usePdfGenerate(generateEbPdf)
 *
 * @param {object} d      - Wizard form state (see ElecDistributionWizard.jsx)
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
  `${import.meta.env.BASE_URL}forms/360S014EB.pdf`

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT — all Y values are top-origin (CSS/screen style).
// The createPageDrawer helpers convert to pdf-lib bottom-origin internally.
// ─────────────────────────────────────────────────────────────────────────────

const LAYOUT = {

  // ── Header fields ───────────────────────────────────────────────────────────
  header: {
    streetRoad:         { x: 120, y:  86 },
    contractor:         { x: 450, y:  86 },
    cityTown:           { x: 120, y: 103 },
    district:           { x: 255, y: 103 },
    dateWorkCompleted:  { x: 450, y: 103 },
    pcoWONo:            { x: 120, y: 120 },
    ciwrNo:             { x: 255, y: 120 },
    npJobNumber:        { x: 160, y: 137 },
    namePrint:          { x: 450, y: 137 },
    // Signature — cssY is the TOP of the 110×20 bounding box (top-origin).
    // Matches the original: p1.drawImage({ x:448, y: PAGE_H-131, h:20 })
    // → bottom at 842-131=711, top at 711+20=731 → cssY = 842-731 = 111
    signature:          { x: 448, y: 111, maxW: 110, maxH: 20 },
  },

  // ── Distribution Main type checkboxes ───────────────────────────────────────
  distributionMain: {
    overhead:              { x: 134, y: 181 },
    underground:           { x: 212, y: 181 },
    undergroundDepthText:  { x: 500, y: 182 },
  },

  // ── Cable circuit table — up to 3 rows ─────────────────────────────────────
  // rowY[i] is the top-origin Y for circuit row i.
  // cols maps each field to its left-edge X (shared across all rows).
  cableRows: {
    rowY: [ 233, 246, 259 ],
    cols: {
      voltage:        55,
      phase:         125,
      cableSize:     175,
      material:      250,
      insulation:    350,
      numberOfCables:420,
      numberOfCores: 485,
      circuitLength: 538,
    },
  },

  // ── Ownership checkboxes ────────────────────────────────────────────────────
  ownership: {
    Powerco:   { x: 113, y: 270 },
    Customer:  { x: 213, y: 270 },
    Other:     { x: 321, y: 270 },
    otherText: { x: 400, y: 272 },
  },

  // ── Underground cable details ───────────────────────────────────────────────
  underground: {
    ductUsedYes:        { x: 135, y: 318 },
    ductUsedNo:         { x: 199, y: 318 },
    ductTypeNew:        { x: 270, y: 318 },
    ductTypeExisting:   { x: 327, y: 318 },
    cappedYes:          { x: 441, y: 318 },
    cappedNo:           { x: 505, y: 318 },
    numberOfDuctsText:  { x: 130, y: 338 },
    ductSizeText:       { x: 270, y: 338 },
    drawWireYes:        { x: 441, y: 337 },
    drawWireNo:         { x: 505, y: 337 },
  },

  // ── Other services in trench checkboxes ────────────────────────────────────
  otherServices: {
    Gas:       { x: 158, y: 356 },
    Telecom:   { x: 215, y: 356 },
    Water:     { x: 315, y: 356 },
    otherText: { x: 430, y: 357 },
  },

  // ── GPS required ────────────────────────────────────────────────────────────
  gps: {
    yes:       { x: 158, y: 381 },
    no:        { x: 215, y: 381 },
    filesText: { x: 425, y: 383 },
  },

  // ── Comments (multi-line wrapped text) ──────────────────────────────────────
  comments: {
    x: 195, y: 701,
    maxWidth:   370,
    fontSize:   8.5,
    lineHeight: 14,
    maxLines:   4,
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
export async function generateEbPdf(d, photos = []) {
  // ── Load template (cached after first call) ───────────────────────────────
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const [p1]          = pdfDoc.getPages()
  const draw          = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)

  // ── Header ────────────────────────────────────────────────────────────────
  const h = LAYOUT.header
  draw.t(h.streetRoad.x,        h.streetRoad.y,        d.streetRoad)
  draw.t(h.contractor.x,        h.contractor.y,        d.contractor)
  draw.t(h.cityTown.x,          h.cityTown.y,          d.cityTown)
  draw.t(h.district.x,          h.district.y,          d.district)
  draw.t(h.dateWorkCompleted.x, h.dateWorkCompleted.y, d.dateWorkCompleted)
  draw.t(h.pcoWONo.x,           h.pcoWONo.y,           d.pcoWONo)
  draw.t(h.ciwrNo.x,            h.ciwrNo.y,            d.ciwrNo)
  draw.t(h.npJobNumber.x,       h.npJobNumber.y,       d.npJobNumber)
  draw.t(h.namePrint.x,         h.namePrint.y,         d.namePrint)

  await drawSignature(
    pdfDoc, p1, d.signed,
    h.signature.x, h.signature.y,
    h.signature.maxW, h.signature.maxH,
    A4_HEIGHT,
  )

  // ── Distribution Main ─────────────────────────────────────────────────────
  const dm = LAYOUT.distributionMain
  draw.ck(dm.overhead.x,    dm.overhead.y,    d.distributionMain === 'Overhead')
  draw.ck(dm.underground.x, dm.underground.y, d.distributionMain === 'Underground')
  if (d.distributionMain === 'Underground') {
    draw.t(dm.undergroundDepthText.x, dm.undergroundDepthText.y, d.undergroundCableDepth)
  }

  // ── Cable circuit rows ────────────────────────────────────────────────────
  const { rowY, cols } = LAYOUT.cableRows
  ;(d.cableRows || []).slice(0, 3).forEach((row, i) => {
    const y = rowY[i]
    draw.t(cols.voltage,        y, row.voltage)
    draw.t(cols.phase,          y, row.phase)
    draw.t(cols.cableSize,      y, row.cableSize)
    draw.t(cols.material,       y, row.material)
    draw.t(cols.insulation,     y, row.insulation)
    draw.t(cols.numberOfCables, y, row.numberOfCables)
    draw.t(cols.numberOfCores,  y, row.numberOfCores)
    draw.t(cols.circuitLength,  y, row.circuitLength)
  })

  // ── Ownership ─────────────────────────────────────────────────────────────
  const own = LAYOUT.ownership
  draw.ck(own.Powerco.x,  own.Powerco.y,  d.ownership === 'Powerco')
  draw.ck(own.Customer.x, own.Customer.y, d.ownership === 'Customer')
  draw.ck(own.Other.x,    own.Other.y,    d.ownership === 'Other')
  if (d.ownership === 'Other') draw.t(own.otherText.x, own.otherText.y, d.ownershipOther)

  // ── Underground cable details ─────────────────────────────────────────────
  const ug = LAYOUT.underground
  draw.ck(ug.ductUsedYes.x,       ug.ductUsedYes.y,      d.cableDuctUsed === 'Yes')
  draw.ck(ug.ductUsedNo.x,        ug.ductUsedNo.y,        d.cableDuctUsed === 'No')
  draw.ck(ug.ductTypeNew.x,       ug.ductTypeNew.y,       d.cableDuctUsed === 'Yes' && d.cableDuctType === 'New')
  draw.ck(ug.ductTypeExisting.x,  ug.ductTypeExisting.y,  d.cableDuctUsed === 'Yes' && d.cableDuctType === 'Existing')
  draw.ck(ug.cappedYes.x,         ug.cappedYes.y,         d.capped === 'Yes')
  draw.ck(ug.cappedNo.x,          ug.cappedNo.y,          d.capped === 'No')
  draw.t( ug.numberOfDuctsText.x, ug.numberOfDuctsText.y, d.numberOfDucts)
  draw.t( ug.ductSizeText.x,      ug.ductSizeText.y,      d.ductSize)
  draw.ck(ug.drawWireYes.x,       ug.drawWireYes.y,       d.drawWire === 'Yes')
  draw.ck(ug.drawWireNo.x,        ug.drawWireNo.y,        d.drawWire === 'No')

  // ── Other services in trench ──────────────────────────────────────────────
  const svcs      = d.otherServicesInTrench || []
  const svcLayout = LAYOUT.otherServices
  draw.ck(svcLayout.Gas.x,     svcLayout.Gas.y,     svcs.includes('Gas'))
  draw.ck(svcLayout.Telecom.x, svcLayout.Telecom.y, svcs.includes('Telecom'))
  draw.ck(svcLayout.Water.x,   svcLayout.Water.y,   svcs.includes('Water'))
  if (svcs.includes('Other')) draw.t(svcLayout.otherText.x, svcLayout.otherText.y, d.otherServicesOther)

  // ── GPS ───────────────────────────────────────────────────────────────────
  const gps = LAYOUT.gps
  draw.ck(gps.yes.x, gps.yes.y, d.gpsRequired === 'Yes')
  draw.ck(gps.no.x,  gps.no.y,  d.gpsRequired === 'No')
  if (d.gpsRequired === 'Yes') draw.t(gps.filesText.x, gps.filesText.y, d.gpsFiles)

  // ── Comments ──────────────────────────────────────────────────────────────
  const cm = LAYOUT.comments
  draw.tWrap(cm.x, cm.y, d.comments, cm.maxWidth, cm.fontSize, cm.lineHeight, cm.maxLines)

  // ── Photos ────────────────────────────────────────────────────────────────
  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}
