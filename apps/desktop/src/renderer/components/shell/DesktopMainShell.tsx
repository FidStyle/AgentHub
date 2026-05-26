import { DesktopSessionSidebar } from './DesktopSessionSidebar'
import { DesktopAgentSession } from './DesktopAgentSession'
import { DesktopAgentConfigPanel } from './DesktopAgentConfigPanel'
import { DesktopAgentConfigPage } from './DesktopAgentConfigPage'
import { DesktopApprovalsPage } from './DesktopApprovalsPage'
import { DesktopSettingsPage } from './DesktopSettingsPage'
import { DesktopSessionsPage } from './DesktopSessionsPage'
import { StatusBar } from '../console/StatusBar'
import { useConsoleStore } from '../../store/console-store'

export function DesktopMainShell() {
  const currentPage = useConsoleStore(s => s.currentPage)

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
        {currentPage === 'sessions' && <DesktopSessionsPage />}
        {currentPage === 'agents' && <DesktopAgentConfigPage />}
        {currentPage === 'approvals' && <DesktopApprovalsPage />}
        {currentPage === 'settings' && <DesktopSettingsPage />}
      </div>
    </div>
  )
}
