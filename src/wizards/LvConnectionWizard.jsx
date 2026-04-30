import { useState, useRef, useEffect } from 'react'
import { APP_ACCENT } from '../shared/constants'
import { PDFDocument, rgb } from 'pdf-lib'
import { Zap } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { WF, WTA, WCB, SectionHead } from '../shared/WizardInputs'
import { PhotoAttachStep } from '../shared/PhotoAttachStep'
import { appendPhotosToPdf } from '../shared/appendPhotosToPdf'
import { sharePdf } from '../shared/sharePdf'
import { getUserPrefs } from '../shared/userPrefs'
import { JobDetailsStep } from '../shared/JobDetailsStep'
import { usePdfGenerate } from '../shared/usePdfGenerate'
import { CoordOverlay } from '../shared/CoordOverlay'
import { useWizardSetup } from '../shared/useWizardSetup'
import { useDraft } from '../shared/useDraft'

const LV_SHOW_OVERLAY = false

const LV_TEAL   = APP_ACCENT
const LV_BG     = '#eef2ff'
const LV_MID    = '#e0e7ff'
const LV_BORDER = '#c7d2fe'

const LV_STEPS = [
  'Job Details',
  'Connection Point',
  'Conductor Details',
  'Work Description',
  'Photos',
  'Preview & Print',
]

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

async function generateLvPdf(d, photos = []) {
  const bytes = await fetch(
    import.meta.env.BASE_URL + 'forms/360S014EA.pdf'
  ).then(r => r.arrayBuffer())

  const pdfDoc = await PDFDocument.load(bytes)
  const pages  = pdfDoc.getPages()
  const p1     = pages[0]

  const font   = await pdfDoc.embedFont('Helvetica')
  const PAGE_H = 842
  const BLUE   = rgb(0/255, 20/255, 160/255)

  const t = (page, x, cssY, str, size = 8.5) => {
    if (!str) return
    page.drawText(String(str), {
      x, y: PAGE_H - cssY - size, size, font, color: BLUE,
    })
  }

  const ck = (page, x, cssY, show) => {
    if (!show) return
    const by = PAGE_H - cssY - 2
    page.drawLine({ start: { x,        y: by - 6 }, end: { x: x + 3, y: by - 9 }, thickness: 1.5, color: BLUE })
    page.drawLine({ start: { x: x + 3, y: by - 9 }, end: { x: x + 9, y: by - 1 }, thickness: 1.5, color: BLUE })
  }

  const tWrap = (page, x, cssY, str, maxPts, lineH = 11, maxLines = 3, size = 8.5) => {
    if (!str) return
    const lines = wrapText(str, font, size, maxPts).slice(0, maxLines)
    lines.forEach((line, i) => t(page, x, cssY + i * lineH, line, size))
  }

  tWrap(p1,  55, 128, d.streetRoad, 310, 14, 2)
  t(p1, 420, 114,  d.contractor)
  t(p1, 420, 128,  d.dateWorkCompleted)
  t(p1, 100, 174,  d.cityTown)
  t(p1, 480, 174,  d.ciwrNo)
  t(p1, 100, 188,  d.district)
  t(p1, 480, 188,  d.pcoWONo)
  t(p1, 200, 202,  d.cowShedNumber)
  t(p1, 420, 202,  d.cocNumber)
  t(p1, 115, 216,  d.icpNumber)

  if (d.signed) {
    try {
      const sigMime = d.signed.split(',')[0].includes('jpeg') ? 'jpeg' : 'png'
      const sigBytes = Uint8Array.from(
        atob(d.signed.split(',')[1]), c => c.charCodeAt(0)
      )
      const sigImg = sigMime === 'jpeg' ? await pdfDoc.embedJpg(sigBytes) : await pdfDoc.embedPng(sigBytes)
      p1.drawImage(sigImg, {
        x: 365, y: PAGE_H - 164, width: 120, height: 22, opacity: 1,
      })
    } catch (_) {}
  }

  ck(p1, 186, 255, d.installedService === 'Overhead line')
  ck(p1, 279, 255, d.installedService === 'Underground cable')

  ck(p1, 186, 271, d.connectedTo === 'Box')
  ck(p1, 279, 271, d.connectedTo === 'Pole')
  ck(p1, 408, 271, d.connectedTo === 'Other')
  if (d.connectedTo === 'Other') t(p1, 490, 273, d.connectedToOther)

  t(p1, 174, 289, d.poleServiceBoxNumber)

  t(p1, 122, 320, d.conductorSize)
  t(p1, 271, 320, d.conductorMaterial)
  t(p1, 442, 320, d.insulation)

  t(p1, 130, 336, d.numberOfCables)
  t(p1, 271, 336, d.numberOfCores)
  t(p1, 442, 336, d.fuseSize)

  t(p1, 130, 352, d.numberOfPhases)
  t(p1, 271, 352, d.phaseColours)

  ck(p1, 186, 366, d.cableDuct === 'No')
  ck(p1, 265, 366, d.cableDuct === 'New')
  if (d.cableDuct === 'New')      t(p1, 360, 368, d.cableDuctNewSize)
  ck(p1, 406, 366, d.cableDuct === 'Existing')
  if (d.cableDuct === 'Existing') t(p1, 510, 368, d.cableDuctExistingSize)

  tWrap(p1, 55, 748, d.workDescription, 485, 11, 4)

  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)
  return await pdfDoc.save()
}

