import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import vm from 'vm'

function loadServiceWorker() {
  const listeners = new Map<string, (event: any) => void>()
  const cacheStore = new Map<string, Response>()
  const context = {
    Response,
    URL,
    fetch: vi.fn(),
    self: {
      location: { origin: 'http://localhost:3000' },
      addEventListener: vi.fn((type: string, listener: (event: any) => void) => {
        listeners.set(type, listener)
      }),
    },
    caches: {
      open: vi.fn(async () => ({
        addAll: vi.fn(async () => undefined),
      })),
      keys: vi.fn<() => Promise<string[]>>(async () => []),
      delete: vi.fn(async () => true),
      match: vi.fn(async (request: Request | string) => {
        const key = typeof request === 'string' ? request : new URL(request.url).pathname
        return cacheStore.get(key)
      }),
    },
  }

  vm.runInNewContext(
    fs.readFileSync(path.resolve(__dirname, '../public/sw.js'), 'utf8'),
    context,
    { filename: 'sw.js' },
  )

  return { context, listeners, cacheStore }
}

describe('service worker fetch routing', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    global.fetch = originalFetch
  })

  it('does not intercept desktop workspace navigation', () => {
    const { listeners } = loadServiceWorker()
    const respondWith = vi.fn()

    listeners.get('fetch')?.({
      request: new Request('http://localhost:3000/workspace', { method: 'GET' }),
      respondWith,
    })

    expect(respondWith).not.toHaveBeenCalled()
  })

  it('pre-caches only mobile routes and not the desktop root document', async () => {
    const { context, listeners } = loadServiceWorker()
    const waitUntil = vi.fn((promise: Promise<unknown>) => promise)

    listeners.get('install')?.({ waitUntil })

    expect(waitUntil).toHaveBeenCalledTimes(1)
    await waitUntil.mock.calls[0][0]
    const openedCache = await context.caches.open.mock.results[0].value
    expect(openedCache.addAll).toHaveBeenCalledWith(['/m', '/m/approve', '/m/preview'])
  })

  it('deletes legacy root-scope caches during activation', async () => {
    const { context, listeners } = loadServiceWorker()
    context.caches.keys.mockResolvedValueOnce(['agenthub-v1', 'agenthub-mobile-v2', 'other-cache'])
    const waitUntil = vi.fn((promise: Promise<unknown>) => promise)

    listeners.get('activate')?.({ waitUntil })

    expect(waitUntil).toHaveBeenCalledTimes(1)
    await waitUntil.mock.calls[0][0]
    expect(context.caches.delete).toHaveBeenCalledWith('agenthub-v1')
    expect(context.caches.delete).not.toHaveBeenCalledWith('agenthub-mobile-v2')
    expect(context.caches.delete).not.toHaveBeenCalledWith('other-cache')
  })

  it('returns a real Response for offline mobile navigation fallback', async () => {
    const { context, listeners } = loadServiceWorker()
    context.fetch.mockRejectedValueOnce(new Error('offline'))
    const respondWith = vi.fn()

    listeners.get('fetch')?.({
      request: new Request('http://localhost:3000/m/sessions/session-1', { method: 'GET' }),
      respondWith,
    })

    expect(respondWith).toHaveBeenCalledTimes(1)
    await expect(respondWith.mock.calls[0][0]).resolves.toBeInstanceOf(Response)
  })
})
