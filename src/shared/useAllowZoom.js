/**
 * useAllowZoom — temporarily re-enables pinch-to-zoom while a PDF preview
 * is on screen.
 *
 * Pinch-zoom is disabled app-wide via the <meta name="viewport"> tag in
 * index.html / index.netlify.html (maximum-scale=1.0, user-scalable=no) to
 * stop accidental zooming while tapping/swiping between form fields on
 * iPads and Android tablets (see CHANGELOGS 2.13.0 — "Accidental zoom
 * disabled on field devices"). That lockout is still the right default
 * everywhere except PDF preview screens, where field techs need to pinch
 * in to check fine detail before printing or sharing.
 *
 * This hook flips the viewport meta tag to allow zooming for as long as
 * `active` is true, and restores the locked-down default the moment it
 * becomes false (or the calling component unmounts). A module-level
 * reference count means the lock is only re-applied once every active
 * preview has closed, so it stays correct even if more than one preview
 * surface happens to be mounted at the same time.
 *
 * Usage:
 *   useAllowZoom(isPreviewOpen)
 */
import { useEffect } from 'react'

const LOCKED_CONTENT   = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
const ZOOMABLE_CONTENT = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes'

let zoomRequests = 0

function applyZoomState() {
  const meta = document.querySelector('meta[name="viewport"]')
  if (!meta) return
  meta.setAttribute('content', zoomRequests > 0 ? ZOOMABLE_CONTENT : LOCKED_CONTENT)
}

export function useAllowZoom(active) {
  useEffect(() => {
    if (!active) return

    zoomRequests += 1
    applyZoomState()

    return () => {
      zoomRequests = Math.max(0, zoomRequests - 1)
      applyZoomState()
    }
  }, [active])
}
