'use client'

import { useState, useEffect } from 'react'
import type { Notification } from '@agenthub/shared'

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)

  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    fetch('/api/notifications?unread=true')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setNotifications(data) })
  }, [])

  const markRead = async (ids: string[]) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n))
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded hover:bg-muted" aria-label="通知">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-auto">
          <div className="p-3 border-b border-border flex justify-between items-center">
            <span className="font-medium text-sm">通知</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markRead(notifications.filter(n => !n.read).map(n => n.id))}
                className="text-xs text-primary hover:underline"
              >
                全部已读
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">暂无通知</p>
          ) : (
            <ul>
              {notifications.map(n => (
                <li key={n.id} className={`p-3 border-b border-border text-sm ${n.read ? 'opacity-60' : ''}`}>
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="text-muted-foreground text-xs mt-0.5">{n.body}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
