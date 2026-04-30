// 360S014EF — AS-Built Zone Substation Equipment Record
import { useState, useRef, useEffect } from 'react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { Building2 } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { WF, WTA, WCB, SectionHead } from '../shared/WizardInputs'
import { PhotoAttachStep } from '../shared/PhotoAttachStep'
import { appendPhotosToPdf } from '../shared/appendPhotosToPdf'
import { sharePdf } from '../shared/sharePdf'
import { getUserPrefs } from '../shared/userPrefs'
import { JobDetailsStep } from '../shared/JobDetailsStep'
import { usePdfGenerate } from '../shared/usePdfGenerate'
import { useWizardSetup } from '../shared/useWizardSetup'
import { useDraft } from '../shared/useDraft'
import { APP_ACCENT } from '../shared/constants'

const EF_SHOW_OVERLAY = false

const ACCENT    = APP_ACCENT
const EF_BG     = '#eef2ff'
const EF_MID    = '#e0e7ff'
const EF_BORDER = '#c7d2fe'

const EF_STEPS = [
  'Job Details',
  'Maintenance / Modification',
  'New / Replacement',
  'Additional Equipment',
  'Photos',
  'Preview & Print',
]

async function generateEfPdf(d, photos = []) {
  const PAGE_H = 842
  const BLUE   = rgb(0/255, 20/255, 160/255)
  const FONT_SIZE = 8

  const existingPdfBytes = await fetch(
    import.meta.env.BASE_URL + 'forms/360S014EF.pdf'
  ).then(r => r.arrayBuffer())

  const pdfDoc = await PDFDocument.load(existingPdfBytes)
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages  = pdfDoc.getPages()
  const p1     = pages[0]
  const p2     = pages[1]

  const t = (page, x, y, val, size = FONT_SIZE) => {
    const str = String(val || '')
    if (!str) return
    page.drawText(str, { x, y: PAGE_H - y, size, font, color: BLUE })
  }

  const tWrap = (page, x, y, val, maxWidth, size = FONT_SIZE, maxLines = 5) => {
    if (!val) return
    const words = String(val).split(' ')
    const lines = []
    let current = ''
    for (const word of words) {
      const test = current ? current + ' ' + word : word
      const w = font.widthOfTextAtSize(test, size)
      if (w > maxWidth && current) { lines.push(current); current = word }
      else current = test
    }
    if (current) lines.push(current)
    lines.slice(0, maxLines).forEach((line, i) => {
      t(page, x, y + i * 12, line, size)
    })
  }

  t(p1,  50,  95, d.substation)
  t(p1,  50, 113, d.streetRoad)
  t(p1, 310, 113, d.contractor)
  t(p1,  50, 128, d.cityTown)
  t(p1, 200, 128, d.district)
  t(p1, 310, 128, d.dateWorkCompleted)
  t(p1,  50, 143, d.pcoWONo)
  t(p1, 185, 143, d.ciwrNo)
  t(p1,  90, 158, d.contractorJobCostCode)
  t(p1, 310, 158, d.namePrint)

  if (d.signed && d.signed.startsWith('data:image')) {
    try {
      const sigMime = d.signed.split(',')[0].includes('jpeg') ? 'jpeg' : 'png'
      const sigBytes = Uint8Array.from(atob(d.signed.split(',')[1]), c => c.charCodeAt(0))
      const sigImg   = sigMime === 'jpeg' ? await pdfDoc.embedJpg(sigBytes) : await pdfDoc.embedPng(sigBytes)
      const { width: sw, height: sh } = sigImg.scale(1)
      const maxW = 120, maxH = 22
      const scale = Math.min(maxW / sw, maxH / sh)
      p1.drawImage(sigImg, {
        x: 310, y: PAGE_H - 152,
        width: sw * scale, height: sh * scale,
      })
    } catch (_) {}
  }

  if (d.maintenanceApplies) {
    t(p1,  90, 218, d.maintenanceEquipmentId)
    t(p1, 235, 218, d.maintenanceParentEquipmentId)
    t(p1, 415, 218, d.maintenanceEquipmentDescription)
    tWrap(p1, 50, 257, d.maintenanceDescription, 495, FONT_SIZE, 5)
  }

  if (d.replacementApplies) {
    t(p1,  90, 348, d.newEquipmentId)
    t(p1, 235, 348, d.oldEquipmentId)
    t(p1, 415, 348, d.drawingReferenceNo)
    t(p1,  90, 373, d.manufacturer)
    t(p1, 235, 373, d.model)
    t(p1, 415, 373, d.serialNo)
    tWrap(p1, 50, 410, d.replacementDescription, 495, FONT_SIZE, 5)
  }

  const rows = (d.additionalItems || []).filter(r =>
    r.installedOrRemoved || r.equipmentId || r.serialNo ||
    r.manufacturerModel  || r.description || r.drawingRef
  )

  const ROW_START = 500
  const ROW_H     = 24

  rows.slice(0, 11).forEach((row, i) => {
    const y = ROW_START + i * ROW_H
    t(p2,  45, y, row.installedOrRemoved)
    t(p2, 130, y, row.equipmentId)
    t(p2, 200, y, row.serialNo)
    t(p2, 233, y, row.manufacturerModel)
    t(p2, 368, y, row.description)
    t(p2, 503, y, row.drawingRef)
  })

  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return await pdfDoc.save()
}

