// src/app/api/creator/deepen/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runFullSynthesis } from '@/lib/synthesis/character-synthesise'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: portrait } = await (admin as any)
    .from('portraits')
    .select('id, synthesis_status')
    .eq('creator_id', user.id)
    .single()

  if (!portrait) return NextResponse.json({ error: 'No portrait found' }, { status: 404 })
  if (portrait.synthesis_status === 'synthesising') {
    return NextResponse.json({ error: 'Already deepening' }, { status: 409 })
  }

  // Fire and forget — client polls synthesis_status
  runFullSynthesis(portrait.id, 'manual').catch(console.error)

  return NextResponse.json({ ok: true, status: 'synthesising' })
}
