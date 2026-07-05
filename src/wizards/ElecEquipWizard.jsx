
// 360S014EE — AS-Built Electrical Equipment Record
import React, { useState } from 'react'
import { FileText } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { APP_ACCENT, APP_YELLOW, WIZARD_COLORS } from '../shared/constants'
import { useWizardSetup } from '../shared/useWizardSetup'
import { useDraft } from '../shared/useDraft'
import { DraftPicker } from '../shared/DraftPicker'
import { useDraftPicker } from '../shared/useDraftPicker'
import { wInp, wLbl, WF, WTA, WCB, SectionHead } from '../shared/WizardInputs'
import { PhotoAttachStep } from '../shared/PhotoAttachStep'
import { sharePdf, buildPdfFilename } from '../shared/sharePdf'
import { getBaseFormState } from '../shared/userPrefs'
import { JobDetailsStep } from '../shared/JobDetailsStep'
import { usePdfGenerate } from '../shared/usePdfGenerate'
import { createWorkerGenerator } from '../shared/pdfWorkerClient'

// ── PDF generation now runs off the main thread via the shared PDF worker ────
const generateEEPdf = createWorkerGenerator('ElecEquipPdfGenerator', 'generateEEPdf')

const W_PURPLE = APP_ACCENT
const W_YELLOW = APP_YELLOW

const EE_BG     = WIZARD_COLORS.bg
const EE_MID    = WIZARD_COLORS.mid
const EE_BORDER = WIZARD_COLORS.border

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

