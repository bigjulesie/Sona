# Sona Knowledge Layer — Design Spec
*2026-03-12*

---

## Overview

This spec covers Phase 2 of the Sona knowledge layer: the system that reads a creator's uploaded content and interviews, builds a deep understanding of who they are, and makes that understanding available — at the right depth, in the right context — to every conversation their Sona has.

The goal is not a knowledge base. It is a mind. A Sona that knows what someone thinks is useful. A Sona that thinks the way they think is something else entirely.

---

## Brand Language

Technical terms used in code map to brand-aligned language in all user-facing surfaces.

| Internal name | User-facing name |
|---|---|
| Synthesis pipeline | — (never surfaced) |
| Dimension synthesis | Character |
| Contextual modules | Currents |
| Dashboard nav item | Mind |
| Synthesise trigger | Deepen |
| synthesis_status: synthesising | Deepening |
| synthesis_status: ready | Up to date |
| Evidence extraction | — (never surfaced) |
| sona_modules | Currents |
| sona_dimensions | Character |
| dimension_category: nlp_patterns | Thinking Style |

---

## Scope

### In this phase

- Audio file ingestion with Deepgram transcription (MP3, M4A, WAV, OGG, MP4)
- Supabase Storage integration for audio files
- Evidence extraction pipeline: per-document LLM analysis producing structured psychological evidence
- Character synthesis: aggregating evidence into a tier-stratified psychometric profile
- Currents generation: deriving contextual behavioural modules from the character profile
- Runtime assembly: composing tier-appropriate identity prompts + relevant currents + RAG chunks at conversation time
- Creator-facing Mind dashboard: read-only transparency into character and currents
- Full NLP framework integration across extraction, synthesis, and delivery

### Explicitly deferred

- WhatsApp automated interview system
- Adaptive interview question generation (targeting low-confidence character dimensions)
- Temporal versioning of the Sona's identity over time
- Reranking of RAG chunks (cross-encoder refinement)
- Chunk deduplication
- In-browser audio recording

---

## Psychometric & NLP Frameworks

The extraction pipeline is anchored to five framework categories. Together they capture not just what a person thinks, but how they think and how they communicate.

### Big Five (OCEAN) — Personality
Openness to experience, Conscientiousness, Extraversion, Agreeableness, Neuroticism. The most scientifically validated personality model. Extracted from patterns across content; not from any single statement.

### Schwartz Values — Core Values
Ten basic human values: self-direction, stimulation, hedonism, achievement, power, security, conformity, tradition, benevolence, universalism. Surfaced through what a person moves toward and away from in their content.

### Communication Dimensions
Directness, warmth, formality, analytical/intuitive balance, use of humour. Extracted from linguistic register across documents and speech.

### Cognitive Patterns
Decision-making style (intuitive / analytical / consultative), risk orientation (seeking / neutral / averse), worldview (optimistic / realistic / sceptical), chunking preference (big-picture / detail-oriented).

### NLP Patterns — Neuro-Linguistic Programming
This is the most distinctive framework in the stack. NLP gives us a precise vocabulary for the *form* of a person's thinking, not just its content. It is the difference between knowing what someone believes and knowing how they experience and communicate it.

**Representational system** — the primary sensory modality through which a person processes experience, detectable from predicate patterns in their language:
- Visual: see, look, clear, bright, picture, perspective
- Auditory: hear, resonate, tone, rhythm, sounds like
- Kinaesthetic: feel, grasp, weight, pressure, get a handle on
- Auditory digital: think, consider, understand, process (abstract/analytical)

**Meta-programs** — habitual filters on attention and decision-making:
- Toward / away-from: motivated by goals or by avoiding problems
- Big-picture / detail-oriented: preferred chunk size
- Internal / external reference: validates from within or seeks external confirmation
- Options / procedures: possibility-seeker or rule-follower
- Proactive / reactive: initiates or responds

**Dilts' Logical Levels** — the level from which a person naturally communicates:
- Environment (context and circumstances)
- Behaviour (what they do)
- Capability (what they can do)
- Beliefs and values (why they do it)
- Identity (who they are)
- Purpose (what they are part of)

A person who speaks primarily from identity ("I am the kind of person who...") is fundamentally different from one who speaks from behaviour or capability. This shapes the Sona's natural register in conversation.

**Language model tendency** — Milton Model (abstract, permissive, metaphorical, hypnotic patterns) vs. Meta Model (precise, specific, direct, challenging). Reveals how the person naturally persuades and reasons.

