// useDraft — wizard autosave & crash-recovery hook.
//
// Reinstated (v2.20.0)
// ─────────────────────
// v2.18.3 removed the debounced autosave write because nothing in the app
// ever read it back — every keystroke was silently writing a full form
// snapshot (including photos) to IndexedDB for a feature with no UI built
// on top of it. That write path is reinstated here, together with the
// missing read/restore half that makes it worth having: useCrashRecovery()
// checks, on mount, whether an autosave snapshot exists for the current
// wizard, and — if the tech made meaningful progress before the tab or app
// closed unexpectedly — hands back everything <CrashRecoveryBanner>
// (src/shared/CrashRecoveryBanner.jsx) needs to offer restoring it.
//
// This autosave slot is intentionally separate from the named-draft system
// (DraftPicker.jsx / draftStore.js). Named drafts are an explicit "save
// this so I can load it again later" action the tech takes on purpose;
// this autosave slot exists purely so an accidental close/crash doesn't
// lose work the tech never got a chance to save on purpose.
//
// Two hooks, one storage backend:
//   useDraft(formKey, d, step, photos)
//     Call from every wizard — same call signature as before. Debounce-
//     writes the current form state and returns { clearDraft }. Every
//     wizard already calls clearDraft() (as `clearFormDraft`) after a
//     successful PDF share, which deletes the autosave slot so a
//     completed form never resurfaces as "unsaved progress" later.
//
//   useCrashRecovery({ formKey, setD, setStep, setPhotos })
//     Call once per wizard, alongside useDraft. Reads any existing
//     autosave slot on mount and exposes { available, step, photos,
//     savedAt, restore, discard } for <CrashRecoveryBanner> to render.
//
// "Meaningful progress" gate
// ───────────────────────────
// Autosave only writes once the tech has moved past step 0 OR attached a
// photo. A wizard that's opened and immediately closed on the Job Details
// screen has nothing worth recovering, so skipping the write there means
// that no-op case never produces a recovery prompt on the next visit.
//
// Storage backend: IndexedDB via idb-keyval — the same 're-former-autosave'
// store used before the write path was disabled, plus the one-time
// legacy-localStorage migration below (unchanged).

import { useState, useEffect, useRef, useCallback } from 'react'
import { createStore, get, set, del } from 'idb-keyval'

// Dedicated IndexedDB store for autosave slots (separate from named drafts)
const autosaveIdb = createStore('re-former-autosave', 'slots')

// Delay between the last form-state change and the debounced autosave write.
const AUTOSAVE_DEBOUNCE_MS = 1500

async function clearAutosave(formKey) {
  try {
    await del(formKey, autosaveIdb)
  } catch (err) {
    console.warn('[useDraft] clearDraft failed:', err)
  }
}

async function readAutosave(formKey) {
  try {
    return (await get(formKey, autosaveIdb)) || null
  } catch (err) {
    console.warn('[useDraft] Reading autosave failed:', err)
    return null
  }
}

async function writeAutosave(formKey, snapshot) {
  try {
    await set(formKey, snapshot, autosaveIdb)
  } catch (err) {
    console.warn('[useDraft] Autosave write failed:', err)
  }
}

