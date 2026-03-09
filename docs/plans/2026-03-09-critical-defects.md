# Critical Defects Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all critical and important architectural defects before the next feature development phase.

**Architecture:** Six independent fixes addressed in priority order — each is a self-contained migration or code change. C2 (tier access) is the highest-leverage change and must land first as it affects revenue correctness. C1 (middleware auth) is a security fix. C3 (rate limit index), C4 (async ingestion), and C6 (stream abort) address reliability and cost. The two "Important" items (hnsw index, RAG threshold) address query quality at scale.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + pgvector + RLS), Anthropic SDK streaming, TypeScript

---

## Task 1: C2 — Fix per-portrait subscription tier access (CRITICAL — revenue + security)

**The problem:** `knowledge_chunks` RLS reads `profiles.access_tier` — a global column that is never elevated on subscribe. A paying subscriber cannot access paid-tier chunks. The `subscriptions.tier` column exists and is set correctly by the Stripe webhook, but the RLS policy completely ignores it.

**Files:**
- Create: `supabase/migrations/00013_fix_tier_rls.sql`
- Modify: nothing in app code — this is purely a DB fix

---

**Step 1: Understand the broken policy**

Read `supabase/migrations/00002_rls_policies.sql` lines 41–47. The current policy is:
```sql
CREATE POLICY "Knowledge chunks filtered by user access tier"
  ON knowledge_chunks FOR SELECT
  TO authenticated
  USING (
    tier_level((SELECT access_tier FROM profiles WHERE id = auth.uid()))
    >= tier_level(min_tier)
  );
```
This reads `profiles.access_tier` — a global column that defaults to `'public'` and is never updated on subscription. It ignores `subscriptions.tier` entirely.

---

**Step 2: Write the migration**

Create `supabase/migrations/00013_fix_tier_rls.sql`:

```sql
-- Fix knowledge_chunks RLS to use per-portrait subscription tier
-- instead of the global profiles.access_tier column.
--
-- A user's effective tier for a given portrait is:
--   1. Their active subscription tier for that portrait (if one exists)
--   2. Their profile access_tier as fallback (defaults to 'public')

CREATE OR REPLACE FUNCTION user_tier_for_portrait(portrait_uuid UUID)
RETURNS access_tier
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  sub_tier access_tier;
  profile_tier access_tier;
BEGIN
  -- Check for an active subscription to this specific portrait
  SELECT tier INTO sub_tier
  FROM subscriptions
  WHERE subscriber_id = auth.uid()
    AND portrait_id = portrait_uuid
    AND status IN ('active', 'trialing');

  IF FOUND THEN
    RETURN sub_tier;
  END IF;

  -- Fall back to global profile tier
  SELECT access_tier INTO profile_tier
  FROM profiles
  WHERE id = auth.uid();

  RETURN COALESCE(profile_tier, 'public');
END;
$$;

-- Drop the broken policy
DROP POLICY IF EXISTS "Knowledge chunks filtered by user access tier" ON knowledge_chunks;

-- New policy: per-portrait subscription-aware tier check
CREATE POLICY "Knowledge chunks filtered by subscription tier"
  ON knowledge_chunks FOR SELECT
  TO authenticated
  USING (
    tier_level(user_tier_for_portrait(portrait_id))
    >= tier_level(min_tier)
  );
```

---

**Step 3: Apply the migration locally**

```bash
npx supabase db push
```
Expected: Migration applies without error.

---

**Step 4: Verify with a manual SQL check**

In the Supabase dashboard SQL editor, run:
```sql
-- Should return 'public' for a user with no subscription
SELECT user_tier_for_portrait('<any-portrait-uuid>');

-- After manually inserting a test subscription (status='active', tier='acquaintance')
-- for a test user, re-run — should return 'acquaintance'
```

---

**Step 5: Commit**

