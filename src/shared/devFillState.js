/**
 * devFillState.js — Development-only utility to populate wizard form state
 * with plausible dummy data for PDF coordinate calibration.
 *
 * Dead-code eliminated in production builds (Rollup tree-shakes the import
 * because all call-sites are inside `import.meta.env.DEV ? ... : undefined`).
 *
 * Two state-updater functions are exported:
 *   devFillState            — one realistic, plausible value per field (as before)
 *   devFillStateAllOptions  — same realistic fill, PLUS flags the state so the
 *                             PDF renderer shows every "1 of N" checkbox/
 *                             ellipse option and every text field's position
 *                             at once (see its own doc comment below, and
 *                             the calibration-mode section in
 *                             src/shared/pdfFieldRenderer.js)
 *
 * useWizardSetup.js wires the dev-only 🧪 button to TOGGLE between the two
 * on each tap, so no wizard needs its own button or extra prop for this:
 *   import { devFillState, devFillStateAllOptions } from '../shared/devFillState'
 *
 *   // Inside useWizardSetup:
 *   const fillModeRef = useRef('normal')
 *   const handleDevFill = import.meta.env.DEV ? () => {
 *     if (fillModeRef.current === 'normal') { setD(devFillStateAllOptions); fillModeRef.current = 'all' }
 *     else                                  { setD(devFillState);          fillModeRef.current = 'normal' }
 *   } : undefined
 *
 *   // On the WizardShell, unchanged:
 *   <WizardShell ... onFillTestData={handleDevFill}>
 *
 * ── Algorithm (devFillState's realistic fill) ───────────────────────────────
 * devFillState is a React state-updater function: (prevState) => nextState.
 * Passing it directly to setD() works because React's setState accepts
 * an updater function — no wrapper needed.
 *
 * Processing rules (applied in order):
 *  0. Pole-wizard-only fields → merged in first if missing (see
 *     withPoleExtras below), so they're visible to rules 1–10 at all
 *  1. Signature fields (signed, wtlSigned, fsSigned) → PRESERVED from userPrefs
 *  2. null values → preserved as-is
 *  3. OVERRIDE_VALUES map → exact key match overrides everything (incl. arrays)
 *     Array-vs-scalar type is respected; mismatches fall through to rule 4.
 *  4. boolean        → true
 *  5. string         → inferred from field name (see inferString)
 *  6. boolean[]      → every element becomes true
 *  7. string[]       → every element gets an inferred string
 *  8. object[]       → every item is recursed (handles row tables)
 *  9. empty []       → inferEmptyArray (handles multi-select and selection arrays)
 * 10. nested object  → recursed
 *
 * devFillStateAllOptions runs this exact same fill first (so anything NOT
 * covered by calibration mode — e.g. circuit-grid range checks that need
 * real in-range numbers — still looks sensible), then adds __calibrate: true.
 */

// ── Today's date in YYYY-MM-DD (HTML date input format) ───────────────────────
const TODAY = new Date().toISOString().slice(0, 10)

/**
 * Build an array of `count` rows, each produced by `rowFn(index)`. Used
 * below to give every repeating-row table (conductors, box entries, etc.)
 * a FULL set of rows up to that wizard's actual maximum — see the
 * "Repeating-row tables" section of OVERRIDE_VALUES for why this matters.
 */
function repeatRows(count, rowFn) {
  return Array.from({ length: count }, (_, i) => rowFn(i))
}

