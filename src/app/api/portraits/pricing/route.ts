import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { portrait_id, monthly_price_cents } = await request.json()

  if (!portrait_id) {
    return NextResponse.json({ error: 'portrait_id required' }, { status: 400 })
  }

  // Validate price: must be null/undefined/0 (free) or integer >= 100 cents
  if (monthly_price_cents != null && monthly_price_cents !== 0) {
    if (!Number.isInteger(monthly_price_cents) || monthly_price_cents < 100) {
      return NextResponse.json(
        { error: 'monthly_price_cents must be null (free) or an integer >= 100' },
        { status: 400 },
      )
    }
  }

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, display_name, creator_id, stripe_price_id')
    .eq('id', portrait_id)
    .single()

  if (!portrait || portrait.creator_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let stripe_price_id: string | null = null

  if (monthly_price_cents) {
    const stripe = getStripe()

    // Archive the old price if one exists (idempotency — creators can reprice)
    if (portrait.stripe_price_id) {
      try {
        await stripe.prices.update(portrait.stripe_price_id, { active: false })
      } catch {
        // Best-effort: old price archival failure is non-blocking
      }
    }

    try {
      // Idempotency keys prevent duplicate products/prices on double-submit
      // Timestamp suffix avoids 24h collision window when repricing to the same amount
      const idemProduct = `product_${portrait_id}_${monthly_price_cents}_${Date.now()}`
      const idemPrice   = `price_${portrait_id}_${monthly_price_cents}_${Date.now()}`

      const product = await stripe.products.create(
        { name: `${portrait.display_name} — Sona`, metadata: { portrait_id } },
        { idempotencyKey: idemProduct },
      )
      const price = await stripe.prices.create(
        {
          product: product.id,
          unit_amount: monthly_price_cents,
          currency: 'usd',
          recurring: { interval: 'month' },
          metadata: { portrait_id },
        },
        { idempotencyKey: idemPrice },
      )
      stripe_price_id = price.id
    } catch {
      return NextResponse.json({ error: 'Stripe error' }, { status: 502 })
    }
  }

  const { error: dbError } = await createAdminClient()
    .from('portraits')
    .update({ monthly_price_cents: monthly_price_cents ?? null, stripe_price_id })
    .eq('id', portrait_id)

  if (dbError) {
    // Stripe objects were created but DB write failed — archive the orphaned price
    if (stripe_price_id) {
      try {
        await getStripe().prices.update(stripe_price_id, { active: false })
      } catch {
        // Best-effort cleanup
      }
    }
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
