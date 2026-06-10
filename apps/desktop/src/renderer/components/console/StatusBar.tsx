import { Badge, Button, StatusPill } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'
import { useOpenWebWorkspace } from '../../hooks/useOpenWebWorkspace'

const stateMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' }> = {
  connected: { label: '云端连接在线', variant: 'success' },
  connecting: { label: '云端连接中', variant: 'warning' },
  disconnected: { label: '云端连接断开', variant: 'destructive' },
  reconnecting: { label: '云端连接重连中', variant: 'warning' },
  authenticating: { label: '云端连接鉴权中', variant: 'secondary' },
}

export function StatusBar() {
  const { connectionState, deviceName, userName, lastHeartbeat, selectedAgent, webWorkspaceError } = useConsoleStore()
  const { openWebWorkspace } = useOpenWebWorkspace()
  const state = stateMap[connectionState] ?? stateMap.disconnected

  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-card">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold">AgentHub 桌面连接器</h1>
        <StatusPill
          label={state.label}
          tone={state.variant === 'success' ? 'success' : state.variant === 'warning' ? 'warning' : state.variant === 'destructive' ? 'danger' : 'neutral'}
          dot
        />
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
