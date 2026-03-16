'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

const GEIST = 'var(--font-geist-sans)'

export function SignOutButton() {
  const router = useRouter()

  async function signOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={signOut}
      className="sona-link"
      style={{
        fontFamily: GEIST,
        fontSize: '0.875rem',
        color: '#6b6b6b',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        fontWeight: 400,
      }}
    >
      Sign out
    </button>
  )
}
