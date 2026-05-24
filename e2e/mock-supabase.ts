import http from 'http'

const mockUser = {
  id: 'test-user-001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@agenthub.dev',
  app_metadata: { provider: 'github' },
  user_metadata: { full_name: 'Test User' },
  created_at: '2026-01-01T00:00:00Z',
}

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // Auth: getUser
  if (req.url?.includes('/auth/v1/user')) {
    res.writeHead(200)
    res.end(JSON.stringify(mockUser))
    return
  }

  // Auth: token refresh
  if (req.url?.includes('/auth/v1/token')) {
    res.writeHead(200)
    res.end(JSON.stringify({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: mockUser,
    }))
    return
  }

  // REST: catchall for Supabase PostgREST queries
  if (req.url?.includes('/rest/v1/')) {
    res.writeHead(200)
    res.end(JSON.stringify([]))
    return
  }

  // Realtime
  if (req.url?.includes('/realtime/')) {
    res.writeHead(200)
    res.end('ok')
    return
  }

  res.writeHead(404)
  res.end(JSON.stringify({ error: 'not found' }))
})

export async function startMockSupabase(port = 54321): Promise<http.Server> {
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Mock Supabase running on http://localhost:${port}`)
      resolve(server)
    })
  })
}

export function stopMockSupabase(srv: http.Server): Promise<void> {
  return new Promise((resolve) => srv.close(() => resolve()))
}
