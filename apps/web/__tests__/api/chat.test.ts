/**
 * API route tests for /api/chat — role-chat-core conversation path.
 *
 * L1 business-test: chat route handler with mocked Postgres client + runtime adapter.
 * Covers role ownership validation (cross-workspace 403), system_prompt passthrough,
 * and role_agent_id persistence on the user message.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  setupMockAuth,
  resetMockAuth,
  setupMockClient,
  createPostgresChain,
  resetMockClient,
  mockWorkspaceRoot,
} from '../utils'

const invokeSpy = vi.fn()
const { resolveEndpointMock, createSessionMock, isWorkerAliveMock, enqueueMock } = vi.hoisted(() => ({
  resolveEndpointMock: vi.fn(async (_input: unknown) => ({ id: 'endpoint-001', kind: 'public_cloud', status: 'available' })),
  createSessionMock: vi.fn(async (input: { roleAgentId?: string | null; runtimeType?: string; cwd?: string | null }) => ({
    id: `runtime-${input.roleAgentId ?? input.runtimeType ?? 'none'}`,
    nativeSessionId: `native-${input.roleAgentId ?? input.runtimeType ?? 'none'}`,
    cwd: input.cwd,
  })),
  isWorkerAliveMock: vi.fn(async () => true),
  enqueueMock: vi.fn(async (_input: unknown) => undefined),
}))
const insertedMessages: Record<string, unknown>[] = []
const insertedPlans: Record<string, unknown>[] = []
const insertedPlanNodes: Record<string, unknown>[] = []
const insertedAttempts: Record<string, unknown>[] = []
const insertedMailboxItems: Record<string, unknown>[] = []
const insertedActions: Record<string, unknown>[] = []
const insertedNotifications: Record<string, unknown>[] = []
const insertedArtifacts: Record<string, unknown>[] = []
const updatedSessions: Record<string, unknown>[] = []

// Events the mocked runtime adapter emits; per-test override via setAdapterEvents.
let adapterEvents: Record<string, unknown>[] = [{ type: 'runtime_output', delta: 'ok' }]
const setAdapterEvents = (events: Record<string, unknown>[]) => {
  adapterEvents = events
}

const firstMockArg = (call: unknown[]): Record<string, unknown> => call[0] as Record<string, unknown>

function strictDeliveryActionEvidenceForNode(planNodeId: string) {
  const node = insertedPlanNodes.find((item) => item.id === planNodeId)
  const label = String(node?.label ?? '')
  if (label.includes('后端')) {
    return [
      {
        plan_node_id: planNodeId,
        action_type: 'write_file',
        status: 'completed',
        result: {
          input: {
            changed_paths: [
              `${mockWorkspaceRoot}/package.json`,
              `${mockWorkspaceRoot}/src/server.js`,
              `${mockWorkspaceRoot}/test/api.test.js`,
            ],
          },
        },
      },
    ]
  }
  if (label.includes('前端')) {
    return [
      {
        plan_node_id: planNodeId,
        action_type: 'write_file',
        status: 'completed',
        result: {
          input: {
            changed_paths: [
              `${mockWorkspaceRoot}/public/index.html`,
              `${mockWorkspaceRoot}/public/app.js`,
              `${mockWorkspaceRoot}/public/styles.css`,
            ],
          },
        },
      },
    ]
  }
  return []
}

vi.mock('@/lib/runtime/hosted-adapter', () => ({
  HostedRuntimeAdapter: class {
    async *invoke(input: Record<string, unknown>) {
      invokeSpy(input)
      for (const evt of adapterEvents) yield evt
    }
  },
}))

vi.mock('@/lib/runtime/gateway', () => ({
  resolveEndpoint: (input: unknown) => resolveEndpointMock(input),
  createSession: (input: unknown) => createSessionMock(input as { roleAgentId?: string | null; runtimeType?: string; cwd?: string | null }),
}))

vi.mock('@/lib/runtime/redis-client', () => ({
  isWorkerAlive: () => isWorkerAliveMock(),
  enqueue: (input: unknown) => enqueueMock(input),
  subscribeEvents: async function* (_runtimeSessionId: string, onSubscribed?: () => Promise<void>) {
    await onSubscribed?.()
    for (const evt of adapterEvents) yield evt
  },
}))

async function callChat(body: unknown): Promise<{ status: number; text: string }> {
  const { POST } = await import('@/app/api/chat/route')
  const req = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await POST(req as any)
  return { status: res.status, text: await res.text() }
}

function chainCapturingInserts() {
  return chainCapturingInsertsWithRoles()
}

function chainCapturingInsertsWithRoles(roleAgents?: unknown[], messages?: unknown[], sessions?: unknown[]) {
  const base = createPostgresChain(undefined, undefined, sessions, messages, roleAgents)
  return vi.fn(() => {
    const client = base()
    const origFrom = client.from
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.from = vi.fn((table: string) => {
      const t = origFrom(table)
      if (table === 'messages') {
        const origInsert = t.insert
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        t.insert = (vals: Record<string, unknown>) => {
          insertedMessages.push(vals)
          return origInsert(vals)
        }
      }
      if (table === 'sessions') {
        const origUpdate = t.update
        t.update = ((vals: Record<string, unknown>) => {
          updatedSessions.push(vals)
          if (!origUpdate) throw new Error('sessions update mock missing')
          return origUpdate(vals)
        }) as typeof t.update
      }
      return t
    })
    return client
  })
}

function chainCapturingDeployApproval(roleAgents?: unknown[]) {
  const base = createPostgresChain(undefined, undefined, undefined, undefined, roleAgents)
  return vi.fn(() => {
    const client = base()
    const origFrom = client.from
    client.from = vi.fn((table: string) => {
      const t = origFrom(table)
      if (table === 'messages') {
        const origInsert = t.insert
        t.insert = (vals: Record<string, unknown>) => {
          insertedMessages.push(vals)
          return origInsert(vals)
        }
      }
      if (table === 'actions') {
        return {
          insert: (vals: Record<string, unknown>) => {
            const row = { id: 'action-deploy-001', ...vals }
            insertedActions.push(row)
            return { select: () => ({ single: () => ({ data: row, error: null }) }) }
          },
        }
      }
      if (table === 'notifications') {
        return {
          insert: (vals: Record<string, unknown>) => {
            const row = { id: 'notification-deploy-001', ...vals }
            insertedNotifications.push(row)
            return { select: () => ({ single: () => ({ data: row, error: null }) }) }
          },
        }
      }
      if (table === 'artifacts') {
        return {
          insert: (vals: Record<string, unknown>) => {
            insertedArtifacts.push(vals)
            return { select: () => ({ single: () => ({ data: { id: 'artifact-unexpected', ...vals }, error: null }) }) }
          },
        }
      }
      return t
    })
    return client
  })
}

describe('POST /api/chat — role-chat-core', () => {
  beforeEach(() => {
    resetMockAuth()
    resetMockClient()
    invokeSpy.mockClear()
    insertedMessages.length = 0
    insertedPlans.length = 0
    insertedPlanNodes.length = 0
    insertedAttempts.length = 0
    insertedMailboxItems.length = 0
    insertedActions.length = 0
    insertedNotifications.length = 0
    insertedArtifacts.length = 0
    updatedSessions.length = 0
    resolveEndpointMock.mockClear()
    createSessionMock.mockClear()
    isWorkerAliveMock.mockClear()
    enqueueMock.mockClear()
    process.env.REDIS_URL = 'redis://test'
    setAdapterEvents([{ type: 'runtime_output', delta: 'ok' }])
    setupMockAuth()
  })

  afterEach(async () => {
    await rm(path.join(mockWorkspaceRoot, 'public'), { recursive: true, force: true })
    await rm(path.join(mockWorkspaceRoot, 'src'), { recursive: true, force: true })
    await rm(path.join(mockWorkspaceRoot, '.agenthub'), { recursive: true, force: true })
    await rm(path.join(mockWorkspaceRoot, 'package.json'), { force: true })
  })

  it('renames the default new chat from the first user message and streams the title update', async () => {
    setupMockClient(chainCapturingInsertsWithRoles(undefined, [], [
      { id: 'session-001', workspace_id: 'ws-001', name: '新聊天', status: 'active' },
    ]))

    const { status, text } = await callChat({
      sessionId: 'session-001',
      content: '做一个加减乘除的简单网站\n使用 sqlite 存储历史记录',
      roleAgentId: 'agent-001',
    })

    expect(status).toBe(200)
    expect(updatedSessions).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '做一个加减乘除的简单网站' }),
      expect.objectContaining({ last_activity_at: expect.any(String) }),
    ]))
    expect(text).toContain('"type":"session_title_updated"')
    expect(text).toContain('"title":"做一个加减乘除的简单网站"')
  })

  it('does not rename a session that already has a custom title', async () => {
    setupMockClient(createPostgresChain(undefined, undefined, [
      { id: 'session-001', workspace_id: 'ws-001', name: '已有标题', status: 'active' },
    ], []))

    const { status, text } = await callChat({
      sessionId: 'session-001',
      content: '第一句话',
      roleAgentId: 'agent-001',
    })

    expect(status).toBe(200)
    expect(updatedSessions).toHaveLength(0)
    expect(text).not.toContain('"type":"session_title_updated"')
  })

  it('AT-001 [critical]: cross-workspace roleAgentId is rejected with 403', async () => {
    setupMockClient(
      createPostgresChain(undefined, undefined, undefined, undefined, [
        { id: 'agent-other', workspace_id: 'ws-other', system_prompt: 'x' },
      ]),
    )
    const { status, text } = await callChat({
      sessionId: 'session-001',
      content: 'hi',
      roleAgentId: 'agent-other',
    })
    expect(status).toBe(403)
    expect(JSON.parse(text).error).toBe('角色不存在或无权限')
    expect(invokeSpy).not.toHaveBeenCalled()
  })

  it('AT-002 [critical]: valid role loads system_prompt and persists role_agent_id', async () => {
    setupMockClient(chainCapturingInserts())
    const { status } = await callChat({
      sessionId: 'session-001',
      content: 'hi',
      roleAgentId: 'agent-001',
      mentions: ['agent-001'],
    })
    expect(status).toBe(200)
    expect(invokeSpy).toHaveBeenCalledOnce()
    const arg = invokeSpy.mock.calls[0][0]
    expect(arg.cwd).toBe(mockWorkspaceRoot)
    expect(arg.systemPrompt).toContain('@Analyzer Agent')
    expect(arg.systemPrompt).toContain('You analyze things.')
    expect(arg.systemPrompt).toContain(`Selected workspace root: ${mockWorkspaceRoot}`)
    expect(arg.systemPrompt).toContain('Only use files visible inside the selected workspace root.')
    expect(arg.systemPrompt).toContain('Do not infer stack, package manager, AGENTS.md, Trellis, or monorepo context from the AgentHub host repository.')
    expect(arg.systemPrompt).toContain('不要调用 AskUserQuestion 或停下来询问可选项')
    expect(arg.systemPrompt).toContain('Node.js + Express + better-sqlite3 + 原生 HTML/CSS/JS')
    expect(arg.systemPrompt).toContain('node src/server.js')
    expect(arg.systemPrompt).toContain('直接启动 HTTP 服务')
    expect(arg.systemPrompt).toContain('不要调用 Claude 内部编排工具 TaskCreate、TaskUpdate、TodoWrite 或 Agent')
    expect(arg.systemPrompt).toContain('不要把 npm start、npm run dev、node server.js 或其他长驻服务作为必须保持运行的交付步骤')
    expect(arg.systemPrompt).toContain('临时验证脚本、临时 SQLite 数据库、临时日志和清理命令也必须留在 selected workspace root 内')
    expect(arg.systemPrompt).not.toContain('Next.js 15')
    expect(arg.systemPrompt).not.toContain('React 19')
    expect(arg.systemPrompt).not.toContain('Drizzle')
    expect(arg.systemPrompt).not.toContain('Postgres')
    expect(arg.systemPrompt).not.toContain('next-auth')
    expect(arg.roleAgentId).toBe('agent-001')
    const userMsg = insertedMessages[0]
    expect(userMsg.role_agent_id).toBe('agent-001')
    expect(userMsg.metadata).toEqual({
      mentions: ['agent-001'],
      roleAgents: [{ id: 'agent-001', name: 'Analyzer Agent', roleType: 'analyzer', runtimeType: 'claude_code', isOrchestrator: false }],
    })
  })

  it('includes pinned session messages in the runtime prompt and request metadata', async () => {
    setupMockClient(chainCapturingInsertsWithRoles(undefined, [
      {
        id: 'msg-pinned-001',
        session_id: 'session-001',
        sender_type: 'user',
        role_agent_id: null,
        content: '这是必须持续参考的固定上下文',
        is_pinned: true,
        created_at: '2026-06-01T00:00:00.000Z',
      },
    ]))

    const { status } = await callChat({
      sessionId: 'session-001',
      content: '继续处理',
      roleAgentId: 'agent-001',
    })

    expect(status).toBe(200)
    expect(String(invokeSpy.mock.calls[0][0].userMessage)).toContain('已固定上下文')
    expect(String(invokeSpy.mock.calls[0][0].userMessage)).toContain('这是必须持续参考的固定上下文')
    expect(insertedMessages[0].metadata).toMatchObject({
      pinnedContextMessageIds: ['msg-pinned-001'],
    })
  })

  it('AT-002a [critical]: roleAgentIds dispatches each selected role and uses role runtime_type', async () => {
    setAdapterEvents([
      { type: 'runtime_output', delta: 'done' },
      { type: 'runtime_completed' },
    ])
    setupMockClient(chainCapturingInsertsWithRoles([
      {
        id: 'agent-001',
        workspace_id: 'ws-001',
        name: 'Frontend Engineer',
        role_type: 'frontend',
        system_prompt: 'Build UI',
        capability_tags: ['ui'],
        runtime_type: 'claude_code',
        is_orchestrator: false,
      },
      {
        id: 'agent-002',
        workspace_id: 'ws-001',
        name: 'Backend Engineer',
        role_type: 'backend',
        system_prompt: 'Build API',
        capability_tags: ['api'],
        runtime_type: 'codex',
        is_orchestrator: false,
      },
    ]))
    const { status, text } = await callChat({
      sessionId: 'session-001',
      content: 'hi',
      roleAgentIds: ['agent-001', 'agent-002'],
    })
    expect(status).toBe(200)
    expect(invokeSpy).toHaveBeenCalledTimes(2)
    expect(invokeSpy.mock.calls.map((call) => call[0].roleAgentId)).toEqual(['agent-001', 'agent-002'])
    expect(invokeSpy.mock.calls.map((call) => call[0].runtimeType)).toEqual(['claude_code', 'codex'])
    expect(String(invokeSpy.mock.calls[1][0].systemPrompt)).toContain('上游角色交接上下文')
    expect(String(invokeSpy.mock.calls[1][0].systemPrompt)).toContain('@Frontend Engineer 交接给 @Backend Engineer')
    expect(String(invokeSpy.mock.calls[1][0].systemPrompt)).toContain('done')
    expect(text).toContain('"roleAgentId":"agent-001"')
    expect(text).toContain('"roleAgentId":"agent-002"')
    expect(text).not.toContain('"type":"role_acknowledgement"')
    expect(text).toContain('"type":"role_handoff"')
    expect(text).toContain('"handoffs"')
    const acknowledgementMessages = insertedMessages.filter((m) => m.message_type === 'role_acknowledgement')
    expect(acknowledgementMessages).toHaveLength(0)
    const agentMessages = insertedMessages.filter((m) => m.sender_type === 'agent' && Boolean((m.metadata as { runtimeBacked?: unknown } | null)?.runtimeBacked))
    expect(agentMessages.map((m) => m.role_agent_id)).toEqual(['agent-001', 'agent-002'])
    expect((agentMessages[1].metadata as { handoffsReceived?: unknown[] }).handoffsReceived).toEqual([
      expect.objectContaining({
        fromRoleAgentId: 'agent-001',
        fromRoleName: 'Frontend Engineer',
        toRoleAgentId: 'agent-002',
        toRoleName: 'Backend Engineer',
        summary: 'done',
      }),
    ])
    expect(insertedMessages[0].metadata).toMatchObject({
      mentions: ['agent-001', 'agent-002'],
      roleAgents: [
        { id: 'agent-001', name: 'Frontend Engineer', roleType: 'frontend', runtimeType: 'claude_code', isOrchestrator: false },
        { id: 'agent-002', name: 'Backend Engineer', roleType: 'backend', runtimeType: 'codex', isOrchestrator: false },
      ],
    })
  })

  it('creates a pending deploy approval from chat without executing or creating deployment artifacts first', async () => {
    setupMockClient(chainCapturingDeployApproval([
      {
        id: 'agent-orch',
        workspace_id: 'ws-001',
        name: '架构师',
        role_type: 'orchestrator',
        system_prompt: '负责协调',
        capability_tags: ['规划'],
        runtime_type: 'claude_code',
        is_orchestrator: true,
      },
    ]))

    const { status, text } = await callChat({
      sessionId: 'session-001',
      content: '请部署当前网站',
    })

    expect(status).toBe(200)
    expect(invokeSpy).not.toHaveBeenCalled()
    expect(enqueueMock).not.toHaveBeenCalled()
    expect(insertedActions).toEqual([
      expect.objectContaining({
        id: 'action-deploy-001',
        action_type: 'deploy',
        command: 'AgentHub 本地静态部署当前工作区',
        cwd: mockWorkspaceRoot,
        risk_level: 'high',
        status: 'pending',
        requires_approval: true,
        result: expect.objectContaining({
          source: 'chat_deploy_request',
          actionKind: 'deploy',
          workspaceRoot: mockWorkspaceRoot,
          targetPaths: [mockWorkspaceRoot],
        }),
      }),
    ])
    expect(insertedNotifications).toEqual([
      expect.objectContaining({
        type: 'approval_required',
        title: '部署需要授权',
        ref_type: 'action',
        ref_id: 'action-deploy-001',
      }),
    ])
    expect(insertedArtifacts).toHaveLength(0)
    const approvalMessage = insertedMessages.find((message) => message.message_type === 'approval')
    expect(approvalMessage).toMatchObject({
      sender_type: 'agent',
      role_agent_id: 'agent-orch',
      metadata: {
        deployment: expect.objectContaining({
          actionId: 'action-deploy-001',
          status: 'pending_approval',
          workspaceRoot: mockWorkspaceRoot,
        }),
        runtimeParts: [
          expect.objectContaining({
            type: 'permission',
            status: 'pending',
            actionId: 'action-deploy-001',
            actionKind: 'deploy',
            workspaceRoot: mockWorkspaceRoot,
            commandPreview: 'AgentHub 本地静态部署当前工作区',
          }),
        ],
      },
    })
    expect(text).toContain('"type":"approval_requested"')
    expect(text).toContain('"actionId":"action-deploy-001"')
    expect(text).not.toContain('"type":"runtime_output"')
    expect(text).not.toContain('"type":"runtime_completed"')
  })

  it('AT-002b [critical]: orchestrator plus workers creates a durable plan and runs planner/workers/summarizer', async () => {
    setAdapterEvents([
      { type: 'runtime_output', delta: 'done' },
      { type: 'runtime_completed' },
    ])
    const base = createPostgresChain(undefined, undefined, undefined, undefined, [
      {
        id: 'agent-orch',
        workspace_id: 'ws-001',
        name: '架构师',
        role_type: 'orchestrator',
        system_prompt: '负责协调',
        capability_tags: ['规划'],
        runtime_type: 'claude_code',
        is_orchestrator: true,
      },
      {
        id: 'agent-fe',
        workspace_id: 'ws-001',
        name: '前端工程师',
        role_type: 'engineer',
        system_prompt: '负责前端',
        capability_tags: ['前端'],
        runtime_type: 'claude_code',
        is_orchestrator: false,
      },
      {
        id: 'agent-be',
        workspace_id: 'ws-001',
        name: '后端工程师',
        role_type: 'engineer',
        system_prompt: '负责后端',
        capability_tags: ['后端'],
        runtime_type: 'codex',
        is_orchestrator: false,
      },
    ])
    setupMockClient(vi.fn(() => {
      const client = base()
      const origFrom = client.from
      client.from = vi.fn((table: string) => {
        if (table === 'plans') {
          return {
            insert: (vals: Record<string, unknown>) => {
              insertedPlans.push(vals)
              return { select: () => ({ single: () => ({ data: { id: 'plan-001', ...vals }, error: null }) }) }
            },
            update: () => ({ eq: () => ({ data: null, error: null }) }),
          }
        }
        if (table === 'plan_nodes') {
          return {
            insert: (vals: Record<string, unknown> | Record<string, unknown>[]) => {
              insertedPlanNodes.push(...(Array.isArray(vals) ? vals : [vals]))
              return { data: null, error: null }
            },
            update: () => ({ eq: () => ({ data: null, error: null }) }),
          }
        }
        if (table === 'plan_node_attempts') {
          return {
            insert: (vals: Record<string, unknown>) => {
              const row = { id: `attempt-${insertedAttempts.length + 1}`, ...vals }
              insertedAttempts.push(row)
              return { select: () => ({ single: () => ({ data: row, error: null }) }) }
            },
            update: (vals: Record<string, unknown>) => ({
              eq: (_field: string, id: string) => {
                const row = insertedAttempts.find((attempt) => attempt.id === id)
                if (row) Object.assign(row, vals)
                return { data: row ?? null, error: row ? null : { message: 'Not found' } }
              },
            }),
          }
        }
        if (table === 'agent_mailbox_items') {
          return {
            insert: (vals: Record<string, unknown>) => {
              const row = { id: `mailbox-${insertedMailboxItems.length + 1}`, ...vals }
              insertedMailboxItems.push(row)
              return { select: () => ({ single: () => ({ data: row, error: null }) }) }
            },
            update: (vals: Record<string, unknown>) => ({
              eq: (_field: string, id: string) => {
                const row = insertedMailboxItems.find((mailbox) => mailbox.id === id)
                if (row) Object.assign(row, vals)
                return { data: row ?? null, error: row ? null : { message: 'Not found' } }
              },
            }),
          }
        }
        if (table === 'runtime_sessions') {
          const runtimeRows = [{ id: 'runtime-latest', native_session_id: 'native-latest' }]
          const runtimeChain = {
            eq: () => runtimeChain,
            is: () => runtimeChain,
            order: () => ({ limit: () => ({ data: runtimeRows, error: null }) }),
          }
          return {
            select: () => runtimeChain,
          }
        }
        if (table === 'actions') {
          const actionChain = {
            eq: (_field: string, planNodeId: string) => ({
              order: () => ({
                data: [
                  ...insertedActions.filter((action) => action.plan_node_id === planNodeId),
                  ...strictDeliveryActionEvidenceForNode(planNodeId),
                ],
                error: null,
              }),
            }),
          }
          return {
            select: () => actionChain,
          }
        }
        if (table === 'artifacts') {
          return {
            select: () => {
              const chain = {
                eq: (_field: string, _value: string) => chain,
                limit: () => ({ data: [], error: null }),
              }
              return chain
            },
            insert: (vals: Record<string, unknown>) => {
              const row = { id: `artifact-${insertedArtifacts.length + 1}`, ...vals }
              insertedArtifacts.push(row)
              return { select: () => ({ single: () => ({ data: row, error: null }) }) }
            },
          }
        }
        const t = origFrom(table)
        if (table === 'messages') {
          const origInsert = t.insert
          t.insert = (vals: Record<string, unknown>) => {
            insertedMessages.push(vals)
            return origInsert(vals)
          }
        }
        return t
      })
      return client
    }))

    const { status, text } = await callChat({
      sessionId: 'session-001',
      content: '请前后端一起完成',
      roleAgentIds: ['agent-orch', 'agent-fe', 'agent-be'],
    })

    expect(status).toBe(200)
    expect(insertedPlans[0]).toMatchObject({ session_id: 'session-001', owner_id: 'user-001', status: 'running' })
    expect(insertedPlanNodes).toHaveLength(4)
    expect(insertedPlanNodes.map((node) => node.action_type)).toEqual(['runtime_invoke', 'runtime_invoke', 'runtime_invoke', 'runtime_invoke'])
    expect(insertedAttempts).toHaveLength(4)
    expect(insertedAttempts.every((attempt) => attempt.status === 'completed')).toBe(true)
    expect(insertedAttempts.every((attempt) => attempt.runtime_session_id === 'runtime-latest')).toBe(true)
    expect(insertedMailboxItems).toHaveLength(4)
    expect(insertedMailboxItems.every((mailbox) => mailbox.status === 'completed')).toBe(true)
    expect(insertedMailboxItems.map((mailbox) => mailbox.runtime_type)).toEqual(['claude_code', 'claude_code', 'codex', 'claude_code'])
    expect(insertedMailboxItems[0].context_package).toMatchObject({
      metadata: { planId: 'plan-001', attemptId: 'attempt-1', control: 'initial' },
    })
    expect(invokeSpy).not.toHaveBeenCalled()
    expect(createSessionMock).toHaveBeenCalledTimes(4)
    expect(createSessionMock.mock.calls.every((call) => call[0].cwd === mockWorkspaceRoot)).toBe(true)
    expect(createSessionMock.mock.calls.map((call) => call[0].roleAgentId)).toEqual(['agent-orch', 'agent-fe', 'agent-be', 'agent-orch'])
    expect(createSessionMock.mock.calls.map((call) => call[0].runtimeType)).toEqual(['claude_code', 'claude_code', 'codex', 'claude_code'])
    expect(enqueueMock).toHaveBeenCalledTimes(4)
    expect(enqueueMock.mock.calls.every((call) => firstMockArg(call).cwd === mockWorkspaceRoot)).toBe(true)
    expect(enqueueMock.mock.calls.every((call) => firstMockArg(call).suppressPlanProgress === true)).toBe(true)
    expect(insertedPlanNodes.every((node) => (node.action_payload as Record<string, unknown>).cwd === mockWorkspaceRoot)).toBe(true)
    expect(insertedPlanNodes.every((node) => (node.action_payload as Record<string, unknown>).workspaceRoot === mockWorkspaceRoot)).toBe(true)
    expect(enqueueMock.mock.calls.map((call) => firstMockArg(call).planNodeId)).toEqual(insertedPlanNodes.map((node) => node.id))
    expect(enqueueMock.mock.calls.map((call) => firstMockArg(call).attemptId)).toEqual(['attempt-1', 'attempt-2', 'attempt-3', 'attempt-4'])
    expect(enqueueMock.mock.calls.map((call) => firstMockArg(call).mailboxItemId)).toEqual(['mailbox-1', 'mailbox-2', 'mailbox-3', 'mailbox-4'])
    expect(String(firstMockArg(enqueueMock.mock.calls[1]).prompt)).toContain('Context handoffs')
    expect(String(firstMockArg(enqueueMock.mock.calls[1]).systemPrompt)).toContain(`Selected workspace root: ${mockWorkspaceRoot}`)
    expect(String(firstMockArg(enqueueMock.mock.calls[1]).systemPrompt)).toContain('Do not infer stack, package manager, AGENTS.md, Trellis, or monorepo context from the AgentHub host repository.')
    expect(String(firstMockArg(enqueueMock.mock.calls[1]).systemPrompt)).toContain('不要调用 AskUserQuestion 或停下来询问可选项')
    expect(String(firstMockArg(enqueueMock.mock.calls[1]).systemPrompt)).toContain('Node.js + Express + better-sqlite3 + 原生 HTML/CSS/JS')
    expect(String(firstMockArg(enqueueMock.mock.calls[1]).systemPrompt)).toContain('node src/server.js')
    expect(String(firstMockArg(enqueueMock.mock.calls[1]).systemPrompt)).toContain('直接启动 HTTP 服务')
    expect(String(firstMockArg(enqueueMock.mock.calls[1]).systemPrompt)).toContain('不要调用 Claude 内部编排工具 TaskCreate、TaskUpdate、TodoWrite 或 Agent')
    expect(String(firstMockArg(enqueueMock.mock.calls[1]).systemPrompt)).toContain('不要把 npm start、npm run dev、node server.js 或其他长驻服务作为必须保持运行的交付步骤')
    expect(String(firstMockArg(enqueueMock.mock.calls[1]).systemPrompt)).toContain('临时验证脚本、临时 SQLite 数据库、临时日志和清理命令也必须留在 selected workspace root 内')
    expect(String(firstMockArg(enqueueMock.mock.calls[3]).prompt)).toContain('前端工程师')
    expect(String(firstMockArg(enqueueMock.mock.calls[3]).prompt)).toContain('后端工程师')
    expect(insertedMailboxItems[1].context_package).toMatchObject({
      metadata: {
        receivedHandoffs: [
          expect.objectContaining({ fromRoleAgentId: 'agent-orch', toRoleAgentId: 'agent-fe' }),
        ],
      },
    })
    expect(insertedMailboxItems[3].context_package).toMatchObject({
      metadata: {
        receivedHandoffs: [
          expect.objectContaining({ fromRoleAgentId: 'agent-fe', toRoleAgentId: 'agent-orch' }),
          expect.objectContaining({ fromRoleAgentId: 'agent-be', toRoleAgentId: 'agent-orch' }),
        ],
      },
    })
    expect(text).toContain('orchestrator_plan_started')
    expect(text).toContain('role_process_message')
    expect(text).toContain('执行中：@前端工程师')
    expect(text).toContain('执行中：@后端工程师')
    expect(text).toContain('已完成：@前端工程师')
    expect(text).toContain('已完成：@后端工程师')
    const processMessages = insertedMessages.filter((message) => message.sender_type === 'agent' && message.metadata && (message.metadata as Record<string, unknown>).processEvent)
    expect(processMessages.map((message) => message.role_agent_id)).toEqual(expect.arrayContaining(['agent-orch', 'agent-fe', 'agent-be']))
    expect(processMessages.some((message) => String(message.content).includes('执行中：@前端工程师'))).toBe(true)
    expect(processMessages.some((message) => String(message.content).includes('执行中：@后端工程师'))).toBe(true)
    expect(processMessages.every((message) => (message.metadata as Record<string, unknown>).createdBy === 'agenthub_orchestrator')).toBe(true)
  })

  it('AT-002c [critical]: default architect engineering request expands to durable backend/frontend dispatch', async () => {
    setAdapterEvents([
      { type: 'runtime_output', delta: 'done' },
      { type: 'runtime_completed' },
    ])
    const base = createPostgresChain(undefined, undefined, undefined, undefined, [
      {
        id: 'agent-orch',
        workspace_id: 'ws-001',
        name: '架构师',
        role_type: 'orchestrator',
        system_prompt: '负责协调',
        capability_tags: ['规划'],
        runtime_type: 'claude_code',
        is_orchestrator: true,
      },
      {
        id: 'agent-fe',
        workspace_id: 'ws-001',
        name: '前端工程师',
        role_type: 'engineer',
        system_prompt: '负责前端',
        capability_tags: ['前端'],
        runtime_type: 'claude_code',
        is_orchestrator: false,
      },
      {
        id: 'agent-be',
        workspace_id: 'ws-001',
        name: '后端工程师',
        role_type: 'engineer',
        system_prompt: '负责后端',
        capability_tags: ['后端', '数据库'],
        runtime_type: 'codex',
        is_orchestrator: false,
      },
    ])
    setupMockClient(vi.fn(() => {
      const client = base()
      const origFrom = client.from
      client.from = vi.fn((table: string) => {
        if (table === 'plans') {
          return {
            insert: (vals: Record<string, unknown>) => {
              insertedPlans.push(vals)
              return { select: () => ({ single: () => ({ data: { id: 'plan-001', ...vals }, error: null }) }) }
            },
            update: () => ({ eq: () => ({ data: null, error: null }) }),
          }
        }
        if (table === 'plan_nodes') {
          return {
            insert: (vals: Record<string, unknown> | Record<string, unknown>[]) => {
              insertedPlanNodes.push(...(Array.isArray(vals) ? vals : [vals]))
              return { data: null, error: null }
            },
            update: () => ({ eq: () => ({ data: null, error: null }) }),
          }
        }
        if (table === 'plan_node_attempts') {
          return {
            insert: (vals: Record<string, unknown>) => {
              const row = { id: `attempt-${insertedAttempts.length + 1}`, ...vals }
              insertedAttempts.push(row)
              return { select: () => ({ single: () => ({ data: row, error: null }) }) }
            },
            update: (vals: Record<string, unknown>) => ({
              eq: (_field: string, id: string) => {
                const row = insertedAttempts.find((attempt) => attempt.id === id)
                if (row) Object.assign(row, vals)
                return { data: row ?? null, error: row ? null : { message: 'Not found' } }
              },
            }),
          }
        }
        if (table === 'agent_mailbox_items') {
          return {
            insert: (vals: Record<string, unknown>) => {
              const row = { id: `mailbox-${insertedMailboxItems.length + 1}`, ...vals }
              insertedMailboxItems.push(row)
              return { select: () => ({ single: () => ({ data: row, error: null }) }) }
            },
            update: (vals: Record<string, unknown>) => ({
              eq: (_field: string, id: string) => {
                const row = insertedMailboxItems.find((mailbox) => mailbox.id === id)
                if (row) Object.assign(row, vals)
                return { data: row ?? null, error: row ? null : { message: 'Not found' } }
              },
            }),
          }
        }
        if (table === 'runtime_sessions') {
          const runtimeRows = [{ id: 'runtime-latest', native_session_id: 'native-latest' }]
          const runtimeChain = {
            eq: () => runtimeChain,
            is: () => runtimeChain,
            order: () => ({ limit: () => ({ data: runtimeRows, error: null }) }),
          }
          return {
            select: () => runtimeChain,
          }
        }
        if (table === 'actions') {
          const actionChain = {
            eq: (_field: string, planNodeId: string) => ({
              order: () => ({
                data: [
                  ...insertedActions.filter((action) => action.plan_node_id === planNodeId),
                  ...strictDeliveryActionEvidenceForNode(planNodeId),
                ],
                error: null,
              }),
            }),
          }
          return {
            select: () => actionChain,
          }
        }
        if (table === 'artifacts') {
          return {
            select: () => {
              const chain = {
                eq: (_field: string, _value: string) => chain,
                limit: () => ({ data: [], error: null }),
              }
              return chain
            },
            insert: (vals: Record<string, unknown>) => {
              const row = { id: `artifact-${insertedArtifacts.length + 1}`, ...vals }
              insertedArtifacts.push(row)
              return { select: () => ({ single: () => ({ data: row, error: null }) }) }
            },
          }
        }
        const t = origFrom(table)
        if (table === 'messages') {
          const origInsert = t.insert
          t.insert = (vals: Record<string, unknown>) => {
            insertedMessages.push(vals)
            return origInsert(vals)
          }
        }
        return t
      })
      return client
    }))
    await mkdir(path.join(mockWorkspaceRoot, 'public'), { recursive: true })
    await writeFile(path.join(mockWorkspaceRoot, 'public/index.html'), '<!doctype html><title>计算器</title>', 'utf8')

    const { status, text } = await callChat({
      sessionId: 'session-001',
      content: '做一个加减乘除的简单网站，使用sqlite存储历史记录',
      permissionMode: 'full_control',
      runMarker: 'STRICT-SPD-UNIT',
    })

    expect(status).toBe(200)
    expect(invokeSpy).not.toHaveBeenCalled()
    expect(insertedPlans[0]).toMatchObject({ session_id: 'session-001', owner_id: 'user-001', status: 'running' })
    expect(insertedPlanNodes.map((node) => node.label)).toEqual(['架构师规划', '后端工程师执行', '前端工程师执行', '架构师汇总'])
    const backendNode = insertedPlanNodes.find((node) => node.label === '后端工程师执行')
    const frontendNode = insertedPlanNodes.find((node) => node.label === '前端工程师执行')
    expect((frontendNode?.depends_on as string)).toContain(String(backendNode?.id))
    expect(insertedAttempts).toHaveLength(4)
    expect(insertedAttempts.every((attempt) => attempt.status === 'completed')).toBe(true)
    expect(insertedAttempts.every((attempt) => attempt.runtime_session_id === 'runtime-latest')).toBe(true)
    expect(insertedMailboxItems.map((mailbox) => mailbox.to_role_agent_id)).toEqual(['agent-orch', 'agent-be', 'agent-fe', 'agent-orch'])
    expect(insertedMailboxItems.map((mailbox) => mailbox.runtime_type)).toEqual(['codex', 'codex', 'codex', 'codex'])
    expect(createSessionMock.mock.calls.every((call) => call[0].cwd === mockWorkspaceRoot)).toBe(true)
    expect(createSessionMock.mock.calls.map((call) => call[0].roleAgentId)).toEqual(['agent-orch', 'agent-be', 'agent-fe', 'agent-orch'])
    expect(createSessionMock.mock.calls.map((call) => call[0].runtimeType)).toEqual(['codex', 'codex', 'codex', 'codex'])
    expect(enqueueMock.mock.calls.every((call) => firstMockArg(call).cwd === mockWorkspaceRoot)).toBe(true)
    expect(enqueueMock.mock.calls.every((call) => firstMockArg(call).suppressPlanProgress === true)).toBe(true)
    expect(enqueueMock.mock.calls.map((call) => firstMockArg(call).runtimeType)).toEqual(['codex', 'codex', 'codex', 'codex'])
    expect(enqueueMock.mock.calls.map((call) => firstMockArg(call).attemptId)).toEqual(['attempt-1', 'attempt-2', 'attempt-3', 'attempt-4'])
    expect(enqueueMock.mock.calls.map((call) => firstMockArg(call).mailboxItemId)).toEqual(['mailbox-1', 'mailbox-2', 'mailbox-3', 'mailbox-4'])
    expect(insertedPlanNodes.map((node) => (node.action_payload as Record<string, unknown>).runtimeType)).toEqual(['codex', 'codex', 'codex', 'codex'])
    expect(insertedMessages[0].metadata).toMatchObject({
      mentions: ['agent-orch', 'agent-be', 'agent-fe'],
      roleAgents: [
        { id: 'agent-orch', name: '架构师', roleType: 'orchestrator', runtimeType: 'claude_code', isOrchestrator: true },
        { id: 'agent-be', name: '后端工程师', roleType: 'engineer', runtimeType: 'codex', isOrchestrator: false },
        { id: 'agent-fe', name: '前端工程师', roleType: 'engineer', runtimeType: 'claude_code', isOrchestrator: false },
      ],
      architectDispatch: {
        requestedTargets: ['role-backend', 'role-frontend'],
        selectedTargets: ['agent-be', 'agent-fe'],
      },
      permissionMode: 'full_control',
      runMarker: 'STRICT-SPD-UNIT',
      deliveryIntent: {
        mode: 'full_auto',
        requestedFinalProduct: true,
      },
    })
    const finalArtifact = insertedArtifacts.find((artifact) => artifact.source_path === 'public/index.html')
    expect(finalArtifact).toMatchObject({
      workspace_id: 'ws-001',
      session_id: 'session-001',
      source_path: 'public/index.html',
      artifact_type: 'html',
      metadata: expect.objectContaining({
        kind: 'final_product_candidate',
        runMarker: 'STRICT-SPD-UNIT',
        artifactRecommendation: expect.objectContaining({ sourcePath: 'public/index.html' }),
        artifactConfirmation: expect.objectContaining({
          source: 'full_control_product_delivery',
          sourcePath: 'public/index.html',
        }),
        designationSource: 'auto_confirmed_by_full_control_delivery',
      }),
    })
    const artifactResultMessage = insertedMessages.find((message) => (
      message.message_type === 'result_card'
      && Boolean((message.metadata as Record<string, unknown> | null)?.artifactRecommendation)
      && Boolean((message.metadata as Record<string, unknown> | null)?.artifactConfirmation)
    ))
    expect(artifactResultMessage?.content).toContain('推荐产物：public/index.html')
    expect(text).toContain('orchestrator_plan_started')
    const backendMessage = insertedMessages.find((message) => (
      message.sender_type === 'agent'
      && message.role_agent_id === 'agent-be'
      && Boolean((message.metadata as { runtimeBacked?: unknown } | null)?.runtimeBacked)
    ))
    const frontendMessage = insertedMessages.find((message) => (
      message.sender_type === 'agent'
      && message.role_agent_id === 'agent-fe'
      && Boolean((message.metadata as { runtimeBacked?: unknown } | null)?.runtimeBacked)
    ))
    const architectMessage = insertedMessages.find((message) => (
      message.sender_type === 'agent'
      && message.role_agent_id === 'agent-orch'
      && Boolean((message.metadata as { runtimeBacked?: unknown } | null)?.runtimeBacked)
      && Array.isArray((message.metadata as { handoffsReceived?: unknown[] } | null)?.handoffsReceived)
    ))
    expect(String(backendMessage?.content)).toContain('AgentHub 观察到的落地证据')
    expect(String(backendMessage?.content)).toContain('src/server.js')
    expect(String(frontendMessage?.content)).toContain('AgentHub 观察到的落地证据')
    expect(String(frontendMessage?.content)).toContain('public/index.html')
    expect(backendMessage?.metadata).toMatchObject({
      runtimeBacked: true,
      runMarker: 'STRICT-SPD-UNIT',
      attemptId: 'attempt-2',
      mailboxItemId: 'mailbox-2',
      runtimeSessionId: 'runtime-latest',
      roleName: '后端工程师',
      visibleStatus: '已完成',
    })
    expect(frontendMessage?.metadata).toMatchObject({
      runtimeBacked: true,
      runMarker: 'STRICT-SPD-UNIT',
      attemptId: 'attempt-3',
      mailboxItemId: 'mailbox-3',
      runtimeSessionId: 'runtime-latest',
      roleName: '前端工程师',
      visibleStatus: '已完成',
    })
    expect(JSON.stringify((architectMessage?.metadata as { handoffsReceived?: unknown[] } | null)?.handoffsReceived ?? [])).toContain('public/index.html')
    expect(JSON.stringify((architectMessage?.metadata as { handoffsReceived?: unknown[] } | null)?.handoffsReceived ?? [])).toContain('src/server.js')
  })

  it('recommends a runnable service artifact when no static html entry exists', async () => {
    setAdapterEvents([
      { type: 'runtime_output', delta: 'done' },
      { type: 'runtime_completed' },
    ])
    const base = chainCapturingInsertsWithRoles([
      {
        id: 'agent-orch',
        workspace_id: 'ws-001',
        name: '架构师',
        role_type: 'orchestrator',
        system_prompt: '负责协调',
        capability_tags: ['规划'],
        runtime_type: 'claude_code',
        is_orchestrator: true,
      },
      {
        id: 'agent-fe',
        workspace_id: 'ws-001',
        name: '前端工程师',
        role_type: 'engineer',
        system_prompt: '负责前端',
        capability_tags: ['前端'],
        runtime_type: 'claude_code',
        is_orchestrator: false,
      },
      {
        id: 'agent-be',
        workspace_id: 'ws-001',
        name: '后端工程师',
        role_type: 'engineer',
        system_prompt: '负责后端',
        capability_tags: ['后端', '数据库'],
        runtime_type: 'codex',
        is_orchestrator: false,
      },
    ])
    setupMockClient(vi.fn(() => {
      const client = base()
      const origFrom = client.from
      client.from = vi.fn((table: string) => {
        if (table === 'plans') {
          return {
            insert: (vals: Record<string, unknown>) => {
              insertedPlans.push(vals)
              return { select: () => ({ single: () => ({ data: { id: 'plan-001', ...vals }, error: null }) }) }
            },
            update: () => ({ eq: () => ({ data: null, error: null }) }),
          }
        }
        if (table === 'plan_nodes') {
          return {
            insert: (vals: Record<string, unknown> | Record<string, unknown>[]) => {
              insertedPlanNodes.push(...(Array.isArray(vals) ? vals : [vals]))
              return { data: null, error: null }
            },
            update: () => ({ eq: () => ({ data: null, error: null }) }),
          }
        }
        if (table === 'plan_node_attempts') {
          return {
            insert: (vals: Record<string, unknown>) => {
              const row = { id: `attempt-${insertedAttempts.length + 1}`, ...vals }
              insertedAttempts.push(row)
              return { select: () => ({ single: () => ({ data: row, error: null }) }) }
            },
            update: (vals: Record<string, unknown>) => ({
              eq: (_field: string, id: string) => {
                const row = insertedAttempts.find((attempt) => attempt.id === id)
                if (row) Object.assign(row, vals)
                return { data: row ?? null, error: row ? null : { message: 'Not found' } }
              },
            }),
          }
        }
        if (table === 'agent_mailbox_items') {
          return {
            insert: (vals: Record<string, unknown>) => {
              const row = { id: `mailbox-${insertedMailboxItems.length + 1}`, ...vals }
              insertedMailboxItems.push(row)
              return { select: () => ({ single: () => ({ data: row, error: null }) }) }
            },
            update: (vals: Record<string, unknown>) => ({
              eq: (_field: string, id: string) => {
                const row = insertedMailboxItems.find((mailbox) => mailbox.id === id)
                if (row) Object.assign(row, vals)
                return { data: row ?? null, error: row ? null : { message: 'Not found' } }
              },
            }),
          }
        }
        if (table === 'runtime_sessions') {
          const runtimeRows = [{ id: 'runtime-latest', native_session_id: 'native-latest' }]
          const runtimeChain = {
            eq: () => runtimeChain,
            is: () => runtimeChain,
            order: () => ({ limit: () => ({ data: runtimeRows, error: null }) }),
          }
          return {
            select: () => runtimeChain,
          }
        }
        if (table === 'actions') {
          const actionChain = {
            eq: (_field: string, planNodeId: string) => ({
              order: () => ({
                data: [
                  ...insertedActions.filter((action) => action.plan_node_id === planNodeId),
                  ...strictDeliveryActionEvidenceForNode(planNodeId),
                ],
                error: null,
              }),
            }),
          }
          return {
            select: () => actionChain,
          }
        }
        if (table === 'artifacts') {
          return {
            select: () => {
              const chain = {
                eq: (_field: string, _value: string) => chain,
                limit: () => ({ data: [], error: null }),
              }
              return chain
            },
            insert: (vals: Record<string, unknown>) => {
              const row = { id: `artifact-${insertedArtifacts.length + 1}`, ...vals }
              insertedArtifacts.push(row)
              return { select: () => ({ single: () => ({ data: row, error: null }) }) }
            },
          }
        }
        const t = origFrom(table)
        if (table === 'messages') {
          const origInsert = t.insert
          t.insert = (vals: Record<string, unknown>) => {
            insertedMessages.push(vals)
            return origInsert(vals)
          }
        }
        return t
      })
      return client
    }))
    await mkdir(path.join(mockWorkspaceRoot, 'src'), { recursive: true })
    await writeFile(path.join(mockWorkspaceRoot, 'src/server.js'), 'console.log("server")\n', 'utf8')
    await writeFile(path.join(mockWorkspaceRoot, 'package.json'), JSON.stringify({
      scripts: { start: 'node src/server.js' },
      dependencies: { express: '^4.18.0' },
    }), 'utf8')

    const { status } = await callChat({
      sessionId: 'session-001',
      content: '全自动做一个加减乘除的简单网站，使用sqlite存储历史记录',
      permissionMode: 'full_control',
      runMarker: 'SERVICE-SPD-UNIT',
    })

    expect(status).toBe(200)
    const finalArtifact = insertedArtifacts.find((artifact) => artifact.source_path === 'package.json')
    expect(finalArtifact).toMatchObject({
      workspace_id: 'ws-001',
      session_id: 'session-001',
      source_path: 'package.json',
      artifact_type: 'generic_file',
      title: '可运行服务产物',
      metadata: expect.objectContaining({
        kind: 'final_product_candidate',
        deliveryKind: 'runnable_service',
        publishKind: 'package_script',
        packageScript: 'start',
        startCommand: 'npm run start',
        artifactRecommendation: expect.objectContaining({ sourcePath: 'package.json' }),
        artifactConfirmation: expect.objectContaining({
          source: 'full_control_product_delivery',
          sourcePath: 'package.json',
        }),
      }),
    })
    const artifactResultMessage = insertedMessages.find((message) => (
      message.message_type === 'result_card'
      && Boolean((message.metadata as Record<string, unknown> | null)?.artifactRecommendation)
      && Boolean((message.metadata as Record<string, unknown> | null)?.artifactConfirmation)
    ))
    expect(artifactResultMessage?.content).toContain('推荐产物：package.json（npm run start）')
  })

  it('uses the architect delivery manifest as the final artifact source before fallback scanning', async () => {
    setAdapterEvents([
      { type: 'runtime_output', delta: 'done' },
      { type: 'runtime_completed' },
    ])
    const base = chainCapturingInsertsWithRoles([
      {
        id: 'agent-orch',
        workspace_id: 'ws-001',
        name: '架构师',
        role_type: 'orchestrator',
        system_prompt: '负责协调',
        capability_tags: ['规划'],
        runtime_type: 'claude_code',
        is_orchestrator: true,
      },
      {
        id: 'agent-fe',
        workspace_id: 'ws-001',
        name: '前端工程师',
        role_type: 'engineer',
        system_prompt: '负责前端',
        capability_tags: ['前端'],
        runtime_type: 'claude_code',
        is_orchestrator: false,
      },
      {
        id: 'agent-be',
        workspace_id: 'ws-001',
        name: '后端工程师',
        role_type: 'engineer',
        system_prompt: '负责后端',
        capability_tags: ['后端', '数据库'],
        runtime_type: 'codex',
        is_orchestrator: false,
      },
    ])
    setupMockClient(vi.fn(() => {
      const client = base()
      const origFrom = client.from
      client.from = vi.fn((table: string) => {
        if (table === 'plans') {
          return {
            insert: (vals: Record<string, unknown>) => {
              insertedPlans.push(vals)
              return { select: () => ({ single: () => ({ data: { id: 'plan-001', ...vals }, error: null }) }) }
            },
            update: () => ({ eq: () => ({ data: null, error: null }) }),
          }
        }
        if (table === 'plan_nodes') {
          return {
            insert: (vals: Record<string, unknown> | Record<string, unknown>[]) => {
              insertedPlanNodes.push(...(Array.isArray(vals) ? vals : [vals]))
              return { data: null, error: null }
            },
            update: () => ({ eq: () => ({ data: null, error: null }) }),
          }
        }
        if (table === 'plan_node_attempts') {
          return {
            insert: (vals: Record<string, unknown>) => {
              const row = { id: `attempt-${insertedAttempts.length + 1}`, ...vals }
              insertedAttempts.push(row)
              return { select: () => ({ single: () => ({ data: row, error: null }) }) }
            },
            update: (vals: Record<string, unknown>) => ({
              eq: (_field: string, id: string) => {
                const row = insertedAttempts.find((attempt) => attempt.id === id)
                if (row) Object.assign(row, vals)
                return { data: row ?? null, error: row ? null : { message: 'Not found' } }
              },
            }),
          }
        }
        if (table === 'agent_mailbox_items') {
          return {
            insert: (vals: Record<string, unknown>) => {
              const row = { id: `mailbox-${insertedMailboxItems.length + 1}`, ...vals }
              insertedMailboxItems.push(row)
              return { select: () => ({ single: () => ({ data: row, error: null }) }) }
            },
            update: (vals: Record<string, unknown>) => ({
              eq: (_field: string, id: string) => {
                const row = insertedMailboxItems.find((mailbox) => mailbox.id === id)
                if (row) Object.assign(row, vals)
                return { data: row ?? null, error: row ? null : { message: 'Not found' } }
              },
            }),
          }
        }
        if (table === 'runtime_sessions') {
          const runtimeRows = [{ id: 'runtime-latest', native_session_id: 'native-latest' }]
          const runtimeChain = {
            eq: () => runtimeChain,
            is: () => runtimeChain,
            order: () => ({ limit: () => ({ data: runtimeRows, error: null }) }),
          }
          return {
            select: () => runtimeChain,
          }
        }
        if (table === 'actions') {
          const actionChain = {
            eq: (_field: string, planNodeId: string) => ({
              order: () => ({
                data: [
                  ...insertedActions.filter((action) => action.plan_node_id === planNodeId),
                  ...strictDeliveryActionEvidenceForNode(planNodeId),
                ],
                error: null,
              }),
            }),
          }
          return {
            select: () => actionChain,
          }
        }
        if (table === 'artifacts') {
          return {
            select: () => {
              const chain = {
                eq: (_field: string, _value: string) => chain,
                limit: () => ({ data: [], error: null }),
              }
              return chain
            },
            insert: (vals: Record<string, unknown>) => {
              const row = { id: `artifact-${insertedArtifacts.length + 1}`, ...vals }
              insertedArtifacts.push(row)
              return { select: () => ({ single: () => ({ data: row, error: null }) }) }
            },
          }
        }
        const t = origFrom(table)
        if (table === 'messages') {
          const origInsert = t.insert
          t.insert = (vals: Record<string, unknown>) => {
            insertedMessages.push(vals)
            return origInsert(vals)
          }
        }
        return t
      })
      return client
    }))
    await mkdir(path.join(mockWorkspaceRoot, '.agenthub'), { recursive: true })
    await writeFile(path.join(mockWorkspaceRoot, 'package.json'), JSON.stringify({ scripts: { start: 'node src/server.js' } }), 'utf8')
    await writeFile(path.join(mockWorkspaceRoot, '.agenthub/start.sh'), 'PORT="${PORT:-3000}"\nnpm run start -- --port "$PORT"\n', 'utf8')
    await writeFile(path.join(mockWorkspaceRoot, '.agenthub/delivery.json'), JSON.stringify({
      title: '姓名生成服务',
      source_path: 'package.json',
      artifact_type: 'generic_file',
      start_command: 'bash .agenthub/start.sh',
      description: '架构师选择 package.json + .agenthub/start.sh 作为最终可运行服务产物。',
    }), 'utf8')

    const { status } = await callChat({
      sessionId: 'session-001',
      content: '全自动做一个加减乘除的简单网站，使用sqlite存储历史记录',
      permissionMode: 'full_control',
      runMarker: 'MANIFEST-SPD-UNIT',
    })

    expect(status).toBe(200)
    const finalArtifact = insertedArtifacts.find((artifact) => artifact.source_path === 'package.json')
    expect(finalArtifact).toMatchObject({
      title: '姓名生成服务',
      metadata: expect.objectContaining({
        source: 'delivery_manifest',
        deliveryKind: 'architect_selected',
        publishKind: 'agent_start_script',
        startCommand: 'bash .agenthub/start.sh',
        manifestPath: '.agenthub/delivery.json',
      }),
    })
    const artifactResultMessage = insertedMessages.find((message) => (
      message.message_type === 'result_card'
      && Boolean((message.metadata as Record<string, unknown> | null)?.artifactRecommendation)
      && Boolean((message.metadata as Record<string, unknown> | null)?.artifactConfirmation)
    ))
    expect(artifactResultMessage?.content).toContain('推荐产物：package.json（bash .agenthub/start.sh）')
  })

  it('AT-003 [high]: no roleAgentId uses the default orchestrator role instead of appending @ text', async () => {
    setupMockClient(chainCapturingInserts())
    const { status } = await callChat({ sessionId: 'session-001', content: 'hi' })
    expect(status).toBe(200)
    expect(invokeSpy).toHaveBeenCalledOnce()
    const arg = invokeSpy.mock.calls[0][0]
    expect(arg.systemPrompt).toContain('@Analyzer Agent')
    expect(arg.roleAgentId).toBe('agent-001')
    expect(insertedMessages[0].content).toBe('hi')
    expect(insertedMessages[0].content).not.toContain('权限预设')
    expect(insertedMessages[0].role_agent_id).toBe('agent-001')
  })

  it('AT-004 [high]: missing sessionId or content returns 400', async () => {
    setupMockClient(createPostgresChain())
    const { status } = await callChat({ content: 'hi' })
    expect(status).toBe(400)
  })

  it('AT-005 [critical]: clean completion persists the agent reply (sender_type=agent)', async () => {
    setAdapterEvents([
      { type: 'runtime_output', delta: 'hello ' },
      { type: 'runtime_output', delta: 'world' },
      { type: 'runtime_completed' },
    ])
    setupMockClient(chainCapturingInserts())
    const { status } = await callChat({
      sessionId: 'session-001',
      content: 'hi',
      roleAgentId: 'agent-001',
    })
    expect(status).toBe(200)
    const agentMsg = insertedMessages.find((m) => m.sender_type === 'agent' && Boolean((m.metadata as { runtimeBacked?: unknown } | null)?.runtimeBacked))
    expect(agentMsg).toBeDefined()
    expect(agentMsg!.content).toBe('hello world')
    expect(agentMsg!.role_agent_id).toBe('agent-001')
  })

  it('preserves Markdown newlines, code fences, and table rows through SSE and persistence', async () => {
    const markdownChunks = [
      [
        '# 一级标题',
        '',
        '> 引用段落',
        '',
        '- 第一项',
        '- [x] 已完成',
        '- [ ] 未完成',
        '',
        '',
      ].join('\n'),
      [
        '```javascript',
        'function hello() {',
        '  console.log("Hello")',
        '}',
        '```',
        '',
        '',
      ].join('\n'),
      [
        '| 列1 | 列2 |',
        '|------|------|',
        '| 单元格 | 单元格 |',
        '',
        '---',
        '',
        '行内公式 $E = mc^2$',
        '',
        '$$',
        '\\int_0^1 x^2 dx',
        '$$',
      ].join('\n'),
    ]
    const markdown = markdownChunks.join('')

    setAdapterEvents([
      ...markdownChunks.map((delta, index) => ({ type: 'runtime_output', delta, mode: 'append', seq: index + 1 })),
      { type: 'runtime_output', delta: markdownChunks[0], mode: 'append', seq: 1 },
      { type: 'runtime_completed' },
    ])
    setupMockClient(chainCapturingInserts())

    const { status, text } = await callChat({
      sessionId: 'session-001',
      content: 'hi',
      roleAgentId: 'agent-001',
    })

    expect(status).toBe(200)
    for (const chunk of markdownChunks) {
      expect(text).toContain(JSON.stringify(chunk).slice(1, -1))
    }
    const agentMsg = insertedMessages.find((m) => m.sender_type === 'agent' && Boolean((m.metadata as { runtimeBacked?: unknown } | null)?.runtimeBacked))
    expect(agentMsg?.content).toBe(markdown)
    expect(String(agentMsg?.content).match(/# 一级标题/g)).toHaveLength(1)
    expect(String(agentMsg?.content)).toContain('- [x] 已完成')
    expect(String(agentMsg?.content)).toContain('```javascript\nfunction hello()')
    expect(String(agentMsg?.content)).toContain('| 单元格 | 单元格 |')
    expect(String(agentMsg?.content)).toContain('行内公式 $E = mc^2$')
    expect(String(agentMsg?.content)).toContain('$$\n\\int_0^1 x^2 dx\n$$')
  })

  it('keeps a single runtime_output markdown snapshot byte-for-byte', async () => {
    const markdown = [
      '# 一级标题',
      '',
      '## 二级标题',
      '',
      '- 第一项',
      '- 第二项',
      '',
      '```javascript',
      'function hello() {',
      '  console.log("Hello")',
      '}',
      '```',
      '',
      '| 列1 | 列2 |',
      '|------|------|',
      '| 单元格 | 单元格 |',
    ].join('\n')

    setAdapterEvents([
      { type: 'runtime_output', delta: markdown, mode: 'append', seq: 1 },
      { type: 'runtime_completed' },
    ])
    setupMockClient(chainCapturingInserts())

    const { status, text } = await callChat({
      sessionId: 'session-001',
      content: 'hi',
      roleAgentId: 'agent-001',
    })

    expect(status).toBe(200)
    expect(text).toContain(JSON.stringify(markdown).slice(1, -1))
    const agentMsg = insertedMessages.find((m) => m.sender_type === 'agent' && Boolean((m.metadata as { runtimeBacked?: unknown } | null)?.runtimeBacked))
    expect(agentMsg?.content).toBe(markdown)
  })

  it('AT-006 [critical]: no runtime_completed → agent reply is NOT persisted (no fake success)', async () => {
    setAdapterEvents([{ type: 'runtime_output', delta: 'partial' }])
    setupMockClient(chainCapturingInserts())
    const { status } = await callChat({ sessionId: 'session-001', content: 'hi' })
    expect(status).toBe(200)
    expect(insertedMessages.some((m) => m.sender_type === 'agent' && Boolean((m.metadata as { runtimeBacked?: unknown } | null)?.runtimeBacked))).toBe(false)
  })

  it('persists a runtime question part even when execution stops to wait for user input', async () => {
    setAdapterEvents([
      { type: 'question', questionId: 'toolu-question-1', title: '实现范围', content: '实现范围：请选择历史记录保存方式' },
      { type: 'runtime_waiting', reason: 'Runtime 等待用户补充确认，未继续执行。', waitingFor: 'question' },
    ])
    setupMockClient(chainCapturingInserts())
    const { status, text } = await callChat({ sessionId: 'session-001', content: 'hi', roleAgentId: 'agent-001' })
    expect(status).toBe(200)
    expect(text).toContain('question')
    const agentMsg = insertedMessages.find((m) => m.sender_type === 'agent' && Boolean((m.metadata as { runtimeBacked?: unknown } | null)?.runtimeBacked))
    expect(agentMsg).toBeDefined()
    expect(agentMsg?.content).toBe('')
    expect(agentMsg?.role_agent_id).toBe('agent-001')
    expect(agentMsg?.metadata).toMatchObject({
      runtimeBacked: true,
      visibleStatus: '等待授权',
    })
    const parts = ((agentMsg!.metadata as { runtimeParts?: unknown[] }).runtimeParts ?? [])
    expect(parts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'question',
        questionId: 'toolu-question-1',
        title: '实现范围',
        content: '实现范围：请选择历史记录保存方式',
      }),
    ]))
  })

  it('AT-007 [high]: runtime tool/permission/diff/artifact events persist as message parts', async () => {
    setAdapterEvents([
      { type: 'tool_started', toolCallId: 'tool-1', toolName: 'shell', input: { command: 'pnpm test' } },
      { type: 'tool_delta', toolCallId: 'tool-1', delta: 'running' },
      { type: 'tool_completed', toolCallId: 'tool-1', toolName: 'shell', result: { ok: true } },
      { type: 'approval_requested', actionId: 'action-1', description: '运行高风险命令', riskLevel: 'high' },
      { type: 'approval_auto_approved', actionId: 'action-auto-1', title: 'Runtime 工具已自动通过', description: '按 full-control 自动执行', riskLevel: 'medium', actionKind: 'write_file', permissionMode: 'full_control' },
      { type: 'runtime_observed_action', actionId: 'action-observed-1', status: 'completed', actionKind: 'shell_command', commandPreview: 'npm test', autoApproved: true, permissionMode: 'full_control' },
      { type: 'diff_created', path: 'app.ts', diff: 'diff --git a/app.ts b/app.ts' },
      { type: 'artifact_created', artifactId: 'artifact-1', artifactType: 'markdown', title: '报告', sourcePath: 'report.md' },
      { type: 'runtime_completed' },
    ])
    setupMockClient(chainCapturingInserts())
    const { status, text } = await callChat({ sessionId: 'session-001', content: 'hi', roleAgentId: 'agent-001' })
    expect(status).toBe(200)
    expect(text).toContain('tool_started')
    const agentMsg = insertedMessages.find((m) => m.sender_type === 'agent' && Boolean((m.metadata as { runtimeBacked?: unknown } | null)?.runtimeBacked))
    expect(agentMsg).toBeDefined()
    const parts = ((agentMsg!.metadata as { runtimeParts?: unknown[] }).runtimeParts ?? [])
    expect(parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'tool', status: 'completed', toolName: 'shell' }),
      expect.objectContaining({ type: 'permission', actionId: 'action-1', riskLevel: 'high' }),
      expect.objectContaining({ type: 'permission', actionId: 'action-auto-1', status: 'completed', autoApproved: true, permissionMode: 'full_control' }),
      expect.objectContaining({ type: 'permission', actionId: 'action-observed-1', status: 'completed', autoApproved: true, commandPreview: 'npm test' }),
      expect.objectContaining({ type: 'diff', path: 'app.ts' }),
      expect.objectContaining({ type: 'artifact', artifactId: 'artifact-1', artifactType: 'markdown' }),
    ]))
  })
})
