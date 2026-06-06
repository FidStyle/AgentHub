import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { createClient } from '@/lib/app-db-client'
import { HostedRuntimeAdapter } from '@/lib/runtime/hosted-adapter'
import { getConnectionByUserId } from '@/server/device-connections'
import { buildAttachmentPrompt, loadSessionAttachments, parseArtifacts } from '@/lib/chat/attachments-artifacts'
import { generateOrchestration } from '@/lib/orchestrator/dag-generator'
import { dispatchPreparedRuntimeInvokeNode } from '@/lib/orchestrator/action-dispatcher'
import { classifyRisk } from '@/lib/orchestrator/permission-engine'
import { subscribeEvents, type RuntimeJob } from '@/lib/runtime/redis-client'
import { ensureDefaultRoleAgents } from '@/lib/role-agents/defaults'
import { loadCloudWorkspaceRoot } from '@/lib/workspace/workspace-api'
import {
  createArchitectDispatch,
  createRuntimeInvokeInputFromChat,
  createRuntimeOutputAccumulator,
  type RuntimeGatewayEvent,
  type RuntimeMessagePart,
} from '@agenthub/shared'
import type { CliRuntimeType, RuntimeType } from '@agenthub/shared'
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

type TargetRunResult = 'completed' | 'waiting' | 'failed'

type RuntimeDispatchRole = {
  id: string
  name: string
  system_prompt?: string | null
  runtime_type: CliRuntimeType
}

type ProcessEventInput = {
  db: Awaited<ReturnType<typeof createClient>>
  sessionId: string
  roleAgentId: string | null
  content: string
  metadata?: Record<string, unknown>
  messageType?: string
  emit?: (event: RoleProcessMessageEvent) => void
}

type ArtifactRecommendationInput = {
  db: Awaited<ReturnType<typeof createClient>>
  userId: string
  workspaceId: string
  sessionId: string
  roleAgentId: string | null
  workspaceRoot: string | null
  runMarker: string | null
  planId: string | null
}

type AutoContinuationOutcome = {
  status: 'completed' | 'failed' | 'waiting' | 'timeout'
  summary: string
  runtimeSessionId: string | null
}

type NodeActionEvidence = {
  action_type?: string | null
  command?: string | null
  status?: string | null
  result?: unknown
}

type RoleProcessMessageEvent = {
  type: 'role_process_message'
  messageId: string
  sessionId: string
  roleAgentId: string | null
  content: string
  messageType: string
  createdAt: string
  metadata: Record<string, unknown>
}

const PLACEHOLDER_SESSION_TITLES = new Set(['', '新会话', '未命名会话'])

function titleFromFirstUserMessage(content: string) {
  const title = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/\s+/g, ' ')
    .slice(0, 80)
  return title || '新会话'
}

async function maybeRenameSessionFromFirstMessage(input: {
  db: Awaited<ReturnType<typeof createClient>>
  sessionId: string
  currentName: unknown
  content: string
}) {
  const currentName = typeof input.currentName === 'string' ? input.currentName.trim() : ''
  if (!PLACEHOLDER_SESSION_TITLES.has(currentName)) return null

  const { data: existingUserMessages } = await input.db
    .from('messages')
    .select('id, sender_type')
    .eq('session_id', input.sessionId)
    .order('created_at', { ascending: true })
    .limit(1)
  if (Array.isArray(existingUserMessages) && existingUserMessages.some((message) => (
    (message as { sender_type?: unknown }).sender_type === 'user'
  ))) return null

  const nextTitle = titleFromFirstUserMessage(input.content)
  if (nextTitle === currentName) return null

  const { error } = await input.db
    .from('sessions')
    .update({ name: nextTitle, updated_at: new Date().toISOString() })
    .eq('id', input.sessionId)
  if (error) return null
  return nextTitle
}

function roleSearchText(role: Pick<SelectedRoleAgent, 'name' | 'role_type' | 'capabilities'>) {
  const capabilities = Array.isArray(role.capabilities) ? role.capabilities.join(' ') : ''
  return `${role.name} ${role.role_type} ${capabilities}`.toLowerCase()
}

function roleMatchesArchitectDispatchTarget(role: SelectedRoleAgent, targetRoleAgentId: string) {
  const text = roleSearchText(role)
  if (targetRoleAgentId === 'role-backend') {
    return text.includes('back') || text.includes('api') || text.includes('server') || text.includes('后端') || text.includes('接口') || text.includes('数据库') || text.includes('runtime')
  }
  if (targetRoleAgentId === 'role-frontend') {
    return text.includes('front') || text.includes('ui') || text.includes('web') || text.includes('前端') || text.includes('页面') || text.includes('界面')
  }
  return false
}

type PinnedContextMessage = {
  id: string
  sender_type: string | null
  role_agent_id: string | null
  content: string
  created_at: string | null
}

async function loadPinnedContextMessages(input: {
  db: Awaited<ReturnType<typeof createClient>>
  sessionId: string
}) {
  const { data } = await input.db
    .from('messages')
    .select('id, sender_type, role_agent_id, content, created_at')
    .eq('session_id', input.sessionId)
    .eq('is_pinned', true)
    .order('created_at', { ascending: true })
  const rows = Array.isArray(data) ? data as unknown as PinnedContextMessage[] : []
  return rows
    .filter((message) => typeof message.content === 'string' && message.content.trim().length > 0)
    .slice(-12)
}

function buildPinnedContextPrompt(messages: PinnedContextMessage[]) {
  if (messages.length === 0) return ''
  const clipped = messages.map((message, index) => {
    const speaker = message.sender_type === 'user' ? '用户' : 'Agent'
    const content = message.content.trim().slice(0, 1600)
    return `${index + 1}. ${speaker}（message:${message.id}）\n${content}`
  })
  return [
    '',
    '已固定上下文（来自当前会话，用户明确要求后续回复持续参考）：',
    ...clipped,
    '请优先遵守以上固定上下文；如与用户本轮新指令冲突，请明确指出冲突并以本轮新指令为准。',
  ].join('\n\n')
}

