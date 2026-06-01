import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { createClient } from '@/lib/app-db-client'
import { HostedRuntimeAdapter } from '@/lib/runtime/hosted-adapter'
import { getConnectionByUserId } from '@/server/device-connections'
import { buildAttachmentPrompt, loadSessionAttachments, parseArtifacts } from '@/lib/chat/attachments-artifacts'
import type { RuntimeGatewayEvent, RuntimeMessagePart } from '@agenthub/shared'

async function localDesktopOperability(db: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const conn = getConnectionByUserId(userId)
  if (!conn?.deviceId) {
    return { ok: false, error: '本地 Desktop 未连接云端，当前只能只读查看历史。' }
  }

  const { data: devices } = await db
    .from('devices')
    .select('id, type, created_at')
    .eq('user_id', userId)
  const desktopDevices = ((devices ?? []) as unknown as Array<{ id: string; type: string; created_at?: string }>).filter((device) => device.type === 'desktop')
  if (desktopDevices.length === 0) return { ok: false, error: '当前账号没有可用的 Desktop 绑定，当前只能只读查看历史。' }

  let connectedChannel: { device_id: string; endpoint_id: string | null; status: string; connected_at?: string | null; last_heartbeat?: string | null } | null = null
  for (const desktop of desktopDevices) {
    if (desktop.id !== conn.deviceId) continue
    const { data: channels } = await db
      .from('device_runtime_channels')
      .select('device_id, endpoint_id, status, connected_at, last_heartbeat')
      .eq('device_id', desktop.id)
    const connected = ((channels ?? []) as unknown as Array<{ device_id: string; endpoint_id: string | null; status: string; connected_at?: string | null; last_heartbeat?: string | null }>)
      .filter((row) => row.status === 'connected')
      .sort((a, b) => {
        const at = new Date(a.last_heartbeat ?? a.connected_at ?? 0).getTime()
        const bt = new Date(b.last_heartbeat ?? b.connected_at ?? 0).getTime()
        return bt - at
      })[0]
    if (!connected?.endpoint_id) continue
    if (!connectedChannel) connectedChannel = connected
    if (connected.device_id === desktop.id) {
      connectedChannel = connected
      break
    }
  }

  const channel = connectedChannel
  if (!channel?.endpoint_id) {
    return { ok: false, error: '本地 Desktop 未连接云端，当前只能只读查看历史。' }
  }

  const { data: capabilities } = await db
    .from('runtime_capabilities')
    .select('capability, value')
    .eq('endpoint_id', channel.endpoint_id)
  const detection = ((capabilities ?? []) as unknown as Array<{ capability: string; value: unknown }>).find((row) => row.capability === 'runtime_detection')
  if (!detection) return { ok: false, error: '本地 Runtime 尚未完成真实检测，当前只能只读查看历史。' }

  let value: unknown = detection.value
  if (typeof detection.value === 'string') {
    try {
      value = JSON.parse(detection.value) as unknown
    } catch {
      value = null
    }
  }
  const ready = Array.isArray(value) && value.some((runtime) => {
    if (!runtime || typeof runtime !== 'object') return false
    const record = runtime as { available?: boolean; authenticated?: boolean; launchable?: boolean }
    return record.available === true && record.authenticated === true && record.launchable !== false
  })
  return ready
    ? { ok: true, error: null }
    : { ok: false, error: '本地 Claude Code / Codex 未登录或不可启动，当前只能只读查看历史。' }
}

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { sessionId, content, roleAgentId, roleAgentIds, mentions, attachmentIds, permissionMode } = await req.json()
  if (!sessionId || !content) {
    return Response.json({ error: '缺少 sessionId 或 content' }, { status: 400 })
  }

  const db = await createClient()

  const { data: session } = await db
    .from('sessions')
    .select('workspace_id')
    .eq('id', sessionId)
    .single()
  if (!session) return Response.json({ error: '会话不存在' }, { status: 404 })

  const { data: ws } = await db
    .from('workspaces')
    .select('id, execution_domain')
    .eq('id', session.workspace_id)
    .eq('owner_id', user.id)
    .single()
  if (!ws) return Response.json({ error: '无权限' }, { status: 403 })

  if (ws.execution_domain === 'local_desktop') {
    const operability = await localDesktopOperability(db, user.id)
    if (!operability.ok) return Response.json({ error: operability.error }, { status: 409 })
  }

  const requestedRoleIds = Array.isArray(roleAgentIds)
    ? roleAgentIds.map((id) => String(id)).filter(Boolean)
    : roleAgentId
      ? [String(roleAgentId)]
      : []

  let selectedRoleAgents: Array<{ id: string; workspace_id: string; name: string; role_type: string; system_prompt: string | null; capabilities: unknown; is_orchestrator: boolean }> = []
  if (requestedRoleIds.length > 0) {
    const { data: roles, error: roleError } = await db
      .from('role_agents')
      .select('id, workspace_id, name, role_type, system_prompt, capabilities, is_orchestrator')
      .eq('workspace_id', ws.id)
      .order('created_at', { ascending: true })
    if (roleError) return Response.json({ error: roleError.message }, { status: 500 })
    selectedRoleAgents = ((roles ?? []) as unknown as typeof selectedRoleAgents)
      .filter((role) => requestedRoleIds.includes(role.id))
    if (selectedRoleAgents.length !== requestedRoleIds.length) {
      return Response.json({ error: '角色不存在或无权限' }, { status: 403 })
    }
    selectedRoleAgents.sort((a, b) => requestedRoleIds.indexOf(a.id) - requestedRoleIds.indexOf(b.id))
  } else {
    const { data: roles, error: roleError } = await db
      .from('role_agents')
      .select('id, workspace_id, name, role_type, system_prompt, capabilities, is_orchestrator')
      .eq('workspace_id', ws.id)
      .order('created_at', { ascending: true })
    if (roleError) return Response.json({ error: roleError.message }, { status: 500 })
    const rows = ((roles ?? []) as unknown as typeof selectedRoleAgents)
    const orchestrator = rows.find((role) => role.name === 'Orchestrator' || role.is_orchestrator) ?? rows[0]
    if (orchestrator) selectedRoleAgents = [orchestrator]
  }
  const primaryRoleAgentId = selectedRoleAgents[0]?.id ?? null
  const systemPrompt = selectedRoleAgents.length > 0
    ? [
        'AgentHub role context:',
        ...selectedRoleAgents.map((role, index) => [
          `${index + 1}. @${role.name} (${role.role_type}${role.is_orchestrator ? ', orchestrator' : ''})`,
          role.system_prompt ? `Instructions: ${role.system_prompt}` : null,
          Array.isArray(role.capabilities) && role.capabilities.length > 0 ? `Capabilities: ${role.capabilities.join(', ')}` : null,
        ].filter(Boolean).join('\n')),
      ].join('\n\n')
    : undefined

  const requestedAttachmentIds = Array.isArray(attachmentIds)
    ? attachmentIds.map((id) => String(id)).filter(Boolean)
    : []
  const attachments = requestedAttachmentIds.length > 0
    ? await loadSessionAttachments(db, sessionId, requestedAttachmentIds)
    : []
  if (requestedAttachmentIds.length > 0 && attachments.length !== requestedAttachmentIds.length) {
    return Response.json({ error: '附件不存在或无权限' }, { status: 403 })
  }
  const userMessage = `${content}${buildAttachmentPrompt(attachments)}`
  const metadata: Record<string, unknown> = {}
  if (mentions || selectedRoleAgents.length > 0) metadata.mentions = mentions ?? selectedRoleAgents.map((role) => role.id)
  if (selectedRoleAgents.length > 0) metadata.roleAgents = selectedRoleAgents.map((role) => ({ id: role.id, name: role.name, roleType: role.role_type, isOrchestrator: role.is_orchestrator }))
  if (permissionMode) metadata.permissionMode = permissionMode
  if (attachments.length > 0) {
    metadata.attachments = attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      type: attachment.type,
      size: attachment.size,
      contentRef: attachment.contentRef,
      createdAt: attachment.createdAt,
    }))
  }

  await db.from('messages').insert({
    session_id: sessionId,
    content,
    sender_type: 'user',
    role_agent_id: primaryRoleAgentId,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  })

  const encoder = new TextEncoder()
  const encode = (data: object) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
  const partId = (prefix: string, evt: RuntimeGatewayEvent) => {
    const record = evt as Record<string, unknown>
    return String(record.toolCallId || record.actionId || record.questionId || record.artifactId || `${prefix}-${Date.now()}`)
  }
  const reduceRuntimeParts = (parts: RuntimeMessagePart[], evt: RuntimeGatewayEvent): RuntimeMessagePart[] => {
    if (evt.type === 'tool_started') {
      const id = partId(`tool-${evt.toolName}`, evt)
      return [...parts.filter((part) => part.id !== id), { id, type: 'tool', status: 'running', toolName: evt.toolName, input: evt.input }]
    }
    if (evt.type === 'tool_delta') {
      const id = partId('tool', evt)
      return parts.map((part) => (
        part.id === id && part.type === 'tool'
          ? { ...part, delta: `${part.delta ?? ''}${evt.delta}` }
          : part
      ))
    }
    if (evt.type === 'tool_completed') {
      const id = partId(`tool-${evt.toolName}`, evt)
      const existing = parts.find((part) => part.id === id && part.type === 'tool')
      return [
        ...parts.filter((part) => part.id !== id),
        {
          id,
          type: 'tool',
          status: 'completed',
          toolName: evt.toolName,
          input: existing?.type === 'tool' ? existing.input : undefined,
          delta: existing?.type === 'tool' ? existing.delta : undefined,
          result: evt.result,
        },
      ]
    }
    if (evt.type === 'approval_requested') {
      return [...parts, { id: partId('approval', evt), type: 'permission', status: 'pending', actionId: evt.actionId, title: evt.title, description: evt.description, riskLevel: evt.riskLevel }]
    }
    if (evt.type === 'question') {
      return [...parts, { id: partId('question', evt), type: 'question', status: 'pending', questionId: evt.questionId, title: evt.title, content: evt.content }]
    }
    if (evt.type === 'diff_created') {
      return [...parts, { id: partId('diff', evt), type: 'diff', status: 'created', path: evt.path, diff: evt.diff }]
    }
    if (evt.type === 'artifact_created') {
      return [...parts, { id: partId('artifact', evt), type: 'artifact', status: 'created', artifactId: evt.artifactId, artifactType: evt.artifactType, title: evt.title, sourcePath: evt.sourcePath, contentRef: evt.contentRef }]
    }
    return parts
  }

  // Both cloud and local_desktop route through the Cloud Runtime Gateway via the adapter.
  // runtime_sessions / runtime_logs persistence happens inside the gateway. For an offline
  // local_desktop endpoint the gateway emits local_runtime_offline plus a DEVICE_OFFLINE
  // runtime_status event so existing P0 client expectations stay compatible.
  const adapter = new HostedRuntimeAdapter()
  const stream = new ReadableStream({
    async start(controller) {
      let reply = ''
      let runtimeParts: RuntimeMessagePart[] = []
      let completed = false
      try {
        if (primaryRoleAgentId) {
          controller.enqueue(encode({ type: 'role_selected', roleAgentId: primaryRoleAgentId }))
        }
        for await (const evt of adapter.invoke({
          userId: user.id,
          sessionId,
          executionDomain: ws.execution_domain,
          workspaceId: ws.id,
          userMessage,
          systemPrompt,
          roleAgentId: primaryRoleAgentId ?? undefined,
        })) {
          if (evt.type === 'runtime_output' && evt.delta) reply += evt.delta
          runtimeParts = reduceRuntimeParts(runtimeParts, evt)
          if (evt.type === 'runtime_completed') completed = true
          controller.enqueue(encode(evt))
        }
      } finally {
        // Persist the agent reply/parts so reload restores streamed text and runtime cards.
        // Failed/unavailable terminals must not fabricate a success message.
        if (completed && (reply || runtimeParts.length > 0)) {
          const { data: agentMessage } = await db.from('messages').insert({
            session_id: sessionId,
            content: reply,
            sender_type: 'agent',
            role_agent_id: primaryRoleAgentId,
            metadata: runtimeParts.length > 0 ? { runtimeParts } : null,
          }).select('id').single()

          const artifacts = parseArtifacts(reply)
          if (artifacts.length > 0) {
            await db.from('messages').insert(artifacts.map((artifact) => ({
              session_id: sessionId,
              content: artifact.content,
              sender_type: 'agent',
              role_agent_id: primaryRoleAgentId,
              message_type: 'text',
              metadata: {
                artifact: {
                  ...artifact,
                  sourceMessageId: agentMessage?.id ?? null,
                },
              },
              is_pinned: true,
            })))
          }
        }
        controller.enqueue(encode({ type: 'done' }))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
