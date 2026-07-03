import React, { useState, useCallback } from 'react'
import { FileText, Share2, X } from 'lucide-react'
import { APP_YELLOW } from './constants'
import { useAllowZoom } from './useAllowZoom'

/**
 * WizardShell — shared outer chrome for all form wizards.
 *
 * Props (standard):
 *   title / formNumber / headerIcon / headerBadge
 *   steps / step / onStepClick / onClose / onBack / onNext
 *   onSaveDraft        fn()|null  — shows 💾 button on all steps
 *   accent / bg / mid / border / progressColor / getDotColor / devPaddingTop
 *   isPreview / onShare / onClosePreview / missingFields / previewContent
 *   children
 *
 * Dev-only props (dead-code-eliminated in production builds):
 *   onFillTestData     fn(allOptions: boolean)|null  — 🧪 fills all fields.
 *     WizardShell owns which mode is currently active (so it can show it —
 *     see below) and tells the wizard which one to apply on each tap:
 *     true = devFillStateAllOptions (every "1 of N" option ticked at once),
 *     false = devFillState (one realistic value per field). Wire it
 *     straight to useWizardSetup's handleDevFill, unchanged.
 *   calibrationPdfUrl  string     — 📐 URL of the form PDF to calibrate against
 *   calibrationPageCount number   — total pages in the form (default 1)
 *
 * ── Calibration workflow ──────────────────────────────────────────────────
 *  1. npm run dev (or --host for iPad)
 *  2. Open any wizard → tap 🧪 to fill all fields with realistic data
 *  3. Tap 🧪 again to switch to "show every option at once" — a small
 *     ALL OPTIONS badge appears next to the form title for as long as this
 *     mode is active, and the button itself turns purple (🔬), so you can
 *     tell which mode is loaded without generating a PDF first
 *  4. Tap 📐 to load the CoordOverlay for that wizard's PDF
 *  5. The form PDF renders full-screen — click any field to read x/y coords
 *  6. Use the −/100%/+ control (or pinch) to zoom in for precise placement
 *  7. Use ← → to navigate pages of multi-page forms
 *  8. Tap 📐 again to return to the form view
 *  9. Tap 'Preview Form →' to generate a filled PDF and compare positions
 *
 * Both buttons are fully eliminated from production bundles:
 * Vite replaces import.meta.env.DEV with false at build time; Rollup strips
 * the dead branches (including the dynamic CoordOverlay import) entirely.
 */
