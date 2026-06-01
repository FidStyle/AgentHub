import { FullConfig } from '@playwright/test'
import { spawn, ChildProcess } from 'child_process'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'

let webProcess: ChildProcess | null = null
let runtimeWorker: ChildProcess | null = null

const WEB_PORT = 3000

function waitForServer(url: string, timeout = 20000): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const check = () => {
      fetch(url).then((r) => {
        if (r.ok || r.status < 500) resolve()
        else if (Date.now() - start > timeout) reject(new Error(`Timeout waiting for ${url}`))
        else setTimeout(check, 500)
      }).catch(() => {
        if (Date.now() - start > timeout) reject(new Error(`Timeout waiting for ${url}`))
        else setTimeout(check, 500)
      })
    }
    check()
  })
}

// Poll Redis (via the runtime redis container) for the worker presence key the runtime-worker sets
// each loop. Fail-loud on timeout — a missing worker would make the reply E2E silently fall into the
// unavailable path.
async function waitForWorkerAlive(timeout = 30000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const out = execFileSync(
        'docker',
        ['exec', '-i', 'agenthub_runtime_redis', 'redis-cli', 'EXISTS', 'agenthub:runtime:worker:alive'],
        { encoding: 'utf8' },
      ).trim()
      if (out === '1') return
    } catch {
      // container not ready yet; retry
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('Timeout waiting for runtime worker presence key (agenthub:runtime:worker:alive)')
}

async function globalSetup(_config: FullConfig) {
  const rootDir = path.resolve(__dirname, '..')
  execFileSync('pnpm', ['env:p0:db:up'], { cwd: rootDir, stdio: 'inherit' })
  execFileSync('pnpm', ['env:p0:seed:fixture'], { cwd: rootDir, stdio: 'inherit' })

  const envFile = path.join(rootDir, 'docker/.p0-test.env')
  const seededEnv = Object.fromEntries(
    fs.readFileSync(envFile, 'utf8')
      .split('\n')
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index), line.slice(index + 1)]
      }),
  )

  // Real runtime reply path (RUNTIME_E2E=1): bring up Redis + a worker (ScriptedRealExecutor) wired
  // to the same p0 DB, and expose REDIS_URL to the web server so the public_cloud gateway enqueues
  // jobs the worker consumes. ScriptedRealExecutor returns a fixed non-echo reply (NOT the prompt),
  // so a visible reply proves the enqueue→worker→DB delivery path — FakeExecutor's echo would not.
  const runtimeEnv: Record<string, string> = {}
  if (process.env.RUNTIME_E2E === '1') {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
    execFileSync(
      'docker',
      ['compose', '-f', 'docker/docker-compose.runtime.yml', 'up', '-d', 'redis'],
      { cwd: rootDir, stdio: 'inherit' },
    )
    runtimeEnv.REDIS_URL = redisUrl
    runtimeWorker = spawn('pnpm', ['--filter', '@agenthub/web', 'exec', 'tsx', 'server/runtime-worker.ts'], {
      cwd: rootDir,
      env: { ...process.env, ...seededEnv, REDIS_URL: redisUrl, RUNTIME_EXECUTOR: 'script' },
      stdio: 'pipe',
    })
    runtimeWorker.stdout?.on('data', (d) => process.stdout.write(d))
    runtimeWorker.stderr?.on('data', (d) => process.stderr.write(d))
    ;(globalThis as any).__E2E_RUNTIME_WORKER = runtimeWorker

    // The reply path requires a configured, available public_cloud endpoint for the test user —
    // resolveEndpoint returns {id:null,status:'unconfigured'} otherwise and the gateway short-circuits
    // before enqueueing. Seed one idempotently (via the p0 postgres container) so the worker
    // actually receives the job.
    const testUserId = seededEnv.TEST_USER_ID ?? process.env.TEST_USER_ID
    if (testUserId) {
      const pgUser = seededEnv.POSTGRES_USER ?? 'agenthub'
      const pgDb = seededEnv.POSTGRES_DB ?? 'agenthub_p0_test'
      const sql = `INSERT INTO public.runtime_endpoints (user_id, kind, runtime_type, status)
        SELECT '${testUserId}', 'public_cloud', 'hosted', 'available'
        WHERE NOT EXISTS (SELECT 1 FROM public.runtime_endpoints WHERE user_id = '${testUserId}' AND kind = 'public_cloud');
        UPDATE public.runtime_endpoints SET status = 'available' WHERE user_id = '${testUserId}' AND kind = 'public_cloud';`
      execFileSync(
        'docker',
        ['exec', '-i', 'agenthub_p0_postgres', 'psql', '-U', pgUser, '-d', pgDb, '-c', sql],
        { cwd: rootDir, stdio: 'inherit' },
      )
    }

    // Wait until the worker has registered its presence key, so the gateway's isWorkerAlive() gate
    // passes deterministically when the first message is sent (the worker boots async via tsx).
    await waitForWorkerAlive()
  } else if (process.env.RUNTIME_E2E_NOWORKER === '1') {
    // No-worker error path: bring up Redis and expose REDIS_URL to the web server, but spawn NO
    // worker. The gateway's worker-presence gate (isWorkerAlive) must then short-circuit to an
    // immediate Chinese error instead of hanging 60s on an empty queue. Validates REG-20260530-006
    // fix: "REDIS_URL 存在但无 worker 时不得空等 60s".
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
    execFileSync(
      'docker',
      ['compose', '-f', 'docker/docker-compose.runtime.yml', 'up', '-d', 'redis'],
      { cwd: rootDir, stdio: 'inherit' },
    )
    execFileSync(
      'docker',
      ['exec', '-i', 'agenthub_runtime_redis', 'redis-cli', 'DEL', 'agenthub:runtime:worker:alive'],
      { cwd: rootDir, stdio: 'inherit' },
    )
    runtimeEnv.REDIS_URL = redisUrl
  }

  webProcess = spawn('pnpm', ['dev:web'], {
    cwd: rootDir,
    env: {
      ...process.env,
      ...seededEnv,
      ...runtimeEnv,
      PORT: String(WEB_PORT),
    },
    stdio: 'pipe',
  })

  webProcess.stdout?.on('data', (d) => process.stdout.write(d))
  webProcess.stderr?.on('data', (d) => process.stderr.write(d))

  await waitForServer(`http://localhost:${WEB_PORT}`)

  ;(globalThis as any).__E2E_WEB_PROCESS = webProcess
}

export default globalSetup
