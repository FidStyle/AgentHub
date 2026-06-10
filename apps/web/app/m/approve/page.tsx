'use client'

import { useEffect, useState } from 'react'
import { Button, Card, CardContent, Badge, StateCard } from '@agenthub/ui'
import type { Notification } from '@agenthub/shared'

export default function MobileApprovePage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/notifications?unread=true')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setNotifications(d) })
      .finally(() => setLoading(false))
  }, [])

  const handleApprove = async (actionId: string, approved: boolean) => {
    const res = await fetch(`/api/actions/${actionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved }),
    })
    if (res.ok) {
      const noti = notifications.find(n => n.ref_id === actionId)
      if (noti) {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [noti.id] }),
        })
      }
      setNotifications(prev => prev.filter(n => n.ref_id !== actionId))
    }
  }

  const pending = notifications.filter(n => n.type === 'approval_required')

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">远程监督与授权</h2>
        <StateCard variant="loading" />
      </div>
    )
  }

  if (pending.length === 0) {
    return <StateCard variant="empty" title="暂无需要授权的动作" description="当前没有需要远程监督的本机执行操作" />
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">远程监督与授权</h2>
      {pending.map(n => (
        <Card key={n.id}>
          <CardContent className="p-4">
            <div className="flex items-start gap-2 mb-2">
              <Badge variant="warning">需要授权</Badge>
              <p className="text-sm font-medium flex-1 truncate">{n.title}</p>
            </div>
            {n.body && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{n.body}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => n.ref_id && handleApprove(n.ref_id, true)} className="flex-1">
                授权本次
              </Button>
              <Button size="sm" variant="outline" onClick={() => n.ref_id && handleApprove(n.ref_id, false)} className="flex-1">
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
