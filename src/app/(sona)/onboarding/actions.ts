'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export async function completeOnboarding(destination: 'create' | 'explore') {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await createAdminClient()
    .from('profiles')
    .update({ onboarding_complete: true })
    .eq('id', user.id)

  redirect(destination === 'create' ? '/dashboard/create' : '/explore')
}
