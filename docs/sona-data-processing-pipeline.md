# Sona — Data Processing & Analysis Pipeline

This document describes every stage of processing that occurs when a creator ingests content into their Sona, from raw file upload to active use in conversations.

---

## Overview

Content flows through four sequential stages:

```
Ingestion → Chunking & Embedding → Evidence Extraction → Synthesis
```

At conversation time a fifth stage — **Retrieval & Prompt Assembly** — draws on the outputs of all four.

---

## Stage 1 — Ingestion

### Entry points

**Text & documents** — `POST /api/creator/ingest`
**Audio files** — `POST /api/creator/ingest` (init) → presigned URL upload → `POST /api/creator/ingest/confirm`

### Rate limiting & auth

Every request is authenticated via Supabase session. The creator must own the portrait (`portraits.creator_id = user.id`). Requests are rate-limited to 20 per hour per user (`rate_limit` table).

### Accepted input formats

| Format | Size limit | Processing |
|--------|-----------|------------|
| PDF | 10 MB | `pdf-parse` (v2 class API) — extracts plain text |
| DOCX | 10 MB | `mammoth` — extracts raw text, discards formatting |
| TXT / MD | 10 MB | Read directly as UTF-8 |
| Pasted text | — | Used as-is |
| MP3, M4A, WAV, OGG, MP4 | 200 MB | Uploaded to Supabase Storage, then transcribed |

### Metadata recorded per source

Each upload creates a `content_sources` row immediately (status `processing`):

| Field | Value |
|-------|-------|
| `title` | Creator-supplied title |
| `source_type` | `transcript` · `interview` · `interview_audio` · `article` · `book` · `essay` · `speech` · `letter` · `other` |
| `min_tier` | Access tier gate (`public` · `acquaintance` · `colleague` · `family`) |
| `storage_path` | Set for audio files only (`{portrait_id}/{source_id}/{filename}`) |
| `status` | `processing` → `ready` · `error` |

### Audio upload flow

1. Creator selects an audio file. The client sends metadata (filename, content type) to `/api/creator/ingest`.
2. Server creates the `content_sources` record and returns a **Supabase Storage presigned URL** (bucket: `sona-content`, private, 200 MB limit).
3. Client PUTs the file directly to the presigned URL — the file never passes through the application server.
4. Client calls `/api/creator/ingest/confirm` with the `source_id`. Server retrieves the public URL from Storage and proceeds to transcription.

---

## Stage 2 — Text Extraction, Chunking & Embedding

This stage is identical for documents and audio (audio uses its transcript as the text source). All processing runs **asynchronously** using Next.js `after()` — the HTTP response is returned immediately and the client sees status `processing`.

### 2a — Audio transcription (audio only)

Audio is transcribed via the **Deepgram Nova-2** model with the following options:

- `punctuate=true` — adds sentence punctuation
- `paragraphs=true` — groups into paragraphs
- `diarize=true` — identifies distinct speakers
- `utterances=true` — returns per-utterance segments with speaker labels and timestamps

The full transcript and speaker-segmented utterances are stored in `sona_transcriptions` (columns: `transcript`, `transcript_with_speakers`, `duration_seconds`).

**Speaker isolation.** For multi-speaker recordings, the system identifies the *subject* — the person being ingested — as the speaker with the highest total word count. Only that speaker's utterances are passed to the chunking stage. This prevents interviewers' questions and third-party speech from polluting the knowledge base.

### 2b — Chunking

Text is split into overlapping chunks using a paragraph-aware strategy:

| Parameter | Value |
|-----------|-------|
| Max chunk size | 1,500 characters |
| Overlap | 200 characters (trailing tail of previous chunk) |
| Split boundary | Double newline (`\n\n+`) — paragraph-level |

Paragraph boundaries are respected where possible; a new chunk only begins when the next paragraph would exceed the size limit. The overlap ensures context is not lost at chunk boundaries.

### 2c — Embedding

Each chunk is embedded using **OpenAI `text-embedding-3-small`** (1,536 dimensions). All chunks in a source are embedded in a single batched API call. Embeddings are stored in the `knowledge_chunks` table (pgvector column) alongside the raw text, source metadata, and access tier.

### knowledge_chunks schema (per row)

