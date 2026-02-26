'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import Anthropic from '@anthropic-ai/sdk'

export async function createPortrait(formData: FormData) {
  const displayName = (formData.get('display_name') as string)?.trim()
  const slug = (formData.get('slug') as string)?.trim()
  const systemPrompt = (formData.get('system_prompt') as string)?.trim() ?? ''

  if (!displayName || !slug) {
    return { error: 'Display name and slug are required' }
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { error: 'Slug may only contain lowercase letters, numbers, and hyphens' }
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('portraits')
    .insert({
      display_name: displayName,
      slug,
      system_prompt: systemPrompt,
      voice_enabled: false,
      voice_provider_id: null,
    })
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
  voice_enabled: boolean
  voice_provider_id: string | null
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

export async function generateSystemPrompt(portraitId: string, displayName: string) {
  const supabase = createAdminClient()

  // Fetch all knowledge chunks for this portrait, ordered by source
  const { data: chunks, error } = await supabase
    .from('knowledge_chunks')
    .select('content, source_title, source_type')
    .eq('portrait_id', portraitId)
    .order('source_title')
    .order('chunk_index')

  if (error) return { error: error.message }

  if (!chunks || chunks.length === 0) {
    return { error: 'No knowledge chunks found for this Sona. Ingest some content first.' }
  }

  // Build source material, capped at ~120k characters to stay well within context limits
  let totalChars = 0
  const CAP = 120_000
  const sections: string[] = []
  let lastTitle = ''

  for (const chunk of chunks) {
    if (totalChars >= CAP) break
    const header = chunk.source_title && chunk.source_title !== lastTitle
      ? `\n[${chunk.source_type ?? 'source'}: ${chunk.source_title}]\n`
      : ''
    lastTitle = chunk.source_title ?? ''
    const block = header + chunk.content
    sections.push(block)
    totalChars += block.length
  }

  const sourceMaterial = sections.join('\n\n')
  const truncated = chunks.length > sections.length

  const anthropic = new Anthropic()

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    system: `You are an expert at crafting AI persona system prompts. You write with precision, depth, and psychological acuity. Your task is to synthesise a rich, authentic system prompt for an AI representation of a real person, based solely on their own words and documented expressions.`,
    messages: [
      {
        role: 'user',
        content: `Below is a collection of source material from ${displayName} — transcripts, interviews, letters, and other writings in their own words.

Study this material carefully and write a comprehensive system prompt for an AI that authentically represents ${displayName}. The system prompt should:

1. **Voice & tone** — Capture how they speak: vocabulary, sentence structure, rhythm, formality, humour, directness
2. **Core values & beliefs** — What they care about most, their ethical stances, what they return to repeatedly
3. **Characteristic thinking patterns** — How they approach problems, make arguments, connect ideas
4. **Personality** — Warmth, wit, seriousness, contradictions, emotional texture
5. **Knowledge & expertise** — The domains they speak to with authority and depth
6. **Boundaries** — What they wouldn't say, topics they'd approach with care or decline
7. **Relationship with the person they're speaking to** — How they engage with different people

Write the system prompt in second person ("You are ${displayName}..."). It should be detailed enough that the AI can respond authentically across a wide range of questions and conversations, grounding itself in what this person has actually expressed.

Do not invent details not supported by the source material. Where the material reveals genuine complexity or contradiction, honour that — it is what makes the representation authentic.

---

SOURCE MATERIAL:

${sourceMaterial}

${truncated ? `\n[Note: ${chunks.length - sections.length} additional chunks were not included due to length limits. The above is a representative sample.]` : ''}`,
      },
    ],
  })

  const generated = message.content[0].type === 'text' ? message.content[0].text : ''

  await supabase.from('audit_log').insert({
    action: 'generate_system_prompt',
    resource_type: 'portrait',
    resource_id: portraitId,
    metadata: { chunks_used: sections.length, total_chunks: chunks.length, prompt_length: generated.length },
  })

  return { success: true, systemPrompt: generated }
}
