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
