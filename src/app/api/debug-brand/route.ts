import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function GET(request: NextRequest) {
  const hdrs = await headers()
  return NextResponse.json({
    host: request.headers.get('host'),
    xBrand: hdrs.get('x-brand'),
    xForwardedHost: request.headers.get('x-forwarded-host'),
    vercelId: request.headers.get('x-vercel-id'),
  })
}
