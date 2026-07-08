
import { useState } from 'react'
import { APP_ACCENT, WIZARD_COLORS } from '../shared/constants'
import { Box } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { WF, WTA, WCB, SectionHead } from '../shared/WizardInputs'
import { PhotoAttachStep } from '../shared/PhotoAttachStep'
import { sharePdf, buildPdfFilename } from '../shared/sharePdf'
import { getBaseFormState } from '../shared/userPrefs'
import { JobDetailsStep } from '../shared/JobDetailsStep'
import { usePdfGenerate } from '../shared/usePdfGenerate'
import { useWizardSetup } from '../shared/useWizardSetup'
import { useDraft, useCrashRecovery } from '../shared/useDraft'
import { DraftPicker } from '../shared/DraftPicker'
import { useDraftPicker } from '../shared/useDraftPicker'
import { CrashRecoveryBanner } from '../shared/CrashRecoveryBanner'
import { createWorkerGenerator } from '../shared/pdfWorkerClient'

// ── PDF generation now runs off the main thread via the shared PDF worker ────
const generateEdPdf = createWorkerGenerator('LvBoxPdfGenerator', 'generateEdPdf')

const ED_GREEN  = APP_ACCENT
const ED_BG     = WIZARD_COLORS.bg
const ED_MID    = WIZARD_COLORS.mid
const ED_BORDER = WIZARD_COLORS.border

const ED_STEPS = [
  'Job Details',
  'Box Entries',
  'Comments',
  'Photos',
  'Preview & Print',
]

const EMPTY_BOX_ROW = () => ({
  equipIdNew: '', equipIdOld: '', address: '', manufacturer: '',
  model: '', serviceOrDist: '', numberOfDisconnects: '',
  fuseHolders: '', typeOfChange: '', reasonForRemoval: '', owner: '',
})

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
    <div style={{ background: '#fff', border: `1.5px solid ${ED_BORDER}`, borderRadius: 10, padding: '12px 12px 10px', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: ED_GREEN, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Box Entry {idx + 1}</span>
        {canRemove && (
          <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13, fontWeight: 700, padding: '2px 6px', borderRadius: 6, fontFamily: 'inherit' }}>✕ Remove</button>
        )}
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={lbl}>Service or Distribution Box</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Service', 'Distribution'].map(opt => {
            const sel = row.serviceOrDist === opt
            return (
              <button key={opt} onClick={() => setRow(idx, 'serviceOrDist', sel ? '' : opt)} style={{ padding: '7px 14px', borderRadius: 8, cursor: 'pointer', border: `2px solid ${sel ? ED_GREEN : ED_BORDER}`, background: sel ? ED_GREEN : '#fff', color: sel ? '#fff' : '#333', fontFamily: 'inherit', fontSize: 13, fontWeight: sel ? 700 : 400 }}>{opt}</button>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
        {[...BOX_FIELDS_LEFT, ...BOX_FIELDS_RIGHT].map(([label, key, type]) => (
          <div key={key}>
            <label style={lbl}>{label}</label>
            <input type={type} style={inp} value={row[key]} onChange={e => setRow(idx, key, e.target.value)} placeholder="—" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LvBoxWizard({ onClose }) {
  const [step, setStep]     = useState(0)
  const [d, setD]           = useState(() => getBaseFormState({
    boxRows: [EMPTY_BOX_ROW()],
    comments: '',
  }))
  const [photos, setPhotos] = useState([])

  const isPreview = step === ED_STEPS.length - 1

  const { draftPickerProps, openSave, openLoad } = useDraftPicker({
    setD, setPhotos, setStep,
    formKey: '360S014ED', formLabel: 'LV Box Record',
    d, step, photos, accent: ED_GREEN,
  })

  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } =
    usePdfGenerate(generateEdPdf)

  const setRow = (i, k, v) => setD(prev => {
    const rows = prev.boxRows.map((r, idx) => idx === i ? { ...r, [k]: v } : r)
    return { ...prev, boxRows: rows }
  })
  const handleShare = () => {
    const siteId = d.boxRows?.[0]?.equipIdNew || d.boxRows?.[0]?.equipIdOld || ''
    sharePdf(
      pdfBytes,
      buildPdfFilename(d.projectName, d.npJobNumber, siteId, 'LV Box Record'),
      pdfBlobUrl,
      clearFormDraft,
    )
  }

  const missingFields = [
    !d.pcoWONo     && 'Powerco WO No.',
    !d.streetRoad  && 'No./Street/Road',
    !d.contractor  && 'Contractor',
    !d.signed      && 'Signature',
  ].filter(Boolean)

  const { set, handleDevFill } = useWizardSetup(d, setD, step, '360S014ED')
  const { clearDraft: clearFormDraft } = useDraft('360S014ED', d, step, photos)
  const crashRecovery = useCrashRecovery({ formKey: '360S014ED', setD, setStep, setPhotos, maxStep: ED_STEPS.length - 2 })

  const renderCurrentStep = () => {
    switch (step) {
      case 0: return (
        <JobDetailsStep key="s0" d={d} setD={setD} accent={ED_GREEN} onOpenDrafts={openLoad} />
      )

      case 1: return (
        <div key="s1">
          <SectionHead label="LV Box Entries (up to 20)" accent={ED_GREEN} />
          {d.boxRows.map((row, i) => (
            <BoxRow key={i} row={row} idx={i} setRow={setRow} canRemove={d.boxRows.length > 1}
              onRemove={() => setD(prev => ({ ...prev, boxRows: prev.boxRows.filter((_, ri) => ri !== i) }))} />
          ))}
          {d.boxRows.length < 20 && (
            <button onClick={() => setD(prev => ({ ...prev, boxRows: [...prev.boxRows, EMPTY_BOX_ROW()] }))}
              style={{ width: '100%', padding: '10px 0', marginTop: 2, borderRadius: 8, border: `2px dashed ${ED_GREEN}`, background: ED_BG, color: ED_GREEN, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Add Box Entry
            </button>
          )}
        </div>
      )

      case 2: return (
        <div key="s2">
          <SectionHead label="Additional Comments" accent={ED_GREEN} />
          <WTA label="Comments" v={d.comments} set={v => set('comments', v)} accent={ED_GREEN} rows={5} />
        </div>
      )

      case 3: return (
        <div key="s3">
          <PhotoAttachStep photos={photos} onChange={setPhotos} accent={ED_GREEN} />
        </div>
      )

      case 4: return null

      default: return null
    }
  }

  const previewContent = buildPreviewContent(() => triggerGenerate(d, photos), ED_GREEN)

  return (
    <>
      <CrashRecoveryBanner recovery={crashRecovery} accent={ED_GREEN} />

        <WizardShell
          title="AS-Built LV Box Record"
          formNumber="360S014ED"
          headerIcon={<Box size={20} color="#fff" />}
          steps={ED_STEPS}
          step={step}
          onStepClick={i => { setStep(i); if (i === ED_STEPS.length - 1) triggerGenerate(d, photos) }}
          onClose={onClose}
          onBack={() => setStep(s => s - 1)}
          onSaveDraft={openSave}
        onFillTestData={handleDevFill}
        calibrationPdfUrl={import.meta.env.DEV ? `${import.meta.env.BASE_URL}forms/360S014ED.pdf` : undefined}
        calibrationPageCount={import.meta.env.DEV ? 1 : undefined}
          onNext={() => { const n = step + 1; setStep(n); if (n === ED_STEPS.length - 1) triggerGenerate(d, photos) }}
          accent={ED_GREEN}
          bg={ED_BG}
          mid={ED_MID}
          border={ED_BORDER}
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
