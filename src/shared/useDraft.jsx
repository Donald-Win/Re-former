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
// Split autosave writes — text/step vs photos (v2.20.3)
// ─────────────────────────────────────────────────────
// `d` (form field state) and `photos` used to be written together as one
// object on every debounced autosave tick. Because `d` is a brand-new
// object on essentially every keystroke, this meant the (potentially
// several-megabyte) photos array was being re-serialised into IndexedDB
// every time the tech typed a character anywhere in the form — expensive
// for no reason, since the photos hadn't actually changed.
//
// Autosave now writes to two separate IndexedDB keys:
//   `<formKey>`         — { step, data, savedAt }   (small, written on every
//                          debounced change to `d` or `step`)
//   `<formKey>:photos`   — the photos array itself   (only rewritten when the
//                          photos array reference actually changes — i.e.
//                          a photo was added/removed/reordered, not on
//                          every keystroke elsewhere in the form)
// readAutosave() transparently merges both back into one snapshot for
// useCrashRecovery(), and also falls back to reading photos off the old
// combined shape (`main.photos`) for any autosave slot written before this
// split — including ones restored by the legacy localStorage migration
// below, which still writes the old combined shape.
//
// Two hooks, one storage backend:
//   useDraft(formKey, d, step, photos)
//     Call from every wizard — same call signature as before. Debounce-
//     writes the current form state and returns { clearDraft }. Every
//     wizard already calls clearDraft() (as `clearFormDraft`) after a
//     successful PDF share, which deletes the autosave slot so a
//     completed form never resurfaces as "unsaved progress" later.
//
//   useCrashRecovery({ formKey, setD, setStep, setPhotos, maxStep })
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

import { useEffect, useRef, useCallback, useState } from 'react'
import { createStore, get, set, del } from 'idb-keyval'

// Dedicated IndexedDB store for autosave slots (separate from named drafts)
const autosaveIdb = createStore('re-former-autosave', 'slots')

// Delay between the last change and the debounced autosave write. Applied
// independently to the text/step key and the photos key (see file header).
const AUTOSAVE_DEBOUNCE_MS = 1500

function photosKey(formKey) {
  return `${formKey}:photos`
}

async function clearAutosave(formKey) {
  try {
    await Promise.all([
      del(formKey, autosaveIdb),
      del(photosKey(formKey), autosaveIdb),
    ])
  } catch (err) {
    console.warn('[useDraft] clearDraft failed:', err)
  }
}

async function readAutosave(formKey) {
  try {
    const [main, photosEntry] = await Promise.all([
      get(formKey, autosaveIdb),
      get(photosKey(formKey), autosaveIdb),
    ])
    if (!main) return null
    // Backward compatibility: autosave snapshots written before the
    // text/photos split stored photos inline on the main object. Prefer
    // the new separate key when present, otherwise fall back to that.
    const photos = photosEntry || main.photos || []
    return { ...main, photos }
  } catch (err) {
    console.warn('[useDraft] Reading autosave failed:', err)
    return null
  }
}

async function writeAutosaveData(formKey, snapshot) {
  try {
    await set(formKey, snapshot, autosaveIdb)
  } catch (err) {
    console.warn('[useDraft] Autosave data write failed:', err)
  }
}

async function writeAutosavePhotos(formKey, photos) {
  try {
    await set(photosKey(formKey), photos, autosaveIdb)
  } catch (err) {
    console.warn('[useDraft] Autosave photos write failed:', err)
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
        // Written in the old combined shape (step/data/photos/savedAt all
        // on one object) — readAutosave()'s fallback picks up `photos` from
        // here automatically until this slot is next rewritten.
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
  // ── Text/step autosave ──────────────────────────────────────────────────
  // Fires on every debounced change to `d` or `step`. Deliberately depends
  // on `photos.length` (a primitive) rather than `photos` itself, so this
  // effect re-evaluates the "has the tech attached a photo yet" gate
  // without re-firing — and re-serialising the whole photos array — every
  // time a keystroke elsewhere produces a new `d` reference.
  useEffect(() => {
    // See "Meaningful progress" gate above.
    const hasProgress = step > 0 || photos.length > 0
    if (!hasProgress) return

    const timer = setTimeout(() => {
      writeAutosaveData(formKey, {
        step,
        data: d,
        savedAt: new Date().toISOString(),
      })
    }, AUTOSAVE_DEBOUNCE_MS)

    return () => clearTimeout(timer)
    // d is a whole object recreated on most keystrokes in these wizards
    // (see setD's spread pattern), so this effect re-arms the debounce
    // timer on essentially every meaningful change — which is the intended
    // behaviour for a "save shortly after the tech stops typing" autosave.
  }, [formKey, d, step, photos.length])

  // ── Photos autosave — separate debounce ─────────────────────────────────
  // Only re-fires when the photos array reference actually changes (a
  // photo was added, removed, or reordered), never as a side effect of
  // typing in an unrelated text field.
  useEffect(() => {
    const hasProgress = step > 0 || photos.length > 0
    if (!hasProgress) return

    const timer = setTimeout(() => {
      writeAutosavePhotos(formKey, photos)
    }, AUTOSAVE_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [formKey, photos, step])

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
 * Restoring does NOT delete the autosave slot — useDraft's write effects
 * simply resume autosaving over the top of it as the tech keeps working.
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
 * `maxStep` as a function of the snapshot's data (v2.20.4)
 * ───────────────────────────────────────────────────────────
 * Most wizards have a fixed step count, so a plain number works fine. But
 * HVInspectionWizard's step count is DYNAMIC — it depends on how many
 * equipment types are selected (`d.selectedEquip`), which only exists
 * inside the autosaved snapshot itself until restore() merges it into live
 * state. Passing a plain number computed from the wizard's CURRENT
 * (pre-restore) state — e.g. always `[]` on a fresh mount — clamped every
 * restore to the same wrong step regardless of how far the tech had
 * actually progressed in that specific snapshot.
 *
 * `maxStep` may now also be a function: `(snapshotData) => number`. It
 * receives the snapshot's own `data` object (the same object about to be
 * merged into `d`), so a wizard whose step count depends on stored
 * selections can compute the correct ceiling from the snapshot being
 * restored, not from whatever the wizard's state happens to be at mount.
 *
 * @param {object}   args
 * @param {string}   args.formKey   - e.g. '360S014EC'
 * @param {function} args.setD      - wizard's setD state setter
 * @param {function} args.setStep   - wizard's setStep state setter
 * @param {function} args.setPhotos - wizard's setPhotos state setter
 * @param {number|function} [args.maxStep] - highest step index safe to
 *                                    restore onto: either a fixed number,
 *                                    or a function `(snapshotData) => number`
 *                                    for wizards whose step count depends on
 *                                    data stored in the snapshot itself
 *                                    (defaults to no clamp if omitted)
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
      // Resolve maxStep against the SNAPSHOT's own data (not the wizard's
      // current, pre-restore state) — see the doc comment above for why
      // this matters for wizards with a data-dependent step count.
      const resolvedMaxStep = typeof maxStep === 'function'
        ? maxStep(snapshot.data || {})
        : maxStep
      const clamped = typeof resolvedMaxStep === 'number'
        ? Math.min(snapshot.step, resolvedMaxStep)
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
