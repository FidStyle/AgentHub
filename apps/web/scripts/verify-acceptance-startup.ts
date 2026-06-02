import { createClient } from '@/lib/app-db-client'
import { detectCliRuntimeCapabilities } from '@/lib/runtime/executor'

type RoleAgent = {
  workspace_id: string
  name: string
  runtime_type: 'claude_code' | 'codex'
}

function assertEnv(name: string) {
  if (!process.env[name]) throw new Error(`缺少 ${name}，不能启动可用后端服务。`)
}

async function assertRoleBootstrap() {
  const db = await createClient()
  const { data, error } = await db
    .from('role_agents')
    .select('workspace_id, name, runtime_type')

  if (error) throw new Error(`检查默认角色失败：${error.message}`)
  const rows = (data ?? []) as unknown as RoleAgent[]
  const byWorkspace = new Map<string, RoleAgent[]>()
  for (const row of rows) {
    byWorkspace.set(row.workspace_id, [...(byWorkspace.get(row.workspace_id) ?? []), row])
  }

  const failures: string[] = []
  for (const [workspaceId, roles] of byWorkspace) {
    const architect = roles.find((role) => role.name === '架构师')
    const frontend = roles.find((role) => role.name === '前端工程师')
    const backend = roles.find((role) => role.name === '后端工程师')
    if (architect?.runtime_type !== 'claude_code') failures.push(`${workspaceId}: 架构师 必须绑定 Claude Code`)
    if (frontend?.runtime_type !== 'claude_code') failures.push(`${workspaceId}: 前端工程师 必须绑定 Claude Code`)
    if (backend?.runtime_type !== 'codex') failures.push(`${workspaceId}: 后端工程师 必须绑定 Codex`)
  }

  if (failures.length > 0) {
    throw new Error(['默认角色启动门禁失败：', ...failures].join('\n'))
  }
}

async function main() {
  assertEnv('DATABASE_URL')
  assertEnv('REDIS_URL')
  assertEnv('AUTH_SECRET')

  const capabilities = detectCliRuntimeCapabilities()
  const failures = capabilities
    .filter((runtime) => runtime.type === 'claude_code' || runtime.type === 'codex')
    .filter((runtime) => !runtime.available || !runtime.authenticated || !runtime.launchable)
    .map((runtime) => `${runtime.type}: ${runtime.diagnostic ?? 'not launchable'}`)

  if (failures.length > 0) {
    throw new Error([
      '本机 Claude Code / Codex Runtime 未全部连接成功，后端服务不应启动：',
      ...failures,
      '请先在本机完成 claude auth login 和 codex login，再重新启动。',
    ].join('\n'))
  }

  await assertRoleBootstrap()

  console.log('=== Acceptance startup preflight PASS ===')
  for (const runtime of capabilities) {
    console.log(`${runtime.type}: ${runtime.version ?? 'unknown version'} (${runtime.cliPath ?? 'unknown path'})`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
