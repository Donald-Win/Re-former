/**
 * TransformerPdfGenerator.js — Pure async PDF generator for 360S014EG.
 *
 * Extracted from TransformerWizard.jsx so that:
 *   - The React component only handles UI state
 *   - PDF generation is testable in isolation (no React dependency)
 *   - The template is cached in memory after the first call (via fetchPdfTemplate)
 *
 * Usage inside the wizard:
 *   import { generateTransformerPdf } from './generators/TransformerPdfGenerator'
 *   ...
 *   const { pdfBytes, ... } = usePdfGenerate(generateTransformerPdf)
 *
 * @param {object} d      - Wizard form state (see TransformerWizard.jsx for shape)
 * @param {Array}  photos - Array of { dataUrl: string, name?: string }
 * @returns {Promise<Uint8Array>} - The generated PDF as a byte array
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
// Using a function so `import.meta.env.BASE_URL` is evaluated at call-time
// (Vite replaces it during the build; we can't use it at module-evaluation time
// in a plain JS file that might be imported before Vite processes it).
const getTemplateUrl = () =>
  `${import.meta.env.BASE_URL}forms/360S014EG.pdf`

// ── Field coordinate tables ───────────────────────────────────────────────────
// All Y values are top-origin (CSS-style). The drawing helpers convert them.

const P1_FIELDS = {
  // Header
  streetRoad:         { x: 115, y:  88 },
  contractor:         { x: 440, y:  88 },
  cityTown:           { x: 115, y: 106 },
  district:           { x: 250, y: 106 },
  dateWorkCompleted:  { x: 440, y: 106 },
  pcoWONo:            { x: 115, y: 123 },
  ciwrNo:             { x: 250, y: 123 },
  npJobNumber:        { x: 160, y: 140 },
  namePrint:          { x: 440, y: 141 },
  // Signature image: top-left corner of the image
  signature:          { x: 438, y: 118, maxW: 120, maxH: 22 },
  // Site details (centred within their cells)
  transformerSiteId:  { fieldLeft:  33, fieldWidth: 128, y: 195 },
  poleId:             { fieldLeft: 162, fieldWidth: 128, y: 195 },
  zoneSubstation:     { fieldLeft: 296, fieldWidth: 128, y: 195 },
  feederId:           { fieldLeft: 439, fieldWidth: 126, y: 195 },
}

// Installation type checkboxes
const P1_INSTALL_CK = {
  'New':                  { x: 144, y: 222 },
  'Refurbished':          { x: 218, y: 222 },
  'Emergency / Stock':    { x: 317, y: 222 },
  'Removal Only':         { x: 446, y: 222 },
}

// Ownership checkboxes
const P1_OWNERSHIP_CK = {
  Powerco:  { x: 144, y: 243 },
  Customer: { x: 218, y: 243 },
  Other:    { x: 317, y: 243 },
}

// Issued / Removed voltage text (centred)
const P1_VOLTAGE = {
  issuedHV:   { fieldLeft: 150, fieldWidth:  85, y: 311 },
  issuedLV:   { fieldLeft: 250, fieldWidth:  85, y: 311 },
  removedHV:  { fieldLeft: 360, fieldWidth:  95, y: 311 },
  removedLV:  { fieldLeft: 480, fieldWidth:  70, y: 311 },
}

// Connection type checkboxes — issued HV
const P1_CONN_I_HV = {
  Bushing:    { x: 148, y: 327 },
  'Cable Box':{ x: 148, y: 344 },
  'Dead Break':{ x: 148, y: 361 },
  'Pitch Box':{ x: 148, y: 378 },
}
// Issued LV
const P1_CONN_I_LV = {
  Bushing:    { x: 247, y: 327 },
  'Cable Box':{ x: 247, y: 344 },
  'Dead Break':{ x: 247, y: 361 },
  Resin:      { x: 247, y: 378 },
}
// Removed HV
const P1_CONN_R_HV = {
  Bushing:    { x: 361, y: 327 },
  'Cable Box':{ x: 361, y: 344 },
  'Dead Break':{ x: 361, y: 361 },
  'Pitch Box':{ x: 361, y: 378 },
}
// Removed LV
const P1_CONN_R_LV = {
  Bushing:    { x: 467, y: 327 },
  'Cable Box':{ x: 467, y: 344 },
  'Dead Break':{ x: 466, y: 361 },
  Resin:      { x: 467, y: 378 },
}

// Capacity kVA (centred)
const P1_CAPACITY = {
  issued:   { fieldLeft: 155, fieldWidth: 170, y: 400 },
  removed:  { fieldLeft: 330, fieldWidth: 260, y: 400 },
}

// Phase ellipses — [cx, cssCY, rx, ry]
const P1_PHASES_I = { Three: [216,428,16,7], One: [240,428,11,7], SWER: [265,428,14,7] }
const P1_PHASES_R = { Three: [434,428,16,7], One: [458,428,11,7], SWER: [483,428,14,7] }

// Serial numbers (centred)
const P1_SERIAL = {
  issued:  { fieldLeft: 155, fieldWidth: 170, y: 445 },
  removed: { fieldLeft: 330, fieldWidth: 260, y: 445 },
}

// Enclosure type checkboxes
const P1_ENC_I = {
  'Pole Mount':        { x: 148, y: 464 },
  Plastic:             { x: 247, y: 464 },
  Fibreglass:          { x: 148, y: 481 },
  Building:            { x: 247, y: 481 },
  Fenced:              { x: 148, y: 498 },
  'Metal Cover':       { x: 247, y: 498 },
  'Customer Premise':  { x: 148, y: 515 },
}
const P1_ENC_R = {
  'Pole Mount':        { x: 361, y: 464 },
  Plastic:             { x: 467, y: 464 },
  Fibreglass:          { x: 361, y: 481 },
  Building:            { x: 467, y: 481 },
  Fenced:              { x: 361, y: 498 },
  'Metal Cover':       { x: 467, y: 498 },
  'Customer Premise':  { x: 361, y: 515 },
}

// Enclosure models (centred)
const P1_ENC_MODEL = {
  issued:  { fieldLeft: 155, fieldWidth: 170, y: 536 },
  removed: { fieldLeft: 330, fieldWidth: 260, y: 536 },
}

// Transformer type ellipses — [cx, cssCY, rx, ry]
const P1_TX_TYPE_I = {
  Bearer:       [172, 565, 16, 8],
  'Grnd Mount': [219, 565, 26, 8],
  Hanger:       [265, 565, 17, 8],
  Pedestal:     [305, 565, 20, 8],
}
const P1_TX_TYPE_R = {
  Bearer:       [390, 565, 16, 8],
  'Grnd Mount': [436, 565, 26, 8],
  Hanger:       [483, 565, 17, 8],
  Pedestal:     [523, 565, 20, 8],
}

// Make / model (centred)
const P1_MAKE = {
  issued:  { fieldLeft: 155, fieldWidth: 170, y: 581 },
  removed: { fieldLeft: 330, fieldWidth: 260, y: 581 },
}
const P1_MODEL = {
  issued:  { fieldLeft: 155, fieldWidth: 170, y: 604 },
  removed: { fieldLeft: 330, fieldWidth: 260, y: 604 },
}

// Issued-only technical fields
const P1_ISSUED_TECH = {
  voltTest:             { fieldLeft: 155, fieldWidth: 170, y: 628 },
  // Tap setting ellipses: value → [cx, cssCY, rx]
  tap: {
    '-10':  [164, 654, 10], '-7.5': [191, 654, 10], '-5':  [217, 654, 10],
    '-2.5': [242, 654, 10], '0':    [266, 654, 10], '+2.5':[292, 654, 11],
    '+5':   [319, 654, 10],
  },
  mdiYes:               { x: 148, y: 663 },
  mdiNo:                { x: 247, y: 663 },
  ctRatio:              { fieldLeft: 155, fieldWidth: 170, y: 682 },
  earthTest1:           { x: 160, y: 699 },
  earthTest2:           { x: 221, y: 699 },
  totalMEN:             { x: 300, y: 699 },
  fuseSizeHV:           { x: 175, y: 717 },
  fuseSizeLV:           { x: 275, y: 717 },
  lvDisconnectorMake:   { x: 175, y: 737 },
  lvDisconnectorModel:  { x: 275, y: 737 },
}

// Removal reasons
const P1_REMOVAL_REASONS = {
  Relocation:         { x: 361, y: 647 },
  Vegetation:         { x: 467, y: 647 },
  'Site Dismantled':  { x: 361, y: 664 },
  Reconstruction:     { x: 467, y: 664 },
  'Vehicle Accident': { x: 361, y: 681 },
  'End of Life':      { x: 467, y: 681 },
  'Capacity Change':  { x: 361, y: 697 },
  Faulty:             { x: 467, y: 697 },
  'Adverse Weather':  { x: 361, y: 725 },
  Vandalism:          { x: 467, y: 725 },
}

// "Removed to store" field
const P1_REMOVED_TO_STORE = { x: 178, y: 755 }

// Page 2 — comments
const P2_COMMENT_Y = [90, 104, 118, 132, 146, 160, 174]
const P2_COMMENT_X = 60

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object}  d       - Form state from TransformerWizard
 * @param {Array}   photos  - Photo attachments
 * @returns {Promise<Uint8Array>}
 */
