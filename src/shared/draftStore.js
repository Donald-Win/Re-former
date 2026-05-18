/**
 * draftStore — named draft storage for wizard forms.
 *
 * Unlike the old single-draft system, this stores multiple named drafts
 * per form type so the user can pre-fill several jobs in advance.
 *
 * Each draft has:
 *   id         — unique key
 *   formKey    — e.g. '360S014EC'
 *   name       — user-supplied label (e.g. "Pyes Pa Pole - pre fill")
 *   step       — wizard step when saved
 *   savedAt    — ISO timestamp
 *   data       — form field values (signed excluded — too large)
 *   photos     — up to MAX_PHOTOS base64 data URLs
 */

const STORAGE_KEY  = 're-former-drafts-v2'
const MAX_DRAFTS   = 50   // across all form types
const MAX_PHOTOS   = 5

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function persist(drafts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
    return true
  } catch {
    // Storage full — try without photos
    try {
      const slim = drafts.map(d => ({ ...d, photos: [] }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim))
      return true
    } catch { return false }
  }
}

function makeId() {
  return 'draft_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
}

/** Returns all drafts for a given formKey, newest first. */
export function listDrafts(formKey) {
  return load().filter(d => d.formKey === formKey)
}

/** Saves a new named draft. Returns the saved draft object. */
export function saveDraft({ formKey, name, step, data, photos = [] }) {
  const drafts = load()

  // Exclude signature — too large
  const cleanData = Object.fromEntries(
    Object.entries(data || {}).filter(([k]) => k !== 'signed')
  )

  const entry = {
    id:      makeId(),
    formKey,
    name:    name?.trim() || 'Unnamed draft',
    step:    step || 0,
    savedAt: new Date().toISOString(),
    data:    cleanData,
    photos:  (photos || []).slice(0, MAX_PHOTOS),
  }

  drafts.unshift(entry)
  persist(drafts.slice(0, MAX_DRAFTS))
  return entry
}

/** Updates an existing draft in place (same id). */
export function updateDraft(id, { name, step, data, photos }) {
  const drafts = load()
  const idx = drafts.findIndex(d => d.id === id)
  if (idx < 0) return null

  const cleanData = Object.fromEntries(
    Object.entries(data || {}).filter(([k]) => k !== 'signed')
  )

  drafts[idx] = {
    ...drafts[idx],
    name:    name?.trim() || drafts[idx].name,
    step:    step ?? drafts[idx].step,
    savedAt: new Date().toISOString(),
    data:    cleanData,
    photos:  (photos || []).slice(0, MAX_PHOTOS),
  }

  persist(drafts)
  return drafts[idx]
}

/** Deletes a draft by id. */
export function deleteDraft(id) {
  persist(load().filter(d => d.id !== id))
}

/** Returns a display label for a draft. */
export function draftLabel(draft) {
  return draft.name || 'Unnamed draft'
}

/** Returns a subtitle line showing key job details. */
export function draftSub(draft) {
  const d = draft.data || {}
  return [
    d.npJobNumber && `NP ${d.npJobNumber}`,
    d.projectName,
    d.streetRoad,
  ].filter(Boolean).join(' — ') || ''
}

/** Human-readable age string. */
export function draftAge(draft) {
  if (!draft?.savedAt) return ''
  const mins = Math.round((Date.now() - new Date(draft.savedAt)) / 60000)
  if (mins < 2)  return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24)  return `${hrs} hour${hrs > 1 ? 's' : ''} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}
