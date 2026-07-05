
// 360S014EC — AS-Built Pole Record
import React, { useState, useRef } from 'react'
import { PenLine } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { APP_ACCENT, APP_YELLOW, WIZARD_COLORS } from '../shared/constants'
import { useWizardSetup } from '../shared/useWizardSetup'
import { useDraft } from '../shared/useDraft'
import { DraftPicker } from '../shared/DraftPicker'
import { useDraftPicker } from '../shared/useDraftPicker'
import { wInp, wLbl, WF, WTA, WCB } from '../shared/WizardInputs'
import { PhotoAttachStep } from '../shared/PhotoAttachStep'
import { GpsCoordButton } from '../shared/GpsCoordButton'
import { sharePdf, buildPdfFilename } from '../shared/sharePdf'
import { getBaseFormState } from '../shared/userPrefs'
import { JobDetailsStep } from '../shared/JobDetailsStep'
import { usePdfGenerate } from '../shared/usePdfGenerate'

// ── Lazy generator import ─────────────────────────────────────────────────────
const loadPoleGenerator = () =>
  import('./generators/PolePdfGenerator').then(m => m.generatePolePdf)

const W_PURPLE = APP_ACCENT
const W_YELLOW = APP_YELLOW

const W_STEPS = [
  'Location & Contractor',
  'Pole IDs & Activity',
  'New Pole Details',
  'Equipment on Pole',
  'Accessories',
  'Conductors',
  'Crossarms',
  'Work Description',
  'Photos',
  'Preview & Print',
]

// ── Static reference data ─────────────────────────────────────────────────────

const POLE_CODES = [
  'B9.5 (Busck)',   'B10.0 (Busck)',  'B10.5 (Busck)',  'B11.0 (Busck)',
  'B12.4 (Busck)',  'B12.5 (Busck)',  'B13.65 (Busck)', 'B14.85 (Busck)',
  'B15.5 (Busck)',  'B18.5 (Busck)',
  '9m (9kN) Goldpine',   '10m (9kN) Goldpine',
  '10m (12kN) Goldpine', '11m (9kN) Goldpine',
  '11m (12kN) Goldpine', '12m (12kN) Goldpine',
]

const POLE_TYPES = [
  '1 Pole', '1 \u00BD Pole', '2 Pole', '3 Pole',
  '4 Pole', 'H Pole', 'Double', 'Stay Pole',
]

const CU_SIZES = [
  '10mm²','16mm²','25mm²','35mm²','50mm²',
  '70mm²','95mm²','120mm²','150mm²','185mm²','240mm²',
]

const ALI_COMMON = ['Namu','Squirrel','Ferret','Flourine','Kutu','Iodine','Wasp']
const ALI_ALL = [
  {name:'Argon',type:'AAAC'},{name:'Bee',type:'AAC'},{name:'Beetle',type:'AAC'},
  {name:'Boron',type:'AAAC'},{name:'Butterfly',type:'AAC'},{name:'Caterpillar',type:'AAC'},
  {name:'Centipede',type:'AAC'},{name:'Chafer',type:'AAC'},{name:'Chlorine',type:'AAAC'},
  {name:'Chromium',type:'AAAC'},{name:'Cockroach',type:'AAC'},{name:'Coyote',type:'ACSR'},
  {name:'Cricket',type:'AAC'},{name:'Dingo',type:'ACSR'},{name:'Dog',type:'ACSR'},
  {name:'Ferret',type:'ACSR'},{name:'Flourine',type:'AAAC'},{name:'Fly',type:'AAC'},
  {name:'Fox',type:'ACSR'},{name:'Gnat',type:'AAC'},{name:'Gopher',type:'ACSR'},
  {name:'Grasshopper',type:'AAC'},{name:'Hare',type:'ACSR'},{name:'Helium',type:'AAAC'},
  {name:'Hornet',type:'AAC'},{name:'Huhu',type:'AAC'},{name:'Hydrogen',type:'AAAC'},
  {name:'Hyena',type:'ACSR'},{name:'Iodine',type:'AAAC'},{name:'Jaguar',type:'ACSR'},
  {name:'Krypton',type:'AAAC'},{name:'Kutu',type:'AAC'},{name:'Ladybird',type:'AAC'},
  {name:'Lutelium',type:'AAAC'},{name:'Magpie',type:'ACSR'},{name:'Mata',type:'AAC'},
  {name:'Mink',type:'ACSR'},{name:'Moa',type:'ACSR'},{name:'Moka',type:'AAC'},
  {name:'Namu',type:'AAC'},{name:'Neon',type:'AAAC'},{name:'Nitrogen',type:'AAAC'},
  {name:'Nobelium',type:'AAAC'},{name:'Oxygen',type:'AAAC'},{name:'Petrel',type:'ACSR'},
  {name:'Phosphorus',type:'AAAC'},{name:'Poko',type:'AAC'},{name:'Rabbit',type:'ACSR'},
  {name:'Raccoon',type:'ACSR'},{name:'Rango',type:'AAC'},{name:'Selenium',type:'AAAC'},
  {name:'Silicon',type:'AAAC'},{name:'Spider',type:'AAC'},{name:'Squirrel',type:'ACSR'},
  {name:'Sulphur',type:'AAAC'},{name:'Swan',type:'ACSR'},{name:'Tiger',type:'ACSR'},
  {name:'Wasp',type:'AAC'},{name:'Waxwing',type:'ACSR'},{name:'Weke',type:'AAC'},
  {name:'Weta',type:'AAC'},{name:'Wolf',type:'ACSR'},{name:'Xenon',type:'AAAC'},
  {name:'Zebra',type:'ACSR'},
]
const ALI_COMMON_ITEMS = ALI_COMMON.map(n => ALI_ALL.find(c => c.name === n)).filter(Boolean)
const ALI_REST         = ALI_ALL.filter(c => !ALI_COMMON.includes(c.name))

