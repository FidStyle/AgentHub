import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mockMessage,
  mockSession,
  mockUser,
  mockWorkspace,
  resetMockAuth,
  resetMockClient,
  setupMockAuth,
  setupMockClient,
} from '../utils'

async function callTimeline(sessionId = 'session-001') {
  const { GET } = await import('@/app/api/sessions/[id]/timeline/route')
  const response = await GET(new Request(`http://localhost/api/sessions/${sessionId}/timeline`), {
    params: Promise.resolve({ id: sessionId }),
  })
  return { status: response.status, data: await response.json() }
}

function orderRows<T extends { created_at?: string }>(rows: T[]) {
  return [...rows].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))
}

function sessionTimelineChain(owner = true) {
  const session = owner ? mockSession : { ...mockSession, workspace_id: 'ws-other' }
  const workspace = owner ? mockWorkspace : null
  const messages = [
    mockMessage,
    {
      ...mockMessage,
      id: 'msg-ack-001',
      sender_type: 'agent',
      role_agent_id: 'agent-architect',
      message_type: 'role_acknowledgement',
      content: '作为架构师，我会先读取 README，再分派前端和后端工程师。',
      created_at: '2026-06-06T00:00:01.000Z',
    },
  ]
  const plans = [
    {
      id: 'plan-001',
      session_id: 'session-001',
      owner_id: mockUser.id,
      title: '计算器网站交付',
      status: 'running',
      created_at: '2026-06-06T00:00:02.000Z',
    },
  ]
  const planNodes = [
    {
      id: 'node-fe-001',
      plan_id: 'plan-001',
      label: '前端工程师实现 UI',
      agent_id: 'agent-fe',
      action_type: 'runtime_invoke',
      status: 'completed',
      created_at: '2026-06-06T00:00:03.000Z',
    },
  ]
  const attempts = [
    {
      id: 'attempt-fe-001',
      plan_node_id: 'node-fe-001',
      attempt_number: 1,
      runtime_session_id: 'runtime-fe-001',
      status: 'completed',
      created_at: '2026-06-06T00:00:04.000Z',
    },
  ]
  const mailboxItems = [
    {
      id: 'mailbox-fe-001',
      plan_node_id: 'node-fe-001',
      to_role_agent_id: 'agent-fe',
      attempt_id: 'attempt-fe-001',
      status: 'completed',
      context_package: {
        toRoleName: '前端工程师',
        summary: '请完成计算器 UI 并接入历史记录。',
      },
      created_at: '2026-06-06T00:00:05.000Z',
    },
  ]
  const runtimeSessions = [
    {
      id: 'runtime-fe-001',
      session_id: 'session-001',
      role_agent_id: 'agent-fe',
      runtime_type: 'claude_code',
      native_session_id: 'native-fe-001',
      status: 'completed',
      created_at: '2026-06-06T00:00:06.000Z',
    },
    {
      id: 'runtime-validator-001',
      session_id: 'session-001',
      role_agent_id: 'agent-architect',
      runtime_type: 'codex',
      status: 'completed',
      created_at: '2026-06-06T00:00:07.000Z',
    },
  ]
  const actions = [
    {
      id: 'action-deploy-001',
      session_id: 'session-001',
      action_type: 'deploy',
      command: 'AgentHub 本地静态部署当前工作区',
      status: 'approved',
      result: {
        deployment: {
          previewPath: 'workspace-file:ws-001:public/index.html',
          manifestPath: '.agenthub/deployments/action-deploy-001/manifest.json',
        },
      },
      created_at: '2026-06-06T00:00:08.000Z',
    },
  ]
  const artifacts = [
    {
      id: 'artifact-deploy-001',
      session_id: 'session-001',
      title: '部署结果',
      source_path: '.agenthub/deployments/action-deploy-001/manifest.json',
      content_ref: 'workspace-file:ws-001:public/index.html',
      metadata: {
        kind: 'deployment',
        actionId: 'action-deploy-001',
        previewPath: 'workspace-file:ws-001:public/index.html',
        manifestPath: '.agenthub/deployments/action-deploy-001/manifest.json',
      },
      created_at: '2026-06-06T00:00:09.000Z',
    },
    {
      id: 'artifact-html-001',
      session_id: 'session-001',
      title: '计算器网站',
      source_path: 'public/index.html',
      content_ref: 'workspace-file:ws-001:public/index.html',
      metadata: {
        startCommand: 'bash .agenthub/run-artifact-html-001.sh',
      },
      created_at: '2026-06-06T00:00:10.000Z',
    },
  ]

  const chainFactory = vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'sessions') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({ data: session, error: session ? null : { message: 'Not found' } }),
            }),
          }),
        }
      }
      if (table === 'workspaces') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => ({ data: workspace, error: workspace ? null : { message: 'Not found' } }),
              }),
            }),
          }),
        }
      }
      if (table === 'messages') {
        return { select: () => ({ eq: () => ({ order: () => ({ data: orderRows(messages), error: null }) }) }) }
      }
      if (table === 'plans') {
        return { select: () => ({ eq: () => ({ order: () => ({ data: orderRows(plans), error: null }) }) }) }
      }
      if (table === 'actions') {
        return { select: () => ({ eq: () => ({ order: () => ({ data: orderRows(actions), error: null }) }) }) }
      }
      if (table === 'artifacts') {
        return { select: () => ({ eq: () => ({ order: () => ({ data: orderRows(artifacts), error: null }) }) }) }
      }
      if (table === 'plan_nodes') {
        return { select: () => ({ in: () => ({ order: () => ({ data: orderRows(planNodes), error: null }) }) }) }
      }
      if (table === 'plan_node_attempts') {
        return { select: () => ({ in: () => ({ order: () => ({ data: orderRows(attempts), error: null }) }) }) }
      }
      if (table === 'agent_mailbox_items') {
        return { select: () => ({ in: () => ({ order: () => ({ data: orderRows(mailboxItems), error: null }) }) }) }
      }
      if (table === 'runtime_sessions') {
        return {
          select: () => ({
            eq: () => ({ order: () => ({ data: orderRows(runtimeSessions), error: null }) }),
            in: (_field: string, ids: string[]) => ({
              order: () => ({
                data: orderRows(runtimeSessions.filter((row) => ids.includes(row.id))),
                error: null,
              }),
            }),
          }),
        }
      }
      return { select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }) }
    }),
  }))

  return { chainFactory }
}

