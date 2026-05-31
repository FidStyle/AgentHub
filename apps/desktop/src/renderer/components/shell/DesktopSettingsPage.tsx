import { Card, CardContent, Button } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'
import { useDesktopAuth } from '../../hooks/useDesktopAuth'
import { useOpenWebWorkspace } from '../../hooks/useOpenWebWorkspace'

export function DesktopSettingsPage() {
  const { deviceName, userName, connectionState, webWorkspaceError, authError, user } = useConsoleStore()
  const { handleGitHubLogin, handleLogout } = useDesktopAuth()
  const { openWebWorkspace } = useOpenWebWorkspace()

  return (
    <section data-testid="desktop-settings-page" className="flex-1 h-full overflow-y-auto">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-base font-semibold">设置</h1>
      </header>
      <div className="p-6 flex flex-col gap-4">
        <Card data-testid="desktop-settings-item-account">
          <CardContent className="py-4">
            <h3 className="text-sm font-medium mb-2">账号</h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{userName}</span>
              <Button
                variant="outline"
                size="sm"
                data-auth-action={user ? 'logout' : 'github-login'}
                onClick={user ? handleLogout : handleGitHubLogin}
              >
                {user ? '退出登录' : 'GitHub 登录'}
              </Button>
            </div>
            {authError && (
              <p className="text-xs text-destructive mt-2">{authError}</p>
            )}
          </CardContent>
        </Card>
        <Card data-testid="desktop-settings-item-device">
          <CardContent className="py-4">
            <h3 className="text-sm font-medium mb-2">设备信息</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">设备名</dt>
              <dd>{deviceName}</dd>
              <dt className="text-muted-foreground">云端连接</dt>
              <dd>{connectionState === 'connected' ? '在线' : '未连接'}</dd>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              云端连接用于本机 Runtime 和后端之间的实时转发，和 GitHub 账号登录是两个状态。
            </p>
          </CardContent>
        </Card>
        <Card data-testid="desktop-settings-item-workspace">
          <CardContent className="py-4">
            <h3 className="text-sm font-medium mb-2">Web 工作台</h3>
            <Button variant="outline" size="sm" onClick={openWebWorkspace}>打开 Web 工作台</Button>
            {webWorkspaceError && (
              <div data-testid="web-workspace-error" className="mt-2 rounded-md border border-destructive/50 bg-destructive/5 p-2.5">
                <p className="text-xs text-destructive">{webWorkspaceError}</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card data-testid="desktop-settings-item-diagnostics">
          <CardContent className="py-4">
            <h3 className="text-sm font-medium mb-2">诊断</h3>
            <p className="text-xs text-muted-foreground">如遇问题，请检查 Connector 服务是否正常运行。</p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
