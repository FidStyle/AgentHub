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

  // Real runtime reply path (RUNTIME_E2E=1): bring up Redis + a worker (FakeExecutor) wired to
  // the same p0 DB, and expose REDIS_URL to the web server so the public_cloud gateway enqueues
  // jobs the worker consumes. Without this the agent-reply spec self-skips.
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
      env: { ...process.env, ...seededEnv, REDIS_URL: redisUrl },
      stdio: 'pipe',
    })
    runtimeWorker.stdout?.on('data', (d) => process.stdout.write(d))
    runtimeWorker.stderr?.on('data', (d) => process.stderr.write(d))
    ;(globalThis as any).__E2E_RUNTIME_WORKER = runtimeWorker
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