// ─────────────────────────────────────────────────────────────────────────────
// POLE WIZARD — fields never present in initial state
// ─────────────────────────────────────────────────────────────────────────────
// Unlike every other wizard (which builds its initial state via
// getBaseFormState({ ...all fields declared as '' })), PoleWizard.jsx's
// useState() only seeds `conductors`, `crossarms`, and `accessories` on top
// of the shared base fields. Every other field on the form — Pole IDs &
// Activity, New Pole Details, Equipment on Pole, the rest of Accessories,
// and Work Description — is added to state lazily via setD() the first
// time the user taps or types into that control.
//
// fillObject() below only iterates keys that ALREADY exist on prevState
// (see fillValue's Object.entries(obj) loop), so any key PoleWizard hasn't
// created yet is completely invisible to it. That's why the 🧪 fill button
// was skipping almost the entire "Pole IDs & Activity" step (and several
// others) — those keys simply don't exist in state until manually touched
// first.
//
// withPoleExtras() merges in a default ('') for every one of these fields
// that's still absent, WITHOUT touching any that the user (or a previous
// fill) has already set — so this only fills gaps, never overwrites real
// data or clobbers a field the user deliberately left blank.
//
// Detection: PoleWizard is the only wizard whose state has BOTH a
// `conductors` array AND a `crossarms` array, so that combination is used
// as the shape check.
const POLE_EXTRA_FIELDS = {
  // Step 1 — Pole IDs & Activity
  oldPoleId: '', poleActivity: '', newPoleId: '', manufacturedDate: '',
  crossarmActivity: '', poleLoading: '',
  ownership: '', ownershipOther: '',
  sharedUse: '', sharedUseOther: '',
  reasonForRemoval: '',

  // Step 2 — New Pole Details
  gpsRequired: '', gpsNorth: '', gpsEast: '', altitude: '',
  poleCondition: '', poleCode: '',
  dulhuntyCode: '', iupCode: '', otherCode: '',
  manufacturerPoleId: '', poleType: '', poleTypeOther: '',

  // Step 3 — Equipment on Pole
  absId: '', linksId: '', dropoutFuseId: '', transformerId: '',
  regulatorId: '', sectionliserId: '', faultIndicatorId: '', lightningArresterId: '',
  otherEquipType: '', otherEquipId: '',

  // Step 4 — Accessories (accessories[] itself is already seeded by the wizard)
  controlBoxPurpose: '', accessoriesOther: '',

  // Step 5 — Conductors (service info; conductors[] itself already seeded)
  serviceConnections: '', serviceAddresses: '',

  // Step 7 — Work Description
  workDescription: '',
}

