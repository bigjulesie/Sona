# Web Research & Identity Verification Design

## Goal

When a creator sets up their Sona, automatically research them on the web to build a richer initial context — reducing reliance on manual uploads for the first synthesis. Identity is anchored via a LinkedIn URL; targeted searches plus an LLM filter ensure only high-confidence, relevant content reaches the synthesis pipeline.

## Context

The existing ingest pipeline (chunking → embedding → evidence extraction → synthesis) is fully functional but relies on creators manually uploading documents or pasting text. Most creators won't upload enough material to produce a high-quality first synthesis. Automated web research solves this cold-start problem by pulling publicly available content about the creator before they've added anything manually.

---

## Architecture

### New wizard step — Step 2 "Verify"

Inserted between the existing Identity (Step 1) and Interview steps. The wizard `STEPS` array becomes:

```
['Identity', 'Verify', 'Interview', 'Content', 'Pricing']
```

**Step number changes required in `page.tsx` and `actions.ts`:**

| Location | Old value | New value |
|---|---|---|
| `STEPS` array | `['Identity', 'Interview', 'Content', 'Pricing']` | `['Identity', 'Verify', 'Interview', 'Content', 'Pricing']` |
| Identity step redirect (after portrait create) | `?step=2` | `?step=2` (unchanged — now lands on Verify ✓) |
| Content step "Skip for now" link | `step=4` | `step=5` |
| Content step "Add context" link | exits wizard to `/dashboard/content` — no step param, no change required | — |
| Pricing step render condition | `step === '4'` | `step === '5'` |
| Interview step render condition | `step === '2'` | `step === '3'` |
| Content step render condition | `step === '3'` | `step === '4'` |

**Fields:**

| Field | Required | Validation | Storage |
|---|---|---|---|
| LinkedIn URL | No | If provided, must match `linkedin.com/in/` pattern | `portraits.linkedin_url` |
| Search context hint | No | Free text, max 200 chars | `portraits.search_context` |
| Personal website URL | No | If provided, must be a valid URL | `portraits.website_url` |

LinkedIn URL is **optional** — it is stored and, if provided, fetched directly as a high-confidence source. It is not scraped for profile data; it is one URL among others that enters the filter pipeline. Its URL domain (`linkedin.com`) is also passed to the Haiku filter as an additional identity signal.

On "Continue" (whether or not any fields are filled), the server action saves the fields to `portraits`, sets `web_research_status = 'running'`, then fires the research job. The creator immediately advances to Step 3 — they do not wait for research to complete. If all fields are empty, the research job still runs using `display_name` alone as the search term; a Sona is always researched.

### Execution model

The web research job is **not** run inside `after()`. The full job — 9 parallel searches, up to ~44 URL fetches, Haiku filtering, chunking, embedding, and evidence extraction — can take several minutes and will exceed Next.js function timeouts on Vercel.

Instead, `saveVerifyStep` calls a dedicated internal API route **`POST /api/research/start`** as a fire-and-forget fetch (no `await`). That route returns `202` immediately and runs the pipeline using `after()` for each individual URL's evidence extraction — matching the existing per-source ingest pattern. This keeps each `after()` call to a single document, within timeout bounds.

```
saveVerifyStep (server action)
  → saves portrait fields, sets web_research_status = 'running'
  → fire-and-forget fetch to POST /api/research/start { portrait_id }
  → redirects creator to Step 3

POST /api/research/start
  → runs search → filter → per-URL ingest (each extraction via after())
  → sets web_research_status = 'complete' | 'error' when done
```

### Database changes (one migration)

