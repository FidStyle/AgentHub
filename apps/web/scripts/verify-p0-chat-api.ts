/**
 * P0 /api/chat 集成测试
 * 验证：DEVICE_OFFLINE 错误态 + hosted runtime 路径 + 未登录 401
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

  // 2. 创建 local_desktop workspace + session → DEVICE_OFFLINE
  console.log('[2/4] local_desktop workspace → DEVICE_OFFLINE')
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
  assert(chatLocalRes.ok, `local_desktop /api/chat 返回 200 SSE`)
  const localEvents = await readSSEEvents(chatLocalRes)
  const offlineEvt = localEvents.find(e => e.type === 'runtime_status' && e.status === 'DEVICE_OFFLINE')
  assert(!!offlineEvt, 'SSE 包含 DEVICE_OFFLINE 事件')
  const doneEvt = localEvents.find(e => e.type === 'done')
  assert(!!doneEvt, 'SSE 包含 done 事件')

  // 3. 创建 cloud workspace + session → runtime_status (minimal_adapter)
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

  const chatCloudRes = await apiFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ sessionId: sessCloud.id, content: '测试 cloud' }),
  })
  assert(chatCloudRes.ok, `cloud /api/chat 返回 200 SSE`)
  const cloudEvents = await readSSEEvents(chatCloudRes)
  const runtimeEvt = cloudEvents.find(e => e.type === 'runtime_status')
  assert(!!runtimeEvt, 'cloud SSE 包含 runtime_status 事件')
  assert(runtimeEvt?.status !== 'DEVICE_OFFLINE', 'cloud 不返回 DEVICE_OFFLINE')

  // 4. 消息落库验证
  console.log('[4/4] 消息持久化验证')
  const msgsRes = await apiFetch(`/api/messages?session_id=${sess.id}`)
  assert(msgsRes.ok, `GET /api/messages 成功`)
  const msgs = await msgsRes.json()
  const userMsg = Array.isArray(msgs) ? msgs.find((m: { content: string }) => m.content === '你好') : null
  assert(!!userMsg, '用户消息已落库')

  console.log(`\nSUMMARY: ${passed} passed, ${failed} failed, status=${failed === 0 ? 'PASS' : 'FAIL'}`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(err => { console.error(err); process.exit(1) })
