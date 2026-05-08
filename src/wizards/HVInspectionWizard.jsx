/**
 * HVInspectionWizard — 220F028A Pre-Commissioning HV Inspection Certificate
 *
 * Steps:
 *   0. Job Details
 *   1. Equipment Types (select which apply)
 *   2. Visual Checks (page 1 table)
 *   3. Operation & Performance Tests (page 2 table)
 *   4. QA & Documentation
 *   5. Signatures
 *   6. Photos
 *   7. Preview & Print
 */
import React, { useState } from 'react'
import { FileText } from 'lucide-react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { WizardShell } from '../shared/WizardShell'
import { JobDetailsStep } from '../shared/JobDetailsStep'
import { PhotoAttachStep } from '../shared/PhotoAttachStep'
import { SignaturePad } from '../shared/SignaturePad'
import { PdfCanvasPreview } from '../shared/PdfCanvasPreview'
import { appendPhotosToPdf } from '../shared/appendPhotosToPdf'
import { getUserPrefs } from '../shared/userPrefs'
import { saveToHistory } from '../shared/jobHistory'
import { useWizardSetup } from '../shared/useWizardSetup'
import { useDraft } from '../shared/useDraft'
import { usePdfGenerate } from '../shared/usePdfGenerate'
import { DraftPicker } from '../shared/DraftPicker'
import { WF, WCB, SectionHead } from '../shared/WizardInputs'
import { APP_ACCENT } from '../shared/constants'

const FORM_KEY   = '220F028A'
const FORM_LABEL = 'HV Inspection Certificate'
const ACCENT     = APP_ACCENT

// ── Equipment type definitions ────────────────────────────────────────────────
const EQUIP_TYPES = [
  { id: 'abs',  label: 'Air Break Switch',          short: 'ABS'  },
  { id: 'sa',   label: 'Surge Arrestor',             short: 'SA'   },
  { id: 'ohd',  label: 'O/H Distribution Line',     short: 'OHD'  },
  { id: 'ohst', label: 'O/H Sub-Trans. Line',        short: 'OHST' },
  { id: 'lr',   label: 'Line Recloser',              short: 'LR'   },
  { id: 'vr',   label: 'Voltage Regulators',         short: 'VR'   },
  { id: 'gmhv', label: 'Ground Mounted HV Switchgear', short: 'GMHV' },
  { id: 'hvug', label: 'HV U/G Cables',              short: 'HVUG' },
  { id: 'lvug', label: 'LV U/G Cables',              short: 'LVUG' },
  { id: 'hvmu', label: 'HV Metering Unit',           short: 'HVMU' },
  { id: 'dt',   label: 'Distribution Transformer',  short: 'DT'   },
  { id: 'pmc',  label: 'Pole Mounted Capacitor',     short: 'PMC'  },
  { id: 're',   label: 'Radio Equipment',            short: 'RE'   },
]


// ── N/A maps — shaded cells from the original form ───────────────────────────
// Key = row index, value = array of EQUIP_TYPES indices that are N/A for that row
// Extracted by pixel analysis of the original PDF
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
  // Operation (rows 0-3)
  0:  [1, 2, 3, 7, 8, 9, 10, 11, 12],
  1:  [0, 1, 2, 3, 6, 7, 8, 9, 10, 12],
  2:  [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12],
  3:  [0, 1, 2, 3, 7, 8, 9, 10, 11, 12],
  // Performance (rows 4-16)
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

// Build a lookup: isNA(checkGroup, rowIdx, colIdx)
// checkGroup: 'visual' | 'operation' | 'performance' | 'qa' | 'doc'
function isNA(checkGroup, rowIdx, colIdx) {
  if (checkGroup === 'visual')      return (P1_NA[rowIdx] || []).includes(colIdx)
  if (checkGroup === 'operation')   return (P2_NA[rowIdx] || []).includes(colIdx)
  if (checkGroup === 'performance') return (P2_NA[rowIdx + 4] || []).includes(colIdx)
  return false  // QA, Doc, Other have no N/A cells
}

