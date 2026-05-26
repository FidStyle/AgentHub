import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname.startsWith('/workspace')) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }
})

export const config = {
  matcher: ['/workspace/:path*'],
}
