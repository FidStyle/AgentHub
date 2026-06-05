import { createClient } from '../lib/app-db-client'
import { advancePlanProgress } from '../lib/orchestrator/plan-progress'
import { dispatchReadyMailboxItems } from '../lib/orchestrator/mailbox-control'
import {
  CliRuntimeExecutor,
  type ExecutorChunk,
  FakeExecutor,
  ScriptedRealExecutor,
  type CliRuntimeType,
  type NativeCliQuestionRequest,
  type NativeCliToolRequest,
  type RuntimeExecutor,
} from '../lib/runtime/executor'
import { dequeue, publishEvent, isCancelled, setHeartbeat, isAlive, clearHeartbeat, setWorkerAlive, clearWorkerAlive, type RuntimeJob } from '../lib/runtime/redis-client'
import { redact } from '../lib/runtime/redact'
import { evaluateNativeCliToolPermission, type NativeCliToolCall } from '@agenthub/shared'

const HEARTBEAT_TTL_SEC = Number(process.env.RUNTIME_HEARTBEAT_TTL_SEC ?? 30)
const HEARTBEAT_EVENT_INTERVAL_MS = Number(process.env.RUNTIME_HEARTBEAT_EVENT_INTERVAL_MS ?? 15_000)
const WORKER_PRESENCE_TTL_SEC = Number(process.env.RUNTIME_WORKER_PRESENCE_TTL_SEC ?? 15)
const WORKER_PRESENCE_INTERVAL_MS = Math.max(1_000, Math.floor((WORKER_PRESENCE_TTL_SEC * 1_000) / 3))
const DEFAULT_RUNTIME_JOB_TIMEOUT_MS = 15 * 60_000

function runtimeTypeForJob(job?: RuntimeJob): CliRuntimeType {
  if (job?.runtimeType === 'codex' || job?.runtimeType === 'claude_code') return job.runtimeType
  return process.env.RUNTIME_CLI === 'codex' ? 'codex' : 'claude_code'
}

// Selects the executor from env. Product/acceptance default is the real CLI executor. Fake/scripted
// executors are explicit test modes only and must not be used as proof of product runtime success.
// Real mode is selected per job so one worker can dispatch all available machine CLIs.
export function createExecutor(job?: RuntimeJob): RuntimeExecutor {
  if (!process.env.RUNTIME_EXECUTOR || process.env.RUNTIME_EXECUTOR === 'real') {
    if (!job?.cwd) {
      throw new Error('RUNTIME_CWD_REQUIRED')
    }
    return new CliRuntimeExecutor({ runtimeType: runtimeTypeForJob(job), cwd: job.cwd })
  }
  const testExecutorAllowed = process.env.NODE_ENV === 'test' || process.env.AGENTHUB_ALLOW_TEST_EXECUTOR === 'true'
  if (!testExecutorAllowed) {
    throw new Error(`RUNTIME_EXECUTOR=${process.env.RUNTIME_EXECUTOR} is only allowed for tests`)
  }
  if (process.env.RUNTIME_EXECUTOR === 'script') return new ScriptedRealExecutor()
  if (process.env.RUNTIME_EXECUTOR === 'fake') return new FakeExecutor()
  throw new Error(`Unsupported RUNTIME_EXECUTOR=${process.env.RUNTIME_EXECUTOR}`)
}

type Terminal = 'completed' | 'cancelled' | 'failed'
type PlanNodeTerminalStatus = 'completed' | 'failed' | 'waiting'
type AttemptStatus = ReturnType<typeof terminalToMailboxStatus> | 'waiting'

async function setStatus(runtimeSessionId: string, status: string, terminal = false): Promise<void> {
  if (!runtimeSessionId) return
  const db = await createClient()
  const patch: Record<string, unknown> = { status }
  if (status === 'running') patch.started_at = new Date().toISOString()
  if (terminal) patch.completed_at = new Date().toISOString()
  await db.from('runtime_sessions').update(patch).eq('id', runtimeSessionId)
}

async function setNativeSessionId(runtimeSessionId: string, nativeSessionId: string): Promise<void> {
  if (!runtimeSessionId || !nativeSessionId) return
  const db = await createClient()
  await db.from('runtime_sessions').update({ native_session_id: nativeSessionId }).eq('id', runtimeSessionId)
}