// ── Check definitions ─────────────────────────────────────────────────────────
const VISUAL_CHECKS = [
  { id: 'vc0',  label: 'Equipment "Fit For Service" Certificate' },
  { id: 'vc1',  label: 'Contact Alignment' },
  { id: 'vc2',  label: 'Jumpers and Connections - Integrity' },
  { id: 'vc3',  label: 'Busbars, Connections, Etc. Covered' },
  { id: 'vc4',  label: 'Insulators / Bushings Correct' },
  { id: 'vc5',  label: 'Conductor Terminations & Binders' },
  { id: 'vc6',  label: 'Animal Access Barriers' },
  { id: 'vc7',  label: 'RI Mitigation' },
  { id: 'vc8',  label: 'Correct Fusing' },
  { id: 'vc9',  label: 'Earthing and Bonding' },
  { id: 'vc10', label: 'Conductor Clearances' },
  { id: 'vc11', label: 'Labelling and Notices' },
  { id: 'vc12', label: 'Security and Access' },
  { id: 'vc13', label: 'Radio Equipment Visual Checks' },
  { id: 'vc14', label: 'Equipment Correctly Installed and Constructed' },
]

const OPERATION_CHECKS = [
  { id: 'op0', label: 'Manual Operation' },
  { id: 'op1', label: 'Automatic Operation' },
  { id: 'op2', label: 'Protection Systems' },
  { id: 'op3', label: 'Indications & Control' },
]

const PERFORMANCE_CHECKS = [
  { id: 'pf0',  label: 'Contacts Timing' },
  { id: 'pf1',  label: 'Auxiliary Supplies' },
  { id: 'pf2',  label: 'Earth & Bond Resistance' },
  { id: 'pf3',  label: 'Phasing' },
  { id: 'pf4',  label: 'Phase Rotation' },
  { id: 'pf5',  label: 'Polarity' },
  { id: 'pf6',  label: 'Conductor Continuity' },
  { id: 'pf7',  label: 'Screen/Sheath Continuity' },
  { id: 'pf8',  label: 'Insulation Resistance' },
  { id: 'pf9',  label: 'Hi-Pot' },
  { id: 'pf10', label: 'Liven Under Test' },
  { id: 'pf11', label: 'Voltage Level Test' },
  { id: 'pf12', label: 'Radio Equipment Performance Tests' },
]

const QA_CHECKS = [
  { id: 'qa0', label: 'Construction Standards' },
  { id: 'qa1', label: 'Safety Standards' },
]

const DOC_CHECKS = [
  { id: 'dc0', label: 'As Built Info Recorded' },
  { id: 'dc1', label: 'Defects Recorded' },
]

// ── PDF coordinates ───────────────────────────────────────────────────────────
// Page 1 - Visual Checks table
// Column x centres (13 equipment types, left → right)
const P1_COL_X = [231, 256, 281, 307, 332, 357, 383, 408, 433, 458, 484, 509, 535]
// Row y centres (15 visual check rows, top → bottom in pdf-lib bottom-origin coords)
const P1_ROW_Y = [430, 406, 383, 355, 333, 310, 288, 271, 254, 237, 219, 202, 185, 168, 151]
// Project Title field
const P1_TITLE = { x: 218, y: 717 }

// Page 2 - Operation (rows 0-3) + Performance Tests (rows 4-16)
const P2_COL_X = [249, 273, 297, 321, 345, 369, 393, 417, 441, 465, 489, 513, 537]
const P2_ROW_Y = [593, 575, 557, 538, 520, 501, 483, 464, 446, 427, 409, 390, 372, 353, 335, 316, 293]
// QA + Doc rows (estimated — calibrate with CoordOverlay if needed)
const P2_QA_Y  = [269, 251]   // Construction Standards, Safety Standards
const P2_DOC_Y = [230, 211]   // As Built Info Recorded, Defects Recorded

