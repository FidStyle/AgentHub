import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

export type CloudWorkspaceOwner = {
  id: string
  email?: string | null
  name?: string | null
  githubUsername?: string | null
}

export type CloudWorkspaceRow = {
  id: string
  name: string
  cloud_project_dir?: string | null
}

export type FileTreeNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

const IGNORED = new Set(['.git', 'node_modules', '.next', 'dist', 'build'])

function slug(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

export function cloudWorkspaceRoot() {
  return process.env.AGENTHUB_CLOUD_WORKSPACE_ROOT ?? path.join(process.cwd(), '.agenthub', 'cloud-workspaces')
}

export function cloudWorkspaceDir(owner: CloudWorkspaceOwner, workspace: CloudWorkspaceRow) {
  if (workspace.cloud_project_dir) return workspace.cloud_project_dir
  const ownerName = slug(owner.githubUsername || owner.name || owner.email || owner.id, 'user')
  const workspaceName = slug(workspace.name, 'workspace')
  return path.join(cloudWorkspaceRoot(), ownerName, `${workspaceName}-${workspace.id.slice(0, 8)}`)
}

async function runGitInit(cwd: string) {
  await new Promise<void>((resolve) => {
    const child = spawn('git', ['init'], { cwd, stdio: 'ignore' })
    child.on('error', () => resolve())
    child.on('close', () => resolve())
  })
}

export async function ensureCloudWorkspaceProject(owner: CloudWorkspaceOwner, workspace: CloudWorkspaceRow) {
  const dir = cloudWorkspaceDir(owner, workspace)
  await mkdir(dir, { recursive: true })
  await runGitInit(dir)
  await writeFile(
    path.join(dir, 'README.md'),
    `# ${workspace.name}\n\nAgentHub cloud workspace project.\n`,
    { flag: 'wx' },
  ).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'EEXIST') throw error
  })
  return dir
}

export async function removeCloudWorkspaceProject(owner: CloudWorkspaceOwner, workspace: CloudWorkspaceRow) {
  const dir = cloudWorkspaceDir(owner, workspace)
  const root = path.resolve(cloudWorkspaceRoot())
  const resolved = path.resolve(dir)
  if (!resolved.startsWith(`${root}${path.sep}`)) return
  await rm(resolved, { recursive: true, force: true })
}

export async function readCloudWorkspaceTree(rootDir: string, maxDepth = 4): Promise<FileTreeNode[]> {
  async function walk(dir: string, relative: string, depth: number): Promise<FileTreeNode[]> {
    if (depth > maxDepth) return []
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    const nodes: FileTreeNode[] = []
    for (const entry of entries) {
      if (IGNORED.has(entry.name)) continue
      const rel = relative ? `${relative}/${entry.name}` : entry.name
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        nodes.push({ name: entry.name, path: rel, type: 'directory', children: await walk(full, rel, depth + 1) })
      } else if (entry.isFile()) {
        nodes.push({ name: entry.name, path: rel, type: 'file' })
      } else {
        const info = await stat(full).catch(() => null)
        if (info?.isFile()) nodes.push({ name: entry.name, path: rel, type: 'file' })
      }
    }
    return nodes.sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1)
  }

  return walk(rootDir, '', 0)
}
