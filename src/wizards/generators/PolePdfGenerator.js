/**
 * PolePdfGenerator.js — PDF generator for 360S014EC (AS-Built Pole Record).
 *
 * The pole-code grid (16 options) and pole-type grid (8 options) were
 * previously matched by ARRAY INDEX against parallel reference arrays
 * (POLE_CODES / POLE_TYPES). Each option is now its own named field — same
 * outcome as every other checkbox group on this form, and each one can be
 * moved or recalibrated independently.
 *
 * Several "equipment on pole" / accessory fields were previously guarded
 * with `if (d.xId !== undefined && d.xId !== null)`. That guard is
 * behaviourally redundant with the draw primitives' own no-op on
 * undefined/null/'' (see pdfDrawUtils.js), so those fields are plain
 * unconditional FIELDS entries here — confirmed equivalent by the
 * comparison harness used while building this conversion.
 *
 * Conductors and crossarms (up to 7 rows each) stay as small loops reading
 * from GRIDS, including their original "skip this row if every relevant
 * column is blank" guards — for crossarms that guard only checks
 * level/existing/voltage (not the other 6 columns), which IS behaviourally
 * significant, so it's preserved exactly.
 *
 * Coordinate convention
 * ─────────────────────
 * All Y values are TOP-ORIGIN (CSS / screen style). renderFields converts
 * them to pdf-lib bottom-origin internally.
 *
 * @param {object} d       - Full wizard form state
 * @param {Array}  photos  - Photo attachments
 * @returns {Promise<Uint8Array>}
 */

import { PDFDocument, StandardFonts } from 'pdf-lib'
import { fetchPdfTemplate, createPageDrawer, DEFAULT_INK, A4_HEIGHT } from '../../shared/pdfDrawUtils'
import { renderFields, renderGridRow } from '../../shared/pdfFieldRenderer'
import { appendPhotosToPdf } from '../../shared/appendPhotosToPdf'

const getTemplateUrl = () =>
  `${import.meta.env.BASE_URL}forms/360S014EC.pdf`

// ─────────────────────────────────────────────────────────────────────────────
// FIELDS
// ─────────────────────────────────────────────────────────────────────────────

