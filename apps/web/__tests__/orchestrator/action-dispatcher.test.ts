import { describe, it, expect, beforeEach, vi } from 'vitest'

const {
  resolveEndpointMock,
  createSessionMock,
  isWorkerAliveMock,
  enqueueMock,
  execFileMock,
  spawnMock,
  spawnSyncMock,
  workspaceRoot,
  fileStore,
  readFileMock,
  readdirMock,
  writeFileMock,
  mkdirMock,
  accessMock,
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
  createSessionMock: vi.fn(async (input: { cwd?: string | null; reuseNativeSession?: boolean }) => ({
    id: 'runtime-001',
    nativeSessionId: input.reuseNativeSession === false ? null : 'native-001',
    cwd: input.cwd,
  })),
  isWorkerAliveMock: vi.fn(async () => true),
  enqueueMock: vi.fn(async (_input: unknown) => undefined),
  execFileMock: vi.fn((_command: string, _args: string[], _options: Record<string, unknown>, callback: (err: Error | null, stdout: string, stderr: string) => void) => {
    callback(null, 'verification passed\n', '')
  }),
  spawnMock: vi.fn(() => ({
    pid: 4321,
    unref: vi.fn(),
  })),
  spawnSyncMock: vi.fn(() => ({ status: 0, stdout: '', stderr: '' })),
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
  accessMock: vi.fn(async () => undefined),
}})

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
  spawn: spawnMock,
  spawnSync: spawnSyncMock,
}))

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: readFileMock,
    readdir: readdirMock,
    writeFile: writeFileMock,
    mkdir: mkdirMock,
    access: accessMock,
  },
  readFile: readFileMock,
  readdir: readdirMock,
  writeFile: writeFileMock,
  mkdir: mkdirMock,
  access: accessMock,
}))

vi.mock('@/lib/runtime/gateway', () => ({
  resolveEndpoint: (input: unknown) => resolveEndpointMock(input),
  createSession: (input: unknown) => createSessionMock(input as { cwd?: string | null }),
}))

vi.mock('@/lib/runtime/redis-client', () => ({
  isWorkerAlive: () => isWorkerAliveMock(),
  enqueue: (input: unknown) => enqueueMock(input),
}))

