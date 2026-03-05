'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { sendWelcomeEmail } from '@/lib/email'

export async function completeOnboarding(destination: 'create' | 'explore') {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await createAdminClient()
    .from('profiles')
    .update({ onboarding_complete: true })
    .eq('id', user.id)

  if (error) redirect('/onboarding?error=true')

  // Send welcome email (fire-and-forget — don't block redirect on failure)
  if (user.email) {
    sendWelcomeEmail(user.email).catch(() => {})
  }

  redirect(destination === 'create' ? '/dashboard/create' : '/explore')
}
