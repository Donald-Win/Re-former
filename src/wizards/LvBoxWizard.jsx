import { useState, useRef, useEffect } from 'react'
import { PDFDocument, rgb } from 'pdf-lib'
import { Box } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { WF, WTA, WCB, SectionHead } from '../shared/WizardInputs'
import { SignaturePad } from '../shared/SignaturePad'
import { PdfCanvasPreview } from '../shared/PdfCanvasPreview'
import { CoordOverlay } from '../shared/CoordOverlay'
import { saveToHistory } from '../shared/jobHistory'
import { JobHistoryPicker } from '../shared/JobHistoryPicker'

// ─── Dev calibration — set false when coords are finalised ────
const ED_SHOW_OVERLAY = false

// ─── Accent colours ───────────────────────────────────────────
const ED_GREEN  = '#16a34a'
const ED_BG     = '#f0fdf4'
const ED_MID    = '#bbf7d0'
const ED_BORDER = '#86efac'

// ─── Step labels ──────────────────────────────────────────────
const ED_STEPS = [
  'Job Details',
  'Box Entries',
  'Comments',
  'Preview & Print',
]

// ─── Empty box row template ───────────────────────────────────
const EMPTY_BOX_ROW = () => ({
  equipIdNew:        '',
  equipIdOld:        '',
  address:           '',
  manufacturer:      '',
  model:             '',
  serviceOrDist:     '',   // 'Service' | 'Distribution'
  numberOfDisconnects: '',
  fuseHolders:       '',
  typeOfChange:      '',
  reasonForRemoval:  '',
  owner:             '',
})

// ─── BoxRow — defined OUTSIDE component (stable reference) ────
const BOX_FIELDS_LEFT = [
  ['Equipment ID — New',            'equipIdNew',          'text'],
  ['Equipment ID — Old',            'equipIdOld',          'text'],
  ['Address',                       'address',             'text'],
  ['Manufacturer',                  'manufacturer',        'text'],
  ['Model',                         'model',               'text'],
  ['No. of Disconnects',            'numberOfDisconnects', 'number'],
]
const BOX_FIELDS_RIGHT = [
  ['No. of Service Fuse Holders & Ratings', 'fuseHolders',      'text'],
  ['Type of Change',                        'typeOfChange',     'text'],
  ['Reason for Removal / Replacement',      'reasonForRemoval', 'text'],
  ['Owner',                                 'owner',            'text'],
]

