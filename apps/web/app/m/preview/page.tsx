'use client'

import { useSearchParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, StateCard } from '@agenthub/ui'

export default function MobilePreviewPage() {
  const params = useSearchParams()
  const url = params.get('url')
  const title = params.get('title') ?? '预览'

  if (!url) {
    return <StateCard variant="empty" title="无预览内容" description="缺少预览链接参数" />
  }

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm truncate">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground truncate mb-3">{url}</p>
          <div className="rounded-md border border-border bg-muted p-4 text-center">
            <p className="text-xs text-muted-foreground">只读预览</p>
            <p className="text-sm mt-2">文件内容将在此显示</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
