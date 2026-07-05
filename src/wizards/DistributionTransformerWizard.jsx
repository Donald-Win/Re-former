// 220F028B — Distribution Transformer Commissioning Certificate
import { useState } from 'react'
import { Zap } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { APP_ACCENT, WIZARD_COLORS } from '../shared/constants'
import { WF, SectionHead } from '../shared/WizardInputs'
import { PhotoAttachStep } from '../shared/PhotoAttachStep'
import { sharePdf, buildPdfFilename } from '../shared/sharePdf'
import { getUserPrefs, getBaseFormState } from '../shared/userPrefs'
import { JobDetailsStep } from '../shared/JobDetailsStep'
import { usePdfGenerate } from '../shared/usePdfGenerate'
import { useWizardSetup } from '../shared/useWizardSetup'
import { useDraft } from '../shared/useDraft'
import { DraftPicker } from '../shared/DraftPicker'
import { useDraftPicker } from '../shared/useDraftPicker'
import { createWorkerGenerator } from '../shared/pdfWorkerClient'
import {
  VOLT_MEASUREMENTS,
  PHASING_MEASUREMENTS,
  EARTH_LIMITS,
  LOOP_LIMIT,
  voltRange,
  phasingRange,
  earthRange,
  loopRange,
  voltRowStatus,
  phasingRowStatus,
} from './generators/DistributionTransformerLimits'

// ── PDF generation now runs off the main thread via the shared PDF worker ────
const generateB28Pdf = createWorkerGenerator('DistributionTransformerPdfGenerator', 'generateB28Pdf')

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

// ── Empty circuit factories ───────────────────────────────────────────────────
// No 'confirmed' field — confirmation is computed per row at PDF generation time
// based on which measurements the tech actually entered.

const emptyVoltCircuit    = () => ({ rw: '', wb: '', br: '', rn: '', wn: '', bn: '' })
const emptyPhasingCircuit = () => ({ r1r2: '', w1w2: '', b1b2: '', neutral: false })

// Range-checking helpers (voltRange, phasingRange, earthRange, loopRange,
// voltRowStatus, phasingRowStatus) and their constants now live in
// ./generators/DistributionTransformerLimits — imported above — so the
// wizard's live UI feedback and the PDF generator's tick/cross marks always
// agree on the same thresholds.

// ── Initial state ─────────────────────────────────────────────────────────────

const initState = () => {
  const prefs = getUserPrefs()
  return getBaseFormState({
    transformerNo: '',
    // contractorRefNo removed — auto-populated from npJobNumber in the PDF generator

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
    dPoleBushing:     '', // 'Yes' | 'No'
    dPoleNeutralCond: '', // 'Yes' | 'No' | 'NA'
    dPoleEarth:       '', // 'Yes' | 'No'
    // d) Ground mounted
    dGroundBushing:   '', // 'Yes' | 'No'

    // e) Pre HV-Fuse Checks
    eLvIsolated:      false,
    eHvFuseCorrect:   false,
    eHvFusesInserted: false,
    eHvFuseSize:      '',

    // f) Off-Load Voltage Checks — circuit-centric, start with 1 circuit
    fCircuits:   [emptyVoltCircuit()],
    fTapSetting: '',

    // g) Pre LV-Fuse Checks
    gLvFuseCorrect: false,

    // h) Phase Rotation Checks
    hPhaseRotation:    false,
    hConsumerRotation: false,

    // i) Phasing / Paralleling — circuit-centric, start with 1 circuit
    iCircuits: [emptyPhasingCircuit()],

    // j) Loop Impedance Tests
    jRW: '', jRB: '', jWB: '',
    jRN: '', jWN: '', jBN: '',

    // k) LV Open Point Restoration — start with 1, user adds more
    kPoints: [{ location: '', restored: false }],

    // l) Testing Attestation — 100% from user prefs (no in-form editing)
    isnId: prefs.isnId || '',
    // namePrint and signed come from getBaseFormState (loaded from user prefs)
  })
}

