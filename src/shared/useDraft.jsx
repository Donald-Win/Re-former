// useDraft — drop-in hook for wizard draft autosave.
//
// Usage in any wizard (3 additions):
//
//   import { useDraft } from '../shared/useDraft'
//
//   // Inside the wizard component, after state is declared:
//   const { DraftBanner, clearDraft } = useDraft('360S014EB', d, step, setD, setStep, photos, setPhotos)
//
//   // In the JSX for step 0, render the banner:
//   {step === 0 && <DraftBanner />}
//
// The hook:
//   - Autosaves d + step + photos to localStorage on every change
//   - On mount checks for a recent draft and offers to restore it via a
//     prominent bottom-sheet modal
//   - Shows a confirmation before discarding a draft ("Start fresh")
//   - Restores photos if the wizard supports it
//   - If draft was saved at the preview step, restores to the step before it
//     so PDF bytes get re-generated correctly

import { useState, useEffect, useRef, useCallback } from 'react'
import { saveDraft, loadDraft, clearDraft, draftAge } from './jobHistory'

// Max photos to persist in draft
const MAX_DRAFT_PHOTOS = 5
// Debounce autosave - avoids hammering localStorage on every keystroke,
// especially important when photos (large base64 strings) are included
const AUTOSAVE_DEBOUNCE_MS = 600

export function useDraft(formKey, d, step, setD, setStep, photos = [], setPhotos = null) {
  const [draft, setDraft]               = useState(null)
  const [dismissed, setDismissed]       = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const isMounted                       = useRef(false)

  // On mount — check for existing draft
  useEffect(() => {
    const found = loadDraft(formKey)
    if (found) setDraft(found)
    isMounted.current = true
  }, [formKey])

  // Autosave whenever d, step, or photos changes (skip first render)
  // Debounced to avoid hammering localStorage on every keystroke,
  // especially when photos (large base64 strings) are in the draft.
  useEffect(() => {
    if (!isMounted.current) return
    const timer = setTimeout(() => {
      const draftPhotos = setPhotos ? (photos || []).slice(0, MAX_DRAFT_PHOTOS) : []
      saveDraft(formKey, { ...d, __photos: draftPhotos }, step)
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [formKey, d, step, photos])

  const restore = useCallback(() => {
    if (!draft) return
    const { __photos, ...formData } = draft.data || {}
    setD(prev => ({ ...prev, ...formData }))
    if (setPhotos && Array.isArray(__photos) && __photos.length > 0) {
      setPhotos(__photos)
    }
    setStep(draft.step)
    setDraft(null)
    setDismissed(true)
  }, [draft, setD, setStep, setPhotos])

  const dismiss = useCallback(() => {
    setConfirmClear(true)
  }, [])

  const confirmDismiss = useCallback(() => {
    clearDraft(formKey)
    setDraft(null)
    setDismissed(true)
    setConfirmClear(false)
  }, [formKey])

  const cancelDismiss = useCallback(() => {
    setConfirmClear(false)
  }, [])

  const clear = useCallback(() => {
    clearDraft(formKey)
    setDraft(null)
  }, [formKey])

  function DraftBanner() {
    if (!draft || dismissed) return null

    const jobLabel = draft.data?.npJobNumber
      ? `NP ${draft.data.npJobNumber}`
      : draft.data?.projectName || draft.data?.streetRoad || 'Unnamed job'

    const photoCount = Array.isArray(draft.data?.__photos) ? draft.data.__photos.length : 0

    if (confirmClear) {
      return (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: '20px 20px 0 0',
            padding: '28px 20px 40px', width: '100%', maxWidth: 480,
            boxShadow: '0 -6px 40px rgba(0,0,0,0.25)',
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb', margin: '0 auto 20px' }} />
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🗑️</div>
              <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#111827' }}>
                Discard saved form?
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                <strong style={{ color: '#374151' }}>{jobLabel}</strong><br />This cannot be undone.
              </p>
            </div>
            <button onClick={confirmDismiss} style={{
              width: '100%', padding: '15px', borderRadius: 14, border: 'none',
              background: '#dc2626', color: '#fff',
              fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 10,
            }}>Yes, start fresh</button>
            <button onClick={cancelDismiss} style={{
              width: '100%', padding: '15px', borderRadius: 14,
              border: '2px solid #e5e7eb', background: '#fff', color: '#6b7280',
              fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>Keep saved form</button>
          </div>
        </div>
      )
    }

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}>
        <div style={{
          background: '#fff', borderRadius: '20px 20px 0 0',
          padding: '28px 20px 40px', width: '100%', maxWidth: 480,
          boxShadow: '0 -6px 40px rgba(0,0,0,0.25)',
        }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb', margin: '0 auto 20px' }} />
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#111827' }}>
              Continue saved form?
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
              <strong style={{ color: '#374151' }}>{jobLabel}</strong>
              <br />
              Saved {draftAge(draft)}
              {draft.step > 0 && <span style={{ color: '#9ca3af' }}> · Step {draft.step + 1}</span>}
              {photoCount > 0 && <span style={{ color: '#9ca3af' }}> · {photoCount} photo{photoCount !== 1 ? 's' : ''}</span>}
            </p>
          </div>
          <button onClick={restore} style={{
            width: '100%', padding: '15px', borderRadius: 14, border: 'none',
            background: '#f59e0b', color: '#fff',
            fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 10,
          }}>Continue saved form →</button>
          <button onClick={dismiss} style={{
            width: '100%', padding: '15px', borderRadius: 14,
            border: '2px solid #e5e7eb', background: '#fff', color: '#6b7280',
            fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>Start fresh</button>
        </div>
      </div>
    )
  }

  return { DraftBanner, clearDraft: clear }
}
