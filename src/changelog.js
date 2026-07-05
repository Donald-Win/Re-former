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
    version: '2.18.2',
    changes: [
      {
        heading: 'GPS buttons time out less often in weak-signal areas',
        detail: 'The "Use my GPS" and "Use my location" buttons were requesting a brand-new satellite fix on every tap, which could take longer than 15 seconds in rural areas or under cover. They now accept a location reading from the last 30 seconds, which is still accurate enough for field records and far less likely to time out.',
      },
      {
        heading: 'Signature drawing runs slightly faster',
        detail: 'The calculation that trims blank space around a saved signature has been sped up under the hood. Not something you\'ll see directly, but one less thing for the app to do after every signature.',
      },
    ],
  },
  {
    version: '2.18.1',
    changes: [
      {
        heading: 'Saved drafts no longer drop photos beyond the fifth',
        detail: 'Saving a named draft, or letting the app auto-save your progress in the background, was still silently keeping only the first 5 photos — even though full photo sets have been supported everywhere else since 2.17.0. All attached photos are now kept in both cases.',
      },
      {
        heading: 'Loading a draft now always replaces your current photos',
        detail: 'If you had photos attached to a form and then loaded a different saved draft with fewer (or no) photos, the old photos could be left in place instead of being replaced. Loading a draft now always shows exactly the photos saved with it.',
      },
      {
        heading: 'Earth resistance tick on Distribution Transformer Commissioning Certificate',
        detail: 'A reading exactly at the limit (e.g. exactly 25 Ω) now correctly shows a green tick, matching the "25 Ω or less" standard, instead of only ticking for readings strictly below it.',
      },
    ],
  },
  {
    version: '2.18.0',
    changes: [
      {
        heading: 'GPS button for Pole Record co-ordinates',
        detail: 'The GPS Co-ordinates section on the Pole Record wizard now has a "Use my GPS" button. Tap it to read your device\'s location and automatically fill in North, East, and Altitude — no more typing co-ordinates in by hand or switching to a separate map app.',
      },
    ],
  },
  {
    version: '2.17.0',
    changes: [
      {
        heading: 'Add Row buttons no longer vanish when all rows are deleted',
        detail: 'In the Pole Record and Zone Substation wizards, tapping × on every conductor, crossarm, or equipment row permanently hid the “Add Row” button, locking the form. The button now always stays visible below the row list.',
      },
      {
        heading: 'Save Draft button no longer gets stuck on “Saving…”',
        detail: 'After a successful save, the Save Draft button would stay disabled and show “Saving…” for the rest of the session. It now resets correctly after every save.',
      },
      {
        heading: 'All attached photos are now saved in drafts',
        detail: 'Drafts and autosaves were silently dropping any photos beyond the fifth. All photos are now saved in full — the storage system (IndexedDB) was specifically chosen to handle large photo sets without any limit.',
      },
      {
        heading: 'Background fixes',
        detail: 'Fixed a timer left running in the background after every PDF generation. Fixed an issue where HV Inspection Certificate signature data could be stored unnecessarily in draft saves.',
      },
    ],
  },
  {
    version: '2.16.0',
    changes: [
      {
        heading: 'Tap the version number to see the full changelog',
        detail: 'The small "v2.x.x" label in the bottom-right corner is now tappable and opens the complete history of every update, not just the latest one — handy for checking what changed a few versions back.',
      },
    ],
  },
  {
    version: '2.15.0',
    changes: [
      {
        heading: 'Browse All Forms — collapsible categories',
        detail: 'Pre-Work, Test & Verification, As-Built Forms, and Commissioning & Test Certificates now collapse under tappable headers and start closed, so the page is much shorter to scroll through. Searching by name or ID automatically opens any category with matching results.',
      },
    ],
  },
  {
    version: '2.14.0',
    changes: [
      {
        heading: 'Signature now visible in My Details',
        detail: 'Opening My Details (⚙️) previously showed an empty box even after you\'d already saved a signature. Your saved signature now displays there properly, so you can check it at a glance and only need to draw a new one if you want to change it.',
      },
      {
        heading: 'Choose your default screen',
        detail: 'My Details (⚙️) now has a "Default View on Open" option, so you can choose whether the app starts on "By Work Type" or "Browse All Forms" each time you open it.',
      },
    ],
  },
  {
    version: '2.13.0',
    changes: [
      {
        heading: 'Offline indicator',
        detail: 'A bar now appears at the bottom of the screen whenever your device loses its connection — "📵 You\'re offline — forms and drafts work, but sharing requires a connection." It disappears automatically when you\'re back online.',
      },
      {
        heading: 'Blank PDFs open instantly on repeat access',
        detail: 'Form PDFs are now served from the cache immediately on every open after the first — no more waiting for a network response before the PDF appears. A background fetch keeps the cached copy fresh for next time.',
      },
      {
        heading: 'App updates are now user-controlled',
        detail: 'Previously, a new app version would install and reload automatically. Now the "Update available" banner appears and nothing happens until you tap "Update now". No more surprise reloads while filling out a form.',
      },
      {
        heading: 'Offline use is fully reliable',
        detail: 'The service worker has been rebuilt using Workbox. All app code — including the PDF renderer (pdfjs) — is now properly pre-cached when you first load the app. Forms, wizards, and PDF previews all work the same with no internet connection.',
      },
      {
        heading: 'Draft photos can no longer be lost',
        detail: 'Draft and project storage has been moved from localStorage to IndexedDB. Photo data in drafts is no longer at risk of being silently deleted by the browser when device storage gets tight.',
      },
      {
        heading: 'Number fields show the number pad on mobile',
        detail: 'All numeric input fields (cable lengths, fuse sizes, number of conductors, etc.) now bring up the numeric keypad on iOS and Android instead of the full keyboard. Letters are also blocked so you can\'t accidentally type text into a numbers-only field.',
      },
      {
        heading: '"Use my location" button improved',
        detail: 'The GPS button now shows "⏳ Please wait…" and disables itself for 2 seconds after any error, preventing accidental rapid re-taps that could temporarily block location lookups. The error message for Android has also been updated to work for any browser, not just Chrome.',
      },
      {
        heading: 'PDF preview no longer jumps when loading',
        detail: 'Multi-page form previews previously caused a jarring snap — the preview area would collapse and then suddenly expand as each page finished rendering. The correct height is now reserved upfront so the scroll position stays stable throughout.',
      },
      {
        heading: 'Signature feels smoother on iPads',
        detail: 'The signature bounding-box calculation was rewritten to be significantly faster. On retina/HiDPI iPads the old code was scanning ~240,000 pixels on every stroke end, causing a brief stutter. The new code typically exits after scanning ~10–20 rows.',
      },
      {
        heading: 'Accidental zoom disabled on field devices',
        detail: 'Pinch-to-zoom is now disabled. On iPads and Android tablets, accidentally zooming the form while tapping or swiping between fields is no longer possible.',
      },
      {
        heading: 'Faster startup',
        detail: 'The app bundle is now split into separate chunks — React, pdf-lib, pdfjs, and each wizard\'s PDF generator only load when needed. First load and navigation are noticeably quicker on slower mobile connections.',
      },
    ],
  },
  {
    version: '2.12.0',
    changes: [
      {
        heading: 'User Settings',
        detail: 'Your name, contractor, competency cert number, and signature are now saved once in a dedicated settings page (gear icon ⚙️ in the header). Every form wizard picks these up automatically — no more filling them in each time.',
      },
      {
        heading: 'Project & Draft system',
        detail: 'Create and save named projects (job number, W/O, project name) and load them into any form in one tap. Save named drafts mid-fill and reload them later — useful for pre-filling a batch of forms before heading to site.',
      },
      {
        heading: 'HV Inspection Certificate — 220F028A',
        detail: 'New wizard for the Pre-Commissioning HV Inspection Certificate. Select the equipment types being commissioned and each gets its own check step showing only the applicable rows. Tick All button covers Visual, Operation, Performance, QA, and Documentation in one tap.',
      },
      {
        heading: 'Improved form navigation',
        detail: 'The 💾 Save Draft button now appears in the nav bar on every step of every wizard — no need to go back to step 1 to save. The Load Draft button on step 1 opens straight to your saved drafts list.',
      },
    ],
  },
  {
    version: '2.11.0',
    changes: [
      {
        heading: 'Save for later',
        detail: 'A new 💾 button in the bottom nav bar lets you save your progress and close a wizard mid-fill. When you reopen the form, a prompt appears asking if you want to continue where you left off or start fresh. Perfect for filling in what you know beforehand and adding photos on the day.',
      },
      {
        heading: 'Smarter file names',
        detail: 'Saved PDFs now include the site-specific ID in the filename. Pole Record uses the Old Pole ID, Transformer uses the Transformer Site ID, LV Connection uses the ICP Number, Elec Equipment uses the Equipment ID, LV Box uses the Box Equipment ID, and Zone Sub uses the Substation name.',
      },
      {
        heading: 'Smaller PDF file sizes',
        detail: 'Photos attached to PDFs are now compressed more aggressively — capped at 1600px on the longest edge and exported at 75% quality instead of 92%. A typical 4-photo PDF is now 60–80% smaller.',
      },
      {
        heading: 'Bug fixes',
        detail: 'Fixed a crash when generating any PDF where a signature had been drawn. Fixed automatic app updates not applying on iOS. Fixed the signature being accidentally saved into the draft cache. Fixed a memory leak when previewing PDFs multiple times in one session.',
      },
    ],
  },
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
