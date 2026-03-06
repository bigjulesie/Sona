import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function GET(request: NextRequest) {
  const hdrs = await headers()
  return NextResponse.json({
    // From NextRequest directly (original request)
    req_host: request.headers.get('host'),
    req_xBrand: request.headers.get('x-brand'),
    req_xForwardedHost: request.headers.get('x-forwarded-host'),
    // From headers() (should include middleware-set headers)
    hdrs_xBrand: hdrs.get('x-brand'),
    hdrs_host: hdrs.get('host'),
    // Vercel routing info
    vercelId: request.headers.get('x-vercel-id'),
  })
}
