/**
 * pdfFieldRenderer.js — Declarative field-driven PDF rendering.
 *
 * Problem this solves
 * ────────────────────
 * Every generator stores each field's coordinates in a LAYOUT object, then
 * has a SEPARATE line of code elsewhere that calls the matching drawing
 * primitive (t / tc / tr / ck / circ) with those coordinates. Changing a
 * field's alignment meant editing the LAYOUT object's shape (x → fieldLeft
 * + fieldWidth, or x → fieldRight) AND swapping the function name on a
 * different line — two edits, in two places, that have to stay in sync.
 *
 * renderFields() collapses that into ONE object per field: position,
 * alignment, type, and the value to draw all live together. To change a
 * field — move it, switch its alignment, change its font size — edit that
 * one object. Nothing else needs to change.
 *
 * Usage
 * ─────
 *   const FIELDS = {
 *     streetRoad: { type: 'text',  align: 'left',   x: 150, y: 219, size: 10,
 *                   value: d => d.streetRoad },
 *     earthLeg1:  { type: 'text',  align: 'right',  x: 263, y: 465, size: 10,
 *                   value: d => d.earthLeg1 },
 *     comments:   { type: 'text',  align: 'center', x: 60, width: 200, y: 90,
 *                   value: d => d.comments },
 *     asBuiltEE:  { type: 'check', x: 487, y: 315, value: d => d.asBuiltEE },
 *     phases:     { type: 'ellipse', cx: 216, cy: 428, rx: 16, ry: 7,
 *                   value: d => d.issued.phases === 'Three' },
 *     workDesc:   { type: 'wrap', x: 60, y: 90, maxWidth: 480, lineHeight: 14,
 *                   maxLines: 7, value: d => d.workDescription },
 *     signed:     { type: 'signature', x: 310, y: 478, maxW: 100, maxH: 22,
 *                   value: d => d.signed },
 *   }
 *
 *   await renderFields({ pdfDoc, page: p1, draw: draw1 }, FIELDS, d)
 *
 * Field shape
 * ───────────
 *   type        'text' | 'check' | 'ellipse' | 'wrap' | 'signature'
 *   align       type:'text' only — 'left' (default) | 'center' | 'right'
 *   x, y        Anchor point. For align:'left'/'right' this is the left or
 *               right edge respectively. For type:'check' it's the tick
 *               position. For type:'wrap'/'signature' it's the top-left.
 *   width       type:'text' align:'center' only — field box width.
 *   cx,cy,rx,ry         type:'ellipse'.
 *   maxWidth, lineHeight, maxLines   type:'wrap'.
 *   maxW, maxH                      type:'signature'.
 *   size        Optional font size override (text/wrap types).
 *   thickness   Optional checkmark stroke override (check type).
 *   borderWidth Optional ellipse stroke override (ellipse type).
 *   value(d)    REQUIRED. Returns the string/number to print for type:'text'
 *               or 'wrap', the boolean to show for type:'check' or
 *               'ellipse', or the signature data-URI for type:'signature'.
 *               Can be as simple as `d => d.streetRoad` or as involved as
 *               `d => d.ownership === 'Other'` or a multi-line computation —
 *               renderFields doesn't care, it just calls the function.
 *
 * What renderFields does NOT replace
 * ────────────────────────────────────
 * Repeating-row tables (a circuit grid, a variable-length list of open
 * points) aren't a fixed set of named fields — they're the same handful of
 * column/row positions applied across however many data rows exist, often
 * with per-row pass/fail logic. Forcing a table into the single-field model
 * wouldn't reduce calibration effort (you already only set a few shared
 * numbers for an entire grid). Those stay as small procedural loops — but
 * each cell within a row still needs the same alignment control as a
 * regular field, so this file also exports renderGridRow() and
 * renderMatrixRow() for that (see below). See
 * DistributionTransformerPdfGenerator.js for a worked example of all three
 * living side by side in the same file.
 *
 * renderGridRow(draw, cols, y, row, defaultSize)
 * ───────────────────────────────────────────────
 * For tables where each row is an object with known keys (e.g. one entry
 * from d.cableRows). Each column is defined once — position, alignment,
 * type, width — exactly like a FIELDS entry, minus `value` (which defaults
 * to `row[key]`, or can be computed via `value: row => ...` for a derived
 * column like "is this row's normalState 'Open'?").
 *
 *   const cols = {
 *     voltage:   { x: 55,  align: 'left' },
 *     cableSize: { x: 175, align: 'right' },
 *     phase:     { x: 350, align: 'center', width: 60 },
 *   }
 *   rows.forEach((row, i) => renderGridRow(draw, cols, rowY[i], row))
 *
 * renderMatrixRow(draw, colX, y, values, opts)
 * ──────────────────────────────────────────────
 * For tables where the "columns" are a fixed list of x positions (one per
 * circuit, or per equipment type) rather than named keys, and every cell in
 * the row shares the same alignment/type/size. `values[i]` is drawn at
 * `colX[i]`; `colX` entries that are `undefined` are skipped.
 *
 *   renderMatrixRow(draw, [143, 222, 302, 382], y,
 *     circuits.map(c => c.rw || ''), { align: 'center', size: 7.5 })
 *
 * Calibration mode — seeing every option at once
 * ──────────────────────────────────────────────────
 * Many fields are "1 of N" — a single string value (d.equipmentType,
 * d.poleCode, row.normalState…) checked against several named options, each
 * with its own checkbox/ellipse. Filling the wizard state with dummy data
 * can only ever satisfy ONE of those checks at a time, no matter what data
 * you put in — that's not a tooling gap, it's what "1 of N" means. Seeing
 * every option's position on the page at once means bypassing the value()
 * check entirely for that pass.
 *
 * renderFields() does exactly that whenever the wizard state has
 * `d.__calibrate` set to true (set by devFillStateAllOptions() in
 * devFillState.js — DEV only, tree-shaken from production same as the rest
 * of the calibration tooling):
 *   - type:'check' / type:'ellipse'  → forced to show, regardless of value()
 *   - type:'text' / type:'wrap'      → draws the FIELD'S OWN KEY instead of
 *     calling value(d), so every text position is visible (including ones
 *     normally hidden behind a different selection, e.g. an "Other, specify"
 *     field) and identifiable by name on the rendered page
 *   - type:'signature'               → skipped (no meaningful placeholder
 *     image to embed)
 *
 * renderFields() sets this mode as a side effect of reading `d.__calibrate`,
 * and renderGridRow() honours the same mode for the rest of that generation
 * pass — no generator code needs to change to support it. renderMatrixRow()
 * doesn't participate: its "columns" are independent per-circuit data
 * (circuit 1's reading isn't a mutually-exclusive alternative to circuit 2's),
 * so there's no "1 of N" ambiguity for it to resolve.
 */

