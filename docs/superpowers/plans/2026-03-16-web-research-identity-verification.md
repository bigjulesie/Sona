# Web Research & Identity Verification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically research a Sona creator on the web when they set up their Sona, solving the cold-start problem by pulling publicly available content before they've added anything manually.

**Architecture:** A new wizard Step 2 "Verify" collects optional identity signals (LinkedIn URL, search context hint, personal website). On continue, a `saveVerifyStep` server action fires a fire-and-forget request to `POST /api/research/start`, which runs the full pipeline: 9 parallel Tavily searches → Haiku LLM filter → sequential evidence extraction per source inside a single `after()` call. All web-researched sources are stored with `source_type = 'web_research'` and displayed with a "Web" badge. Creators can delete any source via a new delete action.

**Tech Stack:** Tavily search API, Claude Haiku (filter), `@mozilla/readability` + jsdom (HTML extraction), Next.js `after()`, Supabase admin client.

---

## Chunk 1: Foundation — DB, types, deps

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/00019_web_research.sql`

All schema changes go in a single migration — including the `raw_content` and `source_url` columns needed by the research pipeline.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/00019_web_research.sql

-- New columns on portraits
ALTER TABLE portraits
  ADD COLUMN IF NOT EXISTS linkedin_url        text,
  ADD COLUMN IF NOT EXISTS search_context      text,
  ADD COLUMN IF NOT EXISTS website_url         text,
  ADD COLUMN IF NOT EXISTS web_research_status text NOT NULL DEFAULT 'never'
    CHECK (web_research_status IN ('never', 'running', 'complete', 'error'));

-- Columns to store web-researched article content and origin URL
ALTER TABLE content_sources
  ADD COLUMN IF NOT EXISTS raw_content text,
  ADD COLUMN IF NOT EXISTS source_url  text;

-- New source_type value: web_research
ALTER TABLE content_sources
  DROP CONSTRAINT IF EXISTS content_sources_source_type_check;
ALTER TABLE content_sources
  ADD CONSTRAINT content_sources_source_type_check
  CHECK (source_type IN (
    'transcript', 'interview', 'interview_audio', 'article', 'book',
    'essay', 'speech', 'letter', 'other', 'web_research'
  ));

-- New job type: web_research
ALTER TABLE sona_synthesis_jobs
  DROP CONSTRAINT IF EXISTS sona_synthesis_jobs_job_type_check;
ALTER TABLE sona_synthesis_jobs
  ADD CONSTRAINT sona_synthesis_jobs_job_type_check
  CHECK (job_type IN (
    'evidence_extraction', 'dimension_synthesis', 'module_generation', 'web_research'
  ));
```

- [ ] **Step 2: Push migration to local Supabase**

```bash
npx supabase db push
```

Expected: migration applied, no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00019_web_research.sql
git commit -m "feat: add web_research migration — portraits columns, content_sources raw_content/source_url, new type constraints"
```

---

### Task 2: TypeScript type updates

**Files:**
- Modify: `src/lib/synthesis/types.ts`
- Modify: `src/lib/synthesis/jobs.ts`

- [ ] **Step 1: Add `'web_research'` to `SynthesisJobType`**

In `src/lib/synthesis/types.ts`, update the union at line 57–60:

```ts
export type SynthesisJobType =
  | 'evidence_extraction'
  | 'dimension_synthesis'
  | 'module_generation'
  | 'web_research'
