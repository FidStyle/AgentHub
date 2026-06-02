import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ServiceWorkerScopeGuard } from '@/components/ServiceWorkerScopeGuard'

export const metadata: Metadata = {
  title: 'AgentHub 工作台',
  description: '多 Agent 协作平台',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    shortcut: '/icon-192.png',
    apple: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#2563eb',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <ServiceWorkerScopeGuard />
        {children}
      </body>
    </html>
  )
}
