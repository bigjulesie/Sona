# Sona — Architectural Review

**Reviewed:** 2026-03-09
**Reviewer:** Backend Architect
**Codebase:** `/Users/julian/Documents/sona`
**Stack:** Next.js 16 App Router · TypeScript · Supabase (Postgres + pgvector + Auth) · Anthropic Claude · OpenAI Embeddings · ElevenLabs TTS · Deepgram STT · Stripe · Vercel

---

## 1. Current Architecture Map

### 1.1 Route Structure

The application uses Next.js App Router route groups to partition brand and function concerns. The hierarchy is:

```
src/app/
├── (nh)/                          NH brand — admin, ingest, chat
│   └── admin/                     NH admin portal (chunks, ingest, interviews, portrait editor, users)
├── (shared)/                      Brand-agnostic auth
│   ├── auth/callback/             PKCE flow handler
│   ├── auth/confirm/              Implicit flow post-login redirect
│   └── login/                     Brand-aware login page
├── (sona)/
│   ├── (platform)/                Public-facing Sona pages (SonaNav layout)
│   │   ├── explore/
│   │   ├── home/
│   │   ├── sona/[slug]/           Subscriber chat + profile
│   │   └── account/
│   ├── dashboard/                 Creator dashboard (DashboardSubNav layout)
│   │   ├── content/
│   │   ├── interview/
│   │   ├── pricing/
│   │   └── settings/
│   ├── (wizard)/dashboard/create/ Minimal-layout wizard (bypasses DashboardSubNav)
│   ├── onboarding/
│   ├── privacy/
│   ├── signup/
│   └── terms/
└── api/
    ├── admin/chunks/              Admin chunk CRUD (is_admin flag check)
    ├── chat/                      SSE streaming chat with RAG
    ├── conversations/[id]/        Conversation fetch
    ├── conversations/             Conversation list
    ├── creator/ingest/            Creator content ingestion (multipart)
    ├── ingest/                    Legacy/internal ingest (service-role-bearer auth)
    ├── interview-requests/[id]/   Admin interview status update
    ├── interview-requests/        Creator interview request submit
    ├── portraits/pricing/         Creator pricing / Stripe product+price creation
    ├── ratings/                   Subscriber rating upsert
    ├── stripe/checkout/           Stripe checkout session creation
    ├── stripe/portal/             Stripe billing portal redirect
    ├── stripe/sync/               Subscription drift reconciliation
    ├── stripe/webhook/            Stripe event processor
    ├── subscriptions/             Free subscription upsert
    ├── transcribe/                STT via Deepgram
    └── tts/                       TTS via ElevenLabs
```

**Proxy / middleware** (`src/proxy.ts`): brand detection from host header, auth guard for non-public routes, injects `x-brand` response header.

### 1.2 Data Model (as of migration 00012)

Core tables:

| Table | Purpose | Key Columns |
|---|---|---|
| `portraits` | The Sona entity | `id`, `slug`, `creator_id`, `brand`, `is_public`, `monthly_price_cents`, `stripe_price_id`, `voice_provider_id`, `system_prompt` |
| `profiles` | Extended auth.users | `id`, `email`, `access_tier`, `portrait_id`, `stripe_customer_id`, `is_admin`, `onboarding_complete` |
| `knowledge_chunks` | RAG source material | `id`, `portrait_id`, `source_id`, `content`, `embedding vector(1536)`, `min_tier`, `chunk_index` |
| `content_sources` | Logical grouping of uploads | `id`, `portrait_id`, `title`, `source_type`, `min_tier`, `status`, `storage_path` |
| `subscriptions` | Active/past subscriptions | `id`, `subscriber_id`, `portrait_id`, `stripe_subscription_id`, `status`, `tier`, `current_period_end` |
| `conversations` | Chat thread header | `id`, `user_id`, `portrait_id`, `title` |
| `messages` | Individual chat turns | `id`, `conversation_id`, `role`, `content`, `chunks_referenced`, `tokens_used` |
| `interview_requests` | WhatsApp interview bookings | `id`, `creator_id`, `portrait_id`, `whatsapp_number`, `status` |
| `ratings` | 1–5 subscriber ratings | `id`, `subscriber_id`, `portrait_id`, `score` |
| `audit_log` | Immutable action log | `id`, `user_id`, `action`, `resource_type`, `resource_id`, `metadata`, `ip_address` |

Views: `portrait_discovery` — aggregates subscriber counts, avg_rating, new_subscribers_30d per public Sona.