```

- [ ] **Step 2: Add `web_research` weight to `SOURCE_TYPE_WEIGHTS`**

In `src/lib/synthesis/jobs.ts`, add to the `SOURCE_TYPE_WEIGHTS` record (after `other: 0.9`):

```ts
const SOURCE_TYPE_WEIGHTS: Record<string, number> = {
  interview_audio: 1.3,
  interview: 1.2,
  article: 1.0,
  book: 1.0,
  essay: 1.0,
  transcript: 1.0,
  speech: 1.0,
  letter: 1.0,
  social_media: 0.8,
  other: 0.9,
  web_research: 1.0,
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/synthesis/types.ts src/lib/synthesis/jobs.ts
git commit -m "feat: add web_research to SynthesisJobType and SOURCE_TYPE_WEIGHTS"
```

---

### Task 3: Install new dependencies

**Files:**
- Modify: `package.json`

`@mozilla/readability` is not installed. `jsdom` is in devDependencies but needed in production API routes — it must move to `dependencies`.

- [ ] **Step 1: Install `@mozilla/readability` and move `jsdom` to production deps**

```bash
npm install @mozilla/readability jsdom
npm uninstall --save-dev jsdom
npm install --save-dev @types/jsdom
```

> `@mozilla/readability` ships its own TypeScript types (no `@types` package needed for it).

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @mozilla/readability, move jsdom to production dependencies"
```

---

## Chunk 2: Research library

### Task 4: `fetch-url.ts` — HTML fetch and article extraction

**Files:**
- Create: `src/lib/research/fetch-url.ts`
- Test: `tests/lib/research/fetch-url.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/research/fetch-url.test.ts
import { describe, it, expect } from 'vitest'
import { extractArticleText } from '@/lib/research/fetch-url'

describe('extractArticleText', () => {
  it('extracts article text from HTML', async () => {
    const html = `<html><head><title>Test Article</title></head><body>
      <article><p>This is the article content about the topic.</p></article>
    </body></html>`
    const result = await extractArticleText(html, 'https://example.com/article')
    expect(result.text).toContain('article content')
    expect(result.title).toBe('Test Article')
  })

  it('returns empty text for structureless HTML', async () => {
    const html = `<html><body></body></html>`
    const result = await extractArticleText(html, 'https://example.com/')
    expect(result.text).toBe('')
  })

  it('does not throw on malformed HTML', async () => {
    await expect(extractArticleText('<not valid html>', 'https://example.com/')).resolves.toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/research/fetch-url.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/research/fetch-url'"

- [ ] **Step 3: Implement `fetch-url.ts`**

```ts
// src/lib/research/fetch-url.ts
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'

export interface FetchedArticle {
  text: string
  title: string | null
}

/**
 * Extract article text from raw HTML using @mozilla/readability.
 * Does not perform any network request.
 */
export async function extractArticleText(
  html: string,
  url: string,
): Promise<FetchedArticle> {
  try {
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    return {
      text: article?.textContent?.trim() ?? '',
      title: article?.title ?? null,
    }
  } catch {
    return { text: '', title: null }
  }
}

/**
 * Fetch a URL and extract article text.
 * Returns null on network error or non-200 response.
 */
export async function fetchUrl(url: string): Promise<FetchedArticle | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SonaBot/1.0)' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const html = await res.text()
    return extractArticleText(html, url)
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/research/fetch-url.test.ts
```

Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/fetch-url.ts tests/lib/research/fetch-url.test.ts
git commit -m "feat: add fetch-url.ts for HTML article extraction via @mozilla/readability"
```

---

### Task 5: `filter.ts` — Claude Haiku identity filter

**Files:**
- Create: `src/lib/research/filter.ts`
- Test: `tests/lib/research/filter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/research/filter.test.ts
import { describe, it, expect } from 'vitest'
import { parseFilterResponse, meetsThresholds } from '@/lib/research/filter'

describe('parseFilterResponse', () => {
  it('parses a valid JSON response', () => {
    const raw = JSON.stringify({ identity_match: 0.9, relevance: 0.8, reason: 'Direct mention' })
    const result = parseFilterResponse(raw)
    expect(result).toEqual({ identity_match: 0.9, relevance: 0.8, reason: 'Direct mention' })
  })

  it('parses JSON wrapped in markdown code fence', () => {
    const raw = '```json\n{"identity_match":0.5,"relevance":0.6,"reason":"Possible"}\n```'
    const result = parseFilterResponse(raw)
    expect(result?.identity_match).toBe(0.5)
  })

  it('returns null for invalid JSON', () => {
    const result = parseFilterResponse('not json at all')
    expect(result).toBeNull()
  })
})

describe('meetsThresholds', () => {
  it('passes when both thresholds are met', () => {
    expect(meetsThresholds({ identity_match: 0.8, relevance: 0.6, reason: '' })).toBe(true)
  })

  it('fails when identity_match is below 0.7', () => {
    expect(meetsThresholds({ identity_match: 0.6, relevance: 0.8, reason: '' })).toBe(false)
  })

  it('fails when relevance is below 0.5', () => {
    expect(meetsThresholds({ identity_match: 0.9, relevance: 0.4, reason: '' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/research/filter.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/research/filter'"

- [ ] **Step 3: Implement `filter.ts`**

```ts
// src/lib/research/filter.ts
import Anthropic from '@anthropic-ai/sdk'

export interface FilterResult {
  identity_match: number
  relevance: number
  reason: string
}

export interface CandidateArticle {
  url: string
  domain: string
  title: string
  snippet: string // first 500 chars of content
}

const IDENTITY_THRESHOLD = 0.7
const RELEVANCE_THRESHOLD = 0.5

