/**
 * userPrefs — lightweight localStorage wrapper for per-device user preferences.
 *
 * Stored keys:
 *   rf_pref_contractor        — contractor company name
 *   rf_pref_namePrint         — tech's printed name
 *   rf_pref_signed            — signature dataURL
 *   rf_pref_certNo            — competency certificate number
 *   rf_pref_dateWorkCompleted — last-used date (YYYY-MM-DD), refreshed to today on each load
 */

const KEYS = {
  contractor:        'rf_pref_contractor',
  namePrint:         'rf_pref_namePrint',
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
 * Returns { contractor, namePrint, signed, certNo, dateWorkCompleted } from localStorage.
 * dateWorkCompleted always returns today — it's used to pre-fill the field,
 * and the tech can change it if the work was done on a different day.
 */
export function getUserPrefs() {
  return {
    contractor:        localStorage.getItem(KEYS.contractor)        || '',
    namePrint:         localStorage.getItem(KEYS.namePrint)         || '',
    signed:            localStorage.getItem(KEYS.signed)            || '',
    certNo:            localStorage.getItem(KEYS.certNo)            || '',
    dateWorkCompleted: todayString(),
  }
}

/** Saves a single pref. key must be one of the four pref keys. */
export function saveUserPref(key, value) {
  if (!KEYS[key]) return
  if (value) {
    localStorage.setItem(KEYS[key], value)
  } else {
    localStorage.removeItem(KEYS[key])
  }
}
