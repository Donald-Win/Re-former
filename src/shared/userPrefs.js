/**
 * userPrefs — lightweight localStorage wrapper for per-device user preferences.
 *
 * Stored keys:
 *   rf_pref_contractor        — contractor company name
 *   rf_pref_namePrint         — tech's printed name
 *   rf_pref_isnId             — ISN ID number
 *   rf_pref_signed            — signature dataURL
 *   rf_pref_certNo            — competency certificate number
 *   rf_pref_dateWorkCompleted — last-used date (YYYY-MM-DD), refreshed to today on each load
 *   rf_pref_defaultView       — which screen the app opens to: 'workType' | 'allForms'
 *   rf_pref_oneDriveRootFolder — OneDrive root folder name (groundwork for future auto-save)
 *   rf_pref_folderTemplate     — JSON array of { token, enabled }, folder path order/toggles
 */

const KEYS = {
  contractor:         'rf_pref_contractor',
  namePrint:          'rf_pref_namePrint',
  isnId:              'rf_pref_isnId',
  signed:             'rf_pref_signed',
  certNo:             'rf_pref_certNo',
  dateWorkCompleted:  'rf_pref_dateWorkCompleted',
  defaultView:        'rf_pref_defaultView',
  oneDriveRootFolder: 'rf_pref_oneDriveRootFolder',
  folderTemplate:     'rf_pref_folderTemplate',
}

/** Today's date as YYYY-MM-DD (matches HTML date input format). */
function todayString() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Returns { contractor, namePrint, isnId, signed, certNo, dateWorkCompleted,
 * defaultView } from localStorage.
 * dateWorkCompleted always returns today — it's used to pre-fill the field,
 * and the tech can change it if the work was done on a different day.
 * defaultView falls back to 'workType' — the app's original default screen —
 * when nothing has been saved yet.
 */
export function getUserPrefs() {
  return {
    contractor:         localStorage.getItem(KEYS.contractor)        || '',
    namePrint:          localStorage.getItem(KEYS.namePrint)         || '',
    isnId:              localStorage.getItem(KEYS.isnId)             || '',
    signed:             localStorage.getItem(KEYS.signed)            || '',
    certNo:             localStorage.getItem(KEYS.certNo)            || '',
    dateWorkCompleted:  todayString(),
    defaultView:        localStorage.getItem(KEYS.defaultView)       || 'workType',
    oneDriveRootFolder: localStorage.getItem(KEYS.oneDriveRootFolder) || '',
  }
}

/** Saves a single pref. key must be one of the keys defined in KEYS above. */
export function saveUserPref(key, value) {
  if (!KEYS[key]) return
  if (value) {
    localStorage.setItem(KEYS[key], value)
  } else {
    localStorage.removeItem(KEYS[key])
  }
}

/**
 * Returns the tech's configured folder template — an ordered array of
 * { token, enabled } — or DEFAULT_FOLDER_TEMPLATE if nothing has been saved
 * yet or the saved value fails to parse. Kept separate from getUserPrefs()
 * because this value is an array, not a plain string like every other pref.
 *
 * Importing DEFAULT_FOLDER_TEMPLATE here (rather than duplicating it) keeps
 * this file and folderStructure.js from drifting apart on what "default"
 * means.
 */
export function getFolderTemplate() {
  try {
    const raw = localStorage.getItem(KEYS.folderTemplate)
    if (!raw) return null // null signals "use the caller's own default" — see folderStructure.js
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Saves the tech's folder template (array of { token, enabled }). */
export function saveFolderTemplate(template) {
  try {
    localStorage.setItem(KEYS.folderTemplate, JSON.stringify(template))
  } catch { /* storage full — not critical */ }
}

/**
 * Returns the common form-state fields that every wizard initialises from
 * user preferences, merged with any form-specific extras.
 *
 * Designed for use as a useState initialiser (function form) so getUserPrefs()
 * is called only once at mount rather than on every render:
 *
 *   const [d, setD] = useState(() => getBaseFormState({ myField: '' }))
 *
 * @param {object} [extras={}]  Form-specific fields to merge in after the base.
 * @returns {object}
 */
export function getBaseFormState(extras = {}) {
  const p = getUserPrefs()
  return {
    npJobNumber:       '',
    projectName:       '',
    pcoWONo:           '',
    ciwrNo:            '',
    streetRoad:        '',
    cityTown:          '',
    district:          '',
    mapNumber:         '',
    contractor:        p.contractor,
    dateWorkCompleted: p.dateWorkCompleted,
    namePrint:         p.namePrint,
    signed:            p.signed,
    ...extras,
  }
}
