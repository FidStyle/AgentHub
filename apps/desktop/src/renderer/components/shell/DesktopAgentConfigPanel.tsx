import { Card, CardHeader, CardTitle, CardContent, Badge, Button, RuntimeIcon, type RuntimeKind } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'
import { RuntimeDetection } from '../console/RuntimeDetection'
import { useOpenWebWorkspace } from '../../hooks/useOpenWebWorkspace'
import { DesktopRuntimeSupervision } from './DesktopRuntimeSupervision'

function agentToRuntime(id: string): RuntimeKind {
  if (id === 'codex' || id === 'claude_code' || id === 'opencode' || id === 'github') return id
  return 'github'
}

export function DesktopAgentConfigPanel() {
  const { agents, webWorkspaceError, navigateTo } = useConsoleStore()
  const { openWebWorkspace } = useOpenWebWorkspace()

  return (
    <aside data-testid="desktop-agent-config" className="w-72 border-l border-border bg-card h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Runtime 状态</h2>
        <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => navigateTo('agents')}>管理 Agent</Button>
      </div>
      <div className="p-3 flex flex-col gap-3">
        {agents.map(agent => (
          <Card key={agent.id} data-runtime={agent.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RuntimeIcon runtimeKind={agentToRuntime(agent.id)} size="sm" />
                  <CardTitle className="text-sm">{agent.name}</CardTitle>
                </div>
                <Badge
                  data-status={agent.status}
                  variant={agent.status === 'connected' ? 'default' : 'secondary'}
                >
                  {agent.status === 'connected' ? '已接入' : '待接入'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {agent.version && (
                <p className="text-xs text-muted-foreground">{agent.version}</p>
              )}
            </CardContent>
          </Card>
        ))}

        <RuntimeDetection />
        <DesktopRuntimeSupervision />

        <div className="mt-2">
          <Button variant="outline" size="sm" className="w-full" onClick={openWebWorkspace}>
            打开 Web 工作台
          </Button>
          {webWorkspaceError && (
            <div data-testid="web-workspace-error" className="mt-2 rounded-md border border-destructive/50 bg-destructive/5 p-2.5">
              <p className="text-xs text-destructive">{webWorkspaceError}</p>
              <p className="text-xs text-muted-foreground mt-1">请检查 Web 服务是否在 localhost:3000 运行，或联系管理员。</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