async function log(runtimeSessionId: string, eventType: string, payload: Record<string, unknown>, seq: number): Promise<void> {
  if (!runtimeSessionId) return
  const db = await createClient()
  await db.from('runtime_logs').insert({ runtime_session_id: runtimeSessionId, event_type: eventType, payload: redact(payload), seq })
}

async function markActionRunning(job: RuntimeJob): Promise<void> {
  const db = await createClient()
  const now = new Date().toISOString()
  if (job.attemptId) {
    await db.from('plan_node_attempts').update({
      status: 'running',
      runtime_session_id: job.runtimeSessionId,
      error: null,
      updated_at: now,
    }).eq('id', job.attemptId)
  }
  if (job.mailboxItemId) {
    await db.from('agent_mailbox_items').update({
      status: 'running',
      error: null,
      updated_at: now,
    }).eq('id', job.mailboxItemId)
  }
  if (job.actionId) {
    await db.from('actions').update({
      status: 'running',
      executed_at: now,
      result: { ...(job.actionResult ?? {}), dispatch: 'running', runtimeSessionId: job.runtimeSessionId, at: now },
    }).eq('id', job.actionId)
  }
  if (job.planNodeId) {
    await db.from('plan_nodes').update({
      status: 'running',
      started_at: now,
      result: { dispatch: 'running', runtimeSessionId: job.runtimeSessionId },
    }).eq('id', job.planNodeId)
  }
}

async function settleParentPlan(db: Awaited<ReturnType<typeof createClient>>, job: RuntimeJob): Promise<void> {
  const planNodeId = job.planNodeId
  if (!planNodeId) return
  if (job.suppressPlanProgress) return
  const progress = await advancePlanProgress(db, { planNodeId })
  if (progress.queuedMailboxItemIds.length > 0 && job.sessionId && job.ownerId) {
    await dispatchReadyMailboxItems({
      db,
      sessionId: job.sessionId,
      userId: job.ownerId,
    })
  }
}

function terminalToMailboxStatus(terminal: Terminal) {
  if (terminal === 'completed') return 'completed'
  if (terminal === 'cancelled') return 'cancelled'
  return 'failed'
}

function isApprovalBoundaryError(error: string): boolean {
  return error === 'Runtime 工具已进入权限审批，未执行该操作。'
}

function isQuestionBoundaryError(error: string): boolean {
  return error === 'Runtime 等待用户补充确认，未继续执行。'
}

function isRuntimePermissionBrokerAction(job: RuntimeJob): boolean {
  const result = job.actionResult
  return Boolean(
    job.actionId
      && result
      && typeof result === 'object'
      && !Array.isArray(result)
      && (result as Record<string, unknown>).source === 'runtime_permission_broker',
  )
}

function shouldCompleteApprovedActionAtBoundary(job: RuntimeJob, error: string, output: string): boolean {
  if (job.approvedNativeTool?.executed && (isApprovalBoundaryError(error) || isQuestionBoundaryError(error))) return true
  if (!isRuntimePermissionBrokerAction(job)) return false
  if (!isApprovalBoundaryError(error) && !isQuestionBoundaryError(error)) return false
  return output.trim().length > 0
}

function runtimeJobTimeoutMs(): number {
  const value = Number(process.env.RUNTIME_JOB_TIMEOUT_MS ?? DEFAULT_RUNTIME_JOB_TIMEOUT_MS)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_RUNTIME_JOB_TIMEOUT_MS
}