import { drawSignature } from './pdfDrawUtils'

// ── Calibration mode ──────────────────────────────────────────────────────────
// Module-level so renderGridRow() can honour it without every call site
// needing to pass it through explicitly. Set as a side effect of
// renderFields() reading d.__calibrate — see file header for the full
// rationale. Not exported directly; isCalibrationMode() is the read-only view.
let _calibrationMode = false

/** True if the current generation pass has calibration mode active. */
export function isCalibrationMode() {
  return _calibrationMode
}

/**
 * The value to draw for one field/column while calibration mode is active —
 * bypasses value()/value(row) entirely so "1 of N" fields show every option.
 */
function calibrationOverrideValue(descriptor, key) {
  switch (descriptor.type) {
    case 'check':
    case 'ellipse':
      return true
    case 'signature':
      return null // drawSignature no-ops on a falsy value — effectively "skip"
    default: // 'text' and 'wrap'
      return key
  }
}

/**
 * Draw every field in `fields` onto one page.
 *
 * @param {object}   ctx        - { pdfDoc, page, draw }
 *   pdfDoc  - The PDFDocument, needed only for type:'signature' fields.
 *   page    - The PDFPage this field set belongs to (same requirement).
 *   draw    - A createPageDrawer() instance already bound to that page.
 * @param {object}   fields     - Map of fieldName → field descriptor (see above).
 * @param {object}   d          - Wizard form state, passed to every value(d) fn.
 *   Setting d.__calibrate = true (DEV only — see devFillStateAllOptions in
 *   devFillState.js) switches every field in this call, and every
 *   renderGridRow() call later in the same pass, into calibration mode.
 * @returns {Promise<void>}
 */
export async function renderFields(ctx, fields, d) {
  const { pdfDoc, page, draw } = ctx
  _calibrationMode = !!d?.__calibrate

  for (const [key, f] of Object.entries(fields)) {
    let value
    if (_calibrationMode) {
      value = calibrationOverrideValue(f, key)
    } else {
      if (typeof f.value !== 'function') {
        console.warn(`[renderFields] Field "${key}" has no value() function — skipped`)
        continue
      }
      value = f.value(d)
    }

    switch (f.type) {
      case 'text': {
        const align = f.align || 'left'
        if (align === 'center')     draw.tc(f.x, f.width, f.y, value, f.size)
        else if (align === 'right') draw.tr(f.x, f.y, value, f.size)
        else                         draw.t(f.x, f.y, value, f.size)
        break
      }
      case 'check':
        draw.ck(f.x, f.y, value, f.thickness)
        break
      case 'ellipse':
        draw.circ(f.cx, f.cy, f.rx, f.ry, value, f.borderWidth)
        break
      case 'wrap':
        draw.tWrap(f.x, f.y, value, f.maxWidth, f.size, f.lineHeight, f.maxLines)
        break
      case 'signature':
        await drawSignature(pdfDoc, page, value, f.x, f.y, f.maxW, f.maxH)
        break
      default:
        console.warn(`[renderFields] Field "${key}" has unknown type "${f.type}" — skipped`)
    }
  }
}

