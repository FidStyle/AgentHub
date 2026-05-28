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

export const mockWorkspace = {
  id: 'ws-001',
  owner_id: 'user-001',
  name: '测试工作区',
  execution_domain: 'cloud',
  description: '一个测试工作区',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

export const mockSession = {
  id: 'session-001',
  workspace_id: 'ws-001',
  name: '测试会话',
  status: 'active',
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
  is_orchestrator: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
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
  single: () => ChainBuilder
  order: () => ChainBuilder
  insert: (vals: Record<string, unknown>) => ChainBuilder
  update: (vals: Record<string, unknown>) => ChainBuilder
}

function chain(data: unknown, error: { message: string } | null = null): ChainBuilder {
  return {
    data,
    error,
    select: () => chain(data, error),
    eq: () => chainBuilder(data, error),
    single: () => chain(data, error),
    order: () => chain(data, error),
    insert: () => chain(data, error),
    update: () => chain(data, error),
  }
}

function chainBuilder(data: unknown, error: { message: string } | null = null): ChainBuilder {
  return {
    data,
    error,
    select: () => chainBuilder(data, error),
    eq: () => chainBuilder(data, error),
    single: () => chain(data, error),
    order: () => chain(data, error),
    insert: () => chain(data, error),
    update: () => chain(data, error),
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
                return { order: () => chain(messages.filter(m => (m as any).session_id === value), null) }
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
      single: () => ({ data: null, error: { message: msg } }),
      order: () => ({ data: null, error: { message: msg } }),
      insert: () => errChain(),
      update: () => errChain(),
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
