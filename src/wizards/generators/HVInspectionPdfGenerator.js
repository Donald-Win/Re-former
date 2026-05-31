/**
 * HVInspectionPdfGenerator.js — PDF generator for 220F028A
 * (Pre-Commissioning HV Inspection Certificate).
 *
 * Extracted from HVInspectionWizard.jsx as part of the architectural migration
 * to standalone generator files using the pdfDrawUtils engine.
 *
 * EQUIP_TYPES and all check-row arrays are exported so HVInspectionWizard.jsx
 * can import them directly, avoiding duplicate definitions.
 *
 * Template
 * ────────
 * The PDF template is fetched once per session and cached in memory via
 * fetchPdfTemplate(), so repeat previews cost no network I/O.
 *
 * LAYOUT coordinates
 * ──────────────────
 * All Y values are top-origin (CSS / screen style), same as every other
 * re-former generator. The createPageDrawer helpers convert to pdf-lib
 * bottom-origin internally.
 *
 * Derivation formulae (from original pdf-lib bottom-origin coords):
 *
 *   Tick x   =  orig_col_centre_x − 5
 *               (shifts left-edge of stroke to align within the cell)
 *
 *   Tick Y   =  834 − orig_bottom_y
 *               (compensates for the +6 / −2 offsets in the old tick helper
 *               vs the ck() geometry in pdfDrawUtils)
 *
 *   Text Y   =  842 − orig_bottom_y − fontSize
 *               (standard bottom-origin → top-origin conversion for text)
 *
 *   Sig  Y   =  842 − (pdfY_bottom + imgHeight)
 *               (cssY is the TOP of the image in top-origin coords)
 *
 * Usage:
 *   import { generateHvPdf } from './generators/HVInspectionPdfGenerator'
 *   const { pdfBytes, ... } = usePdfGenerate(generateHvPdf)
 *
 * @param {object} d      – Wizard form state (see HVInspectionWizard.jsx)
 * @param {Array}  photos – Array of { dataUrl: string, name?: string }
 * @returns {Promise<Uint8Array>}
 */

import { PDFDocument, StandardFonts } from 'pdf-lib'
import {
  fetchPdfTemplate,
  createPageDrawer,
  drawSignature,
  DEFAULT_INK,
  A4_HEIGHT,
} from '../../shared/pdfDrawUtils'
import { appendPhotosToPdf } from '../../shared/appendPhotosToPdf'

// ── Template URL ──────────────────────────────────────────────────────────────
const getTemplateUrl = () =>
  `${import.meta.env.BASE_URL}forms/220F028A.pdf`

// ─────────────────────────────────────────────────────────────────────────────
// FORM SCHEMA
// Exported so HVInspectionWizard.jsx can import them instead of re-defining.
// ─────────────────────────────────────────────────────────────────────────────

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
  { id: 'vc0',  label: 'Equipment "Fit For Service" Certificate'    },
  { id: 'vc1',  label: 'Contact Alignment'                          },
  { id: 'vc2',  label: 'Jumpers and Connections - Integrity'        },
  { id: 'vc3',  label: 'Busbars, Connections, Etc. Covered'        },
  { id: 'vc4',  label: 'Insulators / Bushings Correct'             },
  { id: 'vc5',  label: 'Conductor Terminations & Binders'          },
  { id: 'vc6',  label: 'Animal Access Barriers'                     },
  { id: 'vc7',  label: 'RI Mitigation'                              },
  { id: 'vc8',  label: 'Correct Fusing'                             },
  { id: 'vc9',  label: 'Earthing and Bonding'                       },
  { id: 'vc10', label: 'Conductor Clearances'                       },
  { id: 'vc11', label: 'Labelling and Notices'                      },
  { id: 'vc12', label: 'Security and Access'                        },
  { id: 'vc13', label: 'Radio Equipment Visual Checks'              },
  { id: 'vc14', label: 'Equipment Correctly Installed and Constructed' },
]

/** Page 2 — Operation Checks (4 rows, table rows 0–3). */
export const OPERATION_CHECKS = [
  { id: 'op0', label: 'Manual Operation'       },
  { id: 'op1', label: 'Automatic Operation'    },
  { id: 'op2', label: 'Protection Systems'     },
  { id: 'op3', label: 'Indications & Control'  },
]

