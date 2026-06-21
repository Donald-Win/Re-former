/**
 * projectStore — saved project storage for re-former.
 *
 * Storage backend: IndexedDB via idb-keyval.
 * Projects contain no large blobs, but using IndexedDB keeps the storage
 * layer consistent and avoids localStorage quota pressure from other stores.
 *
 * All public functions are async (return Promises).
 *
 * A "project" stores:
 *   id, projectName, npJobNumber, pcoWONo, ciwrNo, savedAt
 */

import { createStore, get, set, del, keys } from 'idb-keyval'

const projectIdb = createStore('re-former-projects', 'projects')

const MAX_PROJECTS = 20

// ── One-time migration from old localStorage projects ─────────────────────────
// Uses a Promise rather than a boolean flag so concurrent callers all await the
// same in-flight migration rather than each believing it's already done.
// Without this, two simultaneous callers (e.g. ProjectPicker opening while a
// wizard is already mounted) could both pass the boolean check, then interleave
// their writes against the half-migrated IndexedDB store.
let _migrationPromise = null

async function _runMigration() {
  try {
    const OLD_KEY = 're-former-projects'
    const raw = localStorage.getItem(OLD_KEY)
    if (!raw) return
    const old = JSON.parse(raw)
    if (!Array.isArray(old) || old.length === 0) { localStorage.removeItem(OLD_KEY); return }

    const existingKeys = await keys(projectIdb)
    for (const project of old) {
      if (!project.id) continue
      if (existingKeys.includes(project.id)) continue
      await set(project.id, project, projectIdb)
    }
    localStorage.removeItem(OLD_KEY)
    console.log(`[projectStore] Migrated ${old.length} legacy project(s) to IndexedDB`)
  } catch (err) {
    console.warn('[projectStore] Migration failed (non-critical):', err)
  }
}

function migrateFromLocalStorage() {
  if (!_migrationPromise) {
    _migrationPromise = _runMigration()
  }
  return _migrationPromise
}

migrateFromLocalStorage()

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId() {
  return 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
}

// ── Public API — all async ────────────────────────────────────────────────────

/**
 * Returns all saved projects, newest first.
 */
export async function listProjects() {
  await migrateFromLocalStorage()
  const allKeys = await keys(projectIdb)
  const projects = await Promise.all(allKeys.map(k => get(k, projectIdb)))
  return projects
    .filter(Boolean)
    .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
}

/**
 * Saves a new project or updates an existing one (matched by id).
 * Returns the saved project object.
 */
export async function saveProject({ id, projectName, npJobNumber, pcoWONo, ciwrNo }) {
  await migrateFromLocalStorage()

  const entry = {
    id:          id || makeId(),
    projectName: projectName?.trim() || '',
    npJobNumber: npJobNumber?.trim() || '',
    pcoWONo:     pcoWONo?.trim()     || '',
    ciwrNo:      ciwrNo?.trim()      || '',
    savedAt:     new Date().toISOString(),
  }

  await set(entry.id, entry, projectIdb)

  // Enforce MAX_PROJECTS limit (oldest removed first)
  const allKeys = await keys(projectIdb)
  if (allKeys.length > MAX_PROJECTS) {
    const all = await Promise.all(allKeys.map(k => get(k, projectIdb)))
    const sorted = all
      .filter(Boolean)
      .sort((a, b) => new Date(a.savedAt) - new Date(b.savedAt))
    const toDelete = sorted.slice(0, all.length - MAX_PROJECTS)
    await Promise.all(toDelete.map(p => del(p.id, projectIdb)))
  }

  return entry
}

/**
 * Deletes a project by id.
 */
export async function deleteProject(id) {
  await del(id, projectIdb)
}

// ── Display helpers (sync — operate on already-fetched project objects) ───────

export function projectLabel(p) {
  const parts = [p.npJobNumber, p.projectName].filter(Boolean)
  return parts.join(' — ') || 'Unnamed project'
}

export function projectSub(p) {
  const parts = [p.pcoWONo && `W/O ${p.pcoWONo}`, p.ciwrNo && `CIWR ${p.ciwrNo}`].filter(Boolean)
  return parts.join(' · ')
}