| Column | Content |
|--------|---------|
| `portrait_id` | Owning portrait |
| `source_id` | Parent `content_sources` row |
| `content` | Raw chunk text |
| `embedding` | 1,536-dimensional vector |
| `source_title` | Denormalised from source |
| `source_type` | Denormalised from source |
| `min_tier` | Access gate (enforced by RLS at retrieval time) |
| `chunk_index` | Position within source |

---

## Stage 3 — Evidence Extraction

Immediately after chunking completes, the system runs psychological evidence extraction on every new source. This runs as part of the same `after()` block.

### Purpose

To build a structured, queryable model of the creator's personality, values, and cognition — separate from the raw text — that can be synthesised into the Sona's character.

### Method

The full source text (or subject-only transcript for audio) is passed through **Claude Sonnet** in overlapping windows of 4,000 characters (400-character overlap). For each window, the model is instructed to extract evidence items as structured JSON.

### Dimension taxonomy

| Category | Dimension keys |
|----------|---------------|
| `personality` | openness, conscientiousness, extraversion, agreeableness, neuroticism (Big Five) |
| `values` | self_direction, stimulation, hedonism, achievement, power, security, conformity, tradition, benevolence, universalism (Schwartz) |
| `communication` | directness, warmth, formality, analytical_intuitive_balance, use_of_humour |
| `cognitive` | decision_making_style, risk_orientation, worldview, chunk_size_preference |
| `nlp_patterns` | primary_rep_system, meta_program_motivation, meta_program_chunk_size, meta_program_reference, logical_level_primary, language_model_tendency, timeline_orientation |
| `expertise` | Auto-identified domain labels (e.g. entrepreneurship, medicine) |
| `beliefs` | Specific stated beliefs about world, self, or others |

### Evidence item structure

Each extracted item is stored in `sona_evidence`:

| Field | Values / notes |
|-------|----------------|
| `dimension_category` | One of the seven categories above |
| `dimension_key` | Specific dimension within category |
| `evidence_text` | Verbatim quote or close paraphrase |
| `evidence_type` | `direct_quote` · `stated_belief` · `behavioural_pattern` · `inferred` |
| `confidence` | 0.0–1.0 (model-assigned, higher for verbatim quotes) |
| `portrait_id` | Owning portrait |
| `source_id` | Source the evidence was drawn from |

Duplicates across overlapping windows are deduplicated on `(dimension_key, evidence_text[:80])` before insertion. Upsert conflicts are resolved on `(portrait_id, source_id, dimension_key)`.

---

## Stage 4 — Synthesis

Synthesis transforms raw evidence into a coherent character model. It is triggered automatically when **3 or more** new evidence extractions have completed since the last synthesis run. It will not run if the portrait already has evidence from fewer than 4 distinct dimension categories (insufficient breadth).

Synthesis runs as three sequential sub-stages.

### 4a — Dimension synthesis

For each unique `dimension_key` across all evidence, a **weighted confidence score** is computed:

```
weighted_confidence = raw_confidence × evidence_type_weight × source_type_weight × recency_weight
```

**Evidence type weights:**

| Type | Weight |
|------|--------|
| `direct_quote` | 1.0 |
| `stated_belief` | 0.9 |
| `behavioural_pattern` | 0.7 |
| `inferred` | 0.4 |

**Source type weights:**

| Source | Weight |
|--------|--------|
| `interview_audio` | 1.3 |
| `interview` | 1.2 |
| `article` / `book` / `essay` / `transcript` / `speech` / `letter` | 1.0 |
| `other` | 0.9 |

**Recency weight** — exponential decay with a 5-year half-life:

```
recency = e^(−0.138 × years_ago)
```

At 3 years, weight ≈ 0.66. At 5 years, weight ≈ 0.50.

Claude Sonnet then synthesises each dimension's evidence into:

| Output | Description |
|--------|-------------|
| `score` | Normalised 0–100 (100 = extremely high on this dimension) |
| `narrative` | 60–80 word human description of this quality |
| `confidence_flag` | `null` · `LOW_CONFIDENCE` (avg confidence < 0.5 or < 3 evidence items) · `AMBIGUOUS` (evidence in genuine tension) |

Results are upserted into `sona_dimensions`.

### 4b — Identity prompt generation

