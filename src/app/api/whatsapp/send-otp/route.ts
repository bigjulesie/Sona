// src/app/api/whatsapp/send-otp/route.ts
//
// Generates a 6-digit OTP, stores a SHA-256 hash in whatsapp_otps,
// and sends it to the user via WhatsApp Business API.
//
// Required environment variables:
//   WHATSAPP_PHONE_NUMBER_ID  — from Meta Business Manager → WhatsApp → API Setup
//   WHATSAPP_ACCESS_TOKEN     — System user permanent token
//   WHATSAPP_OTP_TEMPLATE_NAME — Approved template name (default: 'sona_verification')
//   OTP_HMAC_SECRET           — Random string used to salt OTP hashes
//
// The WhatsApp template must be pre-approved in Meta Business Manager.
// Template body: "Your Sona verification code is *{{1}}*. It expires in 10 minutes."
// Category: UTILITY

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomInt, createHash } from 'crypto'

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
  if (!phone) {
    return NextResponse.json(
      { error: 'Invalid phone number. Use international format, e.g. +44 7700 900000.' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  // Rate limit: max 3 OTPs per phone number per hour
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await (admin as any)
    .from('whatsapp_otps')
    .select('id', { count: 'exact', head: true })
    .eq('phone_number', phone)
    .gt('created_at', hourAgo)

  if ((count ?? 0) >= 3) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait before requesting another code.' },
      { status: 429 },
    )
  }

  // Generate and store OTP
  const otp = String(randomInt(100000, 999999))
  const otp_hash = hashOtp(otp)

  await (admin as any).from('whatsapp_otps').insert({
    phone_number: phone,
    otp_hash,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  })

  // Send via WhatsApp Cloud API
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN
  const templateName  = process.env.WHATSAPP_OTP_TEMPLATE_NAME ?? 'sona_verification'

  if (!phoneNumberId || !accessToken) {
    console.error('[send-otp] WhatsApp env vars missing')
    return NextResponse.json({ error: 'Verification service not configured.' }, { status: 500 })
  }

  const waRes = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en_GB' },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: otp }],
            },
          ],
        },
      }),
    },
  )

  if (!waRes.ok) {
    const errBody = await waRes.json().catch(() => ({}))
    console.error('[send-otp] WhatsApp API error:', errBody)
    return NextResponse.json({ error: 'Failed to send verification message. Please check the number and try again.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