// Page 3 - Signatures
const P3 = {
  wtlName:   { x: 218, y: 724 },
  wtlSigned: { x: 430, y: 710 },  // signature image
  certNo:    { x: 218, y: 699 },
  date:      { x: 420, y: 699 },
  fsName:    { x: 218, y: 648 },
  fsSigned:  { x: 430, y: 634 },  // signature image
  sinNapa:   { x: 108, y: 620 },
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
    streetRoad: '', cityTown: '', district: '',
    dateWorkCompleted: prefs.dateWorkCompleted || '',
    contractor: prefs.contractor || '',
    namePrint:  prefs.namePrint  || '',
    signed:     prefs.signed     || '',
    // Equipment selection
    selectedEquip: [],
    // Check states
    visualChecks:      initChecks(VISUAL_CHECKS),
    operationChecks:   initChecks(OPERATION_CHECKS),
    performanceChecks: initChecks(PERFORMANCE_CHECKS),
    qaChecks:          initChecks(QA_CHECKS),
    docChecks:         initChecks(DOC_CHECKS),
    // Signatures
    wtlName: '', wtlSigned: '', wtlCertNo: '', wtlDate: '',
    fsName:  '', fsSigned:  '', fsSinNapa: '',
    // Other specify fields
    other1: '', other2: '', other3: '',
  }
}

// ── PDF generation ────────────────────────────────────────────────────────────
async function generateHvPdf(d, photos) {
  const url  = `${import.meta.env.BASE_URL}forms/220F028A.pdf`
  const buf  = await fetch(url).then(r => r.arrayBuffer())
  const doc  = await PDFDocument.load(buf)
  const font = await doc.embedFont(StandardFonts.Helvetica)

  const pages = doc.getPages()
  const p1    = pages[0]
  const p2    = pages[1]
  const p3    = pages[2]

  const BLUE = rgb(0, 0.2, 0.63)
  // Two-line checkmark matching all other wizards
  // x, y are pdf-lib bottom-origin coordinates (centre of cell)
  const tick = (page, x, y) => {
    page.drawLine({ start: { x: x,   y: y - 4 }, end: { x: x+3, y: y - 7 }, thickness: 1.5, color: BLUE, opacity: 1 })
    page.drawLine({ start: { x: x+3, y: y - 7 }, end: { x: x+9, y: y + 1 }, thickness: 1.5, color: BLUE, opacity: 1 })
  }

  const textAt = (page, text, x, y, size = 8) => {
    if (!text) return
    page.drawText(String(text), {
      x, y, size, font,
      color: rgb(0, 0, 0),
      maxWidth: 160,
    })
  }

  // ── Page 1 — Project Title ──────────────────────────────────────────────
  const title = [d.npJobNumber, d.projectName, d.streetRoad, d.cityTown]
    .filter(Boolean).join(' — ')
  textAt(p1, title, P1_TITLE.x, P1_TITLE.y, 8)

  // ── Page 1 — Visual Checks ──────────────────────────────────────────────
  VISUAL_CHECKS.forEach((check, rowIdx) => {
    const equipCols = d.visualChecks?.[check.id] || {}
    EQUIP_TYPES.forEach((equip, colIdx) => {
      if (equipCols[equip.id]) {
        tick(p1, P1_COL_X[colIdx], P1_ROW_Y[rowIdx])
      }
    })
  })

  // ── Page 2 — Operation ──────────────────────────────────────────────────
  OPERATION_CHECKS.forEach((check, rowIdx) => {
    const equipCols = d.operationChecks?.[check.id] || {}
    EQUIP_TYPES.forEach((equip, colIdx) => {
      if (equipCols[equip.id]) {
        tick(p2, P2_COL_X[colIdx], P2_ROW_Y[rowIdx])
      }
    })
  })

  // ── Page 2 — Performance Tests ──────────────────────────────────────────
  PERFORMANCE_CHECKS.forEach((check, rowIdx) => {
    const equipCols = d.performanceChecks?.[check.id] || {}
    EQUIP_TYPES.forEach((equip, colIdx) => {
      if (equipCols[equip.id]) {
        tick(p2, P2_COL_X[colIdx], P2_ROW_Y[rowIdx + 4])
      }
    })
  })

  // ── Page 2 — QA ─────────────────────────────────────────────────────────
  QA_CHECKS.forEach((check, rowIdx) => {
    const equipCols = d.qaChecks?.[check.id] || {}
    EQUIP_TYPES.forEach((equip, colIdx) => {
      if (equipCols[equip.id]) {
        tick(p2, P2_COL_X[colIdx], P2_QA_Y[rowIdx])
      }
    })
  })

  // ── Page 2 — Doc ────────────────────────────────────────────────────────
  DOC_CHECKS.forEach((check, rowIdx) => {
    const equipCols = d.docChecks?.[check.id] || {}
    EQUIP_TYPES.forEach((equip, colIdx) => {
      if (equipCols[equip.id]) {
        tick(p2, P2_COL_X[colIdx], P2_DOC_Y[rowIdx])
      }
    })
  })

  // ── Page 3 — Signatures ─────────────────────────────────────────────────
  textAt(p3, d.wtlName,   P3.wtlName.x,  P3.wtlName.y)
  textAt(p3, d.wtlCertNo, P3.certNo.x,   P3.certNo.y)
  textAt(p3, d.wtlDate,   P3.date.x,     P3.date.y)
  textAt(p3, d.fsName,    P3.fsName.x,   P3.fsName.y)
  textAt(p3, d.fsSinNapa, P3.sinNapa.x,  P3.sinNapa.y)

  // WTL signature
  if (d.wtlSigned) {
    try {
      const isJpeg = d.wtlSigned.includes('jpeg') || d.wtlSigned.includes('jpg')
      const b64   = d.wtlSigned.split(',')[1]
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      const img   = isJpeg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes)
      p3.drawImage(img, { x: P3.wtlSigned.x, y: P3.wtlSigned.y - 18, width: 100, height: 22 })
    } catch {}
  }

  // FS signature
  if (d.fsSigned) {
    try {
      const isJpeg = d.fsSigned.includes('jpeg') || d.fsSigned.includes('jpg')
      const b64   = d.fsSigned.split(',')[1]
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      const img   = isJpeg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes)
      p3.drawImage(img, { x: P3.fsSigned.x, y: P3.fsSigned.y - 18, width: 100, height: 22 })
    } catch {}
  }

  await appendPhotosToPdf(doc, photos)

  const bytes = await doc.save()
  return new Uint8Array(bytes)
}

