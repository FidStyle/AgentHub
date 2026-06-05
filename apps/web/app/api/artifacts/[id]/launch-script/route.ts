import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { createWorkspaceArtifactLaunchScript } from '@/lib/workspace/cloud-workspace-fs'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

const RUNNABLE_ARTIFACT_TYPES = new Set(['html', 'folder', 'generic_file', 'code'])

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
  if (!row.source_path) return NextResponse.json({ error: '产物缺少来源文件，无法生成启动脚本' }, { status: 400 })
  if (!RUNNABLE_ARTIFACT_TYPES.has(row.artifact_type ?? '')) {
    return NextResponse.json({ error: '该产物类型不支持启动脚本' }, { status: 409 })
  }

  const owned = await loadOwnedWorkspace(db, row.workspace_id, user)
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status })
  const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
  if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })

  try {
    const launch = await createWorkspaceArtifactLaunchScript(cloud.root, row.id, row.source_path)
    const metadata = {
      ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
      startScriptPath: launch.scriptPath,
      startCommand: launch.command,
      launchSourcePath: launch.sourcePath,
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
