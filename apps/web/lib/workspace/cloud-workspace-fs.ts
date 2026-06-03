import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import os from 'node:os'

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
}

export type WorkspacePreviewKind = 'html' | 'markdown' | 'code' | 'image' | 'text' | 'binary' | 'folder'

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
  if (mime.startsWith('image/')) return 'image'
  if (ext === '.html' || ext === '.htm') return 'html'
  if (ext === '.md' || ext === '.markdown') return 'markdown'
  if (['.js', '.jsx', '.ts', '.tsx', '.css', '.json', '.sql', '.sh', '.yml', '.yaml', '.toml'].includes(ext)) return 'code'
  if (mime.startsWith('text/') || ext === '.txt') return 'text'
  return 'binary'
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
  const mime = mimeForPath(rel)
  const previewKind = previewKindForPath(rel, mime)
  const canInlineText = previewKind !== 'binary' && previewKind !== 'image'
  let content: string | null = null
  let truncated = false
  if (canInlineText) {
    const buffer = await readFile(fullPath)
    truncated = buffer.length > MAX_PREVIEW_BYTES
    content = buffer.subarray(0, MAX_PREVIEW_BYTES).toString('utf8')
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

export async function createWorkspaceFolderZip(rootDir: string, relativePath: string) {
  const manifest = await buildWorkspaceFolderManifest(rootDir, relativePath)
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const file of manifest.files) {
    const { fullPath } = resolveWorkspacePath(rootDir, file.path)
    const data = await readFile(fullPath)
    const name = Buffer.from(file.path, 'utf8')
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

export async function stageWorkspaceGitPath(rootDir: string, relativePath: string) {
  const { relativePath: rel } = resolveWorkspacePath(rootDir, relativePath)
  const result = await runGit(rootDir, ['add', '--', rel])
  if (result.code !== 0) throw new Error(result.stderr || '暂存文件失败')
}

export async function unstageWorkspaceGitPath(rootDir: string, relativePath: string) {
  const { relativePath: rel } = resolveWorkspacePath(rootDir, relativePath)
  const result = await runGit(rootDir, ['restore', '--staged', '--', rel])
  if (result.code !== 0) throw new Error(result.stderr || '取消暂存失败')
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

async function readEditableWorkspaceFile(rootDir: string, relativePath: string) {
  const { fullPath, relativePath: rel } = resolveWorkspacePath(rootDir, relativePath)
  const info = await stat(fullPath).catch(() => null)
  if (!info) throw new Error('文件不存在')
  if (!info.isFile()) throw new Error('仅支持编辑普通文件')
  if (info.size > MAX_EDIT_BYTES) throw new Error('文件超过 256KB，暂不支持在线编辑')
  if (previewKindForPath(rel) === 'binary' || previewKindForPath(rel) === 'image') throw new Error('该文件类型暂不支持在线编辑')
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
