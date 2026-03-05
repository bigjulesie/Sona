import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'

/**
 * POST /api/stripe/sync
 * Reconciles the calling user's Supabase subscription records against
 * Stripe's live state. Called from the account page on mount to correct
 * any drift caused by missed or failed webhook deliveries.
 */
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('id, stripe_subscription_id, status')
    .eq('subscriber_id', user.id)
    .not('stripe_subscription_id', 'is', null)

  if (!subscriptions?.length) return NextResponse.json({ synced: 0 })

  const stripe = getStripe()
  const admin = createAdminClient()
  let synced = 0

  await Promise.all(subscriptions.map(async (sub) => {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id!)
      const liveStatus =
        stripeSub.status === 'active'   ? 'active'
        : stripeSub.status === 'trialing' ? 'trialing'
        : stripeSub.status === 'past_due' ? 'past_due'
        : 'cancelled'

      if (liveStatus !== sub.status) {
        await admin
          .from('subscriptions')
          .update({ status: liveStatus })
          .eq('id', sub.id)
        synced++
      }
    } catch {
      // Subscription may no longer exist in Stripe — mark cancelled
      if (sub.status !== 'cancelled') {
        await admin
          .from('subscriptions')
          .update({ status: 'cancelled' })
          .eq('id', sub.id)
        synced++
      }
    }
  }))

  return NextResponse.json({ synced })
}
