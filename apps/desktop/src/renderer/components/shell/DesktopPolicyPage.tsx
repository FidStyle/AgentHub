import { Card, CardContent, Badge, Button } from '@agenthub/ui'
import { useConsoleStore, type AuthorizationRecord } from '../../store/console-store'

const STATUS_LABEL: Record<AuthorizationRecord['status'], string> = {
  executable: '已授权可执行',
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

export function DesktopPolicyPage() {
  const { policyPresets, permissionPreset, setPermissionPreset, authorizationRecords } = useConsoleStore()

  return (
    <section data-testid="desktop-policy-page" className="flex-1 h-full overflow-y-auto">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-base font-semibold">本机策略</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Desktop 只设置本机权限上限、同步策略并记录执行结果；授权入口统一在 Web/Mobile 当前会话中。
        </p>
      </header>

      <div className="p-6 flex flex-col gap-4">
        <section data-testid="desktop-policy-presets" className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">权限预设</h2>
            <Badge variant="secondary">当前：{policyPresets.find((item) => item.preset === permissionPreset)?.label}</Badge>
          </div>
          {policyPresets.map((item) => (
            <Card key={item.id}>
              <CardContent className="py-3 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{item.label}</p>
                    {item.enabled && <Badge variant="success">启用中</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                </div>
                <Button
                  size="sm"
                  variant={item.enabled ? 'outline' : 'default'}
                  disabled={item.enabled}
                  onClick={() => setPermissionPreset(item.preset)}
                >
                  {item.enabled ? '已启用' : '切换'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        <section data-testid="desktop-authorization-records" className="grid gap-3">
          <h2 className="text-sm font-medium">越权授权记录</h2>
          {authorizationRecords.length === 0 && (
            <p className="text-sm text-muted-foreground">暂无由 Web/Mobile 授权后越过本机策略的执行记录</p>
          )}
          {authorizationRecords.map((record) => (
            <Card key={record.id}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{record.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{record.scope}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[record.status]}>{STATUS_LABEL[record.status]}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>授权端：{record.surface}</span>
                  <span>时间：{record.createdAt}</span>
                </div>
                {record.commandPreview && (
                  <code className="mt-2 block overflow-x-auto rounded-md bg-muted px-2 py-1 text-xs">
                    {record.commandPreview}
                  </code>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </section>
  )
}
