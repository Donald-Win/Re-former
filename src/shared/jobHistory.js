// Job history — saves up to 5 recent jobs in localStorage.
// Only text fields are stored (no signature blob — too large).
// Primary identifier: NP Job Number, then PCo W/O No., then project+address combo.
//
// ── Draft autosave functions REMOVED ─────────────────────────────────────────
// saveDraft, loadDraft, clearDraft, and draftAge previously lived here and
// persisted wizard state to localStorage under "re-former-draft-<formKey>" keys.
//
// The app has fully migrated to idb-keyval (see src/shared/useDraft.jsx and
// src/shared/draftStore.js). Keeping these localStorage functions alongside
// the IndexedDB implementation created two active storage paths for the same
// data, with no guarantee of which one any given call-site was actually using.
//
// Removing them here means:
//   • All draft I/O goes through the IndexedDB layer exclusively.
//   • Any legacy "re-former-draft-*" keys left in localStorage are harmless
//     orphans — useDraft.jsx's one-time migration already moved them to IDB
//     and removed the originals.
//   • Callers that were still importing { saveDraft } from './jobHistory' will
//     get a clear build-time error rather than silently writing to the wrong
//     store — making the migration visible rather than hidden.

export const STORAGE_KEY = 're-former-job-history'
const MAX_ENTRIES = 5

export const JOB_FIELDS = [
  'npJobNumber', 'projectName',
  'pcoWONo', 'ciwrNo',
  'streetRoad', 'cityTown', 'district',
  'contractor',
  'dateWorkCompleted', 'namePrint',
  'formType',
]

function makeId(d) {
  if (d.npJobNumber) return `np:${d.npJobNumber.trim()}`
  if (d.pcoWONo)     return `wo:${d.pcoWONo.trim()}`
  const combo = [d.projectName, d.streetRoad, d.contractor]
    .filter(Boolean).map(s => s.trim()).join('|')
  if (combo) return `job:${combo}`
  return `ts:${typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now()}`
}

// ── Job history (localStorage — text fields only, no blobs) ──────────────────

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveToHistory(d) {
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

// ── Display helpers ───────────────────────────────────────────────────────────

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
