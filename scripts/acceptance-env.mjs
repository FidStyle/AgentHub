#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { spawn } from 'child_process'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)
const envFile = resolve(repoRoot, 'docker/.acceptance.env')

function parseEnvFile(file) {
  if (!existsSync(file)) return {}
  const env = {}
  for (const rawLine of readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf('=')
    if (index === -1) continue
    env[line.slice(0, index)] = line.slice(index + 1)
  }
  return env
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false,
      env: { ...process.env, ...options.env },
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolveRun()
      else reject(new Error(`${command} ${args.join(' ')} exited ${code}`))
    })
  })
}

function spawnLong(command, args, env) {
  return spawn(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
    env,
  })
}

function spawnQuiet(command, args, env) {
  return spawn(command, args, {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env,
  })
}

async function waitForServer(url, timeout = 30000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (response.ok || response.status < 500) return true
    } catch {
      // Retry until timeout.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500))
  }
  return false
}

async function waitForContainerHealthy(containerName, timeout = 30000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const output = await new Promise((resolveInspect, rejectInspect) => {
        const child = spawn('docker', ['inspect', '-f', '{{.State.Health.Status}}', containerName], {
          cwd: repoRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
        })
        let stdout = ''
        let stderr = ''
        child.stdout?.on('data', (chunk) => { stdout += chunk.toString() })
        child.stderr?.on('data', (chunk) => { stderr += chunk.toString() })
        child.on('error', rejectInspect)
        child.on('exit', (code) => {
          if (code === 0) resolveInspect(stdout.trim())
          else rejectInspect(new Error(stderr.trim() || `docker inspect ${containerName} exited ${code}`))
        })
      })
      if (output === 'healthy') return
    } catch {
      // Retry until timeout.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500))
  }
  throw new Error(`${containerName} 未在 ${timeout}ms 内变为 healthy`)
}

async function up() {
  await run('docker', ['compose', '-p', 'agenthub_acceptance', '-f', 'docker/docker-compose.acceptance.yml', 'up', '-d', 'postgres'])
  await waitForContainerHealthy('agenthub_acceptance_postgres')
  await run('docker', ['compose', '-p', 'agenthub_runtime', '-f', 'docker/docker-compose.runtime.yml', 'up', '-d', 'redis'])
  await run('pnpm', ['env:acceptance:seed'], { env: { ACCEPTANCE_CREATE_GITHUB_FIXTURE: 'true' } })
  console.log('\n验收基础环境已准备：Postgres、Redis、测试 Auth session。')
  console.log('环境文件：docker/.acceptance.env')
  console.log('启动 Web + runtime worker：pnpm dev:acceptance')
  console.log('另开终端运行 smoke：pnpm env:acceptance:smoke')
}

async function down() {
  await run('docker', ['compose', '-p', 'agenthub_runtime', '-f', 'docker/docker-compose.runtime.yml', 'down'])
  await run('docker', ['compose', '-p', 'agenthub_acceptance', '-f', 'docker/docker-compose.acceptance.yml', 'down'])
}

async function smoke() {
  const fileEnv = parseEnvFile(envFile)
  const env = { ...process.env, ...fileEnv }
  if (!env.TEST_AUTH_COOKIE) {
    throw new Error('缺少 TEST_AUTH_COOKIE。请先运行 pnpm env:acceptance:up 生成测试 session。')
  }
  const baseUrl = env.BASE_URL ?? 'http://localhost:3000'
  let web = null
  if (!(await waitForServer(baseUrl, 1000))) {
    web = spawnQuiet('pnpm', ['--filter', '@agenthub/web', 'exec', 'tsx', 'server.ts'], env)
    if (!(await waitForServer(baseUrl))) {
      web.kill('SIGTERM')
      throw new Error(`Web 服务未就绪：${baseUrl}`)
    }
  }
  try {
    await run('pnpm', ['--filter', '@agenthub/web', 'exec', 'tsx', 'scripts/verify-acceptance-api-crud.ts'], { env })
    await run('pnpm', ['--filter', '@agenthub/web', 'exec', 'tsx', 'scripts/verify-acceptance-chat-api.ts'], {
      env: {
        ...env,
        REDIS_URL: env.REDIS_URL ?? 'redis://localhost:6379',
      },
    })
  } finally {
    if (web) web.kill('SIGTERM')
  }
}

async function dev() {
  await up()
  const fileEnv = parseEnvFile(envFile)
  const env = {
    ...process.env,
    ...fileEnv,
    REDIS_URL: process.env.REDIS_URL ?? fileEnv.REDIS_URL ?? 'redis://localhost:6379',
    RUNTIME_EXECUTOR: process.env.RUNTIME_EXECUTOR ?? 'real',
  }

  const worker = spawnLong('pnpm', ['--filter', '@agenthub/web', 'exec', 'tsx', 'server/runtime-worker.ts'], env)
  const web = spawnLong('pnpm', ['dev:web'], env)

  const shutdown = () => {
    worker.kill('SIGTERM')
    web.kill('SIGTERM')
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await new Promise((resolveDev, reject) => {
    let settled = false
    const finish = (name, code) => {
      if (settled) return
      settled = true
      shutdown()
      if (code === 0 || code === null) resolveDev()
      else reject(new Error(`${name} exited ${code}`))
    }
    worker.on('exit', (code) => finish('runtime worker', code))
    web.on('exit', (code) => finish('web server', code))
  })
}

const command = process.argv[2]

try {
  if (command === 'up') await up()
  else if (command === 'down') await down()
  else if (command === 'smoke') await smoke()
  else if (command === 'dev') await dev()
  else {
    console.error('用法: node scripts/acceptance-env.mjs <up|down|dev|smoke>')
    process.exit(2)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
