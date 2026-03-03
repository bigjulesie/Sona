import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { portrait_id, monthly_price_cents } = await request.json()

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, display_name, creator_id')
    .eq('id', portrait_id)
    .single()

  if (!portrait || portrait.creator_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let stripe_price_id: string | null = null

  if (monthly_price_cents) {
    const stripe = getStripe()
    const product = await stripe.products.create({
      name: `${portrait.display_name} — Sona`,
      metadata: { portrait_id },
    })
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: monthly_price_cents,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { portrait_id },
    })
    stripe_price_id = price.id
  }

  await createAdminClient()
    .from('portraits')
    .update({ monthly_price_cents: monthly_price_cents ?? null, stripe_price_id })
    .eq('id', portrait_id)

  return NextResponse.json({ ok: true })
}
