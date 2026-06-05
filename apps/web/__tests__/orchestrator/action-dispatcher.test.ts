import { describe, it, expect, beforeEach, vi } from 'vitest'

const {
  resolveEndpointMock,
  createSessionMock,
  isWorkerAliveMock,
  enqueueMock,
  workspaceRoot,
  fileStore,
  readFileMock,
  readdirMock,
  writeFileMock,
  mkdirMock,
} = vi.hoisted(() => {
  const files = new Map<string, string>()
  const makeDirent = (name: string, type: 'file' | 'directory') => ({
    name,
    isDirectory: () => type === 'directory',
    isFile: () => type === 'file',
  })
  return {
  workspaceRoot: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
  resolveEndpointMock: vi.fn(async (_input: unknown) => ({ id: 'endpoint-001', kind: 'public_cloud', status: 'available' })),
  createSessionMock: vi.fn(async (input: { cwd?: string | null }) => ({ id: 'runtime-001', nativeSessionId: 'native-001', cwd: input.cwd })),
  isWorkerAliveMock: vi.fn(async () => true),
  enqueueMock: vi.fn(async (_input: unknown) => undefined),
  fileStore: files,
  readFileMock: vi.fn(async (filePath: string) => {
    const content = files.get(String(filePath))
    if (content === undefined) throw new Error(`ENOENT: no such file, open '${String(filePath)}'`)
    return content
  }),
  readdirMock: vi.fn(async (dirPath: string) => {
    const dir = String(dirPath).replace(/\/$/, '')
    const childNames = new Map<string, 'file' | 'directory'>()
    for (const filePath of files.keys()) {
      if (!filePath.startsWith(`${dir}/`)) continue
      const rest = filePath.slice(dir.length + 1)
      const [name, ...tail] = rest.split('/')
      if (!name) continue
      childNames.set(name, tail.length > 0 ? 'directory' : 'file')
    }
    return [...childNames.entries()].map(([name, type]) => makeDirent(name, type))
  }),
  writeFileMock: vi.fn(async (filePath: string, content: string) => {
    files.set(String(filePath), String(content))
  }),
  mkdirMock: vi.fn(async () => undefined),
}})

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: readFileMock,
    readdir: readdirMock,
    writeFile: writeFileMock,
    mkdir: mkdirMock,
  },
  readFile: readFileMock,
  readdir: readdirMock,
  writeFile: writeFileMock,
  mkdir: mkdirMock,
}))

vi.mock('@/lib/runtime/gateway', () => ({
  resolveEndpoint: (input: unknown) => resolveEndpointMock(input),
  createSession: (input: unknown) => createSessionMock(input as { cwd?: string | null }),
}))

vi.mock('@/lib/runtime/redis-client', () => ({
  isWorkerAlive: () => isWorkerAliveMock(),
  enqueue: (input: unknown) => enqueueMock(input),
}))

