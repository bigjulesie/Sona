import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export type Brand = 'nh' | 'sona'

export function detectBrand(host: string): Brand {
  if (host.includes('entersona.com')) return 'sona'
  if (host.includes('neuralheirloom.com')) return 'nh'
  return (process.env.BRAND as Brand) ?? 'nh'
}

export function isSonaPublicRoute(pathname: string): boolean {
  return (
    pathname === '/explore' ||
    pathname === '/sona' ||
    pathname.startsWith('/sona/') ||
    pathname === '/signup'
  )
}

export async function middleware(request: NextRequest) {
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

  let response = NextResponse.next()

  if (!isPublic) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      },
    )

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  response.headers.set('x-brand', brand)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
