// src/app/(sona)/dashboard/mind/page.tsx
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MindDashboard } from '@/components/sona/MindDashboard'
import { DIMENSION_CATEGORY_LABELS } from '@/lib/synthesis/types'
import type { DimensionCategory } from '@/lib/synthesis/types'

export default async function MindPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: portrait } = await (admin as any)
    .from('portraits')
    .select('id, synthesis_status, last_synthesised_at')
    .eq('creator_id', user.id)
    .single()

  if (!portrait) redirect('/dashboard')

  const [{ data: dimensions }, { data: currents }, { count: sourceCount }] = await Promise.all([
    (admin as any).from('sona_dimensions')
      .select('dimension_category, dimension_key, narrative, confidence, confidence_flag, min_tier, evidence_count')
      .eq('portrait_id', portrait.id)
      .order('dimension_category'),
    (admin as any).from('sona_modules')
      .select('module_type, title, activation_keywords, min_tier, confidence')
      .eq('portrait_id', portrait.id)
      .is('superseded_at', null)
      .order('module_type'),
    (admin as any).from('content_sources')
      .select('id', { count: 'exact', head: true })
      .eq('portrait_id', portrait.id),
  ])

  // Group dimensions by category label
  const grouped: Record<string, any[]> = {}
  for (const dim of dimensions ?? []) {
    const label = DIMENSION_CATEGORY_LABELS[dim.dimension_category as DimensionCategory] ?? dim.dimension_category
    if (!grouped[label]) grouped[label] = []
    grouped[label].push(dim)
  }

  const initialData = {
    synthesis_status: portrait.synthesis_status,
    last_synthesised_at: portrait.last_synthesised_at,
    dimensions: grouped,
    currents: currents ?? [],
    sourceCount: sourceCount ?? 0,
  }

  return (
    <main>
      <div style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: 'clamp(2rem, 4vw, 3rem) clamp(24px, 4vw, 48px) 0',
      }}>
        <h1 style={{
          fontFamily: 'var(--font-cormorant)',
          fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
          fontStyle: 'italic',
          fontWeight: 400,
          letterSpacing: '-0.02em',
          color: '#1a1a1a',
          marginBottom: '0.25rem',
        }}>
          Mind
        </h1>
        <p style={{
          fontFamily: 'var(--font-geist-sans)',
          fontSize: '0.875rem',
          color: '#6b6b6b',
          marginBottom: '2.5rem',
        }}>
          The depth behind every conversation.
        </p>
      </div>
      <MindDashboard initialData={initialData} />
    </main>
  )
}