export const FIELDS = {

  // ── Page 1 ─────────────────────────────────────────────────────────────────
  p1: {
    // Header
    streetRoad:        { type: 'text', align: 'left', x: 115, y: 107, value: d => d.streetRoad },
    contractor:        { type: 'text', align: 'left', x: 395, y: 107, value: d => d.contractor },
    dateWorkCompleted: { type: 'text', align: 'left', x: 395, y: 121, value: d => d.dateWorkCompleted },
    cityTown:          { type: 'text', align: 'left', x: 115, y: 135, value: d => d.cityTown },
    district:          { type: 'text', align: 'left', x: 115, y: 150, value: d => d.district },
    namePrint:         { type: 'text', align: 'left', x: 395, y: 150, value: d => d.namePrint },
    signed:            { type: 'signature', x: 393, y: 131, maxW: 140, maxH: 20, value: d => d.signed },
    pcoWONo:           { type: 'text', align: 'left', x: 165, y: 164, value: d => d.pcoWONo },
    ciwrNo:            { type: 'text', align: 'left', x: 451, y: 164, value: d => d.ciwrNo },

    // Pole IDs & GPS
    newPoleId:          { type: 'text', align: 'center', x:  33, width: 170, y: 225, value: d => d.newPoleId },
    oldPoleId:          { type: 'text', align: 'center', x: 173, width: 170, y: 225, value: d => d.oldPoleId },
    gpsNorth:           { type: 'text', align: 'left', x: 415, y: 220, value: d => d.gpsNorth },
    gpsEast:            { type: 'text', align: 'left', x: 415, y: 234, value: d => d.gpsEast },
    altitude:           { type: 'text', align: 'left', x: 415, y: 265, value: d => d.altitude },
    manufacturerPoleId: { type: 'text', align: 'center', x:  33, width: 170, y: 273, value: d => d.manufacturerPoleId },
    manufacturedDate:   { type: 'text', align: 'center', x: 173, width: 170, y: 273, value: d => d.manufacturedDate },

    // Pole activity
    poleActivityNew:            { type: 'check', x: 143, y: 319, value: d => d.poleActivity === 'New' },
    poleActivityRemoved:        { type: 'check', x: 218, y: 319, value: d => d.poleActivity === 'Removed' },
    poleActivityReplaced:       { type: 'check', x: 294, y: 319, value: d => d.poleActivity === 'Replaced' },
    poleActivityRelocation:     { type: 'check', x: 386, y: 319, value: d => d.poleActivity === 'Relocation' },
    poleActivityLabelReplaced:  { type: 'check', x: 464, y: 319, value: d => d.poleActivity === 'Label Replaced' },

    // Crossarm activity
    crossarmActivityNew:      { type: 'check', x: 143, y: 333, value: d => d.crossarmActivity === 'New' },
    crossarmActivityRemoved:  { type: 'check', x: 218, y: 333, value: d => d.crossarmActivity === 'Removed' },
    crossarmActivityReplaced: { type: 'check', x: 294, y: 333, value: d => d.crossarmActivity === 'Replaced' },

    // Pole loading
    poleLoadingAngle:        { type: 'check', x: 143, y: 348, value: d => d.poleLoading === 'Angle' },
    poleLoadingInLine:       { type: 'check', x: 218, y: 348, value: d => d.poleLoading === 'In Line' },
    poleLoadingRoadCrossing: { type: 'check', x: 294, y: 348, value: d => d.poleLoading === 'Road Crossing' },
    poleLoadingTakeOff:      { type: 'check', x: 386, y: 348, value: d => d.poleLoading === 'Take Off' },
    poleLoadingTermination:  { type: 'check', x: 464, y: 348, value: d => d.poleLoading === 'Termination' },

    // GPS required
    gpsRequiredYes: { type: 'check', x: 143, y: 362, value: d => d.gpsRequired === 'Yes' },
    gpsRequiredNo:  { type: 'check', x: 218, y: 362, value: d => d.gpsRequired === 'No' },

    // Pole condition
    poleConditionNew:    { type: 'check', x: 143, y: 377, value: d => d.poleCondition === 'New' },
    poleConditionPreUsed:{ type: 'check', x: 218, y: 377, value: d => d.poleCondition === 'Pre-Used' },

    // Ownership
    ownershipPowerco: { type: 'check', x: 143, y: 391, value: d => d.ownership === 'Powerco' },
    ownershipPrivate: { type: 'check', x: 218, y: 391, value: d => d.ownership === 'Private' },
    ownershipOther:   { type: 'check', x: 294, y: 391, value: d => d.ownership === 'Other' },
    ownershipOtherText: { type: 'text', align: 'left', x: 374, y: 392, value: d => (d.ownership === 'Other' ? d.ownershipOther : '') },

    // Shared use
    sharedUseFibre:  { type: 'check', x: 143, y: 405, value: d => d.sharedUse === 'Fibre' },
    sharedUseChorus: { type: 'check', x: 218, y: 405, value: d => d.sharedUse === 'Chorus' },
    sharedUseOther:  { type: 'check', x: 294, y: 405, value: d => d.sharedUse === 'Other' },
    sharedUseOtherText: { type: 'text', align: 'left', x: 374, y: 406, value: d => (d.sharedUse === 'Other' ? d.sharedUseOther : '') },

    reasonForRemoval: { type: 'text', align: 'left', x: 128, y: 420, value: d => d.reasonForRemoval },

    // Pole code grid — 16 Busck/Goldpine codes, matched by name instead of index
    poleCodeB95:                  { type: 'check', x:  45, y: 478, value: d => d.poleCode === 'B9.5 (Busck)' },
    poleCodeB100:                 { type: 'check', x: 173, y: 478, value: d => d.poleCode === 'B10.0 (Busck)' },
    poleCodeB105:                 { type: 'check', x: 295, y: 478, value: d => d.poleCode === 'B10.5 (Busck)' },
    poleCodeB110:                 { type: 'check', x: 427, y: 478, value: d => d.poleCode === 'B11.0 (Busck)' },
    poleCodeB124:                 { type: 'check', x:  45, y: 493, value: d => d.poleCode === 'B12.4 (Busck)' },
    poleCodeB125:                 { type: 'check', x: 173, y: 493, value: d => d.poleCode === 'B12.5 (Busck)' },
    poleCodeB1365:                { type: 'check', x: 295, y: 493, value: d => d.poleCode === 'B13.65 (Busck)' },
    poleCodeB1485:                { type: 'check', x: 427, y: 493, value: d => d.poleCode === 'B14.85 (Busck)' },
    poleCodeB155:                 { type: 'check', x:  45, y: 507, value: d => d.poleCode === 'B15.5 (Busck)' },
    poleCodeB185:                 { type: 'check', x: 173, y: 507, value: d => d.poleCode === 'B18.5 (Busck)' },
    poleCodeGoldpine9m9kN:        { type: 'check', x: 295, y: 507, value: d => d.poleCode === '9m (9kN) Goldpine' },
    poleCodeGoldpine10m9kN:       { type: 'check', x: 427, y: 507, value: d => d.poleCode === '10m (9kN) Goldpine' },
    poleCodeGoldpine10m12kN:      { type: 'check', x:  45, y: 521, value: d => d.poleCode === '10m (12kN) Goldpine' },
    poleCodeGoldpine11m9kN:       { type: 'check', x: 173, y: 521, value: d => d.poleCode === '11m (9kN) Goldpine' },
    poleCodeGoldpine11m12kN:      { type: 'check', x: 295, y: 521, value: d => d.poleCode === '11m (12kN) Goldpine' },
    poleCodeGoldpine12m12kN:      { type: 'check', x: 427, y: 521, value: d => d.poleCode === '12m (12kN) Goldpine' },

    // Custom manufacturer codes (Dulhunty / IUP / Other) — checkbox shows
    // whenever the matching text field is populated, independent of poleCode.
    dulhuntyCheck:  { type: 'check', x:  45, y: 537, value: d => !!d.dulhuntyCode },
    dulhuntyText:   { type: 'text', align: 'left', x: 232, y: 539, value: d => d.dulhuntyCode },
    iupCheck:       { type: 'check', x:  45, y: 552, value: d => !!d.iupCode },
    iupText:        { type: 'text', align: 'left', x: 184, y: 554, value: d => d.iupCode },
    otherCodeCheck: { type: 'check', x:  45, y: 568, value: d => !!d.otherCode },
    otherCodeText:  { type: 'text', align: 'left', x: 232, y: 570, value: d => d.otherCode },

    // Pole type grid — 8 options, matched by name instead of index
    poleType1:      { type: 'check', x:  45, y: 610, value: d => d.poleType === '1 Pole' },
    poleType1Half:  { type: 'check', x: 174, y: 610, value: d => d.poleType === '1 \u00BD Pole' },
    poleType2:      { type: 'check', x: 296, y: 610, value: d => d.poleType === '2 Pole' },
    poleType3:      { type: 'check', x: 429, y: 610, value: d => d.poleType === '3 Pole' },
    poleType4:      { type: 'check', x:  45, y: 624, value: d => d.poleType === '4 Pole' },
    poleTypeH:      { type: 'check', x: 174, y: 624, value: d => d.poleType === 'H Pole' },
    poleTypeDouble: { type: 'check', x: 296, y: 624, value: d => d.poleType === 'Double' },
    poleTypeStay:   { type: 'check', x: 429, y: 624, value: d => d.poleType === 'Stay Pole' },

    poleTypeOtherCheck: { type: 'check', x: 45, y: 639, value: d => d.poleType === 'Other' && !!d.poleTypeOther },
    poleTypeOtherText:  { type: 'text', align: 'left', x: 148, y: 641, value: d => (d.poleType === 'Other' ? d.poleTypeOther : '') },
  },

  // ── Page 2 ─────────────────────────────────────────────────────────────────
  p2: {
    // Equipment on pole — checkbox + ID text per item. Originally guarded by
    // `!== undefined && !== null`; that guard is redundant with the draw
    // primitives' own no-op on falsy/undefined values, so these are plain
    // unconditional fields (confirmed equivalent via the comparison harness).
    absCheck:               { type: 'check', x:  45, y: 126, value: d => !!d.absId },
    absText:                { type: 'text', align: 'left', x: 175, y: 126, value: d => d.absId },
    linksCheck:             { type: 'check', x: 296, y: 126, value: d => !!d.linksId },
    linksText:              { type: 'text', align: 'left', x: 433, y: 126, value: d => d.linksId },
    dropoutFuseCheck:       { type: 'check', x:  45, y: 140, value: d => !!d.dropoutFuseId },
    dropoutFuseText:        { type: 'text', align: 'left', x: 175, y: 140, value: d => d.dropoutFuseId },
    transformerCheck:       { type: 'check', x: 296, y: 140, value: d => !!d.transformerId },
    transformerText:        { type: 'text', align: 'left', x: 433, y: 140, value: d => d.transformerId },
    regulatorCheck:         { type: 'check', x:  45, y: 155, value: d => !!d.regulatorId },
    regulatorText:          { type: 'text', align: 'left', x: 175, y: 155, value: d => d.regulatorId },
    sectionliserCheck:      { type: 'check', x: 296, y: 155, value: d => !!d.sectionliserId },
    sectionliserText:       { type: 'text', align: 'left', x: 433, y: 155, value: d => d.sectionliserId },
    faultIndicatorCheck:    { type: 'check', x:  45, y: 169, value: d => !!d.faultIndicatorId },
    faultIndicatorText:     { type: 'text', align: 'left', x: 175, y: 169, value: d => d.faultIndicatorId },
    otherEquipCheck:        { type: 'check', x: 296, y: 169, value: d => !!d.otherEquipId },
    otherEquipText:         { type: 'text', align: 'left', x: 433, y: 169, value: d => d.otherEquipId },
    lightningArresterCheck: { type: 'check', x:  45, y: 184, value: d => !!d.lightningArresterId },
    lightningArresterText:  { type: 'text', align: 'left', x: 175, y: 184, value: d => d.lightningArresterId },
    otherEquipTypeText:     { type: 'text', align: 'left', x: 433, y: 186, value: d => d.otherEquipType },

    // Accessories — array membership
    accPossumGuard:        { type: 'check', x:  45, y: 224, value: d => (d.accessories || []).includes('Possum Guard') },
    accStreetlightFitting: { type: 'check', x: 215, y: 224, value: d => (d.accessories || []).includes('Streetlight Fitting') },
    accAerialStay:         { type: 'check', x: 384, y: 224, value: d => (d.accessories || []).includes('Aerial Stay') },
    accClimbers:           { type: 'check', x:  45, y: 239, value: d => (d.accessories || []).includes('Climbers') },
    accGroundStay:         { type: 'check', x: 215, y: 239, value: d => (d.accessories || []).includes('Ground Stay') },
    accPlatform:           { type: 'check', x: 384, y: 239, value: d => (d.accessories || []).includes('Platform') },
    accHVCableRiser:       { type: 'check', x:  45, y: 253, value: d => (d.accessories || []).includes('HV Cable Riser') },
    accBirdSpikes:         { type: 'check', x:  45, y: 268, value: d => (d.accessories || []).includes('Bird Spikes') },

    controlBoxCheck:       { type: 'check', x: 215, y: 253, value: d => !!d.controlBoxPurpose },
    controlBoxText:        { type: 'text', align: 'left', x: 357, y: 255, value: d => d.controlBoxPurpose },
    accessoriesOtherCheck: { type: 'check', x: 215, y: 268, value: d => !!d.accessoriesOther },
    accessoriesOtherText:  { type: 'text', align: 'left', x: 295, y: 269, value: d => d.accessoriesOther },

    serviceConnections: { type: 'text', align: 'left', x: 194, y: 311, value: d => d.serviceConnections },
    serviceAddresses:   { type: 'text', align: 'left', x: 442, y: 311, value: d => d.serviceAddresses },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// GRIDS — conductor and crossarm tables (page 2, up to 7 rows each), and the
// work-description line list (page 3).
// ─────────────────────────────────────────────────────────────────────────────

export const GRIDS = {
  // Each column has its own x + alignment — change `align` to 'center' or
  // 'right' to match how that column should sit on the printed form
  // (center alignment also needs a `width`).
  conductorRows: {
    rowY: [343, 359, 375, 391, 407, 423, 439],
    cols: {
      level:      { x: 58,  align: 'left' },
      existing:   { x: 130, align: 'left' },
      size:       { x: 191, align: 'left' },
      material:   { x: 310, align: 'left' },
      insulation: { x: 450, align: 'left' },
    },
  },
  crossarmRows: {
    rowY: [508, 524, 540, 556, 572, 588, 604],
    cols: {
      level:         { x: 58,  align: 'left' },
      existing:      { x: 113, align: 'left' },
      voltage:       { x: 158, align: 'left' },
      endSize:       { x: 216, align: 'left' },
      length:        { x: 265, align: 'left' },
      arms:          { x: 320, align: 'left' },
      insulatorType: { x: 375, align: 'left' },
      armMaterial:   { x: 475, align: 'left' },
      wires:         { x: 520, align: 'left' },
    },
  },
  // Work description — the textarea's newlines map directly onto fixed
  // ruled lines (no word-wrapping).
  workDescription: {
    x: 48,
    rowY: [532, 547, 561, 575, 590, 604, 618, 632, 646, 661, 676, 690, 705, 719, 733],
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function generatePolePdf(d, photos = []) {
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const [p1, p2, p3]  = pdfDoc.getPages()

  const draw1 = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)
  const draw2 = createPageDrawer(p2, font, DEFAULT_INK, A4_HEIGHT)
  const draw3 = createPageDrawer(p3, font, DEFAULT_INK, A4_HEIGHT)

  await renderFields({ pdfDoc, page: p1, draw: draw1 }, FIELDS.p1, d)
  await renderFields({ pdfDoc, page: p2, draw: draw2 }, FIELDS.p2, d)

  // ── Page 2: Conductor rows (up to 7) ──────────────────────────────────────
  const cc = GRIDS.conductorRows
  ;(d.conductors || []).forEach((c, i) => {
    const y = cc.rowY[i]
    if (!y) return
    // Only write the row if at least one field is populated.
    if (!c.level && !c.existing && !c.size && !c.material && !c.insulation) return
    renderGridRow(draw2, cc.cols, y, c)
  })

  // ── Page 2: Crossarm rows (up to 7) ───────────────────────────────────────
  const ca = GRIDS.crossarmRows
  ;(d.crossarms || []).forEach((c, i) => {
    const y = ca.rowY[i]
    if (!y) return
    // Gate check only considers level/existing/voltage — matches the
    // original exactly (other columns can be populated and still get
    // skipped if these three are blank).
    if (!c.level && !c.existing && !c.voltage) return
    renderGridRow(draw2, ca.cols, y, c)
  })

  // ── Page 3: Work description — split on newlines onto fixed ruled lines ──
  const wd = GRIDS.workDescription
  const descLines = (d.workDescription || '').split('\n')
  descLines.slice(0, wd.rowY.length).forEach((line, i) => {
    draw3.t(wd.x, wd.rowY[i], line)
  })

  if (photos && photos.length > 0) {
    await appendPhotosToPdf(pdfDoc, photos)
  }

  return new Uint8Array(await pdfDoc.save())
}
