/**
 * useDraftPicker — manages DraftPicker open/mode state and the draft-load
 * handler for all wizard components.
 *
 * Replaces three repeated boilerplate patterns found in every wizard:
 *   1. const [draftPickerOpen, setDraftPickerOpen] = useState(false)
 *   2. const [draftPickerMode, setDraftPickerMode] = useState('menu')
 *   3. const handleDraftLoad = (draft) => { ... }
 *
 * Usage:
 *   const { draftPickerProps, openSave, openLoad } = useDraftPicker({
 *     setD, setPhotos, setStep,
 *     formKey:   '360S014EB',
 *     formLabel: 'Elec Distribution Record',
 *     d, step, photos, accent,
 *   })
 *
 *   // Wire into WizardShell nav bar:
 *   onSaveDraft={openSave}
 *
 *   // Wire into JobDetailsStep:
 *   onOpenDrafts={openLoad}
 *
 *   // Render at the bottom of the wizard return:
 *   <DraftPicker {...draftPickerProps} />
 *
 * openSave / openLoad are stable (useCallback with no deps) because they
 * only close over stable React setState functions — safe to pass as props
 * without causing unnecessary child re-renders.
 */
import { useState, useCallback } from 'react'

export function useDraftPicker({
  setD,
  setPhotos,
  setStep,
  formKey,
  formLabel,
  d,
  step,
  photos,
  accent,
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('menu')

  const openSave = useCallback(() => { setMode('save'); setOpen(true) }, [])
  const openLoad = useCallback(() => { setMode('list'); setOpen(true) }, [])
  const close    = useCallback(() => setOpen(false), [])

  // Identical to the handleDraftLoad found in every wizard — centralised here.
  const handleLoad = useCallback((draft) => {
    const { photos: _, ...formData } = draft.data || {}
    setD(prev => ({ ...prev, ...formData }))
    if (Array.isArray(draft.photos) && draft.photos.length > 0) setPhotos(draft.photos)
    setStep(draft.step || 0)
  }, [setD, setPhotos, setStep])

  // Pre-assembled props — spread directly onto <DraftPicker>.
  // d, step, photos are current render values so DraftPicker always sees
  // up-to-date form state when the save sheet opens.
  const draftPickerProps = {
    open,
    onClose:     close,
    formKey,
    formLabel,
    d,
    step,
    photos,
    onLoad:      handleLoad,
    accent,
    initialMode: mode,
  }

  return { draftPickerProps, openSave, openLoad }
}
