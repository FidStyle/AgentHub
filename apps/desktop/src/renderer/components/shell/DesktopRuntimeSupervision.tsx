import { Badge, Card, CardContent, CardHeader, CardTitle, RuntimeIcon, type RuntimeKind } from '@agenthub/ui'
import { useConsoleStore, type AgentConfig, type RuntimeInfo } from '../../store/console-store'

const RUNTIME_LABELS: Record<string, string> = {
  claude_code: 'Claude Code',
  codex: 'Codex',
}

function runtimeKind(id: string): RuntimeKind {
  if (id === 'codex' || id === 'claude_code' || id === 'opencode' || id === 'github') return id
  return 'github'
}

function runtimeReady(runtime: RuntimeInfo | undefined) {
  return Boolean(runtime?.available && runtime.authenticated && runtime.launchable)
}

function roleHealth(agent: AgentConfig, runtime: RuntimeInfo | undefined) {
  if (agent.id !== 'codex' && agent.id !== 'claude_code') return { label: '待接入', variant: 'secondary' as const }
  if (runtimeReady(runtime)) return { label: '可调度', variant: 'default' as const }
  return { label: '不可调度', variant: 'secondary' as const }
}

export function DesktopRuntimeSupervision() {
  const { agents, runtimes, nativeSessions } = useConsoleStore()
  const runtimeRows = runtimes.filter((runtime) => runtime.type === 'claude_code' || runtime.type === 'codex')
  const sessionRows = Object.values(nativeSessions)

  return (
    <Card data-testid="desktop-runtime-supervision">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Runtime 监督</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <section>
          <h3 className="text-xs font-medium text-muted-foreground">机器能力</h3>
          <div className="mt-2 space-y-2">
            {runtimeRows.length === 0 ? (
              <p className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                尚未完成 Claude Code / Codex 诊断，请先重新检测本地 Runtime。
              </p>
            ) : runtimeRows.map((runtime) => (
              <div key={runtime.type} className="rounded-md border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <RuntimeIcon runtimeKind={runtimeKind(runtime.type)} size="sm" />
                  <span className="text-sm font-medium">{RUNTIME_LABELS[runtime.type] ?? runtime.type}</span>
                  <Badge className="ml-auto" variant={runtimeReady(runtime) ? 'default' : 'secondary'}>
                    {runtimeReady(runtime) ? 'ready' : '需处理'}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground break-words">{runtime.diagnosticMessage}</p>
                <p className="mt-1 truncate text-[10px] text-muted-foreground" title={runtime.cliPath ?? undefined}>
                  {runtime.version ? `版本 ${runtime.version}` : '版本未知'}
                  {runtime.cliPath ? ` · ${runtime.cliPath}` : ''}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-medium text-muted-foreground">角色运行时健康</h3>
          <div className="mt-2 space-y-2">
            {agents.map((agent) => {
              const runtime = runtimes.find((item) => item.type === agent.id)
              const health = roleHealth(agent, runtime)
              return (
                <div key={agent.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                  <RuntimeIcon runtimeKind={runtimeKind(agent.id)} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm">{agent.name}</span>
                  <Badge variant={health.variant}>{health.label}</Badge>
                </div>
              )
            })}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-medium text-muted-foreground">Native Session 续接</h3>
          <div className="mt-2 space-y-2">
            {sessionRows.length === 0 ? (
              <p className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                暂无可续接的本地 CLI 会话。发送成功后会显示同一 runtime/cwd 的 native session。
              </p>
            ) : sessionRows.map((session) => (
              <div key={session.key} className="rounded-md border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <RuntimeIcon runtimeKind={runtimeKind(session.runtimeType)} size="sm" />
                  <span className="text-sm font-medium">{session.runtimeName}</span>
                  <Badge className="ml-auto" variant="default">可续接</Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground" title={session.cwd}>{session.cwd}</p>
                <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground" title={session.nativeSessionId}>
                  {session.nativeSessionId}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">最近更新 {session.updatedAt}</p>
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  )
}
