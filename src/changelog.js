// ── Changelog ────────────────────────────────────────────────────────────────
// Each entry in CHANGELOGS is a batch with a unique version key.
// Users see ALL batches they haven't dismissed yet — so if you push two
// updates before a user opens the app, they'll see both in sequence.
//
// To announce an update:
//   1. Add a NEW object to the TOP of the CHANGELOGS array
//   2. Give it a unique `version` string
//   3. Fill in the `changes` array
//   4. Deploy — users see it once, then never again
//
// To deploy silently: don't touch this file.

export const CHANGELOGS = [
  {
    version: '2.10.0',
    changes: [
      {
        heading: 'Use my location',
        detail: 'A new button on the job details step automatically fills in your street address, city, and district using your device GPS.',
      },
      {
        heading: 'Contractor, name & signature remembered',
        detail: 'Your contractor name, your name, and your signature are saved on the device and pre-filled every time you open a form. Date Work Completed also defaults to today.',
      },
      {
        heading: 'Pole Record — conductor quick-pick',
        detail: 'Choose Cu or Ali to fast-select conductors. Cu shows common sizes and sets HDCu automatically. Ali lists all named NZ conductors alphabetically with the seven most common pinned at the top. Both ask Bare or PVC to finish. Manual entry is still available.',
      },
      {
        heading: 'Pole Record — crossarm improvements',
        detail: 'End Size is now a labelled dropdown (A, B, D, Z) with dimensions shown. Arms selects Single or Double. Length and number of wires accept numbers only. End size, length, arms and material are grouped together.',
      },
      {
        heading: 'Signature improvements',
        detail: 'The signature pad now uses velocity-based stroke thickness for a natural pen feel. Dots and short taps are drawn correctly. Stroke smoothing improved.',
      },
      {
        heading: 'Unified app colour',
        detail: 'All six wizards now use the same indigo colour scheme. PDF overlay text and the signature ink are also matched so the whole document looks like it was filled with the same pen.',
      },
    ],
  },
  {
    version: '2.9.0',
    changes: [
      {
        heading: 'Photo attachments',
        detail: 'All six wizards now have a Photos step before the preview. Attach job site photos and they will be appended to the PDF — one per page, correctly oriented.',
      },
      {
        heading: 'Pole Record — smarter conductor & crossarm entry',
        detail: 'Level, Existing/New, Material, and Insulation Type in the Conductors section are now dropdowns. Level auto-fills to match the row number. Material options are HDCu, ACSR, AAC, AAAC, and ABC.',
      },
      {
        heading: 'Pole Record — crossarm dropdowns',
        detail: 'Rated Voltage, Number of Arms, and Arm Material in the Crossarms section are now dropdowns. Arm Material shows Timber, Steel, or Composite and writes the correct T/S/C code to the form.',
      },
    ],
  },
  {
    version: '2.8.0',
    changes: [
      {
        heading: 'Smart file names',
        detail: 'Saved PDFs are now named using your Project Name and NP Job Number — e.g. "Pyes Pa Blitz - TC1234567 - Pole Record.pdf"',
      },
      {
        heading: 'Draft autosave',
        detail: 'If you accidentally close a wizard mid-fill, your work is saved. A "Restore draft" banner appears when you reopen the form.',
      },
      {
        heading: 'Fixed bug on iPad',
        detail: 'Saving a PDF to iPad was creating an unwanted sidecar text file. This has been fixed.',
      },
      {
        heading: 'Changed print handling for blank PDF',
        detail: 'Native PDF viewer in Safari on iOS was not handling the blank PDF fipes correctly. Changed to use the same custom handler as the wizard system. should handle printing far better',
      },
      {
        heading: 'Update notices',
        detail: "You'll now see a summary of what's changed when the app updates — like this one.",
      },
    ],
  },
]
