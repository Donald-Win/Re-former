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
 */

const KEYS = {
  contractor:        'rf_pref_contractor',
  namePrint:         'rf_pref_namePrint',
  isnId:             'rf_pref_isnId',
  signed:            'rf_pref_signed',
  certNo:            'rf_pref_certNo',
  dateWorkCompleted: 'rf_pref_dateWorkCompleted',
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
 * Returns { contractor, namePrint, isnId, signed, certNo, dateWorkCompleted } from localStorage.
 * dateWorkCompleted always returns today — it's used to pre-fill the field,
 * and the tech can change it if the work was done on a different day.
 */
export function getUserPrefs() {
  return {
    contractor:        localStorage.getItem(KEYS.contractor)        || '',
    namePrint:         localStorage.getItem(KEYS.namePrint)         || '',
    isnId:             localStorage.getItem(KEYS.isnId)             || '',
    signed:            localStorage.getItem(KEYS.signed)            || '',
    certNo:            localStorage.getItem(KEYS.certNo)            || '',
    dateWorkCompleted: todayString(),
  }
}

/** Saves a single pref. key must be one of the five pref keys. */
export function saveUserPref(key, value) {
  if (!KEYS[key]) return
  if (value) {
    localStorage.setItem(KEYS[key], value)
  } else {
    localStorage.removeItem(KEYS[key])
  }
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
    contractor:        p.contractor,
    dateWorkCompleted: p.dateWorkCompleted,
    namePrint:         p.namePrint,
    signed:            p.signed,
    ...extras,
  }
}
