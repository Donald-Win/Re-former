/**
 * sharePdf — shared share/save handler for all wizards.
 *
 * Shows an on-screen debug overlay when share fails so errors are
 * visible on iPad without a connected Mac console.
 */

function showDebug(lines) {
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

  // Show debug overlay so we can see what happened
  showDebug(log)
}
