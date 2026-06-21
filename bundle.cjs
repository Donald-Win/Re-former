#!/usr/bin/env node
/**
 * bundle.cjs — Project codebase bundler for AI-assisted development.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BUNDLE TOOL VERSION: 2.0.0   (this is the tool's own version — independent
 * of the app's APP_VERSION in src/App.jsx / CHANGELOGS in src/changelog.js)
 *
 * Tool changelog
 *   2.0.0 — Added --profile presets (shared / new-wizard / wizard:<name>),
 *           --changed and --since=<git-ref> delta modes, --out override,
 *           --list-profiles / --help, a self-check footer, a binary-file
 *           note, and a top-5 largest-file report to the console. Default
 *           no-arg behaviour (full scan → ~/project-codebase.txt) is
 *           UNCHANGED, so existing workflows and Project Knowledge uploads
 *           keep working exactly as before.
 *   1.0.0 — Original: full recursive scan, single output file.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY PROFILES EXIST
 * Most day-to-day AI-assisted work is NOT "redesign the whole app" — it's
 * "add one new wizard" or "fix this one generator". Dumping all 60+ files
 * every time burns tokens on 8 wizards you're not touching. Profiles let you
 * hand Claude exactly the slice it needs:
 *
 *   full            (default)  Entire codebase. Use this for Project
 *                              Knowledge — the persistent, canonical dump.
 *   shared                     src/shared/** + root config + App.jsx +
 *                              changelog.js. The architecture layer only.
 *   new-wizard                  shared layer + ONE existing wizard (+ its
 *                              generator) as a clean template to copy when
 *                              scaffolding a brand-new wizard.
 *   wizard:<name>               shared layer + one specific wizard + its
 *                              generator(s). Use --list-profiles for names.
 *
 * Profile output is written to a SEPARATE file (e.g.
 * project-codebase-shared.txt) — it never overwrites the canonical
 * project-codebase.txt that Project Knowledge relies on.
 *
 * WHY --changed / --since EXIST
 * Mid-feature, you often only touch 1–3 files. --changed compares each
 * file's mtime against a small cache (~/.bundle-cache.json) written on the
 * previous run, and only embeds full content for files that changed —
 * everything else is listed as "[Unchanged - skipped]" in the directory map
 * so Claude still knows it exists, just not re-sent. --since=<git-ref> does
 * the same thing but via `git diff --name-only <ref>` for precision.
 *
 * USAGE
 *   node bundle.cjs                              Full scan (unchanged default)
 *   node bundle.cjs path/a path/b                 Full scan of specific targets
 *   node bundle.cjs --profile=shared              Shared layer only
 *   node bundle.cjs --profile=new-wizard           Shared layer + template wizard
 *   node bundle.cjs --profile=wizard:pole          Shared layer + Pole wizard
 *   node bundle.cjs --changed                      Only files changed since last run
 *   node bundle.cjs --profile=wizard:pole --changed  Combine: just what changed in Pole
 *   node bundle.cjs --since=HEAD~3                 Only files changed vs a git ref
 *   node bundle.cjs --out=./ai-context             Write output here instead of $HOME
 *   node bundle.cjs --list-profiles                Show available profiles
 *   node bundle.cjs --help                         Show this help
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// --- CONFIGURATION ---
const ignoreDirs = [
  'node_modules', '.git', '.github', 'dist', 'build', '.next', '.idea',
  '.vscode', 'public/icons', 'coverage', '.cache', '.netlify', '.vercel',
];
const ignoreFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bundle.cjs', '.DS_Store'];
const ignoreExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.pdf', '.zip', '.mp4', '.mov', '.bak', '.log'];

const HOME = os.homedir();
const CACHE_FILE = path.join(HOME, '.bundle-cache.json');

// --- WIZARD REGISTRY ---------------------------------------------------------
// Add ONE entry here whenever a new wizard ships, so `--profile=wizard:<name>`
// and the largest-eligible-set logic stay accurate. Keys are matched
// case-insensitively.
const WIZARDS = {
  pole:                    { component: 'src/wizards/PoleWizard.jsx',                    generators: ['src/wizards/generators/PolePdfGenerator.js'] },
  transformer:             { component: 'src/wizards/TransformerWizard.jsx',             generators: ['src/wizards/generators/TransformerPdfGenerator.js'] },
  elecequip:               { component: 'src/wizards/ElecEquipWizard.jsx',               generators: ['src/wizards/generators/ElecEquipPdfGenerator.js'] },
  lvconnection:            { component: 'src/wizards/LvConnectionWizard.jsx',            generators: ['src/wizards/generators/LvConnectionPdfGenerator.js'] },
  elecdistribution:        { component: 'src/wizards/ElecDistributionWizard.jsx',        generators: ['src/wizards/generators/ElecDistributionPdfGenerator.js'] },
  lvbox:                   { component: 'src/wizards/LvBoxWizard.jsx',                   generators: ['src/wizards/generators/LvBoxPdfGenerator.js'] },
  zonesub:                 { component: 'src/wizards/ZoneSubWizard.jsx',                 generators: ['src/wizards/generators/ZoneSubPdfGenerator.js'] },
  hvinspection:            { component: 'src/wizards/HVInspectionWizard.jsx',            generators: ['src/wizards/generators/HVInspectionPdfGenerator.js', 'src/wizards/generators/HVInspectionChecks.js'] },
  distributiontransformer: { component: 'src/wizards/DistributionTransformerWizard.jsx', generators: ['src/wizards/generators/DistributionTransformerPdfGenerator.js'] },
};

// The cleanest / smallest existing wizard — used as the copy-paste template
// for `--profile=new-wizard`. Change this if a simpler exemplar emerges.
const NEW_WIZARD_EXEMPLAR = 'lvconnection';

// Always-relevant root-level + top-of-src files, regardless of which wizard
// you're touching (registration pattern, build config, changelog format).
const CORE_FILES = [
  'package.json',
  'vite.config.js',
  'netlify.toml',
  'src/main.jsx',
  'src/main.netlify.jsx',
  'src/index.css',
  'src/App.jsx',
  'src/changelog.js',
  'public/forms/README.md',
];

const SHARED_DIR = 'src/shared';

// --- STATE --------------------------------------------------------------------
let fileStructureLog = [];      // lines for the directory map header
let textFilesQueue = [];        // { filePath, relativePath, logIndex }
let skippedFilesCount = 0;      // binaries / lockfiles ignored
const queuedAbsPaths = new Set(); // de-dupe guard across profile + extra targets

// --- ARG PARSING ---------------------------------------------------------------
function parseArgs(argv) {
  const opts = { targets: [], profile: null, changed: false, sinceRef: null, outDir: null, listProfiles: false, help: false };
  argv.forEach(arg => {
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--list-profiles') opts.listProfiles = true;
    else if (arg === '--changed') opts.changed = true;
    else if (arg.startsWith('--since=')) opts.sinceRef = arg.slice('--since='.length);
    else if (arg.startsWith('--profile=')) opts.profile = arg.slice('--profile='.length);
    else if (arg.startsWith('--out=')) opts.outDir = arg.slice('--out='.length);
    else opts.targets.push(arg);
  });
  return opts;
}

function printHelp() {
  console.log(`
Usage:
  node bundle.cjs [targets...] [options]

Options:
  --profile=<name>      Bundle only a curated subset of files (see --list-profiles)
  --changed              Only include files modified since the last bundle run
  --since=<git-ref>      Only include files changed vs a git ref (e.g. --since=HEAD~3)
  --out=<dir>             Write the output file to <dir> instead of your home directory
  --list-profiles         Show available --profile values and exit
  --help                  Show this help and exit

Examples:
  node bundle.cjs
      Full codebase -> ~/project-codebase.txt   (use this for Project Knowledge)

  node bundle.cjs --profile=shared
      Just the shared engine/hooks layer -> ~/project-codebase-shared.txt

  node bundle.cjs --profile=new-wizard
      Shared layer + one example wizard, ready as a scaffolding template

  node bundle.cjs --profile=wizard:pole
      Shared layer + the Pole wizard + its generator(s) only

  node bundle.cjs --changed
      Only files touched since your last bundle run (any profile)

  node bundle.cjs --profile=wizard:pole --changed
      Only what changed in the Pole wizard + shared layer since last time

  node bundle.cjs --since=HEAD~3
      Only files that differ from git ref HEAD~3
`);
}

function printProfiles() {
  const wizardNames = Object.keys(WIZARDS).sort().join(', ');
  console.log(`
Available --profile values:

  full            Entire codebase (default). Use for Project Knowledge.
  shared          src/shared/** + root config + App.jsx + changelog.js.
                  The architecture layer, no wizard-specific noise.
  new-wizard      shared layer + "${WIZARDS[NEW_WIZARD_EXEMPLAR].component}"
                  as a clean copy-paste template for a brand-new wizard.
  wizard:<name>   shared layer + one specific wizard + its generator(s).

  Available wizard names for wizard:<name> —
    ${wizardNames}
`);
}

// --- DISCOVERY ------------------------------------------------------------------

function recordIncluded(relativePath) {
  fileStructureLog.push(`[Included] ${relativePath}`);
  return fileStructureLog.length - 1;
}

// Matches this tool's own output files (project-codebase.txt,
// project-codebase-shared.txt, etc.) so that if --out ever points inside
// the scanned tree, a previous run's output is never vacuumed into the next
// one. The cache file is named explicitly since its pattern isn't regular.
const OWN_OUTPUT_PATTERN = /^project-codebase(-[\w.-]+)?\.txt$/;

function queueTextFile(absPath, relativePath) {
  if (queuedAbsPaths.has(absPath)) return; // already in scope — avoid duplicate <file> blocks
  const ext = path.extname(absPath).toLowerCase();
  const fileName = path.basename(absPath);
  if (
    ignoreExtensions.includes(ext) ||
    ignoreFiles.includes(fileName) ||
    OWN_OUTPUT_PATTERN.test(fileName) ||
    fileName === '.bundle-cache.json'
  ) {
    skippedFilesCount++;
    return;
  }
  queuedAbsPaths.add(absPath);
  const logIndex = recordIncluded(relativePath);
  textFilesQueue.push({ filePath: absPath, relativePath, logIndex });
}

/** Queue one explicit relative path (used by profiles). Warns, doesn't throw, if missing. */
function queueExplicitFile(relPath) {
  const absPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(absPath)) {
    console.warn(`  (profile) Warning: "${relPath}" not found — skipping.`);
    return;
  }
  const stat = fs.statSync(absPath);
  if (!stat.isFile()) return;
  queueTextFile(absPath, relPath);
}

