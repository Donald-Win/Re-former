
import { useState } from 'react'
import { APP_ACCENT, WIZARD_COLORS } from '../shared/constants'
import { Zap } from 'lucide-react'
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
import { createWorkerGenerator } from '../shared/pdfWorkerClient'

// ── PDF generation now runs off the main thread via the shared PDF worker ────
const generateEbPdf = createWorkerGenerator('ElecDistributionPdfGenerator', 'generateEbPdf')

const EB_ORANGE = APP_ACCENT
const EB_BG     = WIZARD_COLORS.bg
const EB_MID    = WIZARD_COLORS.mid
const EB_BORDER = WIZARD_COLORS.border

const EB_STEPS = [
  'Job Details',
  'Distribution Main',
  'Underground Details',
  'Comments & Plan',
  'Photos',
  'Preview & Print',
]

const EMPTY_ROW = () => ({
  voltage: '', phase: '', cableSize: '', material: '',
  insulation: '', numberOfCables: '', numberOfCores: '', circuitLength: '',
})

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
    <div style={{ background: '#fff', border: `1.5px solid ${EB_BORDER}`, borderRadius: 10, padding: '12px 12px 8px', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: EB_ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Circuit {idx + 1}</span>
        {canRemove && (
          <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, fontWeight: 700, padding: '2px 6px', borderRadius: 6, fontFamily: 'inherit' }}>✕ Remove</button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
        {CABLE_FIELDS.map(([label, key, type]) => (
          <div key={key}>
            <label style={lbl}>{label}</label>
            <input type={type} style={inp} value={row[key]} onChange={e => setRow(idx, key, e.target.value)} placeholder="—" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ElecDistributionWizard({ onClose }) {
  const [step, setStep]           = useState(0)
  const [d, setD]                 = useState(() => getBaseFormState({
    distributionMain: '', undergroundCableDepth: '',
    cableRows: [EMPTY_ROW()],
    ownership: '', ownershipOther: '',
    cableDuctUsed: '', cableDuctType: '', capped: '',
    numberOfDucts: '', ductSize: '', drawWire: '',
    otherServicesInTrench: [], otherServicesOther: '',
    gpsRequired: '', gpsFiles: '',
    comments: '',
  }))
  const [photos, setPhotos]       = useState([])

  const isPreview = step === EB_STEPS.length - 1

  const { draftPickerProps, openSave, openLoad } = useDraftPicker({
    setD, setPhotos, setStep,
    formKey: '360S014EB', formLabel: 'Elec Distribution Record',
    d, step, photos, accent: EB_ORANGE,
  })

  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } =
    usePdfGenerate(generateEbPdf)

  const setRow = (i, k, v) => setD(prev => {
    const rows = prev.cableRows.map((r, idx) => idx === i ? { ...r, [k]: v } : r)
    return { ...prev, cableRows: rows }
  })
  const handleShare = () => {
    sharePdf(
      pdfBytes,
      buildPdfFilename(d.projectName, d.npJobNumber, d.streetRoad, 'Elec Distribution Record'),
      pdfBlobUrl,
      clearFormDraft,
    )
  }

  const missingFields = [
    !d.pcoWONo          && 'PCo W/O No.',
    !d.streetRoad       && 'No./Street/Road',
    !d.contractor       && 'Contractor',
    !d.distributionMain && 'Distribution Main',
    !d.signed           && 'Signature',
  ].filter(Boolean)

  const { set, handleDevFill } = useWizardSetup(d, setD, step, '360S014EB')
  const { clearDraft: clearFormDraft } = useDraft('360S014EB', d, step, photos)

  const renderCurrentStep = () => {
    switch (step) {
      case 0: return (
        // 0 — Job Details
        <JobDetailsStep key="s0" d={d} setD={setD} accent={EB_ORANGE} onOpenDrafts={openLoad} />
      )

      case 1: return (
        // 1 — Distribution Main
        <div key="s1">
          <SectionHead label="Distribution Connection Details" accent={EB_ORANGE} />
          <WCB label="Distribution Main" options={['Overhead', 'Underground']} value={d.distributionMain} onChange={v => set('distributionMain', v)} accent={EB_ORANGE} />
          {d.distributionMain === 'Underground' && (
            <div style={{ marginTop: 10 }}>
              <WF label="Underground Cable Depth (mm)" type="number" v={d.undergroundCableDepth} set={v => set('undergroundCableDepth', v)} accent={EB_ORANGE} />
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <SectionHead label="Cable Details" accent={EB_ORANGE} />
            {d.cableRows.map((row, i) => (
              <CableRow key={i} row={row} idx={i} setRow={setRow} canRemove={d.cableRows.length > 1}
                onRemove={() => setD(prev => ({ ...prev, cableRows: prev.cableRows.filter((_, ri) => ri !== i) }))} />
            ))}
            {d.cableRows.length < 3 && (
              <button onClick={() => setD(prev => ({ ...prev, cableRows: [...prev.cableRows, EMPTY_ROW()] }))}
                style={{ width: '100%', padding: '10px 0', marginTop: 2, borderRadius: 8, border: `2px dashed ${EB_ORANGE}`, background: EB_BG, color: EB_ORANGE, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                + Add Circuit
              </button>
            )}
          </div>
          <div style={{ marginTop: 16 }}>
            <WCB label="Ownership" options={['Powerco', 'Customer', 'Other']} value={d.ownership} onChange={v => set('ownership', v)} accent={EB_ORANGE} />
            {d.ownership === 'Other' && (
              <div style={{ marginTop: 10 }}>
                <WF label="Other — specify" v={d.ownershipOther} set={v => set('ownershipOther', v)} accent={EB_ORANGE} />
              </div>
            )}
          </div>
        </div>
      )

      case 2: return (
        // 2 — Underground Details
        <div key="s2">
          {d.distributionMain !== 'Underground' ? (
            <div style={{ background: EB_BG, border: `1px solid ${EB_BORDER}`, borderRadius: 10, padding: '20px 18px', textAlign: 'center', color: '#9a3412', fontSize: 14, lineHeight: 1.6 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🏗️</div>
              <strong>Underground Details — not applicable</strong>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: '#c2410c' }}>This section only applies to underground distribution. You selected <strong>{d.distributionMain || 'no type'}</strong> on the previous step.</p>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9a3412' }}>Tap <strong>Next →</strong> to continue.</p>
            </div>
          ) : (
            <>
              <SectionHead label="Underground Distribution Cable" accent={EB_ORANGE} />
              <WCB label="Cable Duct Used" options={['Yes', 'No']} value={d.cableDuctUsed} onChange={v => set('cableDuctUsed', v)} accent={EB_ORANGE} />
              {d.cableDuctUsed === 'Yes' && (
                <div style={{ marginTop: 12, padding: '12px 14px', background: '#fff', border: `1px solid ${EB_BORDER}`, borderRadius: 8 }}>
                  <WCB label="Duct Type" options={['New', 'Existing']} value={d.cableDuctType} onChange={v => set('cableDuctType', v)} accent={EB_ORANGE} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', marginTop: 12 }}>
                    <WF label="No. of Ducts" type="number" v={d.numberOfDucts} set={v => set('numberOfDucts', v)} accent={EB_ORANGE} />
                    <WF label="Size (mm)"    type="number" v={d.ductSize}      set={v => set('ductSize',      v)} accent={EB_ORANGE} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', marginTop: 10 }}>
                    <WCB label="Capped"    options={['Yes', 'No']} value={d.capped}   onChange={v => set('capped',   v)} accent={EB_ORANGE} />
                    <WCB label="Draw Wire" options={['Yes', 'No']} value={d.drawWire} onChange={v => set('drawWire', v)} accent={EB_ORANGE} />
                  </div>
                </div>
              )}
              <div style={{ marginTop: 14 }}>
                <WCB label="Other Services in Trench" options={['Gas', 'Telecom', 'Water', 'Other']} value={d.otherServicesInTrench}
                  onChange={v => { const cur = d.otherServicesInTrench; set('otherServicesInTrench', cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]) }}
                  multi accent={EB_ORANGE} />
                {d.otherServicesInTrench.includes('Other') && (
                  <div style={{ marginTop: 10 }}>
                    <WF label="Other service — specify" v={d.otherServicesOther} set={v => set('otherServicesOther', v)} accent={EB_ORANGE} />
                  </div>
                )}
              </div>
              <div style={{ marginTop: 14 }}>
                <WCB label="GPS Location Required" options={['Yes', 'No']} value={d.gpsRequired} onChange={v => set('gpsRequired', v)} accent={EB_ORANGE} />
                {d.gpsRequired === 'Yes' && (
                  <div style={{ marginTop: 10 }}>
                    <WF label="GPS Files" v={d.gpsFiles} set={v => set('gpsFiles', v)} accent={EB_ORANGE} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )

      case 3: return (
        // 3 — Comments & Plan
        <div key="s3">
          <SectionHead label="Dimensioned Plan" accent={EB_ORANGE} />
          <div style={{ background: EB_BG, border: `1px solid ${EB_BORDER}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#9a3412', lineHeight: 1.5 }}>
            <strong>📐 Location plan:</strong> Draw the dimensioned plan manually on the printed form.
          </div>
          <SectionHead label="Comments" accent={EB_ORANGE} />
          <WTA label="Comments (e.g. boundary unknown etc.)" v={d.comments} set={v => set('comments', v)} accent={EB_ORANGE} rows={4} />
        </div>
      )

      case 4: return (
        // 4 — Photos
        <div key="s4">
          <PhotoAttachStep photos={photos} onChange={setPhotos} accent={EB_ORANGE} />
        </div>
      )

      case 5: return null

      default: return null
    }
  }

  const previewContent = buildPreviewContent(() => triggerGenerate(d, photos), EB_ORANGE)

  return (
    <>
        <WizardShell
          title="AS-Built Elec. Distribution"
          formNumber="360S014EB"
          headerIcon={<Zap size={20} color="#fff" />}
          steps={EB_STEPS}
          step={step}
          onStepClick={i => { setStep(i); if (i === EB_STEPS.length - 1) triggerGenerate(d, photos) }}
          onClose={onClose}
          onBack={() => setStep(s => s - 1)}
          onSaveDraft={openSave}
        onFillTestData={handleDevFill}
        calibrationPdfUrl={import.meta.env.DEV ? `${import.meta.env.BASE_URL}forms/360S014EB.pdf` : undefined}
        calibrationPageCount={import.meta.env.DEV ? 1 : undefined}
          onNext={() => { const n = step + 1; setStep(n); if (n === EB_STEPS.length - 1) triggerGenerate(d, photos) }}
          accent={EB_ORANGE}
          bg={EB_BG}
          mid={EB_MID}
          border={EB_BORDER}
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
