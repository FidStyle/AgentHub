import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createWorkspaceFolderZip,
  deleteWorkspaceEntry,
  readCloudWorkspacePreview,
  readWorkspaceGitDiff,
  readWorkspaceGitStatus,
  renameWorkspaceEntry,
  resolveWorkspacePath,
  writeWorkspaceFile,
} from '@/lib/workspace/cloud-workspace-fs'

let tmpDirs: string[] = []

async function makeWorkspace() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'agenthub-workspace-'))
  tmpDirs.push(dir)
  return dir
}

async function runGit(cwd: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('git', args, { cwd, stdio: 'ignore' })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`git ${args.join(' ')} failed with ${code}`))
    })
  })
}

afterEach(async () => {
  await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })))
  tmpDirs = []
})

describe('workspace file preview and artifact bundle helpers', () => {
  it('reads html, markdown, code and folder previews from workspace-relative paths', async () => {
    const root = await makeWorkspace()
    await mkdir(path.join(root, 'site'), { recursive: true })
    await writeFile(path.join(root, 'site/index.html'), '<h1>AgentHub HTML Preview</h1>')
    await writeFile(path.join(root, 'README.md'), '# AgentHub Markdown')
    await writeFile(path.join(root, 'src.ts'), 'export const value = 1\n')

    const html = await readCloudWorkspacePreview(root, 'site/index.html')
    expect(html.previewKind).toBe('html')
    expect(html.content).toContain('AgentHub HTML Preview')

    const markdown = await readCloudWorkspacePreview(root, 'README.md')
    expect(markdown.previewKind).toBe('markdown')
    expect(markdown.content).toContain('AgentHub Markdown')

    const code = await readCloudWorkspacePreview(root, 'src.ts')
    expect(code.previewKind).toBe('code')
    expect(code.content).toContain('export const value')

    const folder = await readCloudWorkspacePreview(root, 'site')
    expect(folder.previewKind).toBe('folder')
    expect(folder.content).toContain('site/index.html')
  })

  it('rejects paths outside the workspace root', async () => {
    const root = await makeWorkspace()
    expect(() => resolveWorkspacePath(root, '../outside.txt')).toThrow('路径超出工作区范围')
  })

  it('creates a downloadable zip bundle for folder artifacts', async () => {
    const root = await makeWorkspace()
    await mkdir(path.join(root, 'dist'), { recursive: true })
    await writeFile(path.join(root, 'dist/index.html'), '<h1>bundle</h1>')
    await writeFile(path.join(root, 'dist/app.js'), 'console.log("bundle")')

    const zip = await createWorkspaceFolderZip(root, 'dist')
    expect(zip.subarray(0, 4).toString('hex')).toBe('504b0304')
    expect(zip.includes(Buffer.from('dist/index.html'))).toBe(true)
    expect(zip.includes(Buffer.from('dist/app.js'))).toBe(true)
  })

  it('writes, renames, deletes and reports git changes inside the workspace', async () => {
    const root = await makeWorkspace()
    await runGit(root, ['init'])

    const written = await writeWorkspaceFile(root, 'docs/guide.md', '# Guide\n')
    expect(written).toBe('docs/guide.md')
    let status = await readWorkspaceGitStatus(root)
    expect(status).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'docs/guide.md', untracked: true })]))

    const diff = await readWorkspaceGitDiff(root, 'docs/guide.md')
    expect(diff).toContain('new file mode')
    expect(diff).toContain('+# Guide')

    const renamed = await renameWorkspaceEntry(root, 'docs/guide.md', 'docs/manual.md')
    expect(renamed).toBe('docs/manual.md')
    const preview = await readCloudWorkspacePreview(root, 'docs/manual.md')
    expect(preview.content).toContain('# Guide')

    await deleteWorkspaceEntry(root, 'docs/manual.md')
    await expect(readCloudWorkspacePreview(root, 'docs/manual.md')).rejects.toThrow('文件不存在')
  })
})