Functions: `match_knowledge_chunks(query_embedding, match_portrait_id, match_count)` — cosine similarity retrieval via pgvector; `tier_level(t)` — converts enum to integer for comparison.

### 1.3 Ingestion → Retrieval Data Flow

```
Creator POST /api/creator/ingest (multipart, ≤10 MB)
  │
  ├─ Auth: createServerSupabaseClient().auth.getUser()
  ├─ Rate limit: checkRateLimit(userId, 'ingest') → audit_log COUNT query
  ├─ Ownership: portraits WHERE creator_id = user.id
  ├─ Text extraction: extractText() [pdf-parse / mammoth / utf-8] — src/lib/ingest/extract.ts
  ├─ content_sources INSERT (status='processing')
  ├─ chunkText() — paragraph-split, 1500 char max, 200 char overlap — src/lib/ingest/chunker.ts
  ├─ generateEmbeddings(chunks) — OpenAI text-embedding-3-small (1536d) — src/lib/ingest/embeddings.ts
  ├─ knowledge_chunks INSERT (bulk, via admin client)
  ├─ content_sources UPDATE status='ready'
  └─ audit_log INSERT

Subscriber POST /api/chat
  │
  ├─ Auth + rate limit (100/hr)
  ├─ portraits SELECT (system_prompt, brand, monthly_price_cents)
  ├─ hasActiveSubscription() → subscriptions SELECT
  ├─ retrieveRelevantChunks() → generateEmbedding(query) [OpenAI] → match_knowledge_chunks RPC
  │    RLS on knowledge_chunks: tier_level(profile.access_tier) >= tier_level(chunk.min_tier)
  ├─ conversations INSERT or verify ownership
  ├─ messages SELECT (last 20, ascending)
  ├─ messages INSERT (user turn)
  ├─ Anthropic claude-sonnet-4-6 stream (max_tokens=2048)
  ├─ messages INSERT (assistant turn, post-stream)
  └─ audit_log INSERT
```

### 1.4 Auth Model

- **Session layer**: Supabase GoTrue (cookie-based, `@supabase/ssr`). `createServerSupabaseClient()` (`src/lib/supabase/server.ts`) creates a user-scoped client. `createAdminClient()` (`src/lib/supabase/admin.ts`) uses `SUPABASE_SERVICE_ROLE_KEY` and bypasses RLS.
- **Route guard**: `src/proxy.ts` — blocks unauthenticated access to all non-public routes by calling `supabase.auth.getSession()` (note: `getSession()` not `getUser()` — see Risk §3.2).
- **RLS enforcement**: knowledge_chunks access is enforced at the DB level via the `tier_level()` comparison against `profiles.access_tier`. Subscription status is checked in application code (chat route lines 38–42) not in RLS, meaning the DB would serve chunks to any authenticated user who has the right tier regardless of active subscription.
- **Admin flag**: `profiles.is_admin` boolean. Checked via a secondary query in `requireAdmin()` (`src/app/api/admin/chunks/route.ts`). No admin RLS policy on `portraits` write.
- **Tier assignment**: `profiles.access_tier` is a global field — single tier across all Sonas. `subscriptions.tier` field exists and defaults to `acquaintance` but the RLS policy on `knowledge_chunks` reads from `profiles.access_tier`, not from `subscriptions.tier`. This means the tier is profile-wide, not per-Sona.

### 1.5 External Service Integration Points

| Service | Where | Auth mechanism |
|---|---|---|
| Anthropic Claude | `src/app/api/chat/route.ts` | `ANTHROPIC_API_KEY` env, instantiated per request |
| OpenAI Embeddings | `src/lib/ingest/embeddings.ts` | `OPENAI_API_KEY` env, client recreated per call |
| ElevenLabs TTS | `src/app/api/tts/route.ts` | `ELEVENLABS_API_KEY` env, raw fetch |
| Deepgram STT | `src/app/api/transcribe/route.ts` | `DEEPGRAM_API_KEY` env, raw fetch |
| Stripe | `src/lib/stripe/client.ts`, `src/app/api/stripe/*` | `STRIPE_SECRET_KEY`, singleton-cached |
| Resend email | `src/lib/email.ts` | `RESEND_API_KEY` env, instantiated per send |
| Supabase | `src/lib/supabase/*` | anon key (user-scoped) + service_role key (admin) |

---

## 2. Strengths

### 2.1 Clean Route Group Architecture