export function WizardShell({
  title, formNumber, headerIcon, headerBadge,
  steps, step, onStepClick, onClose, onBack, onNext,
  onSaveDraft, onFillTestData,
  calibrationPdfUrl, calibrationPageCount,
  accent, bg = '#f4f4f8', mid = '#fff', border = '#eee',
  progressColor = APP_YELLOW, getDotColor,
  devPaddingTop = 0,
  isPreview, onShare, onClosePreview, missingFields, previewContent,
  children,
}) {
  const resolvedDotColor = getDotColor || (() => accent)
  const isLastStep  = step === steps.length - 1
  const isFirstStep = step === 0
  const totalPages  = calibrationPageCount || 1

  // ── Calibration state ────────────────────────────────────────────────────
  // Always declared (React hook rules). Only the render branches are DEV-gated.
  const [calibMode,    setCalibMode]    = useState(false)
  const [calibBytes,   setCalibBytes]   = useState(null)
  const [calibPage,    setCalibPage]    = useState(1)
  const [calibLoading, setCalibLoading] = useState(false)
  const [CalibComp,    setCalibComp]    = useState(null)

  // ── Dev-fill mode ─────────────────────────────────────────────────────────
  // WizardShell owns this (rather than the wizard or useWizardSetup) so the
  // current mode can actually be SHOWN — both on the button and as a badge
  // next to the form title — instead of only being visible once you generate
  // the PDF and see which kind of data came out.
  const [fillMode, setFillMode] = useState('normal') // 'normal' | 'all'
  const handleFillToggle = useCallback(() => {
    const next = fillMode === 'normal' ? 'all' : 'normal'
    setFillMode(next)
    onFillTestData?.(next === 'all')
  }, [fillMode, onFillTestData])

  // Allow pinch-to-zoom while the filled-PDF preview overlay OR the
  // coordinate-calibration overlay is showing — locked the rest of the time
  // (see useAllowZoom for details). The calibration tool also has its own
  // explicit +/- zoom control for precision work without a touchscreen.
  useAllowZoom(isPreview || calibMode)

  const handleCalibToggle = useCallback(async () => {
    if (calibMode) { setCalibMode(false); return }

    // Lazy-load CoordOverlay (and pdfjsLib) only when first activated.
    // Dynamic import → separate Rollup chunk, never fetched in production.
    let Comp = CalibComp
    if (!Comp) {
      const mod = await import('./CoordOverlay')
      Comp = mod.CoordOverlay
      setCalibComp(() => Comp)  // () => prevents React treating it as an updater
    }

    if (!calibBytes && calibrationPdfUrl) {
      setCalibLoading(true)
      try {
        const res = await fetch(calibrationPdfUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buf = await res.arrayBuffer()
        setCalibBytes(new Uint8Array(buf))
      } catch (err) {
        console.error('[WizardShell] Calibration PDF load failed:', err)
        setCalibLoading(false)
        return
      }
      setCalibLoading(false)
    }

    setCalibMode(true)
  }, [calibMode, CalibComp, calibBytes, calibrationPdfUrl])

  const calibPrevPage = useCallback(() => setCalibPage(p => Math.max(1, p - 1)), [])
  const calibNextPage = useCallback(() => setCalibPage(p => Math.min(totalPages, p + 1)), [totalPages])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', flexDirection: 'column',
      paddingTop: devPaddingTop,
      background: bg,
      fontFamily: "'Segoe UI',system-ui,sans-serif",
      transition: 'background 0.3s',
    }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{
        background: accent, color: '#fff',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0, transition: 'background 0.3s',
      }}>
        <div style={{ flexShrink: 0 }}>
          {headerIcon ?? <FileText size={22} color="#fff" />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
          <div style={{ fontSize: 10, opacity: 0.75 }}>
            {formNumber}
            {import.meta.env.DEV && fillMode === 'all' && (
              <span style={{
                marginLeft: 8,
                background: '#a78bfa',
                borderRadius: 4, padding: '1px 6px',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
              }}>ALL OPTIONS</span>
            )}
            {import.meta.env.DEV && calibMode && (
              <span style={{
                marginLeft: 8,
                background: 'rgba(255,255,255,0.25)',
                borderRadius: 4, padding: '1px 6px',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
              }}>CALIBRATION</span>
            )}
          </div>
        </div>
        {headerBadge && (
          <div style={{
            background: 'rgba(255,255,255,0.2)', borderRadius: 20,
            padding: '3px 12px', fontSize: 11, fontWeight: 800,
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {headerBadge}
          </div>
        )}
        <button onClick={onClose} title="Close wizard" style={{
          padding: 6, border: 'none',
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 8, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginLeft: headerBadge ? 6 : 0,
        }}>
          <X size={20} color="#fff" />
        </button>
      </div>

      {/* ── Progress strip ────────────────────────────────────────────────── */}
      <div style={{
        background: mid, borderBottom: `1px solid ${border}`,
        padding: '10px 16px', flexShrink: 0, transition: 'background 0.3s',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{
            fontSize: 13, fontWeight: 700, transition: 'color 0.3s',
            color: import.meta.env.DEV && calibMode ? '#6d28d9' : accent,
          }}>
            {import.meta.env.DEV && calibMode
              ? `CoordOverlay — Page ${calibPage} of ${totalPages}`
              : steps[step]}
          </span>
          <span style={{ fontSize: 12, color: '#999' }}>
            {import.meta.env.DEV && calibMode
              ? formNumber
              : `${step + 1} / ${steps.length}`}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 5, background: 'rgba(0,0,0,0.1)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            transition: 'width .3s, background .3s',
            background: import.meta.env.DEV && calibMode ? '#6d28d9' : progressColor,
            width: import.meta.env.DEV && calibMode
              ? `${(calibPage / totalPages) * 100}%`
              : `${(step + 1) / steps.length * 100}%`,
          }} />
        </div>

        {/* Dot navigation */}
        <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
          {import.meta.env.DEV && calibMode
            ? Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setCalibPage(i + 1)} style={{
                  flexShrink: 0, height: 7, borderRadius: 4,
                  border: 'none', padding: 0, cursor: 'pointer',
                  width: i + 1 === calibPage ? 18 : 7,
                  background: i + 1 === calibPage ? '#6d28d9' : '#c4b5fd',
                  opacity: i + 1 === calibPage ? 1 : 0.6,
                  transition: 'all .2s',
                }} />
              ))
            : steps.map((_, i) => (
                <button key={i} onClick={() => i <= step && onStepClick(i)} style={{
                  flexShrink: 0, height: 7, borderRadius: 4,
                  border: 'none', padding: 0,
                  width: i === step ? 18 : 7,
                  cursor: i <= step ? 'pointer' : 'default',
                  background: i <= step ? resolvedDotColor(i) : '#ccc',
                  opacity: i === step ? 1 : 0.6,
                  transition: 'all .2s',
                }} />
              ))
          }
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {/* Calibration overlay replaces form content when active */}
      {import.meta.env.DEV && calibMode
        ? (
          <div style={{ flex: 1, overflowY: 'auto', background: '#0f172a' }}>
            {calibLoading
              ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 200, color: '#94a3b8', fontSize: 14, fontWeight: 600, gap: 12,
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    border: '3px solid #334155', borderTopColor: '#a78bfa',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  Loading {formNumber}.pdf…
                </div>
              )
              : CalibComp && calibBytes && (
                <CalibComp pdfBytes={calibBytes} page={calibPage} />
              )
            }
          </div>
        )
        : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 90px' }}>
            {!isPreview && (
              <div style={{
                background: '#fff', borderRadius: 14, padding: 18,
                boxShadow: `0 2px 12px ${accent}20`,
                border: `1px solid ${border}`,
              }}>
                {children}
              </div>
            )}
          </div>
        )
      }

      {/* ── Nav bar ──────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: mid, borderTop: `1px solid ${border}`,
        padding: '10px 16px', display: 'flex', gap: 10,
        transition: 'background 0.3s',
      }}>

        {/* 💾 Save draft — hidden while calibrating */}
        {onSaveDraft && !isPreview && !calibMode && (
          <button
            onClick={onSaveDraft}
            title="Save draft"
            style={{
              padding: '13px 14px', borderRadius: 12, flexShrink: 0,
              border: `2px solid ${accent}`,
              background: '#fff', color: accent,
              fontFamily: 'inherit', fontSize: 16, fontWeight: 700,
              cursor: 'pointer', minWidth: 48,
            }}
          >
            💾
          </button>
        )}

        {/* 🧪 Fill test data — DEV only, hidden while calibrating. Toggles
            between realistic dummy data and "show every option at once" —
            see useWizardSetup.js / devFillState.js. Button colour + emoji
            reflect whichever mode is CURRENTLY ACTIVE, not which one tapping
            it will switch to, so it's visible without generating a PDF. */}
        {import.meta.env.DEV && onFillTestData && !isPreview && !calibMode && (
          <button
            onClick={handleFillToggle}
            title={fillMode === 'all'
              ? 'Showing every option at once (DEV only) — tap to switch back to realistic data'
              : 'Filled with realistic test data (DEV only) — tap to show every option at once'}
            style={{
              padding: '13px 14px', borderRadius: 12, flexShrink: 0,
              border: `2px solid ${fillMode === 'all' ? '#6d28d9' : '#d97706'}`,
              background: fillMode === 'all' ? '#f5f3ff' : '#fffbeb',
              color: fillMode === 'all' ? '#6d28d9' : '#d97706',
              fontFamily: 'inherit', fontSize: 16, fontWeight: 700,
              cursor: 'pointer', minWidth: 48,
            }}
          >
            {fillMode === 'all' ? '🔬' : '🧪'}
          </button>
        )}

        {/* 📐 Calibration toggle — DEV only, always visible (not hidden during calib) */}
        {import.meta.env.DEV && calibrationPdfUrl && !isPreview && (
          <button
            onClick={handleCalibToggle}
            title={calibMode
              ? 'Close calibration overlay (return to form)'
              : 'Open CoordOverlay — click the PDF to read field coordinates (DEV only)'}
            style={{
              padding: '13px 14px', borderRadius: 12, flexShrink: 0,
              border: '2px solid #6d28d9',
              background: calibMode ? '#6d28d9' : '#f5f3ff',
              color: calibMode ? '#fff' : '#6d28d9',
              fontFamily: 'inherit', fontSize: 16, fontWeight: 700,
              cursor: 'pointer', minWidth: 48,
              transition: 'all 0.15s',
            }}
          >
            📐
          </button>
        )}

        {/* Page navigation — shown only when calibrating */}
        {import.meta.env.DEV && calibMode && !isPreview && (
          <>
            <button
              onClick={calibPrevPage}
              disabled={calibPage <= 1}
              style={{
                flex: 1, padding: 13, borderRadius: 12,
                border: '2px solid #6d28d9',
                background: calibPage <= 1 ? '#f5f3ff' : '#fff',
                color: calibPage <= 1 ? '#c4b5fd' : '#6d28d9',
                fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                cursor: calibPage <= 1 ? 'default' : 'pointer',
              }}
            >
              ← Pg {calibPage > 1 ? calibPage - 1 : '—'}
            </button>
            <button
              onClick={calibNextPage}
              disabled={calibPage >= totalPages}
              style={{
                flex: 1, padding: 13, borderRadius: 12,
                border: 'none',
                background: calibPage >= totalPages ? '#ede9fe' : '#6d28d9',
                color: calibPage >= totalPages ? '#c4b5fd' : '#fff',
                fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                cursor: calibPage >= totalPages ? 'default' : 'pointer',
              }}
            >
              Pg {calibPage < totalPages ? calibPage + 1 : '—'} →
            </button>
          </>
        )}

        {/* Normal back / next — hidden while calibrating */}
        {!calibMode && !isFirstStep && (
          <button onClick={onBack} style={{
            flex: 1, padding: 13, borderRadius: 12,
            border: `2px solid ${accent}`, background: '#fff', color: accent,
            fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            transition: 'border-color 0.3s, color 0.3s',
          }}>← Back</button>
        )}
        {!calibMode && !isLastStep && (
          <button onClick={onNext} style={{
            flex: 2, padding: 13, borderRadius: 12,
            border: 'none', background: accent, color: '#fff',
            fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            transition: 'background 0.3s',
          }}>
            {step === steps.length - 2 ? 'Preview Form →' : 'Next →'}
          </button>
        )}
      </div>

      {/* ── PDF preview overlay ───────────────────────────────────────────── */}
      {isPreview && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.9)', zIndex: 10,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            padding: '12px 16px',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <FileText size={22} color={accent} style={{ flexShrink: 0 }} />
              <span style={{
                fontWeight: 600, fontSize: 15, color: '#111',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{title}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12, flexShrink: 0 }}>
              <button onClick={onShare} style={{
                padding: '8px 14px', border: 'none',
                background: accent, color: '#fff',
                cursor: 'pointer', borderRadius: 8,
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
              }}>
                <Share2 size={16} color="#fff" /> Print / Save / Share
              </button>
              <button onClick={onClosePreview} style={{
                padding: 8, border: 'none', background: 'none',
                cursor: 'pointer', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={24} color="#dc2626" />
              </button>
            </div>
          </div>
          {missingFields && missingFields.length > 0 && (
            <div style={{
              background: '#fef3c7', borderBottom: '2px solid #f59e0b',
              padding: '8px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 8,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.4 }}>
                <strong>Missing fields:</strong> {missingFields.join(', ')}
              </div>
            </div>
          )}
          <div style={{ flex: 1, background: '#111827', overflowY: 'auto', padding: 16 }}>
            {previewContent}
          </div>
        </div>
      )}
    </div>
  )
}

