/**
 * ElecEquipPdfGenerator.js — Pure async PDF generator for 360S014EE
 * (AS-Built Electrical Equipment Record).
 *
 * This form spans two pages of the source PDF:
 *   Page 1 — main equipment record  (portrait A4,  595 × 842 pt)
 *   Page 2 — multi-item table       (landscape A4, 842 × 595 pt)
 *
 * The template is fetched once and kept in the shared in-memory cache via
 * fetchPdfTemplate(), so repeat previews within a session cost no network I/O.
 *
 * Usage inside the wizard:
 *   import { generateEEPdf } from './generators/ElecEquipPdfGenerator'
 *   const { pdfBytes, ... } = usePdfGenerate(generateEEPdf)
 *
 * @param {object} d      - Wizard form state (see ElecEquipWizard.jsx for shape)
 * @param {Array}  photos - [{ dataUrl: string, name?: string }]
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
  `${import.meta.env.BASE_URL}forms/360S014EE.pdf`

// ── Layout schema — all Y values are top-origin (CSS-style) ──────────────────
// The createPageDrawer helpers convert these to pdf-lib bottom-origin internally.

const LAYOUT = {

  // ── Page 1: Main Equipment Record (portrait A4, 842 pt tall) ──────────────
  p1: {

    header: {
      streetRoad:        { x: 115, y: 110 },
      contractor:        { x: 394, y: 110 },
      dateWorkCompleted: { x: 394, y: 124 },
      cityTown:          { x: 115, y: 139 },
      district:          { x: 115, y: 154 },
      namePrint:         { x: 394, y: 154 },
      pcoWONo:           { x: 170, y: 168 },
      ciwrNo:            { x: 490, y: 160 },
      // Signature: cssY is the top of the image in top-origin coords.
      // Bottom of image sits on the form underline at pdf-lib y=691 (842-151).
      // Top in top-origin: 842 - (691+18) = 133.
      signature:         { x: 388, y: 133, maxW: 110, maxH: 18 },
    },

    // Equipment IDs and make/model — centred within their column cells
    equipmentCells: {
      newEquipmentId:    { fieldLeft:  33, fieldWidth: 200, y: 232 },
      oldEquipmentId:    { fieldLeft: 204, fieldWidth: 200, y: 232 },
      locationPoleSiteId:{ fieldLeft: 374, fieldWidth: 200, y: 232 },
      manufacturer:      { fieldLeft:  33, fieldWidth: 200, y: 276 },
      model:             { fieldLeft: 204, fieldWidth: 200, y: 276 },
      serialNo:          { fieldLeft: 374, fieldWidth: 200, y: 276 },
    },

    // Equipment type checkboxes
    equipmentType: {
      'Flicker ABS':              { x:  45, y: 322 },
      'Fused ABS':                { x:  45, y: 336 },
      'Standard ABS':             { x:  45, y: 351 },
      'Load Break Switch':        { x:  45, y: 365 },
      'Vacuum Load Break Switch': { x:  45, y: 379 },
      'Earth Switch':             { x:  45, y: 394 },
      'Ring Main Unit':           { x: 220, y: 322 },
      'Circuit Breaker':          { x: 220, y: 336 },
      'Recloser/Sectionaliser':   { x: 220, y: 351 },
      'Voltage Regulator':        { x: 220, y: 365 },
      'Generator':                { x: 220, y: 379 },
      'Solid Link':               { x: 395, y: 322 },
      'TX Fuse':                  { x: 395, y: 336 },
      'Line Fuse':                { x: 395, y: 351 },
      'Knife Link':               { x: 395, y: 365 },
      'Lightning Arrester':       { x: 395, y: 379 },
      'Other':                    { x: 220, y: 394 },
    },
    equipmentTypeOtherText: { x: 375, y: 396 },

    // Type of Change checkboxes (all on same Y row)
    typeOfChange: {
      'New':      { x: 155, y: 435 },
      'Removed':  { x: 254, y: 435 },
      'Replaced': { x: 353, y: 435 },
    },

    // Ownership checkboxes
    ownership: {
      'Powerco': { x: 155, y: 450 },
      'Private': { x: 254, y: 450 },
      'Other':   { x: 353, y: 450 },
    },
    ownershipOtherText: { x: 435, y: 452 },

    reasonForRemoval: { x: 140, y: 467 },

    // Equipment rating table — up to 5 switch/way rows
    rating: {
      rowY: [556, 570, 585, 599, 613],
      cols: {
        equipmentId:        45,
        normalStateOpen:   135,
        normalStateClosed: 205,
        operatingVoltage:  290,
        voltageRating:     395,
        fuseSize:          480,
      },
    },

    // Remote controlled / indication checkboxes
    remoteControlled: {
      Yes: { x: 156, y: 655 },
      No:  { x: 254, y: 655 },
    },
    remoteIndication: {
      Yes: { x: 156, y: 669 },
      No:  { x: 254, y: 669 },
    },

    // Comments — word-wrapped across 4 ruled lines (lineHeight = 14 pt)
    comments: {
      x:        45,
      maxW:    510,
      startY:  710,
      lineH:    14,
      maxLines:  4,
    },
  },

  // ── Page 2: Multi-Item Table (landscape A4, pageHeight = 595 pt) ──────────
  // pageHeight is read dynamically via p2.getSize() at generation time so
  // this schema does not hard-code it — all Y values remain top-origin.
  p2: {
    multiItems: {
      startY:    161,   // top-origin Y for the first data row
      rowHeight:  22,   // vertical gap between rows
      cols: {
        // ir is centred in a narrow cell
        ir:              { fieldLeft: 67, fieldWidth: 20 },
        // remaining columns are left-aligned text
        equipmentId:      110,
        equipmentType:    180,
        manufacturer:     290,
        model:            395,
        serialNumber:     490,
        operatingVoltage: 612,
        voltageRating:    675,
        fuseSize:         740,
      },
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function generateEEPdf(d, photos = []) {
  // ── Load template (cached after first call) ───────────────────────────────
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages         = pdfDoc.getPages()
  const p1            = pages[0]
  const p2            = pages.length > 1 ? pages[1] : null

  // Page 1 is portrait A4
  const d1 = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)

  // ── Page 1: Header ───────────────────────────────────────────────────────
  const { header } = LAYOUT.p1
  d1.t(header.streetRoad.x,        header.streetRoad.y,        d.streetRoad)
  d1.t(header.contractor.x,        header.contractor.y,        d.contractor)
  d1.t(header.dateWorkCompleted.x, header.dateWorkCompleted.y, d.dateWorkCompleted)
  d1.t(header.cityTown.x,          header.cityTown.y,          d.cityTown)
  d1.t(header.district.x,          header.district.y,          d.district)
  d1.t(header.namePrint.x,         header.namePrint.y,         d.namePrint)
  d1.t(header.pcoWONo.x,           header.pcoWONo.y,           d.pcoWONo)
  d1.t(header.ciwrNo.x,            header.ciwrNo.y,            d.ciwrNo)

  await drawSignature(
    pdfDoc, p1, d.signed,
    header.signature.x, header.signature.y,
    header.signature.maxW, header.signature.maxH,
    A4_HEIGHT,
  )

  // ── Page 1: Equipment IDs and make/model (centred in cells) ─────────────
  const { equipmentCells: ec } = LAYOUT.p1
  d1.tc(ec.newEquipmentId.fieldLeft,     ec.newEquipmentId.fieldWidth,     ec.newEquipmentId.y,     d.newEquipmentId)
  d1.tc(ec.oldEquipmentId.fieldLeft,     ec.oldEquipmentId.fieldWidth,     ec.oldEquipmentId.y,     d.oldEquipmentId)
  d1.tc(ec.locationPoleSiteId.fieldLeft, ec.locationPoleSiteId.fieldWidth, ec.locationPoleSiteId.y, d.locationPoleSiteId)
  d1.tc(ec.manufacturer.fieldLeft,       ec.manufacturer.fieldWidth,       ec.manufacturer.y,       d.manufacturer)
  d1.tc(ec.model.fieldLeft,              ec.model.fieldWidth,              ec.model.y,              d.model)
  d1.tc(ec.serialNo.fieldLeft,           ec.serialNo.fieldWidth,           ec.serialNo.y,           d.serialNo)

  // ── Page 1: Equipment type checkbox ─────────────────────────────────────
  const eqPos = LAYOUT.p1.equipmentType[d.equipmentType]
  if (eqPos) d1.ck(eqPos.x, eqPos.y, true)
  if (d.equipmentType === 'Other' && d.equipmentTypeOther) {
    d1.t(
      LAYOUT.p1.equipmentTypeOtherText.x,
      LAYOUT.p1.equipmentTypeOtherText.y,
      d.equipmentTypeOther,
    )
  }

  // ── Page 1: Type of Change checkbox ─────────────────────────────────────
  const tocPos = LAYOUT.p1.typeOfChange[d.typeOfChange]
  if (tocPos) d1.ck(tocPos.x, tocPos.y, true)

  // ── Page 1: Ownership checkbox ───────────────────────────────────────────
  const ownPos = LAYOUT.p1.ownership[d.ownership]
  if (ownPos) d1.ck(ownPos.x, ownPos.y, true)
  if (d.ownership === 'Other' && d.ownershipOther) {
    d1.t(
      LAYOUT.p1.ownershipOtherText.x,
      LAYOUT.p1.ownershipOtherText.y,
      d.ownershipOther,
    )
  }

  // ── Page 1: Reason for removal ───────────────────────────────────────────
  d1.t(LAYOUT.p1.reasonForRemoval.x, LAYOUT.p1.reasonForRemoval.y, d.reasonForRemoval)

  // ── Page 1: Equipment rating rows (up to 5) ──────────────────────────────
  const { rating } = LAYOUT.p1
  ;(d.equipmentRating || []).forEach((row, i) => {
    const y = rating.rowY[i]
    if (!y) return
    d1.t(rating.cols.equipmentId,         y, row.equipmentId)
    d1.ck(rating.cols.normalStateOpen,    y, row.normalState === 'Open')
    d1.ck(rating.cols.normalStateClosed,  y, row.normalState === 'Closed')
    d1.t(rating.cols.operatingVoltage,    y, row.operatingVoltage)
    d1.t(rating.cols.voltageRating,       y, row.voltageRating)
    d1.t(rating.cols.fuseSize,            y, row.fuseSize)
  })

  // ── Page 1: Remote controlled / indication ───────────────────────────────
  d1.ck(LAYOUT.p1.remoteControlled.Yes.x, LAYOUT.p1.remoteControlled.Yes.y, d.remoteControlled === 'Yes')
  d1.ck(LAYOUT.p1.remoteControlled.No.x,  LAYOUT.p1.remoteControlled.No.y,  d.remoteControlled === 'No')
  d1.ck(LAYOUT.p1.remoteIndication.Yes.x, LAYOUT.p1.remoteIndication.Yes.y, d.remoteIndication === 'Yes')
  d1.ck(LAYOUT.p1.remoteIndication.No.x,  LAYOUT.p1.remoteIndication.No.y,  d.remoteIndication === 'No')

  // ── Page 1: Comments (word-wrapped, 4 ruled lines, lineHeight 14 pt) ─────
  const { comments: cm } = LAYOUT.p1
  d1.tWrap(cm.x, cm.startY, d.comments, cm.maxW, 8.5, cm.lineH, cm.maxLines)

  // ── Page 2: Multi-item equipment table ───────────────────────────────────
  // Page 2 is landscape A4 (842 × 595 pt). We read the actual page height
  // dynamically so that the coordinate conversions are always correct,
  // regardless of how the source PDF encodes the orientation.
  if (p2) {
    const { height: p2Height } = p2.getSize()
    const d2 = createPageDrawer(p2, font, DEFAULT_INK, p2Height)

    const { multiItems } = LAYOUT.p2
    const { cols } = multiItems

    const mRows = (d.multiItems || []).filter(
      r => r.ir || r.equipmentId || r.equipmentType,
    )

    mRows.forEach((row, i) => {
      const y = multiItems.startY + i * multiItems.rowHeight
      // ir field is centred in its narrow cell
      d2.tc(cols.ir.fieldLeft, cols.ir.fieldWidth, y, row.ir)
      // remaining columns are left-aligned
      d2.t(cols.equipmentId,      y, row.equipmentId)
      d2.t(cols.equipmentType,    y, row.equipmentType)
      d2.t(cols.manufacturer,     y, row.manufacturer)
      d2.t(cols.model,            y, row.model)
      d2.t(cols.serialNumber,     y, row.serialNumber)
      d2.t(cols.operatingVoltage, y, row.operatingVoltage)
      d2.t(cols.voltageRating,    y, row.voltageRating)
      d2.t(cols.fuseSize,         y, row.fuseSize)
    })
  }

  // ── Photo pages ──────────────────────────────────────────────────────────
  if (photos && photos.length > 0) {
    await appendPhotosToPdf(pdfDoc, photos)
  }

  return new Uint8Array(await pdfDoc.save())
}
