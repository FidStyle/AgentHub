import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  resetMockAuth,
  resetMockClient,
  setupMockAuth,
  setupMockClient,
} from '../utils'

const { resolveEndpointMock, createSessionMock, isWorkerAliveMock, enqueueMock } = vi.hoisted(() => ({
  resolveEndpointMock: vi.fn(async (_input: unknown) => ({ id: 'endpoint-001', kind: 'public_cloud', status: 'available' })),
  createSessionMock: vi.fn(async (input: { roleAgentId?: string }) => ({
    id: `runtime-${input.roleAgentId ?? 'none'}`,
    nativeSessionId: `native-${input.roleAgentId ?? 'none'}`,
    cwd: '/repo',
  })),
  isWorkerAliveMock: vi.fn(async () => true),
  enqueueMock: vi.fn(async (_input: unknown) => undefined),
}))

vi.mock('@/lib/runtime/gateway', () => ({
  resolveEndpoint: (input: unknown) => resolveEndpointMock(input),
  createSession: (input: unknown) => createSessionMock(input as { roleAgentId?: string }),
}))

vi.mock('@/lib/runtime/redis-client', () => ({
  isWorkerAlive: () => isWorkerAliveMock(),
  enqueue: (input: unknown) => enqueueMock(input),
}))

type Write = { table: string; values: Record<string, unknown>; id?: string }

