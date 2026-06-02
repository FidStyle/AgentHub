import { describe, expect, it } from 'vitest'
import type { AgentMailboxItem, PlanNodeAttempt } from '../orchestrator'
import { nextPlanNodeAttemptDraft, selectReadyMailboxItems } from '../orchestrator'

function mailbox(partial: Partial<AgentMailboxItem> & Pick<AgentMailboxItem, 'id' | 'to_role_agent_id' | 'status' | 'created_at'>): AgentMailboxItem {
  return {
    workspace_id: 'ws-001',
    session_id: 'session-001',
    plan_id: 'plan-001',
    plan_node_id: 'node-001',
    direction: 'inbound',
    from_role_agent_id: null,
    attempt_id: null,
    parent_attempt_id: null,
    lineage_root_id: partial.id,
    runtime_type: 'claude_code',
    context_package: {
      fromRoleAgentId: null,
      fromRoleName: 'Orchestrator',
      toRoleAgentId: partial.to_role_agent_id,
      toRoleName: '角色',
      sessionId: 'session-001',
      summary: '任务',
      sourceMessageId: null,
      createdAt: partial.created_at,
    },
    reply_to_mailbox_item_id: null,
    error: null,
    updated_at: partial.created_at,
    ...partial,
  }
}

function attempt(partial: Partial<PlanNodeAttempt> & Pick<PlanNodeAttempt, 'id' | 'plan_node_id' | 'attempt_number'>): PlanNodeAttempt {
  return {
    control: 'initial',
    previous_attempt_id: null,
    runtime_session_id: null,
    mailbox_item_id: null,
    status: 'failed',
    error: null,
    created_at: '2026-06-02T00:00:00.000Z',
    updated_at: '2026-06-02T00:00:00.000Z',
    ...partial,
  }
}

describe('mailbox scheduling helpers', () => {
  it('selects the earliest queued inbound item for a session and keeps later roles queued', () => {
    const ready = selectReadyMailboxItems([
      mailbox({ id: 'mail-2', to_role_agent_id: 'agent-fe', status: 'queued', created_at: '2026-06-02T00:00:02.000Z' }),
      mailbox({ id: 'mail-1', to_role_agent_id: 'agent-fe', status: 'queued', created_at: '2026-06-02T00:00:01.000Z' }),
      mailbox({ id: 'mail-3', to_role_agent_id: 'agent-be', status: 'queued', created_at: '2026-06-02T00:00:03.000Z' }),
    ])

    expect(ready.map((item) => item.id)).toEqual(['mail-1'])
  })

  it('does not select queued work when the session already has running inbound work', () => {
    const ready = selectReadyMailboxItems([
      mailbox({ id: 'running-fe', to_role_agent_id: 'agent-fe', status: 'running', created_at: '2026-06-02T00:00:01.000Z' }),
      mailbox({ id: 'queued-fe', to_role_agent_id: 'agent-fe', status: 'queued', created_at: '2026-06-02T00:00:02.000Z' }),
      mailbox({ id: 'queued-be', to_role_agent_id: 'agent-be', status: 'queued', created_at: '2026-06-02T00:00:03.000Z' }),
    ])

    expect(ready.map((item) => item.id)).toEqual([])
  })

  it('accepts Date timestamps from local Postgres rows when selecting ready work', () => {
    const ready = selectReadyMailboxItems([
      mailbox({ id: 'mail-2', to_role_agent_id: 'agent-fe', status: 'queued', created_at: new Date('2026-06-02T00:00:02.000Z') as unknown as string }),
      mailbox({ id: 'mail-1', to_role_agent_id: 'agent-fe', status: 'queued', created_at: new Date('2026-06-02T00:00:01.000Z') as unknown as string }),
      mailbox({ id: 'mail-3', to_role_agent_id: 'agent-be', status: 'queued', created_at: new Date('2026-06-02T00:00:03.000Z') as unknown as string }),
    ])

    expect(ready.map((item) => item.id)).toEqual(['mail-1'])
  })

  it('allows one queued item in each independent session', () => {
    const ready = selectReadyMailboxItems([
      mailbox({ id: 'session-a-2', session_id: 'session-a', to_role_agent_id: 'agent-fe', status: 'queued', created_at: '2026-06-02T00:00:02.000Z' }),
      mailbox({ id: 'session-a-1', session_id: 'session-a', to_role_agent_id: 'agent-fe', status: 'queued', created_at: '2026-06-02T00:00:01.000Z' }),
      mailbox({ id: 'session-b-1', session_id: 'session-b', to_role_agent_id: 'agent-be', status: 'queued', created_at: '2026-06-02T00:00:03.000Z' }),
    ])

    expect(ready.map((item) => item.id)).toEqual(['session-a-1', 'session-b-1'])
  })

  it('creates retry attempt drafts without overwriting previous attempt lineage', () => {
    const draft = nextPlanNodeAttemptDraft({
      planNodeId: 'node-001',
      control: 'retry',
      attempts: [
        attempt({ id: 'attempt-001', plan_node_id: 'node-001', attempt_number: 1 }),
        attempt({ id: 'attempt-other', plan_node_id: 'node-other', attempt_number: 9 }),
      ],
    })

    expect(draft).toEqual({
      plan_node_id: 'node-001',
      attempt_number: 2,
      control: 'retry',
      previous_attempt_id: 'attempt-001',
      status: 'queued',
    })
  })
})
