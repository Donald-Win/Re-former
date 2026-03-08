import React from 'react'
import { FileText, Share2, X } from 'lucide-react'
import { APP_YELLOW } from './constants'

/**
 * WizardShell — shared outer chrome for all form wizards.
 *
 * Props:
 *   title          string        — e.g. "AS-Built Pole Record"
 *   formNumber     string        — e.g. "360S014EC"
 *   headerIcon     ReactElement  — icon shown in header bar (default: FileText)
 *   headerBadge    string|null   — optional pill in header (TX scheme label)
 *
 *   steps          string[]      — step name labels
 *   step           number        — current step index
 *   onStepClick    fn(i)         — dot nav click
 *   onClose        fn()          — X button in header
 *   onBack         fn()          — ← Back button (hidden on step 0)
 *   onNext         fn()          — Next / Preview button
 *
 *   accent         string        — header bg, card shadow, active dot, nav buttons
 *   bg             string        — outer background colour
 *   mid            string        — progress strip + nav bar background
 *   border         string        — progress strip bottom border + card border
 *   progressColor  string        — progress bar fill (default APP_YELLOW)
 *   getDotColor    fn(i)         — returns colour for dot i (default: () => accent)
 *   devPaddingTop  number        — top padding when dev overlay is active (default 0)
 *
 *   isPreview      bool
 *   onShare        fn()
 *   onClosePreview fn()
 *   missingFields  string[]|null — field names shown in warning banner
 *   previewContent ReactNode     — spinner / error / PdfCanvasPreview
 *
 *   children       ReactNode     — formSteps[step] content
 */
export function WizardShell({
  // Identity
  title,
  formNumber,
  headerIcon,
  headerBadge,

  // Navigation
  steps,
  step,
  onStepClick,
  onClose,
  onBack,
  onNext,

  // Colours
  accent,
  bg = '#f4f4f8',
  mid = '#fff',
  border = '#eee',
  progressColor = APP_YELLOW,
  getDotColor,

  // Dev overlay
  devPaddingTop = 0,

  // Preview
  isPreview,
  onShare,
  onClosePreview,
  missingFields,
  previewContent,

  // Body
  children,
}) {
  const resolvedDotColor = getDotColor || (() => accent)
  const isLastStep  = step === steps.length - 1
  const isFirstStep = step === 0

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
          <div style={{ fontSize: 10, opacity: 0.75 }}>{formNumber}</div>
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

      {/* ── Progress strip ───────────────────────────────────────────────── */}
      <div style={{
        background: mid, borderBottom: `1px solid ${border}`,
        padding: '10px 16px', flexShrink: 0, transition: 'background 0.3s',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: accent, transition: 'color 0.3s' }}>
            {steps[step]}
          </span>
          <span style={{ fontSize: 12, color: '#999' }}>{step + 1} / {steps.length}</span>
        </div>
        <div style={{ height: 5, background: 'rgba(0,0,0,0.1)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(step + 1) / steps.length * 100}%`,
            background: progressColor,
            borderRadius: 4,
            transition: 'width .3s, background .3s',
          }} />
        </div>
        <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
          {steps.map((_, i) => (
            <button key={i} onClick={() => i <= step && onStepClick(i)} style={{
              flexShrink: 0,
              width: i === step ? 18 : 7,
              height: 7,
              borderRadius: 4,
              border: 'none', padding: 0,
              cursor: i <= step ? 'pointer' : 'default',
              background: i <= step ? resolvedDotColor(i) : '#ccc',
              opacity: i === step ? 1 : 0.6,
              transition: 'all .2s',
            }} />
          ))}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
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

      {/* ── Nav bar ──────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: mid, borderTop: `1px solid ${border}`,
        padding: '10px 16px', display: 'flex', gap: 10,
        transition: 'background 0.3s',
      }}>
        {!isFirstStep && (
          <button onClick={onBack} style={{
            flex: 1, padding: 13, borderRadius: 12,
            border: `2px solid ${accent}`, background: '#fff', color: accent,
            fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            transition: 'border-color 0.3s, color 0.3s',
          }}>← Back</button>
        )}
        {!isLastStep && (
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

      {/* ── PDF preview overlay ──────────────────────────────────────────── */}
      {isPreview && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.9)', zIndex: 10,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Preview header */}
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

          {/* Missing-fields warning */}
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

          {/* PDF content area */}
          <div style={{ flex: 1, background: '#111827', overflowY: 'auto', padding: 16 }}>
            {previewContent}
          </div>
        </div>
      )}
    </div>
  )
}