function dispatchDb(overrides: { role?: Record<string, unknown>; workspace?: Record<string, unknown> | null } = {}) {
  const writes: Array<{ table: string; values: Record<string, unknown>; id?: string }> = []
  const session = { id: 'session-001', workspace_id: 'ws-001' }
  const workspace = overrides.workspace === null
    ? null
    : { id: 'ws-001', owner_id: 'user-001', execution_domain: 'cloud', cloud_project_dir: workspaceRoot, ...overrides.workspace }
  const role = {
    id: 'agent-be',
    name: '后端工程师',
    system_prompt: '你是后端工程师',
    runtime_type: 'codex',
    ...overrides.role,
  }

  return {
    writes,
    db: {
      from: vi.fn((table: string) => {
        if (table === 'sessions') {
          return { select: () => ({ eq: () => ({ single: () => ({ data: session, error: null }) }) }) }
        }
        if (table === 'workspaces') {
          return { select: () => ({ eq: () => ({ eq: () => ({ single: () => ({ data: workspace, error: null }) }) }) }) }
        }
        if (table === 'role_agents') {
          return { select: () => ({ eq: () => ({ eq: () => ({ single: () => ({ data: role, error: null }) }) }) }) }
        }
        if (table === 'plan_node_attempts') {
          return {
            select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ data: [], error: null }) }) }) }),
            insert: (values: Record<string, unknown>) => {
              writes.push({ table, values })
              return { select: () => ({ single: () => ({ data: { id: 'attempt-001', ...values }, error: null }) }) }
            },
            update: (values: Record<string, unknown>) => ({
              eq: (_field: string, id: string) => {
                writes.push({ table, values, id })
                return { data: null, error: null }
              },
            }),
          }
        }
        if (table === 'agent_mailbox_items') {
          return {
            insert: (values: Record<string, unknown>) => {
              writes.push({ table, values })
              return { select: () => ({ single: () => ({ data: { id: 'mailbox-001', ...values }, error: null }) }) }
            },
            update: (values: Record<string, unknown>) => ({
              eq: (_field: string, id: string) => {
                writes.push({ table, values, id })
                return { data: null, error: null }
              },
            }),
          }
        }
        if (table === 'plan_nodes') {
          return {
            update: (values: Record<string, unknown>) => ({
              eq: (_field: string, id: string) => {
                writes.push({ table, values, id })
                return { data: null, error: null }
              },
            }),
          }
        }
        if (table === 'actions' || table === 'notifications') {
          return {
            insert: (values: Record<string, unknown>) => {
              writes.push({ table, values })
              return { data: null, error: null }
            },
            update: (values: Record<string, unknown>) => ({
              eq: (_field: string, id: string) => {
                writes.push({ table, values, id })
                return { data: null, error: null }
              },
            }),
          }
        }
        return { select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }) }
      }),
    },
  }
}

