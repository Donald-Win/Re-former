/**
 * LvConnectionPdfGenerator.js — PDF generator for 360S014EA
 * (AS-Built LV Connection Record).
 *
 * Extracted from LvConnectionWizard.jsx. The React component now only
 * handles UI state; all PDF logic lives here.
 *
 * The template is fetched once per session and cached in memory via
 * fetchPdfTemplate(), so repeat previews cost no network I/O.
 *
 * Usage inside the wizard:
 *   import { generateEaPdf } from './generators/LvConnectionPdfGenerator'
 *   const { pdfBytes, ... } = usePdfGenerate(generateEaPdf)
 *
 * @param {object} d      - Wizard form state (see LvConnectionWizard.jsx)
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
  `${import.meta.env.BASE_URL}forms/360S014EA.pdf`

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT — all Y values are top-origin (CSS/screen style).
// The createPageDrawer helpers convert to pdf-lib bottom-origin internally.
// ─────────────────────────────────────────────────────────────────────────────

const LAYOUT = {

  // ── Header fields ───────────────────────────────────────────────────────────
  // streetRoad occupies two lines — see the tWrap call in the generator.
  header: {
    streetRoad:         { x:  55, y: 128, maxWidth: 310, lineHeight: 14, maxLines: 2 },
    contractor:         { x: 420, y: 114 },
    dateWorkCompleted:  { x: 420, y: 128 },
    cityTown:           { x: 100, y: 174 },
    ciwrNo:             { x: 480, y: 174 },
    district:           { x: 100, y: 188 },
    pcoWONo:            { x: 480, y: 188 },
    cowShedNumber:      { x: 200, y: 202 },
    cocNumber:          { x: 420, y: 202 },
    icpNumber:          { x: 115, y: 216 },
    // cssY = A4_HEIGHT − (pdfLibY + imgHeight) = 842 − (678 + 22) = 142
    // Original: p1.drawImage({ x: 365, y: PAGE_H - 164, width: 120, height: 22 })
    signature:          { x: 365, y: 142, maxW: 120, maxH: 22 },
  },

  // ── Connection Point ─────────────────────────────────────────────────────────
  connectionPoint: {
    installedOverhead:    { x: 186, y: 255 },
    installedUnderground: { x: 279, y: 255 },
    connectedToBox:       { x: 186, y: 271 },
    connectedToPole:      { x: 279, y: 271 },
    connectedToOther:     { x: 408, y: 271 },
    connectedToOtherText: { x: 490, y: 273 },
    poleServiceBoxNumber: { x: 174, y: 289 },
  },

  // ── Conductor Details ────────────────────────────────────────────────────────
  conductor: {
    conductorSize:     { x: 122, y: 320 },
    conductorMaterial: { x: 271, y: 320 },
    insulation:        { x: 442, y: 320 },
    numberOfCables:    { x: 130, y: 336 },
    numberOfCores:     { x: 271, y: 336 },
    fuseSize:          { x: 442, y: 336 },
    numberOfPhases:    { x: 130, y: 352 },
    phaseColours:      { x: 271, y: 352 },
  },

  // ── Cable Duct ───────────────────────────────────────────────────────────────
  cableDuct: {
    no:               { x: 186, y: 366 },
    new:              { x: 265, y: 366 },
    newSizeText:      { x: 360, y: 368 },
    existing:         { x: 406, y: 366 },
    existingSizeText: { x: 510, y: 368 },
  },

  // ── Work Description (multi-line wrapped text) ───────────────────────────────
  workDescription: {
    x: 55, y: 748, maxWidth: 485, lineHeight: 11, maxLines: 4,
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
export async function generateEaPdf(d, photos = []) {
  // ── Load template (cached after first call) ───────────────────────────────
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const [p1]          = pdfDoc.getPages()
  const draw          = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)

  // ── Header ────────────────────────────────────────────────────────────────
  const h = LAYOUT.header
  draw.tWrap(h.streetRoad.x, h.streetRoad.y, d.streetRoad,
    h.streetRoad.maxWidth, 8.5, h.streetRoad.lineHeight, h.streetRoad.maxLines)
  draw.t(h.contractor.x,        h.contractor.y,        d.contractor)
  draw.t(h.dateWorkCompleted.x, h.dateWorkCompleted.y, d.dateWorkCompleted)
  draw.t(h.cityTown.x,          h.cityTown.y,          d.cityTown)
  draw.t(h.ciwrNo.x,            h.ciwrNo.y,            d.ciwrNo)
  draw.t(h.district.x,          h.district.y,          d.district)
  draw.t(h.pcoWONo.x,           h.pcoWONo.y,           d.pcoWONo)
  draw.t(h.cowShedNumber.x,     h.cowShedNumber.y,     d.cowShedNumber)
  draw.t(h.cocNumber.x,         h.cocNumber.y,         d.cocNumber)
  draw.t(h.icpNumber.x,         h.icpNumber.y,         d.icpNumber)

  await drawSignature(
    pdfDoc, p1, d.signed,
    h.signature.x, h.signature.y,
    h.signature.maxW, h.signature.maxH,
    A4_HEIGHT,
  )

  // ── Connection Point ──────────────────────────────────────────────────────
  const cp = LAYOUT.connectionPoint
  draw.ck(cp.installedOverhead.x,    cp.installedOverhead.y,    d.installedService === 'Overhead line')
  draw.ck(cp.installedUnderground.x, cp.installedUnderground.y, d.installedService === 'Underground cable')
  draw.ck(cp.connectedToBox.x,       cp.connectedToBox.y,       d.connectedTo === 'Box')
  draw.ck(cp.connectedToPole.x,      cp.connectedToPole.y,      d.connectedTo === 'Pole')
  draw.ck(cp.connectedToOther.x,     cp.connectedToOther.y,     d.connectedTo === 'Other')
  if (d.connectedTo === 'Other') {
    draw.t(cp.connectedToOtherText.x, cp.connectedToOtherText.y, d.connectedToOther)
  }
  draw.t(cp.poleServiceBoxNumber.x, cp.poleServiceBoxNumber.y, d.poleServiceBoxNumber)

  // ── Conductor Details ─────────────────────────────────────────────────────
  const con = LAYOUT.conductor
  draw.t(con.conductorSize.x,     con.conductorSize.y,     d.conductorSize)
  draw.t(con.conductorMaterial.x, con.conductorMaterial.y, d.conductorMaterial)
  draw.t(con.insulation.x,        con.insulation.y,        d.insulation)
  draw.t(con.numberOfCables.x,    con.numberOfCables.y,    d.numberOfCables)
  draw.t(con.numberOfCores.x,     con.numberOfCores.y,     d.numberOfCores)
  draw.t(con.fuseSize.x,          con.fuseSize.y,          d.fuseSize)
  draw.t(con.numberOfPhases.x,    con.numberOfPhases.y,    d.numberOfPhases)
  draw.t(con.phaseColours.x,      con.phaseColours.y,      d.phaseColours)

  // ── Cable Duct ────────────────────────────────────────────────────────────
  const cd = LAYOUT.cableDuct
  draw.ck(cd.no.x,       cd.no.y,       d.cableDuct === 'No')
  draw.ck(cd.new.x,      cd.new.y,      d.cableDuct === 'New')
  if (d.cableDuct === 'New') {
    draw.t(cd.newSizeText.x, cd.newSizeText.y, d.cableDuctNewSize)
  }
  draw.ck(cd.existing.x, cd.existing.y, d.cableDuct === 'Existing')
  if (d.cableDuct === 'Existing') {
    draw.t(cd.existingSizeText.x, cd.existingSizeText.y, d.cableDuctExistingSize)
  }

  // ── Work Description ──────────────────────────────────────────────────────
  const wd = LAYOUT.workDescription
  draw.tWrap(wd.x, wd.y, d.workDescription, wd.maxWidth, 8.5, wd.lineHeight, wd.maxLines)

  // ── Photos ────────────────────────────────────────────────────────────────
  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}