The `(nh)`, `(sona)`, `(shared)`, and `(wizard)` route groups cleanly separate brand concerns and layout hierarchy. The wizard group correctly bypasses the dashboard nav. This is an idiomatic, well-thought-out use of App Router features and should be preserved as the product grows.

### 2.2 RLS as the Access Control Backstop

The `knowledge_chunks` RLS policy using `tier_level()` in `00002_rls_policies.sql` is correct and well-designed. Even if application-layer checks were bypassed, the database enforces tier gating. The `tier_level()` function is marked `IMMUTABLE` which enables Postgres to cache it per query. The anon policy in `00011_sona_public_rls.sql` correctly restricts public chunk access to `min_tier='public'` chunks only.

### 2.3 Stripe Integration Is Robust

The webhook handler in `src/app/api/stripe/webhook/route.ts` handles the full subscription lifecycle (created, updated, deleted, payment_failed, payment_succeeded, dispute, refund). The sync endpoint `POST /api/stripe/sync` provides a client-triggered reconciliation mechanism for webhook delivery failures. The idempotency key pattern in `/api/portraits/pricing/route.ts` (lines 54–55) prevents duplicate Stripe objects. Orphaned price cleanup on DB write failure (lines 83–90) shows careful attention to partial-failure states.

### 2.4 Audit Log Is Present and Used Consistently

Every billable or sensitive action (chat, tts, transcribe, ingest) writes to `audit_log`. The table structure (action, resource_type, resource_id, metadata, ip_address) is sufficient for forensic audit. The log is insert-only for users (service_role policy only) which prevents tampering.

### 2.5 Rate Limiting Exists for All Billable Endpoints

`checkRateLimit()` in `src/lib/rate-limit.ts` guards chat (100/hr), tts (60/hr), transcribe (60/hr), and ingest (20/hr). The limits are sensible per-user per-hour windows. The implementation uses the audit_log as its counter which is clever — it ties rate tracking directly to the record of what was charged, with no separate Redis dependency.

### 2.6 Typed Database Client

`src/lib/supabase/types.ts` is generated from the schema and used throughout. The type system catches most schema mismatches at compile time. The pattern of `createServerSupabaseClient()` for user-scoped queries and `createAdminClient()` for service-role operations is clearly established and consistently followed.

### 2.7 Streaming Chat Architecture Is Correct

The SSE streaming pattern in `src/app/api/chat/route.ts` (lines 119–151) using `ReadableStream` is appropriate for Next.js App Router server functions. The assistant message is saved post-stream inside the streaming closure. `useChat` in `src/lib/hooks/useChat.ts` correctly handles abort, incremental text accumulation, and error states.

---

## 3. Risks and Weaknesses

### 3.1 Critical: Synchronous Ingestion Blocks the HTTP Request

**File:** `src/app/api/creator/ingest/route.ts`, lines 99–134

The entire ingest pipeline — text extraction, chunking, OpenAI embedding API call, and bulk DB insert — runs synchronously within a single HTTP request. For a 10 MB PDF with many pages, this pipeline can exceed 30 seconds. Vercel serverless functions have a 30-second timeout on the Pro plan and 10 seconds on Hobby. A large book or paper collection will time out silently, leaving the `content_sources` record in `status='processing'` permanently.

Additionally, `generateEmbeddings()` sends all chunks in a single OpenAI API call (`input: texts` is a batch, line 17 of `embeddings.ts`). For a 300-chunk document this is one large synchronous OpenAI call with no retries, no backoff, and no chunked batching. A transient OpenAI 429 or 500 will fail the entire ingest with no recovery path.

### 3.2 Critical: Middleware Uses getSession() Not getUser()

**File:** `src/proxy.ts`, line 57

```typescript
const { data: { session } } = await supabase.auth.getSession()
```

`getSession()` reads the session from the cookie without server-side validation. A crafted or replayed cookie can appear as a valid session. The correct call is `supabase.auth.getUser()` which validates the JWT against Supabase Auth on every request. Every API route correctly uses `getUser()` — the mismatch is only in the middleware auth guard, meaning a forged cookie could bypass the route-level redirect, though it would still be rejected by the API routes themselves. This should still be fixed to match Supabase's security guidance.

### 3.3 Critical: Tier Access Is Profile-Wide, Not Per-Sona

**File:** `supabase/migrations/00002_rls_policies.sql`, lines 41–47; `src/lib/supabase/types.ts` lines 323–360

