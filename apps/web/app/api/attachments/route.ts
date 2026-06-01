import { NextResponse } from 'next/server'
import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import {
  MAX_ATTACHMENT_BYTES,
  assertSessionOwner,
  loadSessionAttachments,
  type AttachmentMetadata,
} from '@/lib/chat/attachments-artifacts'

export async function GET(request: Request) {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: '缺少 session_id' }, { status: 400 })

  const db = await createClient()
  const owner = await assertSessionOwner(db, sessionId, user.id)
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status })

  const attachments = await loadSessionAttachments(db, sessionId)
  return NextResponse.json(attachments.map(({ content, ...attachment }) => ({
    ...attachment,
    preview: content.slice(0, 240),
  })))
}

export async function POST(request: Request) {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const form = await request.formData()
  const sessionId = String(form.get('session_id') ?? '')
  const file = form.get('file')
  if (!sessionId || !(file instanceof File)) {
    return NextResponse.json({ error: '缺少 session_id 或文件' }, { status: 400 })
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: '附件不能超过 64KB，本轮仅接入轻量文本上下文' }, { status: 413 })
  }

  const db = await createClient()
  const owner = await assertSessionOwner(db, sessionId, user.id)
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status })

  const content = await file.text()
  const createdAt = new Date().toISOString()
  const draft = {
    id: '',
    name: file.name,
    type: file.type || 'text/plain',
    size: file.size,
    content,
    contentRef: '',
    createdAt,
  } satisfies AttachmentMetadata

  const { data, error } = await db
    .from('messages')
    .insert({
      session_id: sessionId,
      sender_type: 'system',
      content: `附件：${file.name}`,
      message_type: 'text',
      metadata: { attachment: draft },
      is_pinned: true,
    })
    .select('id')
    .single()
  if (error || !data?.id) {
    return NextResponse.json({ error: error?.message ?? '附件保存失败' }, { status: 500 })
  }

  const attachment: AttachmentMetadata = {
    ...draft,
    id: data.id,
    contentRef: `message:${data.id}`,
  }
  await db
    .from('messages')
    .update({ metadata: { attachment }, updated_at: new Date().toISOString() })
    .eq('id', data.id)

  return NextResponse.json({ ...attachment, preview: content.slice(0, 240) }, { status: 201 })
}
