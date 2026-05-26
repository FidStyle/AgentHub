import React from 'react'
import { Card, CardContent, Button, Badge } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'
import { ActivityPanel } from '../console/ActivityPanel'
import { ApprovalPanel } from '../console/ApprovalPanel'

export function DesktopAgentSession() {
  const { agents, activities, selectedAgent, workspaceDirs } = useConsoleStore()
  const connectedAgents = agents.filter(a => a.status === 'connected')
  const [activeWorkspace, setActiveWorkspace] = React.useState<string | null>(null)

  return (
    <section data-testid="desktop-agent-session" className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="px-4 py-3 border-b border-border flex items-center gap-3">
        <h2 className="text-sm font-semibold">本地 Agent 会话</h2>
        {selectedAgent && (
          <Badge data-testid="desktop-selected-agent" variant="default">{selectedAgent.name}</Badge>
        )}
        {!selectedAgent && connectedAgents.length > 0 && (
          <Badge variant="secondary">{connectedAgents.length} 个在线</Badge>
        )}
      </header>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          {workspaceDirs.map((ws, i) => (
            <button
              key={ws.path}
              data-testid={`desktop-workspace-item-${i}`}
              aria-current={activeWorkspace === ws.path ? 'true' : undefined}
              data-state={activeWorkspace === ws.path ? 'active' : undefined}
              onClick={() => setActiveWorkspace(ws.path)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left w-full ${activeWorkspace === ws.path ? 'bg-muted font-medium' : 'hover:bg-muted/50'}`}
            >
              <span className={`h-2 w-2 rounded-full ${ws.healthy ? 'bg-success' : 'bg-destructive'}`} />
              <span>{ws.path}</span>
            </button>
          ))}
        </div>
        {activities.length > 0 && <ActivityPanel />}
        <ApprovalPanel />
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {selectedAgent ? `当前 Agent: ${selectedAgent.name}` : '选择已接入的 Agent 开始轻量会话'}
            </p>
            {!selectedAgent && (
              <div className="flex gap-2 justify-center mt-3">
                {connectedAgents.map(agent => (
                  <Button key={agent.id} variant="outline" size="sm">
                    {agent.name}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <div data-testid="desktop-agent-composer" className="border-t border-border px-4 py-3">
        <div className="flex gap-2 mb-2">
          <Button size="sm" variant="outline" disabled={connectedAgents.length === 0}>诊断</Button>
          <Button size="sm" variant="outline" disabled={connectedAgents.length === 0}>继续</Button>
          <Button size="sm" variant="outline" disabled={connectedAgents.length === 0}>重试</Button>
          <Button size="sm" variant="destructive" disabled={connectedAgents.length === 0}>停止</Button>
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
            placeholder="输入指令..."
            disabled={connectedAgents.length === 0}
          />
          <Button size="sm" disabled={connectedAgents.length === 0}>发送</Button>
        </div>
      </div>
    </section>
  )
}