`profiles.access_tier` is a single column representing a global tier. The `knowledge_chunks` RLS policy compares this global tier against `chunk.min_tier`. This means if a user subscribes to one paid Sona and their profile tier is elevated to `acquaintance`, they gain `acquaintance`-tier access to **all** Sonas' chunks, not just the one they paid for.

In practice the current code sets `subscriptions.tier = 'acquaintance'` (in `src/app/api/subscriptions/route.ts` line 27 and the Stripe webhook) but never elevates `profiles.access_tier`. So `profiles.access_tier` currently stays at `'public'` for most users, meaning the paid gating in subscriptions is currently **not** enforced at the DB chunk level for paying subscribers either. The `hasActiveSubscription()` check in the chat route (line 39) gates full chat access at the application layer, but the RLS is not actually doing per-subscription tier enforcement.

This is the most significant data model defect and needs to be resolved before multi-Sona scale.

### 3.4 High: Rate Limiting Uses Table Scan on audit_log

**File:** `src/lib/rate-limit.ts`, lines 16–28

Every rate limit check runs a `SELECT COUNT(*)` with a filter on `(user_id, action, created_at)` against `audit_log`. The index `idx_audit_log_action` in `00001_core_schema.sql` covers `action` but not the composite `(user_id, action, created_at)` query. As `audit_log` grows (every chat, tts, transcribe call appends a row), this query will become a full index scan over a large table. At 1,000 daily active users each sending 50 messages, the audit_log will grow by 50,000 rows/day. Within 6 months it will be at ~9M rows with no composite index.

### 3.5 High: The match_knowledge_chunks RPC Does Not Filter by Similarity Threshold

**File:** `supabase/migrations/00004_match_chunks_rpc.sql`, lines 14–26

The function returns the top N chunks by cosine similarity with no minimum similarity threshold. For an obscure query with no relevant content, it will return 8 weakly-relevant or irrelevant chunks, all of which get injected into the system prompt. This inflates token usage and can degrade response quality by injecting noise into Claude's context window. There is also no minimum similarity score returned to the application layer — `src/lib/rag/retrieve.ts` does not filter on `similarity` before building the context string.

### 3.6 High: The ivfflat Index Was Created with lists=100 Against an Unknown Current Dataset Size

**File:** `supabase/migrations/00001_core_schema.sql`, line 80

```sql
CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

`lists = 100` is appropriate for ~1M vectors. For smaller datasets this is over-specified (slow index build, poor recall at small `probes`); for datasets above 1M vectors it is under-specified (recall drops). The index was created at schema init before any data existed. As the knowledge base grows, this index needs to be replaced with `hnsw` (which offers better recall without tuning `lists`) or rebuilt with the correct `lists` value for the actual row count. Neither the application nor any migration monitors this.

### 3.7 High: admin/ingest Route Has Weak Authentication

**File:** `src/app/api/ingest/route.ts`, lines 10–12

```typescript
const authHeader = request.headers.get('authorization')
if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
```

This route authenticates by comparing a bearer token to `SUPABASE_SERVICE_ROLE_KEY` in plain string equality. The `SUPABASE_SERVICE_ROLE_KEY` is a high-privilege key — reusing it as an API auth token is a security smell. If this key is rotated, the route breaks. If the key leaks through logs or error messages, it grants service_role DB access. This route should either be removed (the `creator/ingest` route supersedes it) or protected with a dedicated secret.

### 3.8 Medium: No Conversation-Level Subscription Re-check

**File:** `src/app/api/chat/route.ts`, lines 38–42

Subscription status is checked once at the start of each chat request, but the conversation history is fetched and messages inserted without verifying that the subscription is still active at message insert time. A subscriber who cancels mid-conversation can continue chatting until the next request boundary only. This is acceptable, but the subscription check queries the DB on every message. This check does not use any caching — for popular Sonas with many concurrent chatters this generates one `subscriptions SELECT` per message.

### 3.9 Medium: No Input Sanitisation on system_prompt

**File:** `src/app/api/chat/route.ts`, lines 100–108

The `portrait.system_prompt` is fetched from the database and injected directly into the Anthropic system prompt with no sanitisation. A malicious creator who gains DB write access (or if `portraits` UPDATE is misconfigured) could inject prompt override instructions. This is not user-controllable via current UI flows, but the creator PATCH endpoint (in `(nh)/admin/portrait/actions.ts`) allows arbitrary `system_prompt` updates. There is no length cap or content policy check on this field.

### 3.10 Medium: Conversations Table Has No Portrait-Level Message Count Cap

**File:** `src/app/api/chat/route.ts`, lines 75–79; `src/lib/supabase/types.ts`, messages table

The history fetch at line 78 limits to 20 messages. This is a context window safeguard, not a storage cap. A user can accumulate unlimited messages, conversations, and transcript data with no storage quota. No quota enforcement or archiving policy exists. At scale, the `messages` table will be the largest table in the database with no partitioning strategy.

### 3.11 Medium: Free Subscription Bypasses Subscription Status Validation

**File:** `src/app/api/subscriptions/route.ts`, lines 19–28

The free subscription endpoint checks `portrait.is_public` and `portrait.monthly_price_cents` but does not verify that the user is not already subscribed (it uses `upsert` which handles duplicates). However, it does not check whether the subscriber has previously had a `cancelled` status. A user can subscribe, cancel (via any mechanism), and then re-subscribe to a free Sona unlimited times with no friction or tracking.

### 3.12 Medium: MRR Calculation Is Client-Side and Approximate

**File:** `src/app/(sona)/dashboard/page.tsx`, lines 40–43

```typescript
const mrr = portrait.monthly_price_cents
  ? (subscriberCount * portrait.monthly_price_cents) / 100
  : 0
