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
const MAX_PHOTOS        = 5

function stripSignature(data) {
  return Object.fromEntries(
    Object.entries(data || {}).filter(([k]) => k !== 'signed')
  )
}

async function writeAutosave(formKey, d, step, photos) {
  try {
    const payload = {
      savedAt: Date.now(),
      step,
      data:    stripSignature(d),
      photos:  (photos || []).slice(0, MAX_PHOTOS),
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
// Any existing "re-former-autosave-<formKey>" localStorage entries are moved
// into IndexedDB then removed.  We only do this for known form keys.
const KNOWN_FORM_KEYS = [
  '360S014EC', '360S014EG', '360S014EE',
  '360S014EA', '360S014EB', '360S014ED',
  '360S014EF', '220F028A',
]
let _autoMigrated = false
async function migrateAutosaveSlots() {
  if (_autoMigrated) return
  _autoMigrated = true
  const OLD_PREFIX = 're-former-autosave-'
  for (const formKey of KNOWN_FORM_KEYS) {
    try {
      const raw = localStorage.getItem(OLD_PREFIX + formKey)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const existing = await get(formKey, autosaveIdb)
      if (!existing) {
        // Only migrate if slot photos would still fit (they won't have photos
        // in old format, so it's safe to always migrate)
        await set(formKey, parsed, autosaveIdb)
      }
      localStorage.removeItem(OLD_PREFIX + formKey)
    } catch (_) {}
  }
}

// Kick off on module load
migrateAutosaveSlots()

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDraft(formKey, d, step, photos = []) {
  const isMounted = useRef(false)

  useEffect(() => {
    isMounted.current = true
  }, [])

  // Autosave on every change, debounced
  useEffect(() => {
    if (!isMounted.current) return
    const timer = setTimeout(() => {
      writeAutosave(formKey, d, step, photos)
    }, AUTOSAVE_DEBOUNCE)
    return () => clearTimeout(timer)
  }, [formKey, d, step, photos])

  const clearDraft = () => clearAutosave(formKey)

  return { clearDraft }
}
