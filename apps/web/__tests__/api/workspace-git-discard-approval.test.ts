import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  mockUser,
  resetMockAuth,
  resetMockClient,
  setupMockAuth,
  setupMockClient,
} from '../utils'

const { discardWorkspaceGitPathMock, readWorkspaceGitStatusMock } = vi.hoisted(() => ({
  discardWorkspaceGitPathMock: vi.fn(async (_root: string, _filePath: string) => undefined),
  readWorkspaceGitStatusMock: vi.fn(async (_root: string) => []),
}))

vi.mock('@/lib/workspace/cloud-workspace-fs', () => ({
  cloudWorkspaceDir: (_owner: unknown, workspace: { cloud_project_dir?: string | null }) => workspace.cloud_project_dir ?? '/tmp/ws-001',
  discardWorkspaceGitPath: (root: string, filePath: string) => discardWorkspaceGitPathMock(root, filePath),
  ensureCloudWorkspaceProject: vi.fn(async () => '/tmp/ws-001'),
  readWorkspaceGitStatus: (root: string) => readWorkspaceGitStatusMock(root),
}))

async function callDiscard(body: unknown) {
  const { POST } = await import('@/app/api/workspaces/[id]/git/discard/route')
  const response = await POST(new Request('http://localhost/api/workspaces/ws-001/git/discard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), {
    params: Promise.resolve({ id: 'ws-001' }),
  })
  return { status: response.status, data: await response.json() }
}

async function callApprove(actionId: string, approved: boolean) {
  const { POST } = await import('@/app/api/actions/[actionId]/approve/route')
  const response = await POST(new Request(`http://localhost/api/actions/${actionId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved }),
  }), {
    params: Promise.resolve({ actionId }),
  })
  return { status: response.status, data: await response.json() }
}

function gitDiscardApprovalChain() {
  const writes: Array<{ table: string; values: Record<string, unknown>; id?: string }> = []
  const workspace = {
    id: 'ws-001',
    owner_id: mockUser.id,
    name: '测试工作区',
    execution_domain: 'cloud',
    cloud_project_dir: '/tmp/ws-001',
  }
  const profile = { id: mockUser.id, display_name: 'Test User', github_username: 'test-user' }
  const session = { id: 'session-001', workspace_id: 'ws-001' }
  const action: Record<string, unknown> = {}

  function updateTable(table: string) {
    return (values: Record<string, unknown>) => ({
      eq: (_field: string, id: string) => {
        writes.push({ table, values, id })
        if (table === 'actions' && id === action.id) Object.assign(action, values)
        return { data: null, error: null }
      },
    })
  }

  return {
    writes,
    action,
    chainFactory: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === 'workspaces') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => ({ data: workspace, error: null }),
                }),
              }),
            }),
            update: updateTable(table),
          }
        }
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: () => ({ data: profile, error: null }),
              }),
            }),
          }
        }
        if (table === 'sessions') {
          return {
            select: () => ({
              eq: () => ({
                single: () => ({ data: session, error: null }),
              }),
            }),
          }
        }
        if (table === 'actions') {
          return {
            insert: (values: Record<string, unknown>) => {
              Object.assign(action, { id: 'action-git-001', owner_id: mockUser.id, ...values })
              writes.push({ table, values: action })
              return { select: () => ({ single: () => ({ data: action, error: null }) }) }
            },
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => ({ data: Object.keys(action).length ? action : null, error: null }),
                }),
              }),
            }),
            update: updateTable(table),
          }
        }
        if (table === 'notifications') {
          return {
            insert: (values: Record<string, unknown>) => {
              writes.push({ table, values })
              return { data: { id: 'notification-git-001', ...values }, error: null }
            },
          }
        }
        return {
          select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }),
          update: updateTable(table),
        }
      }),
    })),
  }
}

describe('workspace git discard approval API', () => {
  beforeEach(() => {
    resetMockAuth()
    resetMockClient()
    setupMockAuth()
    discardWorkspaceGitPathMock.mockClear()
    readWorkspaceGitStatusMock.mockClear()
  })

  it('creates a pending approval, approves it, then executes discard through the Git API', async () => {
    const { chainFactory, writes, action } = gitDiscardApprovalChain()
    setupMockClient(chainFactory)

    const pending = await callDiscard({ path: 'README.md', session_id: 'session-001' })

    expect(pending.status).toBe(409)
    expect(pending.data).toEqual(expect.objectContaining({
      approvalRequired: true,
      action: expect.objectContaining({
        id: 'action-git-001',
        action_type: 'git_discard',
        status: 'pending',
        requires_approval: true,
      }),
    }))
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'actions',
        values: expect.objectContaining({
          action_type: 'git_discard',
          risk_level: 'high',
          status: 'pending',
          result: expect.objectContaining({ state: 'waiting_approval' }),
        }),
      }),
      expect.objectContaining({
        table: 'notifications',
        values: expect.objectContaining({
          type: 'approval_required',
          ref_type: 'action',
          ref_id: 'action-git-001',
        }),
      }),
    ]))
    expect(discardWorkspaceGitPathMock).not.toHaveBeenCalled()

    const approved = await callApprove('action-git-001', true)

    expect(approved.status).toBe(200)
    expect(approved.data).toEqual({
      status: 'approved',
      dispatch: { status: 'unsupported', error: 'Git 动作已授权，等待 Git API 执行。' },
    })
    expect(action.status).toBe('approved')

    const mismatched = await callDiscard({
      path: 'OTHER.md',
      session_id: 'session-001',
      action_id: 'action-git-001',
      confirm: true,
    })

    expect(mismatched.status).toBe(409)
    expect(mismatched.data).toEqual({ error: '授权动作与当前丢弃目标不匹配' })
    expect(discardWorkspaceGitPathMock).not.toHaveBeenCalled()

    const confirmed = await callDiscard({
      path: 'README.md',
      session_id: 'session-001',
      action_id: 'action-git-001',
      confirm: true,
    })

    expect(confirmed.status).toBe(200)
    expect(confirmed.data).toEqual({ ok: true, changes: [] })
    expect(discardWorkspaceGitPathMock).toHaveBeenCalledWith('/tmp/ws-001', 'README.md')
    expect(readWorkspaceGitStatusMock).toHaveBeenCalledWith('/tmp/ws-001')
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'actions',
        values: expect.objectContaining({
          status: 'completed',
          result: expect.objectContaining({ path: 'README.md', operation: 'git_discard' }),
        }),
        id: 'action-git-001',
      }),
    ]))
  })
})
