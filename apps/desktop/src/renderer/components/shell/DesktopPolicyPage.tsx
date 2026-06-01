import { Card, CardContent, Badge, Button } from '@agenthub/ui'
import { Activity, CheckCircle2, Clock3, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useConsoleStore } from '../../store/console-store'
import { getPolicyAuditRecords, type PolicyAuditStatus } from '../../utils/policy-audit'

const STATUS_LABEL: Record<PolicyAuditStatus, string> = {
  executed: '本机已执行',
  pending: '等待处理',
  blocked: '本机阻断',
}

const STATUS_VARIANT: Record<PolicyAuditStatus, 'success' | 'warning' | 'destructive'> = {
  executed: 'success',
  pending: 'warning',
  blocked: 'destructive',
}

export function DesktopPolicyPage() {
  const { policyPresets, permissionPreset, setPermissionPreset, activities } = useConsoleStore()
  const current = policyPresets.find((item) => item.preset === permissionPreset)
  const policyAuditRecords = getPolicyAuditRecords(activities)
  const executableCount = policyAuditRecords.filter((record) => record.status === 'executed').length
  const blockedCount = policyAuditRecords.filter((record) => record.status === 'blocked').length
  const pendingCount = policyAuditRecords.filter((record) => record.status === 'pending').length

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
              Desktop 设置本机权限上限并记录本机执行/阻断结果；远程授权入口统一在 Web/Mobile 当前会话中。
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
                本机已执行
              </div>
              <div className="mt-2 text-2xl font-semibold">{executableCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="h-4 w-4 text-warning" />
                等待处理
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
              <h2 className="text-sm font-medium">本机策略审计</h2>
              <p className="mt-1 text-xs text-muted-foreground">仅展示 Desktop 本机已执行、等待处理或被阻断的真实活动；Web/Mobile 审批历史以会话内通知和动作记录为准。</p>
            </div>
            <Badge variant="secondary">{policyAuditRecords.length} 条</Badge>
          </div>
          {policyAuditRecords.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">暂无本机策略审计记录；需要远程审批的动作请在 Web/Mobile 会话中处理。</p>
          )}
          {policyAuditRecords.map((record) => (
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
                  <span>来源：{record.source}</span>
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
