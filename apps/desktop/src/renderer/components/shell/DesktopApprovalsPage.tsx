import { Card, CardContent, Badge, Button } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'

export function DesktopApprovalsPage() {
  const { approvals, approveItem, rejectItem } = useConsoleStore()

  return (
    <section data-testid="desktop-approvals-page" className="flex-1 h-full overflow-y-auto">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-base font-semibold">待审批</h1>
      </header>
      <div className="p-6 flex flex-col gap-3">
        {approvals.length === 0 && (
          <p className="text-sm text-muted-foreground">暂无待审批项目</p>
        )}
        {approvals.map(item => (
          <Card key={item.id}>
            <CardContent className="py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{item.action}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={item.risk === 'high' ? 'destructive' : 'secondary'}>{item.risk}</Badge>
                <Button size="sm" variant="outline" onClick={() => approveItem(item.id)}>批准</Button>
                <Button size="sm" variant="ghost" onClick={() => rejectItem(item.id)}>拒绝</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
