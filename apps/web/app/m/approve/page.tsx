'use client'

import { useEffect, useState } from 'react'
import type { Notification } from '@agenthub/shared'

export default function MobileApprovePage() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    fetch('/api/notifications?unread=true')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setNotifications(d) })
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

  return (
    <div>
      <h2 className="text-lg font-medium mb-4">待审批动作</h2>

      {pending.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">暂无待审批项</p>
      ) : (
        <div className="space-y-3">
          {pending.map(n => (
            <div key={n.id} className="bg-white border rounded-lg p-4">
              <p className="font-medium text-sm">{n.title}</p>
              {n.body && <p className="text-xs text-gray-500 mt-1">{n.body}</p>}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => n.ref_id && handleApprove(n.ref_id, true)}
                  className="flex-1 py-2 bg-green-600 text-white rounded text-sm"
                >
                  批准
                </button>
                <button
                  onClick={() => n.ref_id && handleApprove(n.ref_id, false)}
                  className="flex-1 py-2 bg-red-600 text-white rounded text-sm"
                >
                  拒绝
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
