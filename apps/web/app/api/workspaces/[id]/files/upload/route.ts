import path from 'node:path'
import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { writeWorkspaceFile } from '@/lib/workspace/cloud-workspace-fs'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

const MAX_UPLOAD_BYTES = 512 * 1024

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const form = await request.formData()
  const file = form.get('file')
  const targetDir = String(form.get('target_dir') ?? '').replace(/^\/+/, '').replace(/\/+$/, '')
  if (!(file instanceof File)) return NextResponse.json({ error: '缺少上传文件' }, { status: 400 })
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: '上传文件不能超过 512KB' }, { status: 413 })

  const db = await createClient()
  const owned = await loadOwnedWorkspace(db, id, user)
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status })
  const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
  if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })

  const safeName = path.basename(file.name).replace(/["\r\n/\\]/g, '_')
  const relativePath = targetDir ? `${targetDir}/${safeName}` : safeName
  const bytes = Buffer.from(await file.arrayBuffer())
  try {
    const writtenPath = await writeWorkspaceFile(cloud.root, relativePath, bytes)
    return NextResponse.json({ path: writtenPath, size: file.size, name: safeName }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '上传失败' }, { status: 400 })
  }
}
