import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_DESKTOP_DEV_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'null',
])

function configuredOrigins() {
  const extra = (process.env.DESKTOP_DEV_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return new Set([...DEFAULT_DESKTOP_DEV_ORIGINS, ...extra])
}

export function withDesktopCors(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get('origin')
  if (!origin || !configuredOrigins().has(origin)) return response

  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Vary', 'Origin')
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return response
}

export function desktopCorsPreflight(request: NextRequest) {
  return withDesktopCors(request, new NextResponse(null, { status: 204 }))
}
