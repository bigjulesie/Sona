import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { portrait_id, score } = await request.json()

  if (!portrait_id || score == null) {
    return NextResponse.json({ error: 'portrait_id and score required' }, { status: 400 })
  }

  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return NextResponse.json({ error: 'score must be an integer between 1 and 5' }, { status: 400 })
  }

  // Must have active subscription to rate
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('subscriber_id', user.id)
    .eq('portrait_id', portrait_id)
    .eq('status', 'active')
    .maybeSingle()

  if (!sub) return NextResponse.json({ error: 'Subscription required' }, { status: 403 })

  const { error } = await createAdminClient().from('ratings').upsert({
    subscriber_id: user.id,
    portrait_id,
    score,
  }, { onConflict: 'subscriber_id,portrait_id' })

  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
