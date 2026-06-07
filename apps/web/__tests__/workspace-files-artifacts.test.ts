import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createWorkspaceFolderZip,
  applyWorkspaceSelectionPatch,
  cloudWorkspaceDir,
  cloudWorkspaceRoot,
  createWorkspaceArtifactLaunchScript,
  commitWorkspaceGit,
  createWorkspaceSelectionPatchDraft,
  deleteWorkspaceEntry,
  discardWorkspaceGitPath,
  readCloudWorkspacePreview,
  readWorkspaceGitDiff,
  readWorkspaceGitHistory,
  readWorkspaceGitStatus,
  renameWorkspaceEntry,
  resolveWorkspacePath,
  stageWorkspaceGitPath,
  unstageWorkspaceGitPath,
  writeWorkspaceFile,
} from '@/lib/workspace/cloud-workspace-fs'

let tmpDirs: string[] = []
const originalCloudWorkspaceRoot = process.env.AGENTHUB_CLOUD_WORKSPACE_ROOT

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
  if (originalCloudWorkspaceRoot === undefined) delete process.env.AGENTHUB_CLOUD_WORKSPACE_ROOT
  else process.env.AGENTHUB_CLOUD_WORKSPACE_ROOT = originalCloudWorkspaceRoot
})

describe('workspace file preview and artifact bundle helpers', () => {
  it('keeps default cloud workspaces outside the current project tree', () => {
    delete process.env.AGENTHUB_CLOUD_WORKSPACE_ROOT
    expect(cloudWorkspaceRoot()).toBe(path.join(os.homedir(), '.agenthub', 'cloud-workspaces'))
    expect(cloudWorkspaceDir({ id: 'user-001', name: 'Test User' }, { id: 'workspace-001', name: 'Demo App' }))
      .toBe(path.join(os.homedir(), '.agenthub', 'cloud-workspaces', 'test-user', 'demo-app-workspac'))
  })

  it('allows tests and deployments to override the cloud workspace root', () => {
    process.env.AGENTHUB_CLOUD_WORKSPACE_ROOT = '/tmp/agenthub-cloud-root'
    expect(cloudWorkspaceRoot()).toBe('/tmp/agenthub-cloud-root')
    expect(cloudWorkspaceDir({ id: 'user-001' }, { id: 'workspace-001', name: 'Demo App' }))
      .toBe('/tmp/agenthub-cloud-root/user-001/demo-app-workspac')
  })

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

  it('creates a persistent launch script for runnable workspace artifacts', async () => {
    const root = await makeWorkspace()
    await mkdir(path.join(root, 'public'), { recursive: true })
    await writeFile(path.join(root, 'public/index.html'), '<h1>launchable</h1>')

    const launch = await createWorkspaceArtifactLaunchScript(root, 'artifact-001-long-id', 'public/index.html')
    const scriptPreview = await readCloudWorkspacePreview(root, launch.scriptPath)

    expect(launch).toEqual({
      scriptPath: '.agenthub/run-artifact-artifact-001.sh',
      command: 'bash .agenthub/run-artifact-artifact-001.sh',
      sourcePath: 'public/index.html',
    })
    expect(scriptPreview.content).toContain('npx --yes http-server')
    expect(scriptPreview.content).toContain("SOURCE_PATH='public/index.html'")
    expect(scriptPreview.content).toContain('cd "$(dirname "$0")/.."')
  })

  it('rejects launch scripts for source paths outside the workspace', async () => {
    const root = await makeWorkspace()

    await expect(createWorkspaceArtifactLaunchScript(root, 'artifact-001', '../outside/index.html'))
      .rejects.toThrow('路径超出工作区范围')
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

  it('stages, unstages and discards real git workspace changes', async () => {
    const root = await makeWorkspace()
    await runGit(root, ['init'])
    await runGit(root, ['config', 'user.email', 'agenthub@example.com'])
    await runGit(root, ['config', 'user.name', 'AgentHub Test'])
    await writeFile(path.join(root, 'tracked.txt'), 'before\n')
    await runGit(root, ['add', 'tracked.txt'])
    await runGit(root, ['commit', '-m', 'initial'])

    await writeWorkspaceFile(root, 'tracked.txt', 'after\n')
    let status = await readWorkspaceGitStatus(root)
    expect(status).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'tracked.txt', staged: false, unstaged: true })]))

    await stageWorkspaceGitPath(root, 'tracked.txt')
    status = await readWorkspaceGitStatus(root)
    expect(status).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'tracked.txt', staged: true })]))
    const stagedDiff = await readWorkspaceGitDiff(root, 'tracked.txt', true)
    expect(stagedDiff).toContain('+after')

    await unstageWorkspaceGitPath(root, 'tracked.txt')
    status = await readWorkspaceGitStatus(root)
    expect(status).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'tracked.txt', staged: false, unstaged: true })]))

    await discardWorkspaceGitPath(root, 'tracked.txt')
    const preview = await readCloudWorkspacePreview(root, 'tracked.txt')
    expect(preview.content).toBe('before\n')
    expect(await readWorkspaceGitStatus(root)).toEqual([])
  })

  it('unstages newly added files before the first commit without resolving HEAD', async () => {
    const root = await makeWorkspace()
    await runGit(root, ['init'])
    await writeWorkspaceFile(root, 'first.txt', 'first\n')

    await stageWorkspaceGitPath(root, 'first.txt')
    let status = await readWorkspaceGitStatus(root)
    expect(status).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'first.txt', staged: true })]))

    await unstageWorkspaceGitPath(root, 'first.txt')
    status = await readWorkspaceGitStatus(root)
    expect(status).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'first.txt', untracked: true })]))
  })

  it('commits staged workspace changes and rejects empty commit messages', async () => {
    const root = await makeWorkspace()
    await runGit(root, ['init'])
    await writeWorkspaceFile(root, 'README.md', '# Commit\n')
    await stageWorkspaceGitPath(root, 'README.md')

    await expect(commitWorkspaceGit(root, '   ')).rejects.toThrow('提交说明不能为空')
    await commitWorkspaceGit(root, 'initial from helper')

    expect(await readWorkspaceGitStatus(root)).toEqual([])
    expect((await readWorkspaceGitHistory(root))[0]).toEqual(expect.objectContaining({
      author: 'AgentHub',
      message: 'initial from helper',
    }))
  })

  it('creates and applies selection patch drafts without writing before approval', async () => {
    const root = await makeWorkspace()
    await runGit(root, ['init'])
    await writeWorkspaceFile(root, 'src/app.ts', 'const name = "AgentHub"\nconsole.log(name)\n')

    const original = await readCloudWorkspacePreview(root, 'src/app.ts')
    const content = original.content ?? ''
    const selectionStart = content.indexOf('AgentHub')
    const selectionEnd = selectionStart + 'AgentHub'.length
    const draft = await createWorkspaceSelectionPatchDraft(root, 'src/app.ts', selectionStart, selectionEnd, 'Mini IDE')

    expect(draft.selectedText).toBe('AgentHub')
    expect(draft.diff).toContain('-const name = "AgentHub"')
    expect(draft.diff).toContain('+const name = "Mini IDE"')
    expect((await readCloudWorkspacePreview(root, 'src/app.ts')).content).toBe(content)

    await applyWorkspaceSelectionPatch(root, 'src/app.ts', selectionStart, selectionEnd, 'AgentHub', 'Mini IDE')
    expect((await readCloudWorkspacePreview(root, 'src/app.ts')).content).toContain('Mini IDE')
    expect(await readWorkspaceGitStatus(root)).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'src/app.ts' })]))
  })

  it('rejects stale selection patches when the file changed after draft', async () => {
    const root = await makeWorkspace()
    await runGit(root, ['init'])
    await writeWorkspaceFile(root, 'notes.md', 'before\n')
    await writeWorkspaceFile(root, 'notes.md', 'changed\n')

    await expect(applyWorkspaceSelectionPatch(root, 'notes.md', 0, 'before'.length, 'before', 'after'))
      .rejects.toThrow('文件内容已变化')
  })

  it('reads recent git commit history from the real repository', async () => {
    const root = await makeWorkspace()
    await runGit(root, ['init'])
    await runGit(root, ['config', 'user.email', 'agenthub@example.com'])
    await runGit(root, ['config', 'user.name', 'AgentHub Test'])
    await writeWorkspaceFile(root, 'README.md', '# History\n')
    await runGit(root, ['add', 'README.md'])
    await runGit(root, ['commit', '-m', 'initial history'])

    const commits = await readWorkspaceGitHistory(root)
    expect(commits[0]).toEqual(expect.objectContaining({
      author: 'AgentHub Test',
      message: 'initial history',
    }))
    expect(commits[0]?.shortHash).toHaveLength(7)
  })
})