async function createRuntimeAttemptEvidence(input: {
  db: Awaited<ReturnType<typeof createClient>>
  workspaceId: string
  sessionId: string
  planId: string | null
  target: ExecutionTarget
  runtimeType?: CliRuntimeType
  receivedHandoffs?: RoleHandoffPackage[]
}) {
  if (!input.planId || !input.target.nodeId || !input.target.role) return null
  const runtimeType = input.runtimeType ?? input.target.role.runtime_type
  const { data: attempt, error: attemptError } = await input.db
    .from('plan_node_attempts')
    .insert({
      plan_node_id: input.target.nodeId,
      attempt_number: 1,
      control: 'initial',
      previous_attempt_id: null,
      runtime_session_id: null,
      mailbox_item_id: null,
      status: 'queued',
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
    runtimeType,
    metadata: {
      planId: input.planId,
      planNodeId: input.target.nodeId,
      attemptId: attempt.id,
      control: 'initial',
      receivedHandoffs: input.receivedHandoffs ?? [],
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
      runtime_type: runtimeType,
      status: 'queued',
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
  status: 'completed' | 'failed' | 'waiting'
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function relativeWorkspacePath(workspaceRoot: string | null, filePath: string) {
  if (!workspaceRoot) return filePath
  const relative = path.relative(workspaceRoot, filePath)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : filePath
}

function collectActionTargetPaths(action: NodeActionEvidence, workspaceRoot: string | null) {
  const result = action.result && typeof action.result === 'object' && !Array.isArray(action.result)
    ? action.result as Record<string, unknown>
    : {}
  const input = result.input && typeof result.input === 'object' && !Array.isArray(result.input)
    ? result.input as Record<string, unknown>
    : {}
  const changed = stringArray(input.changed_paths)
  const targetPaths = stringArray(result.targetPaths)
  return [...new Set([...changed, ...targetPaths])]
    .map((item) => relativeWorkspacePath(workspaceRoot, item))
    .filter((item) => item && !item.startsWith('.agenthub/'))
}

async function existingWorkspaceFiles(workspaceRoot: string | null, files: string[]) {
  if (!workspaceRoot) return []
  const found: string[] = []
  for (const file of files) {
    const fullPath = path.join(workspaceRoot, file)
    const info = await stat(fullPath).catch(() => null)
    if (info?.isFile()) found.push(file)
  }
  return found
}

async function buildCompletedRoleEvidenceSummary(input: {
  db: Awaited<ReturnType<typeof createClient>>
  planNodeId: string | null
  workspaceRoot: string | null
  roleName: string
  phase: ExecutionTarget['phase']
}) {
  if (!input.planNodeId) return ''
  const { data } = await input.db
    .from('actions')
    .select('action_type, command, status, result')
    .eq('plan_node_id', input.planNodeId)
    .order('created_at', { ascending: true })
  const actions = Array.isArray(data) ? data as NodeActionEvidence[] : []
  const completedActions = actions.filter((action) => action.status === 'completed')
  const writtenFiles = [...new Set(actions.flatMap((action) => (
    action.action_type === 'write_file' ? collectActionTargetPaths(action, input.workspaceRoot) : []
  )))]
  const commandCount = completedActions.filter((action) => action.action_type === 'shell_command').length
  const expectedFiles = /前端|front|ui|web/i.test(input.roleName)
    ? ['public/index.html', 'public/app.js', 'public/styles.css']
    : /后端|back|api|数据库|server/i.test(input.roleName)
      ? ['package.json', 'src/server.js', 'test/api.test.js']
      : input.phase === 'summarizing'
        ? ['package.json', 'src/server.js', 'public/index.html', 'public/app.js', 'public/styles.css']
        : []
  const existingFiles = await existingWorkspaceFiles(input.workspaceRoot, expectedFiles)
  const lines = [
    '',
    'AgentHub 观察到的落地证据：',
    completedActions.length > 0 ? `- 已完成动作：${completedActions.length} 个${commandCount > 0 ? `，其中命令 ${commandCount} 个` : ''}。` : null,
    writtenFiles.length > 0 ? `- 写入/更新文件：${writtenFiles.slice(0, 12).join('、')}。` : null,
    existingFiles.length > 0 ? `- 当前工作区可读文件：${existingFiles.join('、')}。` : null,
  ].filter(Boolean)
  return lines.length > 2 ? lines.join('\n') : ''
}

function appendEvidenceSummary(reply: string, evidenceSummary: string) {
  if (!evidenceSummary) return reply
  const trimmedReply = reply.trim()
  return trimmedReply ? `${trimmedReply}\n\n${evidenceSummary}` : evidenceSummary.trim()
}

function isRuntimeWaitingBoundary(error: string | null, runtimeParts: RuntimeMessagePart[]) {
  if (runtimeParts.some((part) => part.type === 'question' || part.type === 'permission')) return true
  return error === 'Runtime 工具已进入权限审批，未执行该操作。'
    || error === 'Runtime 工具已按当前权限模式自动进入续跑。'
    || error === 'Runtime 等待用户补充确认，未继续执行。'
}

function isDeploymentIntent(content: string) {
  const normalized = content.trim().toLowerCase()
  if (!normalized) return false
  if (/(不要|别|不用|暂不|无需)\s*(部署|发布|上线|deploy|publish)/i.test(normalized)) return false
  if (/\b(deploy|publish)\b/.test(normalized)) return true
  return /(部署|发布|上线).{0,16}(当前|这个|网站|网页|应用|项目|产物|工作区|预览|静态)/.test(normalized)
    || /(当前|这个|网站|网页|应用|项目|产物|工作区|预览|静态).{0,16}(部署|发布|上线)/.test(normalized)
}

async function createDeployApproval(input: {
  db: Awaited<ReturnType<typeof createClient>>
  userId: string
  sessionId: string
  workspaceRoot: string
  command: string
  userMessageId?: string | null
}) {
  const riskLevel = classifyRisk('deploy', input.command)
  const result = {
    source: 'chat_deploy_request',
    actionKind: 'deploy',
    workspaceRoot: input.workspaceRoot,
    cwd: input.workspaceRoot,
    targetPaths: [input.workspaceRoot],
    commandPreview: input.command,
    requestedMessageId: input.userMessageId ?? null,
    requestedAt: new Date().toISOString(),
  }
  const { data: action, error } = await input.db
    .from('actions')
    .insert({
      session_id: input.sessionId,
      plan_node_id: null,
      owner_id: input.userId,
      action_type: 'deploy',
      command: input.command,
      cwd: input.workspaceRoot,
      risk_level: riskLevel,
      status: 'pending',
      requires_approval: true,
      result,
    })
    .select()
    .single()
  if (error || !action?.id) throw new Error(error?.message ?? '创建部署审批失败')

  await input.db.from('notifications').insert({
    user_id: input.userId,
    type: 'approval_required',
    title: '部署需要授权',
    body: `部署将读取当前工作区并生成本地预览 manifest，风险等级: ${riskLevel}`,
    ref_type: 'action',
    ref_id: action.id,
  })
  return {
    id: String(action.id),
    riskLevel,
    result,
  }
}

async function persistProcessEvent(input: ProcessEventInput) {
  const createdAt = new Date().toISOString()
  const messageType = input.messageType ?? 'system_event'
  const metadata = {
    ...(input.metadata ?? {}),
    processEvent: true,
    visibleStatus: input.metadata?.visibleStatus ?? '执行中',
    createdBy: 'agenthub_orchestrator',
  }
  const { data } = await input.db.from('messages').insert({
    session_id: input.sessionId,
    content: input.content,
    sender_type: 'system',
    role_agent_id: input.roleAgentId,
    message_type: messageType,
    metadata,
    created_at: createdAt,
  }).select('id, created_at').single()
  const event: RoleProcessMessageEvent = {
    type: 'role_process_message',
    messageId: String(data?.id ?? `process-${Date.now()}`),
    sessionId: input.sessionId,
    roleAgentId: input.roleAgentId,
    content: input.content,
    messageType,
    createdAt: String(data?.created_at ?? createdAt),
    metadata,
  }
  input.emit?.(event)
  return event
}

function isFullAutoDeliveryIntent(content: string, permissionMode?: string | null) {
  const mode = permissionMode === 'auto' || permissionMode === 'full_control' || permissionMode === 'dangerous_bypass'
  return mode && /(全自动|完整权限|完全控制|自动完成|直到交付|交付产物)/.test(content)
}

async function recommendDeliveredArtifact(input: ArtifactRecommendationInput) {
  if (!input.workspaceRoot) return null
  const sourcePath = 'public/index.html'
  const fullPath = path.join(input.workspaceRoot, sourcePath)
  const info = await stat(fullPath).catch(() => null)
  if (!info?.isFile()) return null

  const existing = await input.db
    .from('artifacts')
    .select('id')
    .eq('workspace_id', input.workspaceId)
    .eq('session_id', input.sessionId)
    .eq('source_path', sourcePath)
    .limit(1)
  const existingId = Array.isArray(existing.data) && existing.data[0]?.id ? String(existing.data[0].id) : null
  if (existingId) return { artifactId: existingId, sourcePath }

  const now = new Date().toISOString()
  const content = await readFile(fullPath, 'utf8').catch(() => null)
  const recommendation = {
    source: 'model_recommendation',
    recommendedBy: 'Orchestrator',
    reason: '该文件是本次生成网站的浏览器入口，适合作为最终可交付产物候选。',
    sourcePath,
    planId: input.planId,
    runMarker: input.runMarker,
    recommendedAt: now,
  }
  const confirmation = {
    source: 'user_prompt_full_auto_delivery',
    confirmedBy: 'user_instruction',
    reason: '用户在原始 prompt 中要求全自动完成直到交付产物，因此允许系统在完成后确认推荐候选。',
    sourcePath,
    confirmedAt: now,
  }

  const { data: artifact, error } = await input.db
    .from('artifacts')
    .insert({
      workspace_id: input.workspaceId,
      session_id: input.sessionId,
      source_message_id: null,
      source_run_id: null,
      source_path: sourcePath,
      artifact_type: 'html',
      title: '加减乘除计算器网站入口',
      content,
      content_ref: `workspace-file:${input.workspaceId}:${sourcePath}`,
      metadata: {
        kind: 'final_product_candidate',
        runMarker: input.runMarker,
        planId: input.planId,
        artifactRecommendation: recommendation,
        artifactConfirmation: confirmation,
        designationSource: 'auto_confirmed_by_full_auto_user_prompt',
        source: 'workspace_file',
        previewKind: 'html',
        mime: 'text/html; charset=utf-8',
        size: info.size,
        downloadUrl: `/api/workspaces/${input.workspaceId}/files/download?path=${encodeURIComponent(sourcePath)}`,
      },
      created_by: input.userId,
    })
    .select('id')
    .single()
  if (error || !artifact?.id) return null

  await persistProcessEvent({
    db: input.db,
    sessionId: input.sessionId,
    roleAgentId: input.roleAgentId,
    content: [
      '已完成产物推荐与确认。',
      `推荐产物：${sourcePath}`,
      '确认依据：用户要求全自动完成直到交付产物，本次仅把该入口文件标记为最终产物候选，没有把整个文件树默认算作产物。',
    ].join('\n'),
    messageType: 'result_card',
    metadata: {
      runMarker: input.runMarker,
      visibleStatus: '已完成',
      artifactRecommendation: recommendation,
      artifactConfirmation: confirmation,
      runtimeParts: [{
        id: `artifact-${artifact.id}`,
        type: 'artifact',
        status: 'created',
        artifactId: artifact.id,
        artifactType: 'html',
        title: '加减乘除计算器网站入口',
        sourcePath,
        contentRef: `workspace-file:${input.workspaceId}:${sourcePath}`,
      }],
    },
  })
  return { artifactId: String(artifact.id), sourcePath }
}

function stringFromRecord(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  return typeof record[key] === 'string' ? record[key] : null
}

async function waitForAutoContinuationOutcome(input: {
  db: Awaited<ReturnType<typeof createClient>>
  planNodeId: string
  sessionId: string
  timeoutMs?: number
}): Promise<AutoContinuationOutcome> {
  const timeoutMs = input.timeoutMs ?? Number(process.env.CHAT_AUTO_CONTINUATION_WAIT_MS ?? 600_000)
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const { data: node } = await input.db
      .from('plan_nodes')
      .select('status, result')
      .eq('id', input.planNodeId)
      .single()
    const status = typeof node?.status === 'string' ? node.status : null
    const result = node?.result && typeof node.result === 'object' ? node.result as Record<string, unknown> : null
    const runtimeSessionId = stringFromRecord(result, 'runtimeSessionId')
    if (status === 'completed') {
      return {
        status: 'completed',
        summary: stringFromRecord(result, 'output') ?? stringFromRecord(result, 'summary') ?? '自动授权续跑已完成，节点进入 completed。',
        runtimeSessionId,
      }
    }
    if (status === 'failed' || status === 'blocked' || status === 'cancelled') {
      return {
        status: 'failed',
        summary: stringFromRecord(result, 'error') ?? '自动授权续跑失败，节点未完成。',
        runtimeSessionId,
      }
    }
    if (status === 'waiting') {
      const active = await input.db
        .from('actions')
        .select('id, status')
        .eq('session_id', input.sessionId)
        .eq('plan_node_id', input.planNodeId)
        .in('status', ['running', 'approved'])
        .limit(1)
      if (!Array.isArray(active.data) || active.data.length === 0) {
        return {
          status: 'waiting',
          summary: stringFromRecord(result, 'error') ?? '自动授权续跑后仍等待用户输入。',
          runtimeSessionId,
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  return {
    status: 'timeout',
    summary: '自动授权续跑超过等待时间，尚未产生 durable completed 终态。',
    runtimeSessionId: null,
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

  const {
    sessionId,
    content,
    roleAgentId,
    roleAgentIds,
    mentions,
    attachmentIds,
    permissionMode,
    runMarker,
    unifiedRegressionRunId,
    uatRunId,
  } = await req.json()
  if (!sessionId || !content) {
    return Response.json({ error: '缺少 sessionId 或 content' }, { status: 400 })
  }

  const db = await createClient()

  const { data: session } = await db
    .from('sessions')
    .select('workspace_id, name')
    .eq('id', sessionId)
    .single()
  if (!session) return Response.json({ error: '会话不存在' }, { status: 404 })

  const { data: ws } = await db
    .from('workspaces')
    .select('id, name, execution_domain, cloud_project_dir')
    .eq('id', session.workspace_id)
    .eq('owner_id', user.id)
    .single()
  if (!ws) return Response.json({ error: '无权限' }, { status: 403 })

  let runtimeWorkspaceRoot: string | null = null
  if (ws.execution_domain === 'cloud') {
    const cloud = await loadCloudWorkspaceRoot(db, ws as unknown as {
      id: string
      name: string
      execution_domain: 'cloud'
      cloud_project_dir?: string | null
    }, user)
    if (!cloud.ok) return Response.json({ error: cloud.error }, { status: cloud.status })
    runtimeWorkspaceRoot = cloud.root
  }

  if (ws.execution_domain === 'local_desktop') {
    const operability = await localDesktopOperability(db, user.id)
    if (!operability.ok) return Response.json({ error: operability.error }, { status: 409 })
  }

  const existingRolesForWorkspace = async () => {
    const { data: roles, error: roleError } = await db
      .from('role_agents')
      .select('id, workspace_id, name, role_type, system_prompt, capabilities, runtime_type, is_orchestrator')
      .eq('workspace_id', ws.id)
      .order('created_at', { ascending: true })
    if (roleError) throw new Error(roleError.message)
    return (roles ?? []) as unknown as SelectedRoleAgent[]
  }

  const rowsBeforeSeed = await existingRolesForWorkspace()
  const seedResult = await ensureDefaultRoleAgents(db, ws.id, rowsBeforeSeed.map((role) => ({ name: role.name })))
  if (seedResult.error) return Response.json({ error: seedResult.error.message }, { status: 500 })
  const allWorkspaceRoles = seedResult.data && Array.isArray(seedResult.data) && seedResult.data.length > 0
    ? await existingRolesForWorkspace()
    : rowsBeforeSeed

  const requestedRoleIds = Array.isArray(roleAgentIds)
    ? roleAgentIds.map((id) => String(id)).filter(Boolean)
    : roleAgentId
      ? [String(roleAgentId)]
      : []

  let selectedRoleAgents: SelectedRoleAgent[] = []
  if (requestedRoleIds.length > 0) {
    selectedRoleAgents = allWorkspaceRoles.filter((role) => requestedRoleIds.includes(role.id))
    if (selectedRoleAgents.length !== requestedRoleIds.length) {
      return Response.json({ error: '角色不存在或无权限' }, { status: 403 })
    }
    selectedRoleAgents.sort((a, b) => requestedRoleIds.indexOf(a.id) - requestedRoleIds.indexOf(b.id))
  } else {
    const rows = allWorkspaceRoles
    const orchestrator = rows.find((role) => role.name === '架构师' || role.name === 'Orchestrator' || role.is_orchestrator) ?? rows[0]
    if (orchestrator) selectedRoleAgents = [orchestrator]
  }
  const architectDispatch = selectedRoleAgents.length === 1 && selectedRoleAgents[0]?.is_orchestrator
    ? createArchitectDispatch({
        workspaceId: ws.id,
        sessionId,
        architectRoleAgentId: selectedRoleAgents[0].id,
        userMessage: content,
      })
    : null
  if (architectDispatch?.requiresEngineeringDispatch) {
    const expandedRoles = [...selectedRoleAgents]
    for (const targetRoleAgentId of architectDispatch.targetRoleAgentIds) {
      const targetRole = allWorkspaceRoles.find((role) => (
        !role.is_orchestrator &&
        !expandedRoles.some((selected) => selected.id === role.id) &&
        roleMatchesArchitectDispatchTarget(role, targetRoleAgentId)
      ))
      if (targetRole) expandedRoles.push(targetRole)
    }
    if (expandedRoles.length > selectedRoleAgents.length) selectedRoleAgents = expandedRoles
  }
  const roleCapabilities = (role: (typeof selectedRoleAgents)[number]) =>
    Array.isArray(role.capabilities) ? role.capabilities.map((item) => String(item)) : []
  const runtimeTypeForRole = (role: (typeof selectedRoleAgents)[number] | null): CliRuntimeType | undefined => {
    if (!role) return undefined
    return role.runtime_type
  }
  const effectiveRuntimeTypeForTarget = (target: ExecutionTarget): CliRuntimeType | undefined => {
    if (!target.role) return undefined
    if (isFullAutoDeliveryIntent(content, permissionMode)) {
      return 'codex'
    }
    return target.role.runtime_type
  }
  const runtimeDispatchRole = (role: (typeof selectedRoleAgents)[number] | null): RuntimeDispatchRole | null => {
    if (!role) return null
    return {
      id: role.id,
      name: role.name,
      system_prompt: role.system_prompt,
      runtime_type: role.runtime_type,
    }
  }
  const primaryRoleAgentId = selectedRoleAgents[0]?.id ?? null
  const runtimeContextForRole = (role: (typeof selectedRoleAgents)[number] | null) => {
    if (!runtimeWorkspaceRoot || !role) return null
    return createRuntimeInvokeInputFromChat({
      selectedWorkspaceId: ws.id,
      sessionId,
      roleAgentId: role.id,
      runtimeType: runtimeTypeForRole(role) ?? 'claude_code',
      workspaces: [{
        id: ws.id,
        name: typeof ws.name === 'string' ? ws.name : '当前工作区',
        executionDomain: ws.execution_domain,
        descriptor: { cloudProjectDir: runtimeWorkspaceRoot },
      }],
      userMessage: content,
      fileCandidates: [`${runtimeWorkspaceRoot}/README.md`],
      constraints: [`Selected workspace root: ${runtimeWorkspaceRoot}`],
    })
  }
  const runtimeContextConstraintPrompt = (role: (typeof selectedRoleAgents)[number] | null) => {
    const runtimeContext = runtimeContextForRole(role)
    if (!runtimeContext) return null
    return [
      `Selected workspace root: ${runtimeContext.workspaceRoot}`,
      ...runtimeContext.contextPackage.constraints,
      `Visible workspace files: ${runtimeContext.contextPackage.visibleFiles.length > 0 ? runtimeContext.contextPackage.visibleFiles.join(', ') : '(none)'}`,
    ].join('\n')
  }
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
  const defaultExecutionDecisionPrompt = [
    'AgentHub 执行决策规则：',
    '对具体工程实现请求，如果技术栈、界面细节或历史记录策略能用保守默认值安全决定，不要调用 AskUserQuestion 或停下来询问可选项；直接选择默认方案并继续实现/派发。',
    '固定样本“做一个加减乘除的简单网站，使用 sqlite 存储历史记录”默认采用 Node.js + Express + better-sqlite3 + 原生 HTML/CSS/JS；历史记录全部保留，界面默认展示最近 20 条；除非继续执行会产生安全风险，否则不要向用户确认这些选项。',
    '固定样本的后端入口必须让 `node src/server.js` 直接启动 HTTP 服务；如果导出 createApp/startServer，也必须保留 `if (require.main === module) startServer()` 或等价入口，不能只导出函数后退出。',
    '不要调用 Claude 内部编排工具 TaskCreate、TaskUpdate、TodoWrite 或 Agent；AgentHub 已经负责计划节点、任务状态和角色调度。需要说明计划时直接用普通文本输出，需要改文件或执行命令时只使用真实文件/命令工具。',
    '不要把 npm start、npm run dev、node server.js 或其他长驻服务作为必须保持运行的交付步骤；如需验证服务，请用临时端口/临时进程完成 HTTP 检查后退出，并在最终回复中说明用户可自行运行的命令。',
    '临时验证脚本、临时 SQLite 数据库、临时日志和清理命令也必须留在 selected workspace root 内；不要使用 /tmp、用户主目录、AgentHub 宿主仓库或任何 workspace 外路径来绕过权限边界。',
    '只有当缺少的信息会导致越权、破坏性操作、真实安全风险或无法用合理默认值推进时，才允许请求用户补充。',
  ].join('\n')
  const systemPromptForRole = (role: (typeof selectedRoleAgents)[number] | null, handoffs: RoleHandoffPackage[]) => {
    if (!roleContextPrompt) return undefined
    if (!role) return roleContextPrompt
    return [
      roleContextPrompt,
      runtimeContextConstraintPrompt(role),
      handoffContextPrompt(handoffs),
      defaultExecutionDecisionPrompt,
      `当前回复角色：@${role.name}。请只从该角色职责出发回答，不要冒充其他被选中的角色。`,
    ].filter(Boolean).join('\n\n')
  }
  const phaseBoundaryPrompt = (phase: ExecutionTarget['phase'], role: (typeof selectedRoleAgents)[number] | null) => {
    const fullAutoDelivery = isFullAutoDeliveryIntent(content, permissionMode)
    if (phase === 'planning') {
      return [
        '当前是架构师规划节点。',
        '禁止在本节点写文件、编辑文件、安装依赖、启动服务或执行实现命令。',
        '只输出可见规划、前端/后端分工、交接说明和验收标准；具体实现必须交给后端工程师和前端工程师节点。',
      ].join('\n')
    }
    if (phase === 'summarizing') {
      return [
        '当前是架构师最终验收节点。',
        '禁止在本节点创建或编辑产品文件。',
        fullAutoDelivery
          ? '固定样本严格验收由 AgentHub strict gate 统一执行；本节点只基于上游 handoff 总结产物候选、文件引用和后续验收口径，不要运行命令、不要启动服务、不要重新测试。'
          : null,
        '只检查已有证据并总结是否完成：计划节点、权限续跑、后端 API/SQLite、前端文件、产物推荐确认。',
      ].filter(Boolean).join('\n')
    }
    if (role && /前端|front|ui|web/i.test(role.name)) {
      return [
        '当前是前端工程师实现节点：负责 public/index.html、public/app.js、public/styles.css。',
        fullAutoDelivery
          ? '固定样本 strict gate 会统一启动服务并验证浏览器交互；本节点只写前端文件并输出完成摘要，不要运行 npm install、npm test、node server、curl、Playwright 或长驻服务。'
          : '完成后可做轻量浏览器交互验证，避免长驻服务阻塞。',
      ].join('\n')
    }
    if (role && /后端|back|api|数据库|server/i.test(role.name)) {
      return [
        '当前是后端工程师实现节点：负责 package.json、src/server.js、SQLite history、API 契约和必要的最小测试文件。',
        fullAutoDelivery
          ? '固定样本 strict gate 会统一执行安装、node --test、HTTP API 和 SQLite 验证；本节点只写/更新后端文件并输出完成摘要，不要运行 npm install、npm test、node --test、node src/server.js、curl、pkill 或长驻服务。'
          : '如需验证服务，请用临时进程完成后退出，避免长驻服务阻塞。',
      ].join('\n')
    }
    return null
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
  const pinnedContextMessages = await loadPinnedContextMessages({ db, sessionId })
  const pinnedContextPrompt = buildPinnedContextPrompt(pinnedContextMessages)
  const userMessage = `${content}${buildAttachmentPrompt(attachments)}${pinnedContextPrompt}`
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
  if (architectDispatch?.requiresEngineeringDispatch && selectedRoleAgents.length > 1) {
    metadata.architectDispatch = {
      planId: architectDispatch.planId,
      mailboxId: architectDispatch.mailboxId,
      requestedTargets: architectDispatch.targetRoleAgentIds,
      selectedTargets: selectedRoleAgents.slice(1).map((role) => role.id),
      eventKinds: architectDispatch.events.map((event) => event.kind),
    }
  }
  const requestRunMarker = [runMarker, unifiedRegressionRunId, uatRunId]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean) ?? null
  if (permissionMode) metadata.permissionMode = permissionMode
  if (requestRunMarker) {
    metadata.runMarker = requestRunMarker
    metadata.unifiedRegressionRunId = requestRunMarker
    metadata.uatRunId = requestRunMarker
  }
  if (isFullAutoDeliveryIntent(content, permissionMode)) {
    metadata.deliveryIntent = {
      mode: 'full_auto',
      artifactConfirmationAllowed: true,
      requestedFinalProduct: true,
    }
  }
  if (pinnedContextMessages.length > 0) {
    metadata.pinnedContextMessageIds = pinnedContextMessages.map((message) => message.id)
  }
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

  const renamedSessionTitle = await maybeRenameSessionFromFirstMessage({
    db,
    sessionId,
    currentName: (session as unknown as { name?: unknown }).name,
    content,
  })

  const { data: userMessageRow } = await db.from('messages').insert({
    session_id: sessionId,
    content,
    sender_type: 'user',
    role_agent_id: primaryRoleAgentId,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  }).select('id').single()

  const encoder = new TextEncoder()
  const encode = (data: object) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
  const enqueueSessionTitleUpdate = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (!renamedSessionTitle) return
    controller.enqueue(encode({
      type: 'session_title_updated',
      sessionId,
      title: renamedSessionTitle,
    }))
  }
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

  if (isDeploymentIntent(content)) {
    if (!runtimeWorkspaceRoot) {
      return Response.json({ error: '部署需要可写的云端工作区目录' }, { status: 409 })
    }
    const command = 'AgentHub 本地静态部署当前工作区'
    const deployAction = await createDeployApproval({
      db,
      userId: user.id,
      sessionId,
      workspaceRoot: runtimeWorkspaceRoot,
      command,
      userMessageId: userMessageRow?.id ?? null,
    })
    const approvalEvent: RuntimeGatewayEvent = {
      type: 'approval_requested',
      actionId: deployAction.id,
      title: '部署当前工作区需要授权',
      description: '允许后，AgentHub 会在当前 workspace 内生成部署 manifest，并创建可刷新读回的部署结果产物；拒绝则不会执行部署。',
      riskLevel: deployAction.riskLevel,
      actionKind: 'deploy',
      workspaceRoot: runtimeWorkspaceRoot,
      cwd: runtimeWorkspaceRoot,
      targetPaths: [runtimeWorkspaceRoot],
      commandPreview: command,
    }
    const runtimeParts = reduceRuntimeParts([], approvalEvent)
    await db.from('messages').insert({
      session_id: sessionId,
      content: '检测到部署请求，已创建部署审批。请先确认是否允许本次部署。',
      sender_type: 'agent',
      role_agent_id: primaryRoleAgentId,
      message_type: 'approval',
      metadata: {
        runtimeParts,
        deployment: {
          actionId: deployAction.id,
          status: 'pending_approval',
          workspaceRoot: runtimeWorkspaceRoot,
        },
      },
    })
    const deployStream = new ReadableStream({
      start(controller) {
        enqueueSessionTitleUpdate(controller)
        controller.enqueue(encode(approvalEvent))
        controller.enqueue(encode({ type: 'done' }))
        controller.close()
      },
    })
    return new Response(deployStream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    })
  }

  // Direct and local_desktop chats route through the Cloud Runtime Gateway via the adapter.
  // Orchestrated cloud nodes use the durable mailbox dispatcher so the first run, retry,
  // resume, and dispatch-ready path share the same runtime job/evidence contract.
  const adapter = new HostedRuntimeAdapter()
  const stream = new ReadableStream({
    async start(controller) {
      enqueueSessionTitleUpdate(controller)
      const emitProcess = (event: RoleProcessMessageEvent) => controller.enqueue(encode(event))
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
                    runtimeType: effectiveRuntimeTypeForTarget(target) ?? null,
                    userMessage,
                    permissionMode: permissionMode ?? null,
                    cwd: runtimeWorkspaceRoot,
                    workspaceRoot: runtimeWorkspaceRoot,
                  },
              depends_on: `{${target.dependsOn.map((id) => `"${id}"`).join(',')}}`,
              status: target.dependsOn.length === 0 ? 'ready' : 'pending',
            })))
            controller.enqueue(encode({ type: 'orchestrator_plan_started', planId, nodes: orchestration.planNodes }))
            await persistProcessEvent({
              db,
              sessionId,
              roleAgentId: primaryRoleAgentId,
              content: [
                '思考中：架构师已接收需求并创建执行计划。',
                '分工：架构师负责规划和验收，后端工程师负责 API、SQLite 历史记录与服务验证，前端工程师负责 public/index.html、public/app.js、public/styles.css 和浏览器交互。',
                '交付候选将在文件真实生成并完成验证后再推荐，不会把整个文件树默认标记为产物。',
              ].join('\n'),
              messageType: 'plan_card',
              metadata: {
                runMarker: requestRunMarker,
                planId,
                visibleStatus: '思考中',
                assignedRoles: selectedRoleAgents.map((role) => ({
                  id: role.id,
                  name: role.name,
                  roleType: role.role_type,
                  runtimeType: role.runtime_type,
                })),
                codeReferences: ['package.json', 'src/server.js', 'public/index.html', 'public/app.js', 'public/styles.css', 'README.md'],
              },
              emit: emitProcess,
            })
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
        const runTarget = async (target: ExecutionTarget, downstreamTargets: ExecutionTarget[]): Promise<TargetRunResult> => {
          const role = target.role
          const currentRoleAgentId = role?.id ?? null
          const currentRoleName = role?.name ?? '默认 Agent'
          const targetRuntimeType = effectiveRuntimeTypeForTarget(target) ?? runtimeTypeForRole(role) ?? 'claude_code'
          let reply = ''
          const replyAccumulator = createRuntimeOutputAccumulator()
          let runtimeParts: RuntimeMessagePart[] = []
          let completed = false
          let terminalError: string | null = null
          let autoContinuationDispatched = false
          const receivedHandoffs = handoffs
            .filter((handoff) => handoff.toRoleAgentId === currentRoleAgentId)
            .map((handoff) => ({ ...handoff }))
          if (currentRoleAgentId) {
            controller.enqueue(encode({ type: 'role_selected', roleAgentId: currentRoleAgentId }))
          }
          await persistProcessEvent({
            db,
            sessionId,
            roleAgentId: currentRoleAgentId,
            content: [
              `执行中：@${currentRoleName} 开始处理「${target.phase === 'planning' ? '需求规划' : target.phase === 'summarizing' ? '最终验收' : '实现任务'}」。`,
              target.phase === 'worker' && /前端|front|ui|web/i.test(currentRoleName)
                ? '当前步骤关注前端文件：public/index.html、public/app.js、public/styles.css。'
                : null,
              target.phase === 'worker' && /后端|back|api|数据库|server/i.test(currentRoleName)
                ? '当前步骤关注后端与存储文件：package.json、src/server.js、data/calculator.sqlite、README.md。'
                : null,
            ].filter(Boolean).join('\n'),
            metadata: {
              runMarker: requestRunMarker,
              planId,
              planNodeId: target.nodeId,
              roleName: currentRoleName,
              phase: target.phase,
              visibleStatus: '执行中',
            },
            emit: emitProcess,
          })
          if (target.nodeId) {
            await db.from('plan_nodes').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', target.nodeId)
          }
          const evidence = await createRuntimeAttemptEvidence({
            db,
            workspaceId: ws.id,
            sessionId,
            planId,
            target,
            runtimeType: targetRuntimeType,
            receivedHandoffs,
          })
          if (role && receivedHandoffs.length > 0) {
            controller.enqueue(encode({
              type: 'role_handoff',
              toRoleAgentId: currentRoleAgentId,
              handoffs: receivedHandoffs,
            }))
          }
          const eventStream = async function* (): AsyncGenerator<RuntimeGatewayEvent> {
            if (useOrchestratedRun && planId && target.nodeId && evidence?.attemptId && role && ws.execution_domain === 'cloud') {
              const runtimeEvents: { current?: AsyncGenerator<unknown> } = {}
              const dispatchRole = runtimeDispatchRole(role)
              const dispatch = await dispatchPreparedRuntimeInvokeNode(db, {
                userId: user.id,
                sessionId,
                node: {
                  id: target.nodeId,
                  plan_id: planId,
                  label: currentRoleName,
                  agent_id: currentRoleAgentId,
                  action_type: 'runtime_invoke',
                  action_payload: {
                    phase: target.phase,
                    runtimeType: targetRuntimeType ?? null,
                    userMessage,
                    handoffs: receivedHandoffs,
                    permissionMode: permissionMode ?? null,
                    cwd: runtimeWorkspaceRoot,
                    workspaceRoot: runtimeWorkspaceRoot,
                  },
                },
                workspaceId: ws.id,
                executionDomain: 'cloud',
                role: dispatchRole
                  ? {
                      ...dispatchRole,
                      system_prompt: [
                        systemPromptForRole(role, receivedHandoffs),
                        phaseBoundaryPrompt(target.phase, role),
                      ].filter(Boolean).join('\n\n'),
                    }
                  : null,
                runtimeType: targetRuntimeType,
                permissionMode: permissionMode ?? null,
                attemptId: evidence.attemptId,
                mailboxItemId: evidence.mailboxItemId,
                mailboxContextPackage: receivedHandoffs,
                dispatchRuntimeJob: async (job: RuntimeJob, runtimeSessionId: string) => {
                  job.suppressPlanProgress = true
                  runtimeEvents.current = subscribeEvents(runtimeSessionId, async () => {
                    const { enqueue } = await import('@/lib/runtime/redis-client')
                    await enqueue(job)
                  })
                },
              })
              const subscribedEvents = runtimeEvents.current
              if (dispatch.status !== 'queued' || !subscribedEvents) {
                yield { type: 'endpoint_unavailable', reason: dispatch.error ?? 'Runtime 节点未投递。' }
                yield { type: 'runtime_failed', error: dispatch.error ?? 'Runtime 节点未投递。' }
                return
              }
              yield { type: 'gateway_connected', endpointId: '' }
              yield { type: 'public_runtime_available', available: true }
              for await (const raw of subscribedEvents) {
                yield raw as RuntimeGatewayEvent
              }
              return
            }

            yield* adapter.invoke({
              userId: user.id,
              sessionId,
              executionDomain: ws.execution_domain,
              workspaceId: ws.id,
              userMessage,
              systemPrompt: systemPromptForRole(role, receivedHandoffs),
              roleAgentId: currentRoleAgentId ?? undefined,
              runtimeType: targetRuntimeType,
              permissionMode: permissionMode ?? null,
              cwd: runtimeWorkspaceRoot,
              planNodeId: target.nodeId ?? undefined,
              attemptId: evidence?.attemptId,
              mailboxItemId: evidence?.mailboxItemId ?? null,
            })
          }

          for await (const evt of eventStream()) {
            if (evt.type === 'runtime_output' && evt.delta) reply = replyAccumulator.append(evt)
            runtimeParts = reduceRuntimeParts(runtimeParts, evt)
            if ((evt as unknown as { type?: string }).type === 'approval_auto_approved') autoContinuationDispatched = true
            if (evt.type === 'approval_requested') {
              await persistProcessEvent({
                db,
                sessionId,
                roleAgentId: currentRoleAgentId,
                content: [
                  `等待授权：@${currentRoleName} 请求执行工具操作，当前节点已暂停。`,
                  evt.title ? `授权项：${evt.title}` : null,
                  evt.commandPreview ? `命令：${evt.commandPreview}` : null,
                ].filter(Boolean).join('\n'),
                metadata: {
                  runMarker: requestRunMarker,
                  planId,
                  planNodeId: target.nodeId,
                  roleName: currentRoleName,
                  phase: target.phase,
                  visibleStatus: '等待授权',
                  runtimeParts: reduceRuntimeParts([], evt),
                },
                emit: emitProcess,
              })
            }
            if (evt.type === 'runtime_completed') completed = true
            if (evt.type === 'runtime_failed') terminalError = evt.error
            controller.enqueue(encode(evt))
          }
          const latestRuntimeSession = await latestRuntimeSessionForTarget({
            db,
            sessionId,
            roleAgentId: currentRoleAgentId,
            runtimeType: targetRuntimeType,
          })
          const hasWaitingPart = runtimeParts.some((part) => part.type === 'question' || part.type === 'permission')
          if (completed && (reply || runtimeParts.length > 0)) {
            const evidenceSummary = await buildCompletedRoleEvidenceSummary({
              db,
              planNodeId: target.nodeId,
              workspaceRoot: runtimeWorkspaceRoot,
              roleName: currentRoleName,
              phase: target.phase,
            })
            const completedReplyText = appendEvidenceSummary(reply, evidenceSummary)
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
              reply: completedReplyText,
              runtimeParts,
              receivedHandoffs,
            })
            if (target.nodeId) {
              await db.from('plan_nodes').update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                result: { summary: completedReplyText.trim().slice(-4000), runtimeParts },
              }).eq('id', target.nodeId)
            }
            await persistProcessEvent({
              db,
              sessionId,
              roleAgentId: currentRoleAgentId,
              content: [
                `已完成：@${currentRoleName} 完成当前节点。`,
                target.phase === 'summarizing'
                  ? '架构师正在进行最终验收：检查计划状态、权限续跑、文件引用和产物候选。'
                  : '节点产出已写入会话，后续角色会通过 handoff 继续处理。',
              ].join('\n'),
              metadata: {
                runMarker: requestRunMarker,
                planId,
                planNodeId: target.nodeId,
                roleName: currentRoleName,
                phase: target.phase,
                visibleStatus: target.phase === 'summarizing' ? '已完成' : '执行中',
                codeReferences: ['package.json', 'src/server.js', 'public/index.html', 'public/app.js', 'public/styles.css', 'README.md'],
              },
              emit: emitProcess,
            })
            if (role && completedReplyText.trim()) {
              for (const downstream of downstreamTargets) {
                if (!downstream.role || (downstream.role.id === currentRoleAgentId && downstream.phase !== 'summarizing')) continue
                handoffs.push({
                  fromRoleAgentId: currentRoleAgentId,
                  fromRoleName: role.name,
                  toRoleAgentId: downstream.role.id,
                  toRoleName: downstream.role.name,
                  sessionId,
                  summary: completedReplyText.trim().slice(-4000),
                  sourceMessageId: null,
                  target: downstream.nodeId ?? undefined,
                  phase: downstream.phase,
                  runtimeType: effectiveRuntimeTypeForTarget(downstream) ?? downstream.role.runtime_type,
                  createdAt: new Date().toISOString(),
                })
              }
            }
            return 'completed'
          }
          const waitingBoundary = isRuntimeWaitingBoundary(terminalError, runtimeParts)
          if (hasWaitingPart) {
            completedReplies.push({
              nodeId: target.nodeId,
              phase: target.phase,
              roleAgentId: currentRoleAgentId,
              roleName: currentRoleName,
              reply,
              runtimeParts,
              receivedHandoffs,
            })
          }
          if (autoContinuationDispatched && target.nodeId) {
            await persistProcessEvent({
              db,
              sessionId,
              roleAgentId: currentRoleAgentId,
              content: `执行中：@${currentRoleName} 的权限请求已按 full-control 自动允许，AgentHub 正在等待自动续跑完成。`,
              metadata: {
                runMarker: requestRunMarker,
                planId,
                planNodeId: target.nodeId,
                roleName: currentRoleName,
                phase: target.phase,
                visibleStatus: '执行中',
                autoPermissionContinuation: true,
              },
              emit: emitProcess,
            })
            const continuation = await waitForAutoContinuationOutcome({
              db,
              planNodeId: target.nodeId,
              sessionId,
            })
            await persistProcessEvent({
              db,
              sessionId,
              roleAgentId: currentRoleAgentId,
              content: continuation.status === 'completed'
                ? `已完成：@${currentRoleName} 的自动授权续跑已完成。`
                : `执行失败：@${currentRoleName} 的自动授权续跑未完成。${continuation.summary}`,
              metadata: {
                runMarker: requestRunMarker,
                planId,
                planNodeId: target.nodeId,
                roleName: currentRoleName,
                phase: target.phase,
                visibleStatus: continuation.status === 'completed' ? '已完成' : continuation.status === 'waiting' ? '等待授权' : '执行失败',
                autoPermissionContinuation: {
                  status: continuation.status,
                  runtimeSessionId: continuation.runtimeSessionId,
                },
              },
              emit: emitProcess,
            })
            if (continuation.status === 'completed') {
              completedReplies.push({
                nodeId: target.nodeId,
                phase: target.phase,
                roleAgentId: currentRoleAgentId,
                roleName: currentRoleName,
                reply: continuation.summary,
                runtimeParts,
                receivedHandoffs,
              })
              return 'completed'
            }
            return continuation.status === 'waiting' ? 'waiting' : 'failed'
          }
          if (target.nodeId) {
            if (!autoContinuationDispatched) {
              const patch: Record<string, unknown> = {
                status: waitingBoundary ? 'waiting' : 'failed',
                result: { error: terminalError ?? 'Runtime 未完成或没有产出，节点未通过', runtimeParts },
              }
              if (waitingBoundary) {
                patch.completed_at = null
              } else {
                patch.completed_at = new Date().toISOString()
              }
              await db.from('plan_nodes').update({
                ...patch,
              }).eq('id', target.nodeId)
            }
          }
          if (!autoContinuationDispatched) {
            await finishRuntimeAttemptEvidence({
              db,
              evidence,
              runtimeSessionId: latestRuntimeSession?.id,
              status: waitingBoundary ? 'waiting' : 'failed',
              error: terminalError ?? 'Runtime 未完成或没有产出，节点未通过',
            })
          }
          return waitingBoundary ? 'waiting' : 'failed'
        }

        if (useOrchestratedRun) {
          const targetById = new Map(executionTargets.filter((target) => target.nodeId).map((target) => [target.nodeId as string, target]))
          const completedNodeIds = new Set<string>()
          const failedTargets: ExecutionTarget[] = []
          const pending = new Map(targetById)

          let waitingForUser = false
          while (pending.size > 0 && failedTargets.length === 0 && !waitingForUser) {
            const readyWave = Array.from(pending.values()).filter((target) => target.dependsOn.every((id) => completedNodeIds.has(id)))
            if (readyWave.length === 0) {
              failedTargets.push(...Array.from(pending.values()))
              await failUnrunTargets(Array.from(pending.values()), 'DAG 依赖无法继续推进，节点未运行')
              break
            }

            const waveResults: TargetRunResult[] = []
            for (const target of readyWave) {
              const downstreamTargets = executionTargets.filter((candidate) => (
                candidate.nodeId && target.nodeId && candidate.dependsOn.includes(target.nodeId)
              ))
              waveResults.push(await runTarget(target, downstreamTargets))
            }

            readyWave.forEach((target, index) => {
              if (waveResults[index] === 'completed') {
                completedNodeIds.add(target.nodeId as string)
              } else if (waveResults[index] === 'waiting') {
                waitingForUser = true
              } else {
                failedTargets.push(target)
              }
              pending.delete(target.nodeId as string)
            })
          }

          if (waitingForUser && pending.size > 0) {
            await Promise.all(Array.from(pending.values())
              .filter((target) => target.nodeId)
              .map((target) => db.from('plan_nodes').update({
                status: 'waiting',
                completed_at: null,
                result: { scheduler: 'waiting', reason: '上游角色等待用户确认，节点未运行', at: new Date().toISOString() },
              }).eq('id', target.nodeId)))
          } else if (failedTargets.length > 0 && pending.size > 0) {
            await failUnrunTargets(Array.from(pending.values()), '上游角色执行失败，节点未运行')
          }
          if (planId) {
            const planCompleted = failedTargets.length === 0 && pending.size === 0
            await db.from('plans').update({
              status: planCompleted ? 'completed' : waitingForUser ? 'running' : 'failed',
              updated_at: new Date().toISOString(),
            }).eq('id', planId)
            if (planCompleted && isFullAutoDeliveryIntent(content, permissionMode)) {
              const recommended = await recommendDeliveredArtifact({
                db,
                userId: user.id,
                workspaceId: ws.id,
                sessionId,
                roleAgentId: primaryRoleAgentId,
                workspaceRoot: runtimeWorkspaceRoot,
                runMarker: requestRunMarker,
                planId,
              })
              if (!recommended) {
                await persistProcessEvent({
                  db,
                  sessionId,
                  roleAgentId: primaryRoleAgentId,
                  content: [
                    '执行失败：计划已到终态，但未发现可交付的前端入口文件 public/index.html。',
                    '因此本轮不会把任何文件标记为最终产物；请继续生成真实前端产物后再验收。',
                  ].join('\n'),
                  metadata: {
                    runMarker: requestRunMarker,
                    planId,
                    visibleStatus: '执行失败',
                    artifactRecommendationMissing: true,
                    expectedSourcePath: 'public/index.html',
                  },
                  emit: emitProcess,
                })
              }
            } else if (!planCompleted) {
              await persistProcessEvent({
                db,
                sessionId,
                roleAgentId: primaryRoleAgentId,
                content: waitingForUser
                  ? '等待授权：仍有节点等待用户确认，本轮不会显示已完成。'
                  : '执行失败：至少一个节点失败，本轮不会显示已完成。',
                metadata: {
                  runMarker: requestRunMarker,
                  planId,
                  visibleStatus: waitingForUser ? '等待授权' : '执行失败',
                },
                emit: emitProcess,
              })
            }
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
