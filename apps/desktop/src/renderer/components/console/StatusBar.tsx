import { Badge, Button } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'

const stateMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' }> = {
  connected: { label: '在线', variant: 'success' },
  connecting: { label: '连接中', variant: 'warning' },
  disconnected: { label: '离线', variant: 'destructive' },
  reconnecting: { label: '重连中', variant: 'warning' },
  authenticating: { label: '鉴权中', variant: 'secondary' },
}

export function StatusBar() {
  const { connectionState, deviceName, userName, lastHeartbeat, selectedAgent, setWebWorkspaceError } = useConsoleStore()
  const state = stateMap[connectionState] ?? stateMap.disconnected

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
    <header className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-card">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold">AgentHub 桌面连接器</h1>
        <Badge variant={state.variant}>{state.label}</Badge>
        {selectedAgent && <Badge variant="default">{selectedAgent.name}</Badge>}
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{userName}</span>
        <span>{deviceName}</span>
        {lastHeartbeat && <span>心跳: {lastHeartbeat}</span>}
        <Button variant="ghost" size="sm" className="text-xs h-6" onClick={openWebWorkspace}>打开 Web 工作台</Button>
      </div>
    </header>
  )
}
