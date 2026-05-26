import { Card, CardContent, Button } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'

export function DesktopSettingsPage() {
  const { deviceName, userName, connectionState, setWebWorkspaceError } = useConsoleStore()

  const openWebWorkspace = async () => {
    try {
      const res = await fetch('http://localhost:3000/workspace', { method: 'HEAD', mode: 'no-cors' })
      if (res.type === 'opaque' || res.ok) {
        window.open('http://localhost:3000/workspace', '_blank')
      }
    } catch {
      setWebWorkspaceError('无法连接到 Web 工作台，请确认 Web 服务已启动后重试。')
    }
  }

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
              <Button variant="outline" size="sm" data-auth-action="github-login">GitHub 登录</Button>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="desktop-settings-item-device">
          <CardContent className="py-4">
            <h3 className="text-sm font-medium mb-2">设备信息</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">设备名</dt>
              <dd>{deviceName}</dd>
              <dt className="text-muted-foreground">连接状态</dt>
              <dd>{connectionState === 'connected' ? '在线' : '离线'}</dd>
            </dl>
          </CardContent>
        </Card>
        <Card data-testid="desktop-settings-item-workspace">
          <CardContent className="py-4">
            <h3 className="text-sm font-medium mb-2">Web 工作台</h3>
            <Button variant="outline" size="sm" onClick={openWebWorkspace}>打开 Web 工作台</Button>
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
