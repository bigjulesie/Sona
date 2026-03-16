// src/lib/research/web-research.ts
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSearchStrategies, tavilySearch, deduplicateResults } from './search'
import { fetchUrl } from './fetch-url'
import { filterCandidate, meetsThresholds } from './filter'

interface Portrait {
  id: string
  display_name: string
  search_context: string | null
  linkedin_url: string | null
  website_url: string | null
}

export interface ResearchJobMeta {
  queries_run: number
  urls_found: number
  urls_passing_filter: number
  urls_ingested: number
}

interface IngestedSource {
  id: string
  raw_content: string
  source_type: string
}

/**
 * Run the full web research pipeline for a portrait.
 * Returns ingested sources (with raw_content) so the caller can run
 * evidence extraction. Does NOT call after() — that is the caller's responsibility.
 */
export async function runWebResearch(
  portrait: Portrait,
): Promise<{ meta: ResearchJobMeta; sources: IngestedSource[] }> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) throw new Error('TAVILY_API_KEY not configured')

  const admin = createAdminClient()
  const meta: ResearchJobMeta = { queries_run: 0, urls_found: 0, urls_passing_filter: 0, urls_ingested: 0 }

  // 1. Build search strategies (includes direct-fetch for website + LinkedIn)
  const strategies = buildSearchStrategies(
    portrait.display_name,
    portrait.search_context,
    portrait.website_url,
    portrait.linkedin_url,
  )

  // 2. Run all strategies in parallel
  const allResults = await Promise.all(
    strategies.map(async (strategy) => {
      if (strategy.directUrl) {
        const fetched = await fetchUrl(strategy.directUrl)
        if (!fetched?.text) return []
        return [{ url: strategy.directUrl, title: fetched.title ?? strategy.directUrl, content: fetched.text }]
      }
      meta.queries_run++
      const tavilyResults = await tavilySearch(strategy.query, strategy.maxResults, apiKey)
      return tavilyResults.map(r => ({
        url: r.url,
        title: r.title,
        content: r.raw_content || r.content || '',
      }))
    }),
  )

  // 3. Deduplicate
  const candidates = deduplicateResults(allResults.flat())
  meta.urls_found = candidates.length

  // 4. For candidates with no content yet, fetch the URL
  const enriched = await Promise.all(
    candidates.map(async (c) => {
      if (c.content) return c
      const fetched = await fetchUrl(c.url)
      return { ...c, content: fetched?.text ?? '', title: fetched?.title ?? c.title }
    }),
  )

  // 5. LLM identity + relevance filter — run in parallel
  const filterResults = await Promise.all(
    enriched.map(async (c) => {
      if (!c.content) return null
      try {
        const domain = new URL(c.url).hostname
        const snippet = c.content.slice(0, 500)
        const result = await filterCandidate(portrait.display_name, portrait.search_context, {
          url: c.url,
          domain,
          title: c.title,
          snippet,
        })
        if (!result || !meetsThresholds(result)) return null
        return c
      } catch {
        return null
      }
    }),
  )

  const passed = filterResults.filter(Boolean) as typeof enriched
  meta.urls_passing_filter = passed.length

  // 6. Insert each passing URL as a content_source with source_type = 'web_research'
  const ingestedSources: IngestedSource[] = []
  for (const article of passed) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: source, error } = await (admin as any)
        .from('content_sources')
        .insert({
          portrait_id: portrait.id,
          title: article.title,
          source_type: 'web_research',
          min_tier: 'public',
          status: 'processing',
          raw_content: article.content,
          source_url: article.url,
        })
        .select('id')
        .single()
      if (error || !source) continue
      meta.urls_ingested++
      ingestedSources.push({ id: source.id, raw_content: article.content, source_type: 'web_research' })
    } catch {
      // One failing URL never stops the rest
    }
  }

  return { meta, sources: ingestedSources }
}
