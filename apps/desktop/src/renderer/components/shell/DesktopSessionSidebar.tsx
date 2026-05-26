import { Badge } from '@agenthub/ui'
import { useConsoleStore, type DesktopPage } from '../../store/console-store'

export function DesktopSessionSidebar() {
  const { workspaceDirs, approvals, connectionState, currentPage, navigateTo } = useConsoleStore()
  const stateLabel = connectionState === 'connected' ? '在线' : '离线'

  return (
    <aside data-testid="desktop-session-sidebar" className="flex flex-col w-56 border-r border-border bg-card h-full">
      <div className="px-3 py-3 border-b border-border">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">导航</h2>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1">
        <SidebarItem testId="desktop-nav-workspace" label="本地工作区" count={workspaceDirs.length} page="workspace" currentPage={currentPage} onNavigate={navigateTo} />
        <SidebarItem testId="desktop-nav-sessions" label="最近会话" count={0} page="sessions" currentPage={currentPage} onNavigate={navigateTo} />
        <SidebarItem testId="desktop-nav-agents" label="本地 Agent" count={2} page="agents" currentPage={currentPage} onNavigate={navigateTo} />
        <SidebarItem testId="desktop-nav-approvals" label="待审批" count={approvals.length} highlight={approvals.length > 0} page="approvals" currentPage={currentPage} onNavigate={navigateTo} />
        <SidebarItem testId="desktop-nav-settings" label="设置" page="settings" currentPage={currentPage} onNavigate={navigateTo} />
      </nav>
      <div className="px-3 py-2 border-t border-border flex flex-col gap-2">
        <button data-auth-action="github-login" className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 w-full text-left">
          GitHub 登录
        </button>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connectionState === 'connected' ? 'bg-success' : 'bg-destructive'}`} />
          <span className="text-xs text-muted-foreground">{stateLabel}</span>
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
  return (
    <button
      data-testid={testId}
      aria-current={active ? 'page' : undefined}
      onClick={() => onNavigate(page)}
      className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm w-full text-left ${active ? 'bg-muted font-medium' : 'hover:bg-muted/50'}`}
    >
      <span>{label}</span>
      {count != null && count > 0 && (
        <Badge variant={highlight ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0">{count}</Badge>
      )}
    </button>
  )
}
