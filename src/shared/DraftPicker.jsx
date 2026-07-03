/**
 * DraftPicker — bottom-sheet for managing named drafts for a wizard.
 *
 * Modes:
 *   'menu'   — Save current form / Load a saved draft
 *   'save'   — Name and save the current form state
 *   'list'   — List of saved drafts with load and delete
 *
 * Props:
 *   open       bool
 *   onClose    fn()
 *   formKey    string     — e.g. '360S014EC'
 *   formLabel  string     — e.g. 'Pole Record'
 *   d          object     — current wizard form state
 *   step       number     — current wizard step
 *   photos     array      — current photos
 *   onLoad     fn(draft)  — called with draft to restore
 *   accent     string
 *   initialMode string   — 'menu' | 'save' | 'list'
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { Save, FolderOpen, Trash2, X, ChevronRight, Check } from 'lucide-react'
import { listDrafts, saveDraft, deleteDraft, draftLabel, draftSub, draftAge } from './draftStore'
import { APP_ACCENT } from './constants'
import { wInp, wLbl } from './WizardInputs'

export function DraftPicker({
  open,
  onClose,
  formKey,
  formLabel = 'Form',
  d,
  step,
  photos = [],
  onLoad,
  accent = APP_ACCENT,
  initialMode = 'menu',
}) {
  const [mode, setMode]             = useState('menu')
  const [drafts, setDrafts]         = useState([])
  const [draftsLoading, setDraftsLoading] = useState(false)
  const [name, setName]             = useState('')
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const closeTimerRef = useRef(null)

  // Clear the auto-close timer if the component unmounts while it is counting down
  useEffect(() => {
    return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current) }
  }, [])

  // Load drafts from IndexedDB
  const refreshDrafts = useCallback(async () => {
    setDraftsLoading(true)
    try {
      const all = await listDrafts(formKey)
      setDrafts(all)
    } catch (err) {
      console.error('[DraftPicker] Failed to load drafts:', err)
      setDrafts([])
    } finally {
      setDraftsLoading(false)
    }
  }, [formKey])

  useEffect(() => {
    if (open) {
      setMode(initialMode)
      setSaved(false)
      setConfirmDelete(null)
      refreshDrafts()

      // Pre-fill name from job details if available
      const suggested = [d?.npJobNumber, d?.projectName, d?.streetRoad]
        .filter(Boolean).join(' — ')
      setName(suggested || '')
    }
  }, [open, formKey, initialMode]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveDraft({ formKey, name, step, data: d, photos })
      await refreshDrafts()
      setSaved(true)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      closeTimerRef.current = setTimeout(() => { setSaved(false); onClose() }, 900)
    } catch (err) {
      console.error('[DraftPicker] Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleLoad = (draft) => {
    onLoad(draft)
    onClose()
  }

  const handleDelete = async (id) => {
    try {
      await deleteDraft(id)
      await refreshDrafts()
    } catch (err) {
      console.error('[DraftPicker] Delete failed:', err)
    }
    setConfirmDelete(null)
  }

  // Shared sheet layout
  const sheetContainer = {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401,
    background: '#fff', borderRadius: '20px 20px 0 0',
    boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
    maxHeight: '85vh', display: 'flex', flexDirection: 'column',
  }

  const renderHeader = (title, onBack) => (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 18px 8px', gap: 10 }}>
        {onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6b7280', padding: '0 4px 0 0' }}>←</button>
        )}
        <span style={{ fontWeight: 700, fontSize: 17, color: '#111827', flex: 1 }}>{title}</span>
        <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}>
          <X size={18} color="#666" />
        </button>
      </div>
      <div style={{ height: 1, background: '#f0f0f0', margin: '0 18px' }} />
    </>
  )

  // ── Menu ──────────────────────────────────────────────────────────────────
  if (mode === 'menu') return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400 }} />
      <div style={sheetContainer}>
        {renderHeader(`${formLabel} Drafts`)}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 18px 32px' }}>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 20 }}>
            Save your progress to come back later, or load a previously saved draft.
          </p>

          {/* Save current */}
          <button onClick={() => setMode('save')} style={{
            width: '100%', padding: '16px', borderRadius: 14, marginBottom: 12,
            border: `2px solid ${accent}`, background: accent + '12',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
            fontFamily: 'inherit', textAlign: 'left',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Save size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: accent }}>Save Current Form</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Name and save progress to load later</div>
            </div>
          </button>

          {/* Load saved */}
          <button onClick={() => setMode('list')} style={{
            width: '100%', padding: '16px', borderRadius: 14,
            border: '2px solid #e5e7eb', background: '#f9fafb',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
            fontFamily: 'inherit', textAlign: 'left',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FolderOpen size={20} color="#6b7280" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#374151' }}>Load Saved Draft</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {draftsLoading
                  ? 'Loading…'
                  : drafts.length === 0
                    ? 'No saved drafts yet'
                    : `${drafts.length} saved draft${drafts.length !== 1 ? 's' : ''}`}
              </div>
            </div>
          </button>
        </div>
      </div>
    </>
  )

  // ── Save form ─────────────────────────────────────────────────────────────
  if (mode === 'save') return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400 }} />
      <div style={sheetContainer}>
        {renderHeader('Save Draft', () => setMode('menu'))}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 18px 32px' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={wLbl}>Draft Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Pyes Pa Pole - TC1234567"
              style={{ ...wInp, borderColor: name ? accent : '#ddd' }}
            />
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 5 }}>
              Give it a name you'll recognise when you come back to it.
            </div>
          </div>

          {photos.length > 0 && (
            <div style={{ background: accent + '10', border: `1px solid ${accent}30`, borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: accent }}>
              📷 {photos.length} photo{photos.length !== 1 ? 's' : ''} will be saved with this draft
            </div>
          )}

          {step > 0 && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#166534' }}>
              ✓ Progress saved to Step {step + 1}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            style={{
              width: '100%', padding: '15px', borderRadius: 14, border: 'none',
              background: saved ? '#16a34a' : name.trim() ? accent : '#d1d5db',
              color: '#fff', fontFamily: 'inherit', fontSize: 16,
              fontWeight: 700, cursor: name.trim() && !saving ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.2s',
            }}
          >
            {saved ? <><Check size={20} /> Saved!</> : saving ? 'Saving…' : 'Save Draft'}
          </button>
        </div>
      </div>
    </>
  )

  // ── Draft list ────────────────────────────────────────────────────────────
  if (mode === 'list') return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400 }} />
      <div style={sheetContainer}>
        {renderHeader('Saved Drafts', () => setMode('menu'))}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 18px 32px' }}>
          {draftsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 14 }}>Loading drafts…</div>
            </div>
          ) : drafts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              <FolderOpen size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
              <div style={{ fontSize: 14 }}>No saved drafts yet.</div>
              <button onClick={() => setMode('save')} style={{
                marginTop: 16, padding: '10px 20px', borderRadius: 10,
                border: `2px solid ${accent}`, background: accent + '12',
                color: accent, fontFamily: 'inherit', fontSize: 14,
                fontWeight: 600, cursor: 'pointer',
              }}>Save current form</button>
            </div>
          ) : (
            drafts.map(draft => (
              <div key={draft.id} style={{
                border: '1px solid #f0f0f0', borderRadius: 12,
                marginBottom: 10, overflow: 'hidden', background: '#fff',
              }}>
                {confirmDelete === draft.id ? (
                  <div style={{ padding: '14px 16px', background: '#fef2f2' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 10 }}>
                      Delete "{draftLabel(draft)}"?
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleDelete(draft.id)} style={{
                        flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                        background: '#dc2626', color: '#fff', fontFamily: 'inherit',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      }}>Delete</button>
                      <button onClick={() => setConfirmDelete(null)} style={{
                        flex: 1, padding: '9px 0', borderRadius: 8,
                        border: '1px solid #e5e7eb', background: '#fff',
                        color: '#6b7280', fontFamily: 'inherit',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button onClick={() => handleLoad(draft)} style={{
                      flex: 1, padding: '14px 16px', background: 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                        {draftLabel(draft)}
                      </div>
                      {draftSub(draft) && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                          {draftSub(draft)}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        {draftAge(draft)}
                        {draft.step > 0 && ` · Step ${draft.step + 1}`}
                        {draft.photos?.length > 0 && ` · ${draft.photos.length} photo${draft.photos.length !== 1 ? 's' : ''}`}
                      </div>
                    </button>
                    <button onClick={() => setConfirmDelete(draft.id)} style={{
                      padding: '14px 14px', background: 'transparent',
                      border: 'none', borderLeft: '1px solid #f0f0f0',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                    }}>
                      <Trash2 size={16} color="#ef4444" />
                    </button>
                    <div style={{ padding: '14px 12px 14px 0', color: '#d1d5db' }}>
                      <ChevronRight size={16} />
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )

  return null
}
