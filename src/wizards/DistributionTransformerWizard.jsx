// 220F028B — Distribution Transformer Commissioning Certificate
import { useState } from 'react'
import { Zap } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { APP_ACCENT, WIZARD_COLORS } from '../shared/constants'
import { WF, SectionHead } from '../shared/WizardInputs'
import { PhotoAttachStep } from '../shared/PhotoAttachStep'
import { sharePdf, buildPdfFilename } from '../shared/sharePdf'
import { getBaseFormState } from '../shared/userPrefs'
import { JobDetailsStep } from '../shared/JobDetailsStep'
import { usePdfGenerate } from '../shared/usePdfGenerate'
import { useWizardSetup } from '../shared/useWizardSetup'
import { useDraft } from '../shared/useDraft'
import { DraftPicker } from '../shared/DraftPicker'
import { useDraftPicker } from '../shared/useDraftPicker'
import { devFillState } from '../shared/devFillState'

// ── Lazy generator import ─────────────────────────────────────────────────────
const loadB28Generator = () =>
  import('./generators/DistributionTransformerPdfGenerator').then(m => m.generateB28Pdf)

const FORM_KEY   = '220F028B'
const FORM_LABEL = 'Distribution Transformer Commissioning Certificate'
const ACCENT     = APP_ACCENT
const B_BG       = WIZARD_COLORS.bg
const B_MID      = WIZARD_COLORS.mid
const B_BORDER   = WIZARD_COLORS.border

const B_STEPS = [
  'Job Details',
  'As-Built Records',
  'Earthing & Phases',
  'Neutral Earth Bonding',
  'HV-Fuse Checks',
  'Voltage Tests',
  'LV & Phase Rotation',
  'Phasing / Paralleling',
  'Loop Impedance',
  'Open Points & Sign-off',
  'Photos',
  'Preview & Print',
]

// ── Reference data ────────────────────────────────────────────────────────────

const AS_BUILT_ITEMS = [
  { key: 'asBuiltEE',        label: '360S014EE – As-built Electrical Equipment Record' },
  { key: 'asBuiltEG',        label: '360S014EG – As-built Transformer Record' },
  { key: 'asBuiltEH',        label: '360S014EH – As-built Equipment Record Cards' },
  { key: 'asBuiltEI',        label: '360S014EI – As-built Underground Network Distribution Panel Layout Record' },
  { key: 'asBuiltEJ',        label: '360S014EJ – As-built Earth Installation and Test Record' },
  { key: 'asBuiltEO',        label: '360S014EO – As-built Transformer ICP Change Form (if applicable)' },
  { key: 'asBuiltLabelling', label: 'Labelling completed per 393S004 Labelling and Safety Signage Requirements Standard' },
]

const VOLT_ROWS = [
  { key: 'fRW', label: 'R to W', acceptable: '412–422 V' },
  { key: 'fWB', label: 'W to B', acceptable: '412–422 V' },
  { key: 'fBR', label: 'B to R', acceptable: '412–422 V' },
  { key: 'fRN', label: 'R to N', acceptable: '238–244 V' },
  { key: 'fWN', label: 'W to N', acceptable: '238–244 V' },
  { key: 'fBN', label: 'B to N', acceptable: '238–244 V' },
]

const PHASING_ROWS = [
  { key: 'iR1R2', label: 'R1 to R2', acceptable: '<10 V' },
  { key: 'iW1W2', label: 'W1 to W2', acceptable: '<10 V' },
  { key: 'iB1B2', label: 'B1 to B2', acceptable: '<10 V' },
]

// ── Initial state ─────────────────────────────────────────────────────────────

