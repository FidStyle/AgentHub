import { DesktopSessionSidebar } from './DesktopSessionSidebar'
import { DesktopAgentSession } from './DesktopAgentSession'
import { DesktopAgentConfigPanel } from './DesktopAgentConfigPanel'
import { DesktopAgentConfigPage } from './DesktopAgentConfigPage'
import { DesktopPolicyPage } from './DesktopPolicyPage'
import { DesktopSettingsPage } from './DesktopSettingsPage'
import { DesktopLogsPage } from './DesktopLogsPage'
import { StatusBar } from '../console/StatusBar'
import { useConsoleStore } from '../../store/console-store'
import { getRuntimeApi } from '../../utils/electron-api'
import { useEffect } from 'react'

function eventText(event: unknown) {
  if (!event || typeof event !== 'object') return null
  const record = event as { type?: unknown; runtimeType?: unknown; cwd?: unknown; error?: unknown; summary?: unknown; roots?: unknown }
  if (record.type === 'workspace_roots') {
    return { status: 'success' as const, message: '已同步 Desktop 授权工作目录' }
  }
  if (record.type === 'started') {
    const runtime = typeof record.runtimeType === 'string' ? record.runtimeType : '本地 Runtime'
    const cwd = typeof record.cwd === 'string' ? `：${record.cwd}` : ''
    return { status: 'pending' as const, message: `收到 Web 转发请求，正在启动 ${runtime}${cwd}` }
  }
  if (record.type === 'completed') {
    return { status: 'success' as const, message: '本地 Runtime 执行完成' }
  }
  if (record.type === 'failed') {
    return {
      status: 'failed' as const,
      message: '本地 Runtime 执行失败',
      reason: typeof record.error === 'string' ? record.error : undefined,
    }
  }
  return null
}

export function DesktopMainShell() {
  const currentPage = useConsoleStore(s => s.currentPage)
  const addActivity = useConsoleStore(s => s.addActivity)
  const setWorkspaceDirs = useConsoleStore(s => s.setWorkspaceDirs)

  useEffect(() => {
    const runtime = getRuntimeApi()
    if (!runtime?.onHostEvent) return
    return runtime.onHostEvent((event) => {
      if (event && typeof event === 'object') {
        const roots = (event as { type?: unknown; roots?: unknown }).roots
        if ((event as { type?: unknown }).type === 'workspace_roots' && Array.isArray(roots)) {
          setWorkspaceDirs(roots.flatMap((root) => {
            if (!root || typeof root !== 'object') return []
            const record = root as { path?: unknown; healthy?: unknown }
            if (typeof record.path !== 'string') return []
            return [{ path: record.path, healthy: record.healthy === true }]
          }))
        }
      }
      const text = eventText(event)
      if (text) {
        addActivity({
          type: 'runtime',
          status: text.status,
          message: text.message,
          reason: text.reason,
        })
      }
    }) ?? undefined
  }, [addActivity, setWorkspaceDirs])

  return (
    <div data-testid="desktop-main-shell" className="flex flex-col h-screen bg-background text-foreground">
      <StatusBar />
      <div className="flex flex-1 overflow-hidden">
        <DesktopSessionSidebar />
        {currentPage === 'workspace' && (
          <>
            <DesktopAgentSession />
            <DesktopAgentConfigPanel />
          </>
        )}
        {currentPage === 'agents' && <DesktopAgentConfigPage />}
        {currentPage === 'policy' && <DesktopPolicyPage />}
        {currentPage === 'logs' && <DesktopLogsPage />}
        {currentPage === 'settings' && <DesktopSettingsPage />}
      </div>
    </div>
  )
}
