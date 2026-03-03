'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signUpWithMagicLink(formData: FormData) {
  const email = formData.get('email') as string
  const supabase = await createServerSupabaseClient()

  const domain = process.env.NEXT_PUBLIC_SONA_DOMAIN
  if (!domain) throw new Error('NEXT_PUBLIC_SONA_DOMAIN is not set')

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `https://${domain}/auth/callback?next=/onboarding`,
    },
  })

  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`)
  redirect('/signup?sent=true')
}
