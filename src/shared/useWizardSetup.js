/**
 * useWizardSetup — shared setup hook for all wizards.
 *
 * Provides:
 *   1. setD convenience setter
 *   2. DEV-only test-data fill handler
 *
 * Usage:
 *   const { set, handleDevFill } = useWizardSetup(d, setD, step, formType)
 *
 * Bug fix — "ALL OPTIONS" fill mode was never actually wired up
 * ────────────────────────────────────────────────────────────────────────
 * WizardShell owns the 🧪/🔬 fill-mode toggle (see WizardShell.jsx's
 * `fillMode` state and `handleFillToggle`). On every tap it calls
 * `onFillTestData(true)` when switching INTO "show every option at once"
 * mode, and `onFillTestData(false)` when switching back to realistic data.
 *
 * `handleDevFill` below is what's passed in as `onFillTestData`. It
 * previously ignored that argument completely and always called
 * `setD(devFillState)` — the realistic, "one value per field" fill. That
 * meant tapping the button into 🔬 "ALL OPTIONS" mode changed the button's
 * own icon/label (WizardShell tracks that independently) but had NO effect
 * on the actual PDF: every mutually-exclusive checkbox/ellipse group still
 * only showed its one realistic selection, and every text field still
 * showed its one realistic value — instead of every conflicting option
 * being ticked at once and every text field showing its own field name, as
 * devFillStateAllOptions (see devFillState.js) is designed to do.
 *
 * `handleDevFill` now takes the boolean WizardShell already sends and
 * routes to the correct fill function:
 *   handleDevFill(true)   → devFillStateAllOptions — ticks EVERY checkbox/
 *                           ellipse regardless of conflicts (e.g. every pole
 *                           activity option, every enclosure type, every tap
 *                           setting all ticked simultaneously), and every
 *                           text field prints its own field name at its
 *                           position — built specifically for spotting
 *                           misaligned fields on the printed PDF.
 *   handleDevFill(false)  → devFillState — one plausible, realistic value
 *                           per field, for a normal-looking test PDF.
 *
 * History note (v2.18.3) — job history write path removed
 * ─────────────────────────────────────────────────────────
 * This hook used to also snapshot the form into a "recent jobs" history
 * (jobHistory.js) every time the user advanced past step 0, and expose a
 * `loadJobHistory` setter to load one back in. No wizard ever called
 * `loadJobHistory` or displayed the saved history — ProjectPicker.jsx
 * superseded this as the actual "load previous job details" UI back in
 * v2.12.0 — so every job was silently writing to localStorage for a
 * feature with no UI. That write path (and the now-unused jobHistory.js
 * module) has been removed.
 *
 * `step` and `formType` are kept as accepted parameters — rather than
 * changing every wizard's call site — in case a real "recent jobs" picker
 * is built later and this is the natural place to reintroduce the save.
 *
 * Props:
 *   d         — wizard form state (accepted, unused — see history note)
 *   setD      — wizard state setter
 *   step      — current step (accepted, unused — see history note)
 *   formType  — e.g. '360S014EC' (accepted, unused — see history note)
 */
import { useCallback } from 'react'
import { devFillState, devFillStateAllOptions } from './devFillState'

export function useWizardSetup(d, setD, step, formType) {
  // Convenience field setter — supports both calling styles:
  //   Curried:  set('fieldName')(value)   — used as onChange prop
  //   Two-arg:  set('fieldName', value)   — used inline
  //
  // useCallback gives callers a stable reference.  The function itself
  // uses `setD` (a React state setter, which is always stable) so this
  // callback only needs to be recreated if `setD` changes — which never
  // happens in practice.
  const set = useCallback((k, v) => {
    if (v !== undefined) {
      setD(p => ({ ...p, [k]: v }))
    } else {
      return (val) => setD(p => ({ ...p, [k]: val }))
    }
  }, [setD])

  // DEV-only — dead-code eliminated by Vite/Rollup in production builds.
  // `allOptions` is the boolean WizardShell's 🧪/🔬 toggle sends: true while
  // in "show every option at once" mode, false in normal realistic-fill mode.
  const handleDevFill = import.meta.env.DEV
    ? (allOptions) => setD(allOptions ? devFillStateAllOptions : devFillState)
    : undefined

  return { set, handleDevFill }
}
