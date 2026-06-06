/**
 * Strict fresh single-prompt product delivery gate.
 *
 * This verifier starts from the real HTTP API, creates a fresh workspace/session,
 * sends one full-control prompt, and only passes when durable DB state, generated
 * workspace files, artifact semantics, and tri-surface readback evidence agree.
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { once } from 'node:events'
import net from 'node:net'
import { Pool } from 'pg'

export {}

type SseEvent = { type: string; [key: string]: unknown }
type CheckStatus = 'pass' | 'fail' | 'warn'
type Check = { status: CheckStatus; label: string; detail?: string }
type DbRow = Record<string, unknown>

const REPO_ROOT = path.resolve(__dirname, '../../..')
const ACCEPTANCE_ENV = path.join(REPO_ROOT, 'docker/.acceptance.env')
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const RUN_MARKER = process.env.STRICT_PRODUCT_RUN_ID || `STRICT-SPD-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const ARTIFACT_DIR = path.join(REPO_ROOT, 'e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05', RUN_MARKER)
const CHAT_TIMEOUT_MS = (() => {
  const value = Number(process.env.STRICT_PRODUCT_CHAT_TIMEOUT_MS ?? 10 * 60_000)
  return Number.isFinite(value) && value > 0 ? value : 10 * 60_000
})()
const PROMPT = [
  '做一个加减乘除的简单网站，使用sqlite存储历史记录。全自动完成直到交付产物',
  '',
  `验收标记：${RUN_MARKER}`,
].join('\n')

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
  const val = process.env[name]
  if (!val) throw new Error(`缺少环境变量: ${name}`)
  return val
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

function ok(label: string, detail?: string): Check {
  return { status: 'pass', label, detail }
}

function fail(label: string, detail?: string): Check {
  return { status: 'fail', label, detail }
}

function warn(label: string, detail?: string): Check {
  return { status: 'warn', label, detail }
}

function exists(filePath: string) {
  return fs.existsSync(filePath)
}

function apiCookie() {
  const cookie = requireEnv('TEST_AUTH_COOKIE')
  return cookie.includes('=') ? cookie : `authjs.session-token=${cookie}`
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

async function readSseEvents(res: Response, timeoutMs: number): Promise<{ events: SseEvent[]; timedOut: boolean; rawText: string }> {
  const reader = res.body?.getReader()
  if (!reader) {
    const text = await res.text()
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'chat-sse.raw.txt'), text)
    return { events: parseSseEvents(text), timedOut: false, rawText: text }
  }

  const decoder = new TextDecoder()
  let text = ''
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    void reader.cancel('strict-product-chat-timeout').catch(() => {})
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
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'chat-sse.raw.txt'), text)
  return { events: parseSseEvents(text), timedOut, rawText: text }
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

async function writeRunSnapshot(pool: Pool, input: {
  workspaceId: string
  sessionId: string
  planId?: string | null
  reason: string
  fileName: string
}) {
  const snapshot: Record<string, unknown> = {
    reason: input.reason,
    baseUrl: BASE_URL,
    chatPath: 'POST /api/chat',
    workspacePath: input.workspaceId ? `${BASE_URL}/workspaces/${input.workspaceId}` : null,
    mobilePath: input.sessionId ? `${BASE_URL}/m/sessions/${input.sessionId}` : null,
    runMarker: RUN_MARKER,
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    planId: input.planId ?? null,
    capturedAt: new Date().toISOString(),
  }
  if (input.workspaceId) {
    snapshot.workspace = await one(pool, 'SELECT id::text, name, cloud_project_dir, execution_domain, created_at FROM public.workspaces WHERE id = $1', [input.workspaceId])
  }
  if (input.sessionId) {
    snapshot.session = await one(pool, 'SELECT id::text, workspace_id::text, name, created_at, updated_at FROM public.sessions WHERE id = $1', [input.sessionId])
    snapshot.plans = await many(pool, 'SELECT id::text, status, created_at, updated_at FROM public.plans WHERE session_id = $1 ORDER BY created_at DESC LIMIT 5', [input.sessionId])
    snapshot.runtimeSessions = await many(pool, 'SELECT id::text, role_agent_id::text, runtime_type, status, native_session_id, created_at, started_at, completed_at FROM public.runtime_sessions WHERE session_id = $1 ORDER BY created_at DESC LIMIT 20', [input.sessionId])
    snapshot.actions = await many(pool, 'SELECT id::text, action_type, command, status, risk_level, requires_approval, created_at, approved_at, executed_at, result FROM public.actions WHERE session_id = $1 ORDER BY created_at DESC LIMIT 30', [input.sessionId])
    snapshot.messages = await many(pool, 'SELECT id::text, sender_type, message_type, left(content, 1000) AS content, role_agent_id::text, metadata, created_at FROM public.messages WHERE session_id = $1 ORDER BY created_at ASC LIMIT 80', [input.sessionId])
    snapshot.artifacts = await many(pool, 'SELECT id::text, artifact_type, source_path, metadata, created_at FROM public.artifacts WHERE session_id = $1 ORDER BY created_at DESC LIMIT 20', [input.sessionId])
  }
  const effectivePlanId = input.planId
    ?? ((Array.isArray(snapshot.plans) && snapshot.plans[0] && typeof snapshot.plans[0] === 'object')
      ? String((snapshot.plans[0] as Record<string, unknown>).id ?? '')
      : '')
  if (effectivePlanId) {
    snapshot.planNodes = await many(
      pool,
      `SELECT pn.id::text, pn.label, pn.status, ra.name AS role_name, pn.started_at, pn.completed_at, pn.result
         FROM public.plan_nodes pn
         LEFT JOIN public.role_agents ra ON ra.id = pn.agent_id
        WHERE pn.plan_id = $1
        ORDER BY pn.created_at ASC`,
      [effectivePlanId],
    )
    snapshot.queue = await many(
      pool,
      `SELECT 'attempt' AS source, pna.id::text, pna.status, pna.error, pna.runtime_session_id::text, pna.created_at, pna.updated_at
         FROM public.plan_node_attempts pna
         JOIN public.plan_nodes pn ON pn.id = pna.plan_node_id
        WHERE pn.plan_id = $1
       UNION ALL
       SELECT 'mailbox' AS source, ami.id::text, ami.status, ami.error, NULL::text AS runtime_session_id, ami.created_at, ami.updated_at
         FROM public.agent_mailbox_items ami
         JOIN public.plan_nodes pn ON pn.id = ami.plan_node_id
        WHERE pn.plan_id = $1
        ORDER BY created_at ASC`,
      [effectivePlanId],
    )
  }
  if (input.sessionId) {
    snapshot.recentRuntimeLogs = await many(
      pool,
      `SELECT rs.id::text AS runtime_session_id, rl.seq, rl.event_type, rl.payload, rl.created_at
         FROM public.runtime_sessions rs
         JOIN public.runtime_logs rl ON rl.runtime_session_id = rs.id
        WHERE rs.session_id = $1
        ORDER BY rl.created_at DESC, rl.seq DESC
        LIMIT 80`,
      [input.sessionId],
    )
  }
  fs.writeFileSync(path.join(ARTIFACT_DIR, input.fileName), JSON.stringify(snapshot, null, 2))
}

function includesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text))
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function numericResultFrom(body: Record<string, unknown>, paths: string[][]) {
  for (const segments of paths) {
    let current: unknown = body
    for (const segment of segments) {
      const record = objectRecord(current)
      if (!record) {
        current = undefined
        break
      }
      current = record[segment]
    }
    if (typeof current === 'number') return current
    if (typeof current === 'string' && current.trim() !== '' && Number.isFinite(Number(current))) return Number(current)
  }
  return null
}

function arrayFromAny(body: Record<string, unknown> | unknown[], keys: string[]) {
  if (Array.isArray(body)) return body
  for (const key of keys) {
    if (Array.isArray(body[key])) return body[key] as unknown[]
  }
  return []
}

async function freePort() {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  server.close()
  await once(server, 'close')
  if (!port) throw new Error('无法分配临时端口')
  return port
}

async function waitForHttp(url: string, timeoutMs = 20_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok || response.status < 500) return true
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return false
}

function runCommand(command: string, args: string[], cwd: string, timeoutMs = 120_000): Check {
  const result = spawnSync(command, args, { cwd, env: process.env, encoding: 'utf8', timeout: timeoutMs })
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim()
  if (result.error) return fail(`${command} ${args.join(' ')}`, result.error.message)
  if (result.status === 0) return ok(`${command} ${args.join(' ')}`, output.split('\n').slice(-8).join('\n'))
  return fail(`${command} ${args.join(' ')}`, output.split('\n').slice(-16).join('\n'))
}

function collectSqliteCandidates(root: string, requestedDbPath: string) {
  const candidates = new Set<string>()
  if (exists(requestedDbPath)) candidates.add(requestedDbPath)
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      const relative = path.relative(root, fullPath)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || relative.startsWith('.test-data')) continue
        walk(fullPath)
        continue
      }
      if (!entry.isFile()) continue
      if (entry.name.endsWith('-wal') || entry.name.endsWith('-shm')) continue
      if (/\.(sqlite|sqlite3|db)$/i.test(entry.name)) candidates.add(fullPath)
    }
  }
  walk(root)
  return Array.from(candidates)
}

function sqlitePersistentHistoryEvidence(root: string, requestedDbPath: string, minRows: number) {
  const details: string[] = []
  for (const dbFile of collectSqliteCandidates(root, requestedDbPath)) {
    const tablesResult = spawnSync(
      'sqlite3',
      [dbFile, "select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name;"],
      { encoding: 'utf8' },
    )
    if (tablesResult.status !== 0) {
      details.push(`${path.relative(root, dbFile)}: ${tablesResult.stderr.trim()}`)
      continue
    }
    const tables = tablesResult.stdout.split('\n').map((item) => item.trim()).filter(Boolean)
    for (const table of tables) {
      const escapedTable = table.replace(/"/g, '""')
      const countResult = spawnSync('sqlite3', [dbFile, `select count(*) from "${escapedTable}";`], { encoding: 'utf8' })
      const count = Number(countResult.stdout.trim())
      details.push(`${path.relative(root, dbFile)}:${table}=${Number.isFinite(count) ? count : '?'}${countResult.stderr ? ` ${countResult.stderr.trim()}` : ''}`)
      if (Number.isFinite(count) && count >= minRows) {
        return { ok: true, count, file: dbFile, table, detail: details.join('; ') }
      }
    }
  }
  return { ok: false, count: 0, file: null, table: null, detail: details.join('; ') || 'no sqlite user tables found' }
}

function runProductNpmInstall(root: string): Check {
  if (!exists(path.join(root, 'package.json'))) return fail('npm install 生成项目依赖', 'package.json missing')
  const result = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
    cwd: root,
    env: {
      ...process.env,
      npm_config_cache: path.join(root, '.npm-cache'),
      npm_config_update_notifier: 'false',
    },
    encoding: 'utf8',
    timeout: 180_000,
  })
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim()
  if (result.error) return fail('npm install 生成项目依赖', result.error.message)
  if (result.status === 0) return ok('npm install 生成项目依赖', output.split('\n').slice(-8).join('\n'))
  return fail('npm install 生成项目依赖', output.split('\n').slice(-16).join('\n'))
}

async function verifyCalculatorProduct(root: string) {
  const required = [
    'package.json',
    'src/server.js',
    'public/index.html',
    'public/app.js',
    'README.md',
  ]
  for (const file of required) {
    const fullPath = path.join(root, file)
    record(exists(fullPath) ? ok(`生成文件存在 ${file}`) : fail(`生成文件存在 ${file}`, fullPath))
  }
  record(
    exists(path.join(root, 'public/styles.css')) || exists(path.join(root, 'public/style.css'))
      ? ok('生成样式文件存在 public/styles.css 或 public/style.css')
      : fail('生成样式文件存在 public/styles.css 或 public/style.css'),
  )
  if (!exists(path.join(root, 'src/server.js'))) return

  record(runProductNpmInstall(root))
  record(runCommand('node', ['--test'], root))

  const dbPath = path.join(root, 'data/strict-product-gate.sqlite')
  fs.rmSync(dbPath, { force: true })
  const port = await freePort()
  const productUrl = `http://127.0.0.1:${port}`
  const server = spawn('node', ['src/server.js'], {
    cwd: root,
    env: { ...process.env, DB_FILE: dbPath, DB_PATH: dbPath, CALC_DB_PATH: dbPath, CALCULATOR_DB_PATH: dbPath, SQLITE_DB_PATH: dbPath, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  server.stdout?.on('data', (chunk) => { stdout += chunk.toString() })
  server.stderr?.on('data', (chunk) => { stderr += chunk.toString() })
  try {
    const ready = await Promise.race([
      waitForHttp(productUrl),
      once(server, 'exit').then(() => false),
    ])
    if (!ready) {
      record(fail('生成网站 HTTP ready', productUrl))
      if (stderr || stdout) record(fail('生成服务提前退出或无响应', `${stdout}${stderr}`.trim()))
      return
    }
    record(ok('生成网站 HTTP ready', productUrl))

    const contracts = [
      {
        name: 'leftOperand/operator/rightOperand',
        payload: (leftOperand: number | string, operator: string, rightOperand: number | string) => ({ leftOperand, operator, rightOperand }),
        result: (body: Record<string, unknown>) => numericResultFrom(body, [['calculation', 'result'], ['result'], ['data', 'result']]),
        historyOperator: (item: Record<string, unknown>) => typeof item.operator === 'string' ? item.operator : null,
        historyItems: (body: Record<string, unknown> | unknown[]) => arrayFromAny(body, ['calculations', 'history', 'items', 'records']),
      },
      {
        name: 'left/operator/right',
        payload: (leftOperand: number | string, operator: string, rightOperand: number | string) => ({ left: leftOperand, operator, right: rightOperand }),
        result: (body: Record<string, unknown>) => numericResultFrom(body, [['result'], ['calculation', 'result'], ['data', 'result']]),
        historyOperator: (item: Record<string, unknown>) => typeof item.operator === 'string' ? item.operator : null,
        historyItems: (body: Record<string, unknown> | unknown[]) => arrayFromAny(body, ['history', 'calculations', 'items', 'records']),
      },
      {
        name: 'a/operator/b',
        payload: (leftOperand: number | string, operator: string, rightOperand: number | string) => ({ a: leftOperand, operator, b: rightOperand }),
        result: (body: Record<string, unknown>) => numericResultFrom(body, [['result'], ['calculation', 'result'], ['data', 'result']]),
        historyOperator: (item: Record<string, unknown>) => typeof item.operator === 'string' ? item.operator : null,
        historyItems: (body: Record<string, unknown> | unknown[]) => arrayFromAny(body, ['history', 'calculations', 'items', 'records']),
      },
      {
        name: 'a/op/b',
        payload: (leftOperand: number | string, operator: string, rightOperand: number | string) => ({ a: leftOperand, op: operator, b: rightOperand }),
        result: (body: Record<string, unknown>) => numericResultFrom(body, [['result'], ['calculation', 'result'], ['data', 'result']]),
        historyOperator: (item: Record<string, unknown>) => typeof item.op === 'string' ? item.op : typeof item.operator === 'string' ? item.operator : null,
        historyItems: (body: Record<string, unknown> | unknown[]) => arrayFromAny(body, ['items', 'history', 'calculations', 'records']),
      },
      {
        name: 'a/op/b symbolic names',
        payload: (leftOperand: number | string, operator: string, rightOperand: number | string) => {
          const op = operator === '+' ? 'add' : operator === '-' ? 'sub' : operator === '*' ? 'mul' : operator === '/' ? 'div' : operator
          return { a: leftOperand, op, b: rightOperand }
        },
        result: (body: Record<string, unknown>) => numericResultFrom(body, [['result'], ['calculation', 'result'], ['data', 'result']]),
        historyOperator: (item: Record<string, unknown>) => typeof item.op === 'string' ? item.op : typeof item.operator === 'string' ? item.operator : null,
        historyItems: (body: Record<string, unknown> | unknown[]) => arrayFromAny(body, ['items', 'history', 'calculations', 'records']),
      },
    ]
    async function postCalculation(contract: typeof contracts[number], leftOperand: number | string, operator: string, rightOperand: number | string) {
      const response = await fetch(`${productUrl}/api/calculate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(contract.payload(leftOperand, operator, rightOperand)),
      })
      const body = await response.json() as Record<string, unknown>
      return { response, body }
    }
    let activeContract: typeof contracts[number] | null = null
    for (const contract of contracts) {
      const probe = await postCalculation(contract, 1, '+', 2)
      if ((probe.response.status === 200 || probe.response.status === 201) && contract.result(probe.body) === 3) {
        activeContract = contract
        record(ok('API 契约探测通过', contract.name))
        break
      }
    }
    if (!activeContract) {
      record(fail('API 契约探测通过', '既不符合 leftOperand/operator/rightOperand、left/operator/right、a/operator/b，也不符合 a/op/b'))
      return
    }

    const cases = [
      [9, '+', 4, 13],
      [9, '-', 4, 5],
      [9, '*', 4, 36],
      [12, '/', 4, 3],
    ] as const
    for (const [leftOperand, operator, rightOperand, expected] of cases) {
      const { response, body } = await postCalculation(activeContract, leftOperand, operator, rightOperand)
      const result = activeContract.result(body)
      record(
        (response.status === 200 || response.status === 201) && result === expected
          ? ok(`API 计算 ${leftOperand} ${operator} ${rightOperand}`)
          : fail(`API 计算 ${leftOperand} ${operator} ${rightOperand}`, JSON.stringify({ status: response.status, body })),
      )
    }

    const bad = await Promise.all([
      postCalculation(activeContract, 1, '/', 0).then((item) => item.response),
      postCalculation(activeContract, 1, '%', 2).then((item) => item.response),
      postCalculation(activeContract, 'abc', '+', 2).then((item) => item.response),
    ])
    record(bad.every((response) => response.status === 400)
      ? ok('API 拒绝除零、非法操作符和非法数字')
      : fail('API 拒绝除零、非法操作符和非法数字', bad.map((response) => response.status).join(',')))

    const historyResponse = await fetch(`${productUrl}/api/history?limit=20`)
    const history = await historyResponse.json() as Record<string, unknown>
    const historyItems = activeContract.historyItems(history).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    record(
      historyResponse.ok && historyItems.length >= 4
        ? ok('SQLite-backed history API 读回', `${historyItems.length} rows`)
        : fail('SQLite-backed history API 读回', JSON.stringify({ status: historyResponse.status, history })),
    )

    const sqliteEvidence = sqlitePersistentHistoryEvidence(root, dbPath, 4)
    record(
      sqliteEvidence.ok
        ? ok('SQLite 文件真实持久化历史', `${sqliteEvidence.count} rows; ${path.relative(root, sqliteEvidence.file ?? root)}:${sqliteEvidence.table}`)
        : fail('SQLite 文件真实持久化历史', sqliteEvidence.detail),
    )
  } catch (error) {
    record(fail('生成产物运行验证', error instanceof Error ? error.message : String(error)))
  } finally {
    server.kill('SIGTERM')
    fs.rmSync(dbPath, { force: true })
  }
}

function opencliAvailable() {
  const result = spawnSync('opencli', ['doctor'], { encoding: 'utf8', timeout: 20_000 })
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'opencli-doctor.txt'), `${result.stdout}${result.stderr}`)
  return result.status === 0
}

function runOpencli(args: string[], outputFile: string): Check {
  const result = spawnSync('opencli', args, { encoding: 'utf8', timeout: 60_000 })
  fs.writeFileSync(path.join(ARTIFACT_DIR, outputFile), `${result.stdout}${result.stderr}`)
  if (result.error) return warn(`OpenCLI ${args.join(' ')}`, result.error.message)
  if (result.status === 0) return ok(`OpenCLI ${args.join(' ')}`)
  return warn(`OpenCLI ${args.join(' ')}`, `${result.stdout}${result.stderr}`.trim().split('\n').slice(-8).join('\n'))
}

function runOpencliEval(session: string, script: string, outputFile: string, label: string): Check {
  const result = spawnSync('opencli', ['browser', session, 'eval', script], { encoding: 'utf8', timeout: 60_000 })
  fs.writeFileSync(path.join(ARTIFACT_DIR, outputFile), `${result.stdout}${result.stderr}`)
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim()
  if (result.error) return fail(label, result.error.message)
  if (result.status === 0) return ok(label, output.split('\n').slice(0, 20).join('\n'))
  return fail(label, output.split('\n').slice(-12).join('\n'))
}

async function verifyWebRightPanelResize(workspaceId: string) {
  const session = 'agenthub-strict'
  const workspaceUrl = `${BASE_URL}/workspace/${workspaceId}`
  const dragScript = String.raw`
    (async () => {
      const overlay = document.querySelector('[data-testid="artifact-overlay"]')
      const handle = document.querySelector('[data-testid="artifact-resize-handle"]')
      const composer = document.querySelector('[data-testid="message-composer"]')
      const chatPanel = document.querySelector('[data-testid="chat-panel"]')
      if (!overlay) throw new Error('missing artifact overlay')
      if (!handle) throw new Error('missing artifact resize handle')
      if (!composer || !chatPanel) throw new Error('missing chat panel or composer')
      const before = overlay.getBoundingClientRect().width
      const handleBox = handle.getBoundingClientRect()
      const targetX = window.innerWidth - 500
      handle.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 91,
        pointerType: 'mouse',
        isPrimary: true,
        clientX: handleBox.left + Math.max(1, handleBox.width / 2),
        clientY: handleBox.top + Math.max(1, handleBox.height / 2),
      }))
      await new Promise((resolve) => setTimeout(resolve, 80))
      window.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 91,
        pointerType: 'mouse',
        isPrimary: true,
        clientX: targetX,
        clientY: handleBox.top + Math.max(1, handleBox.height / 2),
      }))
      await new Promise((resolve) => setTimeout(resolve, 80))
      window.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 91,
        pointerType: 'mouse',
        isPrimary: true,
        clientX: targetX,
        clientY: handleBox.top + Math.max(1, handleBox.height / 2),
      }))
      await new Promise((resolve) => setTimeout(resolve, 150))
      const after = overlay.getBoundingClientRect().width
      const stored = Number(window.localStorage.getItem('agenthub:right-panel-width'))
      const composerBox = composer.getBoundingClientRect()
      const chatBox = chatPanel.getBoundingClientRect()
      if (!Number.isFinite(stored)) throw new Error('right panel width was not persisted')
      if (Math.abs(after - before) < 40) throw new Error('right panel width did not change enough: before=' + before + ', after=' + after)
      if (Math.abs(stored - after) > 24) throw new Error('persisted width does not match rendered width: stored=' + stored + ', after=' + after)
      if (composerBox.width < 260 || chatBox.width < 360) throw new Error('chat area unusable after resize: composer=' + composerBox.width + ', chat=' + chatBox.width)
      return { before, after, stored, composerWidth: composerBox.width, chatWidth: chatBox.width }
    })()
  `
  record(runOpencliEval(session, dragScript, 'opencli-web-right-panel-resize-drag.txt', 'Web 右侧栏可拖动且聊天区仍可用'))
  record(runOpencli(['browser', session, 'open', workspaceUrl], 'opencli-web-reopen-after-resize.txt'))
  const persistedScript = String.raw`
    (() => {
      const overlay = document.querySelector('[data-testid="artifact-overlay"]')
      const composer = document.querySelector('[data-testid="message-composer"]')
      if (!overlay) throw new Error('missing artifact overlay after reload')
      if (!composer) throw new Error('missing composer after reload')
      const rendered = overlay.getBoundingClientRect().width
      const stored = Number(window.localStorage.getItem('agenthub:right-panel-width'))
      const composerWidth = composer.getBoundingClientRect().width
      if (!Number.isFinite(stored)) throw new Error('persisted width missing after reload')
      if (Math.abs(stored - rendered) > 24) throw new Error('reload width mismatch: stored=' + stored + ', rendered=' + rendered)
      if (composerWidth < 260) throw new Error('composer unusable after reload: ' + composerWidth)
      return { rendered, stored, composerWidth }
    })()
  `
  record(runOpencliEval(session, persistedScript, 'opencli-web-right-panel-resize-persisted.txt', 'Web 右侧栏宽度刷新后持久化'))
}

async function verifyTriSurface(sessionId: string, workspaceId: string, artifactId: string | null) {
  const webMessages = await jsonOrThrow<unknown[]>(await apiFetch(`/api/messages?session_id=${sessionId}`), 'GET /api/messages')
  record(Array.isArray(webMessages) && webMessages.length >= 3
    ? ok('Web API 同 session 消息读回', `${webMessages.length} messages`)
    : fail('Web API 同 session 消息读回', JSON.stringify(webMessages)))

  const mobilePage = await apiFetch(`/m/sessions/${sessionId}`, { headers: { Accept: 'text/html' } })
  const mobileHtml = await mobilePage.text()
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'mobile-session.html'), mobileHtml)
  record(mobilePage.ok && mobileHtml.includes('mobile-session')
    ? ok('Mobile/PWA 同 session 页面读回', `/m/sessions/${sessionId}`)
    : fail('Mobile/PWA 同 session 页面读回', `status=${mobilePage.status}`))

  if (artifactId) {
    const mobilePreview = await apiFetch(`/m/preview?artifactId=${artifactId}`, { headers: { Accept: 'text/html' } })
    const previewHtml = await mobilePreview.text()
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'mobile-preview.html'), previewHtml)
    record(mobilePreview.ok && previewHtml.includes('mobile-preview')
      ? ok('Mobile/PWA 产物预览路由读回', `/m/preview?artifactId=${artifactId}`)
      : fail('Mobile/PWA 产物预览路由读回', `status=${mobilePreview.status}`))
  }

  if (opencliAvailable()) {
    record(runOpencli(['browser', 'agenthub-strict', 'open', `${BASE_URL}/workspace/${workspaceId}`], 'opencli-web-open.txt'))
    await verifyWebRightPanelResize(workspaceId)
    record(runOpencli(['browser', 'agenthub-strict', 'screenshot', path.join(ARTIFACT_DIR, 'web-workspace.png')], 'opencli-web-screenshot.txt'))
    record(runOpencli(['browser', 'agenthub-strict-mobile', 'open', `${BASE_URL}/m/sessions/${sessionId}`], 'opencli-mobile-open.txt'))
    record(runOpencli(['browser', 'agenthub-strict-mobile', 'screenshot', path.join(ARTIFACT_DIR, 'mobile-session.png')], 'opencli-mobile-screenshot.txt'))
  } else {
    record(warn('OpenCLI doctor 不可用，已退化为 HTTP readback', '三端截图证据未采集，严格报告会标记该项 warning'))
  }

  const opencliList = spawnSync('opencli', ['list', '-f', 'json'], { encoding: 'utf8', timeout: 20_000 })
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'opencli-list.json'), `${opencliList.stdout}${opencliList.stderr}`)
  if (opencliList.status === 0 && opencliList.stdout.toLowerCase().includes('agenthub') && opencliList.stdout.toLowerCase().includes('electron')) {
    record(ok('Desktop/Electron OpenCLI adapter 可用'))
  } else {
    const desktopArtifacts = [
      path.join(REPO_ROOT, 'e2e/artifacts/desktop-workspace-page-1200x800.png'),
      path.join(REPO_ROOT, 'e2e/artifacts/desktop-settings-page-1200x800.png'),
    ]
    const found = desktopArtifacts.filter((artifact) => exists(artifact))
    record(found.length > 0
      ? ok('Desktop/Electron 使用 Playwright fallback 证据', found.map((item) => path.relative(REPO_ROOT, item)).join(', '))
      : warn('Desktop/Electron OpenCLI adapter 缺失且 fallback 截图未找到', '不计入核心单 prompt 通过，但报告会记录为三端风险'))
  }
}

async function main() {
  loadEnvFile(ACCEPTANCE_ENV)
  requireEnv('DATABASE_URL')
  requireEnv('REDIS_URL')
  requireEnv('TEST_AUTH_COOKIE')
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })

    console.log('\n=== Strict Single-Prompt Product Delivery Gate ===')
    console.log(`BASE_URL=${BASE_URL}`)
    console.log(`runMarker=${RUN_MARKER}`)
    console.log(`evidenceDir=${ARTIFACT_DIR}`)
    console.log(`chatTimeoutMs=${CHAT_TIMEOUT_MS}`)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  let workspaceId = ''
  let sessionId = ''
  let planId: string | null = null
  let workspaceRoot: string | null = null
  let finalArtifactId: string | null = null
  let fatalError: string | null = null

  try {
    const workspace = await jsonOrThrow<{ id: string; cloud_project_dir?: string | null }>(await apiFetch('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name: `strict-product-${RUN_MARKER}`, execution_domain: 'cloud' }),
    }), 'POST /api/workspaces')
    workspaceId = workspace.id
    record(ok('fresh workspace created', workspaceId))

    const roles = await jsonOrThrow<Array<{ id: string; name: string; runtime_type: string; is_orchestrator: boolean }>>(
      await apiFetch(`/api/role-agents?workspace_id=${workspaceId}`),
      'GET /api/role-agents',
    )
    const architect = roles.find((role) => role.is_orchestrator || role.name === '架构师')
    record(architect ? ok('Orchestrator/架构师角色存在', `${architect.name}:${architect.id}`) : fail('Orchestrator/架构师角色存在'))
    record(roles.some((role) => role.name === '前端工程师') ? ok('前端工程师角色存在') : fail('前端工程师角色存在'))
    record(roles.some((role) => role.name === '后端工程师') ? ok('后端工程师角色存在') : fail('后端工程师角色存在'))

    const session = await jsonOrThrow<{ id: string }>(await apiFetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: workspaceId, name: `strict product delivery ${RUN_MARKER}` }),
    }), 'POST /api/sessions')
    sessionId = session.id
    record(ok('fresh session created', sessionId))

    const chatResponse = await apiFetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        content: PROMPT,
        permissionMode: 'full_control',
        runMarker: RUN_MARKER,
        unifiedRegressionRunId: RUN_MARKER,
      }),
    })
    record(chatResponse.ok ? ok('/api/chat 单 prompt 返回 SSE', `status=${chatResponse.status}`) : fail('/api/chat 单 prompt 返回 SSE', `status=${chatResponse.status}`))
    if (!chatResponse.ok) throw new Error(await chatResponse.text())
    const sseRead = await readSseEvents(chatResponse, CHAT_TIMEOUT_MS)
    if (sseRead.timedOut) {
      record(fail('/api/chat SSE 在严格窗口内结束', `timeoutMs=${CHAT_TIMEOUT_MS}; workspaceId=${workspaceId}; sessionId=${sessionId}; path=POST /api/chat`))
      await writeRunSnapshot(pool, {
        workspaceId,
        sessionId,
        planId,
        reason: `chat SSE timeout after ${CHAT_TIMEOUT_MS}ms`,
        fileName: 'chat-timeout-db-snapshot.json',
      })
    } else {
      record(ok('/api/chat SSE 在严格窗口内结束', `events=${sseRead.events.length}`))
    }
    const events = sseRead.events
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'chat-sse-events.json'), JSON.stringify(events, null, 2))
    const eventTypes = events.map((event) => event.type)
    record(eventTypes.includes('orchestrator_plan_started') ? ok('SSE 包含 orchestrator_plan_started') : fail('SSE 包含 orchestrator_plan_started', eventTypes.join(',')))
    record(eventTypes.includes('role_selected') ? ok('SSE 包含 role_selected') : fail('SSE 包含 role_selected', eventTypes.join(',')))
    record(eventTypes.includes('done') ? ok('SSE 包含 done') : fail('SSE 包含 done', eventTypes.join(',')))
    record(!eventTypes.includes('approval_requested') ? ok('full-control SSE 不出现手动 approval_requested') : fail('full-control SSE 不出现手动 approval_requested', eventTypes.join(',')))

    const wsRow = await one<{ cloud_project_dir: string | null }>(pool, 'SELECT cloud_project_dir FROM public.workspaces WHERE id = $1', [workspaceId])
    workspaceRoot = wsRow?.cloud_project_dir ?? null
    record(workspaceRoot && exists(workspaceRoot) ? ok('workspace root exists', workspaceRoot) : fail('workspace root exists', String(workspaceRoot)))

    const userMarker = await one<{ count: string }>(
      pool,
      `SELECT count(*)::text
         FROM public.messages
        WHERE session_id = $1
          AND sender_type = 'user'
          AND (
            content LIKE '%' || $2 || '%'
            OR metadata->>'runMarker' = $2
            OR metadata->>'unifiedRegressionRunId' = $2
            OR metadata->>'uatRunId' = $2
          )`,
      [sessionId, RUN_MARKER],
    )
    record(Number(userMarker?.count ?? 0) === 1 ? ok('fresh run marker 持久化到唯一用户消息') : fail('fresh run marker 持久化到唯一用户消息', JSON.stringify(userMarker)))

    const plan = await one<{ id: string; status: string }>(
      pool,
      'SELECT id, status FROM public.plans WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1',
      [sessionId],
    )
    planId = plan?.id ?? null
    record(planId ? ok('DB 创建 durable plan', planId) : fail('DB 创建 durable plan'))
    record(plan?.status === 'completed' ? ok('plan.status completed') : fail('plan.status completed', JSON.stringify(plan)))

    const nodes = await many<{ id: string; label: string; status: string; name: string | null; runtime_type: string | null }>(
      pool,
      `SELECT pn.id::text, pn.label, pn.status, ra.name, ra.runtime_type
         FROM public.plan_nodes pn
         LEFT JOIN public.role_agents ra ON ra.id = pn.agent_id
        WHERE pn.plan_id = $1
        ORDER BY pn.created_at ASC`,
      [planId],
    )
    record(nodes.length >= 4 ? ok('plan 包含规划/后端/前端/验收节点', `${nodes.length} nodes`) : fail('plan 包含规划/后端/前端/验收节点', JSON.stringify(nodes)))
    record(nodes.every((node) => node.status === 'completed') ? ok('所有 plan_nodes completed') : fail('所有 plan_nodes completed', JSON.stringify(nodes)))
    record(nodes.some((node) => node.name === '前端工程师' && node.status === 'completed') ? ok('前端工程师节点 completed') : fail('前端工程师节点 completed', JSON.stringify(nodes)))
    record(nodes.some((node) => node.name === '后端工程师' && node.status === 'completed') ? ok('后端/SQLite 节点 completed') : fail('后端/SQLite 节点 completed', JSON.stringify(nodes)))

    const queueLeftovers = await many<{ source: string; id: string; status: string }>(
      pool,
      `SELECT 'attempt' AS source, pna.id::text, pna.status
         FROM public.plan_node_attempts pna
         JOIN public.plan_nodes pn ON pn.id = pna.plan_node_id
        WHERE pn.plan_id = $1 AND pn.status = 'completed' AND pna.status IN ('queued','waiting')
       UNION ALL
       SELECT 'mailbox' AS source, ami.id::text, ami.status
         FROM public.agent_mailbox_items ami
         JOIN public.plan_nodes pn ON pn.id = ami.plan_node_id
        WHERE pn.plan_id = $1 AND pn.status = 'completed' AND ami.status IN ('queued','waiting')`,
      [planId],
    )
    record(queueLeftovers.length === 0 ? ok('completed plan 无 queued/waiting leftovers') : fail('completed plan 无 queued/waiting leftovers', JSON.stringify(queueLeftovers)))

    const runtimeRows = await many<{ id: string; role_agent_id: string | null; runtime_type: string; status: string; native_session_id: string | null }>(
      pool,
      'SELECT id::text, role_agent_id::text, runtime_type, status, native_session_id FROM public.runtime_sessions WHERE session_id = $1 ORDER BY created_at ASC',
      [sessionId],
    )
    record(runtimeRows.length >= 4 ? ok('runtime_sessions 持久化每节点执行', `${runtimeRows.length}`) : fail('runtime_sessions 持久化每节点执行', JSON.stringify(runtimeRows)))
    record(runtimeRows.every((row) => row.status === 'completed') ? ok('所有 runtime_sessions completed') : fail('所有 runtime_sessions completed', JSON.stringify(runtimeRows)))

    const actions = await many<{ status: string; count: string }>(
      pool,
      'SELECT status, count(*)::text FROM public.actions WHERE session_id = $1 GROUP BY status ORDER BY status',
      [sessionId],
    )
    record(actions.every((row) => row.status !== 'pending' && row.status !== 'approved') ? ok('full-control 无 pending/approved 手动权限卡') : fail('full-control 无 pending/approved 手动权限卡', JSON.stringify(actions)))
    record(actions.some((row) => row.status === 'completed' || row.status === 'running')
      ? ok('full-control 产生自动授权/续跑 action 证据', JSON.stringify(actions))
      : fail('full-control 产生自动授权/续跑 action 证据', JSON.stringify(actions)))

    const messages = await many<{ id: string; content: string; message_type: string; sender_type: string; role_agent_id: string | null; name: string | null; metadata: Record<string, unknown> | null }>(
      pool,
      `SELECT m.id::text, m.content, m.message_type, m.sender_type, m.role_agent_id::text, ra.name, m.metadata
         FROM public.messages m
         LEFT JOIN public.role_agents ra ON ra.id = m.role_agent_id
        WHERE m.session_id = $1
        ORDER BY m.created_at ASC`,
      [sessionId],
    )
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'db-messages.json'), JSON.stringify(messages, null, 2))
    const messageText = messages.map((message) => `${message.name ?? ''}\n${message.message_type}\n${message.content}`).join('\n')
    const firstProcess = messages.find((message) => message.message_type !== 'text' || message.name)
    record(firstProcess && includesAny(`${firstProcess.name ?? ''}\n${firstProcess.content}`, [/架构师|Orchestrator/])
      ? ok('首个可见 Agent/过程回复来自架构师/Orchestrator', firstProcess.id)
      : fail('首个可见 Agent/过程回复来自架构师/Orchestrator', firstProcess ? JSON.stringify(firstProcess) : 'none'))
    record(includesAny(messageText, [/前端工程师/]) && includesAny(messageText, [/后端工程师|SQLite|sqlite|数据库|API/])
      ? ok('消息流展示前端和后端/storage 分工')
      : fail('消息流展示前端和后端/storage 分工'))
    const processMessages = messages.filter((message) => message.message_type === 'plan_card' || message.message_type === 'system_event' || message.message_type === 'result_card')
    record(processMessages.length >= 6
      ? ok('消息流包含多步可见开发过程', `${processMessages.length} process messages`)
      : fail('消息流包含多步可见开发过程', `${processMessages.length} process messages`))
    record(includesAny(messageText, [/src\/server\.js|public\/index\.html|public\/app\.js|package\.json|README\.md/])
      ? ok('消息流包含代码/文件引用')
      : fail('消息流包含代码/文件引用'))
    record(includesAny(messageText, [/已完成/]) ? ok('消息流包含最终已完成状态') : fail('消息流包含最终已完成状态'))
    const roleMessages = messages.filter((message) => message.sender_type === 'agent' && message.role_agent_id)
    const workerMessages = roleMessages.filter((message) => message.name && !includesAny(message.name, [/架构师|Orchestrator/]))
    const workerNames = new Set(workerMessages.map((message) => message.name))
    record(workerMessages.length >= 2 && workerNames.has('前端工程师') && workerNames.has('后端工程师')
      ? ok('IM transcript 包含真实前端/后端角色回复', Array.from(workerNames).join(','))
      : fail('IM transcript 包含真实前端/后端角色回复', JSON.stringify(workerMessages)))
    record(workerMessages.some((message) => JSON.stringify(message.metadata ?? {}).includes('handoffsReceived') || message.content.includes('AgentHub 观察到的落地证据'))
      ? ok('角色回复包含 handoff 或落地证据元数据')
      : fail('角色回复包含 handoff 或落地证据元数据', JSON.stringify(workerMessages.map((message) => ({ name: message.name, metadata: message.metadata, content: message.content.slice(0, 400) })))))
    const orchestratorMessages = roleMessages.filter((message) => message.name && includesAny(message.name, [/架构师|Orchestrator/]))
    const negativeValidation = orchestratorMessages.find((message) => includesAny(message.content, [/不能确认|当前不能确认|暂不能|未收到已完成|不会显示已完成|执行失败：至少一个节点失败/]))
    record(!negativeValidation
      ? ok('Orchestrator 验收消息无负向完成结论')
      : fail('Orchestrator 验收消息无负向完成结论', negativeValidation.content.slice(0, 1000)))
    record(orchestratorMessages.some((message) => includesAny(message.content, [/验收|验证|确认|已完成|产物推荐|推荐产物/]))
      ? ok('IM transcript 包含 Orchestrator 验收/产物决策')
      : fail('IM transcript 包含 Orchestrator 验收/产物决策', JSON.stringify(orchestratorMessages.map((message) => message.content.slice(0, 500)))))
    const artifactResultCard = messages.find((message) => (
      message.message_type === 'result_card'
      && Boolean(message.metadata?.artifactRecommendation)
      && Boolean(message.metadata?.artifactConfirmation)
    ))
    record(artifactResultCard
      ? ok('IM transcript 包含产物推荐/确认 result card', artifactResultCard.id)
      : fail('IM transcript 包含产物推荐/确认 result card', JSON.stringify(messages.filter((message) => message.message_type === 'result_card'))))

    if (workspaceRoot) await verifyCalculatorProduct(workspaceRoot)

    if (workspaceRoot) {
      const tree = await jsonOrThrow<{ tree?: unknown[] }>(await apiFetch(`/api/workspaces/${workspaceId}/files`), 'GET workspace files')
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'workspace-files.json'), JSON.stringify(tree, null, 2))
      const treeText = JSON.stringify(tree)
      record(treeText.includes('public/index.html') && treeText.includes('src/server.js')
        ? ok('文件树 API 读回生成文件')
        : fail('文件树 API 读回生成文件', treeText.slice(0, 1000)))
      const previewResponse = await apiFetch(`/api/workspaces/${workspaceId}/files/read?path=${encodeURIComponent('public/index.html')}`)
      const previewText = await previewResponse.text()
      let preview: { content?: string | null; previewKind?: string } | null = null
      try {
        preview = JSON.parse(previewText) as { content?: string | null; previewKind?: string }
      } catch {
        preview = null
      }
      record(preview?.previewKind === 'html' && typeof preview.content === 'string' && preview.content.includes('<')
        ? ok('Workbench 文件预览 API 读回 HTML')
        : fail('Workbench 文件预览 API 读回 HTML', `status=${previewResponse.status}; body=${previewText.slice(0, 1000)}`))
    }

    const artifacts = await many<{ id: string; source_path: string | null; artifact_type: string; metadata: Record<string, unknown> | null }>(
      pool,
      'SELECT id::text, source_path, artifact_type, metadata FROM public.artifacts WHERE workspace_id = $1 AND session_id = $2 ORDER BY created_at DESC',
      [workspaceId, sessionId],
    )
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'db-artifacts.json'), JSON.stringify(artifacts, null, 2))
    const finalArtifact = artifacts.find((artifact) => artifact.source_path === 'public/index.html')
    finalArtifactId = finalArtifact?.id ?? null
    record(finalArtifact ? ok('最终产物候选 artifact row 存在', finalArtifact.id) : fail('最终产物候选 artifact row 存在', JSON.stringify(artifacts)))
    record(
      Boolean(finalArtifact?.metadata?.artifactRecommendation && finalArtifact.metadata.artifactConfirmation)
        ? ok('artifact metadata 包含模型推荐 + 用户确认/指定语义')
        : fail('artifact metadata 包含模型推荐 + 用户确认/指定语义', JSON.stringify(finalArtifact?.metadata)),
    )
    record(artifacts.length <= 3 ? ok('未把整个文件树默认标成产物', `${artifacts.length} artifacts`) : fail('未把整个文件树默认标成产物', `${artifacts.length} artifacts`))

    await verifyTriSurface(sessionId, workspaceId, finalArtifactId)
  } catch (error) {
    fatalError = error instanceof Error ? error.message : String(error)
    record(fail('strict gate fatal error', fatalError))
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
      workspaceId,
      sessionId,
      planId,
      workspaceRoot,
      finalArtifactId,
      evidenceDir: ARTIFACT_DIR,
    }
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
    console.log('\nSUMMARY:', JSON.stringify(summary, null, 2))
    await pool.end()
  }
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exit(1)
})
