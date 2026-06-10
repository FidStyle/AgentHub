import { create } from 'zustand'
import { createRuntimeOutputAccumulator, type RuntimeMessagePart, type RuntimeOutputEvent } from '@agenthub/shared'

export interface Session {
  id: string
  title: string
  lastMessage: string
  updatedAt: string
  status: 'active' | 'archived'
  kind?: 'contact' | 'group'
  roleAgentId?: string | null
  isOrchestrator?: boolean
  sessionId?: string | null
  isPinned?: boolean
  participants?: Array<{ roleAgentId: string; name: string }>
  runtimePermissionMode?: string | null
}

type SessionStatusFilter = 'active' | 'archived'

export interface Message {
  id: string
  sessionId: string
  role: 'user' | 'agent'
  content: string
  createdAt: string
  roleAgentId: string | null
  isPinned: boolean
  messageType?: string
  visibleStatus?: string
  parts?: RuntimeMessagePart[]
  streaming?: boolean
}

type StreamEvent = {
  type?: string
  status?: string
  delta?: string
  mode?: RuntimeOutputEvent['mode']
  seq?: number
  roleAgentId?: string | null
  toolCallId?: string
  toolName?: string
  input?: unknown
  result?: unknown
  actionId?: string
  title?: string
  description?: string
  riskLevel?: string
  actionKind?: string
  workspaceRoot?: string
  cwd?: string
  targetPaths?: string[]
  commandPreview?: string
  permissionMode?: string | null
  autoApproved?: boolean
  questionId?: string
  content?: string
  path?: string
  diff?: string
  artifactId?: string
  artifactType?: string
  sourcePath?: string
  contentRef?: string
  messageId?: string
  sessionId?: string
  createdAt?: string
  messageType?: string
  metadata?: unknown
  draft?: Extract<RuntimeMessagePart, { type: 'agent_draft' }>['draft']
}

const PLACEHOLDER_SESSION_TITLES = new Set(['', '新聊天', '未命名聊天', '新会话', '未命名会话'])

function titleFromFirstUserMessage(content: string) {
  const title = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/\s+/g, ' ')
    .slice(0, 80)
  return title || '新聊天'
}

function shouldAutoTitleSession(title: string) {
  return PLACEHOLDER_SESSION_TITLES.has(title.trim())
}

function isRuntimeMessagePart(value: unknown): value is RuntimeMessagePart {
  if (!value || typeof value !== 'object') return false
  const record = value as { id?: unknown; type?: unknown }
  return typeof record.id === 'string' && typeof record.type === 'string'
}

function partsFromMetadata(metadata: unknown): RuntimeMessagePart[] | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined
  const parts = (metadata as { runtimeParts?: unknown }).runtimeParts
  return Array.isArray(parts) ? parts.filter(isRuntimeMessagePart) : undefined
}

function partId(prefix: string, evt: StreamEvent) {
  return String(evt.toolCallId || evt.actionId || evt.questionId || evt.artifactId || `${prefix}-${Date.now()}`)
}

function isAutomaticPermissionMode(mode?: string | null) {
  const normalized = typeof mode === 'string' ? mode.trim().toLowerCase() : ''
  return normalized === 'full_control' || normalized === 'dangerous_bypass'
}