```sql
-- New columns on portraits
ALTER TABLE portraits
  ADD COLUMN linkedin_url          text,
  ADD COLUMN search_context        text,
  ADD COLUMN website_url           text,
  ADD COLUMN web_research_status   text NOT NULL DEFAULT 'never'
    CHECK (web_research_status IN ('never', 'running', 'complete', 'error'));

-- New source_type value
ALTER TABLE content_sources
  DROP CONSTRAINT IF EXISTS content_sources_source_type_check;
ALTER TABLE content_sources
  ADD CONSTRAINT content_sources_source_type_check
  CHECK (source_type IN (
    'transcript', 'interview', 'interview_audio', 'article', 'book',
    'essay', 'speech', 'letter', 'other', 'web_research'
  ));

-- New job type
ALTER TABLE sona_synthesis_jobs
  DROP CONSTRAINT IF EXISTS sona_synthesis_jobs_job_type_check;
ALTER TABLE sona_synthesis_jobs
  ADD CONSTRAINT sona_synthesis_jobs_job_type_check
  CHECK (job_type IN (
    'evidence_extraction', 'dimension_synthesis', 'module_generation', 'web_research'
  ));
```

### TypeScript type changes

`src/lib/synthesis/types.ts` — `SynthesisJobType` union must include `'web_research'`:

```ts
export type SynthesisJobType =
  | 'evidence_extraction'
  | 'dimension_synthesis'
  | 'module_generation'
  | 'web_research'
```

`src/lib/synthesis/jobs.ts` — `SOURCE_TYPE_WEIGHTS` must include `'web_research'` with weight `1.0` (web-researched sources are treated as equivalent to articles; the per-URL source_type carries the actual weight):

```ts
web_research: 1.0,
```

### New lib files

```
src/lib/research/
  fetch-url.ts       — fetch HTML + extract article text via @mozilla/readability
  filter.ts          — Claude Haiku identity match + relevance scoring
  search.ts          — Tavily API calls, parallel strategy runner
  web-research.ts    — orchestrator: search → fetch → filter → ingest
```

### New API route

`src/app/api/research/start/route.ts` — internal route, auth-checked via admin client. Accepts `{ portrait_id }`, runs full research pipeline, updates `web_research_status` on completion.

### New server action

`src/app/(sona)/(wizard)/dashboard/create/VerifyStep.tsx` client component + server action in adjacent `actions.ts`:
- `saveVerifyStep(portraitId, linkedinUrl, searchContext, websiteUrl)` — saves fields, sets `web_research_status = 'running'`, fires `/api/research/start`

### Content source deletion

`src/app/(sona)/dashboard/content/actions.ts`:
- `deleteContentSource(sourceId)` — verifies the source belongs to a portrait owned by the calling user (via `portraits.creator_id`), deletes the `content_sources` row, CASCADE removes all `knowledge_chunks` and `sona_evidence` rows, resets `portraits.synthesis_status = 'pending'`. Scoped to Sona creators only.

### Environment variable

`TAVILY_API_KEY` — must be added to `.env.local` and Vercel environment config.

---

## Web Research Job

### Search strategies (run in parallel via `Promise.all`)

| Query pattern | Mapped `source_type` | Max results |
|---|---|---|
| `"[name]" [context]` (general) | `other` | 5 |
| `"[name]" [context] interview` | `interview` | 5 |
| `"[name]" [context] article OR essay` | `article` | 5 |
| `"[name]" [context] talk OR keynote OR speech` | `speech` | 5 |
| `"[name]" [context] podcast` | `interview` | 5 |
| `"[name]" [context] book` | `book` | 5 |
| `"[name]" wikipedia` | `article` | 3 |
| `"[name]" [context] scholar OR research OR paper` | `article` | 5 |
| Personal website URL (direct fetch, no search) | `article` | 1 |
| LinkedIn URL (direct fetch if provided) | `article` | 1 |

`[name]` = `portraits.display_name`. `[context]` = `portraits.search_context` (omitted if empty). Up to ~44 candidate URLs before deduplication.

**Search API:** Tavily (`/search` endpoint, `search_depth: "advanced"`, `include_raw_content: true`). Tavily returns article text alongside URLs for most results — a separate fetch is only needed for URLs where `raw_content` is absent or empty.

### LLM identity + relevance filter (Claude Haiku)

Each candidate is scored before entering the ingest pipeline. Input to Haiku: creator name, search context hint, article title, URL domain, and first 500 characters of content. The URL domain (e.g. `nytimes.com`, `linkedin.com`) is included as an additional disambiguation signal for common names. Returns JSON:

```json
{
  "identity_match": 0.0–1.0,
  "relevance": 0.0–1.0,
  "reason": "brief explanation"
}
```

**Thresholds:**
- `identity_match >= 0.7` — high confidence this is about the right person
- `relevance >= 0.5` — contains material useful for character synthesis (opinions, beliefs, expertise, stories)

Both must pass. Failures are logged in the job `metadata` but not surfaced to the creator.

### Ingestion

Each URL that passes the filter is inserted as a `content_sources` row:
- `source_type` = strategy-mapped type (interview, article, speech etc.)
- `title` = article title from Tavily or extracted from HTML
- `min_tier` = `'public'` (default — creator can change later)
- `status` = `'processing'`

Evidence extraction is triggered per-source via `after()` inside `/api/research/start`, matching the existing per-upload pattern in `/api/creator/ingest`. The auto-synthesis trigger (fires when ≥3 extractions complete since last synthesis) runs identically.

Job metadata records: queries run, total URLs found, URLs passing filter, URLs successfully ingested.

---

## Content Library — Source Management

### Delete action

Every row in the content library gets a delete control (small `×` icon, visible on row hover via `sona-row-hover`). Clicking shows an inline confirmation:

> *"Remove this source? This cannot be undone."* — **Remove** / Cancel

Confirming calls `deleteContentSource(sourceId)`:
1. Verifies ownership (source's portrait must be owned by calling user)
2. Deletes the `content_sources` row
3. CASCADE removes all `knowledge_chunks` and `sona_evidence` rows for that source
4. Sets `portraits.synthesis_status = 'pending'`

**Post-delete re-synthesis:** After deletion, `synthesis_status = 'pending'` but no re-synthesis fires automatically — the existing auto-trigger requires new extraction jobs to accumulate. Re-synthesis after deletion will fire when the creator next adds a new source. This is an accepted MVP limitation; a manual re-synthesis trigger is out of scope.

### Web-researched source display

Web-researched sources appear in the existing content list. They are visually distinguished by a `"Web"` pill badge in place of the upload-type label. Behaviour is otherwise identical — same hover, same delete action.

---

## UI Feedback

### Wizard status banner (Steps 3–5)

The wizard `page.tsx` is a server component. The banner reflects `web_research_status` on initial render. Since the page is server-rendered, the banner will be visible when the creator first lands on Step 3 (if research is still running) and will clear on the next navigation or page reload. No client-side polling is implemented for MVP — the creator does not need to watch the banner; sources appear in the content library when they visit it. This is an accepted MVP limitation.

Copy while running:
> *"We're researching you on the web — sources will appear in your content library as they're found."*

Copy on error:
> *"Web research couldn't complete. You can add sources manually."*

### Status set timing

`web_research_status` is set to `'running'` by the `saveVerifyStep` server action **before** the redirect, so the banner is visible as soon as the creator reaches Step 3.

---

## Scope

**In scope:**
- Step 2 "Verify" wizard UI and server action
- `POST /api/research/start` internal API route
- Web research orchestrator and all lib files
- LLM filter (Haiku) with URL domain as disambiguation signal
- Tavily integration
- Direct URL fetch via `@mozilla/readability`
- Content source delete action + UI (Sona only)
- "Web" badge on researched sources
- Status banner in wizard (server-rendered, no polling)
- TypeScript type updates (`SynthesisJobType`, `SOURCE_TYPE_WEIGHTS`)

**Out of scope:**
- Manual URL input in ContentAddForm (separate feature, reuses `fetch-url.ts`)
- Client-side polling for research status banner
- Retry button for failed research
- Manual re-synthesis trigger after deletion
- Creator-facing filter threshold settings
- Re-research after profile update

---

## Error Handling

- Tavily API failure: mark `web_research_status = 'error'`, log in job metadata, do not throw
- Individual URL fetch failure: skip that URL, continue with remaining candidates
- Haiku filter failure: treat as failed filter (discard URL), log, continue
- All per-URL errors are caught and logged; one failing URL never stops the rest
- If `/api/research/start` itself throws before completing all URLs, `web_research_status` is set to `'error'` in the catch block
