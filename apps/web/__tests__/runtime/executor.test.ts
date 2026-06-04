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

import { CliOutputParser, CliRuntimeExecutor, ExecutorUnavailableError, FakeExecutor, ScriptedRealExecutor, cliArgs, outputChunks, type RuntimeExecutor } from '../../lib/runtime/executor'
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
  it('builds Claude Code print commands with stream-json session evidence', () => {
    expect(cliArgs('claude_code', 'hello')).toEqual([
      '--print',
      '--verbose',
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      'hello',
    ])
    expect(cliArgs('claude_code', 'hello again', 'session-123')).toEqual([
      '--print',
      '--verbose',
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--resume',
      'session-123',
      'hello again',
    ])
  })

  it('builds Codex exec commands with skip-git-repo-check for sandbox-compatible UAT', () => {
    expect(cliArgs('codex', 'hello')).toEqual([
      'exec',
      '--json',
      '-s',
      'read-only',
      '--skip-git-repo-check',
      '--color',
      'never',
      'hello',
    ])
    expect(cliArgs('codex', 'hello again', 'thread-123')).toEqual([
      'exec',
      'resume',
      '--json',
      '--skip-git-repo-check',
      'thread-123',
      'hello again',
    ])
  })

  it('extracts Codex thread_id as native session evidence', () => {
    const chunks = outputChunks('codex', JSON.stringify({ type: 'thread.started', thread_id: 'thread-native-001' }))
    expect(chunks).toEqual([{ nativeSessionId: 'thread-native-001' }])
  })

  it('extracts Claude stream-json session and text delta evidence', () => {
    expect(outputChunks('claude_code', JSON.stringify({ type: 'system', session_id: 'claude-native-001' })))
      .toEqual([{ nativeSessionId: 'claude-native-001' }])
    expect(outputChunks('claude_code', JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: '你好' },
    }))).toEqual([{ delta: '你好' }])
    expect(outputChunks('claude_code', JSON.stringify({
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'text_delta', text: '真实流' } },
    }))).toEqual([{ delta: '真实流' }])
    expect(outputChunks('claude_code', JSON.stringify({
      type: 'result',
      session_id: 'claude-native-001',
      result: '完成',
    }))).toEqual([{ nativeSessionId: 'claude-native-001' }, { delta: '完成' }])
  })

  it('does not append Claude final result after streamed text deltas', () => {
    const parser = new CliOutputParser('claude_code')
    const lines = [
      { type: 'system', session_id: 'claude-native-001' },
      { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: '下面是 Markdown ' } } },
      { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: '的主要格式示例：\n\n' } } },
      { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: '## 标题\n' } } },
      { type: 'result', session_id: 'claude-native-001', result: '下面是 Markdown 的主要格式示例：\n\n## 标题\n' },
    ]

    const chunks = lines.flatMap((line) => parser.parseLine(JSON.stringify(line)))
    const text = chunks.map((chunk) => chunk.delta ?? '').join('')

    expect(chunks).toEqual([
      { nativeSessionId: 'claude-native-001' },
      { delta: '下面是 Markdown ' },
      { delta: '的主要格式示例：\n\n' },
      { delta: '## 标题\n' },
      { nativeSessionId: 'claude-native-001' },
    ])
    expect(text).toBe('下面是 Markdown 的主要格式示例：\n\n## 标题\n')
    expect(text.match(/下面是 Markdown/g)).toHaveLength(1)
  })

  it('uses Claude final result as fallback only when no delta was streamed', () => {
    const parser = new CliOutputParser('claude_code')

    const chunks = parser.parseLine(JSON.stringify({
      type: 'result',
      session_id: 'claude-native-001',
      result: '最终回答',
    }))

    expect(chunks).toEqual([{ nativeSessionId: 'claude-native-001' }, { delta: '最终回答' }])
  })

  it('does not append Codex completed agent message after streamed deltas', () => {
    const parser = new CliOutputParser('codex')
    const lines = [
      { type: 'thread.started', thread_id: 'codex-native-001' },
      { method: 'item/agentMessage/delta', params: { itemId: 'msg-001', delta: '下面是 Markdown ' } },
      { method: 'item/agentMessage/delta', params: { itemId: 'msg-001', delta: '的主要格式示例：\n\n' } },
      { method: 'item/agentMessage/delta', params: { itemId: 'msg-001', delta: '## 标题\n' } },
      {
        method: 'item/completed',
        params: {
          item: {
            id: 'msg-001',
            type: 'agent_message',
            phase: 'final_answer',
            text: '下面是 Markdown 的主要格式示例：\n\n## 标题\n',
          },
        },
      },
    ]

    const chunks = lines.flatMap((line) => parser.parseLine(JSON.stringify(line)))
    const text = chunks.map((chunk) => chunk.delta ?? '').join('')

    expect(chunks).toEqual([
      { nativeSessionId: 'codex-native-001' },
      { delta: '下面是 Markdown ' },
      { delta: '的主要格式示例：\n\n' },
      { delta: '## 标题\n' },
    ])
    expect(text).toBe('下面是 Markdown 的主要格式示例：\n\n## 标题\n')
    expect(text.match(/下面是 Markdown/g)).toHaveLength(1)
  })

  it('uses Codex final answer as fallback only when no delta was streamed', () => {
    const parser = new CliOutputParser('codex')

    const chunks = parser.parseLine(JSON.stringify({
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        phase: 'final_answer',
        message: '最终回答',
      },
    }))

    expect(chunks).toEqual([{ delta: '最终回答' }])
  })

  it('ignores Codex commentary agent messages as visible final output', () => {
    const parser = new CliOutputParser('codex')

    const chunks = parser.parseLine(JSON.stringify({
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        phase: 'commentary',
        message: '我先检查仓库。',
      },
    }))

    expect(chunks).toEqual([])
  })

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
  it('publishes running heartbeat events while waiting for a slow CLI first token', async () => {
    vi.useFakeTimers()
    const slow: RuntimeExecutor = {
      async *execute() {
        await new Promise((resolve) => setTimeout(resolve, 16_000))
        yield { delta: 'done' }
      },
    }
    const job: RuntimeJob = { runtimeSessionId: 's-slow', prompt: 'slow work' }
    const run = processJob(job, slow)

    await vi.advanceTimersByTimeAsync(16_000)
    const result = await run

    expect(result).toBe('completed')
    expect(published.filter((p) => p.event.type === 'runtime_status' && p.event.status === 'running').length)
      .toBeGreaterThanOrEqual(2)
    expect(published.some((p) => p.event.type === 'runtime_output' && p.event.delta === 'done')).toBe(true)
    vi.useRealTimers()
  })

  it('publishes a native_session event only when the native session id changes', async () => {
    const executor: RuntimeExecutor = {
      async *execute() {
        yield { nativeSessionId: 'native-1' }
        yield { nativeSessionId: 'native-1' }
        yield { nativeSessionId: 'native-2' }
        yield { delta: 'done' }
      },
    }
    const job: RuntimeJob = { runtimeSessionId: 's-native-dedupe', prompt: 'track native session' }

    const result = await processJob(job, executor)

    expect(result).toBe('completed')
    expect(published.filter((p) => p.event.type === 'native_session').map((p) => p.event.nativeSessionId))
      .toEqual(['native-1', 'native-2'])
  })

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
      attemptId: 'attempt-runtime-001',
      mailboxItemId: 'mailbox-runtime-001',
    }

    const result = await processJob(job, new FakeExecutor())

    expect(result).toBe('completed')
    expect(dbUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'running', runtime_session_id: 's-node', error: null }),
      expect.objectContaining({ status: 'running', error: null }),
      expect.objectContaining({ status: 'running', started_at: expect.any(String) }),
      expect.objectContaining({ status: 'completed', runtime_session_id: 's-node', error: null }),
      expect.objectContaining({ status: 'completed', error: null }),
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

  it('marks linked attempt and mailbox failed when runtime execution fails', async () => {
    const unavailable: RuntimeExecutor = {
      // eslint-disable-next-line require-yield
      async *execute() { throw new Error('native resume failed') },
    }
    const job: RuntimeJob = {
      runtimeSessionId: 's-failed-attempt',
      prompt: 'resume node',
      planNodeId: 'node-runtime-failed',
      attemptId: 'attempt-runtime-failed',
      mailboxItemId: 'mailbox-runtime-failed',
    }

    const result = await processJob(job, unavailable)

    expect(result).toBe('failed')
    expect(dbUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'failed', runtime_session_id: 's-failed-attempt', error: 'native resume failed' }),
      expect.objectContaining({ status: 'failed', error: 'native resume failed' }),
      expect.objectContaining({
        status: 'failed',
        completed_at: expect.any(String),
        result: expect.objectContaining({
          terminal: 'failed',
          runtimeSessionId: 's-failed-attempt',
          error: 'native resume failed',
        }),
      }),
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
  const workspaceRoot = '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2'

  it('rejects the real CLI executor without queued job cwd', () => {
    expect(() => createExecutor()).toThrow('RUNTIME_CWD_REQUIRED')
  })

  it('returns CliRuntimeExecutor when RUNTIME_EXECUTOR=real', () => {
    process.env.RUNTIME_EXECUTOR = 'real'
    expect(createExecutor({ runtimeSessionId: 's-real', prompt: 'hi', cwd: workspaceRoot })).toBeInstanceOf(CliRuntimeExecutor)
  })

  it('selects the real CLI executor per queued job runtimeType', () => {
    process.env.RUNTIME_EXECUTOR = 'real'
    const codex = createExecutor({ runtimeSessionId: 's-codex', prompt: 'hi', runtimeType: 'codex', cwd: workspaceRoot })
    const claude = createExecutor({ runtimeSessionId: 's-claude', prompt: 'hi', runtimeType: 'claude_code', cwd: workspaceRoot })

    expect(codex).toBeInstanceOf(CliRuntimeExecutor)
    expect(claude).toBeInstanceOf(CliRuntimeExecutor)
    expect((codex as unknown as { options: { runtimeType: string } }).options.runtimeType).toBe('codex')
    expect((claude as unknown as { options: { runtimeType: string } }).options.runtimeType).toBe('claude_code')
    expect((codex as unknown as { options: { cwd: string } }).options.cwd).toBe(workspaceRoot)
    expect((claude as unknown as { options: { cwd: string } }).options.cwd).toBe(workspaceRoot)
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