const initState = () => getBaseFormState({
  transformerNo:   '',
  contractorRefNo: '',

  // a) As-Built Records
  asBuiltEE: false, asBuiltEG: false, asBuiltEH: false,
  asBuiltEI: false, asBuiltEJ: false, asBuiltEO: false,
  asBuiltLabelling: false,

  // b) Earthing tests
  earthLeg1: '', earthLeg2: '',
  menUrban:  '', menRural:  '',

  // c) Phase connections
  phaseA: false, phaseB: false, phaseC: false,

  // d) Neutral Earth Bonding — Pole mounted
  dPoleBushing:    '', // 'Yes' | 'No'
  dPoleNeutralCond: '', // 'Yes' | 'No' | 'NA'
  dPoleEarth:      '', // 'Yes' | 'No'
  // d) Ground mounted
  dGroundBushing:  '', // 'Yes' | 'No'

  // e) Pre HV-Fuse Checks
  eLvIsolated:      false,
  eHvFuseCorrect:   false,
  eHvFusesInserted: false,
  eHvFuseSize:      '',

  // f) Off-Load Voltage Checks — [c1, c2, c3, c4] per measurement row
  fRW: ['','','',''], fWB: ['','','',''], fBR: ['','','',''],
  fRN: ['','','',''], fWN: ['','','',''], fBN: ['','','',''],
  fConfirmed: [false, false, false, false, false, false], // one per row
  fTapSetting: '',

  // g) Pre LV-Fuse Checks
  gLvFuseCorrect: false,

  // h) Phase Rotation Checks
  hPhaseRotation:    false,
  hConsumerRotation: false,

  // i) Phasing / Paralleling — [c1, c2, c3, c4] per row; neutrals per circuit
  iR1R2: ['','','',''], iW1W2: ['','','',''], iB1B2: ['','','',''],
  iNeutrals:  [false, false, false, false], // neutral connected per circuit
  iConfirmed: [false, false, false],        // confirm per measurement row

  // j) Loop Impedance Tests
  jRW: '', jRB: '', jWB: '',
  jRN: '', jWN: '', jBN: '',

  // k) LV Open Point Restoration
  kPoints: [
    { location: '', restored: false },
    { location: '', restored: false },
    { location: '', restored: false },
    { location: '', restored: false },
  ],

  // l) Testing Attestation
  isnId: '',
  // namePrint, signed, dateWorkCompleted come from getBaseFormState
})

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfirmToggle({ label, confirmed, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: '100%', padding: '11px 14px', borderRadius: 10, marginBottom: 6,
        border: `2px solid ${confirmed ? ACCENT : '#e5e7eb'}`,
        background: confirmed ? ACCENT + '12' : '#fff',
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
      }}
    >
      <span style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: confirmed ? ACCENT : '#f3f4f6',
        border: `2px solid ${confirmed ? ACCENT : '#d1d5db'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, color: confirmed ? '#fff' : 'transparent', fontWeight: 700,
      }}>✓</span>
      <span style={{
        fontSize: 13, lineHeight: 1.45,
        fontWeight: confirmed ? 600 : 400,
        color: confirmed ? '#111827' : '#374151',
      }}>{label}</span>
    </button>
  )
}

function YesNoSelect({ value, onChange, showNA = false }) {
  const opts = showNA
    ? [['Yes', 'Yes'], ['No', 'No'], ['NA', 'N/A']]
    : [['Yes', 'Yes'], ['No', 'No']]
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {opts.map(([val, lbl]) => {
        const sel = value === val
        return (
          <button key={val} onClick={() => onChange(sel ? '' : val)} style={{
            flex: 1, padding: '9px 0', borderRadius: 8,
            border: `2px solid ${sel ? ACCENT : '#e5e7eb'}`,
            background: sel ? ACCENT : '#fff',
            color: sel ? '#fff' : '#374151',
            fontFamily: 'inherit', fontSize: 13,
            fontWeight: sel ? 700 : 400, cursor: 'pointer',
          }}>{lbl}</button>
        )
      })}
    </div>
  )
}

function VoltageRow({ rowDef, values, onChangeCircuit, confirmed, onConfirm }) {
  const inp = {
    width: '100%', padding: '9px 4px', borderRadius: 7,
    border: '1.5px solid #e5e7eb', fontFamily: 'inherit',
    fontSize: 14, background: '#fff', outline: 'none',
    boxSizing: 'border-box', textAlign: 'center',
  }
  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e5e7eb',
      borderRadius: 10, padding: '11px 12px 8px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>{rowDef.label}</span>
        <span style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>{rowDef.acceptable}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5, marginBottom: 8 }}>
        {values.map((v, i) => (
          <div key={i}>
            <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', marginBottom: 2 }}>
              Circuit {i + 1}
            </div>
            <input
              type="text" inputMode="decimal" value={v} placeholder="—"
              onChange={e => onChangeCircuit(i, e.target.value)}
              style={inp}
            />
          </div>
        ))}
      </div>
      <button onClick={onConfirm} style={{
        width: '100%', padding: '7px 0', borderRadius: 7,
        border: `1.5px solid ${confirmed ? ACCENT : '#e5e7eb'}`,
        background: confirmed ? ACCENT + '12' : '#f9fafb',
        color: confirmed ? ACCENT : '#9ca3af',
        fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}>
        {confirmed ? '✓ Results Confirmed' : 'Mark Results Confirmed'}
      </button>
    </div>
  )
}

// ── Wizard ────────────────────────────────────────────────────────────────────

export default function DistributionTransformerWizard({ onClose }) {
  const [step, setStep]     = useState(0)
  const [d, setD]           = useState(initState)
  const [photos, setPhotos] = useState([])

  const isPreview = step === B_STEPS.length - 1

  const { draftPickerProps, openSave, openLoad } = useDraftPicker({
    setD, setPhotos, setStep,
    formKey: FORM_KEY, formLabel: FORM_LABEL,
    d, step, photos, accent: ACCENT,
  })

  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } =
    usePdfGenerate(loadB28Generator)

  const handleDevFill = import.meta.env.DEV ? () => setD(devFillState) : undefined

  const { set } = useWizardSetup(d, setD, step, FORM_KEY)
  const { clearDraft: clearFormDraft } = useDraft(FORM_KEY, d, step, photos)

  // ── State helpers ─────────────────────────────────────────────────────────

  const toggleBool = k => setD(p => ({ ...p, [k]: !p[k] }))

  const setVolt = (key, circIdx, val) => setD(prev => {
    const arr = [...prev[key]]; arr[circIdx] = val
    return { ...prev, [key]: arr }
  })

  const toggleFConfirmed = rowIdx => setD(prev => {
    const arr = [...prev.fConfirmed]; arr[rowIdx] = !arr[rowIdx]
    return { ...prev, fConfirmed: arr }
  })

  const setPhasing = (key, circIdx, val) => setD(prev => {
    const arr = [...prev[key]]; arr[circIdx] = val
    return { ...prev, [key]: arr }
  })

  const toggleNeutral = idx => setD(prev => {
    const arr = [...prev.iNeutrals]; arr[idx] = !arr[idx]
    return { ...prev, iNeutrals: arr }
  })

  const toggleIConfirmed = idx => setD(prev => {
    const arr = [...prev.iConfirmed]; arr[idx] = !arr[idx]
    return { ...prev, iConfirmed: arr }
  })

  const setOpenPoint = (idx, field, val) => setD(prev => ({
    ...prev,
    kPoints: prev.kPoints.map((p, i) => i === idx ? { ...p, [field]: val } : p),
  }))

  // ── Share ─────────────────────────────────────────────────────────────────

  const handleShare = () => sharePdf(
    pdfBytes,
    buildPdfFilename(d.projectName, d.npJobNumber, d.transformerNo,
      'Distribution Transformer Commissioning Certificate'),
    pdfBlobUrl,
    clearFormDraft,
  )

  // ── Missing fields ────────────────────────────────────────────────────────

  const missingFields = [
    !d.contractor    && 'Contractor',
    !d.streetRoad    && 'No./Street/Road',
    !d.pcoWONo       && 'SAP W/O No.',
    !d.transformerNo && 'Transformer No.',
    !d.namePrint     && 'Print Name',
    !d.isnId         && 'ISN ID Number',
    !d.signed        && 'Signature',
  ].filter(Boolean)

  // ── Shared input style for circuit cells ──────────────────────────────────

  const circInp = {
    width: '100%', padding: '9px 4px', borderRadius: 7,
    border: '1.5px solid #e5e7eb', fontFamily: 'inherit',
    fontSize: 14, background: '#fff', outline: 'none',
    boxSizing: 'border-box', textAlign: 'center',
  }

  // ── Form steps ────────────────────────────────────────────────────────────

  const formSteps = [

    // 0 — Job Details
    <JobDetailsStep key="s0" d={d} setD={setD} accent={ACCENT} onOpenDrafts={openLoad}>
      <div style={{ height: 1, background: '#eee', margin: '14px 0' }} />
      <SectionHead label="Transformer Identification" accent={ACCENT} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <WF label="Transformer No."   v={d.transformerNo}   set={set('transformerNo')}   accent={ACCENT} ph="e.g. TX-456" />
        <WF label="Contractor Ref. No." v={d.contractorRefNo} set={set('contractorRefNo')} accent={ACCENT} ph="e.g. CR-789" />
      </div>
    </JobDetailsStep>,

    // 1 — As-Built Records
    <div key="s1">
      <SectionHead label="a) As-Built Information Records Uploaded to SAP" accent={ACCENT} />
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px', lineHeight: 1.5 }}>
        Confirm each record has been completed and uploaded to SAP before commissioning.
      </p>
      {AS_BUILT_ITEMS.map(item => (
        <ConfirmToggle
          key={item.key}
          label={item.label}
          confirmed={d[item.key]}
          onToggle={() => toggleBool(item.key)}
        />
      ))}
    </div>,

    // 2 — Earthing & Phases
    <div key="s2">
      <SectionHead label="b) Earthing Equipment Testing Verification" accent={ACCENT} />
      <div style={{
        background: '#f0fdf4', border: '1px solid #86efac',
        borderRadius: 8, padding: '8px 12px', marginBottom: 12,
        fontSize: 12, color: '#166534', lineHeight: 1.4,
      }}>
        Earth Electrode ≤ 25 Ω · Total MEN urban ≤ 5 Ω · Total MEN rural ≤ 25 Ω
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <WF label="Earth Electrode — Leg 1 (Ω)" v={d.earthLeg1} set={set('earthLeg1')} accent={ACCENT} ph="e.g. 4.2" />
        <WF label="Earth Electrode — Leg 2 (Ω)" v={d.earthLeg2} set={set('earthLeg2')} accent={ACCENT} ph="e.g. 3.8" />
        <WF label="Total MEN Earth — Urban (Ω)"  v={d.menUrban}  set={set('menUrban')}  accent={ACCENT} ph="e.g. 2.1" />
        <WF label="Total MEN Earth — Rural (Ω)"  v={d.menRural}  set={set('menRural')}  accent={ACCENT} ph="e.g. 12.5" />
      </div>
      <div style={{ height: 1, background: '#eee', margin: '16px 0 14px' }} />
      <SectionHead label="c) Phase Connections to LV Network" accent={ACCENT} />
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>
        Confirm each LV phase terminal is securely connected to the designated phase conductor
        via LV HRC fuses (per 393S024 Network Fuse Protection Standard).
      </p>
      {[['phaseA', 'Phase a confirmed'], ['phaseB', 'Phase b confirmed'], ['phaseC', 'Phase c confirmed']].map(([k, lbl]) => (
        <ConfirmToggle key={k} label={lbl} confirmed={d[k]} onToggle={() => toggleBool(k)} />
      ))}
    </div>,

    // 3 — Neutral Earth Bonding
    <div key="s3">
      <SectionHead label="d) Neutral Earth Bonding Connection Attestation" accent={ACCENT} />

      <div style={{ marginBottom: 18 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase',
          letterSpacing: '0.06em', marginBottom: 12,
        }}>Pole Mounted Transformers</div>

        {[
          { k: 'dPoleBushing',     label: 'Transformer neutral bushing connected to the earth/neutral bar?',                showNA: false },
          { k: 'dPoleNeutralCond', label: 'Transformer neutral bushing connected to each distribution neutral conductor?',  showNA: true  },
          { k: 'dPoleEarth',       label: 'Each overhead neutral conductor connected to earth? (2nd MEN — if applicable)',  showNA: false },
        ].map(({ k, label, showNA }) => (
          <div key={k} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 6, lineHeight: 1.4 }}>{label}</div>
            <YesNoSelect
              value={d[k]}
              onChange={v => setD(p => ({ ...p, [k]: v }))}
              showNA={showNA}
            />
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: '#eee', marginBottom: 14 }} />

      <div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase',
          letterSpacing: '0.06em', marginBottom: 12,
        }}>Ground Mounted Transformers</div>
        <div style={{ fontSize: 13, color: '#374151', marginBottom: 6, lineHeight: 1.4 }}>
          Transformer neutral bushing connected to the earth/neutral bar?
        </div>
        <YesNoSelect
          value={d.dGroundBushing}
          onChange={v => setD(p => ({ ...p, dGroundBushing: v }))}
          showNA={false}
        />
      </div>
    </div>,

    // 4 — HV-Fuse Checks
    <div key="s4">
      <SectionHead label="e) Pre HV-Fuse Insertion Checks" accent={ACCENT} />
      <ConfirmToggle
        label="LV is isolated from the local LV distribution network"
        confirmed={d.eLvIsolated}
        onToggle={() => toggleBool('eLvIsolated')}
      />
      <ConfirmToggle
        label="HV Fuse Rating and Size is correct for the site (per 393S024 Network Fuse Protection Standard)"
        confirmed={d.eHvFuseCorrect}
        onToggle={() => toggleBool('eHvFuseCorrect')}
      />
      <ConfirmToggle
        label="HV Fuses inserted and transformer has been energised"
        confirmed={d.eHvFusesInserted}
        onToggle={() => toggleBool('eHvFusesInserted')}
      />
      <div style={{ marginTop: 10 }}>
        <WF label="HV Fuse Size Installed (A)" v={d.eHvFuseSize} set={set('eHvFuseSize')} accent={ACCENT} ph="e.g. 100" />
      </div>
    </div>,

    // 5 — Voltage Tests
    <div key="s5">
      <SectionHead label="f) OFF LOAD Voltage Checks" accent={ACCENT} />
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>
        Measured at source/supply side of OPEN LV Fuse Base.
        Enter readings for each circuit, then confirm results are within the acceptable range.
      </p>
      {VOLT_ROWS.map((rowDef, rowIdx) => (
        <VoltageRow
          key={rowDef.key}
          rowDef={rowDef}
          values={d[rowDef.key]}
          onChangeCircuit={(ci, val) => setVolt(rowDef.key, ci, val)}
          confirmed={d.fConfirmed[rowIdx]}
          onConfirm={() => toggleFConfirmed(rowIdx)}
        />
      ))}
      <div style={{ marginTop: 4 }}>
        <WF label="As Left Transformer Tap Setting" v={d.fTapSetting} set={set('fTapSetting')} accent={ACCENT} ph="e.g. 0%" />
      </div>
    </div>,

    // 6 — LV & Phase Rotation
    <div key="s6">
      <SectionHead label="g) Pre LV-Fuse Insertion Checks" accent={ACCENT} />
      <ConfirmToggle
        label="LV Fuse Rating/s and Size/s correct for this site (per 393S024 Network Fuse Protection Standard)"
        confirmed={d.gLvFuseCorrect}
        onToggle={() => toggleBool('gLvFuseCorrect')}
      />

      <div style={{ height: 1, background: '#eee', margin: '16px 0 14px' }} />

      <SectionHead label="h) Phase Rotation Checks" accent={ACCENT} />
      <div style={{
        background: '#fef3c7', border: '1px solid #f59e0b',
        borderRadius: 8, padding: '8px 12px', marginBottom: 12,
        fontSize: 12, color: '#92400e', lineHeight: 1.4,
      }}>
        ⚠️ Only required when connecting to a De-energised LV network.
        Leave unticked if not applicable.
      </div>
      <ConfirmToggle
        label="Phase rotation matches pre-transformer removal checks (if available)"
        confirmed={d.hPhaseRotation}
        onToggle={() => toggleBool('hPhaseRotation')}
      />
      <ConfirmToggle
        label="Correct rotation of any consumer three-phase load confirmed (if available)"
        confirmed={d.hConsumerRotation}
        onToggle={() => toggleBool('hConsumerRotation')}
      />
    </div>,

    // 7 — Phasing / Paralleling
    <div key="s7">
      <SectionHead label="i) Phasing In / Paralleling Checks" accent={ACCENT} />
      <div style={{
        background: '#fef3c7', border: '1px solid #f59e0b',
        borderRadius: 8, padding: '8px 12px', marginBottom: 12,
        fontSize: 12, color: '#92400e', lineHeight: 1.4,
      }}>
        ⚠️ Only required when connecting to an Energised LV network where supply to LV
        customers has been maintained through open points. Skip if not applicable.
      </div>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px' }}>
        After confirming both circuits are alive, measure across the paralleling device.
        Acceptable result: &lt;10 V.
      </p>

      {PHASING_ROWS.map((rowDef, rowIdx) => (
        <div key={rowDef.key} style={{
          background: '#fff', border: '1.5px solid #e5e7eb',
          borderRadius: 10, padding: '11px 12px 8px', marginBottom: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>{rowDef.label}</span>
            <span style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>{rowDef.acceptable}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5, marginBottom: 8 }}>
            {d[rowDef.key].map((v, ci) => (
              <div key={ci}>
                <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', marginBottom: 2 }}>
                  Circuit {ci + 1}
                </div>
                <input
                  type="text" inputMode="decimal" value={v} placeholder="—"
                  onChange={e => setPhasing(rowDef.key, ci, e.target.value)}
                  style={circInp}
                />
              </div>
            ))}
          </div>
          <button onClick={() => toggleIConfirmed(rowIdx)} style={{
            width: '100%', padding: '7px 0', borderRadius: 7,
            border: `1.5px solid ${d.iConfirmed[rowIdx] ? ACCENT : '#e5e7eb'}`,
            background: d.iConfirmed[rowIdx] ? ACCENT + '12' : '#f9fafb',
            color: d.iConfirmed[rowIdx] ? ACCENT : '#9ca3af',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            {d.iConfirmed[rowIdx] ? '✓ Results Confirmed' : 'Mark Results Confirmed'}
          </button>
        </div>
      ))}

      {/* Neutrals connected — one checkbox per circuit */}
      <div style={{
        background: '#fff', border: '1.5px solid #e5e7eb',
        borderRadius: 10, padding: '11px 12px', marginBottom: 8,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, marginBottom: 10 }}>
          Neutrals Connected (✓)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5 }}>
          {d.iNeutrals.map((checked, ci) => (
            <button key={ci} onClick={() => toggleNeutral(ci)} style={{
              padding: '11px 0', borderRadius: 7,
              border: `1.5px solid ${checked ? ACCENT : '#e5e7eb'}`,
              background: checked ? ACCENT : '#fff',
              color: checked ? '#fff' : '#374151',
              fontFamily: 'inherit', fontSize: 12,
              fontWeight: checked ? 700 : 400, cursor: 'pointer',
            }}>
              <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }}>Circuit {ci + 1}</div>
              {checked ? '✓' : '○'}
            </button>
          ))}
        </div>
      </div>
    </div>,

    // 8 — Loop Impedance
    <div key="s8">
      <SectionHead label="j) Loop Impedance Tests" accent={ACCENT} />
      <div style={{
        background: '#f0fdf4', border: '1px solid #86efac',
        borderRadius: 8, padding: '8px 12px', marginBottom: 12,
        fontSize: 12, color: '#166534', lineHeight: 1.4,
      }}>
        Acceptable: &lt;0.2 Ω — confirms all connections to the transformer are electrically sound.
        Refer 220S047 Loop Impedance Testing Standard.
      </div>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 14px' }}>
        Measured at source/supply side of LV fuses near the transformer.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 14px' }}>
        <WF label="R to W (Ω)" v={d.jRW} set={set('jRW')} accent={ACCENT} ph="0.00" />
        <WF label="R to B (Ω)" v={d.jRB} set={set('jRB')} accent={ACCENT} ph="0.00" />
        <WF label="W to B (Ω)" v={d.jWB} set={set('jWB')} accent={ACCENT} ph="0.00" />
        <WF label="R to N (Ω)" v={d.jRN} set={set('jRN')} accent={ACCENT} ph="0.00" />
        <WF label="W to N (Ω)" v={d.jWN} set={set('jWN')} accent={ACCENT} ph="0.00" />
        <WF label="B to N (Ω)" v={d.jBN} set={set('jBN')} accent={ACCENT} ph="0.00" />
      </div>
    </div>,

    // 9 — Open Points & Sign-off
    <div key="s9">
      <SectionHead label="k) LV Open Point Restoration" accent={ACCENT} />
      <div style={{
        background: '#fef3c7', border: '1px solid #f59e0b',
        borderRadius: 8, padding: '8px 12px', marginBottom: 12,
        fontSize: 12, color: '#92400e', lineHeight: 1.4,
      }}>
        ⚠️ Only required when connecting to an Energised LV Network.
      </div>
      {d.kPoints.map((pt, idx) => (
        <div key={idx} style={{
          background: '#fff', border: '1.5px solid #e5e7eb',
          borderRadius: 10, padding: '11px 12px', marginBottom: 8,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>
            LV Open Point {idx + 1}
          </div>
          <WF
            label="Location"
            v={pt.location}
            set={v => setOpenPoint(idx, 'location', v)}
            accent={ACCENT}
            ph="e.g. Feeder pillar at 12 Smith Street"
          />
          <button onClick={() => setOpenPoint(idx, 'restored', !pt.restored)} style={{
            width: '100%', padding: '8px 0', borderRadius: 7, marginTop: 2,
            border: `1.5px solid ${pt.restored ? ACCENT : '#e5e7eb'}`,
            background: pt.restored ? ACCENT + '12' : '#f9fafb',
            color: pt.restored ? ACCENT : '#9ca3af',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            {pt.restored ? '✓ Restored to Original Status' : 'Mark as Restored'}
          </button>
        </div>
      ))}

      <div style={{ height: 1, background: '#eee', margin: '16px 0 14px' }} />

      <SectionHead label="l) Testing Attestation" accent={ACCENT} />
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px', lineHeight: 1.5 }}>
        I certify that the work to which this certificate applies has been done lawfully and
        safely and that the information in this certificate is correct and that the equipment
        is safe to energise.
      </p>
      <WF label="Print Name"     v={d.namePrint} set={set('namePrint')} accent={ACCENT} />
      <WF label="ISN ID Number"  v={d.isnId}     set={set('isnId')}     accent={ACCENT} ph="e.g. ISN12345" />
      {d.signed ? (
        <div style={{
          background: ACCENT + '12', border: `1.5px solid ${ACCENT}40`,
          borderRadius: 8, padding: '10px 14px', fontSize: 13, color: ACCENT, fontWeight: 600,
        }}>
          ✓ Signature loaded from My Details
        </div>
      ) : (
        <div style={{
          background: '#fef3c7', border: '1px solid #f59e0b',
          borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e', lineHeight: 1.4,
        }}>
          ⚠️ No signature saved — tap the ⚙️ icon in the app header to add your signature in My Details
        </div>
      )}
    </div>,

    // 10 — Photos
    <div key="s10">
      <PhotoAttachStep photos={photos} onChange={setPhotos} accent={ACCENT} />
    </div>,

    // 11 — Preview & Print (placeholder — WizardShell handles the PDF overlay)
    <div key="s11" />,
  ]

  const previewContent = buildPreviewContent(
    () => triggerGenerate(d, photos),
    ACCENT,
  )

  return (
    <>
      <WizardShell
        title={FORM_LABEL}
        formNumber={FORM_KEY}
        headerIcon={<Zap size={22} color="#fff" style={{ flexShrink: 0 }} />}
        steps={B_STEPS}
        step={step}
        onStepClick={i => {
          setStep(i)
          if (i === B_STEPS.length - 1) triggerGenerate(d, photos)
        }}
        onClose={onClose}
        onBack={() => setStep(s => s - 1)}
        onSaveDraft={openSave}
        onFillTestData={handleDevFill}
        onNext={() => {
          const n = step + 1
          setStep(n)
          if (n === B_STEPS.length - 1) triggerGenerate(d, photos)
        }}
        accent={ACCENT}
        bg={B_BG}
        mid={B_MID}
        border={B_BORDER}
        isPreview={isPreview}
        onShare={handleShare}
        onClosePreview={() => { setStep(s => s - 1); clearPdf() }}
        missingFields={missingFields}
        previewContent={previewContent}
      >
        {formSteps[step]}
      </WizardShell>

      <DraftPicker {...draftPickerProps} />
    </>
  )
}
