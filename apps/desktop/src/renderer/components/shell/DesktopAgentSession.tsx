import React from 'react'
import { Card, CardContent, Button, Badge, Input } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'
import { ActivityPanel } from '../console/ActivityPanel'
import { ApprovalPanel } from '../console/ApprovalPanel'
import { getElectronAPI } from '../../utils/electron-api'

const CONTROL_UNAVAILABLE = '能力未实现：需远程流式 runtime 会话（见 P1-RT），本地一次性执行不支持此控制语义'

export function DesktopAgentSession() {
  const { agents, activities, selectedAgent, workspaceDirs, enterSession, addActivity } = useConsoleStore()
  const connectedAgents = agents.filter(a => a.status === 'connected')
  const [activeWorkspace, setActiveWorkspace] = React.useState<string | null>(null)
  const [input, setInput] = React.useState('')
  const [sending, setSending] = React.useState(false)

  const handleSend = async () => {
    if (!input.trim() || !selectedAgent || sending) return
    const command = input.trim()
    const cwd = activeWorkspace ?? workspaceDirs[0]?.path ?? '.'
    const runtime = getElectronAPI()?.runtime
    setSending(true)
    setInput('')

    if (!runtime || typeof runtime.execute !== 'function') {
      addActivity({
        type: 'runtime',
        status: 'failed',
        message: `[${selectedAgent.name}] ${command}`,
        reason: '本地 runtime 不可用：未检测到 Electron runtime 桥接，无法执行指令',
      })
      setSending(false)
      return
    }

    try {
      const result = await runtime.execute(command, cwd)
      const ok = result.exitCode === 0
      const output = (ok ? result.stdout : result.stderr || result.stdout).trim()
      addActivity({
        type: 'runtime',
        status: ok ? 'success' : 'failed',
        message: `[${selectedAgent.name}] ${command}${output ? `\n${output.slice(0, 2000)}` : ''}`,
        reason: ok ? undefined : `退出码 ${result.exitCode}`,
      })
    } catch (err) {
      addActivity({
        type: 'runtime',
        status: 'failed',
        message: `[${selectedAgent.name}] ${command}`,
        reason: err instanceof Error ? err.message : '执行失败',
      })
    } finally {
      setSending(false)
    }
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
          <Button size="sm" variant="outline" disabled title={CONTROL_UNAVAILABLE}>诊断</Button>
          <Button size="sm" variant="outline" disabled title={CONTROL_UNAVAILABLE}>继续</Button>
          <Button size="sm" variant="outline" disabled title={CONTROL_UNAVAILABLE}>重试</Button>
          <Button size="sm" variant="destructive" disabled title={CONTROL_UNAVAILABLE}>停止</Button>
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
