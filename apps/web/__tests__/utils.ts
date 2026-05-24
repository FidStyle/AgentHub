/**
 * Supabase mock utilities for API route unit tests.
 *
 * Pattern:
 *   import { setupMockClient, createSupabaseChain, createNoAuthChain, createErrorChain } from './utils'
 *   setupMockClient(createSupabaseChain(workspaces, sessions))
 *   const { GET } = await import('@/app/api/workspaces/route')
 *   // ...
 */

import { vi } from 'vitest'

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

export const mockUser = {
  id: 'user-001',
  email: 'test@example.com',
  role: 'authenticated',
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  email_confirmed_at: '2026-01-01T00:00:00.000Z',
  phone_confirmed_at: null,
  last_sign_in_at: '2026-01-01T00:00:00.000Z',
  identity_data: null,
  app_meta: {},
  user_meta: {},
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

/** Chain that returns itself from `.eq()` to support chained eq calls */
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

/** Normal supabase chain for workspace + session queries */
export function createSupabaseChain(
  user = mockUser,
  workspaces: unknown[] = [mockWorkspace],
  sessions: unknown[] = [mockSession],
  messages: unknown[] = [mockMessage],
  roleAgents: unknown[] = [mockRoleAgent],
) {
  // Supports chained .eq().eq() calls (e.g. .update().eq().eq().select().single())
  // Uses a mutable cell so updates propagate through the chain
  let cell = { data: undefined as unknown, error: null as { message: string } | null }
  function chainedEq(data: unknown, err: { message: string } | null = null) {
    cell = { data: { ...(data as Record<string, unknown>) }, error: err }
    const c = chainBuilder(cell.data, cell.error)
    return c
  }
  // Override the cell setter inside update to capture the merged data
  function makeUpdateChain(baseData: unknown) {
    return (vals: Record<string, unknown>) => {
      const merged = { ...(baseData as Record<string, unknown>), ...vals }
      cell = { data: merged, error: null }
      return {
        eq: () => {
          // Each .eq() in the chain returns a new builder pointing to the same cell
          const c = chainBuilder(cell.data, cell.error)
          return c
        },
      }
    }
  }

  return vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === 'workspaces') {
        return {
          select: () => ({
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
                  single: () => chain(workspaces.find(w => (w as any).id === value) ?? null, null),
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
                return {
                  single: () => chain(messages.find(m => (m as any).id === value) ?? null, null),
                }
              }
              if (field === 'session_id') {
                return {
                  order: () => chain(messages.filter(m => (m as any).session_id === value), null),
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
                return {
                  single: () => chain(roleAgents.find(a => (a as any).id === value) ?? null, null),
                }
              }
              if (field === 'workspace_id') {
                return {
                  order: () => chain(roleAgents.filter(a => (a as any).workspace_id === value), null),
                }
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

/** Returns no authenticated user */
export function createNoAuthChain() {
  return vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    from: vi.fn(() => chain(null, { message: 'Not called' })),
  }))
}

/** Returns DB errors */
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
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
    from: vi.fn(() => errChain()),
  }))
}

// ---------------------------------------------------------------------------
// Module mock + export
// ---------------------------------------------------------------------------

/** The shared mock function that gets injected into the module */
const _mockFn = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createClient: _mockFn,
}))

/** Call this to set up the mock in each test */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setupMockClient(mockChain: any) {
  _mockFn.mockResolvedValue(mockChain() as any)
}

/** Reset between tests */
export function resetMockClient() {
  _mockFn.mockReset()
}
