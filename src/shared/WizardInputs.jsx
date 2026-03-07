import React from 'react'
import { APP_ACCENT } from './constants'

export const wInp = {
  width: '100%', padding: '9px 11px', border: '2px solid #ddd', borderRadius: 8,
  fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  background: '#fafafa', color: '#222',
}
export const wLbl = {
  display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 3,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

export function WF({ label, v, set, type = 'text', ph, accent = APP_ACCENT }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ ...wLbl, color: accent !== APP_ACCENT ? accent : wLbl.color }}>{label}</label>}
      <input type={type} value={v || ''} onChange={e => set(e.target.value)}
        placeholder={ph} style={{ ...wInp, borderColor: v ? accent : '#ddd' }} />
    </div>
  )
}

export function WTA({ label, v, set, rows = 3, ph, accent = APP_ACCENT }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ ...wLbl, color: accent !== APP_ACCENT ? accent : wLbl.color }}>{label}</label>}
      <textarea value={v || ''} onChange={e => set(e.target.value)}
        rows={rows} placeholder={ph}
        style={{ ...wInp, height: 'auto', resize: 'vertical', borderColor: v ? accent : '#ddd' }} />
    </div>
  )
}

export function WCB({ label, options, value, onChange, multi, accent = APP_ACCENT }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={wLbl}>{label}</label>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: label ? 4 : 0 }}>
        {options.map(o => {
          const sel = multi ? (value || []).includes(o) : value === o
          return (
            <button key={o} onClick={() => onChange(o)} style={{
              padding: '7px 12px', borderRadius: 8,
              border: `2px solid ${sel ? accent : '#ddd'}`,
              background: sel ? accent : '#fff',
              color: sel ? '#fff' : '#333',
              fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', fontWeight: sel ? 700 : 400,
            }}>{o}</button>
          )
        })}
      </div>
    </div>
  )
}

// Generic section header — pass accent to override colour (e.g. green for TX issued)
export function SectionHead({ label, sub, accent = APP_ACCENT }) {
  return (
    <div style={{ marginBottom: 10, marginTop: 4, paddingBottom: 5, borderBottom: `2px solid ${accent}30` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}