// ── One-time migration from old localStorage autosave slots ──────────────────
// Retained from the pre-2.13 localStorage era: a handful of devices may
// still be carrying old 're-former-autosave-<formKey>' localStorage keys,
// and clearing those out is worth doing regardless of whether this
// particular IndexedDB copy ever gets restored. Uses a Promise rather than
// a boolean flag so concurrent mounts all await the same in-flight
// migration.
const KNOWN_FORM_KEYS = [
  '360S014EC', '360S014EG', '360S014EE',
  '360S014EA', '360S014EB', '360S014ED',
  '360S014EF', '220F028A', '220F028B',
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

// ── useDraft — debounced autosave write + clearDraft ──────────────────────────

/**
 * @param {string} formKey - e.g. '360S014EC'
 * @param {object} d        - current wizard form state
 * @param {number} step     - current wizard step
 * @param {Array}  photos   - current photos
 * @returns {{ clearDraft: function }}
 */
export function useDraft(formKey, d, step, photos = []) {
  useEffect(() => {
    // See "Meaningful progress" gate above.
    const hasProgress = step > 0 || (photos && photos.length > 0)
    if (!hasProgress) return

    const timer = setTimeout(() => {
      writeAutosave(formKey, {
        step,
        data: d,
        photos,
        savedAt: new Date().toISOString(),
      })
    }, AUTOSAVE_DEBOUNCE_MS)

    return () => clearTimeout(timer)
    // d and photos are whole objects/arrays recreated on most keystrokes in
    // these wizards (see setD's spread pattern), so this effect re-arms the
    // debounce timer on essentially every meaningful change — which is the
    // intended behaviour for a "save shortly after the tech stops typing"
    // autosave.
  }, [formKey, d, step, photos])

  const clearDraft = useCallback(() => clearAutosave(formKey), [formKey])

  return { clearDraft }
}

// ── useCrashRecovery — mount-time check + restore/discard for the banner ─────

/**
 * Checks, once on mount, whether an autosave snapshot exists for this
 * wizard. If one is found, exposes everything <CrashRecoveryBanner> needs
 * to offer the tech a choice: restore it into the wizard's live state, or
 * discard it and start fresh.
 *
 * Restoring does NOT delete the autosave slot — useDraft's write effect
 * simply resumes autosaving over the top of it as the tech keeps working.
 * Discarding does delete it, so the prompt doesn't reappear.
 *
 * maxStep — the "Preview & Print" bug (v2.20.1)
 * ───────────────────────────────────────────────
 * The Preview step doesn't hold any of its own data — it only shows a
 * generated PDF, produced by an explicit triggerGenerate(d, photos) call
 * that every wizard makes from its own "Preview Form →" / dot-navigation
 * handlers. If the autosaved snapshot's step happened to be that exact
 * Preview step (e.g. the tech left the app open on the preview screen
 * before it got interrupted), restoring it verbatim would land back on
 * the preview overlay WITHOUT ever calling triggerGenerate — pdfBytes
 * stays null, so the screen renders completely blank (no spinner, no
 * error, nothing) until the tech backs out and re-enters normally.
 *
 * `maxStep`, if provided, is the highest step index restore() is allowed
 * to land on — pass the index of the wizard's LAST DATA STEP (in every
 * current wizard this is the "Photos" step, i.e. `STEPS.length - 2`).
 * restore() clamps snapshot.step to this value, so a snapshot saved on
 * the Preview step lands back on Photos instead — one tap of "Preview
 * Form →" away from a correctly generated PDF, instead of a dead end.
 *
 * @param {object}   args
 * @param {string}   args.formKey   - e.g. '360S014EC'
 * @param {function} args.setD      - wizard's setD state setter
 * @param {function} args.setStep   - wizard's setStep state setter
 * @param {function} args.setPhotos - wizard's setPhotos state setter
 * @param {number}   [args.maxStep] - highest step index safe to restore onto
 *                                    (defaults to no clamp for callers that
 *                                    don't pass one)
 * @returns {{available: boolean, step: number, photos: Array, savedAt: (string|undefined), restore: function, discard: function}}
 */
export function useCrashRecovery({ formKey, setD, setStep, setPhotos, maxStep }) {
  const [snapshot, setSnapshot] = useState(null)
  const resolvedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    readAutosave(formKey).then(found => {
      if (cancelled) return
      resolvedRef.current = true
      if (found) setSnapshot(found)
    })
    return () => { cancelled = true }
    // Intentionally runs once per mount — formKey is constant for the
    // lifetime of a given wizard instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const restore = useCallback(() => {
    if (!snapshot) return
    setD(prev => ({ ...prev, ...(snapshot.data || {}) }))
    if (typeof snapshot.step === 'number') {
      const clamped = typeof maxStep === 'number'
        ? Math.min(snapshot.step, maxStep)
        : snapshot.step
      setStep(clamped)
    }
    if (Array.isArray(snapshot.photos) && snapshot.photos.length > 0) setPhotos(snapshot.photos)
    setSnapshot(null)
  }, [snapshot, setD, setStep, setPhotos, maxStep])

  const discard = useCallback(() => {
    clearAutosave(formKey)
    setSnapshot(null)
  }, [formKey])

  return {
    available: !!snapshot,
    step:      snapshot?.step ?? 0,
    photos:    snapshot?.photos ?? [],
    savedAt:   snapshot?.savedAt,
    restore,
    discard,
  }
}
