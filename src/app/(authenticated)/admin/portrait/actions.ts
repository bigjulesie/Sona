'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function createPortrait(formData: FormData) {
  const displayName = (formData.get('display_name') as string)?.trim()
  const slug = (formData.get('slug') as string)?.trim()
  const systemPrompt = (formData.get('system_prompt') as string)?.trim()

  if (!displayName || !slug || !systemPrompt) {
    return { error: 'Display name, slug, and system prompt are required' }
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { error: 'Slug may only contain lowercase letters, numbers, and hyphens' }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('portraits')
    .insert({ display_name: displayName, slug, system_prompt: systemPrompt })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    action: 'create_portrait',
    resource_type: 'portrait',
    resource_id: data.id,
    metadata: { slug, display_name: displayName },
  })

  revalidatePath('/admin/portrait')
  return { success: true, id: data.id }
}

export async function updatePortrait(portraitId: string, fields: {
  display_name: string
  slug: string
  system_prompt: string
}) {
  if (!/^[a-z0-9-]+$/.test(fields.slug)) {
    return { error: 'Slug may only contain lowercase letters, numbers, and hyphens' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('portraits')
    .update(fields)
    .eq('id', portraitId)

  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    action: 'update_portrait',
    resource_type: 'portrait',
    resource_id: portraitId,
    metadata: { prompt_length: fields.system_prompt.length },
  })

  revalidatePath('/admin/portrait')
  return { success: true }
}

