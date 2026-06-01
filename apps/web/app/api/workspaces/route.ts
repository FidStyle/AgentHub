import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'
import { ensureCloudWorkspaceProject } from '@/lib/workspace/cloud-workspace-fs'

function hasDatabaseConfig() {
  return Boolean(process.env.DATABASE_URL)
}

function parseCapabilityValue(value: unknown) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown
    } catch {
      return null
    }
  }
  return value
}

function hasReadyRuntimeDetection(value: unknown) {
  const parsed = parseCapabilityValue(value)
  if (!Array.isArray(parsed)) return false
  return parsed.some((runtime) => {
    if (!runtime || typeof runtime !== 'object') return false
    const record = runtime as { available?: boolean; authenticated?: boolean; launchable?: boolean }
    return record.available === true && record.authenticated === true && record.launchable !== false
  })
}

async function hasConnectedDesktopRuntime(db: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: devices, error: devicesError } = await db
    .from('devices')
    .select('id, type')
    .eq('user_id', userId)

  if (devicesError) return { ok: false, error: devicesError.message }

  const desktopDevices = ((devices ?? []) as unknown as Array<{ id: string; type: string }>).filter((device) => device.type === 'desktop')
  if (desktopDevices.length === 0) return { ok: false }

  for (const device of desktopDevices) {
    const { data: channels, error: channelError } = await db
      .from('device_runtime_channels')
      .select('endpoint_id, status')
      .eq('device_id', device.id)

    if (channelError) return { ok: false, error: channelError.message }
    const connected = ((channels ?? []) as unknown as Array<{ endpoint_id: string | null; status: string }>)
      .find((channel) => channel.status === 'connected' && channel.endpoint_id)
    if (!connected?.endpoint_id) continue

    const { data: capabilities, error: capabilitiesError } = await db
      .from('runtime_capabilities')
      .select('value')
      .eq('endpoint_id', connected.endpoint_id)
      .eq('capability', 'runtime_detection')
      .limit(1)
    if (capabilitiesError) return { ok: false, error: capabilitiesError.message }
    const row = Array.isArray(capabilities) ? capabilities[0] : capabilities
    if (hasReadyRuntimeDetection((row as { value?: unknown } | null)?.value)) {
      return { ok: true }
    }
  }

  return { ok: false }
}

export async function GET() {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  if (!hasDatabaseConfig()) {
    return NextResponse.json({ error: '数据库未配置，请设置 DATABASE_URL' }, { status: 500 })
  }

  const db = await createClient()

  const { data, error } = await db
    .from('workspaces')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { name, execution_domain, description } = body

  if (!name || !execution_domain) {
    return NextResponse.json({ error: '名称和执行域为必填项' }, { status: 400 })
  }

  if (!['cloud', 'local_desktop'].includes(execution_domain)) {
    return NextResponse.json({ error: '执行域必须为 cloud 或 local_desktop' }, { status: 400 })
  }

  if (!hasDatabaseConfig()) {
    return NextResponse.json({ error: '数据库未配置，请设置 DATABASE_URL' }, { status: 500 })
  }

  const db = await createClient()
  if (execution_domain === 'local_desktop') {
    const desktop = await hasConnectedDesktopRuntime(db, user.id)
    if (desktop.error) return NextResponse.json({ error: desktop.error }, { status: 500 })
    if (!desktop.ok) {
      return NextResponse.json({ error: '本地 Desktop 未连接或 Runtime 未通过检测，无法创建可执行的本地工作区' }, { status: 409 })
    }
  }

  const { data, error } = await db
    .from('workspaces')
    .insert({ owner_id: user.id, name, execution_domain, description: description || '' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (execution_domain === 'cloud') {
    const { data: profile } = await db
      .from('profiles')
      .select('github_username, display_name')
      .eq('id', user.id)
      .single()
    const projectDir = await ensureCloudWorkspaceProject(
      {
        id: user.id,
        email: user.email,
        name: (profile as { display_name?: string | null } | null)?.display_name ?? user.name,
        githubUsername: (profile as { github_username?: string | null } | null)?.github_username,
      },
      data as unknown as { id: string; name: string; cloud_project_dir?: string | null },
    )
    await db
      .from('workspaces')
      .update({ cloud_project_dir: projectDir, updated_at: new Date().toISOString() })
      .eq('id', (data as { id: string }).id)
      .eq('owner_id', user.id)
    return NextResponse.json({ ...(data as Record<string, unknown>), cloud_project_dir: projectDir }, { status: 201 })
  }
  return NextResponse.json(data, { status: 201 })
}
