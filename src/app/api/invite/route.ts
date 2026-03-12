import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const { code } = await request.json()
  const inviteCode = process.env.INVITE_CODE
  if (!inviteCode || (code ?? '').trim().toLowerCase() !== inviteCode.toLowerCase()) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
  }
  const cookieStore = await cookies()
  cookieStore.set('sona-invite', '1', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return NextResponse.json({ success: true })
}
