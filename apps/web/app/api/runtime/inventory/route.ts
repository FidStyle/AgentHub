import { NextResponse } from 'next/server'
import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { detectCliRuntimeCapabilities } from '@/lib/runtime/executor'

type RoleRow = {
  id: string
  name: string
  runtime_type: 'claude_code' | 'codex'
}

export async function GET(request: Request) {
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspace_id')
  const inventory = detectCliRuntimeCapabilities().map((runtime) => ({
    runtimeType: runtime.type,
    available: runtime.available,
    authenticated: runtime.authenticated,
    launchable: runtime.launchable,
    version: runtime.version,
    path: runtime.cliPath,
    capabilitySnapshot: runtime,
    checkedAt: new Date().toISOString(),
    errorCode: runtime.available ? undefined : 'runtime_not_found',
    errorMessage: runtime.diagnostic,
  }))

  if (!workspaceId) {
    return NextResponse.json({ inventory, roles: [] })
  }

  const { data: workspace } = await db
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', user.id)
    .single()
  if (!workspace?.id) return NextResponse.json({ error: '工作区不存在或无权限' }, { status: 404 })

  const { data: roles, error: rolesError } = await db
    .from('role_agents')
    .select('id, name, runtime_type')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
  if (rolesError) return NextResponse.json({ error: rolesError.message }, { status: 500 })

  const rolesWithHealth = ((roles ?? []) as unknown as RoleRow[]).map((role) => {
    const health = inventory.find((runtime) => runtime.runtimeType === role.runtime_type) ?? null
    return {
      ...role,
      selected_runtime_health: health,
    }
  })

  return NextResponse.json({ inventory, roles: rolesWithHealth })
}
