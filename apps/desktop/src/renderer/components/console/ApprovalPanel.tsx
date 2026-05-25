import { Card, CardHeader, CardTitle, CardContent, Button, Badge, StateCard } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'

export function ApprovalPanel() {
  const { approvals, approveItem, rejectItem } = useConsoleStore()

  if (approvals.length === 0) {
    return <StateCard variant="empty" title="无待审批项" description="当前没有需要确认的操作" />
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">待审批</CardTitle>
          <Badge variant="secondary">{approvals.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {approvals.map((item) => (
          <div key={item.id} className="rounded-md border border-border p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant={item.risk === 'high' ? 'destructive' : 'secondary'}>
                {item.risk === 'high' ? '高风险' : '中风险'}
              </Badge>
              <span className="text-sm font-medium">{item.action}</span>
              <span className="ml-auto text-xs text-muted-foreground">{item.createdAt}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{item.description}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => approveItem(item.id)}>批准</Button>
              <Button size="sm" variant="outline" onClick={() => rejectItem(item.id)}>拒绝</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
