import { useEffect, useState } from 'react'
import { Card, CardContent, Button } from '@agenthub/ui'
import { useConsoleStore } from '../../store/console-store'
import { useDesktopAuth } from '../../hooks/useDesktopAuth'
import { useOpenWebWorkspace } from '../../hooks/useOpenWebWorkspace'
import { getRuntimeApi, type DesktopWorkspaceRoot } from '../../utils/electron-api'

export function DesktopSettingsPage() {
  const { deviceName, userName, connectionState, webWorkspaceError, authError, user } = useConsoleStore()
  const { handleGitHubLogin, handleLogout } = useDesktopAuth()
  const { openWebWorkspace } = useOpenWebWorkspace()
  const [workspaceRoots, setWorkspaceRoots] = useState<DesktopWorkspaceRoot[]>([])
  const [workspaceRootInput, setWorkspaceRootInput] = useState('~/.agenthub/cloud-workspaces')
  const [workspaceRootStatus, setWorkspaceRootStatus] = useState<string | null>(null)

  async function refreshWorkspaceRoots() {
    const runtime = getRuntimeApi()
    if (!runtime?.workspaceRoots) {
      setWorkspaceRootStatus('当前 Desktop 环境不支持授权目录管理。')
      return
    }
    const roots = await runtime.workspaceRoots()
    setWorkspaceRoots(Array.isArray(roots) ? roots : [])
  }

  useEffect(() => {
    void refreshWorkspaceRoots()
  }, [])

  async function addWorkspaceRoot(root: string) {
    const runtime = getRuntimeApi()
    if (!runtime?.addWorkspaceRoot) {
      setWorkspaceRootStatus('当前 Desktop 环境不支持添加授权目录。')
      return
    }
    const trimmed = root.trim()
    if (!trimmed) {
      setWorkspaceRootStatus('请输入要授权的本地目录。')
      return
    }
    const roots = await runtime.addWorkspaceRoot(trimmed)
    setWorkspaceRoots(Array.isArray(roots) ? roots : [])
    setWorkspaceRootStatus('已更新 Desktop 授权目录。')
  }

  async function chooseWorkspaceRoot() {
    const runtime = getRuntimeApi()
    if (!runtime?.chooseWorkspaceRoot) {
      setWorkspaceRootStatus('当前 Desktop 环境不支持目录选择器，请手动输入路径。')
      return
    }
    const roots = await runtime.chooseWorkspaceRoot()
    setWorkspaceRoots(Array.isArray(roots) ? roots : [])
    setWorkspaceRootStatus('已同步 Desktop 授权目录。')
  }

  return (
    <section data-testid="desktop-settings-page" className="flex-1 h-full overflow-y-auto">
      <header className="px-6 py-4 border-b border-border">
        <h1 className="text-base font-semibold">设置</h1>
      </header>
      <div className="p-6 flex flex-col gap-4">
        <Card data-testid="desktop-settings-item-account">
          <CardContent className="py-4">
            <h3 className="text-sm font-medium mb-2">账号</h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{userName}</span>
              <Button
                variant="outline"
                size="sm"
                data-auth-action={user ? 'logout' : 'github-login'}
                onClick={user ? handleLogout : handleGitHubLogin}
              >
                {user ? '退出登录' : 'GitHub 登录'}
              </Button>
            </div>
            {authError && (
              <p className="text-xs text-destructive mt-2">{authError}</p>
            )}
          </CardContent>
        </Card>
        <Card data-testid="desktop-settings-item-device">
          <CardContent className="py-4">
            <h3 className="text-sm font-medium mb-2">设备信息</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">设备名</dt>
              <dd>{deviceName}</dd>
              <dt className="text-muted-foreground">云端连接</dt>
              <dd>{connectionState === 'connected' ? '在线' : '未连接'}</dd>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              云端连接用于本机 Runtime 和后端之间的实时转发，和 GitHub 账号登录是两个状态。
            </p>
          </CardContent>
        </Card>
        <Card data-testid="desktop-settings-item-workspace">
          <CardContent className="py-4">
            <h3 className="text-sm font-medium mb-2">Web 工作台</h3>
            <Button variant="outline" size="sm" onClick={openWebWorkspace}>打开 Web 工作台</Button>
            {webWorkspaceError && (
              <div data-testid="web-workspace-error" className="mt-2 rounded-md border border-destructive/50 bg-destructive/5 p-2.5">
                <p className="text-xs text-destructive">{webWorkspaceError}</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card data-testid="desktop-settings-item-workspace-roots">
          <CardContent className="py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">本地授权目录</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Web 创建“本地桌面”工作区时，只能选择这里列出的目录；云端工作区默认使用 ~/.agenthub/cloud-workspaces。
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void refreshWorkspaceRoots()}>
                刷新
              </Button>
            </div>
            <div className="space-y-2">
              {workspaceRoots.length === 0 ? (
                <p className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">暂无已授权目录。</p>
              ) : workspaceRoots.map((root) => (
                <div key={root.path} className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                  <span className="min-w-0 truncate font-mono">{root.path}</span>
                  <span className={root.healthy ? 'shrink-0 text-green-600' : 'shrink-0 text-destructive'}>
                    {root.healthy ? '可用' : '不可用'}
                    {root.source === 'default' ? ' · 默认' : root.source === 'env' ? ' · 环境变量' : root.source === 'user' ? ' · 用户添加' : ''}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={workspaceRootInput}
                onChange={(event) => setWorkspaceRootInput(event.target.value)}
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="~/.agenthub/cloud-workspaces"
              />
              <Button variant="outline" size="sm" onClick={() => void addWorkspaceRoot(workspaceRootInput)}>
                添加目录
              </Button>
              <Button variant="outline" size="sm" onClick={() => void chooseWorkspaceRoot()}>
                选择目录
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => void addWorkspaceRoot('~/.agenthub/cloud-workspaces')}>
                授权默认云端目录
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void addWorkspaceRoot('~/.agenthub/workspaces/default')}>
                授权默认本地目录
              </Button>
            </div>
            {workspaceRootStatus && <p className="mt-2 text-xs text-muted-foreground">{workspaceRootStatus}</p>}
          </CardContent>
        </Card>
        <Card data-testid="desktop-settings-item-diagnostics">
          <CardContent className="py-4">
            <h3 className="text-sm font-medium mb-2">诊断</h3>
            <p className="text-xs text-muted-foreground">如遇问题，请检查 Connector 服务是否正常运行。</p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
