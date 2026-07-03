/**
 * TransformerPdfGenerator.js — PDF generator for 360S014EG
 * (AS-Built Transformer Record).
 *
 * Nearly every field on this form comes in an "Issued" / "Removed" pair at
 * mirrored coordinates, and several option-groups (phases, transformer
 * type, tap setting, enclosure type, connection type) were previously
 * expressed as a shared map looked up by the current value. Each option is
 * now its own named field — same outcome as every other form, and each one
 * can be moved or recalibrated independently of its siblings.
 *
 * issued()/removed() are small helpers mirroring the original's
 * `d.issued || {}` / `d.removed || {}` fallback, so every "issued"/"removed"
 * field can read its parent object safely even if it's missing.
 *
 * Page 2 is a list of comment lines split on '\n' — the user's textarea
 * newlines map straight onto fixed ruled lines on the form (no word-
 * wrapping), so that stays as a small loop reading from GRIDS rather than a
 * single field.
 *
 * Coordinate convention
 * ─────────────────────
 * All Y values are TOP-ORIGIN (CSS / screen style). renderFields converts
 * them to pdf-lib bottom-origin internally.
 *
 * @param {object}  d       - Form state from TransformerWizard
 * @param {Array}   photos  - Photo attachments
 * @returns {Promise<Uint8Array>}
 */

import { PDFDocument, StandardFonts } from 'pdf-lib'
import { fetchPdfTemplate, createPageDrawer, DEFAULT_INK, A4_HEIGHT } from '../../shared/pdfDrawUtils'
import { renderFields, renderGridRow } from '../../shared/pdfFieldRenderer'
import { appendPhotosToPdf } from '../../shared/appendPhotosToPdf'

const getTemplateUrl = () =>
  `${import.meta.env.BASE_URL}forms/360S014EG.pdf`

// ── Safe accessors for the issued/removed sub-objects ────────────────────────
const issued  = d => d.issued  || {}
const removed = d => d.removed || {}
const removalReasons = d => (Array.isArray(removed(d).reasonForRemoval) ? removed(d).reasonForRemoval : [])

// ─────────────────────────────────────────────────────────────────────────────
// FIELDS — Page 1. Page 2 has no simple named fields (only the GRIDS
// comment-line list).
// ─────────────────────────────────────────────────────────────────────────────

