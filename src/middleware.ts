import { NextResponse, type NextRequest } from 'next/server'

export type Brand = 'nh' | 'sona'

export function detectBrand(host: string): Brand {
  if (host.includes('entersona.com')) return 'sona'
  if (host.includes('neuralheirloom.com')) return 'nh'
  return (process.env.BRAND as Brand) ?? 'nh'
}

export function isSonaPublicRoute(pathname: string): boolean {
  return (
    pathname === '/explore' ||
    pathname.startsWith('/sona/') ||
    pathname === '/signup'
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') ?? ''
  const brand = detectBrand(host)

  const isSharedPublicRoute =
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api') ||
    pathname === '/login' ||
    pathname === '/'

  const isPublic =
    isSharedPublicRoute ||
    (brand === 'sona' && isSonaPublicRoute(pathname))

  let response: ReturnType<typeof NextResponse.next>

  if (isPublic) {
    response = NextResponse.next()
  } else {
    const hasSession = request.cookies
      .getAll()
      .some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))

    if (!hasSession) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    response = NextResponse.next()
  }

  response.headers.set('x-brand', brand)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
