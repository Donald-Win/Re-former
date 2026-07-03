/**
 * LvConnectionPdfGenerator.js — PDF generator for 360S014EA
 * (AS-Built LV Connection Record).
 *
 * Every field on this form is a simple named field — no repeating-row
 * tables — so the whole thing is one FIELDS object rendered in a single
 * renderFields() call. See DistributionTransformerPdfGenerator.js for the
 * pattern used when a form also has tables.
 *
 * The template is fetched once per session and cached in memory via
 * fetchPdfTemplate(), so repeat previews cost no network I/O.
 *
 * Usage inside the wizard:
 *   import { generateEaPdf } from './generators/LvConnectionPdfGenerator'
 *   const { pdfBytes, ... } = usePdfGenerate(generateEaPdf)
 *
 * Coordinate convention
 * ─────────────────────
 * All Y values are TOP-ORIGIN (CSS / screen style). renderFields converts
 * them to pdf-lib bottom-origin internally.
 *
 * @param {object} d      - Wizard form state (see LvConnectionWizard.jsx)
 * @param {Array}  photos - Array of { dataUrl: string, name?: string }
 * @returns {Promise<Uint8Array>}
 */

import { PDFDocument, StandardFonts } from 'pdf-lib'
import { fetchPdfTemplate, createPageDrawer, DEFAULT_INK, A4_HEIGHT } from '../../shared/pdfDrawUtils'
import { renderFields } from '../../shared/pdfFieldRenderer'
import { appendPhotosToPdf } from '../../shared/appendPhotosToPdf'

const getTemplateUrl = () =>
  `${import.meta.env.BASE_URL}forms/360S014EA.pdf`

// ─────────────────────────────────────────────────────────────────────────────
// FIELDS — every field on the form. One object = one field.
// ─────────────────────────────────────────────────────────────────────────────

export const FIELDS = {

  // ── Header ───────────────────────────────────────────────────────────────────
  // streetRoad occupies two lines.
  streetRoad:        { type: 'wrap', x: 55, y: 128, maxWidth: 310, lineHeight: 14, maxLines: 2, value: d => d.streetRoad },
  contractor:        { type: 'text', align: 'left', x: 420, y: 114, value: d => d.contractor },
  dateWorkCompleted: { type: 'text', align: 'left', x: 420, y: 128, value: d => d.dateWorkCompleted },
  cityTown:          { type: 'text', align: 'left', x: 100, y: 174, value: d => d.cityTown },
  ciwrNo:            { type: 'text', align: 'left', x: 480, y: 174, value: d => d.ciwrNo },
  district:          { type: 'text', align: 'left', x: 100, y: 188, value: d => d.district },
  pcoWONo:           { type: 'text', align: 'left', x: 480, y: 188, value: d => d.pcoWONo },
  cowShedNumber:     { type: 'text', align: 'left', x: 200, y: 202, value: d => d.cowShedNumber },
  cocNumber:         { type: 'text', align: 'left', x: 420, y: 202, value: d => d.cocNumber },
  icpNumber:         { type: 'text', align: 'left', x: 115, y: 216, value: d => d.icpNumber },
  signed:            { type: 'signature', x: 365, y: 142, maxW: 120, maxH: 22, value: d => d.signed },

  // ── Connection Point ─────────────────────────────────────────────────────────
  installedOverhead:    { type: 'check', x: 186, y: 255, value: d => d.installedService === 'Overhead line' },
  installedUnderground: { type: 'check', x: 279, y: 255, value: d => d.installedService === 'Underground cable' },
  connectedToBox:       { type: 'check', x: 186, y: 271, value: d => d.connectedTo === 'Box' },
  connectedToPole:      { type: 'check', x: 279, y: 271, value: d => d.connectedTo === 'Pole' },
  connectedToOther:     { type: 'check', x: 408, y: 271, value: d => d.connectedTo === 'Other' },
  // Only drawn when "Other" is selected — matches the original's `if` guard,
  // so a leftover value from a previous selection never bleeds onto the PDF.
  connectedToOtherText: { type: 'text', align: 'left', x: 490, y: 273, value: d => (d.connectedTo === 'Other' ? d.connectedToOther : '') },
  poleServiceBoxNumber: { type: 'text', align: 'left', x: 174, y: 289, value: d => d.poleServiceBoxNumber },

  // ── Conductor Details ────────────────────────────────────────────────────────
  conductorSize:     { type: 'text', align: 'left', x: 122, y: 320, value: d => d.conductorSize },
  conductorMaterial: { type: 'text', align: 'left', x: 271, y: 320, value: d => d.conductorMaterial },
  insulation:        { type: 'text', align: 'left', x: 442, y: 320, value: d => d.insulation },
  numberOfCables:    { type: 'text', align: 'left', x: 130, y: 336, value: d => d.numberOfCables },
  numberOfCores:     { type: 'text', align: 'left', x: 271, y: 336, value: d => d.numberOfCores },
  fuseSize:          { type: 'text', align: 'left', x: 442, y: 336, value: d => d.fuseSize },
  numberOfPhases:    { type: 'text', align: 'left', x: 130, y: 352, value: d => d.numberOfPhases },
  phaseColours:      { type: 'text', align: 'left', x: 271, y: 352, value: d => d.phaseColours },

  // ── Cable Duct ───────────────────────────────────────────────────────────────
  cableDuctNo:       { type: 'check', x: 186, y: 366, value: d => d.cableDuct === 'No' },
  cableDuctNew:      { type: 'check', x: 265, y: 366, value: d => d.cableDuct === 'New' },
  cableDuctNewSize:  { type: 'text', align: 'left', x: 360, y: 368, value: d => (d.cableDuct === 'New' ? d.cableDuctNewSize : '') },
  cableDuctExisting:     { type: 'check', x: 406, y: 366, value: d => d.cableDuct === 'Existing' },
  cableDuctExistingSize: { type: 'text', align: 'left', x: 510, y: 368, value: d => (d.cableDuct === 'Existing' ? d.cableDuctExistingSize : '') },

  // ── Work Description (multi-line wrapped text) ───────────────────────────────
  workDescription: { type: 'wrap', x: 55, y: 748, maxWidth: 485, lineHeight: 11, maxLines: 4, value: d => d.workDescription },
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function generateEaPdf(d, photos = []) {
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const [p1]          = pdfDoc.getPages()
  const draw          = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)

  await renderFields({ pdfDoc, page: p1, draw }, FIELDS, d)

  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}
