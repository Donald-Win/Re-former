/**
 * pdfDrawUtils.js — Centralised PDF drawing primitives for all re-former wizards.
 *
 * All functions are pure (no React hooks / state). Pass page/pdfDoc contexts
 * explicitly so the same helpers work across every wizard generator.
 *
 * Template cache
 * ──────────────
 * fetchPdfTemplate(url) fetches the raw PDF once and stores the ArrayBuffer.
 * Returns a .slice(0) clone on every subsequent call so the cached master copy
 * is never mutated by pdf-lib's load().
 *
 * Concurrent-fetch deduplication: if two wizards call fetchPdfTemplate(url)
 * at the same time before the first fetch has resolved, only one HTTP request
 * is made — both callers await the same in-flight Promise.  Without this,
 * two simultaneous opens of the same form template each fire a separate fetch,
 * and whichever finishes last clobbers the cache with a potentially
 * already-detached ArrayBuffer.
 *
 * Drawing helpers
 * ───────────────
 *  t           — plain text at (x, y)
 *  tc          — horizontally centred text within a field
 *  ck          — two-line checkmark / tick (matches the hand-drawn ink style)
 *  wrapText    — break a string into lines that fit within maxWidth pts
 *  tWrap       — draw multi-line wrapped text starting at (x, y)
 *  drawSignature — embed a base64 PNG/JPEG signature image, auto-scaled
 */

import { rgb } from 'pdf-lib'

// ── Default ink colour — deep navy, matches premium ballpoint blue ────────────
export const DEFAULT_INK = rgb(0 / 255, 20 / 255, 160 / 255)

// ── Template cache ────────────────────────────────────────────────────────────
// templateCache:       url → ArrayBuffer  (resolved bytes — never exposed directly)
// templateInFlight:    url → Promise<ArrayBuffer>  (in-progress fetches)
//
// Keeping two separate maps means:
//   1. A completed fetch is served from templateCache as a .slice(0) clone.
//   2. A concurrent second call during an in-progress fetch awaits the same
//      Promise from templateInFlight — only one HTTP request ever fires per URL.
//   3. If a fetch fails, the in-flight Promise rejects and is removed from the
//      map so the next call tries again (no permanent poison-pill).
const templateCache    = {}
const templateInFlight = {}

/**
 * Fetch a PDF template from `url`, cache the ArrayBuffer on the first call,
 * and return a fresh `.slice(0)` clone on every call.
 *
 * Using `.slice(0)` means:
 *   - The cached master is never detached / mutated by PDFDocument.load()
 *   - Each generator gets its own independent buffer
 *
 * @param {string} url - Absolute or base-relative URL, e.g. `import.meta.env.BASE_URL + 'forms/360S014EG.pdf'`
 * @returns {Promise<ArrayBuffer>}
 */
export async function fetchPdfTemplate(url) {
  // ── 1. Byte cache hit — fastest path ────────────────────────────────────
  if (templateCache[url]) {
    return templateCache[url].slice(0)
  }

  // ── 2. In-flight deduplication — second caller joins existing fetch ──────
  if (!templateInFlight[url]) {
    // ── 3. First caller — start the fetch and register the Promise ──────────
    templateInFlight[url] = fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`fetchPdfTemplate: HTTP ${response.status} for ${url}`)
        }
        return response.arrayBuffer()
      })
      .then(buffer => {
        templateCache[url] = buffer        // store master
        delete templateInFlight[url]       // no longer in-flight
        return buffer
      })
      .catch(err => {
        delete templateInFlight[url]       // allow retry on next call
        throw err
      })
  }

  // Both the original and any concurrent callers await the same Promise.
  // When it resolves we get the master buffer and return a clone of it.
  const buf = await templateInFlight[url]
  return buf.slice(0)
}

/**
 * Manually prime the cache with an already-fetched ArrayBuffer.
 * Useful in tests or when you have the bytes from another source.
 */
