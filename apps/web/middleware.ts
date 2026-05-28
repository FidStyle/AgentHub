import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export default function middleware(req: NextRequest) {
  const isProtected =
    req.nextUrl.pathname.startsWith('/workspace') ||
    req.nextUrl.pathname.startsWith('/m')

  const hasSessionCookie =
    req.cookies.has('authjs.session-token') ||
    req.cookies.has('__Secure-authjs.session-token')

  if (!hasSessionCookie && isProtected) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/workspace/:path*', '/m/:path*'],
}