```bash
git add supabase/migrations/00013_fix_tier_rls.sql
git commit -m "fix: per-portrait subscription tier in knowledge_chunks RLS

Previously, chunk access was gated on profiles.access_tier (a global
column, always 'public'). Now reads subscriptions.tier for the specific
portrait first, falling back to profiles.access_tier. Paying subscribers
can now access their paid-tier chunks."
```

---

## Task 2: C1 — Fix middleware auth to use getUser() (CRITICAL — security)

**The problem:** `src/proxy.ts:57` calls `supabase.auth.getSession()` which reads the JWT from the cookie without server-side validation. A crafted or replayed cookie bypasses the auth redirect. `getUser()` validates the JWT against the Supabase auth server.

**Files:**
- Modify: `src/proxy.ts` (line 57–62)

---

**Step 1: Read the current implementation**

Read `src/proxy.ts`. The broken section is lines 57–62:
```typescript
const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  return NextResponse.redirect(url)
}
```

---

**Step 2: Apply the fix**

In `src/proxy.ts`, replace lines 57–62:

```typescript
// OLD
const { data: { session } } = await supabase.auth.getSession()
if (!session) {

// NEW
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
```

That is the complete change — one line replaced, one variable renamed in the condition.

---

**Step 3: Test locally**

```bash
npm run dev
```

1. Log out, navigate to `/dashboard` — should redirect to `/login`. ✓
2. Log in, navigate to `/dashboard` — should render. ✓
3. Manually tamper with the auth cookie value in DevTools → Application → Cookies → delete or corrupt `sb-*-auth-token` — should redirect to `/login`. ✓

---

**Step 4: Commit**

```bash
git add src/proxy.ts
git commit -m "fix: use getUser() in middleware for server-side JWT validation

getSession() reads the cookie without validating against the auth server,
allowing crafted or replayed cookies to bypass the auth redirect guard.
getUser() validates the JWT server-side on every request."
```

---

## Task 3: C3 — Add composite index for rate limit queries (CRITICAL — scalability)

**The problem:** `src/lib/rate-limit.ts` runs `COUNT(*)` on `audit_log` filtered by `(user_id, action, created_at)`. The current indexes are single-column (`idx_audit_log_user` and `idx_audit_log_action`). At scale this becomes a full table scan. The `audit_log` table grows ~50K rows/day per 1K DAU.

**Files:**
- Create: `supabase/migrations/00014_audit_log_rate_limit_index.sql`

---

**Step 1: Write the migration**

Create `supabase/migrations/00014_audit_log_rate_limit_index.sql`:

```sql
-- Composite index to support the rate-limit COUNT(*) query pattern:
--   WHERE user_id = $1 AND action = $2 AND created_at >= $3
-- Without this, the query does a full table scan as audit_log grows.
CREATE INDEX IF NOT EXISTS idx_audit_log_rate_limit
  ON audit_log (user_id, action, created_at DESC);
```

---

**Step 2: Apply the migration**

```bash
npx supabase db push
```
Expected: Index created without error.

---

**Step 3: Verify query plan**

In Supabase SQL editor:
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*)
FROM audit_log
WHERE user_id = '<any-uuid>'
  AND action = 'chat'
  AND created_at >= now() - interval '1 hour';
```
Expected: Output should show `Index Scan using idx_audit_log_rate_limit` — not `Seq Scan`.

---

**Step 4: Commit**

```bash
git add supabase/migrations/00014_audit_log_rate_limit_index.sql
git commit -m "perf: composite index on audit_log for rate limit queries

The rate-limit checker runs COUNT(*) on (user_id, action, created_at)
on every API request. Without a composite index this becomes a full table
scan as audit_log grows. Index covers the exact query pattern."
```

---

## Task 4: C6 — Abort Anthropic stream on client disconnect (CRITICAL — cost)

**The problem:** When a subscriber closes the tab or navigates away during a chat response, the Anthropic stream in `src/app/api/chat/route.ts` continues consuming tokens server-side. `request.signal` is available in Next.js route handlers and should be forwarded to the Anthropic SDK.

**Files:**
- Modify: `src/app/api/chat/route.ts` (lines 111–151)

---

**Step 1: Read the current stream setup**

Read `src/app/api/chat/route.ts` lines 111–151. The current code:
```typescript
const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,
  system: systemPrompt,
  messages,
})

