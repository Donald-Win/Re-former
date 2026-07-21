/**
 * folderStructure.js — Configurable folder-path logic for (future) automatic
 * OneDrive saving.
 *
 * ── Status: groundwork only (v2.22.0) ─────────────────────────────────────
 * This file defines the token registry and path-building logic, and
 * UserSettings.jsx lets the tech configure and preview their folder
 * structure. Nothing in the app actually uploads to OneDrive yet — that's a
 * separate, later piece of work (Microsoft Graph API auth + upload). This
 * module exists now so that:
 *   1. The Map Number field (added to JobDetailsStep.jsx this version) has
 *      somewhere to be used once OneDrive saving is built.
 *   2. The tech can already set up and preview their preferred folder
 *      layout, so it's ready to go the moment uploading is switched on.
 *
 * ── Folder template ────────────────────────────────────────────────────────
 * A "folder template" is an ordered array of token entries:
 *   [{ token: 'projectName', enabled: true }, { token: 'mapNumber', enabled: true }, ...]
 *
 * Stored in localStorage via getFolderTemplate() / saveFolderTemplate()
 * (see userPrefs.js). The tech can reorder tokens (drag and drop) and
 * toggle any of them off — a disabled token is skipped entirely rather than
 * producing an empty folder level. Order and enabled-state are per-device,
 * same as every other setting in My Details.
 *
 * ── Site ID ────────────────────────────────────────────────────────────────
 * "Site ID" means different things per wizard — this mirrors the exact
 * per-wizard field already used for smart PDF filenames (see each wizard's
 * buildPdfFilename() call, introduced in v2.11.0): Pole → oldPoleId,
 * Transformer → transformerSiteId, LV Connection → icpNumber, Elec
 * Equipment → newEquipmentId, LV Box → first box row's equipIdNew/Old,
 * Zone Sub → substation, HV Inspection / Distribution Transformer
 * Commissioning → npJobNumber (no single equipment ID applies). getSiteId()
 * below is the ONE place this mapping lives, so the filename and the folder
 * path can never drift out of sync with each other.
 *
 * @param {object} d       - Wizard form state
 * @param {string} formKey - e.g. '360S014EC'
 * @returns {string}
 */
export function getSiteId(d, formKey) {
  switch (formKey) {
    case '360S014EC': return d.oldPoleId || d.newPoleId || ''
    case '360S014EG': return d.transformerSiteId || ''
    case '360S014EA': return d.icpNumber || ''
    case '360S014EE': return d.newEquipmentId || d.oldEquipmentId || ''
    case '360S014ED': return d.boxRows?.[0]?.equipIdNew || d.boxRows?.[0]?.equipIdOld || ''
    case '360S014EB': return d.streetRoad || ''
    case '360S014EF': return d.substation || ''
    case '220F028A':  return d.siteId || ''
    case '220F028B':  return d.transformerNo || ''
    default:          return ''
  }
}

// ── Token registry ────────────────────────────────────────────────────────────
// Each token knows its own display label (for the settings UI) and how to
// resolve itself from wizard state. A token that resolves to '' is skipped
// when the path is built — no empty folder levels.
export const FOLDER_TOKENS = {
  projectName: {
    label: 'Project Name',
    resolve: d => d.projectName || '',
  },
  npJobNumber: {
    label: 'NP Job Number',
    resolve: d => d.npJobNumber || '',
  },
  mapNumber: {
    label: 'Map Number',
    resolve: d => d.mapNumber || '',
  },
  siteId: {
    label: 'Site ID (pole / transformer / equipment no.)',
    resolve: (d, formKey) => getSiteId(d, formKey),
  },
  contractor: {
    label: 'Contractor',
    resolve: d => d.contractor || '',
  },
  dateWorkCompleted: {
    label: 'Date',
    resolve: d => d.dateWorkCompleted || '',
  },
}

export const DEFAULT_FOLDER_TEMPLATE = [
  { token: 'projectName', enabled: true },
  { token: 'mapNumber',   enabled: true },
  { token: 'siteId',      enabled: true },
]

/** Strip characters OneDrive (and every other filesystem) disallows in a folder name. */
function sanitizeSegment(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '').trim()
}

/**
 * Build the full folder path for a given form's data, honouring the tech's
 * configured root folder name and folder template.
 *
 * @param {object} d            - Wizard form state
 * @param {string} formKey      - e.g. '360S014EC'
 * @param {string} rootFolder   - Tech's chosen OneDrive root folder name
 * @param {Array}  folderTemplate - [{ token, enabled }] in the tech's chosen order
 * @returns {string} e.g. "Field Forms/Pyes Pa Blitz/MAP-4521/WKT-12345"
 */
export function buildFolderPath(d, formKey, rootFolder, folderTemplate) {
  const segments = (folderTemplate || DEFAULT_FOLDER_TEMPLATE)
    .filter(entry => entry.enabled)
    .map(entry => FOLDER_TOKENS[entry.token]?.resolve(d, formKey) || '')
    .filter(Boolean)
    .map(sanitizeSegment)
    .filter(Boolean)

  const root = sanitizeSegment(rootFolder) || 're-former'
  return [root, ...segments].join('/')
}
