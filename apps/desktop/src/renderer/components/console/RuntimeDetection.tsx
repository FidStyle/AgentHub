import { Card, CardHeader, CardTitle, CardContent, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, StateCard } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'
import { useEffect, useState } from 'react'
import { getRuntimeApi } from '../../utils/electron-api'

const runtimeLabels: Record<string, { label: string; loginCmd: string }> = {
  claude_code: { label: 'Claude Code', loginCmd: 'claude auth login' },
  codex: { label: 'Codex', loginCmd: 'codex login' },
}

export function RuntimeDetection() {
  const { runtimes, runtimeLoading, setRuntimes, setRuntimeLoading } = useConsoleStore()
  const [pathRuntime, setPathRuntime] = useState<typeof runtimes[number] | null>(null)

  const detect = async () => {
    setRuntimeLoading(true)
    try {
      const runtimeApi = getRuntimeApi()
      if (!runtimeApi) {
        setRuntimes([])
        return
      }

      const result = await runtimeApi.detect()
      setRuntimes(result)
    } finally {
      setRuntimeLoading(false)
    }
  }

  useEffect(() => { detect() }, [])

  if (runtimeLoading) {
    return <StateCard variant="loading" title="正在检测本地 Runtime" description="扫描 Claude Code / Codex 安装状态" />
  }

  if (runtimes.length === 0) {
    return (
      <StateCard variant="runtime-not-installed"
        title={getRuntimeApi() ? undefined : '桌面预加载未连接'}
        description={getRuntimeApi() ? undefined : '请通过 Electron 桌面窗口使用 Runtime 检测；浏览器 5173 仅用于调试渲染界面。'}
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
            <div key={rt.type} className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2.5" data-testid="runtime-status-card">
              <span className={`h-2 w-2 rounded-full ${rt.available ? (rt.authenticated ? 'bg-success' : 'bg-warning') : 'bg-muted-foreground'}`} />
              <span className="text-sm font-medium">{meta.label}</span>
              {rt.available ? (
                <>
                  <span className="text-xs text-muted-foreground">v{rt.version}</span>
                  <span className={`ml-auto text-xs ${rt.authenticated ? 'text-success' : 'text-warning'}`}>
                    {rt.authenticated && rt.launchable ? '可启动' : '需处理'}
                  </span>
                  {(!rt.authenticated || !rt.launchable) && (
                    <span className="text-xs text-muted-foreground">运行 {meta.loginCmd} 后重新检测</span>
                  )}
                </>
              ) : (
                <span className="ml-auto text-xs text-muted-foreground">未安装</span>
              )}
              <p className="basis-full pl-5 text-xs text-muted-foreground break-words">{rt.diagnosticMessage}</p>
              {rt.cliPath && (
                <div className="basis-full pl-5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setPathRuntime(rt)}
                  >
                    查看 CLI 路径
                  </Button>
                </div>
              )}
            </div>
          )
        })}
        <p className="text-xs text-muted-foreground mt-1">
          AgentHub 不托管 API Key，请使用原生 CLI 完成认证
        </p>
      </CardContent>
      <Dialog open={Boolean(pathRuntime)} onClose={() => setPathRuntime(null)} className="w-[min(560px,92vw)]">
        <DialogHeader>
          <DialogTitle>{pathRuntime ? `${runtimeLabels[pathRuntime.type]?.label ?? pathRuntime.type} CLI 路径` : 'CLI 路径'}</DialogTitle>
        </DialogHeader>
        <DialogContent>
          <p className="text-xs text-muted-foreground">路径只用于本机诊断，不会作为密钥或远端连接地址保存。</p>
          <pre className="mt-3 max-h-48 overflow-auto rounded-md border border-border bg-background p-3 text-xs break-all">
            {pathRuntime?.cliPath}
          </pre>
        </DialogContent>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(pathRuntime?.cliPath ?? '').catch(() => undefined)
            }}
          >
            复制路径
          </Button>
          <Button type="button" size="sm" onClick={() => setPathRuntime(null)}>关闭</Button>
        </DialogFooter>
      </Dialog>
    </Card>
  )
}
