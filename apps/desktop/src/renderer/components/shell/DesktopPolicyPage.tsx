import { Card, CardContent, Badge, Button } from '@agenthub/ui'
import { Activity, CheckCircle2, Clock3, LockKeyhole, ShieldCheck } from 'lucide-react'
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
  const current = policyPresets.find((item) => item.preset === permissionPreset)
  const executableCount = authorizationRecords.filter((record) => record.status === 'executable').length
  const blockedCount = authorizationRecords.filter((record) => record.status === 'security_blocked').length
  const pendingCount = authorizationRecords.filter((record) => record.status === 'needs_authorization').length

  return (
    <section data-testid="desktop-policy-page" className="flex-1 h-full overflow-y-auto">
      <header className="px-6 py-4 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h1 className="text-base font-semibold">本机策略</h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Desktop 设置本机权限上限、同步策略并记录执行结果；授权入口统一在 Web/Mobile 当前会话中。
            </p>
          </div>
          <Badge variant="secondary">当前：{current?.label ?? '未配置'}</Badge>
        </div>
      </header>

      <div className="p-6 flex flex-col gap-4">
        <section className="grid grid-cols-3 gap-3" aria-label="本机策略概览">
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                已授权执行
              </div>
              <div className="mt-2 text-2xl font-semibold">{executableCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="h-4 w-4 text-warning" />
                等待授权
              </div>
              <div className="mt-2 text-2xl font-semibold">{pendingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <LockKeyhole className="h-4 w-4 text-destructive" />
                安全阻断
              </div>
              <div className="mt-2 text-2xl font-semibold">{blockedCount}</div>
            </CardContent>
          </Card>
        </section>

        <section data-testid="desktop-policy-presets" className="grid gap-3">
          <div>
            <h2 className="text-sm font-medium">权限预设</h2>
            <p className="mt-1 text-xs text-muted-foreground">参考 Codex/Claude Code 的本机执行模式，Desktop 只控制本机上限。</p>
          </div>
          {policyPresets.map((item) => (
            <Card key={item.id} className={item.enabled ? 'border-primary/50 bg-primary/5' : undefined}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-4">
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
                </div>
                {item.enabled && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-md bg-background px-2 py-1">
                      <span className="text-muted-foreground">策略源</span>
                      <div className="font-medium">Desktop</div>
                    </div>
                    <div className="rounded-md bg-background px-2 py-1">
                      <span className="text-muted-foreground">授权端</span>
                      <div className="font-medium">Web/Mobile</div>
                    </div>
                    <div className="rounded-md bg-background px-2 py-1">
                      <span className="text-muted-foreground">审计</span>
                      <div className="font-medium">开启</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </section>

        <section data-testid="desktop-authorization-records" className="grid gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium">越权授权记录</h2>
              <p className="mt-1 text-xs text-muted-foreground">记录 Web/Mobile 授权后落到本机执行的策略越界动作。</p>
            </div>
            <Badge variant="secondary">{authorizationRecords.length} 条</Badge>
          </div>
          {authorizationRecords.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">暂无由 Web/Mobile 授权后越过本机策略的执行记录</p>
          )}
          {authorizationRecords.map((record) => (
            <Card key={record.id}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <p className="truncate text-sm font-medium">{record.title}</p>
                    </div>
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
