/**
 * projectStore — lightweight localStorage store for saved projects.
 *
 * A "project" is the set of job identifier fields that stay the same
 * across multiple forms for the same job:
 *   projectName, npJobNumber, pcoWONo, ciwrNo
 *
 * Projects are saved explicitly by the user (unlike job history which
 * auto-saves on step advance). Up to MAX_PROJECTS can be stored.
 */

const STORAGE_KEY  = 're-former-projects'
const MAX_PROJECTS = 20

export const PROJECT_FIELDS = ['projectName', 'npJobNumber', 'pcoWONo', 'ciwrNo']

// ── Helpers ───────────────────────────────────────────────────────────────────

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function save(projects) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  } catch { /* storage full */ }
}

function makeId() {
  return 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns all saved projects, newest first. */
export function listProjects() {
  return load()
}

/**
 * Saves a new project or updates an existing one (matched by id).
 * Returns the saved project object.
 */
export function saveProject({ id, projectName, npJobNumber, pcoWONo, ciwrNo }) {
  const projects = load()
  const existing = id ? projects.findIndex(p => p.id === id) : -1

  const entry = {
    id:          id || makeId(),
    projectName: projectName?.trim() || '',
    npJobNumber: npJobNumber?.trim() || '',
    pcoWONo:     pcoWONo?.trim()     || '',
    ciwrNo:      ciwrNo?.trim()      || '',
    savedAt:     new Date().toISOString(),
  }

  if (existing >= 0) {
    projects[existing] = entry
  } else {
    projects.unshift(entry)
  }

  save(projects.slice(0, MAX_PROJECTS))
  return entry
}

/** Deletes a project by id. */
export function deleteProject(id) {
  save(load().filter(p => p.id !== id))
}

/** Returns a display label for a project. */
export function projectLabel(p) {
  const parts = [p.npJobNumber, p.projectName].filter(Boolean)
  return parts.join(' — ') || 'Unnamed project'
}

/** Returns a subtitle line for a project. */
export function projectSub(p) {
  const parts = [p.pcoWONo && `W/O ${p.pcoWONo}`, p.ciwrNo && `CIWR ${p.ciwrNo}`].filter(Boolean)
  return parts.join(' · ')
}
