import { createAdminClient } from '@/lib/supabase/admin'
import { PortraitsTable } from './PortraitsTable'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

export default async function SonaAdminPage() {
  const admin = createAdminClient()

  // Run all queries in parallel
  const [
    { count: liveCount },
    { count: totalSubscribers },
    { data: portraits },
    { data: interviewRows },
  ] = await Promise.all([
    // Live Sonas
    admin.from('portraits').select('*', { count: 'exact', head: true }).eq('is_public', true),
    // Total subscribers
    admin.from('subscriptions').select('*', { count: 'exact', head: true }),
    // All portraits with creator email, content count, subscriber count
    // Note: if embedded `relation ( count )` syntax doesn't resolve correctly at runtime,
    // replace `content_sources ( count )` and `subscriptions ( count )` with separate
    // queries: admin.from('content_sources').select('portrait_id').then(...)
    // and build lookup maps by portrait_id.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('portraits')
      .select(`
        id,
        creator_id,
        display_name,
        is_public,
        synthesis_status,
        created_at,
        profiles!portraits_creator_id_fkey ( email ),
        content_sources ( count ),
        subscriptions ( count )
      `)
      .order('created_at', { ascending: false }),
    // Portrait IDs that have interview requests
    admin.from('interview_requests').select('portrait_id'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyRow = any
  // Count distinct creators from the portraits result (no separate query needed)
  const uniqueCreators = new Set((portraits ?? []).map((p: AnyRow) => p.creator_id)).size

  // Build a Set of portrait IDs that have an interview request
  const interviewPortraitIds = new Set((interviewRows ?? []).map((r: AnyRow) => r.portrait_id))

  // Shape portrait rows for PortraitsTable
  const rows = (portraits ?? []).map((p: AnyRow) => ({
    id: p.id,
    display_name: p.display_name,
    creator_email: p.profiles?.email ?? '—',
    is_public: p.is_public ?? false,
    synthesis_status: p.synthesis_status ?? null,
    created_at: p.created_at,
    content_count: p.content_sources?.[0]?.count ?? 0,
    subscriber_count: p.subscriptions?.[0]?.count ?? 0,
    has_interview: interviewPortraitIds.has(p.id),
  }))

  const statCards = [
    { label: 'Total creators', value: uniqueCreators },
    { label: 'Live Sonas', value: liveCount ?? 0 },
    { label: 'Total subscribers', value: totalSubscribers ?? 0 },
  ]

  return (
    <div>
      {/* Page heading */}
      <h1 style={{
        fontFamily: CORMORANT,
        fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
        fontWeight: 400,
        fontStyle: 'italic',
        letterSpacing: '-0.02em',
        color: '#1a1a1a',
        margin: '0 0 32px',
      }}>
        Portraits
      </h1>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }}>
        {statCards.map(card => (
          <div key={card.label} style={{
            border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: 14,
            padding: '20px 24px',
          }}>
            <p style={{
              fontFamily: GEIST,
              fontSize: '0.6875rem',
              fontWeight: 500,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: '#b0b0b0',
              margin: '0 0 8px',
            }}>
              {card.label}
            </p>
            <p style={{
              fontFamily: CORMORANT,
              fontSize: '2rem',
              fontWeight: 400,
              color: '#1a1a1a',
              margin: 0,
              lineHeight: 1,
            }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Portraits table */}
      <PortraitsTable portraits={rows} />
    </div>
  )
}
