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

// ─────────────────────────────────────────────────────────────────────────────
// NOT-APPLICABLE (SHADED) CELL DEFINITIONS  (v2.20.3)
// ─────────────────────────────────────────────────────────────────────────────
// These mark which equipment-type columns are shaded/not-applicable for each
// check row on the printed form — used by HVInspectionWizard.jsx to hide
// checkboxes that don't apply to a given equipment type from the fill UI.
//
// Previously this lived in HVInspectionWizard.jsx as two objects (P1_NA,
// P2_NA) keyed by raw ARRAY INDEX into VISUAL_CHECKS/OPERATION_CHECKS/
// PERFORMANCE_CHECKS and EQUIP_TYPES — e.g. `0: [7, 8, 12]` meant "row index
// 0 is N/A for column indices 7, 8, 12". That's a silent trap: if any of
// those four arrays above is ever reordered, or a row/column is inserted or
// removed anywhere but the end, every N/A entry after that point silently
// shifts to describe the WRONG row or the WRONG equipment column — with no
// error, just a form that quietly shades (or fails to shade) the wrong
// cells. PERF_ROW_OFFSET (the "+4" used to read Performance rows out of the
// same P2_NA object as Operation) was a second, independent place this same
// index coupling had to be kept in sync by hand.
//
// The maps below are keyed by the check's `id` and list the applicable
// EQUIPMENT TYPE IDS (not array indices) that are N/A for that check — so
// they stay correct no matter how the arrays above are reordered or edited,
// and there's no separate offset to maintain for Performance vs Operation.
// idsAt() below is only used once, at module load, to translate the
// original index-based data into id-based data — new entries added later
// should be written directly with equipment ids for clarity.

const EQUIP_IDS = EQUIP_TYPES.map(e => e.id)
const idsAt = (...indices) => indices.map(i => EQUIP_IDS[i])

/** Keyed by VISUAL_CHECKS id → array of N/A EQUIP_TYPES ids. */
export const VISUAL_NA = {
  vc0:  idsAt(7, 8, 12),
  vc1:  idsAt(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12),
  vc2:  idsAt(12),
  vc3:  idsAt(0, 1, 2, 3, 4, 5, 6, 11, 12),
  vc4:  idsAt(1, 6, 8, 12),
  vc5:  idsAt(0, 1, 4, 5, 6, 7, 8, 9, 10, 11, 12),
  vc6:  idsAt(1, 6),
  vc7:  idsAt(0, 1, 4, 5, 6, 7, 8, 9, 10, 11, 12),
  vc8:  idsAt(0, 1, 3, 4, 5, 7, 9, 12),
  vc10: idsAt(6, 12),
  vc11: idsAt(1, 12),
  vc12: idsAt(1, 11, 12),
  vc13: idsAt(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11),
  // vc9 and vc14 have no N/A columns — every equipment type applies.
}

/** Keyed by OPERATION_CHECKS id → array of N/A EQUIP_TYPES ids. */
export const OPERATION_NA = {
  op0: idsAt(1, 2, 3, 7, 8, 9, 10, 11, 12),
  op1: idsAt(0, 1, 2, 3, 6, 7, 8, 9, 10, 12),
  op2: idsAt(0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12),
  op3: idsAt(0, 1, 2, 3, 7, 8, 9, 10, 11, 12),
}

/** Keyed by PERFORMANCE_CHECKS id → array of N/A EQUIP_TYPES ids. */
export const PERFORMANCE_NA = {
  pf0:  idsAt(1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12),
  pf1:  idsAt(0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12),
  pf2:  idsAt(2, 3),
  pf3:  idsAt(1, 11, 12),
  pf4:  idsAt(0, 1, 2, 3, 4, 5, 6, 7, 11, 12),
  pf5:  idsAt(0, 1, 2, 3, 4, 5, 6, 7, 11, 12),
  pf6:  idsAt(0, 1, 2, 3, 4, 5, 6, 9, 10, 11, 12),
  pf7:  idsAt(0, 1, 2, 3, 4, 5, 11),
  pf8:  idsAt(0, 1, 2, 3, 10, 11, 12),
  pf9:  idsAt(0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12),
  pf10: idsAt(0, 1, 2, 4, 6, 8, 9, 10, 11, 12),
  pf11: idsAt(0, 1, 2, 3, 4, 6, 7, 8, 9, 11, 12),
  pf12: idsAt(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11),
}
