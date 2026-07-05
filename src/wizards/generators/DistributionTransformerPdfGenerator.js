/**
 * DistributionTransformerPdfGenerator.js — PDF generator for 220F028B
 * (Distribution Transformer Commissioning Certificate).
 *
 * Template: forms/220F028B.pdf
 *   Page 1 — Header, sections a, b, c
 *   Page 2 — Sections d, e, f, g, h
 *   Page 3 — Sections i, j, k, l
 *   Page 4 — Document control (not written to)
 *
 * ── Declarative fields ───────────────────────────────────────────────────────
 * Every simple, named field (header text, checkboxes, the signature, etc.)
 * is defined ONCE in the FIELDS object below: coordinates, alignment, type,
 * and the value to draw all live together in a single object. To change a
 * field — move it, switch it between left/centre/right alignment, change
 * its font size — edit that one object; nothing else needs to change.
 * renderFields() (src/shared/pdfFieldRenderer.js) turns each entry into the
 * matching draw call.
 *
 * Repeating-row tables (the circuit grids in sections f/i, and the LV open
 * point list in section k) are NOT single named fields — they're the same
 * handful of column/row positions applied across a variable number of data
 * rows, plus per-row pass/fail logic. Those stay as small procedural loops
 * further down, reading their column/row constants from GRIDS instead of
 * FIELDS. Each cell still gets the same alignment control as a regular
 * field though: section k uses renderGridRow() (named columns — each can
 * have its own align/type), and sections f/i use renderMatrixRow() (one
 * shared alignment for every circuit's value cell in a row, via
 * GRIDS.sectionF.valueAlign / GRIDS.sectionI.valueAlign).
 *
 * Data shape (wizard state)
 * ─────────────────────────
 * Section f:  d.fCircuits  — Array<{ rw, wb, br, rn, wn, bn }>
 *             d.fTapSetting — string
 *
 * Section i:  d.iCircuits  — Array<{ r1r2, w1w2, b1b2, neutral }>
 *
 * The PDF template has 4 circuit columns; only the first 4 circuits are written.
 * Neither circuit object stores a confirmed flag — each measurement row gets
 * its own tick/cross computed at generation time from the values actually
 * entered across all circuits for that row (see voltRowStatus /
 * phasingRowStatus below): tick when every entered value is in range,
 * 'X' when any is out of range, nothing when the row is empty.
 *
 * Coordinate convention
 * ─────────────────────
 * All Y values are TOP-ORIGIN (CSS / screen style). createPageDrawer /
 * renderFields convert them to pdf-lib bottom-origin internally.
 */

import { PDFDocument, StandardFonts } from 'pdf-lib'
import {
  fetchPdfTemplate,
  createPageDrawer,
  DEFAULT_INK,
  A4_HEIGHT,
} from '../../shared/pdfDrawUtils'
import { renderFields, renderGridRow, renderMatrixRow } from '../../shared/pdfFieldRenderer'
import { appendPhotosToPdf } from '../../shared/appendPhotosToPdf'

const getTemplateUrl = () =>
  `${import.meta.env.BASE_URL}forms/220F028B.pdf`

// ── Font sizes ─────────────────────────────────────────────────────────────────
const FS    = 10  // standard field text
const FS_SM = 10  // circuit value cells (grids only)

// ─────────────────────────────────────────────────────────────────────────────
// FIELDS — every simple, named field. One object = one field: position,
// alignment, type, and the value to draw, all in one place.
// ─────────────────────────────────────────────────────────────────────────────

