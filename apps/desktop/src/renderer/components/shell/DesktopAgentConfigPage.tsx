import { Card, CardHeader, CardTitle, CardContent, Badge, Button, RuntimeIcon, type RuntimeKind } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'

function agentToRuntime(id: string): RuntimeKind {
  if (id === 'codex' || id === 'claude_code' || id === 'opencode' || id === 'github') return id
  return 'github'
}

export function DesktopAgentConfigPage() {
  const { agents, enterSession } = useConsoleStore()
  const connected = agents.filter(a => a.status === 'connected')
  const pending = agents.filter(a => a.status === 'pending')

  return (
    <section data-testid="desktop-agent-config-page" className="flex-1 h-full overflow-y-auto">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-base font-semibold">本地 Agent 配置</h1>
        <p className="text-xs text-muted-foreground mt-1">管理已检测和待接入的 Agent Runtime</p>
      </header>
      <div className="p-6 flex flex-col gap-6">
        <div>
          <h2 className="text-sm font-medium mb-3">已接入</h2>
          <div className="grid gap-3">
            {connected.map(agent => (
              <Card key={agent.id} data-runtime={agent.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RuntimeIcon runtimeKind={agentToRuntime(agent.id)} size="sm" />
                      <CardTitle className="text-sm">{agent.name}</CardTitle>
                    </div>
                    <Badge data-status="connected" variant="default">已接入</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {agent.version && <p className="text-xs text-muted-foreground mb-1">版本 {agent.version}</p>}
                  {agent.capabilities && agent.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {agent.capabilities.map(cap => (
                        <span key={cap} className="text-[10px] rounded border border-border px-1.5 py-0.5">{cap}</span>
                      ))}
                    </div>
                  )}
                  <Button variant="outline" size="sm" onClick={() => enterSession(agent)}>进入会话</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-medium mb-3">待接入</h2>
          <div className="grid gap-3">
            {pending.map(agent => (
              <Card key={agent.id} data-runtime={agent.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RuntimeIcon runtimeKind={agentToRuntime(agent.id)} size="sm" />
                      <CardTitle className="text-sm">{agent.name}</CardTitle>
                    </div>
                    <Badge data-status="pending" variant="secondary">待接入</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">未检测到运行实例，请确认已安装并启动</p>
                  <Button variant="outline" size="sm" disabled className="mt-2">待接入</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
