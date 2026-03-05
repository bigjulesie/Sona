import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SonaIngestForm } from '@/components/sona/SonaIngestForm'

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

  return (
    <div style={{ maxWidth: 600 }}>

      {/* ── Page header ─────────────────────────────────────────── */}
      <h1 style={{
        fontFamily: CORMORANT,
        fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
        fontWeight: 400,
        fontStyle: 'italic',
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
        color: '#1a1a1a',
        margin: '0 0 8px',
      }}>
        Content
      </h1>
      <p style={{
        fontFamily: GEIST,
        fontSize: '0.875rem',
        fontWeight: 300,
        color: '#6b6b6b',
        margin: '0 0 40px',
        lineHeight: 1.6,
      }}>
        Upload writings, talks, interviews, or documents to enrich your Sona's knowledge.
      </p>

      <SonaIngestForm portraitId={portrait.id} portraitName={portrait.display_name} />

    </div>
  )
}
