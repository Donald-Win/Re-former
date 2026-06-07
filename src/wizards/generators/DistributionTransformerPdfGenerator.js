/**
 * DistributionTransformerPdfGenerator.js — PDF generator for 220F028B
 * (Distribution Transformer Commissioning Certificate).
 *
 * ⚠️  COORDINATE CALIBRATION REQUIRED
 * ────────────────────────────────────
 * All LAYOUT coordinates are approximate estimates. Use CoordOverlay
 * to calibrate against the actual 220F028B.pdf template:
 *
 *   1. Add `const B_SHOW_OVERLAY = true` near the top of
 *      DistributionTransformerWizard.jsx, then add the overlay tab UI
 *      following the pattern in ElecEquipWizard.jsx (EE_SHOW_OVERLAY).
 *   2. Open the wizard, switch to the Calibrate tab and click each
 *      field to get exact x/y values for the LAYOUT constants below.
 *   3. Update LAYOUT, then set B_SHOW_OVERLAY back to false.
 *
 * Template: forms/220F028B.pdf
 *   Page 1 — Header, sections a, b, c
 *   Page 2 — Sections d, e, f, g, h
 *   Page 3 — Sections i, j, k, l
 *   Page 4 — Document control (not written to)
 *
 * Coordinate convention
 * ─────────────────────
 * All Y values are TOP-ORIGIN (CSS / screen style).
 * createPageDrawer converts them to pdf-lib bottom-origin internally.
 * Signature cssY = A4_HEIGHT − (pdfY_bottom + imgHeight)
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

const getTemplateUrl = () =>
  `${import.meta.env.BASE_URL}forms/220F028B.pdf`

// ── Font sizes ─────────────────────────────────────────────────────────────────
const FS    = 8.5  // standard field text
const FS_SM = 7.5  // narrow circuit value cells

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT  ⚠️ Approximate — calibrate with CoordOverlay before release
//
// All Y values are top-origin. Formulae used for estimation:
//   field text Y  =  842 − (pdf-lib bottom-origin y) − fontSize
//   checkbox Y    =  834 − (pdf-lib bottom-origin y)
//   signature Y   =  842 − (pdf-lib y_bottom + img_height)
// ─────────────────────────────────────────────────────────────────────────────

const LAYOUT = {

  // ── Page 1 ─────────────────────────────────────────────────────────────────

  p1: {

    // Header
    // Left column:  Job Name, No/Street/Road, CIWR No., SAP W/O No.
    // Right column: Contractor Name, Town/District, Contractor Ref No,
    //               Date Completed, Transformer No.
    header: {
      jobName:         { x: 115, y: 147 },   // → d.projectName
      streetRoad:      { x: 115, y: 162 },
      ciwrNo:          { x: 115, y: 192 },
      sapWONo:         { x: 115, y: 207 },   // → d.pcoWONo
      contractor:      { x: 395, y: 147 },
      townDistrict:    { x: 395, y: 162 },   // cityTown + district
      contractorRefNo: { x: 395, y: 177 },
      dateCompleted:   { x: 395, y: 192 },
      transformerNo:   { x: 395, y: 207 },
    },

    // Section a) — Confirmed ✓ ticks (one per as-built form row)
    // ckX is the left edge of the tick within the confirmed cell.
    sectionA: {
      ckX:        549,
      eeY:        232,
      egY:        245,
      ehY:        258,
      eiY:        271,
      ejY:        284,
      eoY:        297,
      labellingY: 310,
    },

    // Section b) — Earth test result values
    // valueX is the left edge of the measured-value text in the Result column.
    sectionB: {
      valueX: 230,
      leg1Y:  355,
      leg2Y:  368,
      urbanY: 383,
      ruralY: 396,
    },

    // Section c) — Phase connection confirmation ticks (a, b, c cells on right)
    sectionC: {
      ckX: 549,
      aY:  445,
      bY:  460,
      cY:  475,
    },
  },

  // ── Page 2 ─────────────────────────────────────────────────────────────────

  p2: {

    // Section d) — Neutral Earth Bonding
    // Yes / No / N/A tick columns; separate Y per row.
    sectionD: {
      yesX: 313,  // tick left edge for "Yes" column
      noX:  373,  // tick left edge for "No" column
      naX:  430,  // tick left edge for "Not applicable" column (pole mounted only)
      poleBushingY:     105,
      poleNeutralCondY: 120,
      poleEarthY:       138,
      groundBushingY:   163,
    },

    // Section e) — Pre HV-Fuse checks
    sectionE: {
      ckX:             549,
      lvIsolatedY:     215,
      hvFuseCorrectY:  230,
      hvInsertedY:     245,
      hvFuseSize: { x: 250, y: 258 },
    },

    // Section f) — Off-Load Voltage Checks
    // circuitX[i] = left edge of circuit i+1 value column.
    // ckX = left edge of the Confirmed ✓ cell on the far right.
    // rowRWY … rowBNY = top-origin Y for each measurement row.
    sectionF: {
      circuitX: [143, 222, 302, 382],
      ckX:      549,
      rowRWY:   330,
      rowWBY:   345,
      rowBRY:   360,
      rowRNY:   375,
      rowWNY:   390,
      rowBNY:   405,
      tapSetting: { x: 115, y: 423 },
    },

    // Section g) — Pre LV-Fuse Insertion Check
    sectionG: {
      ckX: 549,
      y:   460,
    },

    // Section h) — Phase Rotation Checks
    sectionH: {
      ckX:               549,
      phaseRotationY:    497,
      consumerRotationY: 512,
    },
  },

  // ── Page 3 ─────────────────────────────────────────────────────────────────

  p3: {

    // Section i) — Phasing In / Paralleling Checks
    // circuitX[i] = left edge of circuit i+1 column (shared for measurements & neutrals).
    sectionI: {
      circuitX: [193, 262, 332, 402],
      ckX:          549,
      rowR1R2Y:     115,
      rowW1W2Y:     133,
      rowB1B2Y:     151,
      rowNeutralsY: 169,
    },

    // Section j) — Loop Impedance Tests
    // valueX = left edge of the measured impedance text.
    sectionJ: {
      valueX: 350,
      rwY: 238, rbY: 258, wbY: 278,
      rnY: 298, wnY: 318, bnY: 338,
    },

    // Section k) — LV Open Point Restoration
    // locationX = left edge of location text; ckX = confirmed tick.
    sectionK: {
      locationX: 120,
      ckX:       549,
      rowY:      [402, 417, 432, 447],
    },

    // Section l) — Testing Attestation
    // Signature top in top-origin coords = A4_HEIGHT − (pdf_y_bottom + imgHeight).
    sectionL: {
      printName: { x: 120, y: 490 },
      date:      { x: 120, y: 505 },
      isnId:     { x: 395, y: 505 },
      signature: { x: 310, y: 478, maxW: 100, maxH: 22 },
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function generateB28Pdf(d, photos = []) {
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // Template has 4 pages; only pages 1-3 receive written content.
  const [p1, p2, p3] = pdfDoc.getPages()
  const draw1 = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)
  const draw2 = createPageDrawer(p2, font, DEFAULT_INK, A4_HEIGHT)
  const draw3 = createPageDrawer(p3, font, DEFAULT_INK, A4_HEIGHT)

  // ── Page 1: Header ────────────────────────────────────────────────────────
  const h = LAYOUT.p1.header
  const townDistrict = [d.cityTown, d.district].filter(Boolean).join(', ')

  draw1.t(h.jobName.x,         h.jobName.y,         d.projectName,    FS)
  draw1.t(h.streetRoad.x,      h.streetRoad.y,      d.streetRoad,     FS)
  draw1.t(h.ciwrNo.x,          h.ciwrNo.y,          d.ciwrNo,         FS)
  draw1.t(h.sapWONo.x,         h.sapWONo.y,         d.pcoWONo,        FS)
  draw1.t(h.contractor.x,      h.contractor.y,      d.contractor,     FS)
  draw1.t(h.townDistrict.x,    h.townDistrict.y,    townDistrict,     FS)
  draw1.t(h.contractorRefNo.x, h.contractorRefNo.y, d.contractorRefNo, FS)
  draw1.t(h.dateCompleted.x,   h.dateCompleted.y,   d.dateWorkCompleted, FS)
  draw1.t(h.transformerNo.x,   h.transformerNo.y,   d.transformerNo,  FS)

  // ── Page 1: Section a) As-Built Records ──────────────────────────────────
  const a = LAYOUT.p1.sectionA
  draw1.ck(a.ckX, a.eeY,        d.asBuiltEE)
  draw1.ck(a.ckX, a.egY,        d.asBuiltEG)
  draw1.ck(a.ckX, a.ehY,        d.asBuiltEH)
  draw1.ck(a.ckX, a.eiY,        d.asBuiltEI)
  draw1.ck(a.ckX, a.ejY,        d.asBuiltEJ)
  draw1.ck(a.ckX, a.eoY,        d.asBuiltEO)
  draw1.ck(a.ckX, a.labellingY, d.asBuiltLabelling)

  // ── Page 1: Section b) Earthing Tests ─────────────────────────────────────
  const b = LAYOUT.p1.sectionB
  draw1.t(b.valueX, b.leg1Y,  d.earthLeg1, FS)
  draw1.t(b.valueX, b.leg2Y,  d.earthLeg2, FS)
  draw1.t(b.valueX, b.urbanY, d.menUrban,  FS)
  draw1.t(b.valueX, b.ruralY, d.menRural,  FS)

  // ── Page 1: Section c) Phase Connections ──────────────────────────────────
  const c = LAYOUT.p1.sectionC
  draw1.ck(c.ckX, c.aY, d.phaseA)
  draw1.ck(c.ckX, c.bY, d.phaseB)
  draw1.ck(c.ckX, c.cY, d.phaseC)

  // ── Page 2: Section d) Neutral Earth Bonding ──────────────────────────────
  const dL = LAYOUT.p2.sectionD
  // Pole Mounted
  draw2.ck(dL.yesX, dL.poleBushingY,     d.dPoleBushing === 'Yes')
  draw2.ck(dL.noX,  dL.poleBushingY,     d.dPoleBushing === 'No')
  draw2.ck(dL.yesX, dL.poleNeutralCondY, d.dPoleNeutralCond === 'Yes')
  draw2.ck(dL.noX,  dL.poleNeutralCondY, d.dPoleNeutralCond === 'No')
  draw2.ck(dL.naX,  dL.poleNeutralCondY, d.dPoleNeutralCond === 'NA')
  draw2.ck(dL.yesX, dL.poleEarthY,       d.dPoleEarth === 'Yes')
  draw2.ck(dL.noX,  dL.poleEarthY,       d.dPoleEarth === 'No')
  // Ground Mounted
  draw2.ck(dL.yesX, dL.groundBushingY, d.dGroundBushing === 'Yes')
  draw2.ck(dL.noX,  dL.groundBushingY, d.dGroundBushing === 'No')

  // ── Page 2: Section e) Pre HV-Fuse Checks ─────────────────────────────────
  const e = LAYOUT.p2.sectionE
  draw2.ck(e.ckX, e.lvIsolatedY,    d.eLvIsolated)
  draw2.ck(e.ckX, e.hvFuseCorrectY, d.eHvFuseCorrect)
  draw2.ck(e.ckX, e.hvInsertedY,    d.eHvFusesInserted)
  draw2.t(e.hvFuseSize.x, e.hvFuseSize.y, d.eHvFuseSize, FS)

  // ── Page 2: Section f) Off-Load Voltage Checks ────────────────────────────
  const f = LAYOUT.p2.sectionF
  const voltRowDefs = [
    { key: 'fRW', y: f.rowRWY, ci: 0 },
    { key: 'fWB', y: f.rowWBY, ci: 1 },
    { key: 'fBR', y: f.rowBRY, ci: 2 },
    { key: 'fRN', y: f.rowRNY, ci: 3 },
    { key: 'fWN', y: f.rowWNY, ci: 4 },
    { key: 'fBN', y: f.rowBNY, ci: 5 },
  ]
  voltRowDefs.forEach(({ key, y, ci }) => {
    const vals    = d[key] || []
    const confirm = (d.fConfirmed || [])[ci]
    f.circuitX.forEach((x, circIdx) => {
      draw2.t(x, y, vals[circIdx], FS_SM)
    })
    draw2.ck(f.ckX, y, confirm)
  })
  draw2.t(f.tapSetting.x, f.tapSetting.y, d.fTapSetting, FS)

  // ── Page 2: Section g) Pre LV-Fuse Checks ────────────────────────────────
  const g = LAYOUT.p2.sectionG
  draw2.ck(g.ckX, g.y, d.gLvFuseCorrect)

  // ── Page 2: Section h) Phase Rotation Checks ──────────────────────────────
  const hL = LAYOUT.p2.sectionH
  draw2.ck(hL.ckX, hL.phaseRotationY,    d.hPhaseRotation)
  draw2.ck(hL.ckX, hL.consumerRotationY, d.hConsumerRotation)

  // ── Page 3: Section i) Phasing / Paralleling Checks ──────────────────────
  const iL = LAYOUT.p3.sectionI
  const phasingRowDefs = [
    { key: 'iR1R2', y: iL.rowR1R2Y, ci: 0 },
    { key: 'iW1W2', y: iL.rowW1W2Y, ci: 1 },
    { key: 'iB1B2', y: iL.rowB1B2Y, ci: 2 },
  ]
  phasingRowDefs.forEach(({ key, y, ci }) => {
    const vals    = d[key] || []
    const confirm = (d.iConfirmed || [])[ci]
    iL.circuitX.forEach((x, circIdx) => {
      draw3.t(x, y, vals[circIdx], FS_SM)
    })
    draw3.ck(iL.ckX, y, confirm)
  })
  // Neutrals connected — one tick per circuit column in the neutrals row
  ;(d.iNeutrals || []).forEach((connected, circIdx) => {
    draw3.ck(iL.circuitX[circIdx], iL.rowNeutralsY, connected)
  })

  // ── Page 3: Section j) Loop Impedance Tests ───────────────────────────────
  const jL = LAYOUT.p3.sectionJ
  draw3.t(jL.valueX, jL.rwY, d.jRW, FS)
  draw3.t(jL.valueX, jL.rbY, d.jRB, FS)
  draw3.t(jL.valueX, jL.wbY, d.jWB, FS)
  draw3.t(jL.valueX, jL.rnY, d.jRN, FS)
  draw3.t(jL.valueX, jL.wnY, d.jWN, FS)
  draw3.t(jL.valueX, jL.bnY, d.jBN, FS)

  // ── Page 3: Section k) LV Open Point Restoration ─────────────────────────
  const kL = LAYOUT.p3.sectionK
  ;(d.kPoints || []).forEach((pt, idx) => {
    const y = kL.rowY[idx]
    if (!y) return
    draw3.t(kL.locationX, y, pt.location, FS)
    draw3.ck(kL.ckX, y, pt.restored)
  })

  // ── Page 3: Section l) Testing Attestation ───────────────────────────────
  const lL = LAYOUT.p3.sectionL
  draw3.t(lL.printName.x, lL.printName.y, d.namePrint,         FS)
  draw3.t(lL.date.x,      lL.date.y,      d.dateWorkCompleted, FS)
  draw3.t(lL.isnId.x,     lL.isnId.y,     d.isnId,             FS)

  await drawSignature(
    pdfDoc, p3, d.signed,
    lL.signature.x, lL.signature.y,
    lL.signature.maxW, lL.signature.maxH,
    A4_HEIGHT,
  )

  // ── Photos (appended as additional pages) ─────────────────────────────────
  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}
