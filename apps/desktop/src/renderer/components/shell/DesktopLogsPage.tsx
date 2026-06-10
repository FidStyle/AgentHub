import { Card, CardContent, CardHeader, CardTitle, StatusPill } from '@agenthub/ui'
import { Activity, ShieldCheck, Wifi } from 'lucide-react'
import { ActivityPanel } from '../console/ActivityPanel'
import { useConsoleStore } from '../../store/console-store'
import { getPolicyAuditRecords } from '../../utils/policy-audit'

export function DesktopLogsPage() {
  const { activities, connectionState, permissionPreset } = useConsoleStore()
  const policyAuditRecords = getPolicyAuditRecords(activities)
  const connected = connectionState === 'connected'

  return (
    <section data-testid="desktop-logs-page" className="flex-1 h-full overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">执行日志</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              记录 Desktop 本机 Runtime 转发、诊断和本机策略审计；远程授权仍在 Web/Mobile 会话中处理。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill label={connected ? '云端连接在线' : '云端连接断开'} tone={connected ? 'success' : 'danger'} icon={Wifi} dot />
            <StatusPill label={`本机策略：${permissionPreset}`} tone="neutral" icon={ShieldCheck} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Runtime 活动
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{activities.length}</div>
              <p className="mt-1 text-xs text-muted-foreground">诊断、转发、停止和失败记录</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">策略审计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{policyAuditRecords.length}</div>
              <p className="mt-1 text-xs text-muted-foreground">本机执行、阻断和等待记录</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">职责边界</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs leading-5 text-muted-foreground">
                Desktop 只执行服务器已分派的本地 Runtime 请求；角色、权限审批、产物和会话状态以 Web 后端为事实源。
              </p>
            </CardContent>
          </Card>
        </div>

        <ActivityPanel />
      </div>
    </section>
  )
}
