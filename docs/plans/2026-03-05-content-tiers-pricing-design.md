# Content Ingestion, Tier System & Pricing Hub — Design

## Goal

Upgrade Sona's content ingestion from a simple text-paste form to a proper content library with file upload support; introduce the four-tier access system with subscriber-facing names; and evolve the pricing UI into a dedicated earnings and pricing hub.

## Decisions made

| Topic | Decision |
|---|---|
| Tier naming | Discovery · Perspective · Wisdom · Legacy |
| Content ingestion at launch | Interview (primary) + document upload (PDF, Word, txt) |
| Social / podcast / URL ingestion | Roadmap — not in this phase |
| Pricing model | Single price; all paying subscribers get Perspective tier |
| Creator-assigned subscriber tier | Roadmap (Option A) |
| Legacy invite-only tier | Roadmap |
| Stripe Connect payouts | Roadmap |

---

## Section 1: Tier System

### Tier mapping

| Internal DB value | Subscriber-facing name | Who receives it |
|---|---|---|
| `public` | Discovery | Non-subscribers (free preview content) |
| `acquaintance` | Perspective | All paying subscribers |
| `colleague` | Wisdom | Reserved — manually granted by creator (future) |
| `family` | Legacy | Reserved — creator-invite only (future) |

### How it works

- The `access_tier` enum in Postgres remains unchanged (`public`, `acquaintance`, `colleague`, `family`).
- All UI surfaces display the subscriber-facing names. A constants file maps enum values to display names.
- `knowledge_chunks.min_tier` already exists. When a creator uploads content they select a tier; that value is stored as the internal enum value.
- The RAG retrieval function filters chunks where `min_tier ≤ subscriber_tier`. Tier ordering: public < acquaintance < colleague < family.
- A paying subscriber's `subscriptions.tier` is set to `acquaintance` (Perspective) at checkout — this is already the default in the schema.
- Wisdom and Legacy chunks are never returned to any subscriber in this phase.

### No schema migration required

Enum values are unchanged. Only display labels change.

---

## Section 2: Content Ingestion

### New table: `content_sources`

Tracks each uploaded item as a logical unit. Individual `knowledge_chunks` link back to a source.

```sql
CREATE TABLE content_sources (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portrait_id  UUID NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  source_type  TEXT NOT NULL CHECK (source_type IN ('transcript', 'article', 'book', 'essay', 'speech', 'other')),
  min_tier     access_tier NOT NULL DEFAULT 'public',
  storage_path TEXT,          -- Supabase Storage path for uploaded files (null for paste)
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_msg    TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

`knowledge_chunks` gains a `source_id UUID REFERENCES content_sources(id) ON DELETE CASCADE` column.

### Content library page (`/dashboard/content`)

Replaces the current single-form page. Two states:

**Empty state** — prompt to add first content, with context that the WhatsApp interview is the primary source and documents enrich it.

**Library view** — a list of content sources showing:
- Source title
- Type badge (Transcript, Article, etc.)
- Tier badge (Discovery / Perspective / Wisdom / Legacy)
- Upload date
- Delete action (cascades to chunks)

A persistent "Add content" button opens an inline form or modal.

### Add content form

Fields:
- **Source title** (text input) — e.g. "Interview with The Guardian, 2019"
- **Type** (select) — Transcript · Article · Book · Essay · Speech · Other
- **Tier** (select) — Discovery · Perspective · Wisdom · Legacy
- **Input method** (toggle) — Paste text / Upload file
  - Paste: textarea
  - Upload: file input accepting `.pdf`, `.docx`, `.txt`

### Processing pipeline

1. On submit, a `content_sources` row is created with `status: 'pending'`.
2. A server action / API route handles text extraction:
   - Pasted text: used directly
   - PDF: extracted via `pdf-parse` (Node.js)
   - DOCX: extracted via `mammoth`
   - TXT: read directly
3. Extracted text is split into chunks (~500 tokens with overlap), embedded via OpenAI, and inserted into `knowledge_chunks` with the source's `min_tier`.
4. Source status updated to `ready` (or `error` on failure).
5. UI polls or refreshes to show updated status.

### Processing happens synchronously (MVP)

Background job queuing (e.g. Inngest, pg-boss) is deferred. For MVP, processing runs in the API route with a reasonable timeout. Large files (>50 pages) are flagged with a size warning.

---

## Section 3: Pricing & Earnings Hub

### Wizard step 4 (simplified)

Stays simple for now:
- Free / Paid toggle
- If paid: monthly price in USD (minimum $1)
- Helper text: "All subscribers receive Perspective-level access. Wisdom and Legacy tier controls are coming soon."
- On submit → `/dashboard`

### New dashboard page: `/dashboard/pricing`

Replaces the pricing section currently embedded in Settings. Accessible from the dashboard nav.

**Content:**

- **Current plan** — price displayed, tier granted to subscribers (Perspective, shown as locked with tooltip explaining future unlock)
- **Live stats** — active subscribers count, MRR (calculated as subscribers × price), total earned to date (sum of successful payments — requires Stripe data, deferred to when Stripe Connect is live; show placeholder for now)
- **Payout status** — "Stripe payouts coming soon" placeholder
- **Change price** — inline form to update monthly price (calls existing `/api/portraits/pricing`)

### Dashboard nav update

Add "Pricing" as a nav item alongside Overview · Content · Interview · Settings.

---

## Roadmap (not in this phase)

- **Creator-assigned subscriber tier** — creator chooses which tier paying subscribers receive (currently locked to Perspective)
- **Legacy invite system** — creator manually grants Legacy access to specific individuals, optionally free of charge; platform charges for delivery/seat count
- **Wisdom tier unlock** — criteria TBD (subscriber count threshold, manual unlock, or paid feature)
- **Stripe Connect payouts** — direct creator earnings disbursement
- **Social data connectors** — X/Twitter, LinkedIn, Substack
- **Podcast ingestion** — audio transcription via Deepgram, then standard chunking pipeline
- **URL/blog post ingestion** — fetch and extract article text from URLs
- **Background job processing** — replace synchronous processing with a queue for large documents
