// Shared design tokens — import into any wizard or shared component

export const APP_ACCENT = '#4f46e5'   // indigo-600 — primary colour
export const APP_YELLOW = '#FFD700'   // progress bar fill

// Standard indigo wizard colour scheme shared by most wizard types.
// TransformerWizard uses per-step schemes (green/red/neutral).
// HVInspectionWizard omits bg/mid/border (uses WizardShell defaults).
export const WIZARD_COLORS = {
  bg:     '#eef2ff',   // indigo-50
  mid:    '#e0e7ff',   // indigo-100
  border: '#c7d2fe',   // indigo-200
}
