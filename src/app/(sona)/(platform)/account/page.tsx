import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { BillingPortalButton } from './BillingPortalButton'
import { AccountSync } from './AccountSync'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

export default async function AccountPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      <AccountSync />
      <div style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '56px clamp(24px, 4vw, 48px) 96px',
      }}>

        {/* ── Page header ─────────────────────────────────────────── */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{
            fontFamily: CORMORANT,
            fontSize: 'clamp(2rem, 4vw, 2.75rem)',
            fontWeight: 400,
            fontStyle: 'italic',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: '#1a1a1a',
            margin: '0 0 8px',
          }}>
            Account
          </h1>
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.875rem',
            fontWeight: 300,
            color: '#b0b0b0',
            margin: 0,
          }}>
            {user.email}
          </p>
        </div>

        <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginBottom: 40 }} />

        {/* ── Billing ─────────────────────────────────────────────── */}
        {profile?.stripe_customer_id && (
          <section>
            <p style={{
              fontFamily: GEIST,
              fontSize: '0.6875rem',
              fontWeight: 500,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: '#b0b0b0',
              margin: '0 0 16px',
            }}>
              Billing
            </p>
            <BillingPortalButton />
          </section>
        )}

      </div>
    </main>
  )
}
