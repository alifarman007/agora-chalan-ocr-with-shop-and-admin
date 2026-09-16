/**
 * Next 16 renamed middleware.ts to proxy.ts.
 *
 * This is ONLY a redirect convenience: it checks whether a session cookie exists so a
 * signed-out visitor lands on /login instead of an empty page. It is NOT a security
 * boundary — Server Actions POST to the page route and can bypass this matcher
 * entirely, so every action and route handler re-checks permissions itself.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  const hasSession = Boolean(getSessionCookie(request))

  if (!hasSession && !isPublic) {
    const url = new URL('/login', request.url)
    if (pathname !== '/') url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }
  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
}
