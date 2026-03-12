// src/app/api/creator/mind/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DIMENSION_CATEGORY_LABELS, type DimensionCategory } from '@/lib/synthesis/types'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: portrait } = await (admin as any)
    .from('portraits')
    .select('id, synthesis_status, last_synthesised_at')
    .eq('creator_id', user.id)
    .single()

  if (!portrait) return NextResponse.json({ error: 'No portrait' }, { status: 404 })

  const [{ data: dimensions }, { data: currents }] = await Promise.all([
    (admin as any).from('sona_dimensions')
      .select('dimension_category, dimension_key, narrative, confidence, confidence_flag, min_tier, evidence_count')
      .eq('portrait_id', portrait.id)
      .order('dimension_category'),
    (admin as any).from('sona_modules')
      .select('module_type, title, activation_keywords, min_tier, confidence')
      .eq('portrait_id', portrait.id)
      .is('superseded_at', null)
      .order('module_type'),
  ])

  // Group dimensions by category with user-facing labels
  const grouped: Record<string, any[]> = {}
  for (const dim of dimensions ?? []) {
    const category = dim.dimension_category as DimensionCategory
    const label = DIMENSION_CATEGORY_LABELS[category] ?? category
    if (!grouped[label]) grouped[label] = []
    grouped[label].push(dim)
  }

  return NextResponse.json({
    synthesis_status: portrait.synthesis_status,
    last_synthesised_at: portrait.last_synthesised_at,
    dimensions: grouped,
    currents: currents ?? [],
  })
}