// ── Shared range-indicator styles ─────────────────────────────────────────────

const rangeInpStyle = (status, base) => ({
  ...base,
  borderColor: status === false ? '#ef4444' : status === true ? '#16a34a' : '#e5e7eb',
  background:  status === false ? '#fef2f2' : status === true ? '#f0fdf4' : '#fff',
})

function RangeTag({ status, acceptable }) {
  if (status === null) return (
    <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', minWidth: 68, textAlign: 'right' }}>
      {acceptable}
    </span>
  )
  if (status === true) return (
    <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 700, minWidth: 68, textAlign: 'right' }}>✓</span>
  )
  return (
    <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, whiteSpace: 'nowrap', minWidth: 68, textAlign: 'right', lineHeight: 1.2 }}>
      ✗ {acceptable}
    </span>
  )
}

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

// ── EarthField — labelled input with automatic ≤ limit range indicator ────────

function EarthField({ label, fieldKey, value, onChange, ph, accent }) {
  const status = earthRange(fieldKey, value)
  const baseInp = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    fontFamily: 'inherit', fontSize: 14, outline: 'none', boxSizing: 'border-box',
    border: `1.5px solid ${status === false ? '#ef4444' : status === true ? '#16a34a' : (accent + '60')}`,
    background: status === false ? '#fef2f2' : status === true ? '#f0fdf4' : '#fff',
  }
  const limit = EARTH_LIMITS[fieldKey]
  return (
    <div style={{ marginBottom: 2 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, marginBottom: 4,
        textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
        {limit !== undefined && (
          <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>
            (limit ≤ {limit} Ω)
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="text" inputMode="decimal"
          value={value} placeholder={ph || '—'}
          onChange={e => onChange(e.target.value)}
          style={baseInp}
        />
        {status !== null && (
          <span style={{
            fontSize: 18, fontWeight: 700, flexShrink: 0,
            color: status ? '#16a34a' : '#ef4444',
          }}>
            {status ? '✓' : '✗'}
          </span>
        )}
      </div>
      {status === false && (
        <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginTop: 3 }}>
          Result exceeds limit — check connection and retest
        </div>
      )}
    </div>
  )
}

// ── LoopField — labelled input with automatic < 0.2 Ω range indicator ─────────

function LoopField({ label, value, onChange }) {
  const status = loopRange(value)
  const inp = {
    width: '100%', padding: '9px 10px', borderRadius: 7,
    fontFamily: 'inherit', fontSize: 14, outline: 'none', boxSizing: 'border-box',
    border: `1.5px solid ${status === false ? '#ef4444' : status === true ? '#16a34a' : '#e5e7eb'}`,
    background: status === false ? '#fef2f2' : status === true ? '#f0fdf4' : '#fff',
  }
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4,
        textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="text" inputMode="decimal"
          value={value} placeholder="0.00"
          onChange={e => onChange(e.target.value)}
          style={inp}
        />
        {status !== null && (
          <span style={{ fontSize: 16, fontWeight: 700, flexShrink: 0,
            color: status ? '#16a34a' : '#ef4444' }}>
            {status ? '✓' : '✗'}
          </span>
        )}
      </div>
    </div>
  )
}

// ── VoltageCircuit — circuit-centric card, per-row range feedback ─────────────