export async function generateTransformerPdf(d, photos = []) {
  // ── Load template (cached after first call) ───────────────────────────────
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const [p1, p2]      = pdfDoc.getPages()

  // ── Create page-bound drawing helpers ────────────────────────────────────
  const d1 = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)
  const d2 = createPageDrawer(p2, font, DEFAULT_INK, A4_HEIGHT)

  const i = d.issued   || {}
  const r = d.removed  || {}

  // ── Page 1: Header ────────────────────────────────────────────────────────
  d1.t(P1_FIELDS.streetRoad.x,        P1_FIELDS.streetRoad.y,        d.streetRoad)
  d1.t(P1_FIELDS.contractor.x,        P1_FIELDS.contractor.y,        d.contractor)
  d1.t(P1_FIELDS.cityTown.x,          P1_FIELDS.cityTown.y,          d.cityTown)
  d1.t(P1_FIELDS.district.x,          P1_FIELDS.district.y,          d.district)
  d1.t(P1_FIELDS.dateWorkCompleted.x, P1_FIELDS.dateWorkCompleted.y, d.dateWorkCompleted)
  d1.t(P1_FIELDS.pcoWONo.x,           P1_FIELDS.pcoWONo.y,           d.pcoWONo)
  d1.t(P1_FIELDS.ciwrNo.x,            P1_FIELDS.ciwrNo.y,            d.ciwrNo)
  d1.t(P1_FIELDS.npJobNumber.x,       P1_FIELDS.npJobNumber.y,       d.npJobNumber)
  d1.t(P1_FIELDS.namePrint.x,         P1_FIELDS.namePrint.y,         d.namePrint)

  // Signature
  const sig = P1_FIELDS.signature
  await drawSignature(pdfDoc, p1, d.signed, sig.x, sig.y, sig.maxW, sig.maxH, A4_HEIGHT)

  // ── Page 1: Site details (centred) ────────────────────────────────────────
  const siteCentred = [
    ['transformerSiteId', d.transformerSiteId],
    ['poleId',            d.poleId],
    ['zoneSubstation',    d.zoneSubstation],
    ['feederId',          d.feederId],
  ]
  siteCentred.forEach(([key, val]) => {
    const f = P1_FIELDS[key]
    d1.tc(f.fieldLeft, f.fieldWidth, f.y, val)
  })

  // ── Page 1: Installation type + ownership ─────────────────────────────────
  Object.entries(P1_INSTALL_CK).forEach(([label, pos]) =>
    d1.ck(pos.x, pos.y, d.installationType === label)
  )
  Object.entries(P1_OWNERSHIP_CK).forEach(([label, pos]) =>
    d1.ck(pos.x, pos.y, d.ownership === label)
  )
  if (d.ownership === 'Other') d1.t(360, 219, d.ownershipOther)

  // ── Page 1: Voltage ───────────────────────────────────────────────────────
  d1.tc(P1_VOLTAGE.issuedHV.fieldLeft,  P1_VOLTAGE.issuedHV.fieldWidth,  P1_VOLTAGE.issuedHV.y,  i.voltageHV)
  d1.tc(P1_VOLTAGE.issuedLV.fieldLeft,  P1_VOLTAGE.issuedLV.fieldWidth,  P1_VOLTAGE.issuedLV.y,  i.voltageLV)
  d1.tc(P1_VOLTAGE.removedHV.fieldLeft, P1_VOLTAGE.removedHV.fieldWidth, P1_VOLTAGE.removedHV.y, r.voltageHV)
  d1.tc(P1_VOLTAGE.removedLV.fieldLeft, P1_VOLTAGE.removedLV.fieldWidth, P1_VOLTAGE.removedLV.y, r.voltageLV)

  // ── Page 1: Connection types ──────────────────────────────────────────────
  const connMaps = [
    [P1_CONN_I_HV, i.connectionTypeHV],
    [P1_CONN_I_LV, i.connectionTypeLV],
    [P1_CONN_R_HV, r.connectionTypeHV],
    [P1_CONN_R_LV, r.connectionTypeLV],
  ]
  connMaps.forEach(([map, value]) =>
    Object.entries(map).forEach(([label, pos]) =>
      d1.ck(pos.x, pos.y, value === label)
    )
  )

  // ── Page 1: Capacity ──────────────────────────────────────────────────────
  d1.tc(P1_CAPACITY.issued.fieldLeft,  P1_CAPACITY.issued.fieldWidth,  P1_CAPACITY.issued.y,  i.capacityKVA)
  d1.tc(P1_CAPACITY.removed.fieldLeft, P1_CAPACITY.removed.fieldWidth, P1_CAPACITY.removed.y, r.capacityKVA)

  // ── Page 1: Phase ellipses ────────────────────────────────────────────────
  Object.entries(P1_PHASES_I).forEach(([label, [cx, cy, rx, ry]]) =>
    d1.circ(cx, cy, rx, ry, i.phases === label)
  )
  Object.entries(P1_PHASES_R).forEach(([label, [cx, cy, rx, ry]]) =>
    d1.circ(cx, cy, rx, ry, r.phases === label)
  )

  // ── Page 1: Serial numbers ────────────────────────────────────────────────
  d1.tc(P1_SERIAL.issued.fieldLeft,  P1_SERIAL.issued.fieldWidth,  P1_SERIAL.issued.y,  i.serialNumber)
  d1.tc(P1_SERIAL.removed.fieldLeft, P1_SERIAL.removed.fieldWidth, P1_SERIAL.removed.y, r.serialNumber)

  // ── Page 1: Enclosure types ───────────────────────────────────────────────
  Object.entries(P1_ENC_I).forEach(([label, pos]) =>
    d1.ck(pos.x, pos.y, i.enclosureType === label)
  )
  Object.entries(P1_ENC_R).forEach(([label, pos]) =>
    d1.ck(pos.x, pos.y, r.enclosureType === label)
  )
  d1.tc(P1_ENC_MODEL.issued.fieldLeft,  P1_ENC_MODEL.issued.fieldWidth,  P1_ENC_MODEL.issued.y,  i.enclosureModel)
  d1.tc(P1_ENC_MODEL.removed.fieldLeft, P1_ENC_MODEL.removed.fieldWidth, P1_ENC_MODEL.removed.y, r.enclosureModel)

  // ── Page 1: Transformer type ellipses ─────────────────────────────────────
  Object.entries(P1_TX_TYPE_I).forEach(([label, [cx, cy, rx, ry]]) =>
    d1.circ(cx, cy, rx, ry, i.transformerType === label)
  )
  Object.entries(P1_TX_TYPE_R).forEach(([label, [cx, cy, rx, ry]]) =>
    d1.circ(cx, cy, rx, ry, r.transformerType === label)
  )

  // ── Page 1: Make & model ──────────────────────────────────────────────────
  d1.tc(P1_MAKE.issued.fieldLeft,  P1_MAKE.issued.fieldWidth,  P1_MAKE.issued.y,  i.make)
  d1.tc(P1_MAKE.removed.fieldLeft, P1_MAKE.removed.fieldWidth, P1_MAKE.removed.y, r.make)
  d1.tc(P1_MODEL.issued.fieldLeft,  P1_MODEL.issued.fieldWidth,  P1_MODEL.issued.y,  i.model)
  d1.tc(P1_MODEL.removed.fieldLeft, P1_MODEL.removed.fieldWidth, P1_MODEL.removed.y, r.model)

  // ── Page 1: Issued-only technical data ────────────────────────────────────
  d1.tc(
    P1_ISSUED_TECH.voltTest.fieldLeft,
    P1_ISSUED_TECH.voltTest.fieldWidth,
    P1_ISSUED_TECH.voltTest.y,
    i.voltTest,
  )

  // Tap setting ellipses
  Object.entries(P1_ISSUED_TECH.tap).forEach(([val, [cx, cy, rx]]) =>
    d1.circ(cx, cy, rx, 6, i.tapSetting === val)
  )

  // MDI fitted
  d1.ck(P1_ISSUED_TECH.mdiYes.x, P1_ISSUED_TECH.mdiYes.y, i.mdiFitted === 'YES')
  d1.ck(P1_ISSUED_TECH.mdiNo.x,  P1_ISSUED_TECH.mdiNo.y,  i.mdiFitted === 'NO')

  // CT Ratio (centred)
  d1.tc(
    P1_ISSUED_TECH.ctRatio.fieldLeft,
    P1_ISSUED_TECH.ctRatio.fieldWidth,
    P1_ISSUED_TECH.ctRatio.y,
    i.ctRatio,
  )

  // Earth tests
  d1.t(P1_ISSUED_TECH.earthTest1.x, P1_ISSUED_TECH.earthTest1.y, i.earthTest1)
  d1.t(P1_ISSUED_TECH.earthTest2.x, P1_ISSUED_TECH.earthTest2.y, i.earthTest2)
  d1.t(P1_ISSUED_TECH.totalMEN.x,   P1_ISSUED_TECH.totalMEN.y,   i.totalMEN)

  // Fuse sizes
  d1.t(P1_ISSUED_TECH.fuseSizeHV.x, P1_ISSUED_TECH.fuseSizeHV.y, i.fuseSizeHV)
  d1.t(P1_ISSUED_TECH.fuseSizeLV.x, P1_ISSUED_TECH.fuseSizeLV.y, i.fuseSizeLV)

  // LV disconnector
  d1.t(P1_ISSUED_TECH.lvDisconnectorMake.x,  P1_ISSUED_TECH.lvDisconnectorMake.y,  i.lvDisconnectorMake)
  d1.t(P1_ISSUED_TECH.lvDisconnectorModel.x, P1_ISSUED_TECH.lvDisconnectorModel.y, i.lvDisconnectorModel)

  // ── Page 1: Removal reasons ───────────────────────────────────────────────
  const reasons = Array.isArray(r.reasonForRemoval) ? r.reasonForRemoval : []
  Object.entries(P1_REMOVAL_REASONS).forEach(([label, pos]) =>
    d1.ck(pos.x, pos.y, reasons.includes(label))
  )

  // ── Page 1: Removed to store ──────────────────────────────────────────────
  d1.t(P1_REMOVED_TO_STORE.x, P1_REMOVED_TO_STORE.y, d.removedToStore)

  // ── Page 2: Comments (pre-split on newlines) ──────────────────────────────
  const commentLines = (d.comments || '').split('\n')
  commentLines.slice(0, P2_COMMENT_Y.length).forEach((line, idx) => {
    d2.t(P2_COMMENT_X, P2_COMMENT_Y[idx], line)
  })

  // ── Photo pages ───────────────────────────────────────────────────────────
  if (photos && photos.length > 0) {
    await appendPhotosToPdf(pdfDoc, photos)
  }

  // ── Serialise ─────────────────────────────────────────────────────────────
  return new Uint8Array(await pdfDoc.save())
}
