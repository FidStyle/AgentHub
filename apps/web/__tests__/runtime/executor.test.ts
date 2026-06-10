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
      update: (patch: Record<string, unknown>) => {
        const update = { table, where: [] as Array<[string, unknown]>, ...patch }
        dbUpdates.push(update)
        const chain = {
          eq: (field: string, value: unknown) => {
            update.where.push([field, value])
            return chain
          },
        }
        return chain
      },
      insert: (row: Record<string, unknown>) => {
        dbInserts.push({ table, row })
        if (table === 'actions') {
          return { select: () => ({ single: () => ({ data: { id: 'action-runtime-approval', ...row }, error: null }) }) }
        }
        return {}
      },
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
import { redactString } from '../../lib/runtime/redact'
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
  delete process.env.RUNTIME_JOB_TIMEOUT_MS
  delete process.env.RUNTIME_OUTPUT_IDLE_TIMEOUT_MS
})

describe('CliRuntimeExecutor — executor_unavailable', () => {
  it('redacts credential-shaped text from runtime diagnostics', () => {
    expect(redactString(`stderr contains ${SECRET}`)).toBe('stderr contains [REDACTED]')
  })

  it('builds Claude Code print commands with stream-json session evidence', () => {
    expect(cliArgs('claude_code', 'hello')).toEqual([
      '--print',
      '--verbose',
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--permission-mode',
      'default',
      'hello',
    ])
    expect(cliArgs('claude_code', 'hello again', 'session-123')).toEqual([
      '--print',
      '--verbose',
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--permission-mode',
      'default',
      '--resume',
      'session-123',
      'hello again',
    ])
    expect(cliArgs('claude_code', 'hello', null, '/workspace', 'full_control')).toEqual([
      '--print',
      '--verbose',
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--permission-mode',
      'bypassPermissions',
      'hello',
    ])
    expect(cliArgs('claude_code', 'hello again', 'session-123', undefined, 'auto')).toEqual([
      '--print',
      '--verbose',
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--permission-mode',
      'default',
      '--resume',
      'session-123',
      'hello again',
    ])
  })

  it('builds Codex exec commands with skip-git-repo-check for sandbox-compatible UAT', () => {
    expect(cliArgs('codex', 'hello')).toEqual([
      '-a',
      'on-request',
      'exec',
      '--json',
      '-s',
      'workspace-write',
      '--skip-git-repo-check',
      '--color',
      'never',
      'hello',
    ])
    expect(cliArgs('codex', 'hello', null, '/workspace')).toEqual([
      '-a',
      'on-request',
      'exec',
      '--json',
      '-s',
      'workspace-write',
      '--skip-git-repo-check',
      '--color',
      'never',
      '-C',
      '/workspace',
      'hello',
    ])
    expect(cliArgs('codex', 'hello again', 'thread-123')).toEqual([
      '-a',
      'on-request',
      'exec',
      'resume',
      '--json',
      '--skip-git-repo-check',
      'thread-123',
      'hello again',
    ])
    expect(cliArgs('codex', 'hello', null, '/workspace', 'sandbox')).toEqual([
      '-a',
      'on-request',
      'exec',
      '--json',
      '-s',
      'read-only',
      '--skip-git-repo-check',
      '--color',
      'never',
      '-C',
      '/workspace',
      'hello',
    ])
    expect(cliArgs('codex', 'hello', null, '/workspace', 'standard')).toEqual([
      '-a',
      'on-request',
      'exec',
      '--json',
      '-s',
      'workspace-write',
      '--skip-git-repo-check',
      '--color',
      'never',
      '-C',
      '/workspace',
      'hello',
    ])
    expect(cliArgs('codex', 'hello', null, '/workspace', 'auto')).toEqual([
      '-a',
      'on-request',
      'exec',
      '--json',
      '-s',
      'workspace-write',
      '--skip-git-repo-check',
      '--color',
      'never',
      '-C',
      '/workspace',
      'hello',
    ])
    expect(cliArgs('codex', 'hello', null, '/workspace', 'full_control')).toEqual([
      '-a',
      'never',
      'exec',
      '--json',
      '-s',
      'workspace-write',
      '--skip-git-repo-check',
      '--color',
      'never',
      '-C',
      '/workspace',
      'hello',
    ])
    expect(cliArgs('codex', 'hello again', 'thread-123', undefined, 'full_control')).toEqual([
      '-a',
      'never',
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

  it('extracts Codex command and file-change events as observed automatic actions', () => {
    const command = outputChunks('codex', JSON.stringify({
      type: 'item.completed',
      item: {
        id: 'cmd-1',
        type: 'command_execution',
        command: '/bin/zsh -lc "npm install"',
        aggregated_output: 'ok',
        exit_code: 0,
      },
    }))
    expect(command).toEqual([{
      observedAction: expect.objectContaining({
        id: 'cmd-1',
        toolName: 'command_execution',
        actionKind: 'install_dependency',
        status: 'completed',
        commandPreview: '/bin/zsh -lc "npm install"',
      }),
    }])

    const fileChange = outputChunks('codex', JSON.stringify({
      type: 'item.completed',
      item: {
        id: 'file-1',
        type: 'file_change',
        changes: [{ path: '/workspace/public/index.html', kind: 'add' }],
      },
    }))
    expect(fileChange).toEqual([{
      observedAction: expect.objectContaining({
        id: 'file-1',
        toolName: 'file_change',
        actionKind: 'write_file',
        status: 'completed',
        targetPaths: ['/workspace/public/index.html'],
      }),
    }])
  })

  it('extracts Claude tool_use blocks as native tool permission requests', () => {
    const chunks = outputChunks('claude_code', JSON.stringify({
      type: 'content_block_start',
      content_block: {
        type: 'tool_use',
        id: 'toolu-write-1',
        name: 'Write',
        input: { file_path: '/workspace/src/App.tsx', content: 'hello' },
      },
    }))

    expect(chunks).toEqual([
      {
        toolRequest: expect.objectContaining({
          id: 'toolu-write-1',
          toolName: 'Write',
          actionKind: 'write_file',
          targetPaths: ['/workspace/src/App.tsx'],
        }),
      },
    ])
  })

  it('extracts Claude Read tool_use blocks as read_file requests without falling back to shell_command', () => {
    const chunks = outputChunks('claude_code', JSON.stringify({
      type: 'content_block_start',
      content_block: {
        type: 'tool_use',
        id: 'toolu-read-1',
        name: 'Read',
        input: { file_path: '/workspace/package.json' },
      },
    }))

    expect(chunks).toEqual([
      {
        toolRequest: expect.objectContaining({
          id: 'toolu-read-1',
          toolName: 'Read',
          actionKind: 'read_file',
          targetPaths: ['/workspace/package.json'],
        }),
      },
    ])
  })

  it('extracts Claude AskUserQuestion as a runtime question instead of a shell command request', () => {
    const chunks = outputChunks('claude_code', JSON.stringify({
      type: 'content_block_start',
      content_block: {
        type: 'tool_use',
        id: 'toolu-question-1',
        name: 'AskUserQuestion',
        input: {
          questions: [
            {
              header: '实现范围',
              question: '请选择历史记录保存方式',
              options: [
                { label: 'SQLite', description: '使用本地 SQLite 数据库' },
                { label: '内存', description: '仅用于临时预览' },
              ],
            },
          ],
        },
      },
    }))

    expect(chunks).toEqual([
      {
        question: expect.objectContaining({
          id: 'toolu-question-1',
          toolName: 'AskUserQuestion',
          questionId: 'toolu-question-1',
          title: '实现范围',
          content: expect.stringContaining('实现范围：请选择历史记录保存方式'),
        }),
      },
    ])
    expect(chunks[0]).not.toHaveProperty('toolRequest')
    expect(chunks[0].question?.content).toContain('SQLite：使用本地 SQLite 数据库')
  })

  it('ignores Claude TaskUpdate progress tools instead of requesting shell approval', () => {
    const chunks = outputChunks('claude_code', JSON.stringify({
      type: 'content_block_start',
      content_block: {
        type: 'tool_use',
        id: 'toolu-task-update-1',
        name: 'TaskUpdate',
        input: { taskId: '1', status: 'in_progress' },
      },
    }))

    expect(chunks).toEqual([])
  })

  it('ignores Claude internal orchestration tools instead of requesting shell approval', () => {
    const parser = new CliOutputParser('claude_code')
    const lines = [
      {
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          id: 'toolu-agent-1',
          name: 'Agent',
          input: {
            description: '后端：Express + SQLite API',
            prompt: '请实现后端 API。',
            subagent_type: 'general-purpose',
          },
        },
      },
      {
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          id: 'toolu-task-create-1',
          name: 'TaskCreate',
          input: {
            subject: '初始化 package.json 与依赖',
            activeForm: '初始化项目配置',
            description: '创建 package.json，声明 express、better-sqlite3 依赖与启动脚本',
          },
        },
      },
      {
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          id: 'toolu-todo-1',
          name: 'TodoWrite',
          input: { todos: [{ content: '实现 API', status: 'in_progress' }] },
        },
      },
    ]

    const chunks = lines.flatMap((line) => parser.parseLine(JSON.stringify(line)))

    expect(chunks).toEqual([])
  })

  it('buffers Claude streamed tool input JSON before emitting a Read approval request', () => {
    const parser = new CliOutputParser('claude_code')
    const lines = [
      {
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          id: 'toolu-read-streamed',
          name: 'Read',
          input: {},
        },
      },
      {
        type: 'content_block_delta',
        delta: {
          type: 'input_json_delta',
          partial_json: '{"file_path":"/workspace/package.json"}',
        },
      },
      { type: 'content_block_stop' },
    ]

    const chunks = lines.flatMap((line) => parser.parseLine(JSON.stringify(line)))

    expect(chunks).toEqual([
      {
        toolRequest: expect.objectContaining({
          id: 'toolu-read-streamed',
          toolName: 'Read',
          actionKind: 'read_file',
          input: { file_path: '/workspace/package.json' },
          targetPaths: ['/workspace/package.json'],
        }),
      },
    ])
  })

  it('buffers Claude streamed AskUserQuestion input JSON before emitting a question event', () => {
    const parser = new CliOutputParser('claude_code')
    const lines = [
      {
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          id: 'toolu-question-streamed',
          name: 'AskUserQuestion',
          input: {},
        },
      },
      {
        type: 'content_block_delta',
        delta: {
          type: 'input_json_delta',
          partial_json: '{"questions":[{"header":"确认","question":"是否继续使用 SQLite？","options":[{"label":"继续"}]}]}',
        },
      },
      { type: 'content_block_stop' },
    ]

    const chunks = lines.flatMap((line) => parser.parseLine(JSON.stringify(line)))

    expect(chunks).toEqual([
      {
        question: expect.objectContaining({
          id: 'toolu-question-streamed',
          questionId: 'toolu-question-streamed',
          title: '确认',
          content: expect.stringContaining('确认：是否继续使用 SQLite？'),
        }),
      },
    ])
    expect(chunks[0]).not.toHaveProperty('toolRequest')
  })

  it('extracts Codex exec_command items as dependency install permission requests', () => {
    const chunks = outputChunks('codex', JSON.stringify({
      type: 'item.started',
      item: {
        type: 'exec_command',
        id: 'call-install-1',
        input: { command: 'pnpm install', cwd: '/workspace' },
      },
    }))

    expect(chunks).toEqual([
      {
        toolRequest: expect.objectContaining({
          id: 'call-install-1',
          actionKind: 'install_dependency',
          commandPreview: 'pnpm install',
          cwd: '/workspace',
        }),
      },
    ])
  })

  it('classifies Claude Glob as read_file instead of shell_command', () => {
    const chunks = outputChunks('claude_code', JSON.stringify({
      type: 'content_block_start',
      content_block: {
        type: 'tool_use',
        id: 'toolu-glob-1',
        name: 'Glob',
        input: { pattern: 'public/**/*' },
      },
    }))

    expect(chunks).toEqual([
      {
        toolRequest: expect.objectContaining({
          id: 'toolu-glob-1',
          toolName: 'Glob',
          actionKind: 'read_file',
          input: { pattern: 'public/**/*' },
          targetPaths: [],
        }),
      },
    ])
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

  it('keeps full-control observed command failures recoverable until the runtime stops', async () => {
    const executor: RuntimeExecutor = {
      async *execute() {
        yield {
          observedAction: {
            id: 'cmd-failed',
            toolName: 'command_execution',
            actionKind: 'shell_command',
            status: 'failed',
            commandPreview: "npm test",
            output: "Error: Cannot find module 'supertest'",
            exitCode: 1,
          },
        }
        yield { delta: 'Dependency missing, using a fallback renderer instead.' }
      },
    }

    const result = await processJob({
      runtimeSessionId: 'runtime-observed-failed',
      prompt: 'run failing test',
      permissionMode: 'full_control',
      workspaceRoot: '/workspace',
      cwd: '/workspace',
      sessionId: 'session-001',
      ownerId: 'user-001',
      planNodeId: 'node-runtime-001',
      attemptId: 'attempt-runtime-failed-observed',
      mailboxItemId: 'mailbox-runtime-failed-observed',
    }, executor)

    expect(result).toBe('completed')
    expect(published).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'runtime_observed_action',
          status: 'failed',
          commandPreview: 'npm test',
          autoApproved: true,
        }),
      }),
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'runtime_output',
          delta: 'Dependency missing, using a fallback renderer instead.',
        }),
      }),
    ]))
    expect(published.some((p) => p.event.type === 'runtime_failed')).toBe(false)
    expect(dbUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'runtime_sessions', status: 'completed' }),
      expect.objectContaining({ table: 'plan_node_attempts', status: 'completed' }),
      expect.objectContaining({ table: 'agent_mailbox_items', status: 'completed' }),
      expect.objectContaining({ table: 'plan_nodes', status: 'completed' }),
    ]))
  })

  it('does not turn an observed full-control command failure into a runtime failure by itself', async () => {
    const executor: RuntimeExecutor = {
      async *execute() {
        yield {
          observedAction: {
            id: 'cmd-failed',
            toolName: 'command_execution',
            actionKind: 'shell_command',
            status: 'failed',
            commandPreview: 'npm test',
            output: "Error: Cannot find module 'supertest'",
            exitCode: 1,
          },
        }
      },
    }

    const result = await processJob({
      runtimeSessionId: 'runtime-observed-unrecovered',
      prompt: 'run failing test',
      permissionMode: 'full_control',
      workspaceRoot: '/workspace',
      cwd: '/workspace',
      sessionId: 'session-001',
      ownerId: 'user-001',
      planNodeId: 'node-runtime-001',
      attemptId: 'attempt-runtime-unrecovered-observed',
      mailboxItemId: 'mailbox-runtime-unrecovered-observed',
    }, executor)

    expect(result).toBe('completed')
    expect(published).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'runtime_observed_action',
          status: 'failed',
          commandPreview: 'npm test',
          autoApproved: true,
        }),
      }),
    ]))
    expect(published.some((p) => p.event.type === 'runtime_failed')).toBe(false)
    expect(dbUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'runtime_sessions', status: 'completed' }),
      expect.objectContaining({ table: 'plan_node_attempts', status: 'completed' }),
      expect.objectContaining({ table: 'agent_mailbox_items', status: 'completed' }),
      expect.objectContaining({ table: 'plan_nodes', status: 'completed' }),
    ]))
  })

  it('fails and closes the executor when a runtime job exceeds the hard timeout', async () => {
    vi.useFakeTimers()
    process.env.RUNTIME_JOB_TIMEOUT_MS = '25'
    let returned = false
    const hanging: RuntimeExecutor = {
      execute() {
        return {
          [Symbol.asyncIterator]() {
            return {
              next: () => new Promise<IteratorResult<never>>(() => {}),
              return: async () => {
                returned = true
                return { done: true, value: undefined }
              },
            }
          },
        }
      },
    }
    const run = processJob({ runtimeSessionId: 's-timeout', prompt: 'hang' }, hanging)

    await vi.advanceTimersByTimeAsync(25)
    const result = await run

    expect(result).toBe('failed')
    expect(returned).toBe(true)
    expect(published).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'runtime_failed',
          error: 'Runtime 执行超时，已终止。',
        }),
      }),
    ]))
    expect(dbUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'failed' }),
    ]))
    vi.useRealTimers()
  })

  it('fails and closes the executor when runtime output is idle too long', async () => {
    vi.useFakeTimers()
    process.env.RUNTIME_JOB_TIMEOUT_MS = '500'
    process.env.RUNTIME_OUTPUT_IDLE_TIMEOUT_MS = '25'
    let returned = false
    const idle: RuntimeExecutor = {
      execute() {
        return {
          [Symbol.asyncIterator]() {
            return {
              next: () => new Promise<IteratorResult<never>>(() => {}),
              return: async () => {
                returned = true
                return { done: true, value: undefined }
              },
            }
          },
        }
      },
    }
    const run = processJob({ runtimeSessionId: 's-idle-timeout', prompt: 'hang after start' }, idle)

    await vi.advanceTimersByTimeAsync(25)
    const result = await run

    expect(result).toBe('failed')
    expect(returned).toBe(true)
    expect(published).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'runtime_failed',
          error: 'Runtime 输出空闲超时，已终止。',
        }),
      }),
    ]))
    vi.useRealTimers()
  })

  it('turns native CLI tool requests into pending approval events and stops before execution', async () => {
    const executor: RuntimeExecutor = {
      async *execute() {
        yield {
          toolRequest: {
            id: 'tool-install-1',
            toolName: 'exec_command',
            actionKind: 'install_dependency',
            cwd: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
            commandPreview: 'pnpm install',
          },
        }
      },
    }
    const job: RuntimeJob = {
      runtimeSessionId: 'runtime-tool-approval',
      workspaceId: 'ws-001',
      sessionId: 'session-001',
      ownerId: 'user-001',
      workspaceRoot: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
      cwd: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
      prompt: 'install deps',
      planNodeId: 'node-runtime-001',
      attemptId: 'attempt-runtime-approval',
      mailboxItemId: 'mailbox-runtime-approval',
    }

    const result = await processJob(job, executor)

    expect(result).toBe('waiting')
    expect(dbInserts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'actions',
        row: expect.objectContaining({
          owner_id: 'user-001',
          action_type: 'install_dependency',
          command: 'pnpm install',
          status: 'pending',
          requires_approval: true,
        }),
      }),
      expect.objectContaining({
        table: 'notifications',
        row: expect.objectContaining({
          user_id: 'user-001',
          type: 'approval_required',
          ref_id: 'action-runtime-approval',
        }),
      }),
    ]))
    expect(published).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'approval_requested',
          actionId: 'action-runtime-approval',
          actionKind: 'install_dependency',
          commandPreview: 'pnpm install',
          workspaceRoot: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
        }),
      }),
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'runtime_waiting',
          reason: 'Runtime 工具已进入权限审批，未执行该操作。',
          waitingFor: 'approval',
        }),
      }),
    ]))
    expect(published.some((p) => p.event.type === 'runtime_failed')).toBe(false)
    expect(published.some((p) => p.event.type === 'runtime_output')).toBe(false)
    expect(dbUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'waiting', runtime_session_id: 'runtime-tool-approval', error: 'Runtime 工具已进入权限审批，未执行该操作。' }),
      expect.objectContaining({ status: 'waiting', error: 'Runtime 工具已进入权限审批，未执行该操作。' }),
      expect.objectContaining({
        status: 'waiting',
        completed_at: null,
        result: expect.objectContaining({
          terminal: 'waiting',
          runtimeSessionId: 'runtime-tool-approval',
          error: 'Runtime 工具已进入权限审批，未执行该操作。',
        }),
      }),
    ]))
  })

  it('turns non-full-control Codex observed command starts into pending approval before completion', async () => {
    const workspaceRoot = '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2'
    const executor: RuntimeExecutor = {
      async *execute() {
        yield {
          observedAction: {
            id: 'cmd-write-observed',
            toolName: 'command_execution',
            actionKind: 'shell_command',
            status: 'running',
            cwd: workspaceRoot,
            commandPreview: "printf 'hello' > agenthub-permission.txt",
            input: { command: "printf 'hello' > agenthub-permission.txt" },
          },
        }
        yield {
          observedAction: {
            id: 'cmd-write-observed',
            toolName: 'command_execution',
            actionKind: 'shell_command',
            status: 'completed',
            cwd: workspaceRoot,
            commandPreview: "printf 'hello' > agenthub-permission.txt",
            output: 'wrote file',
            exitCode: 0,
          },
        }
      },
    }
    const job: RuntimeJob = {
      runtimeSessionId: 'runtime-observed-approval',
      workspaceId: 'ws-001',
      sessionId: 'session-001',
      ownerId: 'user-001',
      runtimeType: 'codex',
      permissionMode: 'manual',
      workspaceRoot,
      cwd: workspaceRoot,
      prompt: 'write file',
      planNodeId: 'node-runtime-001',
      attemptId: 'attempt-runtime-observed-approval',
      mailboxItemId: 'mailbox-runtime-observed-approval',
    }

    const result = await processJob(job, executor)

    expect(result).toBe('waiting')
    expect(dbInserts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'actions',
        row: expect.objectContaining({
          owner_id: 'user-001',
          action_type: 'shell_command',
          command: "printf 'hello' > agenthub-permission.txt",
          status: 'pending',
          requires_approval: true,
          result: expect.objectContaining({
            source: 'runtime_permission_broker',
            toolCallId: 'cmd-write-observed',
            toolName: 'command_execution',
            runtimeType: 'codex',
            permissionMode: 'manual',
          }),
        }),
      }),
    ]))
    expect(published).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'approval_requested',
          actionId: 'action-runtime-approval',
          actionKind: 'shell_command',
          commandPreview: "printf 'hello' > agenthub-permission.txt",
          workspaceRoot,
        }),
      }),
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'runtime_waiting',
          waitingFor: 'approval',
        }),
      }),
    ]))
    expect(published.some((p) => p.event.type === 'runtime_observed_action' && p.event.status === 'completed')).toBe(false)
    expect(dbUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'runtime_sessions', status: 'waiting' }),
      expect.objectContaining({ table: 'plan_node_attempts', status: 'waiting', error: 'Runtime 工具已进入权限审批，未执行该操作。' }),
      expect.objectContaining({ table: 'agent_mailbox_items', status: 'waiting', error: 'Runtime 工具已进入权限审批，未执行该操作。' }),
      expect.objectContaining({ table: 'plan_nodes', status: 'waiting', completed_at: null }),
    ]))
  })

  it('auto-approves native CLI tool requests inline in full-control mode and continues the same session', async () => {
    const workspaceRoot = '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2'
    const executor: RuntimeExecutor = {
      async *execute() {
        yield { nativeSessionId: 'claude-native-full-control' }
        yield { delta: '开始检查工作区。' }
        yield {
          toolRequest: {
            id: 'tool-read-full-control',
            toolName: 'Read',
            actionKind: 'read_file',
            cwd: workspaceRoot,
            targetPaths: [`${workspaceRoot}/package.json`],
            input: { file_path: `${workspaceRoot}/package.json` },
          },
        }
        yield { delta: '继续生成产物。' }
        yield {
          toolRequest: {
            id: 'tool-write-full-control',
            toolName: 'Write',
            actionKind: 'write_file',
            cwd: workspaceRoot,
            targetPaths: [`${workspaceRoot}/public/index.html`],
            input: { file_path: `${workspaceRoot}/public/index.html`, content: '<!doctype html>\n' },
          },
        }
        yield { delta: '已完成。' }
      },
    }
    const job: RuntimeJob = {
      runtimeSessionId: 'runtime-full-control-inline',
      workspaceId: 'ws-001',
      sessionId: 'session-001',
      ownerId: 'user-001',
      roleAgentId: 'agent-frontend',
      runtimeType: 'claude_code',
      permissionMode: 'full_control',
      workspaceRoot,
      cwd: workspaceRoot,
      prompt: 'build product',
      planNodeId: 'node-runtime-001',
      attemptId: 'attempt-runtime-full-control',
      mailboxItemId: 'mailbox-runtime-full-control',
    }

    const result = await processJob(job, executor)

    expect(result).toBe('completed')
    const actionRows = dbInserts.filter((insert) => insert.table === 'actions').map((insert) => insert.row)
    expect(actionRows).toEqual([
      expect.objectContaining({
        action_type: 'read_file',
        command: `Read: ${workspaceRoot}/package.json`,
        status: 'completed',
        requires_approval: false,
        approved_at: expect.any(String),
        executed_at: expect.any(String),
        result: expect.objectContaining({
          source: 'runtime_auto_permission_broker',
          toolCallId: 'tool-read-full-control',
          nativeSessionId: 'claude-native-full-control',
          permissionMode: 'full_control',
          autoApproved: true,
          continuedInline: true,
        }),
      }),
      expect.objectContaining({
        action_type: 'write_file',
        command: `Write: ${workspaceRoot}/public/index.html`,
        status: 'completed',
        requires_approval: false,
        result: expect.objectContaining({
          source: 'runtime_auto_permission_broker',
          toolCallId: 'tool-write-full-control',
          roleAgentId: 'agent-frontend',
          runtimeType: 'claude_code',
          targetPaths: [`${workspaceRoot}/public/index.html`],
        }),
      }),
    ])
    expect(published).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'approval_auto_approved',
          actionKind: 'read_file',
          inline: true,
        }),
      }),
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'runtime_output',
          delta: '继续生成产物。',
        }),
      }),
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'runtime_completed',
        }),
      }),
    ]))
    expect(published.some((p) => p.event.type === 'approval_requested')).toBe(false)
    expect(published.some((p) => p.event.error === 'Runtime 工具已按当前权限模式自动进入续跑。')).toBe(false)
  })

  it('persists Claude Read approvals with native tool metadata instead of shell_command cwd fallback', async () => {
    const executor: RuntimeExecutor = {
      async *execute() {
        yield {
          toolRequest: {
            id: 'tool-read-1',
            toolName: 'Read',
            actionKind: 'read_file',
            cwd: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
            targetPaths: ['/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/package.json'],
            input: { file_path: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/package.json' },
          },
        }
      },
    }
    const job: RuntimeJob = {
      runtimeSessionId: 'runtime-read-approval',
      workspaceId: 'ws-001',
      sessionId: 'session-001',
      ownerId: 'user-001',
      runtimeType: 'claude_code',
      nativeSessionId: 'claude-native-001',
      workspaceRoot: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
      cwd: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
      prompt: 'read package',
      planNodeId: 'node-runtime-001',
    }

    const result = await processJob(job, executor)

    expect(result).toBe('waiting')
    expect(dbInserts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'actions',
        row: expect.objectContaining({
          action_type: 'read_file',
          command: 'Read: /Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/package.json',
          cwd: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
          result: expect.objectContaining({
            source: 'runtime_permission_broker',
            runtimeSessionId: 'runtime-read-approval',
            originalRuntimeSessionId: 'runtime-read-approval',
            toolCallId: 'tool-read-1',
            toolName: 'Read',
            actionKind: 'read_file',
            runtimeType: 'claude_code',
            nativeSessionId: 'claude-native-001',
            targetPaths: ['/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/package.json'],
            input: { file_path: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/package.json' },
          }),
        }),
      }),
    ]))
    expect(dbInserts.find((insert) => insert.table === 'actions')?.row).not.toEqual(expect.objectContaining({
      command: 'shell_command: /Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
    }))
    expect(published).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'approval_requested',
          actionKind: 'read_file',
          targetPaths: ['/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/package.json'],
        }),
      }),
    ]))
  })

  it('persists discovered native session and role metadata for native tool approvals', async () => {
    const executor: RuntimeExecutor = {
      async *execute() {
        yield { nativeSessionId: 'claude-native-discovered' }
        yield {
          toolRequest: {
            id: 'tool-read-discovered',
            toolName: 'Read',
            actionKind: 'read_file',
            cwd: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
            targetPaths: ['/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/README.md'],
            input: { file_path: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/README.md' },
          },
        }
      },
    }
    const job: RuntimeJob = {
      runtimeSessionId: 'runtime-read-discovered',
      workspaceId: 'ws-001',
      sessionId: 'session-001',
      ownerId: 'user-001',
      roleAgentId: 'agent-architect',
      runtimeType: 'claude_code',
      workspaceRoot: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
      cwd: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
      prompt: 'read README',
    }

    const result = await processJob(job, executor)

    expect(result).toBe('waiting')
    expect(dbInserts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'actions',
        row: expect.objectContaining({
          result: expect.objectContaining({
            source: 'runtime_permission_broker',
            toolCallId: 'tool-read-discovered',
            nativeSessionId: 'claude-native-discovered',
            roleAgentId: 'agent-architect',
            runtimeType: 'claude_code',
          }),
        }),
      }),
    ]))
  })

  it('publishes AskUserQuestion as a durable question event without creating a shell action', async () => {
    const executor: RuntimeExecutor = {
      async *execute() {
        yield {
          question: {
            id: 'toolu-question-runtime',
            toolName: 'AskUserQuestion',
            questionId: 'toolu-question-runtime',
            title: '实现范围',
            content: '实现范围：请选择历史记录保存方式\n- SQLite：使用本地 SQLite 数据库',
            input: { questions: [{ header: '实现范围', question: '请选择历史记录保存方式' }] },
          },
        }
      },
    }
    const job: RuntimeJob = {
      runtimeSessionId: 'runtime-question',
      workspaceId: 'ws-001',
      sessionId: 'session-001',
      ownerId: 'user-001',
      runtimeType: 'claude_code',
      nativeSessionId: 'claude-native-001',
      workspaceRoot: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
      cwd: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
      prompt: 'ask user',
      planNodeId: 'node-runtime-001',
    }

    const result = await processJob(job, executor)

    expect(result).toBe('waiting')
    expect(dbInserts.some((insert) => insert.table === 'actions')).toBe(false)
    expect(dbInserts.some((insert) => insert.table === 'notifications')).toBe(false)
    expect(published).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'question',
          questionId: 'toolu-question-runtime',
          title: '实现范围',
          content: expect.stringContaining('SQLite'),
        }),
      }),
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'runtime_waiting',
          reason: 'Runtime 等待用户补充确认，未继续执行。',
          waitingFor: 'question',
        }),
      }),
    ]))
    expect(published.some((p) => p.event.type === 'runtime_failed')).toBe(false)
    expect(published.some((p) => p.event.type === 'approval_requested')).toBe(false)
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
        table: 'actions',
        status: 'completed',
        result: expect.objectContaining({
          terminal: 'completed',
          runtimeSessionId: 's-action',
          output: 'do useful work',
        }),
      }),
      expect.objectContaining({
        table: 'plan_nodes',
        status: 'completed',
        completed_at: expect.any(String),
        result: expect.objectContaining({
          terminal: 'completed',
          runtimeSessionId: 's-action',
        }),
      }),
    ]))
  })

  it('closes stale waiting mailbox blockers when an approved action completes its plan node', async () => {
    const job: RuntimeJob = {
      runtimeSessionId: 'runtime-approved-completes-node',
      prompt: 'approved continuation finished',
      actionId: 'action-approved-node',
      planNodeId: 'node-approved',
    }

    const result = await processJob(job, new FakeExecutor())

    expect(result).toBe('completed')
    expect(dbUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'plan_node_attempts',
        status: 'completed',
        error: null,
        where: [['plan_node_id', 'node-approved'], ['status', 'waiting']],
      }),
      expect.objectContaining({
        table: 'agent_mailbox_items',
        status: 'completed',
        error: null,
        where: [['plan_node_id', 'node-approved'], ['status', 'waiting']],
      }),
    ]))
  })

  it('preserves runtime permission broker metadata when an approved action runs and completes', async () => {
    const actionResult = {
      source: 'runtime_permission_broker',
      originalRuntimeSessionId: 'runtime-original',
      toolCallId: 'tool-read-1',
      toolName: 'Read',
      actionKind: 'read_file',
      targetPaths: ['/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/README.md'],
      nativeSessionId: 'claude-native-001',
      roleAgentId: 'agent-architect',
      dispatch: 'queued',
      runtimeSessionId: 'runtime-approved',
    }
    const job: RuntimeJob = {
      runtimeSessionId: 'runtime-approved',
      prompt: 'approved native continuation',
      actionId: 'action-read-approved',
      actionResult,
    }

    const result = await processJob(job, new FakeExecutor())

    expect(result).toBe('completed')
    expect(dbUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'running',
        result: expect.objectContaining({
          source: 'runtime_permission_broker',
          toolName: 'Read',
          targetPaths: ['/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/README.md'],
          dispatch: 'running',
          runtimeSessionId: 'runtime-approved',
        }),
      }),
      expect.objectContaining({
        table: 'actions',
        status: 'completed',
        result: expect.objectContaining({
          source: 'runtime_permission_broker',
          toolName: 'Read',
          targetPaths: ['/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/README.md'],
          terminal: 'completed',
          runtimeSessionId: 'runtime-approved',
        }),
      }),
    ]))
  })

  it('consumes one repeated approved native tool request without creating another pending action', async () => {
    const workspaceRoot = '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2'
    const executor: RuntimeExecutor = {
      async *execute() {
        yield {
          toolRequest: {
            id: 'tool-write-approved',
            toolName: 'Write',
            actionKind: 'write_file',
            cwd: workspaceRoot,
            targetPaths: [`${workspaceRoot}/server.js`],
            input: { file_path: `${workspaceRoot}/server.js`, content: 'console.log("ok")\n' },
          },
        }
        yield { delta: 'continued after approved write' }
      },
    }
    const job: RuntimeJob = {
      runtimeSessionId: 'runtime-approved-repeat',
      prompt: 'approved write continuation',
      actionId: 'action-write-approved',
      planNodeId: 'node-write-approved',
      attemptId: 'attempt-write-approved',
      mailboxItemId: 'mailbox-write-approved',
      workspaceId: 'ws-001',
      sessionId: 'session-001',
      ownerId: 'user-001',
      workspaceRoot,
      cwd: workspaceRoot,
      actionResult: {
        source: 'runtime_permission_broker',
        toolCallId: 'tool-write-approved',
        toolName: 'Write',
        actionKind: 'write_file',
        targetPaths: [`${workspaceRoot}/server.js`],
        dispatch: 'queued',
      },
      approvedNativeTool: {
        toolCallId: 'tool-write-approved',
        toolName: 'Write',
        actionKind: 'write_file',
        targetPaths: [`${workspaceRoot}/server.js`],
        executed: true,
        output: `Wrote 18 bytes to ${workspaceRoot}/server.js`,
      },
    }

    const result = await processJob(job, executor)

    expect(result).toBe('completed')
    expect(dbInserts.some((insert) => insert.table === 'actions')).toBe(false)
    expect(published).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'approved_tool_result_consumed',
          toolName: 'Write',
          toolCallId: 'tool-write-approved',
          actionKind: 'write_file',
        }),
      }),
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'runtime_output',
          delta: 'continued after approved write',
        }),
      }),
    ]))
    expect(dbUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'completed',
        result: expect.objectContaining({
          source: 'runtime_permission_broker',
          toolName: 'Write',
          terminal: 'completed',
          runtimeSessionId: 'runtime-approved-repeat',
        }),
      }),
    ]))
  })

  it('consumes one repeated approved Bash request by matching commandPreview', async () => {
    const workspaceRoot = '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2'
    const command = 'DB_PATH="$(pwd)/calc-plan-verify.db" node verify.mjs; rm -f calc-plan-verify.db'
    const executor: RuntimeExecutor = {
      async *execute() {
        yield {
          toolRequest: {
            id: 'tool-bash-repeat-new-id',
            toolName: 'Bash',
            actionKind: 'destructive_command',
            cwd: workspaceRoot,
            commandPreview: command,
            input: { command },
          },
        }
        yield { delta: 'continued after approved verification' }
      },
    }
    const job: RuntimeJob = {
      runtimeSessionId: 'runtime-approved-bash-repeat',
      prompt: 'approved bash continuation',
      actionId: 'action-bash-approved',
      planNodeId: 'node-bash-approved',
      attemptId: 'attempt-bash-approved',
      mailboxItemId: 'mailbox-bash-approved',
      workspaceId: 'ws-001',
      sessionId: 'session-001',
      ownerId: 'user-001',
      workspaceRoot,
      cwd: workspaceRoot,
      actionResult: {
        source: 'runtime_permission_broker',
        toolCallId: 'tool-bash-approved',
        toolName: 'Bash',
        actionKind: 'destructive_command',
        commandPreview: command,
        dispatch: 'queued',
      },
      approvedNativeTool: {
        toolCallId: 'tool-bash-approved',
        toolName: 'Bash',
        actionKind: 'destructive_command',
        commandPreview: command,
        targetPaths: [],
        executed: true,
        output: 'verification passed',
      },
    }

    const result = await processJob(job, executor)

    expect(result).toBe('completed')
    expect(dbInserts.some((insert) => insert.table === 'actions')).toBe(false)
    expect(published).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'approved_tool_result_consumed',
          toolName: 'Bash',
          toolCallId: 'tool-bash-repeat-new-id',
          actionKind: 'destructive_command',
        }),
      }),
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'runtime_output',
          delta: 'continued after approved verification',
        }),
      }),
    ]))
  })

  it('does not consume a different Bash command after an approved Bash request', async () => {
    const workspaceRoot = '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2'
    const approvedCommand = 'node verify.mjs'
    const differentCommand = 'npm install better-sqlite3'
    const executor: RuntimeExecutor = {
      async *execute() {
        yield {
          toolRequest: {
            id: 'tool-bash-different',
            toolName: 'Bash',
            actionKind: 'install_dependency',
            cwd: workspaceRoot,
            commandPreview: differentCommand,
            input: { command: differentCommand },
          },
        }
      },
    }
    const job: RuntimeJob = {
      runtimeSessionId: 'runtime-approved-bash-different',
      prompt: 'approved bash then different command',
      actionId: 'action-bash-approved',
      planNodeId: 'node-bash-approved',
      attemptId: 'attempt-bash-approved',
      mailboxItemId: 'mailbox-bash-approved',
      workspaceId: 'ws-001',
      sessionId: 'session-001',
      ownerId: 'user-001',
      workspaceRoot,
      cwd: workspaceRoot,
      actionResult: {
        source: 'runtime_permission_broker',
        toolCallId: 'tool-bash-approved',
        toolName: 'Bash',
        actionKind: 'destructive_command',
        commandPreview: approvedCommand,
        dispatch: 'queued',
      },
      approvedNativeTool: {
        toolCallId: 'tool-bash-approved',
        toolName: 'Bash',
        actionKind: 'destructive_command',
        commandPreview: approvedCommand,
        targetPaths: [],
        executed: true,
        output: 'verification passed',
      },
    }

    const result = await processJob(job, executor)

    expect(result).toBe('waiting')
    expect(dbInserts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'actions',
        row: expect.objectContaining({
          action_type: 'install_dependency',
          command: differentCommand,
          status: 'pending',
          result: expect.objectContaining({
            toolCallId: 'tool-bash-different',
            toolName: 'Bash',
            commandPreview: differentCommand,
          }),
        }),
      }),
    ]))
  })

  it('keeps the approved action completed when continuation reaches a different next permission', async () => {
    const workspaceRoot = '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2'
    const executor: RuntimeExecutor = {
      async *execute() {
        yield {
          toolRequest: {
            id: 'tool-read-next',
            toolName: 'Read',
            actionKind: 'read_file',
            cwd: workspaceRoot,
            targetPaths: [`${workspaceRoot}/README.md`],
            input: { file_path: `${workspaceRoot}/README.md` },
          },
        }
      },
    }
    const job: RuntimeJob = {
      runtimeSessionId: 'runtime-approved-next-permission',
      prompt: 'approved write then next read',
      actionId: 'action-write-approved',
      planNodeId: 'node-write-approved',
      attemptId: 'attempt-write-approved',
      mailboxItemId: 'mailbox-write-approved',
      workspaceId: 'ws-001',
      sessionId: 'session-001',
      ownerId: 'user-001',
      workspaceRoot,
      cwd: workspaceRoot,
      actionResult: {
        source: 'runtime_permission_broker',
        toolCallId: 'tool-write-approved',
        toolName: 'Write',
        actionKind: 'write_file',
        targetPaths: [`${workspaceRoot}/server.js`],
        dispatch: 'queued',
      },
      approvedNativeTool: {
        toolCallId: 'tool-write-approved',
        toolName: 'Write',
        actionKind: 'write_file',
        targetPaths: [`${workspaceRoot}/server.js`],
        executed: true,
        output: `Wrote 18 bytes to ${workspaceRoot}/server.js`,
      },
    }

    const result = await processJob(job, executor)

    expect(result).toBe('waiting')
    expect(dbInserts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'actions',
        row: expect.objectContaining({
          action_type: 'read_file',
          command: `Read: ${workspaceRoot}/README.md`,
          status: 'pending',
          result: expect.objectContaining({
            toolCallId: 'tool-read-next',
            toolName: 'Read',
            targetPaths: [`${workspaceRoot}/README.md`],
          }),
        }),
      }),
    ]))
    expect(dbUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'waiting', runtime_session_id: 'runtime-approved-next-permission', error: 'Runtime 工具已进入权限审批，未执行该操作。' }),
      expect.objectContaining({ status: 'waiting', error: 'Runtime 工具已进入权限审批，未执行该操作。' }),
      expect.objectContaining({
        status: 'completed',
        result: expect.objectContaining({
          source: 'runtime_permission_broker',
          toolName: 'Write',
          terminal: 'completed',
          runtimeSessionId: 'runtime-approved-next-permission',
        }),
      }),
      expect.objectContaining({
        table: 'plan_nodes',
        status: 'waiting',
        completed_at: null,
        result: expect.objectContaining({
          source: 'runtime_permission_broker',
          terminal: 'waiting',
          runtimeSessionId: 'runtime-approved-next-permission',
        }),
      }),
    ]))
    const completedActionUpdate = dbUpdates.find((update) => update.status === 'completed' && typeof update.result === 'object')
    expect(completedActionUpdate?.result).toEqual(expect.not.objectContaining({
      error: 'Runtime 工具已进入权限审批，未执行该操作。',
    }))
  })

  it('keeps an approved broker shell action completed when it reaches the next permission after useful output', async () => {
    const workspaceRoot = '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2'
    const executor: RuntimeExecutor = {
      async *execute() {
        yield { delta: '工作区状态已确认，继续落地前端文件。' }
        yield {
          toolRequest: {
            id: 'tool-write-next',
            toolName: 'Write',
            actionKind: 'write_file',
            cwd: workspaceRoot,
            targetPaths: [`${workspaceRoot}/public/index.html`],
            input: { file_path: `${workspaceRoot}/public/index.html`, content: '<!doctype html>\n' },
          },
        }
      },
    }
    const job: RuntimeJob = {
      runtimeSessionId: 'runtime-approved-shell-next-permission',
      prompt: 'approved shell then next write',
      actionId: 'action-shell-approved',
      planNodeId: 'node-shell-approved',
      attemptId: 'attempt-shell-approved',
      mailboxItemId: 'mailbox-shell-approved',
      workspaceId: 'ws-001',
      sessionId: 'session-001',
      ownerId: 'user-001',
      workspaceRoot,
      cwd: workspaceRoot,
      actionResult: {
        source: 'runtime_permission_broker',
        toolCallId: 'tool-shell-approved',
        toolName: 'Bash',
        actionKind: 'shell_command',
        commandPreview: 'ls -la',
        dispatch: 'queued',
      },
    }

    const result = await processJob(job, executor)

    expect(result).toBe('waiting')
    expect(dbInserts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'actions',
        row: expect.objectContaining({
          action_type: 'write_file',
          command: `Write: ${workspaceRoot}/public/index.html`,
          status: 'pending',
          result: expect.objectContaining({
            toolCallId: 'tool-write-next',
            toolName: 'Write',
            targetPaths: [`${workspaceRoot}/public/index.html`],
          }),
        }),
      }),
    ]))
    expect(dbUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'waiting', runtime_session_id: 'runtime-approved-shell-next-permission', error: 'Runtime 工具已进入权限审批，未执行该操作。' }),
      expect.objectContaining({ status: 'waiting', error: 'Runtime 工具已进入权限审批，未执行该操作。' }),
      expect.objectContaining({
        table: 'actions',
        status: 'completed',
        result: expect.objectContaining({
          source: 'runtime_permission_broker',
          toolName: 'Bash',
          terminal: 'completed',
          runtimeSessionId: 'runtime-approved-shell-next-permission',
          output: '工作区状态已确认，继续落地前端文件。',
        }),
      }),
      expect.objectContaining({
        table: 'plan_nodes',
        status: 'waiting',
        completed_at: null,
        result: expect.objectContaining({
          source: 'runtime_permission_broker',
          terminal: 'waiting',
          runtimeSessionId: 'runtime-approved-shell-next-permission',
        }),
      }),
    ]))
    const completedActionUpdate = dbUpdates.find((update) => update.status === 'completed' && typeof update.result === 'object')
    expect(completedActionUpdate?.result).toEqual(expect.not.objectContaining({
      error: 'Runtime 工具已进入权限审批，未执行该操作。',
    }))
  })

  it('keeps an approved native-tool continuation waiting when it reaches a user-question boundary', async () => {
    const workspaceRoot = '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2'
    const executor: RuntimeExecutor = {
      async *execute() {
        yield {
          question: {
            id: 'tool-question-after-approved-read',
            toolName: 'AskUserQuestion',
            questionId: 'tool-question-after-approved-read',
            title: '技术路线确认',
            content: '请选择是否继续使用 SQLite',
            input: { questions: [{ header: '技术路线确认', question: '请选择是否继续使用 SQLite' }] },
          },
        }
      },
    }
    const job: RuntimeJob = {
      runtimeSessionId: 'runtime-approved-question-boundary',
      prompt: 'continue after approved Read',
      workspaceId: 'ws-001',
      sessionId: 'session-001',
      ownerId: 'user-001',
      actionId: 'action-approved-read',
      planNodeId: 'node-approved-read',
      attemptId: 'attempt-approved-read',
      mailboxItemId: 'mailbox-approved-read',
      actionResult: {
        source: 'runtime_permission_broker',
        toolName: 'Read',
        actionKind: 'read_file',
        dispatch: 'queued',
      },
      approvedNativeTool: {
        toolCallId: 'tool-read-approved',
        toolName: 'Read',
        actionKind: 'read_file',
        targetPaths: [`${workspaceRoot}/README.md`],
        executed: true,
        output: `Read ${workspaceRoot}/README.md\n\n# test2`,
      },
    }

    const result = await processJob(job, executor)

    expect(result).toBe('waiting')
    expect(dbInserts.some((insert) => insert.table === 'actions')).toBe(false)
    expect(published).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'question',
          questionId: 'tool-question-after-approved-read',
        }),
      }),
      expect.objectContaining({
        event: expect.objectContaining({
          type: 'runtime_waiting',
          reason: 'Runtime 等待用户补充确认，未继续执行。',
          waitingFor: 'question',
        }),
      }),
    ]))
    expect(published.some((p) => p.event.type === 'runtime_failed')).toBe(false)
    expect(dbUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'waiting', runtime_session_id: 'runtime-approved-question-boundary', error: 'Runtime 等待用户补充确认，未继续执行。' }),
      expect.objectContaining({ status: 'waiting', error: 'Runtime 等待用户补充确认，未继续执行。' }),
      expect.objectContaining({
        table: 'actions',
        status: 'completed',
        result: expect.objectContaining({
          source: 'runtime_permission_broker',
          toolName: 'Read',
          terminal: 'completed',
          runtimeSessionId: 'runtime-approved-question-boundary',
        }),
      }),
      expect.objectContaining({
        table: 'plan_nodes',
        status: 'waiting',
        completed_at: null,
        result: expect.objectContaining({
          source: 'runtime_permission_broker',
          terminal: 'waiting',
          runtimeSessionId: 'runtime-approved-question-boundary',
        }),
      }),
    ]))
    const completedActionUpdate = dbUpdates.find((update) => update.status === 'completed' && typeof update.result === 'object')
    expect(completedActionUpdate?.result).toEqual(expect.not.objectContaining({
      error: 'Runtime 等待用户补充确认，未继续执行。',
    }))
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
      {
        id: 'node-c',
        plan_id: 'plan-001',
        label: 'C',
        status: 'waiting',
        depends_on: ['node-a', 'node-b'],
        result: { scheduler: 'waiting', reason: 'dependencies still waiting' },
      },
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