const readable = new ReadableStream({
  async start(controller) {
    let fullResponse = ''
    for await (const event of stream) {
      // ...
    }
    // save message, audit log
    controller.close()
  },
})
```
There is no abort signal. The `for await` loop runs to completion regardless of client state.

---

**Step 2: Apply the fix**

Replace lines 111–151 in `src/app/api/chat/route.ts`:

```typescript
// Pass request.signal to abort the Anthropic stream if client disconnects
const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,
  system: systemPrompt,
  messages,
}, { signal: request.signal })

const encoder = new TextEncoder()
const readable = new ReadableStream({
  async start(controller) {
    let fullResponse = ''

    try {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullResponse += event.delta.text
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
        }
      }
    } catch (err: unknown) {
      // Client disconnected — stream aborted, do not save partial response
      if (err instanceof Error && err.name === 'AbortError') {
        controller.close()
        return
      }
      throw err
    }

    // Save assistant message (only on clean completion)
    await supabase.from('messages').insert({
      conversation_id: convId,
      role: 'assistant',
      content: fullResponse,
    })

    // Audit log
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const adminSupabase = createAdminClient()
    await adminSupabase.from('audit_log').insert({
      user_id: user.id,
      action: 'chat',
      resource_type: 'conversation',
      resource_id: convId,
      metadata: { portrait_id, chunks_used: chunks.length },
    })

    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, conversation_id: convId })}\n\n`))
    controller.close()
  },
})
```

---

**Step 3: Test locally**

```bash
npm run dev
```

1. Start a chat message that produces a long response.
2. While the response is streaming, close the tab or navigate away.
3. Check Anthropic dashboard — token usage for the aborted request should be significantly less than a full response.

---

**Step 4: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "fix: abort Anthropic stream on client disconnect

Forwards request.signal to the Anthropic SDK so the LLM stream is
cancelled when the subscriber closes the tab or navigates away.
Partial responses are discarded cleanly without saving to DB."
```

---

## Task 5: C4 — Async ingestion pipeline (CRITICAL — reliability)

**The problem:** `src/app/api/creator/ingest/route.ts` runs text extraction + embedding generation + DB insert synchronously in a single HTTP request. A 300-page PDF will exceed Vercel's 60s function timeout, leaving `content_sources.status = 'processing'` forever with no recovery path.

**Solution:** Use Next.js 15+ `after()` to defer heavy processing after the HTTP response is sent. Return immediately with `source_id` and `status: 'processing'`. The actual chunking/embedding/insert runs in the background.

**Files:**
- Modify: `src/app/api/creator/ingest/route.ts`

---

**Step 1: Check Next.js version supports `after()`**

```bash
cat /Users/julian/Documents/sona/package.json | grep '"next"'
```
Expected: version `^16.x` — `after()` was introduced in Next.js 15 and is stable in 16. ✓

---

**Step 2: Understand the current flow**

Read `src/app/api/creator/ingest/route.ts`. The current flow is:
1. Auth + rate limit check
2. Parse + validate form data
3. Verify portrait ownership
4. Extract text from file/paste → **can be slow**
5. `chunkText()` → `generateEmbeddings()` → insert into `knowledge_chunks` → **will timeout on large files**
6. Update `content_sources.status = 'ready'`
7. Return response

---

**Step 3: Refactor to use `after()`**

Replace the contents of `src/app/api/creator/ingest/route.ts` with:

```typescript
// src/app/api/creator/ingest/route.ts
import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { chunkText } from '@/lib/ingest/chunker'
import { generateEmbeddings } from '@/lib/ingest/embeddings'
import { extractText, MAX_FILE_SIZE, ACCEPTED_EXTENSIONS } from '@/lib/ingest/extract'
import { checkRateLimit } from '@/lib/rate-limit'
import type { Database } from '@/lib/supabase/types'