describe('dispatchApprovedAction', () => {
  beforeEach(() => {
    resolveEndpointMock.mockClear()
    createSessionMock.mockClear()
    isWorkerAliveMock.mockClear()
    enqueueMock.mockClear()
    readFileMock.mockClear()
    readdirMock.mockClear()
    writeFileMock.mockClear()
    mkdirMock.mockClear()
    fileStore.clear()
    fileStore.set(`${workspaceRoot}/package.json`, '{"name":"sample"}')
    fileStore.set(`${workspaceRoot}/public/index.html`, '<!doctype html>')
    fileStore.set(`${workspaceRoot}/public/app.js`, 'console.log("app")')
    fileStore.set(`${workspaceRoot}/server.js`, 'const express = require("express")')
    process.env.REDIS_URL = 'redis://localhost:6379'
  })

  it('blocks an approved action when cwd is outside the selected workspace root', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db, writes } = dispatchDb()

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-outside-cwd',
      session_id: 'session-001',
      owner_id: 'user-001',
      action_type: 'shell',
      command: 'pnpm test',
      cwd: '/Users/joytion/Documents/code/AgentHub_new_claude_test',
      runtime_type: 'codex',
    })

    expect(result).toEqual({
      status: 'unavailable',
      error: '该操作试图使用 workspace 外工作目录，已阻止。',
    })
    expect(createSessionMock).not.toHaveBeenCalled()
    expect(enqueueMock).not.toHaveBeenCalled()
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'actions',
        id: 'action-outside-cwd',
        values: expect.objectContaining({
          result: expect.objectContaining({
            dispatch: 'unavailable',
            error: '该操作试图使用 workspace 外工作目录，已阻止。',
          }),
        }),
      }),
      expect.objectContaining({
        table: 'notifications',
        values: expect.objectContaining({
          user_id: 'user-001',
          type: 'action_dispatch_failed',
        }),
      }),
    ]))
  })

  it('blocks an approved action when command targets an absolute path outside the workspace root', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db } = dispatchDb()

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-outside-target',
      session_id: 'session-001',
      owner_id: 'user-001',
      action_type: 'shell',
      command: 'cat /Users/joytion/Documents/code/AgentHub_new_claude_test/package.json',
      cwd: workspaceRoot,
      runtime_type: 'codex',
    })

    expect(result.status).toBe('unavailable')
    expect(result.error).toContain('该操作试图访问 workspace 外路径')
    expect(createSessionMock).not.toHaveBeenCalled()
    expect(enqueueMock).not.toHaveBeenCalled()
  })

  it('queues brokered Claude Read approvals with native tool metadata instead of a malformed shell command prompt', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db, writes } = dispatchDb()

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-read-approval',
      session_id: 'session-001',
      owner_id: 'user-001',
      action_type: 'read_file',
      command: 'Read: /Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/package.json',
      cwd: workspaceRoot,
      result: {
        source: 'runtime_permission_broker',
        runtimeSessionId: 'runtime-original',
        originalRuntimeSessionId: 'runtime-original',
        toolCallId: 'tool-read-1',
        toolName: 'Read',
        actionKind: 'read_file',
        runtimeType: 'claude_code',
        roleAgentId: 'agent-fe',
        nativeSessionId: 'claude-native-001',
        targetPaths: [`${workspaceRoot}/package.json`],
        cwd: workspaceRoot,
        workspaceRoot,
        input: { file_path: `${workspaceRoot}/package.json` },
      },
    })

    expect(result).toEqual({ status: 'queued', runtimeSessionId: 'runtime-001' })
    expect(createSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      roleAgentId: 'agent-fe',
      runtimeType: 'claude_code',
      cwd: workspaceRoot,
    }))
    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({
      runtimeType: 'claude_code',
      nativeSessionId: 'claude-native-001',
      cwd: workspaceRoot,
      prompt: expect.stringContaining('AgentHub approved native CLI tool continuation.'),
    }))
    const queuedJob = enqueueMock.mock.calls[0]?.[0] as { prompt?: string }
    expect(queuedJob.prompt).toContain('Tool: Read')
    expect(queuedJob.prompt).toContain(`Target paths: ${workspaceRoot}/package.json`)
    expect(queuedJob.prompt).toContain('AgentHub has already executed this exact approved native tool request')
    expect(queuedJob.prompt).toContain('Read /Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/package.json')
    expect(queuedJob.prompt).toContain('Node.js + Express + better-sqlite3 + plain HTML/CSS/JS')
    expect(queuedJob.prompt).toContain('continue implementation without AskUserQuestion')
    expect(queuedJob).toEqual(expect.objectContaining({
      approvedNativeTool: expect.objectContaining({
        toolName: 'Read',
        actionKind: 'read_file',
        executed: true,
        targetPaths: [`${workspaceRoot}/package.json`],
      }),
    }))
    expect(queuedJob.prompt).not.toContain(`Command: shell_command: ${workspaceRoot}`)
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'actions',
        id: 'action-read-approval',
        values: expect.objectContaining({
          result: expect.objectContaining({
            source: 'runtime_permission_broker',
            originalRuntimeSessionId: 'runtime-original',
            toolName: 'Read',
            dispatch: 'queued',
            runtimeSessionId: 'runtime-001',
            approvedNativeTool: expect.objectContaining({
              toolName: 'Read',
              executed: true,
            }),
          }),
        }),
      }),
    ]))
  })

  it('executes brokered Claude Write approvals in the workspace before continuation', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db } = dispatchDb()

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-write-approval',
      session_id: 'session-001',
      owner_id: 'user-001',
      action_type: 'write_file',
      command: `Write: ${workspaceRoot}/server.js`,
      cwd: workspaceRoot,
      result: {
        source: 'runtime_permission_broker',
        runtimeSessionId: 'runtime-original',
        originalRuntimeSessionId: 'runtime-original',
        toolCallId: 'tool-write-1',
        toolName: 'Write',
        actionKind: 'write_file',
        runtimeType: 'claude_code',
        roleAgentId: 'agent-fe',
        nativeSessionId: 'claude-native-001',
        targetPaths: [`${workspaceRoot}/server.js`],
        cwd: workspaceRoot,
        workspaceRoot,
        input: { file_path: `${workspaceRoot}/server.js`, content: 'console.log("ok")\n' },
      },
    })

    expect(result).toEqual({ status: 'queued', runtimeSessionId: 'runtime-001' })
    expect(mkdirMock).toHaveBeenCalled()
    expect(writeFileMock).toHaveBeenCalledWith(`${workspaceRoot}/server.js`, 'console.log("ok")\n', 'utf8')
    expect(fileStore.get(`${workspaceRoot}/server.js`)).toBe('console.log("ok")\n')
    const queuedJob = enqueueMock.mock.calls[0]?.[0] as { prompt?: string; approvedNativeTool?: unknown }
    expect(queuedJob.prompt).toContain(`Wrote 18 bytes to ${workspaceRoot}/server.js`)
    expect(queuedJob.approvedNativeTool).toEqual(expect.objectContaining({
      toolCallId: 'tool-write-1',
      toolName: 'Write',
      actionKind: 'write_file',
      executed: true,
      output: `Wrote 18 bytes to ${workspaceRoot}/server.js`,
    }))
  })

  it('executes brokered Claude Glob approvals as workspace-bound read enumeration', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db } = dispatchDb()

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-glob-approval',
      session_id: 'session-001',
      owner_id: 'user-001',
      action_type: 'shell_command',
      command: 'Glob (shell_command)',
      cwd: workspaceRoot,
      result: {
        source: 'runtime_permission_broker',
        runtimeSessionId: 'runtime-original',
        originalRuntimeSessionId: 'runtime-original',
        toolCallId: 'tool-glob-1',
        toolName: 'Glob',
        actionKind: 'shell_command',
        runtimeType: 'claude_code',
        roleAgentId: 'agent-fe',
        nativeSessionId: 'claude-native-001',
        targetPaths: [],
        cwd: workspaceRoot,
        workspaceRoot,
        input: { pattern: 'public/**/*' },
      },
    })

    expect(result).toEqual({ status: 'queued', runtimeSessionId: 'runtime-001' })
    expect(readdirMock).toHaveBeenCalled()
    expect(readFileMock).not.toHaveBeenCalled()
    const queuedJob = enqueueMock.mock.calls[0]?.[0] as { prompt?: string; approvedNativeTool?: unknown }
    expect(queuedJob.prompt).toContain('Tool: Glob')
    expect(queuedJob.prompt).toContain('Glob public/**/*')
    expect(queuedJob.prompt).toContain('public/app.js')
    expect(queuedJob.prompt).toContain('public/index.html')
    expect(queuedJob.approvedNativeTool).toEqual(expect.objectContaining({
      toolCallId: 'tool-glob-1',
      toolName: 'Glob',
      actionKind: 'shell_command',
      executed: true,
    }))
  })

  it('blocks brokered native tool approvals when result targetPaths point outside the selected workspace root', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db } = dispatchDb()

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-read-outside-target',
      session_id: 'session-001',
      owner_id: 'user-001',
      action_type: 'read_file',
      command: 'Read: package.json',
      cwd: workspaceRoot,
      result: {
        source: 'runtime_permission_broker',
        runtimeSessionId: 'runtime-original',
        toolCallId: 'tool-read-1',
        toolName: 'Read',
        actionKind: 'read_file',
        targetPaths: ['/Users/joytion/Documents/code/AgentHub_new_claude_test/package.json'],
        cwd: workspaceRoot,
        workspaceRoot,
        input: { file_path: '/Users/joytion/Documents/code/AgentHub_new_claude_test/package.json' },
      },
    })

    expect(result.status).toBe('unavailable')
    expect(result.error).toContain('该操作试图访问 workspace 外路径')
    expect(createSessionMock).not.toHaveBeenCalled()
    expect(enqueueMock).not.toHaveBeenCalled()
  })
})

