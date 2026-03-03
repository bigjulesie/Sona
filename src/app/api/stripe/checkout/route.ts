import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getStripe, getOrCreateStripeCustomer } from '@/lib/stripe/client'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { portrait_id } = await request.json()
  if (!portrait_id) return NextResponse.json({ error: 'portrait_id required' }, { status: 400 })

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, slug, display_name, stripe_price_id, monthly_price_cents')
    .eq('id', portrait_id)
    .single()

  if (!portrait) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!portrait.stripe_price_id) return NextResponse.json({ error: 'Portrait is free' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single()

  const customerId = await getOrCreateStripeCustomer(supabase, user.id, profile!.email)
  const origin = request.headers.get('origin') ?? `https://${process.env.NEXT_PUBLIC_SONA_DOMAIN}`

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: portrait.stripe_price_id, quantity: 1 }],
    success_url: `${origin}/sona/${portrait.slug}?subscribed=true`,
    cancel_url: `${origin}/sona/${portrait.slug}`,
    metadata: { portrait_id, user_id: user.id },
    subscription_data: {
      metadata: { portrait_id, user_id: user.id },
    },
  })

  return NextResponse.json({ url: session.url })
}
