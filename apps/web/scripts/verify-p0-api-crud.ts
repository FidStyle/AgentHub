/**
 * P0 端到端真实 API CRUD smoke 验证
 * 要求环境变量：DATABASE_URL + TEST_AUTH_COOKIE
 * TEST_AUTH_COOKIE 必须对应 Auth.js database session 表中的真实 session token。
 * 验证链路：创建 workspace → 创建 session → 创建 message → GET 验证持久化
 */
export {}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`缺少环境变量: ${name}`)
  return val
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const cookie = process.env.TEST_AUTH_COOKIE
  const authCookie = cookie?.includes('=') ? cookie : `authjs.session-token=${cookie}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(authCookie ? { Cookie: authCookie } : {}),
    ...(options.headers as Record<string, string> || {}),
  }
  return fetch(`${BASE_URL}${path}`, { ...options, headers })
}

async function main() {
  requireEnv('DATABASE_URL')
  if (!process.env.TEST_AUTH_COOKIE) {
    throw new Error('缺少认证凭据: 需要 TEST_AUTH_COOKIE。先运行 pnpm env:p0:seed 生成测试 session。')
  }

  console.log('=== P0 API CRUD Smoke 验证 ===')
  console.log(`BASE_URL: ${BASE_URL}`)

  // 1. 创建 workspace
  console.log('\n[1/5] POST /api/workspaces')
  const wsRes = await apiFetch('/api/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name: `smoke-test-${Date.now()}`, execution_domain: 'cloud' }),
  })
  if (!wsRes.ok) {
    const err = await wsRes.text()
    throw new Error(`创建 workspace 失败 (${wsRes.status}): ${err}`)
  }
  const workspace = await wsRes.json()
  console.log(`  ✓ workspace_id: ${workspace.id}`)

  // 2. 创建 session
  console.log('\n[2/5] POST /api/sessions')
  const sessRes = await apiFetch('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ workspace_id: workspace.id, name: 'smoke-test-session' }),
  })
  if (!sessRes.ok) {
    const err = await sessRes.text()
    throw new Error(`创建 session 失败 (${sessRes.status}): ${err}`)
  }
  const session = await sessRes.json()
  console.log(`  ✓ session_id: ${session.id}`)

  // 3. 创建 message
  console.log('\n[3/5] POST /api/messages')
  const msgRes = await apiFetch('/api/messages', {
    method: 'POST',
    body: JSON.stringify({ session_id: session.id, content: 'smoke test message', sender_type: 'user' }),
  })
  if (!msgRes.ok) {
    const err = await msgRes.text()
    throw new Error(`创建 message 失败 (${msgRes.status}): ${err}`)
  }
  const message = await msgRes.json()
  console.log(`  ✓ message_id: ${message.id}`)

  // 4. GET 验证 session 持久化
  console.log('\n[4/5] GET /api/sessions — 验证持久化')
  const getSessionsRes = await apiFetch(`/api/sessions?workspace_id=${workspace.id}`)
  if (!getSessionsRes.ok) {
    throw new Error(`GET sessions 失败 (${getSessionsRes.status})`)
  }
  const sessions = await getSessionsRes.json()
  const found = sessions.find((s: { id: string }) => s.id === session.id)
  if (!found) throw new Error('Session 未持久化：GET 返回中不包含刚创建的 session')
  console.log(`  ✓ session 已持久化 (共 ${sessions.length} 条)`)

  // 5. GET 验证 message 持久化
  console.log('\n[5/5] GET /api/messages — 验证持久化')
  const getMsgsRes = await apiFetch(`/api/messages?session_id=${session.id}`)
  if (!getMsgsRes.ok) {
    throw new Error(`GET messages 失败 (${getMsgsRes.status})`)
  }
  const messages = await getMsgsRes.json()
  const msgFound = messages.find((m: { id: string }) => m.id === message.id)
  if (!msgFound) throw new Error('Message 未持久化：GET 返回中不包含刚创建的 message')
  console.log(`  ✓ message 已持久化 (共 ${messages.length} 条)`)

  // 输出 JSON summary
  const summary = {
    status: 'PASS',
    timestamp: new Date().toISOString(),
    workspace_id: workspace.id,
    session_id: session.id,
    message_id: message.id,
    base_url: BASE_URL,
  }
  console.log('\n=== SUMMARY ===')
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((err) => {
  console.error(`\n✗ FAILED: ${err.message}`)
  process.exit(1)
})
