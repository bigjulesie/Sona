import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const { portrait_id, user_id } = sub.metadata
      if (!portrait_id || !user_id) break

      const status =
        sub.status === 'active' ? 'active'
        : sub.status === 'trialing' ? 'trialing'
        : sub.status === 'past_due' ? 'past_due'
        : 'cancelled'

      // current_period_end was removed from Stripe SDK v20 types but is still
      // present in webhook payloads; access via unknown cast.
      const periodEnd: number | undefined = (sub as unknown as Record<string, unknown>)['current_period_end'] as number | undefined

      await supabase.from('subscriptions').upsert({
        subscriber_id: user_id,
        portrait_id,
        stripe_subscription_id: sub.id,
        status,
        tier: 'acquaintance',
        ...(periodEnd != null
          ? { current_period_end: new Date(periodEnd * 1000).toISOString() }
          : {}),
      }, { onConflict: 'subscriber_id,portrait_id' })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('stripe_subscription_id', sub.id)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      // In Stripe SDK v20, subscription moved to parent.subscription_details.subscription
      const subId = (invoice.parent as Stripe.Invoice.Parent & { subscription_details?: { subscription?: string | Stripe.Subscription } } | null)?.subscription_details?.subscription
      if (subId) {
        const subIdStr = typeof subId === 'string' ? subId : subId.id
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', subIdStr)
      }
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const subId = (invoice.parent as Stripe.Invoice.Parent & { subscription_details?: { subscription?: string | Stripe.Subscription } } | null)?.subscription_details?.subscription
      if (subId) {
        const subIdStr = typeof subId === 'string' ? subId : subId.id
        await supabase
          .from('subscriptions')
          .update({ status: 'active' })
          .eq('stripe_subscription_id', subIdStr)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
