/**
 * appendPhotosToPdf
 *
 * Appends one page per photo to an existing pdf-lib PDFDocument.
 *
 * EXIF orientation is normalised by drawing through a canvas before
 * embedding — this bakes the correct pixel orientation into the JPEG
 * regardless of what the camera wrote into EXIF. pdf-lib's embedJpg has no
 * concept of EXIF rotation at all, so any photo embedded without this step
 * would come out sideways/upside-down in the PDF if its camera wrote a
 * rotation tag.
 *
 * Orientation rules (using EXIF-corrected display dimensions):
 *   - Portrait image  (h >= w) → portrait A4 page  (595 × 842 pt)
 *   - Landscape image (w  > h) → landscape A4 page (842 × 595 pt)
 *
 * Two paths — skip re-processing already-normalized photos (v2.20.6)
 * ──────────────────────────────────────────────────────────────────
 * Every photo used to go through the full decode → resize → canvas-draw →
 * re-encode pipeline here, every time a PDF was generated — even though
 * PhotoAttachStep.jsx (see that file) already does exactly this same work
 * once, at attach time, before a photo ever enters wizard state. That meant
 * every photo was silently reprocessed a second time: extra CPU work per
 * generation, and a second lossy JPEG encode compounding artifacts on an
 * image that had already been compressed once.
 *
 * PhotoAttachStep.jsx tags each photo with `normalized: true/false`
 * depending on whether its own canvas pass actually succeeded (see that
 * file's doc comment for the full contract). This file now branches on
 * that flag:
 *
 *   normalized: true  → FAST PATH. The photo is already the correct size,
 *     already JPEG, and already has correct orientation baked into its
 *     pixels. The bytes are embedded as-is with pdfDoc.embedJpg — no
 *     decode, no canvas, no re-encode. Dimensions for page-sizing come
 *     straight from the embedded image object (embeddedImg.scale(1)),
 *     so nothing is drawn to a canvas at all for this path.
 *
 *   normalized: false (or missing) → DEFENSIVE PATH, unchanged from
 *     before. Used for PhotoAttachStep's compression-failure fallback
 *     (a raw, unprocessed file that may still carry an EXIF rotation
 *     tag and may still be oversized), and for any photo saved by an
 *     older version of the app that predates the `normalized` flag
 *     entirely (missing is treated the same as false — the safe,
 *     conservative default). Runs the full load/resize/canvas-draw/
 *     re-encode pipeline exactly as before.
 *
 * If the fast path's embed ever throws for any reason, it falls through to
 * the defensive path for that one photo rather than dropping it.
 *
 * OffscreenCanvas / Worker support
 * ─────────────────────────────────
 * Only the defensive path touches a canvas at all, so this only matters
 * for photos taking that path. When running inside a Web Worker (where
 * `document` is undefined) the helper automatically uses:
 *   • createImageBitmap()   — instead of HTMLImageElement
 *   • new OffscreenCanvas() — instead of document.createElement('canvas')
 *   • canvas.convertToBlob() — instead of canvas.toDataURL()
 * On the main thread the original DOM-based path is used unchanged.
 *
 * Photos are processed SEQUENTIALLY so that the CPU-heavy canvas
 * operations don't all run at the same time and freeze the thread.
 * A short setTimeout(0) yield is inserted between each image to give
 * the browser / worker a chance to handle other events.
 *
 * @param {PDFDocument} pdfDoc  – pdf-lib PDFDocument to mutate in place
 * @param {Array}       photos  – array of { dataUrl: string, name?: string, normalized?: boolean }
 */

const MAX_PHOTO_PX = 1600   // longest edge cap — reduces file size significantly (defensive path only)

// JPEG_QUALITY (defensive path only)
// ────────────────────────────────────
// Only used by the defensive path below — the fast path never re-encodes
// anything, so this has no effect on the common case at all. Kept at 0.9
// (raised from an original 0.75/0.92 history) so the rare photo that does
// still need this pass isn't degraded more than necessary.
const JPEG_QUALITY = 0.9

// ── Environment detection ─────────────────────────────────────────────────────
// document is undefined inside Web Workers; OffscreenCanvas is the alternative.
const IN_WORKER      = typeof document === 'undefined'
const HAS_OFFSCREEN  = typeof OffscreenCanvas !== 'undefined'
const USE_OFFSCREEN  = IN_WORKER && HAS_OFFSCREEN

/** Yields to the event loop for one frame before continuing. */
function yieldToMain() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

