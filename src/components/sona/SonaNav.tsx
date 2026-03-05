import Image from 'next/image'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SignOutButton } from './SignOutButton'

const GEIST = 'var(--font-geist-sans)'

const linkStyle = {
  fontFamily: GEIST,
  fontSize: '0.875rem',
  color: '#6b6b6b',
  textDecoration: 'none',
  fontWeight: 400,
} as const

export async function SonaNav() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  let hasPortrait = false
  if (user) {
    const { data } = await supabase
      .from('portraits')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()
    hasPortrait = !!data
  }

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backgroundColor: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(0,0,0,0.06)',
      padding: '0 clamp(24px, 4vw, 48px)',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
        <Image
          src="/brand_assets/sona/Sona brand - on white bg.svg"
          alt="Sona"
          width={88}
          height={33}
          priority
        />
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
        <Link href="/explore" className="sona-link" style={linkStyle}>Explore</Link>

        {user ? (
          <>
            {hasPortrait && (
              <Link href="/dashboard" className="sona-link" style={linkStyle}>Dashboard</Link>
            )}
            <Link href="/account" className="sona-link" style={linkStyle}>Account</Link>
            <SignOutButton />
          </>
        ) : (
          <>
            <Link href="/login" className="sona-link" style={linkStyle}>Sign in</Link>
            <Link href="/signup" className="sona-btn-dark" style={{
              fontFamily: GEIST,
              fontSize: '0.875rem',
              fontWeight: 500,
              padding: '8px 20px',
              borderRadius: '980px',
              background: '#1a1a1a',
              color: '#fff',
              textDecoration: 'none',
              letterSpacing: '-0.01em',
            }}>
              Get started
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
