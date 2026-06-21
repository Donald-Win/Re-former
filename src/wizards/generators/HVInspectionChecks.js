/**
 * HVInspectionChecks.js — Check-row and equipment-type constants for 220F028A.
 *
 * Extracted from HVInspectionPdfGenerator.js so that HVInspectionWizard.jsx
 * can import these synchronously for UI rendering without pulling pdf-lib into
 * the initial app bundle. HVInspectionPdfGenerator.js also imports from here,
 * keeping every constant defined in exactly one place.
 *
 * These are pure data objects with zero dependencies — safe to import anywhere.
 */

/** 13 equipment type columns shared by every check table on pages 1 and 2. */
export const EQUIP_TYPES = [
  { id: 'abs',  label: 'Air Break Switch',            short: 'ABS'  },
  { id: 'sa',   label: 'Surge Arrestor',               short: 'SA'   },
  { id: 'ohd',  label: 'O/H Distribution Line',       short: 'OHD'  },
  { id: 'ohst', label: 'O/H Sub-Trans. Line',          short: 'OHST' },
  { id: 'lr',   label: 'Line Recloser',                short: 'LR'   },
  { id: 'vr',   label: 'Voltage Regulators',           short: 'VR'   },
  { id: 'gmhv', label: 'Ground Mounted HV Switchgear', short: 'GMHV' },
  { id: 'hvug', label: 'HV U/G Cables',                short: 'HVUG' },
  { id: 'lvug', label: 'LV U/G Cables',                short: 'LVUG' },
  { id: 'hvmu', label: 'HV Metering Unit',             short: 'HVMU' },
  { id: 'dt',   label: 'Distribution Transformer',    short: 'DT'   },
  { id: 'pmc',  label: 'Pole Mounted Capacitor',       short: 'PMC'  },
  { id: 're',   label: 'Radio Equipment',              short: 'RE'   },
]

/** Page 1 — Visual Checks (15 rows). */
export const VISUAL_CHECKS = [
  { id: 'vc0',  label: 'Equipment "Fit For Service" Certificate'       },
  { id: 'vc1',  label: 'Contact Alignment'                             },
  { id: 'vc2',  label: 'Jumpers and Connections - Integrity'           },
  { id: 'vc3',  label: 'Busbars, Connections, Etc. Covered'           },
  { id: 'vc4',  label: 'Insulators / Bushings Correct'                },
  { id: 'vc5',  label: 'Conductor Terminations & Binders'             },
  { id: 'vc6',  label: 'Animal Access Barriers'                        },
  { id: 'vc7',  label: 'RI Mitigation'                                 },
  { id: 'vc8',  label: 'Correct Fusing'                                },
  { id: 'vc9',  label: 'Earthing and Bonding'                          },
  { id: 'vc10', label: 'Conductor Clearances'                          },
  { id: 'vc11', label: 'Labelling and Notices'                         },
  { id: 'vc12', label: 'Security and Access'                           },
  { id: 'vc13', label: 'Radio Equipment Visual Checks'                 },
  { id: 'vc14', label: 'Equipment Correctly Installed and Constructed' },
]

/** Page 2 — Operation Checks (4 rows, table rows 0–3). */
export const OPERATION_CHECKS = [
  { id: 'op0', label: 'Manual Operation'      },
  { id: 'op1', label: 'Automatic Operation'   },
  { id: 'op2', label: 'Protection Systems'    },
  { id: 'op3', label: 'Indications & Control' },
]

/** Page 2 — Performance Tests (13 rows, table rows 4–16). */
export const PERFORMANCE_CHECKS = [
  { id: 'pf0',  label: 'Contacts Timing'                   },
  { id: 'pf1',  label: 'Auxiliary Supplies'                 },
  { id: 'pf2',  label: 'Earth & Bond Resistance'           },
  { id: 'pf3',  label: 'Phasing'                            },
  { id: 'pf4',  label: 'Phase Rotation'                     },
  { id: 'pf5',  label: 'Polarity'                           },
  { id: 'pf6',  label: 'Conductor Continuity'              },
  { id: 'pf7',  label: 'Screen/Sheath Continuity'          },
  { id: 'pf8',  label: 'Insulation Resistance'             },
  { id: 'pf9',  label: 'Hi-Pot'                             },
  { id: 'pf10', label: 'Liven Under Test'                   },
  { id: 'pf11', label: 'Voltage Level Test'                },
  { id: 'pf12', label: 'Radio Equipment Performance Tests'  },
]

/** Page 2 — QA Checks (2 rows, below Performance). */
export const QA_CHECKS = [
  { id: 'qa0', label: 'Construction Standards' },
  { id: 'qa1', label: 'Safety Standards'        },
]

/** Page 2 — Documentation Checks (2 rows, below QA). */
export const DOC_CHECKS = [
  { id: 'dc0', label: 'As Built Info Recorded' },
  { id: 'dc1', label: 'Defects Recorded'        },
]

/** Page 2 — User-labelled Other / Specify rows (3 rows, at the bottom). */
export const OTHER_CHECKS = [
  { id: 'ot0', label: 'Other (Specify 1)' },
  { id: 'ot1', label: 'Other (Specify 2)' },
  { id: 'ot2', label: 'Other (Specify 3)' },
]
