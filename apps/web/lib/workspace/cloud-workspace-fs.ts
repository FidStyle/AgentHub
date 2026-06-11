import { chmod, mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import os from 'node:os'
import { TextDecoder } from 'node:util'
import { artifactTypeForPath } from '@/lib/artifacts/rich-artifacts'

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
const MAX_PREVIEW_BYTES = 256 * 1024
const MAX_EDIT_BYTES = 256 * 1024

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.markdown': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8',
  '.ts': 'text/typescript; charset=utf-8',
  '.tsx': 'text/typescript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pdf': 'application/pdf',
}

export type WorkspacePreviewKind = 'html' | 'markdown' | 'code' | 'image' | 'text' | 'binary' | 'folder' | 'document' | 'presentation'

export type WorkspaceFilePreview = {
  path: string
  name: string
  type: 'file' | 'directory'
  size: number
  mime: string
  previewKind: WorkspacePreviewKind
  content: string | null
  truncated: boolean
}

export type WorkspaceBundleFile = {
  path: string
  size: number
}

export type WorkspaceGitChange = {
  path: string
  status: string
  staged: boolean
  untracked: boolean
  indexStatus: string
  workingTreeStatus: string
  unstaged: boolean
}

export type WorkspacePatchDraft = {
  path: string
  selectionStart: number
  selectionEnd: number
  selectedText: string
  replacement: string
  content: string
  diff: string
}

export type WorkspaceGitCommit = {
  hash: string
  shortHash: string
  author: string
  date: string
  message: string
}

export type WorkspaceGitCommitDiff = WorkspaceGitCommit & {
  diff: string
}

export type WorkspaceArtifactLaunchScript = {
  scriptPath: string
  command: string
  sourcePath: string
  packageScript?: string | null
  startCommand?: string | null
}

export type WorkspaceRunnablePackage = {
  sourcePath: string
  packageScript: string
  command: string
}

export type WorkspaceArtifactLaunchSource = string | {
  sourcePath?: string | null
  packageScript?: string | null
  startCommand?: string | null
}

export type WorkspaceWebStartScript = {
  scriptPath: string
  startCommand: string
  kind: 'dynamic' | 'static'
  packageScript?: string | null
  htmlEntry?: string | null
  created: boolean
}

// Standard web-entry candidates the closure step uses to decide a workspace is a
// browser-visible product when no runnable package script exists.
const STATIC_WEB_ENTRY_CANDIDATES = [
  'public/index.html',
  'index.html',
  'dist/index.html',
  'build/index.html',
  'out/index.html',
] as const

const RUNNABLE_PACKAGE_SCRIPT_NAMES = ['start', 'dev', 'preview', 'serve'] as const
const RUNNABLE_PACKAGE_SCRIPT_SET = new Set<string>(RUNNABLE_PACKAGE_SCRIPT_NAMES)

function slug(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

export function cloudWorkspaceRoot() {
  return process.env.AGENTHUB_CLOUD_WORKSPACE_ROOT ?? path.join(os.homedir(), '.agenthub', 'cloud-workspaces')
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

export function resolveWorkspacePath(rootDir: string, relativePath: string) {
  const root = path.resolve(rootDir)
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized || normalized.includes('\0')) {
    throw new Error('路径不能为空')
  }
  const resolved = path.resolve(root, normalized)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('路径超出工作区范围')
  }
  return { root, relativePath: normalized, fullPath: resolved }
}

export function mimeForPath(filePath: string) {
  return MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

export function previewKindForPath(filePath: string, mime = mimeForPath(filePath)): WorkspacePreviewKind {
  const ext = path.extname(filePath).toLowerCase()
  const richType = artifactTypeForPath(filePath)
  if (richType === 'document' && ext !== '.md' && ext !== '.markdown') return 'document'
  if (richType === 'presentation') return 'presentation'
  if (mime.startsWith('image/')) return 'image'
  if (ext === '.html' || ext === '.htm') return 'html'
  if (ext === '.md' || ext === '.markdown') return 'markdown'
  if (['.js', '.jsx', '.ts', '.tsx', '.css', '.json', '.sql', '.sh', '.yml', '.yaml', '.toml'].includes(ext)) return 'code'
  if (mime.startsWith('text/') || ext === '.txt') return 'text'
  return 'binary'
}

function isLikelyUtf8Text(buffer: Buffer) {
  if (buffer.length === 0) return true
  if (buffer.includes(0)) return false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return false
  }
  let control = 0
  for (const byte of buffer) {
    if (byte === 9 || byte === 10 || byte === 13) continue
    if (byte < 32 || byte === 127) control += 1
  }
  return control / buffer.length <= 0.05
}