export default function LvConnectionWizard({ onClose }) {
  const [step, setStep] = useState(0)

  const { contractor: _contractor, namePrint: _namePrint, signed: _signed, dateWorkCompleted: _date } = getUserPrefs()
  const [d, setD] = useState({
    npJobNumber:          '',
    projectName:          '',
    pcoWONo:              '',
    ciwrNo:               '',
    streetRoad:           '',
    cityTown:             '',
    district:             '',
    contractor:           _contractor,
    dateWorkCompleted:    _date,
    namePrint:            _namePrint,
    signed:               _signed,
    cocNumber:            '',
    cowShedNumber:        '',
    icpNumber:            '',
    installedService:     '',
    connectedTo:          '',
    connectedToOther:     '',
    poleServiceBoxNumber: '',
    conductorSize:        '',
    conductorMaterial:    '',
    insulation:           '',
    numberOfCables:       '',
    numberOfCores:        '',
    fuseSize:             '',
    numberOfPhases:       '',
    phaseColours:         '',
    cableDuct:            '',
    cableDuctNewSize:     '',
    cableDuctExistingSize:'',
    workDescription:      '',
  })

  const isPreview = step === LV_STEPS.length - 1
  const [overlayTab,    setOverlayTab]    = useState('form')
  const [overlayBytes,  setOverlayBytes]  = useState(null)
  const [photos,        setPhotos]        = useState([])
  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } = usePdfGenerate(generateLvPdf)



  useEffect(() => {
    if (LV_SHOW_OVERLAY && overlayTab === 'calibrate' && !overlayBytes) {
      fetch(import.meta.env.BASE_URL + 'forms/360S014EA.pdf')
        .then(r => r.arrayBuffer())
        .then(buf => setOverlayBytes(new Uint8Array(buf)))
        .catch(() => {})
    }
  }, [overlayTab, overlayBytes])

  const handleShare = () => {
    const sanitise = s => (s || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim()
    const parts = [sanitise(d.projectName), sanitise(d.npJobNumber), sanitise(d.icpNumber), 'LV Connection Record'].filter(Boolean)
    const filename = parts.join(' - ') + '.pdf'
    sharePdf(pdfBytes, filename, pdfBlobUrl, clearFormDraft)
  }



  const missingFields = [
    !d.pcoWONo          && 'Powerco W/O Number',
    !d.streetRoad       && 'Physical Address',
    !d.contractor       && 'Contractor',
    !d.installedService && 'Installed Service',
    !d.connectedTo      && 'Conductor Connected To',
    !d.signed           && 'Signature',
  ].filter(Boolean)

  const { loadJobHistory, set } = useWizardSetup(d, setD, step, '360S014EA')
    const { clearDraft: clearFormDraft } = useDraft('360S014EA', d, step, photos)

  const formSteps = [

    <JobDetailsStep key="s0" d={d} setD={setD} accent={LV_TEAL} formKey="360S014EA" formLabel="LV Connection Record" step={step} photos={photos} setPhotos={setPhotos}><div style={{ height: 1, background: '#eee', margin: '14px 0' }} />
      <SectionHead label="Connection Identifiers" accent={LV_TEAL} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <WF label="C.O.C Number"           v={d.cocNumber}     set={v => set('cocNumber',     v)} accent={LV_TEAL} />
        <WF label="Cow Shed / Dairy No."   v={d.cowShedNumber} set={v => set('cowShedNumber', v)} accent={LV_TEAL} />
        <WF label="ICP Number"             v={d.icpNumber}     set={v => set('icpNumber',     v)} accent={LV_TEAL} />
      </div></JobDetailsStep>,

    <div key="s1">
      <SectionHead label="Physical Connection Point" accent={LV_TEAL} />
      <WCB label="Installed Service" options={['Overhead line', 'Underground cable']} value={d.installedService} onChange={v => set('installedService', v)} accent={LV_TEAL} />
      <div style={{ marginTop: 14 }}>
        <WCB label="Conductor Connected To" options={['Box', 'Pole', 'Other']} value={d.connectedTo} onChange={v => set('connectedTo', v)} accent={LV_TEAL} />
      </div>
      {d.connectedTo === 'Other' && (
        <div style={{ marginTop: 10 }}>
          <WF label="Other — specify" v={d.connectedToOther} set={v => set('connectedToOther', v)} accent={LV_TEAL} />
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <WF label="Pole / Service Box Number" v={d.poleServiceBoxNumber} set={v => set('poleServiceBoxNumber', v)} accent={LV_TEAL} />
      </div>
    </div>,

    <div key="s2">
      <SectionHead label="Conductor Details" accent={LV_TEAL} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        <WF label="Conductor Size"     v={d.conductorSize}     set={v => set('conductorSize',     v)} accent={LV_TEAL} />
        <WF label="Conductor Material" v={d.conductorMaterial} set={v => set('conductorMaterial', v)} accent={LV_TEAL} />
        <WF label="Insulation"         v={d.insulation}        set={v => set('insulation',        v)} accent={LV_TEAL} />
        <WF label="Number of Cables"   type="number" v={d.numberOfCables} set={v => set('numberOfCables', v)} accent={LV_TEAL} />
        <WF label="Number of Cores"    type="number" v={d.numberOfCores}  set={v => set('numberOfCores',  v)} accent={LV_TEAL} />
        <WF label="Fuse Size (Amps)"   type="number" v={d.fuseSize}       set={v => set('fuseSize',       v)} accent={LV_TEAL} />
        <WF label="Number of Phases"   type="number" v={d.numberOfPhases} set={v => set('numberOfPhases', v)} accent={LV_TEAL} />
        <WF label="Phase Colour(s)"    v={d.phaseColours}      set={v => set('phaseColours',      v)} accent={LV_TEAL} />
      </div>
      <div style={{ marginTop: 14 }}>
        <WCB label="Cable Duct Used" options={['No', 'New', 'Existing']} value={d.cableDuct} onChange={v => set('cableDuct', v)} accent={LV_TEAL} />
      </div>
      {d.cableDuct === 'New' && (
        <div style={{ marginTop: 10 }}>
          <WF label="New Duct — specify size" v={d.cableDuctNewSize} set={v => set('cableDuctNewSize', v)} accent={LV_TEAL} />
        </div>
      )}
      {d.cableDuct === 'Existing' && (
        <div style={{ marginTop: 10 }}>
          <WF label="Existing Duct — specify size" v={d.cableDuctExistingSize} set={v => set('cableDuctExistingSize', v)} accent={LV_TEAL} />
        </div>
      )}
    </div>,

    <div key="s3">
      <SectionHead label="Work Plan & Description" accent={LV_TEAL} />
      <div style={{
        background: '#f0fdfa', border: `1px solid ${LV_BORDER}`, borderRadius: 8,
        padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#0f766e', lineHeight: 1.5,
      }}>
        <strong>📐 Location plan:</strong> The dimensioned conductor plan must be drawn manually on the printed form.
      </div>
      <WTA label="Describe the Work Performed" v={d.workDescription} set={v => set('workDescription', v)} accent={LV_TEAL} rows={6} />
    </div>,

    <div key="s4">
      <PhotoAttachStep photos={photos} onChange={setPhotos} accent={LV_TEAL} />
    </div>,

    <div key="s5" />,
  ]

  const previewContent = buildPreviewContent(() => triggerGenerate(d, photos), LV_TEAL)

  return (
    <>
      {LV_SHOW_OVERLAY && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 44, background: '#1e1e2e', display: 'flex', alignItems: 'center', zIndex: 9999, padding: '0 16px', gap: 8 }}>
          {['form', 'calibrate'].map(tab => (
            <button key={tab} onClick={() => setOverlayTab(tab)} style={{ padding: '4px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: overlayTab === tab ? LV_TEAL : 'transparent', color: overlayTab === tab ? '#fff' : '#888' }}>
              {tab === 'form' ? 'Form' : 'Calibrate'}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#555', letterSpacing: 1 }}>CALIBRATION MODE</span>
        </div>
      )}

      {LV_SHOW_OVERLAY && overlayTab === 'calibrate' ? (
        <div style={{ position: 'fixed', inset: 0, top: 44, background: '#111', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflow: 'auto' }}>
          {overlayBytes ? <CoordOverlay pdfBytes={overlayBytes} page={1} /> : <div style={{ color: '#888', marginTop: 40 }}>Loading PDF…</div>}
        </div>
      ) : (
        <WizardShell
          title="AS-Built LV Connection"
          formNumber="360S014EA"
          headerIcon={<Zap size={20} color="#fff" />}
          steps={LV_STEPS}
          step={step}
          onStepClick={i => { setStep(i); if (i === LV_STEPS.length - 1) triggerGenerate(d, photos) }}
          onClose={onClose}
          onBack={() => setStep(s => s - 1)}
          onNext={() => { const n = step + 1; setStep(n); if (n === LV_STEPS.length - 1) triggerGenerate(d, photos) }}
          accent={LV_TEAL}
          bg={LV_BG}
          mid={LV_MID}
          border={LV_BORDER}
          devPaddingTop={LV_SHOW_OVERLAY ? 44 : 0}
          isPreview={isPreview}
          onShare={handleShare}
          onClosePreview={() => { setStep(s => s - 1); clearPdf() }}
          missingFields={missingFields}
          previewContent={previewContent}
        >
          {formSteps[step]}
        </WizardShell>
      )}

    </>
  )
}
