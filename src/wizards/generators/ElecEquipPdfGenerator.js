/**
 * ElecEquipPdfGenerator.js — PDF generator for 360S014EE
 * (AS-Built Electrical Equipment Record).
 *
 * This form spans two pages of the source PDF:
 *   Page 1 — main equipment record  (portrait A4,  595 × 842 pt)
 *   Page 2 — multi-item table       (landscape A4, 842 × 595 pt)
 *
 * The original "lookup the position for the current value" pattern used for
 * equipment type / type of change / ownership (one shared map, looked up by
 * d.equipmentType etc.) is expressed here the same way as every other
 * checkbox on the form: one named field per option, each checking
 * `d.fieldName === 'Option'`. Same outcome, consistent with the rest of the
 * codebase, and each option can be moved/recalibrated independently.
 *
 * The equipment rating table (up to 5 rows) and the page 2 multi-item table
 * stay as small loops reading from GRIDS — see
 * DistributionTransformerPdfGenerator.js for more on this split.
 *
 * Coordinate convention
 * ─────────────────────
 * All Y values are TOP-ORIGIN (CSS / screen style). renderFields converts
 * them to pdf-lib bottom-origin internally. Page 2 is landscape — its
 * pageHeight is read dynamically via p2.getSize() at generation time, same
 * as before.
 *
 * @param {object} d      - Wizard form state (see ElecEquipWizard.jsx for shape)
 * @param {Array}  photos - [{ dataUrl: string, name?: string }]
 * @returns {Promise<Uint8Array>}
 */

import { PDFDocument, StandardFonts } from 'pdf-lib'
import { fetchPdfTemplate, createPageDrawer, DEFAULT_INK, A4_HEIGHT } from '../../shared/pdfDrawUtils'
import { renderFields, renderGridRow } from '../../shared/pdfFieldRenderer'
import { appendPhotosToPdf } from '../../shared/appendPhotosToPdf'

const getTemplateUrl = () =>
  `${import.meta.env.BASE_URL}forms/360S014EE.pdf`

// ─────────────────────────────────────────────────────────────────────────────
// FIELDS — Page 1 (page 2 has no simple named fields, only the GRIDS table).
// ─────────────────────────────────────────────────────────────────────────────

