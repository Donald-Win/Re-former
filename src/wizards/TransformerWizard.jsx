// 360S014EG — AS-Built Transformer Record
import React, { useState, useEffect, useRef } from 'react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { FileText, X, Share2 } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { APP_ACCENT, APP_YELLOW } from '../shared/constants'
import { saveToHistory } from '../shared/jobHistory'
import { JobHistoryPicker } from '../shared/JobHistoryPicker'
import { wInp, wLbl, WF, WTA, WCB, SectionHead } from '../shared/WizardInputs'
import { SignaturePad } from '../shared/SignaturePad'
import { PdfCanvasPreview } from '../shared/PdfCanvasPreview'
import { CoordOverlay } from '../shared/CoordOverlay'

const W_PURPLE = APP_ACCENT
const W_YELLOW = APP_YELLOW

//  360S014EG – AS-BUILT TRANSFORMER RECORD

const W_GREEN  = '#166534'   // issued
const W_GREEN_BG  = '#f0fdf4'
const W_GREEN_MID = '#dcfce7'
const W_GREEN_BORDER = '#86efac'
const W_RED    = '#991b1b'   // removed
const W_RED_BG    = '#fff5f5'
const W_RED_MID   = '#fee2e2'
const W_RED_BORDER = '#fca5a5'

// Which step index colour scheme to use
// 0,1 = neutral  2-6 = issued (green)  7-11 = removed (red)  12,13 = neutral
const STEP_SCHEME = [
  'neutral','neutral',
  'issued','issued','issued','issued','issued',
  'removed','removed','removed','removed','removed',
  'neutral','neutral',
]

function schemeColors(scheme) {
  if (scheme === 'issued')  return { bg: W_GREEN_BG,  mid: W_GREEN_MID,  border: W_GREEN_BORDER,  accent: W_GREEN,  label: 'Issued'  }
  if (scheme === 'removed') return { bg: W_RED_BG,    mid: W_RED_MID,    border: W_RED_BORDER,    accent: W_RED,    label: 'Removed' }
  return { bg: '#f4f4f8', mid: '#eee', border: '#ddd', accent: W_PURPLE, label: '' }
}

// ─── Input helpers ─────────────────────────────────────────────────────────────


const TX_SHOW_OVERLAY = false   // set true to enable calibration tab

// ─── Step definitions ──────────────────────────────────────────────────────────
const T_STEPS = [
  'Job Details',           // 0  neutral
  'Site Details',          // 1  neutral
  'Issued – Voltage & Connection',  // 2  green
  'Issued – Capacity & Phases',     // 3  green
  'Issued – Enclosure & Type',      // 4  green
  'Issued – Make, Model & Test',    // 5  green
  'Issued – Technical',             // 6  green
  'Removed – Voltage & Connection', // 7  red
  'Removed – Capacity & Phases',    // 8  red
  'Removed – Enclosure & Type',     // 9  red
  'Removed – Make & Model',         // 10 red
  'Removal Details',                // 11 red
  'Comments & Preview',             // 12 neutral
]

