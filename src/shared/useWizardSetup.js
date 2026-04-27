/**
 * useWizardSetup — shared setup hook for all wizards.
 *
 * Extracts the three patterns that are identical across every wizard:
 *   1. Save to job history when advancing past step 0
 *   2. pickerOpen state + loadJobHistory handler
 *   3. setD convenience setter
 *
 * Usage:
 *   const { pickerOpen, setPickerOpen, loadJobHistory, set } =
 *     useWizardSetup(d, setD, step, formType)
 *
 * Props:
 *   d         — wizard form state
 *   setD      — wizard state setter
 *   step      — current step
 *   formType  — e.g. '360S014EC' — saved into job history so picker can show it
 */
import { useState, useEffect, useRef } from 'react'
import { saveToHistory } from './jobHistory'

export function useWizardSetup(d, setD, step, formType) {
  const [pickerOpen, setPickerOpen] = useState(false)
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

  // Convenience field setter: set('fieldName')(value)
  const set = (k) => (v) => setD(p => ({ ...p, [k]: v }))

  return { pickerOpen, setPickerOpen, loadJobHistory, set }
}
