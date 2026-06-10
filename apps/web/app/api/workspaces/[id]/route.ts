import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'
import { removeCloudWorkspaceProject } from '@/lib/workspace/cloud-workspace-fs'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { data, error } = await db
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (error) return NextResponse.json({ error: '工作区不存在' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { name, description } = body

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return NextResponse.json({ error: '名称不能为空' }, { status: 400 })
  }
  if (name && name.length > 200) {
    return NextResponse.json({ error: '名称不能超过 200 字符' }, { status: 400 })
  }

  const { data, error } = await db
    .from('workspaces')
    .update({ name, description, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', user.id)
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

  const { data: workspace } = await db
    .from('workspaces')
    .select('id, name, execution_domain, cloud_project_dir')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()
  if (!workspace) return NextResponse.json({ error: '工作区不存在' }, { status: 404 })

  const { error: sessionsDeleteError } = await db
    .from('sessions')
    .delete()
    .eq('workspace_id', id)
  if (sessionsDeleteError) return NextResponse.json({ error: sessionsDeleteError.message }, { status: 500 })

  const { error } = await db
    .from('workspaces')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if ((workspace as { execution_domain?: string }).execution_domain === 'cloud') {
    const { data: profile } = await db
      .from('profiles')
      .select('github_username, display_name')
      .eq('id', user.id)
      .single()
    await removeCloudWorkspaceProject(
      {
        id: user.id,
        email: user.email,
        name: (profile as { display_name?: string | null } | null)?.display_name ?? user.name,
        githubUsername: (profile as { github_username?: string | null } | null)?.github_username,
      },
      workspace as unknown as { id: string; name: string; cloud_project_dir?: string | null },
    )
  }

  return NextResponse.json({ ok: true })
}
