import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { portrait_id, whatsapp_number, notes } = await request.json()

  if (!portrait_id || !whatsapp_number) {
    return NextResponse.json({ error: 'portrait_id and whatsapp_number required' }, { status: 400 })
  }

  // Verify creator owns the portrait
  const { data: portrait } = await supabase
    .from('portraits')
    .select('id')
    .eq('id', portrait_id)
    .eq('creator_id', user.id)
    .single()

  if (!portrait) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await createAdminClient().from('interview_requests').insert({
    creator_id: user.id,
    portrait_id,
    whatsapp_number,
    notes,
  })

  if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
