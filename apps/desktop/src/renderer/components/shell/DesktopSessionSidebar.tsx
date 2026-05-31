import { Badge } from '@agenthub/ui'
import { FolderOpen, MessageSquare, Bot, ShieldCheck, Settings, Github } from 'lucide-react'
import { useConsoleStore, type DesktopPage } from '../../store/console-store'
import { useDesktopAuth } from '../../hooks/useDesktopAuth'

const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  workspace: FolderOpen,
  sessions: MessageSquare,
  agents: Bot,
  policy: ShieldCheck,
  settings: Settings,
}

export function DesktopSessionSidebar() {
  const { workspaceDirs, authorizationRecords, activities, connectionState, currentPage, navigateTo, authError, user } = useConsoleStore()
  const { handleGitHubLogin, handleLogout } = useDesktopAuth()
  const channelStateLabel = connectionState === 'connected' ? '云端连接在线' : '云端连接断开'
  const localSessionCount = activities.filter((entry) => /^\[(Codex|Claude Code)]\s+/.test(entry.message)).length

  return (
    <aside data-testid="desktop-session-sidebar" className="flex flex-col w-56 border-r border-border bg-card h-full">
      <div className="px-3 py-3 border-b border-border">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">导航</h2>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1">
        <SidebarItem testId="desktop-nav-workspace" label="本地工作区" count={workspaceDirs.length} page="workspace" currentPage={currentPage} onNavigate={navigateTo} />
        <SidebarItem testId="desktop-nav-sessions" label="最近会话" count={localSessionCount} page="sessions" currentPage={currentPage} onNavigate={navigateTo} />
        <SidebarItem testId="desktop-nav-agents" label="本地 Agent" count={2} page="agents" currentPage={currentPage} onNavigate={navigateTo} />
        <SidebarItem testId="desktop-nav-policy" label="本机策略" count={authorizationRecords.length} highlight={authorizationRecords.length > 0} page="policy" currentPage={currentPage} onNavigate={navigateTo} />
        <SidebarItem testId="desktop-nav-settings" label="设置" page="settings" currentPage={currentPage} onNavigate={navigateTo} />
      </nav>
      <div className="px-3 py-2 border-t border-border flex flex-col gap-2">
        <button
          data-auth-action={user ? 'logout' : 'github-login'}
          onClick={user ? handleLogout : handleGitHubLogin}
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 w-full text-left"
        >
          <Github className="h-3.5 w-3.5" />
          {user ? '退出登录' : 'GitHub 登录'}
        </button>
        {authError && (
          <p className="text-xs text-destructive px-2.5">{authError}</p>
        )}
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connectionState === 'connected' ? 'bg-success' : 'bg-destructive'}`} />
          <span className="text-xs text-muted-foreground">{channelStateLabel}</span>
        </div>
      </div>
    </aside>
  )
}

function SidebarItem({ testId, label, count, highlight, page, currentPage, onNavigate }: {
  testId: string
  label: string
  count?: number
  highlight?: boolean
  page: DesktopPage
  currentPage: DesktopPage
  onNavigate: (page: DesktopPage) => void
}) {
  const active = currentPage === page
  const Icon = NAV_ICONS[page]
  return (
    <button
      data-testid={testId}
      aria-current={active ? 'page' : undefined}
      onClick={() => onNavigate(page)}
      className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm w-full text-left ${active ? 'bg-muted font-medium' : 'hover:bg-muted/50'}`}
    >
      <span className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        {label}
      </span>
      {count != null && count > 0 && (
        <Badge variant={highlight ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0">{count}</Badge>
      )}
    </button>
  )
}
