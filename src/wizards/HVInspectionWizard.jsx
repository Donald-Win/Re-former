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
    // Signatures — WTL fields pre-filled from user settings
    wtlName:   prefs.namePrint || '',
    wtlSigned: prefs.signed    || '',
    wtlCertNo: prefs.certNo    || '',
    // date uses dateWorkCompleted from job details step
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

  // Two-line checkmark matching all other wizards
  // x, y are pdf-lib bottom-origin coordinates (centre of cell)
  // Tick positioned relative to cell centre (x, y = bottom-origin pdf coords)
  // Matches PoleWizard/TransformerWizard tick exactly - centre of cell adjusted
  const tick = (page, x, y) => {
    const bx = x - 5  // left-align within cell
    const by = y + 2  // slight vertical offset to centre in cell
    page.drawLine({ start: { x: bx,   y: by - 6 }, end: { x: bx+3, y: by - 9 }, thickness: 1.5, color: BLUE, opacity: 1 })
    page.drawLine({ start: { x: bx+3, y: by - 9 }, end: { x: bx+9, y: by - 1 }, thickness: 1.5, color: BLUE, opacity: 1 })
  }

  // Text color matches other wizards (deep navy blue)
  const BLUE = rgb(0/255, 20/255, 160/255)
  const textAt = (page, text, x, y, size = 8) => {
    if (!text) return
    page.drawText(String(text), {
      x, y, size, font,
      color: BLUE,
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
  textAt(p3, d.dateWorkCompleted, P3.date.x, P3.date.y)
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
        }
      }
    }))
  }

  const tickAll = (stateKey, checks, group) => {
    const applicable = checks.filter((_, ri) => !isNA(group, ri, colIdx))
    const allTicked  = applicable.every(c => d[stateKey]?.[c.id]?.[equip.id])
    setD(prev => {
      const updated = { ...prev[stateKey] }
      applicable.forEach(c => {
        updated[c.id] = { ...updated[c.id], [equip.id]: !allTicked }
      })
      return { ...prev, [stateKey]: updated }
    })
  }

  return (
    <div>
      {checkSections.map(({ title, checks, stateKey, group }) => {
        const applicable = checks.filter((_, ri) => !isNA(group, ri, colIdx))
        if (applicable.length === 0) return null
        const allTicked = applicable.every(c => d[stateKey]?.[c.id]?.[equip.id])

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
              <button
                onClick={() => tickAll(stateKey, checks, group)}
                style={{
                  padding: '3px 10px', borderRadius: 6,
                  border: `1px solid ${accent}`,
                  background: allTicked ? accent : '#fff',
                  color: allTicked ? '#fff' : accent,
                  fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {allTicked ? '✓ All' : 'Tick All'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {applicable.map(check => {
                const ticked = !!d[stateKey]?.[check.id]?.[equip.id]
                return (
                  <button
                    key={check.id}
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
                      {check.label}
                    </span>
                  </button>
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
// Check sections definition - used per equipment type
const CHECK_SECTIONS = [
  { title: 'Visual Checks',      checks: VISUAL_CHECKS,      stateKey: 'visualChecks',      group: 'visual'      },
  { title: 'Operation',          checks: OPERATION_CHECKS,   stateKey: 'operationChecks',   group: 'operation'   },
  { title: 'Performance Tests',  checks: PERFORMANCE_CHECKS, stateKey: 'performanceChecks', group: 'performance' },
]

// QA checks rendered for all selected equipment types combined (not per-type)
function QaDocStep({ d, setD, accent }) {
  const toggle = (stateKey, checkId, equipId) => {
    setD(prev => ({
      ...prev,
      [stateKey]: {
        ...prev[stateKey],
        [checkId]: { ...prev[stateKey]?.[checkId], [equipId]: !prev[stateKey]?.[checkId]?.[equipId] }
      }
    }))
  }

  const activeEquip = EQUIP_TYPES.filter(e => d.selectedEquip.includes(e.id))

  const renderSection = (title, checks, stateKey) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{title}</div>
      {checks.map(check => {
        const vals    = d[stateKey]?.[check.id] || {}
        const ticked  = activeEquip.every(e => vals[e.id])
        const partial = activeEquip.some(e => vals[e.id])
        return (
          <div key={check.id} style={{
            marginBottom: 8, padding: '11px 14px', borderRadius: 10,
            border: `2px solid ${ticked ? accent : partial ? accent + '60' : '#e5e7eb'}`,
            background: ticked ? accent + '12' : '#fff',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: partial && !ticked ? 8 : 0 }}>
              {check.label}
            </div>
            {activeEquip.length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                {activeEquip.map(equip => {
                  const t = vals[equip.id]
                  return (
                    <button key={equip.id} onClick={() => toggle(stateKey, check.id, equip.id)} style={{
                      padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      border: `2px solid ${t ? accent : '#d1d5db'}`,
                      background: t ? accent : '#f9fafb',
                      color: t ? '#fff' : '#6b7280',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>{t ? '✓ ' : ''}{equip.short}</button>
                  )
                })}
              </div>
            )}
            {activeEquip.length === 1 && (
              <button onClick={() => toggle(stateKey, check.id, activeEquip[0].id)}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  display: 'none',
                }}
              />
            )}
            {activeEquip.length === 1 && (() => {
              const equip = activeEquip[0]
              const t = vals[equip.id]
              return null // single equip handled by outer div click
            })()}
          </div>
        )
      })}
    </div>
  )

  // For single equip, make whole row clickable
  const singleEquip = activeEquip.length === 1 ? activeEquip[0] : null

  const renderSimple = (title, checks, stateKey) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {checks.map(check => {
          const vals   = d[stateKey]?.[check.id] || {}
          const ticked = singleEquip ? vals[singleEquip.id] : activeEquip.every(e => vals[e.id])
          return (
            <button
              key={check.id}
              onClick={() => {
                if (singleEquip) {
                  toggle(stateKey, check.id, singleEquip.id)
                } else {
                  const allTicked = activeEquip.every(e => vals[e.id])
                  activeEquip.forEach(e => {
                    if (vals[e.id] === allTicked) toggle(stateKey, check.id, e.id)
                  })
                }
              }}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10, textAlign: 'left',
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
                fontSize: 12, color: ticked ? accent : 'transparent', fontWeight: 700,
              }}>✓</span>
              <span style={{ fontSize: 13, fontWeight: ticked ? 600 : 400, color: ticked ? '#111827' : '#374151' }}>
                {check.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div>
      {renderSimple('Quality Assurance',  QA_CHECKS,  'qaChecks')}
      {renderSimple('Documentation',       DOC_CHECKS, 'docChecks')}
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Other (Optional)</div>
      <WF label="Specify 1" v={d.other1} set={val => setD(p => ({...p, other1: val}))} accent={accent} />
      <WF label="Specify 2" v={d.other2} set={val => setD(p => ({...p, other2: val}))} accent={accent} />
      <WF label="Specify 3" v={d.other3} set={val => setD(p => ({...p, other3: val}))} accent={accent} />
    </div>
  )
}

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

  // ── Dynamic step list based on selected equipment ────────────────────────
  // Steps: Job Details → Equipment Select → [one step per equip type] → QA/Doc → Signatures → Photos → Preview
  const selectedEquipObjs = EQUIP_TYPES.filter(e => d.selectedEquip.includes(e.id))

  const STEPS = [
    'Job Details',
    'Equipment Types',
    ...selectedEquipObjs.map(e => e.label),
    'QA & Documentation',
    'Signatures',
    'Photos',
    'Preview',
  ]

  const EQUIP_STEP_START = 2
  const EQUIP_STEP_END   = 2 + selectedEquipObjs.length  // exclusive
  const QA_STEP          = EQUIP_STEP_END
  const SIG_STEP         = QA_STEP + 1
  const PHOTO_STEP       = SIG_STEP + 1
  const PREVIEW_STEP     = PHOTO_STEP + 1

  const isPreview     = step === PREVIEW_STEP
  const isEquipStep   = step >= EQUIP_STEP_START && step < EQUIP_STEP_END
  const currentEquip  = isEquipStep ? selectedEquipObjs[step - EQUIP_STEP_START] : null

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

  // ── Render current step ───────────────────────────────────────────────────
  const renderStep = () => {
    if (isPreview) return null

    // Step 0 — Job Details
    if (step === 0) return (
      <JobDetailsStep d={d} setD={setD} accent={ACCENT}
        formKey={FORM_KEY} formLabel={FORM_LABEL}
        step={step} photos={photos} setPhotos={setPhotos}
        onOpenDrafts={() => { setDraftPickerMode('list'); setDraftPickerOpen(true) }}
      />
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
          <div style={{ marginTop: 14, padding: '10px 14px', background: ACCENT + '12', borderRadius: 8, fontSize: 13, color: ACCENT, fontWeight: 600 }}>
            {selectedEquipObjs.length} type{selectedEquipObjs.length !== 1 ? 's' : ''} selected — {selectedEquipObjs.length} check step{selectedEquipObjs.length !== 1 ? 's' : ''} will follow
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

    // QA & Documentation
    if (step === QA_STEP) return <QaDocStep d={d} setD={setD} accent={ACCENT} />

    // Signatures — WTL loaded silently from user settings (same as other wizards)
    if (step === SIG_STEP) return (
      <div>
        <SectionHead label="Field Switcher" accent={ACCENT} />
        <WF label="Name"         v={d.fsName}    set={val => setD(p => ({...p, fsName: val}))}    accent={ACCENT} />
        <WF label="SIN / NAPA ID" v={d.fsSinNapa} set={val => setD(p => ({...p, fsSinNapa: val}))} accent={ACCENT} />
        <SignaturePad value={d.fsSigned} onChange={val => setD(p => ({...p, fsSigned: val}))} accent={ACCENT} />
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
      previewContent={buildPreviewContent(handleShare, ACCENT)}
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