async function postDynamic(
  handler: (_request: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>,
  path: string,
  body: Record<string, unknown> = {},
  id = 'mailbox-001',
) {
  const response = await handler(new Request(`http://localhost${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
  }), {
    params: Promise.resolve({ id }),
  })
  return { status: response.status, data: await response.json() }
}

async function getReady(sessionId = 'session-001') {
  const { GET } = await import('@/app/api/mailbox/ready/route')
  const url = new URL('http://localhost/api/mailbox/ready')
  if (sessionId) url.searchParams.set('session_id', sessionId)
  const response = await GET(new Request(url))
  return { status: response.status, data: await response.json() }
}

async function postDispatchReady(sessionId = 'session-001') {
  const { POST } = await import('@/app/api/mailbox/dispatch-ready/route')
  const response = await POST(new Request('http://localhost/api/mailbox/dispatch-ready', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  }))
  return { status: response.status, data: await response.json() }
}

function mailbox(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mailbox-001',
    workspace_id: 'ws-001',
    session_id: 'session-001',
    plan_id: 'plan-001',
    plan_node_id: 'node-001',
    direction: 'inbound',
    from_role_agent_id: 'agent-arch',
    to_role_agent_id: 'agent-be',
    attempt_id: 'attempt-001',
    parent_attempt_id: 'attempt-parent',
    lineage_root_id: 'attempt-root',
    runtime_type: 'codex',
    status: 'running',
    context_package: {
      fromRoleAgentId: 'agent-arch',
      fromRoleName: '架构师',
      toRoleAgentId: 'agent-be',
      toRoleName: '后端工程师',
      sessionId: 'session-001',
      summary: '实现 API',
      sourceMessageId: null,
      phase: 'worker',
      createdAt: '2026-06-02T00:00:00.000Z',
    },
    reply_to_mailbox_item_id: null,
    error: null,
    created_at: '2026-06-02T00:00:00.000Z',
    updated_at: '2026-06-02T00:00:00.000Z',
    ...overrides,
  }
}

function mailboxControlChain(options: {
  item?: Record<string, unknown> | null
  workspaceOwned?: boolean
  roles?: Record<string, unknown>[]
  sessionOwned?: boolean
  readyItems?: Record<string, unknown>[]
  nodes?: Record<string, unknown>[]
} = {}) {
  const writes: Write[] = []
  const item = options.item === undefined ? mailbox() : options.item
  const workspace = options.workspaceOwned === false ? null : { id: 'ws-001', owner_id: 'user-001', execution_domain: 'cloud' }
  const roles = options.roles ?? [
    { id: 'agent-arch', name: '架构师', runtime_type: 'claude_code', workspace_id: 'ws-001' },
    { id: 'agent-be', name: '后端工程师', runtime_type: 'codex', workspace_id: 'ws-001' },
  ]
  const session = options.sessionOwned === false ? null : { id: 'session-001', workspace_id: 'ws-001' }
  const readyItems = options.readyItems ?? []
  const nodes = options.nodes ?? [
    { id: 'node-001', plan_id: 'plan-001', label: '后端工程师执行', agent_id: 'agent-be', action_type: 'runtime_invoke', action_payload: { userMessage: '实现 API', phase: 'worker' } },
    { id: 'node-arch', plan_id: 'plan-001', label: '架构师执行', agent_id: 'agent-arch', action_type: 'runtime_invoke', action_payload: { userMessage: '规划任务', phase: 'worker' } },
  ]

  const chainFactory = vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'agent_mailbox_items') {
        return {
          select: () => ({
            eq: (field: string, value: string) => {
              if (field === 'id') return { single: () => ({ data: item, error: item ? null : { message: 'Not found' } }) }
              if (field === 'session_id') return { order: () => ({ data: readyItems, error: null }) }
              return { single: () => ({ data: null, error: { message: `Unexpected ${field}=${value}` } }) }
            },
          }),
          insert: (values: Record<string, unknown>) => {
            writes.push({ table, values })
            return { select: () => ({ single: () => ({ data: { id: 'mailbox-reply', ...values }, error: null }) }) }
          },
          update: (values: Record<string, unknown>) => ({
            eq: (_field: string, id: string) => {
              writes.push({ table, values, id })
              return { data: null, error: null }
            },
          }),
        }
      }
      if (table === 'workspaces') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ single: () => ({ data: workspace, error: workspace ? null : { message: 'Not found' } }) }),
            }),
          }),
        }
      }
      if (table === 'role_agents') {
        return {
          select: () => ({
            eq: (_field: string, roleId: string) => ({
              eq: () => {
                const role = roles.find((candidate) => candidate.id === roleId) ?? null
                return { single: () => ({ data: role, error: role ? null : { message: 'Not found' } }) }
              },
            }),
          }),
        }
      }
      if (table === 'plan_node_attempts') {
        return {
          update: (values: Record<string, unknown>) => ({
            eq: (_field: string, id: string) => {
              writes.push({ table, values, id })
              return { data: null, error: null }
            },
          }),
        }
      }
      if (table === 'plan_nodes') {
        return {
          select: () => ({
            eq: (_field: string, nodeId: string) => {
              const node = nodes.find((candidate) => candidate.id === nodeId) ?? null
              return { single: () => ({ data: node, error: node ? null : { message: 'Not found' } }) }
            },
          }),
          update: (values: Record<string, unknown>) => ({
            eq: (_field: string, id: string) => {
              writes.push({ table, values, id })
              return { data: null, error: null }
            },
          }),
        }
      }
      if (table === 'sessions') {
        return {
          select: () => ({
            eq: () => ({ single: () => ({ data: session, error: session ? null : { message: 'Not found' } }) }),
          }),
        }
      }
      return { select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }) }
    }),
  }))

  return { chainFactory, writes }
}

describe('mailbox reply, dead-letter, and ready APIs', () => {
  beforeEach(() => {
    resetMockAuth()
    resetMockClient()
    setupMockAuth()
    resolveEndpointMock.mockClear()
    createSessionMock.mockClear()
    isWorkerAliveMock.mockClear()
    enqueueMock.mockClear()
    process.env.REDIS_URL = 'redis://localhost:6379'
  })

  it('creates a durable reply item, preserves attempt lineage, and completes the inbound item', async () => {
    const { POST } = await import('@/app/api/mailbox-items/[id]/reply/route')
    const { chainFactory, writes } = mailboxControlChain()
    setupMockClient(chainFactory)

    const result = await postDynamic(POST, '/api/mailbox-items/mailbox-001/reply', { summary: 'API 已完成' })

    expect(result.status).toBe(200)
    expect(result.data.mailbox_item.id).toBe('mailbox-reply')
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'agent_mailbox_items',
        values: expect.objectContaining({
          direction: 'reply',
          from_role_agent_id: 'agent-be',
          to_role_agent_id: 'agent-arch',
          attempt_id: 'attempt-001',
          parent_attempt_id: 'attempt-parent',
          lineage_root_id: 'attempt-root',
          reply_to_mailbox_item_id: 'mailbox-001',
          status: 'completed',
        }),
      }),
      expect.objectContaining({
        table: 'agent_mailbox_items',
        values: expect.objectContaining({ status: 'completed', error: null }),
        id: 'mailbox-001',
      }),
      expect.objectContaining({
        table: 'plan_node_attempts',
        values: expect.objectContaining({ status: 'completed', error: null }),
        id: 'attempt-001',
      }),
    ]))
  })

  it('requires an explicit reply target when the original item came from orchestrator', async () => {
    const { POST } = await import('@/app/api/mailbox-items/[id]/reply/route')
    const { chainFactory } = mailboxControlChain({ item: mailbox({ from_role_agent_id: null }) })
    setupMockClient(chainFactory)

    const result = await postDynamic(POST, '/api/mailbox-items/mailbox-001/reply', { summary: '完成' })

    expect(result.status).toBe(400)
    expect(result.data).toEqual({ error: '回复目标角色必填' })
  })

  it('rejects mailbox replies outside the current user workspace', async () => {
    const { POST } = await import('@/app/api/mailbox-items/[id]/reply/route')
    const { chainFactory, writes } = mailboxControlChain({ workspaceOwned: false })
    setupMockClient(chainFactory)

    const result = await postDynamic(POST, '/api/mailbox-items/mailbox-001/reply', { summary: '完成' })

    expect(result.status).toBe(404)
    expect(result.data).toEqual({ error: 'Mailbox 项不存在或无权限' })
    expect(writes).toHaveLength(0)
  })

  it('dead-letters the mailbox item and linked attempt without deleting evidence', async () => {
    const { POST } = await import('@/app/api/mailbox-items/[id]/dead-letter/route')
    const { chainFactory, writes } = mailboxControlChain()
    setupMockClient(chainFactory)

    const result = await postDynamic(POST, '/api/mailbox-items/mailbox-001/dead-letter', { error: 'CLI 未登录' })

    expect(result.status).toBe(200)
    expect(result.data).toEqual(expect.objectContaining({ status: 'dead_letter', error: 'CLI 未登录' }))
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'agent_mailbox_items',
        values: expect.objectContaining({ status: 'dead_letter', error: 'CLI 未登录' }),
        id: 'mailbox-001',
      }),
      expect.objectContaining({
        table: 'plan_node_attempts',
        values: expect.objectContaining({ status: 'dead_letter', error: 'CLI 未登录' }),
        id: 'attempt-001',
      }),
      expect.objectContaining({
        table: 'plan_nodes',
        values: expect.objectContaining({ status: 'failed' }),
        id: 'node-001',
      }),
    ]))
  })

  it('ready endpoint selects cross-role queued work while serializing same-role inbound items', async () => {
    const { chainFactory } = mailboxControlChain({
      readyItems: [
        mailbox({ id: 'running-fe', to_role_agent_id: 'agent-fe', status: 'running', created_at: '2026-06-02T00:00:01.000Z' }),
        mailbox({ id: 'queued-fe', to_role_agent_id: 'agent-fe', status: 'queued', created_at: '2026-06-02T00:00:02.000Z' }),
        mailbox({ id: 'queued-be-1', to_role_agent_id: 'agent-be', status: 'queued', created_at: '2026-06-02T00:00:03.000Z' }),
        mailbox({ id: 'queued-be-2', to_role_agent_id: 'agent-be', status: 'queued', created_at: '2026-06-02T00:00:04.000Z' }),
        mailbox({ id: 'queued-arch', to_role_agent_id: 'agent-arch', status: 'queued', created_at: '2026-06-02T00:00:05.000Z' }),
      ],
    })
    setupMockClient(chainFactory)

    const result = await getReady()

    expect(result.status).toBe(200)
    expect(result.data.ready_items.map((item: { id: string }) => item.id)).toEqual(['queued-be-1', 'queued-arch'])
  })

  it('rejects ready mailbox reads outside the current user workspace', async () => {
    const { chainFactory } = mailboxControlChain({ workspaceOwned: false })
    setupMockClient(chainFactory)

    const result = await getReady()

    expect(result.status).toBe(404)
    expect(result.data).toEqual({ error: '会话不存在或无权限' })
  })

  it('dispatches the ready wave from durable mailbox items without creating duplicate attempts', async () => {
    const { chainFactory, writes } = mailboxControlChain({
      readyItems: [
        mailbox({ id: 'running-fe', to_role_agent_id: 'agent-fe', status: 'running', plan_node_id: 'node-fe-running', attempt_id: 'attempt-fe-running', created_at: '2026-06-02T00:00:01.000Z' }),
        mailbox({ id: 'queued-fe', to_role_agent_id: 'agent-fe', status: 'queued', plan_node_id: 'node-fe', attempt_id: 'attempt-fe', created_at: '2026-06-02T00:00:02.000Z' }),
        mailbox({ id: 'queued-be', to_role_agent_id: 'agent-be', status: 'queued', plan_node_id: 'node-001', attempt_id: 'attempt-be', created_at: '2026-06-02T00:00:03.000Z' }),
        mailbox({ id: 'queued-arch', to_role_agent_id: 'agent-arch', status: 'queued', plan_node_id: 'node-arch', attempt_id: 'attempt-arch', created_at: '2026-06-02T00:00:04.000Z' }),
      ],
    })
    setupMockClient(chainFactory)

    const result = await postDispatchReady()

    expect(result.status).toBe(200)
    expect(result.data.dispatched).toEqual([
      expect.objectContaining({ mailbox_item_id: 'queued-be', status: 'queued', runtime_session_id: 'runtime-agent-be' }),
      expect.objectContaining({ mailbox_item_id: 'queued-arch', status: 'queued', runtime_session_id: 'runtime-agent-arch' }),
    ])
    expect(enqueueMock).toHaveBeenCalledTimes(2)
    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({
      runtimeType: 'codex',
      planNodeId: 'node-001',
      runtimeSessionId: 'runtime-agent-be',
    }))
    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({
      runtimeType: 'claude_code',
      planNodeId: 'node-arch',
      runtimeSessionId: 'runtime-agent-arch',
    }))
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'agent_mailbox_items',
        values: expect.objectContaining({ status: 'running' }),
        id: 'queued-be',
      }),
      expect.objectContaining({
        table: 'plan_node_attempts',
        values: expect.objectContaining({ status: 'running', runtime_session_id: 'runtime-agent-be' }),
        id: 'attempt-be',
      }),
      expect.objectContaining({
        table: 'plan_nodes',
        values: expect.objectContaining({ status: 'running', result: expect.objectContaining({ mailboxItemId: 'queued-be' }) }),
        id: 'node-001',
      }),
    ]))
    expect(writes.some((write) => write.table === 'plan_node_attempts' && 'control' in write.values)).toBe(false)
    expect(writes.some((write) => write.table === 'agent_mailbox_items' && write.values.direction === 'inbound')).toBe(false)
  })
})