const emptyRow = () => ({
  installedOrRemoved: '',
  equipmentId: '',
  serialNo: '',
  manufacturerModel: '',
  description: '',
  drawingRef: '',
})

function ZoneSubWizard({ onClose }) {
  const [step, setStep]               = useState(0)
  const [photos, setPhotos]           = useState([])
  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } = usePdfGenerate(generateEfPdf)

  const { contractor: _contractor, namePrint: _namePrint, signed: _signed, dateWorkCompleted: _date } = getUserPrefs()

  const [d, setD] = useState({
    substation: '',
    npJobNumber: '',
    projectName: '',
    pcoWONo: '',
    ciwrNo: '',
    streetRoad: '',
    cityTown: '',
    district: '',
    contractor: _contractor,
    contractorJobCostCode: '',
    dateWorkCompleted: _date,
    namePrint: _namePrint,
    signed: _signed,
    maintenanceApplies: false,
    maintenanceEquipmentId: '',
    maintenanceParentEquipmentId: '',
    maintenanceEquipmentDescription: '',
    maintenanceDescription: '',
    replacementApplies: false,
    newEquipmentId: '',
    oldEquipmentId: '',
    drawingReferenceNo: '',
    manufacturer: '',
    model: '',
    serialNo: '',
    replacementDescription: '',
    additionalItems: [emptyRow()],
  })

  const isPreview = step === EF_STEPS.length - 1

  const setRow = (i, field, val) => setD(p => {
    const items = [...p.additionalItems]
    items[i] = { ...items[i], [field]: val }
    return { ...p, additionalItems: items }
  })



  const handleShare = () => {
    const sanitise = s => (s || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim()
    const parts = [sanitise(d.projectName), sanitise(d.npJobNumber), sanitise(d.substation), 'Zone Sub Equipment Record'].filter(Boolean)
    const filename = parts.join(' - ') + '.pdf'
    sharePdf(pdfBytes, filename, pdfBlobUrl, clearFormDraft)
  }



  const missingFields = [
    !d.pcoWONo    && 'PCo W/O No.',
    !d.streetRoad && 'No./Street/Road',
    !d.contractor && 'Contractor',
    !d.namePrint  && 'Name (Print)',
    !d.maintenanceApplies && !d.replacementApplies && 'Select at least one work type',
  ].filter(Boolean)

  const { loadJobHistory, set } = useWizardSetup(d, setD, step, '360S014EF')
    const { clearDraft: clearFormDraft } = useDraft('360S014EF', d, step, photos)

  const AppliesToggle = ({ applies, label, onToggle }) => (
    <button type="button" onClick={onToggle} style={{
      width: '100%', padding: '12px 16px', borderRadius: 8, marginBottom: 16,
      border: `2px solid ${applies ? ACCENT : '#ddd'}`,
      background: applies ? ACCENT : '#fff',
      color: applies ? '#fff' : '#555',
      fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
      textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 18 }}>{applies ? '✓' : '○'}</span>
      {label}
    </button>
  )

  const formSteps = [

    // 0 — Job Details
    <JobDetailsStep key="s0" d={d} setD={setD} accent={ACCENT} formKey="360S014EF" formLabel="Zone Sub Equipment Record" step={step} photos={photos} setPhotos={setPhotos}
      topChildren={<>
        <WF label="Substation" v={d.substation} set={v => set('substation', v)} accent={ACCENT} />
        <WF label="Contractor Job Cost Code" v={d.contractorJobCostCode} set={v => set('contractorJobCostCode', v)} accent={ACCENT} />
      </>}
    />,

    // 1 — Maintenance / Modification
    <div key="s1">
      <AppliesToggle
        applies={d.maintenanceApplies}
        label="Maintenance / Modification applies to this job"
        onToggle={() => set('maintenanceApplies', !d.maintenanceApplies)}
      />
      {d.maintenanceApplies ? (
        <>
          <SectionHead label="Equipment" accent={ACCENT} />
          <WF label="Equipment ID"                v={d.maintenanceEquipmentId}          set={v => set('maintenanceEquipmentId', v)}          accent={ACCENT} />
          <WF label="Equipment ID of Parent Equipment" v={d.maintenanceParentEquipmentId} set={v => set('maintenanceParentEquipmentId', v)} accent={ACCENT} />
          <WF label="Description of Equipment"   v={d.maintenanceEquipmentDescription}  set={v => set('maintenanceEquipmentDescription', v)} accent={ACCENT} />
          <WTA label="Description of maintenance, modification, setting change or alteration"
            v={d.maintenanceDescription} set={v => set('maintenanceDescription', v)} rows={6} accent={ACCENT} />
        </>
      ) : (
        <div style={{ background: '#f4f4f8', border: '1px solid #ddd', borderRadius: 10, padding: '20px 18px', textAlign: 'center', color: '#666', fontSize: 14 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔧</div>
          <strong>Not applicable</strong>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#888' }}>Toggle the button above if this section applies.</p>
        </div>
      )}
    </div>,

    // 2 — New / Replacement
    <div key="s2">
      <AppliesToggle
        applies={d.replacementApplies}
        label="New / Replacement applies to this job"
        onToggle={() => set('replacementApplies', !d.replacementApplies)}
      />
      {d.replacementApplies ? (
        <>
          <SectionHead label="Equipment IDs" accent={ACCENT} />
          <WF label="New Equipment ID"             v={d.newEquipmentId}    set={v => set('newEquipmentId', v)}    accent={ACCENT} />
          <WF label="Old Equipment ID"             v={d.oldEquipmentId}    set={v => set('oldEquipmentId', v)}    accent={ACCENT} />
          <WF label="As-Built Drawing Reference No" v={d.drawingReferenceNo} set={v => set('drawingReferenceNo', v)} accent={ACCENT} />
          <SectionHead label="Make / Model" accent={ACCENT} />
          <WF label="Manufacturer" v={d.manufacturer} set={v => set('manufacturer', v)} accent={ACCENT} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <WF label="Model"     v={d.model}    set={v => set('model', v)}    accent={ACCENT} />
            <WF label="Serial No" v={d.serialNo} set={v => set('serialNo', v)} accent={ACCENT} />
          </div>
          <WTA label="Description of new item and/or reason for replacement"
            v={d.replacementDescription} set={v => set('replacementDescription', v)} rows={6} accent={ACCENT} />
        </>
      ) : (
        <div style={{ background: '#f4f4f8', border: '1px solid #ddd', borderRadius: 10, padding: '20px 18px', textAlign: 'center', color: '#666', fontSize: 14 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔄</div>
          <strong>Not applicable</strong>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#888' }}>Toggle the button above if this section applies.</p>
        </div>
      )}
    </div>,

    // 3 — Additional Equipment
    <div key="s3">
      <SectionHead label="Additional Equipment Items" sub="Use this section when more than one item was installed or removed" accent={ACCENT} />
      <div style={{ background: EF_BG, border: `1px solid ${EF_BORDER}`, borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: ACCENT }}>
        Leave this section empty if all details fit on page 1.
      </div>
      {d.additionalItems.map((row, i) => {
        const hasData = row.installedOrRemoved || row.equipmentId || row.serialNo || row.manufacturerModel || row.description || row.drawingRef
        const firstEmptyIdx = d.additionalItems.findIndex(r => !r.installedOrRemoved && !r.equipmentId && !r.serialNo && !r.manufacturerModel && !r.description && !r.drawingRef)
        const isFirstEmpty = i === firstEmptyIdx
        const isLastRow = i === d.additionalItems.length - 1
        return (hasData || isFirstEmpty) ? (
          <div key={i} style={{ background: '#f8f8ff', border: '1.5px solid #ddd', borderRadius: 10, padding: 11, marginBottom: 10, position: 'relative' }}>
            <button onClick={() => setD(p => ({ ...p, additionalItems: p.additionalItems.filter((_, idx) => idx !== i) }))}
              style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', fontSize: 18, color: '#999', cursor: 'pointer', padding: 0 }}>×</button>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: ACCENT }}>Item {i + 1}</div>
            <WCB label="Installed or Removed" options={['Installed', 'Removed']} value={row.installedOrRemoved}
              onChange={v => setRow(i, 'installedOrRemoved', row.installedOrRemoved === v ? '' : v)} accent={ACCENT} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <WF label="Equipment ID"        v={row.equipmentId}       set={v => setRow(i, 'equipmentId', v)}       accent={ACCENT} />
              <WF label="Serial No"           v={row.serialNo}          set={v => setRow(i, 'serialNo', v)}          accent={ACCENT} />
              <WF label="Manufacturer/Model"  v={row.manufacturerModel} set={v => setRow(i, 'manufacturerModel', v)} accent={ACCENT} />
              <WF label="Drawing Ref No"      v={row.drawingRef}        set={v => setRow(i, 'drawingRef', v)}        accent={ACCENT} />
            </div>
            <WF label="Description of New Item" v={row.description} set={v => setRow(i, 'description', v)} accent={ACCENT} />
            {isLastRow && d.additionalItems.length < 11 && (
              <button onClick={() => setD(p => ({ ...p, additionalItems: [...p.additionalItems, emptyRow()] }))}
                style={{ marginTop: 10, padding: '10px 16px', borderRadius: 8, border: 'none', background: ACCENT, color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                + Add Another Item
              </button>
            )}
          </div>
        ) : null
      })}
    </div>,

    // 4 — Photos
    <div key="s4">
      <PhotoAttachStep photos={photos} onChange={setPhotos} accent={ACCENT} />
    </div>,

    // 5 — Preview & Print
    <div key="s5" />,
  ]

  const previewContent = buildPreviewContent(() => triggerGenerate(d, photos), ACCENT)

  return (
    <>
      <WizardShell
        title="Zone Substation Equipment Record"
        formNumber="360S014EF"
        headerIcon={<Building2 size={22} color="#fff" style={{ flexShrink: 0 }} />}
        steps={EF_STEPS}
        step={step}
        onStepClick={setStep}
        onClose={onClose}
        onBack={() => setStep(s => s - 1)}
        onNext={() => {
          const next = step + 1
          setStep(next)
          if (next === EF_STEPS.length - 1) triggerGenerate(d, photos)
        }}
        accent={ACCENT}
        bg="#f4f4f8"
        mid={EF_MID}
        border={EF_BORDER}
        isPreview={isPreview}
        onShare={handleShare}
        onClosePreview={() => { setStep(s => s - 1); clearPdf() }}
        missingFields={missingFields}
        previewContent={previewContent}
      >
        {formSteps[step]}
      </WizardShell>
    </>
  )
}

export default ZoneSubWizard
