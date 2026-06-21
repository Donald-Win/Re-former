/**
 * appendPhotosToPdf
 *
 * Appends one page per photo to an existing pdf-lib PDFDocument.
 *
 * EXIF orientation is normalised by drawing through a canvas before
 * embedding — this bakes the correct pixel orientation into the JPEG
 * regardless of what the camera wrote into EXIF.
 *
 * Orientation rules (using EXIF-corrected display dimensions):
 *   - Portrait image  (h >= w) → portrait A4 page  (595 × 842 pt)
 *   - Landscape image (w  > h) → landscape A4 page (842 × 595 pt)
 *
 * OffscreenCanvas / Worker support
 * ─────────────────────────────────
 * When running inside a Web Worker (where `document` is undefined) the
 * helper automatically uses:
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
 * @param {Array}       photos  – array of { dataUrl: string, name?: string }
 */

const MAX_PHOTO_PX = 1600   // longest edge cap — reduces file size significantly
const JPEG_QUALITY = 0.75   // was 0.92

// ── Environment detection ─────────────────────────────────────────────────────
// document is undefined inside Web Workers; OffscreenCanvas is the alternative.
const IN_WORKER      = typeof document === 'undefined'
const HAS_OFFSCREEN  = typeof OffscreenCanvas !== 'undefined'
const USE_OFFSCREEN  = IN_WORKER && HAS_OFFSCREEN

/** Yields to the event loop for one frame before continuing. */
function yieldToMain() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

// ── Image loading ─────────────────────────────────────────────────────────────

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

// ── Canvas helpers ────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export async function appendPhotosToPdf(pdfDoc, photos) {
  if (!photos || photos.length === 0) return

  for (const photo of photos) {
    // Yield before each image so the thread stays responsive between heavy ops
    await yieldToMain()

    const { dataUrl } = photo
    if (!dataUrl || !dataUrl.startsWith('data:image')) continue

    // ── Step 1: Load image ────────────────────────────────────────────────────
    let imageInfo
    try {
      imageInfo = await loadImageInfo(dataUrl)
    } catch {
      console.warn('appendPhotosToPdf: could not load image', photo.name)
      continue
    }

    const { natW, natH, source } = imageInfo
    if (!natW || !natH) continue

    // ── Step 2: Scale down if oversized ──────────────────────────────────────
    let canvasW = natW
    let canvasH = natH
    if (natW > MAX_PHOTO_PX || natH > MAX_PHOTO_PX) {
      const scale = MAX_PHOTO_PX / Math.max(natW, natH)
      canvasW     = Math.round(natW * scale)
      canvasH     = Math.round(natH * scale)
    }

    // ── Step 3: Normalise via canvas (bakes EXIF, recompresses) ──────────────
    let normBytes
    try {
      const canvas = makeCanvas(canvasW, canvasH)
      canvas.getContext('2d').drawImage(source, 0, 0, canvasW, canvasH)
      normBytes    = await canvasToJpegBytes(canvas)
    } catch (err) {
      console.warn('appendPhotosToPdf: canvas normalisation failed', photo.name, err)
      continue
    }

    // ── Step 4: Embed into the PDF and draw a page ───────────────────────────
    const isLandscape = natW > natH
    const pageW = isLandscape ? 842 : 595
    const pageH = isLandscape ? 595 : 842

    const MARGIN = 20
    const availW = pageW - 2 * MARGIN
    const availH = pageH - 2 * MARGIN
    const scale  = Math.min(availW / canvasW, availH / canvasH)
    const drawW  = canvasW * scale
    const drawH  = canvasH * scale
    const x      = MARGIN + (availW - drawW) / 2
    const y      = MARGIN + (availH - drawH) / 2

    let embedded
    try {
      embedded = await pdfDoc.embedJpg(normBytes)
    } catch (err) {
      console.warn('appendPhotosToPdf: embedJpg failed', err)
      continue
    }

    const page = pdfDoc.addPage([pageW, pageH])
    page.drawImage(embedded, { x, y, width: drawW, height: drawH })
  }
}