export function primePdfTemplateCache(url, arrayBuffer) {
  templateCache[url] = arrayBuffer
}

/**
 * Clear all or a single cached template (useful in tests / dev tools).
 */
export function clearPdfTemplateCache(url) {
  if (url) {
    delete templateCache[url]
    delete templateInFlight[url]
  } else {
    Object.keys(templateCache).forEach(k => delete templateCache[k])
    Object.keys(templateInFlight).forEach(k => delete templateInFlight[k])
  }
}

// ── PDF page height constant (A4 portrait) ────────────────────────────────────
// All wizards use A4 (842 pt tall). Pass `pageHeight` explicitly if you ever
// need to support a different page size.
export const A4_HEIGHT = 842

// ─────────────────────────────────────────────────────────────────────────────
// DRAWING PRIMITIVES
// All functions use pdf-lib bottom-origin coordinates internally.
// The `cssY` parameter is top-origin (like CSS / screen coords) for convenience —
// the helpers convert automatically using `pageHeight`.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw plain text at (x, cssY).
 *
 * @param {PDFPage}  page
 * @param {number}   x          - Left edge, pdf-lib pts
 * @param {number}   cssY       - Top-origin Y in pts (converted internally)
 * @param {*}        text       - Will be coerced to string; null/undefined/'' → no-op
 * @param {number}   [size=8.5]
 * @param {PDFFont}  font
 * @param {RGB}      [color]    - Defaults to DEFAULT_INK
 * @param {number}   [pageHeight=A4_HEIGHT]
 */
export function t(page, x, cssY, text, size = 8.5, font, color = DEFAULT_INK, pageHeight = A4_HEIGHT) {
  if (text === null || text === undefined || text === '') return
  const str = String(text)
  page.drawText(str, {
    x,
    y: pageHeight - cssY - size,
    size,
    font,
    color,
  })
}

/**
 * Draw text centred horizontally within a field defined by `fieldLeft` and `fieldWidth`.
 *
 * @param {PDFPage}  page
 * @param {number}   fieldLeft  - Left edge of the field box
 * @param {number}   fieldWidth - Width of the field box
 * @param {number}   cssY
 * @param {*}        text
 * @param {number}   [size=8.5]
 * @param {PDFFont}  font
 * @param {RGB}      [color]
 * @param {number}   [pageHeight=A4_HEIGHT]
 */
export function tc(
  page,
  fieldLeft,
  fieldWidth,
  cssY,
  text,
  size = 8.5,
  font,
  color = DEFAULT_INK,
  pageHeight = A4_HEIGHT,
) {
  if (text === null || text === undefined || text === '') return
  const str = String(text)
  const w = font.widthOfTextAtSize(str, size)
  const x = fieldLeft + fieldWidth / 2 - w / 2
  page.drawText(str, {
    x,
    y: pageHeight - cssY - size,
    size,
    font,
    color,
  })
}

/**
 * Draw a two-stroke checkmark (✓) centred on (x, cssY).
 *
 * The tick geometry matches the "hand-drawn ballpoint" style used across all
 * existing wizards: a short down-left stroke followed by a longer up-right stroke.
 *
 *   stroke 1: (x, by-6) → (x+3, by-9)   [the short left leg]
 *   stroke 2: (x+3, by-9) → (x+9, by-1) [the long right leg]
 *
 * @param {PDFPage}  page
 * @param {number}   x
 * @param {number}   cssY
 * @param {boolean}  show       - If falsy, nothing is drawn (safe to call unconditionally)
 * @param {number}   [thickness=1.5]
 * @param {RGB}      [color]
 * @param {number}   [pageHeight=A4_HEIGHT]
 */