```

MRR is calculated by multiplying all active subscribers by the current price. This is wrong when the creator has ever repriced — past subscribers locked to the old price will have their numbers skewed. True MRR requires summing `current_period_amount` from Stripe subscriptions, not inferring from headcount × current price.

### 3.13 Low: OpenAI Client Is Recreated on Every Call

**File:** `src/lib/ingest/embeddings.ts`, lines 3–5

```typescript
function getClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}
```

A new `OpenAI` client instance is created for every `generateEmbedding()` call. In a serverless function this is not harmful since the function container is ephemeral, but it is inconsistent with the singleton pattern used for Stripe (`src/lib/stripe/client.ts`) and wastes a small amount of initialization time per request.

### 3.14 Low: content_sources.storage_path Column Is Unused

**File:** `supabase/migrations/00012_content_sources.sql`, line 11

The `storage_path TEXT` column was added to `content_sources` to track the original file in Supabase Storage, but the creator ingest route (`src/app/api/creator/ingest/route.ts`) never writes to this column. The original file is not stored at all — only the extracted text chunks are persisted. This means creators cannot re-process their content with improved chunking strategies, cannot delete a source and have the original file removed, and cannot audit what was ingested.

### 3.15 Low: No TypeScript Types for content_sources

**File:** `src/app/api/creator/ingest/route.ts`, line 88; `src/lib/supabase/types.ts`

The `content_sources` table (added in migration 00012) is not reflected in the generated types file. Both the ingest route and the content library use `as any` casts to work around this. The types need to be regenerated (`supabase gen types typescript`) to eliminate these casts and restore type safety.

### 3.16 Low: No Error Boundary or Monitoring Integration

**File:** `src/app/error.tsx`

The global error boundary exists but there is no error reporting integration (Sentry, Datadog, etc.). API route errors are returned as HTTP responses but never aggregated. There is no alerting on elevated 5xx rates, no performance monitoring, and no LLM cost tracking beyond the audit_log rows.

---

## 4. Proposed Amendments for Next-Stage Development

### 4.1 Database: Per-Subscription Tier Enforcement

**Priority: Critical**

The current RLS architecture conflates profile-level tier with subscription-level tier. To support a true per-Sona tiered knowledge model, the `knowledge_chunks` RLS policy must be refactored to join through `subscriptions`:

Replace the existing policy in `00002_rls_policies.sql` with a policy that checks:
```sql
-- Pseudocode for the correct policy intent
EXISTS (
  SELECT 1 FROM subscriptions s
  WHERE s.subscriber_id = auth.uid()
    AND s.portrait_id = knowledge_chunks.portrait_id
    AND s.status IN ('active', 'trialing')
    AND tier_level(s.tier) >= tier_level(knowledge_chunks.min_tier)
)
OR knowledge_chunks.min_tier = 'public'
```

This requires:
1. A new migration to drop and recreate the `knowledge_chunks FOR SELECT` policy.
2. Keeping `profiles.access_tier` as an NH-era concept only, or deprecating it entirely.
3. Updating `match_knowledge_chunks` RPC to accept the caller's effective tier for the specific portrait, rather than relying on the global RLS.

This is the single most important schema change before scaling to multiple Sonas per user.

### 4.2 Database: Composite Index on audit_log

**Priority: Critical**

Add to a new migration:
```sql
CREATE INDEX idx_audit_log_user_action_created
  ON audit_log(user_id, action, created_at DESC);
