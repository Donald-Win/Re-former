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
 * What this does NOT replace
 * ───────────────────────────
 * Repeating-row tables (a circuit grid, a variable-length list of open
 * points) aren't a fixed set of named fields — they're the same handful of
 * column/row positions applied across however many data rows exist, often
 * with per-row pass/fail logic. Forcing a table into the single-field model
 * wouldn't reduce calibration effort (you already only set a few shared
 * numbers for an entire grid), so those stay as small procedural loops that
 * call the underlying draw.t / draw.ck primitives directly. See
 * DistributionTransformerPdfGenerator.js for a worked example of both
 * patterns living side by side in the same file.
 */

import { drawSignature } from './pdfDrawUtils'

/**
 * Draw every field in `fields` onto one page.
 *
 * @param {object}   ctx        - { pdfDoc, page, draw }
 *   pdfDoc  - The PDFDocument, needed only for type:'signature' fields.
 *   page    - The PDFPage this field set belongs to (same requirement).
 *   draw    - A createPageDrawer() instance already bound to that page.
 * @param {object}   fields     - Map of fieldName → field descriptor (see above).
 * @param {object}   d          - Wizard form state, passed to every value(d) fn.
 * @returns {Promise<void>}
 */
export async function renderFields(ctx, fields, d) {
  const { pdfDoc, page, draw } = ctx

  for (const [key, f] of Object.entries(fields)) {
    if (typeof f.value !== 'function') {
      console.warn(`[renderFields] Field "${key}" has no value() function — skipped`)
      continue
    }
    const value = f.value(d)

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