/** Legacy recursive scan — used for the default `full` mode and any extra positional targets. */
function scanAndQueue(targetPath) {
  if (!fs.existsSync(targetPath)) {
    console.error(`Error: Path "${targetPath}" does not exist. Skipping.`);
    return;
  }

  const stat = fs.statSync(targetPath);
  const relativePath = path.relative(process.cwd(), targetPath) || path.basename(targetPath);

  if (stat.isFile()) {
    const absPath = path.resolve(targetPath);
    if (absPath === path.resolve(getOutputFile())) return; // never include our own output
    queueTextFile(absPath, relativePath);
    return;
  }

  if (stat.isDirectory()) {
    const files = fs.readdirSync(targetPath);
    files.forEach(file => {
      const filePath = path.join(targetPath, file);
      const fileStat = fs.statSync(filePath);
      if (fileStat.isDirectory()) {
        if (!ignoreDirs.includes(file)) scanAndQueue(filePath);
      } else {
        scanAndQueue(filePath);
      }
    });
  }
}

// --- PROFILE RESOLUTION -----------------------------------------------------------

/** Returns true if a profile-driven file set was queued; false means "fall back to full scan". */
function applyProfile(profileArg) {
  if (!profileArg || profileArg === 'full') return false;

  CORE_FILES.forEach(queueExplicitFile);

  if (profileArg === 'shared') {
    scanAndQueue(path.resolve(process.cwd(), SHARED_DIR));
    return true;
  }

  if (profileArg === 'new-wizard') {
    const ex = WIZARDS[NEW_WIZARD_EXEMPLAR];
    queueExplicitFile(ex.component);
    ex.generators.forEach(queueExplicitFile);
    scanAndQueue(path.resolve(process.cwd(), SHARED_DIR));
    return true;
  }

  if (profileArg.startsWith('wizard:')) {
    const key = profileArg.slice('wizard:'.length).toLowerCase();
    const entry = WIZARDS[key];
    if (!entry) {
      console.error(`Unknown wizard "${key}" for --profile=wizard:<name>.`);
      console.error(`Available: ${Object.keys(WIZARDS).sort().join(', ')}`);
      process.exit(1);
    }
    queueExplicitFile(entry.component);
    entry.generators.forEach(queueExplicitFile);
    scanAndQueue(path.resolve(process.cwd(), SHARED_DIR));
    return true;
  }

  console.error(`Unknown profile "${profileArg}". Run with --list-profiles to see options.`);
  process.exit(1);
}

