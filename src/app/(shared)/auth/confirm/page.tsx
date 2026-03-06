'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient as createImplicitClient } from '@supabase/supabase-js'
import { createClient as createCookieClient } from '@/lib/supabase/client'

function AuthConfirm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const hostname = window.location.hostname
    const isSona = hostname.includes('entersona.com') || hostname === 'localhost' || hostname === '127.0.0.1'
    const next = searchParams.get('next') ?? (isSona ? '/explore' : '/chat')

    // Implicit-flow client reads #access_token from the URL hash.
    // createBrowserClient from @supabase/ssr hardcodes PKCE and ignores the hash.
    const implicitClient = createImplicitClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { flowType: 'implicit', detectSessionInUrl: true } }
    )

    const { data: { subscription } } = implicitClient.auth.onAuthStateChange(async (_event, session) => {
      if (!session) return
      subscription.unsubscribe()

      // Copy the session into the SSR cookie-based client so server components can read it.
      const cookieClient = createCookieClient()
      await cookieClient.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })

      router.replace(next)
    })

    const timer = setTimeout(() => {
      implicitClient.auth.getSession().then(({ data: { session } }) => {
        if (!session) router.replace('/login?error=auth')
      })
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#fff',
    }}>
      <p style={{
        fontFamily: 'var(--font-cormorant)',
        fontSize: '1.25rem',
        fontWeight: 400,
        fontStyle: 'italic',
        color: '#b0b0b0',
      }}>
        Signing you in…
      </p>
    </main>
  )
}

export default function AuthConfirmPage() {
  return (
    <Suspense>
      <AuthConfirm />
    </Suspense>
  )
}
