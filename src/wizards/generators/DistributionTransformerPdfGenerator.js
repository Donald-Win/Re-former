/**
 * DistributionTransformerPdfGenerator.js — PDF generator for 220F028B
 * (Distribution Transformer Commissioning Certificate).
 *
 * ⚠️  COORDINATE CALIBRATION REQUIRED
 * ────────────────────────────────────
 * All LAYOUT coordinates are approximate estimates. Use CoordOverlay
 * to calibrate against the actual 220F028B.pdf template.
 *
 * Template: forms/220F028B.pdf
 *   Page 1 — Header, sections a, b, c
 *   Page 2 — Sections d, e, f, g, h
 *   Page 3 — Sections i, j, k, l
 *   Page 4 — Document control (not written to)
 *
 * Data shape (wizard state)
 * ─────────────────────────
 * Section f:  d.fCircuits  — Array<{ rw, wb, br, rn, wn, bn, confirmed }>
 *             d.fTapSetting — string
 *
 * Section i:  d.iCircuits  — Array<{ r1r2, w1w2, b1b2, neutral, confirmed }>
 *
 * The PDF template has 4 circuit columns; only the first 4 circuits are written.
 * Confirmed ticks are set when ALL supplied circuits have confirmed = true.
 *
 * Coordinate convention
 * ─────────────────────
 * All Y values are TOP-ORIGIN (CSS / screen style).
 * createPageDrawer converts them to pdf-lib bottom-origin internally.
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
// ─────────────────────────────────────────────────────────────────────────────

const LAYOUT = {

  // ── Page 1 ─────────────────────────────────────────────────────────────────

  p1: {

    header: {
      jobName:         { x: 115, y: 147 },
      streetRoad:      { x: 115, y: 162 },
      ciwrNo:          { x: 115, y: 192 },
      sapWONo:         { x: 115, y: 207 },
      contractor:      { x: 395, y: 147 },
      townDistrict:    { x: 395, y: 162 },
      contractorRefNo: { x: 395, y: 177 },
      dateCompleted:   { x: 395, y: 192 },
      transformerNo:   { x: 395, y: 207 },
    },

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

    sectionB: {
      valueX: 230,
      leg1Y:  355,
      leg2Y:  368,
      urbanY: 383,
      ruralY: 396,
    },

    sectionC: {
      ckX: 549,
      aY:  445,
      bY:  460,
      cY:  475,
    },
  },

  // ── Page 2 ─────────────────────────────────────────────────────────────────

  p2: {

    sectionD: {
      yesX: 313,
      noX:  373,
      naX:  430,
      poleBushingY:     105,
      poleNeutralCondY: 120,
      poleEarthY:       138,
      groundBushingY:   163,
    },

    sectionE: {
      ckX:             549,
      lvIsolatedY:     215,
      hvFuseCorrectY:  230,
      hvInsertedY:     245,
      hvFuseSize: { x: 250, y: 258 },
    },

    // Section f — circuit columns shared across all measurement rows.
    // circuitX[n] = left-edge x for circuit n+1 value.
    // ckX = left-edge of the Confirmed tick column (far right).
    // Confirmed is marked when ALL supplied circuits are confirmed.
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

    sectionG: {
      ckX: 549,
      y:   460,
    },

    sectionH: {
      ckX:               549,
      phaseRotationY:    497,
      consumerRotationY: 512,
    },
  },

  // ── Page 3 ─────────────────────────────────────────────────────────────────

  p3: {

    // Section i — same column layout as section f.
    // circuitX[n] = left-edge x for circuit n+1 measurement AND neutral tick.
    sectionI: {
      circuitX:    [193, 262, 332, 402],
      ckX:         549,
      rowR1R2Y:    115,
      rowW1W2Y:    133,
      rowB1B2Y:    151,
      rowNeutralsY:169,
    },

    sectionJ: {
      valueX: 350,
      rwY: 238, rbY: 258, wbY: 278,
      rnY: 298, wnY: 318, bnY: 338,
    },

    sectionK: {
      locationX: 120,
      ckX:       549,
      rowY:      [402, 417, 432, 447],
    },

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

  const [p1, p2, p3] = pdfDoc.getPages()
  const draw1 = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)
  const draw2 = createPageDrawer(p2, font, DEFAULT_INK, A4_HEIGHT)
  const draw3 = createPageDrawer(p3, font, DEFAULT_INK, A4_HEIGHT)

  // ── Page 1: Header ────────────────────────────────────────────────────────
  const h = LAYOUT.p1.header
  const townDistrict = [d.cityTown, d.district].filter(Boolean).join(', ')

  draw1.t(h.jobName.x,         h.jobName.y,         d.projectName,     FS)
  draw1.t(h.streetRoad.x,      h.streetRoad.y,      d.streetRoad,      FS)
  draw1.t(h.ciwrNo.x,          h.ciwrNo.y,          d.ciwrNo,          FS)
  draw1.t(h.sapWONo.x,         h.sapWONo.y,         d.pcoWONo,         FS)
  draw1.t(h.contractor.x,      h.contractor.y,      d.contractor,      FS)
  draw1.t(h.townDistrict.x,    h.townDistrict.y,    townDistrict,      FS)
  draw1.t(h.contractorRefNo.x, h.contractorRefNo.y, d.npJobNumber, FS)
  draw1.t(h.dateCompleted.x,   h.dateCompleted.y,   d.dateWorkCompleted, FS)
  draw1.t(h.transformerNo.x,   h.transformerNo.y,   d.transformerNo,   FS)

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
  draw2.ck(dL.yesX, dL.poleBushingY,     d.dPoleBushing === 'Yes')
  draw2.ck(dL.noX,  dL.poleBushingY,     d.dPoleBushing === 'No')
  draw2.ck(dL.yesX, dL.poleNeutralCondY, d.dPoleNeutralCond === 'Yes')
  draw2.ck(dL.noX,  dL.poleNeutralCondY, d.dPoleNeutralCond === 'No')
  draw2.ck(dL.naX,  dL.poleNeutralCondY, d.dPoleNeutralCond === 'NA')
  draw2.ck(dL.yesX, dL.poleEarthY,       d.dPoleEarth === 'Yes')
  draw2.ck(dL.noX,  dL.poleEarthY,       d.dPoleEarth === 'No')
  draw2.ck(dL.yesX, dL.groundBushingY,   d.dGroundBushing === 'Yes')
  draw2.ck(dL.noX,  dL.groundBushingY,   d.dGroundBushing === 'No')

  // ── Page 2: Section e) Pre HV-Fuse Checks ─────────────────────────────────
  const e = LAYOUT.p2.sectionE
  draw2.ck(e.ckX, e.lvIsolatedY,    d.eLvIsolated)
  draw2.ck(e.ckX, e.hvFuseCorrectY, d.eHvFuseCorrect)
  draw2.ck(e.ckX, e.hvInsertedY,    d.eHvFusesInserted)
  draw2.t(e.hvFuseSize.x, e.hvFuseSize.y, d.eHvFuseSize, FS)

  // ── Page 2: Section f) Off-Load Voltage Checks ────────────────────────────
  // Each measurement row gets its own tick/cross/blank based on the values entered
  // across all circuits for that row:
  //   confirmed → tick  (all entered values in range)
  //   failed    → 'X'   (one or more values out of range)
  //   empty     → nothing drawn  (no values entered for this row — not required)
  const f         = LAYOUT.p2.sectionF
  const fCircuits = (d.fCircuits || []).slice(0, 4)

  // Inline per-row status helpers (avoid import dependency)
  const _voltRowStatus = (key) => {
    const filled = fCircuits.map(c => c[key]).filter(v => v !== '' && v != null)
    if (filled.length === 0) return 'empty'
    const allOk = filled.every(v => {
      const n = parseFloat(v)
      if (isNaN(n)) return false
      if (['rw','wb','br'].includes(key)) return n >= 412 && n <= 422
      if (['rn','wn','bn'].includes(key)) return n >= 238 && n <= 244
      return false
    })
    return allOk ? 'confirmed' : 'failed'
  }

  const voltMeasurements = [
    { fieldKey: 'rw', y: f.rowRWY },
    { fieldKey: 'wb', y: f.rowWBY },
    { fieldKey: 'br', y: f.rowBRY },
    { fieldKey: 'rn', y: f.rowRNY },
    { fieldKey: 'wn', y: f.rowWNY },
    { fieldKey: 'bn', y: f.rowBNY },
  ]

  voltMeasurements.forEach(({ fieldKey, y }) => {
    fCircuits.forEach((circ, circIdx) => {
      const x = f.circuitX[circIdx]
      if (x !== undefined) draw2.t(x, y, circ[fieldKey] || '', FS_SM)
    })
    const status = _voltRowStatus(fieldKey)
    if (status === 'confirmed') draw2.ck(f.ckX, y, true)
    else if (status === 'failed') draw2.t(f.ckX, y, 'X', FS)
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
  // Each measurement row gets its own tick/cross/blank:
  //   confirmed → tick  (all entered values < 10 V)
  //   failed    → 'X'   (one or more values ≥ 10 V)
  //   empty     → nothing drawn
  const iL        = LAYOUT.p3.sectionI
  const iCircuits = (d.iCircuits || []).slice(0, 4)

  const _phasingRowStatus = (key) => {
    const filled = iCircuits.map(c => c[key]).filter(v => v !== '' && v != null)
    if (filled.length === 0) return 'empty'
    const allOk = filled.every(v => { const n = parseFloat(v); return !isNaN(n) && n < 10 })
    return allOk ? 'confirmed' : 'failed'
  }

  const phasingMeasurements = [
    { fieldKey: 'r1r2', y: iL.rowR1R2Y },
    { fieldKey: 'w1w2', y: iL.rowW1W2Y },
    { fieldKey: 'b1b2', y: iL.rowB1B2Y },
  ]

  phasingMeasurements.forEach(({ fieldKey, y }) => {
    iCircuits.forEach((circ, circIdx) => {
      const x = iL.circuitX[circIdx]
      if (x !== undefined) draw3.t(x, y, circ[fieldKey] || '', FS_SM)
    })
    const status = _phasingRowStatus(fieldKey)
    if (status === 'confirmed') draw3.ck(iL.ckX, y, true)
    else if (status === 'failed') draw3.t(iL.ckX, y, 'X', FS)
  })

  // Neutrals connected — one tick per circuit column in the neutrals row
  iCircuits.forEach((circ, circIdx) => {
    const x = iL.circuitX[circIdx]
    if (x !== undefined) draw3.ck(x, iL.rowNeutralsY, circ.neutral)
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
    if (y === undefined) return
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
