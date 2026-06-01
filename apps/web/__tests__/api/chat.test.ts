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
  const base = createPostgresChain()
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
      roleAgents: [{ id: 'agent-001', name: 'Analyzer Agent', roleType: 'analyzer', isOrchestrator: false }],
    })
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
})