Using all synthesised dimension narratives, Claude Sonnet generates **four tier-stratified system prompts** — one per access tier — each written in second person ("You are [Name]…"):

| Tier | Depth |
|------|-------|
| `public` | Surface communication style and public expertise domains only |
| `acquaintance` | + Big Five personality, core values, primary NLP patterns |
| `colleague` | + Cognitive patterns, belief structures, meta-programs |
| `family` | Full depth: all dimensions, complete NLP profile, personal philosophy, emotional intelligence |

Prompts are stored in `sona_identity_prompts` (one row per tier) and the public-tier prompt is also written back to `portraits.system_prompt` for backwards compatibility.

### 4c — Currents generation ("Currents")

Currents are focused behavioural modules that activate dynamically based on conversation topic. Ten candidate module types are evaluated:

`business_strategy` · `leadership_management` · `relationships_personal` · `decision_making` · `personal_philosophy` · `creative_process` · `learning_growth` · `communication_influence` · `emotional_intelligence` · `conflict_resolution`

Each module type has a set of **dimension signal keys** that indicate relevance. A module is generated only if at least 2 of its signals are present in dimensions with confidence ≥ 0.5 and ≥ 3 evidence items.

For each qualifying module type, Claude Sonnet produces:

| Output | Description |
|--------|-------------|
| `prompt_content` | 150–250 word behavioural instruction for Claude |
| `activation_keywords` | 8–12 terms/phrases indicating topic relevance |
| `nlp_delivery_notes` | NLP-calibrated delivery instructions (predicates, Dilts level, motivation direction, chunk size, language model) |
| `confidence` | 0.0–1.0 |

An activation embedding is generated from the title, keywords, and module type name. It is stored in `sona_modules` (pgvector column) for semantic retrieval at conversation time.

When all currents are written, `portraits.synthesis_status` is set to `ready` and `portraits.last_synthesised_at` is updated.

---

## Stage 5 — Retrieval & Prompt Assembly (at conversation time)

Every time a subscriber sends a message, the following happens before Claude is called:

### 5a — RAG retrieval

The subscriber's message is embedded using `text-embedding-3-small`. A pgvector similarity search (`match_knowledge_chunks` RPC) retrieves up to **8 knowledge chunks** most semantically similar to the query. Row-level security automatically filters chunks by `min_tier` — subscribers only see chunks they are entitled to.

### 5b — Current selection

The same message embedding is compared against all active `sona_modules` for the portrait using a second similarity search (`match_sona_modules` RPC). Up to **2 currents** above a similarity threshold of 0.65 are selected. Currents that are below the tier level of the subscriber are excluded.

### 5c — Prompt assembly

The final system prompt is assembled in layers:

```
[Identity prompt — tier-appropriate]
---
[Current 1 — prompt_content]
[Current 1 — nlp_delivery_notes]
---
[Current 2 — prompt_content]
[Current 2 — nlp_delivery_notes]
---
REFERENCE MATERIAL (from [Name]'s own words):

[Source: Title A]
[chunk text]

---

[Source: Title B]
[chunk text]
```

If the portrait has not yet completed synthesis (`synthesis_status ≠ 'ready'`), the fallback is `portraits.system_prompt` (the creator's manually written prompt) with no currents and RAG context only.

---

## Database tables involved

| Table | Role |
|-------|------|
| `content_sources` | One row per ingested source; tracks status and metadata |
| `knowledge_chunks` | Chunked + embedded text; used for RAG retrieval |
| `sona_transcriptions` | Raw and speaker-segmented transcripts for audio sources |
| `sona_evidence` | Structured psychological evidence extracted from sources |
| `sona_dimensions` | Synthesised dimension scores and narratives |
| `sona_identity_prompts` | Tier-stratified system prompts (4 per portrait) |
| `sona_modules` | Behavioural currents with activation embeddings |
| `sona_synthesis_jobs` | Job log for all async processing stages |
| `audit_log` | Ingest events for each user |

---

## Re-synthesis

Synthesis is re-run automatically whenever 3 or more new evidence extractions complete after the last synthesis. This means the Sona's character model grows richer with each new source added, without any manual intervention.

Synthesis is skipped if:
- Fewer than 4 distinct dimension categories have evidence (insufficient breadth)
- `portraits.synthesis_status = 'synthesising'` (concurrent run guard)