function ElecEquipWizard({ onClose = () => {} }) {
  const [step, setStep]     = useState(0)
  const [photos, setPhotos] = useState([])
  const [d, setD] = useState(() => getBaseFormState({
    newEquipmentId: '', oldEquipmentId: '', locationPoleSiteId: '',
    manufacturer: '', model: '', serialNo: '',
    equipmentType: '', equipmentTypeOther: '',
    typeOfChange: '', ownership: '', ownershipOther: '',
    reasonForRemoval: '',
    equipmentRating: [emptyRatingRow()],
    remoteControlled: '', remoteIndication: '',
    comments: '',
    multiItems: [emptyMultiRow()],
  }))

  const isPreview = step === EE_STEPS.length - 1

  const { draftPickerProps, openSave, openLoad } = useDraftPicker({
    setD, setPhotos, setStep,
    formKey: '360S014EE', formLabel: 'Elec Equipment Record',
    d, step, photos, accent: W_PURPLE,
  })

  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } =
    usePdfGenerate(generateEEPdf)
  const tog = k => v => setD(p => ({ ...p, [k]: p[k] === v ? '' : v }))

  const setRating = (i, field) => v => setD(p => ({
    ...p,
    equipmentRating: p.equipmentRating.map((r, idx) =>
      idx === i ? { ...r, [field]: v } : r
    ),
  }))
  const togRating = (i, field) => v => setD(p => ({
    ...p,
    equipmentRating: p.equipmentRating.map((r, idx) =>
      idx === i ? { ...r, [field]: r[field] === v ? '' : v } : r
    ),
  }))
  const addRatingRow    = () => setD(p =>
    p.equipmentRating.length < 5
      ? { ...p, equipmentRating: [...p.equipmentRating, emptyRatingRow()] }
      : p
  )
  const removeRatingRow = i => setD(p =>
    p.equipmentRating.length > 1
      ? { ...p, equipmentRating: p.equipmentRating.filter((_, idx) => idx !== i) }
      : p
  )

  const setMulti = (i, field) => v => setD(p => ({
    ...p,
    multiItems: p.multiItems.map((r, idx) =>
      idx === i ? { ...r, [field]: v } : r
    ),
  }))
  const togMulti = (i, field) => v => setD(p => ({
    ...p,
    multiItems: p.multiItems.map((r, idx) =>
      idx === i ? { ...r, [field]: r[field] === v ? '' : v } : r
    ),
  }))
  const addMultiRow    = () => setD(p =>
    p.multiItems.length < 15
      ? { ...p, multiItems: [...p.multiItems, emptyMultiRow()] }
      : p
  )
  const removeMultiRow = i => setD(p =>
    p.multiItems.length > 1
      ? { ...p, multiItems: p.multiItems.filter((_, idx) => idx !== i) }
      : p
  )

  const handleShare = () => {
    sharePdf(
      pdfBytes,
      buildPdfFilename(d.projectName, d.npJobNumber, d.newEquipmentId, 'Elec Equipment Record'),
      pdfBlobUrl,
      clearFormDraft,
    )
  }

  const { set, handleDevFill } = useWizardSetup(d, setD, step, '360S014EE')
  const { clearDraft: clearFormDraft } = useDraft('360S014EE', d, step, photos)

  const renderCurrentStep = () => {
    switch (step) {
      case 0: return (
        // 0 — Job Details
        <JobDetailsStep key="0" d={d} setD={setD} accent={W_PURPLE} onOpenDrafts={openLoad} />
      )

      case 1: return (
        // 1 — Equipment Details
        <div key="1">
          <SectionHead label="Equipment IDs" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <WF label="New Powerco Equipment ID" v={d.newEquipmentId}     set={set('newEquipmentId')} />
            <WF label="Old Powerco Equipment ID" v={d.oldEquipmentId}     set={set('oldEquipmentId')} />
          </div>
          <WF label="Location Pole/Site ID" v={d.locationPoleSiteId} set={set('locationPoleSiteId')} />
          <div style={{ height: 1, background: '#eee', margin: '12px 0' }} />
          <SectionHead label="Equipment Make / Model" />
          <WF label="Manufacturer" v={d.manufacturer} set={set('manufacturer')} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <WF label="Model"     v={d.model}    set={set('model')} />
            <WF label="Serial No" v={d.serialNo} set={set('serialNo')} />
          </div>
        </div>
      )

      case 2: return (
        // 2 — Equipment Type
        <div key="2">
          <SectionHead label="Select Equipment Type" />
          <WCB options={EQ_TYPE_OPTIONS} value={d.equipmentType} onChange={tog('equipmentType')} />
          {d.equipmentType === 'Other' && (
            <WF label="Specify type" v={d.equipmentTypeOther} set={set('equipmentTypeOther')}
              ph="Describe equipment type..." />
          )}
        </div>
      )

      case 3: return (
        // 3 — Replacement Details
        <div key="3">
          <SectionHead label="Type of Change" />
          <WCB options={['New', 'Removed', 'Replaced']} value={d.typeOfChange}
            onChange={tog('typeOfChange')} />
          <SectionHead label="Ownership" />
          <WCB options={['Powerco', 'Private', 'Other']} value={d.ownership}
            onChange={tog('ownership')} />
          {d.ownership === 'Other' && (
            <WF label="Specify ownership" v={d.ownershipOther} set={set('ownershipOther')} />
          )}
          {(d.typeOfChange === 'Removed' || d.typeOfChange === 'Replaced') && (
            <>
              <div style={{ height: 1, background: '#eee', margin: '12px 0' }} />
              <WTA label="Reason for Removal" v={d.reasonForRemoval} set={set('reasonForRemoval')}
                rows={3} ph="Describe reason for removal..." />
            </>
          )}
        </div>
      )

      case 4: return (
        // 4 — Equipment Rating
        <div key="4">
          <SectionHead label="Equipment Rating"
            sub="For RMU Switches: fill a row for each switch way" />
          {d.equipmentRating.map((row, i) => (
            <div key={i} style={{
              border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px',
              marginBottom: 10, background: '#fafcff',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: W_PURPLE, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Switch / Way {i + 1}
                </div>
                {d.equipmentRating.length > 1 && (
                  <button onClick={() => removeRatingRow(i)} style={{
                    padding: '2px 8px', border: 'none', background: 'none',
                    cursor: 'pointer', color: '#dc2626', fontSize: 20, lineHeight: 1,
                  }}>×</button>
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
                        fontFamily: 'inherit', fontSize: 14, cursor: 'pointer',
                        fontWeight: sel ? 700 : 400,
                      }}>{s}</button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <WF label="Operating Voltage" v={row.operatingVoltage}
                  set={setRating(i, 'operatingVoltage')} ph="e.g. 11kV" />
                <WF label="Voltage Rating"    v={row.voltageRating}
                  set={setRating(i, 'voltageRating')}    ph="e.g. 11kV" />
                <WF label="Fuse Size"         v={row.fuseSize}
                  set={setRating(i, 'fuseSize')}         ph="e.g. 100A" />
              </div>
            </div>
          ))}
          {d.equipmentRating.length < 5 && (
            <button onClick={addRatingRow} style={{
              width: '100%', padding: 12, borderRadius: 10,
              border: `2px dashed ${W_PURPLE}`,
              background: '#f0f6ff', color: W_PURPLE, fontFamily: 'inherit',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              + Add Switch / Way ({d.equipmentRating.length} / 5)
            </button>
          )}
        </div>
      )

      case 5: return (
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
                      fontFamily: 'inherit', fontSize: 14, cursor: 'pointer',
                      fontWeight: sel ? 700 : 400,
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
                      fontFamily: 'inherit', fontSize: 14, cursor: 'pointer',
                      fontWeight: sel ? 700 : 400,
                    }}>{v}</button>
                  )
                })}
              </div>
            </div>
          </div>
          <WTA label="Comments and Additional Information" v={d.comments} set={set('comments')}
            rows={5} ph="Add any additional comments here..." />
        </div>
      )

      case 6: return (
        // 6 — Multi-Item Details (page 2)
        <div key="6">
          <SectionHead label="Additional Equipment on Site"
            sub="Only needed when more than one item installed / removed" />
          {d.multiItems.map((row, i) => (
            <div key={i} style={{
              border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px',
              marginBottom: 10, background: '#fafcff',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: W_PURPLE, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Item {i + 1}
                </div>
                {d.multiItems.length > 1 && (
                  <button onClick={() => removeMultiRow(i)} style={{
                    padding: '2px 8px', border: 'none', background: 'none',
                    cursor: 'pointer', color: '#dc2626', fontSize: 20, lineHeight: 1,
                  }}>×</button>
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
                        fontFamily: 'inherit', fontSize: 13,
                        fontWeight: sel ? 700 : 400, cursor: 'pointer',
                      }}>{label}</button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <WF label="Equipment ID"      v={row.equipmentId}      set={setMulti(i, 'equipmentId')} />
                <WF label="Equipment Type"    v={row.equipmentType}    set={setMulti(i, 'equipmentType')}
                  ph="e.g. Fused ABS" />
                <WF label="Manufacturer"      v={row.manufacturer}     set={setMulti(i, 'manufacturer')} />
                <WF label="Model"             v={row.model}            set={setMulti(i, 'model')} />
                <WF label="Serial Number"     v={row.serialNumber}     set={setMulti(i, 'serialNumber')} />
                <WF label="Operating Voltage" v={row.operatingVoltage} set={setMulti(i, 'operatingVoltage')}
                  ph="e.g. 11kV" />
                <WF label="Voltage Rating"    v={row.voltageRating}    set={setMulti(i, 'voltageRating')}
                  ph="e.g. 11kV" />
                <WF label="Fuse Size"         v={row.fuseSize}         set={setMulti(i, 'fuseSize')}
                  ph="e.g. 100A" />
              </div>
            </div>
          ))}
          {d.multiItems.length < 15 && (
            <button onClick={addMultiRow} style={{
              width: '100%', padding: 12, borderRadius: 10,
              border: `2px dashed ${W_PURPLE}`,
              background: '#f0f6ff', color: W_PURPLE, fontFamily: 'inherit',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              + Add Another Item ({d.multiItems.length} / 15)
            </button>
          )}
        </div>
      )

      case 7: return (
        // 7 — Photos
        <div key="7">
          <PhotoAttachStep photos={photos} onChange={setPhotos} accent={W_PURPLE} />
        </div>
      )

      case 8: return null

      default: return null
    }
  }

  const missingFields = [
    !d.pcoWONo    && 'PCo W/O No.',
    !d.streetRoad && 'Street/Road',
    !d.contractor && 'Contractor',
    !d.namePrint  && 'Name (Print)',
  ].filter(Boolean)

  const previewContent = buildPreviewContent(() => triggerGenerate(d, photos), W_PURPLE)

  return (
    <>
        <WizardShell
          title="AS-Built Electrical Equipment Record"
          formNumber="360S014EE"
          headerIcon={<FileText size={22} color="#fff" style={{ flexShrink: 0 }} />}
          steps={EE_STEPS}
          step={step}
          onStepClick={setStep}
          onClose={onClose}
          onBack={() => setStep(s => s - 1)}
          onSaveDraft={openSave}
        onFillTestData={handleDevFill}
        calibrationPdfUrl={import.meta.env.DEV ? `${import.meta.env.BASE_URL}forms/360S014EE.pdf` : undefined}
        calibrationPageCount={import.meta.env.DEV ? 2 : undefined}
          onNext={() => {
            const next = step + 1
            setStep(next)
            if (next === EE_STEPS.length - 1) triggerGenerate(d, photos)
          }}
          accent={W_PURPLE}
          bg={EE_BG}
          mid={EE_MID}
          border={EE_BORDER}
          isPreview={isPreview}
          onShare={handleShare}
          onClosePreview={() => { setStep(s => s - 1); clearPdf() }}
          missingFields={missingFields}
          previewContent={previewContent}
        >
          {renderCurrentStep()}
        </WizardShell>
      <DraftPicker {...draftPickerProps} />
    </>
  )
}

export default ElecEquipWizard
