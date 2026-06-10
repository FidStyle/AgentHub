import { mkdir, rm } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createPostgresChain,
  mockWorkspace,
  resetMockAuth,
  resetMockClient,
  setupMockAuth,
  setupMockClient,
} from '../utils'

async function callRoute<T>(handler: (request: Request) => Promise<Response>, method: 'GET' | 'POST', url: string, body?: unknown) {
  const request = new Request(new URL(url, 'http://localhost'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  })
  const response = await handler(request)
  return { status: response.status, data: await response.json() as T }
}

async function callWorkspaceRoute<T>(
  handler: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>,
  workspaceId: string,
  body: unknown,
) {
  const request = new Request(new URL(`/api/workspaces/${workspaceId}/diff/apply`, 'http://localhost'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const response = await handler(request, { params: Promise.resolve({ id: workspaceId }) })
  return { status: response.status, data: await response.json() as T }
}

describe('new rich IM/API contracts', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    setupMockAuth()
    setupMockClient(createPostgresChain())
  })

  it('creates a role-agent draft with recommended concrete tools', async () => {
    const { POST } = await import('@/app/api/role-agents/draft/route')
    const result = await callRoute<{ name: string; enabled_tool_ids: string[]; capability_tags: string[] }>(
      POST,
      'POST',
      '/api/role-agents/draft',
      { workspace_id: 'ws-001', prompt: '创建一个能生成 PPT 并发布预览的助手' },
    )
    expect(result.status).toBe(200)
    expect(result.data.name).toBe('演示稿工程师')
    expect(result.data.enabled_tool_ids).toContain('ppt_master')
    expect(result.data.enabled_tool_ids).toContain('publish_service')
    expect(result.data.capability_tags).toContain('演示稿')
  })

  it('creates a document engineer draft with visible file/artifact boundaries', async () => {
    const { POST } = await import('@/app/api/role-agents/draft/route')
    const result = await callRoute<{ name: string; enabled_tool_ids: string[]; capability_tags: string[] }>(
      POST,
      'POST',
      '/api/role-agents/draft',
      { workspace_id: 'ws-001', prompt: '创建一个文档工程师，负责 Markdown 文档和预览产物' },
    )
    expect(result.status).toBe(200)
    expect(result.data.name).toBe('文档工程师')
    expect(result.data.enabled_tool_ids).toEqual(expect.arrayContaining(['file_read', 'file_write', 'artifact_store']))
    expect(result.data.capability_tags).toContain('文档')
  })

  it('rejects invalid role-agent tools on create', async () => {
    const { POST } = await import('@/app/api/role-agents/route')
    const result = await callRoute<{ error: string }>(
      POST,
      'POST',
      '/api/role-agents',
      { workspace_id: 'ws-001', name: 'Bad Agent', enabled_tool_ids: ['unknown_tool'] },
    )
    expect(result.status).toBe(400)
    expect(result.data.error).toContain('未知工具')
  })

  it('serves concrete built-in tool catalog and rejects runtimes as tools', async () => {
    const { GET } = await import('@/app/api/tools/catalog/route')
    const catalog = await callRoute<{ tools: Array<{ id: string; label: string }> }>(
      GET,
      'GET',
      '/api/tools/catalog',
    )
    expect(catalog.status).toBe(200)
    expect(catalog.data.tools.map((tool) => tool.id)).toEqual(expect.arrayContaining([
      'file_read',
      'git_cli',
      'publish_service',
      'ppt_master',
    ]))

    const { POST } = await import('@/app/api/role-agents/route')
    const result = await callRoute<{ error: string }>(
      POST,
      'POST',
      '/api/role-agents',
      { workspace_id: 'ws-001', name: 'Bad Runtime Tool Agent', enabled_tool_ids: ['codex'] },
    )
    expect(result.status).toBe(400)
    expect(result.data.error).toContain('Runtime 不是工具')
  })

  it('loads the default presentation engineer from role-agent config', async () => {
    const { DEFAULT_ROLE_AGENTS } = await import('@/config/role-agents/schema')
    const presentationRole = DEFAULT_ROLE_AGENTS.find((role) => role.name === '演示稿工程师')

    expect(presentationRole).toMatchObject({
      role_type: 'engineer',
      runtime_type: 'codex',
      is_orchestrator: false,
    })
    expect(presentationRole?.enabled_tool_ids).toEqual(expect.arrayContaining(['file_read', 'file_write', 'artifact_store', 'ppt_master']))
    expect(presentationRole?.capability_tags).toEqual(expect.arrayContaining(['演示稿', 'PPT', 'PDF预览']))
    expect(presentationRole?.system_prompt).toContain('不要假设 presentation skill 的 profile 文件名')
    expect(presentationRole?.system_prompt).toContain('缺少 @oai/artifact-tool')
    expect(presentationRole?.system_prompt).toContain('继续生成可交付文档和 PPTX')
  })

  it('creates an apply-diff approval action for a valid unified diff', async () => {
    const tmpRoot = path.join(process.cwd(), '.tmp-test-workspace')
    await mkdir(tmpRoot, { recursive: true })
    setupMockClient(createPostgresChain(undefined, [{ ...mockWorkspace, cloud_project_dir: tmpRoot }]))
    const { POST } = await import('@/app/api/workspaces/[id]/diff/apply/route')
    const diff = [
      '--- a/README.md',
      '+++ b/README.md',
      '@@ -1 +1 @@',
      '-old',
      '+new',
    ].join('\n')
    const result = await callWorkspaceRoute<{ action_type: string; status: string }>(
      POST,
      'ws-001',
      { session_id: 'session-001', diff },
    )
    expect(result.status).toBe(201)
    expect(result.data.action_type).toBe('apply_diff')
    expect(result.data.status).toBe('pending')
    await rm(tmpRoot, { recursive: true, force: true })
  })

  it('rejects invalid unified diff content', async () => {
    const { POST } = await import('@/app/api/workspaces/[id]/diff/apply/route')
    const result = await callWorkspaceRoute<{ error: string }>(
      POST,
      'ws-001',
      { session_id: 'session-001', diff: 'not a diff' },
    )
    expect(result.status).toBe(400)
    expect(result.data.error).toContain('unified diff')
  })

  it('keeps diff apply approval visible in the IM transcript contract', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../app/api/workspaces/[id]/diff/apply/route.ts', import.meta.url)),
      'utf8',
    )

    expect(source).toContain("message_type: 'approval'")
    expect(source).toContain("type: 'permission'")
    expect(source).toContain("actionKind: 'apply_diff'")
    expect(source).toContain('commandPreview')
  })
})
