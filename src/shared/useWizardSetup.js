/**
 * useWizardSetup — shared setup hook for all wizards.
 *
 * Extracts four patterns that are identical across every wizard:
 *   1. Save to job history when advancing past step 0
 *   2. loadJobHistory handler
 *   3. setD convenience setter
 *   4. handleDevFill — DEV-only 🧪 button handler. Fills the form with
 *      either realistic dummy data or a "show every option at once"
 *      calibration fill (see devFillState.js) depending on the boolean
 *      WizardShell passes in; every wizard gets both for free from this one
 *      hook, with WizardShell owning (and showing) which mode is active.
 *
 * Usage:
 *   const { loadJobHistory, set, handleDevFill } =
 *     useWizardSetup(d, setD, step, formType)
 *
 *   // handleDevFill takes the mode WizardShell is currently in:
 *   <WizardShell onFillTestData={handleDevFill} ...>
 *
 * Props:
 *   d         — wizard form state
 *   setD      — wizard state setter
 *   step      — current step
 *   formType  — e.g. '360S014EC' — saved into job history so picker can show it
 *
 * Fixes vs. original
 * ──────────────────
 * 1. The useEffect previously had `[step]` as its dependency array, which
 *    suppressed the ESLint exhaustive-deps warning but meant the effect
 *    closed over the initial value of `d` forever — if the user edited fields
 *    before advancing, saveToHistory received a stale snapshot.  We now
 *    include `d` and `formType` in deps.  `prevStepRef` lets us detect the
 *    0→1 transition without re-running on every step change.
 *
 * 2. `loadJobHistory` and `set` are wrapped in useCallback so wizards that
 *    pass them down as props (e.g. to JobDetailsStep or WCB) don't trigger
 *    unnecessary child re-renders on every parent render.
 */
import { useEffect, useRef, useCallback } from 'react'
import { saveToHistory } from './jobHistory'
import { devFillState, devFillStateAllOptions } from './devFillState'

export function useWizardSetup(d, setD, step, formType) {
  const prevStepRef = useRef(0)

  // Save to job history when user advances past step 0.
  // Both `d` and `formType` are included in deps so saveToHistory always
  // receives the current form values, not a stale closure snapshot.
  useEffect(() => {
    if (prevStepRef.current === 0 && step === 1) {
      saveToHistory({ ...d, formType })
    }
    prevStepRef.current = step
  }, [step, d, formType])

  // Load a previous job into the form.
  // useCallback gives callers a stable reference — safe to pass as a prop.
  const loadJobHistory = useCallback((fields) => {
    setD(prev => ({ ...prev, ...fields }))
  }, [setD])

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
  // `allOptions` is supplied by WizardShell, which owns the current mode
  // (and shows it on the button) — this hook just applies whichever fill
  // was asked for:
  //   allOptions=true  → devFillStateAllOptions (every "1 of N" option
  //                       ticked at once, every text field shows its own
  //                       key — see devFillState.js and the
  //                       calibration-mode section of pdfFieldRenderer.js)
  //   allOptions=false → devFillState (one realistic value per field)
  const handleDevFill = import.meta.env.DEV
    ? (allOptions) => setD(allOptions ? devFillStateAllOptions : devFillState)
    : undefined

  return { loadJobHistory, set, handleDevFill }
}

