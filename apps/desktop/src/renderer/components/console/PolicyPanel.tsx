import { Card, CardHeader, CardTitle, CardContent, Badge, StateCard } from '@agenthub/ui'
import { Activity, ShieldCheck } from 'lucide-react'
import { useConsoleStore } from '../../store/console-store'
import { getPolicyAuditRecords, type PolicyAuditStatus } from '../../utils/policy-audit'

const STATUS_LABEL: Record<PolicyAuditStatus, string> = {
  executed: '已执行',
  pending: '等待处理',
  blocked: '已阻断',
}

const STATUS_VARIANT: Record<PolicyAuditStatus, 'success' | 'warning' | 'destructive'> = {
  executed: 'success',
  pending: 'warning',
  blocked: 'destructive',
}

export function PolicyPanel() {
  const { permissionPreset, policyPresets, activities } = useConsoleStore()
  const current = policyPresets.find((item) => item.preset === permissionPreset)
  const policyAuditRecords = getPolicyAuditRecords(activities)

  if (!current) {
    return <StateCard variant="empty" title="未配置本机策略" description="请在本机策略页选择权限预设" />
  }

  return (
    <Card data-testid="desktop-policy-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">本机策略</CardTitle>
          </div>
          <Badge variant="secondary">{current.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{current.description}</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border border-border p-2">
            <div className="text-muted-foreground">预设</div>
            <div className="mt-1 font-medium">{current.label}</div>
          </div>
          <div className="rounded-md border border-border p-2">
            <div className="text-muted-foreground">授权端</div>
            <div className="mt-1 font-medium">Web/Mobile</div>
          </div>
          <div className="rounded-md border border-border p-2">
            <div className="text-muted-foreground">审计</div>
            <div className="mt-1 font-medium">{policyAuditRecords.length} 条</div>
          </div>
        </div>
        <div className="rounded-md border border-border p-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            本机策略审计
          </div>
          {policyAuditRecords.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">暂无本机执行或阻断记录；远程审批请在 Web/Mobile 会话中处理。</p>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              {policyAuditRecords.slice(0, 3).map((record) => (
                <div key={record.id} className="rounded-md bg-muted/50 p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[record.status]}>{STATUS_LABEL[record.status]}</Badge>
                    <span className="text-xs font-medium">{record.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{record.scope}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