function reduceRuntimeParts(parts: RuntimeMessagePart[], evt: StreamEvent): RuntimeMessagePart[] {
  if (evt.type === 'tool_started' && evt.toolName) {
    const id = partId(`tool-${evt.toolName}`, evt)
    return [...parts.filter((part) => part.id !== id), { id, type: 'tool', status: 'running', toolName: evt.toolName, input: evt.input }]
  }
  if (evt.type === 'tool_delta') {
    const id = partId('tool', evt)
    return parts.map((part) => (
      part.id === id && part.type === 'tool'
        ? { ...part, delta: `${part.delta ?? ''}${evt.delta ?? ''}` }
        : part
    ))
  }
  if (evt.type === 'tool_completed' && evt.toolName) {
    const id = partId(`tool-${evt.toolName}`, evt)
    const existing = parts.find((part) => part.id === id && part.type === 'tool')
    const next: RuntimeMessagePart = {
      id,
      type: 'tool',
      status: 'completed',
      toolName: evt.toolName,
      input: existing?.type === 'tool' ? existing.input : evt.input,
      delta: existing?.type === 'tool' ? existing.delta : undefined,
      result: evt.result,
    }
    return [...parts.filter((part) => part.id !== id), next]
  }
  if (evt.type === 'approval_requested' && evt.description) {
    return [...parts, {
      id: partId('approval', evt),
      type: 'permission',
      status: 'pending',
      actionId: evt.actionId,
      title: evt.title,
      description: evt.description,
      riskLevel: evt.riskLevel,
      actionKind: evt.actionKind,
      workspaceRoot: evt.workspaceRoot,
      cwd: evt.cwd,
      targetPaths: evt.targetPaths,
      commandPreview: evt.commandPreview,
    }]
  }
  if (evt.type === 'approval_auto_approved') {
    return [...parts, {
      id: partId('approval-auto', evt),
      type: 'permission',
      status: 'completed',
      actionId: evt.actionId,
      title: evt.title ?? 'Runtime 工具已自动通过',
      description: evt.description ?? '当前权限模式已自动允许本次 Runtime 工具操作。',
      riskLevel: evt.riskLevel,
      actionKind: evt.actionKind,
      workspaceRoot: evt.workspaceRoot,
      cwd: evt.cwd,
      targetPaths: evt.targetPaths,
      commandPreview: evt.commandPreview,
      autoApproved: true,
      permissionMode: evt.permissionMode ?? undefined,
    }]
  }
  if (evt.type === 'runtime_observed_action' && evt.status && evt.status !== 'running') {
    const autoApproved = evt.autoApproved === true || isAutomaticPermissionMode(evt.permissionMode) || Boolean(evt.actionId)
    return [...parts, {
      id: partId('observed-action', evt),
      type: 'permission',
      status: evt.status === 'failed' ? 'failed' : 'completed',
      actionId: evt.actionId ?? undefined,
      title: evt.status === 'failed' ? 'Runtime 工具自动执行失败' : 'Runtime 工具已自动执行',
      description: '当前权限模式自动允许并记录了 Runtime 观测到的工具操作。',
      riskLevel: 'low',
      actionKind: evt.actionKind,
      workspaceRoot: evt.workspaceRoot,
      cwd: evt.cwd,
      targetPaths: evt.targetPaths,
      commandPreview: evt.commandPreview,
      autoApproved,
      permissionMode: evt.permissionMode ?? undefined,
    }]
  }
  if (evt.type === 'question' && evt.content) {
    return [...parts, { id: partId('question', evt), type: 'question', status: 'pending', questionId: evt.questionId, title: evt.title, content: evt.content }]
  }
  if (evt.type === 'diff_created' && evt.diff) {
    return [...parts, { id: partId('diff', evt), type: 'diff', status: 'created', path: evt.path, diff: evt.diff }]
  }
  if (evt.type === 'artifact_created' && evt.artifactType && evt.title) {
    return [...parts, { id: partId('artifact', evt), type: 'artifact', status: 'created', artifactId: evt.artifactId, artifactType: evt.artifactType, title: evt.title, sourcePath: evt.sourcePath, contentRef: evt.contentRef }]
  }
  return parts
}

function runtimePartsFromEvent(evt: StreamEvent): RuntimeMessagePart[] | undefined {
  const fromMetadata = partsFromMetadata(evt.metadata)
  if (fromMetadata) return fromMetadata
  const parts = reduceRuntimeParts([], evt)
  return parts.length > 0 ? parts : undefined
}

function visibleStatusFromMetadata(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined
  const value = (metadata as { visibleStatus?: unknown }).visibleStatus
  return typeof value === 'string' ? value : undefined
}

