import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { BillingPortalButton } from './BillingPortalButton'
import { ProfileForm } from './ProfileForm'
import { DeleteAccountButton } from './DeleteAccountButton'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, stripe_customer_id')
    .eq('id', user.id)
    .single()

  const params = await searchParams
  const saved = params.saved === '1'

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      <div style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: '56px clamp(24px, 4vw, 48px) 96px',
      }}>

        {/* Page heading */}
        <h1 style={{
          fontFamily: CORMORANT,
          fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
          fontWeight: 400,
          fontStyle: 'italic',
          letterSpacing: '-0.02em',
          color: '#1a1a1a',
          margin: '0 0 48px',
        }}>
          Account
        </h1>

        {/* Profile section */}
        <section>
          <h2 style={{
            fontFamily: GEIST,
            fontSize: '0.6875rem',
            fontWeight: 500,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: '#b0b0b0',
            margin: '0 0 20px',
          }}>
            Profile
          </h2>
          <ProfileForm
            fullName={profile?.full_name ?? ''}
            email={user.email ?? ''}
            saved={saved}
          />
        </section>

        <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.07)', margin: '40px 0' }} />

        {/* Billing section */}
        <section>
          <h2 style={{
            fontFamily: GEIST,
            fontSize: '0.6875rem',
            fontWeight: 500,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: '#b0b0b0',
            margin: '0 0 20px',
          }}>
            Billing
          </h2>
          {profile?.stripe_customer_id ? (
            <BillingPortalButton />
          ) : (
            <p style={{
              fontFamily: GEIST,
              fontSize: '0.875rem',
              color: '#6b6b6b',
              margin: 0,
            }}>
              No active subscription.
            </p>
          )}
        </section>

        <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.07)', margin: '40px 0' }} />

        {/* Danger zone section */}
        <section>
          <h2 style={{
            fontFamily: GEIST,
            fontSize: '0.6875rem',
            fontWeight: 500,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: '#b0b0b0',
            margin: '0 0 20px',
          }}>
            Danger Zone
          </h2>
          <DeleteAccountButton />
        </section>

      </div>
    </main>
  )
}