export const FIELDS = {
  p1: {
    // ── Header ─────────────────────────────────────────────────────────────────
    streetRoad:        { type: 'text', align: 'left', x: 115, y: 110, value: d => d.streetRoad },
    contractor:        { type: 'text', align: 'left', x: 394, y: 110, value: d => d.contractor },
    dateWorkCompleted: { type: 'text', align: 'left', x: 394, y: 124, value: d => d.dateWorkCompleted },
    cityTown:          { type: 'text', align: 'left', x: 115, y: 139, value: d => d.cityTown },
    district:          { type: 'text', align: 'left', x: 115, y: 154, value: d => d.district },
    namePrint:         { type: 'text', align: 'left', x: 394, y: 154, value: d => d.namePrint },
    pcoWONo:           { type: 'text', align: 'left', x: 170, y: 168, value: d => d.pcoWONo },
    ciwrNo:            { type: 'text', align: 'left', x: 490, y: 160, value: d => d.ciwrNo },
    signed:            { type: 'signature', x: 388, y: 133, maxW: 110, maxH: 18, value: d => d.signed },

    // ── Equipment IDs and make/model — centred within their column cells ───────
    newEquipmentId:     { type: 'text', align: 'center', x:  33, width: 200, y: 232, value: d => d.newEquipmentId },
    oldEquipmentId:     { type: 'text', align: 'center', x: 204, width: 200, y: 232, value: d => d.oldEquipmentId },
    locationPoleSiteId: { type: 'text', align: 'center', x: 374, width: 200, y: 232, value: d => d.locationPoleSiteId },
    manufacturer:       { type: 'text', align: 'center', x:  33, width: 200, y: 276, value: d => d.manufacturer },
    model:              { type: 'text', align: 'center', x: 204, width: 200, y: 276, value: d => d.model },
    serialNo:           { type: 'text', align: 'center', x: 374, width: 200, y: 276, value: d => d.serialNo },

    // ── Equipment type — one checkbox per option ───────────────────────────────
    eqTypeFlickerABS:           { type: 'check', x:  45, y: 322, value: d => d.equipmentType === 'Flicker ABS' },
    eqTypeFusedABS:             { type: 'check', x:  45, y: 336, value: d => d.equipmentType === 'Fused ABS' },
    eqTypeStandardABS:          { type: 'check', x:  45, y: 351, value: d => d.equipmentType === 'Standard ABS' },
    eqTypeLoadBreakSwitch:      { type: 'check', x:  45, y: 365, value: d => d.equipmentType === 'Load Break Switch' },
    eqTypeVacuumLoadBreakSwitch:{ type: 'check', x:  45, y: 379, value: d => d.equipmentType === 'Vacuum Load Break Switch' },
    eqTypeEarthSwitch:          { type: 'check', x:  45, y: 394, value: d => d.equipmentType === 'Earth Switch' },
    eqTypeRingMainUnit:         { type: 'check', x: 220, y: 322, value: d => d.equipmentType === 'Ring Main Unit' },
    eqTypeCircuitBreaker:       { type: 'check', x: 220, y: 336, value: d => d.equipmentType === 'Circuit Breaker' },
    eqTypeReclSectionaliser:    { type: 'check', x: 220, y: 351, value: d => d.equipmentType === 'Recloser/Sectionaliser' },
    eqTypeVoltageRegulator:     { type: 'check', x: 220, y: 365, value: d => d.equipmentType === 'Voltage Regulator' },
    eqTypeGenerator:            { type: 'check', x: 220, y: 379, value: d => d.equipmentType === 'Generator' },
    eqTypeSolidLink:            { type: 'check', x: 395, y: 322, value: d => d.equipmentType === 'Solid Link' },
    eqTypeTXFuse:               { type: 'check', x: 395, y: 336, value: d => d.equipmentType === 'TX Fuse' },
    eqTypeLineFuse:             { type: 'check', x: 395, y: 351, value: d => d.equipmentType === 'Line Fuse' },
    eqTypeKnifeLink:            { type: 'check', x: 395, y: 365, value: d => d.equipmentType === 'Knife Link' },
    eqTypeLightningArrester:    { type: 'check', x: 395, y: 379, value: d => d.equipmentType === 'Lightning Arrester' },
    eqTypeOther:                { type: 'check', x: 220, y: 394, value: d => d.equipmentType === 'Other' },
    equipmentTypeOtherText: {
      type: 'text', align: 'left', x: 375, y: 396,
      value: d => (d.equipmentType === 'Other' ? d.equipmentTypeOther : ''),
    },

    // ── Type of Change ───────────────────────────────────────────────────────────
    typeOfChangeNew:      { type: 'check', x: 155, y: 435, value: d => d.typeOfChange === 'New' },
    typeOfChangeRemoved:  { type: 'check', x: 254, y: 435, value: d => d.typeOfChange === 'Removed' },
    typeOfChangeReplaced: { type: 'check', x: 353, y: 435, value: d => d.typeOfChange === 'Replaced' },

    // ── Ownership ────────────────────────────────────────────────────────────────
    ownershipPowerco: { type: 'check', x: 155, y: 450, value: d => d.ownership === 'Powerco' },
    ownershipPrivate: { type: 'check', x: 254, y: 450, value: d => d.ownership === 'Private' },
    ownershipOther:   { type: 'check', x: 353, y: 450, value: d => d.ownership === 'Other' },
    ownershipOtherText: {
      type: 'text', align: 'left', x: 435, y: 452,
      value: d => (d.ownership === 'Other' ? d.ownershipOther : ''),
    },

    reasonForRemoval: { type: 'text', align: 'left', x: 140, y: 467, value: d => d.reasonForRemoval },

    // ── Remote controlled / indication ───────────────────────────────────────────
    remoteControlledYes: { type: 'check', x: 156, y: 655, value: d => d.remoteControlled === 'Yes' },
    remoteControlledNo:  { type: 'check', x: 254, y: 655, value: d => d.remoteControlled === 'No' },
    remoteIndicationYes: { type: 'check', x: 156, y: 669, value: d => d.remoteIndication === 'Yes' },
    remoteIndicationNo:  { type: 'check', x: 254, y: 669, value: d => d.remoteIndication === 'No' },

    // ── Comments — word-wrapped across 4 ruled lines ────────────────────────────
    comments: { type: 'wrap', x: 45, y: 710, maxWidth: 510, size: 8.5, lineHeight: 14, maxLines: 4, value: d => d.comments },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// GRIDS — equipment rating table (page 1, up to 5 rows) and the multi-item
// table (page 2, landscape, variable rows).
// ─────────────────────────────────────────────────────────────────────────────

export const GRIDS = {
  rating: {
    rowY: [556, 570, 585, 599, 613],
    // Each column has its own x + alignment — change `align` to 'center' or
    // 'right' to match how that column should sit on the printed form
    // (center alignment also needs a `width`). normalStateOpen/Closed are
    // derived checkboxes — they don't read a literal row key, so they use
    // value() to compute their own boolean from row.normalState.
    cols: {
      equipmentId:       { x: 45,  align: 'left' },
      normalStateOpen:   { x: 135, type: 'check', value: row => row.normalState === 'Open' },
      normalStateClosed: { x: 205, type: 'check', value: row => row.normalState === 'Closed' },
      operatingVoltage:  { x: 290, align: 'left' },
      voltageRating:     { x: 395, align: 'left' },
      fuseSize:          { x: 480, align: 'left' },
    },
  },
  multiItems: {
    startY: 161,
    rowHeight: 22,
    cols: {
      ir:               { x: 67, align: 'center', width: 20 }, // centred in its narrow cell
      equipmentId:      { x: 110, align: 'left' },
      equipmentType:    { x: 180, align: 'left' },
      manufacturer:     { x: 290, align: 'left' },
      model:            { x: 395, align: 'left' },
      serialNumber:     { x: 490, align: 'left' },
      operatingVoltage: { x: 612, align: 'left' },
      voltageRating:    { x: 675, align: 'left' },
      fuseSize:         { x: 740, align: 'left' },
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function generateEEPdf(d, photos = []) {
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages         = pdfDoc.getPages()
  const p1            = pages[0]
  const p2            = pages.length > 1 ? pages[1] : null

  const d1 = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)

  await renderFields({ pdfDoc, page: p1, draw: d1 }, FIELDS.p1, d)

  // ── Equipment rating rows (up to 5) ──────────────────────────────────────
  const rating = GRIDS.rating
  ;(d.equipmentRating || []).forEach((row, i) => {
    const y = rating.rowY[i]
    if (!y) return
    renderGridRow(d1, rating.cols, y, row)
  })

  // ── Page 2: Multi-item equipment table ───────────────────────────────────
  // Landscape — pageHeight is read dynamically from the actual page.
  if (p2) {
    const { height: p2Height } = p2.getSize()
    const d2 = createPageDrawer(p2, font, DEFAULT_INK, p2Height)
    const multiItems = GRIDS.multiItems

    const mRows = (d.multiItems || []).filter(r => r.ir || r.equipmentId || r.equipmentType)

    mRows.forEach((row, i) => {
      renderGridRow(d2, multiItems.cols, multiItems.startY + i * multiItems.rowHeight, row)
    })
  }

  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}
