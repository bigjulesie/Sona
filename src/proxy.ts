import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublicRoute =
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api') ||
    pathname === '/login'

  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Check for a Supabase session cookie (sb-<projectRef>-auth-token)
  const hasSession = request.cookies
    .getAll()
    .some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))

  if (!hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
