/**
 * UserSettings — dedicated settings page for persistent user details.
 *
 * Stores: contractor name, printed name, ISN ID, competency cert no, signature.
 * These are loaded silently into every wizard and written to the PDF
 * without the user being asked each time.
 */
import { useState, useEffect } from 'react'
import { CheckCircle2, User, Building2, PenLine, Trash2, FileText, Hash, Settings, Briefcase, List } from 'lucide-react'
import { getUserPrefs, saveUserPref } from './userPrefs'
import { SignaturePad } from './SignaturePad'
import { APP_ACCENT } from './constants'

export function UserSettings({ onClose }) {
  const [contractor, setContractor] = useState('')
  const [namePrint,  setNamePrint]  = useState('')
  const [isnId,      setIsnId]      = useState('')
  const [certNo,     setCertNo]     = useState('')
  const [signed,     setSigned]     = useState('')
  const [defaultView, setDefaultView] = useState('workType')
  const [saved,      setSaved]      = useState(false)

  // Load existing prefs on mount
  useEffect(() => {
    const prefs = getUserPrefs()
    setContractor(prefs.contractor || '')
    setNamePrint(prefs.namePrint   || '')
    setIsnId(prefs.isnId           || '')
    setCertNo(prefs.certNo         || '')
    setSigned(prefs.signed         || '')
    setDefaultView(prefs.defaultView || 'workType')
  }, [])

  const handleSave = () => {
    saveUserPref('contractor',  contractor)
    saveUserPref('namePrint',   namePrint)
    saveUserPref('isnId',       isnId)
    saveUserPref('certNo',      certNo)
    saveUserPref('signed',      signed)
    saveUserPref('defaultView', defaultView)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClearAll = () => {
    if (!window.confirm('Clear all saved user details?')) return
    saveUserPref('contractor', '')
    saveUserPref('namePrint',  '')
    saveUserPref('isnId',      '')
    saveUserPref('certNo',     '')
    saveUserPref('signed',     '')
    setContractor('')
    setNamePrint('')
    setIsnId('')
    setCertNo('')
    setSigned('')
  }

  const inp = {
    width: '100%', padding: '11px 13px',
    border: `2px solid ${APP_ACCENT}40`,
    borderRadius: 10, fontSize: 15,
    fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', background: '#fff',
    color: '#1a1a2e',
    transition: 'border-color 0.15s',
  }

  const lbl = {
    display: 'flex', alignItems: 'center', gap: 7,
    fontSize: 12, fontWeight: 700, color: APP_ACCENT,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    marginBottom: 6,
  }

  const section = {
    background: '#fff',
    border: `1px solid ${APP_ACCENT}20`,
    borderRadius: 14,
    padding: '18px 16px',
    marginBottom: 14,
    boxShadow: `0 2px 8px ${APP_ACCENT}10`,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#f4f4f8',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: APP_ACCENT, color: '#fff',
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <User size={22} color="#fff" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>My Details</div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>Pre-filled into every form automatically</div>
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.15)', border: 'none',
          borderRadius: 8, padding: '6px 14px',
          color: '#fff', fontFamily: 'inherit',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>Done</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 40px' }}>

        <div style={{
          background: `${APP_ACCENT}12`,
          border: `1px solid ${APP_ACCENT}30`,
          borderRadius: 10, padding: '12px 14px',
          marginBottom: 20, fontSize: 13,
          color: APP_ACCENT, lineHeight: 1.5,
        }}>
          <strong>ℹ️ How this works</strong><br />
          Save your details here once. Every form wizard will automatically
          fill in your contractor, name, ISN ID, and signature — you won't be asked again.
        </div>

        {/* Contractor */}
        <div style={section}>
          <label style={lbl}>
            <Building2 size={14} />
            Contractor / Company
          </label>
          <input
            type="text"
            value={contractor}
            onChange={e => setContractor(e.target.value)}
            placeholder="e.g. Downer Group"
            style={inp}
            onFocus={e => e.target.style.borderColor = APP_ACCENT}
            onBlur={e => e.target.style.borderColor = `${APP_ACCENT}40`}
          />
        </div>

        {/* Name */}
        <div style={section}>
          <label style={lbl}>
            <User size={14} />
            Your Name (Print)
          </label>
          <input
            type="text"
            value={namePrint}
            onChange={e => setNamePrint(e.target.value)}
            placeholder="e.g. Donald Win"
            style={inp}
            onFocus={e => e.target.style.borderColor = APP_ACCENT}
            onBlur={e => e.target.style.borderColor = `${APP_ACCENT}40`}
          />
        </div>

        {/* ISN ID */}
        <div style={section}>
          <label style={lbl}>
            <Hash size={14} />
            ISN ID Number
          </label>
          <input
            type="text"
            value={isnId}
            onChange={e => setIsnId(e.target.value)}
            placeholder="e.g. ISN12345"
            style={inp}
            onFocus={e => e.target.style.borderColor = APP_ACCENT}
            onBlur={e => e.target.style.borderColor = `${APP_ACCENT}40`}
          />
        </div>

        {/* Competency Cert No */}
        <div style={section}>
          <label style={lbl}>
            <FileText size={14} />
            Competency Cert No.
          </label>
          <input
            type="text"
            value={certNo}
            onChange={e => setCertNo(e.target.value)}
            placeholder="e.g. EW123456"
            style={inp}
            onFocus={e => e.target.style.borderColor = APP_ACCENT}
            onBlur={e => e.target.style.borderColor = `${APP_ACCENT}40`}
          />
        </div>

        {/* Signature */}
        <div style={section}>
          <label style={lbl}>
            <PenLine size={14} />
            Signature
          </label>
          <SignaturePad value={signed} onChange={setSigned} accent={APP_ACCENT} />
          <div style={{
            marginTop: 8, fontSize: 12,
            color: '#9ca3af', textAlign: 'center',
          }}>
            {signed ? '✓ Signature saved' : 'Draw your signature above'}
          </div>
        </div>

        {/* Default View */}
        <div style={section}>
          <label style={lbl}>
            <Settings size={14} />
            Default View on Open
          </label>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10, lineHeight: 1.4 }}>
            Choose which screen the app shows first when you open it.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { val: 'workType', label: 'By Work Type',     icon: Briefcase },
              { val: 'allForms', label: 'Browse All Forms', icon: List },
            ].map(({ val, label, icon: Icon }) => {
              const sel = defaultView === val
              return (
                <button
                  key={val}
                  onClick={() => setDefaultView(val)}
                  style={{
                    flex: 1, padding: '12px 8px', borderRadius: 10,
                    border: `2px solid ${sel ? APP_ACCENT : '#e5e7eb'}`,
                    background: sel ? APP_ACCENT : '#fff',
                    color: sel ? '#fff' : '#374151',
                    fontFamily: 'inherit', fontSize: 13,
                    fontWeight: sel ? 700 : 600, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 5,
                  }}
                >
                  <Icon size={18} />
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          style={{
            width: '100%', padding: '15px',
            borderRadius: 14, border: 'none',
            background: saved ? '#16a34a' : APP_ACCENT,
            color: '#fff',
            fontFamily: 'inherit', fontSize: 16,
            fontWeight: 700, cursor: 'pointer',
            marginBottom: 12,
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
            transition: 'background 0.2s',
          }}
        >
          {saved
            ? <><CheckCircle2 size={20} /> Saved!</>
            : 'Save My Details'
          }
        </button>

        {/* Clear all */}
        <button
          onClick={handleClearAll}
          style={{
            width: '100%', padding: '12px',
            borderRadius: 14,
            border: '2px solid #fca5a5',
            background: '#fff5f5', color: '#dc2626',
            fontFamily: 'inherit', fontSize: 14,
            fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
          }}
        >
          <Trash2 size={16} /> Clear All Saved Details
        </button>

      </div>
    </div>
  )
}
