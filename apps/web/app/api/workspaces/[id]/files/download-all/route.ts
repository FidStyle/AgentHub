import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { createWorkspaceZip, ensureWorkspaceGitignore } from '@/lib/workspace/cloud-workspace-fs'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

function slugify(value: string, fallback: string) {
  const slug = value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || fallback
}

function contentDisposition(name: string, fallback: string) {
  const asciiName = `${slugify(name, fallback)}.zip`
  const utf8Name = `${name.replace(/["\r\n]/g, '_')}.zip`
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const db = await createClient()
  const owned = await loadOwnedWorkspace(db, id, user)
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status })
  const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
  if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })

  try {
    await ensureWorkspaceGitignore(cloud.root)
    const zip = await createWorkspaceZip(cloud.root)
    return new Response(new Uint8Array(zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': contentDisposition(owned.workspace.name || 'workspace', 'workspace'),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '打包下载失败' }, { status: 400 })
  }
}
