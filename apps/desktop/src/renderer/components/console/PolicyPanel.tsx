import { Card, CardHeader, CardTitle, CardContent, Badge, StateCard } from '@agenthub/ui'
import { Activity, ShieldCheck } from 'lucide-react'
import { useConsoleStore, type AuthorizationRecord } from '../../store/console-store'

const STATUS_LABEL: Record<AuthorizationRecord['status'], string> = {
  executable: '已授权',
  needs_authorization: '需要授权',
  cancelled: '已取消',
  security_blocked: '安全阻断',
}

const STATUS_VARIANT: Record<AuthorizationRecord['status'], 'success' | 'warning' | 'secondary' | 'destructive'> = {
  executable: 'success',
  needs_authorization: 'warning',
  cancelled: 'secondary',
  security_blocked: 'destructive',
}

export function PolicyPanel() {
  const { permissionPreset, policyPresets, authorizationRecords } = useConsoleStore()
  const current = policyPresets.find((item) => item.preset === permissionPreset)

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
            <div className="text-muted-foreground">记录</div>
            <div className="mt-1 font-medium">{authorizationRecords.length} 条</div>
          </div>
        </div>
        <div className="rounded-md border border-border p-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            越权授权记录
          </div>
          {authorizationRecords.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">暂无 Web/Mobile 授权后的本机执行记录</p>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              {authorizationRecords.slice(0, 3).map((record) => (
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
