import { useState, useEffect } from 'react'
import '../globals.css'
import { getRuntimeApi } from '../utils/electron-api'

interface RuntimeInfo {
  type: string
  available: boolean
  version: string | null
  authenticated: boolean
}

const runtimeMeta: Record<string, { label: string; loginCmd: string; installUrl: string }> = {
  claude_code: {
    label: 'Claude Code',
    loginCmd: 'claude login',
    installUrl: 'https://docs.anthropic.com/claude-code',
  },
  codex: {
    label: 'Codex (OpenAI)',
    loginCmd: 'codex auth',
    installUrl: 'https://github.com/openai/codex',
  },
}

export function RuntimeConfigPage() {
  const [runtimes, setRuntimes] = useState<RuntimeInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    detectRuntimes()
  }, [])

  const detectRuntimes = async () => {
    setLoading(true)
    try {
      const runtimeApi = getRuntimeApi()
      if (!runtimeApi) {
        setRuntimes([])
        return
      }

      const result = await runtimeApi.detect()
      setRuntimes(result)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12" data-testid="runtime-status-card">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-info border-t-transparent mb-3" />
        <p className="text-sm text-muted-foreground">正在检测本地 Runtime...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="connector-console">
      <p className="text-sm text-muted-foreground">
        本地 Runtime 检测与认证引导。AgentHub 不托管 API Key，请使用原生 CLI 完成认证。
      </p>
      <div className="flex flex-col gap-3">
        {runtimes.map((rt) => (
          <RuntimeCard key={rt.type} runtime={rt} />
        ))}
        {runtimes.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-6 text-center" data-testid="state-card-runtime-not-installed">
            <p className="text-sm font-medium mb-1">{getRuntimeApi() ? '未检测到任何 Runtime' : '桌面预加载未连接'}</p>
            <p className="text-xs text-muted-foreground">
              {getRuntimeApi() ? '请安装 Claude Code 或 Codex CLI 后重新检测' : '请通过 Electron 桌面窗口使用 Runtime 检测；浏览器 5173 仅用于调试渲染界面。'}
            </p>
          </div>
        )}
      </div>
      <button
        onClick={detectRuntimes}
        className="self-start rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted transition-colors"
      >
        重新检测
      </button>
    </div>
  )
}

function RuntimeCard({ runtime }: { runtime: RuntimeInfo }) {
  const meta = runtimeMeta[runtime.type] ?? { label: runtime.type, loginCmd: '', installUrl: '' }

  if (!runtime.available) {
    return (
      <div className="rounded-lg border border-border bg-card p-4" data-testid="state-card-runtime-not-installed">
        <div className="flex items-center gap-2 mb-2">
          <span className="h-2 w-2 rounded-full bg-muted-foreground" />
          <span className="text-sm font-medium">{meta.label}</span>
          <span className="ml-auto text-xs text-muted-foreground">未安装</span>
        </div>
        <p className="text-xs text-muted-foreground">
          请安装 {meta.label} CLI 后重新检测。
        </p>
      </div>
    )
  }

  if (!runtime.authenticated) {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/5 p-4" data-testid="state-card-runtime-not-logged-in">
        <div className="flex items-center gap-2 mb-2">
          <span className="h-2 w-2 rounded-full bg-warning" />
          <span className="text-sm font-medium">{meta.label}</span>
          <span className="ml-auto text-xs text-warning">未登录</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          请在终端中运行以下命令完成认证：
        </p>
        <code className="block rounded bg-muted px-2 py-1 text-xs font-mono">
          {meta.loginCmd}
        </code>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-success/30 bg-success/5 p-4" data-testid="runtime-status-card">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-success" />
        <span className="text-sm font-medium">{meta.label}</span>
        <span className="ml-auto text-xs text-success">已就绪</span>
      </div>
      {runtime.version && (
        <p className="text-xs text-muted-foreground mt-1">版本: {runtime.version}</p>
      )}
    </div>
  )
}
