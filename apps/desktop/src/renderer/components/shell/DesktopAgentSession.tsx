import React from 'react'
import { Card, CardContent, Button, Badge, Input } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'
import { ActivityPanel } from '../console/ActivityPanel'
import { ApprovalPanel } from '../console/ApprovalPanel'

export function DesktopAgentSession() {
  const { agents, activities, selectedAgent, workspaceDirs, enterSession, addActivity } = useConsoleStore()
  const connectedAgents = agents.filter(a => a.status === 'connected')
  const [activeWorkspace, setActiveWorkspace] = React.useState<string | null>(null)
  const [input, setInput] = React.useState('')
  const [sending, setSending] = React.useState(false)

  const handleSend = () => {
    if (!input.trim() || !selectedAgent || sending) return
    setSending(true)
    addActivity({ type: 'action', status: 'success', message: `[${selectedAgent.name}] ${input.trim()}` })
    setInput('')
    setSending(false)
  }

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
                  <Button key={agent.id} variant="outline" size="sm" onClick={() => enterSession(agent)}>
                    {agent.name}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <div data-testid="desktop-agent-composer" className="border-t border-border px-4 py-3">
        {!selectedAgent && (
          <p className="text-xs text-muted-foreground mb-2">请先选择一个已接入的 Agent</p>
        )}
        <div className="flex gap-2 mb-2">
          <Button size="sm" variant="outline" disabled={!selectedAgent}>诊断</Button>
          <Button size="sm" variant="outline" disabled={!selectedAgent}>继续</Button>
          <Button size="sm" variant="outline" disabled={!selectedAgent}>重试</Button>
          <Button size="sm" variant="destructive" disabled={!selectedAgent}>停止</Button>
        </div>
        <div className="flex gap-2">
          <Input
            className="flex-1"
            placeholder={selectedAgent ? '输入指令...' : '请先选择 Agent'}
            disabled={!selectedAgent || sending}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <Button size="sm" disabled={!selectedAgent || !input.trim() || sending} onClick={handleSend}>
            {sending ? '发送中' : '发送'}
          </Button>
        </div>
      </div>
    </section>
  )
}
