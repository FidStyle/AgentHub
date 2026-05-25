import { Card, CardHeader, CardTitle, CardContent, Badge, StateCard } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  success: { label: '成功', variant: 'default' },
  failed: { label: '失败', variant: 'destructive' },
  pending: { label: '执行中', variant: 'secondary' },
}

export function ActivityPanel() {
  const { activities } = useConsoleStore()

  if (activities.length === 0) {
    return <StateCard variant="empty" title="暂无活动" description="最近没有 Runtime 或 Action 请求" />
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">执行活动</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
          {activities.map((entry) => {
            const cfg = statusConfig[entry.status] ?? statusConfig.pending
            return (
              <div key={entry.id} className="flex items-center gap-2 text-xs rounded px-2 py-1.5 hover:bg-muted">
                <span className="text-muted-foreground font-mono shrink-0">{entry.time}</span>
                <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0">{cfg.label}</Badge>
                <span className="truncate">{entry.message}</span>
                {entry.reason && <span className="text-destructive ml-auto shrink-0">{entry.reason}</span>}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
