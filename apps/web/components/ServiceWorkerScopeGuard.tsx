'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const RELOAD_FLAG = 'agenthub:root-sw-cleared'

export function ServiceWorkerScopeGuard() {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname.startsWith('/m')) return
    if (!('serviceWorker' in navigator)) return

    void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      const rootScope = `${window.location.origin}/`
      const rootRegistrations = registrations.filter((registration) => registration.scope === rootScope)
      if (rootRegistrations.length === 0) return

      await Promise.all(rootRegistrations.map((registration) => registration.unregister()))
      if (navigator.serviceWorker.controller && sessionStorage.getItem(RELOAD_FLAG) !== '1') {
        sessionStorage.setItem(RELOAD_FLAG, '1')
        window.location.reload()
      }
    }).catch(() => undefined)
  }, [pathname])

  return null
}