function permissionActionIds(parts: RuntimeMessagePart[] | undefined): string[] {
  if (!parts) return []
  return parts
    .filter((part): part is Extract<RuntimeMessagePart, { type: 'permission' }> => part.type === 'permission')
    .map((part) => part.actionId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}

interface SessionState {
  sessions: Session[]
  activeSessionId: string | null
  activeWorkspaceId: string | null
  sessionStatusFilter: SessionStatusFilter
  messages: Message[]
  messagesRevision: number
  loading: boolean
  error: string | null
  setActiveSession: (id: string) => void
  setActiveWorkspace: (id: string) => void
  setSessionStatusFilter: (status: SessionStatusFilter) => Promise<void>
  fetchSessions: (workspaceId: string) => Promise<void>
  createSession: (workspaceId: string) => Promise<void>
  archiveSession: (sessionId: string) => Promise<void>
  restoreSession: (sessionId: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  pinSession: (sessionId: string, isPinned: boolean) => Promise<void>
  setSessionPermissionMode: (sessionId: string, mode: string) => Promise<void>
  openConversation: (conversation: Session) => Promise<void>
  createGroupConversation: (input: { workspaceId: string; name: string; participantRoleAgentIds: string[] }) => Promise<void>
  fetchMessages: (sessionId: string) => Promise<void>
  setMessagePinned: (messageId: string, isPinned: boolean) => Promise<void>
  sendMessage: (input: { content: string; roleAgentIds?: string[]; attachmentIds?: string[]; permissionMode?: string; signal?: AbortSignal }) => Promise<void>
  regenerateMessage: (messageId: string) => Promise<void>
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  activeWorkspaceId: null,
  sessionStatusFilter: 'active',
  messages: [],
  messagesRevision: 0,
  loading: false,
  error: null,

  setActiveSession: (id) => {
    set({ activeSessionId: id })
    get().fetchMessages(id)
  },

  setActiveWorkspace: (id) => {
    const { activeWorkspaceId } = get()
    if (activeWorkspaceId === id) return
    set({
      activeWorkspaceId: id,
      sessions: [],
      activeSessionId: null,
      messages: [],
      error: null,
    })
  },

  setSessionStatusFilter: async (status) => {
    set({ sessionStatusFilter: status })
    const { activeWorkspaceId } = get()
    if (activeWorkspaceId) await get().fetchSessions(activeWorkspaceId)
  },

  fetchSessions: async (workspaceId) => {
    const { sessionStatusFilter } = get()
    set({ loading: true, error: null })
    try {
      const res = await fetch(`/api/conversations?workspace_id=${workspaceId}&status=${sessionStatusFilter}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        set({ error: body.error || res.statusText, loading: false })
        return
      }
      const data = await res.json()
      const sessions: Session[] = data.map((s: Record<string, unknown>) => ({
        id: String(s.sessionId ?? s.session_id ?? s.id),
        title: String(s.title ?? s.name ?? '未命名聊天'),
        lastMessage: (s.lastMessage as string | undefined) || (s.last_message as string | undefined) || '',
        updatedAt: (s.lastActivityAt as string | undefined) || (s.last_message_at as string | undefined) || s.updated_at || s.created_at || '',
        status: s.status === 'archived' ? 'archived' : 'active',
        kind: s.kind === 'contact' ? 'contact' : 'group',
        roleAgentId: (s.roleAgentId as string | null | undefined) ?? null,
        isOrchestrator: Boolean(s.isOrchestrator),
        sessionId: (s.sessionId as string | null | undefined) ?? null,
        isPinned: Boolean(s.isPinned),
        participants: Array.isArray(s.participants) ? s.participants as Array<{ roleAgentId: string; name: string }> : [],
        runtimePermissionMode: typeof s.runtimePermissionMode === 'string' ? s.runtimePermissionMode : null,
      }))
      const current = get().activeSessionId
      const preferredSession = sessions.find((session) => session.sessionId || session.kind !== 'contact') ?? null
      const nextActive = current ?? (preferredSession ? (preferredSession.sessionId ?? preferredSession.id) : null)
      set({ sessions, activeWorkspaceId: workspaceId, activeSessionId: nextActive, messages: [], loading: false })
      if (nextActive) await get().fetchMessages(nextActive)
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  openConversation: async (conversation) => {
    const workspaceId = get().activeWorkspaceId
    if (conversation.kind === 'contact' && conversation.roleAgentId && !conversation.sessionId) {
      if (!workspaceId) return
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          name: conversation.title,
          chat_kind: 'direct',
          direct_role_agent_id: conversation.roleAgentId,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        set({ error: body.error || res.statusText })
        return
      }
      const s = await res.json()
      const sessionId = String(s.id)
      set((state) => ({
        sessions: state.sessions.map((item) => item.id === conversation.id ? { ...item, id: sessionId, sessionId } : item),
        activeSessionId: sessionId,
        messages: [],
      }))
      await get().fetchMessages(sessionId)
      return
    }
    const sessionId = conversation.sessionId ?? conversation.id
    set({ activeSessionId: sessionId })
    await get().fetchMessages(sessionId)
  },

  createGroupConversation: async ({ workspaceId, name, participantRoleAgentIds }) => {
    const res = await fetch('/api/conversations/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, name, participant_role_agent_ids: participantRoleAgentIds }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }))
      set({ error: body.error || res.statusText })
      return
    }
    await get().setSessionStatusFilter('active')
  },

  createSession: async (workspaceId) => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        set({ error: body.error || res.statusText })
        return
      }
      const s = await res.json()
      const session: Session = {
        id: s.id,
        title: s.name || '新聊天',
        lastMessage: '',
        updatedAt: s.updated_at || s.created_at || '',
        status: 'active',
      }
      set((state) => ({
        sessions: state.sessionStatusFilter === 'active' ? [session, ...state.sessions] : [session],
        sessionStatusFilter: 'active',
        activeSessionId: session.id,
        messages: [],
      }))
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  archiveSession: async (sessionId) => {
    const previous = get()
    const nextSessions = previous.sessions.filter((session) => session.id !== sessionId)
    const nextActiveSessionId = previous.activeSessionId === sessionId ? nextSessions[0]?.id ?? null : previous.activeSessionId
    set({
      sessions: nextSessions,
      activeSessionId: nextActiveSessionId,
      messages: previous.activeSessionId === sessionId ? [] : previous.messages,
      error: null,
    })
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error || res.statusText)
      }
      if (nextActiveSessionId && previous.activeSessionId === sessionId) get().fetchMessages(nextActiveSessionId)
    } catch (e) {
      set({
        sessions: previous.sessions,
        activeSessionId: previous.activeSessionId,
        messages: previous.messages,
        error: (e as Error).message,
      })
      throw e
    }
  },

  restoreSession: async (sessionId) => {
    const previous = get()
    set({ sessions: previous.sessions.filter((session) => session.id !== sessionId), error: null })
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error || res.statusText)
      }
    } catch (e) {
      set({ sessions: previous.sessions, error: (e as Error).message })
      throw e
    }
  },

  deleteSession: async (sessionId) => {
    const previous = get()
    const nextSessions = previous.sessions.filter((session) => session.id !== sessionId)
    const nextActiveSessionId = previous.activeSessionId === sessionId ? nextSessions[0]?.id ?? null : previous.activeSessionId
    set({
      sessions: nextSessions,
      activeSessionId: nextActiveSessionId,
      messages: previous.activeSessionId === sessionId ? [] : previous.messages,
      error: null,
    })
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error || res.statusText)
      }
      if (nextActiveSessionId && previous.activeSessionId === sessionId) get().fetchMessages(nextActiveSessionId)
    } catch (e) {
      set({
        sessions: previous.sessions,
        activeSessionId: previous.activeSessionId,
        messages: previous.messages,
        error: (e as Error).message,
      })
      throw e
    }
  },

  pinSession: async (sessionId, isPinned) => {
    const previous = get().sessions
    set({ sessions: previous.map((session) => session.id === sessionId || session.sessionId === sessionId ? { ...session, isPinned } : session) })
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: isPinned }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error || res.statusText)
      }
      const workspaceId = get().activeWorkspaceId
      if (workspaceId) await get().fetchSessions(workspaceId)
    } catch (e) {
      set({ sessions: previous, error: (e as Error).message })
      throw e
    }
  },

  setSessionPermissionMode: async (sessionId, mode) => {
    const previous = get().sessions
    set({
      sessions: previous.map((session) => (
        session.id === sessionId || session.sessionId === sessionId
          ? { ...session, runtimePermissionMode: mode }
          : session
      )),
    })
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runtime_permission_mode: mode }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error || res.statusText)
      }
      const row = await res.json().catch(() => ({})) as { metadata?: Record<string, unknown> }
      const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
      const readbackMode = typeof metadata.runtimePermissionMode === 'string'
        ? metadata.runtimePermissionMode
        : typeof metadata.runtime_permission_mode === 'string'
          ? metadata.runtime_permission_mode
          : mode
      set((state) => ({
        sessions: state.sessions.map((session) => (
          session.id === sessionId || session.sessionId === sessionId
            ? { ...session, runtimePermissionMode: readbackMode }
            : session
        )),
      }))
    } catch (e) {
      set({ sessions: previous, error: (e as Error).message })
      throw e
    }
  },

  fetchMessages: async (sessionId) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`/api/messages?session_id=${sessionId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        set({ error: body.error || res.statusText, loading: false })
        return
      }
      const data = await res.json()
      const messages: Message[] = data
        .map((m: Record<string, unknown>) => ({
          id: m.id,
          sessionId: m.session_id,
          role: m.sender_type === 'user' ? 'user' : 'agent',
          content: m.content,
          createdAt: m.created_at || '',
          roleAgentId: (m.role_agent_id as string | null) ?? null,
          isPinned: Boolean(m.is_pinned),
          messageType: String(m.message_type ?? 'text'),
          visibleStatus: visibleStatusFromMetadata(m.metadata),
          parts: partsFromMetadata(m.metadata),
        }))
      set((state) => ({ messages, messagesRevision: state.messagesRevision + 1, loading: false }))
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  setMessagePinned: async (messageId, isPinned) => {
    const previous = get().messages
    set({
      messages: previous.map((message) => (
        message.id === messageId ? { ...message, isPinned } : message
      )),
    })
    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: isPinned }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error || res.statusText)
      }
      const row = await res.json()
      set((state) => ({
        messages: state.messages.map((message) => (
          message.id === messageId ? { ...message, isPinned: Boolean(row.is_pinned) } : message
        )),
      }))
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('messages:changed', {
          detail: { sessionId: row.session_id, messageId, isPinned: Boolean(row.is_pinned) },
        }))
      }
    } catch (e) {
      set({ messages: previous, error: (e as Error).message })
      throw e
    }
  },

  sendMessage: async ({ content, roleAgentIds = [], attachmentIds = [], permissionMode, signal }) => {
    const { activeSessionId, messages } = get()
    if (!activeSessionId) return
    const primaryRoleAgentId = roleAgentIds[0] ?? null
    const optimisticTitle = titleFromFirstUserMessage(content)

    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      sessionId: activeSessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      roleAgentId: primaryRoleAgentId,
      isPinned: false,
    }
    set({ messages: [...messages, optimistic] })
    set((state) => ({
      sessions: state.sessions.map((session) => (
        session.id === activeSessionId
          ? {
              ...session,
              title: shouldAutoTitleSession(session.title) ? optimisticTitle : session.title,
              lastMessage: content,
              updatedAt: optimistic.createdAt,
            }
          : session
      )),
    }))

    let activeStreamingReplyId: string | null = null

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          sessionId: activeSessionId,
          content,
          roleAgentId: primaryRoleAgentId,
          roleAgentIds,
          mentions: roleAgentIds.length > 0 ? roleAgentIds : null,
          attachmentIds,
          permissionMode,
        }),
      })
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        set({ error: body.error || res.statusText })
        return
      }

      // Stream the SSE runtime events. Each role_selected frame starts a distinct visible
      // reply bubble so multi-role @ runs do not collapse into the first/last role.
      let replySeq = 0
      let replyId = `reply-${Date.now()}-${replySeq}`
      let reply = ''
      let replyAccumulator = createRuntimeOutputAccumulator()
      let runtimeParts: RuntimeMessagePart[] = []
      let replyCreated = false
      let respondingRoleAgentId: string | null = primaryRoleAgentId
      const processPermissionActionIds = new Set<string>()
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const finishReply = (id = replyId) => {
        if (activeStreamingReplyId === id) activeStreamingReplyId = null
        set((state) => ({
          messages: state.messages.map((m) => (m.id === id ? { ...m, streaming: false } : m)),
        }))
      }

      const upsertReply = () => {
        set((state) => {
          if (!replyCreated) {
            replyCreated = true
            activeStreamingReplyId = replyId
            return {
              messages: [
                ...state.messages,
                {
                  id: replyId,
                  sessionId: activeSessionId,
                  role: 'agent',
                  content: reply,
                  createdAt: new Date().toISOString(),
                  roleAgentId: respondingRoleAgentId,
                  isPinned: false,
                  messageType: 'text',
                  parts: runtimeParts,
                  streaming: true,
                } as Message,
              ],
            }
          }
          return {
            messages: state.messages.map((m) => (m.id === replyId ? { ...m, content: reply, parts: runtimeParts, streaming: true } : m)),
          }
        })
      }

      // Runtime unavailable/failed terminals must surface a clear status, never silence or a
      // fake success. Shown as a distinct system notice (no roleAgentId) so it is not mistaken
      // for a real agent answer.
      const statusText: Record<string, string> = {
        endpoint_unavailable: '⚠️ 公共云端 Runtime 未就绪，请稍后再试或切换到本地 Desktop 运行时',
        local_runtime_offline: '⚠️ 本地 Desktop 运行时离线，未收到回复',
        tunnel_disconnected: '⚠️ 本地运行时连接已断开，未收到回复',
        runtime_failed: '⚠️ 运行时执行失败，未收到回复',
        runtime_waiting: '',
        runtime_backgrounded: '执行仍在继续，正在等待新的输出',
      }
      let systemNoticeShown = false
      const showSystemNotice = (text: string) => {
        if (!text || systemNoticeShown) return
        systemNoticeShown = true
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: `sys-${Date.now()}`,
              sessionId: activeSessionId,
              role: 'agent',
              content: text,
              createdAt: new Date().toISOString(),
              roleAgentId: null,
              isPinned: false,
              messageType: 'system_event',
            } as Message,
          ],
        }))
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''
        for (const frame of frames) {
          const line = frame.trim()
          if (!line.startsWith('data:')) continue
          const evt = JSON.parse(line.slice(5).trim()) as StreamEvent
          if (evt.type === 'role_selected' && evt.roleAgentId) {
            if (replyCreated && (reply || runtimeParts.length > 0)) {
              finishReply(replyId)
              replySeq += 1
              replyId = `reply-${Date.now()}-${replySeq}`
              reply = ''
              replyAccumulator = createRuntimeOutputAccumulator()
              runtimeParts = []
              replyCreated = false
            }
            respondingRoleAgentId = evt.roleAgentId
          }
          if (evt.type === 'session_title_updated' && evt.sessionId && evt.title) {
            set((state) => ({
              sessions: state.sessions.map((session) => (
                session.id === evt.sessionId
                  ? { ...session, title: String(evt.title) }
                  : session
              )),
            }))
            continue
          }
          if (evt.type === 'role_process_message' && evt.content) {
            if (replyCreated && (reply || runtimeParts.length > 0)) {
              finishReply(replyId)
              replySeq += 1
              replyId = `reply-${Date.now()}-${replySeq}`
              reply = ''
              replyAccumulator = createRuntimeOutputAccumulator()
              runtimeParts = []
              replyCreated = false
            }
            const messageId = evt.messageId ?? `process-${Date.now()}-${replySeq}`
            const processParts = runtimePartsFromEvent(evt)
            permissionActionIds(processParts).forEach((actionId) => processPermissionActionIds.add(actionId))
            set((state) => {
              const nextMessage: Message = {
                id: messageId,
                sessionId: evt.sessionId ?? activeSessionId,
                role: 'agent',
                content: evt.content ?? '',
                createdAt: evt.createdAt ?? new Date().toISOString(),
                roleAgentId: evt.roleAgentId ?? respondingRoleAgentId ?? null,
                isPinned: false,
                messageType: evt.messageType ?? 'system_event',
                visibleStatus: visibleStatusFromMetadata(evt.metadata),
                parts: processParts,
                streaming: false,
              }
              const existingIndex = state.messages.findIndex((message) => message.id === messageId)
              if (existingIndex >= 0) {
                return {
                  messages: state.messages.map((message) => (message.id === messageId ? nextMessage : message)),
                }
              }
              return { messages: [...state.messages, nextMessage] }
            })
            continue
          }
          if ((evt.type === 'approval_requested' || evt.type === 'approval_auto_approved') && evt.actionId && processPermissionActionIds.has(evt.actionId)) {
            continue
          }
          if (evt.type === 'runtime_status') continue
          if (evt.type === 'role_acknowledgement' && evt.content) {
            if (replyCreated && (reply || runtimeParts.length > 0)) {
              finishReply(replyId)
              replySeq += 1
              replyId = `reply-${Date.now()}-${replySeq}`
              reply = ''
              replyAccumulator = createRuntimeOutputAccumulator()
              runtimeParts = []
              replyCreated = false
            }
            respondingRoleAgentId = evt.roleAgentId ?? respondingRoleAgentId
            reply = evt.content
            upsertReply()
            finishReply(replyId)
            replySeq += 1
            replyId = `reply-${Date.now()}-${replySeq}`
            reply = ''
            replyAccumulator = createRuntimeOutputAccumulator()
            runtimeParts = []
            replyCreated = false
            continue
          }
          const nextParts = reduceRuntimeParts(runtimeParts, evt)
          if (nextParts !== runtimeParts) {
            runtimeParts = nextParts
            upsertReply()
          }
          if (evt.type === 'runtime_output' && evt.delta) {
            reply = replyAccumulator.append(evt as RuntimeOutputEvent)
            upsertReply()
          } else if (evt.type && statusText[evt.type]) {
            showSystemNotice(statusText[evt.type])
          }
        }
      }
      finishReply()
    } catch (e) {
      if (activeStreamingReplyId) {
        const id = activeStreamingReplyId
        activeStreamingReplyId = null
        set((state) => ({
          messages: state.messages.map((m) => (m.id === id ? { ...m, streaming: false } : m)),
        }))
      }
      if (e instanceof DOMException && e.name === 'AbortError') {
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: `sys-${Date.now()}`,
              sessionId: activeSessionId,
              role: 'agent',
              content: '已停止本次回复。',
              createdAt: new Date().toISOString(),
              roleAgentId: null,
              isPinned: false,
              messageType: 'system_event',
            } as Message,
          ],
        }))
        return
      }
      set({ error: (e as Error).message })
    }
  },

  regenerateMessage: async (messageId) => {
    try {
      const res = await fetch(`/api/messages/${messageId}/regenerate`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `重新生成失败（${res.status}）`)
      const payload = body as {
        content?: unknown
        roleAgentIds?: unknown
        roleAgentId?: unknown
        permissionMode?: unknown
      }
      const content = typeof payload.content === 'string' ? payload.content : ''
      if (!content.trim()) throw new Error('重新生成失败：缺少上一条用户消息')
      const roleAgentIds = Array.isArray(payload.roleAgentIds)
        ? payload.roleAgentIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        : typeof payload.roleAgentId === 'string' && payload.roleAgentId.trim()
          ? [payload.roleAgentId]
          : []
      await get().sendMessage({
        content,
        roleAgentIds,
        permissionMode: typeof payload.permissionMode === 'string' ? payload.permissionMode : undefined,
      })
    } catch (e) {
      set({ error: (e as Error).message })
      throw e
    }
  },
}))
