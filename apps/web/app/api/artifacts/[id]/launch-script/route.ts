import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { createWorkspaceArtifactLaunchScript } from '@/lib/workspace/cloud-workspace-fs'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

const RUNNABLE_ARTIFACT_TYPES = new Set(['html', 'folder', 'generic_file', 'code'])

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

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const db = await createClient()
  const { data: artifact } = await db
    .from('artifacts')
    .select('*')
    .eq('id', id)
    .single()
  if (!artifact) return NextResponse.json({ error: '产物不存在' }, { status: 404 })

  const row = artifact as unknown as {
    id: string
    workspace_id: string
    source_path?: string | null
    artifact_type?: string | null
    metadata?: Record<string, unknown> | null
  }
  const launchSource = artifactLaunchSource(row)
  if (!launchSource) return NextResponse.json({ error: '产物缺少来源文件或启动脚本，无法生成启动脚本' }, { status: 400 })
  if (!RUNNABLE_ARTIFACT_TYPES.has(row.artifact_type ?? '')) {
    return NextResponse.json({ error: '该产物类型不支持启动脚本' }, { status: 409 })
  }

  const owned = await loadOwnedWorkspace(db, row.workspace_id, user)
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status })
  const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
  if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })

  try {
    const launch = await createWorkspaceArtifactLaunchScript(cloud.root, row.id, launchSource)
    const metadata = {
      ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
      startScriptPath: launch.scriptPath,
      startCommand: launch.startCommand ?? startCommandFromMetadata(row.metadata) ?? launch.command,
      launchCommand: launch.command,
      launchSourcePath: launch.sourcePath,
      ...(launch.packageScript ? { packageScript: launch.packageScript, publishKind: 'package_script' } : {}),
      launchGeneratedAt: new Date().toISOString(),
    }
    const { data, error } = await db
      .from('artifacts')
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '生成启动脚本失败' }, { status: 400 })
  }
}
