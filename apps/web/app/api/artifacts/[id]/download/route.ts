import { createClient } from '@/lib/app-db-client'
import { createDocxBuffer, createPptxBuffer } from '@/lib/artifacts/rich-artifact-export'
import { parsePresentationDeck } from '@/lib/artifacts/rich-artifacts'
import { requireAuth } from '@/lib/auth-guard'
import { resolveWorkspacePath } from '@/lib/workspace/cloud-workspace-fs'
import { loadCloudWorkspaceRoot } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

function downloadName(title: string, type: string) {
  const ext = type === 'folder' ? 'json' : type === 'html' ? 'html' : type === 'markdown' ? 'md' : type === 'document' ? 'docx' : type === 'presentation' ? 'pptx' : type === 'diff' ? 'patch' : 'txt'
  return `${title || 'artifact'}.${ext}`.replace(/["\r\n/\\]/g, '_')
}

function contentDisposition(title: string, type: string) {
  const name = downloadName(title, type)
  const ext = name.split('.').pop() || 'txt'
  return `attachment; filename="artifact.${ext}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const db = await createClient()
  const { data: artifact } = await db.from('artifacts').select('*').eq('id', id).single()
  if (!artifact) return NextResponse.json({ error: '产物不存在' }, { status: 404 })
  const row = artifact as unknown as { workspace_id: string; title: string; artifact_type: string; source_path?: string | null; content?: string | null; metadata?: Record<string, unknown> | null }
  const { data: workspace } = await db
    .from('workspaces')
    .select('id, name, execution_domain, cloud_project_dir')
    .eq('id', row.workspace_id)
    .eq('owner_id', user.id)
    .single()
  if (!workspace) return NextResponse.json({ error: '产物不存在' }, { status: 404 })

  if (row.artifact_type === 'document' && row.source_path) {
    const cloud = await loadCloudWorkspaceRoot(db, workspace as never, user)
    if (cloud.ok) {
      const { readFile, stat } = await import('node:fs/promises')
      const target = resolveWorkspacePath(cloud.root, row.source_path)
      const info = await stat(target.fullPath).catch(() => null)
      if (info?.isFile()) {
        return new Response(await readFile(target.fullPath), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': contentDisposition(row.title, row.artifact_type),
          },
        })
      }
    }
  }
  if (row.artifact_type === 'document') {
    return new Response(createDocxBuffer(row.title, row.content ?? ''), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': contentDisposition(row.title, row.artifact_type),
      },
    })
  }
  if (row.artifact_type === 'presentation') {
    if (row.source_path) {
      const cloud = await loadCloudWorkspaceRoot(db, workspace as never, user)
      if (cloud.ok) {
        const { readFile, stat } = await import('node:fs/promises')
        const target = resolveWorkspacePath(cloud.root, row.source_path)
        const info = await stat(target.fullPath).catch(() => null)
        if (info?.isFile()) {
          return new Response(await readFile(target.fullPath), {
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              'Content-Disposition': contentDisposition(row.title, row.artifact_type),
            },
          })
        }
      }
    }
    return new Response(createPptxBuffer(parsePresentationDeck(row.content, row.title)), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': contentDisposition(row.title, row.artifact_type),
      },
    })
  }

  const body = row.artifact_type === 'folder'
    ? JSON.stringify(row.metadata?.manifest ?? {}, null, 2)
    : row.content ?? JSON.stringify(row.metadata ?? {}, null, 2)
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': contentDisposition(row.title, row.artifact_type),
    },
  })
}
