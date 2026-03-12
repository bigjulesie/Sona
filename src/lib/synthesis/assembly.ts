// src/lib/synthesis/assembly.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateEmbedding } from '@/lib/ingest/embeddings'

export type AccessTier = 'public' | 'acquaintance' | 'colleague' | 'family'

const TIER_ORDER: Record<AccessTier, number> = {
  public: 0,
  acquaintance: 1,
  colleague: 2,
  family: 3,
}

interface SubscriptionRow {
  tier: string
  status: string
}

export function resolveSubscriberTier(
  subscription: SubscriptionRow | null,
): AccessTier {
  if (!subscription || subscription.status !== 'active') return 'public'
  return (subscription.tier as AccessTier) ?? 'public'
}

interface CurrentSnippet {
  prompt_content: string
  nlp_delivery_notes: string | null
}

interface AssemblyInput {
  identityPrompt: string
  selectedCurrents: CurrentSnippet[]
  ragContext: string
  displayName: string
}

export function buildAssembledPrompt(input: AssemblyInput): string {
  const parts: string[] = [input.identityPrompt.trim()]

  for (const current of input.selectedCurrents) {
    parts.push('---')
    parts.push(current.prompt_content.trim())
    if (current.nlp_delivery_notes?.trim()) {
      parts.push(current.nlp_delivery_notes.trim())
    }
  }

  if (input.ragContext.trim()) {
    parts.push('---')
    parts.push(`REFERENCE MATERIAL (from ${input.displayName}'s own words):\n\n${input.ragContext.trim()}`)
  }

  return parts.join('\n\n')
}

const CURRENT_SIMILARITY_THRESHOLD = 0.65

export async function assemblePrompt(
  supabase: SupabaseClient,
  portraitId: string,
  subscriberId: string,
  message: string,
  ragChunks: Array<{ content: string; source_title: string }>,
): Promise<string> {
  // 1. Resolve subscriber tier
  const { data: subscription } = await (supabase as any)
    .from('subscriptions')
    .select('tier, status')
    .eq('subscriber_id', subscriberId)
    .eq('portrait_id', portraitId)
    .eq('status', 'active')
    .maybeSingle()

  const tier = resolveSubscriberTier(subscription)
  const tierLevel = TIER_ORDER[tier]

  // 2. Load portrait synthesis status + display name
  const { data: portrait } = await (supabase as any)
    .from('portraits')
    .select('synthesis_status, display_name, system_prompt')
    .eq('id', portraitId)
    .single()

  const usesSynthesis = portrait?.synthesis_status === 'ready'

  // 3. Load identity prompt
  let identityPrompt = portrait?.system_prompt ?? ''
  if (usesSynthesis) {
    const { data: identityRow } = await (supabase as any)
      .from('sona_identity_prompts')
      .select('prompt_content')
      .eq('portrait_id', portraitId)
      .eq('tier', tier)
      .maybeSingle()
    if (identityRow?.prompt_content) identityPrompt = identityRow.prompt_content
  }

  // 4. Select relevant currents via semantic similarity
  const selectedCurrents: CurrentSnippet[] = []
  if (usesSynthesis && message.trim()) {
    const queryEmbedding = await generateEmbedding(message)

    const { data: currents } = await (supabase as any).rpc('match_sona_modules', {
      query_embedding: JSON.stringify(queryEmbedding),
      portrait_id: portraitId,
      tier_level: tierLevel,
      match_count: 2,
      similarity_threshold: CURRENT_SIMILARITY_THRESHOLD,
    })

    if (currents?.length) {
      selectedCurrents.push(...currents.map((c: any) => ({
        prompt_content: c.prompt_content,
        nlp_delivery_notes: c.nlp_delivery_notes,
      })))
    }
  }

  // 5. Format RAG context
  const ragContext = ragChunks
    .map(c => `[Source: ${c.source_title}]\n${c.content}`)
    .join('\n\n---\n\n')

  return buildAssembledPrompt({
    identityPrompt,
    selectedCurrents,
    ragContext,
    displayName: portrait?.display_name ?? 'this person',
  })
}
