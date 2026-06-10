import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createPostgresChain,
  mockWorkspace,
  resetMockAuth,
  resetMockClient,
  setupMockAuth,
  setupMockClient,
} from '../utils'

let tmpDirs: string[] = []

describe('/api/workspaces/[id]/files/download', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    setupMockAuth()
  })

  afterEach(async () => {
    await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })))
    tmpDirs = []
  })

  it('downloads files with non-ASCII names using an encoded Content-Disposition header', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agenthub-workspace-download-'))
    tmpDirs.push(root)
    await mkdir(path.join(root, 'artifacts'), { recursive: true })
    await writeFile(path.join(root, 'artifacts', '字节跳动简介.pdf'), 'pdf-bytes')
    setupMockClient(createPostgresChain(undefined, [{ ...mockWorkspace, cloud_project_dir: root }]))

    const { GET } = await import('@/app/api/workspaces/[id]/files/download/route')
    const request = new Request(
      new URL('/api/workspaces/ws-001/files/download?path=artifacts%2F%E5%AD%97%E8%8A%82%E8%B7%B3%E5%8A%A8%E7%AE%80%E4%BB%8B.pdf', 'http://localhost'),
    )
    const response = await GET(request, { params: Promise.resolve({ id: 'ws-001' }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(await response.text()).toBe('pdf-bytes')
    const disposition = response.headers.get('Content-Disposition')
    expect(disposition).toContain('filename="______.pdf"')
    expect(disposition).toContain("filename*=UTF-8''%E5%AD%97%E8%8A%82%E8%B7%B3%E5%8A%A8%E7%AE%80%E4%BB%8B.pdf")
  })
})
