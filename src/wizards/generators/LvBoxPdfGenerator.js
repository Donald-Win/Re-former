/**
 * LvBoxPdfGenerator.js — PDF generator for 360S014ED
 * (AS-Built LV Box Record).
 *
 * Extracted from LvBoxWizard.jsx. The React component now only handles UI
 * state; all PDF logic lives here.
 *
 * The template is fetched once per session and cached in memory via
 * fetchPdfTemplate(), so repeat previews cost no network I/O.
 *
 * Usage inside the wizard:
 *   import { generateEdPdf } from './generators/LvBoxPdfGenerator'
 *   const { pdfBytes, ... } = usePdfGenerate(generateEdPdf)
 *
 * @param {object} d      - Wizard form state (see LvBoxWizard.jsx)
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
  `${import.meta.env.BASE_URL}forms/360S014ED.pdf`

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT — all Y values are top-origin (CSS/screen style).
// The createPageDrawer helpers convert to pdf-lib bottom-origin internally.
// ─────────────────────────────────────────────────────────────────────────────

const LAYOUT = {

  // ── Header fields ───────────────────────────────────────────────────────────
  // This form uses 7pt for all header text (smaller than the 8.5pt default).
  // cityTown and district are joined into a single combined string by the
  // generator before drawing — see the cityTownDistrict field below.
  header: {
    fontSize:           7,
    streetRoad:         { x: 120, y: 150 },
    cityTownDistrict:   { x: 120, y: 160 },  // rendered as "cityTown, district"
    pcoWONo:            { x: 120, y: 170 },
    ciwrNo:             { x: 120, y: 180 },
    contractor:         { x: 460, y: 150 },
    dateWorkCompleted:  { x: 460, y: 160 },
    npJobNumber:        { x: 460, y: 170 },
    // Signature — cssY is the TOP of the bounding box (top-origin).
    // Derived from original: drawImage({ x:460, y: PAGE_H-190, w:90, h:15 })
    //   → pdf-lib bottom = 842−190 = 652
    //   → pdf-lib top    = 652+15  = 667
    //   → cssY           = 842−667 = 175
    signature:          { x: 460, y: 175, maxW: 90, maxH: 15 },
  },

  // ── Box entry table ─────────────────────────────────────────────────────────
  // rowStartY — top-origin Y of the first data row
  // rowHeight  — vertical pitch between successive rows in pts
  // maxRows    — template accommodates up to 20 rows
  // fontSize   — applied to every cell; 6.5pt fits the narrow columns
  // cols       — maps each field key to its left-edge X position
  boxRows: {
    rowStartY:  249,
    rowHeight:  9.8,
    maxRows:    20,
    fontSize:   6.5,
    cols: {
      equipIdNew:           59,
      equipIdOld:          115,
      address:             169,
      manufacturer:        290,
      model:               347,
      serviceOrDist:       452,  // value is 'Service' | 'Distribution' | ''
      numberOfDisconnects: 498,
      fuseHolders:         520,
      typeOfChange:        595,
      reasonForRemoval:    640,
      owner:               695,
    },
  },

  // ── Comments (multi-line wrapped text) ──────────────────────────────────────
  comments: {
    x:          45,
    y:         455,
    maxWidth:  700,
    fontSize:    7,
    lineHeight: 10,
    maxLines:    5,
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
export async function generateEdPdf(d, photos = []) {
  // ── Load template (cached after first call) ───────────────────────────────
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const [p1]                 = pdfDoc.getPages()
  const { height: p1Height } = p1.getSize()
  const draw                 = createPageDrawer(p1, font, DEFAULT_INK, p1Height)

  // ── Header ────────────────────────────────────────────────────────────────
  const h   = LAYOUT.header
  const hFs = h.fontSize
  const cityTownDistrict = [d.cityTown, d.district].filter(Boolean).join(', ')

  draw.t(h.streetRoad.x,        h.streetRoad.y,        d.streetRoad,        hFs)
  draw.t(h.cityTownDistrict.x,  h.cityTownDistrict.y,  cityTownDistrict,    hFs)
  draw.t(h.pcoWONo.x,           h.pcoWONo.y,           d.pcoWONo,           hFs)
  draw.t(h.ciwrNo.x,            h.ciwrNo.y,            d.ciwrNo,            hFs)
  draw.t(h.contractor.x,        h.contractor.y,        d.contractor,        hFs)
  draw.t(h.dateWorkCompleted.x, h.dateWorkCompleted.y, d.dateWorkCompleted, hFs)
  draw.t(h.npJobNumber.x,       h.npJobNumber.y,       d.npJobNumber,       hFs)

  await drawSignature(
    pdfDoc, p1, d.signed,
    h.signature.x, h.signature.y,
    h.signature.maxW, h.signature.maxH,
    A4_HEIGHT,
  )

  // ── Box entry rows ────────────────────────────────────────────────────────
  const { rowStartY, rowHeight, maxRows, fontSize: rowFs, cols } = LAYOUT.boxRows
  ;(d.boxRows || []).slice(0, maxRows).forEach((row, i) => {
    const y = rowStartY + i * rowHeight
    draw.t(cols.equipIdNew,          y, row.equipIdNew,          rowFs)
    draw.t(cols.equipIdOld,          y, row.equipIdOld,          rowFs)
    draw.t(cols.address,             y, row.address,             rowFs)
    draw.t(cols.manufacturer,        y, row.manufacturer,        rowFs)
    draw.t(cols.model,               y, row.model,               rowFs)
    draw.t(cols.serviceOrDist,       y, row.serviceOrDist,       rowFs)
    draw.t(cols.numberOfDisconnects, y, row.numberOfDisconnects, rowFs)
    draw.t(cols.fuseHolders,         y, row.fuseHolders,         rowFs)
    draw.t(cols.typeOfChange,        y, row.typeOfChange,        rowFs)
    draw.t(cols.reasonForRemoval,    y, row.reasonForRemoval,    rowFs)
    draw.t(cols.owner,               y, row.owner,               rowFs)
  })

  // ── Comments ──────────────────────────────────────────────────────────────
  const cm = LAYOUT.comments
  draw.tWrap(cm.x, cm.y, d.comments, cm.maxWidth, cm.fontSize, cm.lineHeight, cm.maxLines)

  // ── Photos ────────────────────────────────────────────────────────────────
  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}
