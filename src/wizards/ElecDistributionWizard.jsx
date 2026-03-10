import { useState, useRef, useEffect } from 'react'
import { PDFDocument, rgb } from 'pdf-lib'
import { Zap } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { WF, WTA, WCB, SectionHead } from '../shared/WizardInputs'
import { SignaturePad } from '../shared/SignaturePad'
import { PdfCanvasPreview } from '../shared/PdfCanvasPreview'
import { CoordOverlay } from '../shared/CoordOverlay'
import { saveToHistory } from '../shared/jobHistory'
import { JobHistoryPicker } from '../shared/JobHistoryPicker'
import { useDraft } from '../shared/useDraft'

// ─── Dev calibration — set false when coords are finalised ────
const EB_SHOW_OVERLAY = false

// ─── Accent colours ───────────────────────────────────────────
const EB_ORANGE = '#ea580c'
const EB_BG     = '#fff7ed'
const EB_MID    = '#fed7aa'
const EB_BORDER = '#fdba74'

// ─── Step labels ──────────────────────────────────────────────
const EB_STEPS = [
  'Job Details',
  'Distribution Main',
  'Underground Details',
  'Comments & Plan',
  'Preview & Print',
]

// ─── Empty cable row template ─────────────────────────────────
const EMPTY_ROW = () => ({
  voltage: '', phase: '', cableSize: '', material: '',
  insulation: '', numberOfCables: '', numberOfCores: '', circuitLength: '',
})

// ─── CableRow — defined OUTSIDE component so React never remounts it ──
// Card-based layout: 2 fields per row, much friendlier on small screens.
const CABLE_FIELDS = [
  ['Voltage',          'voltage',       'text'],
  ['Phase',            'phase',         'text'],
  ['Cable Size',       'cableSize',     'text'],
  ['Material',         'material',      'text'],
  ['Insulation',       'insulation',    'text'],
  ['No. of Cables',    'numberOfCables','number'],
  ['No. of Cores',     'numberOfCores', 'number'],
  ['Circuit Length',   'circuitLength', 'text'],
]