function contentAwarePreviewKind(filePath: string, mime: string, buffer: Buffer): { mime: string; previewKind: WorkspacePreviewKind } {
  const previewKind = previewKindForPath(filePath, mime)
  if (previewKind !== 'binary') return { mime, previewKind }
  if (!isLikelyUtf8Text(buffer.subarray(0, Math.min(buffer.length, 8192)))) return { mime, previewKind }
  return { mime: 'text/plain; charset=utf-8', previewKind: 'text' }
}

async function readFilePrefix(fullPath: string, maxBytes: number) {
  const handle = await open(fullPath, 'r')
  try {
    const buffer = Buffer.alloc(maxBytes)
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

export async function readCloudWorkspacePreview(rootDir: string, relativePath: string): Promise<WorkspaceFilePreview> {
  const { relativePath: rel, fullPath } = resolveWorkspacePath(rootDir, relativePath)
  const info = await stat(fullPath).catch(() => null)
  if (!info) throw new Error('文件不存在')
  if (info.isDirectory()) {
    return {
      path: rel,
      name: path.basename(rel),
      type: 'directory',
      size: info.size,
      mime: 'application/vnd.agenthub.folder+json',
      previewKind: 'folder',
      content: JSON.stringify(await buildWorkspaceFolderManifest(rootDir, rel), null, 2),
      truncated: false,
    }
  }
  if (!info.isFile()) throw new Error('仅支持预览普通文件或文件夹')
  let mime = mimeForPath(rel)
  let previewKind = previewKindForPath(rel, mime)
  let buffer: Buffer | null = null
  if (previewKind === 'binary') {
    buffer = await readFilePrefix(fullPath, Math.min(info.size, MAX_PREVIEW_BYTES))
    const contentAware = contentAwarePreviewKind(rel, mime, buffer)
    mime = contentAware.mime
    previewKind = contentAware.previewKind
  }
  const canInlineText = previewKind !== 'binary' && previewKind !== 'image'
  let content: string | null = null
  let truncated = false
  if (canInlineText) {
    buffer ??= await readFilePrefix(fullPath, Math.min(info.size, MAX_PREVIEW_BYTES))
    truncated = info.size > buffer.length
    content = buffer.toString('utf8')
  }
  return {
    path: rel,
    name: path.basename(rel),
    type: 'file',
    size: info.size,
    mime,
    previewKind,
    content,
    truncated,
  }
}

export async function buildWorkspaceFolderManifest(rootDir: string, relativePath: string): Promise<{ path: string; files: WorkspaceBundleFile[] }> {
  const { relativePath: rel, fullPath } = resolveWorkspacePath(rootDir, relativePath)
  const info = await stat(fullPath).catch(() => null)
  if (!info?.isDirectory()) throw new Error('路径不是文件夹')
  const files: WorkspaceBundleFile[] = []
  async function walk(dir: string, prefix: string) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (IGNORED.has(entry.name)) continue
      const entryFull = path.join(dir, entry.name)
      const entryRel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        await walk(entryFull, entryRel)
      } else if (entry.isFile()) {
        const entryInfo = await stat(entryFull)
        files.push({ path: entryRel, size: entryInfo.size })
      }
    }
  }
  await walk(fullPath, rel)
  return { path: rel, files: files.sort((a, b) => a.path.localeCompare(b.path)) }
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function u16(value: number) {
  const buffer = Buffer.allocUnsafe(2)
  buffer.writeUInt16LE(value)
  return buffer
}

function u32(value: number) {
  const buffer = Buffer.allocUnsafe(4)
  buffer.writeUInt32LE(value >>> 0)
  return buffer
}

