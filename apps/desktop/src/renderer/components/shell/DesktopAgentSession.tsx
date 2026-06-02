import React from 'react'
import { Card, CardContent, Button, Badge, Input } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'
import { ActivityPanel } from '../console/ActivityPanel'
import { PolicyPanel } from '../console/PolicyPanel'
import { getElectronAPI } from '../../utils/electron-api'

const RUNTIME_LABELS: Record<string, string> = {
  claude_code: 'Claude Code',
  codex: 'Codex',
}

function toSupportedRuntimeType(agentId: string): 'claude_code' | 'codex' | null {
  if (agentId === 'claude_code' || agentId === 'codex') return agentId
  return null
}

export function DesktopAgentSession() {
  const {
    agents,
    activities,
    selectedAgent,
    workspaceDirs,
    runtimes,
    enterSession,
    addActivity,
    setRuntimes,
    setRuntimeLoading,
    nativeSessions,
    setNativeSession,
  } = useConsoleStore()
  const connectedAgents = agents.filter(a => a.status === 'connected')
  const [activeWorkspace, setActiveWorkspace] = React.useState<string | null>(null)
  const [input, setInput] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [diagnosing, setDiagnosing] = React.useState(false)
  const selectedRuntimeType = selectedAgent ? toSupportedRuntimeType(selectedAgent.id) : null
  const selectedRuntime = selectedRuntimeType ? runtimes.find((rt) => rt.type === selectedRuntimeType) : null
  const selectedAgentId = selectedAgent?.id ?? ''

  const handleDiagnose = async () => {
    if (diagnosing) return
    const runtime = getElectronAPI()?.runtime
    if (!runtime || typeof runtime.detect !== 'function') {
      addActivity({
        type: 'runtime',
        status: 'failed',
        message: '本地 Runtime 诊断失败',
        reason: '未检测到 Electron runtime 桥接，请在桌面端窗口中重试',
      })
      return
    }

    setDiagnosing(true)
    setRuntimeLoading(true)
    try {
      const result = await runtime.detect()
      setRuntimes(result)
      const summary = result
        .map((rt) => {
          const label = RUNTIME_LABELS[rt.type] ?? rt.type
          const state = rt.available && rt.authenticated && rt.launchable ? '可启动' : '需处理'
          return `${label}: ${state} · ${rt.diagnosticMessage}`
        })
        .join('\n')
      addActivity({
        type: 'runtime',
        status: result.some((rt) => rt.available && rt.authenticated && rt.launchable) ? 'success' : 'failed',
        message: `本地 Runtime 诊断完成\n${summary || '未检测到 Claude Code / Codex'}`,
      })
    } catch (err) {
      addActivity({
        type: 'runtime',
        status: 'failed',
        message: '本地 Runtime 诊断失败',
        reason: err instanceof Error ? err.message : '诊断失败',
      })
    } finally {
      setRuntimeLoading(false)
      setDiagnosing(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || !selectedAgent || sending) return
    const prompt = input.trim()
    const cwd = activeWorkspace ?? workspaceDirs[0]?.path ?? '.'
    const runtime = getElectronAPI()?.runtime
    setSending(true)
    setInput('')

    if (!selectedRuntimeType) {
      addActivity({
        type: 'runtime',
        status: 'failed',
        message: `[${selectedAgent.name}] ${prompt}`,
        reason: '当前 Agent 暂不支持桌面端一次性消息发送',
      })
      setSending(false)
      return
    }

    if (selectedRuntime && (!selectedRuntime.available || !selectedRuntime.authenticated || !selectedRuntime.launchable)) {
      addActivity({
        type: 'runtime',
        status: 'failed',
        message: `[${selectedAgent.name}] ${prompt}`,
        reason: selectedRuntime.diagnosticMessage || '本地 Runtime 未通过诊断，请先点击诊断',
      })
      setSending(false)
      return
    }

    if (!runtime || typeof runtime.execute !== 'function') {
      addActivity({
        type: 'runtime',
        status: 'failed',
        message: `[${selectedAgent.name}] ${prompt}`,
        reason: '本地 runtime 不可用：未检测到 Electron runtime 桥接，无法执行指令',
      })
      setSending(false)
      return
    }

    try {
      const nativeSessionKey = `${selectedRuntimeType}:${cwd}`
      const result = await runtime.execute({
        runtimeType: selectedRuntimeType,
        prompt,
        nativeSessionId: nativeSessions[nativeSessionKey]?.nativeSessionId ?? null,
      }, cwd)
      if (result.nativeSessionId) {
        setNativeSession({
          runtimeType: selectedRuntimeType,
          runtimeName: selectedAgent.name,
          cwd,
          nativeSessionId: result.nativeSessionId,
        })
      }
      const ok = result.exitCode === 0
      const output = (ok ? result.stdout : result.stderr || result.stdout).trim()
      addActivity({
        type: 'runtime',
        status: ok ? 'success' : 'failed',
        message: ok ? `[${selectedAgent.name}] ${prompt}${output ? `\n${output}` : ''}` : `[${selectedAgent.name}] ${prompt}`,
        reason: ok ? undefined : (output || `执行失败，退出码 ${result.exitCode}`),
      })
    } catch (err) {
      addActivity({
        type: 'runtime',
        status: 'failed',
        message: `[${selectedAgent.name}] ${prompt}`,
        reason: err instanceof Error ? err.message : '执行失败',
      })
    } finally {
      setSending(false)
    }
  }

  const handleStop = async () => {
    const runtime = getElectronAPI()?.runtime
    if (!runtime || typeof runtime.cancel !== 'function') {
      addActivity({
        type: 'runtime',
        status: 'failed',
        message: '停止本地 Runtime 请求失败',
        reason: '当前桌面端未提供停止能力',
      })
      return
    }

    const cancelled = await runtime.cancel()
    addActivity({
      type: 'runtime',
      status: cancelled ? 'success' : 'failed',
      message: cancelled ? '已发送停止请求' : '没有正在执行的本地 Runtime 请求',
    })
    if (cancelled) {
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
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Agent 类型
          <select
            data-testid="desktop-agent-type-select"
            value={selectedAgentId}
            onChange={(event) => {
              const agent = agents.find((item) => item.id === event.target.value)
              if (agent && agent.status === 'connected') enterSession(agent)
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            <option value="" disabled>选择 Agent</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id} disabled={agent.status !== 'connected'}>
                {agent.name}{agent.status === 'connected' ? '' : '（待接入）'}
              </option>
            ))}
          </select>
        </label>
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
              <span className="min-w-0 truncate" title={ws.path}>{ws.path}</span>
            </button>
          ))}
        </div>
        {activities.length > 0 && <ActivityPanel />}
        <PolicyPanel />
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
          <Button
            size="sm"
            variant="outline"
            disabled={diagnosing}
            title="诊断 Claude Code / Codex 的安装、认证和可启动状态"
            onClick={handleDiagnose}
          >
            {diagnosing ? '诊断中' : '诊断'}
          </Button>
          {sending && (
            <Button size="sm" variant="destructive" title="停止当前本地 Runtime 请求" onClick={handleStop}>停止</Button>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            className="flex-1"
            placeholder={selectedAgent ? `输入给 ${selectedAgent.name} 的消息...` : '请先选择 Agent'}
            disabled={!selectedAgent || !selectedRuntimeType || sending}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <Button size="sm" disabled={!selectedAgent || !selectedRuntimeType || !input.trim() || sending} onClick={handleSend}>
            {sending ? '发送中' : '发送'}
          </Button>
        </div>
        {selectedAgent && !selectedRuntimeType && (
          <p className="mt-2 text-xs text-muted-foreground">当前桌面端只支持 Codex 和 Claude Code 的本地一次性消息。</p>
        )}
      </div>
    </section>
  )
}
