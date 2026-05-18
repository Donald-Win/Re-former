// 360S014EE — AS-Built Electrical Equipment Record
import React, { useState, useEffect, useRef } from 'react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { FileText, X, Share2 } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { APP_ACCENT, APP_YELLOW } from '../shared/constants'
import { useWizardSetup } from '../shared/useWizardSetup'
import { useDraft } from '../shared/useDraft'
import { DraftPicker } from '../shared/DraftPicker'
import { wInp, wLbl, WF, WTA, WCB, SectionHead } from '../shared/WizardInputs'
import { PhotoAttachStep } from '../shared/PhotoAttachStep'
import { appendPhotosToPdf } from '../shared/appendPhotosToPdf'
import { sharePdf } from '../shared/sharePdf'
import { getUserPrefs } from '../shared/userPrefs'
import { JobDetailsStep } from '../shared/JobDetailsStep'
import { usePdfGenerate } from '../shared/usePdfGenerate'
import { CoordOverlay } from '../shared/CoordOverlay'

const W_PURPLE = APP_ACCENT
const W_YELLOW = APP_YELLOW

const EE_SHOW_OVERLAY = false

const EE_BG     = '#eef2ff'
const EE_MID    = '#e0e7ff'
const EE_BORDER = '#c7d2fe'

const EE_STEPS = [
  'Job Details',
  'Equipment Details',
  'Equipment Type',
  'Replacement Details',
  'Equipment Rating',
  'Additional Detail',
  'Multi-Item Details',
  'Photos',
  'Preview & Print',
]

const EQ_TYPE_OPTIONS = [
  'Flicker ABS', 'Fused ABS', 'Standard ABS',
  'Load Break Switch', 'Vacuum Load Break Switch', 'Earth Switch',
  'Ring Main Unit', 'Circuit Breaker', 'Recloser/Sectionaliser',
  'Voltage Regulator', 'Generator', 'Solid Link',
  'TX Fuse', 'Line Fuse', 'Knife Link',
  'Lightning Arrester', 'Other',
]

const emptyRatingRow = () => ({
  equipmentId: '', normalState: '', operatingVoltage: '', voltageRating: '', fuseSize: '',
})
const emptyMultiRow = () => ({
  ir: '', equipmentId: '', equipmentType: '', manufacturer: '',
  model: '', serialNumber: '', operatingVoltage: '', voltageRating: '', fuseSize: '',
})

const PAGE_H = 842
const BLUE   = rgb(0/255, 20/255, 160/255)