describe('GET /api/sessions/[id]/timeline', () => {
  beforeEach(() => {
    resetMockAuth()
    resetMockClient()
    setupMockAuth()
  })

  it('returns a typed timeline with messages, orchestration, runtime, actions, artifacts, and deployments', async () => {
    const { chainFactory } = sessionTimelineChain()
    setupMockClient(chainFactory)

    const result = await callTimeline()

    expect(result.status).toBe(200)
    expect(result.data.sessionId).toBe('session-001')
    expect(result.data.workspaceId).toBe('ws-001')
    expect(result.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'message',
        refs: expect.objectContaining({ messageType: 'role_acknowledgement' }),
        summary: expect.stringContaining('分派前端和后端工程师'),
      }),
      expect.objectContaining({ kind: 'plan', title: expect.stringContaining('计算器网站交付') }),
      expect.objectContaining({ kind: 'plan_node', roleAgentId: 'agent-fe', title: expect.stringContaining('前端工程师实现 UI') }),
      expect.objectContaining({ kind: 'attempt', refs: expect.objectContaining({ runtimeSessionId: 'runtime-fe-001' }) }),
      expect.objectContaining({ kind: 'mailbox', roleName: '前端工程师' }),
      expect.objectContaining({ kind: 'runtime', refs: expect.objectContaining({ runtimeSessionId: 'runtime-validator-001' }) }),
      expect.objectContaining({
        kind: 'deployment',
        refs: expect.objectContaining({
          actionId: 'action-deploy-001',
          artifactId: 'artifact-deploy-001',
          previewPath: 'workspace-file:ws-001:public/index.html',
          manifestPath: '.agenthub/deployments/action-deploy-001/manifest.json',
        }),
      }),
      expect.objectContaining({ kind: 'artifact', refs: expect.objectContaining({ artifactId: 'artifact-html-001' }) }),
    ]))
  })

  it('does not synthesize epoch timestamps or verbose observed-action JSON in process timeline', async () => {
    const { chainFactory } = sessionTimelineChain()
    setupMockClient(chainFactory)

    const result = await callTimeline()

    expect(result.status).toBe(200)
    const deployment = (result.data.items as Array<{ kind: string; createdAt: string; summary: string }>).find((item) => item.kind === 'deployment')
    expect(deployment?.createdAt).not.toBe('1970-01-01T00:00:00.000Z')
    expect(deployment?.summary).toBe('AgentHub 本地静态部署当前工作区')
    expect(JSON.stringify(result.data.items)).not.toContain('aggregated_output')
  })

  it('rejects sessions outside the current user workspace', async () => {
    const { chainFactory } = sessionTimelineChain(false)
    setupMockClient(chainFactory)

    const result = await callTimeline()

    expect(result.status).toBe(403)
    expect(result.data).toEqual({ error: '无权限' })
  })
})