describe('dispatchRuntimeInvokeNode', () => {
  beforeEach(() => {
    resolveEndpointMock.mockClear()
    createSessionMock.mockClear()
    isWorkerAliveMock.mockClear()
    enqueueMock.mockClear()
    process.env.REDIS_URL = 'redis://localhost:6379'
  })

  it('creates an initial attempt and inbound mailbox item before enqueueing the role runtime job', async () => {
    const { dispatchRuntimeInvokeNode } = await import('@/lib/orchestrator/action-dispatcher')
    const { db, writes } = dispatchDb()

    const result = await dispatchRuntimeInvokeNode(db as never, {
      userId: 'user-001',
      sessionId: 'session-001',
      node: {
        id: 'node-001',
        plan_id: 'plan-001',
        label: '后端工程师执行',
        agent_id: 'agent-be',
        action_payload: { phase: 'worker', userMessage: '实现 API' },
      },
    })

    expect(result).toEqual({ status: 'queued', runtimeSessionId: 'runtime-001' })
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'plan_node_attempts',
        values: expect.objectContaining({ control: 'initial', attempt_number: 1, status: 'queued' }),
      }),
      expect.objectContaining({
        table: 'agent_mailbox_items',
        values: expect.objectContaining({ to_role_agent_id: 'agent-be', runtime_type: 'codex', attempt_id: 'attempt-001', status: 'queued' }),
      }),
      expect.objectContaining({
        table: 'plan_node_attempts',
        values: expect.objectContaining({ status: 'running', runtime_session_id: 'runtime-001' }),
        id: 'attempt-001',
      }),
      expect.objectContaining({
        table: 'plan_nodes',
        values: expect.objectContaining({ status: 'running', result: expect.objectContaining({ attemptId: 'attempt-001', mailboxItemId: 'mailbox-001' }) }),
        id: 'node-001',
      }),
    ]))
    expect(createSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      roleAgentId: 'agent-be',
      runtimeType: 'codex',
      cwd: workspaceRoot,
    }))
    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({
      runtimeSessionId: 'runtime-001',
      runtimeType: 'codex',
      cwd: workspaceRoot,
      planNodeId: 'node-001',
      attemptId: 'attempt-001',
      mailboxItemId: 'mailbox-001',
      nativeSessionId: 'native-001',
    }))
  })

  it('routes from role runtime_type and ignores legacy runtime capability tags', async () => {
    const { dispatchRuntimeInvokeNode } = await import('@/lib/orchestrator/action-dispatcher')
    const { db, writes } = dispatchDb({
      role: {
        runtime_type: 'claude_code',
        capabilities: ['runtime:codex', 'api'],
      },
    })

    const result = await dispatchRuntimeInvokeNode(db as never, {
      userId: 'user-001',
      sessionId: 'session-001',
      node: {
        id: 'node-legacy-tag',
        plan_id: 'plan-001',
        label: '旧标签不参与路由',
        agent_id: 'agent-be',
        action_payload: { phase: 'worker', userMessage: '实现 API' },
      },
    })

    expect(result).toEqual({ status: 'queued', runtimeSessionId: 'runtime-001' })
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'agent_mailbox_items',
        values: expect.objectContaining({ runtime_type: 'claude_code' }),
      }),
    ]))
    expect(createSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      runtimeType: 'claude_code',
      cwd: workspaceRoot,
    }))
    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({
      runtimeType: 'claude_code',
      cwd: workspaceRoot,
      planNodeId: 'node-legacy-tag',
    }))
  })

  it('fails closed when the cloud workspace root is missing', async () => {
    const { dispatchRuntimeInvokeNode } = await import('@/lib/orchestrator/action-dispatcher')
    const { db, writes } = dispatchDb({ workspace: { cloud_project_dir: null } })

    const result = await dispatchRuntimeInvokeNode(db as never, {
      userId: 'user-001',
      sessionId: 'session-001',
      node: {
        id: 'node-missing-root',
        plan_id: 'plan-001',
        label: '缺少工作区目录',
        agent_id: 'agent-be',
        action_payload: { phase: 'worker', userMessage: '实现 API' },
      },
    })

    expect(result).toEqual({
      status: 'unavailable',
      error: '云端工作区目录缺失，节点未投递 Runtime。',
    })
    expect(createSessionMock).not.toHaveBeenCalled()
    expect(enqueueMock).not.toHaveBeenCalled()
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'plan_nodes',
        values: expect.objectContaining({
          status: 'failed',
          result: { error: '云端工作区目录缺失，节点未投递 Runtime。' },
        }),
        id: 'node-missing-root',
      }),
    ]))
  })
})