```

This directly serves `checkRateLimit()` which filters on all three columns. Drop the existing `idx_audit_log_action` index which is now redundant. This will reduce the rate limit check from a partial index scan to an index range scan — sub-millisecond at any realistic table size.

### 4.3 Database: Partition messages Table by created_at

**Priority: Important (within 3 months)**

The `messages` table will be the highest-volume table in the system. Define it as a range-partitioned table by `created_at` (monthly or quarterly partitions). This enables Postgres to prune old partitions from queries, dramatically reducing vacuum overhead, and makes archiving and deletion of old data operationally simple without full table scans.

This requires a migration that recreates the table as partitioned — the existing data must be migrated. Do this before the table exceeds 5M rows.

### 4.4 Database: knowledge_chunks Index Upgrade to HNSW

**Priority: Important**

Replace the `ivfflat` index with `hnsw`:
```sql
DROP INDEX idx_knowledge_chunks_embedding;
CREATE INDEX idx_knowledge_chunks_embedding
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

`hnsw` does not require tuning `lists` proportional to dataset size and provides better recall at all scales. The tradeoff is more memory usage, which is acceptable given Supabase's compute tier. This should be done before the knowledge_chunks table exceeds 500K rows.

### 4.5 Database: similarity_threshold Parameter in match_knowledge_chunks

**Priority: Important**

Update the RPC to filter results below a minimum similarity threshold:
```sql
WHERE kc.portrait_id = match_portrait_id
  AND kc.embedding IS NOT NULL
  AND 1 - (kc.embedding <=> query_embedding) >= match_threshold
```

Add `match_threshold FLOAT DEFAULT 0.35` as a parameter. Return `similarity` in the result so the application can make secondary filtering decisions. Update `src/lib/rag/retrieve.ts` to pass and log the threshold. This eliminates noise-chunk injection into Claude's context and reduces token costs for semantically unmatched queries.

### 4.6 Ingestion Pipeline: Move to Async Queue

**Priority: Critical**

The synchronous ingest in `src/app/api/creator/ingest/route.ts` must be made asynchronous before the platform opens to creators uploading large documents.

Recommended pattern for Vercel deployment:

1. **Ingest endpoint**: Accept the file, write it to Supabase Storage (populating `content_sources.storage_path`), insert a `content_sources` row with `status='pending'`, return immediately with `{ source_id, status: 'pending' }`.

2. **Processing function**: A Vercel background function (or Supabase Edge Function with Deno) reads from a queue (Supabase `pg_net` + a `ingest_queue` table, or an external queue like Inngest / Trigger.dev). The worker:
   - Downloads the file from Supabase Storage
   - Extracts text
   - Chunks with configurable options
   - Calls OpenAI embeddings with retry + exponential backoff
   - Inserts `knowledge_chunks` in batches of 100
   - Updates `content_sources.status='ready'`

3. **Status polling**: `GET /api/creator/ingest/[source_id]` returns current `status` and `chunks_created` for the UI to poll or use SSE.

This decouples ingestion latency from the HTTP request and enables processing of full books (300+ pages) without timeout risk.

### 4.7 Ingestion Pipeline: Store Original Files in Supabase Storage

**Priority: Important**

Populate `content_sources.storage_path` by uploading the raw file to Supabase Storage before processing. This enables:
- Re-chunking with improved parameters without re-upload
- Deletion workflows that remove both the file and its chunks
- Audit evidence for content disputes

Define a bucket `sona-content` with RLS restricting access to the portrait's creator.

### 4.8 RAG: Hybrid Retrieval (Semantic + Keyword)

**Priority: Important (3 months)**

The current retrieval is purely vector-similarity based. For queries that contain specific names, dates, titles, or technical terms, keyword (BM25/full-text) retrieval outperforms embedding similarity. Postgres `tsvector` is already available. A hybrid approach using Reciprocal Rank Fusion (RRF) of vector and keyword results significantly improves recall on factual queries — the kind of queries subscribers most need answered correctly about a creator's actual statements.

Add a `tsv` column to `knowledge_chunks` populated by a trigger:
```sql
ALTER TABLE knowledge_chunks ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX idx_knowledge_chunks_tsv ON knowledge_chunks USING gin(tsv);
```

Update `match_knowledge_chunks` to accept a `use_hybrid BOOLEAN` parameter and return an RRF-merged result set.

