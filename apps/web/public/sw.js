const CACHE_NAME = 'agenthub-mobile-v2'
const LEGACY_CACHE_NAMES = ['agenthub-v1']
const PRECACHE = ['/m', '/m/login', '/m/approve', '/m/preview']

function isMobilePwaRequest(request) {
  const url = new URL(request.url)
  return url.origin === self.location.origin && (url.pathname === '/m' || url.pathname.startsWith('/m/'))
}

async function handleMobilePwaRequest(request) {
  try {
    return await fetch(request)
  } catch (_error) {
    const cached = await caches.match(request)
    if (cached) return cached

    if (request.mode === 'navigate') {
      const fallback = await caches.match('/m')
      if (fallback) return fallback

      return new Response('AgentHub mobile is offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    return Response.error()
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names
        .filter((name) => name !== CACHE_NAME && (name.startsWith('agenthub-') || LEGACY_CACHE_NAMES.includes(name)))
        .map((name) => caches.delete(name))
    ))
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (!isMobilePwaRequest(event.request)) return

  event.respondWith(handleMobilePwaRequest(event.request))
})
