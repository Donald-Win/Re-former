// Job history — saves up to 5 recent jobs in localStorage.
// Only text fields are stored (no signature blob — too large).
// Primary identifier: NP Job Number, then PCo W/O No., then project+address combo.
//
// Also provides draft autosave — each wizard saves its in-progress state so
// an accidental close or page refresh doesn't lose work.

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

// ── Draft autosave ────────────────────────────────────────────────────────────
// Each wizard uses a unique formKey (e.g. '360S014EB') so drafts don't collide.
// Signature blobs are excluded — too large for localStorage.

const DRAFT_PREFIX = 're-former-draft-'

export function saveDraft(formKey, data, step) {
  // Don't bother saving a blank step-0 form — nothing worth restoring
  const hasContent = JOB_FIELDS.some(k => data[k])
  if (step === 0 && !hasContent) return

  const draft = {
    step,
    savedAt: Date.now(),
    data: Object.fromEntries(
      Object.entries(data).filter(([, v]) =>
        // Exclude signature (Uint8Array / large string) and null
        typeof v !== 'object' || v === null || Array.isArray(v)
      )
    ),
  }

  try {
    localStorage.setItem(DRAFT_PREFIX + formKey, JSON.stringify(draft))
  } catch { /* storage full — skip silently */ }
}

export function loadDraft(formKey) {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + formKey)
    if (!raw) return null
    const draft = JSON.parse(raw)
    // Discard drafts older than 7 days — they're stale
    if (Date.now() - draft.savedAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(DRAFT_PREFIX + formKey)
      return null
    }
    return draft
  } catch {
    return null
  }
}

export function clearDraft(formKey) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + formKey)
  } catch {}
}

export function draftAge(draft) {
  if (!draft?.savedAt) return ''
  const mins = Math.round((Date.now() - draft.savedAt) / 60000)
  if (mins < 2)  return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24)  return `${hrs} hour${hrs > 1 ? 's' : ''} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}