// ── Small shared input sub-components ────────────────────────────────────────

const SEL_STYLE = {
  ...wInp,
  appearance: 'none', WebkitAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23666' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 28,
}

function WSel({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={wLbl}>{label}</label>
      <select value={value || ''} onChange={e => onChange(e.target.value)} style={SEL_STYLE}>
        <option value="">—</option>
        {options.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
      </select>
    </div>
  )
}

// ── DateBoxInput — DD-MM-YY split boxes ───────────────────────────────────────

function DateBoxInput({ label, value, onChange }) {
  const ddRef = useRef(null)
  const mmRef = useRef(null)
  const yyRef = useRef(null)
  const parts = value ? value.split('-') : ['', '', '']
  const [dd, mm, yy] = parts

  const update = (newDd, newMm, newYy) => {
    const out = [newDd, newMm, newYy].every(v => v === '') ? '' : `${newDd}-${newMm}-${newYy}`
    onChange(out)
  }

  const boxStyle = {
    width: 52, padding: '10px 0', textAlign: 'center', fontSize: 18, fontWeight: 600,
    border: '1.5px solid #ddd', borderRadius: 8, fontFamily: 'inherit',
    background: '#fff', outline: 'none', boxSizing: 'border-box',
  }
  const sepStyle = { fontSize: 20, fontWeight: 700, color: '#aaa', padding: '0 2px', lineHeight: '44px' }

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={wLbl}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input ref={ddRef} type="text" inputMode="numeric" placeholder="DD" maxLength={2} value={dd}
          onChange={e => { const v = e.target.value.replace(/\D/g,'').slice(0,2); update(v,mm,yy); if (v.length===2) mmRef.current?.focus() }}
          style={boxStyle} />
        <span style={sepStyle}>-</span>
        <input ref={mmRef} type="text" inputMode="numeric" placeholder="MM" maxLength={2} value={mm}
          onChange={e => { const v = e.target.value.replace(/\D/g,'').slice(0,2); update(dd,v,yy); if (v.length===2) yyRef.current?.focus() }}
          onKeyDown={e => { if (e.key==='Backspace'&&mm==='') ddRef.current?.focus() }}
          style={boxStyle} />
        <span style={sepStyle}>-</span>
        <input ref={yyRef} type="text" inputMode="numeric" placeholder="YY" maxLength={2} value={yy}
          onChange={e => { const v = e.target.value.replace(/\D/g,'').slice(0,2); update(dd,mm,v) }}
          onKeyDown={e => { if (e.key==='Backspace'&&yy==='') mmRef.current?.focus() }}
          style={boxStyle} />
      </div>
    </div>
  )
}

// ── ConductorPicker ───────────────────────────────────────────────────────────