async function packFilesToZip(rootDir: string, relativePaths: string[]) {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const relPath of relativePaths) {
    // git ls-files / manifest output is untrusted: validate every entry stays inside the workspace.
    const { fullPath, relativePath } = resolveWorkspacePath(rootDir, relPath)
    const data = await readFile(fullPath)
    const name = Buffer.from(relativePath, 'utf8')
    const crc = crc32(data)
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data,
    ])
    const central = Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), name,
    ])
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const centralDir = Buffer.concat(centrals)
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(centrals.length), u16(centrals.length),
    u32(centralDir.length), u32(offset), u16(0),
  ])
  return Buffer.concat([...locals, centralDir, end])
}

export async function createWorkspaceFolderZip(rootDir: string, relativePath: string) {
  const manifest = await buildWorkspaceFolderManifest(rootDir, relativePath)
  return packFilesToZip(rootDir, manifest.files.map((file) => file.path))
}

async function runGit(rootDir: string, args: string[]) {
  return await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const child = spawn('git', args, { cwd: rootDir, stdio: ['ignore', 'pipe', 'pipe'] })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)))
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)))
    child.on('error', (error) => resolve({ code: 1, stdout: '', stderr: error.message }))
    child.on('close', (code) => resolve({
      code: code ?? 1,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderr).toString('utf8'),
    }))
  })
}

const DEFAULT_GITIGNORE_RULES = [
  'node_modules/',
  'dist/',
  'build/',
  '.next/',
  'out/',
  'coverage/',
  '*.log',
  '.env',
  '.env.*',
  '.DS_Store',
]

const BACKEND_PROJECT_MARKERS = ['requirements.txt', 'pyproject.toml', 'pom.xml', 'go.mod', 'Cargo.toml', 'Gemfile']

/**
 * Generate a default `.gitignore` at the workspace root when the project looks
 * like a front/back-end project but has none. Respects any existing file.
 * Returns whether a file was written plus the rules that were applied.
 */
export async function ensureWorkspaceGitignore(rootDir: string): Promise<{ created: boolean; rules: string[] }> {
  const { fullPath: gitignorePath } = resolveWorkspacePath(rootDir, '.gitignore')
  const existing = await stat(gitignorePath).catch(() => null)
  if (existing?.isFile()) return { created: false, rules: [] }

  const hasProjectMarker =
    (await stat(resolveWorkspacePath(rootDir, 'package.json').fullPath).then((info) => info.isFile()).catch(() => false)) ||
    (await Promise.all(
      BACKEND_PROJECT_MARKERS.map((marker) =>
        stat(resolveWorkspacePath(rootDir, marker).fullPath).then((info) => info.isFile()).catch(() => false),
      ),
    ).then((results) => results.some(Boolean)))

  if (!hasProjectMarker) return { created: false, rules: [] }

  await writeFile(gitignorePath, `${DEFAULT_GITIGNORE_RULES.join('\n')}\n`, 'utf8')
  return { created: true, rules: [...DEFAULT_GITIGNORE_RULES] }
}

async function listWorkspaceFilesFallback(rootDir: string): Promise<string[]> {
  const files: string[] = []
  async function walk(dir: string, prefix: string) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (IGNORED.has(entry.name)) continue
      const entryFull = path.join(dir, entry.name)
      const entryRel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        await walk(entryFull, entryRel)
      } else if (entry.isFile()) {
        files.push(entryRel)
      } else {
        const info = await stat(entryFull).catch(() => null)
        if (info?.isFile()) files.push(entryRel)
      }
    }
  }
  await walk(rootDir, '')
  return files.sort((a, b) => a.localeCompare(b))
}

/**
 * Pack the entire workspace into a store-mode ZIP buffer, excluding files per
 * the workspace `.gitignore` via `git ls-files`. Falls back to a hardcoded
 * IGNORED traversal (excluding `.git/`) when git is unavailable so the feature
 * never fully breaks. Every path is validated through `resolveWorkspacePath`.
 */
export async function createWorkspaceZip(rootDir: string): Promise<Buffer> {
  let files: string[] | null = null
  const result = await runGit(rootDir, ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
  if (result.code === 0) {
    files = result.stdout
      .split('\0')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && !entry.startsWith('.git/') && entry !== '.git')
  } else {
    // Fallback: git unavailable or ls-files failed; traverse with hardcoded IGNORED (excludes .git/).
    console.warn(`[createWorkspaceZip] git ls-files failed (code=${result.code}); falling back to IGNORED traversal: ${result.stderr.trim()}`)
  }
  if (!files) files = await listWorkspaceFilesFallback(rootDir)
  // Deduplicate (ls-files can list the same path under cached + others edge cases) and keep deterministic order.
  const unique = Array.from(new Set(files)).sort((a, b) => a.localeCompare(b))
  return packFilesToZip(rootDir, unique)
}

