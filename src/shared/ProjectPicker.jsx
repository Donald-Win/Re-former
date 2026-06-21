/**
 * ProjectPicker — bottom-sheet modal for managing saved projects.
 *
 * Shows three modes:
 *   'menu'   — two big buttons: Create New / Load Existing
 *   'create' — form to enter project details and save
 *   'list'   — scrollable list of saved projects with delete
 *
 * Props:
 *   open      bool
 *   onClose   fn()
 *   onSelect  fn({ projectName, npJobNumber, pcoWONo, ciwrNo })
 *   accent    string
 */
import { useState, useEffect, useCallback } from 'react'
import { Plus, FolderOpen, Trash2, X, ChevronRight, Check, Pencil } from 'lucide-react'
import { listProjects, saveProject, deleteProject, projectLabel, projectSub } from './projectStore'
import { APP_ACCENT } from './constants'
import { wInp, wLbl } from './WizardInputs'

export function ProjectPicker({ open, onClose, onSelect, accent = APP_ACCENT }) {
  const [mode, setMode]             = useState('menu')
  const [projects, setProjects]     = useState([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [form, setForm]             = useState({ projectName: '', npJobNumber: '', pcoWONo: '', ciwrNo: '' })
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [editingProject, setEditingProject] = useState(null)

  const refreshProjects = useCallback(async () => {
    setProjectsLoading(true)
    try {
      const all = await listProjects()
      setProjects(all)
    } catch (err) {
      console.error('[ProjectPicker] Failed to load projects:', err)
      setProjects([])
    } finally {
      setProjectsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setMode('menu')
      setForm({ projectName: '', npJobNumber: '', pcoWONo: '', ciwrNo: '' })
      setSaved(false)
      setConfirmDelete(null)
      setEditingProject(null)
      refreshProjects()
    }
  }, [open, refreshProjects])

  if (!open) return null

  const setF = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSaveAndLoad = async () => {
    setSaving(true)
    try {
      const entry = await saveProject({ ...form, id: editingProject?.id })
      await refreshProjects()
      if (!editingProject) {
        onSelect({ projectName: entry.projectName, npJobNumber: entry.npJobNumber, pcoWONo: entry.pcoWONo, ciwrNo: entry.ciwrNo })
      }
      setSaved(true)
      setTimeout(() => { setSaved(false); setEditingProject(null); setMode('list') }, 900)
    } catch (err) {
      console.error('[ProjectPicker] Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleLoad = (project) => {
    onSelect({ projectName: project.projectName, npJobNumber: project.npJobNumber, pcoWONo: project.pcoWONo, ciwrNo: project.ciwrNo })
    onClose()
  }

  const handleDelete = async (id) => {
    try {
      await deleteProject(id)
      await refreshProjects()
    } catch (err) {
      console.error('[ProjectPicker] Delete failed:', err)
    }
    setConfirmDelete(null)
  }

  const hasContent = form.projectName || form.npJobNumber || form.pcoWONo || form.ciwrNo
  const npValid    = !form.npJobNumber || /^(TC|WF|WA)\d{7}$/.test(form.npJobNumber)
  const woValid    = !form.pcoWONo     || /^50\d{6}$/.test(form.pcoWONo)
  const formValid  = hasContent && npValid && woValid

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
        {renderHeader('Project')}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 18px 32px' }}>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 20 }}>
            Projects save your job identifiers so you can load them into any form.
          </p>
          <button onClick={() => setMode('create')} style={{
            width: '100%', padding: '16px', borderRadius: 14, marginBottom: 12,
            border: `2px solid ${accent}`, background: accent + '12',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
            fontFamily: 'inherit', textAlign: 'left',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Plus size={22} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: accent }}>Create New Project</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Enter job details and save for reuse</div>
            </div>
          </button>
          <button onClick={() => setMode('list')} style={{
            width: '100%', padding: '16px', borderRadius: 14,
            border: '2px solid #e5e7eb', background: '#f9fafb',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
            fontFamily: 'inherit', textAlign: 'left',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FolderOpen size={22} color="#6b7280" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#374151' }}>Load Existing Project</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {projectsLoading
                  ? 'Loading…'
                  : projects.length === 0
                    ? 'No saved projects yet'
                    : `${projects.length} saved project${projects.length !== 1 ? 's' : ''}`}
              </div>
            </div>
          </button>
        </div>
      </div>
    </>
  )

  // ── Create form ───────────────────────────────────────────────────────────
  if (mode === 'create') return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400 }} />
      <div style={sheetContainer}>
        {renderHeader(editingProject ? 'Edit Project' : 'New Project', () => { setEditingProject(null); setMode(editingProject ? 'list' : 'menu') })}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 18px 32px' }}>
          <div style={{ marginTop: 8 }}>
            {/* Project Name */}
            <div style={{ marginBottom: 14 }}>
              <label style={wLbl}>Project Name</label>
              <input
                type="text"
                value={form.projectName}
                onChange={setF('projectName')}
                placeholder="e.g. Pyes Pa Blitz"
                style={{ ...wInp, borderColor: form.projectName ? accent : '#ddd' }}
              />
            </div>

            {/* NP Job Number */}
            {(() => {
              const val     = form.npJobNumber
              const valid   = /^(TC|WF|WA)\d{7}$/.test(val)
              const invalid = val.length > 0 && !valid
              return (
                <div style={{ marginBottom: 14 }}>
                  <label style={wLbl}>NP Job Number</label>
                  <input
                    type="text"
                    value={val}
                    onChange={e => {
                      let v = e.target.value.toUpperCase()
                      if (v.length > 2) v = v.slice(0, 2) + v.slice(2).replace(/\D/g, '')
                      v = v.slice(0, 9)
                      setForm(p => ({ ...p, npJobNumber: v }))
                    }}
                    placeholder="e.g. TC1234567"
                    inputMode="text"
                    autoCapitalize="characters"
                    style={{
                      ...wInp,
                      borderColor: valid ? '#16a34a' : invalid ? '#dc2626' : '#ddd',
                      background:  valid ? '#f0fdf4' : invalid ? '#fef2f2' : '#fafafa',
                    }}
                  />
                  {invalid && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>Must be TC, WF or WA followed by 7 digits — e.g. TC1234567</div>}
                  {valid   && <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>✓ Valid</div>}
                </div>
              )
            })()}

            {/* PCo W/O No. */}
            {(() => {
              const val     = form.pcoWONo
              const valid   = /^50\d{6}$/.test(val)
              const invalid = val.length > 0 && !valid
              return (
                <div style={{ marginBottom: 14 }}>
                  <label style={wLbl}>PCo W/O No.</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={val}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                      setForm(p => ({ ...p, pcoWONo: v }))
                    }}
                    placeholder="e.g. 50512345"
                    style={{
                      ...wInp,
                      borderColor: valid ? '#16a34a' : invalid ? '#dc2626' : '#ddd',
                      background:  valid ? '#f0fdf4' : invalid ? '#fef2f2' : '#fafafa',
                    }}
                  />
                  {invalid && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>Must be 8 digits starting with 50 — e.g. 50512345</div>}
                  {valid   && <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>✓ Valid</div>}
                </div>
              )
            })()}

            {/* CIWR No. */}
            <div style={{ marginBottom: 14 }}>
              <label style={wLbl}>CIWR No.</label>
              <input
                type="text"
                value={form.ciwrNo}
                onChange={setF('ciwrNo')}
                placeholder="e.g. 78901"
                style={{ ...wInp, borderColor: form.ciwrNo ? accent : '#ddd' }}
              />
            </div>

            <button
              onClick={handleSaveAndLoad}
              disabled={!formValid || saving}
              style={{
                width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                background: saved ? '#16a34a' : formValid ? accent : '#d1d5db',
                color: '#fff', fontFamily: 'inherit', fontSize: 16,
                fontWeight: 700, cursor: formValid && !saving ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.2s',
              }}
            >
              {saved   ? <><Check size={20} /> {editingProject ? 'Saved!' : 'Saved & Loaded!'}</>
               : saving ? 'Saving…'
               : editingProject ? 'Save Changes' : 'Save & Load Project'}
            </button>
          </div>
        </div>
      </div>
    </>
  )

  // ── Project list ──────────────────────────────────────────────────────────
  if (mode === 'list') return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400 }} />
      <div style={sheetContainer}>
        {renderHeader('Saved Projects', () => setMode('menu'))}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 18px 32px' }}>
          {projectsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 14 }}>Loading…</div>
          ) : projects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              <FolderOpen size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
              <div style={{ fontSize: 14 }}>No saved projects yet.</div>
              <button onClick={() => setMode('create')} style={{
                marginTop: 16, padding: '10px 20px', borderRadius: 10,
                border: `2px solid ${accent}`, background: accent + '12',
                color: accent, fontFamily: 'inherit', fontSize: 14,
                fontWeight: 600, cursor: 'pointer',
              }}>Create your first project</button>
            </div>
          ) : (
            projects.map(project => (
              <div key={project.id} style={{
                border: '1px solid #f0f0f0', borderRadius: 12,
                marginBottom: 10, overflow: 'hidden', background: '#fff',
              }}>
                {confirmDelete === project.id ? (
                  <div style={{ padding: '14px 16px', background: '#fef2f2' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 10 }}>
                      Delete &quot;{projectLabel(project)}&quot;?
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleDelete(project.id)} style={{
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
                    <button onClick={() => handleLoad(project)} style={{
                      flex: 1, padding: '14px 16px', background: 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                        {projectLabel(project)}
                      </div>
                      {projectSub(project) && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{projectSub(project)}</div>
                      )}
                      <div style={{ fontSize: 11, color: '#d1d5db', marginTop: 2 }}>
                        Saved {new Date(project.savedAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </button>
                    <button onClick={() => {
                        setEditingProject(project)
                        setForm({ projectName: project.projectName, npJobNumber: project.npJobNumber, pcoWONo: project.pcoWONo, ciwrNo: project.ciwrNo })
                        setSaved(false)
                        setMode('create')
                      }} style={{
                        padding: '14px 12px', background: 'transparent',
                        border: 'none', borderLeft: '1px solid #f0f0f0',
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                      }}>
                      <Pencil size={15} color="#6b7280" />
                    </button>
                    <button onClick={() => setConfirmDelete(project.id)} style={{
                      padding: '14px 12px', background: 'transparent',
                      border: 'none', borderLeft: '1px solid #f0f0f0',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                    }}>
                      <Trash2 size={16} color="#ef4444" />
                    </button>
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
