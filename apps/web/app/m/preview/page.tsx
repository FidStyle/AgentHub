'use client'

import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button, Card, CardHeader, CardTitle, CardContent, StateCard } from '@agenthub/ui'

type PreviewKind = 'html' | 'markdown' | 'code' | 'image' | 'diff' | 'folder' | 'text' | 'generic_file'

interface PreviewState {
  id?: string
  title: string
  source: string
  kind: PreviewKind
  content: string
  downloadUrl?: string
}

function renderPreview(preview: PreviewState) {
  if (preview.kind === 'html') {
    return (
      <iframe
        data-testid="mobile-html-preview"
        sandbox=""
        title={preview.title}
        srcDoc={preview.content}
        className="h-[60vh] w-full rounded-md border border-border bg-white"
      />
    )
  }
  if (preview.kind === 'markdown') {
    return (
      <div data-testid="mobile-markdown-preview" className="prose prose-sm max-w-none rounded-md border border-border bg-background p-3 dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview.content || '暂无内容'}</ReactMarkdown>
      </div>
    )
  }
  if (preview.kind === 'image' && preview.downloadUrl) {
    return (
      <img
        data-testid="mobile-image-preview"
        src={preview.downloadUrl}
        alt={preview.title}
        className="max-h-[60vh] w-full rounded-md border border-border object-contain"
      />
    )
  }
  return (
    <pre data-testid="mobile-text-preview" className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted p-3 text-xs leading-relaxed">
      {preview.content || '暂无内容'}
    </pre>
  )
}

function MobilePreviewContent() {
  const params = useSearchParams()
  const url = params.get('url')
  const title = params.get('title') ?? '预览'
  const messageId = params.get('messageId') ?? (url?.startsWith('message:') ? url.slice('message:'.length) : null)
  const artifactId = params.get('artifactId') ?? (url?.startsWith('artifact:') ? url.slice('artifact:'.length) : null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    setPreview(null)
    if (artifactId) {
      fetch(`/api/artifacts/${artifactId}`)
        .then((res) => {
          if (!res.ok) throw new Error('产物预览加载失败')
          return res.json()
        })
        .then((artifact: { id: string; title?: string; artifact_type?: PreviewKind; content?: string | null; metadata?: { manifest?: unknown } | null }) => {
          const kind = artifact.artifact_type ?? 'generic_file'
          const content = kind === 'folder'
            ? JSON.stringify(artifact.metadata?.manifest ?? {}, null, 2)
            : artifact.content ?? ''
          setPreview({
            id: artifact.id,
            title: artifact.title ?? title,
            source: `artifact:${artifact.id}`,
            kind,
            content,
            downloadUrl: `/api/artifacts/${artifact.id}/download`,
          })
        })
        .catch((e) => setError(e instanceof Error ? e.message : '产物预览加载失败'))
      return
    }
    if (messageId) {
      fetch(`/api/messages/${messageId}`)
        .then((res) => {
          if (!res.ok) throw new Error('预览内容加载失败')
          return res.json()
        })
        .then((message: { id?: string; content?: string; metadata?: { attachment?: { content?: string; type?: string; name?: string } } }) => {
          const attachment = message.metadata?.attachment
          setPreview({
            id: message.id,
            title: attachment?.name ?? title,
            source: `message:${messageId}`,
            kind: attachment?.type?.includes('markdown') ? 'markdown' : attachment?.type?.includes('html') ? 'html' : 'text',
            content: attachment?.content ?? message.content ?? '',
          })
        })
        .catch((e) => setError(e instanceof Error ? e.message : '预览内容加载失败'))
    }
  }, [artifactId, messageId, title])

  if (!url && !messageId && !artifactId) {
    return <StateCard variant="empty" title="无预览内容" description="缺少预览链接参数" />
  }

  if (error) return <StateCard variant="error" title="预览失败" description={error} />
  if (!preview) return <StateCard variant="loading" title="正在加载预览内容" />

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="truncate text-sm">{preview.title}</CardTitle>
            {preview.downloadUrl && (
              <Button size="sm" variant="outline" onClick={() => { window.location.href = preview.downloadUrl! }}>
                下载
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 truncate text-xs text-muted-foreground">{preview.source}</p>
          <div className="rounded-md border border-border bg-muted p-3">
            <p className="mb-2 text-xs text-muted-foreground">只读预览 · {preview.kind}</p>
            {renderPreview(preview)}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function MobilePreviewPage() {
  return (
    <Suspense fallback={<StateCard variant="loading" />}>
      <MobilePreviewContent />
    </Suspense>
  )
}
