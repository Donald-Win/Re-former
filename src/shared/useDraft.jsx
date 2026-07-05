// useDraft — wizard autosave hook.
//
// Disabled write path (v2.18.3)
// ──────────────────────────────
// This hook used to debounce-write a full snapshot of the form (including
// photos) to IndexedDB on every field change. Nothing in the app ever read
// that data back — there is no "Resume where you left off?" prompt anywhere,
// only the named-draft system (DraftPicker.jsx / draftStore.js), which is
// entirely separate. So every keystroke in every wizard was silently
// writing to IndexedDB for a feature with no UI ever built on top of it.
//
// The write effect has been removed. clearDraft() is kept as a safe no-op
// call (deleting a slot that was never written just does nothing) so every
// wizard's existing `clearFormDraft()` call after a successful PDF share
// keeps working unchanged — no wizard files needed to change for this fix.
//
// If real crash-recovery is wanted later, re-add a debounced write effect
// here and a restore-prompt read on wizard mount — see DraftPicker.jsx for
// the equivalent flow already built for named drafts.
//
// Storage backend: IndexedDB via idb-keyval, kept only for clearAutosave()
// and the one-time legacy-localStorage migration below.

import { createStore, get, set, del } from 'idb-keyval'

// Dedicated IndexedDB store for autosave slots (separate from named drafts)
const autosaveIdb = createStore('re-former-autosave', 'slots')

async function clearAutosave(formKey) {
  try {
    await del(formKey, autosaveIdb)
  } catch (err) {
    console.warn('[useDraft] clearDraft failed:', err)
  }
}

// ── One-time migration from old localStorage autosave slots ──────────────────
// Retained even with the write path disabled: a handful of devices may still
// be carrying pre-2.13 localStorage autosave slots, and clearing those out
// of localStorage is worth doing on its own regardless of whether the
// IndexedDB copy they migrate into is ever read. Uses a Promise rather than
// a boolean flag so concurrent mounts all await the same in-flight migration.
const KNOWN_FORM_KEYS = [
  '360S014EC', '360S014EG', '360S014EE',
  '360S014EA', '360S014EB', '360S014ED',
  '360S014EF', '220F028A',
]
let _migrationPromise = null

async function _runAutosaveMigration() {
  const OLD_PREFIX = 're-former-autosave-'
  for (const formKey of KNOWN_FORM_KEYS) {
    try {
      const raw = localStorage.getItem(OLD_PREFIX + formKey)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const existing = await get(formKey, autosaveIdb)
      if (!existing) {
        await set(formKey, parsed, autosaveIdb)
      }
      localStorage.removeItem(OLD_PREFIX + formKey)
    } catch (_) {}
  }
}

function migrateAutosaveSlots() {
  if (!_migrationPromise) {
    _migrationPromise = _runAutosaveMigration()
  }
  return _migrationPromise
}

// Kick off on module load
migrateAutosaveSlots()

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * @param {string} formKey - e.g. '360S014EC'
 * @param {object} d        - current wizard form state (accepted, unused —
 *                             kept so every wizard's existing call site
 *                             `useDraft(FORM_KEY, d, step, photos)` needs no change)
 * @param {number} step      - current wizard step (accepted, unused)
 * @param {Array}  photos    - current photos (accepted, unused)
 */
export function useDraft(formKey, d, step, photos = []) {
  const clearDraft = () => clearAutosave(formKey)
  return { clearDraft }
}
