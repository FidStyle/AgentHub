import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export default function middleware(req: NextRequest) {
  const isProtected =
    req.nextUrl.pathname.startsWith('/workspace') ||
    req.nextUrl.pathname.startsWith('/m')

  const uatAuth = req.nextUrl.searchParams.get('uat_auth')
  const acceptanceToken = process.env.TEST_AUTH_COOKIE_VALUE
  const hasValidAcceptanceAuth = Boolean(acceptanceToken && uatAuth && uatAuth === acceptanceToken)
  const hasSessionCookie =
    req.cookies.has('authjs.session-token') ||
    req.cookies.has('__Secure-authjs.session-token')

  if (!hasSessionCookie && !hasValidAcceptanceAuth && isProtected) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }
  const response = NextResponse.next()
  if (hasValidAcceptanceAuth) {
    response.cookies.set('authjs.session-token', acceptanceToken as string, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })
  }
  return response
}

export const config = {
  matcher: ['/workspace/:path*', '/m/:path*'],
}
