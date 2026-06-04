import { beforeEach, describe, expect, it, vi } from 'vitest'

type Filter = { op: 'eq' | 'is'; column: string; value: unknown }

const previousRows: Array<{ native_session_id: string | null }> = []
const inserts: Array<Record<string, unknown>> = []
const selectFilters: Filter[][] = []

vi.mock('../../lib/app-db-client', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table !== 'runtime_sessions') {
        return {}
      }

      const filters: Filter[] = []
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push({ op: 'eq' as const, column, value })
          return builder
        },
        is: (column: string, value: unknown) => {
          filters.push({ op: 'is' as const, column, value })
          return builder
        },
        order: () => builder,
        limit: () => {
          selectFilters.push([...filters])
          return { data: previousRows, error: null }
        },
        insert: (values: Record<string, unknown>) => {
          inserts.push(values)
          return { select: () => ({ single: () => ({ data: { id: 'runtime-new' }, error: null }) }) }
        },
      }
      return builder
    },
  }),
}))

import { createSession } from '../../lib/runtime/gateway'

const workspaceRoot = '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2'

beforeEach(() => {
  previousRows.length = 0
  inserts.length = 0
  selectFilters.length = 0
})

describe('createSession native session reuse scope', () => {
  const endpoint = { id: 'endpoint-001', kind: 'public_cloud' as const, status: 'available' as const }

  it('reuses the latest native session id only within session, role, runtime, and cwd scope', async () => {
    previousRows.push({ native_session_id: null }, { native_session_id: 'native-fe-codex-repo' })

    const runtimeSession = await createSession({
      sessionId: 'session-001',
      endpoint,
      roleAgentId: 'agent-fe',
      runtimeType: 'codex',
      cwd: workspaceRoot,
    })

    expect(runtimeSession).toMatchObject({
      id: 'runtime-new',
      nativeSessionId: 'native-fe-codex-repo',
      runtimeType: 'codex',
      cwd: workspaceRoot,
    })
    expect(selectFilters[0]).toEqual([
      { op: 'eq', column: 'session_id', value: 'session-001' },
      { op: 'eq', column: 'runtime_type', value: 'codex' },
      { op: 'eq', column: 'role_agent_id', value: 'agent-fe' },
      { op: 'eq', column: 'cwd', value: workspaceRoot },
    ])
    expect(inserts[0]).toMatchObject({
      session_id: 'session-001',
      endpoint_id: 'endpoint-001',
      role_agent_id: 'agent-fe',
      runtime_type: 'codex',
      native_session_id: 'native-fe-codex-repo',
      cwd: workspaceRoot,
      status: 'idle',
    })
  })

  it('uses null role and selected cwd scope for direct chat without leaking a role scoped native id', async () => {
    previousRows.push({ native_session_id: 'native-direct' })

    await createSession({
      sessionId: 'session-001',
      endpoint,
      runtimeType: 'claude_code',
      cwd: workspaceRoot,
    })

    expect(selectFilters[0]).toEqual([
      { op: 'eq', column: 'session_id', value: 'session-001' },
      { op: 'eq', column: 'runtime_type', value: 'claude_code' },
      { op: 'is', column: 'role_agent_id', value: null },
      { op: 'eq', column: 'cwd', value: workspaceRoot },
    ])
    expect(inserts[0]).toMatchObject({
      role_agent_id: null,
      native_session_id: 'native-direct',
      cwd: workspaceRoot,
    })
  })

  it('rejects runtime session creation without cwd', async () => {
    await expect(createSession({
      sessionId: 'session-001',
      endpoint,
      runtimeType: 'claude_code',
    })).rejects.toThrow('RUNTIME_CWD_REQUIRED')
    expect(inserts).toHaveLength(0)
  })
})
