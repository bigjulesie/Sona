import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Image from 'next/image'
import Link from 'next/link'

const GEIST = 'var(--font-geist-sans)'

export default async function SonaAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/')

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      {/* Minimal admin header */}
      <header style={{
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        backgroundColor: '#fff',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}>
        <div style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '0 clamp(24px, 4vw, 48px)',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center' }}>
            <Image
              src="/brand_assets/sona/Sona brand on white bg 1.svg"
              alt="Sona"
              width={88}
              height={33}
              priority
            />
          </Link>
          <span style={{
            fontFamily: GEIST,
            fontSize: '0.6875rem',
            fontWeight: 500,
            letterSpacing: '0.09em',
            textTransform: 'uppercase' as const,
            color: '#b0b0b0',
          }}>
            Admin
          </span>
        </div>
      </header>

      {/* Page content */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px clamp(24px, 4vw, 48px)' }}>
        {children}
      </div>
    </div>
  )
}
