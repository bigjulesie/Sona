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

  const sourceCount = sources?.length ?? 0

  // Determine which progress message to show based on how much has been added
  const progressMessage = (() => {
    if (sourceCount === 0) {
      return {
        heading: null,
        body: 'Your Sona draws on everything you share here. Start with something that captures how you think.',
        link: null,
      }
    }
    if (sourceCount <= 2) {
      return {
        heading: null,
        body: 'Good start. Every piece of context makes your Sona more distinctly you.',
        link: null,
      }
    }
    return {
      heading: null,
      body: 'Your Sona has good depth to draw on. Keep adding to make it even more precise.',
      link: { href: '/dashboard/mind', label: 'See what your Sona knows →' },
    }
  })()

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
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
          Context
        </h1>
        <p style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 300, color: '#6b6b6b', margin: 0, lineHeight: 1.6 }}>
          Writings, talks, and documents that add depth to your Sona.
        </p>
      </div>

      {/* Progress indicator */}
      <div style={{
        borderRadius: 12,
        border: '1px solid rgba(0,0,0,0.07)',
        padding: '1rem 1.25rem',
        marginBottom: 36,
        background: '#fafafa',
      }}>
        <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', color: '#6b6b6b', margin: progressMessage.link ? '0 0 0.625rem' : 0, lineHeight: 1.6 }}>
          {progressMessage.body}
        </p>
        {progressMessage.link && (
          <a
            href={progressMessage.link.href}
            style={{
              fontFamily: GEIST,
              fontSize: '0.8125rem',
              color: '#6b6b6b',
              textDecoration: 'underline',
            }}
          >
            {progressMessage.link.label}
          </a>
        )}
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