// --- CHANGE FILTERING --------------------------------------------------------------

function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { return {}; }
}
function saveCache(cache) {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); } catch (e) { console.warn('Could not save bundle cache:', e.message); }
}

/** Keep only files whose mtime is newer than what's recorded in the cache (or not yet recorded). */
function filterByMtimeCache(queue, cache) {
  return queue.filter(({ filePath }) => {
    const abs = path.resolve(filePath);
    let mtime;
    try { mtime = fs.statSync(abs).mtimeMs; } catch { return true; }
    const cached = cache[abs];
    return cached === undefined || mtime > cached;
  });
}

/** Keep only files git reports as changed vs. `ref`. Best-effort: falls back to "keep everything" on any git error. */
function filterByGitRef(queue, ref) {
  let changedSet;
  try {
    const out = execSync(`git diff --name-only ${ref}`, { cwd: process.cwd(), encoding: 'utf8' });
    changedSet = new Set(out.split('\n').map(s => s.trim()).filter(Boolean).map(p => p.split(path.sep).join('/')));
  } catch (e) {
    console.error(`Could not get "git diff --name-only ${ref}": ${e.message.split('\n')[0]}`);
    console.error('Falling back to including every file in scope.');
    return queue;
  }
  return queue.filter(({ relativePath }) => changedSet.has(relativePath.split(path.sep).join('/')));
}

