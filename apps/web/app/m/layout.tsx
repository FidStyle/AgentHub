'use client'

import { useEffect } from 'react'

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-blue-600">AgentHub</h1>
        <nav className="flex gap-3 text-sm">
          <a href="/m" className="text-gray-600 hover:text-blue-600">工作区</a>
          <a href="/m/approve" className="text-gray-600 hover:text-blue-600">审批</a>
        </nav>
      </header>
      <main className="p-4">{children}</main>
    </div>
  )
}
