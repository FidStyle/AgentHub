/**
 * P1-RT Phase 3 集成测试 — 自建 public_cloud runtime worker/pool
 * 真实 Postgres + Redis（D-003 全部自建，无付费 API、无托管平台、无真实 CLI spawn）。
 * 覆盖 5 类语义：
 *  1. 调度：enqueue → dequeue 消费同一 job
 *  2. 流式：FakeExecutor 产出 ≥2 个 runtime_output 增量
 *  3. completed 落库：runtime_sessions.status=completed + runtime_logs seq 有序递增
 *  4. 取消：setCancel 后 processJob 落 cancelled + emit runtime_cancelled
 *  5. 失败：job.fail 注入异常 → 落 failed + emit runtime_failed（不伪装成功）
 *  6. 恢复证据：带 attemptId/mailboxItemId 的 job 会同步结算 plan_node_attempts / agent_mailbox_items
 *
 * REDIS_URL / DATABASE_URL 任一未设则 SKIP 需基础设施的断言（打印 SKIP，不静默通过）。
 */
export {}

import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
const REDIS_URL = process.env.REDIS_URL

let passed = 0
let failed = 0
let skipped = 0

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  ✓ ${msg}`) }
  else { failed++; console.error(`  ✗ ${msg}`) }
}
function skip(reason: string) {
  skipped++
  console.log(`  ⊘ SKIP: ${reason}`)
}

function firstId(result: { rows: unknown[] }): string {
  return (result.rows[0] as { id: string }).id
}

// runtime_sessions.session_id → sessions → workspaces → user. Build the parent chain so the
// FK constraint holds; returns { userId, runtimeSessionId }. userId removal cascades the rest.
async function createRuntimeSession(pool: Pool): Promise<{ userId: string; runtimeSessionId: string }> {
  const userId = `p3-test-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await pool.query(`INSERT INTO public."user"(id, email) VALUES ($1, $2)`, [userId, `${userId}@test.local`])
  const ws = await pool.query(
    `INSERT INTO public.workspaces(owner_id, name, execution_domain) VALUES ($1, $2, 'cloud') RETURNING id`,
    [userId, `p3-ws-${userId}`],
  )
  const sess = await pool.query(
    `INSERT INTO public.sessions(workspace_id) VALUES ($1) RETURNING id`,
    [firstId(ws)],
  )
  const rs = await pool.query(
    `INSERT INTO public.runtime_sessions(session_id, status) VALUES ($1, 'idle') RETURNING id`,
    [firstId(sess)],
  )
  return { userId, runtimeSessionId: firstId(rs) }
}

