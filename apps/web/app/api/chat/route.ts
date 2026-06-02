import { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireAuth } from '@/lib/auth-guard'
import { createClient } from '@/lib/app-db-client'
import { HostedRuntimeAdapter } from '@/lib/runtime/hosted-adapter'
import { getConnectionByUserId } from '@/server/device-connections'
import { buildAttachmentPrompt, loadSessionAttachments, parseArtifacts } from '@/lib/chat/attachments-artifacts'
import type { RuntimeGatewayEvent, RuntimeMessagePart } from '@agenthub/shared'
import type { RuntimeType } from '@agenthub/shared'
import type { ContextPackage } from '@agenthub/shared'

type SelectedRoleAgent = {
  id: string
  workspace_id: string
  name: string
  role_type: string
  system_prompt: string | null
  capabilities: unknown
  runtime_type: 'claude_code' | 'codex'
  is_orchestrator: boolean
}

type RoleHandoffPackage = ContextPackage

type ExecutionTarget = {
  nodeId: string | null
  role: SelectedRoleAgent | null
  phase: 'direct' | 'planning' | 'worker' | 'summarizing'
}

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

  let selectedRoleAgents: SelectedRoleAgent[] = []
  if (requestedRoleIds.length > 0) {
    const { data: roles, error: roleError } = await db
      .from('role_agents')
      .select('id, workspace_id, name, role_type, system_prompt, capabilities, runtime_type, is_orchestrator')
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
      .select('id, workspace_id, name, role_type, system_prompt, capabilities, runtime_type, is_orchestrator')
      .eq('workspace_id', ws.id)
      .order('created_at', { ascending: true })
    if (roleError) return Response.json({ error: roleError.message }, { status: 500 })
    const rows = ((roles ?? []) as unknown as typeof selectedRoleAgents)
    const orchestrator = rows.find((role) => role.name === '架构师' || role.name === 'Orchestrator' || role.is_orchestrator) ?? rows[0]
    if (orchestrator) selectedRoleAgents = [orchestrator]
  }
  const roleCapabilities = (role: (typeof selectedRoleAgents)[number]) =>
    Array.isArray(role.capabilities) ? role.capabilities.map((item) => String(item)) : []
  const runtimeTypeForRole = (role: (typeof selectedRoleAgents)[number] | null): RuntimeType | undefined => {
    if (!role) return undefined
    return role.runtime_type
  }
  const primaryRoleAgentId = selectedRoleAgents[0]?.id ?? null
  const roleContextPrompt = selectedRoleAgents.length > 0
    ? [
        'AgentHub 角色上下文：',
        ...selectedRoleAgents.map((role, index) => [
          `${index + 1}. @${role.name} (${role.role_type}${role.is_orchestrator ? ', orchestrator' : ''})`,
          role.system_prompt ? `角色指令：${role.system_prompt}` : null,
          roleCapabilities(role).length > 0 ? `能力标签：${roleCapabilities(role).join('、')}` : null,
          runtimeTypeForRole(role) ? `执行 Runtime：${runtimeTypeForRole(role) === 'codex' ? 'Codex' : 'Claude Code'}` : null,
        ].filter(Boolean).join('\n')),
      ].join('\n\n')
    : undefined
  const handoffContextPrompt = (handoffs: RoleHandoffPackage[]) => {
    if (handoffs.length === 0) return null
    return [
      '上游角色交接上下文：',
      ...handoffs.map((handoff, index) => [
        `${index + 1}. @${handoff.fromRoleName} 交接给 @${handoff.toRoleName}：`,
        handoff.summary,
      ].join('\n')),
      '请基于以上交接上下文继续推进，不要重复上游角色已经完成的工作；如有冲突，请明确指出并给出你的角色判断。',
    ].join('\n\n')
  }
  const systemPromptForRole = (role: (typeof selectedRoleAgents)[number] | null, handoffs: RoleHandoffPackage[]) => {
    if (!roleContextPrompt) return undefined
    if (!role) return roleContextPrompt
    return [
      roleContextPrompt,
      handoffContextPrompt(handoffs),
      `当前回复角色：@${role.name}。请只从该角色职责出发回答，不要冒充其他被选中的角色。`,
    ].filter(Boolean).join('\n\n')
  }

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
  if (selectedRoleAgents.length > 0) {
    metadata.roleAgents = selectedRoleAgents.map((role) => ({
      id: role.id,
      name: role.name,
      roleType: role.role_type,
      runtimeType: role.runtime_type,
      isOrchestrator: role.is_orchestrator,
    }))
  }
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

  const { data: userMessageRow } = await db.from('messages').insert({
    session_id: sessionId,
    content,
    sender_type: 'user',
    role_agent_id: primaryRoleAgentId,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  }).select('id').single()

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
      const completedReplies: Array<{
        nodeId: string | null
        phase: ExecutionTarget['phase']
        roleAgentId: string | null
        roleName: string
        reply: string
        runtimeParts: RuntimeMessagePart[]
        receivedHandoffs: RoleHandoffPackage[]
      }> = []
      const persistedHandoffs: RoleHandoffPackage[] = []
      try {
        const orchestrator = selectedRoleAgents.find((role) => role.is_orchestrator)
        const useOrchestratedRun = Boolean(orchestrator && selectedRoleAgents.length > 1)
        const workerRoles = useOrchestratedRun
          ? selectedRoleAgents.filter((role) => role.id !== orchestrator?.id)
          : []
        const executionTargets: ExecutionTarget[] = useOrchestratedRun && orchestrator
          ? [
              { nodeId: randomUUID(), role: orchestrator, phase: 'planning' },
              ...workerRoles.map((role) => ({ nodeId: randomUUID(), role, phase: 'worker' as const })),
              { nodeId: randomUUID(), role: orchestrator, phase: 'summarizing' },
            ]
          : (selectedRoleAgents.length > 0 ? selectedRoleAgents : [null]).map((role) => ({
              nodeId: null,
              role,
              phase: 'direct' as const,
            }))
        let planId: string | null = null
        if (useOrchestratedRun) {
          const planNodes = executionTargets.map((target) => ({
            id: target.nodeId,
            label: target.phase === 'planning'
              ? '架构师规划'
              : target.phase === 'summarizing'
                ? '架构师汇总'
                : `${target.role?.name ?? '角色'}执行`,
            depends_on: target.phase === 'worker'
              ? [executionTargets[0].nodeId].filter(Boolean)
              : target.phase === 'summarizing'
                ? executionTargets.filter((candidate) => candidate.phase === 'worker').map((candidate) => candidate.nodeId).filter(Boolean)
                : [],
          }))
          const dag = {
            nodes: planNodes.map((node) => ({ id: node.id, label: node.label, depends_on: node.depends_on })),
            edges: planNodes.flatMap((node) => node.depends_on.map((dep) => ({ from: dep, to: node.id }))),
          }
          const { data: plan } = await db.from('plans').insert({
            session_id: sessionId,
            owner_id: user.id,
            title: content.slice(0, 80) || '多角色编排',
            dag,
            status: 'running',
          }).select('id').single()
          planId = plan?.id ?? null
          if (planId) {
            await db.from('plan_nodes').insert(executionTargets.map((target) => ({
              id: target.nodeId,
              plan_id: planId,
              label: target.phase === 'planning'
                ? '架构师规划'
                : target.phase === 'summarizing'
                  ? '架构师汇总'
                  : `${target.role?.name ?? '角色'}执行`,
              agent_id: target.role?.id ?? null,
              action_type: 'runtime_invoke',
              action_payload: {
                phase: target.phase,
                runtimeType: target.role?.runtime_type ?? null,
                userMessage,
              },
              depends_on: `{${(target.phase === 'worker'
                ? [executionTargets[0].nodeId]
                : target.phase === 'summarizing'
                  ? executionTargets.filter((candidate) => candidate.phase === 'worker').map((candidate) => candidate.nodeId)
                  : []).filter(Boolean).map((id) => `"${id}"`).join(',')}}`,
              status: target.phase === 'planning' ? 'ready' : 'pending',
            })))
            controller.enqueue(encode({ type: 'orchestrator_plan_started', planId, nodes: planNodes }))
          }
        }
        const handoffs: RoleHandoffPackage[] = []
        const failUnrunTargets = async (targets: ExecutionTarget[], reason: string) => {
          await Promise.all(targets
            .filter((target) => target.nodeId)
            .map((target) => db.from('plan_nodes').update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              result: { error: reason },
            }).eq('id', target.nodeId)))
        }
        const runTarget = async (target: ExecutionTarget, downstreamTargets: ExecutionTarget[]) => {
          const role = target.role
          const currentRoleAgentId = role?.id ?? null
          const currentRoleName = role?.name ?? '默认 Agent'
          let reply = ''
          let runtimeParts: RuntimeMessagePart[] = []
          let completed = false
          const receivedHandoffs = handoffs
            .filter((handoff) => handoff.toRoleAgentId === currentRoleAgentId)
            .map((handoff) => ({ ...handoff }))
          if (currentRoleAgentId) {
            controller.enqueue(encode({ type: 'role_selected', roleAgentId: currentRoleAgentId }))
          }
          if (target.nodeId) {
            await db.from('plan_nodes').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', target.nodeId)
          }
          if (role && receivedHandoffs.length > 0) {
            controller.enqueue(encode({
              type: 'role_handoff',
              toRoleAgentId: currentRoleAgentId,
              handoffs: receivedHandoffs,
            }))
          }
          for await (const evt of adapter.invoke({
            userId: user.id,
            sessionId,
            executionDomain: ws.execution_domain,
            workspaceId: ws.id,
            userMessage,
            systemPrompt: systemPromptForRole(role, receivedHandoffs),
            roleAgentId: currentRoleAgentId ?? undefined,
            runtimeType: runtimeTypeForRole(role),
          })) {
            if (evt.type === 'runtime_output' && evt.delta) reply += evt.delta
            runtimeParts = reduceRuntimeParts(runtimeParts, evt)
            if (evt.type === 'runtime_completed') completed = true
            controller.enqueue(encode(evt))
          }
          if (completed && (reply || runtimeParts.length > 0)) {
            completedReplies.push({
              nodeId: target.nodeId,
              phase: target.phase,
              roleAgentId: currentRoleAgentId,
              roleName: currentRoleName,
              reply,
              runtimeParts,
              receivedHandoffs,
            })
            if (target.nodeId) {
              await db.from('plan_nodes').update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                result: { summary: reply.trim().slice(-4000), runtimeParts },
              }).eq('id', target.nodeId)
            }
            if (role && reply.trim()) {
              for (const downstream of downstreamTargets) {
                if (!downstream.role || (downstream.role.id === currentRoleAgentId && downstream.phase !== 'summarizing')) continue
                handoffs.push({
                  fromRoleAgentId: currentRoleAgentId,
                  fromRoleName: role.name,
                  toRoleAgentId: downstream.role.id,
                  toRoleName: downstream.role.name,
                  sessionId,
                  summary: reply.trim().slice(-4000),
                  sourceMessageId: null,
                  target: downstream.nodeId ?? undefined,
                  phase: downstream.phase,
                  runtimeType: downstream.role.runtime_type,
                  createdAt: new Date().toISOString(),
                })
              }
            }
            return true
          } else if (target.nodeId) {
            await db.from('plan_nodes').update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              result: { error: 'Runtime 未完成或没有产出，节点未通过' },
            }).eq('id', target.nodeId)
          }
          return false
        }

        if (useOrchestratedRun) {
          const planner = executionTargets.find((target) => target.phase === 'planning')
          const workers = executionTargets.filter((target) => target.phase === 'worker')
          const summarizer = executionTargets.find((target) => target.phase === 'summarizing')
          const plannerOk = planner ? await runTarget(planner, [...workers, ...(summarizer ? [summarizer] : [])]) : true
          const workerResults = plannerOk
            ? await Promise.all(workers.map((target) => runTarget(target, summarizer ? [summarizer] : [])))
            : workers.map(() => false)
          if (!plannerOk) {
            await failUnrunTargets([...workers, ...(summarizer ? [summarizer] : [])], '上游架构师规划失败，节点未运行')
          }
          const summarizerOk = plannerOk && workerResults.every(Boolean) && summarizer ? await runTarget(summarizer, []) : true
          if (plannerOk && !workerResults.every(Boolean) && summarizer) {
            await failUnrunTargets([summarizer], '上游角色执行失败，汇总节点未运行')
          }
          if (planId) {
            const planCompleted = plannerOk && workerResults.every(Boolean) && summarizerOk
            await db.from('plans').update({ status: planCompleted ? 'completed' : 'failed', updated_at: new Date().toISOString() }).eq('id', planId)
          }
        } else {
          for (let index = 0; index < executionTargets.length; index += 1) {
            await runTarget(executionTargets[index], executionTargets.slice(index + 1))
          }
        }
      } finally {
        // Persist the agent reply/parts so reload restores streamed text and runtime cards.
        // Failed/unavailable terminals must not fabricate a success message.
        const messageIdByRole = new Map<string, string>()
        for (const completedReply of completedReplies) {
          const receivedHandoffs = completedReply.receivedHandoffs.map((handoff) => ({
            ...handoff,
            sourceMessageId: handoff.fromRoleAgentId ? messageIdByRole.get(handoff.fromRoleAgentId) ?? null : null,
          }))
          const messageMetadata: Record<string, unknown> = {}
          if (completedReply.runtimeParts.length > 0) messageMetadata.runtimeParts = completedReply.runtimeParts
          if (receivedHandoffs.length > 0) messageMetadata.handoffsReceived = receivedHandoffs

          const { data: agentMessage } = await db.from('messages').insert({
            session_id: sessionId,
            content: completedReply.reply,
            sender_type: 'agent',
            role_agent_id: completedReply.roleAgentId,
            metadata: Object.keys(messageMetadata).length > 0 ? messageMetadata : null,
          }).select('id').single()
          if (completedReply.roleAgentId && agentMessage?.id) {
            messageIdByRole.set(completedReply.roleAgentId, agentMessage.id)
          }
          persistedHandoffs.push(...receivedHandoffs)

          const artifacts = parseArtifacts(completedReply.reply)
          if (artifacts.length > 0) {
            await db.from('messages').insert(artifacts.map((artifact) => ({
              session_id: sessionId,
              content: artifact.content,
              sender_type: 'agent',
              role_agent_id: completedReply.roleAgentId,
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
        if (userMessageRow?.id && persistedHandoffs.length > 0) {
          await db.from('messages').update({
            metadata: {
              ...metadata,
              roleHandoffs: persistedHandoffs,
            },
          }).eq('id', userMessageRow.id)
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
