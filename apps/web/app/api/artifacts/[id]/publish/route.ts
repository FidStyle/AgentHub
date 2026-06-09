import {
  artifactLaunchSource,
  artifactRow,
  persistPublishStatusMessage,
  RUNNABLE_ARTIFACT_TYPES,
  startArtifactPublish,
  stopArtifactPublish,
} from '@/lib/artifacts/publish-service'
import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

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
    const stoppedPid = stopArtifactPublish(row)
    const stoppedAt = new Date().toISOString()
    await db.from('artifacts').update({
      metadata: {
        ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
        publishStatus: 'stopped',
        publishUrl: null,
        publishPid: null,
        publishError: null,
        publishStoppedAt: stoppedAt,
      },
      updated_at: stoppedAt,
    }).eq('id', row.id)
    await persistPublishStatusMessage({
      db,
      row,
      status: 'stopped',
      stoppedAt,
      message: stoppedPid ? `已停止发布进程 PID ${stoppedPid}。` : '已记录停止发布；未发现正在运行的发布进程。',
    })
    return NextResponse.json({ status: 'stopped', pid: stoppedPid, stoppedAt })
  }

  if (!artifactLaunchSource(row)) return NextResponse.json({ error: '产物缺少来源文件或启动脚本，无法发布' }, { status: 400 })
  if (!RUNNABLE_ARTIFACT_TYPES.has(row.artifact_type ?? '')) {
    return NextResponse.json({ error: '该产物类型不支持发布' }, { status: 409 })
  }

  try {
    const result = await startArtifactPublish({
      db,
      row,
      workspaceRoot: cloud.root,
      persistMessage: true,
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : '发布失败'
    const failedAt = new Date().toISOString()
    await db.from('artifacts').update({
      metadata: {
        ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
        publishStatus: 'failed',
        publishPid: null,
        publishUrl: null,
        publishError: message,
        publishFailedAt: failedAt,
      },
      updated_at: failedAt,
    }).eq('id', row.id)
    await persistPublishStatusMessage({
      db,
      row,
      status: 'failed',
      error: message,
      message,
    })
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
