// Job history — saves up to 5 recent jobs in localStorage.
// Only text fields are stored (no signature blob — too large).
// Keyed by pcoWONo+streetRoad combo so blank W/O jobs also deduplicate.

const STORAGE_KEY = 're-former-job-history'
const MAX_ENTRIES = 5

export const JOB_FIELDS = [
  'pcoWONo', 'ciwrNo',
  'streetRoad', 'cityTown', 'district',
  'contractor', 'contractorJobCostCode',
  'dateWorkCompleted', 'namePrint',
]

function makeId(d) {
  // Stable key: prefer W/O number, fall back to street+contractor combo,
  // last resort timestamp (only if truly empty — prevents spurious dupes)
  if (d.pcoWONo) return `wo:${d.pcoWONo.trim()}`
  const combo = [d.streetRoad, d.contractor].filter(Boolean).map(s => s.trim()).join('|')
  if (combo) return `job:${combo}`
  return `ts:${Date.now()}`
}

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveToHistory(d) {
  // Don't save blank entries
  if (!d.pcoWONo && !d.streetRoad && !d.contractor) return

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
  const parts = [entry.pcoWONo, entry.streetRoad, entry.cityTown].filter(Boolean)
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
