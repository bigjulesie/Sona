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

export async function saveVerifyStep(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const portrait_id = formData.get('portrait_id') as string
  const linkedin_url = (formData.get('linkedin_url') as string | null)?.trim() ?? ''
  const search_context_raw = (formData.get('search_context') as string | null)?.trim() ?? ''
  const website_url = (formData.get('website_url') as string | null)?.trim() ?? ''

  // Field validation
  if (linkedin_url && !linkedin_url.includes('linkedin.com/in/')) {
    return { error: 'LinkedIn URL must include linkedin.com/in/' }
  }

  if (website_url) {
    try {
      new URL(website_url)
    } catch {
      return { error: 'Website URL is not valid' }
    }
  }

  // Trim search context to 200 chars without erroring
  const search_context = search_context_raw.slice(0, 200)

  // Verify portrait belongs to current user
  const { data: portrait } = await createAdminClient()
    .from('portraits')
    .select('id')
    .eq('id', portrait_id)
    .eq('creator_id', user.id)
    .maybeSingle()

  if (!portrait) {
    return { error: 'Portrait not found.' }
  }

  // Update portrait with verify fields and mark research as running
  await createAdminClient()
    .from('portraits')
    .update({
      linkedin_url: linkedin_url || null,
      search_context: search_context || null,
      website_url: website_url || null,
      web_research_status: 'running',
    })
    .eq('id', portrait_id)

  // Fire-and-forget: kick off web research
  try {
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/research/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
      },
      body: JSON.stringify({ portrait_id }),
    }).catch(err => console.error('[research/start] fire-and-forget error:', err))
  } catch (err) {
    console.error('[research/start] fetch setup error:', err)
  }

  redirect(`/dashboard/create?step=3&portrait_id=${portrait_id}`)
}
