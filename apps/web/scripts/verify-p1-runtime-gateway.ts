/**
 * P1 Cloud Runtime Gateway 集成测试
 * 覆盖 cross-layer contract §6 Tests Required：
 *  1. DB 迁移幂等 + 5 张 gateway 表存在 + P0 sessions/messages 不变
 *  2. cloud 未配置 public_cloud → endpoint_unavailable + public_runtime_available=false（无假成功）
 *  3. local_desktop 无 tunnel → local_runtime_offline + DEVICE_OFFLINE 兼容
 *  4. runtime_sessions / runtime_logs 落库可读回
 *  5. 安全：runtime endpoint target 拒绝本地 IP/端口
 *
 * 无 DATABASE_URL / TEST_AUTH_COOKIE 时跳过需环境的断言并打印 SKIP 原因（不静默通过）。
 */
export {}

import { Pool } from 'pg'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isLocalNetworkTarget } from '../lib/runtime/gateway'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const DATABASE_URL = process.env.DATABASE_URL
const TEST_AUTH_COOKIE = process.env.TEST_AUTH_COOKIE
const SCHEMA_PATH = join(__dirname, '../../../docker/postgres/acceptance-schema.sql')

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

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const cookie = TEST_AUTH_COOKIE
  const authCookie = cookie?.includes('=') ? cookie : `authjs.session-token=${cookie}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(authCookie ? { Cookie: authCookie } : {}),
    ...(options.headers as Record<string, string> || {}),
  }
  return fetch(`${BASE_URL}${path}`, { ...options, headers })
}

async function readSSEEvents(res: Response): Promise<Array<{ type: string; [k: string]: unknown }>> {
  const text = await res.text()
  return text
    .split('\n\n')
    .filter(chunk => chunk.startsWith('data: '))
    .map(chunk => JSON.parse(chunk.replace('data: ', '')))
}

// --- Test 5: 安全（无环境依赖，始终运行）---
function testSecurity() {
  console.log('\n[安全] runtime endpoint target 拒绝本地 IP/端口')
  assert(isLocalNetworkTarget('http://localhost:7681'), 'localhost 被识别为本地 target')
  assert(isLocalNetworkTarget('127.0.0.1:8080'), '127.0.0.1 被识别为本地 target')
  assert(isLocalNetworkTarget('192.168.1.10:3000'), '192.168.x 被识别为本地 target')
  assert(isLocalNetworkTarget('10.0.0.5'), '10.x 被识别为本地 target')
  assert(isLocalNetworkTarget('172.16.0.1'), '172.16-31.x 被识别为本地 target')
  assert(!isLocalNetworkTarget('https://gateway.agenthub.io'), '公网 gateway 域名不被误判为本地')
}

// --- Test 1: DB 幂等 + 表存在 + P0 不变 ---
async function testDbIdempotency(pool: Pool) {
  console.log('\n[DB] schema 幂等 + gateway 表 + P0 不变')
  const before = await pool.query(
    `SELECT
       (SELECT count(*) FROM information_schema.columns WHERE table_name='sessions') AS s_cols,
       (SELECT count(*) FROM information_schema.columns WHERE table_name='messages') AS m_cols,
       (SELECT count(*) FROM public.sessions) AS s_rows,
       (SELECT count(*) FROM public.messages) AS m_rows`,
  )
  const sql = readFileSync(SCHEMA_PATH, 'utf8')
  // 二次 apply 必须无错（IF NOT EXISTS 幂等）
  await pool.query(sql)
  await pool.query(sql)
  assert(true, 'schema 二次 apply 无错误抛出')

  const tbl = await pool.query(
    `SELECT count(*)::int AS n FROM information_schema.tables
     WHERE table_schema='public' AND table_name IN
     ('runtime_endpoints','runtime_sessions','runtime_logs','device_runtime_channels','runtime_capabilities')`,
  )
  assert(tbl.rows[0].n === 5, `5 张 gateway 表存在 (got ${tbl.rows[0].n})`)

  const after = await pool.query(
    `SELECT
       (SELECT count(*) FROM information_schema.columns WHERE table_name='sessions') AS s_cols,
       (SELECT count(*) FROM information_schema.columns WHERE table_name='messages') AS m_cols,
       (SELECT count(*) FROM public.sessions) AS s_rows,
       (SELECT count(*) FROM public.messages) AS m_rows`,
  )
  assert(before.rows[0].s_cols === after.rows[0].s_cols, 'sessions 列结构不变')
  assert(before.rows[0].m_cols === after.rows[0].m_cols, 'messages 列结构不变')
  assert(before.rows[0].s_rows === after.rows[0].s_rows, 'sessions 行数不变')
  assert(before.rows[0].m_rows === after.rows[0].m_rows, 'messages 行数不变')
}

// --- Test 2/3/4: /api/chat 路由 + 事件 + 落库 ---
async function testChatRouting(pool: Pool) {
  // cloud 未配置
  console.log('\n[cloud] 未配置 public_cloud → endpoint_unavailable')
  const wsCloudRes = await apiFetch('/api/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name: `rt-gw-cloud-${Date.now()}`, execution_domain: 'cloud' }),
  })
  const wsCloud = await wsCloudRes.json()
  const sessCloudRes = await apiFetch('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ workspace_id: wsCloud.id, name: 'rt-gw-cloud-sess' }),
  })
  const sessCloud = await sessCloudRes.json()
  const cloudChat = await apiFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ sessionId: sessCloud.id, content: 'cloud 测试' }),
  })
  assert(cloudChat.ok, `cloud /api/chat 返回 200 SSE`)
  const cloudEvents = await readSSEEvents(cloudChat)
  assert(!!cloudEvents.find(e => e.type === 'gateway_connected'), 'cloud SSE 含 gateway_connected')
  const pubAvail = cloudEvents.find(e => e.type === 'public_runtime_available')
  assert(!!pubAvail && pubAvail.available === false, 'cloud public_runtime_available=false')
  assert(!!cloudEvents.find(e => e.type === 'endpoint_unavailable'), 'cloud SSE 含 endpoint_unavailable')
  // 无假 assistant 成功消息
  assert(
    !cloudEvents.find(e => e.type === 'text_delta' || e.type === 'completed'),
    'cloud 未返回假 assistant 成功消息',
  )

  // local_desktop 无 tunnel
  console.log('\n[local] 无 tunnel → local_runtime_offline + DEVICE_OFFLINE')
  const wsLocalRes = await apiFetch('/api/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name: `rt-gw-local-${Date.now()}`, execution_domain: 'local_desktop' }),
  })
  const wsLocal = await wsLocalRes.json()
  const sessLocalRes = await apiFetch('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ workspace_id: wsLocal.id, name: 'rt-gw-local-sess' }),
  })
  const sessLocal = await sessLocalRes.json()
  const localChat = await apiFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ sessionId: sessLocal.id, content: 'local 测试' }),
  })
  assert(localChat.ok, `local_desktop /api/chat 返回 200 SSE`)
  const localEvents = await readSSEEvents(localChat)
  assert(!!localEvents.find(e => e.type === 'local_runtime_offline'), 'local SSE 含 local_runtime_offline')
  assert(
    !!localEvents.find(e => e.type === 'runtime_status' && e.status === 'DEVICE_OFFLINE'),
    'local SSE 保留 DEVICE_OFFLINE 兼容',
  )

  // runtime_sessions / runtime_logs 落库可读回
  console.log('\n[落库] runtime_sessions / runtime_logs 读回')
  const rs = await pool.query(
    `SELECT id, status FROM public.runtime_sessions WHERE session_id = $1`,
    [sessCloud.id],
  )
  const rsRows = rs.rows as Array<{ id: string; status: string }>
  assert(rsRows.length >= 1, `cloud session 对应 runtime_sessions 行存在 (got ${rsRows.length})`)
  const validStatus = ['idle', 'running', 'completed', 'failed', 'cancelled']
  assert(rsRows.length >= 1 && validStatus.includes(rsRows[0].status), `runtime_sessions.status 合法 (${rsRows[0]?.status})`)
  if (rsRows.length >= 1) {
    const logs = await pool.query(
      `SELECT count(*)::int AS n FROM public.runtime_logs WHERE runtime_session_id = $1`,
      [rsRows[0].id],
    )
    const n = (logs.rows[0] as { n: number }).n
    assert(n >= 1, `runtime_logs 至少 1 行 (got ${n})`)
  }
}

async function main() {
  console.log('\n=== P1 Cloud Runtime Gateway 集成测试 ===')

  testSecurity()

  if (!DATABASE_URL) {
    skip('DATABASE_URL 未设置 — 跳过 DB 幂等与落库断言')
  } else {
    const pool = new Pool({ connectionString: DATABASE_URL })
    try {
      await testDbIdempotency(pool)
      if (!TEST_AUTH_COOKIE) {
        skip('TEST_AUTH_COOKIE 未设置 — 跳过 /api/chat 路由与落库断言')
      } else {
        await testChatRouting(pool)
      }
    } finally {
      await pool.end()
    }
  }

  const status = failed === 0 ? 'PASS' : 'FAIL'
  console.log(`\nSUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped, status=${status}`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(err => { console.error(err); process.exit(1) })
