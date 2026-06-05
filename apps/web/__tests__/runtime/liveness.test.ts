import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture redis side effects + db writes. Heartbeat presence is modeled by a
// simple in-memory set toggled by setHeartbeat/clearHeartbeat so isAlive reflects it.
const published: Array<{ id: string; event: Record<string, unknown> }> = []
const dbUpdates: Array<Record<string, unknown>> = []
const dbInserts: Array<Record<string, unknown>> = []
const heartbeats = new Set<string>()
const workerPresenceRefreshes: number[] = []

vi.mock('../../lib/runtime/redis-client', () => ({
  publishEvent: async (id: string, event: Record<string, unknown>) => { published.push({ id, event }) },
  isCancelled: async () => false,
  dequeue: async () => null,
  setHeartbeat: async (id: string) => { heartbeats.add(id) },
  clearHeartbeat: async (id: string) => { heartbeats.delete(id) },
  isAlive: async (id: string) => heartbeats.has(id),
  setWorkerAlive: async (ttlSec?: number) => { workerPresenceRefreshes.push(ttlSec ?? 0) },
  clearWorkerAlive: async () => {},
}))

vi.mock('../../lib/app-db-client', () => ({
  createClient: async () => ({
    from: () => ({
      update: (patch: Record<string, unknown>) => { dbUpdates.push(patch); return { eq: () => ({ eq: () => {} }) } },
      insert: (row: Record<string, unknown>) => { dbInserts.push(row); return {} },
    }),
  }),
}))

import { FakeExecutor } from '../../lib/runtime/executor'
import { processJob, reclaimDeadSession, startWorkerPresenceHeartbeat } from '../../server/runtime-worker'
import type { RuntimeJob } from '../../lib/runtime/redis-client'

beforeEach(() => {
  published.length = 0
  dbUpdates.length = 0
  dbInserts.length = 0
  heartbeats.clear()
  workerPresenceRefreshes.length = 0
  vi.useRealTimers()
})

describe('worker liveness — heartbeat during running', () => {
  it('writes a heartbeat while running and clears it on completion', async () => {
    const job: RuntimeJob = { runtimeSessionId: 'hb1', prompt: 'a b c' }
    // FakeExecutor streams synchronously; assert heartbeat was set then cleared at terminal.
    const result = await processJob(job, new FakeExecutor())
    expect(result).toBe('completed')
    expect(heartbeats.has('hb1')).toBe(false) // cleared on completed
  })

  it('refreshes worker presence on an interval independent of queue polling', async () => {
    vi.useFakeTimers()
    const stop = startWorkerPresenceHeartbeat({ intervalMs: 1_000, ttlSec: 5 })

    await vi.advanceTimersByTimeAsync(3_100)
    stop()

    expect(workerPresenceRefreshes).toEqual([5, 5, 5, 5])
    vi.useRealTimers()
  })
})

describe('worker liveness — stuck session reclaim', () => {
  it('reclaims a running session as failed + emits runtime_failed when heartbeat is gone', async () => {
    // No heartbeat present → worker considered dead.
    const reclaimed = await reclaimDeadSession('dead1', 'ep1')
    expect(reclaimed).toBe(true)
    expect(dbUpdates.some((p) => p.status === 'failed')).toBe(true)
    const failed = published.find((p) => p.event.type === 'runtime_failed')
    expect(failed).toBeDefined()
    expect(String(failed!.event.error)).toContain('liveness lost')
  })

  it('does not reclaim a session whose heartbeat is still alive', async () => {
    heartbeats.add('alive1')
    const reclaimed = await reclaimDeadSession('alive1', 'ep1')
    expect(reclaimed).toBe(false)
    expect(published.some((p) => p.event.type === 'runtime_failed')).toBe(false)
  })

  it('never reports completed for a dead session (no fake success)', async () => {
    await reclaimDeadSession('dead2')
    expect(published.some((p) => p.event.type === 'runtime_completed')).toBe(false)
  })
})
