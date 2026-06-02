/**
 * COMPLETE-MULTI-AGENT-ORCHESTRATION Phase 5 UAT verifier.
 *
 * This script exercises the canonical product path:
 *   Auth.js cookie -> real API -> /api/chat SSE -> Gateway -> runtime worker -> DB evidence.
 *
 * It is intentionally strict about fake/script output. Scripted executors can be useful for
 * integration tests, but this verifier is for the final Claude Code + Codex UAT evidence.
 */
import { Pool } from 'pg'

export {}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

type RoleAgent = {
  id: string
  name: string
  runtime_type: 'claude_code' | 'codex'
  is_orchestrator: boolean
}

type SseEvent = { type: string; [key: string]: unknown }

let passed = 0
let failed = 0

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`缺少环境变量: ${name}`)
  return val
}

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed += 1
    console.log(`  ✓ ${msg}`)
  } else {
    failed += 1
    console.error(`  ✗ ${msg}`)
  }
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const cookie = requireEnv('TEST_AUTH_COOKIE')
  const authCookie = cookie.includes('=') ? cookie : `authjs.session-token=${cookie}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Cookie: authCookie,
    ...(options.headers as Record<string, string> || {}),
  }
  return fetch(`${BASE_URL}${path}`, { ...options, headers })
}

async function jsonOrThrow<T>(res: Response, label: string): Promise<T> {
  const text = await res.text()
  if (!res.ok) throw new Error(`${label} failed (${res.status}): ${text}`)
  return JSON.parse(text) as T
}

async function readSseEvents(res: Response): Promise<SseEvent[]> {
  const text = await res.text()
  return text
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => JSON.parse(chunk.replace('data: ', '')) as SseEvent)
}

async function main() {
  requireEnv('DATABASE_URL')
  requireEnv('REDIS_URL')
  requireEnv('TEST_AUTH_COOKIE')

  if (process.env.RUNTIME_EXECUTOR === 'fake' || process.env.RUNTIME_EXECUTOR === 'script') {
    throw new Error('Phase 5 UAT 不接受 RUNTIME_EXECUTOR=fake/script。请使用真实 worker：RUNTIME_EXECUTOR=real 或不设置。')
  }

  console.log('\n=== COMPLETE-MULTI-AGENT Phase 5 真实多角色 UAT ===')
  console.log(`BASE_URL: ${BASE_URL}`)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  const workspace = await jsonOrThrow<{ id: string }>(await apiFetch('/api/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name: `phase5-multi-agent-${Date.now()}`, execution_domain: 'cloud' }),
  }), 'POST /api/workspaces')
  console.log(`workspace_id=${workspace.id}`)

  const roles = await jsonOrThrow<RoleAgent[]>(await apiFetch(`/api/role-agents?workspace_id=${workspace.id}`), 'GET /api/role-agents')
  const architect = roles.find((role) => role.name === '架构师' || role.is_orchestrator)
  const frontend = roles.find((role) => role.name === '前端工程师')
  const backend = roles.find((role) => role.name === '后端工程师')

  assert(Boolean(architect), '默认角色包含架构师')
  assert(Boolean(frontend), '默认角色包含前端工程师')
  assert(Boolean(backend), '默认角色包含后端工程师')
  assert(architect?.runtime_type === 'claude_code', `架构师绑定 Claude Code（got ${architect?.runtime_type}）`)
  assert(frontend?.runtime_type === 'claude_code', `前端工程师绑定 Claude Code（got ${frontend?.runtime_type}）`)
  assert(backend?.runtime_type === 'codex', `后端工程师绑定 Codex（got ${backend?.runtime_type}）`)
  if (!architect || !frontend || !backend) throw new Error('缺少 Phase 5 必需默认角色，停止 UAT')

  const session = await jsonOrThrow<{ id: string }>(await apiFetch('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ workspace_id: workspace.id, name: 'phase5-multi-agent-session' }),
  }), 'POST /api/sessions')
  console.log(`session_id=${session.id}`)

  const content = [
    `PHASE5-MULTI-${Date.now()}`,
    '请按数据库 schema/后端接口先行的方式协作，后端工程师先定义 API 和持久化字段，前端工程师再说明界面调用和状态展示，最后由架构师汇总。',
    '请每个角色明确自己的 Runtime 和交接依据。',
  ].join('\n')

  const chatRes = await apiFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: session.id,
      content,
      roleAgentIds: [architect.id, frontend.id, backend.id],
    }),
  })
  assert(chatRes.ok, `/api/chat 返回 200 SSE（got ${chatRes.status}）`)
  const events = await readSseEvents(chatRes)
  const eventTypes = events.map((event) => event.type)
  assert(eventTypes.includes('orchestrator_plan_started'), 'SSE 包含 orchestrator_plan_started')
  assert(eventTypes.filter((type) => type === 'role_selected').length >= 4, 'SSE 包含多角色 role_selected 事件')
  assert(eventTypes.includes('role_handoff'), 'SSE 包含 role_handoff 交接事件')
  assert(eventTypes.includes('runtime_completed'), 'SSE 包含 runtime_completed 终态')
  assert(eventTypes.includes('done'), 'SSE 包含 done')
  assert(!eventTypes.includes('endpoint_unavailable'), 'SSE 不包含 endpoint_unavailable')
  assert(!eventTypes.includes('runtime_failed'), 'SSE 不包含 runtime_failed')

  const scriptedPhraseSeen = events.some((event) =>
    event.type === 'runtime_output' &&
    typeof event.delta === 'string' &&
    event.delta.includes('运行时执行器返回的回复')
  )
  assert(!scriptedPhraseSeen, '未出现 ScriptedRealExecutor 固定回复')

  const planRows = await pool.query(
    `SELECT id, status, dag FROM public.plans WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [session.id],
  )
  const plan = planRows.rows[0] as { id: string; status: string; dag: { edges?: unknown[] } } | undefined
  assert(Boolean(plan?.id), 'DB 持久化 plan')
  assert(plan?.status === 'completed', `plan.status=completed（got ${plan?.status}）`)
  assert(Array.isArray(plan?.dag?.edges) && plan.dag.edges.length >= 3, 'plan.dag 持久化 fan-out/fan-in edges')

  const nodeRows = plan?.id
    ? await pool.query(
      `SELECT id, label, agent_id, action_payload, depends_on, status
       FROM public.plan_nodes
       WHERE plan_id = $1
       ORDER BY created_at ASC`,
      [plan.id],
    )
    : { rows: [] }
  const nodes = nodeRows.rows as Array<{
    id: string
    label: string
    agent_id: string | null
    action_payload: { runtimeType?: string; phase?: string }
    depends_on: string[] | string | null
    status: string
  }>
  assert(nodes.length >= 4, `DB 持久化 planner/workers/summarizer 节点（got ${nodes.length}）`)
  assert(nodes.every((node) => node.status === 'completed'), '所有 plan_nodes completed')
  const backendNode = nodes.find((node) => node.agent_id === backend.id)
  const frontendNode = nodes.find((node) => node.agent_id === frontend.id)
  assert(backendNode?.action_payload?.runtimeType === 'codex', `后端节点 runtimeType=codex（got ${backendNode?.action_payload?.runtimeType}）`)
  assert(frontendNode?.action_payload?.runtimeType === 'claude_code', `前端节点 runtimeType=claude_code（got ${frontendNode?.action_payload?.runtimeType}）`)
  const frontendDepends = Array.isArray(frontendNode?.depends_on) ? frontendNode?.depends_on : []
  assert(Boolean(backendNode?.id && frontendDepends.includes(backendNode.id)), '数据库/schema 任务中前端节点等待后端节点')

  const runtimeRows = await pool.query(
    `SELECT id, role_agent_id, runtime_type, status, native_session_id
     FROM public.runtime_sessions
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [session.id],
  )
  const runtimeSessions = runtimeRows.rows as Array<{
    id: string
    role_agent_id: string | null
    runtime_type: string
    status: string
    native_session_id: string | null
  }>
  assert(runtimeSessions.length >= 4, `DB 持久化每节点 runtime_sessions（got ${runtimeSessions.length}）`)
  assert(runtimeSessions.some((row) => row.role_agent_id === backend.id && row.runtime_type === 'codex'), '后端工程师 runtime_session 使用 Codex')
  assert(runtimeSessions.some((row) => row.role_agent_id === frontend.id && row.runtime_type === 'claude_code'), '前端工程师 runtime_session 使用 Claude Code')
  assert(runtimeSessions.every((row) => row.status === 'completed'), '所有 runtime_sessions completed')
  assert(runtimeSessions.some((row) => row.native_session_id), '至少一个 runtime_session 记录 native_session_id')

  const messageRows = await pool.query(
    `SELECT id, sender_type, role_agent_id, content, metadata
     FROM public.messages
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [session.id],
  )
  const messages = messageRows.rows as Array<{
    id: string
    sender_type: string
    role_agent_id: string | null
    content: string
    metadata: { roleHandoffs?: unknown[]; handoffsReceived?: unknown[] } | null
  }>
  assert(messages.some((message) => message.sender_type === 'user' && message.content.includes('PHASE5-MULTI')), '用户消息持久化')
  assert(messages.filter((message) => message.sender_type === 'agent').length >= 4, '多角色 agent 消息持久化')
  assert(messages.some((message) => message.role_agent_id === backend.id), '后端工程师 agent 消息持久化')
  assert(messages.some((message) => message.role_agent_id === frontend.id), '前端工程师 agent 消息持久化')
  assert(messages.some((message) => Array.isArray(message.metadata?.handoffsReceived)), '下游 agent 消息持久化 handoffsReceived')
  assert(messages.some((message) => Array.isArray(message.metadata?.roleHandoffs)), '用户消息持久化 roleHandoffs')

  await pool.end()

  const summary = {
    status: failed === 0 ? 'PASS' : 'FAIL',
    workspace_id: workspace.id,
    session_id: session.id,
    plan_id: plan?.id,
    runtime_session_ids: runtimeSessions.map((row) => row.id),
    message_ids: messages.map((row) => row.id),
    event_types: eventTypes,
  }
  console.log('\n=== SUMMARY ===')
  console.log(JSON.stringify(summary, null, 2))
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
