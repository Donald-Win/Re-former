/**
 * HVInspectionWizard — 220F028A Pre-Commissioning HV Inspection Certificate
 *
 * Steps:
 *   0. Job Details
 *   1. Equipment Types (select which apply)
 *   2…N. One check step per selected equipment type
 *   N+1. Signatures
 *   N+2. Photos
 *   N+3. Preview & Print
 *
 * PDF generation is handled entirely by HVInspectionPdfGenerator.js.
 * This file contains only UI state, step rendering, and wizard orchestration.
 */
import React, { useState } from 'react'
import { FileText } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { JobDetailsStep } from '../shared/JobDetailsStep'
import { PhotoAttachStep } from '../shared/PhotoAttachStep'
import { SignaturePad } from '../shared/SignaturePad'
import { PdfCanvasPreview } from '../shared/PdfCanvasPreview'
import { getUserPrefs } from '../shared/userPrefs'
import { useWizardSetup } from '../shared/useWizardSetup'
import { useDraft } from '../shared/useDraft'
import { usePdfGenerate } from '../shared/usePdfGenerate'
import { DraftPicker } from '../shared/DraftPicker'
import { WF, WCB, SectionHead } from '../shared/WizardInputs'
import { APP_ACCENT } from '../shared/constants'
import {
  generateHvPdf,
  EQUIP_TYPES,
  VISUAL_CHECKS,
  OPERATION_CHECKS,
  PERFORMANCE_CHECKS,
  QA_CHECKS,
  DOC_CHECKS,
  OTHER_CHECKS,
} from './generators/HVInspectionPdfGenerator'

const FORM_KEY   = '220F028A'
const FORM_LABEL = 'HV Inspection Certificate'
const ACCENT     = APP_ACCENT