**Timeline orientation** — in-time (fully present, spontaneous, intense) vs. through-time (sequential, planning-oriented, reflective). Visible in how they discuss past decisions and future goals.

**Belief structures** — generalisations ("people always/never..."), cause-effect assumptions ("X leads to Y"), complex equivalences ("success means..."). Surfaces directly in interviews and long-form writing.

**For audio specifically:** pace, rhythm, pause placement, tonal shifts on emphasis. Prosodic patterns annotated during transcription to calibrate the Sona's response cadence and delivery.

---

## Data Model

### New tables

#### `sona_evidence`
Raw psychological evidence extracted from each content source. One row per piece of evidence.

```
id                uuid pk
portrait_id       uuid fk portraits
source_id         uuid fk content_sources
dimension_category text  -- personality | values | communication | cognitive | nlp_patterns | expertise | beliefs
dimension_key     text  -- e.g. openness, benevolence, primary_rep_system, meta_program_motivation
evidence_text     text  -- the actual quote or paraphrase, verbatim where possible
evidence_type     text  -- direct_quote | stated_belief | behavioural_pattern | inferred
confidence        float -- 0.0–1.0
source_speaker    text  -- populated for diarized audio (subject | interviewer)
created_at        timestamp
UNIQUE(portrait_id, source_id, dimension_key)
```

Indexes: `(portrait_id, dimension_category, dimension_key)` for aggregation; unique constraint on `(portrait_id, source_id, dimension_key)` is the upsert conflict target when a source is re-processed.

#### `sona_dimensions`
Aggregated character profile. One row per dimension per portrait.

```
id                uuid pk
portrait_id       uuid fk portraits
dimension_category text
dimension_key     text
score             float     -- normalised 0–100
confidence        float     -- 0.0–1.0; below 0.5 = LOW_CONFIDENCE
confidence_flag   text      -- null | LOW_CONFIDENCE | AMBIGUOUS
narrative         text      -- 60–80 word human-readable synthesis of this dimension
evidence_count    int
min_tier          access_tier
last_synthesised_at timestamp
created_at        timestamp
updated_at        timestamp
UNIQUE(portrait_id, dimension_category, dimension_key)
```

#### `sona_modules`
Contextual behavioural currents. One row per module per portrait.

```
id                   uuid pk
portrait_id          uuid fk portraits
module_type          text  -- business_strategy | leadership_management | relationships_personal |
                           --   decision_making | personal_philosophy | creative_process |
                           --   learning_growth | communication_influence | emotional_intelligence |
                           --   conflict_resolution | domain_expertise_{label} (auto-discovered)
title                text  -- e.g. "Strategic Thinking"
prompt_content       text  -- the behavioural instruction for Claude
activation_keywords  text[]
activation_embedding vector(1536)  -- for semantic current selection at runtime
nlp_delivery_notes   text  -- NLP-calibrated delivery instructions for this specific current
min_tier             access_tier
confidence           float
superseded_at        timestamp nullable  -- soft delete on re-synthesis
created_at           timestamp
updated_at           timestamp
```

#### `sona_identity_prompts`
Four tier-stratified identity prompts per portrait, regenerated on each synthesis cycle.

```
id             uuid pk
portrait_id    uuid fk portraits
tier           access_tier  -- public | acquaintance | colleague | family
prompt_content text
generated_at   timestamp
UNIQUE(portrait_id, tier)
```

#### `sona_synthesis_jobs`
Job tracking across all pipeline stages.

```
id           uuid pk
portrait_id  uuid fk portraits
job_type     text  -- evidence_extraction | dimension_synthesis | module_generation
status       text  -- pending | running | complete | error
triggered_by text  -- upload | manual | scheduled
source_id    uuid nullable  -- for evidence_extraction jobs
metadata     jsonb
error_msg    text nullable
started_at   timestamp nullable
completed_at timestamp nullable
created_at   timestamp
```

#### `sona_transcriptions`
Audio transcripts linked to content sources.

```
id                uuid pk
source_id         uuid fk content_sources UNIQUE
transcript        text
transcript_with_speakers jsonb  -- diarized output: [{speaker, text, start_ms, end_ms}]
duration_seconds  int
language          text
model             text  -- deepgram-nova-2
created_at        timestamp
```

### Additions to existing tables

**`portraits`**
```
synthesis_status    text  -- never | pending | synthesising | ready | error  DEFAULT 'never'
last_synthesised_at timestamp nullable
```

