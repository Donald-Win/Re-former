/**
 * devFillState.js — Development-only utility to populate wizard form state
 * with plausible dummy data for PDF coordinate calibration.
 *
 * Dead-code eliminated in production builds (Rollup tree-shakes the import
 * because all call-sites are inside `import.meta.env.DEV ? ... : undefined`).
 *
 * ── Usage in any wizard ────────────────────────────────────────────────────
 *   import { devFillState } from '../shared/devFillState'
 *
 *   // Inside the component, after usePdfGenerate:
 *   const handleDevFill = import.meta.env.DEV ? () => setD(devFillState) : undefined
 *
 *   // On the WizardShell:
 *   <WizardShell ... onFillTestData={handleDevFill}>
 *
 * ── Algorithm ──────────────────────────────────────────────────────────────
 * devFillState is a React state-updater function: (prevState) => nextState.
 * Passing it directly to setD() works because React's setState accepts
 * an updater function — no wrapper needed.
 *
 * Processing rules (applied in order):
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
 */

// ── Today's date in YYYY-MM-DD (HTML date input format) ───────────────────────
const TODAY = new Date().toISOString().slice(0, 10)

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

  // Circuit-centric voltage checks — 2 circuits with readings in acceptable range
  // (R–W/W–B/B–R: 412–422 V  ·  R–N/W–N/B–N: 238–244 V)
  fCircuits: [
    { rw: '416', wb: '418', br: '415', rn: '240', wn: '241', bn: '239' },
    { rw: '417', wb: '419', br: '416', rn: '241', wn: '240', bn: '240' },
  ],

  // Circuit-centric phasing/paralleling checks — 2 circuits, <10 V, neutrals connected
  iCircuits: [
    { r1r2: '2', w1w2: '3', b1b2: '1', neutral: true },
    { r1r2: '3', w1w2: '2', b1b2: '2', neutral: true },
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
 * devFillState — React state updater function.
 *
 * Pass directly to setD():
 *   setD(devFillState)
 *
 * Works for any wizard regardless of its specific state shape.
 *
 * @param {object} prevState - Current wizard form state (passed by React)
 * @returns {object}          Fully populated state for PDF calibration
 */
export function devFillState(prevState) {
  return fillObject(prevState)
}
