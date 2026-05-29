// 360S014EG — AS-Built Transformer Record
// PDF generation extracted to src/wizards/generators/TransformerPdfGenerator.js
import React, { useState } from 'react'
import { FileText } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { APP_ACCENT, APP_YELLOW } from '../shared/constants'
import { useWizardSetup } from '../shared/useWizardSetup'
import { useDraft } from '../shared/useDraft'
import { DraftPicker } from '../shared/DraftPicker'
import { WF, WTA, WCB, SectionHead } from '../shared/WizardInputs'
import { PhotoAttachStep } from '../shared/PhotoAttachStep'
import { sharePdf } from '../shared/sharePdf'
import { getUserPrefs } from '../shared/userPrefs'
import { JobDetailsStep } from '../shared/JobDetailsStep'
import { usePdfGenerate } from '../shared/usePdfGenerate'
import { generateTransformerPdf } from './generators/TransformerPdfGenerator'

const W_PURPLE = APP_ACCENT
const W_YELLOW = APP_YELLOW

// ── Step colour schemes ───────────────────────────────────────────────────────
const W_GREEN        = '#15803d'
const W_GREEN_BG     = '#f0fdf4'
const W_GREEN_MID    = '#dcfce7'
const W_GREEN_BORDER = '#86efac'
const W_RED          = '#dc2626'
const W_RED_BG       = '#fef2f2'
const W_RED_MID      = '#fee2e2'
const W_RED_BORDER   = '#fca5a5'

const STEP_SCHEME = [
  'neutral','neutral',
  'issued','issued','issued','issued','issued',
  'removed','removed','removed','removed','removed',
  'neutral','neutral','neutral',
]

function schemeColors(scheme) {
  if (scheme === 'issued')  return { bg: W_GREEN_BG,  mid: W_GREEN_MID,  border: W_GREEN_BORDER,  accent: W_GREEN,  label: 'Issued'  }
  if (scheme === 'removed') return { bg: W_RED_BG,    mid: W_RED_MID,    border: W_RED_BORDER,    accent: W_RED,    label: 'Removed' }
  return { bg: '#f4f4f8', mid: '#eee', border: '#ddd', accent: W_PURPLE, label: '' }
}

// ── Step list ─────────────────────────────────────────────────────────────────
const T_STEPS = [
  'Job Details',
  'Site Details',
  'Issued – Voltage & Connection',
  'Issued – Capacity & Phases',
  'Issued – Enclosure & Type',
  'Issued – Make, Model & Test',
  'Issued – Technical',
  'Removed – Voltage & Connection',
  'Removed – Capacity & Phases',
  'Removed – Enclosure & Type',
  'Removed – Make & Model',
  'Removal Details',
  'Comments',
  'Photos',
  'Preview & Print',
]

// ── Option lists ──────────────────────────────────────────────────────────────
const ENC_OPTIONS  = ['Pole Mount','Plastic','Fibreglass','Building','Fenced','Metal Cover','Customer Premise']
const CONN_HV      = ['Bushing','Cable Box','Dead Break','Pitch Box']
const CONN_LV      = ['Bushing','Cable Box','Dead Break','Resin']
const PHASES       = ['Three','One','SWER']
const TX_TYPE      = ['Bearer','Grnd Mount','Hanger','Pedestal']
const REMOVAL_OPTS = [
  'Relocation','Vegetation','Site Dismantled','Reconstruction',
  'Vehicle Accident','End of Life','Capacity Change','Faulty',
  'Adverse Weather','Vandalism',
]

