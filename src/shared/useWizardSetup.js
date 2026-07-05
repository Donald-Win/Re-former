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
import { devFillState } from './devFillState'

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

  // DEV-only — dead-code eliminated by Vite/Rollup in production builds
  const handleDevFill = import.meta.env.DEV
    ? () => setD(devFillState)
    : undefined

  return { set, handleDevFill }
}
