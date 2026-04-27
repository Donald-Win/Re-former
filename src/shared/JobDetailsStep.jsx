/**
 * JobDetailsStep — shared Step 0 for all wizards.
 *
 * Props:
 *   d              object   — wizard form state
 *   setD           fn       — wizard setD
 *   accent         string   — colour
 *   DraftBanner    component — from useDraft
 *   onPickerOpen   fn       — opens JobHistoryPicker
 *   showNamePrint  bool     — false for LvBoxWizard which has no namePrint field
 *   children       node     — extra fields appended after signature (e.g. LvConnection ICP fields)
 */
import { useEffect } from 'react'
import { WF } from './WizardInputs'
import { SignaturePad } from './SignaturePad'
import { GpsLocationButton } from './GpsLocationButton'
import { saveUserPref } from './userPrefs'
import { APP_ACCENT } from './constants'

export function JobDetailsStep({
  d,
  setD,
  accent = APP_ACCENT,
  DraftBanner,
  onPickerOpen,
  showNamePrint = true,
  children,
}) {
  const set = (k, v) => setD(p => ({ ...p, [k]: v }))

  // Persist user prefs whenever values change
  useEffect(() => { saveUserPref('contractor', d.contractor) }, [d.contractor])
  useEffect(() => { saveUserPref('namePrint',  d.namePrint)  }, [d.namePrint])
  useEffect(() => { if (d.signed) saveUserPref('signed', d.signed) }, [d.signed])

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <WF label="Project Name"  v={d.projectName} set={v => set('projectName', v)} accent={accent} />
        <WF label="NP Job Number" v={d.npJobNumber}  set={v => set('npJobNumber', v)} accent={accent} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <WF label="PCo W/O No." v={d.pcoWONo} set={v => set('pcoWONo', v)} accent={accent} />
        <WF label="CIWR No."    v={d.ciwrNo}  set={v => set('ciwrNo',  v)} accent={accent} />
      </div>

      <GpsLocationButton accent={accent} onLocation={loc => setD(p => ({ ...p, ...loc }))} />

      <WF label="No./Street/Road" v={d.streetRoad} set={v => set('streetRoad', v)} ph="123 Example Road" accent={accent} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <WF label="City / Town" v={d.cityTown} set={v => set('cityTown', v)} ph="Hamilton" accent={accent} />
        <WF label="District"    v={d.district} set={v => set('district', v)} ph="Waikato"  accent={accent} />
      </div>

      <div style={{ height: 1, background: '#eee', margin: '14px 0' }} />

      <WF label="Contractor"          v={d.contractor}        set={v => set('contractor',        v)} accent={accent} />
      <WF label="Date Work Completed" v={d.dateWorkCompleted} set={v => set('dateWorkCompleted', v)} type="date" accent={accent} />
      {showNamePrint && (
        <WF label="Name (Print)" v={d.namePrint} set={v => set('namePrint', v)} accent={accent} />
      )}
      <SignaturePad value={d.signed} onChange={v => set('signed', v)} accent={accent} />

      {children}
    </div>
  )
}
