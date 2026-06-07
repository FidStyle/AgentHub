/**
 * Auth + Postgres DB mock utilities for API route unit tests.
 */

import { vi } from 'vitest'

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

export const mockUser = {
  id: 'user-001',
  name: 'Test User',
  email: 'test@example.com',
  image: null,
}

export const mockWorkspaceRoot = '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2'

export const mockWorkspace = {
  id: 'ws-001',
  owner_id: 'user-001',
  name: '测试工作区',
  execution_domain: 'cloud',
  cloud_project_dir: mockWorkspaceRoot,
  description: '一个测试工作区',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

export const mockSession = {
  id: 'session-001',
  workspace_id: 'ws-001',
  name: '测试会话',
  status: 'active',
  chat_kind: 'group',
  direct_role_agent_id: null,
  participant_role_agent_ids: [],
  metadata: {},
  is_pinned: false,
  pinned_at: null,
  last_activity_at: '2026-01-01T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

export const mockMessage = {
  id: 'msg-001',
  session_id: 'session-001',
  sender_type: 'user',
  sender_id: 'user-001',
  role_agent_id: null,
  content: 'Hello world',
  message_type: 'text',
  streaming_status: 'complete',
  metadata: null,
  is_pinned: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

export const mockRoleAgent = {
  id: 'agent-001',
  workspace_id: 'ws-001',
  name: 'Analyzer Agent',
  role_type: 'analyzer',
  system_prompt: 'You analyze things.',
  capabilities: [],
  runtime_type: 'claude_code',
  is_orchestrator: false,
  toolset_ids: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

export const mockArtifact = {
  id: 'artifact-001',
  workspace_id: 'ws-001',
  session_id: 'session-001',
  source_message_id: null,
  source_run_id: null,
  source_path: null,
  artifact_type: 'markdown',
  title: '测试产物',
  content: '# 测试产物',
  content_ref: null,
  metadata: {},
  created_by: 'user-001',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

export const mockNotification = {
  id: 'notification-001',
  user_id: 'user-001',
  type: 'approval_required',
  title: '需要授权',
  body: '需要审批动作',
  ref_type: 'action',
  ref_id: 'action-001',
  read: false,
  created_at: '2026-01-01T00:00:00.000Z',
}

// ---------------------------------------------------------------------------
// Auth mock
// ---------------------------------------------------------------------------

const _authMockFn = vi.fn()

vi.mock('@/lib/auth-guard', () => ({
  requireAuth: () => _authMockFn(),
}))

export function setupMockAuth(user: typeof mockUser | null = mockUser) {
  if (user) {
    _authMockFn.mockResolvedValue({ user, error: null })
  } else {
    const { NextResponse } = require('next/server')
    _authMockFn.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: '未授权' }, { status: 401 }),
    })
  }
}

export function resetMockAuth() {
  _authMockFn.mockReset()
}

// ---------------------------------------------------------------------------
// Chain helpers
// ---------------------------------------------------------------------------

type ChainBuilder = {
  data: unknown
  error: { message: string } | null
  select: () => ChainBuilder
  eq: (field: string, value: string) => ChainBuilder
  in: (field: string, values: string[]) => ChainBuilder
  single: () => ChainBuilder
  order: () => ChainBuilder
  limit: () => ChainBuilder
  insert: (vals: Record<string, unknown>) => ChainBuilder
  update: (vals: Record<string, unknown>) => ChainBuilder
  delete: () => ChainBuilder
}

function chain(data: unknown, error: { message: string } | null = null): ChainBuilder {
  return {
    data,
    error,
    select: () => chain(data, error),
    eq: () => chainBuilder(data, error),
    in: () => chainBuilder(data, error),
    single: () => chain(data, error),
    order: () => chain(data, error),
    limit: () => chain(data, error),
    insert: () => chain(data, error),
    update: () => chain(data, error),
    delete: () => chain(data, error),
  }
}

function chainBuilder(data: unknown, error: { message: string } | null = null): ChainBuilder {
  return {
    data,
    error,
    select: () => chainBuilder(data, error),
    eq: () => chainBuilder(data, error),
    in: () => chainBuilder(data, error),
    single: () => chain(data, error),
    order: () => chain(data, error),
    limit: () => chain(data, error),
    insert: () => chain(data, error),
    update: () => chain(data, error),
    delete: () => chainBuilder(data, error),
  }
}

// ---------------------------------------------------------------------------
// Chain factories
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createPostgresChain(
  _user: any = mockUser,
  workspaces: unknown[] = [mockWorkspace],
  sessions: unknown[] = [mockSession],
  messages: unknown[] = [mockMessage],
  roleAgents: unknown[] = [mockRoleAgent],
  artifacts: unknown[] = [mockArtifact],
  notifications: unknown[] = [mockNotification],
) {
  let cell = { data: undefined as unknown, error: null as { message: string } | null }

  function makeUpdateChain(baseData: unknown) {
    return (vals: Record<string, unknown>) => {
      const merged = { ...(baseData as Record<string, unknown>), ...vals }
      cell = { data: merged, error: null }
      return {
        eq: () => {
          const c = chainBuilder(cell.data, cell.error)
          return c
        },
      }
    }
  }

  return vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'workspaces') {
        return {
          select: () => ({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            eq: (field: string, value: string) => {
              if (field === 'owner_id' && value === 'user-001') {
                return {
                  order: () => chain(workspaces, null),
                  single: () => chain(workspaces[0] ?? null, workspaces[0] ? null : { message: 'Not found' }),
                }
              }
              if (field === 'id') {
                return {
                  eq: () => ({
                    single: () => chain(workspaces[0] ?? null, workspaces[0] ? null : { message: 'Not found' }),
                  }),
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  single: () => chain((workspaces as any[]).find(w => w.id === value) ?? null, null),
                }
              }
              return chain(workspaces, null)
            },
            order: () => chain(workspaces, null),
          }),
          insert: (vals: Record<string, unknown>) => ({
            select: () => ({
              single: () => chain({ ...(workspaces[0] ?? mockWorkspace), ...vals, id: 'ws-new' }, null),
            }),
          }),
          update: makeUpdateChain(workspaces[0] ?? mockWorkspace),
          delete: () => ({
            eq: (_field: string, value: string) => ({
              eq: () => chain((workspaces as Array<{ id?: string }>).some(w => w.id === value) ? null : null, null),
            }),
          }),
        }
      }
      if (table === 'sessions') {
        return {
          select: () => ({
            eq: (field: string, value: string) => {
              if (field === 'id') {
                return {
                  single: () => chain(sessions[0] ?? null, sessions[0] ? null : { message: 'Not found' }),
                }
              }
              if (field === 'workspace_id') {
                return {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  order: () => chain(sessions.filter(s => (s as any).workspace_id === value), null),
                }
              }
              return chain(sessions, null)
            },
            order: () => chain(sessions, null),
          }),
          insert: (vals: Record<string, unknown>) => ({
            select: () => ({
              single: () => chain({ ...mockSession, ...vals, id: 'session-new' }, null),
            }),
          }),
          update: makeUpdateChain(sessions[0] ?? mockSession),
          delete: () => ({ eq: () => chain(null, null) }),
        }
      }
      if (table === 'session_participants') {
        return {
          select: () => ({ eq: () => ({ order: () => chain([], null) }) }),
          insert: (vals: Record<string, unknown> | Record<string, unknown>[]) => chain(vals, null),
        }
      }
      if (table === 'messages') {
        return {
          select: () => ({
            eq: (field: string, value: string) => {
              if (field === 'id') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return { single: () => chain((messages as any[]).find(m => m.id === value) ?? null, null) }
              }
              if (field === 'session_id') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const bySession = messages.filter(m => (m as any).session_id === value)
                return {
                  eq: (field2: string, value2: unknown) => ({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    order: () => chain(bySession.filter(m => (m as any)[field2] === value2), null),
                  }),
                  order: () => chain(bySession, null),
                }
              }
              return chain(messages, null)
            },
            order: () => chain(messages, null),
          }),
          insert: (vals: Record<string, unknown>) => ({
            select: () => ({
              single: () => chain({ ...mockMessage, ...vals, id: `msg-${Date.now()}` }, null),
            }),
          }),
          update: makeUpdateChain(messages[0] ?? mockMessage),
        }
      }
      if (table === 'role_agents') {
        return {
          select: () => ({
            eq: (field: string, value: string) => {
              if (field === 'id') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return { single: () => chain((roleAgents as any[]).find(a => a.id === value) ?? null, null) }
              }
              if (field === 'workspace_id') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return { order: () => chain(roleAgents.filter(a => (a as any).workspace_id === value), null) }
              }
              return chain(roleAgents, null)
            },
            order: () => chain(roleAgents, null),
          }),
          insert: (vals: Record<string, unknown>) => ({
            select: () => ({
              single: () => chain({ ...mockRoleAgent, ...vals, id: `agent-${Date.now()}` }, null),
            }),
          }),
          update: makeUpdateChain(roleAgents[0] ?? mockRoleAgent),
          delete: () => ({ eq: () => chain(null, null) }),
        }
      }
      if (table === 'artifacts') {
        return {
          select: () => ({
            eq: (field: string, value: string) => {
              if (field === 'id') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return { single: () => chain((artifacts as any[]).find(a => a.id === value) ?? null, null) }
              }
              if (field === 'workspace_id') {
                return {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  order: () => chain(artifacts.filter(a => (a as any).workspace_id === value), null),
                  eq: (_field2: string, value2: string) => ({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    order: () => chain(artifacts.filter(a => (a as any).workspace_id === value && (a as any).session_id === value2), null),
                  }),
                }
              }
              return chain(artifacts, null)
            },
            order: () => chain(artifacts, null),
          }),
          insert: (vals: Record<string, unknown>) => ({
            select: () => ({
              single: () => chain({ ...mockArtifact, ...vals, id: `artifact-${Date.now()}` }, null),
            }),
          }),
          update: makeUpdateChain(artifacts[0] ?? mockArtifact),
          delete: () => ({ eq: () => chain(null, null) }),
        }
      }
      if (table === 'notifications') {
        return {
          select: () => ({
            eq: (field: string, value: string) => {
              if (field === 'user_id') {
                const byUser = notifications.filter(n => (n as { user_id?: string }).user_id === value)
                return {
                  order: () => ({
                    limit: () => chain(byUser, null),
                    eq: (field2: string, value2: unknown) => ({
                      order: () => ({
                        limit: () => chain(byUser.filter(n => (n as Record<string, unknown>)[field2] === value2), null),
                      }),
                    }),
                  }),
                }
              }
              return chain(notifications, null)
            },
            order: () => ({ limit: () => chain(notifications, null) }),
          }),
          update: (vals: Record<string, unknown>) => ({
            in: (_field: string, ids: string[]) => ({
              eq: () => chain(notifications.filter(n => ids.includes((n as { id: string }).id)).map(n => ({ ...(n as Record<string, unknown>), ...vals })), null),
            }),
          }),
          insert: (vals: Record<string, unknown>) => ({
            select: () => ({
              single: () => chain({ ...mockNotification, ...vals, id: `notification-${Date.now()}` }, null),
            }),
          }),
          delete: () => ({ eq: () => chain(null, null) }),
        }
      }
      if (table === 'actions') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => chain(null, { message: 'Not found' }),
              }),
              order: () => chain([], null),
              single: () => chain(null, { message: 'Not found' }),
            }),
            order: () => chain([], null),
          }),
          insert: (vals: Record<string, unknown>) => ({
            select: () => ({
              single: () => chain({ id: 'action-new', ...vals, created_at: '2026-01-01T00:00:00.000Z' }, null),
            }),
          }),
          update: makeUpdateChain({ id: 'action-new' }),
        }
      }
      return chain(null, { message: `Unknown table: ${table}` })
    }),
  }))
}

export function createNoAuthChain() {
  return vi.fn(() => ({
    from: vi.fn(() => chain(null, { message: 'Not called' })),
  }))
}

export function createErrorChain(msg = 'Database error') {
  function errChain() {
    return {
      data: null,
      error: { message: msg } as { message: string },
      select: errChain,
      eq: errChain,
      in: errChain,
      single: () => ({ data: null, error: { message: msg } }),
      order: errChain,
      limit: () => ({ data: null, error: { message: msg } }),
      insert: () => errChain(),
      update: () => errChain(),
      delete: () => errChain(),
    }
  }
  return vi.fn(() => ({
    from: vi.fn(() => errChain()),
  }))
}

// ---------------------------------------------------------------------------
// Module mock + export
// ---------------------------------------------------------------------------

const _mockFn = vi.fn()

vi.mock('@/lib/app-db-client', () => ({
  createClient: _mockFn,
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setupMockClient(mockChain: any) {
  _mockFn.mockResolvedValue(mockChain() as any)
}

export function resetMockClient() {
  _mockFn.mockReset()
}