export function ck(
  page,
  x,
  cssY,
  show,
  thickness = 1.5,
  color = DEFAULT_INK,
  pageHeight = A4_HEIGHT,
) {
  if (!show) return
  const by = pageHeight - cssY - 2
  page.drawLine({
    start: { x,         y: by - 6 },
    end:   { x: x + 3,  y: by - 9 },
    thickness,
    color,
    opacity: 1,
  })
  page.drawLine({
    start: { x: x + 3,  y: by - 9 },
    end:   { x: x + 9,  y: by - 1 },
    thickness,
    color,
    opacity: 1,
  })
}

/**
 * Draw a thin unfilled ellipse — used by the Transformer wizard to "circle" a
 * printed value on the form (e.g. phase count, transformer type).
 *
 * @param {PDFPage}  page
 * @param {number}   cx         - Centre X
 * @param {number}   cssCY      - Centre Y in top-origin coords
 * @param {number}   rx         - Horizontal radius
 * @param {number}   ry         - Vertical radius
 * @param {boolean}  show
 * @param {number}   [borderWidth=1.2]
 * @param {RGB}      [color]
 * @param {number}   [pageHeight=A4_HEIGHT]
 */
export function circ(
  page,
  cx,
  cssCY,
  rx,
  ry,
  show,
  borderWidth = 1.2,
  color = DEFAULT_INK,
  pageHeight = A4_HEIGHT,
) {
  if (!show) return
  page.drawEllipse({
    x: cx,
    y: pageHeight - cssCY,
    xScale: rx,
    yScale: ry,
    borderColor: color,
    borderWidth,
    color: rgb(0, 0, 0),
    opacity: 0,
    borderOpacity: 1,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT WRAPPING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Break `text` into an array of lines where each line is ≤ `maxWidth` pts wide.
 * Long words that cannot fit are split character-by-character.
 *
 * @param {string}  text
 * @param {number}  maxWidth  - Maximum line width in pts
 * @param {PDFFont} font
 * @param {number}  fontSize
 * @returns {string[]}
 */
export function wrapText(text, maxWidth, font, fontSize) {
  const words = String(text || '').split(' ')
  const lines = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word

    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)

      // Word itself is too long — split character by character
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        let part = ''
        for (const char of word) {
          const next = part + char
          if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
            part = next
          } else {
            if (part) lines.push(part)
            part = char
          }
        }
        current = part
      } else {
        current = word
      }
    }
  }

  if (current) lines.push(current)
  return lines
}

/**
 * Draw wrapped text starting at (x, cssY), adding `lineHeight` pts per line.
 *
 * @param {PDFPage}  page
 * @param {number}   x
 * @param {number}   cssY        - Top-origin Y of the first line
 * @param {*}        text
 * @param {number}   maxWidth    - Maximum line width in pts
 * @param {PDFFont}  font
 * @param {number}   [fontSize=8.5]
 * @param {number}   [lineHeight=11]
 * @param {number}   [maxLines=Infinity]  - Truncate after this many lines
 * @param {RGB}      [color]
 * @param {number}   [pageHeight=A4_HEIGHT]
 */