function withPoleExtras(prevState) {
  if (!Array.isArray(prevState?.conductors) || !Array.isArray(prevState?.crossarms)) {
    return prevState
  }
  const merged = { ...prevState }
  for (const [k, v] of Object.entries(POLE_EXTRA_FIELDS)) {
    if (!(k in merged)) merged[k] = v
  }
  return merged
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERRIDE_VALUES
// Exact field-name matches that take priority over type inference.
// For selection/checkbox fields (where the value must be a specific string to
// trigger the right PDF mark), list the valid option here.
// Shared across ALL wizards — add future wizard fields here too.
// ─────────────────────────────────────────────────────────────────────────────
const OVERRIDE_VALUES = {

  // ── Standard job-detail fields (all wizards) ────────────────────────────────
  npJobNumber:       'TC1234567',
  projectName:       'Pyes Pa Test Site',
  pcoWONo:           '50512345',
  ciwrNo:            '78901',
  streetRoad:        '42 Example Road',
  cityTown:          'Hamilton',
  district:          'Waikato',
  contractor:        'Downer Group',
  namePrint:         'J. Smith',
  dateWorkCompleted: TODAY,

  // ── Transformer wizard (360S014EG) ──────────────────────────────────────────
  transformerSiteId: 'TX-789',
  poleId:            'WKT-99999',
  zoneSubstation:    'Pyes Pa',
  feederId:          'F01',
  installationType:  'New',
  removedToStore:    'Waikato Depot',
  // Nested inside issued / removed objects — key is the property name:
  voltageHV:         '11kV',
  voltageLV:         '400V',
  connectionTypeHV:  'Cable Box',
  connectionTypeLV:  'Cable Box',
  capacityKVA:       '100',
  phases:            'Three',        // must match 'Three'|'One'|'SWER' for ellipse
  enclosureType:     'Pole Mount',   // must match ENC_OPTIONS for checkbox
  enclosureModel:    'Elmetal RX-4',
  transformerType:   'Bearer',       // must match TX_TYPE for ellipse
  make:              'ABB',
  voltTest:          'PASS',
  tapSetting:        '0',            // must match '-10'|...|'+5' for ellipse
  mdiFitted:         'YES',          // 'YES'|'NO'
  ctRatio:           '200/5',
  earthTest1:        '3.2',
  earthTest2:        '2.8',
  totalMEN:          '1.5',
  fuseSizeHV:        '100A',
  fuseSizeLV:        '400A',
  lvDisconnectorMake:  'ABB',
  lvDisconnectorModel: 'T2N 160',
  // reasonForRemoval is a multi-select array in transformer but a string in pole:
  // The array case is handled by inferEmptyArray below.

  // ── Pole wizard (360S014EC) ─────────────────────────────────────────────────
  oldPoleId:          'WKT-12345',
  newPoleId:          'WKT-12346',
  manufacturerPoleId: 'GP-789456',
  manufacturedDate:   '01-01-22',
  poleActivity:       'New',
  crossarmActivity:   'New',
  poleLoading:        'Angle',
  gpsRequired:        'Yes',
  poleCondition:      'New',
  ownership:          'Powerco',
  ownershipOther:     'Council',
  sharedUse:          'Fibre',
  sharedUseOther:     'Fibre Co.',
  poleCode:           '12m (12kN) Goldpine',
  poleType:           '1 Pole',
  gpsNorth:           '5812345',
  gpsEast:            '1832456',
  altitude:           '45m',
  gpsFiles:           'GPS_site_001.gpx',
  serviceConnections: '2',
  serviceAddresses:   '15 Test St, 17 Test St',
  otherEquipType:     'Test Equipment',
  otherEquipId:       'EQ-TEST',
  controlBoxPurpose:  'Remote switching',
  accessoriesOther:   'Cable guard',
  reasonForRemoval:   'End of life replacement.',  // string in Pole wizard
  workDescription:    'New pole installed per 393S001. Site left clean and tidy.',

  // ── Pole wizard — "Equipment on Pole" IDs (only present once the user has
  // tapped the corresponding equipment button; see withPoleExtras above) ────
  absId:                'EQ-100',
  linksId:              'EQ-101',
  dropoutFuseId:        'EQ-102',
  transformerId:        'TX-100',
  regulatorId:          'EQ-103',
  sectionliserId:       'EQ-104',
  faultIndicatorId:     'EQ-105',
  lightningArresterId:  'EQ-106',

  // ── Pole wizard — custom pole-code / pole-type entry fields (only present
  // once the user has selected DULHUNTY / IUP / OTHER / "Other" type) ───────
  dulhuntyCode:  'D300 8kN 12m',
  iupCode:       '12kN 11m',
  otherCode:     'Other Co 10kN 12m',
  poleTypeOther: 'Custom pole type',

  // ── Conductor / crossarm row fields (nested in arrays) ──────────────────────
  existing:      'N',   // 'E'|'N'
  voltage:       '11',  // LV / 11 / 22 / 33
  endSize:       'A',   // A|B|D|Z
  arms:          '1',   // '1'|'2'
  armMaterial:   'T',   // T|S|C
  insulatorType: 'PN',
  wires:         '3',
  level:         '1',
  size:          '95mm²',
  insulation:    'Bare',

  // ── Elec Equipment wizard (360S014EE) ───────────────────────────────────────
  newEquipmentId:    'EQ-002',
  oldEquipmentId:    'EQ-001',
  locationPoleSiteId:'WKT-55555',
  manufacturer:      'ABB',
  model:             'Model-X',
  serialNo:          'SN-123456',
  serialNumber:      'SN-123456',
  equipmentType:     'Standard ABS',
  equipmentTypeOther:'Custom switch type',
  typeOfChange:      'New',
  normalState:       'Closed',  // 'Open'|'Closed'
  operatingVoltage:  '11kV',
  voltageRating:     '11kV',
  fuseSize:          '100A',
  remoteControlled:  'Yes',
  remoteIndication:  'Yes',
  equipmentId:       'EQ-001',
  ir:                'I',       // 'I'|'R' in multi-item table

  // ── LV Connection wizard (360S014EA) ────────────────────────────────────────
  cocNumber:          'COC-999',
  cowShedNumber:      'CS-01',
  icpNumber:          '0000123456789',
  installedService:   'Underground cable',
  connectedTo:        'Box',
  connectedToOther:   'Pillar',
  poleServiceBoxNumber: 'BOX-123',
  conductorSize:      '95mm²',
  conductorMaterial:  'ACSR',
  numberOfCables:     '1',
  numberOfCores:      '4',
  numberOfPhases:     '3',
  phaseColours:       'R/W/B',
  cableDuct:          'New',
  cableDuctNewSize:   '100mm',
  cableDuctExistingSize: '100mm',

  // ── Elec Distribution wizard (360S014EB) ────────────────────────────────────
  distributionMain:   'Underground',
  undergroundCableDepth: '600',
  cableDuctUsed:      'Yes',
  cableDuctType:      'New',
  numberOfDucts:      '2',
  ductSize:           '100',
  capped:             'Yes',
  drawWire:           'Yes',
  otherServicesOther: 'Fibre',

  // Cable row fields
  phase:          'Three',
  cableSize:      '95mm²',
  material:       'ACSR',
  circuitLength:  '150m',

  // ── LV Box wizard (360S014ED) ────────────────────────────────────────────────
  equipIdNew:          'LVB-002',
  equipIdOld:          'LVB-001',
  address:             '42 Test Road',
  serviceOrDist:       'Distribution',
  numberOfDisconnects: '4',
  fuseHolders:         '3×100A',
  owner:               'Powerco',

  // ── Zone Sub wizard (360S014EF) ──────────────────────────────────────────────
  substation:          'Pyes Pa Zone Sub',
  contractorJobCostCode: 'CC-1234',
  maintenanceApplies:  true,
  replacementApplies:  true,
  maintenanceEquipmentId: 'EQ-010',
  maintenanceParentEquipmentId: 'EQ-009',
  maintenanceEquipmentDescription: 'Test Circuit Breaker',
  maintenanceDescription: 'Replaced contacts and tested operation. All checks passed.',
  drawingReferenceNo:  'DRG-2025-001',
  replacementDescription: 'New unit installed. Serial number updated in SAP.',
  installedOrRemoved:  'Installed',
  manufacturerModel:   'ABB Model-X',
  drawingRef:          'DRG-001',

  // ── HV Inspection wizard (220F028A) ─────────────────────────────────────────
  siteId:     'SUB-123',
  // selectedEquip is an array — handled by inferEmptyArray
  other1:     'Visual check item 1',
  other2:     'Visual check item 2',
  other3:     'Visual check item 3',
  wtlName:    'J. Smith',
  wtlCertNo:  'EW123456',
  certNo:     'EW123456',
  fsName:     'A. Jones',
  fsSinNapa:  'SIN98765',

  // ── Distribution Transformer wizard (220F028B) ───────────────────────────────
  transformerNo:   'TX-456',
  contractorRefNo: 'CR-9876',
  earthLeg1:       '4.2',
  earthLeg2:       '3.8',
  menUrban:        '2.1',
  menRural:        '12.5',
  dPoleBushing:    'Yes',
  dPoleNeutralCond:'Yes',
  dPoleEarth:      'Yes',
  dGroundBushing:  'Yes',
  eHvFuseSize:     '100',
  fTapSetting:     '0%',
  isnId:           'ISN12345',
  jRW: '0.08', jRB: '0.07', jWB: '0.09',
  jRN: '0.06', jWN: '0.07', jBN: '0.08',

  // Circuit-centric voltage checks — ALL 4 possible circuits, every reading
  // in the acceptable range (R–W/W–B/B–R: 412–422 V · R–N/W–N/B–N: 238–244 V).
  // Was previously only 2 of the 4 — the other two circuit COLUMNS on the
  // form never got any data, so there was nothing to calibrate against.
  fCircuits: [
    { rw: '416', wb: '418', br: '415', rn: '240', wn: '241', bn: '239' },
    { rw: '417', wb: '419', br: '416', rn: '241', wn: '240', bn: '240' },
    { rw: '418', wb: '417', br: '414', rn: '239', wn: '239', bn: '238' },
    { rw: '420', wb: '416', br: '413', rn: '242', wn: '243', bn: '241' },
  ],

  // Circuit-centric phasing/paralleling checks — ALL 4 possible circuits,
  // every reading <10 V (same "only 2 of 4" issue as fCircuits above).
  iCircuits: [
    { r1r2: '2', w1w2: '3', b1b2: '1', neutral: true },
    { r1r2: '3', w1w2: '2', b1b2: '2', neutral: true },
    { r1r2: '4', w1w2: '5', b1b2: '3', neutral: false },
    { r1r2: '1', w1w2: '4', b1b2: '2', neutral: true },
  ],

  // ── Repeating-row tables — every row, up to each wizard's real maximum ──────
  // Without an explicit array override here, a row-table field falls through
  // to the generic array rules further down (see fillValue), which only fill
  // whatever rows ALREADY exist in the wizard's current state — typically
  // just the single row every wizard starts with. That's enough for the
  // wizard's own UI, but for PDF calibration it means only the FIRST row's
  // position ever gets tested; every other row on the form (up to 20, for
  // LV Box) never receives any data, so there's nothing on the page to check
  // its coordinates against. These overrides replace each array wholesale
  // with a full set of rows instead, regardless of how many rows happen to
  // exist when you tap fill.
  //
  // The standalone field overrides above (level, existing, voltage, size,
  // normalState, operatingVoltage, voltageRating, fuseSize, equipmentId, ir,
  // phase, cableSize, material, circuitLength, insulation, equipIdNew,
  // equipIdOld, address, serviceOrDist, numberOfDisconnects, fuseHolders,
  // owner, installedOrRemoved, manufacturerModel, drawingRef) still apply to
  // any OTHER field with that exact name elsewhere — e.g. LvConnectionWizard
  // has a standalone `fuseSize` field, not part of any row table — they're
  // just no longer reached for the row tables themselves, since those are
  // now fully replaced below.

  // Pole — conductors (max 7)
  conductors: repeatRows(7, i => ({
    level: String(i + 1),
    existing: i % 2 === 0 ? 'E' : 'N',
    size: ['95mm²', '50mm²', '16mm²', '25mm²', '35mm²', '70mm²', '120mm²'][i],
    material: ['ACSR', 'Cu', 'AAC', 'AAAC', 'ABC', 'ACSR', 'Cu'][i],
    insulation: i % 2 === 0 ? 'Bare' : 'PVC',
    picker: 'manual',
  })),

  // Pole — crossarms (max 7)
  crossarms: repeatRows(7, i => ({
    level: String(i + 1),
    existing: i % 2 === 0 ? 'E' : 'N',
    voltage: ['LV', '11', '22', '33', 'LVTX', '66', '11'][i],
    endSize: ['A', 'B', 'D', 'Z', 'A', 'B', 'D'][i],
    length: String(20 + (i % 3) * 3),
    arms: i % 2 === 0 ? '1' : '2',
    insulatorType: ['PN', 'PS', 'TT', 'DP', 'EDO', 'PN', 'PS'][i],
    armMaterial: ['T', 'S', 'C', 'T', 'S', 'C', 'T'][i],
    wires: i % 2 === 0 ? '3' : '6',
  })),

  // ElecEquip — equipment rating rows (max 5)
  equipmentRating: repeatRows(5, i => ({
    equipmentId: `SW-${i + 1}`,
    normalState: i % 2 === 0 ? 'Closed' : 'Open',
    operatingVoltage: ['11kV', '22kV', '33kV'][i % 3],
    voltageRating: ['11kV', '22kV', '33kV'][i % 3],
    fuseSize: ['100A', '63A', '40A'][i % 3],
  })),

  // ElecEquip — page 2 multi-item table (max 15)
  multiItems: repeatRows(15, i => ({
    ir: i % 2 === 0 ? 'I' : 'R',
    equipmentId: `EQ-${i + 1}`,
    equipmentType: ['Fused ABS', 'TX Fuse', 'Line Fuse', 'Solid Link', 'Lightning Arrester'][i % 5],
    manufacturer: 'ABB',
    model: `Model-${i + 1}`,
    serialNumber: `SN-${1000 + i}`,
    operatingVoltage: ['11kV', '22kV', '33kV'][i % 3],
    voltageRating: ['11kV', '22kV', '33kV'][i % 3],
    fuseSize: ['100A', '63A', '40A'][i % 3],
  })),

  // ZoneSub — additional equipment items (max 11)
  additionalItems: repeatRows(11, i => ({
    installedOrRemoved: i % 2 === 0 ? 'Installed' : 'Removed',
    equipmentId: `EQ-${i + 1}`,
    serialNo: `SN-${2000 + i}`,
    manufacturerModel: `ABB Model-${i + 1}`,
    description: `Test item ${i + 1} for coordinate calibration.`,
    drawingRef: `DRG-${100 + i}`,
  })),

  // ElecDistribution — cable circuit rows (max 3)
  cableRows: [
    { voltage: '11kV', phase: 'Three', cableSize: '95mm²',  material: 'ACSR', insulation: 'Bare', numberOfCables: '1', numberOfCores: '3', circuitLength: '150m' },
    { voltage: 'LV',   phase: 'Three', cableSize: '185mm²', material: 'Cu',   insulation: 'PVC',  numberOfCables: '1', numberOfCores: '4', circuitLength: '80m' },
    { voltage: 'LV',   phase: 'One',   cableSize: '16mm²',  material: 'Cu',   insulation: 'PVC',  numberOfCables: '1', numberOfCores: '2', circuitLength: '20m' },
  ],

  // LvBox — box entry rows (max 20)
  boxRows: repeatRows(20, i => ({
    equipIdNew: `NEW-${i + 1}`,
    equipIdOld: `OLD-${i + 1}`,
    address: `${i + 1} Test Road`,
    manufacturer: 'ABB',
    model: `Model-${i + 1}`,
    serviceOrDist: i % 2 === 0 ? 'Service' : 'Distribution',
    numberOfDisconnects: String((i % 4) + 1),
    fuseHolders: '3×100A',
    typeOfChange: 'New',
    reasonForRemoval: '',
    owner: 'Powerco',
  })),

  // DistributionTransformer — LV open point restoration rows (max 4)
  kPoints: [
    { location: 'Feeder pillar at 12 Smith Street', restored: true },
    { location: 'Pole P-204', restored: false },
    { location: 'Box B-9', restored: true },
    { location: 'Link cabinet LC-3', restored: true },
  ],

  // ── Shared text fields ───────────────────────────────────────────────────────
  comments:          'Test comment for coordinate calibration.',
  description:       'Test description for coordinate calibration.',
  location:          '42 Test Road, Hamilton',
}

// ─────────────────────────────────────────────────────────────────────────────
// STRING INFERENCE
// Called when no exact match exists in OVERRIDE_VALUES.
// ─────────────────────────────────────────────────────────────────────────────
function inferString(key) {
  const k = key.toLowerCase()
  if (k.includes('date'))                        return TODAY
  if (k.includes('name') && !k.includes('file')) return 'J. Smith'
  if (k.includes('contractor'))                  return 'Downer Group'
  if (k.includes('street') || k.includes('road')) return '42 Example Road'
  if (k.includes('city') || k.includes('town'))  return 'Hamilton'
  if (k.includes('district'))                    return 'Waikato'
  if (k.includes('comment') || k.includes('description') || k.includes('reason'))
                                                  return 'Test text for calibration.'
  if (k.includes('serial'))                      return 'SN-12345'
  if (k.includes('manufacturer'))                return 'ABB'
  if (k.includes('model'))                       return 'Model-X'
  if (k.includes('address') || k.includes('location')) return '42 Test Road'
  if (k.includes('voltage') || k.includes('kv')) return '11kV'
  if (k.includes('size') || k.includes('rating'))return '100A'
  if (k.includes('phase'))                       return 'R/W/B'
  if (k.includes('number') || k.includes('no') || k === 'id') return '12345'
  if (k.includes('file'))                        return 'file_001.gpx'
  if (k.includes('connection'))                  return 'Bushing'
  if (k.includes('type'))                        return 'New'
  if (k.includes('owner'))                       return 'Powerco'
  return 'Test'  // universal fallback — still shows up on the PDF
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY ARRAY INFERENCE
// Called when an array property is currently [] (zero length).
// Returns a useful default so multi-select and selection arrays get values.
// ─────────────────────────────────────────────────────────────────────────────
function inferEmptyArray(key) {
  switch (key) {
    // HV Inspection — must contain valid EQUIP_TYPE ids
    case 'selectedEquip':        return ['abs', 'dt']

    // Pole wizard multi-selects
    case 'accessories':          return ['Possum Guard', 'Aerial Stay']
    case 'otherServicesInTrench':return ['Gas']

    // Transformer — removed.reasonForRemoval
    case 'reasonForRemoval':     return ['End of Life']

    // 220F028B — fallback for circuit arrays if somehow empty
    // (normally caught by OVERRIDE_VALUES since they're always non-empty)
    case 'fCircuits': return [
      { rw: '416', wb: '418', br: '415', rn: '240', wn: '241', bn: '239' },
    ]
    case 'iCircuits': return [
      { r1r2: '2', w1w2: '3', b1b2: '1', neutral: true },
    ]

    default: return []  // leave unknown empty arrays alone
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE FILLER
// ─────────────────────────────────────────────────────────────────────────────

/** Recursively fill an object, returning a new object (never mutates). */
function fillObject(obj) {
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = fillValue(key, value)
  }
  return result
}

/** Determine the filled value for a single field. */
function fillValue(key, value) {
  // ── Rule 1: Always preserve signature blobs from userPrefs ────────────────
  if (key === 'signed' || key === 'wtlSigned' || key === 'fsSigned') return value

  // ── Rule 2: Preserve nulls ────────────────────────────────────────────────
  if (value === null) return null

  // ── Rule 3: OVERRIDE_VALUES — exact key match, type-aware ─────────────────
  if (key in OVERRIDE_VALUES) {
    const explicit = OVERRIDE_VALUES[key]
    const valIsArr = Array.isArray(value)
    const expIsArr = Array.isArray(explicit)
    // Only apply if both sides agree on array vs scalar, to avoid type confusion
    // (e.g. reasonForRemoval is a string in Pole wizard but an array in Transformer)
    if (valIsArr === expIsArr) return explicit
    // Type mismatch → fall through to type-based rules
  }

  // ── Rule 4: Booleans → true ───────────────────────────────────────────────
  if (typeof value === 'boolean') return true

  // ── Rule 5: Strings → infer from key name ─────────────────────────────────
  if (typeof value === 'string') return inferString(key)

  // ── Rules 6–9: Arrays ─────────────────────────────────────────────────────
  if (Array.isArray(value)) {
    if (value.length === 0) return inferEmptyArray(key)

    const first = value[0]
    if (typeof first === 'boolean')                    return value.map(() => true)
    if (typeof first === 'string')                     return value.map(() => inferString(key))
    if (typeof first === 'object' && first !== null)   return value.map(item => fillObject(item))
    return value  // unknown element type — leave as-is
  }

  // ── Rule 10: Nested objects → recurse ─────────────────────────────────────
  if (typeof value === 'object') return fillObject(value)

  // Anything else (number, symbol, …) — leave unchanged
  return value
}

/**
 * devFillState — React state updater function. Fills every field with one
 * plausible, realistic value — exactly as before. Explicitly clears
 * __calibrate so tapping back to this mode after using
 * devFillStateAllOptions() correctly returns to normal rendering.
 *
 * Pass directly to setD():
 *   setD(devFillState)
 *
 * Works for any wizard regardless of its specific state shape. For the Pole
 * wizard specifically, also merges in defaults for every field PoleWizard.jsx
 * only ever adds to state lazily (Pole IDs & Activity, New Pole Details,
 * Equipment on Pole, the rest of Accessories, and Work Description — see
 * withPoleExtras above) — without this, those fields stayed invisible to the
 * fill button until manually typed into or tapped first.
 *
 * @param {object} prevState - Current wizard form state (passed by React)
 * @returns {object}          Fully populated state for PDF calibration
 */
export function devFillState(prevState) {
  return { ...fillObject(withPoleExtras(prevState)), __calibrate: false }
}

/**
 * devFillStateAllOptions — React state updater function for seeing every
 * "1 of N" option's position on the page in a single render.
 *
 * Pass directly to setD():
 *   setD(devFillStateAllOptions)
 *
 * Fields like d.equipmentType or d.poleCode are a single string checked
 * against several named checkbox/ellipse options — no amount of dummy data
 * can make one string equal several different values at once, so filling
 * the wizard state can only ever show ONE option's tick per field. Setting
 * __calibrate = true instead tells the PDF renderer (renderFields /
 * renderGridRow in pdfFieldRenderer.js) to bypass each field's real
 * condition for this generation pass: every checkbox/ellipse is forced to
 * show, and every text field prints its own key name instead of its real
 * value — so you can see every option, AND every normally-hidden
 * "Other, specify"-style field, in one PDF, each one labelled.
 *
 * Still runs the normal realistic fill first underneath (including the Pole
 * wizard's lazily-added fields — see devFillState above), so anything NOT
 * driven by a FIELDS/GRIDS value() — e.g. the circuit-grid range checks in
 * DistributionTransformerPdfGenerator, which need real in-range numbers to
 * show their confirmed tick — still looks sensible.
 *
 * Tap the same dev "fill" button again (wired to toggle between this and
 * devFillState — see useWizardSetup.js) to go back to realistic data.
 *
 * @param {object} prevState - Current wizard form state (passed by React)
 * @returns {object}          State flagged so the next PDF render shows every option
 */
export function devFillStateAllOptions(prevState) {
  return { ...fillObject(withPoleExtras(prevState)), __calibrate: true }
}
