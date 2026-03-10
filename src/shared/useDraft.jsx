// useDraft — drop-in hook for wizard draft autosave.
//
// Usage in any wizard (3 additions):
//
//   import { useDraft } from '../shared/useDraft'
//
//   // Inside the wizard component, after state is declared:
//   const { DraftBanner } = useDraft('360S014EB', d, step, setD, setStep)
//
//   // In the JSX, render the banner at the top of step 0:
//   {step === 0 && <DraftBanner />}
//
// The hook:
//   - Autosaves d + step to localStorage on every change
//   - On mount checks for a recent draft and offers to restore it
//   - Clears the draft when the wizard closes or PDF is shared
//   - DraftBanner renders nothing if no draft exists

import { useState, useEffect, useRef, useCallback } from 'react'
import { saveDraft, loadDraft, clearDraft, draftAge } from './jobHistory'

export function useDraft(formKey, d, step, setD, setStep) {
  const [draft, setDraft]           = useState(null)
  const [dismissed, setDismissed]   = useState(false)
  const isMounted                   = useRef(false)

  // On mount — check for existing draft
  useEffect(() => {
    const found = loadDraft(formKey)
    if (found) setDraft(found)
    isMounted.current = true
  }, [formKey])

  // Autosave whenever d or step changes (skip first render)
  useEffect(() => {
    if (!isMounted.current) return
    saveDraft(formKey, d, step)
  }, [formKey, d, step])

  const restore = useCallback(() => {
    if (!draft) return
    setD(prev => ({ ...prev, ...draft.data }))
    setStep(draft.step)
    setDraft(null)
    setDismissed(true)
  }, [draft, setD, setStep])

  const dismiss = useCallback(() => {
    clearDraft(formKey)
    setDraft(null)
    setDismissed(true)
  }, [formKey])

  // Call this after successful PDF generation to wipe the draft
  const clear = useCallback(() => {
    clearDraft(formKey)
    setDraft(null)
  }, [formKey])

  function DraftBanner() {
    if (!draft || dismissed) return null
    return (
      <div style={{
        background: '#fffbeb',
        border: '2px solid #f59e0b',
        borderRadius: 10,
        padding: '10px 14px',
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>📋</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>
            Unsaved draft found
          </div>
          <div style={{ fontSize: 11, color: '#b45309', marginTop: 1 }}>
            {draft.data.npJobNumber
              ? `NP ${draft.data.npJobNumber}`
              : draft.data.projectName || draft.data.streetRoad || 'Unnamed job'}
            {' · '}saved {draftAge(draft)}
          </div>
        </div>
        <button
          onClick={restore}
          style={{
            background: '#f59e0b', color: '#fff',
            border: 'none', borderRadius: 7,
            padding: '6px 12px', fontWeight: 700,
            fontSize: 12, cursor: 'pointer', flexShrink: 0,
          }}
        >
          Restore
        </button>
        <button
          onClick={dismiss}
          style={{
            background: '#fef3c7', color: '#92400e',
            border: 'none', borderRadius: 7,
            padding: '6px 10px', fontWeight: 600,
            fontSize: 12, cursor: 'pointer', flexShrink: 0,
          }}
        >
          Discard
        </button>
      </div>
    )
  }

  return { DraftBanner, clearDraft: clear }
}
