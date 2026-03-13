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
 * @param {PDFDocument} pdfDoc  – pdf-lib PDFDocument to mutate in place
 * @param {Array}       photos  – array of { dataUrl: string, name?: string }
 */
export async function appendPhotosToPdf(pdfDoc, photos) {
  if (!photos || photos.length === 0) return

  for (const photo of photos) {
    const { dataUrl } = photo
    if (!dataUrl || !dataUrl.startsWith('data:image')) continue

    // 1. Load through <img> to get EXIF-corrected display dimensions
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

    // 2. Normalise EXIF via canvas.
    // Drawing an <img> onto a canvas always produces correctly-oriented pixels.
    // The resulting re-encoded JPEG has no EXIF rotation tag and is safe for pdf-lib.
    let normBytes
    try {
      const canvas = document.createElement('canvas')
      canvas.width  = natW
      canvas.height = natH
      const ctx = canvas.getContext('2d')
      ctx.drawImage(imgEl, 0, 0, natW, natH)
      const normDataUrl = canvas.toDataURL('image/jpeg', 0.92)
      const b64 = normDataUrl.split(',')[1]
      normBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    } catch (err) {
      console.warn('appendPhotosToPdf: canvas normalisation failed', photo.name, err)
      continue
    }

    // 3. Choose A4 page orientation from EXIF-corrected dimensions.
    //    Portrait  (h >= w) → portrait  A4: 595 × 842 pt
    //    Landscape (w  > h) → landscape A4: 842 × 595 pt
    const isLandscape = natW > natH
    const pageW = isLandscape ? 842 : 595
    const pageH = isLandscape ? 595 : 842

    // 4. Scale to fill page (minus margin) preserving aspect ratio, then centre.
    const MARGIN = 20
    const availW = pageW - 2 * MARGIN
    const availH = pageH - 2 * MARGIN
    const scale  = Math.min(availW / natW, availH / natH)
    const drawW  = natW * scale
    const drawH  = natH * scale
    // pdf-lib origin is bottom-left
    const x = MARGIN + (availW - drawW) / 2
    const y = MARGIN + (availH - drawH) / 2

    // 5. Embed canvas-normalised JPEG and draw onto a new page.
    let embedded
    try {
      embedded = await pdfDoc.embedJpg(normBytes)
    } catch (err) {
      console.warn('appendPhotosToPdf: embedJpg failed for', photo.name, err)
      continue
    }

    const page = pdfDoc.addPage([pageW, pageH])
    page.drawImage(embedded, { x, y, width: drawW, height: drawH })
  }
}