function CableRow({ row, idx, setRow, onRemove, canRemove }) {
  const inp = {
    width: '100%', padding: '8px 10px', borderRadius: 7,
    border: `1.5px solid ${EB_BORDER}`, fontFamily: 'inherit',
    fontSize: 14, background: '#fff', outline: 'none', boxSizing: 'border-box',
  }
  const lbl = {
    fontSize: 11, fontWeight: 700, color: '#9a3412',
    marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em',
  }
  return (
    <div style={{
      background: '#fff',
      border: `1.5px solid ${EB_BORDER}`,
      borderRadius: 10,
      padding: '12px 12px 8px',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: EB_ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Circuit {idx + 1}
        </span>
        {canRemove && (
          <button
            onClick={onRemove}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#ef4444', fontSize: 13, fontWeight: 700, padding: '2px 6px',
              borderRadius: 6, fontFamily: 'inherit',
            }}
          >
            ✕ Remove
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
        {CABLE_FIELDS.map(([label, key, type]) => (
          <div key={key}>
            <label style={lbl}>{label}</label>
            <input
              type={type}
              style={inp}
              value={row[key]}
              onChange={e => setRow(idx, key, e.target.value)}
              placeholder="—"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Word-wrap helper — breaks on points, not characters
// ─────────────────────────────────────────────────────────────
function wrapText(text, font, size, maxPts) {
  const words = String(text).split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current ? current + ' ' + word : word
    if (font.widthOfTextAtSize(candidate, size) <= maxPts) {
      current = candidate
    } else {
      if (current) lines.push(current)
      if (font.widthOfTextAtSize(word, size) > maxPts) {
        let part = ''
        for (const char of word) {
          const next = part + char
          if (font.widthOfTextAtSize(next, size) <= maxPts) {
            part = next
          } else {
            if (part) lines.push(part)
            part = char
          }
        }
        current = part
      } else {
        current = word
      }
    }
  }
  if (current) lines.push(current)
  return lines
}

// ─────────────────────────────────────────────────────────────
// PDF generation
// ─────────────────────────────────────────────────────────────
async function generateEbPdf(d) {
  const bytes = await fetch(
    import.meta.env.BASE_URL + 'forms/360S014EB.pdf'
  ).then(r => r.arrayBuffer())

  const srcDoc = await PDFDocument.load(bytes)
  const pdfDoc = await PDFDocument.create()
  const [copiedPage] = await pdfDoc.copyPages(srcDoc, [0])
  pdfDoc.addPage(copiedPage)
  const p1     = pdfDoc.getPages()[0]
  const font   = await pdfDoc.embedFont('Helvetica')
  const PAGE_H = 842
  const BLUE   = rgb(26/255, 26/255, 1)

  const t = (x, cssY, str, size = 8.5) => {
    if (!str) return
    p1.drawText(String(str), {
      x, y: PAGE_H - cssY - size, size, font, color: BLUE,
    })
  }

  const ck = (x, cssY, show) => {
    if (!show) return
    const by = PAGE_H - cssY - 2
    p1.drawLine({ start: { x,        y: by - 6 }, end: { x: x + 3, y: by - 9 }, thickness: 1.5, color: BLUE })
    p1.drawLine({ start: { x: x + 3, y: by - 9 }, end: { x: x + 9, y: by - 1 }, thickness: 1.5, color: BLUE })
  }

  const tWrap = (x, cssY, str, maxPts, lineH = 11, maxLines = 2, size = 8.5) => {
    if (!str) return
    wrapText(str, font, size, maxPts).slice(0, maxLines)
      .forEach((line, i) => t(x, cssY + i * lineH, line, size))
  }

  // ── Header ─────────────────────────────────────────────────
  t(120,  86, d.streetRoad)
  t(450,  86, d.contractor)
  t(120, 103, d.cityTown)
  t(255, 103, d.district)
  t(450, 103, d.dateWorkCompleted)
  t(120, 120, d.pcoWONo)
  t(255, 120, d.ciwrNo)
  t(160, 137, d.npJobNumber)
  t(450, 137, d.namePrint)

  // ── Signature ──────────────────────────────────────────────
  if (d.signed) {
    try {
      const sigBytes = Uint8Array.from(atob(d.signed.split(',')[1]), c => c.charCodeAt(0))
      const sigImg   = await pdfDoc.embedPng(sigBytes)
      p1.drawImage(sigImg, { x: 448, y: PAGE_H - 131, width: 110, height: 20, opacity: 1 })
    } catch (_) {}
  }

  // ── Distribution Main ──────────────────────────────────────
  ck(134, 181, d.distributionMain === 'Overhead')
  ck(212, 181, d.distributionMain === 'Underground')
  if (d.distributionMain === 'Underground') t(500, 182, d.undergroundCableDepth)

  // ── Cable table rows (up to 3) ────────────────────────────
  const ROW_Y = [233, 246, 259]
  const COL_X = {
    voltage: 55, phase: 125, cableSize: 175, material: 250,
    insulation: 350, numberOfCables: 420, numberOfCores: 485, circuitLength: 538,
  }
  d.cableRows.slice(0, 3).forEach((row, i) => {
    const y = ROW_Y[i]
    t(COL_X.voltage,        y, row.voltage)
    t(COL_X.phase,          y, row.phase)
    t(COL_X.cableSize,      y, row.cableSize)
    t(COL_X.material,       y, row.material)
    t(COL_X.insulation,     y, row.insulation)
    t(COL_X.numberOfCables, y, row.numberOfCables)
    t(COL_X.numberOfCores,  y, row.numberOfCores)
    t(COL_X.circuitLength,  y, row.circuitLength)
  })

  // ── Ownership ──────────────────────────────────────────────
  ck(113, 270, d.ownership === 'Powerco')
  ck(213, 270, d.ownership === 'Customer')
  ck(321, 270, d.ownership === 'Other')
  if (d.ownership === 'Other') t(400, 272, d.ownershipOther)

  // ── Underground section ────────────────────────────────────
  // Cable duct used: Yes / No
  ck(135, 318, d.cableDuctUsed === 'Yes')
  ck(199, 318, d.cableDuctUsed === 'No')
  // Duct type: New / Existing (only relevant if Yes)
  ck(270, 318, d.cableDuctUsed === 'Yes' && d.cableDuctType === 'New')
  ck(327, 318, d.cableDuctUsed === 'Yes' && d.cableDuctType === 'Existing')
  // Capped
  ck(441, 318, d.capped === 'Yes')
  ck(505, 318, d.capped === 'No')
  // No. of ducts / size / draw wire
  t(130, 338, d.numberOfDucts)
  t(270, 338, d.ductSize)
  ck(441, 337, d.drawWire === 'Yes')
  ck(505, 337, d.drawWire === 'No')
  // Other services in trench
  ck(158, 356, d.otherServicesInTrench.includes('Gas'))
  ck(215, 356, d.otherServicesInTrench.includes('Telecom'))
  ck(315, 356, d.otherServicesInTrench.includes('Water'))
  if (d.otherServicesInTrench.includes('Other')) t(430, 357, d.otherServicesOther)
  // GPS
  ck(158, 381, d.gpsRequired === 'Yes')
  ck(215, 381, d.gpsRequired === 'No')
  if (d.gpsRequired === 'Yes') t(425, 383, d.gpsFiles)

  // ── Comments ───────────────────────────────────────────────
  tWrap(195, 701, d.comments, 370, 14, 4)

  return await pdfDoc.save()
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function ElecDistributionWizard({ onClose }) {
  const [step, setStep] = useState(0)

  const [d, setD] = useState({
    // Standard job-history fields
    npJobNumber:          '',
    projectName:          '',
    pcoWONo:              '',
    ciwrNo:               '',
    streetRoad:           '',
    cityTown:             '',
    district:             '',
    contractor:           '',
    dateWorkCompleted:    '',
    namePrint:            '',
    signed:               '',
    // Distribution Main
    distributionMain:      '',
    undergroundCableDepth: '',
    cableRows: [EMPTY_ROW()],
    ownership:      '',
    ownershipOther: '',
    // Underground Details
    cableDuctUsed:         '',   // Yes / No
    cableDuctType:         '',   // New / Existing (shown only if cableDuctUsed === 'Yes')
    capped:                '',
    numberOfDucts:         '',
    ductSize:              '',
    drawWire:              '',
    otherServicesInTrench: [],
    otherServicesOther:    '',
    gpsRequired:           '',
    gpsFiles:              '',
    // Comments
    comments: '',
  })

  const [pdfBytes,      setPdfBytes]      = useState(null)
  const [pdfBlobUrl,    setPdfBlobUrl]    = useState(null)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [pdfError,      setPdfError]      = useState(null)
  const [isPreview,     setIsPreview]     = useState(false)
  const [pickerOpen,    setPickerOpen]    = useState(false)
  const [overlayTab,    setOverlayTab]    = useState('form')
  const [overlayBytes,  setOverlayBytes]  = useState(null)

  const prevStepRef = useRef(step)

  const set = (k, v) => setD(prev => ({ ...prev, [k]: v }))

  // Stable setRow — passed as prop to CableRow to avoid remounting
  const setRow = (i, k, v) => setD(prev => {
    const rows = prev.cableRows.map((r, idx) => idx === i ? { ...r, [k]: v } : r)
    return { ...prev, cableRows: rows }
  })

  // ── Auto-save job history on step 0 → 1 ──────────────────
  useEffect(() => {
    if (prevStepRef.current === 0 && step === 1) saveToHistory(d)
    prevStepRef.current = step
  }, [step])

  // ── Fetch PDF bytes for CoordOverlay ─────────────────────
  useEffect(() => {
    if (EB_SHOW_OVERLAY && overlayTab === 'calibrate' && !overlayBytes) {
      fetch(import.meta.env.BASE_URL + 'forms/360S014EB.pdf')
        .then(r => r.arrayBuffer())
        .then(buf => setOverlayBytes(new Uint8Array(buf)))
        .catch(() => {})
    }
  }, [overlayTab, overlayBytes])

  // ── PDF generation ────────────────────────────────────────
  const triggerGenerate = async () => {
    setIsPreview(true)
    setPdfGenerating(true)
    setPdfError(null)
    setPdfBytes(null)
    try {
      const bytes = await generateEbPdf(d)
      setPdfBytes(bytes)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      setPdfBlobUrl(URL.createObjectURL(blob))
    } catch (e) {
      setPdfError('PDF generation failed: ' + e.message)
    } finally {
      setPdfGenerating(false)
    }
  }

  // ── Share ─────────────────────────────────────────────────
  const handleShare = async () => {
    if (!pdfBytes) return
    const filename = (() => {
      const sanitise = s => (s || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim()
      const proj = sanitise(d.projectName)
      const np   = sanitise(d.npJobNumber)
      const form = 'Elec Distribution Record'
      const parts = [proj, np, form].filter(Boolean)
      return parts.join(' - ') + '.pdf'
    })()
    const file = new File([pdfBytes], filename, { type: 'application/pdf' })
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); clearFormDraft() } catch (_) {}
    } else if (pdfBlobUrl) {
      window.open(pdfBlobUrl, '_blank')
    }
  }

  const loadJobHistory = fields => setD(prev => ({ ...prev, ...fields }))

  // ── Missing fields ────────────────────────────────────────
  const missingFields = [
    !d.pcoWONo          && 'PCo W/O No.',
    !d.streetRoad       && 'No./Street/Road',
    !d.contractor       && 'Contractor',
    !d.distributionMain && 'Distribution Main',
    !d.signed           && 'Signature',
  ].filter(Boolean)

  // ── Step content ──────────────────────────────────────────
  const { DraftBanner, clearDraft: clearFormDraft } = useDraft('360S014EB', d, step, setD, setStep)

  const formSteps = [

    // ── Step 0 — Job Details ─────────────────────────────
    <div key="s0">
      <DraftBanner />
      <button
        onClick={() => setPickerOpen(true)}
        style={{
          width: '100%', padding: '10px 0', marginBottom: 16,
          borderRadius: 8, border: `2px dashed ${EB_ORANGE}`,
          background: EB_BG, color: EB_ORANGE,
          fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        📋 Load Previous Job
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <WF label="Project Name"  v={d.projectName} set={v => set('projectName', v)} accent={EB_ORANGE} />
        <WF label="NP Job Number" v={d.npJobNumber}  set={v => set('npJobNumber',  v)} accent={EB_ORANGE} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <WF label="PCo W/O No." v={d.pcoWONo} set={v => set('pcoWONo', v)} accent={EB_ORANGE} />
        <WF label="CIWR No."    v={d.ciwrNo}  set={v => set('ciwrNo',  v)} accent={EB_ORANGE} />
      </div>
      <WF label="No./Street/Road" v={d.streetRoad} set={v => set('streetRoad', v)} ph="123 Example Road" accent={EB_ORANGE} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <WF label="City / Town" v={d.cityTown} set={v => set('cityTown', v)} ph="Hamilton" accent={EB_ORANGE} />
        <WF label="District"    v={d.district} set={v => set('district', v)} ph="Waikato"  accent={EB_ORANGE} />
      </div>

      <div style={{ height: 1, background: '#eee', margin: '14px 0' }} />

      <WF label="Contractor"               v={d.contractor}            set={v => set('contractor',            v)} accent={EB_ORANGE} />
      <WF label="Date Work Completed" type="date" v={d.dateWorkCompleted} set={v => set('dateWorkCompleted', v)} accent={EB_ORANGE} />
      <WF label="Name (Print)"             v={d.namePrint}             set={v => set('namePrint',             v)} accent={EB_ORANGE} />
      <SignaturePad value={d.signed} onChange={v => set('signed', v)} accent={EB_ORANGE} />
    </div>,

    // ── Step 1 — Distribution Main ───────────────────────
    <div key="s1">
      <SectionHead label="Distribution Connection Details" accent={EB_ORANGE} />

      <WCB
        label="Distribution Main"
        options={['Overhead', 'Underground']}
        value={d.distributionMain}
        onChange={v => set('distributionMain', v)}
        accent={EB_ORANGE}
      />

      {d.distributionMain === 'Underground' && (
        <div style={{ marginTop: 10 }}>
          <WF
            label="Underground Cable Depth (mm)"
            type="number"
            v={d.undergroundCableDepth}
            set={v => set('undergroundCableDepth', v)}
            accent={EB_ORANGE}
          />
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <SectionHead label="Cable Details" accent={EB_ORANGE} />
        {d.cableRows.map((row, i) => (
          <CableRow
            key={i}
            row={row}
            idx={i}
            setRow={setRow}
            canRemove={d.cableRows.length > 1}
            onRemove={() => setD(prev => ({
              ...prev,
              cableRows: prev.cableRows.filter((_, ri) => ri !== i),
            }))}
          />
        ))}
        {d.cableRows.length < 3 && (
          <button
            onClick={() => setD(prev => ({ ...prev, cableRows: [...prev.cableRows, EMPTY_ROW()] }))}
            style={{
              width: '100%', padding: '10px 0', marginTop: 2,
              borderRadius: 8, border: `2px dashed ${EB_ORANGE}`,
              background: EB_BG, color: EB_ORANGE,
              fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            + Add Circuit
          </button>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <WCB
          label="Ownership"
          options={['Powerco', 'Customer', 'Other']}
          value={d.ownership}
          onChange={v => set('ownership', v)}
          accent={EB_ORANGE}
        />
        {d.ownership === 'Other' && (
          <div style={{ marginTop: 10 }}>
            <WF label="Other — specify" v={d.ownershipOther} set={v => set('ownershipOther', v)} accent={EB_ORANGE} />
          </div>
        )}
      </div>
    </div>,

    // ── Step 2 — Underground Details ─────────────────────
    <div key="s2">
      {d.distributionMain !== 'Underground' ? (
        <div style={{
          background: EB_BG, border: `1px solid ${EB_BORDER}`,
          borderRadius: 10, padding: '20px 18px', textAlign: 'center',
          color: '#9a3412', fontSize: 14, lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🏗️</div>
          <strong>Underground Details — not applicable</strong>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#c2410c' }}>
            This section only applies to underground distribution.
            You selected <strong>{d.distributionMain || 'no type'}</strong> on the previous step.
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9a3412' }}>
            Tap <strong>Next →</strong> to continue.
          </p>
        </div>
      ) : (
        <>
          <SectionHead label="Underground Distribution Cable" accent={EB_ORANGE} />

          {/* ── Cable duct: Yes / No first ── */}
          <WCB
            label="Cable Duct Used"
            options={['Yes', 'No']}
            value={d.cableDuctUsed}
            onChange={v => set('cableDuctUsed', v)}
            accent={EB_ORANGE}
          />

          {/* ── Duct details — only if Yes ── */}
          {d.cableDuctUsed === 'Yes' && (
            <div style={{
              marginTop: 12,
              padding: '12px 14px',
              background: '#fff',
              border: `1px solid ${EB_BORDER}`,
              borderRadius: 8,
            }}>
              <WCB
                label="Duct Type"
                options={['New', 'Existing']}
                value={d.cableDuctType}
                onChange={v => set('cableDuctType', v)}
                accent={EB_ORANGE}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', marginTop: 12 }}>
                <WF label="No. of Ducts" type="number" v={d.numberOfDucts} set={v => set('numberOfDucts', v)} accent={EB_ORANGE} />
                <WF label="Size (mm)"    type="number" v={d.ductSize}      set={v => set('ductSize',      v)} accent={EB_ORANGE} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', marginTop: 10 }}>
                <WCB
                  label="Capped"
                  options={['Yes', 'No']}
                  value={d.capped}
                  onChange={v => set('capped', v)}
                  accent={EB_ORANGE}
                />
                <WCB
                  label="Draw Wire"
                  options={['Yes', 'No']}
                  value={d.drawWire}
                  onChange={v => set('drawWire', v)}
                  accent={EB_ORANGE}
                />
              </div>
            </div>
          )}

          {/* ── Other services — always shown for UG ── */}
          <div style={{ marginTop: 14 }}>
            <WCB
              label="Other Services in Trench"
              options={['Gas', 'Telecom', 'Water', 'Other']}
              value={d.otherServicesInTrench}
              onChange={v => {
                const cur = d.otherServicesInTrench
                set('otherServicesInTrench',
                  cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]
                )
              }}
              multi
              accent={EB_ORANGE}
            />
            {d.otherServicesInTrench.includes('Other') && (
              <div style={{ marginTop: 10 }}>
                <WF
                  label="Other service — specify"
                  v={d.otherServicesOther}
                  set={v => set('otherServicesOther', v)}
                  accent={EB_ORANGE}
                />
              </div>
            )}
          </div>

          {/* ── GPS ── */}
          <div style={{ marginTop: 14 }}>
            <WCB
              label="GPS Location Required"
              options={['Yes', 'No']}
              value={d.gpsRequired}
              onChange={v => set('gpsRequired', v)}
              accent={EB_ORANGE}
            />
            {d.gpsRequired === 'Yes' && (
              <div style={{ marginTop: 10 }}>
                <WF label="GPS Files" v={d.gpsFiles} set={v => set('gpsFiles', v)} accent={EB_ORANGE} />
              </div>
            )}
          </div>
        </>
      )}
    </div>,

    // ── Step 3 — Comments & Plan ─────────────────────────
    <div key="s3">
      <SectionHead label="Dimensioned Plan" accent={EB_ORANGE} />
      <div style={{
        background: EB_BG, border: `1px solid ${EB_BORDER}`,
        borderRadius: 8, padding: '10px 14px', marginBottom: 14,
        fontSize: 13, color: '#9a3412', lineHeight: 1.5,
      }}>
        <strong>📐 Location plan:</strong> Draw the dimensioned plan manually on
        the printed form.
      </div>

      <SectionHead label="Comments" accent={EB_ORANGE} />
      <WTA
        label="Comments (e.g. boundary unknown etc.)"
        v={d.comments}
        set={v => set('comments', v)}
        accent={EB_ORANGE}
        rows={4}
      />
    </div>,

    // ── Step 4 — Preview ─────────────────────────────────
    <div key="s4" />,
  ]

  // ── Preview content ───────────────────────────────────────
  const previewContent = (
    <>
      {pdfGenerating && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          height: '100%', color: '#9ca3af',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Generating PDF…</div>
        </div>
      )}
      {pdfError && !pdfGenerating && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', height: '100%',
        }}>
          <div style={{ fontSize: 14, color: '#f87171', marginBottom: 12 }}>{pdfError}</div>
          <button
            onClick={triggerGenerate}
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              background: EB_ORANGE, color: '#fff',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}
      {!pdfGenerating && !pdfError && pdfBytes && (
        <PdfCanvasPreview pdfBytes={pdfBytes} />
      )}
    </>
  )

  // ─────────────────────────────────────────────────────────
  return (
    <>
      {EB_SHOW_OVERLAY && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 44,
          background: '#1e1e2e', display: 'flex', alignItems: 'center',
          zIndex: 9999, padding: '0 16px', gap: 8,
        }}>
          {['form', 'calibrate'].map(tab => (
            <button
              key={tab}
              onClick={() => setOverlayTab(tab)}
              style={{
                padding: '4px 14px', borderRadius: 20,
                border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                background: overlayTab === tab ? EB_ORANGE : 'transparent',
                color:      overlayTab === tab ? '#fff'   : '#888',
              }}
            >
              {tab === 'form' ? 'Form' : 'Calibrate'}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#555', letterSpacing: 1 }}>
            CALIBRATION MODE — EB_SHOW_OVERLAY = true
          </span>
        </div>
      )}

      {EB_SHOW_OVERLAY && overlayTab === 'calibrate' ? (
        <div style={{
          position: 'fixed', inset: 0, top: 44,
          background: '#111',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          overflow: 'auto',
        }}>
          {overlayBytes
            ? <CoordOverlay pdfBytes={overlayBytes} page={1} />
            : <div style={{ color: '#888', marginTop: 40 }}>Loading PDF…</div>
          }
        </div>
      ) : (
        <WizardShell
          title="AS-Built Elec. Distribution"
          formNumber="360S014EB"
          headerIcon={<Zap size={20} color="#fff" />}
          steps={EB_STEPS}
          step={step}
          onStepClick={i => {
            setStep(i)
            if (i === EB_STEPS.length - 1) triggerGenerate()
          }}
          onClose={onClose}
          onBack={() => setStep(s => s - 1)}
          onNext={() => {
            const n = step + 1
            setStep(n)
            if (n === EB_STEPS.length - 1) triggerGenerate()
          }}
          accent={EB_ORANGE}
          bg={EB_BG}
          mid={EB_MID}
          border={EB_BORDER}
          devPaddingTop={EB_SHOW_OVERLAY ? 44 : 0}
          isPreview={isPreview}
          onShare={handleShare}
          onClosePreview={() => {
            setIsPreview(false)
            setStep(s => s - 1)
            setPdfBytes(null)
            setPdfBlobUrl(null)
          }}
          missingFields={missingFields}
          previewContent={previewContent}
        >
          {formSteps[step]}
        </WizardShell>
      )}

      <JobHistoryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={loadJobHistory}
        accent={EB_ORANGE}
      />
    </>
  )
}
