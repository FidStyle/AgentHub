/**
 * API route tests for /api/chat — role-chat-core conversation path.
 *
 * L1 business-test: chat route handler with mocked Postgres client + runtime adapter.
 * Covers role ownership validation (cross-workspace 403), system_prompt passthrough,
 * and role_agent_id persistence on the user message.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  setupMockAuth,
  resetMockAuth,
  setupMockClient,
  createPostgresChain,
  resetMockClient,
} from '../utils'

const invokeSpy = vi.fn()
const insertedMessages: Record<string, unknown>[] = []
const insertedPlans: Record<string, unknown>[] = []
const insertedPlanNodes: Record<string, unknown>[] = []

// Events the mocked runtime adapter emits; per-test override via setAdapterEvents.
let adapterEvents: Record<string, unknown>[] = [{ type: 'runtime_output', delta: 'ok' }]
const setAdapterEvents = (events: Record<string, unknown>[]) => {
  adapterEvents = events
}

vi.mock('@/lib/runtime/hosted-adapter', () => ({
  HostedRuntimeAdapter: class {
    async *invoke(input: Record<string, unknown>) {
      invokeSpy(input)
      for (const evt of adapterEvents) yield evt
    }
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

function chainCapturingInsertsWithRoles(roleAgents?: unknown[]) {
  const base = createPostgresChain(undefined, undefined, undefined, undefined, roleAgents)
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
    setAdapterEvents([{ type: 'runtime_output', delta: 'ok' }])
    setupMockAuth()
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
    expect(arg.systemPrompt).toContain('@Analyzer Agent')
    expect(arg.systemPrompt).toContain('You analyze things.')
    expect(arg.roleAgentId).toBe('agent-001')
    const userMsg = insertedMessages[0]
    expect(userMsg.role_agent_id).toBe('agent-001')
    expect(userMsg.metadata).toEqual({
      mentions: ['agent-001'],
      roleAgents: [{ id: 'agent-001', name: 'Analyzer Agent', roleType: 'analyzer', runtimeType: 'claude_code', isOrchestrator: false }],
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
        capabilities: ['ui'],
        runtime_type: 'claude_code',
        is_orchestrator: false,
      },
      {
        id: 'agent-002',
        workspace_id: 'ws-001',
        name: 'Backend Engineer',
        role_type: 'backend',
        system_prompt: 'Build API',
        capabilities: ['api'],
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
    expect(text).toContain('"type":"role_handoff"')
    expect(text).toContain('"handoffs"')
    const agentMessages = insertedMessages.filter((m) => m.sender_type === 'agent')
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
        capabilities: ['规划'],
        runtime_type: 'claude_code',
        is_orchestrator: true,
      },
      {
        id: 'agent-fe',
        workspace_id: 'ws-001',
        name: '前端工程师',
        role_type: 'engineer',
        system_prompt: '负责前端',
        capabilities: ['前端'],
        runtime_type: 'claude_code',
        is_orchestrator: false,
      },
      {
        id: 'agent-be',
        workspace_id: 'ws-001',
        name: '后端工程师',
        role_type: 'engineer',
        system_prompt: '负责后端',
        capabilities: ['后端'],
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
    expect(invokeSpy).toHaveBeenCalledTimes(4)
    expect(invokeSpy.mock.calls.map((call) => call[0].roleAgentId)).toEqual(['agent-orch', 'agent-fe', 'agent-be', 'agent-orch'])
    expect(invokeSpy.mock.calls.map((call) => call[0].runtimeType)).toEqual(['claude_code', 'claude_code', 'codex', 'claude_code'])
    expect(String(invokeSpy.mock.calls[1][0].systemPrompt)).toContain('上游角色交接上下文')
    expect(String(invokeSpy.mock.calls[3][0].systemPrompt)).toContain('@前端工程师 交接给 @架构师')
    expect(String(invokeSpy.mock.calls[3][0].systemPrompt)).toContain('@后端工程师 交接给 @架构师')
    expect(text).toContain('orchestrator_plan_started')
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
    const agentMsg = insertedMessages.find((m) => m.sender_type === 'agent')
    expect(agentMsg).toBeDefined()
    expect(agentMsg!.content).toBe('hello world')
    expect(agentMsg!.role_agent_id).toBe('agent-001')
  })

  it('AT-006 [critical]: no runtime_completed → agent reply is NOT persisted (no fake success)', async () => {
    setAdapterEvents([{ type: 'runtime_output', delta: 'partial' }])
    setupMockClient(chainCapturingInserts())
    const { status } = await callChat({ sessionId: 'session-001', content: 'hi' })
    expect(status).toBe(200)
    expect(insertedMessages.some((m) => m.sender_type === 'agent')).toBe(false)
  })

  it('AT-007 [high]: runtime tool/permission/diff/artifact events persist as message parts', async () => {
    setAdapterEvents([
      { type: 'tool_started', toolCallId: 'tool-1', toolName: 'shell', input: { command: 'pnpm test' } },
      { type: 'tool_delta', toolCallId: 'tool-1', delta: 'running' },
      { type: 'tool_completed', toolCallId: 'tool-1', toolName: 'shell', result: { ok: true } },
      { type: 'approval_requested', actionId: 'action-1', description: '运行高风险命令', riskLevel: 'high' },
      { type: 'diff_created', path: 'app.ts', diff: 'diff --git a/app.ts b/app.ts' },
      { type: 'artifact_created', artifactId: 'artifact-1', artifactType: 'markdown', title: '报告', sourcePath: 'report.md' },
      { type: 'runtime_completed' },
    ])
    setupMockClient(chainCapturingInserts())
    const { status, text } = await callChat({ sessionId: 'session-001', content: 'hi', roleAgentId: 'agent-001' })
    expect(status).toBe(200)
    expect(text).toContain('tool_started')
    const agentMsg = insertedMessages.find((m) => m.sender_type === 'agent')
    expect(agentMsg).toBeDefined()
    const parts = ((agentMsg!.metadata as { runtimeParts?: unknown[] }).runtimeParts ?? [])
    expect(parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'tool', status: 'completed', toolName: 'shell' }),
      expect.objectContaining({ type: 'permission', actionId: 'action-1', riskLevel: 'high' }),
      expect.objectContaining({ type: 'diff', path: 'app.ts' }),
      expect.objectContaining({ type: 'artifact', artifactId: 'artifact-1', artifactType: 'markdown' }),
    ]))
  })
})