// ─── PDF generation ────────────────────────────────────────────────────────────
async function generatePdf(d) {
  const PAGE_H = 842
  const BLUE = rgb(26 / 255, 26 / 255, 1)

  const existingPdfBytes = await fetch(import.meta.env.BASE_URL + 'forms/360S014EG.pdf').then(r => r.arrayBuffer())
  const pdfDoc = await PDFDocument.load(existingPdfBytes)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const [p1, p2] = pdfDoc.getPages()

  const t = (page, x, cssY, str, size = 8.5) => {
    if (!str) return
    page.drawText(String(str), { x, y: PAGE_H - cssY - size, size, font, color: BLUE })
  }
  const tc = (page, fieldLeft, fieldWidth, cssY, str, size = 8.5) => {
    if (!str) return
    const w = font.widthOfTextAtSize(String(str), size)
    const x = fieldLeft + (fieldWidth / 2) - (w / 2)
    page.drawText(String(str), { x, y: PAGE_H - cssY - size, size, font, color: BLUE })
  }
  const ck = (page, x, cssY, show) => {
    if (!show) return
    const by = PAGE_H - cssY - 2
    page.drawLine({ start: { x, y: by - 6 }, end: { x: x + 3, y: by - 9 }, thickness: 1.5, color: BLUE, opacity: 1 })
    page.drawLine({ start: { x: x + 3, y: by - 9 }, end: { x: x + 9, y: by - 1 }, thickness: 1.5, color: BLUE, opacity: 1 })
  }
  const circ = (page, cx, cssYCentre, rx, ry, show) => {
    if (!show) return
    page.drawEllipse({ x: cx, y: PAGE_H - cssYCentre, xScale: rx, yScale: ry, borderColor: BLUE, borderWidth: 1.2, color: rgb(0, 0, 0), opacity: 0, borderOpacity: 1 })
  }

  const i = d.issued
  const r = d.removed

  // ── ADDRESS BLOCK ──────────────────────────────────────────────────────────
  t(p1, 115,  88, d.streetRoad)
  t(p1, 440,  88, d.contractor)
  t(p1, 115, 106, d.cityTown)
  t(p1, 250, 106, d.district)
  t(p1, 440, 106, d.dateWorkCompleted)
  t(p1, 115, 123, d.pcoWONo)
  t(p1, 250, 123, d.ciwrNo)
  if (d.signed && d.signed.startsWith("data:image")) {
    const sigBytes = Uint8Array.from(atob(d.signed.split(",")[1]), c => c.charCodeAt(0));
    const sigImg = await pdfDoc.embedPng(sigBytes);
    const sigDimsTx = sigImg.scale(1);
    const sigMaxHTx = 20;
    const sigWTx = (sigMaxHTx / sigDimsTx.height) * sigDimsTx.width;
    p1.drawImage(sigImg, { x: 438, y: PAGE_H - 136, width: sigWTx, height: sigMaxHTx, opacity: 1 });
  }
  t(p1, 160, 140, d.contractorJobCostCode)
  t(p1, 440, 141, d.namePrint)

  // ── DETAILS: IDs ───────────────────────────────────────────────────────────
  tc(p1,  33, 128, 195, d.transformerSiteId)
  tc(p1, 162, 128, 195, d.poleId)
  tc(p1, 296, 128, 195, d.zoneSubstation)
  tc(p1, 439, 126, 195, d.feederId)

  // ── INSTALLATION TYPE ──────────────────────────────────────────────────────
  ck(p1, 144, 222, d.installationType === 'New')
  ck(p1, 218, 222, d.installationType === 'Refurbished')
  ck(p1, 317, 222, d.installationType === 'Emergency / Stock')
  ck(p1, 446, 222, d.installationType === 'Removal Only')

  // ── OWNERSHIP ──────────────────────────────────────────────────────────────
  ck(p1, 144, 243, d.ownership === 'Powerco')
  ck(p1, 218, 243, d.ownership === 'Customer')
  ck(p1, 317, 243, d.ownership === 'Other')
  if (d.ownership === 'Other') t(p1, 360, 219, d.ownershipOther)

  // ── VOLTAGE ────────────────────────────────────────────────────────────────
  tc(p1, 150,  85, 311, i.voltageHV)
  tc(p1, 250,  85, 311, i.voltageLV)
  tc(p1, 360,  95, 311, r.voltageHV)
  tc(p1, 480,  70, 311, r.voltageLV)

  // ── CONNECTION TYPE – Issued HV ────────────────────────────────────────────
  ck(p1, 148, 327, i.connectionTypeHV === 'Bushing')
  ck(p1, 148, 344, i.connectionTypeHV === 'Cable Box')
  ck(p1, 148, 361, i.connectionTypeHV === 'Dead Break')
  ck(p1, 148, 378, i.connectionTypeHV === 'Pitch Box')

  // ── CONNECTION TYPE – Issued LV ────────────────────────────────────────────
  ck(p1, 247, 327, i.connectionTypeLV === 'Bushing')
  ck(p1, 247, 344, i.connectionTypeLV === 'Cable Box')
  ck(p1, 247, 361, i.connectionTypeLV === 'Dead Break')
  ck(p1, 247, 378, i.connectionTypeLV === 'Resin')

  // ── CONNECTION TYPE – Removed HV ───────────────────────────────────────────
  ck(p1, 361, 327, r.connectionTypeHV === 'Bushing')
  ck(p1, 361, 344, r.connectionTypeHV === 'Cable Box')
  ck(p1, 361, 361, r.connectionTypeHV === 'Dead Break')
  ck(p1, 361, 378, r.connectionTypeHV === 'Pitch Box')

  // ── CONNECTION TYPE – Removed LV ───────────────────────────────────────────
  ck(p1, 467, 327, r.connectionTypeLV === 'Bushing')
  ck(p1, 467, 344, r.connectionTypeLV === 'Cable Box')
  ck(p1, 466, 361, r.connectionTypeLV === 'Dead Break')
  ck(p1, 467, 378, r.connectionTypeLV === 'Resin')

  // ── CAPACITY ───────────────────────────────────────────────────────────────
  tc(p1, 155, 170, 400, i.capacityKVA)
  tc(p1, 330, 260, 400, r.capacityKVA)

  // ── PHASES ─────────────────────────────────────────────────────────────────
  circ(p1, 216, 428, 16, 7, i.phases === 'Three')
  circ(p1, 240, 428, 11, 7, i.phases === 'One')
  circ(p1, 265, 428, 14, 7, i.phases === 'SWER')
  circ(p1, 434, 428, 16, 7, r.phases === 'Three')
  circ(p1, 458, 428, 11, 7, r.phases === 'One')
  circ(p1, 483, 428, 14, 7, r.phases === 'SWER')

  // ── SERIAL NUMBER ──────────────────────────────────────────────────────────
  tc(p1, 155, 170, 445, i.serialNumber)
  tc(p1, 330, 260, 445, r.serialNumber)

  // ── ENCLOSURE TYPE ─────────────────────────────────────────────────────────
  ck(p1, 148, 464, i.enclosureType === 'Pole Mount')
  ck(p1, 247, 464, i.enclosureType === 'Plastic')
  ck(p1, 148, 481, i.enclosureType === 'Fibreglass')
  ck(p1, 247, 481, i.enclosureType === 'Building')
  ck(p1, 148, 498, i.enclosureType === 'Fenced')
  ck(p1, 247, 498, i.enclosureType === 'Metal Cover')
  ck(p1, 148, 515, i.enclosureType === 'Customer Premise')

  ck(p1, 361, 464, r.enclosureType === 'Pole Mount')
  ck(p1, 467, 464, r.enclosureType === 'Plastic')
  ck(p1, 361, 481, r.enclosureType === 'Fibreglass')
  ck(p1, 467, 481, r.enclosureType === 'Building')
  ck(p1, 361, 498, r.enclosureType === 'Fenced')
  ck(p1, 467, 498, r.enclosureType === 'Metal Cover')
  ck(p1, 361, 515, r.enclosureType === 'Customer Premise')

  // ── ENCLOSURE MODEL ────────────────────────────────────────────────────────
  tc(p1, 155, 170, 536, i.enclosureModel)
  tc(p1, 330, 260, 536, r.enclosureModel)

  // ── TRANSFORMER TYPE ───────────────────────────────────────────────────────
  circ(p1, 172, 565, 16, 8, i.transformerType === 'Bearer')
  circ(p1, 219, 565, 26, 8, i.transformerType === 'Grnd Mount')
  circ(p1, 265, 565, 17, 8, i.transformerType === 'Hanger')
  circ(p1, 305, 565, 20, 8, i.transformerType === 'Pedestal')
  circ(p1, 390, 565, 16, 8, r.transformerType === 'Bearer')
  circ(p1, 436, 565, 26, 8, r.transformerType === 'Grnd Mount')
  circ(p1, 483, 565, 17, 8, r.transformerType === 'Hanger')
  circ(p1, 523, 565, 20, 8, r.transformerType === 'Pedestal')

  // ── MAKE / MODEL ───────────────────────────────────────────────────────────
  tc(p1, 155, 170, 581, i.make)
  tc(p1, 330, 260, 581, r.make)
  tc(p1, 155, 170, 604, i.model)
  tc(p1, 330, 260, 604, r.model)

  // ── VOLT TEST ──────────────────────────────────────────────────────────────
  tc(p1, 155, 170, 628, i.voltTest)

  // ── REASON FOR REMOVAL ─────────────────────────────────────────────────────
  ck(p1, 361, 647, r.reasonForRemoval.includes('Relocation'))
  ck(p1, 467, 647, r.reasonForRemoval.includes('Vegetation'))
  ck(p1, 361, 664, r.reasonForRemoval.includes('Site Dismantled'))
  ck(p1, 467, 664, r.reasonForRemoval.includes('Reconstruction'))
  ck(p1, 361, 681, r.reasonForRemoval.includes('Vehicle Accident'))
  ck(p1, 467, 681, r.reasonForRemoval.includes('End of Life'))
  ck(p1, 361, 697, r.reasonForRemoval.includes('Capacity Change'))
  ck(p1, 467, 697, r.reasonForRemoval.includes('Faulty'))
  ck(p1, 361, 725, r.reasonForRemoval.includes('Adverse Weather'))
  ck(p1, 467, 725, r.reasonForRemoval.includes('Vandalism'))

  // ── TAP SETTING ────────────────────────────────────────────────────────────
  const TAP_CIRCS = [
    { val: '-10',  cx: 164, rx: 10 },
    { val: '-7.5', cx: 191, rx: 10 },
    { val: '-5',   cx: 217, rx: 10 },
    { val: '-2.5', cx: 242, rx: 10 },
    { val: '0',    cx: 266, rx: 10 },
    { val: '+2.5', cx: 292, rx: 11 },
    { val: '+5',   cx: 319, rx: 10 },
  ]
  TAP_CIRCS.forEach(({ val, cx, rx }) => circ(p1, cx, 654, rx, 6, i.tapSetting === val))

  // ── MDI FITTED ─────────────────────────────────────────────────────────────
  ck(p1, 148, 663, i.mdiFitted === 'YES')
  ck(p1, 247, 663, i.mdiFitted === 'NO')

  // ── CT RATIO ───────────────────────────────────────────────────────────────
  tc(p1, 155, 170, 682, i.ctRatio)

  // ── EARTH TEST ─────────────────────────────────────────────────────────────
  t(p1, 160, 699, i.earthTest1)
  t(p1, 221, 699, i.earthTest2)
  t(p1, 300, 699, i.totalMEN)

  // ── FUSE SIZE ──────────────────────────────────────────────────────────────
  t(p1, 175, 717, i.fuseSizeHV)
  t(p1, 275, 717, i.fuseSizeLV)

  // ── LV DISCONNECTOR ────────────────────────────────────────────────────────
  t(p1, 175, 737, i.lvDisconnectorMake)
  t(p1, 275, 737, i.lvDisconnectorModel)

  // ── REMOVED TO STORE ───────────────────────────────────────────────────────
  t(p1, 178, 755, d.removedToStore)

  // ── PAGE 2 – COMMENTS ──────────────────────────────────────────────────────
  const commentLines = (d.comments || '').split('\n')
  const COMMENT_Y = [90, 104, 118, 132, 146, 160, 174]
  commentLines.slice(0, 7).forEach((line, idx) => t(p2, 60, COMMENT_Y[idx], line))

  return new Uint8Array(await pdfDoc.save())
}