// ── Check Grid Component ──────────────────────────────────────────────────────
// Renders a mobile-friendly grid for a list of checks × selected equipment types
function CheckGrid({ checks, stateKey, d, setD, selectedEquip, accent, checkGroup = '' }) {
  if (selectedEquip.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
        No equipment types selected — go back to Step 2.
      </div>
    )
  }

  const toggle = (checkId, equipId) => {
    setD(prev => ({
      ...prev,
      [stateKey]: {
        ...prev[stateKey],
        [checkId]: {
          ...prev[stateKey]?.[checkId],
          [equipId]: !prev[stateKey]?.[checkId]?.[equipId],
        }
      }
    }))
  }

  const toggleAll = (checkId) => {
    const checkIdx = checks.findIndex(c => c.id === checkId)
    const current  = d[stateKey]?.[checkId] || {}
    const applicable = activeEquip.filter(e => {
      const ci = EQUIP_TYPES.findIndex(et => et.id === e.id)
      return !checkGroup || !isNA(checkGroup, checkIdx, ci)
    })
    const allTicked = applicable.every(e => current[e.id])
    setD(prev => ({
      ...prev,
      [stateKey]: {
        ...prev[stateKey],
        [checkId]: Object.fromEntries(
          EQUIP_TYPES.map(e => {
            const ci = EQUIP_TYPES.findIndex(et => et.id === e.id)
            const na = checkGroup && isNA(checkGroup, checkIdx, ci)
            if (na) return [e.id, false]
            return [e.id, !allTicked]
          })
        )
      }
    }))
  }

  const activeEquip = EQUIP_TYPES.filter(e => selectedEquip.includes(e.id))

  return (
    <div>
      {checks.map((check) => {
        const vals  = d[stateKey]?.[check.id] || {}
        const count = activeEquip.filter(e => vals[e.id]).length
        const all   = count === activeEquip.length

        return (
          <div key={check.id} style={{
            marginBottom: 10,
            border: `1px solid ${count > 0 ? accent + '40' : '#e5e7eb'}`,
            borderRadius: 10,
            background: count > 0 ? accent + '08' : '#fff',
            overflow: 'hidden',
          }}>
            {/* Check label row */}
            <div style={{
              padding: '10px 12px 6px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', flex: 1 }}>
                {check.label}
              </span>
              <button
                onClick={() => toggleAll(check.id)}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: `1px solid ${accent}`,
                  background: all ? accent : '#fff',
                  color: all ? '#fff' : accent,
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', flexShrink: 0, marginLeft: 8,
                }}
              >
                {all ? '✓ All' : 'All'}
              </button>
            </div>
            {/* Equipment type buttons */}
            <div style={{ padding: '0 12px 10px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {activeEquip.map(equip => {
                const ticked = vals[equip.id]
                return (
                  {(() => {
                    const colIdx = EQUIP_TYPES.findIndex(e => e.id === equip.id)
                    const na = checkGroup && isNA(checkGroup, checks.indexOf(check), colIdx)
                    if (na) return (
                      <span key={equip.id} style={{
                        padding: '5px 9px', borderRadius: 7,
                        background: '#e5e7eb', color: '#9ca3af',
                        fontSize: 11, fontWeight: 600,
                        userSelect: 'none',
                      }}>
                        {equip.short}
                      </span>
                    )
                    return (
                      <button
                        key={equip.id}
                        onClick={() => toggle(check.id, equip.id)}
                        style={{
                          padding: '5px 9px', borderRadius: 7,
                          border: `2px solid ${ticked ? accent : '#d1d5db'}`,
                          background: ticked ? accent : '#f9fafb',
                          color: ticked ? '#fff' : '#6b7280',
                          fontSize: 11, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit',
                          transition: 'all 0.12s',
                        }}
                      >
                        {ticked ? '✓ ' : ''}{equip.short}
                      </button>
                    )
                  })()}
                )
              })}
            </div>
          </div>
        )
      })}
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

  const { loadJobHistory, set } = useWizardSetup(d, setD, step, FORM_KEY)
  const { clearDraft: clearFormDraft } = useDraft(FORM_KEY, d, step, photos)
  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } =
    usePdfGenerate(generateHvPdf)

  const handleDraftLoad = (draft) => {
    const { photos: dp, ...fd } = draft.data || {}
    setD(prev => ({ ...prev, ...fd }))
    if (Array.isArray(draft.photos) && draft.photos.length > 0) setPhotos(draft.photos)
    setStep(draft.step || 0)
  }

  const activeEquip = EQUIP_TYPES.filter(e => d.selectedEquip.includes(e.id))

  const STEPS = [
    'Job Details',
    'Equipment Types',
    'Visual Checks',
    'Operation & Performance',
    'QA & Documentation',
    'Signatures',
    'Photos',
    'Preview',
  ]

  const isPreview = step === STEPS.length - 1

  const handleNext = () => {
    if (step === STEPS.length - 2) {
      triggerGenerate(d, photos)
    }
    setStep(s => Math.min(s + 1, STEPS.length - 1))
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
  if (!d.wtlName)                        missingFields.push('Work Team Leader Name')

  // ── Step content ──────────────────────────────────────────────────────────
  const formSteps = [

    // Step 0 — Job Details
    <JobDetailsStep key="0" d={d} setD={setD} accent={ACCENT}
      formKey={FORM_KEY} formLabel={FORM_LABEL}
      step={step} photos={photos} setPhotos={setPhotos}
      onOpenDrafts={() => { setDraftPickerMode('list'); setDraftPickerOpen(true) }}
    />,

    // Step 1 — Equipment Types
    <div key="1">
      <SectionHead label="Which equipment is being commissioned?" accent={ACCENT} />
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, marginTop: 0 }}>
        Select all equipment types that apply to this job. Only selected types will appear in the check steps.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {EQUIP_TYPES.map(e => {
          const sel = d.selectedEquip.includes(e.id)
          return (
            <button
              key={e.id}
              onClick={() => setD(prev => ({
                ...prev,
                selectedEquip: sel
                  ? prev.selectedEquip.filter(id => id !== e.id)
                  : [...prev.selectedEquip, e.id]
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
              }}>
                {sel ? '✓' : ''}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: sel ? ACCENT : '#111827' }}>{e.label}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{e.short}</div>
              </div>
            </button>
          )
        })}
      </div>
      {d.selectedEquip.length > 0 && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: ACCENT + '12', borderRadius: 8, fontSize: 13, color: ACCENT, fontWeight: 600 }}>
          {d.selectedEquip.length} type{d.selectedEquip.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>,

    // Step 2 — Visual Checks
    <div key="2">
      <SectionHead label="Visual Checks" sub="Tap equipment type buttons to mark ✓ for each check" accent={ACCENT} />
      <CheckGrid
        checks={VISUAL_CHECKS}
        stateKey="visualChecks"
        d={d} setD={setD}
        selectedEquip={d.selectedEquip}
        accent={ACCENT}
        checkGroup="visual"
      />
    </div>,

    // Step 3 — Operation & Performance
    <div key="3">
      <SectionHead label="Operation" accent={ACCENT} />
      <CheckGrid
        checks={OPERATION_CHECKS}
        stateKey="operationChecks"
        d={d} setD={setD}
        selectedEquip={d.selectedEquip}
        accent={ACCENT}
        checkGroup="operation"
      />
      <SectionHead label="Performance Tests" accent={ACCENT} />
      <CheckGrid
        checks={PERFORMANCE_CHECKS}
        stateKey="performanceChecks"
        d={d} setD={setD}
        selectedEquip={d.selectedEquip}
        accent={ACCENT}
        checkGroup="performance"
      />
    </div>,

    // Step 4 — QA & Documentation
    <div key="4">
      <SectionHead label="Quality Assurance" accent={ACCENT} />
      <CheckGrid
        checks={QA_CHECKS}
        stateKey="qaChecks"
        d={d} setD={setD}
        selectedEquip={d.selectedEquip}
        accent={ACCENT}
      />
      <SectionHead label="Documentation" accent={ACCENT} />
      <CheckGrid
        checks={DOC_CHECKS}
        stateKey="docChecks"
        d={d} setD={setD}
        selectedEquip={d.selectedEquip}
        accent={ACCENT}
      />
      <SectionHead label="Other (Optional)" accent={ACCENT} />
      <WF label="Specify 1" v={d.other1} set={val => setD(p => ({...p, other1: val}))} accent={ACCENT} />
      <WF label="Specify 2" v={d.other2} set={val => setD(p => ({...p, other2: val}))} accent={ACCENT} />
      <WF label="Specify 3" v={d.other3} set={val => setD(p => ({...p, other3: val}))} accent={ACCENT} />
    </div>,

    // Step 5 — Signatures
    <div key="5">
      <SectionHead label="Work Team Leader" accent={ACCENT} />
      <WF label="Name" v={d.wtlName}   set={val => setD(p => ({...p, wtlName: val}))}   accent={ACCENT} />
      <WF label="Competency Cert No" v={d.wtlCertNo} set={val => setD(p => ({...p, wtlCertNo: val}))} accent={ACCENT} />
      <WF label="Date" v={d.wtlDate} set={val => setD(p => ({...p, wtlDate: val}))} type="date" accent={ACCENT} />
      <SignaturePad value={d.wtlSigned} onChange={val => setD(p => ({...p, wtlSigned: val}))} accent={ACCENT} />

      <SectionHead label="Field Switcher" accent={ACCENT} />
      <WF label="Name" v={d.fsName}    set={val => setD(p => ({...p, fsName: val}))}    accent={ACCENT} />
      <WF label="SIN / NAPA ID" v={d.fsSinNapa} set={val => setD(p => ({...p, fsSinNapa: val}))} accent={ACCENT} />
      <SignaturePad value={d.fsSigned}  onChange={val => setD(p => ({...p, fsSigned: val}))}  accent={ACCENT} />
    </div>,

    // Step 6 — Photos
    <PhotoAttachStep key="6" photos={photos} onChange={setPhotos} accent={ACCENT} />,

    // Step 7 — Preview
    <div key="7" />,
  ]

  return (
    <WizardShell
      title={FORM_LABEL}
      formNumber={FORM_KEY}
      headerIcon={<FileText size={22} color="#fff" />}
      steps={STEPS}
      step={step}
      onStepClick={setStep}
      onClose={onClose}
      onBack={handleBack}
      onNext={handleNext}
      onSaveDraft={() => { setDraftPickerMode('save'); setDraftPickerOpen(true) }}
      accent={ACCENT}
      isPreview={isPreview}
      onShare={handleShare}
      onClosePreview={() => { clearPdf(); setStep(s => s - 1) }}
      missingFields={isPreview && missingFields.length > 0 ? missingFields : null}
      previewContent={buildPreviewContent(handleShare, ACCENT)}
    >
      {!isPreview && formSteps[step]}

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
