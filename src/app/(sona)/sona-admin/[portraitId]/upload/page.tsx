import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UploadForm } from './UploadForm'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

interface PageProps {
  params: Promise<{ portraitId: string }>
}

export default async function AdminUploadPage({ params }: PageProps) {
  const { portraitId } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/')

  const { data: portrait } = await (admin as any)
    .from('portraits')
    .select('id, display_name, slug')
    .eq('id', portraitId)
    .single()

  if (!portrait) notFound()

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Back link */}
      <Link
        href="/sona-admin"
        style={{
          fontFamily: GEIST,
          fontSize: '0.8125rem',
          color: '#b0b0b0',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 32,
        }}
      >
        ← All portraits
      </Link>

      {/* Header */}
      <h1 style={{
        fontFamily: CORMORANT,
        fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
        fontWeight: 400,
        fontStyle: 'italic',
        letterSpacing: '-0.02em',
        color: '#1a1a1a',
        margin: '0 0 4px',
      }}>
        Upload interview
      </h1>
      <p style={{
        fontFamily: GEIST,
        fontSize: '0.875rem',
        fontWeight: 300,
        color: '#6b6b6b',
        margin: '0 0 40px',
        lineHeight: 1.6,
      }}>
        For <strong style={{ fontWeight: 500, color: '#1a1a1a' }}>{portrait.display_name}</strong>
        {' '}— audio recording of a friend, colleague, or family member speaking about this person.
      </p>

      <UploadForm portraitId={portrait.id} portraitName={portrait.display_name} />
    </div>
  )
}
