/**
 * DistributionTransformerLimits.js — Shared range-checking constants and
 * row-status logic for 220F028B (Distribution Transformer Commissioning
 * Certificate).
 *
 * Previously this logic was defined independently in both
 * DistributionTransformerWizard.jsx (for live tick/cross feedback in the UI)
 * and DistributionTransformerPdfGenerator.js (for tick/cross marks drawn on
 * the generated PDF). Two independently-maintained copies of the same
 * thresholds is exactly the kind of silent index/logic-coupling bug this
 * project has hit before (see HVInspectionChecks.js / PoleConstants.js for
 * the established fix pattern) — this file is now the single source of
 * truth for both call sites.
 *
 * Bug fix note (v2.19.0): earthRange() previously used a strict `<` when
 * checking a reading against EARTH_LIMITS, even though the limits are
 * documented (and the standard is) "N Ω or less". A reading of exactly the
 * limit (e.g. exactly 25 Ω) would incorrectly fail to tick. Now uses `<=`.
 */

// Voltage measurements within each circuit card (section f)
export const VOLT_MEASUREMENTS = [
  { key: 'rw', label: 'R to W', acceptable: '412–422 V' },
  { key: 'wb', label: 'W to B', acceptable: '412–422 V' },
  { key: 'br', label: 'B to R', acceptable: '412–422 V' },
  { key: 'rn', label: 'R to N', acceptable: '238–244 V' },
  { key: 'wn', label: 'W to N', acceptable: '238–244 V' },
  { key: 'bn', label: 'B to N', acceptable: '238–244 V' },
]

// Phasing measurements within each circuit card (section i)
export const PHASING_MEASUREMENTS = [
  { key: 'r1r2', label: 'R1 to R2', acceptable: '<10 V' },
  { key: 'w1w2', label: 'W1 to W2', acceptable: '<10 V' },
  { key: 'b1b2', label: 'B1 to B2', acceptable: '<10 V' },
]

// Earth resistance limits (section b) — results must be AT OR BELOW these values
export const EARTH_LIMITS = {
  earthLeg1: 25,  // electrode ≤ 25 Ω
  earthLeg2: 25,
  menUrban:   5,  // MEN urban ≤ 5 Ω
  menRural:  25,  // MEN rural ≤ 25 Ω
}

// Loop impedance limit (section j) — must be below 0.2 Ω
export const LOOP_LIMIT = 0.2

// ── Range-checking helpers ────────────────────────────────────────────────────
// Each returns true (in range) | false (out of range) | null (no value entered)

export function voltRange(key, val) {
  if (val === '' || val == null) return null
  const n = parseFloat(val)
  if (isNaN(n)) return false
  if (['rw', 'wb', 'br'].includes(key)) return n >= 412 && n <= 422
  if (['rn', 'wn', 'bn'].includes(key)) return n >= 238 && n <= 244
  return null
}

export function phasingRange(val) {
  if (val === '' || val == null) return null
  const n = parseFloat(val)
  if (isNaN(n)) return false
  return n < 10
}

// Earth resistance: must be AT OR BELOW the limit (lower = better)
export function earthRange(key, val) {
  if (val === '' || val == null) return null
  const n = parseFloat(val)
  if (isNaN(n)) return false
  const limit = EARTH_LIMITS[key]
  return limit !== undefined ? n <= limit : null
}

// Loop impedance: must be below 0.2 Ω
export function loopRange(val) {
  if (val === '' || val == null) return null
  const n = parseFloat(val)
  if (isNaN(n)) return false
  return n < LOOP_LIMIT
}

// ── Per-row status across all circuits ────────────────────────────────────────
// 'confirmed' = has values AND all in range  → tick
// 'failed'    = has values but any out of range → cross
// 'empty'     = no circuits have a value entered → nothing drawn/shown

export function voltRowStatus(circuits, key) {
  const filled = circuits.map(c => c[key]).filter(v => v !== '' && v != null)
  if (filled.length === 0) return 'empty'
  return filled.every(v => voltRange(key, v) === true) ? 'confirmed' : 'failed'
}

export function phasingRowStatus(circuits, key) {
  const filled = circuits.map(c => c[key]).filter(v => v !== '' && v != null)
  if (filled.length === 0) return 'empty'
  return filled.every(v => phasingRange(v) === true) ? 'confirmed' : 'failed'
}
