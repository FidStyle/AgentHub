import { Badge, Button, Card, CardContent } from '@agenthub/ui'
import { useConsoleStore, type ActivityEntry } from '../../store/console-store'

function parseRuntimeSession(entry: ActivityEntry) {
  const match = entry.message.match(/^\[(Codex|Claude Code)]\s+([^\n]+)/)
  if (!match) return null
  return {
    agentName: match[1],
    prompt: match[2],
    detail: entry.message,
  }
}

export function DesktopSessionsPage() {
  const { activities, agents, enterSession } = useConsoleStore()
  const sessions = activities
    .map((entry) => ({ entry, parsed: parseRuntimeSession(entry) }))
    .filter((item): item is { entry: ActivityEntry; parsed: NonNullable<ReturnType<typeof parseRuntimeSession>> } => Boolean(item.parsed))
    .slice()
    .reverse()

  return (
    <section data-testid="desktop-sessions-page" className="flex-1 h-full overflow-y-auto p-6">
      <header className="mb-4">
        <h1 className="text-base font-semibold">最近会话</h1>
        <p className="mt-1 text-xs text-muted-foreground">显示本机 Codex / Claude Code 的轻量消息记录，完整工作区历史仍在 Web 工作台查看。</p>
      </header>
      {sessions.length === 0 ? (
        <div data-testid="desktop-empty-sessions" className="rounded-md border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">暂无本地 Runtime 会话</p>
          <p className="mt-1 text-xs text-muted-foreground">在“本地工作区”选择 Codex 或 Claude Code 发送消息后，这里会显示最近记录。</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sessions.map(({ entry, parsed }) => {
            const agent = agents.find((item) => item.name === parsed.agentName)
            return (
              <Card key={entry.id} data-testid="desktop-recent-session">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={entry.status === 'success' ? 'default' : entry.status === 'failed' ? 'destructive' : 'secondary'}>
                      {entry.status === 'success' ? '成功' : entry.status === 'failed' ? '失败' : '执行中'}
                    </Badge>
                    <span className="text-sm font-medium">{parsed.agentName}</span>
                    <span className="text-xs text-muted-foreground">{entry.time}</span>
                  </div>
                  <p className="line-clamp-2 break-words text-sm">{parsed.prompt}</p>
                  {entry.reason && <p className="line-clamp-2 break-words text-xs text-destructive">{entry.reason}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => agent && enterSession(agent)} disabled={!agent || agent.status !== 'connected'}>
                      回到会话
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}