async function generateEEPdf(d, photos = []) {
  const bytes  = await fetch(import.meta.env.BASE_URL + 'forms/360S014EE.pdf').then(r => r.arrayBuffer())
  const pdfDoc = await PDFDocument.load(bytes)
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages  = pdfDoc.getPages()
  const p1     = pages[0]
  const p2     = pages.length > 1 ? pages[1] : null

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
    page.drawLine({ start: { x: x,     y: by - 6 }, end: { x: x + 3, y: by - 9 }, thickness: 1.5, color: BLUE, opacity: 1 })
    page.drawLine({ start: { x: x + 3, y: by - 9 }, end: { x: x + 9, y: by - 1 }, thickness: 1.5, color: BLUE, opacity: 1 })
  }

  t(p1, 115,  110, d.streetRoad)
  t(p1, 394,  110, d.contractor)
  t(p1, 394,  124, d.dateWorkCompleted)
  t(p1, 115,  139, d.cityTown)
  t(p1, 115,  154, d.district)
  t(p1, 394,  154, d.namePrint)
  t(p1, 170,  168, d.pcoWONo)
  t(p1, 490,  160, d.ciwrNo)

  if (d.signed && d.signed.startsWith('data:image')) {
    const sigMime = d.signed.split(',')[0].includes('jpeg') ? 'jpeg' : 'png'
    const sigBytes = Uint8Array.from(atob(d.signed.split(',')[1]), c => c.charCodeAt(0))
    const sigImg   = sigMime === 'jpeg' ? await pdfDoc.embedJpg(sigBytes) : await pdfDoc.embedPng(sigBytes)
    const sigDims  = sigImg.scale(1)
    const sigH     = 18
    const sigW     = (sigH / sigDims.height) * sigDims.width
    p1.drawImage(sigImg, { x: 388, y: PAGE_H - 151, width: sigW, height: sigH, opacity: 1 })
  }

  tc(p1,  33, 200, 232, d.newEquipmentId)
  tc(p1, 204, 200, 232, d.oldEquipmentId)
  tc(p1, 374, 200, 232, d.locationPoleSiteId)
  tc(p1,  33, 200, 276, d.manufacturer)
  tc(p1, 204, 200, 276, d.model)
  tc(p1, 374, 200, 276, d.serialNo)

  const EQ_CK = {
    'Flicker ABS':              { x:  45, y: 322 },
    'Fused ABS':                { x:  45, y: 336 },
    'Standard ABS':             { x:  45, y: 351 },
    'Load Break Switch':        { x:  45, y: 365 },
    'Vacuum Load Break Switch': { x:  45, y: 379 },
    'Earth Switch':             { x:  45, y: 394 },
    'Ring Main Unit':           { x: 220, y: 322 },
    'Circuit Breaker':          { x: 220, y: 336 },
    'Recloser/Sectionaliser':   { x: 220, y: 351 },
    'Voltage Regulator':        { x: 220, y: 365 },
    'Generator':                { x: 220, y: 379 },
    'Solid Link':               { x: 395, y: 322 },
    'TX Fuse':                  { x: 395, y: 336 },
    'Line Fuse':                { x: 395, y: 351 },
    'Knife Link':               { x: 395, y: 365 },
    'Lightning Arrester':       { x: 395, y: 379 },
    'Other':                    { x: 220, y: 394 },
  }
  if (EQ_CK[d.equipmentType]) {
    ck(p1, EQ_CK[d.equipmentType].x, EQ_CK[d.equipmentType].y, true)
  }
  if (d.equipmentType === 'Other' && d.equipmentTypeOther) {
    t(p1, 375, 396, d.equipmentTypeOther)
  }

  const TOC_X = { 'New': 155, 'Removed': 254, 'Replaced': 353 }
  if (TOC_X[d.typeOfChange]) ck(p1, TOC_X[d.typeOfChange], 435, true)
  const OWN_X = { 'Powerco': 155, 'Private': 254, 'Other': 353 }
  if (OWN_X[d.ownership]) ck(p1, OWN_X[d.ownership], 450, true)
  if (d.ownership === 'Other' && d.ownershipOther) t(p1, 435, 452, d.ownershipOther)
  if (d.reasonForRemoval) t(p1, 140, 467, d.reasonForRemoval)

  const RATING_Y = [556, 570, 585, 599, 613]
  ;(d.equipmentRating || []).forEach((row, i) => {
    if (!RATING_Y[i]) return
    const y = RATING_Y[i]
    t(p1,  45, y, row.equipmentId)
    ck(p1, 135, y, row.normalState === 'Open')
    ck(p1, 205, y, row.normalState === 'Closed')
    t(p1, 290, y, row.operatingVoltage)
    t(p1, 395, y, row.voltageRating)
    t(p1, 480, y, row.fuseSize)
  })

  ck(p1, 156, 655, d.remoteControlled === 'Yes')
  ck(p1, 254, 655, d.remoteControlled === 'No')
  ck(p1, 156, 669, d.remoteIndication === 'Yes')
  ck(p1, 254, 669, d.remoteIndication === 'No')

  const COMMENT_X     = 45
  const COMMENT_MAX_W = 510
  const COMMENT_SIZE  = 8.5
  const COMMENT_Y     = [710, 724, 738, 752]
  const commentWords  = (d.comments || '').split(' ')
  const commentLines  = []
  let   currentLine   = ''
  for (const word of commentWords) {
    const test = currentLine ? currentLine + ' ' + word : word
    if (font.widthOfTextAtSize(test, COMMENT_SIZE) <= COMMENT_MAX_W) {
      currentLine = test
    } else {
      if (currentLine) commentLines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) commentLines.push(currentLine)
  commentLines.slice(0, 4).forEach((line, i) => t(p1, COMMENT_X, COMMENT_Y[i], line))

  if (p2) {
    const { width: P2W, height: P2H } = p2.getSize()
    const t2 = (x, cssY, str, size = 8.5) => {
      if (!str) return
      p2.drawText(String(str), { x, y: P2H - cssY - size, size, font, color: BLUE })
    }
    const tc2 = (fieldLeft, fieldWidth, cssY, str, size = 8.5) => {
      if (!str) return
      const w = font.widthOfTextAtSize(String(str), size)
      const x = fieldLeft + (fieldWidth / 2) - (w / 2)
      p2.drawText(String(str), { x, y: P2H - cssY - size, size, font, color: BLUE })
    }
    const M_ROWS = (d.multiItems || []).filter(r => r.ir || r.equipmentId || r.equipmentType)
    const M_Y0   = 161
    const M_RH   = 22
    M_ROWS.forEach((row, i) => {
      const y = M_Y0 + i * M_RH
      tc2(  67,  20, y, row.ir)
      t2(  110,      y, row.equipmentId)
      t2(  180,      y, row.equipmentType)
      t2(  290,      y, row.manufacturer)
      t2(  395,      y, row.model)
      t2(  490,      y, row.serialNumber)
      t2(  612,      y, row.operatingVoltage)
      t2(  675,      y, row.voltageRating)
      t2(  740,      y, row.fuseSize)
    })
  }

  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)
  return new Uint8Array(await pdfDoc.save())
}

