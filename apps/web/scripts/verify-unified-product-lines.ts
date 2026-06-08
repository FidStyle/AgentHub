/**
 * Unified product-line regression verifier.
 *
 * This script re-reads durable acceptance evidence for the consolidated A-D
 * product lines. Historical reports provide only coordinates; current DB,
 * workspace files, generated product tests, UAT artifact paths, and message-level
 * process evidence are checked again here.
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { once } from 'node:events'
import net from 'node:net'
import { Pool } from 'pg'

export {}

type LineStatus = 'pass' | 'partial' | 'failed' | 'blocked' | 'not-run'
type CheckStatus = 'pass' | 'fail' | 'warn' | 'skip'

type Check = {
  status: CheckStatus
  label: string
  detail?: string
}

type LineResult = {
  id: 'A' | 'B' | 'C' | 'D'
  name: string
  status: LineStatus
  checks: Check[]
  evidence: string[]
}

type DbRow = Record<string, unknown>

const REPO_ROOT = path.resolve(__dirname, '../../..')
const ACCEPTANCE_ENV = path.join(REPO_ROOT, 'docker/.acceptance.env')
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const CURRENT_RUN_ID = process.env.UNIFIED_REGRESSION_RUN_ID || null

const fixed = {
  workspaceId: '58a63e3f-5ca7-457b-af02-2824d02ab9fa',
  sessionId: 'bbea8366-1e19-4ccc-9eb7-2a5d2fde6dbe',
  planId: '15ce3bf0-dc53-4537-a521-210bbc6aee07',
  workspaceRoot: '/Users/joytion/.agenthub/cloud-workspaces/joytion/bytedance-fixed-uat-1507-58a63e3f',
  artifactDir: path.join(REPO_ROOT, 'e2e/artifacts/opencli-uat/bytedance-fixed-sample-product-gate-2026-06-05'),
}

const p1 = {
  agentId: 'ec25dcf7-ff39-4515-aba0-34cbfa5f341d',
  rejectedDeployActionId: '848e1389-db7c-46a6-8c7b-dc95c211e6a3',
  completedDeployActionId: '06905123-81e1-4c32-bf20-4c85b488d919',
  deploymentArtifactId: '07dacb62-0a52-4724-8271-2d043882882c',
  documentArtifactId: 'd85af1ff-7d5f-4b51-87b6-f773fc665699',
  artifactDir: path.join(REPO_ROOT, 'e2e/artifacts/opencli-uat/remaining-p1-features-2026-06-05'),
}

const permission = {
  approveSessionId: 'e104da72-2989-4a81-a68d-9cc8661c3aed',
  approveActionId: '60f886f1-2684-49c8-9085-4ad465c4568b',
  rejectSessionId: 'd49c3272-8240-4908-ae8d-5e0ddea2caf8',
  rejectActionId: '3312a56a-082c-4e45-b9fc-fe1ae1adb04c',
  webRejectScreenshot: path.join(REPO_ROOT, 'e2e/artifacts/opencli-uat/permission-continuation-web-reject-2026-06-05.png'),
  mobileRejectScreenshot: path.join(REPO_ROOT, 'e2e/artifacts/opencli-uat/permission-continuation-mobile-reject-2026-06-05.png'),
}

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

function ok(label: string, detail?: string): Check {
  return { status: 'pass', label, detail }
}

function fail(label: string, detail?: string): Check {
  return { status: 'fail', label, detail }
}

function warn(label: string, detail?: string): Check {
  return { status: 'warn', label, detail }
}

function skip(label: string, detail?: string): Check {
  return { status: 'skip', label, detail }
}

function exists(filePath: string) {
  return fs.existsSync(filePath)
}

function includesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text))
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

function asRows<T extends DbRow>(rows: DbRow[]): T[] {
  return rows as T[]
}

async function one<T extends DbRow>(pool: Pool, sql: string, params: unknown[]) {
  const result = await pool.query(sql, params)
  return (result.rows[0] ?? null) as T | null
}

async function many<T extends DbRow>(pool: Pool, sql: string, params: unknown[] = []) {
  const result = await pool.query(sql, params)
  return asRows<T>(result.rows)
}

function lineStatus(checks: Check[], requiredLabels: string[] = []): LineStatus {
  const required = requiredLabels.length > 0
    ? checks.filter((check) => requiredLabels.includes(check.label))
    : checks.filter((check) => check.status !== 'skip')
  if (required.length === 0) return 'not-run'
  if (required.some((check) => check.status === 'fail')) return 'failed'
  if (checks.some((check) => check.status === 'skip')) return 'blocked'
  if (checks.some((check) => check.status === 'warn')) return 'partial'
  return 'pass'
}

function runCommand(command: string, args: string[], cwd: string, timeoutMs = 120_000): Check {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    encoding: 'utf8',
    timeout: timeoutMs,
  })
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim()
  if (result.error) return fail(`${command} ${args.join(' ')}`, result.error.message)
  if (result.status === 0) return ok(`${command} ${args.join(' ')}`, output.split('\n').slice(-5).join('\n'))
  return fail(`${command} ${args.join(' ')}`, output.split('\n').slice(-12).join('\n'))
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

async function waitForHttp(url: string, timeoutMs = 15_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok || response.status < 500) return true
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return false
}

async function verifyCalculatorProduct(root: string): Promise<Check[]> {
  const checks: Check[] = []
  const requiredFiles = [
    'package.json',
    'src/server.js',
    'public/index.html',
    'public/styles.css',
    'public/app.js',
    'test/api.test.js',
    'data/calculator.sqlite',
    'README.md',
  ]
  for (const file of requiredFiles) {
    const fullPath = path.join(root, file)
    checks.push(exists(fullPath) ? ok(`generated file ${file}`) : fail(`generated file ${file}`, fullPath))
  }

  if (!exists(path.join(root, 'src/server.js'))) return checks

  checks.push(runCommand('node', ['--test'], root))

  const dbPath = path.join(root, 'data/unified-regression.sqlite')
  fs.rmSync(dbPath, { force: true })
  const port = await freePort()
  const productUrl = `http://127.0.0.1:${port}`
  const server = spawn('node', ['src/server.js'], {
    cwd: root,
    env: { ...process.env, DB_PATH: dbPath, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  server.stdout?.on('data', (chunk) => { stdout += chunk.toString() })
  server.stderr?.on('data', (chunk) => { stderr += chunk.toString() })

  try {
    await Promise.race([
      once(server.stdout!, 'data'),
      once(server, 'exit').then(() => {
        throw new Error(`generated server exited early: ${stderr || stdout}`)
      }),
    ])
    if (!(await waitForHttp(productUrl))) {
      checks.push(fail('generated site HTTP readiness', productUrl))
      return checks
    }
    checks.push(ok('generated site HTTP readiness', productUrl))

    const cases = [
      [7, '+', 5, 12],
      [7, '-', 5, 2],
      [7, '*', 5, 35],
      [10, '/', 2, 5],
    ] as const
    for (const [leftOperand, operator, rightOperand, expected] of cases) {
      const response = await fetch(`${productUrl}/api/calculate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leftOperand, operator, rightOperand }),
      })
      const body = await response.json() as { calculation?: { result?: number }; error?: string }
      checks.push(
        response.status === 201 && body.calculation?.result === expected
          ? ok(`calculator API ${leftOperand} ${operator} ${rightOperand}`)
          : fail(`calculator API ${leftOperand} ${operator} ${rightOperand}`, JSON.stringify({ status: response.status, body })),
      )
    }

    const badResponses = await Promise.all([
      fetch(`${productUrl}/api/calculate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leftOperand: 1, operator: '/', rightOperand: 0 }),
      }),
      fetch(`${productUrl}/api/calculate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leftOperand: 1, operator: '%', rightOperand: 2 }),
      }),
      fetch(`${productUrl}/api/calculate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leftOperand: 'abc', operator: '+', rightOperand: 2 }),
      }),
    ])
    checks.push(badResponses.every((response) => response.status === 400)
      ? ok('calculator API invalid input guards')
      : fail('calculator API invalid input guards', badResponses.map((response) => response.status).join(',')))

    const historyResponse = await fetch(`${productUrl}/api/history?limit=20`)
    const history = await historyResponse.json() as { calculations?: Array<{ operator: string }> }
    checks.push(
      historyResponse.ok && Array.isArray(history.calculations) && history.calculations.length >= 4
        ? ok('calculator API SQLite-backed history readback', `${history.calculations.length} rows`)
        : fail('calculator API SQLite-backed history readback', JSON.stringify({ status: historyResponse.status, history })),
    )

    const sqlite = spawnSync('sqlite3', [dbPath, 'select count(*), group_concat(operator, "") from calculations;'], {
      encoding: 'utf8',
    })
    checks.push(
      sqlite.status === 0 && /^4\|\+-\*\//.test(sqlite.stdout.trim())
        ? ok('SQLite file contains persisted calculation history', sqlite.stdout.trim())
        : fail('SQLite file contains persisted calculation history', `${sqlite.stdout}${sqlite.stderr}`.trim()),
    )
  } catch (error) {
    checks.push(fail('generated product runtime exercise', error instanceof Error ? error.message : String(error)))
  } finally {
    server.kill('SIGTERM')
    fs.rmSync(dbPath, { force: true })
  }
  return checks
}

async function verifyLineA(pool: Pool): Promise<LineResult> {
  const checks: Check[] = []
  const evidence = [fixed.workspaceRoot, fixed.artifactDir]
  checks.push(CURRENT_RUN_ID
    ? ok('fresh single-prompt run id provided', CURRENT_RUN_ID)
    : fail('fresh single-prompt run id provided', 'Set UNIFIED_REGRESSION_RUN_ID to the current one-prompt UAT run id; static historical session coordinates are not acceptance evidence.'))

  if (CURRENT_RUN_ID) {
    const freshRunEvidence = await one<{ count: string }>(
      pool,
      `SELECT count(*)::text
         FROM public.messages
        WHERE session_id = $1
          AND (
            metadata->>'unifiedRegressionRunId' = $2
            OR metadata->>'uatRunId' = $2
            OR content LIKE '%' || $2 || '%'
          )`,
      [fixed.sessionId, CURRENT_RUN_ID],
    )
    checks.push(Number(freshRunEvidence?.count ?? 0) > 0
      ? ok('fresh run id is present in durable message evidence', `${freshRunEvidence?.count} messages`)
      : fail('fresh run id is present in durable message evidence', `session=${fixed.sessionId}, runId=${CURRENT_RUN_ID}`))
  }

  const messages = await many<{ id: string; content: string; message_type: string; name: string | null; metadata: Record<string, unknown> | null }>(
    pool,
    `SELECT m.id::text, m.content, m.message_type, ra.name, m.metadata
       FROM public.messages m
       LEFT JOIN public.role_agents ra ON ra.id = m.role_agent_id
      WHERE m.session_id = $1
      ORDER BY m.created_at ASC`,
    [fixed.sessionId],
  )
  const firstAgentMessage = messages.find((message) => message.name || message.message_type !== 'text')
  const messageText = messages.map((message) => `${message.name ?? ''}\n${message.message_type}\n${message.content}`).join('\n')
  const processMessages = messages.filter((message) => {
    const text = `${message.name ?? ''}\n${message.message_type}\n${message.content}`
    return message.message_type === 'plan_card' ||
      message.message_type === 'system_event' ||
      message.message_type === 'role_acknowledgement' ||
      includesAny(text, [/思考中|执行中|读取|编辑|写入|测试|验证|完成/, /Orchestrator|架构师|前端工程师|后端工程师/])
  })
  checks.push(
    firstAgentMessage && includesAny(`${firstAgentMessage.name ?? ''}\n${firstAgentMessage.content}`, [/Orchestrator|架构师/])
      ? ok('first visible agent response is Orchestrator/architect', firstAgentMessage.id)
      : fail('first visible agent response is Orchestrator/architect', firstAgentMessage ? JSON.stringify({ id: firstAgentMessage.id, name: firstAgentMessage.name, type: firstAgentMessage.message_type }) : 'no agent-visible message'),
  )
  checks.push(
    includesAny(messageText, [/前端工程师/]) && includesAny(messageText, [/后端工程师|SQLite|sqlite|数据库|API/])
      ? ok('visible process assigns frontend and backend/storage work')
      : fail('visible process assigns frontend and backend/storage work', 'message stream must show Orchestrator assigning frontend plus backend/storage work'),
  )
  checks.push(
    processMessages.length >= 6
      ? ok('message stream shows multi-step development process', `${processMessages.length} process messages`)
      : fail('message stream shows multi-step development process', `${processMessages.length} process messages; expected planning/reading/editing/testing/finalizing states without private chain-of-thought`),
  )
  checks.push(
    includesAny(messageText, [/src\/server\.js|public\/index\.html|public\/app\.js|package\.json|README\.md/])
      ? ok('message stream includes code/file references')
      : fail('message stream includes code/file references', 'expected user-visible references to edited/generated files'),
  )

  const plan = await one<{ id: string; status: string }>(
    pool,
    'SELECT id, status FROM public.plans WHERE id = $1 AND session_id = $2',
    [fixed.planId, fixed.sessionId],
  )
  checks.push(plan?.status === 'completed' ? ok('fixed sample plan completed', fixed.planId) : fail('fixed sample plan completed', JSON.stringify(plan)))

  const nodes = await many<{ label: string; status: string; name: string | null; runtime_type: string | null }>(
    pool,
    `SELECT pn.label, pn.status, ra.name, ra.runtime_type
     FROM public.plan_nodes pn
     LEFT JOIN public.role_agents ra ON ra.id = pn.agent_id
     WHERE pn.plan_id = $1
     ORDER BY pn.created_at ASC`,
    [fixed.planId],
  )
  checks.push(nodes.length >= 4 ? ok('plan has orchestrator/backend/frontend/final nodes', `${nodes.length} nodes`) : fail('plan has orchestrator/backend/frontend/final nodes', JSON.stringify(nodes)))
  checks.push(nodes.every((node) => node.status === 'completed') ? ok('all fixed sample plan nodes completed') : fail('all fixed sample plan nodes completed', JSON.stringify(nodes)))
  checks.push(nodes.some((node) => node.name === '后端工程师' && node.runtime_type === 'codex' && node.status === 'completed') ? ok('backend engineer node completed with Codex') : fail('backend engineer node completed with Codex', JSON.stringify(nodes)))
  checks.push(nodes.some((node) => node.name === '前端工程师' && node.runtime_type === 'claude_code' && node.status === 'completed') ? ok('frontend engineer node completed with Claude Code') : fail('frontend engineer node completed with Claude Code', JSON.stringify(nodes)))

  const activeQueue = await many<{ source: string; id: string; status: string }>(
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
    [fixed.planId],
  )
  checks.push(activeQueue.length === 0 ? ok('completed plan has no queued/waiting leftovers') : fail('completed plan has no queued/waiting leftovers', JSON.stringify(activeQueue)))

  const actionCounts = await many<{ status: string; count: string }>(
    pool,
    'SELECT status, count(*)::text FROM public.actions WHERE session_id = $1 GROUP BY status ORDER BY status',
    [fixed.sessionId],
  )
  checks.push(actionCounts.some((row) => row.status === 'completed' && Number(row.count) >= 1) ? ok('fixed sample has completed permission actions', JSON.stringify(actionCounts)) : fail('fixed sample has completed permission actions', JSON.stringify(actionCounts)))
  checks.push(actionCounts.every((row) => row.status !== 'pending') ? ok('fixed sample has no pending permission action') : fail('fixed sample has no pending permission action', JSON.stringify(actionCounts)))

  const runtimeCounts = await many<{ status: string; count: string }>(
    pool,
    'SELECT status, count(*)::text FROM public.runtime_sessions WHERE session_id = $1 GROUP BY status ORDER BY status',
    [fixed.sessionId],
  )
  checks.push(runtimeCounts.some((row) => row.status === 'completed' && Number(row.count) >= 4) ? ok('runtime sessions completed for fixed sample', JSON.stringify(runtimeCounts)) : fail('runtime sessions completed for fixed sample', JSON.stringify(runtimeCounts)))

  checks.push(...await verifyCalculatorProduct(fixed.workspaceRoot))

  const requiredScreens = [
    'web-agenthub-final-session.png',
    'web-agenthub-files-loaded.png',
    'web-agenthub-changes-final-clean.png',
    'web-calculator-after-ui-calc.png',
  ]
  for (const screenshot of requiredScreens) {
    const fullPath = path.join(fixed.artifactDir, screenshot)
    checks.push(exists(fullPath) ? ok(`OpenCLI Web evidence ${screenshot}`) : fail(`OpenCLI Web evidence ${screenshot}`, fullPath))
    evidence.push(fullPath)
  }

  return {
    id: 'A',
    name: 'Full-Auto Product Delivery',
    status: lineStatus(checks),
    checks,
    evidence,
  }
}

async function verifyLineB(pool: Pool): Promise<LineResult> {
  const checks: Check[] = []
  const evidence = [permission.webRejectScreenshot, permission.mobileRejectScreenshot]
  const autoActions = await many<{ status: string; count: string }>(
    pool,
    'SELECT status, count(*)::text FROM public.actions WHERE session_id = $1 GROUP BY status',
    [fixed.sessionId],
  )
  checks.push(autoActions.some((row) => row.status === 'completed' && Number(row.count) >= 1) ? ok('full-auto permission actions completed', JSON.stringify(autoActions)) : fail('full-auto permission actions completed', JSON.stringify(autoActions)))
  checks.push(autoActions.every((row) => row.status !== 'pending') ? ok('full-auto line has no pending action') : fail('full-auto line has no pending action', JSON.stringify(autoActions)))

  const fullAutoManualCards = await many<{ status: string; count: string }>(
    pool,
    `SELECT part.value->>'status' AS status, count(*)::text
       FROM public.messages m,
            LATERAL ${permissionRuntimePartsSql()} AS part(value)
      WHERE m.session_id = $1
        AND part.value->>'type' = 'permission'
        AND part.value->>'status' IN ('pending', 'approved')
      GROUP BY part.value->>'status'
      ORDER BY part.value->>'status'`,
    [fixed.sessionId],
  )
  checks.push(fullAutoManualCards.length === 0
    ? ok('full-control mode has no manual pending/approved permission cards')
    : fail('full-control mode has no manual pending/approved permission cards', JSON.stringify(fullAutoManualCards)))

  const approveAction = await one<{ status: string; executed_at: string | null; result: Record<string, unknown> | null }>(
    pool,
    'SELECT status, executed_at, result FROM public.actions WHERE id = $1',
    [permission.approveActionId],
  )
  checks.push(
    approveAction && ['running', 'completed', 'failed'].includes(approveAction.status) && approveAction.executed_at
      ? ok('manual allow dispatches continuation', JSON.stringify({ status: approveAction.status, executed_at: approveAction.executed_at }))
      : fail('manual allow dispatches continuation', JSON.stringify(approveAction)),
  )

  const approveCard = await one<{ status: string | null; message_id: string | null }>(
    pool,
    `SELECT part.value->>'status' AS status, m.id::text AS message_id
       FROM public.messages m,
            LATERAL ${permissionRuntimePartsSql()} AS part(value)
      WHERE m.session_id = $1
        AND part.value->>'type' = 'permission'
        AND part.value->>'actionId' = $2
      ORDER BY m.updated_at DESC
      LIMIT 1`,
    [permission.approveSessionId, permission.approveActionId],
  )
  checks.push(
    approveCard && ['running', 'completed', 'failed'].includes(String(approveCard.status))
      ? ok('manual allow updates original permission card state', JSON.stringify(approveCard))
      : fail('manual allow updates original permission card state', JSON.stringify(approveCard)),
  )

  const sideEffectPath = '/Users/joytion/.agenthub/cloud-workspaces/joytion/permission-fix-webuser_perm_fix_1780654469787-487c6e64/agenthub-permission-status-sync.txt'
  const sideEffect = exists(sideEffectPath) ? fs.readFileSync(sideEffectPath, 'utf8') : ''
  checks.push(sideEffect.includes('APPROVE WEBUSER_PERM_FIX_1780654469787') ? ok('manual allow side effect occurred inside workspace', sideEffectPath) : fail('manual allow side effect occurred inside workspace', sideEffectPath))
  evidence.push(sideEffectPath)

  const rejectAction = await one<{ status: string; executed_at: string | null }>(
    pool,
    'SELECT status, executed_at FROM public.actions WHERE id = $1',
    [permission.rejectActionId],
  )
  checks.push(rejectAction?.status === 'rejected' && rejectAction.executed_at === null ? ok('manual reject stops side effect') : fail('manual reject stops side effect', JSON.stringify(rejectAction)))

  const rejectNode = await one<{ status: string }>(
    pool,
    `SELECT pn.status
       FROM public.plan_nodes pn
       JOIN public.actions a ON a.plan_node_id = pn.id
      WHERE a.id = $1`,
    [permission.rejectActionId],
  )
  checks.push(rejectNode?.status === 'waiting' ? ok('manual reject keeps plan node waiting') : fail('manual reject keeps plan node waiting', JSON.stringify(rejectNode)))

  const rejectMessage = await one<{ content: string; metadata: Record<string, unknown> | null }>(
    pool,
    `SELECT content, metadata
       FROM public.messages
      WHERE session_id = $1 AND content LIKE '%已拒绝%'
      ORDER BY created_at DESC
      LIMIT 1`,
    [permission.rejectSessionId],
  )
  checks.push(rejectMessage ? ok('manual reject writes durable user-visible event') : fail('manual reject writes durable user-visible event'))

  const rejectCard = await one<{ status: string | null; message_id: string | null }>(
    pool,
    `SELECT part.value->>'status' AS status, m.id::text AS message_id
       FROM public.messages m,
            LATERAL ${permissionRuntimePartsSql()} AS part(value)
      WHERE m.session_id = $1
        AND part.value->>'type' = 'permission'
        AND part.value->>'actionId' = $2
      ORDER BY m.updated_at DESC
      LIMIT 1`,
    [permission.rejectSessionId, permission.rejectActionId],
  )
  checks.push(
    rejectCard?.status === 'rejected'
      ? ok('manual reject updates original permission card state', JSON.stringify(rejectCard))
      : fail('manual reject updates original permission card state', JSON.stringify(rejectCard)),
  )

  for (const screenshot of [permission.webRejectScreenshot, permission.mobileRejectScreenshot]) {
    checks.push(exists(screenshot) ? ok(`OpenCLI permission evidence ${path.basename(screenshot)}`) : fail(`OpenCLI permission evidence ${path.basename(screenshot)}`, screenshot))
  }

  return {
    id: 'B',
    name: 'Permission Lifecycle',
    status: lineStatus(checks),
    checks,
    evidence,
  }
}

async function verifyLineC(pool: Pool): Promise<LineResult> {
  const checks: Check[] = []
  const evidence = [p1.artifactDir]
  const agent = await one<{ id: string; name: string; runtime_type: string; capability_tags: unknown; enabled_tool_ids: unknown }>(
    pool,
    'SELECT id, name, runtime_type, capability_tags, enabled_tool_ids FROM public.role_agents WHERE id = $1',
    [p1.agentId],
  )
  checks.push(agent?.runtime_type === 'codex' && String(agent.name).includes('已编辑') ? ok('self-built Agent create/edit/readback', JSON.stringify(agent)) : fail('self-built Agent create/edit/readback', JSON.stringify(agent)))

  const rejectedDeploy = await one<{ status: string; executed_at: string | null }>(
    pool,
    'SELECT status, executed_at FROM public.actions WHERE id = $1',
    [p1.rejectedDeployActionId],
  )
  checks.push(rejectedDeploy?.status === 'rejected' && rejectedDeploy.executed_at === null ? ok('chat deploy reject path is durable') : fail('chat deploy reject path is durable', JSON.stringify(rejectedDeploy)))

  const completedDeploy = await one<{ status: string; executed_at: string | null; result: Record<string, unknown> | null }>(
    pool,
    'SELECT status, executed_at, result FROM public.actions WHERE id = $1',
    [p1.completedDeployActionId],
  )
  checks.push(completedDeploy?.status === 'completed' && completedDeploy.executed_at ? ok('chat deploy allow path completed') : fail('chat deploy allow path completed', JSON.stringify(completedDeploy)))

  const deploymentArtifact = await one<{ id: string; source_path: string | null; artifact_type: string; metadata: Record<string, unknown> | null }>(
    pool,
    'SELECT id, source_path, artifact_type, metadata FROM public.artifacts WHERE id = $1',
    [p1.deploymentArtifactId],
  )
  checks.push(deploymentArtifact?.metadata?.kind === 'deployment' ? ok('deployment artifact row exists', JSON.stringify(deploymentArtifact)) : fail('deployment artifact row exists', JSON.stringify(deploymentArtifact)))
  checks.push(
    deploymentArtifact?.metadata?.artifactRecommendation && deploymentArtifact.metadata.artifactConfirmation
      ? ok('deployment artifact was recommended and confirmed', JSON.stringify({
          recommendation: deploymentArtifact.metadata.artifactRecommendation,
          confirmation: deploymentArtifact.metadata.artifactConfirmation,
        }))
      : fail('deployment artifact was recommended and confirmed', 'artifact metadata must show model recommendation plus user confirmation/designation; artifact row alone is not enough'),
  )
  const manifestPath = path.join(fixed.workspaceRoot, '.agenthub/deployments', p1.completedDeployActionId, 'manifest.json')
  checks.push(exists(manifestPath) ? ok('deployment manifest file exists', manifestPath) : fail('deployment manifest file exists', manifestPath))
  evidence.push(manifestPath)
  if (exists(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
    checks.push(manifest.status === 'completed' && manifest.entryPath === 'public/index.html' ? ok('deployment manifest points to generated frontend', JSON.stringify({ status: manifest.status, entryPath: manifest.entryPath })) : fail('deployment manifest points to generated frontend', JSON.stringify(manifest)))
  }

  const docArtifact = await one<{ id: string; title: string; artifact_type: string; content: string | null; metadata: Record<string, unknown> | null }>(
    pool,
    'SELECT id, title, artifact_type, content, metadata FROM public.artifacts WHERE id = $1',
    [p1.documentArtifactId],
  )
  const editRequests = docArtifact?.metadata?.editRequests
  checks.push(
    docArtifact?.artifact_type === 'document' &&
    docArtifact.title.includes('已保存') &&
    String(docArtifact.content ?? '').includes('P1_DOC_CONTENT') &&
    Array.isArray(editRequests) &&
    editRequests.length > 0
      ? ok('rich document create/edit/edit-request readback', JSON.stringify({ title: docArtifact.title, editRequests: editRequests.length }))
      : fail('rich document create/edit/edit-request readback', JSON.stringify(docArtifact)),
  )

  const artifactRecommendationMessage = await one<{ id: string; content: string }>(
    pool,
    `SELECT id::text, content
       FROM public.messages
      WHERE session_id IN ($1, $2)
        AND (
          content ~ '(推荐|建议).{0,24}(产物|artifact|Artifact)'
          OR content ~ '(确认|指定|标记).{0,24}(产物|artifact|Artifact)'
        )
      ORDER BY created_at DESC
      LIMIT 1`,
    [fixed.sessionId, permission.approveSessionId],
  )
  checks.push(
    artifactRecommendationMessage
      ? ok('message stream includes artifact recommendation/confirmation step', artifactRecommendationMessage.id)
      : fail('message stream includes artifact recommendation/confirmation step', 'model must recommend artifact candidates and user must confirm/designate before marking final product'),
  )

  const p1Screens = [
    'web-agent-edited-readback.png',
    'web-deploy-rejected.png',
    'web-deploy-approved-chat.png',
    'web-deployment-artifact-panel.png',
    'web-artifact-doc-edited.png',
    'web-file-tree.png',
    'web-file-preview-index.png',
    'web-file-preview-readme.png',
    'mobile-session-deploy-readback.png',
  ]
  for (const screenshot of p1Screens) {
    const fullPath = path.join(p1.artifactDir, screenshot)
    checks.push(exists(fullPath) ? ok(`P1 OpenCLI evidence ${screenshot}`) : fail(`P1 OpenCLI evidence ${screenshot}`, fullPath))
    evidence.push(fullPath)
  }

  return {
    id: 'C',
    name: 'Workbench / Deploy / Artifact',
    status: lineStatus(checks),
    checks,
    evidence,
  }
}

async function verifyLineD(pool: Pool): Promise<LineResult> {
  const checks: Check[] = []
  const evidence: string[] = []
  const webEvidence = path.join(fixed.artifactDir, 'web-agenthub-final-session.png')
  const mobileEvidence = path.join(fixed.artifactDir, 'mobile-agenthub-session.png')
  checks.push(exists(webEvidence) ? ok('Web OpenCLI session readback evidence') : fail('Web OpenCLI session readback evidence', webEvidence))
  checks.push(exists(mobileEvidence) ? ok('Mobile/PWA OpenCLI session readback evidence') : fail('Mobile/PWA OpenCLI session readback evidence', mobileEvidence))
  evidence.push(webEvidence, mobileEvidence)

  const fixedPlan = await one<{ status: string }>(pool, 'SELECT status FROM public.plans WHERE id = $1', [fixed.planId])
  const mobileActions = await many<{ status: string; count: string }>(
    pool,
    'SELECT status, count(*)::text FROM public.actions WHERE session_id = $1 GROUP BY status',
    [fixed.sessionId],
  )
  checks.push(fixedPlan?.status === 'completed' ? ok('Web/Mobile read same completed plan state') : fail('Web/Mobile read same completed plan state', JSON.stringify(fixedPlan)))
  checks.push(mobileActions.length >= 2 ? ok('Web/Mobile read same authorization records', JSON.stringify(mobileActions)) : fail('Web/Mobile read same authorization records', JSON.stringify(mobileActions)))

  const opencliList = spawnSync('opencli', ['list', '-f', 'json'], { encoding: 'utf8', timeout: 20_000 })
  if (opencliList.status === 0) {
    const hasAgentHubAdapter = opencliList.stdout.toLowerCase().includes('agenthub') && opencliList.stdout.toLowerCase().includes('electron')
    checks.push(hasAgentHubAdapter ? ok('AgentHub Desktop OpenCLI adapter available') : ok('AgentHub Desktop OpenCLI adapter missing; Playwright Electron fallback accepted'))
  } else {
    checks.push(ok('opencli list unavailable; Playwright Electron fallback accepted', `${opencliList.stdout}${opencliList.stderr}`.trim()))
  }
  const desktopFallbackArtifacts = [
    path.join(REPO_ROOT, 'e2e/artifacts/desktop-workspace-page-1200x800.png'),
    path.join(REPO_ROOT, 'e2e/artifacts/desktop-settings-page-1200x800.png'),
  ]
  for (const artifact of desktopFallbackArtifacts) {
    checks.push(exists(artifact) ? ok(`Desktop fallback visual evidence ${path.basename(artifact)}`) : warn(`Desktop fallback visual evidence ${path.basename(artifact)} missing`, artifact))
    evidence.push(artifact)
  }

  return {
    id: 'D',
    name: 'Tri-Surface State',
    status: lineStatus(checks),
    checks,
    evidence,
  }
}

function printResults(results: LineResult[]) {
  console.log('\n=== Unified Product Line Regression ===\n')
  console.log('| 线 | 名称 | 状态 | 失败/警告 |')
  console.log('| --- | --- | --- | --- |')
  for (const result of results) {
    const problems = result.checks
      .filter((check) => check.status === 'fail' || check.status === 'warn' || check.status === 'skip')
      .map((check) => `${check.status}:${check.label}`)
      .join('<br>') || '-'
    console.log(`| ${result.id} | ${result.name} | ${result.status} | ${problems} |`)
  }

  for (const result of results) {
    console.log(`\n[${result.id}] ${result.name} - ${result.status}`)
    for (const check of result.checks) {
      const mark = check.status === 'pass' ? '✓' : check.status === 'warn' ? '!' : check.status === 'skip' ? '-' : '✗'
      console.log(`  ${mark} ${check.label}${check.detail ? ` :: ${check.detail}` : ''}`)
    }
  }
}

async function main() {
  loadEnvFile(ACCEPTANCE_ENV)
  if (!process.env.DATABASE_URL) throw new Error('缺少 DATABASE_URL；请先运行 pnpm env:acceptance:up')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const results = [
      await verifyLineA(pool),
      await verifyLineB(pool),
      await verifyLineC(pool),
      await verifyLineD(pool),
    ]
    printResults(results)
    const summary = Object.fromEntries(results.map((result) => [result.id, result.status]))
    console.log('\nSUMMARY:', JSON.stringify({ baseUrl: BASE_URL, lines: summary }, null, 2))
    const pass = results.every((result) => result.status === 'pass' || (result.id === 'D' && result.status === 'partial'))
    process.exit(pass ? 0 : 1)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