// ─── Main App ──────────────────────────────────────────────────────────────────
function TransformerWizardApp({ onClose }) {
  const [tab, setTab] = useState('wizard')
  const [step, setStep] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pdfBytes, setPdfBytes] = useState(null)
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [pdfError, setPdfError] = useState(null)
  const [calibrationPdfBytes, setCalibrationPdfBytes] = useState(null)
  const blobUrlRef = useRef(null)

  const ENC_OPTIONS = ['Pole Mount', 'Plastic', 'Fibreglass', 'Building', 'Fenced', 'Metal Cover', 'Customer Premise']
  const CONN_HV = ['Bushing', 'Cable Box', 'Dead Break', 'Pitch Box']
  const CONN_LV = ['Bushing', 'Cable Box', 'Dead Break', 'Resin']
  const PHASES  = ['Three', 'One', 'SWER']
  const TX_TYPE = ['Bearer', 'Grnd Mount', 'Hanger', 'Pedestal']

  const [d, setD] = useState({
    streetRoad: '', cityTown: '', district: '',
    pcoWONo: '', ciwrNo: '', contractorJobCostCode: '',
    contractor: '', dateWorkCompleted: '',
    signed: '', namePrint: '',
    transformerSiteId: '', poleId: '',
    zoneSubstation: '', feederId: '',
    installationType: '', ownership: '', ownershipOther: '',
    issued: {
      voltageHV: '', voltageLV: '',
      connectionTypeHV: '', connectionTypeLV: '',
      capacityKVA: '', phases: '', serialNumber: '',
      enclosureType: '', enclosureModel: '',
      transformerType: '', make: '', model: '',
      voltTest: '', tapSetting: '', mdiFitted: '', ctRatio: '',
      earthTest1: '', earthTest2: '', totalMEN: '',
      fuseSizeHV: '', fuseSizeLV: '',
      lvDisconnectorMake: '', lvDisconnectorModel: '',
    },
    removed: {
      voltageHV: '', voltageLV: '',
      connectionTypeHV: '', connectionTypeLV: '',
      capacityKVA: '', phases: '', serialNumber: '',
      enclosureType: '', enclosureModel: '',
      transformerType: '', make: '', model: '',
      reasonForRemoval: [],
    },
    removedToStore: '',
    comments: '',
  })

  const isPreview = step === T_STEPS.length - 1
  const scheme = schemeColors(STEP_SCHEME[step])
  const G = scheme.accent  // active accent colour for this step

  useEffect(() => {
    if (TX_SHOW_OVERLAY) {
      fetch(import.meta.env.BASE_URL + 'forms/360S014EG.pdf').then(r => r.arrayBuffer())
        .then(buf => setCalibrationPdfBytes(new Uint8Array(buf)))
        .catch(err => console.warn('Could not load calibration PDF:', err))
    }
  }, [])

  const triggerGenerate = () => {
    setPdfBytes(null); setPdfBlobUrl(null)
    setPdfGenerating(true); setPdfError(null)
    generatePdf(d).then(bytes => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      blobUrlRef.current = url
      setPdfBytes(bytes); setPdfBlobUrl(url); setPdfGenerating(false)
    }).catch(err => {
      console.error('PDF generation failed:', err)
      setPdfError('Could not generate PDF — check console for details.')
      setPdfGenerating(false)
    })
  }

  const set   = k => v => setD(p => ({ ...p, [k]: v }))


  const loadJobHistory = fields => {
    setD(prev => ({ ...prev, ...fields }))
  }


  // Auto-save job details when user advances past step 0
  const prevStepRef = React.useRef(0)
  React.useEffect(() => {
    if (prevStepRef.current === 0 && step === 1) saveToHistory(d)
    prevStepRef.current = step
  }, [step])
  const tog   = k => v => setD(p => ({ ...p, [k]: p[k] === v ? '' : v }))
  const setI  = k => v => setD(p => ({ ...p, issued:  { ...p.issued,  [k]: v } }))
  const togI  = k => v => setD(p => ({ ...p, issued:  { ...p.issued,  [k]: p.issued[k]  === v ? '' : v } }))
  const setR  = k => v => setD(p => ({ ...p, removed: { ...p.removed, [k]: v } }))
  const togR  = k => v => setD(p => ({ ...p, removed: { ...p.removed, [k]: p.removed[k] === v ? '' : v } }))
  const togRA = k => v => setD(p => {
    const a = p.removed[k] || []
    return { ...p, removed: { ...p.removed, [k]: a.includes(v) ? a.filter(x => x !== v) : [...a, v] } }
  })

  const handleShare = async () => {
    if (!pdfBlobUrl) return
    try {
      const blob = await fetch(pdfBlobUrl).then(r => r.blob())
      const file = new File([blob], 'AS-Built-Transformer-Record.pdf', { type: 'application/pdf' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // iOS Safari — native share sheet with file
        await navigator.share({ title: 'Powerco AS-Built Transformer Record', files: [file] })
      } else {
        // Android / desktop — open in new tab so browser PDF viewer
        // provides its own share/save controls
        window.open(pdfBlobUrl, '_blank')
      }
    } catch (err) { if (err.name !== 'AbortError') console.error('Share failed:', err) }
  }

  // Helper: step-coloured WF / WCB wrappers that auto-inherit accent
  const F  = (props) => <WF  {...props} accent={G} />
  const CB = (props) => <WCB {...props} accent={G} />
  const SH = (props) => <SectionHead {...props} accent={G} />

  // ─── Form steps ────────────────────────────────────────────────────────────
  const formSteps = [

    // 0 – Job Details
    <div key="0">
      <button onClick={() => setPickerOpen(true)} style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '10px 14px', marginBottom: 14, width: '100%',
        background: '#eef2ff', border: `2px solid ${APP_ACCENT}`,
        borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 13, fontWeight: 700, color: APP_ACCENT,
      }}>
        <span style={{ fontSize: 16 }}>📋</span> Load Previous Job
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <F label="PCo W/O No."  v={d.pcoWONo}  set={set('pcoWONo')} />
        <F label="CIWR No."     v={d.ciwrNo}   set={set('ciwrNo')} />
      </div>
      <F label="No./Street/Road" v={d.streetRoad} set={set('streetRoad')} ph="123 Example Road" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <F label="City/Town" v={d.cityTown} set={set('cityTown')} ph="Hamilton" />
        <F label="District"  v={d.district} set={set('district')} ph="Waikato" />
      </div>
      <F label="Contractor Job Cost Code" v={d.contractorJobCostCode} set={set('contractorJobCostCode')} />
      <div style={{ height: 1, background: '#eee', margin: '12px 0' }} />
      <F label="Contractor" v={d.contractor} set={set('contractor')} />
      <F label="Date Work Completed" v={d.dateWorkCompleted} set={set('dateWorkCompleted')} type="date" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <F label="Name (Print)" v={d.namePrint} set={set('namePrint')} />
      </div>
      <SignaturePad value={d.signed} onChange={set('signed')} accent={G} />
    </div>,

    // 1 – Site Details
    <div key="1">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <F label="Transformer Site ID" v={d.transformerSiteId} set={set('transformerSiteId')} />
        <F label="Pole ID"             v={d.poleId}            set={set('poleId')} />
        <F label="Zone Substation"     v={d.zoneSubstation}    set={set('zoneSubstation')} />
        <F label="Feeder ID"           v={d.feederId}          set={set('feederId')} />
      </div>
      <div style={{ height: 1, background: '#eee', margin: '12px 0' }} />
      <CB label="Installation Type"
        options={['New', 'Refurbished', 'Emergency / Stock', 'Removal Only']}
        value={d.installationType} onChange={tog('installationType')} />
      <CB label="Ownership"
        options={['Powerco', 'Customer', 'Other']}
        value={d.ownership} onChange={tog('ownership')} />
      {d.ownership === 'Other' && (
        <F label="Specify Ownership" v={d.ownershipOther} set={set('ownershipOther')} />
      )}
    </div>,

    // 2 – Issued: Voltage & Connection
    <div key="2">
      <SH label="Voltage" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <F label="HV" v={d.issued.voltageHV} set={setI('voltageHV')} ph="e.g. 11kV" />
        <F label="LV" v={d.issued.voltageLV} set={setI('voltageLV')} ph="e.g. 400V" />
      </div>
      <SH label="HV Connection Type" />
      <CB options={CONN_HV} value={d.issued.connectionTypeHV} onChange={togI('connectionTypeHV')} />
      <SH label="LV Connection Type" />
      <CB options={CONN_LV} value={d.issued.connectionTypeLV} onChange={togI('connectionTypeLV')} />
    </div>,

    // 3 – Issued: Capacity & Phases
    <div key="3">
      <SH label="Capacity (kVA)" />
      <F ph="kVA" v={d.issued.capacityKVA} set={setI('capacityKVA')} />
      <SH label="Phases" />
      <CB options={PHASES} value={d.issued.phases} onChange={togI('phases')} />
      <SH label="Serial Number" />
      <F v={d.issued.serialNumber} set={setI('serialNumber')} />
    </div>,

    // 4 – Issued: Enclosure & Type
    <div key="4">
      <SH label="Enclosure Type" />
      <CB options={ENC_OPTIONS} value={d.issued.enclosureType} onChange={togI('enclosureType')} />
      <SH label="Enclosure Model" />
      <F v={d.issued.enclosureModel} set={setI('enclosureModel')} />
      <SH label="Transformer Type" />
      <CB options={TX_TYPE} value={d.issued.transformerType} onChange={togI('transformerType')} />
    </div>,

    // 5 – Issued: Make, Model & Volt Test
    <div key="5">
      <SH label="Make" />
      <F v={d.issued.make} set={setI('make')} />
      <SH label="Model" />
      <F v={d.issued.model} set={setI('model')} />
      <SH label="Volt Test" />
      <F v={d.issued.voltTest} set={setI('voltTest')} ph="e.g. PASS" />
    </div>,

    // 6 – Issued: Technical
    <div key="6">
      <SH label="Tap Setting %" />
      <CB options={['-10', '-7.5', '-5', '-2.5', '0', '+2.5', '+5']}
        value={d.issued.tapSetting} onChange={togI('tapSetting')} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <SH label="MDI Fitted" />
          <CB options={['YES', 'NO']} value={d.issued.mdiFitted} onChange={togI('mdiFitted')} />
        </div>
        <F label="CT Ratio" v={d.issued.ctRatio} set={setI('ctRatio')} />
      </div>
      <SH label="Earth Test" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <F label="Test 1"    v={d.issued.earthTest1} set={setI('earthTest1')} />
        <F label="Test 2"    v={d.issued.earthTest2} set={setI('earthTest2')} />
        <F label="Total MEN" v={d.issued.totalMEN}   set={setI('totalMEN')} />
      </div>
      <SH label="Fuse Size" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <F label="HV" v={d.issued.fuseSizeHV} set={setI('fuseSizeHV')} />
        <F label="LV" v={d.issued.fuseSizeLV} set={setI('fuseSizeLV')} />
      </div>
      <SH label="LV Disconnector" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <F label="Make"  v={d.issued.lvDisconnectorMake}  set={setI('lvDisconnectorMake')} />
        <F label="Model" v={d.issued.lvDisconnectorModel} set={setI('lvDisconnectorModel')} />
      </div>
    </div>,

    // 7 – Removed: Voltage & Connection
    <div key="7">
      <SH label="Voltage" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <F label="HV" v={d.removed.voltageHV} set={setR('voltageHV')} ph="e.g. 11kV" />
        <F label="LV" v={d.removed.voltageLV} set={setR('voltageLV')} ph="e.g. 400V" />
      </div>
      <SH label="HV Connection Type" />
      <CB options={CONN_HV} value={d.removed.connectionTypeHV} onChange={togR('connectionTypeHV')} />
      <SH label="LV Connection Type" />
      <CB options={CONN_LV} value={d.removed.connectionTypeLV} onChange={togR('connectionTypeLV')} />
    </div>,

    // 8 – Removed: Capacity & Phases
    <div key="8">
      <SH label="Capacity (kVA)" />
      <F ph="kVA" v={d.removed.capacityKVA} set={setR('capacityKVA')} />
      <SH label="Phases" />
      <CB options={PHASES} value={d.removed.phases} onChange={togR('phases')} />
      <SH label="Serial Number" />
      <F v={d.removed.serialNumber} set={setR('serialNumber')} />
    </div>,

    // 9 – Removed: Enclosure & Type
    <div key="9">
      <SH label="Enclosure Type" />
      <CB options={ENC_OPTIONS} value={d.removed.enclosureType} onChange={togR('enclosureType')} />
      <SH label="Enclosure Model" />
      <F v={d.removed.enclosureModel} set={setR('enclosureModel')} />
      <SH label="Transformer Type" />
      <CB options={TX_TYPE} value={d.removed.transformerType} onChange={togR('transformerType')} />
    </div>,

    // 10 – Removed: Make & Model
    <div key="10">
      <SH label="Make" />
      <F v={d.removed.make} set={setR('make')} />
      <SH label="Model" />
      <F v={d.removed.model} set={setR('model')} />
    </div>,

    // 11 – Removal Details
    <div key="11">
      <SH label="Reason for Removal" />
      <CB multi
        options={['Relocation', 'Vegetation', 'Site Dismantled', 'Reconstruction',
                  'Vehicle Accident', 'End of Life', 'Capacity Change', 'Faulty',
                  'Adverse Weather', 'Vandalism']}
        value={d.removed.reasonForRemoval} onChange={togRA('reasonForRemoval')} />
      <SH label="Removed to Store" />
      <F ph="Stipulate location" v={d.removedToStore} set={set('removedToStore')} />
    </div>,

    // 12 – Comments & Preview
    <div key="12">
      <WTA label="Comments" v={d.comments} set={set('comments')} rows={6}
        ph="Add any additional comments here..." accent={G} />
      <div style={{ background: '#f0ebff', border: `1px solid ${W_PURPLE}`, borderRadius: 10, padding: '12px 14px', marginTop: 6 }}>
        <p style={{ margin: 0, fontSize: 13, color: W_PURPLE, fontWeight: 600 }}>
          ✓ All sections complete — click <strong>Preview Form →</strong> to generate your filled PDF.
        </p>
      </div>
    </div>,
  ]

  // ─── Render ───────────────────────────────────────────────────────────────────
  const progressPct = (step + 1) / T_STEPS.length * 100
  const progressColor = STEP_SCHEME[step] === 'issued' ? W_GREEN : STEP_SCHEME[step] === 'removed' ? W_RED : W_YELLOW

  // ── Computed values for shell ──────────────────────────────────────────
  const missingFields = [
    !d.pcoWONo    && 'PCo W/O No.',
    !d.streetRoad && 'Street/Road',
    !d.contractor && 'Contractor',
    !d.namePrint  && 'Name (Print)',
  ].filter(Boolean)

  const previewContent = (
    <>
      {pdfGenerating && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Generating PDF…</div>
        </div>
      )}
      {pdfError && !pdfGenerating && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div style={{ fontSize: 14, color: '#f87171', marginBottom: 12 }}>{pdfError}</div>
          <button onClick={() => triggerGenerate()} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: W_PURPLE, color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
        </div>
      )}
      {!pdfGenerating && !pdfError && pdfBytes && <PdfCanvasPreview pdfBytes={pdfBytes} />}
    </>
  )

  return (
    <>
      {/* Dev overlay tab bar — visible only when TX_SHOW_OVERLAY = true */}
      {TX_SHOW_OVERLAY && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300, display: 'flex', background: '#1e1b4b', padding: '6px 12px', gap: 8 }}>
          {['wizard', 'calibrate'].map(t2 => (
            <button key={t2} onClick={() => setTab(t2)} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: tab === t2 ? W_YELLOW : 'rgba(255,255,255,0.1)', color: tab === t2 ? '#1e1b4b' : '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>{t2}</button>
          ))}
          <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 12, alignSelf: 'center' }}>DEV BUILD</span>
        </div>
      )}

      {TX_SHOW_OVERLAY && tab === 'calibrate' && (
        <div style={{ paddingTop: 44, overflowX: 'auto', background: '#111' }}>
          {calibrationPdfBytes
            ? <CoordOverlay pdfBytes={calibrationPdfBytes} />
            : <div style={{ padding: 32, color: '#ef4444', fontSize: 14 }}>⚠ Could not load forms/360S014EG.pdf</div>}
        </div>
      )}

      {tab === 'wizard' && (
        <WizardShell
          title="AS-Built Transformer Record"
          formNumber="360S014EG"
          headerIcon={<FileText size={22} color="#fff" style={{ flexShrink: 0 }} />}
          headerBadge={scheme.label || null}
          steps={T_STEPS}
          step={step}
          onStepClick={setStep}
          onClose={onClose}
          onBack={() => setStep(s => s - 1)}
          onNext={() => { const next = step + 1; setStep(next); if (next === T_STEPS.length - 1) triggerGenerate() }}
          accent={scheme.accent}
          bg={scheme.bg}
          mid={scheme.mid}
          border={scheme.border}
          progressColor={progressColor}
          getDotColor={i => { const s = STEP_SCHEME[i]; return s === 'issued' ? W_GREEN : s === 'removed' ? W_RED : W_PURPLE }}
          devPaddingTop={TX_SHOW_OVERLAY ? 44 : 0}
          isPreview={isPreview}
          onShare={handleShare}
          onClosePreview={() => { setStep(s => s - 1); setPdfBytes(null); setPdfBlobUrl(null) }}
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
        accent={G}
      />
    </>
  )
}

export default TransformerWizardApp