type AccessTier = Database['public']['Enums']['access_tier']
const VALID_TIERS: AccessTier[] = ['public', 'acquaintance', 'colleague', 'family']
const VALID_TYPES = ['transcript', 'interview', 'article', 'book', 'essay', 'speech', 'letter', 'other']

export async function POST(request: NextRequest) {
  // Auth
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit
  const allowed = await checkRateLimit(user.id, 'ingest')
  if (!allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

  // Parse form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const portrait_id = formData.get('portrait_id') as string | null
  const title = (formData.get('title') as string | null)?.trim()
  const source_type = (formData.get('source_type') as string | null) ?? 'transcript'
  const min_tier = (formData.get('min_tier') as AccessTier | null) ?? 'public'
  const pastedContent = formData.get('content') as string | null
  const file = formData.get('file') as File | null

  // Validate required fields
  if (!portrait_id) return NextResponse.json({ error: 'portrait_id required' }, { status: 400 })
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  if (!VALID_TYPES.includes(source_type)) return NextResponse.json({ error: 'Invalid source_type' }, { status: 400 })
  if (!VALID_TIERS.includes(min_tier)) return NextResponse.json({ error: 'Invalid min_tier' }, { status: 400 })
  if (!pastedContent && !file) return NextResponse.json({ error: 'content or file required' }, { status: 400 })

  // File size/type validation (before reading bytes)
  if (file) {
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: 'Unsupported file type. Use PDF, DOCX, or TXT.' }, { status: 400 })
    }
  }

  // Verify creator owns portrait
  const { data: portrait } = await supabase
    .from('portraits')
    .select('id')
    .eq('id', portrait_id)
    .eq('creator_id', user.id)
    .single()
  if (!portrait) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // Create content_source record immediately (status: 'processing')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: source, error: sourceError } = await (admin as any)
    .from('content_sources')
    .insert({ portrait_id, title, source_type, min_tier, status: 'processing' })
    .select('id')
    .single()

  if (sourceError || !source) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Read file bytes now (before response is sent — buffer is unavailable after)
  const fileBuffer = file ? Buffer.from(await file.arrayBuffer()) : null
  const fileType = file?.type ?? ''
  const fileName = file?.name ?? ''

  // Defer heavy processing until after response is sent
  after(async () => {
    try {
      const text = fileBuffer
        ? await extractText(fileBuffer, fileType, fileName)
        : pastedContent!

      if (!text.trim()) throw new Error('No text content found')

      const chunks = chunkText(text)
      const embeddings = await generateEmbeddings(chunks)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = chunks.map((chunk, i) => ({
        portrait_id,
        source_id: source.id,
        content: chunk,
        embedding: JSON.stringify(embeddings[i]),
        source_title: title,
        source_type,
        min_tier,
        chunk_index: i,
      }))

      const { error: chunkError } = await admin.from('knowledge_chunks').insert(rows)
      if (chunkError) throw chunkError

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('content_sources')
        .update({ status: 'ready' })
        .eq('id', source.id)

      await admin.from('audit_log').insert({
        user_id: user.id,
        action: 'ingest',
        resource_type: 'content_source',
        resource_id: source.id,
        metadata: { portrait_id, title, chunks_created: chunks.length },
      })
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('content_sources')
        .update({ status: 'error', error_msg: err instanceof Error ? err.message : 'Processing failed' })
        .eq('id', source.id)
    }
  })

  // Return immediately — client polls content_sources.status for completion
  return NextResponse.json({ ok: true, source_id: source.id, status: 'processing' })
}
```

---

**Step 4: Test locally**

```bash
npm run dev
```

1. Upload a small text file via the content dashboard.
2. The API should return immediately with `{ ok: true, source_id: "...", status: "processing" }`.
3. After a few seconds, check the Supabase dashboard — `content_sources.status` should transition to `'ready'`.
4. Verify `knowledge_chunks` rows exist for the `source_id`.

---

**Step 5: Update the ContentLibrary component to show processing state**

Read `src/app/(sona)/dashboard/content/page.tsx`. Find where `content_sources` are rendered. The `status` column should already be fetched. Ensure the UI shows a "Processing…" indicator when `status === 'processing'` rather than just showing the source as ready.

If the component doesn't already poll for status updates, add a `useEffect` with a 3-second interval that re-fetches when any source has `status === 'processing'`, stopping when all are `'ready'` or `'error'`.

---

**Step 6: Commit**

```bash
git add src/app/api/creator/ingest/route.ts
git commit -m "feat: async ingestion using next/server after()

