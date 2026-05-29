import { Badge, Button } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'
import { useOpenWebWorkspace } from '../../hooks/useOpenWebWorkspace'

const stateMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' }> = {
  connected: { label: '设备通道在线', variant: 'success' },
  connecting: { label: '设备通道连接中', variant: 'warning' },
  disconnected: { label: '设备通道未连接', variant: 'destructive' },
  reconnecting: { label: '设备通道重连中', variant: 'warning' },
  authenticating: { label: '设备通道鉴权中', variant: 'secondary' },
}

export function StatusBar() {
  const { connectionState, deviceName, userName, lastHeartbeat, selectedAgent, webWorkspaceError } = useConsoleStore()
  const { openWebWorkspace } = useOpenWebWorkspace()
  const state = stateMap[connectionState] ?? stateMap.disconnected

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
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-xs h-6" onClick={openWebWorkspace}>打开 Web 工作台</Button>
          {webWorkspaceError && <span className="text-destructive text-[10px]">连接失败</span>}
        </div>
      </div>
    </header>
  )
}
