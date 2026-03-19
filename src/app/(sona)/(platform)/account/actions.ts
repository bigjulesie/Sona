'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateProfile(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const raw = formData.get('full_name')
  const fullName = typeof raw === 'string' ? raw.trim() : ''

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

  // deleteUser invalidates all sessions server-side; no need to sign out first
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id)
  if (error) throw new Error('Failed to delete account')

  redirect('/')
}

export async function updateVoice(gender: 'male' | 'female') {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('profiles')
    .update({ voice_gender: gender } as any)
    .eq('id', user.id)

  if (error) throw new Error('Failed to save voice preference')
  revalidatePath('/account')
}

export async function updateAvatar(avatarUrl: string, haloColor: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl, avatar_halo_color: haloColor })
    .eq('id', user.id)

  if (error) throw new Error('Failed to save avatar')

  revalidatePath('/account')
  revalidatePath('/', 'layout')  // revalidates SonaNav across all pages
}
