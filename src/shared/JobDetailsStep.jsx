/**
 * JobDetailsStep — shared Step 0 for all wizards.
 *
 * Project details managed via ProjectPicker.
 * Drafts managed via DraftPicker (save named drafts, load them later).
 * Contractor, name, signature come from UserSettings — not shown here.
 *
 * Props:
 *   d          object  — wizard form state
 *   setD       fn      — wizard setD
 *   accent     string  — colour
 *   formKey    string  — e.g. '360S014EC'
 *   formLabel  string  — e.g. 'Pole Record'
 *   step       number  — current wizard step
 *   photos     array   — current photos
 *   setPhotos  fn      — photos setter
 *   clearDraft fn      — from useDraft, called after PDF share
 *   topChildren node   — extra fields before project (e.g. ZoneSub substation)
 *   children    node   — extra fields after date
 */
import { useState } from 'react'
import { FolderOpen, BookMarked } from 'lucide-react'
import { WF } from './WizardInputs'
import { GpsLocationButton } from './GpsLocationButton'
import { ProjectPicker } from './ProjectPicker'
import { DraftPicker } from './DraftPicker'
import { APP_ACCENT } from './constants'

export function JobDetailsStep({
  d,
  setD,
  accent = APP_ACCENT,
  formKey,
  formLabel = 'Form',
  step = 0,
  photos = [],
  setPhotos,
  topChildren,
  children,
}) {
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [draftPickerOpen, setDraftPickerOpen]     = useState(false)

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

  const handleDraftLoad = (draft) => {
    const { photos: draftPhotos, ...formData } = draft.data || {}
    setD(prev => ({ ...prev, ...formData }))
    if (setPhotos && Array.isArray(draft.photos) && draft.photos.length > 0) {
      setPhotos(draft.photos)
    }
  }

  const hasProject = d.projectName || d.npJobNumber || d.pcoWONo || d.ciwrNo
  const projectSummary = [d.npJobNumber, d.projectName].filter(Boolean).join(' — ')

  return (
    <div>
      {topChildren}

      {/* Project section */}
      <div style={{ marginBottom: 12 }}>
        {hasProject ? (
          <div style={{
            background: accent + '12',
            border: `2px solid ${accent}40`,
            borderRadius: 12, padding: '12px 14px', marginBottom: 8,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Project loaded
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
              {projectSummary || 'Unnamed project'}
            </div>
            {(d.pcoWONo || d.ciwrNo) && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {[d.pcoWONo && `W/O ${d.pcoWONo}`, d.ciwrNo && `CIWR ${d.ciwrNo}`].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: '#fef3c7', border: '1.5px dashed #f59e0b',
            borderRadius: 12, padding: '10px 14px', marginBottom: 8,
            fontSize: 13, color: '#92400e',
          }}>
            ⚠️ No project loaded
          </div>
        )}

        {/* Two buttons side by side — project and drafts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            onClick={() => setProjectPickerOpen(true)}
            style={{
              padding: '11px 0', borderRadius: 10,
              border: `2px solid ${accent}`,
              background: accent + '10', color: accent,
              fontWeight: 700, fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 6,
            }}
          >
            <FolderOpen size={16} />
            {hasProject ? 'Change' : 'Project'}
          </button>

          <button
            onClick={() => setDraftPickerOpen(true)}
            style={{
              padding: '11px 0', borderRadius: 10,
              border: '2px solid #6b7280',
              background: '#f9fafb', color: '#374151',
              fontWeight: 700, fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 6,
            }}
          >
            <BookMarked size={16} />
            Drafts
          </button>
        </div>
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
        open={projectPickerOpen}
        onClose={() => setProjectPickerOpen(false)}
        onSelect={handleProjectSelect}
        accent={accent}
      />

      <DraftPicker
        open={draftPickerOpen}
        onClose={() => setDraftPickerOpen(false)}
        formKey={formKey}
        formLabel={formLabel}
        d={d}
        step={step}
        photos={photos}
        onLoad={handleDraftLoad}
        accent={accent}
      />
    </div>
  )
}
