import { spawn, type ChildProcess } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { once } from 'node:events'
import { createWorkspaceArtifactLaunchScript } from '@/lib/workspace/cloud-workspace-fs'
import type { RuntimeMessagePart } from '@agenthub/shared'

export const RUNNABLE_ARTIFACT_TYPES = new Set(['html', 'folder', 'generic_file', 'code'])

type DbClient = {
  from: (table: string) => unknown
}

type DbQuery = {
  select: (...args: unknown[]) => DbQuery
  insert: (values: unknown) => DbQuery
  update: (values: unknown) => DbQuery
  eq: (...args: unknown[]) => DbQuery
  single: () => Promise<{ data?: unknown; error?: { message?: string } | null }> | { data?: unknown; error?: { message?: string } | null }
}

function table(db: DbClient, name: string) {
  return db.from(name) as DbQuery
}

export type PublishArtifactRow = {
  id: string
  workspace_id: string
  session_id?: string | null
  title?: string | null
  source_path?: string | null
  artifact_type?: string | null
  metadata?: Record<string, unknown> | null
}

type PublishRecord = {
  artifactId: string
  pid: number
  port: number
  url: string
  process: ChildProcess
  startedAt: string
}

type PublishRegistry = Map<string, PublishRecord>

const globalForPublish = globalThis as typeof globalThis & {
  __agenthubArtifactPublishes?: PublishRegistry
}

const publishRegistry = globalForPublish.__agenthubArtifactPublishes ?? new Map<string, PublishRecord>()
globalForPublish.__agenthubArtifactPublishes = publishRegistry

async function freePort() {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  server.close()
  await once(server, 'close')
  if (!port) throw new Error('无法分配发布端口')
  return port
}

async function waitForHttp(url: string, timeoutMs = 90_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok || response.status < 500) return true
    } catch {
      // service may still be starting
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

export function packageScriptFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  const script = typeof metadata?.packageScript === 'string' ? metadata.packageScript.trim() : ''
  return script || null
}

export function startCommandFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  const command = typeof metadata?.startCommand === 'string' ? metadata.startCommand.trim() : ''
  return command || null
}

export function artifactLaunchSource(row: { source_path?: string | null; metadata?: Record<string, unknown> | null }) {
  const startCommand = startCommandFromMetadata(row.metadata)
  const packageScript = packageScriptFromMetadata(row.metadata)
  if (startCommand) return { sourcePath: row.source_path ?? 'package.json', startCommand, packageScript }
  if (packageScript) return { sourcePath: row.source_path ?? 'package.json', packageScript }
  if (row.source_path) return row.source_path
  return null
}

export async function artifactRow(db: DbClient, id: string): Promise<PublishArtifactRow | null> {
  const { data } = await table(db, 'artifacts')
    .select('*')
    .eq('id', id)
    .single()
  return data as PublishArtifactRow | null
}

export async function persistPublishStatusMessage(input: {
  db: DbClient
  row: {
    id: string
    session_id?: string | null
    title?: string | null
  }
  status: Extract<RuntimeMessagePart, { type: 'publish_status' }>['status']
  url?: string
  message: string
}) {
  if (!input.row.session_id) return
  const title = input.row.title?.trim() || '产物发布'
  const part: RuntimeMessagePart = {
    id: `publish-${input.row.id}-${Date.now()}`,
    type: 'publish_status',
    status: input.status,
    artifactId: input.row.id,
    title,
    url: input.url,
    message: input.message,
  }
  table(input.db, 'messages').insert({
    session_id: input.row.session_id,
    sender_type: 'system',
    content: `发布状态：${title}\n${input.message}`,
    message_type: 'system_event',
    metadata: {
      visibleStatus: input.status === 'failed' ? '执行失败' : input.status === 'running' ? '执行中' : '已完成',
      artifactId: input.row.id,
      publishStatus: input.status,
      runtimeParts: [part],
    },
  })
}

export function stopArtifactPublish(row: PublishArtifactRow) {
  const current = publishRegistry.get(row.id)
  if (current) {
    current.process.kill('SIGTERM')
    publishRegistry.delete(row.id)
    return current.pid
  }
  const storedPid = typeof row.metadata?.publishPid === 'number' ? row.metadata.publishPid : null
  if (storedPid && Number.isInteger(storedPid) && storedPid > 0) {
    try {
      process.kill(storedPid, 'SIGTERM')
      return storedPid
    } catch {
      return null
    }
  }
  return null
}

export async function startArtifactPublish(input: {
  db: DbClient
  row: PublishArtifactRow
  workspaceRoot: string
  persistMessage?: boolean
}) {
  const launchSource = artifactLaunchSource(input.row)
  if (!launchSource) throw new Error('产物缺少来源文件或启动脚本，无法发布')
  if (!RUNNABLE_ARTIFACT_TYPES.has(input.row.artifact_type ?? '')) {
    throw new Error('该产物类型不支持发布')
  }

  const current = publishRegistry.get(input.row.id)
  if (current && current.process.exitCode === null) {
    return { status: 'running' as const, url: current.url, pid: current.pid, port: current.port, artifact: input.row }
  }

  const workspaceRoot = path.resolve(input.workspaceRoot)
  const launch = await createWorkspaceArtifactLaunchScript(workspaceRoot, input.row.id, launchSource)
  const port = await freePort()
  const scriptFullPath = path.resolve(workspaceRoot, launch.scriptPath)
  if (!scriptFullPath.startsWith(`${workspaceRoot}${path.sep}`)) {
    throw new Error('启动脚本路径超出工作区范围')
  }
  const child = spawn('bash', [scriptFullPath], {
    cwd: workspaceRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'ignore', 'ignore'],
  })
  const url = `http://127.0.0.1:${port}`
  const startedAt = new Date().toISOString()
  publishRegistry.set(input.row.id, {
    artifactId: input.row.id,
    pid: child.pid ?? 0,
    port,
    url,
    process: child,
    startedAt,
  })
  child.once('exit', () => {
    const currentRecord = publishRegistry.get(input.row.id)
    if (currentRecord?.process === child) publishRegistry.delete(input.row.id)
  })

  const ready = await waitForHttp(url)
  if (!ready) {
    child.kill('SIGTERM')
    publishRegistry.delete(input.row.id)
    if (input.persistMessage !== false) {
      await persistPublishStatusMessage({
        db: input.db,
        row: input.row,
        status: 'failed',
        message: '发布服务启动超时，已终止临时进程。',
      })
    }
    throw new Error('发布服务启动超时')
  }

  const metadata = {
    ...(input.row.metadata && typeof input.row.metadata === 'object' ? input.row.metadata : {}),
    startScriptPath: launch.scriptPath,
    startCommand: launch.startCommand ?? startCommandFromMetadata(input.row.metadata) ?? launch.command,
    launchCommand: launch.command,
    launchSourcePath: launch.sourcePath,
    ...(launch.packageScript ? { packageScript: launch.packageScript, publishKind: 'package_script' } : {}),
    publishStatus: 'running',
    publishUrl: url,
    publishPid: child.pid ?? null,
    publishPort: port,
    publishStartedAt: startedAt,
  }
  const { data, error } = await table(input.db, 'artifacts')
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq('id', input.row.id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (input.persistMessage !== false) {
    await persistPublishStatusMessage({
      db: input.db,
      row: input.row,
      status: 'running',
      url,
      message: `发布已启动，访问地址：${url}`,
    })
  }
  return { status: 'running' as const, url, pid: child.pid ?? null, port, artifact: data }
}
