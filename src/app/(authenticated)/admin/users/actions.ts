'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/types'

type AccessTier = Database['public']['Enums']['access_tier']

export async function updateUserTier(userId: string, tier: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('profiles')
    .update({ access_tier: tier as AccessTier })
    .eq('id', userId)

  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    action: 'update_access_tier',
    resource_type: 'profile',
    resource_id: userId,
    metadata: { new_tier: tier },
  })

  return { success: true }
}

export async function inviteUser(email: string, tier: string, portraitId: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { access_tier: tier },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
  })

  if (error) return { error: error.message }

  // Update portrait_id on the auto-created profile
  if (data.user) {
    await supabase
      .from('profiles')
      .update({ portrait_id: portraitId })
      .eq('id', data.user.id)
  }

  await supabase.from('audit_log').insert({
    action: 'invite_user',
    resource_type: 'profile',
    metadata: { email, tier },
  })

  return { success: true }
}