### 4.9 API Layer: Split /api/chat into Stream and Persist Paths

**Priority: Important**

The current `/api/chat/route.ts` does five DB operations in sequence: portrait lookup, subscription check, conversation get/create, history fetch, user message insert — all before streaming begins. Any of these DB calls taking >500ms creates visible latency before the first token appears.

Refactor to two phases:
- `/api/chat/prepare` — validates auth, subscription, loads history, returns `conversation_id` and context. Runs eagerly.
- `/api/chat/stream` — accepts `conversation_id`, pre-fetched context, and streams. Saves messages after stream completes.

Alternatively, batch the pre-stream DB operations using `Promise.all` for portrait + subscription + conversation queries that are currently sequential (lines 28–72 run sequentially; portrait → subscription → conversation could be parallelised with `Promise.all` since they are independent).

### 4.10 API Layer: Move tts and transcribe to Edge Runtime

**Priority: Nice-to-have**

`/api/tts/route.ts` and `/api/transcribe/route.ts` are pure proxy routes — they authenticate the user, then forward a request to ElevenLabs or Deepgram and stream the response back. These have no Node.js dependencies (`pdf-parse` and `mammoth` are not imported) and are ideal candidates for `export const runtime = 'edge'`. Edge functions have lower cold-start latency (~0ms vs ~200ms for Node) and are closer to the user's region, which matters for TTS/STT round-trip times.

### 4.11 Group Conversation Mode: Required Infrastructure

**Priority: Important (plan before next feature cycle)**

Group conversation mode (inviting a Sona into a conversation with others) requires infrastructure that does not exist:

**New data model requirements:**
```sql
CREATE TABLE group_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portrait_id    UUID NOT NULL REFERENCES portraits(id),
  created_by     UUID NOT NULL REFERENCES profiles(id),
  invite_token   TEXT UNIQUE NOT NULL,  -- shareable link token
  status         TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  max_participants INTEGER DEFAULT 10,
  created_at     TIMESTAMPTZ DEFAULT now(),
  expires_at     TIMESTAMPTZ
);

CREATE TABLE group_session_participants (
  session_id     UUID REFERENCES group_sessions(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

CREATE TABLE group_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  sender_id      UUID REFERENCES profiles(id),   -- NULL if Sona
  role           TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content        TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

**Real-time delivery**: Supabase Realtime (PostgreSQL logical replication subscriptions via `supabase.channel()`) can broadcast new `group_messages` rows to all session participants without additional infrastructure. This is the correct choice here — it avoids adding WebSocket server complexity.

**Access control considerations**: Any participant in the group session must individually satisfy the Sona's subscription requirement, or the session host's subscription covers all participants (simpler UX but more complex billing). Decide this policy before implementation.

**Sona participation**: The Sona should respond to the group conversation history, not just the last message. The `match_knowledge_chunks` call should use the last user message as the query but include the full recent group context window in the Claude messages array. This is a minor change to the existing chat logic.

### 4.12 Auth: Fix Middleware to Use getUser()

**Priority: Critical**

In `src/proxy.ts` line 57, replace:
```typescript
const { data: { session } } = await supabase.auth.getSession()
if (!session) {
```
with:
```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
```

This is a one-line change that closes the forged-cookie bypass vulnerability per Supabase's own security guidance.

### 4.13 Auth: Creator Ownership Validation at Portrait Write

**Priority: Important**

There is no global RLS policy preventing a user from `UPDATE`-ing a portrait they don't own. The application routes check ownership (e.g., `pricing/route.ts` line 33), but if any route is added without this check, a creator could update another creator's portrait. Add an RLS UPDATE policy:
```sql
CREATE POLICY "creators_update_own_portrait"
  ON portraits FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());
