/**
 * COMPLETE-MULTI-AGENT-ORCHESTRATION recovery UAT verifier.
 *
 * Requires a previously completed Phase 5 multi-agent session. It resumes one completed
 * runtime node through the real API, dispatches the queued mailbox through the real worker,
 * and verifies durable retry/resume lineage plus native session continuity evidence.
 */
import { Pool } from 'pg'

export {}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

let passed = 0
let failed = 0

type DispatchResult = {
  mailbox_item_id: string
  status: string
  runtime_session_id?: string | null
  runtimeSessionId?: string | null
}

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

async function waitForAttemptTerminal(pool: Pool, attemptId: string, timeoutMs = 360_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const result = await pool.query(
      `SELECT a.id, a.status, a.runtime_session_id, a.error, rs.status AS runtime_status, rs.native_session_id
       FROM public.plan_node_attempts a
       LEFT JOIN public.runtime_sessions rs ON rs.id = a.runtime_session_id
       WHERE a.id = $1`,
      [attemptId],
    )
    const row = result.rows[0] as {
      id: string
      status: string
      runtime_session_id: string | null
      error: string | null
      runtime_status: string | null
      native_session_id: string | null
    } | undefined
    if (row && ['completed', 'failed', 'cancelled', 'dead_letter'].includes(row.status)) return row
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error(`等待 attempt ${attemptId} 终态超时`)
}