/** Decode a data-URL's base64 payload into raw bytes. */
function dataUrlToBytes(dataUrl) {
  const b64 = dataUrl.split(',')[1]
  if (!b64) return null
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

// ── Image loading (defensive path only) ───────────────────────────────────────

/**
 * Load a data-URL into a drawable source and return its natural dimensions.
 *
 * Worker path  → fetch() + createImageBitmap({ imageOrientation: 'from-image' })
 * Main thread  → HTMLImageElement (browser applies EXIF rotation automatically)
 *
 * @returns {Promise<{ natW: number, natH: number, source: HTMLImageElement | ImageBitmap }>}
 */
async function loadImageInfo(dataUrl) {
  if (IN_WORKER && typeof createImageBitmap !== 'undefined') {
    const res  = await fetch(dataUrl)
    const blob = await res.blob()
    // Request EXIF-corrected orientation where the option is supported;
    // fall back to default orientation if the browser ignores the option.
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' }).catch(
      () => createImageBitmap(blob),
    )
    return { natW: bmp.width, natH: bmp.height, source: bmp }
  }

  // Main-thread fallback — HTMLImageElement handles EXIF via browser rendering
  return new Promise((resolve, reject) => {
    const img   = new Image()
    img.onload  = () => resolve({ natW: img.naturalWidth, natH: img.naturalHeight, source: img })
    img.onerror = () => reject(new Error('Image load failed'))
    img.src     = dataUrl
  })
}

// ── Canvas helpers (defensive path only) ──────────────────────────────────────

/**
 * Create a canvas of (w × h). Uses OffscreenCanvas in worker context.
 */
function makeCanvas(w, h) {
  if (USE_OFFSCREEN) return new OffscreenCanvas(w, h)
  const c   = document.createElement('canvas')
  c.width   = w
  c.height  = h
  return c
}

/**
 * Export a canvas to JPEG bytes (Uint8Array).
 * OffscreenCanvas → convertToBlob(); HTMLCanvasElement → toDataURL().
 */
async function canvasToJpegBytes(canvas) {
  if (USE_OFFSCREEN && canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY })
    return new Uint8Array(await blob.arrayBuffer())
  }
  const b64 = canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1]
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

/**
 * Run the full defensive pipeline for a photo that isn't already known to
 * be normalized: decode, resize to fit MAX_PHOTO_PX, draw through a canvas
 * (baking in EXIF orientation), re-encode as JPEG, and embed.
 *
 * @returns {Promise<{ embedded: object, imgW: number, imgH: number } | null>}
 *   null if the photo could not be processed at all (caller should skip it).
 */
async function embedViaDefensivePipeline(pdfDoc, photo) {
  let imageInfo
  try {
    imageInfo = await loadImageInfo(photo.dataUrl)
  } catch {
    console.warn('appendPhotosToPdf: could not load image', photo.name)
    return null
  }

  const { natW, natH, source } = imageInfo
  if (!natW || !natH) return null

  let canvasW = natW
  let canvasH = natH
  if (natW > MAX_PHOTO_PX || natH > MAX_PHOTO_PX) {
    const scale = MAX_PHOTO_PX / Math.max(natW, natH)
    canvasW     = Math.round(natW * scale)
    canvasH     = Math.round(natH * scale)
  }

  let normBytes
  try {
    const canvas = makeCanvas(canvasW, canvasH)
    canvas.getContext('2d').drawImage(source, 0, 0, canvasW, canvasH)
    normBytes    = await canvasToJpegBytes(canvas)
  } catch (err) {
    console.warn('appendPhotosToPdf: canvas normalisation failed', photo.name, err)
    return null
  }

  try {
    const embedded = await pdfDoc.embedJpg(normBytes)
    return { embedded, imgW: canvasW, imgH: canvasH }
  } catch (err) {
    console.warn('appendPhotosToPdf: embedJpg failed', err)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export async function appendPhotosToPdf(pdfDoc, photos) {
  if (!photos || photos.length === 0) return

  for (const photo of photos) {
    // Yield before each image so the thread stays responsive between heavy ops
    await yieldToMain()

    const { dataUrl, normalized } = photo
    if (!dataUrl || !dataUrl.startsWith('data:image')) continue

    let embedded = null
    let imgW, imgH

    // ── Fast path: skip decode/resize/canvas/re-encode entirely ─────────────
    if (normalized) {
      try {
        const bytes = dataUrlToBytes(dataUrl)
        if (bytes) {
          embedded = await pdfDoc.embedJpg(bytes)
          const scaled = embedded.scale(1)
          imgW = scaled.width
          imgH = scaled.height
        }
      } catch (err) {
        console.warn('appendPhotosToPdf: fast-path embed failed, falling back to full processing', photo.name, err)
        embedded = null
      }
    }

    // ── Defensive path — anything not already known-normalized, or where
    //    the fast path above failed for some reason ────────────────────────
    if (!embedded) {
      const result = await embedViaDefensivePipeline(pdfDoc, photo)
      if (!result) continue
      embedded = result.embedded
      imgW = result.imgW
      imgH = result.imgH
    }

    // ── Page sizing + draw — shared by both paths ────────────────────────────
    const isLandscape = imgW > imgH
    const pageW = isLandscape ? 842 : 595
    const pageH = isLandscape ? 595 : 842

    const MARGIN = 20
    const availW = pageW - 2 * MARGIN
    const availH = pageH - 2 * MARGIN
    const scale  = Math.min(availW / imgW, availH / imgH)
    const drawW  = imgW * scale
    const drawH  = imgH * scale
    const x      = MARGIN + (availW - drawW) / 2
    const y      = MARGIN + (availH - drawH) / 2

    const page = pdfDoc.addPage([pageW, pageH])
    page.drawImage(embedded, { x, y, width: drawW, height: drawH })
  }
}
