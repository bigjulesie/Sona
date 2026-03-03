'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateSonaSettings(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id')
    .eq('creator_id', user.id)
    .single()

  if (!portrait) redirect('/dashboard/create')

  const { error } = await createAdminClient().from('portraits').update({
    tagline: formData.get('tagline') as string,
    bio: formData.get('bio') as string,
    category: formData.get('category') as string,
  }).eq('id', portrait.id)

  if (error) throw new Error('Failed to save settings')

  revalidatePath('/dashboard/settings')
}
