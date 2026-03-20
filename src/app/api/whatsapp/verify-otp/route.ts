// src/app/api/whatsapp/verify-otp/route.ts
//
// Validates the OTP submitted by the user, marks it used,
// and saves the verified phone number + timezone to profiles.

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createHash } from 'crypto'

function hashOtp(otp: string): string {
  const secret = process.env.OTP_HMAC_SECRET ?? 'sona-otp-fallback-salt'
  return createHash('sha256').update(`${otp}:${secret}`).digest('hex')
}

function normalisePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, '').replace(/^00/, '+')
  return /^\+\d{7,15}$/.test(cleaned) ? cleaned : null
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const phone = normalisePhone(body.phone_number ?? '')
  const otp   = String(body.otp ?? '').trim()

  if (!phone || !otp) {
    return NextResponse.json({ error: 'phone_number and otp are required.' }, { status: 400 })
  }

  const otp_hash = hashOtp(otp)
  const admin = createAdminClient()

  // Find a matching, unused, unexpired OTP
  const { data: record } = await (admin as any)
    .from('whatsapp_otps')
    .select('id')
    .eq('phone_number', phone)
    .eq('otp_hash', otp_hash)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!record) {
    return NextResponse.json(
      { error: 'That code is incorrect or has expired. Please try again.' },
      { status: 400 },
    )
  }

  // Consume the OTP
  await (admin as any)
    .from('whatsapp_otps')
    .update({ used: true })
    .eq('id', record.id)

  // Save verified phone + timezone to profile
  const timezone = typeof body.timezone === 'string' && body.timezone ? body.timezone : null
  await (admin as any)
    .from('profiles')
    .update({
      phone_number:   phone,
      phone_verified: true,
      timezone,
    })
    .eq('id', user.id)

  return NextResponse.json({ ok: true, verified: true })
}
