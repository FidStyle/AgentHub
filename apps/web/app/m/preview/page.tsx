'use client'

import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, StateCard } from '@agenthub/ui'

function MobilePreviewContent() {
  const params = useSearchParams()
  const url = params.get('url')
  const title = params.get('title') ?? '预览'
  const messageId = params.get('messageId') ?? (url?.startsWith('message:') ? url.slice('message:'.length) : null)
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!messageId) return
    fetch(`/api/messages/${messageId}`)
      .then((res) => {
        if (!res.ok) throw new Error('预览内容加载失败')
        return res.json()
      })
      .then((message: { content?: string; metadata?: { attachment?: { content?: string } } }) => {
        setContent(message.metadata?.attachment?.content ?? message.content ?? '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : '预览内容加载失败'))
  }, [messageId])

  if (!url && !messageId) {
    return <StateCard variant="empty" title="无预览内容" description="缺少预览链接参数" />
  }

  if (error) return <StateCard variant="error" title="预览失败" description={error} />

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm truncate">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground truncate mb-3">{messageId ? `message:${messageId}` : url}</p>
          <div className="rounded-md border border-border bg-muted p-3">
            <p className="mb-2 text-xs text-muted-foreground">只读预览</p>
            {messageId ? (
              content === null ? (
                <StateCard variant="loading" title="正在加载预览内容" />
              ) : (
                <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap text-xs leading-relaxed">{content || '暂无内容'}</pre>
              )
            ) : (
              <p className="text-sm">暂不直接读取外部链接内容，请使用 messageId 或 message:contentRef 预览已保存产物。</p>
            )}
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
