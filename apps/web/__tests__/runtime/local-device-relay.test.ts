import { describe, expect, it, vi, beforeEach } from 'vitest'

const statusUpdates: string[] = []
const sentPayloads: Array<Record<string, unknown>> = []
const workspaceRoot = '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2'

vi.mock('../../server/device-connections', () => ({
  getConnectionByUserId: () => ({ deviceId: 'desktop-1', userId: 'u1', workspaceIds: ['w1'], lastHeartbeat: Date.now() }),
  sendRuntimeInvokeToDevice: async function* (_deviceId: string, payload: Record<string, unknown>) {
    sentPayloads.push(payload)
    yield { type: 'started', sessionId: payload.sessionId as string, timestamp: Date.now(), runtimeType: 'codex', cwd: payload.cwd as string }
    yield { type: 'text_delta', sessionId: payload.sessionId as string, timestamp: Date.now(), delta: 'real local reply' }
    yield { type: 'completed', sessionId: payload.sessionId as string, timestamp: Date.now(), exitCode: 0, summary: 'done' }
  },
}))

vi.mock('../../lib/runtime/device-channel-store', () => ({
  getChannelByDevice: async () => null,
  markChannelConnected: async () => {},
}))

vi.mock('../../lib/runtime/redis-client', () => ({
  enqueue: async () => {},
  subscribeEvents: async function* () {},
  setCancel: async () => {},
  isWorkerAlive: async () => false,
}))

vi.mock('../../lib/app-db-client', () => ({
  createClient: async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: async () => ({
              data: table === 'runtime_capabilities'
                ? [{ value: [{ type: 'codex', available: true, authenticated: true, launchable: true }] }]
                : [],
            }),
          }),
        }),
      }),
      update: (patch: { status?: string }) => {
        if (table === 'runtime_sessions' && patch.status) statusUpdates.push(patch.status)
        return { eq: () => {} }
      },
    }),
  }),
}))

import { invoke, type RuntimeSessionRecord } from '../../lib/runtime/gateway'
import type { RuntimeGatewayEvent } from '@agenthub/shared'

async function drain(gen: AsyncGenerator<RuntimeGatewayEvent>): Promise<RuntimeGatewayEvent[]> {
  const out: RuntimeGatewayEvent[] = []
  for await (const e of gen) out.push(e)
  return out
}

beforeEach(() => {
  statusUpdates.length = 0
  sentPayloads.length = 0
})

describe('gateway user_local relay', () => {
  it('forwards local_desktop runtime_invoke events into gateway SSE events', async () => {
    const runtimeSession: RuntimeSessionRecord = {
      id: 'rs-local-1',
      endpoint: { id: 'ep-local-1', kind: 'user_local', status: 'available', deviceId: 'desktop-1' },
      runtimeType: 'codex',
      cwd: workspaceRoot,
    }

    const events = await drain(invoke({
      userId: 'u1',
      runtimeSession,
      userMessage: 'hello local',
      systemPrompt: '你是架构师',
    }))

    expect(sentPayloads[0]).toMatchObject({
      sessionId: 'rs-local-1',
      runtimeType: 'codex',
      cwd: workspaceRoot,
    })
    expect(sentPayloads[0].prompt).toContain('hello local')
    expect(events.some((event) => event.type === 'tunnel_connected')).toBe(true)
    expect(events.some((event) => event.type === 'runtime_output' && event.delta === 'real local reply')).toBe(true)
    expect(events.some((event) => event.type === 'runtime_completed')).toBe(true)
    expect(statusUpdates).toContain('running')
    expect(statusUpdates).toContain('completed')
  })

  it('fails when the selected role runtime_type is not locally ready', async () => {
    const runtimeSession: RuntimeSessionRecord = {
      id: 'rs-local-2',
      endpoint: { id: 'ep-local-1', kind: 'user_local', status: 'available', deviceId: 'desktop-1' },
      runtimeType: 'claude_code',
      cwd: workspaceRoot,
    }

    const events = await drain(invoke({
      userId: 'u1',
      runtimeSession,
      userMessage: 'hello local',
      runtimeType: 'claude_code',
    }))

    expect(sentPayloads).toEqual([])
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'runtime_failed',
        error: '当前角色绑定的本地 Runtime 未登录或不可启动，无法执行本地任务。',
      }),
    ]))
    expect(statusUpdates).toContain('failed')
  })
})
