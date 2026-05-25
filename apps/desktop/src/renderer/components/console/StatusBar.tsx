import { Badge } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'

const stateMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' }> = {
  connected: { label: '在线', variant: 'success' },
  connecting: { label: '连接中', variant: 'warning' },
  disconnected: { label: '离线', variant: 'destructive' },
  reconnecting: { label: '重连中', variant: 'warning' },
  authenticating: { label: '鉴权中', variant: 'secondary' },
}

export function StatusBar() {
  const { connectionState, deviceName, userName, lastHeartbeat } = useConsoleStore()
  const state = stateMap[connectionState] ?? stateMap.disconnected

  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-card">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold">AgentHub 桌面连接器</h1>
        <Badge variant={state.variant}>{state.label}</Badge>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{userName}</span>
        <span>{deviceName}</span>
        {lastHeartbeat && <span>心跳: {lastHeartbeat}</span>}
      </div>
    </header>
  )
}
