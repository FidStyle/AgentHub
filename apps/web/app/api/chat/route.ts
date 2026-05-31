import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { createClient } from '@/lib/app-db-client'
import { HostedRuntimeAdapter } from '@/lib/runtime/hosted-adapter'
import { getConnectionByUserId } from '@/server/device-connections'

async function localDesktopOperability(db: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const conn = getConnectionByUserId(userId)
  if (!conn) return { ok: false, error: '本地 Desktop 未连接云端，当前只能只读查看历史。' }

  const { data: devices } = await db
    .from('devices')
    .select('id, type')
    .eq('user_id', userId)
  const desktop = ((devices ?? []) as unknown as Array<{ id: string; type: string }>).find((device) => device.id === conn.deviceId && device.type === 'desktop')
  if (!desktop) return { ok: false, error: '当前账号没有可用的 Desktop 绑定，当前只能只读查看历史。' }

  const { data: channels } = await db
    .from('device_runtime_channels')
    .select('endpoint_id, status')
    .eq('device_id', desktop.id)
  const channel = ((channels ?? []) as unknown as Array<{ endpoint_id: string | null; status: string }>).find((row) => row.status === 'connected')
  if (!channel?.endpoint_id) {
    return { ok: false, error: '本地 Runtime 尚未完成真实检测，当前只能只读查看历史。' }
  }

  const { data: capabilities } = await db
    .from('runtime_capabilities')
    .select('capability, value')
    .eq('endpoint_id', channel.endpoint_id)
  const detection = ((capabilities ?? []) as unknown as Array<{ capability: string; value: unknown }>).find((row) => row.capability === 'runtime_detection')
  if (!detection) return { ok: false, error: '本地 Runtime 尚未完成真实检测，当前只能只读查看历史。' }

  let value: unknown = detection.value
  if (typeof detection.value === 'string') {
    try {
      value = JSON.parse(detection.value) as unknown
    } catch {
      value = null
    }
  }
  const ready = Array.isArray(value) && value.some((runtime) => {
    if (!runtime || typeof runtime !== 'object') return false
    const record = runtime as { available?: boolean; authenticated?: boolean; launchable?: boolean }
    return record.available === true && record.authenticated === true && record.launchable !== false
  })
  return ready
    ? { ok: true, error: null }
    : { ok: false, error: '本地 Claude Code / Codex 未登录或不可启动，当前只能只读查看历史。' }
}

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { sessionId, content, roleAgentId, mentions } = await req.json()
  if (!sessionId || !content) {
    return Response.json({ error: '缺少 sessionId 或 content' }, { status: 400 })
  }

  const db = await createClient()

  const { data: session } = await db
    .from('sessions')
    .select('workspace_id')
    .eq('id', sessionId)
    .single()
  if (!session) return Response.json({ error: '会话不存在' }, { status: 404 })

  const { data: ws } = await db
    .from('workspaces')
    .select('id, execution_domain')
    .eq('id', session.workspace_id)
    .eq('owner_id', user.id)
    .single()
  if (!ws) return Response.json({ error: '无权限' }, { status: 403 })

  if (ws.execution_domain === 'local_desktop') {
    const operability = await localDesktopOperability(db, user.id)
    if (!operability.ok) return Response.json({ error: operability.error }, { status: 409 })
  }

  // When a role is mentioned, it must belong to this workspace. Load its system prompt so the
  // runtime executes with the role's persona; reject cross-workspace role references.
  let systemPrompt: string | undefined
  if (roleAgentId) {
    const { data: roleAgent } = await db
      .from('role_agents')
      .select('workspace_id, system_prompt')
      .eq('id', roleAgentId)
      .single()
    if (!roleAgent || roleAgent.workspace_id !== ws.id) {
      return Response.json({ error: '角色不存在或无权限' }, { status: 403 })
    }
    systemPrompt = roleAgent.system_prompt || undefined
  }

  await db.from('messages').insert({
    session_id: sessionId,
    content,
    sender_type: 'user',
    role_agent_id: roleAgentId ?? null,
    metadata: mentions ? { mentions } : null,
  })

  const encoder = new TextEncoder()
  const encode = (data: object) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`)

  // Both cloud and local_desktop route through the Cloud Runtime Gateway via the adapter.
  // runtime_sessions / runtime_logs persistence happens inside the gateway. For an offline
  // local_desktop endpoint the gateway emits local_runtime_offline plus a DEVICE_OFFLINE
  // runtime_status event so existing P0 client expectations stay compatible.
  const adapter = new HostedRuntimeAdapter()
  const stream = new ReadableStream({
    async start(controller) {
      let reply = ''
      let completed = false
      try {
        for await (const evt of adapter.invoke({
          userId: user.id,
          sessionId,
          executionDomain: ws.execution_domain,
          workspaceId: ws.id,
          userMessage: content,
          systemPrompt,
          roleAgentId: roleAgentId ?? undefined,
        })) {
          if (evt.type === 'runtime_output' && evt.delta) reply += evt.delta
          if (evt.type === 'runtime_completed') completed = true
          controller.enqueue(encode(evt))
        }
      } finally {
        // Persist the agent reply so reload restores it. Only on a clean completion with
        // non-empty output — failed/unavailable terminals must not fabricate a success message.
        if (completed && reply) {
          await db.from('messages').insert({
            session_id: sessionId,
            content: reply,
            sender_type: 'agent',
            role_agent_id: roleAgentId ?? null,
          })
        }
        controller.enqueue(encode({ type: 'done' }))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