Heavy processing (text extraction, embedding, DB insert) now runs after
the HTTP response is sent. Returns immediately with source_id and
status='processing'. Eliminates Vercel timeout risk on large files.
Error path updates content_sources.status='error' with message."
```

---

## Task 6: IMPORTANT — Replace ivfflat with hnsw embedding index

**The problem:** `supabase/migrations/00001_core_schema.sql:80` creates an `ivfflat` index with `lists=100` against an empty table. `ivfflat` requires data to be present at index creation time to build its cluster lists — built against an empty table it degrades to a linear scan. `hnsw` is build-time agnostic and delivers consistently better recall.

**Files:**
- Create: `supabase/migrations/00015_hnsw_embedding_index.sql`

---

**Step 1: Write the migration**

Create `supabase/migrations/00015_hnsw_embedding_index.sql`:

```sql
-- Replace ivfflat embedding index with hnsw.
-- ivfflat was built against an empty table (lists=100 is meaningless without data)
-- and degrades to a linear scan. hnsw provides consistent recall regardless of
-- when the index is built and scales well to millions of vectors.
--
-- m=16, ef_construction=64 are safe defaults for 1536-dim embeddings.
-- Increase ef_construction to 128 for higher recall if query quality degrades at scale.

DROP INDEX IF EXISTS idx_knowledge_chunks_embedding;

CREATE INDEX idx_knowledge_chunks_embedding
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

**Step 2: Apply the migration**

```bash
npx supabase db push
```
Expected: Old index dropped, new hnsw index created.

> Note: On a table with many existing rows this index creation may take several seconds. On production, run during a low-traffic window.

---

**Step 3: Commit**

```bash
git add supabase/migrations/00015_hnsw_embedding_index.sql
git commit -m "perf: replace ivfflat with hnsw for embedding similarity search

ivfflat built against an empty table produces meaningless cluster lists
and degrades to a linear scan. hnsw delivers consistent ANN recall
regardless of table population state."
```

---

## Task 7: IMPORTANT — Add minimum similarity threshold to RAG retrieval

**The problem:** `supabase/migrations/00004_match_chunks_rpc.sql` returns the top `match_count` results with no similarity floor. A poorly-matched query injects irrelevant chunks into Claude's context on every call, degrading response quality and wasting tokens.

**Files:**
- Create: `supabase/migrations/00016_rag_similarity_threshold.sql`
- Modify: `src/lib/rag/retrieve.ts`

---

**Step 1: Update the RPC function**

Create `supabase/migrations/00016_rag_similarity_threshold.sql`:

```sql
-- Add minimum similarity threshold to match_knowledge_chunks RPC.
-- Results below the threshold are irrelevant and should not be sent to Claude.
-- Default threshold of 0.3 (cosine similarity) filters out clearly unrelated chunks
-- while retaining loosely relevant material. Tune based on observed retrieval quality.

CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  match_portrait_id UUID,
  match_count INTEGER DEFAULT 8,
  match_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  source_title TEXT,
  source_type TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kc.id,
    kc.content,
    kc.source_title,
    kc.source_type,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE kc.portrait_id = match_portrait_id
    AND kc.embedding IS NOT NULL
    AND 1 - (kc.embedding <=> query_embedding) >= match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

---

**Step 2: Apply the migration**

```bash
npx supabase db push
```

---

**Step 3: No app code change required**

The `match_threshold` parameter has a default of `0.3`, so existing calls to `supabase.rpc('match_knowledge_chunks', { ... })` in `src/lib/rag/retrieve.ts` will use the default. No changes needed unless you want to expose the threshold as a parameter later.

---

**Step 4: Test retrieval quality**

In Supabase SQL editor, run a test query:
```sql
SELECT * FROM match_knowledge_chunks(
  '[0.1, 0.2, ...]'::vector(1536),  -- replace with a real embedding
  '<portrait-uuid>',
  8,
  0.3
);
```
Verify that results have `similarity >= 0.3`. Adjust the default in the migration if too many or too few chunks are returned.

---

**Step 5: Commit**

```bash
git add supabase/migrations/00016_rag_similarity_threshold.sql
git commit -m "feat: minimum similarity threshold in match_knowledge_chunks RPC

Without a threshold, irrelevant chunks were injected into Claude context
on every query. Default threshold of 0.3 cosine similarity filters noise
while retaining loosely-relevant material. Backward compatible (default param)."
```

---

## Task 8: IMPORTANT — Populate messages.tokens_used for cost tracking

**The problem:** `messages.tokens_used` column exists (defined in `00001_core_schema.sql:61`) but is never populated. This makes LLM cost tracking impossible — there is no way to know how many tokens are being consumed per conversation, per portrait, or per subscriber.

**Files:**
- Modify: `src/app/api/chat/route.ts` (assistant message insert, ~line 131)

---

**Step 1: Read the Anthropic stream finalMessage**

The Anthropic streaming SDK exposes `stream.finalMessage()` after the stream completes, which includes `usage.output_tokens` and `usage.input_tokens`. This is the source of truth for token counts.

---

**Step 2: Update the chat route**

In `src/app/api/chat/route.ts`, find the assistant message insert (around line 131). Update the `after await stream` section to capture token usage:

```typescript
// After the for await loop completes, get final usage
const finalMessage = await stream.finalMessage()
const tokensUsed = (finalMessage.usage.input_tokens ?? 0) + (finalMessage.usage.output_tokens ?? 0)

// Save assistant message with token count
await supabase.from('messages').insert({
  conversation_id: convId,
  role: 'assistant',
  content: fullResponse,
  tokens_used: tokensUsed,
})
```

Replace the existing assistant message insert (which omits `tokens_used`).

---

**Step 3: Verify locally**

After sending a chat message, check the Supabase dashboard:
```sql
SELECT role, length(content), tokens_used
FROM messages
ORDER BY created_at DESC
LIMIT 5;
```
Expected: `tokens_used` should be a non-null integer for assistant messages.

---

**Step 4: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: populate messages.tokens_used from Anthropic stream finalMessage

Uses stream.finalMessage() to capture input + output token counts after
each completion. Enables per-conversation and per-portrait cost analysis."
```

---

## Execution Order Summary

| # | Defect | Type | Risk if skipped |
|---|--------|------|-----------------|
| 1 | C2: Per-portrait tier RLS | Critical | Paying subscribers can't access paid content |
| 2 | C1: getUser() in middleware | Critical | Crafted cookies bypass auth redirect |
| 3 | C3: audit_log composite index | Critical | Rate limit queries cause DB bottleneck at scale |
| 4 | C6: Stream abort on disconnect | Critical | LLM tokens consumed after client navigates away |
| 5 | C4: Async ingestion | Critical | Large file uploads timeout silently |
| 6 | HNSW index | Important | Degraded similarity search as knowledge base grows |
| 7 | RAG similarity threshold | Important | Irrelevant chunks injected into every Claude context |
| 8 | messages.tokens_used | Important | No LLM cost visibility |

Each task is independent — they can be reviewed and merged individually.