// --- OUTPUT PATH --------------------------------------------------------------------

let _resolvedOutputFile = null;
function getOutputFile() { return _resolvedOutputFile; }

function buildOutputFilename(outDir, profileArg, changedFlag, sinceRef) {
  let base = 'project-codebase';
  if (profileArg && profileArg !== 'full') base += '-' + profileArg.replace(':', '-');
  if (changedFlag) base += '-changed';
  if (sinceRef) base += '-since-' + sinceRef.replace(/[^a-zA-Z0-9._-]/g, '');
  return path.join(outDir || HOME, `${base}.txt`);
}

// --- MAIN -----------------------------------------------------------------------------

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) { printHelp(); return; }
  if (opts.listProfiles) { printProfiles(); return; }

  _resolvedOutputFile = buildOutputFilename(opts.outDir, opts.profile, opts.changed, opts.sinceRef);

  const usedProfile = applyProfile(opts.profile);

  if (!usedProfile) {
    const targets = opts.targets.length ? opts.targets : ['.'];
    console.log(`Scanning targets: ${targets.join(', ')}...`);
    targets.forEach(scanAndQueue);
  } else if (opts.targets.length) {
    // Extra explicit targets layered on top of a profile.
    opts.targets.forEach(scanAndQueue);
  }

  // --- Apply --changed / --since filtering (mutually exclusive; --since wins if both given) ---
  let skippedUnchangedCount = 0;
  if (opts.sinceRef || opts.changed) {
    const before = textFilesQueue;
    const kept = opts.sinceRef
      ? filterByGitRef(before, opts.sinceRef)
      : filterByMtimeCache(before, loadCache());

    const keptPaths = new Set(kept.map(f => f.filePath));
    before.forEach(f => {
      if (!keptPaths.has(f.filePath)) {
        fileStructureLog[f.logIndex] = `[Unchanged - skipped] ${f.relativePath}`;
        skippedUnchangedCount++;
      }
    });
    textFilesQueue = kept;
  }

  const outputFile = getOutputFile();
  if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });

  // --- Header / directory map ---
  const modeLabel = [
    opts.profile && opts.profile !== 'full' ? opts.profile : 'full',
    opts.sinceRef ? `since:${opts.sinceRef}` : opts.changed ? 'changed-only' : null,
  ].filter(Boolean).join(' + ');

  fs.writeFileSync(outputFile, `=== PROJECT DIRECTORY MAP ===\n`);
  fs.appendFileSync(outputFile, `Mode: ${modeLabel}\n`);
  const targetsLabel = usedProfile
    ? (opts.targets.length ? `profile scope + ${opts.targets.join(', ')}` : 'profile scope')
    : (opts.targets.length ? opts.targets : ['.']).join(', ');
  fs.appendFileSync(outputFile, `Targets: ${targetsLabel}\n`);
  fs.appendFileSync(outputFile, `Files with full content included below: ${textFilesQueue.length}\n`);
  if (skippedUnchangedCount > 0) {
    fs.appendFileSync(outputFile, `Unchanged (skipped — rely on Project Knowledge / a prior dump for these): ${skippedUnchangedCount}\n`);
  }
  fs.appendFileSync(outputFile, `Ignored binaries/locks: ${skippedFilesCount}\n`);
  fs.appendFileSync(outputFile, `Binary files (images, PDFs, archives, etc.) are intentionally excluded from\n`);
  fs.appendFileSync(outputFile, `this dump — they exist in the repository but cannot be represented as text.\n\n`);
  fs.appendFileSync(outputFile, fileStructureLog.join('\n') + `\n\n=========================================\n\n`);

  if (textFilesQueue.length === 0) {
    fs.appendFileSync(outputFile, `(No files matched — nothing changed, or the profile/targets matched nothing.)\n`);
    console.log('No files to include — nothing changed since the last bundle run (or scope was empty).');
    console.log(`--> ${outputFile}`);
    return;
  }

  console.log(`Mapped ${fileStructureLog.length} entries (${textFilesQueue.length} with full content). Bundling...`);

  // --- Body: per-file content ---
  let totalChars = 0;
  const sizes = [];
  const cache = loadCache();

  textFilesQueue.forEach(({ filePath, relativePath }) => {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      // Token optimisation: compress 3+ consecutive blank lines down to one.
      content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

      totalChars += content.length;
      sizes.push({ relativePath, chars: content.length });

      fs.appendFileSync(outputFile, `<file path="${relativePath}">\n${content}\n</file>\n\n`);

      // Mark this file as "seen as of now" for future --changed comparisons.
      cache[path.resolve(filePath)] = fs.statSync(filePath).mtimeMs;
    } catch (err) {
      console.error(`Failed to read ${relativePath}: ${err.message}`);
    }
  });

  // Self-check footer: lets you (or Claude) confirm the dump wasn't truncated
  // in transit — if this line is missing from what Claude received, re-upload.
  fs.appendFileSync(
    outputFile,
    `=== END OF BUNDLE — ${textFilesQueue.length} files, ${totalChars.toLocaleString()} chars ===\n`,
  );

  saveCache(cache);

  const estTokens = Math.round(totalChars / 4);
  console.log(`\nSuccess! Codebase bundle created.`);
  console.log(`--> ${outputFile}`);
  console.log(`--> Size: ~${(totalChars / 1024).toFixed(1)} KB`);
  console.log(`--> Estimated context used: ~${estTokens.toLocaleString()} tokens.`);

  const top5 = sizes.sort((a, b) => b.chars - a.chars).slice(0, 5);
  if (top5.length > 1) {
    console.log(`\nLargest files in this bundle (consider --profile to trim these next time):`);
    top5.forEach(f => console.log(`   ${(f.chars / 1024).toFixed(1)} KB  ${f.relativePath}`));
  }
  console.log('');
}

main();
