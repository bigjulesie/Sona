import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PricingManager } from '@/components/sona/PricingManager'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

export default async function DashboardPricingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, monthly_price_cents')
    .eq('creator_id', user.id)
    .maybeSingle()

  if (!portrait) redirect('/dashboard/create')

  const { data: stats } = await supabase
    .from('portrait_discovery')
    .select('subscriber_count')
    .eq('id', portrait.id)
    .maybeSingle()

  const subscriberCount = Number(stats?.subscriber_count ?? 0)
  const mrr = portrait.monthly_price_cents
    ? (subscriberCount * portrait.monthly_price_cents) / 100
    : 0

  return (
    <div style={{ maxWidth: 520 }}>

      <h1 style={{
        fontFamily: CORMORANT,
        fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
        fontWeight: 400,
        fontStyle: 'italic',
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
        color: '#1a1a1a',
        margin: '0 0 40px',
      }}>
        Pricing & Earnings
      </h1>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 40 }}>
        {[
          { label: 'Subscribers', value: subscriberCount.toLocaleString() },
          { label: 'Monthly revenue', value: mrr > 0 ? `$${mrr.toFixed(0)}` : '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{
            border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: 16,
            padding: '20px 24px',
          }}>
            <p style={{ fontFamily: GEIST, fontSize: '0.75rem', fontWeight: 400, color: '#b0b0b0', margin: '0 0 6px' }}>
              {label}
            </p>
            <p style={{
              fontFamily: CORMORANT,
              fontSize: '2rem',
              fontWeight: 400,
              fontStyle: 'italic',
              color: '#1a1a1a',
              margin: 0,
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginBottom: 40 }} />

      {/* Pricing manager */}
      <PricingManager
        portraitId={portrait.id}
        currentPriceCents={portrait.monthly_price_cents}
      />

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.06)', margin: '40px 0' }} />

      {/* Payouts placeholder */}
      <div>
        <p style={{ fontFamily: GEIST, fontSize: '0.6875rem', fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#b0b0b0', margin: '0 0 12px' }}>
          Payouts
        </p>
        <p style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 300, color: '#9b9b9b', margin: 0, lineHeight: 1.6 }}>
          Direct payouts via Stripe Connect are coming soon.
        </p>
      </div>

    </div>
  )
}
