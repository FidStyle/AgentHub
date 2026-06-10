import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'

const RUNTIME_PERMISSION_MODES = new Set(['standard', 'sandbox', 'auto', 'full_control', 'dangerous_bypass'])

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  // The local Postgres query client builds raw SQL and does not support PostgREST embedded
  // selects, so ownership is verified with a separate workspace lookup (same pattern as
  // /api/messages) instead of a `workspaces!inner(...)` join.
  const { data, error } = await db
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: '会话不存在' }, { status: 404 })

  const { data: ws } = await db
    .from('workspaces')
    .select('id')
    .eq('id', (data as unknown as { workspace_id: string }).workspace_id)
    .eq('owner_id', user.id)
    .single()
  if (!ws) return NextResponse.json({ error: '无权限' }, { status: 403 })

  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { name, status, is_pinned, runtime_permission_mode } = body

  if (status && !['active', 'archived'].includes(status)) {
    return NextResponse.json({ error: '无效的会话状态' }, { status: 400 })
  }
  if (runtime_permission_mode !== undefined && runtime_permission_mode !== null) {
    if (typeof runtime_permission_mode !== 'string' || !RUNTIME_PERMISSION_MODES.has(runtime_permission_mode)) {
      return NextResponse.json({ error: '无效的权限模式' }, { status: 400 })
    }
  }

  const { data: session } = await db
    .from('sessions')
    .select('workspace_id, metadata')
    .eq('id', id)
    .single()
  if (!session) return NextResponse.json({ error: '会话不存在' }, { status: 404 })

  const { data: ws } = await db
    .from('workspaces')
    .select('id')
    .eq('id', session.workspace_id)
    .eq('owner_id', user.id)
    .single()
  if (!ws) return NextResponse.json({ error: '无权限' }, { status: 403 })

  const now = new Date().toISOString()
  const update: Record<string, unknown> = { updated_at: now, last_activity_at: now }
  if (name) update.name = name
  if (status) update.status = status
  if (typeof is_pinned === 'boolean') {
    update.is_pinned = is_pinned
    update.pinned_at = is_pinned ? now : null
  }
  if (runtime_permission_mode !== undefined) {
    const metadata = metadataRecord((session as { metadata?: unknown }).metadata)
    if (runtime_permission_mode === null) {
      delete metadata.runtimePermissionMode
      delete metadata.runtime_permission_mode
    } else {
      metadata.runtimePermissionMode = runtime_permission_mode
      metadata.runtime_permission_mode = runtime_permission_mode
    }
    update.metadata = metadata
  }

  const { data, error } = await db
    .from('sessions')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { data: session } = await db
    .from('sessions')
    .select('workspace_id')
    .eq('id', id)
    .single()
  if (!session) return NextResponse.json({ error: '会话不存在' }, { status: 404 })

  const { data: ws } = await db
    .from('workspaces')
    .select('id')
    .eq('id', session.workspace_id)
    .eq('owner_id', user.id)
    .single()
  if (!ws) return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { error } = await db
    .from('sessions')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