function dispatchDb(overrides: { role?: Record<string, unknown>; workspace?: Record<string, unknown> | null; attempts?: Array<Record<string, unknown>> } = {}) {
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
    workspace_id: 'ws-001',
    enabled_tool_ids: ['file_read', 'file_write', 'shell', 'artifact_store', 'publish_service', 'diff_apply', 'ppt_master'],
    ...overrides.role,
  }
  const roles = [
    role,
    {
      id: 'agent-artifact',
      workspace_id: 'ws-001',
      name: '产物助手',
      system_prompt: '你是产物助手',
      runtime_type: 'codex',
      enabled_tool_ids: ['file_read', 'artifact_store', 'publish_service'],
    },
  ]

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
          return {
            select: () => ({
              eq: (field: string, value: string) => ({
                single: () => ({ data: field === 'id' ? roles.find((item) => item.id === value) ?? null : role, error: null }),
                order: () => ({ data: field === 'workspace_id' ? roles.filter((item) => item.workspace_id === value) : roles, error: null }),
                eq: () => ({ single: () => ({ data: role, error: null }) }),
              }),
            }),
          }
        }
        if (table === 'plan_node_attempts') {
          return {
            select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ data: overrides.attempts ?? [], error: null }) }) }) }),
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
        if (table === 'actions') {
          return {
            insert: (values: Record<string, unknown>) => {
              writes.push({ table, values })
              return {
                data: { id: 'action-runtime-preapproval', ...values },
                error: null,
                select: () => ({ single: () => ({ data: { id: 'action-runtime-preapproval', ...values }, error: null }) }),
              }
            },
            update: (values: Record<string, unknown>) => ({
              eq: (_field: string, id: string) => {
                writes.push({ table, values, id })
                return { data: null, error: null }
              },
            }),
          }
        }
        if (table === 'notifications') {
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
        if (table === 'artifacts') {
          return {
            insert: (values: Record<string, unknown>) => {
              writes.push({ table, values })
              return { select: () => ({ single: () => ({ data: { id: 'artifact-deploy-001', ...values }, error: null }) }) }
            },
          }
        }
        if (table === 'messages') {
          return {
            insert: (values: Record<string, unknown>) => {
              writes.push({ table, values })
              return { data: null, error: null }
            },
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
    execFileMock.mockClear()
    spawnMock.mockClear()
    spawnSyncMock.mockClear()
    readFileMock.mockClear()
    readdirMock.mockClear()
    writeFileMock.mockClear()
    mkdirMock.mockClear()
    accessMock.mockClear()
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
          status: 'failed',
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

  it('blocks role-scoped actions when the role lacks the required tool', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db, writes } = dispatchDb({ role: { enabled_tool_ids: ['file_read'] } })

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-shell-no-tool',
      session_id: 'session-001',
      owner_id: 'user-001',
      role_agent_id: 'agent-be',
      action_type: 'shell',
      command: 'pnpm test',
      cwd: workspaceRoot,
      runtime_type: 'codex',
    })

    expect(result.status).toBe('unsupported')
    expect(result.error).toContain('未启用「执行命令」工具')
    expect(createSessionMock).not.toHaveBeenCalled()
    expect(enqueueMock).not.toHaveBeenCalled()
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'actions',
        id: 'action-shell-no-tool',
        values: expect.objectContaining({ status: 'failed' }),
      }),
    ]))
  })

  it('blocks an approved action when command targets an absolute path outside the workspace root', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db, writes } = dispatchDb()

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-outside-target',
      session_id: 'session-001',
      owner_id: 'user-001',
      plan_node_id: 'node-front-end',
      action_type: 'shell',
      command: 'cat /Users/joytion/Documents/code/AgentHub_new_claude_test/package.json',
      cwd: workspaceRoot,
      runtime_type: 'codex',
    })

    expect(result.status).toBe('unavailable')
    expect(result.error).toContain('该操作试图访问 workspace 外路径')
    expect(createSessionMock).not.toHaveBeenCalled()
    expect(enqueueMock).not.toHaveBeenCalled()
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'actions',
        id: 'action-outside-target',
        values: expect.objectContaining({
          status: 'failed',
          result: expect.objectContaining({ dispatch: 'unavailable' }),
        }),
      }),
      expect.objectContaining({
        table: 'plan_nodes',
        id: 'node-front-end',
        values: expect.objectContaining({
          status: 'failed',
          result: expect.objectContaining({ dispatch: 'unavailable' }),
        }),
      }),
    ]))
  })

  it('allows shell interpreter paths and readonly runtime skill files without opening host repo access', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db } = dispatchDb()
    const command = '/bin/zsh -lc "sed -n \'1,220p\' /Users/joytion/.codex/plugins/cache/openai-primary-runtime/presentations/26.601.10930/skills/presentations/SKILL.md && wc -l /Users/joytion/.codex/plugins/cache/openai-primary-runtime/presentations/26.601.10930/skills/presentations/SKILL.md && pwd && rg --files"'

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-read-runtime-skill',
      session_id: 'session-001',
      owner_id: 'user-001',
      plan_node_id: 'node-ppt',
      action_type: 'shell_command',
      command,
      cwd: workspaceRoot,
      runtime_type: 'codex',
    })

    expect(result).toEqual({ status: 'queued', runtimeSessionId: 'runtime-001' })
    expect(createSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      cwd: workspaceRoot,
    }))
    expect(enqueueMock).toHaveBeenCalled()
  })

  it('still blocks host repository paths when the command is wrapped by a shell interpreter', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db } = dispatchDb()

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-shell-host-repo-target',
      session_id: 'session-001',
      owner_id: 'user-001',
      action_type: 'shell_command',
      command: '/bin/zsh -lc "cat /Users/joytion/Documents/code/AgentHub_new_claude_test/package.json"',
      cwd: workspaceRoot,
      runtime_type: 'codex',
    })

    expect(result.status).toBe('unavailable')
    expect(result.error).toContain('/Users/joytion/Documents/code/AgentHub_new_claude_test/package.json')
    expect(createSessionMock).not.toHaveBeenCalled()
    expect(enqueueMock).not.toHaveBeenCalled()
  })

  it('blocks destructive commands against runtime skill files outside the workspace', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db } = dispatchDb()

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-delete-runtime-skill',
      session_id: 'session-001',
      owner_id: 'user-001',
      action_type: 'destructive_command',
      command: 'rm -f /Users/joytion/.codex/plugins/cache/openai-primary-runtime/presentations/26.601.10930/skills/presentations/SKILL.md',
      cwd: workspaceRoot,
      runtime_type: 'codex',
    })

    expect(result.status).toBe('unavailable')
    expect(result.error).toContain('该操作试图访问 workspace 外路径')
    expect(createSessionMock).not.toHaveBeenCalled()
    expect(enqueueMock).not.toHaveBeenCalled()
  })

  it('does not treat URL paths in approved network commands as filesystem absolute paths', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db } = dispatchDb()
    const command = 'curl -s -X POST http://127.0.0.1:3100/api/calculate -H "content-type: application/json" -d \'{"leftOperand":12,"operator":"/","rightOperand":3}\''

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-local-network',
      session_id: 'session-001',
      owner_id: 'user-001',
      action_type: 'network_request',
      command,
      cwd: workspaceRoot,
      runtime_type: 'claude_code',
    })

    expect(result).toEqual({ status: 'queued', runtimeSessionId: 'runtime-001' })
    expect(createSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      cwd: workspaceRoot,
    }))
    expect(enqueueMock).toHaveBeenCalled()
  })

  it('completes approved deploy actions with a durable manifest, artifact, and result message', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db, writes } = dispatchDb()

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-deploy-approval',
      session_id: 'session-001',
      owner_id: 'user-001',
      action_type: 'deploy',
      command: 'AgentHub 本地静态部署当前工作区',
      cwd: workspaceRoot,
      result: {
        source: 'chat_deploy_request',
        actionKind: 'deploy',
        workspaceRoot,
        cwd: workspaceRoot,
        targetPaths: [workspaceRoot],
      },
    })

    expect(result).toEqual({ status: 'completed' })
    expect(resolveEndpointMock).not.toHaveBeenCalled()
    expect(createSessionMock).not.toHaveBeenCalled()
    expect(enqueueMock).not.toHaveBeenCalled()
    expect(mkdirMock).toHaveBeenCalledWith(`${workspaceRoot}/.agenthub/deployments/action-deploy-approval`, { recursive: true })
    expect(writeFileMock).toHaveBeenCalledWith(
      `${workspaceRoot}/.agenthub/deployments/action-deploy-approval/manifest.json`,
      expect.stringContaining('"status": "completed"'),
      'utf8',
    )
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'artifacts',
        values: expect.objectContaining({
          artifact_type: 'markdown',
          title: '部署结果',
          content_ref: 'workspace-file:ws-001:public/index.html',
          source_path: '.agenthub/deployments/action-deploy-approval/manifest.json',
          metadata: expect.objectContaining({
            kind: 'deployment',
            actionId: 'action-deploy-approval',
            status: 'completed',
            previewPath: 'workspace-file:ws-001:public/index.html',
            manifestPath: '.agenthub/deployments/action-deploy-approval/manifest.json',
          }),
        }),
      }),
      expect.objectContaining({
        table: 'messages',
        values: expect.objectContaining({
          message_type: 'result_card',
          metadata: expect.objectContaining({
            deployment: expect.objectContaining({
              actionId: 'action-deploy-approval',
              artifactId: 'artifact-deploy-001',
              status: 'completed',
            }),
            runtimeParts: expect.arrayContaining([
              expect.objectContaining({
                type: 'artifact',
                artifactId: 'artifact-deploy-001',
                title: '部署结果',
              }),
              expect.objectContaining({
                type: 'web_preview',
                status: 'created',
                title: '部署预览',
                iframeUrl: '/m/preview?artifactId=artifact-deploy-001',
              }),
              expect.objectContaining({
                type: 'publish_status',
                status: 'running',
                artifactId: 'artifact-deploy-001',
                title: '部署状态',
              }),
            ]),
          }),
        }),
      }),
      expect.objectContaining({
        table: 'actions',
        id: 'action-deploy-approval',
        values: expect.objectContaining({
          status: 'completed',
          result: expect.objectContaining({
            source: 'chat_deploy_request',
            actionKind: 'deploy',
            dispatch: 'completed',
            artifactId: 'artifact-deploy-001',
            previewPath: 'workspace-file:ws-001:public/index.html',
            manifestPath: '.agenthub/deployments/action-deploy-approval/manifest.json',
          }),
        }),
      }),
      expect.objectContaining({
        table: 'notifications',
        values: expect.objectContaining({
          type: 'deployment_completed',
          ref_type: 'action',
          ref_id: 'action-deploy-approval',
        }),
      }),
    ]))
  })

  it('completes approved presentation generation with a PPTX artifact and IM preview card', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db, writes } = dispatchDb({
      role: {
        id: 'agent-ppt',
        name: '演示稿工程师',
        enabled_tool_ids: ['ppt_master', 'artifact_store', 'file_read', 'file_write'],
      },
    })

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-ppt-001',
      session_id: 'session-001',
      owner_id: 'user-001',
      action_type: 'presentation_generate',
      command: '生成一份三页项目汇报 PPT',
      cwd: workspaceRoot,
      role_agent_id: 'agent-ppt',
      result: {
        title: '项目汇报',
        prompt: '生成一份三页项目汇报 PPT',
      },
    })

    expect(result).toEqual({ status: 'completed' })
    expect(resolveEndpointMock).not.toHaveBeenCalled()
    expect(createSessionMock).not.toHaveBeenCalled()
    expect(enqueueMock).not.toHaveBeenCalled()
    expect(mkdirMock).toHaveBeenCalledWith(`${workspaceRoot}/artifacts/项目汇报`, { recursive: true })
    expect(writeFileMock).toHaveBeenCalledWith(`${workspaceRoot}/artifacts/项目汇报/deck.pptx`, expect.any(Buffer))
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'artifacts',
        values: expect.objectContaining({
          artifact_type: 'presentation',
          title: '项目汇报',
          source_path: 'artifacts/项目汇报/deck.pptx',
          metadata: expect.objectContaining({
            kind: 'presentation_generated',
            previewKind: 'presentation',
          }),
        }),
      }),
      expect.objectContaining({
        table: 'messages',
        values: expect.objectContaining({
          role_agent_id: 'agent-artifact',
          message_type: 'result_card',
          metadata: expect.objectContaining({
            runtimeParts: expect.arrayContaining([
              expect.objectContaining({ type: 'artifact', artifactType: 'presentation' }),
              expect.objectContaining({ type: 'presentation_preview', title: '项目汇报' }),
            ]),
          }),
        }),
      }),
      expect.objectContaining({
        table: 'actions',
        id: 'action-ppt-001',
        values: expect.objectContaining({
          status: 'completed',
          result: expect.objectContaining({
            dispatch: 'completed',
            pptxPath: 'artifacts/项目汇报/deck.pptx',
          }),
        }),
      }),
      expect.objectContaining({
        table: 'notifications',
        values: expect.objectContaining({
          type: 'presentation_generated',
          ref_id: 'action-ppt-001',
        }),
      }),
    ]))
  })

  it('allows /dev/null as a network command output sink while preserving workspace path checks', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db } = dispatchDb()
    const command = 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3100/api/calculate -X POST -H "content-type: application/json" -d \'{"leftOperand":1,"operator":"/","rightOperand":0}\''

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-local-network-dev-null',
      session_id: 'session-001',
      owner_id: 'user-001',
      action_type: 'network_request',
      command,
      cwd: workspaceRoot,
      runtime_type: 'claude_code',
    })

    expect(result).toEqual({ status: 'queued', runtimeSessionId: 'runtime-001' })
    expect(enqueueMock).toHaveBeenCalled()
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

  it('preserves automatic permission mode when enqueueing approved continuation jobs', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db } = dispatchDb()

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-auto-write',
      session_id: 'session-001',
      owner_id: 'user-001',
      action_type: 'write_file',
      command: `Write: ${workspaceRoot}/server.js`,
      cwd: workspaceRoot,
      result: {
        source: 'runtime_permission_broker',
        runtimeSessionId: 'runtime-original',
        originalRuntimeSessionId: 'runtime-original',
        toolCallId: 'tool-auto-write',
        toolName: 'Write',
        actionKind: 'write_file',
        runtimeType: 'claude_code',
        roleAgentId: 'agent-fe',
        nativeSessionId: 'claude-native-001',
        permissionMode: 'auto',
        targetPaths: [`${workspaceRoot}/server.js`],
        cwd: workspaceRoot,
        workspaceRoot,
        input: { file_path: `${workspaceRoot}/server.js`, content: 'console.log("auto")\n' },
      },
    })

    expect(result).toEqual({ status: 'queued', runtimeSessionId: 'runtime-001' })
    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({
      permissionMode: 'auto',
      actionId: 'action-auto-write',
      approvedNativeTool: expect.objectContaining({
        toolCallId: 'tool-auto-write',
        executed: true,
      }),
    }))
  })

  it('binds approved native tool continuations back to the original attempt and mailbox', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db, writes } = dispatchDb({
      attempts: [{
        id: 'attempt-runtime-approval',
        attempt_number: 2,
        runtime_session_id: 'runtime-original',
        mailbox_item_id: 'mailbox-runtime-approval',
      }],
    })

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-approved-read',
      session_id: 'session-001',
      owner_id: 'user-001',
      plan_node_id: 'node-runtime-approval',
      action_type: 'read_file',
      command: `Read: ${workspaceRoot}/package.json`,
      cwd: workspaceRoot,
      result: {
        source: 'runtime_permission_broker',
        runtimeSessionId: 'runtime-original',
        originalRuntimeSessionId: 'runtime-original',
        toolCallId: 'tool-read-approval',
        toolName: 'Read',
        actionKind: 'read_file',
        runtimeType: 'codex',
        roleAgentId: 'agent-be',
        nativeSessionId: 'codex-native-001',
        permissionMode: 'standard',
        targetPaths: [`${workspaceRoot}/package.json`],
        cwd: workspaceRoot,
        workspaceRoot,
        input: { file_path: `${workspaceRoot}/package.json` },
      },
    })

    expect(result).toEqual({ status: 'queued', runtimeSessionId: 'runtime-001' })
    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'action-approved-read',
      planNodeId: 'node-runtime-approval',
      attemptId: 'attempt-runtime-approval',
      mailboxItemId: 'mailbox-runtime-approval',
    }))
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'plan_node_attempts',
        id: 'attempt-runtime-approval',
        values: expect.objectContaining({
          status: 'running',
          runtime_session_id: 'runtime-001',
        }),
      }),
      expect.objectContaining({
        table: 'agent_mailbox_items',
        id: 'mailbox-runtime-approval',
        values: expect.objectContaining({ status: 'running' }),
      }),
      expect.objectContaining({
        table: 'plan_nodes',
        id: 'node-runtime-approval',
        values: expect.objectContaining({
          status: 'running',
          result: expect.objectContaining({
            runtimeSessionId: 'runtime-001',
            attemptId: 'attempt-runtime-approval',
            mailboxItemId: 'mailbox-runtime-approval',
          }),
        }),
      }),
    ]))
  })

  it('queues runtime invoke preapproval with the original prompt after the user allows it', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db, writes } = dispatchDb()

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-runtime-preapproval',
      session_id: 'session-001',
      owner_id: 'user-001',
      action_type: 'runtime_invoke',
      command: 'Runtime 执行：@后端工程师',
      cwd: workspaceRoot,
      result: {
        source: 'runtime_invoke_preapproval',
        actionKind: 'runtime_invoke',
        workspaceRoot,
        cwd: workspaceRoot,
        commandPreview: 'Runtime 执行：@后端工程师',
        prompt: '请创建 agenthub-permission-allow.txt',
        systemPrompt: '当前回复角色：@后端工程师',
        runtimeType: 'codex',
        roleAgentId: 'agent-be',
        roleName: '后端工程师',
        permissionMode: 'manual',
      },
    })

    expect(result).toEqual({ status: 'queued', runtimeSessionId: 'runtime-001' })
    expect(createSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      roleAgentId: 'agent-be',
      runtimeType: 'codex',
      cwd: workspaceRoot,
    }))
    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'action-runtime-preapproval',
      runtimeType: 'codex',
      roleAgentId: 'agent-be',
      cwd: workspaceRoot,
      prompt: '请创建 agenthub-permission-allow.txt',
      systemPrompt: '当前回复角色：@后端工程师',
      permissionMode: 'full_control',
    }))
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'actions',
        id: 'action-runtime-preapproval',
        values: expect.objectContaining({
          status: 'running',
          result: expect.objectContaining({
            source: 'runtime_invoke_preapproval',
            dispatch: 'queued',
            runtimeSessionId: 'runtime-001',
          }),
        }),
      }),
    ]))
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

  it('executes brokered Bash approvals inside the workspace before continuation', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db, writes } = dispatchDb()
    const command = 'DB_PATH="$(pwd)/calc-plan-verify.db" node verify.mjs; rm -f calc-plan-verify.db'

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-bash-approval',
      session_id: 'session-001',
      owner_id: 'user-001',
      action_type: 'destructive_command',
      command,
      cwd: workspaceRoot,
      result: {
        source: 'runtime_permission_broker',
        runtimeSessionId: 'runtime-original',
        originalRuntimeSessionId: 'runtime-original',
        toolCallId: 'tool-bash-1',
        toolName: 'Bash',
        actionKind: 'destructive_command',
        runtimeType: 'claude_code',
        roleAgentId: 'agent-architect',
        nativeSessionId: 'claude-native-001',
        commandPreview: command,
        targetPaths: [],
        cwd: workspaceRoot,
        workspaceRoot,
        input: { command, description: 'Run verification against a workspace temp DB' },
      },
    })

    expect(result).toEqual({ status: 'queued', runtimeSessionId: 'runtime-001' })
    expect(execFileMock).toHaveBeenCalledWith('/bin/sh', ['-lc', command], expect.objectContaining({
      cwd: workspaceRoot,
      timeout: 120_000,
    }), expect.any(Function))
    const queuedJob = enqueueMock.mock.calls[0]?.[0] as { prompt?: string; approvedNativeTool?: unknown }
    expect(queuedJob.prompt).toContain('AgentHub has already executed this exact approved native tool request')
    expect(queuedJob.prompt).toContain('verification passed')
    expect(queuedJob.prompt).toContain('Do not use /tmp')
    expect(queuedJob.approvedNativeTool).toEqual(expect.objectContaining({
      toolCallId: 'tool-bash-1',
      toolName: 'Bash',
      actionKind: 'destructive_command',
      commandPreview: command,
      executed: true,
      output: expect.stringContaining('verification passed'),
    }))
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'actions',
        id: 'action-bash-approval',
        values: expect.objectContaining({
          result: expect.objectContaining({
            source: 'runtime_permission_broker',
            dispatch: 'queued',
            approvedNativeTool: expect.objectContaining({
              toolName: 'Bash',
              commandPreview: command,
              executed: true,
            }),
          }),
        }),
      }),
    ]))
  })

  it('starts long-running brokered Bash approvals in the workspace background before continuation', async () => {
    const { dispatchApprovedAction } = await import('@/lib/orchestrator/action-dispatcher')
    const { db } = dispatchDb()
    const command = 'PORT=3100 DB_PATH="$PWD/data/verify.sqlite" node src/server.js'

    const result = await dispatchApprovedAction(db as never, {
      id: 'action-background-server',
      session_id: 'session-001',
      owner_id: 'user-001',
      action_type: 'shell_command',
      command,
      cwd: workspaceRoot,
      result: {
        source: 'runtime_permission_broker',
        runtimeSessionId: 'runtime-original',
        originalRuntimeSessionId: 'runtime-original',
        toolCallId: 'tool-bash-server',
        toolName: 'Bash',
        actionKind: 'shell_command',
        runtimeType: 'claude_code',
        roleAgentId: 'agent-fe',
        nativeSessionId: 'claude-native-001',
        commandPreview: command,
        targetPaths: [],
        cwd: workspaceRoot,
        workspaceRoot,
        input: { command, description: 'Start server for browser verification' },
      },
    })

    expect(result).toEqual({ status: 'queued', runtimeSessionId: 'runtime-001' })
    expect(execFileMock).not.toHaveBeenCalled()
    expect(spawnMock).toHaveBeenCalledWith('/bin/sh', [
      '-lc',
      expect.stringContaining(command),
    ], expect.objectContaining({
      cwd: workspaceRoot,
      detached: true,
      stdio: 'ignore',
    }))
    expect(mkdirMock).toHaveBeenCalledWith(`${workspaceRoot}/.agenthub`, { recursive: true })
    expect(writeFileMock).toHaveBeenCalledWith(
      `${workspaceRoot}/.agenthub/last-background-service.json`,
      expect.stringContaining('"pid": 4321'),
      'utf8',
    )
    const queuedJob = enqueueMock.mock.calls[0]?.[0] as { prompt?: string; approvedNativeTool?: unknown }
    expect(queuedJob.prompt).toContain('Started long-running command in the background')
    expect(queuedJob.prompt).toContain(`${workspaceRoot}/.agenthub/last-background-service.log`)
    expect(queuedJob.approvedNativeTool).toEqual(expect.objectContaining({
      toolCallId: 'tool-bash-server',
      toolName: 'Bash',
      actionKind: 'shell_command',
      commandPreview: command,
      executed: true,
      output: expect.stringContaining('Started long-running command in the background'),
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
        capability_tags: ['runtime:codex', 'api'],
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

  it('does not reuse a native Codex session for explicit retry mailbox dispatch in full-control mode', async () => {
    const { dispatchPreparedRuntimeInvokeNode } = await import('@/lib/orchestrator/action-dispatcher')
    const { db } = dispatchDb()

    const result = await dispatchPreparedRuntimeInvokeNode(db as never, {
      userId: 'user-001',
      sessionId: 'session-001',
      node: {
        id: 'node-ppt-retry',
        plan_id: 'plan-001',
        label: '演示稿工程师执行',
        action_payload: {
          cwd: workspaceRoot,
          workspaceRoot,
          phase: 'worker',
          userMessage: '生成 PPT',
        },
      },
      workspaceId: 'ws-001',
      executionDomain: 'cloud',
      role: {
        id: 'agent-ppt',
        name: '演示稿工程师',
        runtime_type: 'codex',
      },
      runtimeType: 'codex',
      permissionMode: 'full_control',
      attemptId: 'attempt-retry',
      mailboxItemId: 'mailbox-retry',
      mailboxContextPackage: {
        target: 'retry',
        metadata: { control: 'retry' },
      },
    })

    expect(result).toEqual({ status: 'queued', runtimeSessionId: 'runtime-001' })
    expect(createSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      roleAgentId: 'agent-ppt',
      runtimeType: 'codex',
      cwd: workspaceRoot,
      reuseNativeSession: false,
    }))
    expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({
      runtimeSessionId: 'runtime-001',
      nativeSessionId: null,
      permissionMode: 'full_control',
      attemptId: 'attempt-retry',
      mailboxItemId: 'mailbox-retry',
    }))
  })

  it('creates a runtime invoke approval before dispatching standard permission mailbox nodes', async () => {
    const { dispatchPreparedRuntimeInvokeNode } = await import('@/lib/orchestrator/action-dispatcher')
    const { db, writes } = dispatchDb()

    const result = await dispatchPreparedRuntimeInvokeNode(db as never, {
      userId: 'user-001',
      sessionId: 'session-001',
      node: {
        id: 'node-standard-preapproval',
        plan_id: 'plan-001',
        label: '后端工程师执行',
        action_payload: {
          cwd: workspaceRoot,
          workspaceRoot,
          phase: 'worker',
          userMessage: '创建文件',
          permissionMode: 'standard',
        },
      },
      workspaceId: 'ws-001',
      executionDomain: 'cloud',
      role: {
        id: 'agent-be',
        name: '后端工程师',
        system_prompt: '你是后端工程师',
        runtime_type: 'codex',
      },
      runtimeType: 'codex',
      permissionMode: 'standard',
      attemptId: 'attempt-standard',
      mailboxItemId: 'mailbox-standard',
    })

    expect(result).toEqual(expect.objectContaining({
      status: 'waiting',
      actionId: 'action-runtime-preapproval',
      actionKind: 'runtime_invoke',
      commandPreview: 'Runtime 执行：@后端工程师',
      workspaceRoot,
      cwd: workspaceRoot,
    }))
    expect(createSessionMock).not.toHaveBeenCalled()
    expect(enqueueMock).not.toHaveBeenCalled()
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'actions',
        values: expect.objectContaining({
          action_type: 'runtime_invoke',
          status: 'pending',
          requires_approval: true,
          result: expect.objectContaining({
            source: 'runtime_invoke_preapproval',
            planNodeId: 'node-standard-preapproval',
            permissionMode: 'standard',
            runtimeType: 'codex',
            attemptId: 'attempt-standard',
            mailboxItemId: 'mailbox-standard',
          }),
        }),
      }),
      expect.objectContaining({
        table: 'plan_node_attempts',
        id: 'attempt-standard',
        values: expect.objectContaining({
          status: 'waiting',
          error: '等待用户确认是否允许 Runtime 执行。',
        }),
      }),
      expect.objectContaining({
        table: 'agent_mailbox_items',
        id: 'mailbox-standard',
        values: expect.objectContaining({
          status: 'waiting',
          error: '等待用户确认是否允许 Runtime 执行。',
        }),
      }),
      expect.objectContaining({
        table: 'plan_nodes',
        id: 'node-standard-preapproval',
        values: expect.objectContaining({
          status: 'waiting',
          result: expect.objectContaining({
            actionId: 'action-runtime-preapproval',
            permissionMode: 'standard',
          }),
        }),
      }),
      expect.objectContaining({
        table: 'messages',
        values: expect.objectContaining({
          message_type: 'approval',
          metadata: expect.objectContaining({
            runtimeParts: expect.arrayContaining([
              expect.objectContaining({
                type: 'permission',
                status: 'pending',
                actionId: 'action-runtime-preapproval',
                permissionMode: 'standard',
              }),
            ]),
          }),
        }),
      }),
    ]))
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
