import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { updateSonaSettings } from './actions'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

const CATEGORIES = [
  'Technology', 'Business', 'Science', 'Arts',
  'Sport', 'Politics', 'Education', 'Health', 'Other',
]

interface PageProps {
  searchParams: Promise<{ saved?: string }>
}

export default async function DashboardSettingsPage({ searchParams }: PageProps) {
  const { saved } = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: portrait } = await supabase
    .from('portraits')
    .select('tagline, bio, category, monthly_price_cents')
    .eq('creator_id', user.id)
    .single()

  if (!portrait) redirect('/dashboard/create')

  const isPaid = portrait.monthly_price_cents != null && portrait.monthly_price_cents > 0

  return (
    <div style={{ maxWidth: 520 }}>

      {/* ── Page header ─────────────────────────────────────────── */}
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
        Settings
      </h1>

      {/* ── Save success banner ─────────────────────────────────── */}
      {saved && (
        <div style={{
          fontFamily: GEIST,
          fontSize: '0.8125rem',
          fontWeight: 400,
          color: '#1a7a5a',
          backgroundColor: 'rgba(26,122,90,0.07)',
          border: '1px solid rgba(26,122,90,0.15)',
          borderRadius: 10,
          padding: '10px 16px',
          marginBottom: 32,
        }}>
          Changes saved.
        </div>
      )}

      {/* ── Profile form ────────────────────────────────────────── */}
      <form action={updateSonaSettings}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* Tagline */}
          <div>
            <label style={{
              fontFamily: GEIST,
              fontSize: '0.6875rem',
              fontWeight: 500,
              letterSpacing: '0.09em',
              textTransform: 'uppercase' as const,
              color: '#b0b0b0',
              display: 'block',
              marginBottom: 10,
            }}>
              Tagline
            </label>
            <input
              name="tagline"
              defaultValue={portrait.tagline ?? ''}
              placeholder="What you're known for, in one line"
              className="sona-input"
              style={{
                fontFamily: GEIST,
                fontSize: '0.9375rem',
                fontWeight: 300,
                color: '#1a1a1a',
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(0,0,0,0.15)',
                padding: '8px 0',
                outline: 'none',
                boxSizing: 'border-box' as const,
              }}
            />
          </div>

          {/* Bio */}
          <div>
            <label style={{
              fontFamily: GEIST,
              fontSize: '0.6875rem',
              fontWeight: 500,
              letterSpacing: '0.09em',
              textTransform: 'uppercase' as const,
              color: '#b0b0b0',
              display: 'block',
              marginBottom: 10,
            }}>
              Bio
            </label>
            <textarea
              name="bio"
              rows={5}
              defaultValue={portrait.bio ?? ''}
              placeholder="Tell people who you are and what you bring to a conversation…"
              style={{
                fontFamily: GEIST,
                fontSize: '0.9375rem',
                fontWeight: 300,
                color: '#1a1a1a',
                lineHeight: 1.7,
                width: '100%',
                background: '#fafafa',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 12,
                padding: '14px 16px',
                outline: 'none',
                resize: 'none' as const,
                boxSizing: 'border-box' as const,
              }}
            />
          </div>

          {/* Category */}
          <div>
            <label style={{
              fontFamily: GEIST,
              fontSize: '0.6875rem',
              fontWeight: 500,
              letterSpacing: '0.09em',
              textTransform: 'uppercase' as const,
              color: '#b0b0b0',
              display: 'block',
              marginBottom: 10,
            }}>
              Category
            </label>
            <select
              name="category"
              defaultValue={portrait.category ?? ''}
              className="sona-input"
              style={{
                fontFamily: GEIST,
                fontSize: '0.9375rem',
                fontWeight: 300,
                color: '#1a1a1a',
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(0,0,0,0.15)',
                padding: '8px 0',
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none' as const,
                WebkitAppearance: 'none' as const,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23b0b0b0' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 4px center',
                paddingRight: 24,
              }}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Save */}
          <div>
            <button
              type="submit"
              className="sona-btn-dark"
              style={{
                fontFamily: GEIST,
                fontSize: '0.9375rem',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                padding: '12px 32px',
                borderRadius: '980px',
                background: '#1a1a1a',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Save changes
            </button>
          </div>

        </div>
      </form>

      {/* ── Pricing ─────────────────────────────────────────────── */}
      <div style={{
        marginTop: 48,
        paddingTop: 32,
        borderTop: '1px solid rgba(0,0,0,0.06)',
      }}>
        <p style={{
          fontFamily: GEIST,
          fontSize: '0.6875rem',
          fontWeight: 500,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: '#b0b0b0',
          margin: '0 0 12px',
        }}>
          Pricing
        </p>
        <p style={{
          fontFamily: CORMORANT,
          fontSize: '1.5rem',
          fontWeight: 400,
          fontStyle: 'italic',
          color: '#1a1a1a',
          margin: '0 0 6px',
          lineHeight: 1.2,
        }}>
          {isPaid
            ? `$${(portrait.monthly_price_cents! / 100).toFixed(0)} per month`
            : 'Free'}
        </p>
        <p style={{
          fontFamily: GEIST,
          fontSize: '0.8125rem',
          fontWeight: 300,
          color: '#b0b0b0',
          margin: 0,
        }}>
          Contact support to change your pricing after launch.
        </p>
      </div>

    </div>
  )
}
