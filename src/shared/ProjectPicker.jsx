/**
 * ProjectPicker — bottom-sheet modal for managing saved projects.
 *
 * Shows two modes:
 *   'menu'   — two big buttons: Create New / Load Existing
 *   'create' — form to enter project details and save
 *   'list'   — scrollable list of saved projects with delete
 *
 * Props:
 *   open      bool
 *   onClose   fn()
 *   onSelect  fn({ projectName, npJobNumber, pcoWONo, ciwrNo }) — called on load or create
 *   accent    string — colour
 */
import { useState, useEffect } from 'react'
import { Plus, FolderOpen, Trash2, X, ChevronRight, Check } from 'lucide-react'
import { listProjects, saveProject, deleteProject, projectLabel, projectSub, PROJECT_FIELDS } from './projectStore'
import { APP_ACCENT } from './constants'
import { wInp, wLbl } from './WizardInputs'

export function ProjectPicker({ open, onClose, onSelect, accent = APP_ACCENT }) {
  const [mode, setMode]         = useState('menu') // 'menu' | 'create' | 'list'
  const [projects, setProjects] = useState([])
  const [form, setForm]         = useState({ projectName: '', npJobNumber: '', pcoWONo: '', ciwrNo: '' })
  const [saved, setSaved]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // id to confirm

  useEffect(() => {
    if (open) {
      setMode('menu')
      setForm({ projectName: '', npJobNumber: '', pcoWONo: '', ciwrNo: '' })
      setSaved(false)
      setConfirmDelete(null)
      setProjects(listProjects())
    }
  }, [open])

  if (!open) return null

  const setF = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSaveAndLoad = () => {
    const entry = saveProject(form)
    setProjects(listProjects())
    onSelect({ projectName: entry.projectName, npJobNumber: entry.npJobNumber, pcoWONo: entry.pcoWONo, ciwrNo: entry.ciwrNo })
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 800)
  }

  const handleLoad = (project) => {
    onSelect({ projectName: project.projectName, npJobNumber: project.npJobNumber, pcoWONo: project.pcoWONo, ciwrNo: project.ciwrNo })
    onClose()
  }

  const handleDelete = (id) => {
    deleteProject(id)
    setProjects(listProjects())
    setConfirmDelete(null)
  }

  const hasContent = form.projectName || form.npJobNumber || form.pcoWONo || form.ciwrNo

  // ── Shared sheet wrapper ───────────────────────────────────────────────────
  const Sheet = ({ children, title, onBack }) => (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401,
        background: '#fff', borderRadius: '20px 20px 0 0',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
        </div>
        {/* Header */}
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
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 18px 32px' }}>
          {children}
        </div>
      </div>
    </>
  )

  // ── Menu ──────────────────────────────────────────────────────────────────
  if (mode === 'menu') {
    return (
      <Sheet title="Project">
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 20 }}>
          Projects save your job identifiers so you can load them into any form.
        </p>

        {/* Create New */}
        <button onClick={() => setMode('create')} style={{
          width: '100%', padding: '16px', borderRadius: 14, marginBottom: 12,
          border: `2px solid ${accent}`,
          background: accent + '12', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 14,
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

        {/* Load Existing */}
        <button onClick={() => setMode('list')} style={{
          width: '100%', padding: '16px', borderRadius: 14,
          border: '2px solid #e5e7eb',
          background: '#f9fafb', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 14,
          fontFamily: 'inherit', textAlign: 'left',
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FolderOpen size={22} color="#6b7280" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#374151' }}>Load Existing Project</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {projects.length === 0 ? 'No saved projects yet' : `${projects.length} saved project${projects.length !== 1 ? 's' : ''}`}
            </div>
          </div>
        </button>
      </Sheet>
    )
  }

  // ── Create form ───────────────────────────────────────────────────────────
  if (mode === 'create') {
    return (
      <Sheet title="New Project" onBack={() => setMode('menu')}>
        <div style={{ marginTop: 8 }}>
          {[
            ['Project Name',  'projectName', 'e.g. Pyes Pa Blitz'],
            ['NP Job Number', 'npJobNumber', 'e.g. TC1234567'],
            ['PCo W/O No.',   'pcoWONo',     'e.g. 123456'],
            ['CIWR No.',      'ciwrNo',      'e.g. 78901'],
          ].map(([label, key, ph]) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <label style={wLbl}>{label}</label>
              <input
                type="text"
                value={form[key]}
                onChange={setF(key)}
                placeholder={ph}
                style={{ ...wInp, borderColor: form[key] ? accent : '#ddd' }}
              />
            </div>
          ))}

          <button
            onClick={handleSaveAndLoad}
            disabled={!hasContent}
            style={{
              width: '100%', padding: '15px', borderRadius: 14, border: 'none',
              background: saved ? '#16a34a' : hasContent ? accent : '#d1d5db',
              color: '#fff', fontFamily: 'inherit', fontSize: 16,
              fontWeight: 700, cursor: hasContent ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.2s',
            }}
          >
            {saved ? <><Check size={20} /> Saved & Loaded!</> : 'Save & Load Project'}
          </button>
        </div>
      </Sheet>
    )
  }

  // ── Project list ──────────────────────────────────────────────────────────
  if (mode === 'list') {
    return (
      <Sheet title="Saved Projects" onBack={() => setMode('menu')}>
        {projects.length === 0 ? (
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
              marginBottom: 10, overflow: 'hidden',
              background: '#fff',
            }}>
              {confirmDelete === project.id ? (
                // Confirm delete inline
                <div style={{ padding: '14px 16px', background: '#fef2f2' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 10 }}>
                    Delete "{projectLabel(project)}"?
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
                  {/* Load button */}
                  <button onClick={() => handleLoad(project)} style={{
                    flex: 1, padding: '14px 16px', background: 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'inherit',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                      {projectLabel(project)}
                    </div>
                    {projectSub(project) && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        {projectSub(project)}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#d1d5db', marginTop: 2 }}>
                      Saved {new Date(project.savedAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </button>

                  {/* Delete button */}
                  <button onClick={() => setConfirmDelete(project.id)} style={{
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
      </Sheet>
    )
  }

  return null
}