// ── Component ─────────────────────────────────────────────────────────────────
function TransformerWizardApp({ onClose }) {
  const [step, setStep] = useState(0)
  const [draftPickerOpen, setDraftPickerOpen] = useState(false)
  const [draftPickerMode, setDraftPickerMode] = useState('menu')
  const [photos, setPhotos] = useState([])

  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } =
    usePdfGenerate(generateTransformerPdf)

  const {
    contractor: _contractor,
    namePrint:  _namePrint,
    signed:     _signed,
    dateWorkCompleted: _date,
  } = getUserPrefs()

  const [d, setD] = useState({
    streetRoad: '', cityTown: '', district: '',
    contractor: _contractor, namePrint: _namePrint,
    npJobNumber: '', projectName: '',
    pcoWONo: '', ciwrNo: '',
    dateWorkCompleted: _date, signed: _signed,
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
  const scheme    = schemeColors(STEP_SCHEME[step])
  const G         = scheme.accent

  // ── State helpers ─────────────────────────────────────────────────────────
  const tog  = k => v => setD(p => ({ ...p,          [k]: p[k]          === v ? '' : v }))
  const setI = k => v => setD(p => ({ ...p, issued:  { ...p.issued,  [k]: v } }))
  const togI = k => v => setD(p => ({ ...p, issued:  { ...p.issued,  [k]: p.issued[k]  === v ? '' : v } }))
  const setR = k => v => setD(p => ({ ...p, removed: { ...p.removed, [k]: v } }))
  const togR = k => v => setD(p => ({ ...p, removed: { ...p.removed, [k]: p.removed[k] === v ? '' : v } }))
  const togRA = k => v => setD(p => {
    const a = p.removed[k] || []
    return { ...p, removed: { ...p.removed, [k]: a.includes(v) ? a.filter(x => x !== v) : [...a, v] } }
  })

  // ── PDF share ─────────────────────────────────────────────────────────────
  const handleShare = () => {
    const sanitise = s => (s || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim()
    const parts = [
      sanitise(d.projectName),
      sanitise(d.npJobNumber),
      sanitise(d.transformerSiteId),
      'Transformer Record',
    ].filter(Boolean)
    sharePdf(pdfBytes, parts.join(' - ') + '.pdf', pdfBlobUrl, clearFormDraft)
  }

  // ── Shared hooks ──────────────────────────────────────────────────────────
  const { set } = useWizardSetup(d, setD, step, '360S014EG')
  const { clearDraft: clearFormDraft } = useDraft('360S014EG', d, step, photos)

  const handleDraftLoad = draft => {
    const { photos: dp, ...fd } = draft.data || {}
    setD(prev => ({ ...prev, ...fd }))
    if (Array.isArray(draft.photos) && draft.photos.length > 0) setPhotos(draft.photos)
    setStep(draft.step || 0)
  }

  const missingFields = [
    !d.pcoWONo    && 'PCo W/O No.',
    !d.streetRoad && 'Street/Road',
    !d.contractor && 'Contractor',
    !d.namePrint  && 'Name (Print)',
  ].filter(Boolean)

  // ─────────────────────────────────────────────────────────────────────────
  // STEP CONTENT
  // Only the current step is rendered to avoid iOS keyboard-collapse issues.
  // ─────────────────────────────────────────────────────────────────────────
  const renderCurrentStep = () => {
    if (isPreview) return null

    switch (step) {

      // 0 — Job Details
      case 0:
        return (
          <JobDetailsStep d={d} setD={setD} accent={G}
            onOpenDrafts={() => { setDraftPickerMode('list'); setDraftPickerOpen(true) }} />
        )

      // 1 — Site Details
      case 1:
        return (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <WF accent={G} label="Transformer Site ID" v={d.transformerSiteId} set={set('transformerSiteId')} />
              <WF accent={G} label="Pole ID"             v={d.poleId}            set={set('poleId')} />
              <WF accent={G} label="Zone Substation"     v={d.zoneSubstation}    set={set('zoneSubstation')} />
              <WF accent={G} label="Feeder ID"           v={d.feederId}          set={set('feederId')} />
            </div>
            <div style={{ height: 1, background: '#eee', margin: '12px 0' }} />
            <WCB accent={G} label="Installation Type"
              options={['New','Refurbished','Emergency / Stock','Removal Only']}
              value={d.installationType} onChange={tog('installationType')} />
            <WCB accent={G} label="Ownership"
              options={['Powerco','Customer','Other']}
              value={d.ownership} onChange={tog('ownership')} />
            {d.ownership === 'Other' && (
              <WF accent={G} label="Specify Ownership" v={d.ownershipOther} set={set('ownershipOther')} />
            )}
          </div>
        )

      // 2 — Issued: Voltage & Connection
      case 2:
        return (
          <div>
            <SectionHead accent={G} label="Voltage" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <WF accent={G} label="HV" v={d.issued.voltageHV} set={setI('voltageHV')} ph="e.g. 11kV" />
              <WF accent={G} label="LV" v={d.issued.voltageLV} set={setI('voltageLV')} ph="e.g. 400V" />
            </div>
            <SectionHead accent={G} label="HV Connection Type" />
            <WCB accent={G} options={CONN_HV} value={d.issued.connectionTypeHV} onChange={togI('connectionTypeHV')} />
            <SectionHead accent={G} label="LV Connection Type" />
            <WCB accent={G} options={CONN_LV} value={d.issued.connectionTypeLV} onChange={togI('connectionTypeLV')} />
          </div>
        )

      // 3 — Issued: Capacity & Phases
      case 3:
        return (
          <div>
            <SectionHead accent={G} label="Capacity (kVA)" />
            <WF accent={G} ph="kVA" v={d.issued.capacityKVA} set={setI('capacityKVA')} />
            <SectionHead accent={G} label="Phases" />
            <WCB accent={G} options={PHASES} value={d.issued.phases} onChange={togI('phases')} />
            <SectionHead accent={G} label="Serial Number" />
            <WF accent={G} v={d.issued.serialNumber} set={setI('serialNumber')} />
          </div>
        )

      // 4 — Issued: Enclosure & Type
      case 4:
        return (
          <div>
            <SectionHead accent={G} label="Enclosure Type" />
            <WCB accent={G} options={ENC_OPTIONS} value={d.issued.enclosureType} onChange={togI('enclosureType')} />
            <SectionHead accent={G} label="Enclosure Model" />
            <WF accent={G} v={d.issued.enclosureModel} set={setI('enclosureModel')} />
            <SectionHead accent={G} label="Transformer Type" />
            <WCB accent={G} options={TX_TYPE} value={d.issued.transformerType} onChange={togI('transformerType')} />
          </div>
        )

      // 5 — Issued: Make, Model & Volt Test
      case 5:
        return (
          <div>
            <SectionHead accent={G} label="Make" />
            <WF accent={G} v={d.issued.make} set={setI('make')} />
            <SectionHead accent={G} label="Model" />
            <WF accent={G} v={d.issued.model} set={setI('model')} />
            <SectionHead accent={G} label="Volt Test" />
            <WF accent={G} v={d.issued.voltTest} set={setI('voltTest')} ph="e.g. PASS" />
          </div>
        )

      // 6 — Issued: Technical
      case 6:
        return (
          <div>
            <SectionHead accent={G} label="Tap Setting %" />
            <WCB accent={G} options={['-10','-7.5','-5','-2.5','0','+2.5','+5']}
              value={d.issued.tapSetting} onChange={togI('tapSetting')} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <SectionHead accent={G} label="MDI Fitted" />
                <WCB accent={G} options={['YES','NO']} value={d.issued.mdiFitted} onChange={togI('mdiFitted')} />
              </div>
              <WF accent={G} label="CT Ratio" v={d.issued.ctRatio} set={setI('ctRatio')} />
            </div>
            <SectionHead accent={G} label="Earth Test" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <WF accent={G} label="Test 1"    v={d.issued.earthTest1} set={setI('earthTest1')} />
              <WF accent={G} label="Test 2"    v={d.issued.earthTest2} set={setI('earthTest2')} />
              <WF accent={G} label="Total MEN" v={d.issued.totalMEN}   set={setI('totalMEN')} />
            </div>
            <SectionHead accent={G} label="Fuse Size" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <WF accent={G} label="HV" v={d.issued.fuseSizeHV} set={setI('fuseSizeHV')} />
              <WF accent={G} label="LV" v={d.issued.fuseSizeLV} set={setI('fuseSizeLV')} />
            </div>
            <SectionHead accent={G} label="LV Disconnector" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <WF accent={G} label="Make"  v={d.issued.lvDisconnectorMake}  set={setI('lvDisconnectorMake')} />
              <WF accent={G} label="Model" v={d.issued.lvDisconnectorModel} set={setI('lvDisconnectorModel')} />
            </div>
          </div>
        )

      // 7 — Removed: Voltage & Connection
      case 7:
        return (
          <div>
            <SectionHead accent={G} label="Voltage" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <WF accent={G} label="HV" v={d.removed.voltageHV} set={setR('voltageHV')} ph="e.g. 11kV" />
              <WF accent={G} label="LV" v={d.removed.voltageLV} set={setR('voltageLV')} ph="e.g. 400V" />
            </div>
            <SectionHead accent={G} label="HV Connection Type" />
            <WCB accent={G} options={CONN_HV} value={d.removed.connectionTypeHV} onChange={togR('connectionTypeHV')} />
            <SectionHead accent={G} label="LV Connection Type" />
            <WCB accent={G} options={CONN_LV} value={d.removed.connectionTypeLV} onChange={togR('connectionTypeLV')} />
          </div>
        )

      // 8 — Removed: Capacity & Phases
      case 8:
        return (
          <div>
            <SectionHead accent={G} label="Capacity (kVA)" />
            <WF accent={G} ph="kVA" v={d.removed.capacityKVA} set={setR('capacityKVA')} />
            <SectionHead accent={G} label="Phases" />
            <WCB accent={G} options={PHASES} value={d.removed.phases} onChange={togR('phases')} />
            <SectionHead accent={G} label="Serial Number" />
            <WF accent={G} v={d.removed.serialNumber} set={setR('serialNumber')} />
          </div>
        )

      // 9 — Removed: Enclosure & Type
      case 9:
        return (
          <div>
            <SectionHead accent={G} label="Enclosure Type" />
            <WCB accent={G} options={ENC_OPTIONS} value={d.removed.enclosureType} onChange={togR('enclosureType')} />
            <SectionHead accent={G} label="Enclosure Model" />
            <WF accent={G} v={d.removed.enclosureModel} set={setR('enclosureModel')} />
            <SectionHead accent={G} label="Transformer Type" />
            <WCB accent={G} options={TX_TYPE} value={d.removed.transformerType} onChange={togR('transformerType')} />
          </div>
        )

      // 10 — Removed: Make & Model
      case 10:
        return (
          <div>
            <SectionHead accent={G} label="Make" />
            <WF accent={G} v={d.removed.make} set={setR('make')} />
            <SectionHead accent={G} label="Model" />
            <WF accent={G} v={d.removed.model} set={setR('model')} />
          </div>
        )

      // 11 — Removal Details
      case 11:
        return (
          <div>
            <SectionHead accent={G} label="Reason for Removal" />
            <WCB accent={G} multi options={REMOVAL_OPTS}
              value={d.removed.reasonForRemoval} onChange={togRA('reasonForRemoval')} />
            <SectionHead accent={G} label="Removed to Store" />
            <WF accent={G} ph="Stipulate location" v={d.removedToStore} set={set('removedToStore')} />
          </div>
        )

      // 12 — Comments
      case 12:
        return (
          <div>
            <WTA label="Comments" v={d.comments} set={set('comments')} rows={6}
              ph="Add any additional comments here..." accent={G} />
            <div style={{ background: '#f0ebff', border: `1px solid ${W_PURPLE}`, borderRadius: 10, padding: '12px 14px', marginTop: 6 }}>
              <p style={{ margin: 0, fontSize: 13, color: W_PURPLE, fontWeight: 600 }}>
                ✓ All sections complete — add photos on the next step, then preview your PDF.
              </p>
            </div>
          </div>
        )

      // 13 — Photos
      case 13:
        return <PhotoAttachStep photos={photos} onChange={setPhotos} accent={W_PURPLE} />

      default:
        return null
    }
  }

  const previewContent = buildPreviewContent(() => triggerGenerate(d, photos), scheme.accent)

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
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
        onSaveDraft={() => { setDraftPickerMode('save'); setDraftPickerOpen(true) }}
        onNext={() => {
          const next = step + 1
          setStep(next)
          if (next === T_STEPS.length - 1) triggerGenerate(d, photos)
        }}
        accent={scheme.accent}
        bg={scheme.bg}
        mid={scheme.mid}
        border={scheme.border}
        progressColor={
          STEP_SCHEME[step] === 'issued'  ? W_GREEN :
          STEP_SCHEME[step] === 'removed' ? W_RED   : W_YELLOW
        }
        getDotColor={i => {
          const s = STEP_SCHEME[i]
          return s === 'issued' ? W_GREEN : s === 'removed' ? W_RED : W_PURPLE
        }}
        isPreview={isPreview}
        onShare={handleShare}
        onClosePreview={() => { setStep(s => s - 1); clearPdf() }}
        missingFields={missingFields}
        previewContent={previewContent}
      >
        {renderCurrentStep()}
      </WizardShell>

      <DraftPicker
        open={draftPickerOpen}
        onClose={() => setDraftPickerOpen(false)}
        formKey="360S014EG"
        formLabel="Transformer Record"
        d={d}
        step={step}
        photos={photos}
        onLoad={handleDraftLoad}
        accent={G}
        initialMode={draftPickerMode}
      />
    </>
  )
}

export default TransformerWizardApp
