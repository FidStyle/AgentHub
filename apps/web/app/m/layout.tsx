'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle, ShieldCheck, Workflow } from 'lucide-react'

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === '/m/login'

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/m/' })
    }
  }, [])

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-background text-foreground" data-testid="mobile-session">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-primary">
            <Workflow className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">AgentHub</h1>
            <p className="truncate text-[11px] text-muted-foreground">轻量 IM · 授权 · 产物预览</p>
          </div>
        </div>
        <nav className="flex items-center gap-1 text-xs">
          {isLogin ? (
            <a href="/" className="rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Web 端</a>
          ) : (
            <>
              <a href="/m" className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <MessageCircle className="h-3.5 w-3.5" />
                工作区
              </a>
              <a href="/m/approve" className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                授权
              </a>
            </>
          )}
        </nav>
      </header>
      <main className="min-h-0 flex-1 p-3">{children}</main>
    </div>
  )
}