**`content_sources`**
```
storage_path  text nullable  -- Supabase Storage object path for audio files
source_date   date nullable  -- original content creation date (for archival material recency weighting)
```
`source_type` is a text column (not a DB enum). Adding `interview_audio` requires updating the `VALID_TYPES` validation array in the ingest route and the ContentAddForm dropdown — not a DB migration.

**Supabase Storage** — new bucket: `sona-content`, path convention: `{portrait_id}/{source_id}/{filename}`

---

## Stage 1: Evidence Extraction

### Audio ingestion

Accepted audio types: MP3, M4A, WAV, OGG, MP4. Maximum file size: 200MB.

**Important:** Audio files cannot be uploaded through a Next.js API route — Vercel serverless functions have a ~4.5MB request body limit. Audio is uploaded directly from the client to Supabase Storage using a presigned URL. The API route is only involved in creating the `content_sources` record and triggering the transcription job — it never receives the file bytes.

Flow:
1. Client calls `POST /api/creator/ingest` with metadata only (title, source_type, portrait_id, min_tier) to create the `content_sources` record and receive a presigned Supabase Storage upload URL + `source_id`
2. Client uploads file directly to Supabase Storage using the presigned URL
3. Client calls `POST /api/creator/ingest/confirm` with `source_id` to signal upload complete
4. Server updates `content_sources` with `status: processing`, `storage_path` populated
4. Deepgram pre-recorded REST API called: `POST /listen` with `model=nova-2`, `punctuate=true`, `paragraphs=true`, `diarize=true`
5. Diarization separates subject voice from interviewer voice
6. Full transcript stored in `sona_transcriptions` with per-speaker segments in `transcript_with_speakers`
7. Subject-only transcript text fed into existing chunk → embed → insert pipeline
8. Evidence extraction triggered (see below)
9. `content_sources.status` → `ready`

For audio uploads, the `ContentAddForm` shows a note below the file picker: *"This recording will be transcribed. If multiple voices are present, they will be separated."*

### Evidence extraction

Triggered after a content source reaches `ready` status. Creates a `sona_synthesis_jobs` record (`type: evidence_extraction`). Runs asynchronously via Next.js `after()`.

**Processing:** Content is read in sections of ~4,000 tokens to preserve context without excessive cost. For diarized audio, only the subject's segments (`source_speaker: subject`) are passed to extraction.

**The extraction call:** A structured Claude call with a carefully designed prompt that:
- Provides the full list of dimension categories, keys, and their definitions
- Instructs extraction of specific evidence items (quotes, stated beliefs, observable patterns) — not conclusions
- Asks for JSON output with one object per evidence item
- Includes NLP-specific detection instructions: scan for sensory predicates, toward/away patterns, Dilts level language, belief structures, chunking preference, timeline orientation
- Sets evidence_type rules: verbatim quotes → `direct_quote`, clear belief statements → `stated_belief`, observable patterns → `behavioural_pattern`, implicit patterns → `inferred`

**Evidence weighting inputs (used in Stage 2):**
- Source type multiplier: `interview_audio` ×1.3, structured interview ×1.2, long-form written ×1.0, social media ×0.8
- Evidence type base confidence: direct_quote 1.0, stated_belief 0.9, behavioural_pattern 0.7, inferred 0.4

**Re-processing:** If a source is re-processed, its prior evidence rows are replaced (upsert on `portrait_id + source_id + dimension_key`).

**Concurrency:** Evidence extraction jobs for a portrait are processed sequentially, not in parallel, to manage API costs and avoid race conditions on synthesis triggering.

---

## Stage 2: Character (Dimension Synthesis)

### Triggering

Synthesis fires when:
- Creator clicks **Deepen** in the Mind dashboard
- Automatically, after 3 or more new evidence extractions have completed since the last synthesis run (debounced — waits for all in-progress extractions to complete first)

Minimum threshold: synthesis will not run until evidence exists across at least 4 distinct dimension categories. A single document is not enough to build a credible character.

`portraits.synthesis_status` → `synthesising` at job start.

### Aggregation

For each dimension key, all evidence items are gathered and weighted:

