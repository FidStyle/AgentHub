'use client'

import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button, Card, CardHeader, CardTitle, CardContent, StateCard } from '@agenthub/ui'
import { Maximize2, X } from 'lucide-react'

type PreviewKind = 'html' | 'markdown' | 'code' | 'image' | 'diff' | 'folder' | 'text' | 'generic_file' | 'document' | 'presentation' | 'pdf'

interface PreviewState {
  id?: string
  title: string
  source: string
  kind: PreviewKind
  content: string
  downloadUrl?: string
  frameUrl?: string
}

function slidesToText(slides: Array<{ index?: number; title?: string; body?: string[] }>) {
  return slides.map((slide, index) => [
    `第 ${slide.index ?? index + 1} 页：${slide.title ?? '未命名页面'}`,
    ...(Array.isArray(slide.body) ? slide.body.map((line) => `- ${line}`) : []),
  ].join('\n')).join('\n\n')
}

function MobilePreviewFrame({ preview }: { preview: PreviewState }) {
  const [fullscreen, setFullscreen] = useState(false)
  const iframe = (
    <iframe
      data-testid="mobile-html-preview"
      sandbox="allow-same-origin"
      title={preview.title}
      src={preview.frameUrl}
      srcDoc={preview.frameUrl ? undefined : preview.content}
      className="h-[60vh] w-full rounded-md border border-border bg-white"
    />
  )
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setFullscreen(true)} data-testid="mobile-preview-fullscreen">
          <Maximize2 className="mr-1 h-3.5 w-3.5" />
          全屏
        </Button>
      </div>
      {iframe}
      {fullscreen ? (
        <div data-testid="mobile-preview-fullscreen-overlay" className="fixed inset-0 z-50 bg-background p-3">
          <div className="flex h-full flex-col rounded-md border border-border bg-background shadow-lg">
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
              <div className="min-w-0 truncate text-sm font-medium">{preview.title}</div>
              <Button size="sm" variant="outline" onClick={() => setFullscreen(false)}>
                <X className="mr-1 h-3.5 w-3.5" />
                退出全屏
              </Button>
            </div>
            <div className="min-h-0 flex-1 p-2">
              <iframe
                title={`${preview.title} 全屏预览`}
                sandbox="allow-same-origin"
                src={preview.frameUrl}
                srcDoc={preview.frameUrl ? undefined : preview.content}
                className="h-full w-full rounded-md border border-border bg-white"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function renderPreview(preview: PreviewState) {
  if (preview.kind === 'html') {
    return <MobilePreviewFrame preview={preview} />
  }
  if (preview.kind === 'markdown' || preview.kind === 'document') {
    return (
      <div data-testid="mobile-markdown-preview" className="prose prose-sm max-w-none rounded-md border border-border bg-background p-3 dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview.content || '暂无内容'}</ReactMarkdown>
      </div>
    )
  }
  if (preview.kind === 'pdf' && preview.downloadUrl) {
    return (
      <iframe
        data-testid="mobile-pdf-preview"
        title={preview.title}
        src={preview.downloadUrl}
        className="h-[60vh] w-full rounded-md border border-border bg-white"
      />
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
          if (!res.ok) {
            if (res.status === 404) throw new Error('产物记录不存在或已失效，请从当前工作区的产物列表打开最新预览。')
            throw new Error(`产物预览加载失败（${res.status}）`)
          }
          return res.json()
        })
        .then(async (artifact: { id: string; title?: string; artifact_type?: PreviewKind; content?: string | null; metadata?: { manifest?: unknown; previewHtmlPath?: string; publishUrl?: string } | null; workspace_id?: string }) => {
          const kind = artifact.artifact_type ?? 'generic_file'
          if (kind === 'presentation' || kind === 'document') {
            const previewRes = await fetch(`/api/artifacts/${artifact.id}/preview`, { method: 'POST' })
            const previewBody = await previewRes.json().catch(() => ({})) as {
              kind?: string
              status?: string
              html?: string
              url?: string
              message?: string
              slides?: Array<{ index?: number; title?: string; body?: string[] }>
            }
            if (previewRes.ok && previewBody.status === 'html' && previewBody.html) {
              setPreview({
                id: artifact.id,
                title: artifact.title ?? title,
                source: `artifact:${artifact.id}`,
                kind: 'html',
                content: previewBody.html,
                downloadUrl: `/api/artifacts/${artifact.id}/download`,
              })
              return
            }
            if (kind === 'document') {
              setPreview({
                id: artifact.id,
                title: artifact.title ?? title,
                source: `artifact:${artifact.id}`,
                kind: 'document',
                content: previewBody.message || artifact.content || '暂无文档内容',
                downloadUrl: `/api/artifacts/${artifact.id}/download`,
              })
              return
            }
            setPreview({
              id: artifact.id,
              title: artifact.title ?? title,
              source: `artifact:${artifact.id}`,
              kind: 'presentation',
              content: slidesToText(previewBody.slides ?? []) || previewBody.message || artifact.content || '暂无演示稿摘要',
              downloadUrl: `/api/artifacts/${artifact.id}/download`,
            })
            return
          }
          if (kind === 'html') {
            const previewRes = await fetch(`/api/artifacts/${artifact.id}/preview`, { method: 'POST' })
            const previewBody = await previewRes.json().catch(() => ({})) as { status?: string; html?: string; url?: string; message?: string }
            const frameUrl = previewRes.ok && typeof previewBody.url === 'string' && previewBody.url ? previewBody.url : undefined
            setPreview({
              id: artifact.id,
              title: artifact.title ?? title,
              source: `artifact:${artifact.id}`,
              kind: 'html',
              content: previewRes.ok && previewBody.html ? previewBody.html : artifact.content ?? previewBody.message ?? '',
              frameUrl,
              downloadUrl: `/api/artifacts/${artifact.id}/download`,
            })
            return
          }
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
    <div data-testid="mobile-preview">
      <Suspense fallback={<StateCard variant="loading" />}>
        <MobilePreviewContent />
      </Suspense>
    </div>
  )
}
