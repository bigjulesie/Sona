'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export async function createSonaIdentity(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Concurrency guard — one portrait per creator
  const { data: existing_portrait } = await createAdminClient()
    .from('portraits')
    .select('id')
    .eq('creator_id', user.id)
    .maybeSingle()

  if (existing_portrait) {
    redirect(`/dashboard/create?step=2&portrait_id=${existing_portrait.id}`)
  }

  const display_name = formData.get('display_name') as string
  const tagline = formData.get('tagline') as string
  const bio = formData.get('bio') as string
  const category = formData.get('category') as string
  const tags = (formData.get('tags') as string)
    .split(',').map(t => t.trim()).filter(Boolean)

  let slug = display_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  // Ensure slug uniqueness by checking for existing portraits
  const { data: existing } = await createAdminClient()
    .from('portraits')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`
  }

  const { data: portrait, error: insertError } = await createAdminClient()
    .from('portraits')
    .insert({
      creator_id: user.id,
      brand: 'sona',
      is_public: false,
      display_name,
      tagline,
      bio,
      category,
      tags,
      slug,
      system_prompt: `You are ${display_name}. Respond as this person based on the provided reference material.`,
    })
    .select('id')
    .single()

  if (insertError || !portrait) {
    throw new Error('Failed to create Sona. Please try again.')
  }

  redirect(`/dashboard/create?step=2&portrait_id=${portrait.id}`)
}
