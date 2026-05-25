import { Card, CardHeader, CardTitle, CardContent, Button, StateCard } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'
import { useEffect } from 'react'

const runtimeLabels: Record<string, { label: string; loginCmd: string }> = {
  claude_code: { label: 'Claude Code', loginCmd: 'claude login' },
  codex: { label: 'Codex', loginCmd: 'codex auth' },
}

export function RuntimeDetection() {
  const { runtimes, runtimeLoading, setRuntimes, setRuntimeLoading } = useConsoleStore()

  const detect = async () => {
    setRuntimeLoading(true)
    const result = await window.electronAPI.runtime.detect()
    setRuntimes(result)
    setRuntimeLoading(false)
  }

  useEffect(() => { detect() }, [])

  if (runtimeLoading) {
    return <StateCard variant="loading" title="正在检测本地 Runtime" description="扫描 Claude Code / Codex 安装状态" />
  }

  if (runtimes.length === 0) {
    return (
      <StateCard variant="runtime-not-installed"
        action={<Button variant="outline" size="sm" onClick={detect}>重新检测</Button>} />
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Runtime 检测</CardTitle>
          <Button variant="outline" size="sm" onClick={detect}>重新检测</Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {runtimes.map((rt) => {
          const meta = runtimeLabels[rt.type] ?? { label: rt.type, loginCmd: '' }
          return (
            <div key={rt.type} className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5" data-testid="runtime-status-card">
              <span className={`h-2 w-2 rounded-full ${rt.available ? (rt.authenticated ? 'bg-success' : 'bg-warning') : 'bg-muted-foreground'}`} />
              <span className="text-sm font-medium">{meta.label}</span>
              {rt.available ? (
                <>
                  <span className="text-xs text-muted-foreground">v{rt.version}</span>
                  <span className={`ml-auto text-xs ${rt.authenticated ? 'text-success' : 'text-warning'}`}>
                    {rt.authenticated ? '已认证' : '未登录'}
                  </span>
                  {!rt.authenticated && (
                    <span className="text-xs text-muted-foreground">运行 {meta.loginCmd}</span>
                  )}
                </>
              ) : (
                <span className="ml-auto text-xs text-muted-foreground">未安装</span>
              )}
            </div>
          )
        })}
        <p className="text-xs text-muted-foreground mt-1">
          AgentHub 不托管 API Key，请使用原生 CLI 完成认证
        </p>
      </CardContent>
    </Card>
  )
}