export const FIELDS = {

  // ── Page 1 — Header, sections a/b/c ─────────────────────────────────────────
  p1: {
    jobName:         { type: 'text', align: 'left', x: 150, y: 199, size: FS, value: d => d.projectName },
    streetRoad:      { type: 'text', align: 'left', x: 150, y: 219, size: FS, value: d => d.streetRoad },
    ciwrNo:          { type: 'text', align: 'left', x: 150, y: 259, size: FS, value: d => d.ciwrNo },
    sapWONo:         { type: 'text', align: 'left', x: 150, y: 279, size: FS, value: d => d.pcoWONo },
    contractor:      { type: 'text', align: 'left', x: 400, y: 199, size: FS, value: d => d.contractor },
    townDistrict:    {
      type: 'text', align: 'left', x: 400, y: 219, size: FS,
      value: d => [d.cityTown, d.district].filter(Boolean).join(', '),
    },
    contractorRefNo: { type: 'text', align: 'left', x: 400, y: 239, size: FS, value: d => d.npJobNumber },
    dateCompleted:   { type: 'text', align: 'left', x: 400, y: 259, size: FS, value: d => d.dateWorkCompleted },
    transformerNo:   { type: 'text', align: 'left', x: 400, y: 279, size: FS, value: d => d.transformerNo },

    // a) As-Built Records — shared tick column at x=487
    asBuiltEE:        { type: 'check', x: 487, y: 315, value: d => d.asBuiltEE },
    asBuiltEG:        { type: 'check', x: 487, y: 333, value: d => d.asBuiltEG },
    asBuiltEH:        { type: 'check', x: 487, y: 352, value: d => d.asBuiltEH },
    asBuiltEI:        { type: 'check', x: 487, y: 371, value: d => d.asBuiltEI },
    asBuiltEJ:        { type: 'check', x: 487, y: 389, value: d => d.asBuiltEJ },
    asBuiltEO:        { type: 'check', x: 487, y: 408, value: d => d.asBuiltEO },
    asBuiltLabelling: { type: 'check', x: 487, y: 427, value: d => d.asBuiltLabelling },

    // b) Earthing Tests — right-aligned, shared right edge at x=263
    earthLeg1: { type: 'text', align: 'right', x: 263, y: 465, size: FS, value: d => d.earthLeg1 },
    earthLeg2: { type: 'text', align: 'right', x: 263, y: 484, size: FS, value: d => d.earthLeg2 },
    menUrban:  { type: 'text', align: 'right', x: 263, y: 502, size: FS, value: d => d.menUrban },
    menRural:  { type: 'text', align: 'right', x: 263, y: 521, size: FS, value: d => d.menRural },

    // c) Phase Connections — shared tick column at x=513
    phaseA: { type: 'check', x: 513, y: 589, value: d => d.phaseA },
    phaseB: { type: 'check', x: 513, y: 607, value: d => d.phaseB },
    phaseC: { type: 'check', x: 513, y: 626, value: d => d.phaseC },
  },

  // ── Page 2 — sections d/e/g/h (f is a grid — see GRIDS.sectionF) ────────────
  p2: {
    // d) Neutral Earth Bonding — Yes/No/NA tick columns
    dPoleBushingYes:     { type: 'check', x: 407, y: 148, value: d => d.dPoleBushing === 'Yes' },
    dPoleBushingNo:      { type: 'check', x: 436, y: 148, value: d => d.dPoleBushing === 'No' },
    dPoleNeutralCondYes: { type: 'check', x: 407, y: 172, value: d => d.dPoleNeutralCond === 'Yes' },
    dPoleNeutralCondNo:  { type: 'check', x: 436, y: 172, value: d => d.dPoleNeutralCond === 'No' },
    dPoleNeutralCondNA:  { type: 'check', x: 523, y: 172, value: d => d.dPoleNeutralCond === 'NA' },
    dPoleEarthYes:       { type: 'check', x: 407, y: 196, value: d => d.dPoleEarth === 'Yes' },
    dPoleEarthNo:        { type: 'check', x: 436, y: 196, value: d => d.dPoleEarth === 'No' },
    dGroundBushingYes:   { type: 'check', x: 407, y: 233, value: d => d.dGroundBushing === 'Yes' },
    dGroundBushingNo:    { type: 'check', x: 436, y: 233, value: d => d.dGroundBushing === 'No' },

    // e) Pre HV-Fuse Checks
    eLvIsolated:      { type: 'check', x: 513, y: 271, value: d => d.eLvIsolated },
    eHvFuseCorrect:   { type: 'check', x: 513, y: 290, value: d => d.eHvFuseCorrect },
    eHvFusesInserted: { type: 'check', x: 513, y: 309, value: d => d.eHvFusesInserted },
    eHvFuseSize:      { type: 'text', align: 'right', x: 465, y: 327, size: FS, value: d => d.eHvFuseSize },

    // f) Tap setting — the one simple field that lives alongside the
    // section f circuit grid (see GRIDS.sectionF for the grid itself)
    fTapSetting: { type: 'text', align: 'left', x: 283, y: 522, size: FS, value: d => d.fTapSetting },

    // g) Pre LV-Fuse Checks
    gLvFuseCorrect: { type: 'check', x: 513, y: 566, value: d => d.gLvFuseCorrect },

    // h) Phase Rotation Checks
    hPhaseRotation:    { type: 'check', x: 513, y: 610, value: d => d.hPhaseRotation },
    hConsumerRotation: { type: 'check', x: 513, y: 629, value: d => d.hConsumerRotation },
  },

  // ── Page 3 — sections j/l (i and k are grids — see GRIDS) ───────────────────
  p3: {
    // j) Loop Impedance Tests — right-aligned, shared right edge at x=283
    jRW: { type: 'text', align: 'right', x: 283, y: 358, size: FS, value: d => d.jRW },
    jRB: { type: 'text', align: 'right', x: 283, y: 382, size: FS, value: d => d.jRB },
    jWB: { type: 'text', align: 'right', x: 283, y: 407, size: FS, value: d => d.jWB },
    jRN: { type: 'text', align: 'right', x: 283, y: 431, size: FS, value: d => d.jRN },
    jWN: { type: 'text', align: 'right', x: 283, y: 455, size: FS, value: d => d.jWN },
    jBN: { type: 'text', align: 'right', x: 283, y: 480, size: FS, value: d => d.jBN },

    // l) Testing Attestation
    printName: { type: 'text', align: 'left', x: 125, y: 688, size: FS, value: d => d.namePrint },
    date:      { type: 'text', align: 'left', x: 125, y: 719, size: FS, value: d => d.dateWorkCompleted },
    isnId:     { type: 'text', align: 'left', x: 392, y: 719, size: FS, value: d => d.isnId },
    signed:    { type: 'signature', x: 392, y: 682, maxW: 100, maxH: 24, value: d => d.signed },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// GRIDS — column/row constants for the three repeating-row sections.
// Rendered by hand-written loops further down (not renderFields) because
// each row's value, and section f/i's per-row tick/cross, depend on runtime
// data (how many circuits exist, which values are in range) rather than
// being a fixed one-field-per-spot layout.
// ─────────────────────────────────────────────────────────────────────────────

export const GRIDS = {

  // Section f) Off-Load Voltage Checks — 6 measurement rows × up to 4 circuits.
  // valueAlign/valueWidth control how each circuit's reading sits within its
  // column — change valueAlign to 'center' or 'right' to match the printed
  // form (center also needs valueWidth). ckX is the separate confirmed-tick/
  // cross column at the end of the row, always a checkbox — not affected by
  // valueAlign.
  sectionF: {
    circuitX: [138, 210, 274, 346],
    valueAlign: 'left',
    valueWidth: undefined,
    ckX: 513,
    rows: [
      { fieldKey: 'rw', y: 410 },
      { fieldKey: 'wb', y: 429 },
      { fieldKey: 'br', y: 448 },
      { fieldKey: 'rn', y: 466 },
      { fieldKey: 'wn', y: 485 },
      { fieldKey: 'bn', y: 503 },
    ],
  },

  // Section i) Phasing / Paralleling Checks — 3 measurement rows + 1 neutrals row.
  // Same valueAlign/valueWidth pattern as sectionF.
  sectionI: {
    circuitX: [138, 216, 293, 372],
    valueAlign: 'left',
    valueWidth: undefined,
    ckX: 513,
    rows: [
      { fieldKey: 'r1r2', y: 210 },
      { fieldKey: 'w1w2', y: 234 },
      { fieldKey: 'b1b2', y: 258 },
    ],
    neutralsY: 283,
  },

  // Section k) LV Open Point Restoration — up to 4 rows. Each column has its
  // own x + alignment, same as every other named-column grid in this app.
  sectionK: {
    rowY: [542, 566, 591, 615],
    cols: {
      location: { x: 125, align: 'left' },
      restored: { x: 513, type: 'check' },
    },
  },
}

// ── Range-checking helpers (shared by sections f and i) ──────────────────────
// Returns 'confirmed' (tick), 'failed' ('X'), or 'empty' (nothing drawn) for
// one measurement row, based on every circuit's entered value for that key.

export function voltRowStatus(circuits, key) {
  const filled = circuits.map(c => c[key]).filter(v => v !== '' && v != null)
  if (filled.length === 0) return 'empty'
  const allOk = filled.every(v => {
    const n = parseFloat(v)
    if (isNaN(n)) return false
    if (['rw', 'wb', 'br'].includes(key)) return n >= 412 && n <= 422
    if (['rn', 'wn', 'bn'].includes(key)) return n >= 238 && n <= 244
    return false
  })
  return allOk ? 'confirmed' : 'failed'
}

export function phasingRowStatus(circuits, key) {
  const filled = circuits.map(c => c[key]).filter(v => v !== '' && v != null)
  if (filled.length === 0) return 'empty'
  const allOk = filled.every(v => { const n = parseFloat(v); return !isNaN(n) && n < 10 })
  return allOk ? 'confirmed' : 'failed'
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

  // ── Every simple named field — one call per page ──────────────────────────
  await renderFields({ pdfDoc, page: p1, draw: draw1 }, FIELDS.p1, d)
  await renderFields({ pdfDoc, page: p2, draw: draw2 }, FIELDS.p2, d)
  await renderFields({ pdfDoc, page: p3, draw: draw3 }, FIELDS.p3, d)

  // ── Page 2: Section f) Off-Load Voltage Checks (grid) ─────────────────────
  // confirmed → tick, failed → 'X', empty → nothing drawn (see voltRowStatus)
  const f         = GRIDS.sectionF
  const fCircuits = (d.fCircuits || []).slice(0, 4)

  f.rows.forEach(({ fieldKey, y }) => {
    renderMatrixRow(draw2, f.circuitX, y, fCircuits.map(c => c[fieldKey] || ''), {
      align: f.valueAlign, width: f.valueWidth, size: FS_SM,
    })
    const status = voltRowStatus(fCircuits, fieldKey)
    if (status === 'confirmed') draw2.ck(f.ckX, y, true)
    else if (status === 'failed') draw2.t(f.ckX, y, 'X', FS)
  })

  // ── Page 3: Section i) Phasing / Paralleling Checks (grid) ───────────────
  const iL        = GRIDS.sectionI
  const iCircuits = (d.iCircuits || []).slice(0, 4)

  iL.rows.forEach(({ fieldKey, y }) => {
    renderMatrixRow(draw3, iL.circuitX, y, iCircuits.map(c => c[fieldKey] || ''), {
      align: iL.valueAlign, width: iL.valueWidth, size: FS_SM,
    })
    const status = phasingRowStatus(iCircuits, fieldKey)
    if (status === 'confirmed') draw3.ck(iL.ckX, y, true)
    else if (status === 'failed') draw3.t(iL.ckX, y, 'X', FS)
  })

  // Neutrals connected — one tick per circuit column in the neutrals row
  renderMatrixRow(draw3, iL.circuitX, iL.neutralsY, iCircuits.map(c => c.neutral), { type: 'check' })

  // ── Page 3: Section k) LV Open Point Restoration (grid) ──────────────────
  const kL = GRIDS.sectionK
  ;(d.kPoints || []).forEach((pt, idx) => {
    const y = kL.rowY[idx]
    if (y === undefined) return
    renderGridRow(draw3, kL.cols, y, pt, FS)
  })

  // ── Photos (appended as additional pages) ─────────────────────────────────
  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}