/**
 * Draw one row of a NAMED-COLUMN table (see file header for the full
 * picture). Each column is a small descriptor — the same shape as a FIELDS
 * entry, minus `value`:
 *
 *   type      'text' (default) | 'check' | 'ellipse'
 *   align     type:'text' only — 'left' (default) | 'center' | 'right'
 *   x, y is supplied by the caller — column descriptors only need x
 *   width     type:'text' align:'center' only
 *   cx,cy,rx,ry      type:'ellipse' (cy defaults to the row's y if omitted)
 *   size      optional font size override
 *   thickness, borderWidth   optional stroke overrides
 *   value(row)  optional — computed value instead of `row[key]`. Use this
 *               for a derived column, e.g. a checkbox driven by
 *               `row.normalState === 'Open'` rather than a literal key.
 *
 * Honours the same calibration mode as renderFields() (see file header) —
 * if the most recent renderFields() call in this generation pass had
 * d.__calibrate set, every column here shows its forced/placeholder value
 * too, with no extra wiring needed at the call site.
 *
 * @param {object} draw        - createPageDrawer() instance for this row's page
 * @param {object} cols        - Map of columnName → column descriptor
 * @param {number} y           - Top-origin Y for this row
 * @param {object} row         - This row's data object
 * @param {number} [defaultSize] - Font size used when a column doesn't set its own `size`
 */
export function renderGridRow(draw, cols, y, row, defaultSize) {
  for (const [key, col] of Object.entries(cols)) {
    const value = _calibrationMode
      ? calibrationOverrideValue(col, key)
      : (col.value ? col.value(row) : row[key])
    const size  = col.size ?? defaultSize
    const type  = col.type || 'text'

    switch (type) {
      case 'text': {
        const align = col.align || 'left'
        if (align === 'center')     draw.tc(col.x, col.width, y, value, size)
        else if (align === 'right') draw.tr(col.x, y, value, size)
        else                         draw.t(col.x, y, value, size)
        break
      }
      case 'check':
        draw.ck(col.x, y, value, col.thickness)
        break
      case 'ellipse':
        draw.circ(col.cx ?? col.x, col.cy ?? y, col.rx, col.ry, value, col.borderWidth)
        break
      default:
        console.warn(`[renderGridRow] Column "${key}" has unknown type "${type}" — skipped`)
    }
  }
}

/**
 * Draw one row of a POSITIONAL-COLUMN matrix (see file header). Used when
 * the "columns" are a fixed list of x positions — one per circuit, one per
 * equipment type — rather than named keys, and every cell in the row shares
 * the same alignment/type/size. `values[i]` is drawn at `colX[i]`; entries
 * in `colX` that are `undefined` are skipped (matches the original
 * `if (x !== undefined)` guards used throughout these grids).
 *
 * @param {object}   draw          - createPageDrawer() instance for this row's page
 * @param {number[]} colX          - x position for each column, in order
 * @param {number}   y             - Top-origin Y for this row
 * @param {Array}    values        - Value for each column, in the same order as colX
 * @param {object}   [opts]
 * @param {string}   [opts.align='left']  - 'left' | 'center' | 'right' (type:'text' only)
 * @param {number}   [opts.width]         - Required for align:'center'
 * @param {number}   [opts.size]          - Font size override
 * @param {string}   [opts.type='text']   - 'text' | 'check'
 * @param {number}   [opts.thickness]     - type:'check' stroke override
 */
export function renderMatrixRow(draw, colX, y, values, opts = {}) {
  const { align = 'left', width, size, type = 'text', thickness } = opts
  colX.forEach((x, i) => {
    if (x === undefined) return
    const value = values[i]
    if (type === 'check') {
      draw.ck(x, y, value, thickness)
    } else if (align === 'center') {
      draw.tc(x, width, y, value, size)
    } else if (align === 'right') {
      draw.tr(x, y, value, size)
    } else {
      draw.t(x, y, value, size)
    }
  })
}
