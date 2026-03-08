import React, { useState, useEffect } from 'react'
import { Clock, X, ChevronRight, Trash2 } from 'lucide-react'
import { APP_ACCENT } from './constants'
import { loadHistory, formatJobDate, JOB_FIELDS, STORAGE_KEY } from './jobHistory'

// Modal that lets the user pick a previous job to load into the wizard.
// Props:
//   open       — bool
//   onClose    — () => void
//   onSelect   — (fields: object) => void  — called with the job's text fields
//   accent     — colour override (optional)

export function JobHistoryPicker({ open, onClose, onSelect, accent = APP_ACCENT }) {
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (open) setHistory(loadHistory())
  }, [open])

  const handleSelect = entry => {
    const fields = Object.fromEntries(JOB_FIELDS.map(k => [k, entry[k] || '']))
    onSelect(fields)
    onClose()
  }

  const handleDelete = (e, id) => {
    e.stopPropagation()
    const updated = history.filter(h => h.id !== id)
    setHistory(updated)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)) } catch {}
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        zIndex: 1000, touchAction: 'none',
      }} />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1001,
        background: '#fff', borderRadius: '18px 18px 0 0',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
        maxHeight: '75vh', display: 'flex', flexDirection: 'column',
      }}>

        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#ddd' }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 18px 10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} color={accent} />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#1a1a2e' }}>
              Recent Jobs
            </span>
          </div>
          <button onClick={onClose} style={{
            background: '#f3f4f6', border: 'none', borderRadius: 8,
            padding: 6, cursor: 'pointer', display: 'flex',
          }}>
            <X size={18} color="#666" />
          </button>
        </div>

        <div style={{ fontSize: 12, color: '#888', padding: '0 18px 10px' }}>
          Tap a job to load its details into this form
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#f0f0f0', margin: '0 18px' }} />

        {/* Job list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0 24px' }}>
          {history.length === 0 ? (
            <div style={{
              padding: '32px 18px', textAlign: 'center',
              color: '#aaa', fontSize: 14,
            }}>
              No saved jobs yet.<br />
              <span style={{ fontSize: 12 }}>
                Jobs are saved automatically when you advance past the first step.
              </span>
            </div>
          ) : (
            history.map(entry => (
              <button key={entry.id} onClick={() => handleSelect(entry)} style={{
                display: 'flex', alignItems: 'center',
                width: '100%', padding: '14px 18px',
                background: 'transparent', border: 'none',
                borderBottom: '1px solid #f5f5f5',
                cursor: 'pointer', textAlign: 'left', gap: 12,
              }}>
                {/* Colour dot */}
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: accent, flexShrink: 0,
                }} />

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, fontSize: 14, color: '#1a1a2e',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {entry.npJobNumber
                      ? `NP ${entry.npJobNumber}`
                      : entry.pcoWONo
                        ? `W/O ${entry.pcoWONo}`
                        : entry.projectName || entry.streetRoad || 'Unnamed job'}
                  </div>
                  {(entry.projectName || entry.streetRoad) && (
                    <div style={{
                      fontSize: 12, color: '#555', marginTop: 2,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {[entry.projectName, entry.streetRoad, entry.cityTown].filter(Boolean).join(' — ')}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>
                    {[
                      entry.contractor,
                      entry.dateWorkCompleted
                        ? new Date(entry.dateWorkCompleted).toLocaleDateString('en-NZ', { day:'numeric', month:'short', year:'numeric' })
                        : null,
                    ].filter(Boolean).join(' · ')}
                    {entry.savedAt && (
                      <span style={{ marginLeft: 6, color: '#ccc' }}>
                        — saved {formatJobDate(entry)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <button onClick={e => handleDelete(e, entry.id)} style={{
                  background: '#fff0f0', border: 'none', borderRadius: 6,
                  padding: 6, cursor: 'pointer', display: 'flex', flexShrink: 0,
                }}>
                  <Trash2 size={14} color="#ef4444" />
                </button>

                <ChevronRight size={16} color="#ccc" style={{ flexShrink: 0 }} />
              </button>
            ))
          )}
        </div>
      </div>
    </>
  )
}
