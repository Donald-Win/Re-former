// Job history — saves up to 5 recent jobs in localStorage.
// Only text fields are stored (no signature blob — too large).
// Primary identifier: NP Job Number, then PCo W/O No., then project+address combo.

export const STORAGE_KEY = 're-former-job-history'
const MAX_ENTRIES = 5

export const JOB_FIELDS = [
  'npJobNumber', 'projectName',
  'pcoWONo', 'ciwrNo',
  'streetRoad', 'cityTown', 'district',
  'contractor',
  'dateWorkCompleted', 'namePrint',
]

function makeId(d) {
  if (d.npJobNumber) return `np:${d.npJobNumber.trim()}`
  if (d.pcoWONo)     return `wo:${d.pcoWONo.trim()}`
  const combo = [d.projectName, d.streetRoad, d.contractor].filter(Boolean).map(s => s.trim()).join('|')
  if (combo) return `job:${combo}`
  return `ts:${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`
}

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveToHistory(d) {
  // Don't save if there's nothing meaningful to identify this job by
  if (!d.npJobNumber && !d.pcoWONo && !d.projectName && !d.streetRoad && !d.contractor) return

  const id = makeId(d)
  const entry = {
    id,
    savedAt: new Date().toISOString(),
    ...Object.fromEntries(JOB_FIELDS.map(k => [k, d[k] || ''])),
  }

  const existing = loadHistory().filter(e => e.id !== id)
  const updated  = [entry, ...existing].slice(0, MAX_ENTRIES)

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 2)))
    } catch { /* give up silently */ }
  }
}

export function formatJobLabel(entry) {
  const parts = [entry.npJobNumber, entry.projectName, entry.streetRoad].filter(Boolean)
  return parts.join(' — ') || 'Unnamed job'
}

export function formatJobDate(entry) {
  if (!entry.savedAt) return ''
  try {
    return new Date(entry.savedAt).toLocaleDateString('en-NZ', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return '' }
}
