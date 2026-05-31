/**
 * P0 /api/chat 集成测试
 * 验证：未登录 401 + local_desktop 明确 409 错误态 + cloud runtime 路径 + 消息持久化
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

async function readSSEEvents(res: Response): Promise<Array<{ type: string; [k: string]: unknown }>> {
  const text = await res.text()
  return text
    .split('\n\n')
    .filter(chunk => chunk.startsWith('data: '))
    .map(chunk => JSON.parse(chunk.replace('data: ', '')))
}

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  ✓ ${msg}`) }
  else { failed++; console.error(`  ✗ ${msg}`) }
}

async function main() {
  requireEnv('DATABASE_URL')
  requireEnv('TEST_AUTH_COOKIE')

  console.log('\n=== P0 /api/chat 集成测试 ===\n')

  // 1. 未登录 → 401
  console.log('[1/4] 未登录请求 /api/chat')
  const noAuthRes = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: 'fake', content: 'test' }),
  })
  assert(noAuthRes.status === 401, `未登录返回 401 (got ${noAuthRes.status})`)

  // 2. 创建 local_desktop workspace + session → 409 明确只读错误
  console.log('[2/4] local_desktop workspace → 409 只读错误态')
  const wsRes = await apiFetch('/api/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name: `chat-test-local-${Date.now()}`, execution_domain: 'local_desktop' }),
  })
  assert(wsRes.ok, `创建 local_desktop workspace (status ${wsRes.status})`)
  const ws = await wsRes.json()

  const sessRes = await apiFetch('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ workspace_id: ws.id, name: 'chat-test-session' }),
  })
  assert(sessRes.ok, `创建 session (status ${sessRes.status})`)
  const sess = await sessRes.json()

  const chatLocalRes = await apiFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ sessionId: sess.id, content: '你好' }),
  })
  assert(chatLocalRes.status === 409, `local_desktop /api/chat 返回 409 (got ${chatLocalRes.status})`)
  const localBody = await chatLocalRes.json() as { error?: string }
  assert(
    typeof localBody.error === 'string' && localBody.error.includes('本地') && localBody.error.includes('只读'),
    `local_desktop 返回中文只读错误 (${localBody.error ?? 'missing'})`,
  )

  // 3. 创建 cloud workspace + session → runtime_status (gateway 路由)
  console.log('[3/4] cloud workspace → runtime_status')
  const wsCloudRes = await apiFetch('/api/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name: `chat-test-cloud-${Date.now()}`, execution_domain: 'cloud' }),
  })
  const wsCloud = await wsCloudRes.json()
  const sessCloudRes = await apiFetch('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ workspace_id: wsCloud.id, name: 'chat-cloud-session' }),
  })
  const sessCloud = await sessCloudRes.json()

  const cloudContent = `测试 cloud ${Date.now()}`
  const chatCloudRes = await apiFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ sessionId: sessCloud.id, content: cloudContent }),
  })
  assert(chatCloudRes.ok, `cloud /api/chat 返回 200 SSE`)
  const cloudEvents = await readSSEEvents(chatCloudRes)
  assert(!!cloudEvents.find(e => e.type === 'gateway_connected'), 'cloud SSE 包含 gateway_connected')
  assert(!!cloudEvents.find(e => e.type === 'done'), 'cloud SSE 包含 done')
  assert(!cloudEvents.find(e => e.type === 'local_runtime_offline'), 'cloud 不返回 local_runtime_offline')
  assert(!cloudEvents.find(e => e.type === 'runtime_status' && e.status === 'DEVICE_OFFLINE'), 'cloud 不返回 DEVICE_OFFLINE')
  const cloudTerminal = cloudEvents.find(e =>
    e.type === 'endpoint_unavailable' ||
    e.type === 'runtime_failed' ||
    e.type === 'runtime_completed',
  )
  assert(!!cloudTerminal, `cloud SSE 有明确 runtime 终态 (${cloudEvents.map(e => e.type).join(', ')})`)

  // 4. 消息落库验证
  console.log('[4/4] 消息持久化验证')
  const msgsRes = await apiFetch(`/api/messages?session_id=${sessCloud.id}`)
  assert(msgsRes.ok, `GET /api/messages 成功`)
  const msgs = await msgsRes.json()
  const userMsg = Array.isArray(msgs) ? msgs.find((m: { content: string; sender_type: string }) => m.content === cloudContent && m.sender_type === 'user') : null
  assert(!!userMsg, 'cloud 用户消息已落库')
  if (cloudTerminal?.type === 'runtime_completed') {
    const agentMsg = Array.isArray(msgs) ? msgs.find((m: { sender_type: string }) => m.sender_type === 'agent') : null
    assert(!!agentMsg, 'runtime_completed 后 agent 回复已落库')
  }

  console.log(`\nSUMMARY: ${passed} passed, ${failed} failed, status=${failed === 0 ? 'PASS' : 'FAIL'}`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(err => { console.error(err); process.exit(1) })