async function nextRuntimeChunk(iterator: AsyncIterator<ExecutorChunk>, deadlineAt: number) {
  const remainingMs = deadlineAt - Date.now()
  if (remainingMs <= 0) {
    await iterator.return?.()
    throw new Error('Runtime 执行超时，已终止。')
  }

  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      iterator.next(),
      new Promise<IteratorResult<ExecutorChunk>>((_, reject) => {
        timer = setTimeout(() => {
          void iterator.return?.().catch(() => {})
          reject(new Error('Runtime 执行超时，已终止。'))
        }, remainingMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function sameApprovedNativeToolRequest(job: RuntimeJob, tool: NativeCliToolRequest): boolean {
  const approved = job.approvedNativeTool
  if (!approved?.executed) return false
  if (approved.toolCallId && tool.id && approved.toolCallId === tool.id) return true
  if (approved.toolName !== tool.toolName || approved.actionKind !== tool.actionKind) return false
  if (approved.commandPreview || tool.commandPreview) {
    return Boolean(approved.commandPreview && tool.commandPreview && approved.commandPreview.trim() === tool.commandPreview.trim())
  }
  const approvedTargets = new Set((approved.targetPaths ?? []).filter(Boolean))
  const requestedTargets = (tool.targetPaths ?? []).filter(Boolean)
  if (approvedTargets.size === 0 && requestedTargets.length === 0) return true
  return requestedTargets.some((target) => approvedTargets.has(target))
}

function toolRequestDescription(tool: NativeCliToolRequest, workspaceRoot: string) {
  const command = tool.commandPreview ? `命令: ${tool.commandPreview}` : `工具: ${tool.toolName}`
  const targets = tool.targetPaths && tool.targetPaths.length > 0 ? `\n路径: ${tool.targetPaths.join(', ')}` : ''
  return [
    'Runtime 请求执行需要授权的 native CLI 工具。',
    `动作: ${tool.actionKind}`,
    command,
    `Workspace: ${workspaceRoot}`,
    targets,
  ].filter(Boolean).join('\n')
}

function nativeToolCommandLabel(tool: NativeCliToolRequest, toolCall: NativeCliToolCall): string {
  if (toolCall.commandPreview) return toolCall.commandPreview
  const targets = toolCall.targetPaths?.filter((target) => target.trim()) ?? []
  if (targets.length > 0) return `${tool.toolName}: ${targets.join(', ')}`
  return `${tool.toolName} (${toolCall.actionKind})`
}

function questionEventFromRequest(job: RuntimeJob, question: NativeCliQuestionRequest) {
  return {
    type: 'question',
    questionId: question.questionId ?? question.id ?? `question-${job.runtimeSessionId}`,
    title: question.title ?? '需要用户确认',
    content: question.content,
    endpointId: job.endpointId,
  }
}

function toolCallFromRequest(job: RuntimeJob, tool: NativeCliToolRequest): NativeCliToolCall | null {
  if (!job.workspaceId || !job.sessionId || !job.workspaceRoot || !job.cwd) return null
  return {
    id: tool.id ?? `tool-${job.runtimeSessionId}-${Date.now()}`,
    workspaceId: job.workspaceId,
    sessionId: job.sessionId,
    runtimeInvocationId: job.runtimeSessionId,
    actionKind: tool.actionKind,
    cwd: tool.cwd ?? job.cwd,
    targetPaths: tool.targetPaths,
    commandPreview: tool.commandPreview,
    requestedAt: new Date().toISOString(),
  }
}

async function createPermissionAction(job: RuntimeJob, tool: NativeCliToolRequest, toolCall: NativeCliToolCall, riskLevel: string, nativeSessionId?: string | null) {
  if (!job.ownerId) {
    throw new Error('Runtime 权限请求缺少用户归属，已阻止执行。')
  }
  const db = await createClient()
  const command = nativeToolCommandLabel(tool, toolCall)
  const { data: action, error } = await db
    .from('actions')
    .insert({
      session_id: toolCall.sessionId,
      plan_node_id: job.planNodeId ?? null,
      owner_id: job.ownerId,
      action_type: toolCall.actionKind,
      command,
      cwd: toolCall.cwd,
      risk_level: riskLevel,
      status: 'pending',
      requires_approval: true,
      result: {
        source: 'runtime_permission_broker',
        runtimeSessionId: job.runtimeSessionId,
        originalRuntimeSessionId: job.runtimeSessionId,
        toolCallId: toolCall.id,
        toolName: tool.toolName,
        actionKind: toolCall.actionKind,
        commandPreview: toolCall.commandPreview ?? null,
        input: tool.input ?? null,
        nativeSessionId: nativeSessionId ?? job.nativeSessionId ?? null,
        runtimeType: job.runtimeType ?? null,
        roleAgentId: job.roleAgentId ?? null,
        targetPaths: toolCall.targetPaths ?? [],
        cwd: toolCall.cwd,
        workspaceRoot: job.workspaceRoot,
      },
    })
    .select('id')
    .single()
  if (error || !action) {
    throw new Error(error?.message ?? '创建权限动作失败。')
  }
  const actionId = (action as { id: string }).id
  await db.from('notifications').insert({
    user_id: job.ownerId,
    type: 'approval_required',
    title: `Runtime 工具需要授权: ${command.slice(0, 50)}`,
    body: `风险等级: ${riskLevel}`,
    ref_type: 'action',
    ref_id: actionId,
  })
  return actionId
}

async function markActionTerminal(
  job: RuntimeJob,
  terminal: Terminal,
  output = '',
  error?: string,
  options: {
    actionTerminal?: Terminal
    actionError?: string | null
    planNodeStatus?: PlanNodeTerminalStatus
    attemptStatus?: AttemptStatus
    attemptError?: string | null
  } = {},
): Promise<void> {
  const db = await createClient()
  const now = new Date().toISOString()
  const actionTerminal = options.actionTerminal ?? terminal
  const actionStatus = actionTerminal === 'completed' ? 'completed' : 'failed'
  const resultError = options.actionError === null ? undefined : options.actionError ?? error
  const result = {
    ...(job.actionResult ?? {}),
    terminal: actionTerminal,
    runtimeSessionId: job.runtimeSessionId,
    output: output.slice(-20_000),
    error: resultError,
    at: now,
  }
  const mailboxStatus = options.attemptStatus ?? terminalToMailboxStatus(terminal)
  const attemptError = options.attemptError === null ? null : options.attemptError ?? error ?? null
  if (job.attemptId) {
    await db.from('plan_node_attempts').update({
      status: mailboxStatus,
      runtime_session_id: job.runtimeSessionId,
      error: attemptError,
      updated_at: now,
    }).eq('id', job.attemptId)
  }
  if (job.mailboxItemId) {
    await db.from('agent_mailbox_items').update({
      status: mailboxStatus,
      error: attemptError,
      updated_at: now,
    }).eq('id', job.mailboxItemId)
  }
  if (job.actionId) {
    await db.from('actions').update({ status: actionStatus, result }).eq('id', job.actionId)
  }
  if (job.planNodeId) {
    const planNodeStatus = options.planNodeStatus ?? (terminal === 'completed' ? 'completed' : 'failed')
    const planNodePatch: Record<string, unknown> = {
      status: planNodeStatus,
      result,
    }
    if (planNodeStatus === 'waiting') {
      planNodePatch.completed_at = null
    } else {
      planNodePatch.completed_at = now
    }
    await db.from('plan_nodes').update(planNodePatch).eq('id', job.planNodeId)
    if (planNodeStatus === 'completed' && job.actionId) {
      await closeCompletedPlanNodeWaitingQueue(db, job.planNodeId, now)
    }
  }
  await settleParentPlan(db, job)
}

async function closeCompletedPlanNodeWaitingQueue(
  db: Awaited<ReturnType<typeof createClient>>,
  planNodeId: string,
  now: string,
): Promise<void> {
  const patch = {
    status: 'completed',
    error: null,
    updated_at: now,
  }
  await db
    .from('plan_node_attempts')
    .update(patch)
    .eq('plan_node_id', planNodeId)
    .eq('status', 'waiting')
  await db
    .from('plan_node_attempts')
    .update(patch)
    .eq('plan_node_id', planNodeId)
    .eq('status', 'queued')
  await db
    .from('agent_mailbox_items')
    .update(patch)
    .eq('plan_node_id', planNodeId)
    .eq('status', 'waiting')
  await db
    .from('agent_mailbox_items')
    .update(patch)
    .eq('plan_node_id', planNodeId)
    .eq('status', 'queued')
}

// Single job lifecycle: running → stream chunks (cancellable) → completed/cancelled/failed.
// Each step persists to runtime_logs (seq) + publishes to redis for gateway relay. Exported for tests.
export async function processJob(job: RuntimeJob, executor: RuntimeExecutor): Promise<Terminal> {
  const id = job.runtimeSessionId
  let seq = 0
  let outputSeq = 0
  let output = ''
  const emit = async (event: Record<string, unknown>) => {
    await log(id, String(event.type), event, seq++)
    await publishEvent(id, event)
  }
  let lastHeartbeatEventAt = 0
  let lastNativeSessionId = job.nativeSessionId ?? ''
  const emitRunningHeartbeat = async (force = false) => {
    const now = Date.now()
    if (!force && now - lastHeartbeatEventAt < HEARTBEAT_EVENT_INTERVAL_MS) return
    lastHeartbeatEventAt = now
    await setHeartbeat(id, HEARTBEAT_TTL_SEC)
    await emit({ type: 'runtime_status', status: 'running', endpointId: job.endpointId })
  }
  let suppressedApprovedToolRequest = false
  const deadlineAt = Date.now() + runtimeJobTimeoutMs()

  await setStatus(id, 'running')
  await markActionRunning(job)
  await emitRunningHeartbeat(true)
  const heartbeatInterval = setInterval(() => {
    void emitRunningHeartbeat().catch((err) => {
      console.error('[runtime-worker] heartbeat error', err)
    })
  }, HEARTBEAT_EVENT_INTERVAL_MS)
  heartbeatInterval.unref?.()

  try {
    // Prepend the role's system prompt (when present) so the executor runs with the role persona.
    // Absent systemPrompt keeps the prompt unchanged — no behaviour change for existing jobs.
    const prompt = job.systemPrompt ? `${job.systemPrompt}\n\n${job.prompt}` : job.prompt
    const iterator = executor.execute({ prompt, fail: job.fail, nativeSessionId: job.nativeSessionId })[Symbol.asyncIterator]()
    while (true) {
      const next = await nextRuntimeChunk(iterator, deadlineAt)
      if (next.done) break
      const chunk = next.value
      if (await isCancelled(id)) {
        clearInterval(heartbeatInterval)
        await setStatus(id, 'cancelled', true)
        await clearHeartbeat(id)
        await markActionTerminal(job, 'cancelled', output, 'cancelled by request')
        await emit({ type: 'runtime_cancelled', endpointId: job.endpointId, reason: 'cancelled by request' })
        return 'cancelled'
      }
      if (chunk.nativeSessionId && chunk.nativeSessionId !== lastNativeSessionId) {
        lastNativeSessionId = chunk.nativeSessionId
        await setNativeSessionId(id, chunk.nativeSessionId)
        await emit({ type: 'native_session', nativeSessionId: chunk.nativeSessionId, endpointId: job.endpointId })
      }
      if (chunk.question) {
        await emit(questionEventFromRequest(job, chunk.question))
        throw new Error('Runtime 等待用户补充确认，未继续执行。')
      }
      if (chunk.toolRequest) {
        if (!suppressedApprovedToolRequest && sameApprovedNativeToolRequest(job, chunk.toolRequest)) {
          suppressedApprovedToolRequest = true
          await emit({
            type: 'approved_tool_result_consumed',
            endpointId: job.endpointId,
            toolName: chunk.toolRequest.toolName,
            toolCallId: chunk.toolRequest.id,
            actionKind: chunk.toolRequest.actionKind,
          })
          continue
        }
        const toolCall = toolCallFromRequest(job, chunk.toolRequest)
        if (!toolCall || !job.workspaceRoot || !job.workspaceId) {
          throw new Error('Runtime 权限请求缺少 workspace 上下文，已阻止执行。')
        }
        const permission = evaluateNativeCliToolPermission(toolCall, {
          workspaceId: job.workspaceId,
          workspaceRoot: job.workspaceRoot,
        })
        if (permission.code === 'OUTSIDE_WORKSPACE_ROOT') {
          throw new Error('该操作试图访问 workspace 外路径，已阻止。')
        }
        if (permission.code !== 'APPROVAL_REQUIRED' || !permission.approval) {
          throw new Error('Runtime 权限请求无法进入审批队列，已阻止执行。')
        }
        const riskLevel = permission.approval.riskLevel
        const actionId = await createPermissionAction(job, chunk.toolRequest, toolCall, riskLevel, lastNativeSessionId)
        await emit({
          type: 'approval_requested',
          actionId,
          title: 'Runtime 工具需要授权',
          description: toolRequestDescription(chunk.toolRequest, job.workspaceRoot),
          riskLevel,
          endpointId: job.endpointId,
          actionKind: toolCall.actionKind,
          workspaceRoot: job.workspaceRoot,
          cwd: toolCall.cwd,
          targetPaths: toolCall.targetPaths ?? [],
          commandPreview: toolCall.commandPreview,
        })
        throw new Error('Runtime 工具已进入权限审批，未执行该操作。')
      }
      if (!chunk.delta) continue
      await setHeartbeat(id, HEARTBEAT_TTL_SEC)
      output += chunk.delta
      outputSeq += 1
      await emit({ type: 'runtime_output', delta: chunk.delta, endpointId: job.endpointId, mode: 'append', seq: outputSeq })
    }
  } catch (err) {
    clearInterval(heartbeatInterval)
    const error = err instanceof Error ? err.message : String(err)
    await setStatus(id, 'failed', true)
    await clearHeartbeat(id)
    const actionCompletedAtBoundary = shouldCompleteApprovedActionAtBoundary(job, error, output)
    const isWaitingBoundary = isApprovalBoundaryError(error) || (isQuestionBoundaryError(error) && actionCompletedAtBoundary)
    const boundaryOptions = isWaitingBoundary
      ? {
          ...(actionCompletedAtBoundary ? { actionTerminal: 'completed' as const, actionError: null } : {}),
          planNodeStatus: 'waiting' as const,
          attemptStatus: 'waiting' as const,
          attemptError: error,
        }
      : {}
    await markActionTerminal(job, 'failed', output, error, boundaryOptions)
    await emit({ type: 'runtime_failed', endpointId: job.endpointId, error })
    return 'failed'
  }

  clearInterval(heartbeatInterval)
  await setStatus(id, 'completed', true)
  await clearHeartbeat(id)
  await markActionTerminal(job, 'completed', output)
  await emit({ type: 'runtime_completed', endpointId: job.endpointId, summary: 'done' })
  return 'completed'
}

// Liveness reclaim: when a session is still marked running but its heartbeat key
// has expired, the owning worker is gone. Reclaim it as failed + emit runtime_failed
// so consumers see a terminal event instead of hanging. Returns true when reclaimed.
export async function reclaimDeadSession(runtimeSessionId: string, endpointId?: string, seq = 0): Promise<boolean> {
  if (!runtimeSessionId) return false
  if (await isAlive(runtimeSessionId)) return false
  await setStatus(runtimeSessionId, 'failed', true)
  await clearHeartbeat(runtimeSessionId)
  const event = { type: 'runtime_failed', endpointId, error: 'liveness lost: worker heartbeat expired' }
  await log(runtimeSessionId, event.type, event, seq)
  await publishEvent(runtimeSessionId, event)
  return true
}

export function startWorkerPresenceHeartbeat(options: { intervalMs?: number; ttlSec?: number } = {}): () => void {
  const ttlSec = options.ttlSec ?? WORKER_PRESENCE_TTL_SEC
  const intervalMs = options.intervalMs ?? WORKER_PRESENCE_INTERVAL_MS
  let inFlight = false
  let stopped = false
  const refresh = async () => {
    if (stopped || inFlight) return
    inFlight = true
    try {
      await setWorkerAlive(ttlSec)
    } catch (err) {
      console.error('[runtime-worker] worker presence heartbeat error', err)
    } finally {
      inFlight = false
    }
  }
  void refresh()
  const timer = setInterval(() => {
    void refresh()
  }, intervalMs)
  timer.unref?.()
  return () => {
    stopped = true
    clearInterval(timer)
  }
}

async function main(): Promise<void> {
  console.log('[runtime-worker] started, consuming queue...')
  const stopWorkerPresenceHeartbeat = startWorkerPresenceHeartbeat()
  const shutdown = async () => {
    stopWorkerPresenceHeartbeat()
    await clearWorkerAlive().catch(() => {})
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
  while (true) {
    const job = await dequeue(5)
    if (!job) continue
    try {
      await processJob(job, createExecutor(job))
    } catch (err) {
      console.error('[runtime-worker] job error', err)
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('runtime-worker.ts')) {
  void main()
}
