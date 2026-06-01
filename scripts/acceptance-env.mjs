#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { spawn } from 'child_process'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)
const envFile = resolve(repoRoot, 'docker/.acceptance.env')
const legacyEnvFile = resolve(repoRoot, 'docker/.p0-test.env')

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

async function up() {
  await run('docker', ['compose', '-f', 'docker/docker-compose.p0-test.yml', 'up', '-d', 'postgres'])
  await run('docker', ['compose', '-f', 'docker/docker-compose.runtime.yml', 'up', '-d', 'redis'])
  await run('pnpm', ['env:acceptance:seed'], { env: { ACCEPTANCE_CREATE_GITHUB_FIXTURE: 'true' } })
  console.log('\n验收基础环境已准备：Postgres、Redis、测试 Auth session。')
  console.log('环境文件：docker/.acceptance.env')
  console.log('启动 Web + runtime worker：pnpm dev:acceptance')
  console.log('另开终端运行 smoke：pnpm env:acceptance:smoke')
}

async function down() {
  await run('docker', ['compose', '-f', 'docker/docker-compose.runtime.yml', 'down'])
  await run('docker', ['compose', '-f', 'docker/docker-compose.p0-test.yml', 'down'])
}

async function smoke() {
  const fileEnv = { ...parseEnvFile(legacyEnvFile), ...parseEnvFile(envFile) }
  const env = { ...process.env, ...fileEnv }
  if (!env.TEST_AUTH_COOKIE) {
    throw new Error('缺少 TEST_AUTH_COOKIE。请先运行 pnpm env:acceptance:up 生成测试 session。')
  }
  await run('pnpm', ['--filter', '@agenthub/web', 'exec', 'tsx', 'scripts/verify-acceptance-api-crud.ts'], { env })
  await run('pnpm', ['--filter', '@agenthub/web', 'exec', 'tsx', 'scripts/verify-acceptance-chat-api.ts'], {
    env: {
      ...env,
      REDIS_URL: env.REDIS_URL ?? 'redis://localhost:6379',
    },
  })
}

async function dev() {
  await up()
  const fileEnv = { ...parseEnvFile(legacyEnvFile), ...parseEnvFile(envFile) }
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
