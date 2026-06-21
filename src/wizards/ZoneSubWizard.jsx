
// 360S014EF — AS-Built Zone Substation Equipment Record
import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { WF, WTA, WCB, SectionHead } from '../shared/WizardInputs'
import { PhotoAttachStep } from '../shared/PhotoAttachStep'
import { sharePdf, buildPdfFilename } from '../shared/sharePdf'
import { getBaseFormState } from '../shared/userPrefs'
import { JobDetailsStep } from '../shared/JobDetailsStep'
import { usePdfGenerate } from '../shared/usePdfGenerate'
import { useWizardSetup } from '../shared/useWizardSetup'
import { useDraft } from '../shared/useDraft'
import { DraftPicker } from '../shared/DraftPicker'
import { useDraftPicker } from '../shared/useDraftPicker'
import { APP_ACCENT, WIZARD_COLORS } from '../shared/constants'

// ── Lazy generator import ─────────────────────────────────────────────────────
const loadEfGenerator = () =>
  import('./generators/ZoneSubPdfGenerator').then(m => m.generateEfPdf)

const ACCENT    = APP_ACCENT
const EF_BG     = WIZARD_COLORS.bg
const EF_MID    = WIZARD_COLORS.mid
const EF_BORDER = WIZARD_COLORS.border

const EF_STEPS = [
  'Job Details',
  'Maintenance / Modification',
  'New / Replacement',
  'Additional Equipment',
  'Photos',
  'Preview & Print',
]

const emptyRow = () => ({
  installedOrRemoved: '',
  equipmentId: '',
  serialNo: '',
  manufacturerModel: '',
  description: '',
  drawingRef: '',
})

function ZoneSubWizard({ onClose }) {
  const [step, setStep]     = useState(0)
  const [d, setD]           = useState(() => getBaseFormState({
    substation: '',
    contractorJobCostCode: '',
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
  }))
  const [photos, setPhotos] = useState([])

  const isPreview = step === EF_STEPS.length - 1

  const { draftPickerProps, openSave, openLoad } = useDraftPicker({
    setD, setPhotos, setStep,
    formKey: '360S014EF', formLabel: 'Zone Sub Equipment Record',
    d, step, photos, accent: ACCENT,
  })

  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } =
    usePdfGenerate(loadEfGenerator)

  const setRow = (i, field, val) => setD(p => {
    const items = [...p.additionalItems]
    items[i] = { ...items[i], [field]: val }
    return { ...p, additionalItems: items }
  })

  const handleShare = () => {
    sharePdf(
      pdfBytes,
      buildPdfFilename(d.projectName, d.npJobNumber, d.substation, 'Zone Sub Equipment Record'),
      pdfBlobUrl,
      clearFormDraft,
    )
  }

  const missingFields = [
    !d.pcoWONo    && 'PCo W/O No.',
    !d.streetRoad && 'No./Street/Road',
    !d.contractor && 'Contractor',
    !d.namePrint  && 'Name (Print)',
    !d.maintenanceApplies && !d.replacementApplies && 'Select at least one work type',
  ].filter(Boolean)

  const { set, handleDevFill } = useWizardSetup(d, setD, step, '360S014EF')
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

  const renderCurrentStep = () => {
    switch (step) {
      case 0: return (
        // 0 — Job Details
        <JobDetailsStep key="s0" d={d} setD={setD} accent={ACCENT} onOpenDrafts={openLoad}
          topChildren={<>
            <WF label="Substation" v={d.substation} set={v => set('substation', v)} accent={ACCENT} />
            <WF label="Contractor Job Cost Code" v={d.contractorJobCostCode} set={v => set('contractorJobCostCode', v)} accent={ACCENT} />
          </>}
        />
      )

      case 1: return (
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
        </div>
      )

      case 2: return (
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
        </div>
      )

      case 3: return (
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
        </div>
      )

      case 4: return (
        // 4 — Photos
        <div key="s4">
          <PhotoAttachStep photos={photos} onChange={setPhotos} accent={ACCENT} />
        </div>
      )

      case 5: return null

      default: return null
    }
  }

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
        onSaveDraft={openSave}
        onFillTestData={handleDevFill}
        calibrationPdfUrl={import.meta.env.DEV ? `${import.meta.env.BASE_URL}forms/360S014EF.pdf` : undefined}
        calibrationPageCount={import.meta.env.DEV ? 2 : undefined}
        onNext={() => {
          const next = step + 1
          setStep(next)
          if (next === EF_STEPS.length - 1) triggerGenerate(d, photos)
        }}
        accent={ACCENT}
        bg={EF_BG}
        mid={EF_MID}
        border={EF_BORDER}
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

export default ZoneSubWizard