/** Page 2 — Performance Tests (13 rows, table rows 4–16). */
export const PERFORMANCE_CHECKS = [
  { id: 'pf0',  label: 'Contacts Timing'                  },
  { id: 'pf1',  label: 'Auxiliary Supplies'                },
  { id: 'pf2',  label: 'Earth & Bond Resistance'          },
  { id: 'pf3',  label: 'Phasing'                           },
  { id: 'pf4',  label: 'Phase Rotation'                    },
  { id: 'pf5',  label: 'Polarity'                          },
  { id: 'pf6',  label: 'Conductor Continuity'             },
  { id: 'pf7',  label: 'Screen/Sheath Continuity'         },
  { id: 'pf8',  label: 'Insulation Resistance'            },
  { id: 'pf9',  label: 'Hi-Pot'                            },
  { id: 'pf10', label: 'Liven Under Test'                  },
  { id: 'pf11', label: 'Voltage Level Test'               },
  { id: 'pf12', label: 'Radio Equipment Performance Tests' },
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

// Maps Other-row index → the form-state key holding the user-typed label text.
const OTHER_LABEL_KEYS = ['other1', 'other2', 'other3']

// Performance rows occupy the lower portion of the combined p2 rowY array.
const PERF_ROW_OFFSET = 4  // Operation occupies rows 0–3; Performance starts at 4

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT
// All Y values are top-origin (CSS / screen style).
// The createPageDrawer helpers convert to pdf-lib bottom-origin internally.
//
// Tick column X  =  original pdf-lib col-centre x  − 5
// Tick row Y     =  834 − original pdf-lib bottom-origin y
// Text Y         =  842 − original pdf-lib bottom-origin y  − fontSize
// Sig  Y         =  842 − (pdfY_bottom + imgHeight)   [top of image, top-origin]
// ─────────────────────────────────────────────────────────────────────────────

const LAYOUT = {

  // ── Page 1 ─────────────────────────────────────────────────────────────────

  p1: {
    // Composite project title drawn at top of page 1.
    // Composed from: npJobNumber, projectName, streetRoad, cityTown, siteId.
    title: { x: 135, y: 107, size: 10 },

    // Visual Checks table (15 rows × 13 equipment-type columns).
    visual: {
      // colX[i] — tick left-edge x for equipment-type column i  (orig P1_COL_X − 5)
      colX: [226, 251, 276, 302, 327, 352, 378, 403, 428, 453, 479, 504, 530],
      // rowY[i] — tick top-origin Y for visual-check row i       (834 − orig P1_ROW_Y)
      rowY: [404, 428, 451, 479, 501, 525, 546, 563, 580, 597, 615, 632, 647, 666, 686],
    },
  },

  // ── Page 2 ─────────────────────────────────────────────────────────────────

  p2: {
    // Operation and Performance tables share the same 13-column layout.
    // colX[i] — tick left-edge x  (orig P2_COL_X − 5)
    colX: [244, 268, 292, 316, 340, 364, 388, 412, 436, 460, 484, 508, 532],

    // Combined row array for Operation (0–3) and Performance (4–16).
    // rowY[i] — tick top-origin Y  (834 − orig P2_ROW_Y)
    rowY: [241, 259, 276, 296, 314, 333, 351, 370, 388, 407, 425, 444, 462, 481, 499, 518, 541],

    // QA rows: Construction Standards, Safety Standards
    // (834 − orig P2_QA_Y)
    qaRowY: [565, 584],

    // Documentation rows: As Built Info Recorded, Defects Recorded
    // (834 − orig P2_DOC_Y)
    docRowY: [602, 621],

    // Other (Specify) rows — user-typed label plus per-equip-type tick marks.
    other: {
      // colX[i] — tick left-edge x  (orig P2_OTHER_COL_X − 5)
      colX:      [244, 268, 292, 316, 340, 364, 388, 412, 435, 459, 483, 508, 532],
      // rowY[i] — tick top-origin Y  (834 − orig P2_OTHER_Y)
      rowY:      [640, 658, 677],
      // labelRowY[i] — text baseline Y for the label (842 − orig P2_OTHER_Y − 9)
      labelRowY: [639, 657, 676],
      labelX:    135,
      labelSize: 9,
    },
  },

  // ── Page 3 — Signatures ─────────────────────────────────────────────────────
  // size: 10 for all text fields (matches original; kept explicit for clarity).
  // Sig cssY: top-of-image in top-origin coords = 842 − (pdfY_bottom + 22).

  p3: {
    wtlName: { x: 193, y: 115, size: 10 },            // WTL printed name
    wtlSig:  { x: 383, y: 106, maxW: 100, maxH: 22 }, // WTL signature image
    certNo:  { x: 193, y: 141, size: 10 },            // WTL certificate number
    date:    { x: 383, y: 141, size: 10 },            // Date work completed (same row)
    fsName:  { x: 173, y: 192, size: 10 },            // Field Switcher printed name
    fsSig:   { x: 383, y: 182, maxW: 100, maxH: 22 }, // Field Switcher signature image
    sinNapa: { x: 140, y: 229, size: 10 },            // Field Switcher SIN / NAPA ID
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate the Pre-Commissioning HV Inspection Certificate PDF.
 *
 * Signature images are embedded via drawSignature(), which scales each image
 * to fit within the maxW × maxH bounding box while preserving aspect ratio —
 * an improvement over the original code that stretched images to a fixed size.
 *
 * @param {object} d      – Full wizard form state
 * @param {Array}  photos – Photo attachments  [{ dataUrl, name? }]
 * @returns {Promise<Uint8Array>}
 */
export async function generateHvPdf(d, photos = []) {

  // ── Load template (cached after first call) ──────────────────────────────
  const templateBytes = await fetchPdfTemplate(getTemplateUrl())
  const pdfDoc        = await PDFDocument.load(templateBytes)
  const font          = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const [p1, p2, p3] = pdfDoc.getPages()

  // Bind a drawing helper to each of the three form pages.
  const draw1 = createPageDrawer(p1, font, DEFAULT_INK, A4_HEIGHT)
  const draw2 = createPageDrawer(p2, font, DEFAULT_INK, A4_HEIGHT)
  const draw3 = createPageDrawer(p3, font, DEFAULT_INK, A4_HEIGHT)

  // ── Page 1 — Project Title ───────────────────────────────────────────────
  const titleText = [d.npJobNumber, d.projectName, d.streetRoad, d.cityTown, d.siteId]
    .filter(Boolean).join(' — ')
  draw1.t(LAYOUT.p1.title.x, LAYOUT.p1.title.y, titleText, LAYOUT.p1.title.size)

  // ── Page 1 — Visual Checks (15 rows × 13 columns) ───────────────────────
  const { colX: p1ColX, rowY: p1RowY } = LAYOUT.p1.visual
  VISUAL_CHECKS.forEach((check, rowIdx) => {
    const equipCols = d.visualChecks?.[check.id] || {}
    EQUIP_TYPES.forEach((equip, colIdx) => {
      draw1.ck(p1ColX[colIdx], p1RowY[rowIdx], equipCols[equip.id])
    })
  })

  // ── Page 2 — Operation Checks (4 rows, rowY indices 0–3) ────────────────
  const { colX: p2ColX, rowY: p2RowY } = LAYOUT.p2
  OPERATION_CHECKS.forEach((check, rowIdx) => {
    const equipCols = d.operationChecks?.[check.id] || {}
    EQUIP_TYPES.forEach((equip, colIdx) => {
      draw2.ck(p2ColX[colIdx], p2RowY[rowIdx], equipCols[equip.id])
    })
  })

  // ── Page 2 — Performance Tests (13 rows, rowY indices 4–16) ─────────────
  PERFORMANCE_CHECKS.forEach((check, rowIdx) => {
    const equipCols = d.performanceChecks?.[check.id] || {}
    EQUIP_TYPES.forEach((equip, colIdx) => {
      draw2.ck(p2ColX[colIdx], p2RowY[rowIdx + PERF_ROW_OFFSET], equipCols[equip.id])
    })
  })

  // ── Page 2 — QA Checks ──────────────────────────────────────────────────
  QA_CHECKS.forEach((check, rowIdx) => {
    const equipCols = d.qaChecks?.[check.id] || {}
    EQUIP_TYPES.forEach((equip, colIdx) => {
      draw2.ck(p2ColX[colIdx], LAYOUT.p2.qaRowY[rowIdx], equipCols[equip.id])
    })
  })

  // ── Page 2 — Documentation Checks ───────────────────────────────────────
  DOC_CHECKS.forEach((check, rowIdx) => {
    const equipCols = d.docChecks?.[check.id] || {}
    EQUIP_TYPES.forEach((equip, colIdx) => {
      draw2.ck(p2ColX[colIdx], LAYOUT.p2.docRowY[rowIdx], equipCols[equip.id])
    })
  })

  // ── Page 2 — Other / Specify rows ───────────────────────────────────────
  const { colX: otherColX, rowY: otherRowY, labelRowY, labelX, labelSize } = LAYOUT.p2.other
  OTHER_CHECKS.forEach((check, rowIdx) => {
    const equipCols = d.otherChecks?.[check.id] || {}
    const labelText = d[OTHER_LABEL_KEYS[rowIdx]]
    if (labelText) draw2.t(labelX, labelRowY[rowIdx], labelText, labelSize)
    EQUIP_TYPES.forEach((equip, colIdx) => {
      draw2.ck(otherColX[colIdx], otherRowY[rowIdx], equipCols[equip.id])
    })
  })

  // ── Page 3 — Signature text fields ──────────────────────────────────────
  const s = LAYOUT.p3
  draw3.t(s.wtlName.x, s.wtlName.y, d.wtlName,          s.wtlName.size)
  draw3.t(s.certNo.x,  s.certNo.y,  d.wtlCertNo,        s.certNo.size)
  draw3.t(s.date.x,    s.date.y,    d.dateWorkCompleted, s.date.size)
  draw3.t(s.fsName.x,  s.fsName.y,  d.fsName,           s.fsName.size)
  draw3.t(s.sinNapa.x, s.sinNapa.y, d.fsSinNapa,        s.sinNapa.size)

  // ── Page 3 — Signature images ────────────────────────────────────────────
  // drawSignature() scales each image to fit within maxW × maxH while
  // preserving aspect ratio; silently no-ops for falsy / invalid values.
  await drawSignature(
    pdfDoc, p3, d.wtlSigned,
    s.wtlSig.x, s.wtlSig.y, s.wtlSig.maxW, s.wtlSig.maxH, A4_HEIGHT,
  )
  await drawSignature(
    pdfDoc, p3, d.fsSigned,
    s.fsSig.x,  s.fsSig.y,  s.fsSig.maxW,  s.fsSig.maxH,  A4_HEIGHT,
  )

  // ── Photos (appended as additional pages) ────────────────────────────────
  if (photos && photos.length > 0) await appendPhotosToPdf(pdfDoc, photos)

  return new Uint8Array(await pdfDoc.save())
}