function ElecEquipWizard({ onClose = () => {} }) {
  const [tab, setTab]                   = useState('wizard')
  const [calPage, setCalPage]           = useState(1)
  const [step, setStep]                 = useState(0)
  const [draftPickerOpen, setDraftPickerOpen] = useState(false)
  const [draftPickerMode, setDraftPickerMode] = useState('menu')
  const [photos, setPhotos] = useState([])
  const [calibrationPdfBytes, setCalibrationPdfBytes] = useState(null)
  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } = usePdfGenerate(generateEEPdf)

  const { contractor: _contractor, namePrint: _namePrint, signed: _signed, dateWorkCompleted: _date } = getUserPrefs()
  const [d, setD] = useState({
    npJobNumber: '', projectName: '',
    pcoWONo: '', ciwrNo: '',
    streetRoad: '', cityTown: '', district: '',
    contractor: _contractor, dateWorkCompleted: _date,
    signed: _signed, namePrint: _namePrint,
    newEquipmentId: '', oldEquipmentId: '', locationPoleSiteId: '',
    manufacturer: '', model: '', serialNo: '',
    equipmentType: '', equipmentTypeOther: '',
    typeOfChange: '', ownership: '', ownershipOther: '',
    reasonForRemoval: '',
    equipmentRating: [emptyRatingRow()],
    remoteControlled: '', remoteIndication: '',
    comments: '',
    multiItems: [emptyMultiRow()],
  })

  const isPreview = step === EE_STEPS.length - 1

  useEffect(() => {
    if (!EE_SHOW_OVERLAY) return
    fetch(import.meta.env.BASE_URL + 'forms/360S014EE.pdf')
      .then(r => r.arrayBuffer())
      .then(buf => setCalibrationPdfBytes(new Uint8Array(buf)))
      .catch(err => console.warn('Could not load calibration PDF:', err))
  }, [])



  const tog = k => v => setD(p => ({ ...p, [k]: p[k] === v ? '' : v }))

  const setRating    = (i, field) => v => setD(p => ({
    ...p, equipmentRating: p.equipmentRating.map((r, idx) => idx === i ? { ...r, [field]: v } : r),
  }))
  const togRating    = (i, field) => v => setD(p => ({
    ...p, equipmentRating: p.equipmentRating.map((r, idx) => idx === i ? { ...r, [field]: r[field] === v ? '' : v } : r),
  }))
  const addRatingRow    = () => setD(p => p.equipmentRating.length < 5 ? { ...p, equipmentRating: [...p.equipmentRating, emptyRatingRow()] } : p)
  const removeRatingRow = i  => setD(p => p.equipmentRating.length > 1 ? { ...p, equipmentRating: p.equipmentRating.filter((_, idx) => idx !== i) } : p)

  const setMulti    = (i, field) => v => setD(p => ({
    ...p, multiItems: p.multiItems.map((r, idx) => idx === i ? { ...r, [field]: v } : r),
  }))
  const togMulti    = (i, field) => v => setD(p => ({
    ...p, multiItems: p.multiItems.map((r, idx) => idx === i ? { ...r, [field]: r[field] === v ? '' : v } : r),
  }))
  const addMultiRow    = () => setD(p => p.multiItems.length < 15 ? { ...p, multiItems: [...p.multiItems, emptyMultiRow()] } : p)
  const removeMultiRow = i  => setD(p => p.multiItems.length > 1  ? { ...p, multiItems: p.multiItems.filter((_, idx) => idx !== i) } : p)

  const handleShare = () => {
    const sanitise = s => (s || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim()
    const parts = [sanitise(d.projectName), sanitise(d.npJobNumber), sanitise(d.newEquipmentId), 'Elec Equipment Record'].filter(Boolean)
    const filename = parts.join(' - ') + '.pdf'
    sharePdf(pdfBytes, filename, pdfBlobUrl, clearFormDraft)
  }


  const { loadJobHistory, set } = useWizardSetup(d, setD, step, '360S014EE')
    const { clearDraft: clearFormDraft } = useDraft('360S014EE', d, step, photos)

  const handleDraftLoad = (draft) => {
    const { photos: draftPhotos, ...formData } = draft.data || {}
    setD(prev => ({ ...prev, ...formData }))
    if (Array.isArray(draft.photos) && draft.photos.length > 0) setPhotos(draft.photos)
    setStep(draft.step || 0)
  }

  const formSteps = [

    // 0 — Job Details
    <JobDetailsStep key="0" d={d} setD={setD} accent={W_PURPLE} onOpenDrafts={() => { setDraftPickerMode('list'); setDraftPickerOpen(true) }} />,

    // 1 — Equipment Details
    <div key="1">
      <SectionHead label="Equipment IDs" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <WF label="New Powerco Equipment ID" v={d.newEquipmentId}    set={set('newEquipmentId')} />
        <WF label="Old Powerco Equipment ID" v={d.oldEquipmentId}    set={set('oldEquipmentId')} />
      </div>
      <WF label="Location Pole/Site ID" v={d.locationPoleSiteId} set={set('locationPoleSiteId')} />
      <div style={{ height: 1, background: '#eee', margin: '12px 0' }} />
      <SectionHead label="Equipment Make / Model" />
      <WF label="Manufacturer" v={d.manufacturer} set={set('manufacturer')} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <WF label="Model"     v={d.model}    set={set('model')} />
        <WF label="Serial No" v={d.serialNo} set={set('serialNo')} />
      </div>
    </div>,

    // 2 — Equipment Type
    <div key="2">
      <SectionHead label="Select Equipment Type" />
      <WCB options={EQ_TYPE_OPTIONS} value={d.equipmentType} onChange={tog('equipmentType')} />
      {d.equipmentType === 'Other' && (
        <WF label="Specify type" v={d.equipmentTypeOther} set={set('equipmentTypeOther')} ph="Describe equipment type..." />
      )}
    </div>,

    // 3 — Replacement Details
    <div key="3">
      <SectionHead label="Type of Change" />
      <WCB options={['New', 'Removed', 'Replaced']} value={d.typeOfChange} onChange={tog('typeOfChange')} />
      <SectionHead label="Ownership" />
      <WCB options={['Powerco', 'Private', 'Other']} value={d.ownership} onChange={tog('ownership')} />
      {d.ownership === 'Other' && (
        <WF label="Specify ownership" v={d.ownershipOther} set={set('ownershipOther')} />
      )}
      {(d.typeOfChange === 'Removed' || d.typeOfChange === 'Replaced') && (
        <>
          <div style={{ height: 1, background: '#eee', margin: '12px 0' }} />
          <WTA label="Reason for Removal" v={d.reasonForRemoval} set={set('reasonForRemoval')} rows={3} ph="Describe reason for removal..." />
        </>
      )}
    </div>,

    // 4 — Equipment Rating
    <div key="4">
      <SectionHead label="Equipment Rating" sub="For RMU Switches: fill a row for each switch way" />
      {d.equipmentRating.map((row, i) => (
        <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', marginBottom: 10, background: '#fafcff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: W_PURPLE, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Switch / Way {i + 1}
            </div>
            {d.equipmentRating.length > 1 && (
              <button onClick={() => removeRatingRow(i)} style={{ padding: '2px 8px', border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 20, lineHeight: 1 }}>×</button>
            )}
          </div>
          <WF label="Equipment ID" v={row.equipmentId} set={setRating(i, 'equipmentId')} />
          <div style={{ marginBottom: 12 }}>
            <label style={wLbl}>Normal State</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {['Open', 'Closed'].map(s => {
                const sel = row.normalState === s
                return (
                  <button key={s} onClick={() => togRating(i, 'normalState')(s)} style={{
                    flex: 1, padding: '9px 0', borderRadius: 8,
                    border: `2px solid ${sel ? W_PURPLE : '#ddd'}`,
                    background: sel ? W_PURPLE : '#fff',
                    color: sel ? '#fff' : '#333',
                    fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', fontWeight: sel ? 700 : 400,
                  }}>{s}</button>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <WF label="Operating Voltage" v={row.operatingVoltage} set={setRating(i, 'operatingVoltage')} ph="e.g. 11kV" />
            <WF label="Voltage Rating"    v={row.voltageRating}    set={setRating(i, 'voltageRating')}    ph="e.g. 11kV" />
            <WF label="Fuse Size"         v={row.fuseSize}         set={setRating(i, 'fuseSize')}         ph="e.g. 100A" />
          </div>
        </div>
      ))}
      {d.equipmentRating.length < 5 && (
        <button onClick={addRatingRow} style={{
          width: '100%', padding: 12, borderRadius: 10, border: `2px dashed ${W_PURPLE}`,
          background: '#f0f6ff', color: W_PURPLE, fontFamily: 'inherit',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>
          + Add Switch / Way ({d.equipmentRating.length} / 5)
        </button>
      )}
    </div>,

    // 5 — Additional Detail
    <div key="5">
      <SectionHead label="Additional Detail" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={wLbl}>Remote Controlled</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {['Yes', 'No'].map(v => {
              const sel = d.remoteControlled === v
              return (
                <button key={v} onClick={() => tog('remoteControlled')(v)} style={{
                  flex: 1, padding: '9px 0', borderRadius: 8,
                  border: `2px solid ${sel ? W_PURPLE : '#ddd'}`,
                  background: sel ? W_PURPLE : '#fff',
                  color: sel ? '#fff' : '#333',
                  fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', fontWeight: sel ? 700 : 400,
                }}>{v}</button>
              )
            })}
          </div>
        </div>
        <div>
          <label style={wLbl}>Remote Indication</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {['Yes', 'No'].map(v => {
              const sel = d.remoteIndication === v
              return (
                <button key={v} onClick={() => tog('remoteIndication')(v)} style={{
                  flex: 1, padding: '9px 0', borderRadius: 8,
                  border: `2px solid ${sel ? W_PURPLE : '#ddd'}`,
                  background: sel ? W_PURPLE : '#fff',
                  color: sel ? '#fff' : '#333',
                  fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', fontWeight: sel ? 700 : 400,
                }}>{v}</button>
              )
            })}
          </div>
        </div>
      </div>
      <WTA label="Comments and Additional Information" v={d.comments} set={set('comments')} rows={5} ph="Add any additional comments here..." />
    </div>,

    // 6 — Multi-Item Details (page 2)
    <div key="6">
      <SectionHead label="Additional Equipment on Site" sub="Only needed when more than one item installed / removed" />
      {d.multiItems.map((row, i) => (
        <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', marginBottom: 10, background: '#fafcff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: W_PURPLE, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Item {i + 1}</div>
            {d.multiItems.length > 1 && (
              <button onClick={() => removeMultiRow(i)} style={{ padding: '2px 8px', border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 20, lineHeight: 1 }}>×</button>
            )}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={wLbl}>Installed (I) or Removed (R)</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {[['I', 'Installed'], ['R', 'Removed']].map(([val, label]) => {
                const sel = row.ir === val
                return (
                  <button key={val} onClick={() => togMulti(i, 'ir')(val)} style={{
                    flex: 1, padding: '9px 0', borderRadius: 8,
                    border: `2px solid ${sel ? W_PURPLE : '#ddd'}`,
                    background: sel ? W_PURPLE : '#fff',
                    color: sel ? '#fff' : '#333',
                    fontFamily: 'inherit', fontSize: 13, fontWeight: sel ? 700 : 400, cursor: 'pointer',
                  }}>{label}</button>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <WF label="Equipment ID"       v={row.equipmentId}       set={setMulti(i, 'equipmentId')} />
            <WF label="Equipment Type"     v={row.equipmentType}     set={setMulti(i, 'equipmentType')}     ph="e.g. Fused ABS" />
            <WF label="Manufacturer"       v={row.manufacturer}      set={setMulti(i, 'manufacturer')} />
            <WF label="Model"              v={row.model}             set={setMulti(i, 'model')} />
            <WF label="Serial Number"      v={row.serialNumber}      set={setMulti(i, 'serialNumber')} />
            <WF label="Operating Voltage"  v={row.operatingVoltage}  set={setMulti(i, 'operatingVoltage')}  ph="e.g. 11kV" />
            <WF label="Voltage Rating"     v={row.voltageRating}     set={setMulti(i, 'voltageRating')}     ph="e.g. 11kV" />
            <WF label="Fuse Size"          v={row.fuseSize}          set={setMulti(i, 'fuseSize')}          ph="e.g. 100A" />
          </div>
        </div>
      ))}
      {d.multiItems.length < 15 && (
        <button onClick={addMultiRow} style={{
          width: '100%', padding: 12, borderRadius: 10, border: `2px dashed ${W_PURPLE}`,
          background: '#f0f6ff', color: W_PURPLE, fontFamily: 'inherit',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>
          + Add Another Item ({d.multiItems.length} / 15)
        </button>
      )}
    </div>,

    // 7 – Photos
    <div key="7">
      <PhotoAttachStep photos={photos} onChange={setPhotos} accent={W_PURPLE} />
    </div>,
  ]

  const missingFields = [
    !d.pcoWONo    && 'PCo W/O No.',
    !d.streetRoad && 'Street/Road',
    !d.contractor && 'Contractor',
    !d.namePrint  && 'Name (Print)',
  ].filter(Boolean)

  const previewContent = buildPreviewContent(() => triggerGenerate(d, photos), W_PURPLE)

  return (
    <>
      {EE_SHOW_OVERLAY && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300, display: 'flex', background: '#1e1b4b', padding: '6px 12px', gap: 8, alignItems: 'center' }}>
          {['wizard', 'calibrate'].map(t2 => (
            <button key={t2} onClick={() => setTab(t2)} style={{
              padding: '6px 16px', borderRadius: 8, border: 'none',
              background: tab === t2 ? W_YELLOW : 'rgba(255,255,255,0.1)',
              color: tab === t2 ? '#1e1b4b' : '#fff',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize',
            }}>{t2}</button>
          ))}
          {tab === 'calibrate' && (
            <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
              {[1, 2].map(pg => (
                <button key={pg} onClick={() => setCalPage(pg)} style={{
                  padding: '4px 12px', borderRadius: 6, border: 'none',
                  background: calPage === pg ? '#3b82f6' : 'rgba(255,255,255,0.15)',
                  color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>Page {pg}</button>
              ))}
            </div>
          )}
          <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 12 }}>DEV BUILD — 360S014EE</span>
        </div>
      )}

      {EE_SHOW_OVERLAY && tab === 'calibrate' && (
        <div style={{ paddingTop: 44, overflowX: 'auto', background: '#111' }}>
          {calibrationPdfBytes
            ? <CoordOverlay pdfBytes={calibrationPdfBytes} page={calPage} />
            : <div style={{ padding: 32, color: '#ef4444', fontSize: 14 }}>⚠ Could not load forms/360S014EE.pdf — is it in public/forms/?</div>}
        </div>
      )}

      {tab === 'wizard' && (
        <WizardShell
          title="AS-Built Electrical Equipment Record"
          formNumber="360S014EE"
          headerIcon={<FileText size={22} color="#fff" style={{ flexShrink: 0 }} />}
          steps={EE_STEPS}
          step={step}
          onStepClick={setStep}
          onClose={onClose}
          onBack={() => setStep(s => s - 1)}
          onSaveDraft={() => { setDraftPickerMode('save'); setDraftPickerOpen(true) }}
        onNext={() => { const next = step + 1; setStep(next); if (next === EE_STEPS.length - 1) triggerGenerate(d, photos) }}
          accent={W_PURPLE}
          bg={EE_BG}
          mid={EE_MID}
          border={EE_BORDER}
          devPaddingTop={EE_SHOW_OVERLAY ? 44 : 0}
          isPreview={isPreview}
          onShare={handleShare}
          onClosePreview={() => { setStep(s => s - 1); clearPdf() }}
          missingFields={missingFields}
          previewContent={previewContent}
        >
          {formSteps[step]}
        </WizardShell>
      )}
      <DraftPicker
        open={draftPickerOpen}
        onClose={() => setDraftPickerOpen(false)}
        formKey="360S014EE"
        formLabel="Elec Equipment Record"
        d={d}
        step={step}
        photos={photos}
        onLoad={handleDraftLoad}
        accent={W_PURPLE}
        initialMode={draftPickerMode}
      />
    </>
  )
}
export default ElecEquipWizard
