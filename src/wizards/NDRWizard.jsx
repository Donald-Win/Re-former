/**
 * NDRWizard — 122F007 Electricity Network Damage Report
 *
 * Steps:
 *   0. Incident Details (address, date, time, OMS/CAE, asset ID)
 *   1. Incident Description (details, repair type)
 *   2. Damage Caused By (person/company details, cause type)
 *   3. In Attendance (fire/ambulance/police, contact, attended by)
 *   4. Additional Details (notifiable, injury, plans, mark out, trees etc)
 *   5. Photos (categorised: Before / After / Site Map / UG Cable / Additional)
 *   6. Preview & Print
 */
import React, { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { WizardShell } from '../shared/WizardShell'
import { PhotoAttachStep } from '../shared/PhotoAttachStep'
import { PdfCanvasPreview } from '../shared/PdfCanvasPreview'
import { getUserPrefs } from '../shared/userPrefs'
import { useWizardSetup } from '../shared/useWizardSetup'
import { useDraft } from '../shared/useDraft'
import { usePdfGenerate } from '../shared/usePdfGenerate'
import { DraftPicker } from '../shared/DraftPicker'
import { WF, WTA, WCB, SectionHead } from '../shared/WizardInputs'
import { APP_ACCENT } from '../shared/constants'

const FORM_KEY   = '122F007'
const FORM_LABEL = 'Network Damage Report'
const ACCENT     = '#dc2626'   // Red — incident/damage form

const STEPS = [
  'Incident Details',
  'Incident Description',
  'Damage Caused By',
  'In Attendance',
  'Additional Details',
  'Photos',
  'Preview',
]

// ── PDF field coordinates (bottom-origin, pt) ─────────────────────────────────
// All calibrated from pdfplumber rect extraction + word positions
const F = {
  // Page 1
  incidentAddr:    { x:  48, y: 745 },
  cityTown:        { x: 339, y: 745 },
  date:            { x: 339, y: 731 },
  timeOfIncident:  { x:  48, y: 718 },
  timeArrived:     { x: 339, y: 718 },
  omsOrCae:        { x:  48, y: 704 },
  assetId:         { x: 339, y: 704 },
  incidentDetails1:{ x:  48, y: 678 },
  incidentDetails2:{ x:  48, y: 664 },
  incidentDetails3:{ x:  48, y: 650 },
  repairDetails1:  { x: 180, y: 622 },
  repairDetails2:  { x:  48, y: 608 },
  repairDetails3:  { x:  48, y: 594 },
  // Temp/Perm checkboxes
  cbTemp:          { x: 108, y: 624 },
  cbPerm:          { x: 141, y: 624 },
  // Damage caused by - unknown
  cbUnknown:       { x: 211, y: 576 },
  // Title checkboxes
  cbMs:            { x: 118, y: 560 },
  cbMr:            { x: 140, y: 560 },
  cbMrs:           { x: 163, y: 560 },
  titleOther:      { x: 210, y: 560 },
  // Person details
  fullName:        { x: 136, y: 542 },
  fullNamePhone:   { x: 383, y: 542 },
  companyName:     { x: 136, y: 527 },
  companyPhone:    { x: 383, y: 527 },
  contactAddr:     { x: 136, y: 504 },
  emailAddr:       { x: 136, y: 489 },
  // Cause type checkboxes
  cbPlant:         { x: 178, y: 474 },
  cbHandTools:     { x: 257, y: 474 },
  cbDeliberate:    { x: 356, y: 474 },
  cbVehicle:       { x: 456, y: 474 },
  // Cause details
  causeDetails1:   { x: 136, y: 459 },
  causeDetails2:   { x: 136, y: 444 },
  makeModel:       { x: 136, y: 430 },
  colour:          { x: 136, y: 415 },
  registration:    { x: 390, y: 415 },
  // In attendance
  cbFireYes:       { x:  73, y: 380 },
  cbFireNo:        { x:  87, y: 380 },
  cbAmbuYes:       { x: 183, y: 380 },
  cbAmbuNo:        { x: 197, y: 380 },
  cbPoliceYes:     { x: 307, y: 380 },
  cbPoliceNo:      { x: 321, y: 380 },
  attendComment:   { x: 385, y: 380 },
  contactPerson:   { x: 136, y: 365 },
  station:         { x: 300, y: 365 },
  eventNum:        { x: 455, y: 365 },
  attendedBy:      { x: 136, y: 348 },
  contractor:      { x: 383, y: 348 },
  attendedDate:    { x:  80, y: 321 },
  region:          { x: 335, y: 321 },
  witnessName:     { x: 136, y: 301 },
  witnessPhone:    { x: 383, y: 301 },
  // Additional details
  cbNotifYes:      { x: 175, y: 267 },
  cbNotifNo:       { x: 193, y: 267 },
  notifComment:    { x: 298, y: 267 },
  cbInjuryYes:     { x: 175, y: 257 },
  cbInjuryNo:      { x: 193, y: 257 },
  cbInjuryUnk:     { x: 213, y: 257 },
  cbPlansYes:      { x: 175, y: 246 },
  cbPlansNo:       { x: 193, y: 246 },
  cbPlansNA:       { x: 213, y: 246 },
  plansComment:    { x: 298, y: 246 },
  cbMarkYes:       { x: 175, y: 235 },
  cbMarkNo:        { x: 193, y: 235 },
  cbMarkNA:        { x: 213, y: 235 },
  markComment:     { x: 298, y: 235 },
  cbTrialYes:      { x: 175, y: 224 },
  cbTrialNo:       { x: 193, y: 224 },
  cbTrialNA:       { x: 213, y: 224 },
  trialDepth:      { x: 298, y: 224 },
  cbHighYes:       { x: 175, y: 213 },
  heightBefore:    { x: 280, y: 213 },
  heightAfter:     { x: 435, y: 213 },
  cbTreeYes:       { x: 175, y: 192 },
  cbTreeNo:        { x: 193, y: 192 },
  treeDetails1:    { x:  43, y: 175 },
  treeDetails2:    { x:  43, y: 162 },
}

// ── Photo page bounding boxes (for embedding photos into specific pages) ──────
const PHOTO_AREAS = {
  before: { page: 1, x: 36, y: 129, w: 532, h: 618 },  // page 2 (index 1)
  after:  { page: 2, x: 36, y: 108, w: 527, h: 618 },  // page 3 (index 2)
  map:    { page: 3, x: 36, y: 108, w: 527, h: 618 },  // page 4 (index 3)
  ug:     { page: 4, x: 36, y: 108, w: 527, h: 618 },  // page 5 (index 4)
  extra:  { page: 5, x: 36, y: 108, w: 527, h: 618 },  // page 6 (index 5)
}

// ── Init state ────────────────────────────────────────────────────────────────
function initState() {
  const prefs = getUserPrefs()
  return {
    // Step 0 - Incident Details
    uniqueRef:       '',
    incidentAddr:    '',
    cityTown:        '',
    incidentDate:    prefs.dateWorkCompleted || '',
    timeOfIncident:  '',
    timeAmPm:        'am',
    timeArrived:     '',
    timeArrivedAmPm: 'am',
    omsOrCae:        '',
    assetId:         '',
    // Step 1 - Incident Description
    incidentDetails: '',
    repairType:      '',   // 'temp' | 'perm'
    repairDetails:   '',
    // Step 2 - Damage Caused By
    causeUnknown:    false,
    causeTitle:      '',   // 'Ms' | 'Mr' | 'Mrs' | 'Other'
    causeTitleOther: '',
    causeFullName:   '',
    causePhone:      '',
    causeCompany:    '',
    causeCompanyPhone: '',
    causeAddress:    '',
    causeEmail:      '',
    causeType:       '',   // 'plant' | 'handtools' | 'deliberate' | 'vehicle'
    causeDetails:    '',
    makModel:        '',
    colour:          '',
    registration:    '',
    // Step 3 - In Attendance
    fireAttend:      '',   // 'yes' | 'no'
    ambuAttend:      '',
    policeAttend:    '',
    attendComment:   '',
    contactPerson:   '',
    station:         '',
    eventNum:        '',
    attendedBy:      prefs.namePrint  || '',
    contractor:      prefs.contractor || '',
    attendedDate:    prefs.dateWorkCompleted || '',
    region:          '',
    witnessName:     '',
    witnessPhone:    '',
    // Step 4 - Additional Details
    notifiable:      '',   // 'yes' | 'no'
    notifComment:    '',
    injury:          '',   // 'yes' | 'no' | 'unknown'
    plansOnSite:     '',   // 'yes' | 'no' | 'na'
    plansComment:    '',
    markOut:         '',   // 'yes' | 'no' | 'na'
    markComment:     '',
    trialHoles:      '',   // 'yes' | 'no' | 'na'
    trialDepth:      '',
    highLoad:        false,
    heightBefore:    '',
    heightAfter:     '',
    treeYes:         '',   // 'yes' | 'no'
    treeDetails:     '',
    // Photos are handled separately by category
    photosBefore: [],
    photosAfter:  [],
    photosMap:    [],
    photosUG:     [],
    photosExtra:  [],
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const BLUE = rgb(0/255, 20/255, 160/255)

async function embedPhotoIntoArea(pdfDoc, photos, area) {
  if (!photos || photos.length === 0) return
  const page    = pdfDoc.getPages()[area.page]
  const margin  = 4
  const count   = photos.length
  // Lay out photos in a grid within the area
  const cols    = count <= 1 ? 1 : count <= 4 ? 2 : 3
  const rows    = Math.ceil(count / cols)
  const cellW   = (area.w - margin * (cols + 1)) / cols
  const cellH   = (area.h - margin * (rows + 1)) / rows

  for (let i = 0; i < photos.length; i++) {
    const { dataUrl } = photos[i]
    if (!dataUrl) continue
    try {
      // Normalise via canvas
      const imgEl = await new Promise((res, rej) => {
        const img = new window.Image()
        img.onload = () => res(img)
        img.onerror = () => rej()
        img.src = dataUrl
      })
      const SCALE = 1200 / Math.max(imgEl.naturalWidth, imgEl.naturalHeight)
      const cW = Math.round(imgEl.naturalWidth  * Math.min(SCALE, 1))
      const cH = Math.round(imgEl.naturalHeight * Math.min(SCALE, 1))
      const canvas = document.createElement('canvas')
      canvas.width = cW; canvas.height = cH
      canvas.getContext('2d').drawImage(imgEl, 0, 0, cW, cH)
      const b64   = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      const embedded = await pdfDoc.embedJpg(bytes)

      const col = i % cols
      const row = Math.floor(i / cols)
      const x   = area.x + margin + col * (cellW + margin)
      const y   = area.y + area.h - margin - (row + 1) * cellH - row * margin
      const scale = Math.min(cellW / cW, cellH / cH)
      const dW  = cW * scale, dH = cH * scale
      page.drawImage(embedded, {
        x: x + (cellW - dW) / 2,
        y: y + (cellH - dH) / 2,
        width: dW, height: dH,
      })
    } catch { /* skip failed photo */ }
  }
}

// ── PDF generation ────────────────────────────────────────────────────────────
async function generateNdrPdf(d, _photos) {
  const url = `${import.meta.env.BASE_URL}forms/122F007.pdf`
  const buf = await fetch(url).then(r => r.arrayBuffer())
  const doc = await PDFDocument.load(buf)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const p1   = doc.getPages()[0]

  const t = (page, text, x, y, size = 8, maxWidth = 200) => {
    if (!text) return
    page.drawText(String(text), { x, y, size, font, color: BLUE, maxWidth })
  }

  const ck = (page, x, y, show) => {
    if (!show) return
    page.drawLine({ start: { x, y: y - 6 }, end: { x: x + 3, y: y - 9 }, thickness: 1.5, color: BLUE, opacity: 1 })
    page.drawLine({ start: { x: x + 3, y: y - 9 }, end: { x: x + 9, y: y - 1 }, thickness: 1.5, color: BLUE, opacity: 1 })
  }

  // ── Page 1 fields ──────────────────────────────────────────────────────────
  // Split long text across multiple lines
  const splitText = (text, maxChars) => {
    if (!text) return ['', '', '']
    const words = text.split(' ')
    const lines = ['', '', '']
    let li = 0
    words.forEach(w => {
      if (li > 2) return
      if ((lines[li] + ' ' + w).trim().length <= maxChars) {
        lines[li] = (lines[li] + ' ' + w).trim()
      } else {
        li++
        if (li <= 2) lines[li] = w
      }
    })
    return lines
  }

  // Incident address
  t(p1, d.incidentAddr, F.incidentAddr.x, F.incidentAddr.y, 8, 280)
  t(p1, d.cityTown,     F.cityTown.x,     F.cityTown.y,     8, 120)
  t(p1, d.incidentDate, F.date.x,         F.date.y,         8, 120)
  t(p1, d.timeOfIncident + (d.timeAmPm ? ` ${d.timeAmPm}` : ''), F.timeOfIncident.x, F.timeOfIncident.y, 8, 100)
  t(p1, d.timeArrived + (d.timeArrivedAmPm ? ` ${d.timeArrivedAmPm}` : ''), F.timeArrived.x, F.timeArrived.y, 8, 100)
  t(p1, d.omsOrCae,     F.omsOrCae.x,     F.omsOrCae.y,     8, 280)
  t(p1, d.assetId,      F.assetId.x,      F.assetId.y,      8, 150)

  // Incident details (split across 3 lines)
  const incLines = splitText(d.incidentDetails, 80)
  t(p1, incLines[0], F.incidentDetails1.x, F.incidentDetails1.y, 8, 490)
  t(p1, incLines[1], F.incidentDetails2.x, F.incidentDetails2.y, 8, 490)
  t(p1, incLines[2], F.incidentDetails3.x, F.incidentDetails3.y, 8, 490)

  // Repair type checkboxes
  ck(p1, F.cbTemp.x, F.cbTemp.y, d.repairType === 'temp')
  ck(p1, F.cbPerm.x, F.cbPerm.y, d.repairType === 'perm')
  const repLines = splitText(d.repairDetails, 70)
  t(p1, repLines[0], F.repairDetails1.x, F.repairDetails1.y, 8, 360)
  t(p1, repLines[1], F.repairDetails2.x, F.repairDetails2.y, 8, 490)
  t(p1, repLines[2], F.repairDetails3.x, F.repairDetails3.y, 8, 490)

  // Damage caused by
  ck(p1, F.cbUnknown.x, F.cbUnknown.y, d.causeUnknown)
  ck(p1, F.cbMs.x,  F.cbMs.y,  d.causeTitle === 'Ms')
  ck(p1, F.cbMr.x,  F.cbMr.y,  d.causeTitle === 'Mr')
  ck(p1, F.cbMrs.x, F.cbMrs.y, d.causeTitle === 'Mrs')
  if (d.causeTitle === 'Other') t(p1, d.causeTitleOther, F.titleOther.x, F.titleOther.y, 8, 80)
  t(p1, d.causeFullName,     F.fullName.x,      F.fullName.y,      8, 230)
  t(p1, d.causePhone,        F.fullNamePhone.x,  F.fullNamePhone.y, 8, 150)
  t(p1, d.causeCompany,      F.companyName.x,    F.companyName.y,   8, 230)
  t(p1, d.causeCompanyPhone, F.companyPhone.x,   F.companyPhone.y,  8, 150)
  t(p1, d.causeAddress,      F.contactAddr.x,    F.contactAddr.y,   8, 420)
  t(p1, d.causeEmail,        F.emailAddr.x,      F.emailAddr.y,     8, 420)

  // Cause type
  ck(p1, F.cbPlant.x,      F.cbPlant.y,      d.causeType === 'plant')
  ck(p1, F.cbHandTools.x,  F.cbHandTools.y,  d.causeType === 'handtools')
  ck(p1, F.cbDeliberate.x, F.cbDeliberate.y, d.causeType === 'deliberate')
  ck(p1, F.cbVehicle.x,    F.cbVehicle.y,    d.causeType === 'vehicle')
  const causeLines = splitText(d.causeDetails, 80)
  t(p1, causeLines[0], F.causeDetails1.x, F.causeDetails1.y, 8, 420)
  t(p1, causeLines[1], F.causeDetails2.x, F.causeDetails2.y, 8, 420)
  t(p1, d.makModel,    F.makeModel.x,     F.makeModel.y,     8, 420)
  t(p1, d.colour,      F.colour.x,        F.colour.y,        8, 180)
  t(p1, d.registration,F.registration.x,  F.registration.y,  8, 150)

  // In attendance
  ck(p1, F.cbFireYes.x,   F.cbFireYes.y,   d.fireAttend   === 'yes')
  ck(p1, F.cbFireNo.x,    F.cbFireNo.y,    d.fireAttend   === 'no')
  ck(p1, F.cbAmbuYes.x,   F.cbAmbuYes.y,   d.ambuAttend   === 'yes')
  ck(p1, F.cbAmbuNo.x,    F.cbAmbuNo.y,    d.ambuAttend   === 'no')
  ck(p1, F.cbPoliceYes.x, F.cbPoliceYes.y, d.policeAttend === 'yes')
  ck(p1, F.cbPoliceNo.x,  F.cbPoliceNo.y,  d.policeAttend === 'no')
  t(p1, d.attendComment, F.attendComment.x, F.attendComment.y, 8, 150)
  t(p1, d.contactPerson, F.contactPerson.x, F.contactPerson.y, 8, 150)
  t(p1, d.station,       F.station.x,       F.station.y,       8, 140)
  t(p1, d.eventNum,      F.eventNum.x,      F.eventNum.y,      8, 100)
  t(p1, d.attendedBy,    F.attendedBy.x,    F.attendedBy.y,    8, 200)
  t(p1, d.contractor,    F.contractor.x,    F.contractor.y,    8, 160)
  t(p1, d.attendedDate,  F.attendedDate.x,  F.attendedDate.y,  8, 120)
  t(p1, d.region,        F.region.x,        F.region.y,        8, 200)
  t(p1, d.witnessName,   F.witnessName.x,   F.witnessName.y,   8, 200)
  t(p1, d.witnessPhone,  F.witnessPhone.x,  F.witnessPhone.y,  8, 160)

  // Additional details
  ck(p1, F.cbNotifYes.x, F.cbNotifYes.y, d.notifiable === 'yes')
  ck(p1, F.cbNotifNo.x,  F.cbNotifNo.y,  d.notifiable === 'no')
  t(p1, d.notifComment, F.notifComment.x, F.notifComment.y, 8, 230)

  ck(p1, F.cbInjuryYes.x, F.cbInjuryYes.y, d.injury === 'yes')
  ck(p1, F.cbInjuryNo.x,  F.cbInjuryNo.y,  d.injury === 'no')
  ck(p1, F.cbInjuryUnk.x, F.cbInjuryUnk.y, d.injury === 'unknown')

  ck(p1, F.cbPlansYes.x, F.cbPlansYes.y, d.plansOnSite === 'yes')
  ck(p1, F.cbPlansNo.x,  F.cbPlansNo.y,  d.plansOnSite === 'no')
  ck(p1, F.cbPlansNA.x,  F.cbPlansNA.y,  d.plansOnSite === 'na')
  t(p1, d.plansComment, F.plansComment.x, F.plansComment.y, 8, 230)

  ck(p1, F.cbMarkYes.x, F.cbMarkYes.y, d.markOut === 'yes')
  ck(p1, F.cbMarkNo.x,  F.cbMarkNo.y,  d.markOut === 'no')
  ck(p1, F.cbMarkNA.x,  F.cbMarkNA.y,  d.markOut === 'na')
  t(p1, d.markComment, F.markComment.x, F.markComment.y, 8, 230)

  ck(p1, F.cbTrialYes.x, F.cbTrialYes.y, d.trialHoles === 'yes')
  ck(p1, F.cbTrialNo.x,  F.cbTrialNo.y,  d.trialHoles === 'no')
  ck(p1, F.cbTrialNA.x,  F.cbTrialNA.y,  d.trialHoles === 'na')
  t(p1, d.trialDepth, F.trialDepth.x, F.trialDepth.y, 8, 230)

  ck(p1, F.cbHighYes.x, F.cbHighYes.y, d.highLoad)
  t(p1, d.heightBefore, F.heightBefore.x, F.heightBefore.y, 8, 120)
  t(p1, d.heightAfter,  F.heightAfter.x,  F.heightAfter.y,  8, 120)

  ck(p1, F.cbTreeYes.x, F.cbTreeYes.y, d.treeYes === 'yes')
  ck(p1, F.cbTreeNo.x,  F.cbTreeNo.y,  d.treeYes === 'no')
  const treeLines = splitText(d.treeDetails, 120)
  t(p1, treeLines[0], F.treeDetails1.x, F.treeDetails1.y, 8, 500)
  t(p1, treeLines[1], F.treeDetails2.x, F.treeDetails2.y, 8, 500)

  // ── Photo pages ────────────────────────────────────────────────────────────
  await embedPhotoIntoArea(doc, d.photosBefore, PHOTO_AREAS.before)
  await embedPhotoIntoArea(doc, d.photosAfter,  PHOTO_AREAS.after)
  await embedPhotoIntoArea(doc, d.photosMap,    PHOTO_AREAS.map)
  await embedPhotoIntoArea(doc, d.photosUG,     PHOTO_AREAS.ug)
  await embedPhotoIntoArea(doc, d.photosExtra,  PHOTO_AREAS.extra)

  return new Uint8Array(await doc.save())
}

// ── Photo category component ──────────────────────────────────────────────────
function PhotoCategoryStep({ d, setD }) {
  const CATS = [
    { key: 'photosBefore', label: 'Before',                     sub: 'Photos taken before repair' },
    { key: 'photosAfter',  label: 'After',                      sub: 'Photos taken after repair' },
    { key: 'photosMap',    label: 'Site Map',                   sub: 'Location map (required if trees involved)' },
    { key: 'photosUG',     label: 'UG Cable Mark-out',          sub: 'For underground cable damage' },
    { key: 'photosExtra',  label: 'Additional',                 sub: 'Any other relevant photos' },
  ]

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        Photos are placed into the correct pages of the PDF automatically.
      </p>
      {CATS.map(cat => {
        const photos = d[cat.key] || []
        return (
          <div key={cat.key} style={{ marginBottom: 14 }}>
            <div style={{
              fontWeight: 700, fontSize: 13, color: ACCENT, marginBottom: 2,
            }}>{cat.label}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{cat.sub}</div>
            <PhotoAttachStep
              photos={photos}
              onChange={updater => setD(prev => ({
                ...prev,
                [cat.key]: typeof updater === 'function' ? updater(prev[cat.key] || []) : updater,
              }))}
              accent={ACCENT}
            />
          </div>
        )
      })}
    </div>
  )
}

// ── Wizard ────────────────────────────────────────────────────────────────────
export default function NDRWizard({ onClose }) {
  const [d, setD]   = useState(initState)
  const [step, setStep] = useState(0)
  const [draftPickerOpen, setDraftPickerOpen] = useState(false)
  const [draftPickerMode, setDraftPickerMode] = useState('menu')

  const allPhotos = [
    ...(d.photosBefore || []),
    ...(d.photosAfter  || []),
    ...(d.photosMap    || []),
    ...(d.photosUG     || []),
    ...(d.photosExtra  || []),
  ]

  const { loadJobHistory, set } = useWizardSetup(d, setD, step, FORM_KEY)
  const { clearDraft: clearFormDraft } = useDraft(FORM_KEY, d, step, allPhotos)
  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } =
    usePdfGenerate(generateNdrPdf)

  const handleDraftLoad = (draft) => {
    setD(prev => ({ ...prev, ...(draft.data || {}) }))
    setStep(draft.step || 0)
  }

  const isPreview = step === STEPS.length - 1

  const handleNext = () => {
    if (step === STEPS.length - 2) triggerGenerate(d, allPhotos)
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }

  const handleBack = () => {
    if (isPreview) { clearPdf(); setStep(s => s - 1); return }
    setStep(s => Math.max(s - 1, 0))
  }

  const handleShare = async () => {
    if (!pdfBytes) return
    const { sharePdf } = await import('../shared/sharePdf')
    const ref   = d.uniqueRef || d.incidentAddr || 'NDR'
    const fname = `${ref} - Network Damage Report.pdf`
    await sharePdf(pdfBytes, fname, pdfBlobUrl, clearFormDraft)
  }

  const missingFields = []
  if (!d.incidentAddr) missingFields.push('Incident Address')
  if (!d.incidentDate) missingFields.push('Date')

  // ── Step content ──────────────────────────────────────────────────────────
  const renderStep = () => {
    if (isPreview) return null

    // Step 0 — Incident Details
    if (step === 0) return (
      <div>
        <WF label="Unique Reference # (for file name)" v={d.uniqueRef} set={v => setD(p => ({...p, uniqueRef: v}))} ph="e.g. NDR-2025-001" accent={ACCENT} />
        <WF label="Incident Address" v={d.incidentAddr} set={v => setD(p => ({...p, incidentAddr: v}))} ph="123 Example Road" accent={ACCENT} />
        <WF label="City / Town" v={d.cityTown} set={v => setD(p => ({...p, cityTown: v}))} ph="Hamilton" accent={ACCENT} />
        <WF label="Date" v={d.incidentDate} set={v => setD(p => ({...p, incidentDate: v}))} type="date" accent={ACCENT} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 10px', alignItems: 'end', marginBottom: 12 }}>
          <WF label="Time of Incident" v={d.timeOfIncident} set={v => setD(p => ({...p, timeOfIncident: v}))} ph="e.g. 14:30" accent={ACCENT} />
          <WCB options={['am','pm']} value={d.timeAmPm} onChange={v => setD(p => ({...p, timeAmPm: v}))} accent={ACCENT} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 10px', alignItems: 'end', marginBottom: 12 }}>
          <WF label="Time Arrived on Site" v={d.timeArrived} set={v => setD(p => ({...p, timeArrived: v}))} ph="e.g. 15:00" accent={ACCENT} />
          <WCB options={['am','pm']} value={d.timeArrivedAmPm} onChange={v => setD(p => ({...p, timeArrivedAmPm: v}))} accent={ACCENT} />
        </div>
        <WF label="OMS or CAE #" v={d.omsOrCae} set={v => setD(p => ({...p, omsOrCae: v}))} accent={ACCENT} />
        <WF label="Asset ID" v={d.assetId} set={v => setD(p => ({...p, assetId: v}))} accent={ACCENT} />
      </div>
    )

    // Step 1 — Incident Description
    if (step === 1) return (
      <div>
        <WTA label="Details of Incident (network damage / property damage)" rows={5}
          v={d.incidentDetails} set={v => setD(p => ({...p, incidentDetails: v}))} accent={ACCENT} />
        <SectionHead label="Details of Repair" accent={ACCENT} />
        <WCB label="Repair Type" options={['Temp','Perm']}
          value={d.repairType === 'temp' ? 'Temp' : d.repairType === 'perm' ? 'Perm' : ''}
          onChange={v => setD(p => ({...p, repairType: v.toLowerCase()}))} accent={ACCENT} />
        <WTA label="Repair Details" rows={3}
          v={d.repairDetails} set={v => setD(p => ({...p, repairDetails: v}))} accent={ACCENT} />
      </div>
    )

    // Step 2 — Damage Caused By
    if (step === 2) return (
      <div>
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => setD(p => ({...p, causeUnknown: !p.causeUnknown}))}
            style={{
              padding: '10px 14px', borderRadius: 10, width: '100%', textAlign: 'left',
              border: `2px solid ${d.causeUnknown ? ACCENT : '#e5e7eb'}`,
              background: d.causeUnknown ? ACCENT + '12' : '#fff',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: d.causeUnknown ? ACCENT : '#f3f4f6',
              border: `2px solid ${d.causeUnknown ? ACCENT : '#d1d5db'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: d.causeUnknown ? '#fff' : 'transparent', fontWeight: 700,
            }}>✓</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Cause unknown — tick here</span>
          </button>
        </div>

        {!d.causeUnknown && (
          <>
            <SectionHead label="Person Responsible" accent={ACCENT} />
            <WCB label="Title" options={['Ms','Mr','Mrs','Other']}
              value={d.causeTitle} onChange={v => setD(p => ({...p, causeTitle: v}))} accent={ACCENT} />
            {d.causeTitle === 'Other' && (
              <WF label="Other title" v={d.causeTitleOther} set={v => setD(p => ({...p, causeTitleOther: v}))} accent={ACCENT} />
            )}
            <WF label="Full Name"     v={d.causeFullName}   set={v => setD(p => ({...p, causeFullName: v}))}   accent={ACCENT} />
            <WF label="Phone"         v={d.causePhone}      set={v => setD(p => ({...p, causePhone: v}))}      accent={ACCENT} />
            <WF label="Company Name (if applicable)" v={d.causeCompany} set={v => setD(p => ({...p, causeCompany: v}))} accent={ACCENT} />
            <WF label="Company Phone" v={d.causeCompanyPhone} set={v => setD(p => ({...p, causeCompanyPhone: v}))} accent={ACCENT} />
            <WF label="Contact Address" v={d.causeAddress}  set={v => setD(p => ({...p, causeAddress: v}))}   accent={ACCENT} />
            <WF label="Email Address" v={d.causeEmail}      set={v => setD(p => ({...p, causeEmail: v}))}     accent={ACCENT} />

            <SectionHead label="Cause Type" accent={ACCENT} />
            <WCB options={['Plant / Equipment','Hand Tools','Deliberate / Wilful Act','Vehicle']}
              value={
                d.causeType === 'plant'      ? 'Plant / Equipment'      :
                d.causeType === 'handtools'  ? 'Hand Tools'             :
                d.causeType === 'deliberate' ? 'Deliberate / Wilful Act':
                d.causeType === 'vehicle'    ? 'Vehicle'                : ''
              }
              onChange={v => setD(p => ({...p, causeType:
                v === 'Plant / Equipment'       ? 'plant'      :
                v === 'Hand Tools'              ? 'handtools'  :
                v === 'Deliberate / Wilful Act' ? 'deliberate' : 'vehicle'
              }))}
              accent={ACCENT}
            />
            <WTA label="Details"      v={d.causeDetails} set={v => setD(p => ({...p, causeDetails: v}))} rows={2} accent={ACCENT} />
            <WF label="Make / Model"  v={d.makModel}     set={v => setD(p => ({...p, makModel: v}))}     accent={ACCENT} />
            <WF label="Colour"        v={d.colour}       set={v => setD(p => ({...p, colour: v}))}       accent={ACCENT} />
            <WF label="Registration"  v={d.registration} set={v => setD(p => ({...p, registration: v}))} accent={ACCENT} />
          </>
        )}
      </div>
    )

    // Step 3 — In Attendance & Response
    if (step === 3) return (
      <div>
        <SectionHead label="In Attendance" accent={ACCENT} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          {[['Fire', 'fireAttend'], ['Ambulance', 'ambuAttend'], ['Police', 'policeAttend']].map(([label, key]) => (
            <div key={key}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <WCB options={['Yes','No']} value={d[key] === 'yes' ? 'Yes' : d[key] === 'no' ? 'No' : ''}
                onChange={v => setD(p => ({...p, [key]: v.toLowerCase()}))} accent={ACCENT} />
            </div>
          ))}
        </div>
        <WF label="Comment" v={d.attendComment} set={v => setD(p => ({...p, attendComment: v}))} accent={ACCENT} />
        <WF label="Contact Person" v={d.contactPerson} set={v => setD(p => ({...p, contactPerson: v}))} accent={ACCENT} />
        <WF label="Station" v={d.station} set={v => setD(p => ({...p, station: v}))} accent={ACCENT} />
        <WF label="Event #" v={d.eventNum} set={v => setD(p => ({...p, eventNum: v}))} accent={ACCENT} />

        <SectionHead label="Response" sub="Pre-filled from your settings" accent={ACCENT} />
        <WF label="Attended By (fault response person)" v={d.attendedBy} set={v => setD(p => ({...p, attendedBy: v}))} accent={ACCENT} />
        <WF label="Contractor" v={d.contractor} set={v => setD(p => ({...p, contractor: v}))} accent={ACCENT} />
        <WF label="Attended Date" v={d.attendedDate} set={v => setD(p => ({...p, attendedDate: v}))} type="date" accent={ACCENT} />
        <WF label="Region" v={d.region} set={v => setD(p => ({...p, region: v}))} accent={ACCENT} />
        <WF label="Witness Name" v={d.witnessName} set={v => setD(p => ({...p, witnessName: v}))} accent={ACCENT} />
        <WF label="Witness Phone" v={d.witnessPhone} set={v => setD(p => ({...p, witnessPhone: v}))} accent={ACCENT} />
      </div>
    )

    // Step 4 — Additional Details
    if (step === 4) return (
      <div>
        <div style={{ marginBottom: 14 }}>
          <WCB label="Notifiable Incident?" options={['Yes','No']}
            value={d.notifiable === 'yes' ? 'Yes' : d.notifiable === 'no' ? 'No' : ''}
            onChange={v => setD(p => ({...p, notifiable: v.toLowerCase()}))} accent={ACCENT} />
          {d.notifiable === 'yes' && (
            <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#dc2626', marginTop: 6 }}>
              ⚠️ Notify Powerco Network Operations Centre immediately.
            </div>
          )}
          <WF label="Comment" v={d.notifComment} set={v => setD(p => ({...p, notifComment: v}))} accent={ACCENT} />
        </div>

        <WCB label="Injury Sustained?" options={['Yes','No','Unknown']}
          value={d.injury === 'yes' ? 'Yes' : d.injury === 'no' ? 'No' : d.injury === 'unknown' ? 'Unknown' : ''}
          onChange={v => setD(p => ({...p, injury: v.toLowerCase()}))} accent={ACCENT} />
        {d.injury === 'yes' && (
          <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#dc2626', marginBottom: 10 }}>
            ⚠️ Report to Powerco Network Operations Centre.
          </div>
        )}

        <SectionHead label="Site Conditions" accent={ACCENT} />

        {[
          ['Plans on Site?',    'plansOnSite', true,  'plansComment', 'Accuracy / comments'],
          ['Mark Out?',         'markOut',     true,  'markComment',  'Comments'],
          ['Trial Holes Dug?',  'trialHoles',  true,  'trialDepth',   'Depth'],
        ].map(([label, key, hasNA, commentKey, commentLabel]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <WCB label={label} options={hasNA ? ['Yes','No','N/A'] : ['Yes','No']}
              value={d[key] === 'yes' ? 'Yes' : d[key] === 'no' ? 'No' : d[key] === 'na' ? 'N/A' : ''}
              onChange={v => setD(p => ({...p, [key]: v === 'N/A' ? 'na' : v.toLowerCase()}))} accent={ACCENT} />
            {commentKey && d[key] && d[key] !== 'no' && (
              <WF label={commentLabel} v={d[commentKey]} set={v => setD(p => ({...p, [commentKey]: v}))} accent={ACCENT} />
            )}
          </div>
        ))}

        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => setD(p => ({...p, highLoad: !p.highLoad}))}
            style={{
              padding: '10px 14px', borderRadius: 10, width: '100%', textAlign: 'left',
              border: `2px solid ${d.highLoad ? ACCENT : '#e5e7eb'}`,
              background: d.highLoad ? ACCENT + '12' : '#fff',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 10,
              marginBottom: 8,
            }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: d.highLoad ? ACCENT : '#f3f4f6',
              border: `2px solid ${d.highLoad ? ACCENT : '#d1d5db'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: d.highLoad ? '#fff' : 'transparent', fontWeight: 700,
            }}>✓</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>High Load?</span>
          </button>
          {d.highLoad && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <WF label="Line Height Before (if known)" v={d.heightBefore} set={v => setD(p => ({...p, heightBefore: v}))} accent={ACCENT} />
              <WF label="Line Height After" v={d.heightAfter} set={v => setD(p => ({...p, heightAfter: v}))} accent={ACCENT} />
            </div>
          )}
        </div>

        <SectionHead label="Trees" accent={ACCENT} />
        <WCB label="Trees involved?" options={['Yes','No']}
          value={d.treeYes === 'yes' ? 'Yes' : d.treeYes === 'no' ? 'No' : ''}
          onChange={v => setD(p => ({...p, treeYes: v.toLowerCase()}))} accent={ACCENT} />
        {d.treeYes === 'yes' && (
          <WTA label="Tree Details (condition, boundary, location, measurements)" rows={4}
            v={d.treeDetails} set={v => setD(p => ({...p, treeDetails: v}))} accent={ACCENT} />
        )}
      </div>
    )

    // Step 5 — Photos
    if (step === 5) return <PhotoCategoryStep d={d} setD={setD} />

    return null
  }

  return (
    <WizardShell
      title={FORM_LABEL}
      formNumber={FORM_KEY}
      headerIcon={<AlertTriangle size={22} color="#fff" />}
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
        d={d} step={step} photos={allPhotos}
        onLoad={handleDraftLoad}
        accent={ACCENT}
        initialMode={draftPickerMode}
      />
    </WizardShell>
  )
}