```
weighted_confidence = evidence.confidence
  × evidence_type_weight  (direct_quote: 1.0, stated_belief: 0.9, behavioural_pattern: 0.7, inferred: 0.4)
  × source_type_weight    (interview_audio: 1.3, interview: 1.2, written: 1.0, social: 0.8)
  × recency_weight        (exponential decay based on content_sources.created_at — this year: 1.0, 3 years ago: ~0.7, 5+ years: ~0.5)
                          Note: recency is calculated from upload date, not original content creation date.
                          An optional source_date field (see ContentAddForm) allows creators to specify
                          the original date of older archival material.
```

A Claude call takes the weighted evidence set for each dimension and produces:
- A normalised score (0–100)
- A confidence score (0.0–1.0)
- A confidence flag: `LOW_CONFIDENCE` if confidence < 0.5 or evidence count < 3; `AMBIGUOUS` if evidence items are in genuine tension; null otherwise
- A narrative summary: 60–80 words, describing the dimension as a human quality, not a score

**Contradiction handling:** Ambiguous dimensions are not averaged. The narrative surfaces the tension: "There is a marked difference between how this person writes and how they speak — their written content is highly analytical and Meta-Model precise, while their spoken interviews rely heavily on kinaesthetic predicates and personal narrative. Both registers are authentic."

**Low-confidence dimensions** are flagged in the Mind dashboard with a quiet signal: *"More content in this area would improve accuracy."* These become targets for the future interview system.

### Tier-stratified identity prompts

After dimension synthesis, four identity prompts are generated — one per access tier — and stored in `sona_identity_prompts`. Each is written as a second-person Claude system prompt ("You are...") and differs in depth:

- **Discovery (public):** Surface communication style + public expertise domains. Enough to be a recognisable, coherent presence.
- **Perspective:** Adds Big Five personality traits + core values + primary NLP communication patterns.
- **Wisdom:** Adds cognitive patterns + belief structures + meta-programs + relationship approach. The Sona understands not just what this person thinks but how they developed those views.
- **Legacy:** Full depth — all character dimensions, complete NLP profile, personal philosophy, emotional intelligence patterns. The complete mind.

`portraits.system_prompt` is updated to the Discovery (public) prompt for backwards compatibility. The richer prompts are assembled at conversation time.

`sona_identity_prompts` rows are only written (upserted) after all stages complete successfully — they are not touched at the start of synthesis. This ensures that during an active synthesis run, the previous successful prompts remain available as a fallback.

`portraits.synthesis_status` remains `synthesising` through Stage 3. It only transitions to `ready` (and `last_synthesised_at` is updated) after module generation completes successfully. If Stage 3 fails, status transitions to `error`.

---

## Stage 3: Currents (Module Generation)

Runs immediately after Stage 2 completes. Reads the full character profile and generates the contextual behavioural currents.

### Module discovery

The engine checks each candidate module type against the available evidence and dimensions. A current is only generated if there is sufficient, confident signal in the relevant domains. A sparse current is worse than no current — it risks making the Sona seem to claim expertise it doesn't have grounding for.

Candidate module types:
`business_strategy`, `leadership_management`, `relationships_personal`, `decision_making`, `personal_philosophy`, `creative_process`, `learning_growth`, `communication_influence`, `emotional_intelligence`, `conflict_resolution`

Plus open-ended `domain_expertise_{label}` for specialisms discovered from content (finance, medicine, law, technology, agriculture, art, etc.) — the label is auto-named from the content.

### Module structure

Each current is generated in a dedicated Claude call that receives:
- The character dimensions most relevant to that module type
- The raw evidence most pertinent to that domain
- The full NLP profile

The output is structured JSON:
- `prompt_content` — the behavioural instruction, written as *"When discussing [domain], you approach it this way..."*
- `nlp_delivery_notes` — explicit, person-specific delivery instructions: which predicates to favour, which Dilts level to operate from, motivation direction, chunk size preference, language model tendency

Example `nlp_delivery_notes` for a business current: *"Operate primarily at the identity and capability Dilts levels when discussing strategy. Use kinaesthetic and visual predicates in roughly equal measure. Frame challenges as away-from problems first ('what we need to avoid'), then pivot to toward-goals ('where we're heading'). Start with the big picture before drilling into specifics — this person gets frustrated when detail precedes context. Avoid procedural framing; always present options."*

- `activation_keywords` — array of terms and phrases that suggest this current is relevant
- `activation_embedding` — a 1536-dim embedding of the current's title + keywords + a brief contextual description. Generated at module creation time using the existing `generateEmbedding` utility (OpenAI `text-embedding-3-small`). Must use the same model as the query embedding in Stage 4 — mixing embedding models makes cosine similarity meaningless.

### Versioning

