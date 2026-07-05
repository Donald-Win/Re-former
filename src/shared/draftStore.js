/**
 * draftStore — named draft storage for wizard forms.
 *
 * Storage backend: IndexedDB via idb-keyval.
 * IndexedDB handles hundreds of MB comfortably, so photo base64 strings
 * are stored without risk of QuotaExceededError.
 *
 * All public functions are async (return Promises).
 *
 * Each draft object:
 *   id         — unique key  (e.g. "draft_1234567890_abc1")
 *   formKey    — e.g. '360S014EC'
 *   name       — user-supplied label
 *   step       — wizard step when saved
 *   savedAt    — ISO timestamp
 *   data       — form field values  (signed/signature excluded — stored in userPrefs)
 *   photos     — array of { dataUrl, name } — stored in full in IndexedDB
 */

import { createStore, get, set, del, keys } from 'idb-keyval'

// Dedicated IndexedDB store so we don't collide with other idb-keyval usage
const draftIdb = createStore('re-former-drafts', 'drafts')

const MAX_DRAFTS = 50

// ── One-time migration from old localStorage drafts ───────────────────────────
// Uses a Promise rather than a boolean flag so concurrent callers all await the
// same in-flight migration rather than each believing it's already done.
// Without this, two simultaneous calls (e.g. listDrafts + saveDraft on mount)
// could both pass the `_migrated` boolean check, then interleave their writes
// against the half-migrated IndexedDB store.
let _migrationPromise = null

async function _runMigration() {
  try {
    const OLD_KEY = 're-former-drafts-v2'
    const raw = localStorage.getItem(OLD_KEY)
    if (!raw) return
    const old = JSON.parse(raw)
    if (!Array.isArray(old) || old.length === 0) { localStorage.removeItem(OLD_KEY); return }

    // Write each legacy draft into IndexedDB (skip ones already there)
    const existingKeys = await keys(draftIdb)
    for (const draft of old) {
      if (!draft.id) continue
      if (existingKeys.includes(draft.id)) continue
      await set(draft.id, draft, draftIdb)
    }
    localStorage.removeItem(OLD_KEY)
    console.log(`[draftStore] Migrated ${old.length} legacy draft(s) to IndexedDB`)
  } catch (err) {
    console.warn('[draftStore] Migration failed (non-critical):', err)
  }
}

function migrateFromLocalStorage() {
  if (!_migrationPromise) {
    _migrationPromise = _runMigration()
  }
  return _migrationPromise
}

// Kick off migration immediately when the module loads
migrateFromLocalStorage()

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId() {
  return 'draft_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
}

function stripSignature(data) {
  // Signatures are large (50–200 KB as base64) and already persisted in userPrefs,
  // so we never store them in drafts. Covers the shared 'signed' field and the
  // HV Inspection wizard's 'wtlSigned' and 'fsSigned'.
  const SIG_KEYS = new Set(['signed', 'wtlSigned', 'fsSigned'])
  return Object.fromEntries(
    Object.entries(data || {}).filter(([k]) => !SIG_KEYS.has(k))
  )
}

// ── Public API — all async ────────────────────────────────────────────────────

/**
 * Returns all drafts for a given formKey, newest first.
 */
export async function listDrafts(formKey) {
  await migrateFromLocalStorage()
  const allKeys = await keys(draftIdb)
  const drafts = await Promise.all(allKeys.map(k => get(k, draftIdb)))
  return drafts
    .filter(d => d && d.formKey === formKey)
    .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
}

/**
 * Saves a new named draft. Returns the saved draft object.
 */
export async function saveDraft({ formKey, name, step, data, photos = [] }) {
  await migrateFromLocalStorage()

  const entry = {
    id:      makeId(),
    formKey,
    name:    name?.trim() || 'Unnamed draft',
    step:    step || 0,
    savedAt: new Date().toISOString(),
    data:    stripSignature(data),
    photos:  photos || [],
  }

  await set(entry.id, entry, draftIdb)

  // Enforce MAX_DRAFTS limit across ALL form types (oldest removed first)
  const allKeys = await keys(draftIdb)
  if (allKeys.length > MAX_DRAFTS) {
    const all = await Promise.all(allKeys.map(k => get(k, draftIdb)))
    const sorted = all
      .filter(Boolean)
      .sort((a, b) => new Date(a.savedAt) - new Date(b.savedAt))
    const toDelete = sorted.slice(0, all.length - MAX_DRAFTS)
    await Promise.all(toDelete.map(d => del(d.id, draftIdb)))
  }

  return entry
}

/**
 * Updates an existing draft in place (same id).
 */
export async function updateDraft(id, { name, step, data, photos }) {
  const existing = await get(id, draftIdb)
  if (!existing) return null

  const updated = {
    ...existing,
    name:    name?.trim() || existing.name,
    step:    step ?? existing.step,
    savedAt: new Date().toISOString(),
    data:    stripSignature(data),
    photos:  photos || [],
  }

  await set(id, updated, draftIdb)
  return updated
}

/**
 * Deletes a draft by id.
 */
export async function deleteDraft(id) {
  await del(id, draftIdb)
}

// ── Display helpers (sync — operate on already-fetched draft objects) ─────────

export function draftLabel(draft) {
  return draft?.name || 'Unnamed draft'
}

export function draftSub(draft) {
  const d = draft?.data || {}
  return [
    d.npJobNumber && `NP ${d.npJobNumber}`,
    d.projectName,
    d.streetRoad,
  ].filter(Boolean).join(' — ') || ''
}

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
