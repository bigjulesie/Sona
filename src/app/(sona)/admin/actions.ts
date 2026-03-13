'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function assertAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')
  // Use admin client for profile read to guarantee success regardless of RLS policy state
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) throw new Error('Forbidden')
}

export async function togglePortraitPublished(portraitId: string, isPublic: boolean) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('portraits')
    .update({ is_public: isPublic })
    .eq('id', portraitId)
  if (error) throw new Error('Failed to update portrait')
  revalidatePath('/admin')
}