export const FIELDS = {
  p1: {

    // ── Header ─────────────────────────────────────────────────────────────────
    streetRoad:        { type: 'text', align: 'left', x: 115, y:  88, value: d => d.streetRoad },
    contractor:        { type: 'text', align: 'left', x: 440, y:  88, value: d => d.contractor },
    cityTown:          { type: 'text', align: 'left', x: 115, y: 106, value: d => d.cityTown },
    district:          { type: 'text', align: 'left', x: 250, y: 106, value: d => d.district },
    dateWorkCompleted: { type: 'text', align: 'left', x: 440, y: 106, value: d => d.dateWorkCompleted },
    pcoWONo:           { type: 'text', align: 'left', x: 115, y: 123, value: d => d.pcoWONo },
    ciwrNo:            { type: 'text', align: 'left', x: 250, y: 123, value: d => d.ciwrNo },
    npJobNumber:       { type: 'text', align: 'left', x: 160, y: 140, value: d => d.npJobNumber },
    namePrint:         { type: 'text', align: 'left', x: 440, y: 141, value: d => d.namePrint },
    signed:            { type: 'signature', x: 438, y: 118, maxW: 120, maxH: 22, value: d => d.signed },

    // Site details — centred within their cells
    transformerSiteId: { type: 'text', align: 'center', x:  33, width: 128, y: 195, value: d => d.transformerSiteId },
    poleId:             { type: 'text', align: 'center', x: 162, width: 128, y: 195, value: d => d.poleId },
    zoneSubstation:     { type: 'text', align: 'center', x: 296, width: 128, y: 195, value: d => d.zoneSubstation },
    feederId:           { type: 'text', align: 'center', x: 439, width: 126, y: 195, value: d => d.feederId },

    // ── Installation type ────────────────────────────────────────────────────────
    installNew:            { type: 'check', x: 144, y: 222, value: d => d.installationType === 'New' },
    installRefurbished:    { type: 'check', x: 218, y: 222, value: d => d.installationType === 'Refurbished' },
    installEmergencyStock: { type: 'check', x: 317, y: 222, value: d => d.installationType === 'Emergency / Stock' },
    installRemovalOnly:    { type: 'check', x: 446, y: 222, value: d => d.installationType === 'Removal Only' },

    // ── Ownership ────────────────────────────────────────────────────────────────
    ownershipPowerco:  { type: 'check', x: 144, y: 243, value: d => d.ownership === 'Powerco' },
    ownershipCustomer: { type: 'check', x: 218, y: 243, value: d => d.ownership === 'Customer' },
    ownershipOther:    { type: 'check', x: 317, y: 243, value: d => d.ownership === 'Other' },
    ownershipOtherText: { type: 'text', align: 'left', x: 360, y: 219, value: d => (d.ownership === 'Other' ? d.ownershipOther : '') },

    // ── Voltage ──────────────────────────────────────────────────────────────────
    issuedVoltageHV:  { type: 'text', align: 'center', x: 150, width:  85, y: 311, value: d => issued(d).voltageHV },
    issuedVoltageLV:  { type: 'text', align: 'center', x: 250, width:  85, y: 311, value: d => issued(d).voltageLV },
    removedVoltageHV: { type: 'text', align: 'center', x: 360, width:  95, y: 311, value: d => removed(d).voltageHV },
    removedVoltageLV: { type: 'text', align: 'center', x: 480, width:  70, y: 311, value: d => removed(d).voltageLV },

    // ── Connection type — Issued HV / LV, Removed HV / LV ───────────────────────
    issuedConnHVBushing:    { type: 'check', x: 148, y: 327, value: d => issued(d).connectionTypeHV === 'Bushing' },
    issuedConnHVCableBox:   { type: 'check', x: 148, y: 344, value: d => issued(d).connectionTypeHV === 'Cable Box' },
    issuedConnHVDeadBreak:  { type: 'check', x: 148, y: 361, value: d => issued(d).connectionTypeHV === 'Dead Break' },
    issuedConnHVPitchBox:   { type: 'check', x: 148, y: 378, value: d => issued(d).connectionTypeHV === 'Pitch Box' },

    issuedConnLVBushing:    { type: 'check', x: 247, y: 327, value: d => issued(d).connectionTypeLV === 'Bushing' },
    issuedConnLVCableBox:   { type: 'check', x: 247, y: 344, value: d => issued(d).connectionTypeLV === 'Cable Box' },
    issuedConnLVDeadBreak:  { type: 'check', x: 247, y: 361, value: d => issued(d).connectionTypeLV === 'Dead Break' },
    issuedConnLVResin:      { type: 'check', x: 247, y: 378, value: d => issued(d).connectionTypeLV === 'Resin' },

    removedConnHVBushing:   { type: 'check', x: 361, y: 327, value: d => removed(d).connectionTypeHV === 'Bushing' },
    removedConnHVCableBox:  { type: 'check', x: 361, y: 344, value: d => removed(d).connectionTypeHV === 'Cable Box' },
    removedConnHVDeadBreak: { type: 'check', x: 361, y: 361, value: d => removed(d).connectionTypeHV === 'Dead Break' },
    removedConnHVPitchBox:  { type: 'check', x: 361, y: 378, value: d => removed(d).connectionTypeHV === 'Pitch Box' },

    removedConnLVBushing:   { type: 'check', x: 467, y: 327, value: d => removed(d).connectionTypeLV === 'Bushing' },
    removedConnLVCableBox:  { type: 'check', x: 467, y: 344, value: d => removed(d).connectionTypeLV === 'Cable Box' },
    // NOTE: x:466 (not 467) — matches the original LAYOUT exactly; not a typo
    // we're free to "fix" since that would shift this one tick visually.
    removedConnLVDeadBreak: { type: 'check', x: 466, y: 361, value: d => removed(d).connectionTypeLV === 'Dead Break' },
    removedConnLVResin:     { type: 'check', x: 467, y: 378, value: d => removed(d).connectionTypeLV === 'Resin' },

    // ── Capacity ─────────────────────────────────────────────────────────────────
    issuedCapacityKVA:  { type: 'text', align: 'center', x: 155, width: 170, y: 400, value: d => issued(d).capacityKVA },
    removedCapacityKVA: { type: 'text', align: 'center', x: 330, width: 260, y: 400, value: d => removed(d).capacityKVA },

    // ── Phase ellipses ───────────────────────────────────────────────────────────
    issuedPhaseThree:  { type: 'ellipse', cx: 216, cy: 428, rx: 16, ry: 7, value: d => issued(d).phases === 'Three' },
    issuedPhaseOne:    { type: 'ellipse', cx: 240, cy: 428, rx: 11, ry: 7, value: d => issued(d).phases === 'One' },
    issuedPhaseSWER:   { type: 'ellipse', cx: 265, cy: 428, rx: 14, ry: 7, value: d => issued(d).phases === 'SWER' },
    removedPhaseThree: { type: 'ellipse', cx: 434, cy: 428, rx: 16, ry: 7, value: d => removed(d).phases === 'Three' },
    removedPhaseOne:   { type: 'ellipse', cx: 458, cy: 428, rx: 11, ry: 7, value: d => removed(d).phases === 'One' },
    removedPhaseSWER:  { type: 'ellipse', cx: 483, cy: 428, rx: 14, ry: 7, value: d => removed(d).phases === 'SWER' },

    // ── Serial numbers ───────────────────────────────────────────────────────────
    issuedSerialNumber:  { type: 'text', align: 'center', x: 155, width: 170, y: 445, value: d => issued(d).serialNumber },
    removedSerialNumber: { type: 'text', align: 'center', x: 330, width: 260, y: 445, value: d => removed(d).serialNumber },

    // ── Enclosure type ───────────────────────────────────────────────────────────
    issuedEncPoleMount:       { type: 'check', x: 148, y: 464, value: d => issued(d).enclosureType === 'Pole Mount' },
    issuedEncPlastic:         { type: 'check', x: 247, y: 464, value: d => issued(d).enclosureType === 'Plastic' },
    issuedEncFibreglass:      { type: 'check', x: 148, y: 481, value: d => issued(d).enclosureType === 'Fibreglass' },
    issuedEncBuilding:        { type: 'check', x: 247, y: 481, value: d => issued(d).enclosureType === 'Building' },
    issuedEncFenced:          { type: 'check', x: 148, y: 498, value: d => issued(d).enclosureType === 'Fenced' },
    issuedEncMetalCover:      { type: 'check', x: 247, y: 498, value: d => issued(d).enclosureType === 'Metal Cover' },
    issuedEncCustomerPremise: { type: 'check', x: 148, y: 515, value: d => issued(d).enclosureType === 'Customer Premise' },

    removedEncPoleMount:       { type: 'check', x: 361, y: 464, value: d => removed(d).enclosureType === 'Pole Mount' },
    removedEncPlastic:         { type: 'check', x: 467, y: 464, value: d => removed(d).enclosureType === 'Plastic' },
    removedEncFibreglass:      { type: 'check', x: 361, y: 481, value: d => removed(d).enclosureType === 'Fibreglass' },
    removedEncBuilding:        { type: 'check', x: 467, y: 481, value: d => removed(d).enclosureType === 'Building' },
    removedEncFenced:          { type: 'check', x: 361, y: 498, value: d => removed(d).enclosureType === 'Fenced' },
    removedEncMetalCover:      { type: 'check', x: 467, y: 498, value: d => removed(d).enclosureType === 'Metal Cover' },
    removedEncCustomerPremise: { type: 'check', x: 361, y: 515, value: d => removed(d).enclosureType === 'Customer Premise' },

    issuedEnclosureModel:  { type: 'text', align: 'center', x: 155, width: 170, y: 536, value: d => issued(d).enclosureModel },
    removedEnclosureModel: { type: 'text', align: 'center', x: 330, width: 260, y: 536, value: d => removed(d).enclosureModel },

    // ── Transformer type ellipses ─────────────────────────────────────────────────
    issuedTxBearer:     { type: 'ellipse', cx: 172, cy: 565, rx: 16, ry: 8, value: d => issued(d).transformerType === 'Bearer' },
    issuedTxGrndMount:  { type: 'ellipse', cx: 219, cy: 565, rx: 26, ry: 8, value: d => issued(d).transformerType === 'Grnd Mount' },
    issuedTxHanger:     { type: 'ellipse', cx: 265, cy: 565, rx: 17, ry: 8, value: d => issued(d).transformerType === 'Hanger' },
    issuedTxPedestal:   { type: 'ellipse', cx: 305, cy: 565, rx: 20, ry: 8, value: d => issued(d).transformerType === 'Pedestal' },
    removedTxBearer:    { type: 'ellipse', cx: 390, cy: 565, rx: 16, ry: 8, value: d => removed(d).transformerType === 'Bearer' },
    removedTxGrndMount: { type: 'ellipse', cx: 436, cy: 565, rx: 26, ry: 8, value: d => removed(d).transformerType === 'Grnd Mount' },
    removedTxHanger:    { type: 'ellipse', cx: 483, cy: 565, rx: 17, ry: 8, value: d => removed(d).transformerType === 'Hanger' },
    removedTxPedestal:  { type: 'ellipse', cx: 523, cy: 565, rx: 20, ry: 8, value: d => removed(d).transformerType === 'Pedestal' },

    // ── Make / model ───────────────────────────────────────────────────────────────
    issuedMake:   { type: 'text', align: 'center', x: 155, width: 170, y: 581, value: d => issued(d).make },
    removedMake:  { type: 'text', align: 'center', x: 330, width: 260, y: 581, value: d => removed(d).make },
    issuedModel:  { type: 'text', align: 'center', x: 155, width: 170, y: 604, value: d => issued(d).model },
    removedModel: { type: 'text', align: 'center', x: 330, width: 260, y: 604, value: d => removed(d).model },

    // ── Issued-only technical data ───────────────────────────────────────────────
    issuedVoltTest: { type: 'text', align: 'center', x: 155, width: 170, y: 628, value: d => issued(d).voltTest },

    // Tap setting ellipses — ry is fixed at 6 for every option (matches original)
    tapMinus10: { type: 'ellipse', cx: 164, cy: 654, rx: 10, ry: 6, value: d => issued(d).tapSetting === '-10' },
    tapMinus75: { type: 'ellipse', cx: 191, cy: 654, rx: 10, ry: 6, value: d => issued(d).tapSetting === '-7.5' },
    tapMinus5:  { type: 'ellipse', cx: 217, cy: 654, rx: 10, ry: 6, value: d => issued(d).tapSetting === '-5' },
    tapMinus25: { type: 'ellipse', cx: 242, cy: 654, rx: 10, ry: 6, value: d => issued(d).tapSetting === '-2.5' },
    tapZero:    { type: 'ellipse', cx: 266, cy: 654, rx: 10, ry: 6, value: d => issued(d).tapSetting === '0' },
    tapPlus25:  { type: 'ellipse', cx: 292, cy: 654, rx: 11, ry: 6, value: d => issued(d).tapSetting === '+2.5' },
    tapPlus5:   { type: 'ellipse', cx: 319, cy: 654, rx: 10, ry: 6, value: d => issued(d).tapSetting === '+5' },

    mdiYes: { type: 'check', x: 148, y: 663, value: d => issued(d).mdiFitted === 'YES' },
    mdiNo:  { type: 'check', x: 247, y: 663, value: d => issued(d).mdiFitted === 'NO' },

    issuedCtRatio: { type: 'text', align: 'center', x: 155, width: 170, y: 682, value: d => issued(d).ctRatio },

    issuedEarthTest1: { type: 'text', align: 'left', x: 160, y: 699, value: d => issued(d).earthTest1 },
    issuedEarthTest2: { type: 'text', align: 'left', x: 221, y: 699, value: d => issued(d).earthTest2 },
    issuedTotalMEN:   { type: 'text', align: 'left', x: 300, y: 699, value: d => issued(d).totalMEN },

    issuedFuseSizeHV: { type: 'text', align: 'left', x: 175, y: 717, value: d => issued(d).fuseSizeHV },
    issuedFuseSizeLV: { type: 'text', align: 'left', x: 275, y: 717, value: d => issued(d).fuseSizeLV },

    issuedLvDisconnectorMake:  { type: 'text', align: 'left', x: 175, y: 737, value: d => issued(d).lvDisconnectorMake },
    issuedLvDisconnectorModel: { type: 'text', align: 'left', x: 275, y: 737, value: d => issued(d).lvDisconnectorModel },

    // ── Removal reasons ──────────────────────────────────────────────────────────
    removalReasonRelocation:     { type: 'check', x: 361, y: 647, value: d => removalReasons(d).includes('Relocation') },
    removalReasonVegetation:     { type: 'check', x: 467, y: 647, value: d => removalReasons(d).includes('Vegetation') },
    removalReasonSiteDismantled: { type: 'check', x: 361, y: 664, value: d => removalReasons(d).includes('Site Dismantled') },
    removalReasonReconstruction: { type: 'check', x: 467, y: 664, value: d => removalReasons(d).includes('Reconstruction') },
    removalReasonVehicleAccident:{ type: 'check', x: 361, y: 681, value: d => removalReasons(d).includes('Vehicle Accident') },
    removalReasonEndOfLife:      { type: 'check', x: 467, y: 681, value: d => removalReasons(d).includes('End of Life') },
    removalReasonCapacityChange: { type: 'check', x: 361, y: 697, value: d => removalReasons(d).includes('Capacity Change') },
    removalReasonFaulty:         { type: 'check', x: 467, y: 697, value: d => removalReasons(d).includes('Faulty') },
    removalReasonAdverseWeather: { type: 'check', x: 361, y: 725, value: d => removalReasons(d).includes('Adverse Weather') },
    removalReasonVandalism:      { type: 'check', x: 467, y: 725, value: d => removalReasons(d).includes('Vandalism') },

    // ── Removed to store ──────────────────────────────────────────────────────────
    removedToStore: { type: 'text', align: 'left', x: 178, y: 755, value: d => d.removedToStore },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// GRIDS — Page 2 comment lines. The user's textarea newlines map directly
// onto fixed ruled lines (no word-wrapping), so this is a row list rather
// than a single field.
// ─────────────────────────────────────────────────────────────────────────────

export const GRIDS = {
  p2Comments: {
    x: 60,
    align: 'left', // change to 'center' or 'right' if needed ('center' also needs `width`)
    width: undefined,
    rowY: [90, 104, 118, 132, 146, 160, 174],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function generateTransformerPdf(d, photos = []) {
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const [p1, p2]      = pdfDoc.getPages()
  const draw1         = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)
  const draw2         = createPageDrawer(p2, font, DEFAULT_INK, A4_HEIGHT)

  await renderFields({ pdfDoc, page: p1, draw: draw1 }, FIELDS.p1, d)

  // ── Page 2: Comments — split on newlines onto fixed ruled lines ─────────
  // Reuses renderGridRow with a single synthetic "line" column so this list
  // gets the same alignment control as every other grid (change
  // GRIDS.p2Comments.align to 'center' or 'right' if needed).
  const { x: cx, align, width, rowY } = GRIDS.p2Comments
  const lineCol = { line: { x: cx, align, width } }
  const commentLines = (d.comments || '').split('\n')
  commentLines.slice(0, rowY.length).forEach((line, idx) => {
    renderGridRow(draw2, lineCol, rowY[idx], { line })
  })

  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}
