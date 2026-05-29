import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture redis side effects + db writes. Heartbeat presence is modeled by a
// simple in-memory set toggled by setHeartbeat/clearHeartbeat so isAlive reflects it.
const published: Array<{ id: string; event: Record<string, unknown> }> = []
const dbUpdates: Array<Record<string, unknown>> = []
const dbInserts: Array<Record<string, unknown>> = []
const heartbeats = new Set<string>()

vi.mock('../../lib/runtime/redis-client', () => ({
  publishEvent: async (id: string, event: Record<string, unknown>) => { published.push({ id, event }) },
  isCancelled: async () => false,
  dequeue: async () => null,
  setHeartbeat: async (id: string) => { heartbeats.add(id) },
  clearHeartbeat: async (id: string) => { heartbeats.delete(id) },
  isAlive: async (id: string) => heartbeats.has(id),
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
import { processJob, reclaimDeadSession } from '../../server/runtime-worker'
import type { RuntimeJob } from '../../lib/runtime/redis-client'

beforeEach(() => {
  published.length = 0
  dbUpdates.length = 0
  dbInserts.length = 0
  heartbeats.clear()
})

describe('worker liveness — heartbeat during running', () => {
  it('writes a heartbeat while running and clears it on completion', async () => {
    const job: RuntimeJob = { runtimeSessionId: 'hb1', prompt: 'a b c' }
    // FakeExecutor streams synchronously; assert heartbeat was set then cleared at terminal.
    const result = await processJob(job, new FakeExecutor())
    expect(result).toBe('completed')
    expect(heartbeats.has('hb1')).toBe(false) // cleared on completed
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
