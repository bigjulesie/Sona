// src/lib/research/search.ts

export interface SearchStrategy {
  query: string
  maxResults: number
  directUrl?: string
}

export interface SearchResult {
  url: string
  title: string
  content: string
}

/**
 * Build all search strategies for a creator.
 * All web-researched sources use source_type = 'web_research' on ingest.
 */
export function buildSearchStrategies(
  name: string,
  context: string | null,
  websiteUrl: string | null,
  linkedinUrl: string | null,
): SearchStrategy[] {
  const c = context ? ` ${context}` : ''
  const strategies: SearchStrategy[] = [
    { query: `"${name}"${c}`,                                  maxResults: 5 },
    { query: `"${name}"${c} interview`,                        maxResults: 5 },
    { query: `"${name}"${c} article OR essay`,                 maxResults: 5 },
    { query: `"${name}"${c} talk OR keynote OR speech`,        maxResults: 5 },
    { query: `"${name}"${c} podcast`,                          maxResults: 5 },
    { query: `"${name}"${c} book`,                             maxResults: 5 },
    { query: `"${name}" wikipedia`,                            maxResults: 3 },
    { query: `"${name}"${c} scholar OR research OR paper`,     maxResults: 5 },
  ]
  if (websiteUrl) {
    strategies.push({ query: '', maxResults: 1, directUrl: websiteUrl })
  }
  if (linkedinUrl) {
    strategies.push({ query: '', maxResults: 1, directUrl: linkedinUrl })
  }
  return strategies
}

export function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>()
  return results.filter(r => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })
}

interface TavilyResult {
  url: string
  title: string
  raw_content?: string
  content?: string
}

interface TavilyResponse {
  results: TavilyResult[]
}

/**
 * Run a single Tavily search. Returns empty array on error.
 */
export async function tavilySearch(
  query: string,
  maxResults: number,
  apiKey: string,
): Promise<TavilyResult[]> {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        include_raw_content: true,
        max_results: maxResults,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as TavilyResponse
    return data.results ?? []
  } catch {
    return []
  }
}