```

### 4.14 Observability: Structured Logging and Error Tracking

**Priority: Important**

The application has zero structured logging and no error tracking service integration. Recommended additions:

1. **Sentry** (or equivalent): Install `@sentry/nextjs`. Instrument API routes and the streaming chat handler. The streaming handler in `/api/chat/route.ts` has a broad `catch` inside the `ReadableStream` that silently swallows errors after stream start.

2. **LLM cost tracking**: The `messages.tokens_used` column exists but is never populated (line 131 of `chat/route.ts` does not write `tokens_used`). Populate it from `stream.finalMessage().usage.output_tokens` after the Anthropic stream completes. Add a corresponding `embedding_tokens_used` column or metadata field in `audit_log` for OpenAI embedding calls. This enables cost attribution per creator and per Sona.

3. **Composite index for cost queries**: Once token usage is populated, analytics queries like "total tokens used per portrait this month" will need a composite index on `messages(conversation_id, created_at, tokens_used)`.

### 4.15 Cost Controls: LLM and TTS Spend Guardrails

**Priority: Critical**

Current exposure points with no hard caps:

| Risk | Current State | Fix |
|---|---|---|
| Claude context size | system_prompt + up to 8 × 1500-char chunks + 20 messages history = potentially 20,000+ tokens per request | Cap: limit chunk count to 5 by default, add `max_context_tokens` guard before streaming |
| TTS credit drain | 2,000 char cap per call (line 21 of `tts/route.ts`), 60/hr rate limit | Adequate, but no monthly cap per creator; a viral Sona could exhaust the account limit |
| Embedding cost | Entire document sent in one batch; no cost estimate before processing | Add a pre-ingest token estimate and warn creator if above a threshold |
| Claude streaming on cancelled requests | `AbortController` in `useChat.ts` sends abort to the client fetch but the server-side Anthropic stream continues | The Anthropic SDK stream should be aborted in the server handler when the SSE connection closes; this wastes tokens on abandoned requests |

For the Claude streaming abort issue in `src/app/api/chat/route.ts`: the `stream` object from `anthropic.messages.stream()` supports `.abort()`. The `ReadableStream` `cancel` callback is the correct place to call it.

---

## 5. Prioritised Recommendations

### Critical — Do Before Next Feature

| # | Recommendation | File(s) |
|---|---|---|
| C1 | Fix `getSession()` → `getUser()` in middleware | `src/proxy.ts:57` |
| C2 | Refactor knowledge_chunks RLS to be per-subscription, not per-profile | `supabase/migrations/00002_rls_policies.sql` + new migration |
| C3 | Add composite index `(user_id, action, created_at)` to audit_log | New migration |
| C4 | Make ingestion async — return immediately, process in background | `src/app/api/creator/ingest/route.ts` |
| C5 | Add similarity threshold to `match_knowledge_chunks` | `supabase/migrations/00004_match_chunks_rpc.sql` + new migration |
| C6 | Add LLM abort on SSE disconnect | `src/app/api/chat/route.ts:119` |

### Important — Within 3 Months

| # | Recommendation | File(s) |
|---|---|---|
| I1 | Regenerate Supabase types to include content_sources | `src/lib/supabase/types.ts` |
| I2 | Replace ivfflat with hnsw for knowledge_chunks embedding index | New migration |
| I3 | Add RLS UPDATE policy on portraits | New migration |
| I4 | Store original files in Supabase Storage, populate `storage_path` | `src/app/api/creator/ingest/route.ts` + `supabase/` |
| I5 | Populate `messages.tokens_used` from Anthropic stream usage | `src/app/api/chat/route.ts:131` |
| I6 | Add Sentry (or equivalent) error tracking | `next.config.ts` + API routes |
| I7 | Parallelise pre-stream DB queries in /api/chat | `src/app/api/chat/route.ts:28–72` |
| I8 | Design and migrate group_sessions schema (even if UI comes later) | New migration |
| I9 | Partition messages table by created_at before it exceeds 5M rows | New migration |

### Nice-to-Have — Backlog

| # | Recommendation | File(s) |
|---|---|---|
| N1 | Move tts and transcribe routes to Edge runtime | `src/app/api/tts/route.ts`, `src/app/api/transcribe/route.ts` |
| N2 | Add hybrid BM25 + vector retrieval in match_knowledge_chunks | New migration |
| N3 | Singleton OpenAI client (minor) | `src/lib/ingest/embeddings.ts` |
| N4 | Remove or properly gate the legacy `/api/ingest` route | `src/app/api/ingest/route.ts` |
| N5 | Fix MRR calculation to use Stripe subscription amounts | `src/app/(sona)/dashboard/page.tsx:40` |

### Highest-Leverage Single Change

**C2 — Per-subscription tier enforcement in RLS** is the highest-leverage architectural change. It is the one defect that, if left unaddressed, makes the entire tier/knowledge-gating product promise unreliable at scale. Every other improvement is incremental; this one is foundational. The current state means paying subscribers cannot access paid-tier chunks (because `profiles.access_tier` is never elevated), and a correctly elevated profile would gain access to all Sonas' paid content regardless of which ones they actually subscribe to. Both failure modes are product-breaking.
