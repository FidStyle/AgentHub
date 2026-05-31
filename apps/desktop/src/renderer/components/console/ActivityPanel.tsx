import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, StateCard } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  success: { label: '成功', variant: 'default' },
  failed: { label: '失败', variant: 'destructive' },
  pending: { label: '执行中', variant: 'secondary' },
}

export function ActivityPanel() {
  const { activities } = useConsoleStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (activities.length === 0) {
    return <StateCard variant="empty" title="暂无活动" description="最近没有 Runtime 或 Action 请求" />
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">执行活动</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto">
          {activities.map((entry) => {
            const cfg = statusConfig[entry.status] ?? statusConfig.pending
            const expanded = expandedId === entry.id
            const hasDetail = entry.message.includes('\n') || entry.message.length > 120 || Boolean(entry.reason)
            return (
              <div key={entry.id} className="rounded-md px-2 py-1.5 text-xs hover:bg-muted">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 font-mono text-muted-foreground">{entry.time}</span>
                  <Badge variant={cfg.variant} className="shrink-0 px-1.5 py-0 text-[10px]">{cfg.label}</Badge>
                  <span className="min-w-0 flex-1 truncate">{entry.message}</span>
                  {entry.reason && <span className="max-w-[35%] truncate text-destructive">{entry.reason}</span>}
                  {hasDetail && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 shrink-0 px-2"
                      onClick={() => setExpandedId(expanded ? null : entry.id)}
                    >
                      {expanded ? '收起' : '详情'}
                    </Button>
                  )}
                </div>
                {expanded && (
                  <div className="mt-2 max-h-[360px] overflow-auto rounded-md border border-border bg-background p-2">
                    <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-5 text-foreground">{entry.message}</pre>
                    {entry.reason && (
                      <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-destructive">{entry.reason}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