Currents are soft-deleted on re-synthesis (`superseded_at` timestamped, new rows inserted). The history of how a Sona's currents have evolved is preserved.

Stage 3 creates its own `sona_synthesis_jobs` record (`type: module_generation`). This is a distinct job from the Stage 2 `dimension_synthesis` job, allowing independent error tracking and retry. Both jobs are created before their respective stages begin and updated to `complete` or `error` on completion.

---

## Stage 4: Runtime Assembly

Runs on every conversation message. No LLM calls — lookups and string assembly only.

### Assembly sequence

1. **Resolve subscriber tier** — query `subscriptions` for a row matching `(subscriber_id, portrait_id)` with `status = 'active'`. Read `subscriptions.tier` directly. If no active subscription row exists, tier defaults to `public`. This extends the existing boolean `hasActiveSubscription()` check to return the actual tier value.
2. **Load tier-appropriate identity prompt** — direct lookup from `sona_identity_prompts` for this portrait + tier. If `synthesis_status = 'never'` or `'error'`, fall back to `portraits.system_prompt` (current behaviour preserved). If `synthesis_status = 'pending'` or `'synthesising'`, use the last successfully generated `sona_identity_prompts` row if it exists; otherwise fall back.
3. **Select relevant currents** — embed the incoming message (or rolling window of last 2–3 messages for ongoing conversations) using `generateEmbedding` (OpenAI `text-embedding-3-small` — same model used for `activation_embedding` generation). Cosine similarity against `sona_modules.activation_embedding`, filtered to `min_tier <= subscriber_tier` and `superseded_at IS NULL`. Select up to 2 currents above similarity threshold of 0.65. If nothing crosses threshold, no current is forced — identity prompt + RAG only.
4. **Retrieve RAG chunks** — existing pipeline unchanged: HNSW similarity search + RLS tier filtering
5. **Assemble prompt:**

```
[Tier-appropriate identity prompt]
— who this person is, at the depth the subscriber's tier unlocks

[Selected current prompt_content]
— how they engage in this specific context

[NLP delivery notes from selected current]
— precise calibration: predicates, chunk size, Dilts level, meta-programs

---
REFERENCE MATERIAL (from {name}'s own words):
[RAG chunks]
```

### Prompt token budget

| Component | Approximate tokens |
|---|---|
| Identity prompt (Discovery) | ~200 |
| Identity prompt (Legacy) | ~600 |
| Selected currents + NLP notes | ~500–700 |
| RAG chunks (8 × ~375) | ~3,000 |
| Conversation history (20 messages) | ~4,000 |
| **Total** | **~5,000–8,300** |

Well within Claude's context window across all tier levels.

### Group / mastermind context

When multiple Sonas join a conversation (the In the Room feature), each independently runs the full assembly sequence — its own identity prompt, its own current selection, its own RAG retrieval on the shared query. No combined prompt. No inflation. Each Sona arrives in the conversation as a distinct, fully-assembled presence.

The existing `/api/group-sessions/[id]/contribute` route reads `portrait.system_prompt` directly. This route must also be updated to use the Stage 4 assembly sequence (with the same synthesis status fallback logic), so that group sessions benefit from synthesis-powered prompts on the same timeline as single-Sona conversations.

### Synthesis status guard

| `synthesis_status` | Behaviour |
|---|---|
| `never` | Fall back to manual `system_prompt` + RAG |
| `pending` / `synthesising` | Use last successful synthesis if available; else fall back |
| `ready` | Full assembly |
| `error` | Fall back to manual `system_prompt` + RAG |

---

## Creator UI: The Mind Dashboard

### Dashboard nav

New item: **Mind** — added to `DashboardNav` alongside Overview · Content · Pricing · Interview · Settings. Routes to `/dashboard/mind`.

### Synthesis status bar

Top of the Mind page. Shows:
- Current status: *"Your Sona's depth hasn't been built yet"* / *"Deepening…"* / *"Up to date"* / *"Something went wrong — try again"*
- Last deepened timestamp (when status is `ready`)
- **Deepen** button — available when status is `never` or `ready`; shows a calm progress state during synthesis; disabled while deepening

### Character tab

Read-only view of the character profile grouped by dimension category: Personality, Values, Communication Style, Thinking Style, Cognitive Patterns, Expertise.

