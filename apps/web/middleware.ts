import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isProtected =
    req.nextUrl.pathname.startsWith('/workspace') ||
    req.nextUrl.pathname.startsWith('/m')

  if (!req.auth && isProtected) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }
})

export const config = {
  matcher: ['/workspace/:path*', '/m/:path*'],
}