export function parseFilterResponse(raw: string): FilterResult | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(cleaned)
    if (
      typeof parsed.identity_match !== 'number' ||
      typeof parsed.relevance !== 'number'
    ) return null
    return {
      identity_match: parsed.identity_match,
      relevance: parsed.relevance,
      reason: parsed.reason ?? '',
    }
  } catch {
    return null
  }
}

export function meetsThresholds(result: FilterResult): boolean {
  return result.identity_match >= IDENTITY_THRESHOLD && result.relevance >= RELEVANCE_THRESHOLD
}

/**
 * Ask Claude Haiku whether a candidate article is about the right person
 * and contains material useful for character synthesis.
 * Returns null on API failure — caller treats null as failed filter (discard).
 */
export async function filterCandidate(
  creatorName: string,
  searchContext: string | null,
  candidate: CandidateArticle,
): Promise<FilterResult | null> {
  const client = new Anthropic()
  const contextLine = searchContext ? `Context about the person: ${searchContext}` : ''

  const prompt = `You are evaluating whether a web article is about a specific person and contains material useful for building a character profile.

Creator name: ${creatorName}
${contextLine}
URL domain: ${candidate.domain}
Article title: ${candidate.title}
Content preview: ${candidate.snippet}

Return JSON with exactly these fields:
- identity_match: 0.0–1.0 (how confident you are this is about the correct ${creatorName})
- relevance: 0.0–1.0 (how useful this content is for understanding their personality, beliefs, expertise, or experiences)
- reason: brief explanation (1–2 sentences)

Respond with raw JSON only, no markdown.`

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    return parseFilterResponse(text)
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/research/filter.test.ts
```

Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/filter.ts tests/lib/research/filter.test.ts
git commit -m "feat: add filter.ts — Claude Haiku identity and relevance scoring for web research"
```

---

### Task 6: `search.ts` — Tavily search strategies

**Files:**
- Create: `src/lib/research/search.ts`
- Test: `tests/lib/research/search.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/research/search.test.ts
import { describe, it, expect } from 'vitest'
import { buildSearchStrategies, deduplicateResults } from '@/lib/research/search'

describe('buildSearchStrategies', () => {
  it('builds 8 search strategies with no optional URLs', () => {
    // 8 Tavily query strategies, no direct-URL strategies
    const strategies = buildSearchStrategies('Ada Lovelace', null, null, null)
    expect(strategies).toHaveLength(8)
    expect(strategies.every(s => !s.directUrl)).toBe(true)
  })

  it('includes name in all queries', () => {
    const strategies = buildSearchStrategies('Ada Lovelace', null, null, null)
    strategies.filter(s => !s.directUrl).forEach(s => {
      expect(s.query).toContain('"Ada Lovelace"')
    })
  })

  it('includes context in queries when provided', () => {
    const strategies = buildSearchStrategies('Ada Lovelace', 'mathematician', null, null)
    expect(strategies[0].query).toContain('mathematician')
  })

  it('adds a direct-fetch strategy for websiteUrl when provided', () => {
    const strategies = buildSearchStrategies('Ada Lovelace', null, 'https://ada.example.com', null)
    const websiteStrategy = strategies.find(s => s.directUrl === 'https://ada.example.com')
    expect(websiteStrategy).toBeDefined()
    expect(strategies).toHaveLength(9)
  })

  it('adds a direct-fetch strategy for linkedinUrl when provided', () => {
    const strategies = buildSearchStrategies('Ada Lovelace', null, null, 'https://linkedin.com/in/ada')
    const linkedinStrategy = strategies.find(s => s.directUrl === 'https://linkedin.com/in/ada')
    expect(linkedinStrategy).toBeDefined()
    expect(strategies).toHaveLength(9)
  })

  it('adds both direct-fetch strategies when both URLs provided', () => {
    const strategies = buildSearchStrategies('Ada Lovelace', null, 'https://ada.com', 'https://linkedin.com/in/ada')
    expect(strategies).toHaveLength(10)
  })
})

describe('deduplicateResults', () => {
  it('removes duplicate URLs, keeping first occurrence', () => {
    const results = [
      { url: 'https://a.com', title: 'A', content: 'a' },
      { url: 'https://b.com', title: 'B', content: 'b' },
      { url: 'https://a.com', title: 'A again', content: 'a2' },
    ]
    const deduped = deduplicateResults(results)
    expect(deduped).toHaveLength(2)
    expect(deduped[0].title).toBe('A')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/research/search.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/research/search'"

- [ ] **Step 3: Implement `search.ts`**

```ts
// src/lib/research/search.ts

export interface SearchStrategy {
  query: string
  maxResults: number
  directUrl?: string // if set, skip Tavily and fetch this URL directly
}

export interface SearchResult {
  url: string
  title: string
  content: string // raw_content from Tavily, or text fetched directly
}

/**
 * Build all search strategies for a creator.
 * All web-researched sources use source_type = 'web_research' on ingest —
 * the per-strategy query style is for finding the right content, not for labelling it.
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/research/search.test.ts
```

Expected: PASS — 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/search.ts tests/lib/research/search.test.ts
git commit -m "feat: add search.ts — Tavily search strategies and deduplication for web research"
```

---

### Task 7: `web-research.ts` — orchestrator

**Files:**
- Create: `src/lib/research/web-research.ts`

No unit test for the orchestrator — it calls external APIs. Integration is verified when the API route is live.

- [ ] **Step 1: Implement the orchestrator**

```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Fix any type errors before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/lib/research/web-research.ts
git commit -m "feat: add web-research.ts orchestrator — search, filter, and ingest pipeline"
```

---

## Chunk 3: API route and wizard

### Task 8: `POST /api/research/start` route

**Files:**
- Create: `src/app/api/research/start/route.ts`

This route accepts `{ portrait_id }`, returns `202` immediately, and runs the full research pipeline + per-source evidence extraction inside a **single** `after()` call. Evidence extraction is run sequentially within that callback (not nested after() calls, which are not supported by Next.js).

- [ ] **Step 1: Implement the route**

```ts
// src/app/api/research/start/route.ts
import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runWebResearch } from '@/lib/research/web-research'

export async function POST(request: NextRequest) {
  let portrait_id: string
  try {
    const body = await request.json() as { portrait_id?: string }
    portrait_id = body.portrait_id ?? ''
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!portrait_id) {
    return NextResponse.json({ error: 'portrait_id required' }, { status: 400 })
  }

  // Return 202 immediately — all heavy work runs inside a single after() call
  after(async () => {
    const admin = createAdminClient()

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: portrait } = await (admin as any)
        .from('portraits')
        .select('id, display_name, search_context, linkedin_url, website_url')
        .eq('id', portrait_id)
        .single()

      if (!portrait) return

      const { meta, sources } = await runWebResearch(portrait)

      // Evidence extraction: sequential per source within this single after() call.
      // Each source was already chunked and embedded by runWebResearch — here we
      // chunk + embed + extract evidence. Failures per source are caught individually.
      const { chunkText } = await import('@/lib/ingest/chunker')
      const { generateEmbeddings } = await import('@/lib/ingest/embeddings')
      const { extractEvidenceForSource } = await import('@/lib/synthesis/evidence-extract')

      for (const source of sources) {
        try {
          if (!source.raw_content) continue

          const chunks = chunkText(source.raw_content)
          const embeddings = await generateEmbeddings(chunks)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rows: any[] = chunks.map((chunk: string, i: number) => ({
            portrait_id,
            source_id: source.id,
            content: chunk,
            embedding: JSON.stringify(embeddings[i]),
            source_title: '',
            source_type: source.source_type,
            min_tier: 'public',
            chunk_index: i,
          }))

          await admin.from('knowledge_chunks').insert(rows)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin as any)
            .from('content_sources')
            .update({ status: 'ready' })
            .eq('id', source.id)

          await extractEvidenceForSource(source.id, portrait_id, source.source_type)
        } catch {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin as any)
            .from('content_sources')
            .update({ status: 'error' })
            .eq('id', source.id)
        }
      }

      // Mark research complete
      // Write job record with pipeline metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('sona_synthesis_jobs')
        .insert({
          portrait_id,
          job_type: 'web_research',
          status: 'complete',
          triggered_by: 'web_research_auto',
          metadata: meta,
        })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('portraits')
        .update({ web_research_status: 'complete' })
        .eq('id', portrait_id)
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('sona_synthesis_jobs')
        .insert({
          portrait_id,
          job_type: 'web_research',
          status: 'error',
          triggered_by: 'web_research_auto',
          metadata: {},
        })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('portraits')
        .update({ web_research_status: 'error' })
        .eq('id', portrait_id)
    }
  })

  return NextResponse.json({ ok: true }, { status: 202 })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/research/start/route.ts
git commit -m "feat: add POST /api/research/start — fire-and-forget web research API route"
```

---

### Task 9: `VerifyStep.tsx` and `saveVerifyStep` server action

**Files:**
- Create: `src/app/(sona)/(wizard)/dashboard/create/VerifyStep.tsx`
- Modify: `src/app/(sona)/(wizard)/dashboard/create/actions.ts` (add `saveVerifyStep`)

- [ ] **Step 1: Add `saveVerifyStep` to `actions.ts`**

In `src/app/(sona)/(wizard)/dashboard/create/actions.ts`, add this function after `createSonaIdentity`. Also add `revalidatePath` is not needed here but `redirect` is already imported.

```ts
export async function saveVerifyStep(
  portraitId: string,
  linkedinUrl: string | null,
  searchContext: string | null,
  websiteUrl: string | null,
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify ownership
  const { data: portrait } = await createAdminClient()
    .from('portraits')
    .select('id')
    .eq('id', portraitId)
    .eq('creator_id', user.id)
    .maybeSingle()
  if (!portrait) redirect('/dashboard')

  // Validate LinkedIn URL format if provided
  const cleanedLinkedin = linkedinUrl?.includes('linkedin.com/in/') ? linkedinUrl : null

  // Validate website URL format if provided
  let cleanedWebsite: string | null = null
  if (websiteUrl) {
    try {
      new URL(websiteUrl)
      cleanedWebsite = websiteUrl
    } catch {
      cleanedWebsite = null
    }
  }

  // Save fields and mark research as running
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (createAdminClient() as any)
    .from('portraits')
    .update({
      linkedin_url: cleanedLinkedin,
      search_context: searchContext?.slice(0, 200) ?? null,
      website_url: cleanedWebsite,
      web_research_status: 'running',
    })
    .eq('id', portraitId)

  // Fire-and-forget: start the research pipeline
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  fetch(`${baseUrl}/api/research/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portrait_id: portraitId }),
  }).catch(() => { /* intentional fire-and-forget */ })

  redirect(`/dashboard/create?step=3&portrait_id=${portraitId}`)
}
```

- [ ] **Step 2: Create `VerifyStep.tsx`**

```tsx
// src/app/(sona)/(wizard)/dashboard/create/VerifyStep.tsx
'use client'

