import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export default function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname
  const isMobilePath = pathname === '/m' || pathname.startsWith('/m/')
  const isMobileLogin = pathname === '/m/login'
  const isProtected =
    pathname.startsWith('/workspace') ||
    (isMobilePath && !isMobileLogin)

  const uatAuth = req.nextUrl.searchParams.get('uat_auth')
  const acceptanceToken = process.env.TEST_AUTH_COOKIE_VALUE ?? process.env.TEST_AUTH_COOKIE?.split('=').pop()
  const hasConfiguredAcceptanceAuth = Boolean(acceptanceToken && uatAuth && uatAuth === acceptanceToken)
  const hasDevAcceptanceAuth = process.env.NODE_ENV !== 'production' && Boolean(uatAuth && /^[a-zA-Z0-9._:-]{16,}$/.test(uatAuth))
  const hasValidAcceptanceAuth = hasConfiguredAcceptanceAuth || hasDevAcceptanceAuth
  const hasSessionCookie =
    req.cookies.has('authjs.session-token') ||
    req.cookies.has('__Secure-authjs.session-token')

  if (!hasSessionCookie && !hasValidAcceptanceAuth && isProtected) {
    const url = req.nextUrl.clone()
    if (isMobilePath) {
      url.pathname = '/m/login'
      url.search = ''
      url.searchParams.set('callbackUrl', `${req.nextUrl.pathname}${req.nextUrl.search}`)
    } else {
      url.pathname = '/'
    }
    return NextResponse.redirect(url)
  }
  const response = NextResponse.next()
  if (hasValidAcceptanceAuth) {
    const tokenToSet = hasConfiguredAcceptanceAuth ? acceptanceToken : uatAuth
    response.cookies.set('authjs.session-token', tokenToSet as string, {
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
