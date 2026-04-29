/**
 * JobDetailsStep — shared Step 0 for all wizards.
 *
 * Project details (name, NP job number, W/O, CIWR) are managed via
 * ProjectPicker — user either creates a new project or loads a saved one.
 *
 * Contractor, name, and signature come from UserSettings — not shown here.
 *
 * Props:
 *   d            object    — wizard form state
 *   setD         fn        — wizard setD
 *   accent       string    — colour
 *   DraftBanner  component — from useDraft
 *   topChildren  node      — extra fields before project picker (e.g. ZoneSub substation)
 *   children     node      — extra fields after date (e.g. LvConnection ICP fields)
 */
import { useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { WF } from './WizardInputs'
import { GpsLocationButton } from './GpsLocationButton'
import { ProjectPicker } from './ProjectPicker'
import { APP_ACCENT } from './constants'

export function JobDetailsStep({
  d,
  setD,
  accent = APP_ACCENT,
  DraftBanner,
  topChildren,
  children,
}) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const set = (k, v) => {
    if (v !== undefined) {
      setD(p => ({ ...p, [k]: v }))
    } else {
      return (val) => setD(p => ({ ...p, [k]: val }))
    }
  }

  const handleProjectSelect = ({ projectName, npJobNumber, pcoWONo, ciwrNo }) => {
    setD(p => ({ ...p, projectName, npJobNumber, pcoWONo, ciwrNo }))
  }

  // Project summary pill — shows what's currently loaded
  const hasProject = d.projectName || d.npJobNumber || d.pcoWONo || d.ciwrNo
  const projectSummary = [d.npJobNumber, d.projectName].filter(Boolean).join(' — ')

  return (
    <div>
      {DraftBanner && <DraftBanner />}

      {topChildren}

      {/* Project section */}
      <div style={{ marginBottom: 16 }}>
        {hasProject ? (
          // Loaded project chip
          <div style={{
            background: accent + '12',
            border: `2px solid ${accent}40`,
            borderRadius: 12, padding: '12px 14px',
            marginBottom: 8,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Project loaded
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{projectSummary || 'Unnamed project'}</div>
            {(d.pcoWONo || d.ciwrNo) && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {[d.pcoWONo && `W/O ${d.pcoWONo}`, d.ciwrNo && `CIWR ${d.ciwrNo}`].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: '#fef3c7', border: '1.5px dashed #f59e0b',
            borderRadius: 12, padding: '12px 14px', marginBottom: 8,
            fontSize: 13, color: '#92400e',
          }}>
            ⚠️ No project loaded — tap below to create or load one.
          </div>
        )}

        <button
          onClick={() => setPickerOpen(true)}
          style={{
            width: '100%', padding: '12px 0',
            borderRadius: 10, border: `2px solid ${accent}`,
            background: accent + '10', color: accent,
            fontWeight: 700, fontSize: 14,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
          }}
        >
          <FolderOpen size={18} />
          {hasProject ? 'Change Project' : 'Create / Load Project'}
        </button>
      </div>

      <div style={{ height: 1, background: '#eee', margin: '4px 0 14px' }} />

      <GpsLocationButton accent={accent} onLocation={loc => setD(p => ({ ...p, ...loc }))} />

      <WF label="No./Street/Road" v={d.streetRoad} set={set('streetRoad')} ph="123 Example Road" accent={accent} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <WF label="City / Town" v={d.cityTown} set={set('cityTown')} ph="Hamilton" accent={accent} />
        <WF label="District"    v={d.district} set={set('district')} ph="Waikato"  accent={accent} />
      </div>

      <WF label="Date Work Completed" v={d.dateWorkCompleted} set={set('dateWorkCompleted')} type="date" accent={accent} />

      {children}

      <ProjectPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleProjectSelect}
        accent={accent}
      />
    </div>
  )
}
