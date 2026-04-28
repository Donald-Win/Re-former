/**
 * JobDetailsStep — shared Step 0 for all wizards.
 *
 * Contractor, name (print) and signature are NO LONGER shown here.
 * They are set once in User Settings and loaded silently into wizard
 * state via getUserPrefs() when each wizard initialises.
 *
 * Props:
 *   d            object    — wizard form state
 *   setD         fn        — wizard setD
 *   accent       string    — colour
 *   DraftBanner  component — from useDraft
 *   onPickerOpen fn        — opens JobHistoryPicker
 *   topChildren  node      — extra fields before project name (e.g. ZoneSub substation)
 *   children     node      — extra fields after date (e.g. LvConnection ICP fields)
 */
import { WF } from './WizardInputs'
import { GpsLocationButton } from './GpsLocationButton'
import { APP_ACCENT } from './constants'

export function JobDetailsStep({
  d,
  setD,
  accent = APP_ACCENT,
  DraftBanner,
  onPickerOpen,
  topChildren,
  children,
}) {
  const set = (k, v) => {
    if (v !== undefined) {
      setD(p => ({ ...p, [k]: v }))
    } else {
      return (val) => setD(p => ({ ...p, [k]: val }))
    }
  }

  return (
    <div>
      {DraftBanner && <DraftBanner />}

      <button
        onClick={onPickerOpen}
        style={{
          width: '100%', padding: '10px 0', marginBottom: 16,
          borderRadius: 8, border: `2px dashed ${accent}`,
          background: accent + '18', color: accent,
          fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        📋 Load Previous Job
      </button>

      {topChildren}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <WF label="Project Name"  v={d.projectName} set={set('projectName')} accent={accent} />
        <WF label="NP Job Number" v={d.npJobNumber}  set={set('npJobNumber')} accent={accent} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <WF label="PCo W/O No." v={d.pcoWONo} set={set('pcoWONo')} accent={accent} />
        <WF label="CIWR No."    v={d.ciwrNo}  set={set('ciwrNo')}  accent={accent} />
      </div>

      <GpsLocationButton accent={accent} onLocation={loc => setD(p => ({ ...p, ...loc }))} />

      <WF label="No./Street/Road" v={d.streetRoad} set={set('streetRoad')} ph="123 Example Road" accent={accent} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <WF label="City / Town" v={d.cityTown} set={set('cityTown')} ph="Hamilton" accent={accent} />
        <WF label="District"    v={d.district} set={set('district')} ph="Waikato"  accent={accent} />
      </div>

      <WF label="Date Work Completed" v={d.dateWorkCompleted} set={set('dateWorkCompleted')} type="date" accent={accent} />

      {children}
    </div>
  )
}