import { useState } from 'react'
import { saveVerifyStep } from './actions'

const GEIST = 'var(--font-geist-sans)'

interface Props {
  portraitId: string
}

export function VerifyStep({ portraitId }: Props) {
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [searchContext, setSearchContext] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    await saveVerifyStep(
      portraitId,
      linkedinUrl.trim() || null,
      searchContext.trim() || null,
      websiteUrl.trim() || null,
    )
    // saveVerifyStep redirects — pending stays true until navigation completes
  }

  const labelStyle = {
    fontFamily: GEIST,
    fontSize: '0.6875rem',
    fontWeight: 500,
    letterSpacing: '0.09em',
    textTransform: 'uppercase' as const,
    color: '#b0b0b0',
    display: 'block',
    marginBottom: 10,
  }

  const inputStyle = {
    fontFamily: GEIST,
    fontSize: '0.9375rem',
    fontWeight: 300,
    color: '#1a1a1a',
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid rgba(0,0,0,0.15)',
    padding: '8px 0',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      <div>
        <label style={labelStyle}>
          LinkedIn URL <span style={{ fontWeight: 300, textTransform: 'none', letterSpacing: 0 }}>— optional</span>
        </label>
        <input
          type="url"
          value={linkedinUrl}
          onChange={e => setLinkedinUrl(e.target.value)}
          placeholder="https://linkedin.com/in/your-name"
          className="sona-input"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>
          Search context <span style={{ fontWeight: 300, textTransform: 'none', letterSpacing: 0 }}>— optional</span>
        </label>
        <input
          type="text"
          value={searchContext}
          onChange={e => setSearchContext(e.target.value)}
          placeholder="e.g. AI researcher, founder of Acme Corp"
          maxLength={200}
          className="sona-input"
          style={inputStyle}
        />
        <p style={{ fontFamily: GEIST, fontSize: '0.75rem', fontWeight: 300, color: '#b0b0b0', margin: '6px 0 0' }}>
          Helps us find the right person when your name is common.
        </p>
      </div>

      <div>
        <label style={labelStyle}>
          Personal website <span style={{ fontWeight: 300, textTransform: 'none', letterSpacing: 0 }}>— optional</span>
        </label>
        <input
          type="url"
          value={websiteUrl}
          onChange={e => setWebsiteUrl(e.target.value)}
          placeholder="https://yourwebsite.com"
          className="sona-input"
          style={inputStyle}
        />
      </div>

      <div style={{ display: 'flex' }}>
        <button
          type="submit"
          disabled={pending}
          className="sona-btn-dark"
          style={{
            fontFamily: GEIST,
            fontSize: '0.9375rem',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            padding: '12px 36px',
            borderRadius: '980px',
            background: '#1a1a1a',
            color: '#fff',
            border: 'none',
            cursor: pending ? 'default' : 'pointer',
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? 'Starting…' : 'Continue'}
        </button>
      </div>

    </form>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(sona)/(wizard)/dashboard/create/VerifyStep.tsx src/app/(sona)/(wizard)/dashboard/create/actions.ts
git commit -m "feat: add VerifyStep wizard UI and saveVerifyStep server action"
```

---

### Task 10: `page.tsx` — step renumbering, Verify step, and status banner

**Files:**
- Modify: `src/app/(sona)/(wizard)/dashboard/create/page.tsx`

Current STEPS array: `['Identity', 'Interview', 'Content', 'Pricing']`
Target STEPS array: `['Identity', 'Verify', 'Interview', 'Content', 'Pricing']`

Step mapping after this change:
| Step | Old content | New content |
|---|---|---|
| 1 | Identity | Identity (unchanged) |
| 2 | Interview | **Verify** (new) |
| 3 | Content | Interview (was 2) |
| 4 | Pricing | Content (was 3) — "Skip for now" → `step=5` |
| 5 | — | Pricing (was 4) |

The existing `createSonaIdentity` action already redirects to `?step=2` — no change needed there (it now correctly lands on Verify).

The page also needs to fetch `web_research_status` when on steps 3–5 and render a banner.

- [ ] **Step 1: Apply all changes to `page.tsx`**

Make the following modifications:

**1a. Add `VerifyStep` import** near the top (after existing imports):
```ts
import { VerifyStep } from './VerifyStep'
```

**1b. Update `STEPS` array**:
```ts
const STEPS = ['Identity', 'Verify', 'Interview', 'Content', 'Pricing']
```

**1c. After the `verifiedPortraitId` block, add the web research status fetch**:
```ts
let webResearchStatus: string | null = null
if (verifiedPortraitId && currentStep >= 3) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: portraitData } = await (supabase as any)
    .from('portraits')
    .select('web_research_status')
    .eq('id', verifiedPortraitId)
    .maybeSingle()
  webResearchStatus = portraitData?.web_research_status ?? null
}
```

**1d. In the JSX, inside the outermost `<div>`, before the step indicator block, add the banner**:
```tsx
{/* ── Web research status banner (steps 3–5) ──────────────── */}
{webResearchStatus === 'running' && (
  <div style={{
    fontFamily: GEIST,
    fontSize: '0.8125rem',
    fontWeight: 300,
    color: '#6b6b6b',
    backgroundColor: 'rgba(0,0,0,0.03)',
    border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: 10,
    padding: '12px 18px',
    marginBottom: 32,
    lineHeight: 1.5,
  }}>
    We&apos;re researching you on the web — sources will appear in your content library as they&apos;re found.
  </div>
)}
{webResearchStatus === 'error' && (
  <div style={{
    fontFamily: GEIST,
    fontSize: '0.8125rem',
    fontWeight: 300,
    color: '#9b9b9b',
    backgroundColor: 'rgba(0,0,0,0.02)',
    border: '1px solid rgba(0,0,0,0.06)',
    borderRadius: 10,
    padding: '12px 18px',
    marginBottom: 32,
    lineHeight: 1.5,
  }}>
    Web research couldn&apos;t complete. You can add sources manually.
  </div>
)}
```

**1e. Replace the Step 2 block** (the Interview section currently at `{step === '2' && verifiedPortraitId && (`) with the Verify step:
```tsx
{/* ── Step 2: Verify ─────────────────────────────────────── */}
{step === '2' && verifiedPortraitId && (
  <>
    <h1 style={{
      fontFamily: CORMORANT,
      fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
      fontWeight: 400,
      fontStyle: 'italic',
      lineHeight: 1.1,
      letterSpacing: '-0.02em',
      color: '#1a1a1a',
      margin: '0 0 8px',
    }}>
      Help us find you
    </h1>
    <p style={{
      fontFamily: GEIST,
      fontSize: '0.875rem',
      fontWeight: 300,
      color: '#6b6b6b',
      margin: '0 0 40px',
      lineHeight: 1.6,
    }}>
      We&apos;ll research publicly available content about you to build your initial context. All fields are optional.
    </p>
    <VerifyStep portraitId={verifiedPortraitId} />
  </>
)}
```

**1f. Move Interview block to step 3** (change `step === '2'` → `step === '3'`).

**1g. Move Content block to step 4** (change `step === '3'` → `step === '4'`). Update the "Skip for now" link href from `step=4` to `step=5`:
```tsx
href={`/dashboard/create?step=5&portrait_id=${encodeURIComponent(verifiedPortraitId)}`}
```

**1h. Move Pricing block to step 5** (change `step === '4'` → `step === '5'`).

- [ ] **Step 2: Verify TypeScript compiles and there are no lint errors**

```bash
npx tsc --noEmit && npx eslint "src/app/(sona)/\(wizard\)/dashboard/create/page.tsx"
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(sona)/(wizard)/dashboard/create/page.tsx"
git commit -m "feat: add Step 2 Verify to wizard, renumber steps 2-5, add web research status banner"
```

---

## Chunk 4: Content library — delete and "Web" badge

### Task 11: `deleteContentSource` server action

**Files:**
- Create: `src/app/(sona)/dashboard/content/actions.ts`

- [ ] **Step 1: Create `actions.ts`**

```ts
// src/app/(sona)/dashboard/content/actions.ts
'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/**
 * Delete a content source. Verifies the source belongs to the calling user's portrait.
 * CASCADE removes all knowledge_chunks and sona_evidence rows for the source.
 * Resets portraits.synthesis_status to 'pending'.
 */
export async function deleteContentSource(sourceId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()

  // Verify ownership: source → portrait → creator
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: source } = await (admin as any)
    .from('content_sources')
    .select('id, portrait_id, portraits!inner(creator_id)')
    .eq('id', sourceId)
    .single()

  if (!source) throw new Error('Source not found')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const creatorId = (source as any).portraits?.creator_id
  if (creatorId !== user.id) throw new Error('Forbidden')

  const portraitId = source.portrait_id

  // Delete source — CASCADE removes knowledge_chunks and sona_evidence
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('content_sources')
    .delete()
    .eq('id', sourceId)

  // Reset synthesis_status so re-synthesis fires on next new source
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('portraits')
    .update({ synthesis_status: 'pending' })
    .eq('id', portraitId)

  revalidatePath('/dashboard/content')
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(sona)/dashboard/content/actions.ts
git commit -m "feat: add deleteContentSource server action with ownership verification"
```

---

### Task 12: `ContentLibrary.tsx` — delete button and "Web" badge

**Files:**
- Modify: `src/components/sona/ContentLibrary.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add imports, state, and TYPE_LABELS update**

In `ContentLibrary.tsx`:

Add import:
```ts
import { deleteContentSource } from '@/app/(sona)/dashboard/content/actions'
```

Add state:
```ts
const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
```

Update `TYPE_LABELS` to include `interview_audio` and `web_research`:
```ts
const TYPE_LABELS: Record<string, string> = {
  transcript:      'Transcript',
  interview:       'Interview',
  interview_audio: 'Interview',
  article:         'Article',
  book:            'Book',
  essay:           'Essay',
  speech:          'Speech',
  letter:          'Letter',
  other:           'Other',
  web_research:    'Web',
}
```

- [ ] **Step 2: Update source row JSX**

Replace the existing source row `<div key={source.id} ...>` block with:

```tsx
<div
  key={source.id}
  className="sona-row-hover"
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.06)',
    backgroundColor: '#fff',
  }}
>
  {/* Title + type */}
  <div style={{ flex: 1, minWidth: 0 }}>
    <p style={{
      fontFamily: GEIST,
      fontSize: '0.875rem',
      fontWeight: 400,
      color: '#1a1a1a',
      margin: '0 0 2px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}>
      {source.title}
    </p>
    <p style={{ fontFamily: GEIST, fontSize: '0.75rem', fontWeight: 300, color: '#b0b0b0', margin: 0 }}>
      {TYPE_LABELS[source.source_type] ?? source.source_type} · {formatDate(source.created_at)}
    </p>
  </div>

  {/* Badge: "Web" pill for web_research sources; tier badge otherwise */}
  {source.source_type === 'web_research' ? (
    <span style={{
      fontFamily: GEIST,
      fontSize: '0.6875rem',
      fontWeight: 500,
      letterSpacing: '0.04em',
      padding: '3px 10px',
      borderRadius: '980px',
      backgroundColor: 'rgba(0,0,0,0.05)',
      color: '#9b9b9b',
      flexShrink: 0,
    }}>
      Web
    </span>
  ) : (
    <span style={{
      fontFamily: GEIST,
      fontSize: '0.6875rem',
      fontWeight: 500,
      letterSpacing: '0.04em',
      padding: '3px 10px',
      borderRadius: '980px',
      backgroundColor: TIER_COLORS[source.min_tier] ?? 'rgba(0,0,0,0.06)',
      color: TIER_TEXT_COLORS[source.min_tier] ?? '#9b9b9b',
      flexShrink: 0,
    }}>
      {TIER_LABELS[source.min_tier as keyof typeof TIER_LABELS] ?? source.min_tier}
    </span>
  )}

  {/* Delete icon — hidden by default (opacity:0), shown on row hover via .sona-row-delete CSS rule */}
  {confirmingDelete !== source.id && (
    <button
      onClick={() => setConfirmingDelete(source.id)}
      className="sona-row-delete"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: '#c0c0c0',
        fontSize: '1.125rem',
        lineHeight: 1,
        padding: '0 0 0 4px',
        flexShrink: 0,
        opacity: 0,
        transition: 'opacity 0.15s',
      }}
      aria-label="Delete source"
    >
      ×
    </button>
  )}

  {/* Inline delete confirmation */}
  {confirmingDelete === source.id && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <span style={{ fontFamily: GEIST, fontSize: '0.75rem', fontWeight: 300, color: '#6b6b6b', whiteSpace: 'nowrap' }}>
        Remove this source? This cannot be undone.
      </span>
      <button
        onClick={async () => {
          await deleteContentSource(source.id)
          setConfirmingDelete(null)
        }}
        style={{
          fontFamily: GEIST,
          fontSize: '0.75rem',
          fontWeight: 500,
          color: '#DE3E7B',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          whiteSpace: 'nowrap',
        }}
      >
        Remove
      </button>
      <button
        onClick={() => setConfirmingDelete(null)}
        style={{
          fontFamily: GEIST,
          fontSize: '0.75rem',
          fontWeight: 300,
          color: '#b0b0b0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        Cancel
      </button>
    </div>
  )}
</div>
```

- [ ] **Step 3: Add `.sona-row-delete` hover CSS to `globals.css`**

Find `globals.css` and add this rule alongside the other `.sona-row-hover` rules:

```css
.sona-row-hover:hover .sona-row-delete {
  opacity: 1 !important;
}
```

Also, ensure the delete button has `opacity: 0` in its base inline style (already included in the JSX above — the opacity transition is handled by the CSS above toggling it).

- [ ] **Step 4: Verify TypeScript and lint pass**

```bash
npx tsc --noEmit && npx eslint src/components/sona/ContentLibrary.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/sona/ContentLibrary.tsx src/app/globals.css
git commit -m "feat: add delete button and Web badge to ContentLibrary"
```

---

## Chunk 5: Finalisation

### Task 13: Environment variables and final checks

**Files:**
- Modify: `.env.local.example`

- [ ] **Step 1: Update `.env.local.example`**

Add to `.env.local.example`:
```
TAVILY_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> `NEXT_PUBLIC_APP_URL` may already exist — check first and update the value if needed. `TAVILY_API_KEY` is new.

Get the Tavily API key from `https://app.tavily.com` and add it to your `.env.local` as well as Vercel environment variables (Settings → Environment Variables → Production + Preview + Development).

- [ ] **Step 2: Run full type check**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass (at minimum the 3 new research lib test files).

- [ ] **Step 4: Run lint**

```bash
npx eslint src/
```

Expected: no errors (warnings acceptable).

- [ ] **Step 5: Commit**

```bash
git add .env.local.example
git commit -m "chore: add TAVILY_API_KEY and NEXT_PUBLIC_APP_URL to env example"
```

---

## Implementation notes

1. **`content_sources` type casting:** Use `(admin as any).from('content_sources')` throughout — this table's generated types haven't been regenerated. Matches the existing pattern in `/api/creator/ingest/route.ts`.

2. **`portraits` new columns:** Similarly cast `(admin as any).from('portraits')` when reading/writing `web_research_status`, `linkedin_url`, `search_context`, `website_url`.

3. **Single `after()` per route call:** The `/api/research/start` route uses exactly one `after()` call at the top level. Evidence extraction for all sources runs sequentially inside that single callback. Do not nest `after()` calls — Next.js does not support nested `after()`.

4. **All web-researched sources use `source_type = 'web_research'`:** The search strategy types (`interview`, `speech`, etc.) are only used for query construction — they do not affect how results are stored. All web-researched sources are stored with `source_type = 'web_research'` and get the "Web" badge uniformly.

5. **LinkedIn scraping limitations:** LinkedIn blocks most scrapers; `fetchUrl(linkedinUrl)` will likely return `null` in production. This is accepted — the URL domain is still passed to the Haiku filter as a disambiguation signal through the general search results.

6. **Haiku model ID:** Uses `claude-haiku-4-5-20251001` — the current model ID per project conventions.

7. **`createSonaIdentity` concurrency guard redirect:** The concurrency guard at line 20 of `actions.ts` redirects existing portraits to `?step=2`. After renumbering, this lands on the new Verify step rather than Interview. This is correct for first-time setup but may feel slightly odd for creators who re-enter the wizard. Accepted MVP limitation — not addressed in this implementation.