function VoltageCircuit({ circIdx, data, onChangeField, onRemove, canRemove }) {
  const hasAnyOut = VOLT_MEASUREMENTS.some(m => voltRange(m.key, data[m.key]) === false)
  const hasAnyIn  = VOLT_MEASUREMENTS.some(m => voltRange(m.key, data[m.key]) === true)
  const allEnteredIn = hasAnyIn && !hasAnyOut

  const cardBorder = hasAnyOut ? '#fca5a5' : allEnteredIn ? '#86efac' : '#e5e7eb'
  const cardBg     = hasAnyOut ? '#fff5f5' : allEnteredIn ? '#f0fdf4' : '#fff'

  const baseInp = {
    flex: 1, padding: '9px 10px', borderRadius: 7, fontFamily: 'inherit',
    fontSize: 14, outline: 'none', boxSizing: 'border-box', minWidth: 0,
  }

  return (
    <div style={{
      background: cardBg, border: `1.5px solid ${cardBorder}`,
      borderRadius: 10, padding: '12px 12px 10px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Circuit {circIdx + 1}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {allEnteredIn && (
            <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>✓ All in range</span>
          )}
          {canRemove && (
            <button onClick={onRemove} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#ef4444', fontSize: 13, fontWeight: 700,
              padding: '2px 6px', borderRadius: 6, fontFamily: 'inherit',
            }}>✕ Remove</button>
          )}
        </div>
      </div>

      {VOLT_MEASUREMENTS.map(m => {
        const status = voltRange(m.key, data[m.key])
        return (
          <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT, minWidth: 48 }}>{m.label}</span>
            <input
              type="text" inputMode="decimal"
              value={data[m.key]} placeholder="—"
              onChange={e => onChangeField(m.key, e.target.value)}
              style={rangeInpStyle(status, baseInp)}
            />
            <RangeTag status={status} acceptable={m.acceptable} />
          </div>
        )
      })}

      <div style={{
        marginTop: 6, padding: '7px 10px', borderRadius: 7,
        background: hasAnyOut ? '#fee2e2' : allEnteredIn ? '#dcfce7' : '#f9fafb',
        border: `1px solid ${hasAnyOut ? '#fca5a5' : allEnteredIn ? '#86efac' : '#e5e7eb'}`,
        fontSize: 12, fontWeight: 600,
        color: hasAnyOut ? '#dc2626' : allEnteredIn ? '#15803d' : '#9ca3af',
      }}>
        {hasAnyOut
          ? '✗ One or more readings are outside the acceptable range'
          : allEnteredIn
            ? '✓ All entered readings are within the acceptable range'
            : 'Each row is confirmed automatically once a valid reading is entered'}
      </div>
    </div>
  )
}

// ── PhasingCircuit — circuit-centric card, per-row range feedback ─────────────

