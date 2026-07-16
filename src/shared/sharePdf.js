/**
 * sharePdf — shared share/save handler for all wizards.
 * buildPdfFilename — sanitised filename builder.
 *
 * In development the debug overlay is shown when share fails so errors are
 * visible on iPad without a connected Mac console.
 * In production the overlay is suppressed — field users should never see
 * raw stack traces.
 *
 * Blob URL cleanup (v2.20.3)
 * ───────────────────────────
 * When the caller passes an existing `blobUrl` (the normal case — every
 * wizard passes `pdfBlobUrl` from usePdfGenerate, which owns and revokes
 * that URL on its own schedule), this function only ever reads it and
 * never touches its lifecycle.
 *
 * When no `blobUrl` is passed, this function previously created its own
 * via `URL.createObjectURL(blob)` in the "share by url" and final
 * `window.open` fallback paths — and never revoked it, leaking one object
 * URL (and the underlying Blob it keeps alive) per share attempt that hit
 * either path. Any self-created URL is now tracked and revoked after a
 * short grace period (long enough for the browser's share sheet or the new
 * tab to finish reading it) once this function is done with it.
 *
 * onSuccess on the fallback path (v2.20.4)
 * ──────────────────────────────────────────
 * `onSuccess` (every wizard passes its `clearFormDraft` callback here, so
 * a completed form's autosave/crash-recovery slot is cleared once it's
 * been shared) was previously only invoked on the two `navigator.share()`
 * success paths. Any environment without `navigator.share` (most desktop
 * browsers, some Android browsers) — or where both share attempts fail for
 * a reason other than the user cancelling — falls through to the
 * `window.open` fallback, which never called `onSuccess`. That meant the
 * draft/autosave was silently never cleared on that path: reopening the
 * same form later would still show a stale "unsaved progress found"
 * crash-recovery prompt, even though the tech had already generated and
 * viewed/printed the finished PDF. `onSuccess` is now called after
 * `window.open` too, so the draft is cleared regardless of which path the
 * share/print ends up taking.
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

  // Only set when THIS function creates its own object URL (i.e. the
  // caller didn't pass one in) — that's the only URL we're responsible for
  // cleaning up. `blobUrl` passed in by the caller is owned by
  // usePdfGenerate and must never be revoked here.
  let ownBlobUrl = null
  const getUrl = () => blobUrl ?? (ownBlobUrl ??= URL.createObjectURL(blob))
  const releaseOwnUrl = () => {
    if (!ownBlobUrl) return
    const url = ownBlobUrl
    ownBlobUrl = null
    // Small delay so whatever just consumed the URL (a new tab from
    // window.open, or the OS share sheet) has time to finish reading it
    // before it's revoked out from under it.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  log.push(`navigator.share exists: ${!!navigator.share}`)
  log.push(`navigator.canShare exists: ${!!navigator.canShare}`)
  if (navigator.canShare) {
    log.push(`canShare({files}): ${navigator.canShare({ files: [file] })}`)
    log.push(`canShare({url}): ${navigator.canShare({ url: 'https://example.com' })}`)
  }

  try {
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
      try {
        log.push('Attempting navigator.share({ url })')
        await navigator.share({ url: getUrl() })
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
    window.open(getUrl(), '_blank')
    // The tech has now been handed the PDF (in a new tab) exactly as
    // intended by this fallback path — treat that as a successful share so
    // the draft/autosave is cleared here too, same as the two navigator.share
    // paths above. Without this, any device/browser without navigator.share
    // (or where both share attempts fail for a non-abort reason) would never
    // clear the draft, leaving a stale "unsaved progress" prompt next time
    // the tech reopens this form.
    onSuccess?.()

    // Show debug overlay (dev only — no-op in production)
    showDebug(log)
  } finally {
    releaseOwnUrl()
  }
}
