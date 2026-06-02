import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { createClient } from '@/lib/app-db-client'
import { HostedRuntimeAdapter } from '@/lib/runtime/hosted-adapter'
import { getConnectionByUserId } from '@/server/device-connections'
import { buildAttachmentPrompt, loadSessionAttachments, parseArtifacts } from '@/lib/chat/attachments-artifacts'
import { generateOrchestration } from '@/lib/orchestrator/dag-generator'
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
  dependsOn: string[]
}

type RuntimeAttemptEvidence = {
  attemptId: string
  mailboxItemId: string | null
}

async function createRuntimeAttemptEvidence(input: {
  db: Awaited<ReturnType<typeof createClient>>
  workspaceId: string
  sessionId: string
  planId: string | null
  target: ExecutionTarget
}) {
  if (!input.planId || !input.target.nodeId || !input.target.role) return null
  const { data: attempt, error: attemptError } = await input.db
    .from('plan_node_attempts')
    .insert({
      plan_node_id: input.target.nodeId,
      attempt_number: 1,
      control: 'initial',
      previous_attempt_id: null,
      runtime_session_id: null,
      mailbox_item_id: null,
      status: 'running',
      error: null,
    })
    .select()
    .single()
  if (attemptError || !attempt?.id) return null

  const contextPackage = {
    fromRoleAgentId: null,
    fromRoleName: 'Orchestrator',
    toRoleAgentId: input.target.role.id,
    toRoleName: input.target.role.name,
    sessionId: input.sessionId,
    summary: `执行编排节点「${input.target.role.name} / ${input.target.phase}」。`,
    sourceMessageId: null,
    target: 'initial',
    phase: input.target.phase,
    runtimeType: input.target.role.runtime_type,
    metadata: {
      planId: input.planId,
      planNodeId: input.target.nodeId,
      attemptId: attempt.id,
      control: 'initial',
    },
    createdAt: new Date().toISOString(),
  }
  const { data: mailbox } = await input.db
    .from('agent_mailbox_items')
    .insert({
      workspace_id: input.workspaceId,
      session_id: input.sessionId,
      plan_id: input.planId,
      plan_node_id: input.target.nodeId,
      direction: 'inbound',
      from_role_agent_id: null,
      to_role_agent_id: input.target.role.id,
      attempt_id: attempt.id,
      parent_attempt_id: null,
      lineage_root_id: attempt.id,
      runtime_type: input.target.role.runtime_type,
      status: 'running',
      context_package: contextPackage,
      reply_to_mailbox_item_id: null,
      error: null,
    })
    .select()
    .single()
  if (mailbox?.id) {
    await input.db.from('plan_node_attempts').update({ mailbox_item_id: mailbox.id }).eq('id', attempt.id)
  }
  return { attemptId: attempt.id as string, mailboxItemId: (mailbox?.id as string | undefined) ?? null }
}

async function latestRuntimeSessionForTarget(input: {
  db: Awaited<ReturnType<typeof createClient>>
  sessionId: string
  roleAgentId: string | null
  runtimeType?: RuntimeType
}) {
  let query = input.db
    .from('runtime_sessions')
    .select('id, native_session_id')
    .eq('session_id', input.sessionId)
  query = input.roleAgentId ? query.eq('role_agent_id', input.roleAgentId) : query.is('role_agent_id', null)
  if (input.runtimeType) query = query.eq('runtime_type', input.runtimeType)
  const { data } = await query.order('created_at', { ascending: false }).limit(1)
  const rows = Array.isArray(data) ? data as Array<{ id?: string; native_session_id?: string | null }> : []
  return rows[0] ?? null
}

async function finishRuntimeAttemptEvidence(input: {
  db: Awaited<ReturnType<typeof createClient>>
  evidence: RuntimeAttemptEvidence | null
  runtimeSessionId?: string | null
  status: 'completed' | 'failed'
  error?: string
}) {
  if (!input.evidence) return
  const patch = {
    status: input.status,
    runtime_session_id: input.runtimeSessionId ?? null,
    error: input.error ?? null,
    updated_at: new Date().toISOString(),
  }
  await input.db.from('plan_node_attempts').update(patch).eq('id', input.evidence.attemptId)
  if (input.evidence.mailboxItemId) {
    await input.db.from('agent_mailbox_items').update({
      status: input.status,
      error: input.error ?? null,
      updated_at: patch.updated_at,
    }).eq('id', input.evidence.mailboxItemId)
  }
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
        const orchestration = generateOrchestration(selectedRoleAgents, content)
        const useOrchestratedRun = orchestration.useOrchestratedRun
        const executionTargets: ExecutionTarget[] = orchestration.targets
        let planId: string | null = null
        if (useOrchestratedRun) {
          const { data: plan } = await db.from('plans').insert({
            session_id: sessionId,
            owner_id: user.id,
            title: content.slice(0, 80) || '多角色编排',
            dag: orchestration.dag,
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
              depends_on: `{${target.dependsOn.map((id) => `"${id}"`).join(',')}}`,
              status: target.dependsOn.length === 0 ? 'ready' : 'pending',
            })))
            controller.enqueue(encode({ type: 'orchestrator_plan_started', planId, nodes: orchestration.planNodes }))
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
          const evidence = await createRuntimeAttemptEvidence({
            db,
            workspaceId: ws.id,
            sessionId,
            planId,
            target,
          })
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
          const latestRuntimeSession = await latestRuntimeSessionForTarget({
            db,
            sessionId,
            roleAgentId: currentRoleAgentId,
            runtimeType: runtimeTypeForRole(role),
          })
          if (completed && (reply || runtimeParts.length > 0)) {
            await finishRuntimeAttemptEvidence({
              db,
              evidence,
              runtimeSessionId: latestRuntimeSession?.id,
              status: 'completed',
            })
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
          await finishRuntimeAttemptEvidence({
            db,
            evidence,
            runtimeSessionId: latestRuntimeSession?.id,
            status: 'failed',
            error: 'Runtime 未完成或没有产出，节点未通过',
          })
          return false
        }

        if (useOrchestratedRun) {
          const targetById = new Map(executionTargets.filter((target) => target.nodeId).map((target) => [target.nodeId as string, target]))
          const completedNodeIds = new Set<string>()
          const failedTargets: ExecutionTarget[] = []
          const pending = new Map(targetById)

          while (pending.size > 0 && failedTargets.length === 0) {
            const readyWave = Array.from(pending.values()).filter((target) => target.dependsOn.every((id) => completedNodeIds.has(id)))
            if (readyWave.length === 0) {
              failedTargets.push(...Array.from(pending.values()))
              await failUnrunTargets(Array.from(pending.values()), 'DAG 依赖无法继续推进，节点未运行')
              break
            }

            const waveResults = await Promise.all(readyWave.map((target) => {
              const downstreamTargets = executionTargets.filter((candidate) => (
                candidate.nodeId && target.nodeId && candidate.dependsOn.includes(target.nodeId)
              ))
              return runTarget(target, downstreamTargets)
            }))

            readyWave.forEach((target, index) => {
              if (waveResults[index]) {
                completedNodeIds.add(target.nodeId as string)
              } else {
                failedTargets.push(target)
              }
              pending.delete(target.nodeId as string)
            })
          }

          if (failedTargets.length > 0 && pending.size > 0) {
            await failUnrunTargets(Array.from(pending.values()), '上游角色执行失败，节点未运行')
          }
          if (planId) {
            const planCompleted = failedTargets.length === 0 && pending.size === 0
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
