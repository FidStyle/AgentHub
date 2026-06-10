import { existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import path from 'path'

export interface DesktopWorkspaceRoot {
  path: string
  healthy: boolean
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
  if (!raw) return [path.join(homedir(), '.agenthub', 'workspaces', 'default')]
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function getDesktopWorkspaceRoots(): DesktopWorkspaceRoot[] {
  return configuredWorkspaceRoots().map((item) => {
    const root = normalizeWorkspaceRoot(item)
    let healthy = existsSync(root)
    if (!healthy) {
      try {
        mkdirSync(root, { recursive: true })
        healthy = true
      } catch {
        healthy = false
      }
    }
    return { path: root, healthy }
  })
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
