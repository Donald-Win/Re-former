// useDraft — wizard autosave hook.
//
// Autosaves form state on every change (debounced, 600ms).
// Storage backend: IndexedDB via idb-keyval so photo base64 strings
// don't blow localStorage's ~5 MB quota.
//
// No automatic restore prompt — loading is purely manual via DraftPicker.
//
// Usage:
//   const { clearDraft } = useDraft(formKey, d, step, photos)
//
//   // clearDraft() — call after successful PDF share to wipe the autosave slot

import { useEffect, useRef } from 'react'
import { createStore, get, set, del } from 'idb-keyval'

// Dedicated IndexedDB store for autosave slots (separate from named drafts)
const autosaveIdb = createStore('re-former-autosave', 'slots')

const AUTOSAVE_DEBOUNCE = 600

function stripSignature(data) {
  // Signatures are large (50–200 KB as base64) and already persisted in userPrefs,
  // so we never store them in autosave slots. Covers the shared 'signed' field and
  // the HV Inspection wizard's 'wtlSigned' and 'fsSigned'.
  const SIG_KEYS = new Set(['signed', 'wtlSigned', 'fsSigned'])
  return Object.fromEntries(
    Object.entries(data || {}).filter(([k]) => !SIG_KEYS.has(k))
  )
}

async function writeAutosave(formKey, d, step, photos) {
  try {
    const payload = {
      savedAt: Date.now(),
      step,
      data:    stripSignature(d),
      photos:  photos || [],
    }
    await set(formKey, payload, autosaveIdb)
  } catch (err) {
    console.warn('[useDraft] Autosave failed:', err)
  }
}

async function clearAutosave(formKey) {
  try {
    await del(formKey, autosaveIdb)
  } catch (err) {
    console.warn('[useDraft] clearDraft failed:', err)
  }
}

// ── One-time migration from old localStorage autosave slots ──────────────────
// Uses a Promise rather than a boolean flag so concurrent mounts all await the
// same in-flight migration rather than each believing it's already done.
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

export function useDraft(formKey, d, step, photos = []) {
  // ── First-render guard ────────────────────────────────────────────────────
  // We skip the autosave on the very first render so we don't overwrite an
  // existing autosave slot with a freshly-initialised (possibly empty) form
  // state before the wizard has had a chance to restore a previous session.
  //
  // WHY NOT isMounted (two separate effects)?
  // React runs effects in declaration order within the same render cycle.
  // If Effect A sets isMounted.current = true and Effect B checks it, both
  // run during the first render — Effect B will always see true because
  // Effect A already ran.  A single ref that flips on first execution is the
  // correct pattern here.
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Skip on first call; allow all subsequent changes through
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    const timer = setTimeout(() => {
      writeAutosave(formKey, d, step, photos)
    }, AUTOSAVE_DEBOUNCE)

    // Cleanup cancels the debounce timer if the component unmounts or deps
    // change before the 600 ms window expires (e.g. rapid field edits).
    return () => clearTimeout(timer)
  }, [formKey, d, step, photos])

  const clearDraft = () => clearAutosave(formKey)

  return { clearDraft }
}
