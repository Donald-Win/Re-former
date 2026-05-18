// useDraft — wizard autosave hook.
//
// Autosaves form state on every change (debounced, 600ms).
// No automatic restore prompt. Loading is purely manual via DraftPicker.
//
// Usage:
//   const { clearDraft } = useDraft(formKey, d, step, photos)
//
//   // clearDraft() — call after successful PDF share to wipe the autosave slot

import { useEffect, useRef } from 'react'
import { saveDraft } from './draftStore'

const AUTOSAVE_KEY      = 're-former-autosave-'
const AUTOSAVE_DEBOUNCE = 600
const MAX_PHOTOS        = 5

// Autosave uses a separate lightweight slot (not the named draft store)
// so it doesn't pollute the user's named draft list
function writeAutosave(formKey, d, step, photos) {
  try {
    const cleanData = Object.fromEntries(
      Object.entries(d || {}).filter(([k]) => k !== 'signed')
    )
    const payload = {
      savedAt: Date.now(),
      step,
      data: cleanData,
      photos: (photos || []).slice(0, MAX_PHOTOS),
    }
    localStorage.setItem(AUTOSAVE_KEY + formKey, JSON.stringify(payload))
  } catch { /* storage full - skip */ }
}

function clearAutosave(formKey) {
  try { localStorage.removeItem(AUTOSAVE_KEY + formKey) } catch {}
}

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
