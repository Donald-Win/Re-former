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
    version: '2.22.0',
    changes: [
      {
        heading: 'New optional "Map Number" field',
        detail: "You'll notice a new Map Number field on the job details step of every form. It's optional and only needed if you use one — it's being added now to get ready for a future update that will save your finished PDFs straight into OneDrive, organised into folders automatically. Nothing changes yet if you leave it blank.",
      },
      {
        heading: 'New "Folder Structure" option in My Details',
        detail: "My Details (⚙️) now has a Folder Structure section where you can set a OneDrive root folder name and choose how your job folders will be organised — by Project Name, Map Number, Site ID, and so on. Drag to reorder, or switch a level off if you don't want it. This is groundwork only for now — automatic saving to OneDrive isn't switched on yet — but it lets you set up your preferred layout ahead of time and see a live preview of what it'll look like.",
      },
    ],
  },
  {
    version: '2.21.0',
    changes: [
      {
        heading: "\"What's New\" no longer dumps the entire update history at once",
        detail: "If the app's storage was ever cleared (or on a brand-new device), the app couldn't tell that apart from a fresh install — so it showed every update going all the way back to the very first release, one after another. It now recognises this case and quietly catches up in the background instead, so you'll only ever see genuinely new updates from that point forward.",
      },
      {
        heading: '"Skip all" button on the What\'s New screen',
        detail: "If several updates ever do pile up waiting to be seen (for example, if the app hasn't been opened in a while), a \"Skip all\" link now appears next to the page counter so you're not stuck tapping \"Next\" through each one.",
      },
    ],
  },
  {
    version: '2.20.6',
    changes: [
      {
        heading: 'Faster PDF generation for forms with several photos attached',
        detail: "Photos that were already correctly sized and oriented at the moment they were attached are now added straight into the PDF, instead of being processed a second time during generation. This speeds up generating any form with photos attached, especially several at once, with no change to how the photos look in the finished PDF. A backup process still handles the rare case where a photo couldn't be fully prepared when it was first attached.",
      },
    ],
  },
  {
    version: '2.20.5',
    changes: [
      {
        heading: 'Photos attached to PDFs look slightly sharper',
        detail: "Photos were being compressed twice — once when you attached them, and again while the PDF was being generated — and the second pass used a lower quality setting than the first, for no size benefit. That second pass is still needed (it's what keeps photos the right way up), but now keeps more of the original quality instead of needlessly softening an image that was already sized appropriately.",
      },
    ],
  },
  {
    version: '2.20.4',
    changes: [
      {
        heading: 'Completed forms no longer wrongly show "unsaved progress"',
        detail: "On some devices, sharing or printing a finished PDF didn't properly mark the form as complete. Reopening that form afterwards could still show an \"unsaved progress found\" prompt even though it had already been finished and shared. This now clears correctly every time, on every device.",
      },
      {
        heading: 'HV Inspection Certificate — corrected tick placement for Performance Tests',
        detail: 'A background fix ensures every row under Performance Tests lines up with the correct equipment column on the generated PDF.',
      },
      {
        heading: 'HV Inspection Certificate — restoring unsaved progress returns to the right step',
        detail: "If the app closed unexpectedly partway through an HV Inspection Certificate, restoring that progress could land you further back than necessary. It now returns you to the step you were actually on.",
      },
      {
        heading: 'Background fixes',
        detail: 'Added a safeguard so text typed into a field is not lost in the rare case where the screen changes at the exact moment you were typing.',
      },
    ],
  },
  {
    version: '2.20.3',
    changes: [
      {
        heading: 'Photos take up less space and save faster',
        detail: 'Photos are now resized and compressed as soon as you attach them, instead of only when the PDF is generated. Saved drafts and background progress-saving with several photos attached are now much smaller and quicker to save.',
      },
      {
        heading: 'Typing feels smoother on longer fields',
        detail: 'Comments, work descriptions, and other free-text fields no longer cause a brief stutter on each keystroke — most noticeable on older tablets.',
      },
      {
        heading: 'PDF generation recovers automatically after a failure',
        detail: 'If PDF generation ran into trouble in the background (most likely when processing a large batch of photos), every later attempt could get stuck until the app was fully reloaded. It now recovers on its own, and Retry works as expected.',
      },
      {
        heading: '"Use my location" is more reliable when closing a form quickly',
        detail: 'Looking up an address no longer keeps running, or tries to fill in fields, after the form has already been closed.',
      },
      {
        heading: 'Save Draft always suggests an up-to-date name',
        detail: 'The suggested draft name could occasionally be based on slightly outdated job details if they changed right as the Save Draft screen opened. It now always reflects the latest details.',
      },
      {
        heading: 'Background fixes',
        detail: 'Fixed a small memory leak that could occur after sharing a PDF by link. Fixed a leftover timer after every PDF generation. Corrected the internal logic behind the HV Inspection Certificate\'s shaded/not-applicable cells so it can no longer silently drift out of sync if the form is edited in the future.',
      },
    ],
  },
  {
    version: '2.20.2',
    changes: [
      {
        heading: 'Pole Record — newly added conductor rows no longer disappear',
        detail: 'After starting a conductor row (tapping Cu, Ali, or Manual) but before picking a specific size, tapping "+ Add Another Row" could make the brand new row vanish instead of appearing on screen. The new row now always shows up correctly.',
      },
      {
        heading: 'App updates no longer reload the page twice',
        detail: 'Tapping "Update now" on the update banner occasionally caused the app to refresh twice in quick succession. It now reloads once, as intended.',
      },
      {
        heading: 'Removed the unused "Excel version" download links',
        detail: 'A few forms showed a "Download Excel version" link that never worked, since no Excel files were ever provided alongside the PDFs. This option has been removed — every form here is a PDF.',
      },
    ],
  },
  {
    version: '2.20.1',
    changes: [
      {
        heading: 'Restoring unsaved progress no longer shows a blank screen',
        detail: 'If a form crashed or was closed while sitting on the "Preview & Print" screen, restoring that progress previously jumped straight back to a blank preview with no PDF and no way forward except closing it and starting again. Restoring now returns you to the Photos step instead — tap "Preview Form" from there and the PDF generates correctly.',
      },
    ],
  },
  {
    version: '2.20.0',
    changes: [
      {
        heading: 'Pick up where you left off',
        detail: 'If the app closes or crashes partway through filling out a form, reopening that form now offers to restore your progress — including any photos already attached — instead of making you start again. This is separate from named drafts and is cleared automatically once you generate and share the finished PDF.',
      },
      {
        heading: 'HV Inspection Certificate signatures are no longer lost from saved progress',
        detail: 'The Team Lead and Field Switcher signatures on the Pre-Commissioning HV Inspection Certificate are now kept when you save a draft or when your progress is restored, instead of being dropped.',
      },
    ],
  },
  {
    version: '2.19.1',
    changes: [
      {
        heading: 'Distribution Transformer Certificate — label corrected',
        detail: 'The missing-fields warning on the Distribution Transformer Commissioning Certificate now correctly reads "PCo W/O No." to match the rest of the app — it previously said "SAP W/O No." by mistake.',
      },
    ],
  },
  {
    version: '2.19.0',
    changes: [
      {
        heading: 'PDF generation no longer freezes the app',
        detail: 'Generating a filled PDF — especially one with several photos attached — used to briefly freeze the screen while it worked. PDF generation now happens in the background, so the app stays responsive the whole time.',
      },
    ],
  },
  {
    version: '2.18.3',
    changes: [
      {
        heading: 'Photos are attached in the order you select them',
        detail: 'When adding several photos at once, they could occasionally end up in a different order in the finished PDF than the order you picked them in (larger photos sometimes finished loading after smaller ones). Photos are now always appended in the exact order you selected them.',
      },
    ],
  },
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
        detail: 'In the Pole Record and Zone Substation wizards, tapping × on every conductor, crossarm, or equipment row permanently hid the "Add Row" button, locking the form. The button now always stays visible below the row list.',
      },
      {
        heading: 'Save Draft button no longer gets stuck on "Saving…"',
        detail: 'After a successful save, the Save Draft button would stay disabled and show "Saving…" for the rest of the session. It now resets correctly after every save.',
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
        detail: "The native PDF viewer in Safari on iOS wasn't handling blank form PDFs correctly. Changed to use the same custom handler as the wizard system, which should handle printing far better.",
      },
      {
        heading: 'Update notices',
        detail: "You'll now see a summary of what's changed when the app updates — like this one.",
      },
    ],
  },
]
