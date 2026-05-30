import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendChat } from '../chatClient'
import { getRuntimeConfig } from '../config'

// Minimal fake XHR that lets a test script drive readyState/status/responseText transitions,
// mirroring how an SSE response streams `data: {json}\n\n` frames incrementally.
class FakeXHR {
  static LOADING = 3
  static DONE = 4
  readyState = 0
  status = 0
  statusText = ''
  responseText = ''
  onreadystatechange: (() => void) | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  sentBody: string | null = null
  static instance: FakeXHR | null = null

  constructor() {
    FakeXHR.instance = this
  }
  open() {}
  setRequestHeader() {}
  send(body: string) {
    this.sentBody = body
  }
  // Test helpers
  pushFrame(obj: object) {
    this.responseText += `data: ${JSON.stringify(obj)}\n\n`
    this.readyState = FakeXHR.LOADING
    this.onreadystatechange?.()
  }
  finish(status: number, finalText?: string) {
    if (finalText !== undefined) this.responseText = finalText
    this.status = status
    this.readyState = FakeXHR.DONE
    this.onload?.()
  }
}

const base = { baseUrl: 'https://api.test', sessionId: 'sess-real', token: 'tok-123', content: '帮我跑测试' }

beforeEach(() => {
  vi.stubGlobal('XMLHttpRequest', FakeXHR as unknown as typeof XMLHttpRequest)
})
afterEach(() => {
  vi.unstubAllGlobals()
  FakeXHR.instance = null
})

describe('config', () => {
  it('reports not configured when env keys are missing', () => {
    vi.stubGlobal('process', { env: {} })
    const cfg = getRuntimeConfig()
    expect(cfg.configured).toBe(false)
    expect(cfg.missing).toContain('EXPO_PUBLIC_API_BASE_URL')
    vi.unstubAllGlobals()
    vi.stubGlobal('XMLHttpRequest', FakeXHR as unknown as typeof XMLHttpRequest)
  })
})

describe('sendChat', () => {
  it('① 不产生本地 echo：onDelta 只来自真实 runtime_output，从不回显输入原文', async () => {
    const deltas: string[] = []
    const promise = sendChat({
      ...base,
      onDelta: (r) => deltas.push(r),
      onNotice: () => {},
      onError: () => {},
    })
    const xhr = FakeXHR.instance!
    // send must POST the real session id + content, not a hardcoded mobile-sess-1
    expect(JSON.parse(xhr.sentBody!)).toMatchObject({ sessionId: 'sess-real', content: '帮我跑测试' })
    xhr.pushFrame({ type: 'runtime_output', delta: '正在' })
    xhr.pushFrame({ type: 'runtime_output', delta: '执行测试' })
    xhr.pushFrame({ type: 'runtime_completed' })
    xhr.finish(200)
    const { reply } = await promise
    expect(reply).toBe('正在执行测试')
    // no delta ever equals an echo of the user input
    expect(deltas.every((d) => !d.includes('收到') && d !== base.content)).toBe(true)
  })

  it('② 成功路径：累积 runtime_output deltas 为单条 agent 回复', async () => {
    const notices: string[] = []
    const promise = sendChat({
      ...base,
      onDelta: () => {},
      onNotice: (t) => notices.push(t),
      onError: () => {},
    })
    const xhr = FakeXHR.instance!
    xhr.pushFrame({ type: 'runtime_output', delta: 'Hello ' })
    xhr.pushFrame({ type: 'runtime_output', delta: 'World' })
    xhr.pushFrame({ type: 'runtime_completed' })
    xhr.finish(200)
    const { reply } = await promise
    expect(reply).toBe('Hello World')
    expect(notices).toHaveLength(0)
  })

  it('③ 失败路径：HTTP 非 2xx 触发 onError，不伪造成功回复', async () => {
    let errMsg = ''
    const promise = sendChat({
      ...base,
      onDelta: () => {},
      onNotice: () => {},
      onError: (m) => (errMsg = m),
    })
    const xhr = FakeXHR.instance!
    xhr.finish(503, JSON.stringify({ error: '运行时执行失败，未收到回复' }))
    const { reply } = await promise
    expect(reply).toBe('')
    expect(errMsg).toBe('运行时执行失败，未收到回复')
  })

  it('③b 失败路径：runtime_failed 终端事件映射中文通知', async () => {
    const notices: string[] = []
    const promise = sendChat({
      ...base,
      onDelta: () => {},
      onNotice: (t) => notices.push(t),
      onError: () => {},
    })
    const xhr = FakeXHR.instance!
    xhr.pushFrame({ type: 'runtime_failed', error: 'boom' })
    xhr.finish(200)
    const { reply } = await promise
    expect(reply).toBe('')
    expect(notices.some((n) => n.includes('运行时执行失败'))).toBe(true)
  })
})
