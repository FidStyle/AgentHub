export function DesktopSessionsPage() {
  return (
    <section data-testid="desktop-sessions-page" className="flex-1 h-full overflow-y-auto p-6">
      <header className="mb-4">
        <h1 className="text-base font-semibold">最近会话</h1>
      </header>
      <div data-testid="desktop-empty-sessions" className="text-center py-12">
        <p className="text-sm text-muted-foreground">暂无会话记录</p>
      </div>
    </section>
  )
}