export function tWrap(
  page,
  x,
  cssY,
  text,
  maxWidth,
  font,
  fontSize = 8.5,
  lineHeight = 11,
  maxLines = Infinity,
  color = DEFAULT_INK,
  pageHeight = A4_HEIGHT,
) {
  if (!text) return
  const lines = wrapText(text, maxWidth, font, fontSize)
  const limit = Math.min(lines.length, maxLines)
  for (let i = 0; i < limit; i++) {
    t(page, x, cssY + i * lineHeight, lines[i], fontSize, font, color, pageHeight)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNATURE EMBEDDING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Embed a base64 signature image (PNG or JPEG) into `pdfDoc` and draw it onto
 * `page` at (x, cssY), scaled to fit within (maxWidth × maxHeight) while
 * preserving aspect ratio.
 *
 * The function detects the mime-type from the data-URI prefix so callers don't
 * need to pass it separately.  Silently no-ops if `base64Sig` is falsy.
 *
 * @param {PDFDocument} pdfDoc
 * @param {PDFPage}     page
 * @param {string}      base64Sig  - Full data-URI, e.g. "data:image/png;base64,..."
 * @param {number}      x
 * @param {number}      cssY       - Top-origin Y of the TOP of the signature image
 * @param {number}      [maxWidth=120]
 * @param {number}      [maxHeight=22]
 * @param {number}      [pageHeight=A4_HEIGHT]
 * @returns {Promise<void>}
 */
export async function drawSignature(
  pdfDoc,
  page,
  base64Sig,
  x,
  cssY,
  maxWidth = 120,
  maxHeight = 22,
  pageHeight = A4_HEIGHT,
) {
  if (!base64Sig || !base64Sig.startsWith('data:image')) return

  try {
    const isJpeg =
      base64Sig.split(',')[0].includes('jpeg') ||
      base64Sig.split(',')[0].includes('jpg')

    const b64data = base64Sig.split(',')[1]
    if (!b64data) return

    const bytes = Uint8Array.from(atob(b64data), c => c.charCodeAt(0))
    const img   = isJpeg ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes)

    const { width: natW, height: natH } = img.scale(1)
    if (!natW || !natH) return

    // Scale-to-fit while preserving aspect ratio
    const scale  = Math.min(maxWidth / natW, maxHeight / natH)
    const drawW  = natW * scale
    const drawH  = natH * scale

    // cssY is the TOP of the image; pdf-lib wants the BOTTOM-LEFT corner
    const pdfY = pageHeight - cssY - drawH

    page.drawImage(img, { x, y: pdfY, width: drawW, height: drawH, opacity: 1 })
  } catch (err) {
    // Signature embedding is non-fatal — log but don't crash generation
    console.warn('[pdfDrawUtils] drawSignature failed:', err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a set of drawing functions pre-bound to a specific page, font, colour,
 * and page height. This eliminates the repetitive argument threading found in
 * the original wizard generators.
 *
 * Usage:
 *   const draw = createPageDrawer(page, font, BLUE, 842)
 *   draw.t(50, 100, 'Hello')
 *   draw.ck(135, 220, isChecked)
 *   draw.tWrap(50, 300, longComment, 400)
 *
 * @param {PDFPage}  page
 * @param {PDFFont}  font
 * @param {RGB}      [color=DEFAULT_INK]
 * @param {number}   [pageHeight=A4_HEIGHT]
 * @returns {{ t, tc, ck, circ, tWrap, wrapText }}
 */
export function createPageDrawer(page, font, color = DEFAULT_INK, pageHeight = A4_HEIGHT) {
  return {
    /** Draw plain text */
    t: (x, cssY, text, size = 8.5) =>
      t(page, x, cssY, text, size, font, color, pageHeight),

    /** Draw horizontally centred text */
    tc: (fieldLeft, fieldWidth, cssY, text, size = 8.5) =>
      tc(page, fieldLeft, fieldWidth, cssY, text, size, font, color, pageHeight),

    /** Draw a checkmark */
    ck: (x, cssY, show, thickness = 1.5) =>
      ck(page, x, cssY, show, thickness, color, pageHeight),

    /** Draw a circling ellipse */
    circ: (cx, cssCY, rx, ry, show, borderWidth = 1.2) =>
      circ(page, cx, cssCY, rx, ry, show, borderWidth, color, pageHeight),

    /** Draw wrapped text */
    tWrap: (x, cssY, text, maxWidth, fontSize = 8.5, lineHeight = 11, maxLines = Infinity) =>
      tWrap(page, x, cssY, text, maxWidth, font, fontSize, lineHeight, maxLines, color, pageHeight),

    /** Pure word-wrap helper (no drawing) */
    wrapText: (text, maxWidth, fontSize = 8.5) =>
      wrapText(text, maxWidth, font, fontSize),
  }
}
