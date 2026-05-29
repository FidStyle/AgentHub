import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture emitted runtime events (redis) and persisted logs (db) so we can assert on them.
const published: Array<{ id: string; event: Record<string, unknown> }> = []
const dbInserts: Array<Record<string, unknown>> = []
const dbUpdates: Array<Record<string, unknown>> = []

vi.mock('../../lib/runtime/redis-client', () => ({
  publishEvent: async (id: string, event: Record<string, unknown>) => { published.push({ id, event }) },
  isCancelled: async () => false,
  dequeue: async () => null,
}))

vi.mock('../../lib/app-db-client', () => ({
  createClient: async () => ({
    from: () => ({
      update: (patch: Record<string, unknown>) => { dbUpdates.push(patch); return { eq: () => ({ eq: () => {} }) } },
      insert: (row: Record<string, unknown>) => { dbInserts.push(row); return {} },
    }),
  }),
}))

import { CliRuntimeExecutor, ExecutorUnavailableError, FakeExecutor, type RuntimeExecutor } from '../../lib/runtime/executor'
import { processJob, createExecutor } from '../../server/runtime-worker'
import type { RuntimeJob } from '../../lib/runtime/redis-client'

const SECRET = 'sk-super-secret-token-DO-NOT-LEAK'

beforeEach(() => {
  published.length = 0
  dbInserts.length = 0
  dbUpdates.length = 0
  delete process.env.RUNTIME_EXECUTOR
  delete process.env.RUNTIME_CLI
})

describe('CliRuntimeExecutor — executor_unavailable', () => {
  it('throws ExecutorUnavailableError when the CLI binary is missing', async () => {
    // Force a guaranteed-missing binary by routing through an unknown runtime type cast.
    const exec = new CliRuntimeExecutor({ runtimeType: 'claude_code' })
    // Override the resolved binary to a name that cannot exist on PATH.
    ;(exec as unknown as { options: { runtimeType: string } }).options.runtimeType = 'codex'
    process.env.PATH = '/nonexistent-dir-for-test'
    let caught: unknown
    try {
      for await (const _ of exec.execute({ prompt: 'hi' })) void _
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ExecutorUnavailableError)
    expect((caught as ExecutorUnavailableError).code).toBe('executor_unavailable')
  })

  it('never includes injected credentials in the unavailable error message', async () => {
    process.env.PATH = '/nonexistent-dir-for-test'
    const exec = new CliRuntimeExecutor({ runtimeType: 'claude_code', env: { ANTHROPIC_API_KEY: SECRET } })
    let message = ''
    try {
      for await (const _ of exec.execute({ prompt: 'hi' })) void _
    } catch (err) {
      message = err instanceof Error ? err.message : String(err)
    }
    expect(message).not.toContain(SECRET)
  })
})

describe('processJob — FakeExecutor regression', () => {
  it('streams prompt words and completes', async () => {
    const job: RuntimeJob = { runtimeSessionId: 's1', prompt: 'hello world foo' }
    const result = await processJob(job, new FakeExecutor())
    expect(result).toBe('completed')
    const deltas = published.filter((p) => p.event.type === 'runtime_output').map((p) => p.event.delta)
    expect(deltas.join('')).toBe('hello world foo')
    expect(published.some((p) => p.event.type === 'runtime_completed')).toBe(true)
  })

  it('emits runtime_failed when the executor reports unavailable', async () => {
    const unavailable: RuntimeExecutor = {
      // eslint-disable-next-line require-yield
      async *execute() { throw new ExecutorUnavailableError('runtime CLI not found') },
    }
    const job: RuntimeJob = { runtimeSessionId: 's2', prompt: 'hi' }
    const result = await processJob(job, unavailable)
    expect(result).toBe('failed')
    const failed = published.find((p) => p.event.type === 'runtime_failed')
    expect(failed).toBeDefined()
    expect(String(failed!.event.error)).toContain('not found')
  })
})

describe('credential isolation', () => {
  it('never leaks a credential present in process.env into events or logs', async () => {
    process.env.ANTHROPIC_API_KEY = SECRET
    try {
      const job: RuntimeJob = { runtimeSessionId: 's3', prompt: 'one two three' }
      await processJob(job, new FakeExecutor())
      const serialized = JSON.stringify({ published, dbInserts, dbUpdates })
      expect(serialized).not.toContain(SECRET)
    } finally {
      delete process.env.ANTHROPIC_API_KEY
    }
  })
})

describe('createExecutor factory', () => {
  it('defaults to FakeExecutor', () => {
    expect(createExecutor()).toBeInstanceOf(FakeExecutor)
  })

  it('returns CliRuntimeExecutor when RUNTIME_EXECUTOR=real', () => {
    process.env.RUNTIME_EXECUTOR = 'real'
    expect(createExecutor()).toBeInstanceOf(CliRuntimeExecutor)
  })
})
