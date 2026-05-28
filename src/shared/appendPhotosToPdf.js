/**
 * appendPhotosToPdf
 *
 * Appends one page per photo to an existing pdf-lib PDFDocument.
 *
 * EXIF orientation is normalised by drawing through a <canvas> before
 * embedding — this bakes the correct pixel orientation into the JPEG
 * regardless of what the camera wrote into EXIF.
 *
 * Orientation rules (using EXIF-corrected display dimensions):
 *   - Portrait image  (h >= w) → portrait A4 page  (595 × 842 pt)
 *   - Landscape image (w  > h) → landscape A4 page (842 × 595 pt)
 *
 * Photos are processed SEQUENTIALLY (not with Promise.all) so that the
 * synchronous, CPU-heavy canvas operations (drawImage + toDataURL) don't
 * all run at the same time and freeze the main thread on lower-end devices.
 * A short setTimeout(0) yield is inserted between each image to give the
 * browser a chance to paint / handle events before the next one starts.
 *
 * @param {PDFDocument} pdfDoc  – pdf-lib PDFDocument to mutate in place
 * @param {Array}       photos  – array of { dataUrl: string, name?: string }
 */

const MAX_PHOTO_PX = 1600  // longest edge cap — reduces file size significantly
const JPEG_QUALITY = 0.75  // was 0.92

/** Yields to the browser's event loop for one frame before continuing. */
function yieldToMain() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

export async function appendPhotosToPdf(pdfDoc, photos) {
  if (!photos || photos.length === 0) return

  for (const photo of photos) {
    // Yield before each image so the UI stays responsive between heavy ops
    await yieldToMain()

    const { dataUrl } = photo
    if (!dataUrl || !dataUrl.startsWith('data:image')) continue

    // ── Step 1: Load image to get EXIF-corrected display dimensions ────────
    let imgEl
    try {
      imgEl = await new Promise((resolve, reject) => {
        const img = new window.Image()
        img.onload  = () => resolve(img)
        img.onerror = () => reject(new Error('Image load failed'))
        img.src = dataUrl
      })
    } catch {
      console.warn('appendPhotosToPdf: could not load image', photo.name)
      continue
    }

    const natW = imgEl.naturalWidth
    const natH = imgEl.naturalHeight
    if (!natW || !natH) continue

    // ── Step 2: Scale down if oversized ────────────────────────────────────
    let canvasW = natW
    let canvasH = natH
    if (natW > MAX_PHOTO_PX || natH > MAX_PHOTO_PX) {
      const scale = MAX_PHOTO_PX / Math.max(natW, natH)
      canvasW = Math.round(natW * scale)
      canvasH = Math.round(natH * scale)
    }

    // ── Step 3: Normalise EXIF via canvas (synchronous — the heavy bit) ────
    let normBytes
    try {
      const canvas = document.createElement('canvas')
      canvas.width  = canvasW
      canvas.height = canvasH
      const ctx = canvas.getContext('2d')
      ctx.drawImage(imgEl, 0, 0, canvasW, canvasH)
      const normDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
      const b64 = normDataUrl.split(',')[1]
      normBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    } catch (err) {
      console.warn('appendPhotosToPdf: canvas normalisation failed', photo.name, err)
      continue
    }

    // ── Step 4: Embed into the PDF and draw a page ─────────────────────────
    // Choose A4 page orientation from EXIF-corrected dimensions
    const isLandscape = natW > natH
    const pageW = isLandscape ? 842 : 595
    const pageH = isLandscape ? 595 : 842

    // Scale to fill page (minus margin) preserving aspect ratio, then centre
    const MARGIN = 20
    const availW = pageW - 2 * MARGIN
    const availH = pageH - 2 * MARGIN
    const scale  = Math.min(availW / canvasW, availH / canvasH)
    const drawW  = canvasW * scale
    const drawH  = canvasH * scale
    const x = MARGIN + (availW - drawW) / 2
    const y = MARGIN + (availH - drawH) / 2

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
