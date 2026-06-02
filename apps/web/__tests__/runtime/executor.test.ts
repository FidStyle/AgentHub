import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture emitted runtime events (redis) and persisted logs (db) so we can assert on them.
const published: Array<{ id: string; event: Record<string, unknown> }> = []
const dbInserts: Array<Record<string, unknown>> = []
const dbUpdates: Array<Record<string, unknown>> = []
let planNodeRows: Array<Record<string, unknown>> = []

vi.mock('../../lib/runtime/redis-client', () => ({
  publishEvent: async (id: string, event: Record<string, unknown>) => { published.push({ id, event }) },
  isCancelled: async () => false,
  dequeue: async () => null,
  setHeartbeat: async () => {},
  clearHeartbeat: async () => {},
  setWorkerAlive: async () => {},
  clearWorkerAlive: async () => {},
  isAlive: async () => true,
}))

vi.mock('../../lib/app-db-client', () => ({
  createClient: async () => ({
    from: (table: string) => ({
      update: (patch: Record<string, unknown>) => { dbUpdates.push(patch); return { eq: () => ({ eq: () => {} }) } },
      insert: (row: Record<string, unknown>) => { dbInserts.push(row); return {} },
      select: () => ({
        eq: (field: string) => (
          field === 'id'
            ? { single: () => ({ data: { plan_id: 'plan-001' }, error: null }) }
            : {
                data: table === 'plan_nodes'
                  ? planNodeRows
                  : [{ id: 'node-default', plan_id: 'plan-001', label: 'default', status: 'completed', depends_on: [] }],
                error: null,
              }
        ),
      }),
    }),
  }),
}))

import { CliRuntimeExecutor, ExecutorUnavailableError, FakeExecutor, ScriptedRealExecutor, type RuntimeExecutor } from '../../lib/runtime/executor'
import { processJob, createExecutor } from '../../server/runtime-worker'
import type { RuntimeJob } from '../../lib/runtime/redis-client'

const SECRET = 'sk-super-secret-token-DO-NOT-LEAK'

beforeEach(() => {
  published.length = 0
  dbInserts.length = 0
  dbUpdates.length = 0
  planNodeRows = [{ id: 'node-default', plan_id: 'plan-001', label: 'default', status: 'completed', depends_on: [] }]
  delete process.env.RUNTIME_EXECUTOR
  delete process.env.RUNTIME_CLI
  delete process.env.AGENTHUB_ALLOW_TEST_EXECUTOR
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

  it('updates linked action and plan node when a queued action completes', async () => {
    const job: RuntimeJob = {
      runtimeSessionId: 's-action',
      prompt: 'do useful work',
      actionId: 'action-001',
      planNodeId: 'node-001',
    }

    const result = await processJob(job, new FakeExecutor())

    expect(result).toBe('completed')
    expect(dbUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'running', executed_at: expect.any(String) }),
      expect.objectContaining({ status: 'running', started_at: expect.any(String) }),
      expect.objectContaining({
        status: 'completed',
        result: expect.objectContaining({
          terminal: 'completed',
          runtimeSessionId: 's-action',
          output: 'do useful work',
        }),
      }),
      expect.objectContaining({
        status: 'completed',
        completed_at: expect.any(String),
        result: expect.objectContaining({
          terminal: 'completed',
          runtimeSessionId: 's-action',
        }),
      }),
    ]))
  })

  it('updates a runtime_invoke plan node even when no action row exists', async () => {
    const job: RuntimeJob = {
      runtimeSessionId: 's-node',
      prompt: 'run node',
      planNodeId: 'node-runtime-001',
    }

    const result = await processJob(job, new FakeExecutor())

    expect(result).toBe('completed')
    expect(dbUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'running', started_at: expect.any(String) }),
      expect.objectContaining({
        status: 'completed',
        completed_at: expect.any(String),
        result: expect.objectContaining({
          terminal: 'completed',
          runtimeSessionId: 's-node',
          output: 'run node',
        }),
      }),
      expect.objectContaining({ status: 'completed', updated_at: expect.any(String) }),
    ]))
  })

  it('unlocks a downstream fan-in node after the last dependency completes', async () => {
    planNodeRows = [
      { id: 'node-a', plan_id: 'plan-001', label: 'A', status: 'completed', depends_on: [] },
      { id: 'node-b', plan_id: 'plan-001', label: 'B', status: 'completed', depends_on: [] },
      { id: 'node-c', plan_id: 'plan-001', label: 'C', status: 'waiting', depends_on: ['node-a', 'node-b'] },
    ]
    const job: RuntimeJob = {
      runtimeSessionId: 's-fanin',
      prompt: 'finish node b',
      planNodeId: 'node-b',
    }

    const result = await processJob(job, new FakeExecutor())

    expect(result).toBe('completed')
    expect(dbUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'ready' }),
    ]))
    expect(dbUpdates).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'completed', updated_at: expect.any(String) }),
    ]))
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
  it('defaults to the real CLI executor', () => {
    expect(createExecutor()).toBeInstanceOf(CliRuntimeExecutor)
  })

  it('returns CliRuntimeExecutor when RUNTIME_EXECUTOR=real', () => {
    process.env.RUNTIME_EXECUTOR = 'real'
    expect(createExecutor()).toBeInstanceOf(CliRuntimeExecutor)
  })

  it('selects the real CLI executor per queued job runtimeType', () => {
    process.env.RUNTIME_EXECUTOR = 'real'
    const codex = createExecutor({ runtimeSessionId: 's-codex', prompt: 'hi', runtimeType: 'codex' })
    const claude = createExecutor({ runtimeSessionId: 's-claude', prompt: 'hi', runtimeType: 'claude_code' })

    expect(codex).toBeInstanceOf(CliRuntimeExecutor)
    expect(claude).toBeInstanceOf(CliRuntimeExecutor)
    expect((codex as unknown as { options: { runtimeType: string } }).options.runtimeType).toBe('codex')
    expect((claude as unknown as { options: { runtimeType: string } }).options.runtimeType).toBe('claude_code')
  })

  it('returns FakeExecutor only when RUNTIME_EXECUTOR=fake', () => {
    process.env.RUNTIME_EXECUTOR = 'fake'
    expect(createExecutor()).toBeInstanceOf(FakeExecutor)
  })

  it('returns ScriptedRealExecutor only when RUNTIME_EXECUTOR=script', () => {
    process.env.RUNTIME_EXECUTOR = 'script'
    expect(createExecutor()).toBeInstanceOf(ScriptedRealExecutor)
  })

  it('rejects unknown executor modes instead of silently falling back to fake', () => {
    process.env.RUNTIME_EXECUTOR = 'unknown'
    expect(() => createExecutor()).toThrow(/Unsupported RUNTIME_EXECUTOR=unknown/)
  })

  it('rejects fake/script executors outside test authorization', () => {
    try {
      vi.stubEnv('NODE_ENV', 'production')
      process.env.RUNTIME_EXECUTOR = 'fake'
      expect(() => createExecutor()).toThrow(/only allowed for tests/)
      process.env.RUNTIME_EXECUTOR = 'script'
      expect(() => createExecutor()).toThrow(/only allowed for tests/)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
