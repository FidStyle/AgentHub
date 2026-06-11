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

async function probeHttp(port: number) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}`)
    return response.ok || response.status < 500
  } catch {
    return false
  }
}

// Many Node/Express apps ignore the injected PORT env and listen on a hard-coded port,
// so the publish process may serve on a port we never picked. Walk the spawned process
// tree and list every TCP port it is LISTENing on, so we can discover the real port
// instead of assuming the app honored our requested one.
async function listeningPortsForPid(rootPid: number): Promise<number[]> {
  const pids = await processTreePids(rootPid)
  if (pids.length === 0) return []
  return new Promise((resolve) => {
    const lsof = spawn('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-a', '-p', pids.join(',')], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    let out = ''
    lsof.stdout.on('data', (chunk) => { out += chunk.toString() })
    lsof.on('error', () => resolve([]))
    lsof.on('close', () => {
      const ports = new Set<number>()
      for (const line of out.split('\n')) {
        const match = line.match(/:(\d+)\s+\(LISTEN\)/)
        if (match) ports.add(Number(match[1]))
      }
      resolve([...ports])
    })
  })
}

async function processTreePids(rootPid: number): Promise<number[]> {
  return new Promise((resolve) => {
    const ps = spawn('ps', ['-Ao', 'pid=,ppid='], { stdio: ['ignore', 'pipe', 'ignore'] })
    let out = ''
    ps.stdout.on('data', (chunk) => { out += chunk.toString() })
    ps.on('error', () => resolve([rootPid]))
    ps.on('close', () => {
      const children = new Map<number, number[]>()
      for (const line of out.split('\n')) {
        const [pid, ppid] = line.trim().split(/\s+/).map(Number)
        if (!pid || Number.isNaN(ppid)) continue
        const list = children.get(ppid) ?? []
        list.push(pid)
        children.set(ppid, list)
      }
      const collected: number[] = []
      const stack = [rootPid]
      while (stack.length) {
        const pid = stack.pop()!
        collected.push(pid)
        for (const child of children.get(pid) ?? []) stack.push(child)
      }
      resolve(collected)
    })
  })
}

// Wait until the publish process is reachable over HTTP. Prefer the requested port,
// but discover the actual LISTEN port from the process tree when the app ignored it.
async function waitForPublishPort(rootPid: number, requestedPort: number, timeoutMs = 90_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await probeHttp(requestedPort)) return requestedPort
    for (const port of await listeningPortsForPid(rootPid)) {
      if (port !== requestedPort && await probeHttp(port)) return port
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return null
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
  port?: number
  error?: string
  stoppedAt?: string
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
    port: input.port,
    error: input.error,
    stoppedAt: input.stoppedAt,
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
  const requestedPort = await freePort()
  const scriptFullPath = path.resolve(workspaceRoot, launch.scriptPath)
  if (!scriptFullPath.startsWith(`${workspaceRoot}${path.sep}`)) {
    throw new Error('启动脚本路径超出工作区范围')
  }
  const child = spawn('bash', [scriptFullPath], {
    cwd: workspaceRoot,
    env: { ...process.env, PORT: String(requestedPort) },
    stdio: ['ignore', 'ignore', 'ignore'],
  })
  const startedAt = new Date().toISOString()
  publishRegistry.set(input.row.id, {
    artifactId: input.row.id,
    pid: child.pid ?? 0,
    port: requestedPort,
    url: `http://127.0.0.1:${requestedPort}`,
    process: child,
    startedAt,
  })
  child.once('exit', () => {
    const currentRecord = publishRegistry.get(input.row.id)
    if (currentRecord?.process === child) publishRegistry.delete(input.row.id)
  })

  const port = await waitForPublishPort(child.pid ?? 0, requestedPort)
  if (!port) {
    child.kill('SIGTERM')
    publishRegistry.delete(input.row.id)
    const failedAt = new Date().toISOString()
    await table(input.db, 'artifacts').update({
      metadata: {
        ...(input.row.metadata && typeof input.row.metadata === 'object' ? input.row.metadata : {}),
        publishStatus: 'failed',
        publishUrl: null,
        publishPid: null,
        publishPort: requestedPort,
        publishError: '发布服务启动超时，已终止临时进程。',
        publishFailedAt: failedAt,
      },
      updated_at: failedAt,
    }).eq('id', input.row.id)
    if (input.persistMessage !== false) {
      await persistPublishStatusMessage({
        db: input.db,
        row: input.row,
        status: 'failed',
        port: requestedPort,
        error: '发布服务启动超时',
        message: '发布服务启动超时，已终止临时进程。',
      })
    }
    throw new Error('发布服务启动超时')
  }

  const url = `http://127.0.0.1:${port}`
  const existing = publishRegistry.get(input.row.id)
  if (existing?.process === child) {
    publishRegistry.set(input.row.id, { ...existing, port, url })
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
      port,
      message: `发布已启动，访问地址：${url}`,
    })
  }
  return { status: 'running' as const, url, pid: child.pid ?? null, port, artifact: data }
}
