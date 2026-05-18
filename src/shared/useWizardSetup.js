/**
 * useWizardSetup — shared setup hook for all wizards.
 *
 * Extracts the three patterns that are identical across every wizard:
 *   1. Save to job history when advancing past step 0
 *   2. loadJobHistory handler
 *   3. setD convenience setter
 *
 * Usage:
 *   const { loadJobHistory, set } =
 *     useWizardSetup(d, setD, step, formType)
 *
 * Props:
 *   d         — wizard form state
 *   setD      — wizard state setter
 *   step      — current step
 *   formType  — e.g. '360S014EC' — saved into job history so picker can show it
 */
import { useEffect, useRef } from 'react'
import { saveToHistory } from './jobHistory'

export function useWizardSetup(d, setD, step, formType) {
  const prevStepRef = useRef(0)

  // Save to job history when user advances past step 0
  useEffect(() => {
    if (prevStepRef.current === 0 && step === 1) {
      saveToHistory({ ...d, formType })
    }
    prevStepRef.current = step
  }, [step])

  // Load a previous job into the form
  const loadJobHistory = (fields) => {
    setD(prev => ({ ...prev, ...fields }))
  }

  // Convenience field setter — supports both calling styles:
  //   Curried:  set('fieldName')(value)   — used as: set={set('fieldName')}
  //   Two-arg:  set('fieldName', value)   — used as: set={v => set('fieldName', v)}
  const set = (k, v) => {
    if (v !== undefined) {
      setD(p => ({ ...p, [k]: v }))
    } else {
      return (val) => setD(p => ({ ...p, [k]: val }))
    }
  }

  return { loadJobHistory, set }
}
