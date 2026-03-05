import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { portrait_id } = await request.json()

  const { data: portrait } = await supabase
    .from('portraits')
    .select('monthly_price_cents, is_public')
    .eq('id', portrait_id)
    .single()

  if (!portrait?.is_public) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (portrait.monthly_price_cents) {
    return NextResponse.json({ error: 'Use checkout for paid Sonas' }, { status: 400 })
  }

  await createAdminClient().from('subscriptions').upsert({
    subscriber_id: user.id,
    portrait_id,
    status: 'active',
    tier: 'acquaintance',
  }, { onConflict: 'subscriber_id,portrait_id' })

  return NextResponse.json({ ok: true })
}
