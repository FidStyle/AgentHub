import { describe, it, expect, vi, beforeEach } from 'vitest'

// Gate the public_cloud branch: an unconfigured endpoint or a missing worker must short-circuit to
// endpoint_unavailable WITHOUT enqueueing (no hang to idle timeout). A configured endpoint with a
// live worker proceeds to enqueue + subscribe. We model these via mocks and assert enqueue counts.
const enqueueMock = vi.fn(async (..._args: unknown[]) => {})
let workerAlive = true
let endpointRow: { id: string; kind: string; status: string; device_id: string | null } | null = null
const dbUpdates: Array<Record<string, unknown>> = []

vi.mock('../../lib/runtime/redis-client', () => ({
  enqueue: (...args: unknown[]) => enqueueMock(...args),
  isWorkerAlive: async () => workerAlive,
  setCancel: async () => {},
  // available path subscribes then immediately yields a terminal so the generator returns.
  subscribeEvents: async function* (_runtimeSessionId: string, onSubscribed?: () => Promise<void>) {
    await onSubscribed?.()
    yield { type: 'runtime_completed', summary: 'done' }
  },
}))

vi.mock('../../lib/app-db-client', () => ({
  createClient: async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ limit: async () => ({ data: endpointRow ? [endpointRow] : [] }) }),
          limit: async () => ({ data: endpointRow ? [endpointRow] : [] }),
        }),
      }),
      update: (patch: Record<string, unknown>) => {
        if (table === 'runtime_sessions') dbUpdates.push(patch)
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

const cloudSession = (status: string, id: string | null): RuntimeSessionRecord => ({
  id: 'rs-1',
  endpoint: { id, kind: 'public_cloud', status: status as 'available' | 'offline' | 'unconfigured' },
})

beforeEach(() => {
  enqueueMock.mockClear()
  dbUpdates.length = 0
  workerAlive = true
  endpointRow = null
  process.env.REDIS_URL = 'redis://localhost:6379'
})

describe('gateway public_cloud gating', () => {
  it('unconfigured endpoint → endpoint_unavailable, never enqueues', async () => {
    const events = await drain(
      invoke({ userId: 'u1', runtimeSession: cloudSession('unconfigured', null), userMessage: 'hi' }),
    )
    expect(enqueueMock).toHaveBeenCalledTimes(0)
    expect(events.find((e) => e.type === 'endpoint_unavailable')).toBeDefined()
    expect(events.some((e) => e.type === 'public_runtime_available' && e.available === false)).toBe(true)
    expect(dbUpdates.some((p) => p.status === 'failed')).toBe(true)
  })

  it('configured endpoint but no live worker → endpoint_unavailable, never enqueues', async () => {
    workerAlive = false
    const events = await drain(
      invoke({ userId: 'u1', runtimeSession: cloudSession('available', 'ep-1'), userMessage: 'hi' }),
    )
    expect(enqueueMock).toHaveBeenCalledTimes(0)
    const unavailable = events.find((e) => e.type === 'endpoint_unavailable')
    expect(unavailable).toBeDefined()
    expect(String((unavailable as { reason?: string }).reason)).toContain('未就绪')
  })

  it('configured endpoint + live worker → enqueues and streams reply', async () => {
    workerAlive = true
    const events = await drain(
      invoke({ userId: 'u1', runtimeSession: cloudSession('available', 'ep-1'), userMessage: 'hi' }),
    )
    expect(enqueueMock).toHaveBeenCalledTimes(1)
    expect(events.some((e) => e.type === 'public_runtime_available' && e.available === true)).toBe(true)
    expect(events.some((e) => e.type === 'runtime_completed')).toBe(true)
  })
})
