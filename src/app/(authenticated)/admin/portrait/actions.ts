'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function updateSystemPrompt(portraitId: string, systemPrompt: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('portraits')
    .update({ system_prompt: systemPrompt })
    .eq('id', portraitId)

  if (error) return { error: error.message }

  await supabase.from('audit_log').insert({
    action: 'update_system_prompt',
    resource_type: 'portrait',
    resource_id: portraitId,
    metadata: { prompt_length: systemPrompt.length },
  })

  revalidatePath('/admin/portrait')
  return { success: true }
}
