'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateProfile(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const fullName = (formData.get('full_name') as string ?? '').trim()

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', user.id)

  if (error) throw new Error('Failed to save profile')

  revalidatePath('/account')
  redirect('/account?saved=1')
}

export async function deleteAccount() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await createAdminClient().auth.admin.deleteUser(user.id)
  if (error) throw new Error('Failed to delete account')

  redirect('/')
}
