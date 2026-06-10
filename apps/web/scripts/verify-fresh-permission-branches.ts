/**
 * Fresh manual permission lifecycle gate.
 *
 * This verifier creates fresh workspaces/sessions, triggers real runtime tool
 * approvals through /api/chat, then drives allow and reject through the public
 * approval API. It intentionally avoids fixed historical IDs.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { Pool } from 'pg'
import { closeRedis, isWorkerAlive } from '../lib/runtime/redis-client'

type CheckStatus = 'pass' | 'fail' | 'warn'
type Check = { status: CheckStatus; label: string; detail?: string }
type DbRow = Record<string, unknown>
type SseEvent = { type: string; [key: string]: unknown }
type RoleAgent = { id: string; name: string; runtime_type: string; is_orchestrator: boolean }
type BranchKind = 'allow' | 'reject'

const REPO_ROOT = path.resolve(__dirname, '../../..')
const ACCEPTANCE_ENV = path.join(REPO_ROOT, 'docker/.acceptance.env')
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const RUN_MARKER = process.env.PERMISSION_BRANCH_RUN_ID || `PERMISSION-BRANCH-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const ARTIFACT_DIR = path.join(REPO_ROOT, 'e2e/artifacts/opencli-uat/fresh-permission-branches-2026-06-07', RUN_MARKER)
const CHAT_TIMEOUT_MS = Number(process.env.PERMISSION_BRANCH_CHAT_TIMEOUT_MS ?? 240_000)

let passed = 0
let failed = 0
let warned = 0

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return
  for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf('=')
    if (index === -1) continue
    const key = line.slice(0, index)
    const value = line.slice(index + 1)
    if (!process.env[key]) process.env[key] = value
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`缺少环境变量: ${name}`)
  return value
}

function ok(label: string, detail?: string): Check {
  return { status: 'pass', label, detail }
}

function fail(label: string, detail?: string): Check {
  return { status: 'fail', label, detail }
}

function warn(label: string, detail?: string): Check {
  return { status: 'warn', label, detail }
}

function record(check: Check) {
  if (check.status === 'pass') {
    passed += 1
    console.log(`  ✓ ${check.label}${check.detail ? ` :: ${check.detail}` : ''}`)
  } else if (check.status === 'warn') {
    warned += 1
    console.warn(`  ! ${check.label}${check.detail ? ` :: ${check.detail}` : ''}`)
  } else {
    failed += 1
    console.error(`  ✗ ${check.label}${check.detail ? ` :: ${check.detail}` : ''}`)
  }
}

function apiCookie() {
  const cookie = requireEnv('TEST_AUTH_COOKIE')
  return cookie.includes('=') ? cookie : `authjs.session-token=${cookie}`
}

function opencliAuthenticatedUrl(pathname: string) {
  const url = new URL(pathname, BASE_URL)
  const token = process.env.TEST_AUTH_COOKIE_VALUE ?? apiCookie().split('=').slice(1).join('=')
  if (token) url.searchParams.set('uat_auth', token)
  return url.toString()
}

async function apiFetch(pathname: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Cookie: apiCookie(),
    ...(options.headers as Record<string, string> || {}),
  }
  return fetch(`${BASE_URL}${pathname}`, { ...options, headers })
}

async function jsonOrThrow<T>(res: Response, label: string): Promise<T> {
  const text = await res.text()
  if (!res.ok) throw new Error(`${label} failed (${res.status}): ${text}`)
  return JSON.parse(text) as T
}

async function readSseEvents(res: Response, timeoutMs: number, outputFile: string): Promise<{ events: SseEvent[]; timedOut: boolean }> {
  const reader = res.body?.getReader()
  if (!reader) {
    const text = await res.text()
    fs.writeFileSync(outputFile, text)
    return { events: parseSseEvents(text), timedOut: false }
  }

  const decoder = new TextDecoder()
  let text = ''
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    void reader.cancel('fresh-permission-branch-timeout').catch(() => undefined)
  }, timeoutMs)
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      text += decoder.decode(next.value, { stream: true })
    }
    text += decoder.decode()
  } catch (error) {
    if (!timedOut) throw error
  } finally {
    clearTimeout(timer)
  }
  fs.writeFileSync(outputFile, text)
  return { events: parseSseEvents(text), timedOut }
}

function parseSseEvents(text: string): SseEvent[] {
  return text
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => {
      try {
        return JSON.parse(chunk.replace('data: ', '')) as SseEvent
      } catch {
        return { type: 'parse_error', raw: chunk }
      }
    })
}

async function many<T extends DbRow>(pool: Pool, sql: string, params: unknown[] = []) {
  const result = await pool.query(sql, params)
  return result.rows as T[]
}

async function one<T extends DbRow>(pool: Pool, sql: string, params: unknown[]) {
  const rows = await many<T>(pool, sql, params)
  return rows[0] ?? null
}

function permissionRuntimePartsSql() {
  return `jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(COALESCE(m.metadata, '{}'::jsonb)->'runtimeParts') = 'array'
      THEN COALESCE(m.metadata, '{}'::jsonb)->'runtimeParts'
      ELSE '[]'::jsonb
    END
  )`
}

async function poll<T>(label: string, fn: () => Promise<T | null>, timeoutMs = 120_000): Promise<T | null> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const value = await fn()
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  record(fail(label, `timeoutMs=${timeoutMs}`))
  return null
}

function runOpencli(args: string[], outputFile: string): Check {
  const result = spawnSync('opencli', args, { encoding: 'utf8', timeout: 60_000 })
  fs.writeFileSync(outputFile, `${result.stdout}${result.stderr}`)
  if (result.error) return warn(`OpenCLI ${args.join(' ')}`, result.error.message)
  if (result.status === 0) return ok(`OpenCLI ${args.join(' ')}`)
  return fail(`OpenCLI ${args.join(' ')}`, `${result.stdout}${result.stderr}`.trim().split('\n').slice(-10).join('\n'))
}

function runOpencliEval(session: string, script: string, outputFile: string, label: string): Check {
  const result = spawnSync('opencli', ['browser', session, 'eval', script], { encoding: 'utf8', timeout: 60_000 })
  fs.writeFileSync(outputFile, `${result.stdout}${result.stderr}`)
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim()
  if (result.error) return fail(label, result.error.message)
  if (result.status === 0) return ok(label, output.split('\n').slice(0, 20).join('\n'))
  return fail(label, output.split('\n').slice(-12).join('\n'))
}

function opencliAvailable() {
  const result = spawnSync('opencli', ['doctor'], { encoding: 'utf8', timeout: 20_000 })
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'opencli-doctor.txt'), `${result.stdout}${result.stderr}`)
  return result.status === 0
}

function branchPrompt(kind: BranchKind, marker: string, fileName: string) {
  const decision = kind === 'allow' ? '允许' : '拒绝'
  const content = kind === 'allow' ? `ALLOW ${marker}` : `REJECT ${marker}`
  return [
    `P1 权限${decision}路径验证 ${marker}`,
    `请由架构师分配后端工程师，后端工程师必须使用真实文件写入工具，在当前工作区创建文件 ${fileName}，内容必须是：${content}`,
    '这是手动权限控制验收：不要请求额外信息；遇到 Runtime 工具授权时等待用户处理。',
  ].join('\n')
}

async function createBranchContext(kind: BranchKind, marker: string) {
  const workspace = await jsonOrThrow<{ id: string; cloud_project_dir?: string | null }>(await apiFetch('/api/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name: `permission-${kind}-${marker}`, execution_domain: 'cloud' }),
  }), `${kind} POST /api/workspaces`)
  const roles = await jsonOrThrow<RoleAgent[]>(await apiFetch(`/api/role-agents?workspace_id=${workspace.id}`), `${kind} GET /api/role-agents`)
  const architect = roles.find((role) => role.is_orchestrator || role.name === '架构师')
  const backend = roles.find((role) => role.name === '后端工程师') ?? roles.find((role) => !role.is_orchestrator)
  if (!architect || !backend) throw new Error(`${kind} branch missing architect/backend roles: ${JSON.stringify(roles)}`)
  const permissionRuntimeType = process.env.PERMISSION_BRANCH_RUNTIME_TYPE === 'claude_code' ? 'claude_code' : 'codex'
  for (const role of [architect, backend]) {
    const patched = await apiFetch(`/api/role-agents/${role.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ runtime_type: permissionRuntimeType }),
    })
    if (!patched.ok) throw new Error(`${kind} PATCH role runtime failed (${patched.status}): ${await patched.text()}`)
    role.runtime_type = permissionRuntimeType
  }
  const session = await jsonOrThrow<{ id: string }>(await apiFetch('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ workspace_id: workspace.id, name: `permission ${kind} ${marker}` }),
  }), `${kind} POST /api/sessions`)
  return { workspaceId: workspace.id, sessionId: session.id, architect, backend }
}

async function writeSnapshot(pool: Pool, kind: BranchKind, input: {
  workspaceId: string
  sessionId: string
  actionId?: string | null
  filePath?: string | null
}) {
  const snapshot = {
    kind,
    runMarker: RUN_MARKER,
    baseUrl: BASE_URL,
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    actionId: input.actionId ?? null,
    filePath: input.filePath ?? null,
    capturedAt: new Date().toISOString(),
    workspace: await one(pool, 'SELECT id::text, name, cloud_project_dir, execution_domain, created_at FROM public.workspaces WHERE id = $1', [input.workspaceId]),
    session: await one(pool, 'SELECT id::text, workspace_id::text, name, created_at, updated_at FROM public.sessions WHERE id = $1', [input.sessionId]),
    plans: await many(pool, 'SELECT id::text, status, created_at, updated_at FROM public.plans WHERE session_id = $1 ORDER BY created_at DESC LIMIT 5', [input.sessionId]),
    nodes: await many(pool, `SELECT pn.id::text, pn.label, pn.status, ra.name AS role_name, pn.result, pn.created_at, pn.started_at, pn.completed_at FROM public.plan_nodes pn LEFT JOIN public.role_agents ra ON ra.id = pn.agent_id WHERE pn.plan_id IN (SELECT id FROM public.plans WHERE session_id = $1) ORDER BY pn.created_at ASC`, [input.sessionId]),
    queue: await many(pool, `SELECT 'attempt' AS source, pna.id::text, pna.plan_node_id::text, pna.status, pna.runtime_session_id::text, pna.error, pna.created_at, pna.updated_at FROM public.plan_node_attempts pna JOIN public.plan_nodes pn ON pn.id = pna.plan_node_id JOIN public.plans p ON p.id = pn.plan_id WHERE p.session_id = $1 UNION ALL SELECT 'mailbox' AS source, ami.id::text, ami.plan_node_id::text, ami.status, NULL::text AS runtime_session_id, ami.error, ami.created_at, ami.updated_at FROM public.agent_mailbox_items ami JOIN public.plans p ON p.id = ami.plan_id WHERE p.session_id = $1 ORDER BY created_at ASC`, [input.sessionId]),
    runtimeSessions: await many(pool, 'SELECT id::text, role_agent_id::text, runtime_type, status, native_session_id, created_at, started_at, completed_at FROM public.runtime_sessions WHERE session_id = $1 ORDER BY created_at ASC', [input.sessionId]),
    actions: await many(pool, 'SELECT id::text, plan_node_id::text, action_type, command, status, risk_level, requires_approval, approved_at, executed_at, result, created_at FROM public.actions WHERE session_id = $1 ORDER BY created_at ASC', [input.sessionId]),
    messages: await many(pool, 'SELECT id::text, sender_type, message_type, role_agent_id::text, left(content, 1200) AS content, metadata, created_at FROM public.messages WHERE session_id = $1 ORDER BY created_at ASC', [input.sessionId]),
  }
  fs.writeFileSync(path.join(ARTIFACT_DIR, `${kind}-db-snapshot.json`), JSON.stringify(snapshot, null, 2))
}

async function verifyOpencliReadback(kind: BranchKind, sessionId: string, workspaceId: string, marker: string, expectedStatusText: RegExp) {
  if (!opencliAvailable()) {
    record(fail(`${kind} OpenCLI doctor 可用`, 'opencli doctor failed'))
    return
  }
  const browser = `agenthub-permission-${kind}`
  const workspaceUrl = opencliAuthenticatedUrl(`/workspace/${workspaceId}?session_id=${sessionId}`)
  const mobileUrl = opencliAuthenticatedUrl(`/m/sessions/${sessionId}`)
  record(runOpencli(['browser', browser, 'open', workspaceUrl], path.join(ARTIFACT_DIR, `${kind}-opencli-web-open.txt`)))
  record(runOpencliEval(browser, String.raw`
    (() => {
      const text = document.body.innerText || ''
      if (!text.includes('${marker}')) throw new Error('missing marker ${marker}')
      if (!/Runtime 工具需要授权|授权|权限|等待授权|已执行|已允许|已拒绝/.test(text)) throw new Error('missing permission wording')
      if (!${expectedStatusText}.test(text)) throw new Error('missing expected status text')
      return { textLength: text.length }
    })()
  `, path.join(ARTIFACT_DIR, `${kind}-opencli-web-permission-readback.txt`), `${kind} Web 权限状态读回`))
  record(runOpencli(['browser', browser, 'screenshot', path.join(ARTIFACT_DIR, `${kind}-web-permission.png`)], path.join(ARTIFACT_DIR, `${kind}-opencli-web-screenshot.txt`)))
  const mobileBrowser = `agenthub-permission-mobile-${kind}`
  record(runOpencli(['browser', mobileBrowser, 'open', mobileUrl], path.join(ARTIFACT_DIR, `${kind}-opencli-mobile-open.txt`)))
  record(runOpencliEval(mobileBrowser, String.raw`
    (() => {
      const text = document.body.innerText || ''
      if (!text.includes('${marker}')) throw new Error('missing marker ${marker}')
      if (!/Runtime 工具需要授权|授权|权限|等待授权|已执行|已允许|已拒绝/.test(text)) throw new Error('missing mobile permission wording')
      if (!${expectedStatusText}.test(text)) throw new Error('missing expected mobile status text')
      return { textLength: text.length }
    })()
  `, path.join(ARTIFACT_DIR, `${kind}-opencli-mobile-permission-readback.txt`), `${kind} Mobile 权限状态读回`))
  record(runOpencli(['browser', mobileBrowser, 'screenshot', path.join(ARTIFACT_DIR, `${kind}-mobile-permission.png`)], path.join(ARTIFACT_DIR, `${kind}-opencli-mobile-screenshot.txt`)))
}

async function runBranch(pool: Pool, kind: BranchKind) {
  const marker = `${RUN_MARKER}-${kind.toUpperCase()}`
  const fileName = `agenthub-permission-${kind}-${marker}.txt`
  console.log(`\n=== ${kind.toUpperCase()} BRANCH ${marker} ===`)
  const context = await createBranchContext(kind, marker)
  record(ok(`${kind} fresh workspace/session`, `${context.workspaceId}/${context.sessionId}`))

  const chatResponse = await apiFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: context.sessionId,
      content: branchPrompt(kind, marker, fileName),
      roleAgentIds: [context.architect.id, context.backend.id],
      permissionMode: 'manual',
      runMarker: marker,
      uatRunId: marker,
    }),
  })
  record(chatResponse.ok ? ok(`${kind} /api/chat 返回 SSE`, `status=${chatResponse.status}`) : fail(`${kind} /api/chat 返回 SSE`, `status=${chatResponse.status}`))
  if (!chatResponse.ok) throw new Error(await chatResponse.text())
  const sse = await readSseEvents(chatResponse, CHAT_TIMEOUT_MS, path.join(ARTIFACT_DIR, `${kind}-chat-sse.raw.txt`))
  fs.writeFileSync(path.join(ARTIFACT_DIR, `${kind}-chat-sse-events.json`), JSON.stringify(sse.events, null, 2))
  record(!sse.timedOut ? ok(`${kind} /api/chat SSE 结束`, `${sse.events.length} events`) : fail(`${kind} /api/chat SSE 结束`, `timeoutMs=${CHAT_TIMEOUT_MS}`))
  record(sse.events.some((event) => event.type === 'approval_requested') ? ok(`${kind} SSE 产生 approval_requested`) : fail(`${kind} SSE 产生 approval_requested`, sse.events.map((event) => event.type).join(',')))

  const pendingAction = await poll(`${kind} pending action 生成`, () => one<{
    id: string
    plan_node_id: string | null
    status: string
    command: string
    result: Record<string, unknown> | null
  }>(
    pool,
    `SELECT id::text, plan_node_id::text, status, command, result
       FROM public.actions
      WHERE session_id = $1 AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1`,
    [context.sessionId],
  ))
  if (!pendingAction) return null
  record(ok(`${kind} pending action 可读`, pendingAction.id))

  const workspace = await one<{ cloud_project_dir: string | null }>(pool, 'SELECT cloud_project_dir FROM public.workspaces WHERE id = $1', [context.workspaceId])
  const workspaceRoot = workspace?.cloud_project_dir ?? null
  const sideEffectPath = workspaceRoot ? path.join(workspaceRoot, fileName) : null
  record(workspaceRoot && fs.existsSync(workspaceRoot) ? ok(`${kind} workspace root exists`, workspaceRoot) : fail(`${kind} workspace root exists`, String(workspaceRoot)))

  const pendingCard = await one<{ status: string | null; message_id: string | null }>(
    pool,
    `SELECT part.value->>'status' AS status, m.id::text AS message_id
       FROM public.messages m,
            LATERAL ${permissionRuntimePartsSql()} AS part(value)
      WHERE m.session_id = $1
        AND part.value->>'type' = 'permission'
        AND part.value->>'actionId' = $2
      ORDER BY m.updated_at DESC NULLS LAST, m.created_at DESC
      LIMIT 1`,
    [context.sessionId, pendingAction.id],
  )
  record(pendingCard?.status === 'pending' ? ok(`${kind} 原权限卡初始 pending`, JSON.stringify(pendingCard)) : fail(`${kind} 原权限卡初始 pending`, JSON.stringify(pendingCard)))

  const approveResponse = await apiFetch(`/api/actions/${pendingAction.id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approved: kind === 'allow' }),
  })
  const approveBody = await approveResponse.text()
  fs.writeFileSync(path.join(ARTIFACT_DIR, `${kind}-approve-response.json`), approveBody)
  record(approveResponse.ok ? ok(`${kind} approval API`, approveBody) : fail(`${kind} approval API`, `status=${approveResponse.status}; ${approveBody}`))

  if (kind === 'allow') {
    const allowedAction = await poll('allow action 进入运行或终态', () => one<{
      status: string
      executed_at: string | null
      result: Record<string, unknown> | null
    }>(
      pool,
      'SELECT status, executed_at, result FROM public.actions WHERE id = $1 AND status IN (\'running\',\'completed\',\'failed\')',
      [pendingAction.id],
    ))
    record(allowedAction?.executed_at ? ok('manual allow dispatches continuation', JSON.stringify({ status: allowedAction.status, executed_at: allowedAction.executed_at })) : fail('manual allow dispatches continuation', JSON.stringify(allowedAction)))
    const sideEffect = await poll('manual allow side effect occurred inside workspace', async () => {
      if (!sideEffectPath || !fs.existsSync(sideEffectPath)) return null
      return fs.readFileSync(sideEffectPath, 'utf8')
    }, 90_000)
    record(sideEffect?.includes(`ALLOW ${marker}`) ? ok('manual allow side effect content', sideEffectPath ?? undefined) : fail('manual allow side effect content', String(sideEffect)))
    const allowCard = await poll('manual allow updates original permission card state', () => one<{ status: string | null; message_id: string | null }>(
      pool,
      `SELECT part.value->>'status' AS status, m.id::text AS message_id
         FROM public.messages m,
              LATERAL ${permissionRuntimePartsSql()} AS part(value)
        WHERE m.session_id = $1
          AND part.value->>'type' = 'permission'
          AND part.value->>'actionId' = $2
        ORDER BY m.updated_at DESC NULLS LAST, m.created_at DESC
        LIMIT 1`,
      [context.sessionId, pendingAction.id],
    ))
    record(allowCard && ['running', 'completed', 'failed'].includes(String(allowCard.status)) ? ok('manual allow updates original permission card state', JSON.stringify(allowCard)) : fail('manual allow updates original permission card state', JSON.stringify(allowCard)))
    await verifyOpencliReadback(kind, context.sessionId, context.workspaceId, marker, /已执行|已允许|已通过|running|completed|执行中|已完成/)
  } else {
    await new Promise((resolve) => setTimeout(resolve, 1_000))
    const rejectedAction = await one<{ status: string; executed_at: string | null }>(pool, 'SELECT status, executed_at FROM public.actions WHERE id = $1', [pendingAction.id])
    record(rejectedAction?.status === 'rejected' && rejectedAction.executed_at === null ? ok('manual reject stops action execution') : fail('manual reject stops action execution', JSON.stringify(rejectedAction)))
    record(sideEffectPath && !fs.existsSync(sideEffectPath) ? ok('manual reject has no side effect file', sideEffectPath) : fail('manual reject has no side effect file', String(sideEffectPath)))
    const rejectNode = pendingAction.plan_node_id
      ? await one<{ status: string }>(pool, 'SELECT status FROM public.plan_nodes WHERE id = $1', [pendingAction.plan_node_id])
      : null
    record(rejectNode?.status === 'waiting' ? ok('manual reject keeps plan node waiting') : fail('manual reject keeps plan node waiting', JSON.stringify(rejectNode)))
    const rejectCard = await one<{ status: string | null; message_id: string | null }>(
      pool,
      `SELECT part.value->>'status' AS status, m.id::text AS message_id
         FROM public.messages m,
              LATERAL ${permissionRuntimePartsSql()} AS part(value)
        WHERE m.session_id = $1
          AND part.value->>'type' = 'permission'
          AND part.value->>'actionId' = $2
        ORDER BY m.updated_at DESC NULLS LAST, m.created_at DESC
        LIMIT 1`,
      [context.sessionId, pendingAction.id],
    )
    record(rejectCard?.status === 'rejected' ? ok('manual reject updates original permission card state', JSON.stringify(rejectCard)) : fail('manual reject updates original permission card state', JSON.stringify(rejectCard)))
    const rejectMessage = await one<{ content: string }>(
      pool,
      `SELECT content
         FROM public.messages
        WHERE session_id = $1 AND content LIKE '%已拒绝%'
        ORDER BY created_at DESC
        LIMIT 1`,
      [context.sessionId],
    )
    record(rejectMessage ? ok('manual reject writes durable user-visible event') : fail('manual reject writes durable user-visible event'))
    await verifyOpencliReadback(kind, context.sessionId, context.workspaceId, marker, /已拒绝|rejected|等待你的下一次输入/)
  }

  await writeSnapshot(pool, kind, {
    workspaceId: context.workspaceId,
    sessionId: context.sessionId,
    actionId: pendingAction.id,
    filePath: sideEffectPath,
  })
  return {
    kind,
    marker,
    workspaceId: context.workspaceId,
    sessionId: context.sessionId,
    actionId: pendingAction.id,
    planNodeId: pendingAction.plan_node_id,
    workspaceRoot,
    sideEffectPath,
  }
}

async function main() {
  loadEnvFile(ACCEPTANCE_ENV)
  process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
  requireEnv('DATABASE_URL')
  requireEnv('REDIS_URL')
  requireEnv('TEST_AUTH_COOKIE')
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

  console.log('\n=== Fresh Manual Permission Branch Gate ===')
  console.log(`BASE_URL=${BASE_URL}`)
  console.log(`runMarker=${RUN_MARKER}`)
  console.log(`evidenceDir=${ARTIFACT_DIR}`)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  let fatalError: string | null = null
  const branchResults: unknown[] = []
  try {
    const executorMode = process.env.RUNTIME_EXECUTOR
    record(executorMode !== 'fake' && executorMode !== 'script'
      ? ok('permission gate 使用真实 runtime executor', executorMode || 'real')
      : fail('permission gate 使用真实 runtime executor', `RUNTIME_EXECUTOR=${executorMode}`))
    const workerReady = await isWorkerAlive()
    record(workerReady ? ok('Runtime worker ready before permission branches') : fail('Runtime worker ready before permission branches'))
    if (executorMode === 'fake' || executorMode === 'script' || !workerReady) {
      throw new Error('permission branch preflight failed: real runtime executor and live runtime worker are required')
    }

    branchResults.push(await runBranch(pool, 'allow'))
    branchResults.push(await runBranch(pool, 'reject'))
  } catch (error) {
    fatalError = error instanceof Error ? error.message : String(error)
    record(fail('fresh permission branch fatal error', fatalError))
    throw error
  } finally {
    const summary = {
      status: failed === 0 && !fatalError ? 'PASS' : 'FAIL',
      passed,
      failed,
      warned,
      fatalError,
      baseUrl: BASE_URL,
      runMarker: RUN_MARKER,
      evidenceDir: ARTIFACT_DIR,
      branches: branchResults,
    }
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
    console.log('\nSUMMARY:', JSON.stringify(summary, null, 2))
    await pool.end()
    await closeRedis().catch(() => undefined)
  }
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exit(1)
})