async function main() {
  requireEnv('DATABASE_URL')
  requireEnv('REDIS_URL')
  requireEnv('TEST_AUTH_COOKIE')
  if (process.env.RUNTIME_EXECUTOR === 'fake' || process.env.RUNTIME_EXECUTOR === 'script') {
    throw new Error('Recovery UAT 不接受 RUNTIME_EXECUTOR=fake/script。')
  }

  console.log('\n=== COMPLETE-MULTI-AGENT Recovery 真实 resume UAT ===')
  console.log(`BASE_URL: ${BASE_URL}`)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const targetResult = await pool.query(
      `SELECT
         p.id AS plan_id,
         p.session_id,
         pn.id AS node_id,
         pn.label AS node_label,
         pn.agent_id,
         pn.status AS node_status,
         pna.id AS previous_attempt_id,
         pna.runtime_session_id AS previous_runtime_session_id,
         rs.runtime_type,
         rs.native_session_id AS previous_native_session_id,
         rs.cwd
       FROM public.plans p
       JOIN public.plan_nodes pn ON pn.plan_id = p.id
       JOIN public.plan_node_attempts pna ON pna.plan_node_id = pn.id
       JOIN public.runtime_sessions rs ON rs.id = pna.runtime_session_id
       WHERE p.status = 'completed'
         AND pn.status = 'completed'
         AND pn.agent_id IS NOT NULL
         AND pna.status = 'completed'
         AND rs.status = 'completed'
         AND rs.native_session_id IS NOT NULL
         AND p.session_id = COALESCE($1::uuid, p.session_id)
       ORDER BY p.created_at DESC, CASE WHEN rs.runtime_type = 'codex' THEN 0 ELSE 1 END, pna.attempt_number DESC
       LIMIT 1`,
      [process.env.PHASE5_SESSION_ID || null],
    )
    const target = targetResult.rows[0] as {
      plan_id: string
      session_id: string
      node_id: string
      node_label: string
      agent_id: string
      node_status: string
      previous_attempt_id: string
      previous_runtime_session_id: string
      runtime_type: 'claude_code' | 'codex'
      previous_native_session_id: string
      cwd: string | null
    } | undefined
    if (!target) throw new Error('未找到可 resume 的 Phase 5 completed runtime node。请先运行 verify-complete-multi-agent-phase5.ts。')

    console.log(`plan_id=${target.plan_id}`)
    console.log(`session_id=${target.session_id}`)
    console.log(`node_id=${target.node_id}`)
    console.log(`runtime_type=${target.runtime_type}`)
    console.log(`previous_runtime_session_id=${target.previous_runtime_session_id}`)

    const resume = await jsonOrThrow<{
      control: string
      node_status: string
      attempt: { id: string; previous_attempt_id?: string | null }
      mailbox_item: { id: string; context_package?: { metadata?: Record<string, unknown> } }
    }>(await apiFetch(`/api/plan-nodes/${target.node_id}/resume`, { method: 'POST' }), 'POST resume')
    assert(resume.control === 'resume', 'resume API 返回 control=resume')
    assert(resume.node_status === 'ready', 'resume 后节点进入 ready')
    assert(resume.attempt.previous_attempt_id === target.previous_attempt_id, '新 attempt 保留 previous_attempt_id lineage')
    assert(Boolean(resume.mailbox_item?.id), 'resume 创建 queued mailbox item')
    assert(
      resume.mailbox_item.context_package?.metadata?.previousRuntimeSessionId === target.previous_runtime_session_id,
      'mailbox context 记录 previousRuntimeSessionId',
    )

    const dispatch = await jsonOrThrow<{
      dispatched?: DispatchResult[]
      dispatches?: DispatchResult[]
    }>(
      await apiFetch('/api/mailbox/dispatch-ready', {
        method: 'POST',
        body: JSON.stringify({ session_id: target.session_id }),
      }),
      'POST dispatch-ready',
    )
    const dispatches = dispatch.dispatched ?? dispatch.dispatches ?? []
    const dispatched = dispatches.find((item) => item.mailbox_item_id === resume.mailbox_item.id)
    const dispatchedRuntimeSessionId = dispatched?.runtime_session_id ?? dispatched?.runtimeSessionId
    assert(dispatched?.status === 'queued', `dispatch-ready 投递 resume mailbox（got ${dispatched?.status ?? 'missing'}）`)
    assert(Boolean(dispatchedRuntimeSessionId), 'dispatch-ready 返回新 runtimeSessionId')

    const terminal = await waitForAttemptTerminal(pool, resume.attempt.id)
    assert(terminal.status === 'completed', `resume attempt completed（got ${terminal.status}）`)
    assert(terminal.runtime_status === 'completed', `resume runtime_session completed（got ${terminal.runtime_status}）`)
    assert(terminal.runtime_session_id === dispatchedRuntimeSessionId, 'attempt.runtime_session_id 指向 dispatch-ready 创建的 runtime session')
    assert(Boolean(terminal.native_session_id), 'resume runtime_session 记录 native_session_id')

    const runtimeRows = await pool.query(
      `SELECT role_agent_id, runtime_type, cwd, native_session_id
       FROM public.runtime_sessions
       WHERE id = $1`,
      [terminal.runtime_session_id],
    )
    const runtime = runtimeRows.rows[0] as {
      role_agent_id: string | null
      runtime_type: string
      cwd: string | null
      native_session_id: string | null
    } | undefined
    assert(runtime?.role_agent_id === target.agent_id, 'resume runtime_session 复用同一 role_agent_id')
    assert(runtime?.runtime_type === target.runtime_type, 'resume runtime_session 复用同一 runtime_type')
    assert((runtime?.cwd ?? null) === (target.cwd ?? null), 'resume runtime_session 复用同一 cwd')
    assert(runtime?.native_session_id === target.previous_native_session_id, 'resume 复用上一轮 native_session_id')

    const planRows = await pool.query(`SELECT status FROM public.plans WHERE id = $1`, [target.plan_id])
    assert(planRows.rows[0]?.status === 'completed', `parent plan 恢复后重新 completed（got ${planRows.rows[0]?.status})`)

    console.log('\n=== SUMMARY ===')
    console.log(JSON.stringify({
      status: failed === 0 ? 'PASS' : 'FAIL',
      plan_id: target.plan_id,
      session_id: target.session_id,
      node_id: target.node_id,
      previous_attempt_id: target.previous_attempt_id,
      resume_attempt_id: resume.attempt.id,
      previous_runtime_session_id: target.previous_runtime_session_id,
      resume_runtime_session_id: terminal.runtime_session_id,
      runtime_type: target.runtime_type,
      native_session_id: terminal.native_session_id,
    }, null, 2))
  } finally {
    await pool.end()
  }

  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
