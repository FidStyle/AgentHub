import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { createWorkspaceFolderZip, mimeForPath, resolveWorkspacePath } from '@/lib/workspace/cloud-workspace-fs'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

function safeDownloadName(value: string, fallback: string) {
  return (path.basename(value) || fallback).replace(/["\r\n]/g, '_')
}

function contentDisposition(value: string, fallback: string) {
  const name = safeDownloadName(value, fallback)
  const asciiName = name.replace(/[^\x20-\x7E]/g, '_') || fallback
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const filePath = new URL(request.url).searchParams.get('path')
  if (!filePath) return NextResponse.json({ error: '缺少 path' }, { status: 400 })

  const db = await createClient()
  const owned = await loadOwnedWorkspace(db, id, user)
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status })
  const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
  if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })

  try {
    const target = resolveWorkspacePath(cloud.root, filePath)
    const info = await import('node:fs/promises').then((fs) => fs.stat(target.fullPath))
    if (info.isDirectory()) {
      const zip = await createWorkspaceFolderZip(cloud.root, target.relativePath)
      const name = `${safeDownloadName(target.relativePath, 'artifact')}.zip`
      return new Response(zip, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': contentDisposition(name, 'artifact.zip'),
        },
      })
    }
    if (!info.isFile()) return NextResponse.json({ error: '仅支持下载普通文件或文件夹' }, { status: 400 })
    const data = await readFile(target.fullPath)
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': mimeForPath(target.relativePath),
        'Content-Disposition': contentDisposition(target.relativePath, 'download'),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '下载失败' }, { status: 400 })
  }
}
