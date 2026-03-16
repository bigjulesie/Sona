# Web Research & Identity Verification Design

## Goal

When a creator sets up their Sona, automatically research them on the web to build a richer initial context — reducing reliance on manual uploads for the first synthesis. Identity is anchored via a LinkedIn URL; targeted searches plus an LLM filter ensure only high-confidence, relevant content reaches the synthesis pipeline.

## Context

The existing ingest pipeline (chunking → embedding → evidence extraction → synthesis) is fully functional but relies on creators manually uploading documents or pasting text. Most creators won't upload enough material to produce a high-quality first synthesis. Automated web research solves this cold-start problem by pulling publicly available content about the creator before they've added anything manually.

---

## Architecture

### New wizard step — Step 2 "Verify"

Inserted between the existing Identity (Step 1) and Interview (Step 3) steps. All subsequent steps shift up by one. The wizard `STEPS` array becomes:

```
['Identity', 'Verify', 'Interview', 'Content', 'Pricing']
```

**Fields:**

| Field | Required | Validation | Storage |
|---|---|---|---|
| LinkedIn URL | Yes | Must match `linkedin.com/in/` pattern | `portraits.linkedin_url` |
| Search context hint | No | Free text, max 200 chars | `portraits.search_context` |
| Personal website URL | No | Valid URL format | `portraits.website_url` |

On "Continue", a server action saves the three fields to `portraits` then fires the web research job asynchronously via `after()`. The creator immediately advances to Step 3 — they do not wait for research to complete.

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

### New lib files

```
src/lib/research/
  fetch-url.ts       — fetch HTML + extract article text via @mozilla/readability
  filter.ts          — Claude Haiku identity match + relevance scoring
  search.ts          — Tavily API calls, parallel strategy runner
  web-research.ts    — orchestrator: search → fetch → filter → ingest
```

### New server action

`src/app/(sona)/(wizard)/dashboard/create/actions.ts` (or alongside other wizard actions):
- `saveVerifyStep(portraitId, linkedinUrl, searchContext, websiteUrl)` — saves fields, triggers research job

### Content source deletion

`src/app/(sona)/dashboard/content/actions.ts`:
- `deleteContentSource(sourceId)` — deletes the row; CASCADE on `knowledge_chunks` and `sona_evidence` handles cleanup; resets `portraits.synthesis_status = 'pending'`

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

`[name]` = `portraits.display_name`. `[context]` = `portraits.search_context` (omitted if empty). Up to ~44 candidate URLs before deduplication.

**Search API:** Tavily (`/search` endpoint, `search_depth: "advanced"`, `include_raw_content: true`). Tavily returns article text alongside URLs for most results — a separate fetch is only needed for URLs where content is absent.

### LLM identity + relevance filter (Claude Haiku)

Each candidate is scored before entering the ingest pipeline. Input to Haiku: creator name, search context hint, article title, and first 500 characters of content. Returns JSON:

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

Then handed directly to `extractEvidenceForSource()` — the existing function called after every manual upload. Chunking, embedding, evidence extraction, and the auto-synthesis trigger (fires when ≥3 extractions complete since last synthesis) all run identically.

Job metadata records: queries run, total URLs found, URLs passing filter, URLs successfully ingested.

---

## Content Library — Source Management

### Delete action

Every row in the content library gets a delete control (small `×` icon, visible on row hover via `sona-row-hover`). Clicking shows an inline confirmation:

> *"Remove this source? This cannot be undone."* — **Remove** / Cancel

Confirming calls `deleteContentSource(sourceId)`:
1. Deletes the `content_sources` row
2. CASCADE removes all `knowledge_chunks` and `sona_evidence` rows for that source
3. Sets `portraits.synthesis_status = 'pending'`

Re-synthesis fires automatically on the next new source addition (existing ≥3 extractions trigger). No immediate re-synthesis on delete — the creator may remove several sources in sequence.

### Web-researched source display

Web-researched sources appear in the existing content list. They are visually distinguished by a `"Web"` pill badge in place of the upload-type label. Behaviour is otherwise identical — same hover, same delete action.

---

## UI Feedback

### Wizard status banner (Steps 3–5)

While `portraits.web_research_status = 'running'`, a quiet text banner appears below the step indicator:

> *"We're researching you on the web — sources will appear in your content library as they're found."*

Disappears when status becomes `complete` or `error`. No spinner, no blocking.

### Error state (content library)

If `web_research_status = 'error'`:

> *"Web research couldn't complete. You can add sources manually."*

Shown once at the top of the content library. No retry UI for MVP.

---

## Scope

**In scope:**
- Step 2 "Verify" wizard UI and server action
- Web research orchestrator and all lib files
- LLM filter (Haiku)
- Tavily integration
- Direct URL fetch via Readability
- Content source delete action + UI
- Web badge on researched sources
- Status banner in wizard

**Out of scope:**
- Manual URL input in ContentAddForm (separate feature, can be added later using `fetch-url.ts`)
- Retry button for failed research
- Manual re-synthesis trigger
- Creator-facing filter settings (thresholds fixed for MVP)
- Re-research after profile update

---

## Error Handling

- Tavily API failure: mark `web_research_status = 'error'`, log in job metadata, do not throw
- Individual URL fetch failure: skip that URL, continue with remaining candidates
- Haiku filter failure: treat as failed filter (discard URL), log, continue
- All errors caught within `after()` — never affects the HTTP response or wizard flow
