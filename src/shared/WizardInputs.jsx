import React, { useState, useEffect, useRef } from 'react'
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

// ── Input latency mitigation (v2.20.3) ────────────────────────────────────
// WF/WTA used to call `set()` (the wizard's setD) on every single keystroke,
// which replaces the entire top-level form-state object and re-renders the
// whole current step for every character typed — noticeable lag on the
// longer text fields (comments, work descriptions) on slower tablets.
//
// Both components now keep the value the person SEES in local state, so
// typing always feels instant and only re-renders this one input. The
// upstream `set()` call (which triggers the big wizard-level re-render) is
// debounced by TEXT_DEBOUNCE_MS, and flushed immediately on blur so nothing
// is lost if the person taps Next/Back, opens a modal, or moves to another
// field right away — those all blur the current input first.
//
// Flush (not discard) a pending debounce on unmount (v2.20.4)
// ──────────────────────────────────────────────────────────────
// If this input unmounts WHILE a debounced write is still pending — e.g. a
// step change fires from something other than blurring this field, such as
// the dev-fill tool replacing wizard state, or a programmatic step jump —
// the pending edit used to be silently discarded: the cleanup only cleared
// the timer, it never committed the value. latestValueRef/setRef track the
// most recent local value and `set` across renders (the unmount effect
// itself only runs once, so without these refs it would only ever see the
// value/set from the FIRST render), so the cleanup can flush the true
// latest edit up to the wizard's state instead of dropping it.
const TEXT_DEBOUNCE_MS = 250

export function WF({ label, v, set, type = 'text', ph, accent = APP_ACCENT }) {
  const [focused, setFocused] = useState(false)
  const isNumeric = type === 'number'

  const [localValue, setLocalValue] = useState(v || '')
  const debounceRef = useRef(null)

  // Stay in sync with value changes that come from OUTSIDE this input —
  // draft/crash-recovery restore, GPS autofill, dev-fill, etc. Harmless if
  // it also fires right after our own debounced write lands, since setting
  // state to its own value is a no-op re-render.
  useEffect(() => { setLocalValue(v || '') }, [v])

  // Always-current refs so the unmount cleanup (which only runs once, with
  // a closure fixed at mount) can flush the LATEST value/set rather than
  // whatever they were on the first render.
  const latestValueRef = useRef(localValue)
  const setRef = useRef(set)
  useEffect(() => { latestValueRef.current = localValue }, [localValue])
  useEffect(() => { setRef.current = set }, [set])

  // Flush any pending debounced edit on unmount instead of discarding it.
  useEffect(() => () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      setRef.current(latestValueRef.current)
    }
  }, [])

  const commitNow = (val) => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    set(val)
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ ...wLbl, color: accent !== APP_ACCENT ? accent : wLbl.color }}>{label}</label>}
      <input
        type={isNumeric ? 'text' : type}
        inputMode={isNumeric ? 'numeric' : undefined}
        pattern={isNumeric ? '[0-9]*' : undefined}
        value={localValue}
        onChange={e => {
          const raw = e.target.value
          // Strip non-digits on desktop for numeric fields.
          // Mobile keyboards are already constrained via inputMode/pattern.
          const next = isNumeric ? raw.replace(/[^0-9]/g, '') : raw
          setLocalValue(next)
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => { debounceRef.current = null; set(next) }, TEXT_DEBOUNCE_MS)
        }}
        placeholder={ph}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); commitNow(localValue) }}
        style={{
          ...wInp,
          borderColor: focused ? accent : localValue ? accent : '#ddd',
          boxShadow: focused ? `0 0 0 3px ${accent}25` : 'none',
        }} />
    </div>
  )
}

export function WTA({ label, v, set, rows = 3, ph, accent = APP_ACCENT }) {
  const [focused, setFocused] = useState(false)

  const [localValue, setLocalValue] = useState(v || '')
  const debounceRef = useRef(null)

  useEffect(() => { setLocalValue(v || '') }, [v])

  // Always-current refs so the unmount cleanup (which only runs once, with
  // a closure fixed at mount) can flush the LATEST value/set rather than
  // whatever they were on the first render.
  const latestValueRef = useRef(localValue)
  const setRef = useRef(set)
  useEffect(() => { latestValueRef.current = localValue }, [localValue])
  useEffect(() => { setRef.current = set }, [set])

  // Flush any pending debounced edit on unmount instead of discarding it.
  useEffect(() => () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      setRef.current(latestValueRef.current)
    }
  }, [])

  const commitNow = (val) => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    set(val)
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ ...wLbl, color: accent !== APP_ACCENT ? accent : wLbl.color }}>{label}</label>}
      <textarea value={localValue}
        onChange={e => {
          const next = e.target.value
          setLocalValue(next)
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => { debounceRef.current = null; set(next) }, TEXT_DEBOUNCE_MS)
        }}
        rows={rows} placeholder={ph}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); commitNow(localValue) }}
        style={{
          ...wInp,
          height: 'auto', resize: 'vertical',
          borderColor: focused ? accent : localValue ? accent : '#ddd',
          boxShadow: focused ? `0 0 0 3px ${accent}25` : 'none',
        }} />
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

// Generic section header — pass accent to override colour
export function SectionHead({ label, sub, accent = APP_ACCENT }) {
  return (
    <div style={{ marginBottom: 10, marginTop: 4, paddingBottom: 5, borderBottom: `2px solid ${accent}30` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}
