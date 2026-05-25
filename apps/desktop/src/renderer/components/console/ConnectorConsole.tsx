import { StatusBar } from './StatusBar'
import { WorkspaceBinding } from './WorkspaceBinding'
import { RuntimeDetection } from './RuntimeDetection'
import { ActivityPanel } from './ActivityPanel'
import { ApprovalPanel } from './ApprovalPanel'

export function ConnectorConsole() {
  return (
    <div data-testid="connector-console" className="flex flex-col h-screen bg-background text-foreground">
      <StatusBar />
      <main className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-[720px] flex flex-col gap-4">
          <WorkspaceBinding />
          <RuntimeDetection />
          <ActivityPanel />
          <ApprovalPanel />
        </div>
      </main>
      <footer className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
        AgentHub Desktop Connector v0.13.0
      </footer>
    </div>
  )
}
