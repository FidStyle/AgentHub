import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import path from 'path'

export interface DesktopWorkspaceRoot {
  path: string
  healthy: boolean
  source?: 'default' | 'env' | 'user'
}

function expandHome(value: string) {
  if (value === '~') return homedir()
  if (value.startsWith('~/')) return path.join(homedir(), value.slice(2))
  return value
}

export function normalizeWorkspaceRoot(value: string) {
  return path.resolve(expandHome(value.trim()))
}

function configuredWorkspaceRoots() {
  const raw = process.env.AGENTHUB_DESKTOP_WORKSPACE_ROOTS
  if (raw) {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => ({ path: item, source: 'env' as const }))
  }
  return uniqueRoots([
    { path: path.join(homedir(), '.agenthub', 'cloud-workspaces'), source: 'default' as const },
    { path: path.join(homedir(), '.agenthub', 'workspaces', 'default'), source: 'default' as const },
    ...loadUserWorkspaceRoots().map((item) => ({ path: item, source: 'user' as const })),
  ])
}

function rootsConfigPath() {
  return path.join(homedir(), '.agenthub', 'desktop-workspace-roots.json')
}

function loadUserWorkspaceRoots() {
  try {
    const raw = readFileSync(rootsConfigPath(), 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  } catch {
    return []
  }
}

function saveUserWorkspaceRoots(roots: string[]) {
  const configPath = rootsConfigPath()
  mkdirSync(path.dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(roots, null, 2))
}

function uniqueRoots(roots: Array<{ path: string; source: DesktopWorkspaceRoot['source'] }>) {
  const seen = new Set<string>()
  return roots.flatMap((root) => {
    const normalized = normalizeWorkspaceRoot(root.path)
    if (seen.has(normalized)) return []
    seen.add(normalized)
    return [{ path: normalized, source: root.source }]
  })
}

export function getDesktopWorkspaceRoots(): DesktopWorkspaceRoot[] {
  return configuredWorkspaceRoots().map((item) => {
    const root = normalizeWorkspaceRoot(item.path)
    let healthy = existsSync(root)
    if (!healthy) {
      try {
        mkdirSync(root, { recursive: true })
        healthy = true
      } catch {
        healthy = false
      }
    }
    return { path: root, healthy, source: item.source }
  })
}

export function addDesktopWorkspaceRoot(value: string): DesktopWorkspaceRoot[] {
  const root = normalizeWorkspaceRoot(value)
  const existing = getDesktopWorkspaceRoots().some((item) => normalizeWorkspaceRoot(item.path) === root)
  if (!existing) {
    saveUserWorkspaceRoots(uniqueRoots([
      ...loadUserWorkspaceRoots().map((item) => ({ path: item, source: 'user' as const })),
      { path: root, source: 'user' as const },
    ]).map((item) => item.path))
  }
  return getDesktopWorkspaceRoots()
}

export function isPathInsideAllowedWorkspaceRoots(cwd: string, roots = getDesktopWorkspaceRoots()) {
  const target = normalizeWorkspaceRoot(cwd)
  return roots
    .filter((root) => root.healthy)
    .some((root) => {
      const base = normalizeWorkspaceRoot(root.path)
      return target === base || target.startsWith(`${base}${path.sep}`)
    })
}