// ── N/A maps — shaded cells from the original form ───────────────────────────
// Key = row index, value = array of EQUIP_TYPES indices that are N/A for that row.
// Extracted by pixel analysis of the original PDF.
const P1_NA = {
  0:  [7, 8, 12],
  1:  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  2:  [12],
  3:  [0, 1, 2, 3, 4, 5, 6, 11, 12],
  4:  [1, 6, 8, 12],
  5:  [0, 1, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  6:  [1, 6],
  7:  [0, 1, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  8:  [0, 1, 3, 4, 5, 7, 9, 12],
  10: [6, 12],
  11: [1, 12],
  12: [1, 11, 12],
  13: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

const P2_NA = {
  // Operation (rows 0–3)
  0:  [1, 2, 3, 7, 8, 9, 10, 11, 12],
  1:  [0, 1, 2, 3, 6, 7, 8, 9, 10, 12],
  2:  [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12],
  3:  [0, 1, 2, 3, 7, 8, 9, 10, 11, 12],
  // Performance (rows 4–16)
  4:  [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12],
  5:  [0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12],
  6:  [2, 3],
  7:  [1, 11, 12],
  8:  [0, 1, 2, 3, 4, 5, 6, 7, 11, 12],
  9:  [0, 1, 2, 3, 4, 5, 6, 7, 11, 12],
  10: [0, 1, 2, 3, 4, 5, 6, 9, 10, 11, 12],
  11: [0, 1, 2, 3, 4, 5, 11],
  12: [0, 1, 2, 3, 10, 11, 12],
  13: [0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12],
  14: [0, 1, 2, 4, 6, 8, 9, 10, 11, 12],
  15: [0, 1, 2, 3, 4, 6, 7, 8, 9, 11, 12],
  16: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

/**
 * Returns true when a particular cell in the check grid is N/A (shaded).
 * @param {'visual'|'operation'|'performance'|'qa'|'doc'} checkGroup
 * @param {number} rowIdx - Row index within the check group
 * @param {number} colIdx - Equipment-type column index
 */
function isNA(checkGroup, rowIdx, colIdx) {
  if (checkGroup === 'visual')      return (P1_NA[rowIdx] || []).includes(colIdx)
  if (checkGroup === 'operation')   return (P2_NA[rowIdx] || []).includes(colIdx)
  if (checkGroup === 'performance') return (P2_NA[rowIdx + 4] || []).includes(colIdx)
  return false  // QA, Doc, Other have no N/A cells
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function initChecks(checkList) {
  const result = {}
  checkList.forEach(c => {
    result[c.id] = {}
    EQUIP_TYPES.forEach(e => { result[c.id][e.id] = false })
  })
  return result
}

function initState() {
  const prefs = getUserPrefs()
  return {
    // Job details
    projectName: '', npJobNumber: '', pcoWONo: '', ciwrNo: '',
    siteId: '',
    streetRoad: '', cityTown: '', district: '',
    dateWorkCompleted: prefs.dateWorkCompleted || '',
    contractor:  prefs.contractor  || '',
    namePrint:   prefs.namePrint   || '',
    signed:      prefs.signed      || '',
    // Equipment selection
    selectedEquip: [],
    // Check states
    visualChecks:      initChecks(VISUAL_CHECKS),
    operationChecks:   initChecks(OPERATION_CHECKS),
    performanceChecks: initChecks(PERFORMANCE_CHECKS),
    qaChecks:          initChecks(QA_CHECKS),
    docChecks:         initChecks(DOC_CHECKS),
    otherChecks:       initChecks(OTHER_CHECKS),
    // Signatures — WTL pre-filled from user settings
    wtlName:   prefs.namePrint || '',
    wtlSigned: prefs.signed    || '',
    wtlCertNo: prefs.certNo    || '',
    // Field Switcher
    fsName: '', fsSigned: '', fsSinNapa: '',
    // Other (Specify) labels
    other1: '', other2: '', other3: '',
  }
}

// ── Check sections definition — used by EquipCheckList ───────────────────────
const CHECK_SECTIONS = [
  { title: 'Visual Checks',     checks: VISUAL_CHECKS,      stateKey: 'visualChecks',      group: 'visual'      },
  { title: 'Operation',         checks: OPERATION_CHECKS,   stateKey: 'operationChecks',   group: 'operation'   },
  { title: 'Performance Tests', checks: PERFORMANCE_CHECKS, stateKey: 'performanceChecks', group: 'performance' },
  { title: 'QA',                checks: QA_CHECKS,          stateKey: 'qaChecks',          group: 'qa'          },
  { title: 'Documentation',     checks: DOC_CHECKS,         stateKey: 'docChecks',         group: 'doc'         },
  { title: 'Other',             checks: OTHER_CHECKS,       stateKey: 'otherChecks',       group: 'other'       },
]

// ── EquipCheckList ────────────────────────────────────────────────────────────
// Shows checks for ONE equipment type as simple tick toggles.
// Only renders rows that are applicable (not N/A) for this equipment type.
function EquipCheckList({ checkSections, equip, d, setD, accent }) {
  const colIdx = EQUIP_TYPES.findIndex(e => e.id === equip.id)

  const toggle = (stateKey, checkId) => {
    setD(prev => ({
      ...prev,
      [stateKey]: {
        ...prev[stateKey],
        [checkId]: {
          ...prev[stateKey]?.[checkId],
          [equip.id]: !prev[stateKey]?.[checkId]?.[equip.id],
        },
      },
    }))
  }

  // Tick all applicable checks across all non-Other sections at once
  const nonOtherSections = checkSections.filter(s => s.group !== 'other')

  const allNonOtherTicked = nonOtherSections.every(({ checks, stateKey, group }) =>
    checks
      .filter((_, ri) => !isNA(group, ri, colIdx))
      .every(c => d[stateKey]?.[c.id]?.[equip.id])
  )

  const tickAllSections = () => {
    setD(prev => {
      const next = { ...prev }
      nonOtherSections.forEach(({ checks, stateKey, group }) => {
        const updated = { ...next[stateKey] }
        checks
          .filter((_, ri) => !isNA(group, ri, colIdx))
          .forEach(c => { updated[c.id] = { ...updated[c.id], [equip.id]: !allNonOtherTicked } })
        next[stateKey] = updated
      })
      return next
    })
  }

  return (
    <div>
      {checkSections.map(({ title, checks, stateKey, group }) => {
        const applicable = checks.filter((_, ri) => !isNA(group, ri, colIdx))
        if (applicable.length === 0) return null
        const isOther = group === 'other'

        return (
          <div key={stateKey} style={{ marginBottom: 18 }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 8,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: accent,
                textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>{title}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {applicable.map(check => {
                const ticked = !!d[stateKey]?.[check.id]?.[equip.id]
                const otherKey =
                  check.id === 'ot0' ? 'other1' :
                  check.id === 'ot1' ? 'other2' : 'other3'

                return (
                  <div key={check.id} style={{ marginBottom: 4 }}>
                    {isOther && (
                      <input
                        type="text"
                        placeholder="Specify what this check covers…"
                        value={d[otherKey] || ''}
                        onChange={e => setD(p => ({ ...p, [otherKey]: e.target.value }))}
                        style={{
                          width: '100%', padding: '7px 10px', borderRadius: 8, marginBottom: 4,
                          border: '1.5px solid #d1d5db', fontSize: 12,
                          fontFamily: 'inherit', boxSizing: 'border-box',
                          background: '#fafafa',
                        }}
                      />
                    )}
                    <button
                      onClick={() => toggle(stateKey, check.id)}
                      style={{
                        width: '100%', padding: '11px 14px',
                        borderRadius: 10, textAlign: 'left',
                        border: `2px solid ${ticked ? accent : '#e5e7eb'}`,
                        background: ticked ? accent + '12' : '#fff',
                        cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}
                    >
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: ticked ? accent : '#f3f4f6',
                        border: `2px solid ${ticked ? accent : '#d1d5db'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, color: ticked ? accent : 'transparent',
                        fontWeight: 700,
                      }}>✓</span>
                      <span style={{
                        fontSize: 13, fontWeight: ticked ? 600 : 400,
                        color: ticked ? '#111827' : '#374151',
                      }}>
                        {isOther
                          ? (d[otherKey] || check.label.replace('Other (', '').replace(')', ''))
                          : check.label}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Tick All button — excludes Other (Specify) rows */}
      <button
        onClick={tickAllSections}
        style={{
          width: '100%', padding: '13px', marginTop: 4,
          borderRadius: 12, border: `2px solid ${accent}`,
          background: allNonOtherTicked ? accent : '#fff',
          color: allNonOtherTicked ? '#fff' : accent,
          fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        {allNonOtherTicked ? '✓ All Checks Ticked' : 'Tick All Checks'}
      </button>
    </div>
  )
}

// ── Wizard ────────────────────────────────────────────────────────────────────
export default function HVInspectionWizard({ onClose }) {
  const [d, setD]       = useState(initState)
  const [step, setStep] = useState(0)
  const [photos, setPhotos] = useState([])
  const [draftPickerOpen, setDraftPickerOpen] = useState(false)
  const [draftPickerMode, setDraftPickerMode] = useState('menu')

  // loadJobHistory is provided by useWizardSetup but not needed in this wizard
  // (job details are loaded via ProjectPicker / DraftPicker instead).
  const { set } = useWizardSetup(d, setD, step, FORM_KEY)
  const { clearDraft: clearFormDraft } = useDraft(FORM_KEY, d, step, photos)
  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } =
    usePdfGenerate(generateHvPdf)

  const handleDraftLoad = (draft) => {
    const { photos: dp, ...fd } = draft.data || {}
    setD(prev => ({ ...prev, ...fd }))
    if (Array.isArray(draft.photos) && draft.photos.length > 0) setPhotos(draft.photos)
    setStep(draft.step || 0)
  }

  // ── Dynamic step list based on selected equipment ──────────────────────────
  const selectedEquipObjs = EQUIP_TYPES.filter(e => d.selectedEquip.includes(e.id))

  const STEPS = [
    'Job Details',
    'Equipment Types',
    ...selectedEquipObjs.map(e => e.label),
    'Signatures',
    'Photos',
    'Preview',
  ]

  const EQUIP_STEP_START = 2
  const EQUIP_STEP_END   = 2 + selectedEquipObjs.length  // exclusive
  const SIG_STEP         = EQUIP_STEP_END
  const PHOTO_STEP       = SIG_STEP + 1
  const PREVIEW_STEP     = PHOTO_STEP + 1

  const isPreview    = step === PREVIEW_STEP
  const isEquipStep  = step >= EQUIP_STEP_START && step < EQUIP_STEP_END
  const currentEquip = isEquipStep ? selectedEquipObjs[step - EQUIP_STEP_START] : null

  const handleNext = () => {
    if (step === PREVIEW_STEP - 1) triggerGenerate(d, photos)
    setStep(s => Math.min(s + 1, PREVIEW_STEP))
  }

  const handleBack = () => {
    if (isPreview) { clearPdf(); setStep(s => s - 1); return }
    setStep(s => Math.max(s - 1, 0))
  }

  const handleShare = async () => {
    if (!pdfBytes) return
    const { sharePdf } = await import('../shared/sharePdf')
    const parts = [d.npJobNumber || d.projectName || 'HV Inspection', 'HV Inspection Certificate'].filter(Boolean)
    await sharePdf(pdfBytes, `${parts.join(' - ')}.pdf`, pdfBlobUrl, clearFormDraft)
  }

  const missingFields = []
  if (!d.projectName && !d.npJobNumber) missingFields.push('Project / Job Number')
  if (d.selectedEquip.length === 0)     missingFields.push('Equipment Types')

  // ── Render current step ────────────────────────────────────────────────────
  const renderStep = () => {
    if (isPreview) return null

    // Step 0 — Job Details
    if (step === 0) return (
      <JobDetailsStep d={d} setD={setD} accent={ACCENT}
        formKey={FORM_KEY} formLabel={FORM_LABEL}
        step={step} photos={photos} setPhotos={setPhotos}
        onOpenDrafts={() => { setDraftPickerMode('list'); setDraftPickerOpen(true) }}
      >
        <WF label="Site ID" v={d.siteId} set={val => setD(p => ({ ...p, siteId: val }))}
          ph="e.g. SUB-123 or Zone Sub name" accent={ACCENT} />
      </JobDetailsStep>
    )

    // Step 1 — Equipment Type selection
    if (step === 1) return (
      <div>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, marginTop: 0 }}>
          Select all equipment types being commissioned. Each will get its own check step.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {EQUIP_TYPES.map(e => {
            const sel = d.selectedEquip.includes(e.id)
            return (
              <button key={e.id}
                onClick={() => setD(prev => ({
                  ...prev,
                  selectedEquip: sel
                    ? prev.selectedEquip.filter(id => id !== e.id)
                    : [...prev.selectedEquip, e.id],
                }))}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10, textAlign: 'left',
                  border: `2px solid ${sel ? ACCENT : '#e5e7eb'}`,
                  background: sel ? ACCENT + '12' : '#fff',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: sel ? ACCENT : '#e5e7eb',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{sel ? '✓' : ''}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: sel ? ACCENT : '#111827' }}>{e.label}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{e.short}</div>
                </div>
              </button>
            )
          })}
        </div>
        {selectedEquipObjs.length > 0 && (
          <div style={{
            marginTop: 14, padding: '10px 14px',
            background: ACCENT + '12', borderRadius: 8,
            fontSize: 13, color: ACCENT, fontWeight: 600,
          }}>
            {selectedEquipObjs.length} type{selectedEquipObjs.length !== 1 ? 's' : ''} selected —{' '}
            {selectedEquipObjs.length} check step{selectedEquipObjs.length !== 1 ? 's' : ''} will follow
          </div>
        )}
      </div>
    )

    // Equipment-specific check steps
    if (isEquipStep && currentEquip) return (
      <EquipCheckList
        checkSections={CHECK_SECTIONS}
        equip={currentEquip}
        d={d} setD={setD}
        accent={ACCENT}
      />
    )

    // Signatures — WTL loaded silently from user settings; only FS fields shown
    if (step === SIG_STEP) return (
      <div>
        <SectionHead label="Field Switcher" accent={ACCENT} />
        <WF label="Name"          v={d.fsName}    set={val => setD(p => ({ ...p, fsName: val }))}    accent={ACCENT} />
        <WF label="SIN / NAPA ID" v={d.fsSinNapa} set={val => setD(p => ({ ...p, fsSinNapa: val }))} accent={ACCENT} />
        <SignaturePad value={d.fsSigned} onChange={val => setD(p => ({ ...p, fsSigned: val }))} accent={ACCENT} />
      </div>
    )

    // Photos
    if (step === PHOTO_STEP) return (
      <PhotoAttachStep photos={photos} onChange={setPhotos} accent={ACCENT} />
    )

    return null
  }

  return (
    <WizardShell
      title={FORM_LABEL}
      formNumber={FORM_KEY}
      headerIcon={<FileText size={22} color="#fff" />}
      steps={STEPS}
      step={step}
      onStepClick={i => i <= step && setStep(i)}
      onClose={onClose}
      onBack={handleBack}
      onNext={handleNext}
      onSaveDraft={() => { setDraftPickerMode('save'); setDraftPickerOpen(true) }}
      accent={ACCENT}
      isPreview={isPreview}
      onShare={handleShare}
      onClosePreview={() => { clearPdf(); setStep(s => s - 1) }}
      missingFields={isPreview && missingFields.length > 0 ? missingFields : null}
      previewContent={buildPreviewContent(() => triggerGenerate(d, photos), ACCENT)}
    >
      {renderStep()}

      <DraftPicker
        open={draftPickerOpen}
        onClose={() => setDraftPickerOpen(false)}
        formKey={FORM_KEY}
        formLabel={FORM_LABEL}
        d={d} step={step} photos={photos}
        onLoad={handleDraftLoad}
        accent={ACCENT}
        initialMode={draftPickerMode}
      />
    </WizardShell>
  )
}