async function createRecoveryCase(pool: Pool): Promise<{
  userId: string
  runtimeSessionId: string
  attemptId: string
  mailboxItemId: string
  planId: string
}> {
  const userId = `p3-recovery-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await pool.query(`INSERT INTO public."user"(id, email) VALUES ($1, $2)`, [userId, `${userId}@test.local`])
  const ws = await pool.query(
    `INSERT INTO public.workspaces(owner_id, name, execution_domain) VALUES ($1, $2, 'cloud') RETURNING id`,
    [userId, `p3-recovery-ws-${userId}`],
  )
  const workspaceId = firstId(ws)
  const sess = await pool.query(`INSERT INTO public.sessions(workspace_id) VALUES ($1) RETURNING id`, [workspaceId])
  const sessionId = firstId(sess)
  const role = await pool.query(
    `INSERT INTO public.role_agents(workspace_id, name, role_type, system_prompt, runtime_type)
     VALUES ($1, '后端工程师', 'backend', '负责后端', 'codex') RETURNING id`,
    [workspaceId],
  )
  const roleAgentId = firstId(role)
  const plan = await pool.query(
    `INSERT INTO public.plans(session_id, owner_id, title, status, dag)
     VALUES ($1, $2, 'recovery evidence', 'running', '{}'::jsonb) RETURNING id`,
    [sessionId, userId],
  )
  const planId = firstId(plan)
  const node = await pool.query(
    `INSERT INTO public.plan_nodes(plan_id, label, agent_id, action_type, action_payload, depends_on, status)
     VALUES ($1, '后端工程师执行', $2, 'runtime_invoke', '{}'::jsonb, ARRAY[]::uuid[], 'running') RETURNING id`,
    [planId, roleAgentId],
  )
  const planNodeId = firstId(node)
  const rs = await pool.query(
    `INSERT INTO public.runtime_sessions(session_id, role_agent_id, runtime_type, native_session_id, cwd, status)
     VALUES ($1, $2, 'codex', 'native-recovery-prev', '/repo', 'idle') RETURNING id`,
    [sessionId, roleAgentId],
  )
  const runtimeSessionId = firstId(rs)
  const attempt = await pool.query(
    `INSERT INTO public.plan_node_attempts(plan_node_id, attempt_number, control, runtime_session_id, status)
     VALUES ($1, 2, 'resume', $2, 'running') RETURNING id`,
    [planNodeId, runtimeSessionId],
  )
  const attemptId = firstId(attempt)
  const mailbox = await pool.query(
    `INSERT INTO public.agent_mailbox_items(
       workspace_id, session_id, plan_id, plan_node_id, direction,
       to_role_agent_id, attempt_id, lineage_root_id, runtime_type, status, context_package
     )
     VALUES ($1, $2, $3, $4, 'inbound', $5, $6, $6, 'codex', 'running', '{}'::jsonb)
     RETURNING id`,
    [workspaceId, sessionId, planId, planNodeId, roleAgentId, attemptId],
  )
  return { userId, runtimeSessionId, attemptId, mailboxItemId: firstId(mailbox), planId }
}

async function sessionStatus(pool: Pool, id: string): Promise<string | null> {
  const r = await pool.query(`SELECT status FROM public.runtime_sessions WHERE id = $1`, [id])
  return r.rows.length ? (r.rows[0] as { status: string }).status : null
}

async function logsBySeq(pool: Pool, id: string): Promise<{ event_type: string; seq: number }[]> {
  const r = await pool.query(
    `SELECT event_type, seq FROM public.runtime_logs WHERE runtime_session_id = $1 ORDER BY seq ASC`,
    [id],
  )
  return r.rows as { event_type: string; seq: number }[]
}

async function attemptStatus(pool: Pool, id: string): Promise<{ status: string; runtime_session_id: string | null; error: string | null } | null> {
  const r = await pool.query(`SELECT status, runtime_session_id, error FROM public.plan_node_attempts WHERE id = $1`, [id])
  return r.rows.length ? r.rows[0] as { status: string; runtime_session_id: string | null; error: string | null } : null
}

async function mailboxStatus(pool: Pool, id: string): Promise<{ status: string; error: string | null } | null> {
  const r = await pool.query(`SELECT status, error FROM public.agent_mailbox_items WHERE id = $1`, [id])
  return r.rows.length ? r.rows[0] as { status: string; error: string | null } : null
}

async function main() {
  console.log('\n=== P1-RT Phase 3 集成测试（自建 public_cloud worker/pool）===')

  if (!DATABASE_URL || !REDIS_URL) {
    skip('DATABASE_URL 或 REDIS_URL 未设置 — 跳过调度/落库/流式/取消/失败断言')
    const status = failed === 0 ? 'PASS' : 'FAIL'
    console.log(`\nSUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped, status=${status}`)
    process.exit(failed === 0 ? 0 : 1)
  }

  const pool = new Pool({ connectionString: DATABASE_URL })
  const { enqueue, dequeue, setCancel, clearCancel, closeRedis } = await import('../lib/runtime/redis-client')
  const { processJob } = await import('../server/runtime-worker')
  const { ScriptedRealExecutor } = await import('../lib/runtime/executor')
  const executor = new ScriptedRealExecutor()

  try {
    // --- Test 1: 调度（enqueue → dequeue 同一 job）---
    console.log('\n[调度] enqueue → dequeue 消费同一 job')
    const sched = await createRuntimeSession(pool)
    await enqueue({ runtimeSessionId: sched.runtimeSessionId, prompt: 'hello world ping' })
    const popped = await dequeue(2)
    assert(popped?.runtimeSessionId === sched.runtimeSessionId, `dequeue 取回入队 job（id=${popped?.runtimeSessionId}）`)
    assert(popped?.prompt === 'hello world ping', 'dequeue 保留 prompt 内容')

    // --- Test 2+3: 流式 + completed 落库 + seq 有序 ---
    console.log('\n[流式+落库] FakeExecutor 流式 → completed + runtime_logs seq 有序')
    const ok = await createRuntimeSession(pool)
    const okTerminal = await processJob({ runtimeSessionId: ok.runtimeSessionId, prompt: 'alpha beta gamma delta' }, executor)
    assert(okTerminal === 'completed', `processJob 返回 completed（got ${okTerminal}）`)
    assert((await sessionStatus(pool, ok.runtimeSessionId)) === 'completed', 'runtime_sessions.status=completed 落库')

    const okLogs = await logsBySeq(pool, ok.runtimeSessionId)
    const outputs = okLogs.filter(l => l.event_type === 'runtime_output')
    assert(outputs.length >= 2, `runtime_output 流式增量 ≥2（got ${outputs.length}）`)
    assert(okLogs.some(l => l.event_type === 'runtime_status'), '落 runtime_status（running）事件')
    assert(okLogs.some(l => l.event_type === 'runtime_completed'), '落 runtime_completed 终态事件')
    const seqs = okLogs.map(l => l.seq)
    const seqOrdered = seqs.every((s, i) => i === 0 || s > seqs[i - 1])
    assert(seqOrdered, `runtime_logs seq 严格递增有序（${seqs.join(',')}）`)

    // --- Test 4: 取消（setCancel → cancelled）---
    console.log('\n[取消] setCancel → processJob 落 cancelled + emit runtime_cancelled')
    const cancel = await createRuntimeSession(pool)
    await setCancel(cancel.runtimeSessionId)
    const cancelTerminal = await processJob({ runtimeSessionId: cancel.runtimeSessionId, prompt: 'one two three four five six' }, executor)
    assert(cancelTerminal === 'cancelled', `processJob 返回 cancelled（got ${cancelTerminal}）`)
    assert((await sessionStatus(pool, cancel.runtimeSessionId)) === 'cancelled', 'runtime_sessions.status=cancelled 落库')
    const cancelLogs = await logsBySeq(pool, cancel.runtimeSessionId)
    assert(cancelLogs.some(l => l.event_type === 'runtime_cancelled'), '落 runtime_cancelled 事件')
    assert(!cancelLogs.some(l => l.event_type === 'runtime_completed'), '取消后不伪装 completed')
    await clearCancel(cancel.runtimeSessionId)

    // --- Test 5: 失败（job.fail → failed，不伪装成功）---
    console.log('\n[失败] job.fail 注入异常 → 落 failed + emit runtime_failed')
    const fail = await createRuntimeSession(pool)
    const failTerminal = await processJob({ runtimeSessionId: fail.runtimeSessionId, prompt: 'a b c d e f', fail: true }, executor)
    assert(failTerminal === 'failed', `processJob 返回 failed（got ${failTerminal}）`)
    assert((await sessionStatus(pool, fail.runtimeSessionId)) === 'failed', 'runtime_sessions.status=failed 落库')
    const failLogs = await logsBySeq(pool, fail.runtimeSessionId)
    assert(failLogs.some(l => l.event_type === 'runtime_failed'), '落 runtime_failed 错误事件')
    assert(!failLogs.some(l => l.event_type === 'runtime_completed'), '失败后不伪装 completed')

    // --- Test 6: 恢复证据（attempt/mailbox 随 worker 终态结算）---
    console.log('\n[恢复证据] processJob 结算 attempt/mailbox + native session scope evidence')
    const recovery = await createRecoveryCase(pool)
    const recoveryTerminal = await processJob({
      runtimeSessionId: recovery.runtimeSessionId,
      prompt: 'resume recovery node',
      attemptId: recovery.attemptId,
      mailboxItemId: recovery.mailboxItemId,
    }, executor)
    assert(recoveryTerminal === 'completed', `带 attempt/mailbox 的 job completed（got ${recoveryTerminal}）`)
    const recoveryAttempt = await attemptStatus(pool, recovery.attemptId)
    const recoveryMailbox = await mailboxStatus(pool, recovery.mailboxItemId)
    assert(recoveryAttempt?.status === 'completed', `plan_node_attempts.status=completed（got ${recoveryAttempt?.status}）`)
    assert(recoveryAttempt?.runtime_session_id === recovery.runtimeSessionId, 'plan_node_attempts.runtime_session_id 指向本次 runtime session')
    assert(recoveryAttempt?.error === null, 'plan_node_attempts.error 成功时为空')
    assert(recoveryMailbox?.status === 'completed', `agent_mailbox_items.status=completed（got ${recoveryMailbox?.status}）`)
    assert(recoveryMailbox?.error === null, 'agent_mailbox_items.error 成功时为空')

    // cleanup（删 runtime_logs/runtime_sessions；recovery case 先删 plan，因为 plans.owner_id 不级联 user）
    for (const r of [sched, ok, cancel, fail, recovery]) {
      await pool.query(`DELETE FROM public.runtime_logs WHERE runtime_session_id = $1`, [r.runtimeSessionId])
      await pool.query(`DELETE FROM public.runtime_sessions WHERE id = $1`, [r.runtimeSessionId])
      if ('planId' in r) await pool.query(`DELETE FROM public.plans WHERE id = $1`, [r.planId])
      await pool.query(`DELETE FROM public."user" WHERE id = $1`, [r.userId])
    }
  } finally {
    await closeRedis()
    await pool.end()
  }

  const status = failed === 0 ? 'PASS' : 'FAIL'
  console.log(`\nSUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped, status=${status}`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(err => { console.error(err); process.exit(1) })
