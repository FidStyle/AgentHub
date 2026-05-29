import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { createClient } from '@/lib/app-db-client'
import { HostedRuntimeAdapter } from '@/lib/runtime/hosted-adapter'

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { sessionId, content } = await req.json()
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

  await db.from('messages').insert({
    session_id: sessionId,
    content,
    sender_type: 'user',
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
      try {
        for await (const evt of adapter.invoke({
          userId: user.id,
          sessionId,
          executionDomain: ws.execution_domain,
          workspaceId: ws.id,
          userMessage: content,
        })) {
          controller.enqueue(encode(evt))
        }
      } finally {
        controller.enqueue(encode({ type: 'done' }))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
