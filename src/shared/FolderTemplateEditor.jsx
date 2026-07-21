/**
 * FolderTemplateEditor — drag-and-drop reorderable list of folder-path
 * tokens, each with an on/off toggle, plus a live example path preview.
 *
 * Groundwork for future OneDrive auto-save (v2.22.0) — see
 * shared/folderStructure.js for the full picture. This component only
 * edits and previews the tech's chosen folder template; nothing is
 * uploaded anywhere yet.
 *
 * Drag implementation
 * ────────────────────
 * Touch-friendly reordering via pointer events (works on iPad, desktop, and
 * Android alike) rather than HTML5 drag-and-drop, which iOS Safari doesn't
 * support well for arbitrary list items. Each row has a dedicated drag
 * handle; dragging it tracks the pointer's vertical position against the
 * other rows' measured bounding boxes and swaps the dragged row past a
 * neighbour once the pointer crosses that neighbour's midpoint — the same
 * "swap on midpoint cross" technique used by most touch reorder lists.
 *
 * Props:
 *   template   [{ token, enabled }]  - current ordered template
 *   onChange   fn(newTemplate)       - called whenever order or a toggle changes
 *   accent     string
 *   previewData object               - sample data used to render the live path preview
 */
import { useRef, useState, useCallback } from 'react'
import { GripVertical } from 'lucide-react'
import { FOLDER_TOKENS, buildFolderPath } from './folderStructure'
import { APP_ACCENT } from './constants'

export function FolderTemplateEditor({ template, onChange, accent = APP_ACCENT, rootFolder, previewData }) {
  const rowRefs = useRef({})
  const [draggingToken, setDraggingToken] = useState(null)
  const dragState = useRef(null) // { startY, currentOrder }

  const toggleEnabled = (token) => {
    onChange(template.map(entry => entry.token === token ? { ...entry, enabled: !entry.enabled } : entry))
  }

  const handlePointerDown = useCallback((e, token) => {
    e.preventDefault()
    setDraggingToken(token)
    dragState.current = { startY: e.clientY, order: template.map(t => t.token) }
    const handleMove = (ev) => {
      if (!dragState.current) return
      const order = dragState.current.order
      const draggedIdx = order.indexOf(token)
      const draggedRect = rowRefs.current[token]?.getBoundingClientRect()
      if (!draggedRect) return
      const draggedMidY = ev.clientY

      // Find which neighbour (if any) the pointer has crossed the midpoint of.
      for (let i = 0; i < order.length; i++) {
        if (i === draggedIdx) continue
        const otherToken = order[i]
        const otherRect = rowRefs.current[otherToken]?.getBoundingClientRect()
        if (!otherRect) continue
        const otherMid = otherRect.top + otherRect.height / 2
        const shouldSwap =
          (i < draggedIdx && draggedMidY < otherMid) ||
          (i > draggedIdx && draggedMidY > otherMid)
        if (shouldSwap) {
          const newOrder = [...order]
          newOrder.splice(draggedIdx, 1)
          newOrder.splice(i, 0, token)
          dragState.current.order = newOrder
          onChange(newOrder.map(tok => template.find(t => t.token === tok)))
          break
        }
      }
    }
    const handleUp = () => {
      dragState.current = null
      setDraggingToken(null)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }, [template, onChange])

  const previewPath = buildFolderPath(previewData, previewData.__formKey, rootFolder, template)

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {template.map(entry => {
          const info = FOLDER_TOKENS[entry.token]
          if (!info) return null
          const dragging = draggingToken === entry.token
          return (
            <div
              key={entry.token}
              ref={el => { rowRefs.current[entry.token] = el }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10,
                border: `1.5px solid ${entry.enabled ? accent + '50' : '#e5e7eb'}`,
                background: dragging ? accent + '15' : entry.enabled ? '#fff' : '#f9fafb',
                boxShadow: dragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                touchAction: 'none',
                zIndex: dragging ? 2 : 1,
                position: 'relative',
              }}
            >
              <span
                onPointerDown={e => handlePointerDown(e, entry.token)}
                style={{
                  cursor: 'grab', display: 'flex', alignItems: 'center',
                  color: '#9ca3af', touchAction: 'none', padding: 4,
                }}
              >
                <GripVertical size={18} />
              </span>
              <span style={{
                flex: 1, fontSize: 13, fontWeight: entry.enabled ? 600 : 400,
                color: entry.enabled ? '#111827' : '#9ca3af',
              }}>
                {info.label}
              </span>
              <button
                onClick={() => toggleEnabled(entry.token)}
                style={{
                  width: 40, height: 22, borderRadius: 11, border: 'none',
                  background: entry.enabled ? accent : '#d1d5db',
                  position: 'relative', cursor: 'pointer', flexShrink: 0,
                  transition: 'background 0.15s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: entry.enabled ? 20 : 2,
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                }} />
              </button>
            </div>
          )
        })}
      </div>

      <div style={{
        marginTop: 12, padding: '10px 12px', borderRadius: 8,
        background: '#f3f4f6', fontSize: 12, color: '#6b7280',
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4, color: '#9ca3af', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.05em' }}>
          Example folder path
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 12.5, color: accent, wordBreak: 'break-all' }}>
          {previewPath || '(no tokens enabled)'}
        </div>
      </div>
    </div>
  )
}
