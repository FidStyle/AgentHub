import type { AppDbClient } from '@/lib/postgres-query-client'

export type ConversationKind = 'contact' | 'group'
export type ConversationRow = {
  kind: ConversationKind
  id: string
  title: string
  roleAgentId?: string | null
  isOrchestrator?: boolean
  sessionId?: string | null
  isPinned: boolean
  lastActivityAt: string
  lastMessage: string
  status: 'active' | 'archived'
  participants: Array<{ roleAgentId: string; name: string }>
}

type SessionLike = {
  id: string
  workspace_id: string
  name?: string | null
  status?: string | null
  updated_at?: string | null
  created_at?: string | null
  last_activity_at?: string | null
  is_pinned?: boolean | null
  pinned_at?: string | null
  chat_kind?: string | null
  direct_role_agent_id?: string | null
  participant_role_agent_ids?: string[] | null
  metadata?: Record<string, unknown> | null
}

type RoleLike = {
  id: string
  name: string
  role_type?: string | null
  is_orchestrator?: boolean | null
  updated_at?: string | null
  created_at?: string | null
}

type MessageSummary = {
  content?: string | null
  sender_type?: string | null
  created_at?: string | null
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : []
}

export function sessionParticipantIds(session: SessionLike) {
  return [
    ...asStringArray(session.participant_role_agent_ids),
    ...asStringArray(session.metadata?.participant_role_agent_ids),
    ...asStringArray(session.metadata?.participants),
  ].filter((value, index, array) => array.indexOf(value) === index)
}

export function isDirectSessionForRole(session: SessionLike, roleAgentId: string) {
  return session.chat_kind === 'direct' && session.direct_role_agent_id === roleAgentId
}

export function isGroupSession(session: SessionLike) {
  return session.chat_kind === 'group' || sessionParticipantIds(session).length > 0
}

export async function loadSessionLastMessage(db: AppDbClient, sessionId: string): Promise<MessageSummary | null> {
  const { data } = await db
    .from('messages')
    .select('content, sender_type, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
  return Array.isArray(data) ? (data[0] as MessageSummary | undefined) ?? null : null
}

export function buildConversationRows(input: {
  roles: RoleLike[]
  sessions: SessionLike[]
  lastMessages: Map<string, MessageSummary | null>
  status: 'active' | 'archived' | 'all'
}): ConversationRow[] {
  const roleById = new Map(input.roles.map((role) => [role.id, role]))
  const directByRole = new Map<string, SessionLike>()
  for (const session of input.sessions) {
    if (session.direct_role_agent_id && session.chat_kind === 'direct') directByRole.set(session.direct_role_agent_id, session)
  }

  const contacts: ConversationRow[] = input.roles.map((role) => {
    const direct = directByRole.get(role.id)
    const lastMessage = direct ? input.lastMessages.get(direct.id) : null
    return {
      kind: 'contact',
      id: `contact:${role.id}`,
      title: role.name,
      roleAgentId: role.id,
      isOrchestrator: Boolean(role.is_orchestrator),
      sessionId: direct?.id ?? null,
      isPinned: Boolean(direct?.is_pinned),
      lastActivityAt: direct?.last_activity_at ?? lastMessage?.created_at ?? direct?.updated_at ?? role.updated_at ?? role.created_at ?? '',
      lastMessage: lastMessage?.content ?? '',
      status: direct?.status === 'archived' ? 'archived' : 'active',
      participants: [{ roleAgentId: role.id, name: role.name }],
    }
  })

  const groups: ConversationRow[] = input.sessions
    .filter((session) => isGroupSession(session))
    .filter((session) => input.status === 'all' || (session.status ?? 'active') === input.status)
    .map((session) => {
      const participantIds = sessionParticipantIds(session)
      const lastMessage = input.lastMessages.get(session.id)
      return {
        kind: 'group',
        id: `group:${session.id}`,
        title: session.name?.trim() || '未命名群聊',
        sessionId: session.id,
        roleAgentId: null,
        isPinned: Boolean(session.is_pinned),
        lastActivityAt: session.last_activity_at ?? lastMessage?.created_at ?? session.updated_at ?? session.created_at ?? '',
        lastMessage: lastMessage?.content ?? '',
        status: session.status === 'archived' ? 'archived' : 'active',
        participants: participantIds
          .map((id) => roleById.get(id))
          .filter((role): role is RoleLike => Boolean(role))
          .map((role) => ({ roleAgentId: role.id, name: role.name })),
      }
    })

  const rows = input.status === 'archived'
    ? groups
    : [...contacts, ...groups]
  return rows.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    return new Date(b.lastActivityAt || 0).getTime() - new Date(a.lastActivityAt || 0).getTime()
  })
}
