import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createPostgresChain,
  resetMockAuth,
  resetMockClient,
  mockArtifact,
  mockWorkspace,
  setupMockAuth,
  setupMockClient,
} from '../utils'

let tmpDirs: string[] = []

async function callRoute<T>(
  handler: (request: Request) => Promise<Response>,
  method: 'GET' | 'POST',
  url: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const request = new Request(new URL(url, 'http://localhost'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  })
  const response = await handler(request)
  return { status: response.status, data: await response.json() as T }
}

async function callArtifactRoute<T>(
  handler: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>,
  method: 'GET' | 'PATCH' | 'POST',
  id: string,
  body?: unknown,
): Promise<{ status: number; data: T; response: Response }> {
  const request = new Request(new URL(`/api/artifacts/${id}`, 'http://localhost'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'PATCH' || method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  })
  const response = await handler(request, { params: Promise.resolve({ id }) })
  return { status: response.status, data: await response.clone().json().catch(() => null) as T, response }
}

describe('/api/artifacts', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    setupMockAuth()
    setupMockClient(createPostgresChain())
  })

  afterEach(async () => {
    await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })))
    tmpDirs = []
  })

  it('lists durable artifacts by workspace and session with ownership checks', async () => {
    const { GET } = await import('@/app/api/artifacts/route')
    const result = await callRoute<Array<{ id: string; title: string }>>(
      GET,
      'GET',
      '/api/artifacts?workspace_id=ws-001&session_id=session-001',
    )
    expect(result.status).toBe(200)
    expect(result.data.some((artifact) => artifact.title === '测试产物')).toBe(true)
  })

  it('creates a non-file artifact as a durable record', async () => {
    const { POST } = await import('@/app/api/artifacts/route')
    const result = await callRoute<{ title: string; artifact_type: string; content: string }>(
      POST,
      'POST',
      '/api/artifacts',
      {
        workspace_id: 'ws-001',
        session_id: 'session-001',
        title: 'Markdown 产物',
        artifact_type: 'markdown',
        content: '# Markdown 产物',
      },
    )
    expect(result.status).toBe(201)
    expect(result.data.title).toBe('Markdown 产物')
    expect(result.data.artifact_type).toBe('markdown')
    expect(result.data.content).toContain('Markdown 产物')
  })

  it('creates document and presentation artifacts with editable content', async () => {
    const { POST } = await import('@/app/api/artifacts/route')

    const documentResult = await callRoute<{ artifact_type: string; content: string }>(
      POST,
      'POST',
      '/api/artifacts',
      {
        workspace_id: 'ws-001',
        session_id: 'session-001',
        title: '富文档产物',
        artifact_type: 'document',
      },
    )
    expect(documentResult.status).toBe(201)
    expect(documentResult.data.artifact_type).toBe('document')
    expect(documentResult.data.content).toContain('富文档产物')

    const presentationResult = await callRoute<{ artifact_type: string; content: string }>(
      POST,
      'POST',
      '/api/artifacts',
      {
        workspace_id: 'ws-001',
        session_id: 'session-001',
        title: '演示稿产物',
        artifact_type: 'presentation',
      },
    )
    expect(presentationResult.status).toBe(201)
    expect(presentationResult.data.artifact_type).toBe('presentation')
    expect(JSON.parse(presentationResult.data.content).slides.length).toBeGreaterThan(0)
  })

  it('generates a real PPTX file and writes an IM presentation preview card', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agenthub-ppt-generate-'))
    tmpDirs.push(root)
    const insertedMessages: Record<string, unknown>[] = []
    const base = createPostgresChain(
      undefined,
      [{ ...mockWorkspace, cloud_project_dir: root }],
      undefined,
      [],
      [{
        id: 'agent-artifact',
        workspace_id: 'ws-001',
        name: '产物助手',
        role_type: 'assistant',
        system_prompt: '负责产物收口',
        capability_tags: ['产物'],
        enabled_tool_ids: ['artifact_store'],
        runtime_type: 'codex',
        is_orchestrator: false,
      }],
      [],
    )
    setupMockClient(() => {
      const client = base()
      const origFrom = client.from
      client.from = ((table: string) => {
        const t = origFrom(table)
        if (table === 'messages') {
          const origInsert = t.insert
          t.insert = (vals: Record<string, unknown>) => {
            insertedMessages.push(vals)
            return origInsert(vals)
          }
        }
        return t
      }) as typeof client.from
      return client
    })

    const { POST } = await import('@/app/api/artifacts/presentations/generate/route')
    const result = await callRoute<{ artifact: { artifact_type: string; title: string }; pptxPath: string }>(
      POST,
      'POST',
      '/api/artifacts/presentations/generate',
      {
        workspace_id: 'ws-001',
        session_id: 'session-001',
        title: '项目汇报',
        prompt: '生成一份三页项目汇报 PPT',
      },
    )

    expect(result.status).toBe(201)
    expect(result.data.artifact.artifact_type).toBe('presentation')
    expect(result.data.pptxPath).toBe('artifacts/项目汇报/deck.pptx')
    const pptxBytes = await readFile(path.join(root, result.data.pptxPath))
    expect(pptxBytes.subarray(0, 4).toString('hex')).toBe('504b0304')
    expect(insertedMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role_agent_id: 'agent-artifact',
        message_type: 'result_card',
        metadata: expect.objectContaining({
          runtimeParts: expect.arrayContaining([
            expect.objectContaining({ type: 'artifact', artifactType: 'presentation' }),
            expect.objectContaining({ type: 'presentation_preview', title: '项目汇报' }),
          ]),
        }),
      }),
    ]))
  })

  it('updates artifact content and records edit requests durably', async () => {
    const { PATCH } = await import('@/app/api/artifacts/[id]/route')
    const result = await callArtifactRoute<{
      title: string
      content: string
      metadata: { editRequests: Array<{ instruction: string }> }
    }>(
      PATCH,
      'PATCH',
      'artifact-001',
      {
        title: '更新后的富文档',
        artifact_type: 'document',
        content: '# 更新后的富文档',
        edit_request: { instruction: '把摘要改成三点列表' },
      },
    )

    expect(result.status).toBe(200)
    expect(result.data.title).toBe('更新后的富文档')
    expect(result.data.content).toContain('更新后的富文档')
    expect(result.data.metadata.editRequests[0].instruction).toBe('把摘要改成三点列表')
  })

  it('downloads document and presentation artifacts as OpenXML files', async () => {
    setupMockClient(createPostgresChain(undefined, undefined, undefined, undefined, undefined, [
      { ...mockArtifact, artifact_type: 'document', title: '导出文档', content: '# 导出文档' },
    ]))
    const { GET } = await import('@/app/api/artifacts/[id]/download/route')
    const documentResult = await callArtifactRoute<unknown>(GET, 'GET', 'artifact-001')

    expect(documentResult.status).toBe(200)
    expect(documentResult.response.headers.get('Content-Type')).toContain('wordprocessingml.document')
    const bytes = Buffer.from(await documentResult.response.arrayBuffer())
    expect(bytes.subarray(0, 4).toString('hex')).toBe('504b0304')

    setupMockClient(createPostgresChain(undefined, undefined, undefined, undefined, undefined, [
      {
        ...mockArtifact,
        artifact_type: 'presentation',
        title: '导出演示稿',
        content: JSON.stringify({ version: 1, title: '导出演示稿', slides: [{ title: '第一页', body: ['要点'] }] }),
      },
    ]))
    const presentationResult = await callArtifactRoute<unknown>(GET, 'GET', 'artifact-001')

    expect(presentationResult.status).toBe(200)
    expect(presentationResult.response.headers.get('Content-Type')).toContain('presentationml.presentation')
    const pptxBytes = Buffer.from(await presentationResult.response.arrayBuffer())
    expect(pptxBytes.subarray(0, 4).toString('hex')).toBe('504b0304')
  })

  it('downloads generated presentation artifacts from the workspace source file when present', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agenthub-pptx-artifact-'))
    tmpDirs.push(root)
    await mkdir(path.join(root, 'artifacts', 'deck'), { recursive: true })
    const sourceBytes = Buffer.from('PK\u0003\u0004source-pptx')
    await writeFile(path.join(root, 'artifacts', 'deck', 'deck.pptx'), sourceBytes)
    setupMockClient(createPostgresChain(undefined, [{ ...mockWorkspace, cloud_project_dir: root }], undefined, undefined, undefined, [
      {
        ...mockArtifact,
        artifact_type: 'presentation',
        title: '源文件演示稿',
        source_path: 'artifacts/deck/deck.pptx',
        content: JSON.stringify({ version: 1, title: '不会用于下载', slides: [{ title: 'JSON', body: ['fallback'] }] }),
      },
    ]))

    const { GET } = await import('@/app/api/artifacts/[id]/download/route')
    const result = await callArtifactRoute<unknown>(GET, 'GET', 'artifact-001')
    const bytes = Buffer.from(await result.response.arrayBuffer())

    expect(result.status).toBe(200)
    expect(result.response.headers.get('Content-Type')).toContain('presentationml.presentation')
    expect(bytes.equals(sourceBytes)).toBe(true)
  })

  it('previews markdown-like documents without forcing a publish command', async () => {
    setupMockClient(createPostgresChain(undefined, undefined, undefined, undefined, undefined, [
      { ...mockArtifact, artifact_type: 'document', title: '需求文档', content: '# 需求文档\n\n正文' },
    ]))
    const { POST } = await import('@/app/api/artifacts/[id]/preview/route')
    const result = await callArtifactRoute<{ kind: string; status: string; content: string; url: string }>(
      POST,
      'POST',
      'artifact-001',
    )

    expect(result.status).toBe(200)
    expect(result.data.kind).toBe('document')
    expect(result.data.status).toBe('markdown')
    expect(result.data.content).toContain('需求文档')
    expect(result.data.url).toContain('/m/preview?artifactId=artifact-001')
  })

  it('fails explicitly when presentation source is missing', async () => {
    setupMockClient(createPostgresChain(undefined, undefined, undefined, undefined, undefined, [
      {
        ...mockArtifact,
        artifact_type: 'presentation',
        title: '汇报演示稿',
        source_path: null,
        content: JSON.stringify({ version: 1, title: '汇报演示稿', slides: [{ title: '第一页', body: ['要点'] }] }),
      },
    ]))
    const { POST } = await import('@/app/api/artifacts/[id]/preview/route')
    const result = await callArtifactRoute<{ kind: string; status: string; message: string }>(
      POST,
      'POST',
      'artifact-001',
    )

    expect(result.status).toBe(409)
    expect(result.data.kind).toBe('presentation')
    expect(result.data.status).toBe('unavailable')
    expect(result.data.message).toContain('缺少源文件路径')
  })

  it('rejects artifact creation without workspace_id', async () => {
    const { POST } = await import('@/app/api/artifacts/route')
    const result = await callRoute<{ error: string }>(POST, 'POST', '/api/artifacts', {
      title: '缺工作区',
    })
    expect(result.status).toBe(400)
    expect(result.data.error).toBe('缺少 workspace_id')
  })
})