function porcelainStatusLabel(status: string) {
  if (status === '?') return 'untracked'
  if (status === ' ') return 'unmodified'
  if (status === 'A') return 'added'
  if (status === 'M') return 'modified'
  if (status === 'D') return 'deleted'
  if (status === 'R') return 'renamed'
  if (status === 'C') return 'copied'
  if (status === 'U') return 'conflicted'
  return 'modified'
}

export async function readWorkspaceGitStatus(rootDir: string): Promise<WorkspaceGitChange[]> {
  const result = await runGit(rootDir, ['status', '--porcelain=v1', '-uall'])
  if (result.code !== 0) throw new Error(result.stderr || '读取 Git 状态失败')
  return result.stdout
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2)
      const rawPath = line.slice(3).trim()
      const renameIndex = rawPath.lastIndexOf(' -> ')
      const filePath = renameIndex >= 0 ? rawPath.slice(renameIndex + 4) : rawPath
      return {
        path: filePath,
        status,
        staged: status[0] !== ' ' && status[0] !== '?',
        untracked: status === '??',
        indexStatus: porcelainStatusLabel(status[0]),
        workingTreeStatus: porcelainStatusLabel(status[1]),
        unstaged: status[1] !== ' ' || status === '??',
      }
    })
}

export async function readWorkspaceGitDiff(rootDir: string, relativePath?: string | null, staged = false) {
  const args = staged ? ['diff', '--cached', '--'] : ['diff', '--']
  if (relativePath) {
    const { relativePath: rel } = resolveWorkspacePath(rootDir, relativePath)
    args.push(rel)
  }
  const result = await runGit(rootDir, args)
  if (result.code !== 0) throw new Error(result.stderr || '读取 Git diff 失败')
  if (result.stdout || !relativePath) return result.stdout

  // Untracked files have no `git diff` output. Return a synthetic diff so the
  // Changes tab can still show meaningful content before the file is staged.
  const preview = await readCloudWorkspacePreview(rootDir, relativePath)
  if (!preview.content) return ''
  const lines = preview.content.split('\n')
  return [
    `diff --git a/${preview.path} b/${preview.path}`,
    'new file mode 100644',
    '--- /dev/null',
    `+++ b/${preview.path}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((line) => `+${line}`),
  ].join('\n')
}

export async function readWorkspaceGitHistory(rootDir: string, limit = 12): Promise<WorkspaceGitCommit[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 50)
  const result = await runGit(rootDir, ['log', `-${safeLimit}`, '--date=iso-strict', '--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s'])
  if (result.code !== 0) {
    if (/does not have any commits yet|your current branch .* does not have any commits/i.test(result.stderr)) return []
    throw new Error(result.stderr || '读取 Git 提交历史失败')
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash, shortHash, author, date, ...messageParts] = line.split('\x1f')
      return {
        hash: hash ?? '',
        shortHash: shortHash ?? '',
        author: author ?? '',
        date: date ?? '',
        message: messageParts.join('\x1f') || '无提交说明',
      }
    })
}

export async function readWorkspaceGitCommitDiff(rootDir: string, commitHash: string): Promise<WorkspaceGitCommitDiff> {
  const hash = commitHash.trim()
  if (!/^[a-f0-9]{7,40}$/i.test(hash)) throw new Error('commit hash 无效')
  const meta = await runGit(rootDir, ['show', '--no-patch', '--date=iso-strict', '--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s', hash])
  if (meta.code !== 0) throw new Error(meta.stderr || '读取 commit 信息失败')
  const [fullHash, shortHash, author, date, ...messageParts] = meta.stdout.trim().split('\x1f')
  const diff = await runGit(rootDir, ['show', '--format=', '--patch', '--find-renames', hash])
  if (diff.code !== 0) throw new Error(diff.stderr || '读取 commit diff 失败')
  return {
    hash: fullHash ?? hash,
    shortHash: shortHash ?? hash.slice(0, 7),
    author: author ?? '',
    date: date ?? '',
    message: messageParts.join('\x1f') || '无提交说明',
    diff: diff.stdout,
  }
}

export async function resetWorkspaceGitHard(rootDir: string, commitHash: string) {
  const hash = commitHash.trim()
  if (!/^[a-f0-9]{7,40}$/i.test(hash)) throw new Error('commit hash 无效')
  const result = await runGit(rootDir, ['reset', '--hard', hash])
  if (result.code !== 0) throw new Error(result.stderr || 'Git reset --hard 失败')
  return result.stdout
}

export async function stageWorkspaceGitPath(rootDir: string, relativePath: string) {
  const { relativePath: rel } = resolveWorkspacePath(rootDir, relativePath)
  const result = await runGit(rootDir, ['add', '--', rel])
  if (result.code !== 0) throw new Error(result.stderr || '暂存文件失败')
}

export async function unstageWorkspaceGitPath(rootDir: string, relativePath: string) {
  const { relativePath: rel } = resolveWorkspacePath(rootDir, relativePath)
  const result = await runGit(rootDir, ['restore', '--staged', '--', rel])
  if (result.code === 0) return
  if (/could not resolve HEAD|ambiguous argument 'HEAD'|unknown revision/i.test(result.stderr)) {
    const fallback = await runGit(rootDir, ['rm', '--cached', '-r', '--ignore-unmatch', '--', rel])
    if (fallback.code === 0) return
  }
  throw new Error(result.stderr || '取消暂存失败')
}

export async function commitWorkspaceGit(rootDir: string, message: string) {
  const trimmed = message.trim()
  if (!trimmed) throw new Error('提交说明不能为空')
  const staged = await runGit(rootDir, ['diff', '--cached', '--name-only'])
  if (staged.code !== 0) throw new Error(staged.stderr || '读取已暂存变更失败')
  if (!staged.stdout.trim()) throw new Error('没有已暂存变更可提交')
  const result = await runGit(rootDir, ['-c', 'user.name=AgentHub', '-c', 'user.email=agenthub@example.com', 'commit', '-m', trimmed])
  if (result.code !== 0) throw new Error(result.stderr || 'Git commit 失败')
  return result.stdout
}

export async function discardWorkspaceGitPath(rootDir: string, relativePath: string) {
  const { relativePath: rel } = resolveWorkspacePath(rootDir, relativePath)
  const statusRows = await readWorkspaceGitStatus(rootDir)
  const row = statusRows.find((item) => item.path === rel)
  if (row?.untracked) {
    const { fullPath } = resolveWorkspacePath(rootDir, rel)
    await rm(fullPath, { recursive: true, force: true })
    return
  }
  const result = await runGit(rootDir, ['restore', '--worktree', '--', rel])
  if (result.code !== 0) throw new Error(result.stderr || '丢弃工作区改动失败')
}

export async function writeWorkspaceFile(rootDir: string, relativePath: string, content: string | Buffer) {
  const { fullPath, relativePath: rel } = resolveWorkspacePath(rootDir, relativePath)
  await mkdir(path.dirname(fullPath), { recursive: true })
  await writeFile(fullPath, content)
  return rel
}

function shellSingleQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function scriptPathFromStartCommand(startCommand: string) {
  const trimmed = startCommand.trim().replace(/\s+/g, ' ')
  const match = /^(?:bash|sh)\s+(\.agenthub\/[A-Za-z0-9._/-]+\.sh)$/.exec(trimmed)
  if (!match?.[1] || match[1].includes('..')) throw new Error('启动命令必须指向 .agenthub 内的脚本')
  return { command: trimmed, scriptPath: match[1] }
}

function packageScriptsFromContent(content: string) {
  const parsed = JSON.parse(content) as { scripts?: unknown }
  if (!parsed.scripts || typeof parsed.scripts !== 'object' || Array.isArray(parsed.scripts)) return {}
  return parsed.scripts as Record<string, unknown>
}

function preferredRunnablePackageScript(scripts: Record<string, unknown>, requested?: string | null) {
  if (requested) {
    if (!RUNNABLE_PACKAGE_SCRIPT_SET.has(requested)) throw new Error('不支持的启动脚本')
    if (typeof scripts[requested] !== 'string' || !String(scripts[requested]).trim()) {
      throw new Error(`package.json 缺少 ${requested} 脚本`)
    }
    return requested
  }
  return RUNNABLE_PACKAGE_SCRIPT_NAMES.find((script) => (
    typeof scripts[script] === 'string' && String(scripts[script]).trim()
  )) ?? null
}

export async function detectWorkspaceRunnablePackage(rootDir: string, packagePath = 'package.json'): Promise<WorkspaceRunnablePackage | null> {
  const source = resolveWorkspacePath(rootDir, packagePath)
  const info = await stat(source.fullPath).catch(() => null)
  if (!info?.isFile()) return null
  const content = await readFile(source.fullPath, 'utf8').catch(() => null)
  if (!content) return null
  try {
    const packageScript = preferredRunnablePackageScript(packageScriptsFromContent(content))
    if (!packageScript) return null
    return {
      sourcePath: source.relativePath,
      packageScript,
      command: `npm run ${packageScript}`,
    }
  } catch {
    return null
  }
}

export async function createWorkspaceArtifactLaunchScript(
  rootDir: string,
  artifactId: string,
  launchSource: WorkspaceArtifactLaunchSource,
): Promise<WorkspaceArtifactLaunchScript> {
  const requestedSourcePath = typeof launchSource === 'string' ? launchSource : launchSource.sourcePath
  const requestedPackageScript = typeof launchSource === 'string' ? null : launchSource.packageScript
  const requestedStartCommand = typeof launchSource === 'string' ? null : launchSource.startCommand
  const sourcePath = requestedSourcePath || 'package.json'
  const source = resolveWorkspacePath(rootDir, sourcePath)
  const info = await stat(source.fullPath).catch(() => null)
  if (!info) throw new Error('产物来源不存在')
  const agentLaunch = requestedStartCommand ? scriptPathFromStartCommand(requestedStartCommand) : null
  if (agentLaunch) {
    const agentScript = resolveWorkspacePath(rootDir, agentLaunch.scriptPath)
    const agentScriptInfo = await stat(agentScript.fullPath).catch(() => null)
    if (!agentScriptInfo?.isFile()) throw new Error('启动脚本不存在')
  }
  let packageScript: string | null = null
  const packageJson = resolveWorkspacePath(rootDir, 'package.json')
  const packageInfo = await stat(packageJson.fullPath).catch(() => null)
  if (packageInfo?.isFile()) {
    const packageContent = await readFile(packageJson.fullPath, 'utf8')
    try {
      packageScript = preferredRunnablePackageScript(packageScriptsFromContent(packageContent), requestedPackageScript)
    } catch (error) {
      if (requestedPackageScript) throw error
      packageScript = null
    }
  } else if (requestedPackageScript) {
    throw new Error('package.json 不存在，无法使用启动脚本')
  }
  const scriptId = slug(artifactId.slice(0, 12), 'artifact')
  const scriptPath = `.agenthub/run-artifact-${scriptId}.sh`
  const sourceDir = info.isDirectory() ? source.relativePath : path.posix.dirname(source.relativePath)
  const servingPath = sourceDir === '.' ? source.relativePath : sourceDir
  const script = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'cd "$(dirname "$0")/.."',
    '',
    'PORT="${PORT:-3000}"',
    'export PORT',
    `SOURCE_PATH=${shellSingleQuote(source.relativePath)}`,
    `SERVE_PATH=${shellSingleQuote(servingPath)}`,
    packageScript ? `PACKAGE_SCRIPT=${shellSingleQuote(packageScript)}` : 'PACKAGE_SCRIPT=""',
    agentLaunch ? `AGENTHUB_START_SCRIPT=${shellSingleQuote(agentLaunch.scriptPath)}` : 'AGENTHUB_START_SCRIPT=""',
    '',
    'if [ -n "$AGENTHUB_START_SCRIPT" ]; then',
    '  bash "$AGENTHUB_START_SCRIPT"',
    '  exit 0',
    'fi',
    '',
    'if [ -f package.json ]; then',
    '  if [ ! -d node_modules ]; then',
    '    npm install',
    '  fi',
    '  if [ -n "$PACKAGE_SCRIPT" ]; then',
    '    npm run "$PACKAGE_SCRIPT" -- --host 127.0.0.1 --port "$PORT"',
    '    exit 0',
    '  fi',
    '  if npm run | grep -qE "^  start$|^  dev$| start$| dev$"; then',
    '    if npm run | grep -qE "^  start$| start$"; then',
    '      npm run start -- --host 127.0.0.1 --port "$PORT"',
    '    else',
    '      npm run dev -- --host 127.0.0.1 --port "$PORT"',
    '    fi',
    '    exit 0',
    '  fi',
    'fi',
    '',
    'if [ -f "$SOURCE_PATH" ]; then',
    '  SERVE_PATH="$(dirname "$SOURCE_PATH")"',
    'fi',
    'npx --yes http-server "$SERVE_PATH" -a 127.0.0.1 -p "$PORT"',
    '',
  ].join('\n')
  const written = await writeWorkspaceFile(rootDir, scriptPath, script)
  await chmod(resolveWorkspacePath(rootDir, written).fullPath, 0o755)
  return {
    scriptPath: written,
    command: `bash ${written}`,
    sourcePath: source.relativePath,
    ...(packageScript ? { packageScript } : {}),
    ...(agentLaunch ? { startCommand: agentLaunch.command } : {}),
  }
}

async function findStaticWebEntry(rootDir: string): Promise<string | null> {
  for (const candidate of STATIC_WEB_ENTRY_CANDIDATES) {
    const resolved = resolveWorkspacePath(rootDir, candidate)
    const info = await stat(resolved.fullPath).catch(() => null)
    if (info?.isFile()) return resolved.relativePath
  }
  return null
}

const WORKSPACE_WEB_START_SCRIPT_PATH = '.agenthub/start.sh'

// Closure-stage fallback: generate a standard `.agenthub/start.sh` for a
// browser-visible web product when the model did not author one. Dynamic
// products (package.json with start/dev/preview/serve) start the real service;
// pure static HTML products serve the entry directory with http-server. Both
// honor `PORT="${PORT:-3000}"` and bind to 127.0.0.1 per the delivery contract.
// Never overwrites an existing start.sh (model authorship wins). Returns null
// when the workspace is not a web product (no runnable package and no HTML entry).
export async function ensureWorkspaceWebStartScript(rootDir: string): Promise<WorkspaceWebStartScript | null> {
  const existing = resolveWorkspacePath(rootDir, WORKSPACE_WEB_START_SCRIPT_PATH)
  const existingInfo = await stat(existing.fullPath).catch(() => null)

  const runnable = await detectWorkspaceRunnablePackage(rootDir)
  const htmlEntry = runnable ? null : await findStaticWebEntry(rootDir)
  if (!runnable && !htmlEntry) return null

  const startCommand = `bash ${WORKSPACE_WEB_START_SCRIPT_PATH}`
  // Validate the produced command satisfies the launch-command contract.
  scriptPathFromStartCommand(startCommand)

  if (existingInfo?.isFile()) {
    return {
      scriptPath: WORKSPACE_WEB_START_SCRIPT_PATH,
      startCommand,
      kind: runnable ? 'dynamic' : 'static',
      ...(runnable ? { packageScript: runnable.packageScript } : {}),
      ...(htmlEntry ? { htmlEntry } : {}),
      created: false,
    }
  }

  let script: string
  if (runnable) {
    script = [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'cd "$(dirname "$0")/.."',
      '',
      'PORT="${PORT:-3000}"',
      'export PORT',
      `PACKAGE_SCRIPT=${shellSingleQuote(runnable.packageScript)}`,
      '',
      'if [ ! -d node_modules ]; then',
      '  npm install',
      'fi',
      'npm run "$PACKAGE_SCRIPT" -- --host 127.0.0.1 --port "$PORT"',
      '',
    ].join('\n')
  } else {
    const entryDir = path.posix.dirname(htmlEntry as string)
    const serveDir = entryDir === '.' ? '.' : entryDir
    script = [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'cd "$(dirname "$0")/.."',
      '',
      'PORT="${PORT:-3000}"',
      'export PORT',
      `SERVE_PATH=${shellSingleQuote(serveDir)}`,
      '',
      'npx --yes http-server "$SERVE_PATH" -a 127.0.0.1 -p "$PORT"',
      '',
    ].join('\n')
  }

  const written = await writeWorkspaceFile(rootDir, WORKSPACE_WEB_START_SCRIPT_PATH, script)
  await chmod(resolveWorkspacePath(rootDir, written).fullPath, 0o755)
  return {
    scriptPath: written,
    startCommand,
    kind: runnable ? 'dynamic' : 'static',
    ...(runnable ? { packageScript: runnable.packageScript } : {}),
    ...(htmlEntry ? { htmlEntry } : {}),
    created: true,
  }
}

async function readEditableWorkspaceFile(rootDir: string, relativePath: string) {
  const { fullPath, relativePath: rel } = resolveWorkspacePath(rootDir, relativePath)
  const info = await stat(fullPath).catch(() => null)
  if (!info) throw new Error('文件不存在')
  if (!info.isFile()) throw new Error('仅支持编辑普通文件')
  if (info.size > MAX_EDIT_BYTES) throw new Error('文件超过 256KB，暂不支持在线编辑')
  const preview = await readCloudWorkspacePreview(rootDir, rel)
  if (preview.content === null || ['binary', 'image', 'folder', 'document', 'presentation'].includes(preview.previewKind)) {
    throw new Error('该文件类型暂不支持在线编辑')
  }
  return { relativePath: rel, content: await readFile(fullPath, 'utf8') }
}

function assertSelection(content: string, selectionStart: number, selectionEnd: number) {
  if (!Number.isInteger(selectionStart) || !Number.isInteger(selectionEnd)) {
    throw new Error('选区范围无效')
  }
  if (selectionStart < 0 || selectionEnd < selectionStart || selectionEnd > content.length) {
    throw new Error('选区范围超出文件内容')
  }
}

function simpleUnifiedDiff(filePath: string, original: string, next: string) {
  if (original === next) return ''
  const oldLines = original.split('\n')
  const newLines = next.split('\n')
  return [
    `diff --git a/${filePath} b/${filePath}`,
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    `@@ -1,${oldLines.length} +1,${newLines.length} @@`,
    ...oldLines.map((line) => `-${line}`),
    ...newLines.map((line) => `+${line}`),
  ].join('\n')
}

export async function createWorkspaceSelectionPatchDraft(
  rootDir: string,
  relativePath: string,
  selectionStart: number,
  selectionEnd: number,
  replacement: string,
): Promise<WorkspacePatchDraft> {
  const { relativePath: rel, content } = await readEditableWorkspaceFile(rootDir, relativePath)
  assertSelection(content, selectionStart, selectionEnd)
  if (Buffer.byteLength(replacement, 'utf8') > MAX_EDIT_BYTES) throw new Error('替换内容超过 256KB')
  const selectedText = content.slice(selectionStart, selectionEnd)
  const next = `${content.slice(0, selectionStart)}${replacement}${content.slice(selectionEnd)}`
  if (Buffer.byteLength(next, 'utf8') > MAX_EDIT_BYTES) throw new Error('修改后文件超过 256KB')
  return {
    path: rel,
    selectionStart,
    selectionEnd,
    selectedText,
    replacement,
    content: next,
    diff: simpleUnifiedDiff(rel, content, next),
  }
}

export async function applyWorkspaceSelectionPatch(
  rootDir: string,
  relativePath: string,
  selectionStart: number,
  selectionEnd: number,
  expectedText: string,
  replacement: string,
) {
  const draft = await createWorkspaceSelectionPatchDraft(rootDir, relativePath, selectionStart, selectionEnd, replacement)
  if (draft.selectedText !== expectedText) throw new Error('文件内容已变化，请重新选择后再应用')
  await writeWorkspaceFile(rootDir, draft.path, draft.content)
  return draft
}

export async function renameWorkspaceEntry(rootDir: string, fromPath: string, toPath: string) {
  const from = resolveWorkspacePath(rootDir, fromPath)
  const to = resolveWorkspacePath(rootDir, toPath)
  await mkdir(path.dirname(to.fullPath), { recursive: true })
  await rename(from.fullPath, to.fullPath)
  return to.relativePath
}

export async function deleteWorkspaceEntry(rootDir: string, relativePath: string) {
  const { fullPath } = resolveWorkspacePath(rootDir, relativePath)
  await rm(fullPath, { recursive: true, force: true })
}