Each dimension shows:
- Its human label (e.g. "Openness to Experience", "Primary Representational System")
- Narrative summary — not a numerical score. *"You tend to encounter new ideas visually — you build mental pictures before you reason analytically, and your language reflects this consistently across your writing and speech."*
- Tier badge — which tier of subscriber can access this dimension
- `LOW_CONFIDENCE` signal where present: *"More content in this area would improve accuracy"*
- `AMBIGUOUS` signal where present: a brief description of the tension

Creators cannot edit any dimension. They see what has been concluded from their content — honestly, without flattery.

### Currents tab

List of generated currents. Each shows:
- Title and type (e.g. *Strategic Thinking — Business & Strategy*)
- Activation context: *"Conversations about entrepreneurship, commercial decisions, competitive positioning"*
- Tier badge
- Confidence signal where low

Creators cannot edit current content.

### Dashboard overview nudge

On `/dashboard` (overview page), a small status card:
- If `synthesis_status = 'never'`: *"Your Sona's depth hasn't been built yet. Add content and deepen it."* with a quiet link to /dashboard/mind
- If `synthesis_status = 'ready'`: *"Up to date · Last deepened [date]"* — ambient signal, no action required

### Audio upload

`ContentAddForm` extended:
- File picker accepts: MP3, M4A, WAV, OGG, MP4 (in addition to PDF, DOCX, TXT, MD)
- Audio files are uploaded directly to Supabase Storage via presigned URL (client-side); documents continue to go through the API route
- File size limit: 200MB for audio; 10MB for documents
- `source_type` dropdown gains: **Interview (audio)** → maps to `interview_audio`
- Optional **Date** field added (maps to `content_sources.source_date`) — allows creators to specify the original creation date of archival material, enabling accurate recency weighting
- When an audio file is selected: *"This recording will be transcribed. If multiple voices are present, they will be separated."*

---

## New API Routes

| Route | Purpose |
|---|---|
| `POST /api/creator/ingest` | Creates content_sources record; returns presigned Storage URL for audio, or accepts file bytes for documents (≤10MB) |
| `POST /api/creator/ingest/confirm` | Signals audio upload complete; triggers transcription + extraction jobs |
| `POST /api/creator/deepen` | Triggers dimension synthesis + module generation for the creator's portrait |
| `GET /api/creator/mind` | Returns character dimensions + currents for the Mind dashboard |

---

## Architecture Decisions

**Why sequential extraction per portrait, not parallel:** API cost management and synthesis trigger consistency. If 20 documents are uploaded at once, processing them in parallel and triggering synthesis 20 times simultaneously would be expensive and produce inconsistent results. Sequential processing with a debounced synthesis trigger produces one clean synthesis run.

**Why soft-delete currents rather than update in place:** Versioning is implicit — the history of how a Sona's currents have evolved over time is preserved without any additional infrastructure. When the interview automation system is built, this history becomes the basis for tracking how the person's thinking has changed.

**Why pre-generate four identity prompts rather than generate at runtime:** Tier-appropriate identity construction is expensive and would add latency to every conversation. Pre-generation means runtime assembly is fast string concatenation, not an LLM call.

**Why activation_embedding on currents rather than keyword matching:** A subscriber asking "how do you handle a partnership going wrong?" should activate the `relationships_personal` and `conflict_resolution` currents even if the words "relationship" and "conflict" don't appear. Semantic similarity is more robust than keyword matching across the range of natural conversation.

**Why no creator editing of character or currents:** The brand principle is authenticity over curation. Human nature tends toward self-presentation. Allowing creators to edit their own psychometric profile would produce flattering, socially desirable Sonas rather than genuine ones. The value of a Sona to a subscriber is its credibility — a curated Sona is a diminished one.

---

## What This Enables Next

This architecture is designed to make the following future phases straightforward to add:

**Interview automation:** The character dimensions with `LOW_CONFIDENCE` or `AMBIGUOUS` flags are already identified. The interview question generation system reads these and produces targeted questions — NLP-couched to extract maximum insight efficiently.

**Adaptive WhatsApp interviews:** Monthly confirmatory check-ins that re-submit evidence through the extraction pipeline, triggering a re-synthesis that reflects how the person has evolved. The soft-delete versioning of currents tracks that evolution.

**Temporal analysis:** With `last_synthesised_at` timestamps on dimensions and the version history of currents, it becomes possible to show how a Sona's character has shifted over time — a genuinely novel capability for subscribers at the Legacy tier.

---

*Spec status: Approved for implementation planning.*
*Phase: Sona knowledge layer — synthesis engine + audio ingestion.*
