import type { RuntimeGatewayEvent } from '@agenthub/shared'

// Terminal runtime states must surface a clear Chinese notice, never silence or a fake success.
// Mirrors the Web/PWA statusText mapping so all surfaces behave consistently.
export const statusText: Record<string, string> = {
  endpoint_unavailable: '⚠️ 公共云端 Runtime 未就绪，请稍后再试或切换到本地 Desktop 运行时',
  local_runtime_offline: '⚠️ 本地 Desktop 运行时离线，未收到回复',
  tunnel_disconnected: '⚠️ 本地运行时连接已断开，未收到回复',
  runtime_failed: '⚠️ 运行时执行失败，未收到回复',
}

export interface SendChatParams {
  baseUrl: string
  sessionId: string
  token: string
  content: string
  roleAgentId?: string | null
  onDelta: (reply: string) => void
  onNotice: (text: string) => void
  onError: (message: string) => void
}

// Parse `data: {json}\n\n` SSE frames from an accumulating buffer. Returns the unparsed tail.
function drainFrames(buffer: string, onEvent: (evt: RuntimeGatewayEvent) => void): string {
  let rest = buffer
  let sep = rest.indexOf('\n\n')
  while (sep !== -1) {
    const frame = rest.slice(0, sep)
    rest = rest.slice(sep + 2)
    const line = frame.trim()
    if (line.startsWith('data:')) {
      const payload = line.slice(5).trim()
      try {
        onEvent(JSON.parse(payload) as RuntimeGatewayEvent)
      } catch {
        // ignore malformed frame; keep streaming
      }
    }
    sep = rest.indexOf('\n\n')
  }
  return rest
}

// React Native fetch has no ReadableStream reader, so consume the SSE stream via XHR's
// incremental responseText. Accumulates runtime_output deltas into one agent reply; maps
// terminal events to explicit Chinese notices. Non-2xx → onError, never a fabricated success.
export function sendChat(params: SendChatParams): Promise<{ reply: string }> {
  const { baseUrl, sessionId, token, content, roleAgentId, onDelta, onNotice, onError } = params

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${baseUrl.replace(/\/$/, '')}/api/chat`)
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    let reply = ''
    let consumed = 0
    let buffer = ''
    let noticed = false

    const handleEvent = (evt: RuntimeGatewayEvent) => {
      if (evt.type === 'runtime_output' && evt.delta) {
        reply += evt.delta
        onDelta(reply)
      } else if (statusText[evt.type]) {
        noticed = true
        onNotice(statusText[evt.type])
      }
    }

    xhr.onreadystatechange = () => {
      if (xhr.readyState < XMLHttpRequest.LOADING) return
      if (xhr.status && xhr.status >= 400) return // handled in onload/onerror

      const chunk = xhr.responseText.slice(consumed)
      consumed = xhr.responseText.length
      buffer += chunk
      buffer = drainFrames(buffer, handleEvent)
    }

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        let msg = '发送失败，请重试'
        try {
          const body = JSON.parse(xhr.responseText)
          if (body?.error) msg = body.error
        } catch {
          if (xhr.statusText) msg = xhr.statusText
        }
        onError(msg)
        resolve({ reply: '' })
        return
      }
      if (!reply && !noticed) onNotice('⚠️ 未收到运行时回复')
      resolve({ reply })
    }

    xhr.onerror = () => {
      onError('网络错误，无法连接运行时')
      resolve({ reply: '' })
    }

    xhr.send(
      JSON.stringify({
        sessionId,
        content,
        roleAgentId: roleAgentId ?? null,
        mentions: roleAgentId ? [roleAgentId] : null,
      }),
    )
  })
}
