/**
 * sharePdf — shared share/save handler for all wizards.
 * buildPdfFilename — sanitised filename builder.
 *
 * In development the debug overlay is shown when share fails so errors are
 * visible on iPad without a connected Mac console.
 * In production the overlay is suppressed — field users should never see
 * raw stack traces.
 */

function showDebug(lines) {
  // Only expose the debug overlay during local development.
  // import.meta.env.DEV is replaced with a boolean literal at build time,
  // so this entire branch is dead-code-eliminated in production bundles.
  if (!import.meta.env.DEV) return

  const existing = document.getElementById('__sharePdfDebug')
  if (existing) existing.remove()
  const el = document.createElement('div')
  el.id = '__sharePdfDebug'
  el.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
    'background:#1e1b4b', 'color:#fff', 'font-family:monospace',
    'font-size:13px', 'padding:16px', 'white-space:pre-wrap',
    'max-height:60vh', 'overflow-y:auto',
  ].join(';')
  el.textContent = lines.join('\n')
  const btn = document.createElement('button')
  btn.textContent = '✕ Dismiss'
  btn.style.cssText = 'display:block;margin-top:12px;padding:8px 16px;background:#4f46e5;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer'
  btn.onclick = () => el.remove()
  el.appendChild(btn)
  document.body.appendChild(el)
}

/**
 * Build a sanitised PDF filename from the supplied parts.
 *
 * Each part has characters that are invalid in filenames stripped and is
 * trimmed. Falsy or empty parts are filtered out before joining with ' - '.
 * A '.pdf' extension is appended automatically.
 *
 * @param {...string} parts  e.g. (d.projectName, d.npJobNumber, d.oldPoleId, 'Pole Record')
 * @returns {string}         e.g. "Pyes Pa Blitz - TC1234567 - Pole Record.pdf"
 */
export function buildPdfFilename(...parts) {
  const sanitise = s => (s || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim()
  return parts.map(sanitise).filter(Boolean).join(' - ') + '.pdf'
}

export async function sharePdf(pdfBytes, filename, blobUrl, onSuccess) {
  if (!pdfBytes) { showDebug(['sharePdf: pdfBytes is null — nothing to share']); return }

  const log = [`sharePdf called — filename: ${filename}`, `pdfBytes length: ${pdfBytes.length}`]

  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const file = new File([blob], filename, { type: 'application/pdf' })

  log.push(`navigator.share exists: ${!!navigator.share}`)
  log.push(`navigator.canShare exists: ${!!navigator.canShare}`)
  if (navigator.canShare) {
    log.push(`canShare({files}): ${navigator.canShare({ files: [file] })}`)
    log.push(`canShare({url}): ${navigator.canShare({ url: 'https://example.com' })}`)
  }

  if (navigator.share) {
    // Attempt 1: file share
    try {
      log.push('Attempting navigator.share({ files })')
      await navigator.share({ files: [file] })
      log.push('SUCCESS — file share')
      onSuccess?.()
      return
    } catch (err) {
      log.push(`FAILED: ${err.name}: ${err.message}`)
      if (err.name === 'AbortError') { return }
    }

    // Attempt 2: url share
    const url = blobUrl ?? URL.createObjectURL(blob)
    try {
      log.push('Attempting navigator.share({ url })')
      await navigator.share({ url })
      log.push('SUCCESS — url share')
      onSuccess?.()
      return
    } catch (err) {
      log.push(`FAILED: ${err.name}: ${err.message}`)
      if (err.name === 'AbortError') { return }
    }
  }

  // Fallback
  log.push('Falling back to window.open')
  const url = blobUrl ?? URL.createObjectURL(blob)
  window.open(url, '_blank')

  // Show debug overlay (dev only — no-op in production)
  showDebug(log)
}
