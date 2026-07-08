/**
 * CrashRecoveryBanner — shown when useCrashRecovery() (see
 * src/shared/useDraft.jsx) finds an autosaved snapshot for the current
 * wizard left over from a previous session that was never explicitly
 * saved as a named draft or submitted (e.g. the app crashed, the tab was
 * closed, or the device lost power mid-fill).
 *
 * Purely presentational — all IndexedDB read/write/restore/discard logic
 * lives in useCrashRecovery(). This component only renders whatever state
 * that hook hands back and forwards taps to its restore()/discard()
 * callbacks. Renders nothing once dismissed either way.
 *
 * Usage (see any wizard for a live example):
 *   const crashRecovery = useCrashRecovery({ formKey: FORM_KEY, setD, setStep, setPhotos })
 *   ...
 *   <CrashRecoveryBanner recovery={crashRecovery} accent={ACCENT} />
 */
import { FolderOpen } from 'lucide-react'
import { draftAge } from './draftStore'
import { APP_ACCENT } from './constants'

export function CrashRecoveryBanner({ recovery, accent = APP_ACCENT }) {
  if (!recovery || !recovery.available) return null

  const photoCount = recovery.photos?.length || 0
  const subline = [
    recovery.step > 0 && `Step ${recovery.step + 1}`,
    photoCount > 0 && `${photoCount} photo${photoCount !== 1 ? 's' : ''}`,
  ].filter(Boolean).join(' · ')

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 500 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 501, background: '#fff', borderRadius: 20, padding: '1.75rem',
        maxWidth: 380, width: 'calc(100% - 2.5rem)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: accent + '15',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}>
          <FolderOpen size={22} color={accent} />
        </div>

        <div style={{ fontWeight: 800, fontSize: 17, color: '#111827', marginBottom: 6 }}>
          Unsaved progress found
        </div>

        <p style={{ fontSize: 13.5, color: '#6b7280', lineHeight: 1.5, margin: '0 0 6px' }}>
          This form was left open {draftAge(recovery)} without being saved or submitted.
          Would you like to continue where you left off?
        </p>

        {subline && (
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 4px' }}>{subline}</p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button
            onClick={recovery.discard}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 12,
              border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Start Fresh
          </button>
          <button
            onClick={recovery.restore}
            style={{
              flex: 1.4, padding: '12px 0', borderRadius: 12,
              border: 'none', background: accent, color: '#fff',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Continue Editing
          </button>
        </div>
      </div>
    </>
  )
}
