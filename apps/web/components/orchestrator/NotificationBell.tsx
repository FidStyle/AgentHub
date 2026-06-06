'use client'

import { useState, useEffect } from 'react'
import type { Notification } from '@agenthub/shared'
import { Badge, Button } from '@agenthub/ui'
import { Bell } from 'lucide-react'

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  const unreadCount = notifications.filter(n => !n.read).length

  const loadNotifications = () => {
    setError(null)
    fetch('/api/notifications?unread=true')
      .then((r) => {
        if (!r.ok) throw new Error('加载通知失败')
        return r.json()
      })
      .then(data => { if (Array.isArray(data)) setNotifications(data) })
      .catch((e) => setError(e instanceof Error ? e.message : '加载通知失败'))
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  const markRead = async (ids: string[]) => {
    if (ids.length === 0) return
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n))
  }

  const approveAction = async (notification: Notification, approved: boolean) => {
    if (!notification.ref_id) return
    setActingId(notification.id)
    setError(null)
    try {
      const res = await fetch(`/api/actions/${notification.ref_id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || '处理授权失败')
      await markRead([notification.id])
      setNotifications(prev => prev.filter(n => n.id !== notification.id))
      window.dispatchEvent(new CustomEvent('actions:changed', { detail: { actionId: notification.ref_id } }))
    } catch (e) {
      setError(e instanceof Error ? e.message : '处理授权失败')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="notification-bell"
        onClick={() => {
          setOpen(!open)
          if (!open) loadNotifications()
        }}
        className="relative rounded-md p-2 hover:bg-muted"
        aria-label="通知"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span data-testid="notification-unread-count" className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div data-testid="notification-menu" className="absolute right-0 top-10 z-50 max-h-96 w-80 overflow-auto rounded-lg border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border p-3">
            <span className="text-sm font-medium">通知</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markRead(notifications.filter(n => !n.read).map(n => n.id))}
                className="text-xs text-primary hover:underline"
              >
                全部已读
              </button>
            )}
          </div>
          {error && <p className="border-b border-border p-3 text-xs text-destructive">{error}</p>}
          {notifications.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">暂无通知</p>
          ) : (
            <ul>
              {notifications.map(n => (
                <li key={n.id} className={`border-b border-border p-3 text-sm ${n.read ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 font-medium">{n.title}</p>
                    {n.type === 'approval_required' && <Badge variant="warning">待授权</Badge>}
                  </div>
                  {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                  {n.type === 'approval_required' && n.ref_type === 'action' && n.ref_id && (
                    <div className="mt-3 flex flex-col gap-2">
                      <Button
                        size="sm"
                        className="w-full px-1.5"
                        disabled={actingId === n.id}
                        onClick={() => approveAction(n, true)}
                      >
                        授权本次
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full px-1.5"
                        disabled={actingId === n.id}
                        onClick={() => approveAction(n, false)}
                      >
                        取消
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
