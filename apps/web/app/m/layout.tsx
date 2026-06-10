'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === '/m/login'

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/m/' })
    }
  }, [])

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto" data-testid="mobile-session">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-base font-semibold text-primary">AgentHub</h1>
        <nav className="flex gap-3 text-xs">
          {isLogin ? (
            <a href="/" className="text-muted-foreground hover:text-primary transition-colors">Web 端</a>
          ) : (
            <>
              <a href="/m" className="text-muted-foreground hover:text-primary transition-colors">工作区</a>
              <a href="/m/approve" className="text-muted-foreground hover:text-primary transition-colors">授权</a>
            </>
          )}
        </nav>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}
