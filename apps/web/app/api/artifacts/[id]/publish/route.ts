import { spawn, type ChildProcess } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { once } from 'node:events'
import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { createWorkspaceArtifactLaunchScript } from '@/lib/workspace/cloud-workspace-fs'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

const RUNNABLE_ARTIFACT_TYPES = new Set(['html', 'folder', 'generic_file', 'code'])

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

function stopPublish(artifactId: string, metadata: Record<string, unknown> | null | undefined) {
  const current = publishRegistry.get(artifactId)
  if (current) {
    current.process.kill('SIGTERM')
    publishRegistry.delete(artifactId)
    return current.pid
  }
  const storedPid = typeof metadata?.publishPid === 'number' ? metadata.publishPid : null
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

async function artifactRow(db: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await db
    .from('artifacts')
    .select('*')
    .eq('id', id)
    .single()
  return data as unknown as {
    id: string
    workspace_id: string
    source_path?: string | null
    artifact_type?: string | null
    metadata?: Record<string, unknown> | null
  } | null
}

function packageScriptFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  const script = typeof metadata?.packageScript === 'string' ? metadata.packageScript.trim() : ''
  return script || null
}

function startCommandFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  const command = typeof metadata?.startCommand === 'string' ? metadata.startCommand.trim() : ''
  return command || null
}

function artifactLaunchSource(row: { source_path?: string | null; metadata?: Record<string, unknown> | null }) {
  const startCommand = startCommandFromMetadata(row.metadata)
  const packageScript = packageScriptFromMetadata(row.metadata)
  if (startCommand) return { sourcePath: row.source_path ?? 'package.json', startCommand, packageScript }
  if (packageScript) return { sourcePath: row.source_path ?? 'package.json', packageScript }
  if (row.source_path) return row.source_path
  return null
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await req.json().catch(() => ({})) as { action?: string }
  const action = body.action === 'stop' ? 'stop' : 'start'
  const db = await createClient()
  const row = await artifactRow(db, id)
  if (!row) return NextResponse.json({ error: '产物不存在' }, { status: 404 })

  const owned = await loadOwnedWorkspace(db, row.workspace_id, user)
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status })
  const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
  if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })

  if (action === 'stop') {
    const stoppedPid = stopPublish(row.id, row.metadata)
    await db.from('artifacts').update({
      metadata: {
        ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
        publishStatus: 'stopped',
        publishPid: null,
        publishStoppedAt: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    return NextResponse.json({ status: 'stopped', pid: stoppedPid })
  }

  const launchSource = artifactLaunchSource(row)
  if (!launchSource) return NextResponse.json({ error: '产物缺少来源文件或启动脚本，无法发布' }, { status: 400 })
  if (!RUNNABLE_ARTIFACT_TYPES.has(row.artifact_type ?? '')) {
    return NextResponse.json({ error: '该产物类型不支持发布' }, { status: 409 })
  }

  const current = publishRegistry.get(row.id)
  if (current && current.process.exitCode === null) {
    return NextResponse.json({ status: 'running', url: current.url, pid: current.pid, port: current.port })
  }

  try {
    const workspaceRoot = path.resolve(cloud.root)
    const launch = await createWorkspaceArtifactLaunchScript(workspaceRoot, row.id, launchSource)
    const port = await freePort()
    const scriptFullPath = path.resolve(workspaceRoot, launch.scriptPath)
    if (!scriptFullPath.startsWith(`${workspaceRoot}${path.sep}`)) {
      return NextResponse.json({ error: '启动脚本路径超出工作区范围' }, { status: 400 })
    }
    const child = spawn('bash', [scriptFullPath], {
      cwd: workspaceRoot,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'ignore', 'ignore'],
    })
    const url = `http://127.0.0.1:${port}`
    const startedAt = new Date().toISOString()
    const record: PublishRecord = {
      artifactId: row.id,
      pid: child.pid ?? 0,
      port,
      url,
      process: child,
      startedAt,
    }
    publishRegistry.set(row.id, record)
    child.once('exit', () => {
      const currentRecord = publishRegistry.get(row.id)
      if (currentRecord?.process === child) publishRegistry.delete(row.id)
    })

    const ready = await waitForHttp(url)
    if (!ready) {
      child.kill('SIGTERM')
      publishRegistry.delete(row.id)
      return NextResponse.json({ error: '发布服务启动超时' }, { status: 504 })
    }

    const metadata = {
      ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
      startScriptPath: launch.scriptPath,
      startCommand: launch.startCommand ?? startCommandFromMetadata(row.metadata) ?? launch.command,
      launchCommand: launch.command,
      launchSourcePath: launch.sourcePath,
      ...(launch.packageScript ? { packageScript: launch.packageScript, publishKind: 'package_script' } : {}),
      publishStatus: 'running',
      publishUrl: url,
      publishPid: child.pid ?? null,
      publishPort: port,
      publishStartedAt: startedAt,
    }
    const { data, error } = await db
      .from('artifacts')
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ status: 'running', url, pid: child.pid ?? null, port, artifact: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '发布失败' }, { status: 400 })
  }
}
