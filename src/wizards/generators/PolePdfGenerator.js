/**
 * PolePdfGenerator.js — Pure async PDF generator for 360S014EC (AS-Built Pole Record).
 *
 * Extracted from PoleWizard.jsx so the React component handles only UI state.
 * All PDF I/O, coordinate mapping, and drawing live here — zero React dependency.
 *
 * The template is fetched once and kept in the shared in-memory cache via
 * fetchPdfTemplate(), so repeat previews within a session cost no network I/O.
 *
 * Usage inside the wizard:
 *   import { generatePolePdf } from './generators/PolePdfGenerator'
 *   const { pdfBytes, ... } = usePdfGenerate(generatePolePdf)
 *
 * @param {object} d      - Wizard form state (see PoleWizard.jsx for full shape)
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
  `${import.meta.env.BASE_URL}forms/360S014EC.pdf`

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT SCHEMA — all Y values are top-origin (CSS/screen style).
// The createPageDrawer helpers convert to pdf-lib bottom-origin internally.
// ─────────────────────────────────────────────────────────────────────────────

// ── Page 1 ────────────────────────────────────────────────────────────────────

const P1 = {
  // Header fields
  header: {
    streetRoad:        { x: 115, y: 107 },
    contractor:        { x: 395, y: 107 },
    dateWorkCompleted: { x: 395, y: 121 },
    cityTown:          { x: 115, y: 135 },
    district:          { x: 115, y: 150 },
    namePrint:         { x: 395, y: 150 },
    // Signature image: top of image in top-origin coords
    signature:         { x: 393, y: 131, maxW: 140, maxH: 20 },
    pcoWONo:           { x: 165, y: 164 },
    ciwrNo:            { x: 451, y: 164 },
  },

  // Pole IDs — centred within their cells
  poleIds: {
    newPoleId:         { fieldLeft:  33, fieldWidth: 170, y: 225 },
    oldPoleId:         { fieldLeft: 173, fieldWidth: 170, y: 225 },
    gpsNorth:          { x: 415, y: 220 },
    gpsEast:           { x: 415, y: 234 },
    altitude:          { x: 415, y: 265 },
    manufacturerPoleId:{ fieldLeft:  33, fieldWidth: 170, y: 273 },
    manufacturedDate:  { fieldLeft: 173, fieldWidth: 170, y: 273 },
  },

  // Activity checkboxes  (x, y pairs — show when value matches label)
  poleActivity: {
    'New':             { x: 143, y: 319 },
    'Removed':         { x: 218, y: 319 },
    'Replaced':        { x: 294, y: 319 },
    'Relocation':      { x: 386, y: 319 },
    'Label Replaced':  { x: 464, y: 319 },
  },
  crossarmActivity: {
    'New':             { x: 143, y: 333 },
    'Removed':         { x: 218, y: 333 },
    'Replaced':        { x: 294, y: 333 },
  },
  poleLoading: {
    'Angle':           { x: 143, y: 348 },
    'In Line':         { x: 218, y: 348 },
    'Road Crossing':   { x: 294, y: 348 },
    'Take Off':        { x: 386, y: 348 },
    'Termination':     { x: 464, y: 348 },
  },
  gpsRequired: {
    'Yes':             { x: 143, y: 362 },
    'No':              { x: 218, y: 362 },
  },
  poleCondition: {
    'New':             { x: 143, y: 377 },
    'Pre-Used':        { x: 218, y: 377 },
  },
  ownership: {
    'Powerco':         { x: 143, y: 391 },
    'Private':         { x: 218, y: 391 },
    'Other':           { x: 294, y: 391 },
  },
  ownershipOtherText:  { x: 374, y: 392 },

  sharedUse: {
    'Fibre':           { x: 143, y: 405 },
    'Chorus':          { x: 218, y: 405 },
    'Other':           { x: 294, y: 405 },
  },
  sharedUseOtherText:  { x: 374, y: 406 },

  reasonForRemoval:    { x: 128, y: 420 },

  // Pole code grid — 16 Busck/Goldpine codes in 4×4 layout, then 3 extra
  // Each entry: [x, y] for the checkbox, matching POLE_CODES index order
  poleCodes: [
    // Row 1 — codes 0-3
    { x:  45, y: 478 }, { x: 173, y: 478 }, { x: 295, y: 478 }, { x: 427, y: 478 },
    // Row 2 — codes 4-7
    { x:  45, y: 493 }, { x: 173, y: 493 }, { x: 295, y: 493 }, { x: 427, y: 493 },
    // Row 3 — codes 8-11
    { x:  45, y: 507 }, { x: 173, y: 507 }, { x: 295, y: 507 }, { x: 427, y: 507 },
    // Row 4 — codes 12-15
    { x:  45, y: 521 }, { x: 173, y: 521 }, { x: 295, y: 521 }, { x: 427, y: 521 },
  ],
  // Dulhunty / IUP / Other codes (custom manufacturer)
  dulhuntyCheck:       { x:  45, y: 537 },
  dulhuntyText:        { x: 232, y: 539 },
  iupCheck:            { x:  45, y: 552 },
  iupText:             { x: 184, y: 554 },
  otherCodeCheck:      { x:  45, y: 568 },
  otherCodeText:       { x: 232, y: 570 },

  // Pole type grid — 8 options in 4+4 layout
  poleTypes: [
    // Row 1 — types 0-3
    { x:  45, y: 610 }, { x: 174, y: 610 }, { x: 296, y: 610 }, { x: 429, y: 610 },
    // Row 2 — types 4-7
    { x:  45, y: 624 }, { x: 174, y: 624 }, { x: 296, y: 624 }, { x: 429, y: 624 },
  ],
  poleTypeOtherCheck:  { x:  45, y: 639 },
  poleTypeOtherText:   { x: 148, y: 641 },
}

// ── Page 2 ────────────────────────────────────────────────────────────────────

const P2 = {
  // Equipment on pole — checkbox x and text x per equipment type
  equipment: {
    // [checkboxX, textX, y]
    abs:              [  45, 175, 126 ],
    links:            [ 296, 433, 126 ],
    dropoutFuse:      [  45, 175, 140 ],
    transformer:      [ 296, 433, 140 ],
    regulator:        [  45, 175, 155 ],
    sectionliser:     [ 296, 433, 155 ],
    faultIndicator:   [  45, 175, 169 ],
    otherEquip:       [ 296, 433, 169 ],
    lightningArrester:[  45, 175, 184 ],
    otherEquipType:   [ 433, 433, 186 ],  // type label goes to x=433, no checkbox
  },

  // Accessories checkboxes [x, y]
  accessories: {
    'Possum Guard':       [  45, 224 ],
    'Streetlight Fitting':[ 215, 224 ],
    'Aerial Stay':        [ 384, 224 ],
    'Climbers':           [  45, 239 ],
    'Ground Stay':        [ 215, 239 ],
    'Platform':           [ 384, 239 ],
    'HV Cable Riser':     [  45, 253 ],
    'Bird Spikes':        [  45, 268 ],
  },
  controlBoxCheck:    { x:  215, y: 253 },
  controlBoxText:     { x:  357, y: 255 },
  accessoriesOtherCheck: { x: 215, y: 268 },
  accessoriesOtherText:  { x: 295, y: 269 },

  serviceConnections: { x: 194, y: 311 },
  serviceAddresses:   { x: 442, y: 311 },

  // Conductor rows — 7 rows, Y values top-to-bottom
  conductorRowY:    [ 343, 359, 375, 391, 407, 423, 439 ],
  conductorCols: {
    level:     58,
    existing: 130,
    size:     191,
    material: 310,
    insulation:450,
  },

  // Crossarm rows — 7 rows
  crossarmRowY:     [ 508, 524, 540, 556, 572, 588, 604 ],
  crossarmCols: {
    level:        58,
    existing:    113,
    voltage:     158,
    endSize:     216,
    length:      265,
    arms:        320,
    insulatorType:375,
    armMaterial: 475,
    wires:       520,
  },
}

// ── Page 3 ────────────────────────────────────────────────────────────────────

const P3 = {
  // Work description — 15 lines
  workDescriptionLineY: [
    532, 547, 561, 575, 590,
    604, 618, 632, 646, 661,
    676, 690, 705, 719, 733,
  ],
  workDescriptionX: 48,
}

// ── Reference data (mirrors the React component constants) ────────────────────

const POLE_CODES = [
  'B9.5 (Busck)',   'B10.0 (Busck)',  'B10.5 (Busck)',  'B11.0 (Busck)',
  'B12.4 (Busck)',  'B12.5 (Busck)',  'B13.65 (Busck)', 'B14.85 (Busck)',
  'B15.5 (Busck)',  'B18.5 (Busck)',
  '9m (9kN) Goldpine',   '10m (9kN) Goldpine',
  '10m (12kN) Goldpine', '11m (9kN) Goldpine',
  '11m (12kN) Goldpine', '12m (12kN) Goldpine',
]

const POLE_TYPES = [
  '1 Pole', '1 \u00BD Pole', '2 Pole', '3 Pole',
  '4 Pole', 'H Pole',        'Double',  'Stay Pole',
]

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} d       - Full wizard form state
 * @param {Array}  photos  - Photo attachments
 * @returns {Promise<Uint8Array>}
 */