function PhasingCircuit({ circIdx, data, onChangeField, onToggleNeutral, onRemove, canRemove }) {
  const hasAnyOut = PHASING_MEASUREMENTS.some(m => phasingRange(data[m.key]) === false)
  const hasAnyIn  = PHASING_MEASUREMENTS.some(m => phasingRange(data[m.key]) === true)
  const allEnteredIn = hasAnyIn && !hasAnyOut

  const cardBorder = hasAnyOut ? '#fca5a5' : allEnteredIn ? '#86efac' : '#e5e7eb'
  const cardBg     = hasAnyOut ? '#fff5f5' : allEnteredIn ? '#f0fdf4' : '#fff'

  const baseInp = {
    flex: 1, padding: '9px 10px', borderRadius: 7, fontFamily: 'inherit',
    fontSize: 14, outline: 'none', boxSizing: 'border-box', minWidth: 0,
  }

  return (
    <div style={{
      background: cardBg, border: `1.5px solid ${cardBorder}`,
      borderRadius: 10, padding: '12px 12px 10px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Circuit {circIdx + 1}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {allEnteredIn && (
            <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>✓ All in range</span>
          )}
          {canRemove && (
            <button onClick={onRemove} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#ef4444', fontSize: 13, fontWeight: 700,
              padding: '2px 6px', borderRadius: 6, fontFamily: 'inherit',
            }}>✕ Remove</button>
          )}
        </div>
      </div>

      {PHASING_MEASUREMENTS.map(m => {
        const status = phasingRange(data[m.key])
        return (
          <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT, minWidth: 60 }}>{m.label}</span>
            <input
              type="text" inputMode="decimal"
              value={data[m.key]} placeholder="—"
              onChange={e => onChangeField(m.key, e.target.value)}
              style={rangeInpStyle(status, baseInp)}
            />
            <RangeTag status={status} acceptable={m.acceptable} />
          </div>
        )
      })}

      {/* Neutral Connected toggle */}
      <button onClick={onToggleNeutral} style={{
        width: '100%', padding: '10px 14px', borderRadius: 10, marginTop: 6, marginBottom: 6,
        border: `2px solid ${data.neutral ? ACCENT : '#e5e7eb'}`,
        background: data.neutral ? ACCENT + '12' : '#fff',
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          background: data.neutral ? ACCENT : '#f3f4f6',
          border: `2px solid ${data.neutral ? ACCENT : '#d1d5db'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: data.neutral ? '#fff' : 'transparent', fontWeight: 700,
        }}>✓</span>
        <span style={{
          fontSize: 13, lineHeight: 1.45,
          fontWeight: data.neutral ? 600 : 400,
          color: data.neutral ? '#111827' : '#374151',
        }}>Neutral Connected</span>
      </button>

      <div style={{
        padding: '7px 10px', borderRadius: 7,
        background: hasAnyOut ? '#fee2e2' : allEnteredIn ? '#dcfce7' : '#f9fafb',
        border: `1px solid ${hasAnyOut ? '#fca5a5' : allEnteredIn ? '#86efac' : '#e5e7eb'}`,
        fontSize: 12, fontWeight: 600,
        color: hasAnyOut ? '#dc2626' : allEnteredIn ? '#15803d' : '#9ca3af',
      }}>
        {hasAnyOut
          ? '✗ One or more readings are outside the acceptable range'
          : allEnteredIn
            ? '✓ All entered readings are within the acceptable range'
            : 'Each row is confirmed automatically once a valid reading is entered'}
      </div>
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
    usePdfGenerate(generateB28Pdf)

  const { set, handleDevFill } = useWizardSetup(d, setD, step, FORM_KEY)
  const { clearDraft: clearFormDraft } = useDraft(FORM_KEY, d, step, photos)

  // ── State helpers ─────────────────────────────────────────────────────────

  const toggleBool = k => setD(p => ({ ...p, [k]: !p[k] }))

  // Voltage circuits (section f) — range status computed at PDF time, not stored
  const setVoltField = (circIdx, field, val) => setD(prev => ({
    ...prev,
    fCircuits: prev.fCircuits.map((c, i) => i === circIdx ? { ...c, [field]: val } : c),
  }))
  const addVoltCircuit = () => setD(prev => ({
    ...prev,
    fCircuits: [...prev.fCircuits, emptyVoltCircuit()],
  }))
  const removeVoltCircuit = circIdx => setD(prev => ({
    ...prev,
    fCircuits: prev.fCircuits.filter((_, i) => i !== circIdx),
  }))

  // Phasing circuits (section i) — range status computed at PDF time, not stored
  const setPhasingField = (circIdx, field, val) => setD(prev => ({
    ...prev,
    iCircuits: prev.iCircuits.map((c, i) => i === circIdx ? { ...c, [field]: val } : c),
  }))
  const togglePhasingNeutral = circIdx => setD(prev => ({
    ...prev,
    iCircuits: prev.iCircuits.map((c, i) => i === circIdx ? { ...c, neutral: !c.neutral } : c),
  }))
  const addPhasingCircuit = () => setD(prev => ({
    ...prev,
    iCircuits: [...prev.iCircuits, emptyPhasingCircuit()],
  }))
  const removePhasingCircuit = circIdx => setD(prev => ({
    ...prev,
    iCircuits: prev.iCircuits.filter((_, i) => i !== circIdx),
  }))

  // Open points (section k)
  const setOpenPoint = (idx, field, val) => setD(prev => ({
    ...prev,
    kPoints: prev.kPoints.map((p, i) => i === idx ? { ...p, [field]: val } : p),
  }))
  const addOpenPoint = () => setD(prev => ({
    ...prev,
    kPoints: [...prev.kPoints, { location: '', restored: false }],
  }))
  const removeOpenPoint = idx => setD(prev => ({
    ...prev,
    kPoints: prev.kPoints.filter((_, i) => i !== idx),
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

  // ── Form steps ────────────────────────────────────────────────────────────

  const renderCurrentStep = () => {
    switch (step) {
      case 0: return (
        // contractorRefNo removed — auto-populated from npJobNumber in the PDF
        <JobDetailsStep key="s0" d={d} setD={setD} accent={ACCENT} onOpenDrafts={openLoad}>
          <div style={{ height: 1, background: '#eee', margin: '14px 0' }} />
          <SectionHead label="Transformer Identification" accent={ACCENT} />
          <WF label="Transformer No." v={d.transformerNo} set={set('transformerNo')} accent={ACCENT} ph="e.g. TX-456" />
        </JobDetailsStep>
      )

      case 1: return (
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
        </div>
      )

      case 2: return (
        // 2 — Earthing & Phases
        <div key="s2">
          <SectionHead label="b) Earthing Equipment Testing Verification" accent={ACCENT} />
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac',
            borderRadius: 8, padding: '8px 12px', marginBottom: 14,
            fontSize: 12, color: '#166534', lineHeight: 1.4,
          }}>
            Results must be <strong>below</strong> the limits shown. ✓ appears automatically when within range.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <EarthField label="Earth Electrode — Leg 1" fieldKey="earthLeg1" value={d.earthLeg1} onChange={v => set('earthLeg1')(v)} ph="e.g. 4.2" accent={ACCENT} />
            <EarthField label="Earth Electrode — Leg 2" fieldKey="earthLeg2" value={d.earthLeg2} onChange={v => set('earthLeg2')(v)} ph="e.g. 3.8" accent={ACCENT} />
            <EarthField label="Total MEN — Urban"       fieldKey="menUrban"  value={d.menUrban}  onChange={v => set('menUrban')(v)}  ph="e.g. 2.1" accent={ACCENT} />
            <EarthField label="Total MEN — Rural"       fieldKey="menRural"  value={d.menRural}  onChange={v => set('menRural')(v)}  ph="e.g. 12.5" accent={ACCENT} />
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
        </div>
      )

      case 3: return (
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
                <YesNoSelect value={d[k]} onChange={v => setD(p => ({ ...p, [k]: v }))} showNA={showNA} />
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
            <YesNoSelect value={d.dGroundBushing} onChange={v => setD(p => ({ ...p, dGroundBushing: v }))} showNA={false} />
          </div>
        </div>
      )

      case 4: return (
        // 4 — HV-Fuse Checks
        <div key="s4">
          <SectionHead label="e) Pre HV-Fuse Insertion Checks" accent={ACCENT} />
          <ConfirmToggle label="LV is isolated from the local LV distribution network" confirmed={d.eLvIsolated} onToggle={() => toggleBool('eLvIsolated')} />
          <ConfirmToggle label="HV Fuse Rating and Size is correct for the site (per 393S024 Network Fuse Protection Standard)" confirmed={d.eHvFuseCorrect} onToggle={() => toggleBool('eHvFuseCorrect')} />
          <ConfirmToggle label="HV Fuses inserted and transformer has been energised" confirmed={d.eHvFusesInserted} onToggle={() => toggleBool('eHvFusesInserted')} />
          <div style={{ marginTop: 10 }}>
            <WF label="HV Fuse Size Installed (A)" v={d.eHvFuseSize} set={set('eHvFuseSize')} accent={ACCENT} ph="e.g. 100" />
          </div>
        </div>
      )

      case 5: return (
        // 5 — Voltage Tests (circuit-centric, auto-confirm)
        <div key="s5">
          <SectionHead label="f) OFF LOAD Voltage Checks" accent={ACCENT} />
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>
            Measured at source/supply side of OPEN LV Fuse Base.
            Readings are automatically confirmed when all six are within the acceptable range.
          </p>
          {(d.fCircuits || []).map((circ, i) => (
            <VoltageCircuit
              key={i}
              circIdx={i}
              data={circ}
              onChangeField={(field, val) => setVoltField(i, field, val)}
              onRemove={() => removeVoltCircuit(i)}
              canRemove={(d.fCircuits || []).length > 1}
            />
          ))}
          {(d.fCircuits || []).length < 4 && (
            <button onClick={addVoltCircuit} style={{
              width: '100%', padding: '10px 0', marginTop: 2, borderRadius: 8,
              border: `2px dashed ${ACCENT}`, background: B_BG,
              color: ACCENT, fontWeight: 700, fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              + Add Circuit {(d.fCircuits || []).length + 1}
            </button>
          )}
          <div style={{ marginTop: 12 }}>
            <WF label="As Left Transformer Tap Setting" v={d.fTapSetting} set={set('fTapSetting')} accent={ACCENT} ph="e.g. 0%" />
          </div>
        </div>
      )

      case 6: return (
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
            ⚠️ Only required when connecting to a De-energised LV network. Leave unticked if not applicable.
          </div>
          <ConfirmToggle label="Phase rotation matches pre-transformer removal checks (if available)" confirmed={d.hPhaseRotation} onToggle={() => toggleBool('hPhaseRotation')} />
          <ConfirmToggle label="Correct rotation of any consumer three-phase load confirmed (if available)" confirmed={d.hConsumerRotation} onToggle={() => toggleBool('hConsumerRotation')} />
        </div>
      )

      case 7: return (
        // 7 — Phasing / Paralleling (circuit-centric, auto-confirm, neutral per circuit)
        <div key="s7">
          <SectionHead label="i) Phasing In / Paralleling Checks" accent={ACCENT} />
          <div style={{
            background: '#fef3c7', border: '1px solid #f59e0b',
            borderRadius: 8, padding: '8px 12px', marginBottom: 12,
            fontSize: 12, color: '#92400e', lineHeight: 1.4,
          }}>
            ⚠️ Only required when connecting to an Energised LV network. Skip if not applicable.
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px' }}>
            After confirming both circuits are alive, measure across the paralleling device.
            Readings are automatically confirmed when all three are &lt;10 V.
          </p>
          {(d.iCircuits || []).map((circ, i) => (
            <PhasingCircuit
              key={i}
              circIdx={i}
              data={circ}
              onChangeField={(field, val) => setPhasingField(i, field, val)}
              onToggleNeutral={() => togglePhasingNeutral(i)}
              onRemove={() => removePhasingCircuit(i)}
              canRemove={(d.iCircuits || []).length > 1}
            />
          ))}
          {(d.iCircuits || []).length < 4 && (
            <button onClick={addPhasingCircuit} style={{
              width: '100%', padding: '10px 0', marginTop: 2, borderRadius: 8,
              border: `2px dashed ${ACCENT}`, background: B_BG,
              color: ACCENT, fontWeight: 700, fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              + Add Circuit {(d.iCircuits || []).length + 1}
            </button>
          )}
        </div>
      )

      case 8: return (
        // 8 — Loop Impedance (with auto range indicators)
        <div key="s8">
          <SectionHead label="j) Loop Impedance Tests" accent={ACCENT} />
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac',
            borderRadius: 8, padding: '8px 12px', marginBottom: 12,
            fontSize: 12, color: '#166534', lineHeight: 1.4,
          }}>
            Acceptable: &lt;0.2 Ω — ✓ appears automatically when each reading is within range.
            Refer 220S047 Loop Impedance Testing Standard.
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 14px' }}>
            Measured at source/supply side of LV fuses near the transformer.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 14px' }}>
            <LoopField label="R to W (Ω)" value={d.jRW} onChange={set('jRW')} />
            <LoopField label="R to B (Ω)" value={d.jRB} onChange={set('jRB')} />
            <LoopField label="W to B (Ω)" value={d.jWB} onChange={set('jWB')} />
            <LoopField label="R to N (Ω)" value={d.jRN} onChange={set('jRN')} />
            <LoopField label="W to N (Ω)" value={d.jWN} onChange={set('jWN')} />
            <LoopField label="B to N (Ω)" value={d.jBN} onChange={set('jBN')} />
          </div>
        </div>
      )

      case 9: return (
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
          {(d.kPoints || []).map((pt, idx) => (
            <div key={idx} style={{
              background: '#fff', border: '1.5px solid #e5e7eb',
              borderRadius: 10, padding: '11px 12px', marginBottom: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>
                  LV Open Point {idx + 1}
                </div>
                {(d.kPoints || []).length > 1 && (
                  <button onClick={() => removeOpenPoint(idx)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#ef4444', fontSize: 13, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 6, fontFamily: 'inherit',
                  }}>✕ Remove</button>
                )}
              </div>
              <WF
                label="Location" v={pt.location}
                set={v => setOpenPoint(idx, 'location', v)}
                accent={ACCENT} ph="e.g. Feeder pillar at 12 Smith Street"
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
          {(d.kPoints || []).length < 4 && (
            <button onClick={addOpenPoint} style={{
              width: '100%', padding: '10px 0', marginTop: 2, marginBottom: 8, borderRadius: 8,
              border: `2px dashed ${ACCENT}`, background: B_BG,
              color: ACCENT, fontWeight: 700, fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              + Add Open Point
            </button>
          )}

          <div style={{ height: 1, background: '#eee', margin: '16px 0 14px' }} />

          {/* l) Testing Attestation — 100% from user settings, no in-form editing */}
          <SectionHead label="l) Testing Attestation" accent={ACCENT} />
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>
            I certify that the work to which this certificate applies has been done lawfully and
            safely and that the information in this certificate is correct and that the equipment
            is safe to energise.
          </p>

          <div style={{
            background: '#fff', border: '1.5px solid #e5e7eb',
            borderRadius: 10, overflow: 'hidden', marginBottom: 12,
          }}>
            {[
              { label: 'Name',      value: d.namePrint },
              { label: 'ISN ID',    value: d.isnId },
            ].map(({ label, value }, i, arr) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 14px',
                borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none',
              }}>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, minWidth: 60 }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: value ? '#111827' : '#d1d5db' }}>
                  {value || '—'}
                </span>
              </div>
            ))}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 14px', borderTop: '1px solid #f3f4f6',
            }}>
              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, minWidth: 60 }}>Signature</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: d.signed ? '#16a34a' : '#d1d5db' }}>
                {d.signed ? '✓ Saved' : '—'}
              </span>
            </div>
          </div>

          {(!d.namePrint || !d.isnId || !d.signed) ? (
            <div style={{
              background: '#fef3c7', border: '1px solid #f59e0b',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e', lineHeight: 1.5,
            }}>
              ⚠️ Some details are missing — tap ⚙️ in the app header to complete your My Details
            </div>
          ) : (
            <div style={{
              background: ACCENT + '12', border: `1.5px solid ${ACCENT}40`,
              borderRadius: 8, padding: '10px 14px', fontSize: 13, color: ACCENT, fontWeight: 600,
            }}>
              ✓ All attestation details loaded from My Details
            </div>
          )}
        </div>
      )

      case 10: return (
        // 10 — Photos
        <div key="s10">
          <PhotoAttachStep photos={photos} onChange={setPhotos} accent={ACCENT} />
        </div>
      )

      case 11: return null

      default: return null
    }
  }

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
        calibrationPdfUrl={import.meta.env.DEV ? `${import.meta.env.BASE_URL}forms/220F028B.pdf` : undefined}
        calibrationPageCount={import.meta.env.DEV ? 4 : undefined}
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
        {renderCurrentStep()}
      </WizardShell>

      <DraftPicker {...draftPickerProps} />
    </>
  )
}
