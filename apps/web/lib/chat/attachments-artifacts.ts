import type { AppDbClient } from '@/lib/postgres-query-client'

export const MAX_ATTACHMENT_BYTES = 64 * 1024

export type AttachmentMetadata = {
  id: string
  name: string
  type: string
  size: number
  content: string
  contentRef: string
  createdAt: string
}

export type ArtifactMetadata = {
  title: string
  type: 'markdown' | 'code' | 'file' | 'preview' | 'diff'
  content: string
}

type MessageRow = {
  id: string
  metadata: Record<string, unknown> | null
}

export async function assertSessionOwner(db: AppDbClient, sessionId: string, userId: string) {
  const { data: session } = await db
    .from('sessions')
    .select('workspace_id')
    .eq('id', sessionId)
    .single()
  if (!session) return { ok: false as const, status: 404, error: '会话不存在' }

  const { data: workspace } = await db
    .from('workspaces')
    .select('id, execution_domain')
    .eq('id', (session as unknown as { workspace_id: string }).workspace_id)
    .eq('owner_id', userId)
    .single()
  if (!workspace) return { ok: false as const, status: 403, error: '无权限' }

  return {
    ok: true as const,
    session: session as unknown as { workspace_id: string },
    workspace: workspace as unknown as { id: string; execution_domain: 'cloud' | 'local_desktop' },
  }
}

export function metadataAttachment(metadata: Record<string, unknown> | null): AttachmentMetadata | null {
  const attachment = metadata?.attachment
  if (!attachment || typeof attachment !== 'object') return null
  const value = attachment as Partial<AttachmentMetadata>
  if (!value.id || !value.name || typeof value.content !== 'string') return null
  return {
    id: String(value.id),
    name: String(value.name),
    type: String(value.type ?? 'application/octet-stream'),
    size: Number(value.size ?? value.content.length),
    content: value.content,
    contentRef: String(value.contentRef ?? `message:${value.id}`),
    createdAt: String(value.createdAt ?? ''),
  }
}

export async function loadSessionAttachments(
  db: AppDbClient,
  sessionId: string,
  attachmentIds?: string[],
): Promise<AttachmentMetadata[]> {
  const { data } = await db
    .from('messages')
    .select('id, metadata')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  const wanted = attachmentIds?.length ? new Set(attachmentIds) : null
  return ((data ?? []) as unknown as MessageRow[])
    .map((row) => metadataAttachment(row.metadata))
    .filter((attachment): attachment is AttachmentMetadata => {
      if (!attachment) return false
      return !wanted || wanted.has(attachment.id)
    })
}

export function buildAttachmentPrompt(attachments: AttachmentMetadata[]) {
  if (attachments.length === 0) return ''
  const blocks = attachments.map((attachment, index) => {
    return [
      `附件 ${index + 1}: ${attachment.name}`,
      `类型: ${attachment.type}`,
      `引用: ${attachment.contentRef}`,
      '内容:',
      attachment.content,
    ].join('\n')
  })
  return `\n\n附件上下文（必须在回答中按需使用，不要只复述文件名）：\n${blocks.join('\n\n---\n')}`
}

function artifactType(value: string | undefined): ArtifactMetadata['type'] {
  if (value === 'code' || value === 'file' || value === 'preview' || value === 'diff') return value
  return 'markdown'
}

function parseAttrs(raw: string) {
  const attrs: Record<string, string> = {}
  for (const match of raw.matchAll(/([a-zA-Z][\w-]*)="([^"]*)"/g)) {
    attrs[match[1]] = match[2]
  }
  return attrs
}

export function parseArtifacts(reply: string): ArtifactMetadata[] {
  const artifacts: ArtifactMetadata[] = []
  for (const match of reply.matchAll(/<agenthub-artifact\s*([^>]*)>([\s\S]*?)<\/agenthub-artifact>/gi)) {
    const attrs = parseAttrs(match[1] ?? '')
    const content = (match[2] ?? '').trim()
    if (!content) continue
    artifacts.push({
      title: attrs.title?.trim() || 'Agent 产物',
      type: artifactType(attrs.type),
      content,
    })
  }
  return artifacts
}