function BoxRow({ row, idx, setRow, onRemove, canRemove }) {
  const inp = {
    width: '100%', padding: '8px 10px', borderRadius: 7,
    border: `1.5px solid ${ED_BORDER}`, fontFamily: 'inherit',
    fontSize: 14, background: '#fff', outline: 'none', boxSizing: 'border-box',
  }
  const lbl = {
    fontSize: 11, fontWeight: 700, color: '#15803d',
    marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em',
  }

  return (
    <div style={{
      background: '#fff',
      border: `1.5px solid ${ED_BORDER}`,
      borderRadius: 10,
      padding: '12px 12px 10px',
      marginBottom: 12,
    }}>
      {/* Row header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: ED_GREEN, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Box Entry {idx + 1}
        </span>
        {canRemove && (
          <button
            onClick={onRemove}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#ef4444', fontSize: 13, fontWeight: 700,
              padding: '2px 6px', borderRadius: 6, fontFamily: 'inherit',
            }}
          >
            ✕ Remove
          </button>
        )}
      </div>

      {/* Service or Distribution chip */}
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>Service or Distribution Box</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Service', 'Distribution'].map(opt => {
            const sel = row.serviceOrDist === opt
            return (
              <button
                key={opt}
                onClick={() => setRow(idx, 'serviceOrDist', sel ? '' : opt)}
                style={{
                  padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                  border: `2px solid ${sel ? ED_GREEN : ED_BORDER}`,
                  background: sel ? ED_GREEN : '#fff',
                  color: sel ? '#fff' : '#333',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: sel ? 700 : 400,
                }}
              >
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      {/* 2-column grid of text fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
        {[...BOX_FIELDS_LEFT, ...BOX_FIELDS_RIGHT].map(([label, key, type]) => (
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
// Word-wrap helper
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
          if (font.widthOfTextAtSize(next, size) <= maxPts) { part = next }
          else { if (part) lines.push(part); part = char }
        }
        current = part
      } else { current = word }
    }
  }
  if (current) lines.push(current)
  return lines
}

// ─────────────────────────────────────────────────────────────
// PDF generation
// Landscape A4: width ≈ 842, height ≈ 595
// cssY = distance from PAGE TOP; y = PAGE_H - cssY - size
// All coordinates are initial estimates — calibrate with overlay.
// ─────────────────────────────────────────────────────────────
async function generateEdPdf(d) {
  const bytes = await fetch(
    import.meta.env.BASE_URL + 'forms/360S014ED.pdf'
  ).then(r => r.arrayBuffer())

  const srcDoc = await PDFDocument.load(bytes)
  const pdfDoc = await PDFDocument.create()
  const [copiedPage] = await pdfDoc.copyPages(srcDoc, [0])
  pdfDoc.addPage(copiedPage)
  const p1   = pdfDoc.getPages()[0]
  const font = await pdfDoc.embedFont('Helvetica')

  // Landscape: width > height
  const PAGE_H = p1.getHeight()   // ≈ 595
  const BLUE   = rgb(26/255, 26/255, 1)

  const t = (x, cssY, str, size = 7) => {
    if (!str) return
    p1.drawText(String(str), {
      x, y: PAGE_H - cssY - size, size, font, color: BLUE,
    })
  }

  const tWrap = (x, cssY, str, maxPts, lineH = 9, maxLines = 3, size = 7) => {
    if (!str) return
    wrapText(str, font, size, maxPts).slice(0, maxLines)
      .forEach((line, i) => t(x, cssY + i * lineH, line, size))
  }

  // ── Header ─────────────────────────────────────────────────
  // Left column
  t(120, 150, d.streetRoad)
  t(120, 160, [d.cityTown, d.district].filter(Boolean).join(', '))
  t(120, 170, d.pcoWONo)
  t(120, 180, d.ciwrNo)
  // Right column
  t(460, 150, d.contractor)
  t(460, 160, d.dateWorkCompleted)
  t(460, 170, d.npJobNumber)

  // ── Signature ──────────────────────────────────────────────
  if (d.signed) {
    try {
      const sigBytes = Uint8Array.from(atob(d.signed.split(',')[1]), c => c.charCodeAt(0))
      const sigImg   = await pdfDoc.embedPng(sigBytes)
      p1.drawImage(sigImg, { x: 460, y: PAGE_H - 190, width: 90, height: 15, opacity: 1 })
    } catch (_) {}
  }

  // ── Table rows ─────────────────────────────────────────────
  // Row 1 starts at cssY ≈ 168; each row ≈ 10.5pt tall
  // Columns (x positions, estimated):
  //   equipIdNew:        x=38
  //   equipIdOld:        x=82
  //   address:           x=126
  //   manufacturer:      x=248
  //   model:             x=322
  //   serviceOrDist:     x=400   (text: 'S' or 'D' for brevity)
  //   numberOfDisconnects: x=448
  //   fuseHolders:       x=470
  //   typeOfChange:      x=558
  //   reasonForRemoval:  x=614
  //   owner:             x=722

  const ROW_START_Y = 249
  const ROW_H       = 9.8

  d.boxRows.slice(0, 20).forEach((row, i) => {
    const y = ROW_START_Y + i * ROW_H
    t(59,  y, row.equipIdNew,          6.5)
    t(115, y, row.equipIdOld,          6.5)
    t(169, y, row.address,             6.5)
    t(290, y, row.manufacturer,        6.5)
    t(347, y, row.model,               6.5)
    if (row.serviceOrDist === 'Service')      t(452, y, 'Service', 6.5)
    if (row.serviceOrDist === 'Distribution') t(452, y, 'Distribution', 6.5)
    t(498, y, row.numberOfDisconnects, 6.5)
    t(520, y, row.fuseHolders,         6.5)
    t(595, y, row.typeOfChange,        6.5)
    t(640, y, row.reasonForRemoval,    6.5)
    t(695, y, row.owner,               6.5)
  })

  // ── Additional Comments ────────────────────────────────────
  tWrap(45, 455, d.comments, 700, 10, 5, 7)

  return await pdfDoc.save()
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
export default function LvBoxWizard({ onClose }) {
  const [step, setStep] = useState(0)

  const [d, setD] = useState({
    // Job Details
    npJobNumber:           '',
    projectName:           '',
    streetRoad:            '',
    cityTown:              '',
    district:              '',
    pcoWONo:               '',
    ciwrNo:                '',
    contractor:            '',
    dateWorkCompleted:     '',
    signed:                '',
    // Box table rows
    boxRows: [EMPTY_BOX_ROW()],
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
  const set    = (k, v) => setD(prev => ({ ...prev, [k]: v }))
  const setRow = (i, k, v) => setD(prev => {
    const rows = prev.boxRows.map((r, idx) => idx === i ? { ...r, [k]: v } : r)
    return { ...prev, boxRows: rows }
  })

  // ── Auto-save job history on step 0 → 1 ──────────────────
  useEffect(() => {
    if (prevStepRef.current === 0 && step === 1) saveToHistory(d)
    prevStepRef.current = step
  }, [step])

  // ── Fetch PDF bytes for CoordOverlay ─────────────────────
  useEffect(() => {
    if (ED_SHOW_OVERLAY && overlayTab === 'calibrate' && !overlayBytes) {
      fetch(import.meta.env.BASE_URL + 'forms/360S014ED.pdf')
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
      const bytes = await generateEdPdf(d)
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
    const filename = `LvBox-${d.pcoWONo || d.streetRoad || 'record'}.pdf`
    const file = new File([pdfBytes], filename, { type: 'application/pdf' })
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }) } catch (_) {}
    } else if (pdfBlobUrl) {
      window.open(pdfBlobUrl, '_blank')
    }
  }

  const loadJobHistory = fields => setD(prev => ({ ...prev, ...fields }))

  const missingFields = [
    !d.pcoWONo     && 'Powerco WO No.',
    !d.streetRoad  && 'No./Street/Road',
    !d.contractor  && 'Contractor',
    !d.signed      && 'Signature',
  ].filter(Boolean)

  // ── Step content ──────────────────────────────────────────
  const formSteps = [

    // ── Step 0 — Job Details ─────────────────────────────
    <div key="s0">
      <button
        onClick={() => setPickerOpen(true)}
        style={{
          width: '100%', padding: '10px 0', marginBottom: 16,
          borderRadius: 8, border: `2px dashed ${ED_GREEN}`,
          background: ED_BG, color: ED_GREEN,
          fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        📋 Load Previous Job
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <WF label="Project Name"  v={d.projectName} set={v => set('projectName', v)} accent={ED_GREEN} />
        <WF label="NP Job Number" v={d.npJobNumber}  set={v => set('npJobNumber',  v)} accent={ED_GREEN} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <WF label="PCo W/O No."  v={d.pcoWONo} set={v => set('pcoWONo', v)} accent={ED_GREEN} />
        <WF label="CIWR No."     v={d.ciwrNo}  set={v => set('ciwrNo',  v)} accent={ED_GREEN} />
      </div>
      <WF label="No./Street/Road" v={d.streetRoad} set={v => set('streetRoad', v)} ph="123 Example Road" accent={ED_GREEN} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <WF label="City / Town" v={d.cityTown} set={v => set('cityTown', v)} ph="Hamilton" accent={ED_GREEN} />
        <WF label="District"    v={d.district} set={v => set('district', v)} ph="Waikato"  accent={ED_GREEN} />
      </div>

      <div style={{ height: 1, background: '#eee', margin: '14px 0' }} />

      <WF label="Contractor"               v={d.contractor}            set={v => set('contractor',            v)} accent={ED_GREEN} />
      <WF label="Date Work Completed" type="date" v={d.dateWorkCompleted} set={v => set('dateWorkCompleted', v)} accent={ED_GREEN} />
      <SignaturePad value={d.signed} onChange={v => set('signed', v)} accent={ED_GREEN} />
    </div>,

    // ── Step 1 — Box Entries ─────────────────────────────
    <div key="s1">
      <SectionHead label="LV Box Entries (up to 20)" accent={ED_GREEN} />

      {d.boxRows.map((row, i) => (
        <BoxRow
          key={i}
          row={row}
          idx={i}
          setRow={setRow}
          canRemove={d.boxRows.length > 1}
          onRemove={() => setD(prev => ({
            ...prev,
            boxRows: prev.boxRows.filter((_, ri) => ri !== i),
          }))}
        />
      ))}

      {d.boxRows.length < 20 && (
        <button
          onClick={() => setD(prev => ({ ...prev, boxRows: [...prev.boxRows, EMPTY_BOX_ROW()] }))}
          style={{
            width: '100%', padding: '10px 0', marginTop: 2,
            borderRadius: 8, border: `2px dashed ${ED_GREEN}`,
            background: ED_BG, color: ED_GREEN,
            fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          + Add Box Entry
        </button>
      )}
    </div>,

    // ── Step 2 — Comments ─────────────────────────────────
    <div key="s2">
      <SectionHead label="Additional Comments" accent={ED_GREEN} />
      <WTA
        label="Comments"
        v={d.comments}
        set={v => set('comments', v)}
        accent={ED_GREEN}
        rows={5}
      />
    </div>,

    // ── Step 3 — Preview ─────────────────────────────────
    <div key="s3" />,
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
              background: ED_GREEN, color: '#fff',
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
      {/* ── Dev calibration tab bar ─────────────────────── */}
      {ED_SHOW_OVERLAY && (
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
                background: overlayTab === tab ? ED_GREEN : 'transparent',
                color:      overlayTab === tab ? '#fff'  : '#888',
              }}
            >
              {tab === 'form' ? 'Form' : 'Calibrate'}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#555', letterSpacing: 1 }}>
            CALIBRATION MODE — ED_SHOW_OVERLAY = true
          </span>
        </div>
      )}

      {/* ── Calibrate tab ───────────────────────────────── */}
      {ED_SHOW_OVERLAY && overlayTab === 'calibrate' ? (
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
        /* ── Wizard ─────────────────────────────────────── */
        <WizardShell
          title="AS-Built LV Box Record"
          formNumber="360S014ED"
          headerIcon={<Box size={20} color="#fff" />}
          steps={ED_STEPS}
          step={step}
          onStepClick={i => {
            setStep(i)
            if (i === ED_STEPS.length - 1) triggerGenerate()
          }}
          onClose={onClose}
          onBack={() => setStep(s => s - 1)}
          onNext={() => {
            const n = step + 1
            setStep(n)
            if (n === ED_STEPS.length - 1) triggerGenerate()
          }}
          accent={ED_GREEN}
          bg={ED_BG}
          mid={ED_MID}
          border={ED_BORDER}
          devPaddingTop={ED_SHOW_OVERLAY ? 44 : 0}
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

      {/* ── Job history picker ───────────────────────────── */}
      <JobHistoryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={loadJobHistory}
        accent={ED_GREEN}
      />
    </>
  )
}
