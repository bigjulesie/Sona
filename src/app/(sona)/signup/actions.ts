'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signUpWithMagicLink(formData: FormData) {
  const email = formData.get('email') as string
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `https://${process.env.NEXT_PUBLIC_SONA_DOMAIN}/auth/callback?next=/onboarding`,
    },
  })

  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`)
  redirect('/signup?sent=true')
}