function ConductorPicker({ c, i, setCond, setMultiCond }) {
  const picker = c.picker || (c.size || c.material ? 'manual' : null)
  const accent = W_PURPLE

  const pathBtn = (label, active, onClick, color = accent) => (
    <button type="button" onClick={onClick} style={{
      flex: 1, padding: '8px 4px', borderRadius: 7, fontFamily: 'inherit', fontSize: 13,
      fontWeight: 700, cursor: 'pointer',
      border: `2px solid ${active ? color : '#ddd'}`,
      background: active ? color : '#fff',
      color: active ? '#fff' : '#555',
    }}>{label}</button>
  )

  const insBtn = (label, onClick) => (
    <button type="button" onClick={onClick} style={{
      flex: 1, padding: '8px 4px', borderRadius: 7, fontFamily: 'inherit', fontSize: 13,
      fontWeight: 700, cursor: 'pointer',
      border: `2px solid ${accent}`,
      background: '#fff', color: accent,
    }}>{label}</button>
  )

  const summary = c.size && c.material && c.insulation ? (
    <div style={{
      background: '#eef2ff', border: `1px solid ${accent}`, borderRadius: 7,
      padding: '6px 10px', marginBottom: 8, fontSize: 13, fontWeight: 600, color: accent,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span>{c.size} · {c.material} · {c.insulation}</span>
      <button type="button"
        onClick={() => setMultiCond(i, { size: '', material: '', insulation: '', picker: null })}
        style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}>
        ↺
      </button>
    </div>
  ) : null

  const pathRow = (active) => (
    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
      {pathBtn('Cu',     active==='cu',     () => setMultiCond(i, { size:'', material:'', insulation:'', picker:'cu'     }), '#b45309')}
      {pathBtn('Ali',    active==='ali',    () => setMultiCond(i, { size:'', material:'', insulation:'', picker:'ali'    }), '#0369a1')}
      {pathBtn('Manual', active==='manual', () => setMultiCond(i, { size:'', material:'', insulation:'', picker:'manual' }), '#6b7280')}
    </div>
  )

  if (!picker) return (
    <div>
      {summary}
      <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>Select conductor type</div>
      {pathRow(null)}
    </div>
  )

  if (picker === 'cu') return (
    <div>
      {summary}
      {pathRow('cu')}
      {!c.size && (
        <>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>Select size</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {CU_SIZES.map(s => (
              <button key={s} type="button"
                onClick={() => setMultiCond(i, { size: s, material: 'HDCu' })}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1.5px solid #d97706',
                  background: '#fffbeb', color: '#92400e', fontFamily: 'inherit', fontSize: 12,
                  fontWeight: 600, cursor: 'pointer' }}>{s}</button>
            ))}
          </div>
        </>
      )}
      {c.size && !c.insulation && (
        <>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>Insulation — {c.size} HDCu</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {insBtn('Bare', () => setCond(i, 'insulation', 'Bare'))}
            {insBtn('PVC',  () => setCond(i, 'insulation', 'PVC'))}
          </div>
        </>
      )}
    </div>
  )

  if (picker === 'ali') return (
    <div>
      {summary}
      {pathRow('ali')}
      {!c.size && (
        <>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>Common</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {ALI_COMMON_ITEMS.map(cd => (
              <button key={cd.name} type="button"
                onClick={() => setMultiCond(i, { size: cd.name, material: cd.type })}
                style={{ padding: '6px 10px', borderRadius: 6, border: '2px solid #0369a1',
                  background: '#0369a1', color: '#fff', fontFamily: 'inherit',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{cd.name}</button>
            ))}
          </div>
          <div style={{ height: 1, background: '#e5e7eb', marginBottom: 8 }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
            {ALI_REST.map(cd => (
              <button key={cd.name} type="button"
                onClick={() => setMultiCond(i, { size: cd.name, material: cd.type })}
                style={{ padding: '5px 9px', borderRadius: 6, border: '1.5px solid #bae6fd',
                  background: '#f0f9ff', color: '#075985', fontFamily: 'inherit',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{cd.name}</button>
            ))}
          </div>
        </>
      )}
      {c.size && !c.insulation && (
        <>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>Insulation — {c.size} ({c.material})</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {insBtn('Bare', () => setCond(i, 'insulation', 'Bare'))}
            {insBtn('PVC',  () => setCond(i, 'insulation', 'PVC'))}
          </div>
        </>
      )}
    </div>
  )

  return (
    <div>
      {summary}
      {pathRow('manual')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <WF label="Size"     v={c.size}     set={v => setCond(i, 'size', v)}     ph="e.g. 95mm²" />
        <WF label="Material" v={c.material} set={v => setCond(i, 'material', v)} ph="e.g. ACSR" />
      </div>
      <WF label="Insulation" v={c.insulation} set={v => setCond(i, 'insulation', v)} ph="e.g. Bare, PVC, XLPE" />
    </div>
  )
}

// ── Wizard component ──────────────────────────────────────────────────────────

function PoleRecordWizard({ onClose }) {
  const [step, setStep]     = useState(0)
  const [d, setD]           = useState(() => getBaseFormState({
    conductors: [{ level: '1', existing: '', size: '', material: '', insulation: '', picker: null }],
    crossarms:  [{ level: '1', existing: '', voltage: '', endSize: '', length: '', arms: '', insulatorType: '', armMaterial: '', wires: '' }],
    accessories: [],
  }))
  const [photos, setPhotos] = useState([])

  const { pdfBytes, pdfBlobUrl, triggerGenerate, clearPdf, buildPreviewContent } =
    usePdfGenerate(loadPoleGenerator)

  const isPreview = step === W_STEPS.length - 1

  const { draftPickerProps, openSave, openLoad } = useDraftPicker({
    setD, setPhotos, setStep,
    formKey: '360S014EC', formLabel: 'Pole Record',
    d, step, photos, accent: W_PURPLE,
  })

  // ── State helpers ─────────────────────────────────────────────────────────

  const tog = k => v => setD(p => ({ ...p, [k]: p[k] === v ? '' : v }))

  const togAcc = v => setD(p => {
    const a = p.accessories || []
    return { ...p, accessories: a.includes(v) ? a.filter(x => x !== v) : [...a, v] }
  })

  const setCond = (i, field, val) => setD(p => {
    const c = [...p.conductors]
    c[i] = { ...c[i], [field]: val }
    return { ...p, conductors: c }
  })

  const setMultiCond = (i, fields) => setD(p => {
    const c = [...p.conductors]
    c[i] = { ...c[i], ...fields }
    return { ...p, conductors: c }
  })

  const setCA = (i, field, val) => setD(p => {
    const c = [...p.crossarms]
    c[i] = { ...c[i], [field]: val }
    return { ...p, crossarms: c }
  })

  // ── PDF share ─────────────────────────────────────────────────────────────

  const handleShare = () => {
    sharePdf(
      pdfBytes,
      buildPdfFilename(d.projectName, d.npJobNumber, d.oldPoleId, 'Pole Record'),
      pdfBlobUrl,
      clearFormDraft,
    )
  }

  // ── Shared hooks ──────────────────────────────────────────────────────────

  const { set, handleDevFill } = useWizardSetup(d, setD, step, '360S014EC')
  const { clearDraft: clearFormDraft } = useDraft('360S014EC', d, step, photos)

  // ── Missing-field warnings ────────────────────────────────────────────────

  const missingFields = [
    !d.pcoWONo    && 'PCo W/O No.',
    !d.streetRoad && 'Street/Road',
    !d.contractor && 'Contractor',
    !d.namePrint  && 'Name (Print)',
  ].filter(Boolean)

  // ─────────────────────────────────────────────────────────────────────────
  // STEP CONTENT
  // ─────────────────────────────────────────────────────────────────────────

  const LEVEL_OPTS   = [['1','1'],['2','2'],['3','3'],['4','4'],['5','5'],['6','6'],['7','7']]
  const EN_OPTS      = [['E','Existing (E)'],['N','New (N)']]
  const VOLTAGE_OPTS = [['LV','LV'],['LVTX','LVTX'],['11','11'],['22','22'],['33','33'],['66','66']]
  const ARMS_OPTS    = [['1','Single'],['2','Double']]
  const END_SIZE_OPTS= [['A','A — 75×100mm'],['B','B — 100×100mm'],['D','D — 150×100mm'],['Z','Z — 75×75mm Angle Iron']]
  const MATERIAL_OPTS= [['T','Timber (T)'],['S','Steel (S)'],['C','Composite (C)']]

  const renderCurrentStep = () => {
    switch (step) {
      case 0: return (
        // 0 — Location & Contractor
        <JobDetailsStep key="0" d={d} setD={setD} accent={W_PURPLE} onOpenDrafts={openLoad} />
      )

      case 1: return (
        // 1 — Pole IDs & Activity
        <div key="1">
          <WF label="Powerco Old Pole ID" v={d.oldPoleId} set={set('oldPoleId')} />
          <WCB label="Type of Pole Activity"
            options={['New','Removed','Replaced','Relocation','Label Replaced']}
            value={d.poleActivity} onChange={tog('poleActivity')} />
          {(d.poleActivity==='New'||d.poleActivity==='Replaced'||d.poleActivity==='Label Replaced') &&
            <WF label="Powerco New Pole ID(s)" v={d.newPoleId} set={set('newPoleId')} />}
          {(d.poleActivity==='New'||d.poleActivity==='Replaced') &&
            <DateBoxInput label="New Pole Manufactured Date" value={d.manufacturedDate||''} onChange={set('manufacturedDate')} />}
          <WCB label="Cross-arm Activity"
            options={['New','Removed','Replaced']}
            value={d.crossarmActivity} onChange={tog('crossarmActivity')} />
          <WCB label="Pole Loading"
            options={['Angle','In Line','Road Crossing','Take Off','Termination']}
            value={d.poleLoading} onChange={tog('poleLoading')} />
          <WCB label="Ownership" options={['Powerco','Private','Other']} value={d.ownership} onChange={tog('ownership')} />
          {d.ownership==='Other' && <WF label="Specify Ownership" v={d.ownershipOther} set={set('ownershipOther')} />}
          <WCB label="Shared Use" options={['Fibre','Chorus','Other']} value={d.sharedUse} onChange={tog('sharedUse')} />
          {d.sharedUse==='Other' && <WF label="Specify Shared Use" v={d.sharedUseOther} set={set('sharedUseOther')} />}
          {(d.poleActivity==='Removed'||d.poleActivity==='Replaced') &&
            <WTA label="Reason for Removal" v={d.reasonForRemoval} set={set('reasonForRemoval')} rows={2} />}
        </div>
      )

      case 2: return (
        // 2 — New Pole Details
        <div key="2">
          {!(d.poleActivity==='New'||d.poleActivity==='Replaced') ? (
            <div style={{ background:'#f4f4f8', border:'1px solid #ddd', borderRadius:10, padding:'20px 18px', textAlign:'center', color:'#666', fontSize:14, lineHeight:1.6 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>🪵</div>
              <strong>New Pole Details — not applicable</strong>
              <p style={{ margin:'8px 0 0', fontSize:13, color:'#888' }}>
                These fields only apply when the pole activity is <strong>New</strong> or <strong>Replaced</strong>.
                {d.poleActivity ? <> You selected <strong>{d.poleActivity}</strong>.</> : <> Select an activity on the previous step.</>}
              </p>
              <p style={{ margin:'6px 0 0', fontSize:12, color:'#999' }}>Tap <strong>Next →</strong> to continue.</p>
            </div>
          ) : (
            <>
              <WCB label="GPS Required" options={['Yes','No']} value={d.gpsRequired} onChange={tog('gpsRequired')} />
              {d.gpsRequired==='Yes' && (
                <div style={{ background:'#f5f5f5', borderRadius:10, padding:12, marginBottom:12 }}>
                  <div style={{ fontWeight:700, fontSize:11, marginBottom:8, color:'#555' }}>GPS CO-ORDINATES</div>
                  <GpsCoordButton accent={W_PURPLE} onCoords={coords => setD(p => ({ ...p, ...coords }))} />
                  <WF label="North"                    v={d.gpsNorth}  set={set('gpsNorth')}  ph="e.g. 5812345" />
                  <WF label="East"                     v={d.gpsEast}   set={set('gpsEast')}   ph="e.g. 1832456" />
                  <WF label="Altitude above sea level" v={d.altitude}  set={set('altitude')}  ph="e.g. 45m" />
                </div>
              )}
              <WCB label="Pole Condition" options={['New','Pre-Used']} value={d.poleCondition} onChange={tog('poleCondition')} />

              <div style={{ marginBottom:14 }}>
                <label style={wLbl}>New Pole Code & Manufacturer</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginTop:4 }}>
                  {POLE_CODES.map(code => {
                    const sel = d.poleCode === code
                    return (
                      <button key={code} onClick={() => tog('poleCode')(code)} style={{
                        padding:'7px 9px', borderRadius:8,
                        border:`2px solid ${sel?W_PURPLE:'#ddd'}`,
                        background:sel?W_PURPLE:'#fff', color:sel?'#fff':'#333',
                        fontFamily:'inherit', fontSize:11, cursor:'pointer',
                        fontWeight:sel?700:400, textAlign:'left',
                      }}>{code}</button>
                    )
                  })}
                  {['DULHUNTY','IUP','OTHER'].map(code => {
                    const sel = d.poleCode === code
                    return (
                      <button key={code} onClick={() => tog('poleCode')(code)} style={{
                        padding:'7px 9px', borderRadius:8,
                        border:`2px solid ${sel?W_PURPLE:'#ddd'}`,
                        background:sel?W_PURPLE:'#fff', color:sel?'#fff':'#333',
                        fontFamily:'inherit', fontSize:11, cursor:'pointer',
                        fontWeight:sel?700:400, textAlign:'left',
                      }}>{code}</button>
                    )
                  })}
                </div>
              </div>
              {d.poleCode==='DULHUNTY' && <WF label="State Pole Code, kN & Length"       v={d.dulhuntyCode} set={set('dulhuntyCode')} ph="e.g. D300 8kN 12m" />}
              {d.poleCode==='IUP'      && <WF label="State kN & Length (Steel)"           v={d.iupCode}      set={set('iupCode')}      ph="e.g. 12kN 11m" />}
              {d.poleCode==='OTHER'    && <WF label="State Manufacturer, kN & Length"     v={d.otherCode}    set={set('otherCode')}    ph="e.g. Other Co 10kN 12m" />}
              {d.poleCode && !d.poleCode.includes('Busck') &&
                <WF label="Manufacturers Unique Pole ID" v={d.manufacturerPoleId} set={set('manufacturerPoleId')} ph="Required for Goldpine & Dulhunty" />}

              <WCB label="New Pole Information (Type)" options={POLE_TYPES} value={d.poleType} onChange={tog('poleType')} />
              {d.poleType==='Other' && <WF label="Specify Type" v={d.poleTypeOther} set={set('poleTypeOther')} />}
            </>
          )}
        </div>
      )

      case 3: return (
        // 3 — Equipment on Pole
        <div key="3">
          <div style={{ fontSize:13, color:'#777', marginBottom:10 }}>
            Select equipment on pole and enter IDs where applicable.
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={wLbl}>Equipment on Pole</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
              {[
                ['ABS',                   'absId'             ],
                ['Links',                 'linksId'           ],
                ['Drop out Fuse',         'dropoutFuseId'     ],
                ['Transformer',           'transformerId'     ],
                ['Regulator',             'regulatorId'       ],
                ['Sectionliser/Recloser', 'sectionliserId'   ],
                ['Fault Indicator',       'faultIndicatorId' ],
                ['Lightning Arrester',    'lightningArresterId'],
              ].map(([label, k]) => {
                const selected = d[k] !== undefined && d[k] !== null
                return (
                  <button key={k}
                    onClick={() => {
                      if (selected) setD(p => { const n = {...p}; delete n[k]; return n })
                      else setD(p => ({ ...p, [k]: '' }))
                    }}
                    style={{
                      padding:'7px 12px', borderRadius:8,
                      border:`2px solid ${selected?W_PURPLE:'#ddd'}`,
                      background:selected?W_PURPLE:'#fff', color:selected?'#fff':'#333',
                      fontFamily:'inherit', fontSize:13, cursor:'pointer', fontWeight:selected?700:400,
                    }}>{label}</button>
                )
              })}
            </div>
          </div>
          {[
            ['ABS',                   'absId'             ],
            ['Links',                 'linksId'           ],
            ['Drop out Fuse',         'dropoutFuseId'     ],
            ['Transformer',           'transformerId'     ],
            ['Regulator',             'regulatorId'       ],
            ['Sectionliser/Recloser', 'sectionliserId'   ],
            ['Fault Indicator',       'faultIndicatorId' ],
            ['Lightning Arrester',    'lightningArresterId'],
          ].map(([label, k]) =>
            (d[k] !== undefined && d[k] !== null) &&
            <WF key={k} label={`${label} – Equipment ID`} v={d[k]} set={set(k)} ph="Leave blank if N/A" />
          )}
          <div style={{ marginBottom:14, marginTop:14 }}>
            <label style={wLbl}>Other Equipment</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
              <button
                onClick={() => {
                  if (d.otherEquipType !== undefined && d.otherEquipType !== null) {
                    setD(p => { const n = {...p}; delete n.otherEquipType; delete n.otherEquipId; return n })
                  } else {
                    setD(p => ({ ...p, otherEquipType: '', otherEquipId: '' }))
                  }
                }}
                style={{
                  padding:'7px 12px', borderRadius:8,
                  border:`2px solid ${d.otherEquipType!==undefined&&d.otherEquipType!==null?W_PURPLE:'#ddd'}`,
                  background:d.otherEquipType!==undefined&&d.otherEquipType!==null?W_PURPLE:'#fff',
                  color:d.otherEquipType!==undefined&&d.otherEquipType!==null?'#fff':'#333',
                  fontFamily:'inherit', fontSize:13, cursor:'pointer',
                  fontWeight:d.otherEquipType!==undefined&&d.otherEquipType!==null?700:400,
                }}>Other Equipment</button>
            </div>
          </div>
          {d.otherEquipType !== undefined && d.otherEquipType !== null && (
            <div>
              <WF label="Equipment Type" v={d.otherEquipType} set={set('otherEquipType')} ph="Specify type" />
              <WF label="Equipment ID"   v={d.otherEquipId}   set={set('otherEquipId')} />
            </div>
          )}
        </div>
      )

      case 4: return (
        // 4 — Accessories
        <div key="4">
          <WCB
            label="Pole Accessories (select all that apply)"
            options={['Possum Guard','Streetlight Fitting','Aerial Stay','Climbers','Ground Stay','Platform','HV Cable Riser','Bird Spikes']}
            value={d.accessories} onChange={togAcc} multi />
          <div style={{ marginBottom:14, marginTop:14 }}>
            <label style={wLbl}>Control Box & Other Options</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
              {['Control Box','Other'].map(item => {
                const isCB     = item === 'Control Box'
                const selected = isCB ? !!d.controlBoxPurpose : !!d.accessoriesOther
                return (
                  <button key={item}
                    onClick={() => {
                      if (!selected) {
                        if (isCB) setD(p => ({ ...p, controlBoxPurpose: '' }))
                        else      setD(p => ({ ...p, accessoriesOther:   '' }))
                      }
                    }}
                    style={{
                      padding:'7px 12px', borderRadius:8,
                      border:`2px solid ${selected?W_PURPLE:'#ddd'}`,
                      background:selected?W_PURPLE:'#fff', color:selected?'#fff':'#333',
                      fontFamily:'inherit', fontSize:13, cursor:'pointer', fontWeight:selected?700:400,
                    }}>{item}</button>
                )
              })}
            </div>
          </div>
          {d.controlBoxPurpose !== undefined && d.controlBoxPurpose !== null &&
            <WF label="Control Box – Stipulate Purpose" v={d.controlBoxPurpose} set={set('controlBoxPurpose')} ph="Leave blank if N/A" />}
          {d.accessoriesOther !== undefined && d.accessoriesOther !== null &&
            <WF label="Other Accessories (specify)" v={d.accessoriesOther} set={set('accessoriesOther')} />}
        </div>
      )

      case 5: return (
        // 5 — Conductors
        <div key="5">
          <WF label="Number of Pole Service Connections" v={d.serviceConnections} set={set('serviceConnections')} ph="e.g. 2" />
          {parseInt(d.serviceConnections||0,10)>=1 &&
            <WF label="Address(s) of Service(s) from Pole" v={d.serviceAddresses} set={set('serviceAddresses')} ph="List addresses" />}
          <div style={{ fontWeight:700, fontSize:14, marginBottom:8, color:'#333' }}>Conductors</div>
          {(() => {
            const firstEmptyIdx = d.conductors.findIndex(c => !(c.level||c.existing||c.size||c.material||c.insulation))
            return d.conductors.map((c, i) => {
              const hasData    = c.level||c.existing||c.size||c.material||c.insulation||c.picker
              const isFirstEmpty = i === firstEmptyIdx
              const isLastRow    = i === d.conductors.length - 1
              return (hasData || isFirstEmpty) ? (
                <div key={i} style={{ background:'#f8f8ff', border:'1.5px solid #ddd', borderRadius:10, padding:11, marginBottom:10, position:'relative' }}>
                  <button
                    onClick={() => setD(p => ({ ...p, conductors: p.conductors.filter((_,idx) => idx!==i) }))}
                    style={{ position:'absolute', top:8, right:8, background:'none', border:'none', fontSize:18, color:'#999', cursor:'pointer', padding:0 }}>×</button>
                  <div style={{ fontWeight:600, fontSize:12, marginBottom:8, color:W_PURPLE }}>Row {i+1}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <WSel label="Level"          value={c.level}    onChange={v => setCond(i,'level',v)}    options={LEVEL_OPTS} />
                    <WSel label="Existing / New" value={c.existing} onChange={v => setCond(i,'existing',v)} options={EN_OPTS} />
                  </div>
                  <ConductorPicker c={c} i={i} setCond={setCond} setMultiCond={setMultiCond} />
                </div>
              ) : null
            })
          })()}
          {d.conductors.length < 7 && (
            <button
              onClick={() => setD(p => ({ ...p, conductors: [...p.conductors, { level:String(p.conductors.length+1), existing:'', size:'', material:'', insulation:'', picker:null }]}))}
              style={{ marginTop:10, padding:'10px 16px', borderRadius:8, border:'none', background:W_PURPLE, color:'#fff', fontFamily:'inherit', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              + Add Another Row
            </button>
          )}
        </div>
      )

      case 6: return (
        // 6 — Crossarms
        <div key="6">
          <div style={{ background:'#fffff0', border:'1px solid #e0e000', borderRadius:8, padding:9, marginBottom:12, fontSize:11, color:'#555' }}>
            <b>Length:</b> enter in code format, e.g. 20=2m, 23=2.3m<br/>
            <b>Insulators:</b> PN=Pin(LV), PS=Post(HV), TT=Term-Term, DP=Delta Post, EDO
          </div>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:8, color:'#333' }}>Crossarms</div>
          {(() => {
            const firstEmptyIdx = d.crossarms.findIndex(c => !(c.level||c.existing||c.voltage||c.endSize||c.length||c.arms||c.insulatorType||c.armMaterial||c.wires))
            return d.crossarms.map((c, i) => {
              const hasData      = c.level||c.existing||c.voltage||c.endSize||c.length||c.arms||c.insulatorType||c.armMaterial||c.wires
              const isFirstEmpty = i === firstEmptyIdx
              const isLastRow    = i === d.crossarms.length - 1
              return (hasData || isFirstEmpty) ? (
                <div key={i} style={{ background:'#f8f8ff', border:'1.5px solid #ddd', borderRadius:10, padding:11, marginBottom:10, position:'relative' }}>
                  <button
                    onClick={() => setD(p => ({ ...p, crossarms: p.crossarms.filter((_,idx) => idx!==i) }))}
                    style={{ position:'absolute', top:8, right:8, background:'none', border:'none', fontSize:18, color:'#999', cursor:'pointer', padding:0 }}>×</button>
                  <div style={{ fontWeight:600, fontSize:12, marginBottom:8, color:W_PURPLE }}>Crossarm {i+1}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <WSel label="Level"          value={c.level}    onChange={v => setCA(i,'level',v)}    options={LEVEL_OPTS} />
                    <WSel label="Existing / New" value={c.existing} onChange={v => setCA(i,'existing',v)} options={EN_OPTS} />
                  </div>
                  <WSel label="Rated Voltage" value={c.voltage} onChange={v => setCA(i,'voltage',v)} options={VOLTAGE_OPTS} />
                  <div style={{ height:1, background:'#e5e7eb', margin:'8px 0' }} />
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <WSel label="End Size"    value={c.endSize}     onChange={v => setCA(i,'endSize',v)}     options={END_SIZE_OPTS} />
                    <WF   label="Length"      v={c.length}          set={v => setCA(i,'length', v.replace(/\D/g,''))}  ph="e.g. 20" type="number" />
                    <WSel label="Arms"        value={c.arms}        onChange={v => setCA(i,'arms',v)}        options={ARMS_OPTS} />
                    <WSel label="Arm Material"value={c.armMaterial} onChange={v => setCA(i,'armMaterial',v)} options={MATERIAL_OPTS} />
                  </div>
                  <div style={{ height:1, background:'#e5e7eb', margin:'8px 0' }} />
                  <WF label="Insulator Type" v={c.insulatorType} set={v => setCA(i,'insulatorType',v)} ph="PN / PS / TT / DP / EDO" />
                  <WF label="# Wires"        v={c.wires}         set={v => setCA(i,'wires', v.replace(/\D/g,''))} ph="e.g. 3" type="number" />
                </div>
              ) : null
            })
          })()}
          {d.crossarms.length < 7 && (
            <button
              onClick={() => setD(p => ({ ...p, crossarms: [...p.crossarms, { level:String(p.crossarms.length+1), existing:'', voltage:'', endSize:'', length:'', arms:'', insulatorType:'', armMaterial:'', wires:'' }]}))}
              style={{ marginTop:10, padding:'10px 16px', borderRadius:8, border:'none', background:W_PURPLE, color:'#fff', fontFamily:'inherit', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              + Add Another Row
            </button>
          )}
        </div>
      )

      case 7: return (
        // 7 — Work Description
        <div key="7">
          <div style={{ fontSize:13, color:'#777', marginBottom:10 }}>
            Illustrate asset location if the pole is new or has been moved more than 1 metre. Show any LV break positions.
          </div>
          <WTA label="Describe the work performed" v={d.workDescription} set={set('workDescription')} rows={12} ph="Describe all work performed..." />
        </div>
      )

      case 8: return (
        // 8 — Photos
        <div key="8">
          <PhotoAttachStep photos={photos} onChange={setPhotos} accent={W_PURPLE} />
        </div>
      )

      default: return null
    }
  }

  const previewContent = buildPreviewContent(() => triggerGenerate(d, photos), W_PURPLE)

  return (
    <>
      <WizardShell
        title="AS-Built Pole Record"
        formNumber="360S014EC"
        headerIcon={<PenLine size={22} color="#fff" style={{ flexShrink: 0 }} />}
        steps={W_STEPS}
        step={step}
        onStepClick={setStep}
        onClose={onClose}
        onBack={() => setStep(s => s - 1)}
        onSaveDraft={openSave}
        onFillTestData={handleDevFill}
        calibrationPdfUrl={import.meta.env.DEV ? `${import.meta.env.BASE_URL}forms/360S014EC.pdf` : undefined}
        calibrationPageCount={import.meta.env.DEV ? 3 : undefined}
        onNext={() => {
          const n = step + 1
          setStep(n)
          if (n === W_STEPS.length - 1) triggerGenerate(d, photos)
        }}
        accent={W_PURPLE}
        bg={WIZARD_COLORS.bg}
        mid={WIZARD_COLORS.mid}
        border={WIZARD_COLORS.border}
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

export default PoleRecordWizard

