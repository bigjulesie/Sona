// src/app/(sona)/dashboard/content/page.tsx
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ContentLibrary } from '@/components/sona/ContentLibrary'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

export default async function DashboardContentPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, display_name')
    .eq('creator_id', user.id)
    .maybeSingle()

  if (!portrait) redirect('/dashboard/create')

  // content_sources added in migration 00012 — types not regenerated yet
  const { data: sources } = await (supabase as any)
    .from('content_sources')
    .select('id, title, source_type, min_tier, status, created_at')
    .eq('portrait_id', portrait.id)
    .order('created_at', { ascending: false }) as { data: Array<{ id: string; title: string; source_type: string; min_tier: string; status: string; created_at: string }> | null }

  return (
    <div style={{ maxWidth: 640 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 40, gap: 16 }}>
        <div>
          <h1 style={{
            fontFamily: CORMORANT,
            fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
            fontWeight: 400,
            fontStyle: 'italic',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: '#1a1a1a',
            margin: '0 0 6px',
          }}>
            Content
          </h1>
          <p style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 300, color: '#6b6b6b', margin: 0, lineHeight: 1.6 }}>
            Writings, talks, and documents that enrich your Sona's knowledge.
          </p>
        </div>
      </div>

      {/* Library */}
      <ContentLibrary
        sources={sources ?? []}
        portraitId={portrait.id}
        portraitName={portrait.display_name}
      />

    </div>
  )
}