export async function generatePolePdf(d, photos = []) {
  // ── Load template (cached after first call) ───────────────────────────────
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages         = pdfDoc.getPages()
  const [p1, p2, p3]  = pages

  // ── Per-page drawing helpers ──────────────────────────────────────────────
  const d1 = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)
  const d2 = createPageDrawer(p2, font, DEFAULT_INK, A4_HEIGHT)
  const d3 = createPageDrawer(p3, font, DEFAULT_INK, A4_HEIGHT)

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 1
  // ─────────────────────────────────────────────────────────────────────────

  // Header
  const h = P1.header
  d1.t(h.streetRoad.x,        h.streetRoad.y,        d.streetRoad)
  d1.t(h.contractor.x,        h.contractor.y,        d.contractor)
  d1.t(h.dateWorkCompleted.x, h.dateWorkCompleted.y, d.dateWorkCompleted)
  d1.t(h.cityTown.x,          h.cityTown.y,          d.cityTown)
  d1.t(h.district.x,          h.district.y,          d.district)
  d1.t(h.namePrint.x,         h.namePrint.y,         d.namePrint)
  d1.t(h.pcoWONo.x,           h.pcoWONo.y,           d.pcoWONo)
  d1.t(h.ciwrNo.x,            h.ciwrNo.y,            d.ciwrNo)

  await drawSignature(
    pdfDoc, p1, d.signed,
    h.signature.x, h.signature.y,
    h.signature.maxW, h.signature.maxH,
    A4_HEIGHT,
  )

  // Pole IDs & GPS
  const pid = P1.poleIds
  d1.tc(pid.newPoleId.fieldLeft,          pid.newPoleId.fieldWidth,          pid.newPoleId.y,          d.newPoleId)
  d1.tc(pid.oldPoleId.fieldLeft,          pid.oldPoleId.fieldWidth,          pid.oldPoleId.y,          d.oldPoleId)
  d1.t(pid.gpsNorth.x,                    pid.gpsNorth.y,                    d.gpsNorth)
  d1.t(pid.gpsEast.x,                     pid.gpsEast.y,                     d.gpsEast)
  d1.t(pid.altitude.x,                    pid.altitude.y,                    d.altitude)
  d1.tc(pid.manufacturerPoleId.fieldLeft, pid.manufacturerPoleId.fieldWidth, pid.manufacturerPoleId.y, d.manufacturerPoleId)
  d1.tc(pid.manufacturedDate.fieldLeft,   pid.manufacturedDate.fieldWidth,   pid.manufacturedDate.y,   d.manufacturedDate)

  // Activity / loading / condition / ownership checkboxes
  const checkboxGroups = [
    [ P1.poleActivity,    d.poleActivity       ],
    [ P1.crossarmActivity,d.crossarmActivity   ],
    [ P1.poleLoading,     d.poleLoading        ],
    [ P1.gpsRequired,     d.gpsRequired        ],
    [ P1.poleCondition,   d.poleCondition      ],
    [ P1.ownership,       d.ownership          ],
    [ P1.sharedUse,       d.sharedUse          ],
  ]
  checkboxGroups.forEach(([map, value]) =>
    Object.entries(map).forEach(([label, pos]) =>
      d1.ck(pos.x, pos.y, value === label)
    )
  )

  // Conditional text for "Other" selections
  if (d.ownership  === 'Other') d1.t(P1.ownershipOtherText.x,  P1.ownershipOtherText.y,  d.ownershipOther)
  if (d.sharedUse  === 'Other') d1.t(P1.sharedUseOtherText.x,  P1.sharedUseOtherText.y,  d.sharedUseOther)
  d1.t(P1.reasonForRemoval.x, P1.reasonForRemoval.y, d.reasonForRemoval)

  // Pole code checkboxes (16-entry grid)
  POLE_CODES.forEach((code, i) => {
    if (P1.poleCodes[i]) {
      d1.ck(P1.poleCodes[i].x, P1.poleCodes[i].y, d.poleCode === code)
    }
  })

  // Custom manufacturer codes (Dulhunty / IUP / Other)
  d1.ck(P1.dulhuntyCheck.x, P1.dulhuntyCheck.y, !!d.dulhuntyCode)
  d1.t( P1.dulhuntyText.x,  P1.dulhuntyText.y,  d.dulhuntyCode)
  d1.ck(P1.iupCheck.x,      P1.iupCheck.y,       !!d.iupCode)
  d1.t( P1.iupText.x,       P1.iupText.y,        d.iupCode)
  d1.ck(P1.otherCodeCheck.x,P1.otherCodeCheck.y, !!d.otherCode)
  d1.t( P1.otherCodeText.x, P1.otherCodeText.y,  d.otherCode)

  // Pole type checkboxes (8-entry grid)
  POLE_TYPES.forEach((type, i) => {
    if (P1.poleTypes[i]) {
      d1.ck(P1.poleTypes[i].x, P1.poleTypes[i].y, d.poleType === type)
    }
  })

  // "Other" pole type
  d1.ck(P1.poleTypeOtherCheck.x, P1.poleTypeOtherCheck.y, d.poleType === 'Other' && !!d.poleTypeOther)
  if (d.poleType === 'Other') d1.t(P1.poleTypeOtherText.x, P1.poleTypeOtherText.y, d.poleTypeOther)

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 2
  // ─────────────────────────────────────────────────────────────────────────

  // Equipment on pole — each item has a checkbox and a text field
  const eq = P2.equipment
  const equipItems = [
    // [stateKey for ID,  stateKey for type label (null = use ID as text), row def key]
    ['absId',              null,            'abs'              ],
    ['linksId',            null,            'links'            ],
    ['dropoutFuseId',      null,            'dropoutFuse'      ],
    ['transformerId',      null,            'transformer'      ],
    ['regulatorId',        null,            'regulator'        ],
    ['sectionliserId',     null,            'sectionliser'     ],
    ['faultIndicatorId',   null,            'faultIndicator'   ],
    ['otherEquipId',       'otherEquipType','otherEquip'       ],
    ['lightningArresterId',null,            'lightningArrester'],
  ]

  equipItems.forEach(([idKey, typeKey, rowKey]) => {
    const row   = eq[rowKey]
    const idVal = d[idKey]
    if (idVal !== undefined && idVal !== null) {
      d2.ck(row[0], row[2], !!idVal)
      d2.t( row[1], row[2], idVal)
    }
  })

  // "Other" equipment type label (goes in its own cell)
  if (d.otherEquipType !== undefined && d.otherEquipType !== null) {
    d2.t(eq.otherEquipType[0], eq.otherEquipType[2], d.otherEquipType)
  }

  // Accessories checkboxes
  const accessories = d.accessories || []
  Object.entries(P2.accessories).forEach(([label, [x, y]]) =>
    d2.ck(x, y, accessories.includes(label))
  )

  // Control box
  if (d.controlBoxPurpose !== undefined && d.controlBoxPurpose !== null) {
    d2.ck(P2.controlBoxCheck.x, P2.controlBoxCheck.y, !!d.controlBoxPurpose)
    d2.t( P2.controlBoxText.x,  P2.controlBoxText.y,  d.controlBoxPurpose)
  }

  // Accessories "Other"
  if (d.accessoriesOther !== undefined && d.accessoriesOther !== null) {
    d2.ck(P2.accessoriesOtherCheck.x, P2.accessoriesOtherCheck.y, !!d.accessoriesOther)
    d2.t( P2.accessoriesOtherText.x,  P2.accessoriesOtherText.y,  d.accessoriesOther)
  }

  // Service connections
  d2.t(P2.serviceConnections.x, P2.serviceConnections.y, d.serviceConnections)
  d2.t(P2.serviceAddresses.x,   P2.serviceAddresses.y,   d.serviceAddresses)

  // Conductor rows
  const cc = P2.conductorCols
  ;(d.conductors || []).forEach((c, i) => {
    const y = P2.conductorRowY[i]
    if (!y) return
    // Only write the row if at least one field is populated
    if (!c.level && !c.existing && !c.size && !c.material && !c.insulation) return
    d2.t(cc.level,      y, c.level)
    d2.t(cc.existing,   y, c.existing)
    d2.t(cc.size,       y, c.size)
    d2.t(cc.material,   y, c.material)
    d2.t(cc.insulation, y, c.insulation)
  })

  // Crossarm rows
  const ca = P2.crossarmCols
  ;(d.crossarms || []).forEach((c, i) => {
    const y = P2.crossarmRowY[i]
    if (!y) return
    if (!c.level && !c.existing && !c.voltage) return
    d2.t(ca.level,        y, c.level)
    d2.t(ca.existing,     y, c.existing)
    d2.t(ca.voltage,      y, c.voltage)
    d2.t(ca.endSize,      y, c.endSize)
    d2.t(ca.length,       y, c.length)
    d2.t(ca.arms,         y, c.arms)
    d2.t(ca.insulatorType,y, c.insulatorType)
    d2.t(ca.armMaterial,  y, c.armMaterial)
    d2.t(ca.wires,        y, c.wires)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 3 — Work description
  // ─────────────────────────────────────────────────────────────────────────

  // The work description field is a plain <textarea> split by newlines.
  // Each newline maps to the next ruled line on page 3.
  const descLines = (d.workDescription || '').split('\n')
  descLines.slice(0, P3.workDescriptionLineY.length).forEach((line, i) => {
    d3.t(P3.workDescriptionX, P3.workDescriptionLineY[i], line)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Photo pages
  // ─────────────────────────────────────────────────────────────────────────
  if (photos && photos.length > 0) {
    await appendPhotosToPdf(pdfDoc, photos)
  }

  return new Uint8Array(await pdfDoc.save())
}
