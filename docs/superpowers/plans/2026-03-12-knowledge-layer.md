# Sona Knowledge Layer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Sona synthesis engine — a four-stage pipeline that reads a creator's content and interviews, builds a psychometric character profile (Big Five, Schwartz Values, NLP patterns), generates contextual behavioural currents (the quiver), and assembles tier-gated prompts at conversation time.

**Architecture:** Evidence is extracted per-document by Claude into structured `sona_evidence` rows, then aggregated into `sona_dimensions` (the character profile) and `sona_modules` (the currents). At conversation time, the subscriber's tier selects the right identity prompt depth, semantic similarity selects the most relevant current, and both are combined with RAG chunks into a single assembled prompt. Audio interviews are uploaded directly to Supabase Storage via presigned URL and transcribed via Deepgram's pre-recorded API.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + pgvector + Storage), Anthropic Claude (claude-sonnet-4-6), OpenAI text-embedding-3-small, Deepgram Nova-2, Vitest

**Spec:** `docs/superpowers/specs/2026-03-12-sona-knowledge-layer-design.md`

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `supabase/migrations/00016_knowledge_layer.sql` | All new tables + portrait column additions |
| `src/lib/synthesis/types.ts` | Shared TypeScript types for the synthesis pipeline |
| `src/lib/synthesis/jobs.ts` | Create / update `sona_synthesis_jobs` rows |
| `src/lib/synthesis/evidence-extract.ts` | Stage 1: Claude call extracting evidence from a document section |
| `src/lib/synthesis/character-synthesise.ts` | Stage 2: Aggregate evidence → `sona_dimensions` + identity prompts |
| `src/lib/synthesis/currents-generate.ts` | Stage 3: Generate `sona_modules` with activation embeddings |
| `src/lib/synthesis/assembly.ts` | Stage 4: Compose tier-gated runtime prompt |
| `src/lib/audio/transcribe.ts` | Deepgram pre-recorded REST API transcription |
| `src/app/api/creator/ingest/confirm/route.ts` | Signal audio upload complete → trigger transcription + extraction |
| `src/app/api/creator/deepen/route.ts` | Trigger Stage 2 + 3 for creator's portrait |
| `src/app/api/creator/mind/route.ts` | Return character + currents for Mind dashboard |
| `src/app/(sona)/dashboard/mind/page.tsx` | Mind dashboard server page |
| `src/components/sona/MindDashboard.tsx` | Mind dashboard client component (status bar + tabs) |
| `src/components/sona/MindCharacterTab.tsx` | Read-only character profile view |
| `src/components/sona/MindCurrentsTab.tsx` | Read-only currents list |
| `src/__tests__/synthesis/evidence-extract.test.ts` | Unit tests for evidence extraction |
| `src/__tests__/synthesis/character-synthesise.test.ts` | Unit tests for character aggregation |
| `src/__tests__/synthesis/currents-generate.test.ts` | Unit tests for currents generation |
| `src/__tests__/synthesis/assembly.test.ts` | Unit tests for runtime assembly |
| `src/__tests__/audio/transcribe.test.ts` | Unit tests for Deepgram transcription |

### Modified files
| File | Change |
|---|---|
| `src/app/api/creator/ingest/route.ts` | Detect audio files; return presigned URL instead of processing bytes |
| `src/app/api/chat/route.ts` | Replace manual prompt construction with `assemblePrompt()` from assembly.ts |
| `src/app/api/group-sessions/[id]/contribute/route.ts` | Same: use `assemblePrompt()` |
| `src/components/sona/ContentAddForm.tsx` | Audio upload (presigned URL flow), source_date field, interview_audio type |
| `src/app/(sona)/dashboard/DashboardNav.tsx` | Add Mind nav item |

---

## Chunk 1: Foundation — Migration & Types

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/00016_knowledge_layer.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/00016_knowledge_layer.sql

-- 1. Add columns to portraits
ALTER TABLE portraits
  ADD COLUMN IF NOT EXISTS synthesis_status text NOT NULL DEFAULT 'never'
    CHECK (synthesis_status IN ('never','pending','synthesising','ready','error')),
  ADD COLUMN IF NOT EXISTS last_synthesised_at timestamptz;

-- 2. Add columns to content_sources
ALTER TABLE content_sources
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS source_date date;

-- 3. sona_evidence
CREATE TABLE IF NOT EXISTS sona_evidence (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portrait_id         uuid NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  source_id           uuid NOT NULL REFERENCES content_sources(id) ON DELETE CASCADE,
  dimension_category  text NOT NULL,
  dimension_key       text NOT NULL,
  evidence_text       text NOT NULL,
  evidence_type       text NOT NULL CHECK (evidence_type IN ('direct_quote','stated_belief','behavioural_pattern','inferred')),
  confidence          float NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  source_speaker      text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portrait_id, source_id, dimension_key)
);

CREATE INDEX IF NOT EXISTS idx_sona_evidence_portrait_dim
  ON sona_evidence (portrait_id, dimension_category, dimension_key);

-- 4. sona_dimensions
CREATE TABLE IF NOT EXISTS sona_dimensions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portrait_id          uuid NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  dimension_category   text NOT NULL,
  dimension_key        text NOT NULL,
  score                float CHECK (score >= 0 AND score <= 100),
  confidence           float CHECK (confidence >= 0 AND confidence <= 1),
  confidence_flag      text CHECK (confidence_flag IN ('LOW_CONFIDENCE','AMBIGUOUS') OR confidence_flag IS NULL),
  narrative            text,
  evidence_count       int NOT NULL DEFAULT 0,
  min_tier             access_tier NOT NULL DEFAULT 'public',
  last_synthesised_at  timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portrait_id, dimension_category, dimension_key)
);

CREATE INDEX IF NOT EXISTS idx_sona_dimensions_portrait
  ON sona_dimensions (portrait_id);

-- 5. sona_modules
CREATE TABLE IF NOT EXISTS sona_modules (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portrait_id          uuid NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  module_type          text NOT NULL,
  title                text NOT NULL,
  prompt_content       text NOT NULL,
  activation_keywords  text[] NOT NULL DEFAULT '{}',
  activation_embedding vector(1536),
  nlp_delivery_notes   text,
  min_tier             access_tier NOT NULL DEFAULT 'public',
  confidence           float CHECK (confidence >= 0 AND confidence <= 1),
  superseded_at        timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sona_modules_portrait_active
  ON sona_modules (portrait_id) WHERE superseded_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sona_modules_embedding
  ON sona_modules USING hnsw (activation_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE superseded_at IS NULL;

-- 6. sona_identity_prompts
CREATE TABLE IF NOT EXISTS sona_identity_prompts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portrait_id    uuid NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  tier           access_tier NOT NULL,
  prompt_content text NOT NULL,
  generated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portrait_id, tier)
);

-- 7. sona_synthesis_jobs
CREATE TABLE IF NOT EXISTS sona_synthesis_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portrait_id   uuid NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  job_type      text NOT NULL CHECK (job_type IN ('evidence_extraction','dimension_synthesis','module_generation')),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','complete','error')),
  triggered_by  text NOT NULL DEFAULT 'upload',
  source_id     uuid REFERENCES content_sources(id) ON DELETE SET NULL,
  metadata      jsonb NOT NULL DEFAULT '{}',
  error_msg     text,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sona_synthesis_jobs_portrait
  ON sona_synthesis_jobs (portrait_id, job_type, status);

-- 8. sona_transcriptions
CREATE TABLE IF NOT EXISTS sona_transcriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id                uuid NOT NULL REFERENCES content_sources(id) ON DELETE CASCADE UNIQUE,
  transcript               text NOT NULL,
  transcript_with_speakers jsonb,
  duration_seconds         int,
  language                 text NOT NULL DEFAULT 'en',
  model                    text NOT NULL DEFAULT 'nova-2',
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- 9. RLS — creators can read their own portrait's synthesis data
ALTER TABLE sona_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE sona_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sona_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sona_identity_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sona_synthesis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sona_transcriptions ENABLE ROW LEVEL SECURITY;

-- Creators read via portrait ownership; service role manages all
CREATE POLICY "creators_read_evidence" ON sona_evidence
  FOR SELECT USING (
    portrait_id IN (SELECT id FROM portraits WHERE creator_id = auth.uid())
  );

CREATE POLICY "creators_read_dimensions" ON sona_dimensions
  FOR SELECT USING (
    portrait_id IN (SELECT id FROM portraits WHERE creator_id = auth.uid())
  );

CREATE POLICY "creators_read_modules" ON sona_modules
  FOR SELECT USING (
    portrait_id IN (SELECT id FROM portraits WHERE creator_id = auth.uid())
  );

CREATE POLICY "creators_read_identity_prompts" ON sona_identity_prompts
  FOR SELECT USING (
    portrait_id IN (SELECT id FROM portraits WHERE creator_id = auth.uid())
  );

CREATE POLICY "creators_read_jobs" ON sona_synthesis_jobs
  FOR SELECT USING (
    portrait_id IN (SELECT id FROM portraits WHERE creator_id = auth.uid())
  );

CREATE POLICY "creators_read_transcriptions" ON sona_transcriptions
  FOR SELECT USING (
    source_id IN (
      SELECT cs.id FROM content_sources cs
      JOIN portraits p ON p.id = cs.portrait_id
      WHERE p.creator_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply migration locally**

```bash
npx supabase db push
```
Expected: migration applies without errors. Run `npx supabase db diff` to confirm no pending changes.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00016_knowledge_layer.sql
git commit -m "feat: add knowledge layer database migration"
```

---

### Task 2: Synthesis types

**Files:**
- Create: `src/lib/synthesis/types.ts`

- [ ] **Step 1: Write the types file**

```typescript
// src/lib/synthesis/types.ts
export type DimensionCategory =
  | 'personality'
  | 'values'
  | 'communication'
  | 'cognitive'
  | 'nlp_patterns'
  | 'expertise'
  | 'beliefs'

export type EvidenceType =
  | 'direct_quote'
  | 'stated_belief'
  | 'behavioural_pattern'
  | 'inferred'

export type ConfidenceFlag = 'LOW_CONFIDENCE' | 'AMBIGUOUS' | null

export interface ExtractedEvidence {
  dimension_category: DimensionCategory
  dimension_key: string
  evidence_text: string
  evidence_type: EvidenceType
  confidence: number
}

export interface WeightedEvidence {
  dimension_category: DimensionCategory
  dimension_key: string
  evidence_text: string
  evidence_type: EvidenceType
  raw_confidence: number
  weighted_confidence: number
  source_type: string
  source_date: Date | null
}

export interface SynthesisedDimension {
  dimension_category: DimensionCategory
  dimension_key: string
  score: number
  confidence: number
  confidence_flag: ConfidenceFlag
  narrative: string
  evidence_count: number
}

export interface GeneratedCurrent {
  module_type: string
  title: string
  prompt_content: string
  activation_keywords: string[]
  nlp_delivery_notes: string
  confidence: number
}

export type SynthesisJobType =
  | 'evidence_extraction'
  | 'dimension_synthesis'
  | 'module_generation'

export type SynthesisJobStatus = 'pending' | 'running' | 'complete' | 'error'

// Tier → identity prompt depth
export const TIER_PROMPT_DEPTH: Record<string, string> = {
  public: 'Surface communication style and public expertise domains only.',
  acquaintance: 'Include Big Five personality traits, core values, and primary NLP communication patterns.',
  colleague: 'Include cognitive patterns, belief structures, meta-programs, and relationship approach.',
  family: 'Full depth: all character dimensions, complete NLP profile, personal philosophy, and emotional intelligence patterns.',
}

// Dimension categories → user-facing group labels
export const DIMENSION_CATEGORY_LABELS: Record<DimensionCategory, string> = {
  personality: 'Personality',
  values: 'Values',
  communication: 'Communication Style',
  cognitive: 'Cognitive Patterns',
  nlp_patterns: 'Thinking Style',
  expertise: 'Expertise',
  beliefs: 'Beliefs',
}

// Minimum tier required to access each dimension category
export const DIMENSION_MIN_TIER: Record<DimensionCategory, string> = {
  personality: 'acquaintance',
  values: 'acquaintance',
  communication: 'public',
  cognitive: 'colleague',
  nlp_patterns: 'acquaintance',
  expertise: 'public',
  beliefs: 'colleague',
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/synthesis/types.ts
git commit -m "feat: synthesis pipeline type definitions"
```

---

### Task 3: Job helpers

**Files:**
- Create: `src/lib/synthesis/jobs.ts`
- Create: `src/__tests__/synthesis/jobs.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/synthesis/jobs.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// We test the pure logic functions only — Supabase calls are integration concerns
import { calculateRecencyWeight } from '@/lib/synthesis/jobs'

describe('calculateRecencyWeight', () => {
  it('returns 1.0 for content from this year', () => {
    const thisYear = new Date()
    expect(calculateRecencyWeight(thisYear)).toBeCloseTo(1.0, 1)
  })

  it('returns ~0.7 for content from 3 years ago', () => {
    const threeYearsAgo = new Date()
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3)
    const weight = calculateRecencyWeight(threeYearsAgo)
    expect(weight).toBeGreaterThan(0.6)
    expect(weight).toBeLessThan(0.8)
  })

  it('returns ~0.5 for content from 5+ years ago', () => {
    const fiveYearsAgo = new Date()
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
    const weight = calculateRecencyWeight(fiveYearsAgo)
    expect(weight).toBeGreaterThan(0.4)
    expect(weight).toBeLessThan(0.6)
  })

  it('uses today as fallback when date is null', () => {
    expect(calculateRecencyWeight(null)).toBeCloseTo(1.0, 1)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/__tests__/synthesis/jobs.test.ts
```
Expected: FAIL — `calculateRecencyWeight` not defined.

- [ ] **Step 3: Write jobs.ts**

```typescript
// src/lib/synthesis/jobs.ts
import { createAdminClient } from '@/lib/supabase/admin'
import type { SynthesisJobType, SynthesisJobStatus } from './types'

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
}

export const EVIDENCE_TYPE_WEIGHTS: Record<string, number> = {
  direct_quote: 1.0,
  stated_belief: 0.9,
  behavioural_pattern: 0.7,
  inferred: 0.4,
}

/**
 * Exponential decay recency weight.
 * Half-life ≈ 4 years: weight(0yr) = 1.0, weight(3yr) ≈ 0.70, weight(5yr) ≈ 0.57
 */
export function calculateRecencyWeight(date: Date | null): number {
  const d = date ?? new Date()
  const yearsAgo = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  return Math.exp(-0.085 * yearsAgo)
}

export function getSourceTypeWeight(sourceType: string): number {
  return SOURCE_TYPE_WEIGHTS[sourceType] ?? 0.9
}

export async function createJob(
  portraitId: string,
  jobType: SynthesisJobType,
  triggeredBy: string,
  sourceId?: string,
): Promise<string> {
  const admin = createAdminClient()
  const { data, error } = await (admin as any)
    .from('sona_synthesis_jobs')
    .insert({
      portrait_id: portraitId,
      job_type: jobType,
      status: 'pending',
      triggered_by: triggeredBy,
      source_id: sourceId ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function updateJob(
  jobId: string,
  status: SynthesisJobStatus,
  metadata?: Record<string, unknown>,
  errorMsg?: string,
) {
  const admin = createAdminClient()
  await (admin as any)
    .from('sona_synthesis_jobs')
    .update({
      status,
      metadata: metadata ?? {},
      error_msg: errorMsg ?? null,
      started_at: status === 'running' ? new Date().toISOString() : undefined,
      completed_at: status === 'complete' || status === 'error'
        ? new Date().toISOString()
        : undefined,
    })
    .eq('id', jobId)
}

export async function countRecentExtractions(
  portraitId: string,
  sinceLastSynthesis: Date | null,
): Promise<number> {
  const admin = createAdminClient()
  let query = (admin as any)
    .from('sona_synthesis_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('portrait_id', portraitId)
    .eq('job_type', 'evidence_extraction')
    .eq('status', 'complete')
  if (sinceLastSynthesis) {
    query = query.gt('completed_at', sinceLastSynthesis.toISOString())
  }
  const { count } = await query
  return count ?? 0
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run src/__tests__/synthesis/jobs.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/synthesis/jobs.ts src/__tests__/synthesis/jobs.test.ts
git commit -m "feat: synthesis job helpers with recency weighting"
```

---

## Chunk 2: Audio Pipeline

### Task 4: Deepgram pre-recorded transcription

**Files:**
- Create: `src/lib/audio/transcribe.ts`
- Create: `src/__tests__/audio/transcribe.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/audio/transcribe.test.ts
import { describe, it, expect, vi } from 'vitest'
import { parseDeepgramResponse, extractSubjectTranscript } from '@/lib/audio/transcribe'

const mockDiarizedResponse = {
  results: {
    channels: [{
      alternatives: [{
        transcript: 'Hello world this is speaker one then speaker two',
        words: [
          { word: 'Hello', speaker: 0, start: 0.0, end: 0.3 },
          { word: 'world', speaker: 0, start: 0.4, end: 0.7 },
          { word: 'this', speaker: 1, start: 1.0, end: 1.2 },
          { word: 'is', speaker: 1, start: 1.3, end: 1.4 },
          { word: 'speaker', speaker: 0, start: 2.0, end: 2.3 },
          { word: 'one', speaker: 0, start: 2.4, end: 2.6 },
          { word: 'then', speaker: 0, start: 3.0, end: 3.2 },
          { word: 'speaker', speaker: 1, start: 4.0, end: 4.3 },
          { word: 'two', speaker: 1, start: 4.4, end: 4.6 },
        ],
        paragraphs: {
          paragraphs: [
            { speaker: 0, sentences: [{ text: 'Hello world.' }], start: 0, end: 0.7 },
            { speaker: 1, sentences: [{ text: 'This is.' }], start: 1.0, end: 1.4 },
            { speaker: 0, sentences: [{ text: 'Speaker one then.' }], start: 2.0, end: 3.2 },
            { speaker: 1, sentences: [{ text: 'Speaker two.' }], start: 4.0, end: 4.6 },
          ]
        }
      }]
    }],
    utterances: [
      { speaker: 0, transcript: 'Hello world.', start: 0, end: 0.7 },
      { speaker: 1, transcript: 'This is.', start: 1.0, end: 1.4 },
      { speaker: 0, transcript: 'Speaker one then.', start: 2.0, end: 3.2 },
      { speaker: 1, transcript: 'Speaker two.', start: 4.0, end: 4.6 },
    ]
  },
  metadata: { duration: 5.0 }
}

describe('parseDeepgramResponse', () => {
  it('returns full transcript and speaker segments', () => {
    const result = parseDeepgramResponse(mockDiarizedResponse)
    expect(result.fullTranscript).toContain('Hello world')
    expect(result.speakerSegments).toHaveLength(4)
    expect(result.durationSeconds).toBe(5)
  })

  it('maps speaker numbers to speaker labels', () => {
    const result = parseDeepgramResponse(mockDiarizedResponse)
    expect(result.speakerSegments[0].speaker).toBe('speaker_0')
    expect(result.speakerSegments[1].speaker).toBe('speaker_1')
  })
})

describe('extractSubjectTranscript', () => {
  it('returns text from the speaker with the most words', () => {
    const segments = [
      { speaker: 'speaker_0', text: 'This is a long response from the subject yes indeed', start_ms: 0, end_ms: 5000 },
      { speaker: 'speaker_1', text: 'Short question', start_ms: 5100, end_ms: 6000 },
      { speaker: 'speaker_0', text: 'Another long answer from the same speaker', start_ms: 6100, end_ms: 9000 },
    ]
    const result = extractSubjectTranscript(segments)
    expect(result).toContain('long response')
    expect(result).toContain('Another long answer')
    expect(result).not.toContain('Short question')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/__tests__/audio/transcribe.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Write transcribe.ts**

```typescript
// src/lib/audio/transcribe.ts

export interface SpeakerSegment {
  speaker: string
  text: string
  start_ms: number
  end_ms: number
}

export interface TranscriptionResult {
  fullTranscript: string
  speakerSegments: SpeakerSegment[]
  durationSeconds: number
}

export function parseDeepgramResponse(raw: any): TranscriptionResult {
  const utterances: any[] = raw?.results?.utterances ?? []
  const fullTranscript =
    raw?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
  const durationSeconds = Math.round(raw?.metadata?.duration ?? 0)

  const speakerSegments: SpeakerSegment[] = utterances.map((u: any) => ({
    speaker: `speaker_${u.speaker}`,
    text: u.transcript,
    start_ms: Math.round((u.start ?? 0) * 1000),
    end_ms: Math.round((u.end ?? 0) * 1000),
  }))

  return { fullTranscript, speakerSegments, durationSeconds }
}

/**
 * Identify the "subject" as the speaker with the most total words,
 * and return their combined transcript text.
 */
export function extractSubjectTranscript(segments: SpeakerSegment[]): string {
  const wordCounts: Record<string, number> = {}
  for (const seg of segments) {
    wordCounts[seg.speaker] = (wordCounts[seg.speaker] ?? 0) +
      seg.text.split(/\s+/).filter(Boolean).length
  }
  const subjectSpeaker = Object.entries(wordCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0]
  if (!subjectSpeaker) return ''
  return segments
    .filter(s => s.speaker === subjectSpeaker)
    .map(s => s.text)
    .join('\n\n')
}

/**
 * Transcribe a pre-recorded audio file via Deepgram REST API.
 * Returns the raw Deepgram response (call parseDeepgramResponse to interpret).
 */
export async function transcribeAudio(storageUrl: string): Promise<any> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY not set')

  const response = await fetch(
    'https://api.deepgram.com/v1/listen' +
    '?model=nova-2&punctuate=true&paragraphs=true&diarize=true&utterances=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: storageUrl }),
    }
  )
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Deepgram error ${response.status}: ${text}`)
  }
  return response.json()
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/audio/transcribe.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio/transcribe.ts src/__tests__/audio/transcribe.test.ts
git commit -m "feat: Deepgram pre-recorded audio transcription"
```

---

### Task 5: Extend ingest route for audio + presigned URL flow

**Files:**
- Modify: `src/app/api/creator/ingest/route.ts`
- Create: `src/app/api/creator/ingest/confirm/route.ts`

- [ ] **Step 1: Update VALID_TYPES and add audio detection in ingest/route.ts**

In `src/app/api/creator/ingest/route.ts`, make the following changes:

```typescript
// Add interview_audio to VALID_TYPES
const VALID_TYPES = ['transcript', 'interview', 'article', 'book', 'essay', 'speech', 'letter', 'other', 'interview_audio']

const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav', 'ogg', 'mp4']
const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'video/mp4', 'audio/x-m4a']
const MAX_AUDIO_FILE_SIZE = 200 * 1024 * 1024 // 200MB

function isAudioFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return AUDIO_EXTENSIONS.includes(ext) || AUDIO_MIME_TYPES.includes(file.type)
}
```

Replace the file validation block and the `after()` block with audio-aware branching:

```typescript
  // File validation
  if (file) {
    const isAudio = isAudioFile(file)
    if (isAudio) {
      if (file.size > MAX_AUDIO_FILE_SIZE) {
        return NextResponse.json({ error: 'Audio file too large (max 200 MB)' }, { status: 400 })
      }
    } else {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
      }
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        return NextResponse.json({ error: 'Unsupported file type. Use PDF, DOCX, TXT, or audio file.' }, { status: 400 })
      }
    }
  }

  // ... (portrait ownership check remains unchanged) ...

  // For audio files: return a presigned upload URL; processing happens after client confirms upload
  if (file && isAudioFile(file)) {
    const storagePath = `${portrait_id}/${source.id}/${file.name}`
    const { data: uploadData, error: uploadError } = await admin.storage
      .from('sona-content')
      .createSignedUploadUrl(storagePath)
    if (uploadError || !uploadData) {
      return NextResponse.json({ error: 'Storage error' }, { status: 500 })
    }
    // Store storage_path on the source record
    await (admin as any)
      .from('content_sources')
      .update({ storage_path: storagePath })
      .eq('id', source.id)

    return NextResponse.json({
      ok: true,
      source_id: source.id,
      status: 'awaiting_upload',
      upload_url: uploadData.signedUrl,
      storage_path: storagePath,
    })
  }

  // Non-audio: existing after() flow unchanged
  // ... (existing after() block) ...
```

- [ ] **Step 2: Write the confirm route**

```typescript
// src/app/api/creator/ingest/confirm/route.ts
import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { transcribeAudio, parseDeepgramResponse, extractSubjectTranscript } from '@/lib/audio/transcribe'
import { chunkText } from '@/lib/ingest/chunker'
import { generateEmbeddings } from '@/lib/ingest/embeddings'
import { createJob, updateJob } from '@/lib/synthesis/jobs'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { source_id } = await request.json()
  if (!source_id) return NextResponse.json({ error: 'source_id required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify creator owns this source
  const { data: source } = await (admin as any)
    .from('content_sources')
    .select('id, portrait_id, title, source_type, min_tier, storage_path')
    .eq('id', source_id)
    .single()

  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id')
    .eq('id', source.portrait_id)
    .eq('creator_id', user.id)
    .single()

  if (!portrait) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!source.storage_path) return NextResponse.json({ error: 'No storage path on source' }, { status: 400 })

  const jobId = await createJob(source.portrait_id, 'evidence_extraction', 'upload', source_id)

  after(async () => {
    try {
      await updateJob(jobId, 'running')

      // Get public URL for Deepgram to fetch
      const { data: { publicUrl } } = admin.storage
        .from('sona-content')
        .getPublicUrl(source.storage_path)

      // Transcribe
      const rawResult = await transcribeAudio(publicUrl)
      const parsed = parseDeepgramResponse(rawResult)

      // Store transcript
      await (admin as any).from('sona_transcriptions').upsert({
        source_id,
        transcript: parsed.fullTranscript,
        transcript_with_speakers: parsed.speakerSegments,
        duration_seconds: parsed.durationSeconds,
      })

      // Extract subject-only text for chunking
      const subjectText = parsed.speakerSegments.length > 0
        ? extractSubjectTranscript(parsed.speakerSegments)
        : parsed.fullTranscript

      // Chunk + embed + insert knowledge chunks (same as document flow)
      const chunks = chunkText(subjectText)
      const embeddings = await generateEmbeddings(chunks)
      const rows: any[] = chunks.map((chunk, i) => ({
        portrait_id: source.portrait_id,
        source_id,
        content: chunk,
        embedding: JSON.stringify(embeddings[i]),
        source_title: source.title,
        source_type: source.source_type,
        min_tier: source.min_tier,
        chunk_index: i,
      }))
      await admin.from('knowledge_chunks').insert(rows)

      // Mark source ready
      await (admin as any).from('content_sources')
        .update({ status: 'ready' })
        .eq('id', source_id)

      await updateJob(jobId, 'complete', { chunks_created: chunks.length })

      await admin.from('audit_log').insert({
        user_id: user.id,
        action: 'ingest_audio',
        resource_type: 'content_source',
        resource_id: source_id,
        metadata: { portrait_id: source.portrait_id, chunks_created: chunks.length },
      })

      // Trigger evidence extraction
      const { extractEvidenceForSource } = await import('@/lib/synthesis/evidence-extract')
      await extractEvidenceForSource(source_id, source.portrait_id, 'interview_audio')
    } catch (err) {
      await (admin as any).from('content_sources')
        .update({ status: 'error', error_msg: err instanceof Error ? err.message : 'Failed' })
        .eq('id', source_id)
      await updateJob(jobId, 'error', {}, err instanceof Error ? err.message : 'Failed')
    }
  })

  return NextResponse.json({ ok: true, source_id, status: 'processing' })
}
```

- [ ] **Step 3: Build check**

```bash
npx tsc --noEmit 2>&1 | grep -E "ingest|confirm|audio" | head -20
```
Expected: no errors in the modified files.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/creator/ingest/route.ts src/app/api/creator/ingest/confirm/route.ts
git commit -m "feat: audio ingest with presigned URL and Deepgram transcription"
```

---

## Chunk 3: Evidence Extraction

### Task 6: Evidence extraction from documents

**Files:**
- Create: `src/lib/synthesis/evidence-extract.ts`
- Create: `src/__tests__/synthesis/evidence-extract.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/synthesis/evidence-extract.test.ts
import { describe, it, expect, vi } from 'vitest'
import { parseEvidenceResponse, buildSectionWindows } from '@/lib/synthesis/evidence-extract'

describe('buildSectionWindows', () => {
  it('returns the full text as one window when under 4000 chars', () => {
    const text = 'Short text about something'
    const windows = buildSectionWindows(text)
    expect(windows).toHaveLength(1)
    expect(windows[0]).toBe(text)
  })

  it('splits long text into overlapping windows of ~4000 chars', () => {
    const text = 'word '.repeat(1000) // ~5000 chars
    const windows = buildSectionWindows(text)
    expect(windows.length).toBeGreaterThan(1)
    windows.forEach(w => expect(w.length).toBeLessThanOrEqual(4200))
  })
})

describe('parseEvidenceResponse', () => {
  it('parses valid JSON array of evidence items', () => {
    const raw = JSON.stringify([
      {
        dimension_category: 'personality',
        dimension_key: 'openness',
        evidence_text: 'I love exploring new ideas',
        evidence_type: 'direct_quote',
        confidence: 0.9,
      },
      {
        dimension_category: 'nlp_patterns',
        dimension_key: 'primary_rep_system',
        evidence_text: 'I see the picture clearly',
        evidence_type: 'behavioural_pattern',
        confidence: 0.7,
      },
    ])
    const result = parseEvidenceResponse(raw)
    expect(result).toHaveLength(2)
    expect(result[0].dimension_category).toBe('personality')
    expect(result[1].dimension_key).toBe('primary_rep_system')
  })

  it('handles JSON wrapped in markdown code block', () => {
    const raw = '```json\n[{"dimension_category":"values","dimension_key":"benevolence","evidence_text":"I care deeply","evidence_type":"stated_belief","confidence":0.8}]\n```'
    const result = parseEvidenceResponse(raw)
    expect(result).toHaveLength(1)
    expect(result[0].dimension_key).toBe('benevolence')
  })

  it('returns empty array on unparseable response', () => {
    expect(parseEvidenceResponse('not json')).toEqual([])
  })

  it('filters out items missing required fields', () => {
    const raw = JSON.stringify([
      { dimension_key: 'openness', evidence_text: 'text', evidence_type: 'direct_quote', confidence: 0.9 },
      { dimension_category: 'personality', dimension_key: 'conscientiousness', evidence_text: 'text', evidence_type: 'direct_quote', confidence: 0.8 },
    ])
    const result = parseEvidenceResponse(raw)
    expect(result).toHaveLength(1) // First item missing dimension_category
  })
})
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npx vitest run src/__tests__/synthesis/evidence-extract.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Write evidence-extract.ts**

```typescript
// src/lib/synthesis/evidence-extract.ts
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { createJob, updateJob } from './jobs'
import type { ExtractedEvidence } from './types'

const WINDOW_SIZE = 4000
const WINDOW_OVERLAP = 400

export function buildSectionWindows(text: string): string[] {
  if (text.length <= WINDOW_SIZE) return [text]
  const windows: string[] = []
  let start = 0
  while (start < text.length) {
    windows.push(text.slice(start, start + WINDOW_SIZE))
    start += WINDOW_SIZE - WINDOW_OVERLAP
  }
  return windows
}

export function parseEvidenceResponse(raw: string): ExtractedEvidence[] {
  try {
    // Strip markdown code fence if present
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item: any) =>
      item?.dimension_category &&
      item?.dimension_key &&
      item?.evidence_text &&
      item?.evidence_type &&
      typeof item?.confidence === 'number'
    )
  } catch {
    return []
  }
}

const EXTRACTION_SYSTEM_PROMPT = `You are a precise psychological analyst extracting evidence from a person's content.

For each piece of evidence you find, return a JSON object with exactly these fields:
- dimension_category: one of: personality | values | communication | cognitive | nlp_patterns | expertise | beliefs
- dimension_key: the specific dimension (see reference below)
- evidence_text: verbatim quote or very close paraphrase
- evidence_type: direct_quote | stated_belief | behavioural_pattern | inferred
- confidence: 0.0–1.0 (higher for verbatim quotes, lower for inferred)

DIMENSION REFERENCE:
personality: openness, conscientiousness, extraversion, agreeableness, neuroticism
values: self_direction, stimulation, hedonism, achievement, power, security, conformity, tradition, benevolence, universalism
communication: directness, warmth, formality, analytical_intuitive_balance, use_of_humour
cognitive: decision_making_style, risk_orientation, worldview, chunk_size_preference
nlp_patterns:
  primary_rep_system (visual|auditory|kinaesthetic|auditory_digital — from predicate patterns)
  meta_program_motivation (toward|away_from — does this person move toward goals or away from problems?)
  meta_program_chunk_size (big_picture|detail_oriented)
  meta_program_reference (internal|external — validates internally or seeks external confirmation)
  logical_level_primary (environment|behaviour|capability|beliefs_values|identity|purpose — which Dilts level?)
  language_model_tendency (milton_model|meta_model — abstract/permissive vs precise/direct)
  timeline_orientation (in_time|through_time)
expertise: [auto-identify domain label, e.g. entrepreneurship, medicine, law]
beliefs: [specific belief statements about world, self, or others]

Return ONLY a JSON array. No preamble. No explanation.
Extract only what is clearly present — do not invent or over-infer.`

export async function extractEvidenceFromText(
  text: string,
  sourceType: string,
): Promise<ExtractedEvidence[]> {
  const client = new Anthropic()
  const windows = buildSectionWindows(text)
  const allEvidence: ExtractedEvidence[] = []

  for (const window of windows) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Extract psychological evidence from this content:\n\n${window}`,
      }],
    })
    const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
    allEvidence.push(...parseEvidenceResponse(raw))
  }

  // Deduplicate by (dimension_key, evidence_text) to avoid double-counting overlapping windows
  const seen = new Set<string>()
  return allEvidence.filter(e => {
    const key = `${e.dimension_key}::${e.evidence_text.slice(0, 80)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function extractEvidenceForSource(
  sourceId: string,
  portraitId: string,
  sourceType: string,
) {
  const admin = createAdminClient()
  const jobId = await createJob(portraitId, 'evidence_extraction', 'upload', sourceId)
  await updateJob(jobId, 'running')

  try {
    // Get content text: for audio, use subject-only transcript; for docs, use knowledge_chunks
    let text = ''
    if (sourceType === 'interview_audio') {
      const { data: transcription } = await (admin as any)
        .from('sona_transcriptions')
        .select('transcript')
        .eq('source_id', sourceId)
        .single()
      text = transcription?.transcript ?? ''
    } else {
      const { data: chunks } = await admin
        .from('knowledge_chunks')
        .select('content')
        .eq('source_id' as any, sourceId)
        .order('chunk_index' as any)
      text = chunks?.map((c: any) => c.content).join('\n\n') ?? ''
    }

    if (!text.trim()) {
      await updateJob(jobId, 'complete', { evidence_count: 0, reason: 'no text' })
      return
    }

    const evidence = await extractEvidenceFromText(text, sourceType)

    // Upsert evidence rows (conflict target: portrait_id + source_id + dimension_key)
    if (evidence.length > 0) {
      const rows = evidence.map(e => ({
        portrait_id: portraitId,
        source_id: sourceId,
        dimension_category: e.dimension_category,
        dimension_key: e.dimension_key,
        evidence_text: e.evidence_text,
        evidence_type: e.evidence_type,
        confidence: e.confidence,
      }))
      await (admin as any)
        .from('sona_evidence')
        .upsert(rows, { onConflict: 'portrait_id,source_id,dimension_key' })
    }

    await updateJob(jobId, 'complete', { evidence_count: evidence.length })

    // Check if automatic synthesis should be triggered (≥3 new extractions since last synthesis)
    const { data: portrait } = await (admin as any)
      .from('portraits')
      .select('last_synthesised_at')
      .eq('id', portraitId)
      .single()

    const { countRecentExtractions } = await import('./jobs')
    const recentCount = await countRecentExtractions(
      portraitId,
      portrait?.last_synthesised_at ? new Date(portrait.last_synthesised_at) : null,
    )
    if (recentCount >= 3) {
      const { runFullSynthesis } = await import('./character-synthesise')
      await runFullSynthesis(portraitId, 'upload')
    }
  } catch (err) {
    await updateJob(jobId, 'error', {}, err instanceof Error ? err.message : 'Failed')
  }
}
```

- [ ] **Step 4: Wire extraction trigger into the existing document ingest route**

In `src/app/api/creator/ingest/route.ts`, inside the `after()` block, add after `status: 'ready'` update:

```typescript
      // Trigger evidence extraction for non-audio sources
      const { extractEvidenceForSource } = await import('@/lib/synthesis/evidence-extract')
      await extractEvidenceForSource(source.id, portrait_id, source_type)
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/__tests__/synthesis/evidence-extract.test.ts
```
Expected: PASS (6 tests).

- [ ] **Step 6: Build check**

```bash
npx tsc --noEmit 2>&1 | grep "evidence-extract\|ingest/route" | head -10
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/synthesis/evidence-extract.ts src/__tests__/synthesis/evidence-extract.test.ts src/app/api/creator/ingest/route.ts
git commit -m "feat: per-document evidence extraction pipeline"
```

---

## Chunk 4: Character & Currents Synthesis

### Task 7: Character (dimension) synthesis

**Files:**
- Create: `src/lib/synthesis/character-synthesise.ts`
- Create: `src/__tests__/synthesis/character-synthesise.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/synthesis/character-synthesise.test.ts
import { describe, it, expect } from 'vitest'
import { computeWeightedConfidence, groupEvidenceByDimension } from '@/lib/synthesis/character-synthesise'

describe('computeWeightedConfidence', () => {
  it('weights direct_quote higher than inferred', () => {
    const quoteWeight = computeWeightedConfidence({
      raw_confidence: 0.9,
      evidence_type: 'direct_quote',
      source_type: 'interview',
      source_date: new Date(),
    })
    const inferredWeight = computeWeightedConfidence({
      raw_confidence: 0.9,
      evidence_type: 'inferred',
      source_type: 'interview',
      source_date: new Date(),
    })
    expect(quoteWeight).toBeGreaterThan(inferredWeight)
  })

  it('weights interview_audio source higher than social_media', () => {
    const audioWeight = computeWeightedConfidence({
      raw_confidence: 0.8,
      evidence_type: 'stated_belief',
      source_type: 'interview_audio',
      source_date: new Date(),
    })
    const socialWeight = computeWeightedConfidence({
      raw_confidence: 0.8,
      evidence_type: 'stated_belief',
      source_type: 'social_media',
      source_date: new Date(),
    })
    expect(audioWeight).toBeGreaterThan(socialWeight)
  })
})

describe('groupEvidenceByDimension', () => {
  it('groups evidence rows by dimension_key', () => {
    const rows = [
      { dimension_key: 'openness', dimension_category: 'personality', evidence_text: 'A', evidence_type: 'direct_quote', confidence: 0.9, source_type: 'article', source_date: null },
      { dimension_key: 'openness', dimension_category: 'personality', evidence_text: 'B', evidence_type: 'inferred', confidence: 0.5, source_type: 'article', source_date: null },
      { dimension_key: 'benevolence', dimension_category: 'values', evidence_text: 'C', evidence_type: 'stated_belief', confidence: 0.8, source_type: 'interview', source_date: null },
    ]
    const grouped = groupEvidenceByDimension(rows)
    expect(Object.keys(grouped)).toHaveLength(2)
    expect(grouped['openness']).toHaveLength(2)
    expect(grouped['benevolence']).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run src/__tests__/synthesis/character-synthesise.test.ts
```

- [ ] **Step 3: Write character-synthesise.ts**

```typescript
// src/lib/synthesis/character-synthesise.ts
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { createJob, updateJob, calculateRecencyWeight, getSourceTypeWeight, EVIDENCE_TYPE_WEIGHTS } from './jobs'
import type { SynthesisedDimension, ConfidenceFlag } from './types'
import { TIER_PROMPT_DEPTH, DIMENSION_MIN_TIER } from './types'

interface EvidenceRow {
  dimension_key: string
  dimension_category: string
  evidence_text: string
  evidence_type: string
  confidence: number
  source_type: string
  source_date: string | null
}

interface WeightInput {
  raw_confidence: number
  evidence_type: string
  source_type: string
  source_date: Date | null
}

export function computeWeightedConfidence(input: WeightInput): number {
  const typeWeight = EVIDENCE_TYPE_WEIGHTS[input.evidence_type] ?? 0.5
  const sourceWeight = getSourceTypeWeight(input.source_type)
  const recencyWeight = calculateRecencyWeight(input.source_date)
  return input.raw_confidence * typeWeight * sourceWeight * recencyWeight
}

export function groupEvidenceByDimension(
  rows: EvidenceRow[],
): Record<string, EvidenceRow[]> {
  const grouped: Record<string, EvidenceRow[]> = {}
  for (const row of rows) {
    if (!grouped[row.dimension_key]) grouped[row.dimension_key] = []
    grouped[row.dimension_key].push(row)
  }
  return grouped
}

function computeConfidenceFlag(
  confidence: number,
  evidenceCount: number,
  isAmbiguous: boolean,
): ConfidenceFlag {
  if (isAmbiguous) return 'AMBIGUOUS'
  if (confidence < 0.5 || evidenceCount < 3) return 'LOW_CONFIDENCE'
  return null
}

async function synthesiseDimension(
  dimensionKey: string,
  category: string,
  evidenceRows: EvidenceRow[],
): Promise<SynthesisedDimension> {
  const client = new Anthropic()
  const weightedItems = evidenceRows.map(e => ({
    ...e,
    weighted: computeWeightedConfidence({
      raw_confidence: e.confidence,
      evidence_type: e.evidence_type,
      source_type: e.source_type,
      source_date: e.source_date ? new Date(e.source_date) : null,
    }),
  }))

  const totalWeight = weightedItems.reduce((s, e) => s + e.weighted, 0)
  const avgConfidence = totalWeight / weightedItems.length
  const evidenceText = weightedItems
    .sort((a, b) => b.weighted - a.weighted)
    .map(e => `[${e.evidence_type}, confidence ${e.weighted.toFixed(2)}]: "${e.evidence_text}"`)
    .join('\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Synthesise the following evidence about a person's ${category} dimension "${dimensionKey}".

Evidence items (weighted by source quality and recency):
${evidenceText}

Return a JSON object with:
- score: normalised 0–100 (where 100 = extremely high on this dimension)
- narrative: 60–80 words describing this dimension as a human quality — not a score, a person
- is_ambiguous: true if the evidence items are in genuine tension with each other

Return ONLY valid JSON. No preamble.`,
    }],
  })

  let parsed: any = {}
  try {
    const raw = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
    parsed = JSON.parse(raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, ''))
  } catch { /* use defaults */ }

  return {
    dimension_category: category as any,
    dimension_key: dimensionKey,
    score: Math.max(0, Math.min(100, parsed.score ?? 50)),
    confidence: Math.min(1, avgConfidence),
    confidence_flag: computeConfidenceFlag(avgConfidence, evidenceRows.length, !!parsed.is_ambiguous),
    narrative: parsed.narrative ?? '',
    evidence_count: evidenceRows.length,
  }
}

async function generateIdentityPrompts(
  portraitId: string,
  dimensions: SynthesisedDimension[],
  displayName: string,
): Promise<Record<string, string>> {
  const client = new Anthropic()
  const tiers = ['public', 'acquaintance', 'colleague', 'family']
  const prompts: Record<string, string> = {}

  const dimensionSummary = dimensions
    .filter(d => d.narrative)
    .map(d => `${d.dimension_category}/${d.dimension_key}: ${d.narrative}`)
    .join('\n')

  for (const tier of tiers) {
    const depth = TIER_PROMPT_DEPTH[tier]
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Write a Claude system prompt for a Sona — an AI persona representing ${displayName}.

The prompt should be second-person ("You are ${displayName}...") and ${depth}

Character profile (use what is relevant to the tier depth above):
${dimensionSummary}

Write a cohesive, natural identity prompt. Do not list dimensions mechanically — describe the person. No preamble or explanation, just the system prompt text.`,
      }],
    })
    prompts[tier] = response.content[0]?.type === 'text' ? response.content[0].text : ''
  }

  return prompts
}

export async function runFullSynthesis(portraitId: string, triggeredBy: string) {
  const admin = createAdminClient()

  // Check minimum evidence threshold
  const { data: evidenceCheck } = await (admin as any)
    .from('sona_evidence')
    .select('dimension_category')
    .eq('portrait_id', portraitId)

  const uniqueCategories = new Set((evidenceCheck ?? []).map((e: any) => e.dimension_category))
  if (uniqueCategories.size < 4) return // Not enough breadth yet

  // Mark portrait as synthesising
  await (admin as any).from('portraits')
    .update({ synthesis_status: 'synthesising' })
    .eq('id', portraitId)

  const jobId = await createJob(portraitId, 'dimension_synthesis', triggeredBy)
  await updateJob(jobId, 'running')

  try {
    // Load all evidence with source metadata
    const { data: allEvidence } = await (admin as any)
      .from('sona_evidence')
      .select(`
        dimension_key, dimension_category, evidence_text, evidence_type, confidence,
        content_sources!inner(source_type, source_date)
      `)
      .eq('portrait_id', portraitId)

    const rows: EvidenceRow[] = (allEvidence ?? []).map((e: any) => ({
      dimension_key: e.dimension_key,
      dimension_category: e.dimension_category,
      evidence_text: e.evidence_text,
      evidence_type: e.evidence_type,
      confidence: e.confidence,
      source_type: e.content_sources?.source_type ?? 'other',
      source_date: e.content_sources?.source_date ?? null,
    }))

    const grouped = groupEvidenceByDimension(rows)
    const dimensions: SynthesisedDimension[] = []

    for (const [dimKey, dimRows] of Object.entries(grouped)) {
      const category = dimRows[0].dimension_category
      const dim = await synthesiseDimension(dimKey, category, dimRows)
      dimensions.push(dim)
    }

    // Upsert dimensions
    const dimRows = dimensions.map(d => ({
      portrait_id: portraitId,
      dimension_category: d.dimension_category,
      dimension_key: d.dimension_key,
      score: d.score,
      confidence: d.confidence,
      confidence_flag: d.confidence_flag,
      narrative: d.narrative,
      evidence_count: d.evidence_count,
      min_tier: DIMENSION_MIN_TIER[d.dimension_category] ?? 'public',
      last_synthesised_at: new Date().toISOString(),
    }))
    await (admin as any).from('sona_dimensions')
      .upsert(dimRows, { onConflict: 'portrait_id,dimension_category,dimension_key' })

    // Generate tier-stratified identity prompts
    const { data: portrait } = await (admin as any)
      .from('portraits')
      .select('display_name')
      .eq('id', portraitId)
      .single()

    const prompts = await generateIdentityPrompts(portraitId, dimensions, portrait?.display_name ?? 'this person')

    // Upsert identity prompts (written only on success)
    for (const [tier, content] of Object.entries(prompts)) {
      await (admin as any).from('sona_identity_prompts')
        .upsert({ portrait_id: portraitId, tier, prompt_content: content, generated_at: new Date().toISOString() },
          { onConflict: 'portrait_id,tier' })
    }

    // Update portraits.system_prompt with public tier for backwards compat
    await (admin as any).from('portraits')
      .update({ system_prompt: prompts['public'] ?? '' })
      .eq('id', portraitId)

    await updateJob(jobId, 'complete', { dimensions_synthesised: dimensions.length })

    // Immediately run currents generation (Stage 3)
    const { generateCurrents } = await import('./currents-generate')
    await generateCurrents(portraitId, triggeredBy)
  } catch (err) {
    await (admin as any).from('portraits')
      .update({ synthesis_status: 'error' })
      .eq('id', portraitId)
    await updateJob(jobId, 'error', {}, err instanceof Error ? err.message : 'Failed')
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/synthesis/character-synthesise.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/synthesis/character-synthesise.ts src/__tests__/synthesis/character-synthesise.test.ts
git commit -m "feat: character dimension synthesis with tier-stratified identity prompts"
```

---

### Task 8: Currents generation

**Files:**
- Create: `src/lib/synthesis/currents-generate.ts`
- Create: `src/__tests__/synthesis/currents-generate.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/synthesis/currents-generate.test.ts
import { describe, it, expect } from 'vitest'
import { identifyRelevantModuleTypes, CANDIDATE_MODULE_TYPES } from '@/lib/synthesis/currents-generate'

describe('identifyRelevantModuleTypes', () => {
  it('returns module types where sufficient evidence exists in relevant dimensions', () => {
    const dimensions = [
      { dimension_key: 'achievement', dimension_category: 'values', confidence: 0.8, evidence_count: 5 },
      { dimension_key: 'risk_orientation', dimension_category: 'cognitive', confidence: 0.7, evidence_count: 4 },
      { dimension_key: 'conscientiousness', dimension_category: 'personality', confidence: 0.9, evidence_count: 6 },
    ]
    const types = identifyRelevantModuleTypes(dimensions)
    expect(types).toContain('business_strategy')
    expect(types).toContain('decision_making')
  })

  it('excludes module types where evidence is insufficient', () => {
    const dimensions = [
      { dimension_key: 'benevolence', dimension_category: 'values', confidence: 0.3, evidence_count: 1 },
    ]
    const types = identifyRelevantModuleTypes(dimensions)
    // Low confidence + low count should not qualify
    expect(types.length).toBe(0)
  })

  it('CANDIDATE_MODULE_TYPES contains core types', () => {
    expect(CANDIDATE_MODULE_TYPES).toContain('business_strategy')
    expect(CANDIDATE_MODULE_TYPES).toContain('personal_philosophy')
    expect(CANDIDATE_MODULE_TYPES).toContain('decision_making')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run src/__tests__/synthesis/currents-generate.test.ts
```

- [ ] **Step 3: Write currents-generate.ts**

```typescript
// src/lib/synthesis/currents-generate.ts
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateEmbedding } from '@/lib/ingest/embeddings'
import { createJob, updateJob } from './jobs'
import type { GeneratedCurrent } from './types'

export const CANDIDATE_MODULE_TYPES = [
  'business_strategy',
  'leadership_management',
  'relationships_personal',
  'decision_making',
  'personal_philosophy',
  'creative_process',
  'learning_growth',
  'communication_influence',
  'emotional_intelligence',
  'conflict_resolution',
] as const

// Which dimension keys signal relevance for each module type
const MODULE_DIMENSION_SIGNALS: Record<string, string[]> = {
  business_strategy: ['achievement', 'risk_orientation', 'conscientiousness', 'self_direction'],
  leadership_management: ['achievement', 'power', 'extraversion', 'conscientiousness'],
  relationships_personal: ['agreeableness', 'benevolence', 'warmth', 'meta_program_reference'],
  decision_making: ['risk_orientation', 'decision_making_style', 'logical_level_primary', 'meta_program_motivation'],
  personal_philosophy: ['universalism', 'self_direction', 'tradition', 'worldview'],
  creative_process: ['openness', 'stimulation', 'chunk_size_preference'],
  learning_growth: ['openness', 'self_direction', 'conscientiousness'],
  communication_influence: ['directness', 'warmth', 'language_model_tendency', 'primary_rep_system'],
  emotional_intelligence: ['agreeableness', 'neuroticism', 'warmth', 'meta_program_reference'],
  conflict_resolution: ['agreeableness', 'directness', 'meta_program_motivation'],
}

interface DimensionSummary {
  dimension_key: string
  dimension_category: string
  confidence: number
  evidence_count: number
  narrative?: string
}

export function identifyRelevantModuleTypes(dimensions: DimensionSummary[]): string[] {
  const qualifiedKeys = new Set(
    dimensions
      .filter(d => d.confidence >= 0.5 && d.evidence_count >= 3)
      .map(d => d.dimension_key)
  )

  return CANDIDATE_MODULE_TYPES.filter(moduleType => {
    const signals = MODULE_DIMENSION_SIGNALS[moduleType] ?? []
    const matchCount = signals.filter(s => qualifiedKeys.has(s)).length
    return matchCount >= 2 // Need at least 2 qualified signals
  })
}

async function generateCurrent(
  moduleType: string,
  displayName: string,
  dimensions: DimensionSummary[],
  nlpProfile: DimensionSummary[],
): Promise<GeneratedCurrent | null> {
  const client = new Anthropic()
  const signals = MODULE_DIMENSION_SIGNALS[moduleType] ?? []
  const relevantDims = dimensions.filter(d => signals.includes(d.dimension_key))
  const dimSummary = relevantDims
    .filter(d => d.narrative)
    .map(d => `${d.dimension_key}: ${d.narrative}`)
    .join('\n')

  const nlpSummary = nlpProfile
    .filter(d => d.narrative)
    .map(d => `${d.dimension_key}: ${d.narrative}`)
    .join('\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Create a contextual behavioural current (a focused system prompt module) for ${displayName}'s Sona in the domain: ${moduleType.replace(/_/g, ' ')}.

Relevant character dimensions:
${dimSummary}

NLP communication profile:
${nlpSummary}

Return a JSON object with:
- title: short human-readable name (e.g. "Strategic Thinking")
- prompt_content: the behavioural instruction for Claude (second person, "When discussing [domain], you approach it this way..."). 150–250 words.
- activation_keywords: array of 8–12 terms/phrases that indicate this current is relevant
- nlp_delivery_notes: precise NLP-calibrated delivery instructions — which predicates to use, Dilts level, motivation direction, chunk size, language model tendency. 60–80 words.
- confidence: 0.0–1.0 based on strength of available evidence

If there is insufficient evidence to generate a credible current, return null.

Return ONLY valid JSON. No preamble.`,
    }],
  })

  try {
    const raw = response.content[0]?.type === 'text' ? response.content[0].text : 'null'
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(cleaned)
    if (!parsed || !parsed.prompt_content) return null
    return {
      module_type: moduleType,
      title: parsed.title ?? moduleType,
      prompt_content: parsed.prompt_content,
      activation_keywords: parsed.activation_keywords ?? [],
      nlp_delivery_notes: parsed.nlp_delivery_notes ?? '',
      confidence: parsed.confidence ?? 0.5,
    }
  } catch {
    return null
  }
}

export async function generateCurrents(portraitId: string, triggeredBy: string) {
  const admin = createAdminClient()
  const jobId = await createJob(portraitId, 'module_generation', triggeredBy)
  await updateJob(jobId, 'running')

  try {
    const { data: portrait } = await (admin as any)
      .from('portraits')
      .select('display_name')
      .eq('id', portraitId)
      .single()

    const { data: allDimensions } = await (admin as any)
      .from('sona_dimensions')
      .select('dimension_key, dimension_category, confidence, evidence_count, narrative')
      .eq('portrait_id', portraitId)

    const dimensions: DimensionSummary[] = allDimensions ?? []
    const nlpProfile = dimensions.filter(d => d.dimension_category === 'nlp_patterns')
    const moduleTypes = identifyRelevantModuleTypes(dimensions)

    // Soft-delete existing active currents
    await (admin as any).from('sona_modules')
      .update({ superseded_at: new Date().toISOString() })
      .eq('portrait_id', portraitId)
      .is('superseded_at', null)

    let generatedCount = 0
    for (const moduleType of moduleTypes) {
      const current = await generateCurrent(
        moduleType,
        portrait?.display_name ?? 'this person',
        dimensions,
        nlpProfile,
      )
      if (!current) continue

      // Generate activation embedding
      const embeddingText = `${current.title} ${current.activation_keywords.join(' ')} ${moduleType.replace(/_/g, ' ')}`
      const embedding = await generateEmbedding(embeddingText)

      await (admin as any).from('sona_modules').insert({
        portrait_id: portraitId,
        module_type: current.module_type,
        title: current.title,
        prompt_content: current.prompt_content,
        activation_keywords: current.activation_keywords,
        activation_embedding: JSON.stringify(embedding),
        nlp_delivery_notes: current.nlp_delivery_notes,
        min_tier: 'public', // Individual modules can be elevated in future
        confidence: current.confidence,
      })
      generatedCount++
    }

    // Synthesis complete — only now update status to 'ready'
    await (admin as any).from('portraits').update({
      synthesis_status: 'ready',
      last_synthesised_at: new Date().toISOString(),
    }).eq('id', portraitId)

    await updateJob(jobId, 'complete', { currents_generated: generatedCount })
  } catch (err) {
    await (admin as any).from('portraits')
      .update({ synthesis_status: 'error' })
      .eq('id', portraitId)
    await updateJob(jobId, 'error', {}, err instanceof Error ? err.message : 'Failed')
  }
}
```

- [ ] **Step 4: Add `generateEmbedding` (singular) export to embeddings.ts**

Check `src/lib/ingest/embeddings.ts` — if it only exports `generateEmbeddings` (plural), add:

```typescript
export async function generateEmbedding(text: string): Promise<number[]> {
  const results = await generateEmbeddings([text])
  return results[0]
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/__tests__/synthesis/currents-generate.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/synthesis/currents-generate.ts src/lib/ingest/embeddings.ts src/__tests__/synthesis/currents-generate.test.ts
git commit -m "feat: currents generation with activation embeddings"
```

---

## Chunk 5: Runtime Assembly & Deepen Route

### Task 9: Runtime prompt assembly

**Files:**
- Create: `src/lib/synthesis/assembly.ts`
- Create: `src/__tests__/synthesis/assembly.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/synthesis/assembly.test.ts
import { describe, it, expect } from 'vitest'
import { resolveSubscriberTier, buildAssembledPrompt } from '@/lib/synthesis/assembly'

describe('resolveSubscriberTier', () => {
  it('returns public when no subscription', () => {
    expect(resolveSubscriberTier(null)).toBe('public')
  })

  it('returns the tier from an active subscription', () => {
    expect(resolveSubscriberTier({ tier: 'colleague', status: 'active' })).toBe('colleague')
  })

  it('returns public for non-active subscription', () => {
    expect(resolveSubscriberTier({ tier: 'acquaintance', status: 'cancelled' })).toBe('public')
  })
})

describe('buildAssembledPrompt', () => {
  it('includes identity prompt and RAG chunks', () => {
    const prompt = buildAssembledPrompt({
      identityPrompt: 'You are Jane.',
      selectedCurrents: [],
      ragContext: 'Some knowledge here.',
      displayName: 'Jane',
    })
    expect(prompt).toContain('You are Jane.')
    expect(prompt).toContain('Some knowledge here.')
  })

  it('includes current prompt_content and NLP notes when current is provided', () => {
    const prompt = buildAssembledPrompt({
      identityPrompt: 'You are Jane.',
      selectedCurrents: [{
        prompt_content: 'When discussing strategy, you think boldly.',
        nlp_delivery_notes: 'Use visual predicates.',
      }],
      ragContext: 'Knowledge.',
      displayName: 'Jane',
    })
    expect(prompt).toContain('When discussing strategy')
    expect(prompt).toContain('Use visual predicates.')
  })

  it('does not include current section when no currents selected', () => {
    const prompt = buildAssembledPrompt({
      identityPrompt: 'You are Jane.',
      selectedCurrents: [],
      ragContext: '',
      displayName: 'Jane',
    })
    expect(prompt).not.toContain('undefined')
    expect(prompt).not.toContain('null')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run src/__tests__/synthesis/assembly.test.ts
```

- [ ] **Step 3: Write assembly.ts**

```typescript
// src/lib/synthesis/assembly.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateEmbedding } from '@/lib/ingest/embeddings'

export type AccessTier = 'public' | 'acquaintance' | 'colleague' | 'family'

const TIER_ORDER: Record<AccessTier, number> = {
  public: 0,
  acquaintance: 1,
  colleague: 2,
  family: 3,
}

interface SubscriptionRow {
  tier: string
  status: string
}

export function resolveSubscriberTier(
  subscription: SubscriptionRow | null,
): AccessTier {
  if (!subscription || subscription.status !== 'active') return 'public'
  return (subscription.tier as AccessTier) ?? 'public'
}

interface CurrentSnippet {
  prompt_content: string
  nlp_delivery_notes: string | null
}

interface AssemblyInput {
  identityPrompt: string
  selectedCurrents: CurrentSnippet[]
  ragContext: string
  displayName: string
}

export function buildAssembledPrompt(input: AssemblyInput): string {
  const parts: string[] = [input.identityPrompt.trim()]

  for (const current of input.selectedCurrents) {
    parts.push('---')
    parts.push(current.prompt_content.trim())
    if (current.nlp_delivery_notes?.trim()) {
      parts.push(current.nlp_delivery_notes.trim())
    }
  }

  if (input.ragContext.trim()) {
    parts.push('---')
    parts.push(`REFERENCE MATERIAL (from ${input.displayName}'s own words):\n\n${input.ragContext.trim()}`)
  }

  return parts.join('\n\n')
}

const CURRENT_SIMILARITY_THRESHOLD = 0.65

export async function assemblePrompt(
  supabase: SupabaseClient,
  portraitId: string,
  subscriberId: string,
  message: string,
  ragChunks: Array<{ content: string; source_title: string }>,
): Promise<string> {
  const admin = supabase // In practice, use admin client for synthesis tables

  // 1. Resolve subscriber tier
  const { data: subscription } = await (admin as any)
    .from('subscriptions')
    .select('tier, status')
    .eq('subscriber_id', subscriberId)
    .eq('portrait_id', portraitId)
    .eq('status', 'active')
    .maybeSingle()

  const tier = resolveSubscriberTier(subscription)
  const tierLevel = TIER_ORDER[tier]

  // 2. Load portrait synthesis status + display name
  const { data: portrait } = await (admin as any)
    .from('portraits')
    .select('synthesis_status, display_name, system_prompt')
    .eq('id', portraitId)
    .single()

  const usesSynthesis = portrait?.synthesis_status === 'ready'

  // 3. Load identity prompt
  let identityPrompt = portrait?.system_prompt ?? ''
  if (usesSynthesis) {
    const { data: identityRow } = await (admin as any)
      .from('sona_identity_prompts')
      .select('prompt_content')
      .eq('portrait_id', portraitId)
      .eq('tier', tier)
      .maybeSingle()
    if (identityRow?.prompt_content) identityPrompt = identityRow.prompt_content
  }

  // 4. Select relevant currents via semantic similarity
  const selectedCurrents: CurrentSnippet[] = []
  if (usesSynthesis && message.trim()) {
    const queryEmbedding = await generateEmbedding(message)

    const { data: currents } = await (admin as any).rpc('match_sona_modules', {
      query_embedding: JSON.stringify(queryEmbedding),
      portrait_id: portraitId,
      tier_level: tierLevel,
      match_count: 2,
      similarity_threshold: CURRENT_SIMILARITY_THRESHOLD,
    })

    if (currents?.length) {
      selectedCurrents.push(...currents.map((c: any) => ({
        prompt_content: c.prompt_content,
        nlp_delivery_notes: c.nlp_delivery_notes,
      })))
    }
  }

  // 5. Format RAG context
  const ragContext = ragChunks
    .map(c => `[Source: ${c.source_title}]\n${c.content}`)
    .join('\n\n---\n\n')

  return buildAssembledPrompt({
    identityPrompt,
    selectedCurrents,
    ragContext,
    displayName: portrait?.display_name ?? 'this person',
  })
}
```

- [ ] **Step 4: Add match_sona_modules RPC to migration**

Add to `supabase/migrations/00016_knowledge_layer.sql`:

```sql
-- RPC for semantic current selection
CREATE OR REPLACE FUNCTION match_sona_modules(
  query_embedding vector(1536),
  portrait_id uuid,
  tier_level int,
  match_count int DEFAULT 2,
  similarity_threshold float DEFAULT 0.65
)
RETURNS TABLE (
  id uuid,
  module_type text,
  title text,
  prompt_content text,
  nlp_delivery_notes text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.id,
    sm.module_type,
    sm.title,
    sm.prompt_content,
    sm.nlp_delivery_notes,
    1 - (sm.activation_embedding <=> query_embedding) AS similarity
  FROM sona_modules sm
  WHERE
    sm.portrait_id = match_sona_modules.portrait_id
    AND sm.superseded_at IS NULL
    AND CASE sm.min_tier
      WHEN 'public' THEN 0
      WHEN 'acquaintance' THEN 1
      WHEN 'colleague' THEN 2
      WHEN 'family' THEN 3
    END <= match_sona_modules.tier_level
    AND 1 - (sm.activation_embedding <=> query_embedding) >= similarity_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

- [ ] **Step 5: Apply updated migration**

```bash
npx supabase db push
```

- [ ] **Step 6: Run assembly tests**

```bash
npx vitest run src/__tests__/synthesis/assembly.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 7: Update /api/chat to use assemblePrompt**

In `src/app/api/chat/route.ts`, replace the existing prompt construction with:

```typescript
import { assemblePrompt } from '@/lib/synthesis/assembly'

// Replace existing system prompt construction:
// const systemPrompt = [portrait.system_prompt, contextSection].filter(Boolean).join('\n\n---\n\nREFERENCE MATERIAL...')
// With:
const systemPrompt = await assemblePrompt(supabase, portrait_id, user.id, message, chunks)
```

- [ ] **Step 8: Update /api/group-sessions/[id]/contribute to use assemblePrompt**

In `src/app/api/group-sessions/[id]/contribute/route.ts`, replace:
```typescript
// Existing: uses portrait.system_prompt directly
const systemPrompt = `${portrait.system_prompt}\n\n---\n\nREFERENCE MATERIAL...`
// Replace with:
const { assemblePrompt } = await import('@/lib/synthesis/assembly')
const systemPrompt = await assemblePrompt(supabase, session.portrait_id, user.id, transcript, chunks)
```

- [ ] **Step 9: Build check**

```bash
npx tsc --noEmit 2>&1 | grep -E "assembly|chat/route|contribute" | head -20
```

- [ ] **Step 10: Write and wire deepen route**

```typescript
// src/app/api/creator/deepen/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runFullSynthesis } from '@/lib/synthesis/character-synthesise'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: portrait } = await (admin as any)
    .from('portraits')
    .select('id, synthesis_status')
    .eq('creator_id', user.id)
    .single()

  if (!portrait) return NextResponse.json({ error: 'No portrait found' }, { status: 404 })
  if (portrait.synthesis_status === 'synthesising') {
    return NextResponse.json({ error: 'Already deepening' }, { status: 409 })
  }

  // Fire and forget — client polls synthesis_status
  runFullSynthesis(portrait.id, 'manual').catch(console.error)

  return NextResponse.json({ ok: true, status: 'synthesising' })
}
```

- [ ] **Step 11: Commit**

```bash
git add src/lib/synthesis/assembly.ts src/__tests__/synthesis/assembly.test.ts src/app/api/creator/deepen/route.ts src/app/api/chat/route.ts src/app/api/group-sessions/[id]/contribute/route.ts supabase/migrations/00016_knowledge_layer.sql
git commit -m "feat: runtime assembly, deepen route, update chat and group-sessions"
```

---

## Chunk 6: Mind Dashboard UI

### Task 10: Mind API route

**Files:**
- Create: `src/app/api/creator/mind/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/creator/mind/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DIMENSION_CATEGORY_LABELS } from '@/lib/synthesis/types'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: portrait } = await (admin as any)
    .from('portraits')
    .select('id, synthesis_status, last_synthesised_at')
    .eq('creator_id', user.id)
    .single()

  if (!portrait) return NextResponse.json({ error: 'No portrait' }, { status: 404 })

  const [{ data: dimensions }, { data: currents }] = await Promise.all([
    (admin as any).from('sona_dimensions')
      .select('dimension_category, dimension_key, narrative, confidence, confidence_flag, min_tier, evidence_count')
      .eq('portrait_id', portrait.id)
      .order('dimension_category'),
    (admin as any).from('sona_modules')
      .select('module_type, title, activation_keywords, min_tier, confidence')
      .eq('portrait_id', portrait.id)
      .is('superseded_at', null)
      .order('module_type'),
  ])

  // Group dimensions by category with user-facing labels
  const grouped: Record<string, any[]> = {}
  for (const dim of dimensions ?? []) {
    const label = DIMENSION_CATEGORY_LABELS[dim.dimension_category as any] ?? dim.dimension_category
    if (!grouped[label]) grouped[label] = []
    grouped[label].push(dim)
  }

  return NextResponse.json({
    synthesis_status: portrait.synthesis_status,
    last_synthesised_at: portrait.last_synthesised_at,
    dimensions: grouped,
    currents: currents ?? [],
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/creator/mind/route.ts
git commit -m "feat: mind dashboard API route"
```

---

### Task 11: Mind dashboard UI components

**Files:**
- Create: `src/components/sona/MindDashboard.tsx`
- Create: `src/components/sona/MindCharacterTab.tsx`
- Create: `src/components/sona/MindCurrentsTab.tsx`
- Create: `src/app/(sona)/dashboard/mind/page.tsx`
- Modify: `src/app/(sona)/dashboard/DashboardNav.tsx`

- [ ] **Step 1: Write MindCharacterTab.tsx**

```typescript
// src/components/sona/MindCharacterTab.tsx
'use client'

import { TIER_LABELS } from '@/lib/tiers'

interface DimensionRow {
  dimension_key: string
  narrative: string
  confidence: number
  confidence_flag: string | null
  min_tier: string
  evidence_count: number
}

interface Props {
  grouped: Record<string, DimensionRow[]>
}

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

export function MindCharacterTab({ grouped }: Props) {
  if (Object.keys(grouped).length === 0) {
    return (
      <p style={{ fontFamily: GEIST, fontSize: '0.875rem', color: '#6b6b6b', textAlign: 'center', padding: '3rem 0' }}>
        No character profile yet. Add content and deepen your Sona.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      {Object.entries(grouped).map(([category, dims]) => (
        <section key={category}>
          <p style={{
            fontFamily: GEIST,
            fontSize: '0.6875rem',
            fontWeight: 500,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: '#b0b0b0',
            marginBottom: '1rem',
          }}>
            {category}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {dims.map(dim => (
              <div key={dim.dimension_key} className="sona-card" style={{
                padding: '1.25rem 1.5rem',
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.07)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <span style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 500, color: '#1a1a1a' }}>
                    {dim.dimension_key.replace(/_/g, ' ')}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {dim.confidence_flag && (
                      <span style={{
                        fontFamily: GEIST,
                        fontSize: '0.6875rem',
                        color: '#b0b0b0',
                        border: '1px solid rgba(0,0,0,0.1)',
                        borderRadius: 6,
                        padding: '2px 8px',
                      }}>
                        {dim.confidence_flag === 'LOW_CONFIDENCE' ? 'Needs more content' : 'Complex'}
                      </span>
                    )}
                    <span style={{
                      fontFamily: GEIST,
                      fontSize: '0.6875rem',
                      color: '#6b6b6b',
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: 6,
                      padding: '2px 8px',
                    }}>
                      {TIER_LABELS[dim.min_tier as keyof typeof TIER_LABELS] ?? dim.min_tier}
                    </span>
                  </div>
                </div>
                {dim.narrative && (
                  <p style={{ fontFamily: CORMORANT, fontStyle: 'italic', fontSize: '1rem', color: '#1a1a1a', lineHeight: 1.6, margin: 0 }}>
                    {dim.narrative}
                  </p>
                )}
                {dim.confidence_flag === 'LOW_CONFIDENCE' && (
                  <p style={{ fontFamily: GEIST, fontSize: '0.75rem', color: '#b0b0b0', marginTop: '0.5rem' }}>
                    More content in this area would improve accuracy.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write MindCurrentsTab.tsx**

```typescript
// src/components/sona/MindCurrentsTab.tsx
'use client'

import { TIER_LABELS } from '@/lib/tiers'

interface CurrentRow {
  module_type: string
  title: string
  activation_keywords: string[]
  min_tier: string
  confidence: number
}

export function MindCurrentsTab({ currents }: { currents: CurrentRow[] }) {
  if (currents.length === 0) {
    return (
      <p style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.875rem', color: '#6b6b6b', textAlign: 'center', padding: '3rem 0' }}>
        No currents generated yet. Deepen your Sona to build them.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {currents.map(c => (
        <div key={c.module_type} className="sona-card" style={{
          padding: '1.25rem 1.5rem',
          borderRadius: 12,
          border: '1px solid rgba(0,0,0,0.07)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.9375rem', fontWeight: 500, color: '#1a1a1a' }}>
              {c.title}
            </span>
            <span style={{
              fontFamily: 'var(--font-geist-sans)',
              fontSize: '0.6875rem',
              color: '#6b6b6b',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: 6,
              padding: '2px 8px',
            }}>
              {TIER_LABELS[c.min_tier as keyof typeof TIER_LABELS] ?? c.min_tier}
            </span>
          </div>
          <p style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.75rem', color: '#6b6b6b', margin: 0 }}>
            {c.activation_keywords.slice(0, 6).join(' · ')}
          </p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Write MindDashboard.tsx**

```typescript
// src/components/sona/MindDashboard.tsx
'use client'

import { useState, useCallback } from 'react'
import { MindCharacterTab } from './MindCharacterTab'
import { MindCurrentsTab } from './MindCurrentsTab'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

interface Props {
  initialData: {
    synthesis_status: string
    last_synthesised_at: string | null
    dimensions: Record<string, any[]>
    currents: any[]
  }
}

export function MindDashboard({ initialData }: Props) {
  const [data, setData] = useState(initialData)
  const [activeTab, setActiveTab] = useState<'character' | 'currents'>('character')
  const [deepening, setDeepening] = useState(false)

  const handleDeepen = useCallback(async () => {
    setDeepening(true)
    await fetch('/api/creator/deepen', { method: 'POST' })
    // Poll until status changes from synthesising
    const poll = setInterval(async () => {
      const res = await fetch('/api/creator/mind')
      const fresh = await res.json()
      if (fresh.synthesis_status !== 'synthesising') {
        setData(fresh)
        setDeepening(false)
        clearInterval(poll)
      }
    }, 3000)
  }, [])

  const statusLabel = deepening || data.synthesis_status === 'synthesising'
    ? 'Deepening…'
    : data.synthesis_status === 'ready'
      ? 'Up to date'
      : data.synthesis_status === 'error'
        ? 'Something went wrong — try again'
        : "Your Sona's depth hasn't been built yet"

  const canDeepen = !deepening && data.synthesis_status !== 'synthesising'

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 clamp(24px, 4vw, 48px) 4rem' }}>
      {/* Status bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem 0',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        marginBottom: '2.5rem',
      }}>
        <div>
          <p style={{ fontFamily: GEIST, fontSize: '0.875rem', color: '#1a1a1a', margin: 0 }}>{statusLabel}</p>
          {data.last_synthesised_at && data.synthesis_status === 'ready' && (
            <p style={{ fontFamily: GEIST, fontSize: '0.75rem', color: '#b0b0b0', margin: '2px 0 0' }}>
              Last deepened {new Date(data.last_synthesised_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
        <button
          onClick={handleDeepen}
          disabled={!canDeepen}
          className="sona-btn-dark"
          style={{
            fontFamily: GEIST,
            fontSize: '0.875rem',
            fontWeight: 500,
            color: canDeepen ? '#fff' : '#b0b0b0',
            backgroundColor: canDeepen ? '#1a1a1a' : 'rgba(0,0,0,0.05)',
            border: 'none',
            borderRadius: 980,
            padding: '10px 28px',
            cursor: canDeepen ? 'pointer' : 'default',
            transition: 'opacity 0.15s',
          }}
        >
          {deepening ? 'Deepening…' : 'Deepen'}
        </button>
      </div>

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        {(['character', 'currents'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              fontFamily: GEIST,
              fontSize: '0.875rem',
              fontWeight: activeTab === tab ? 500 : 400,
              color: activeTab === tab ? '#1a1a1a' : '#6b6b6b',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #1a1a1a' : '2px solid transparent',
              padding: '0 0 0.75rem',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab === 'character' ? 'Character' : 'Currents'}
          </button>
        ))}
      </div>

      {activeTab === 'character'
        ? <MindCharacterTab grouped={data.dimensions} />
        : <MindCurrentsTab currents={data.currents} />
      }
    </div>
  )
}
```

- [ ] **Step 4: Write the Mind page**

```typescript
// src/app/(sona)/dashboard/mind/page.tsx
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { MindDashboard } from '@/components/sona/MindDashboard'

export default async function MindPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/creator/mind`, {
    headers: { Cookie: `sb-access-token=${(await supabase.auth.getSession()).data.session?.access_token}` },
    cache: 'no-store',
  })

  if (!res.ok) redirect('/dashboard')
  const data = await res.json()

  return (
    <main>
      <div style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: 'clamp(2rem, 4vw, 3rem) clamp(24px, 4vw, 48px) 0',
      }}>
        <h1 style={{
          fontFamily: 'var(--font-cormorant)',
          fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
          fontStyle: 'italic',
          fontWeight: 400,
          letterSpacing: '-0.02em',
          color: '#1a1a1a',
          marginBottom: '0.25rem',
        }}>
          Mind
        </h1>
        <p style={{
          fontFamily: 'var(--font-geist-sans)',
          fontSize: '0.875rem',
          color: '#6b6b6b',
          marginBottom: '2.5rem',
        }}>
          What your Sona knows about you.
        </p>
      </div>
      <MindDashboard initialData={data} />
    </main>
  )
}
```

- [ ] **Step 5: Add Mind to DashboardNav**

In `src/app/(sona)/dashboard/DashboardNav.tsx`, update NAV_ITEMS:

```typescript
const NAV_ITEMS = [
  { href: '/dashboard',          label: 'Overview',  exact: true },
  { href: '/dashboard/content',  label: 'Content',   exact: false },
  { href: '/dashboard/mind',     label: 'Mind',      exact: false },
  { href: '/dashboard/pricing',  label: 'Pricing',   exact: false },
  { href: '/dashboard/interview',label: 'Interview', exact: false },
  { href: '/dashboard/settings', label: 'Settings',  exact: false },
]
```

- [ ] **Step 6: Add synthesis status nudge to dashboard overview**

In `src/app/(sona)/dashboard/page.tsx`, after the existing supabase queries, fetch synthesis status and add a nudge card before the main content:

```typescript
  // Fetch synthesis status
  const { data: synthesisStatus } = await supabase
    .from('portraits')
    .select('synthesis_status, last_synthesised_at')
    .eq('id', portrait.id)
    .single()

  // Add nudge card in JSX (only when synthesis_status is 'never'):
  {synthesisStatus?.synthesis_status === 'never' && (
    <div style={{
      border: '1px solid rgba(0,0,0,0.07)',
      borderRadius: 12,
      padding: '1rem 1.5rem',
      marginBottom: '1.5rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <p style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.875rem', color: '#6b6b6b', margin: 0 }}>
        Your Sona's depth hasn't been built yet. Add content and deepen it.
      </p>
      <a href="/dashboard/mind" style={{
        fontFamily: 'var(--font-geist-sans)',
        fontSize: '0.875rem',
        color: '#1a1a1a',
        textDecoration: 'none',
      }}>
        Go to Mind →
      </a>
    </div>
  )}
```

- [ ] **Step 7: Update ContentAddForm for audio**

In `src/components/sona/ContentAddForm.tsx`:

1. Add `'interview_audio'` to the source type options: `{ value: 'interview_audio', label: 'Interview (audio)' }`
2. Add `source_date` date input field after the title field
3. Detect audio file selection and switch to presigned URL upload flow:

```typescript
  const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav', 'ogg', 'mp4']

  function isAudioFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    return AUDIO_EXTENSIONS.includes(ext)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // ... existing validation ...

    if (selectedFile && isAudioFile(selectedFile)) {
      // Step 1: create source + get presigned URL
      const initRes = await fetch('/api/creator/ingest', {
        method: 'POST',
        body: formDataWithMetadataOnly, // title, source_type, min_tier, portrait_id, source_date
      })
      const { source_id, upload_url } = await initRes.json()

      // Step 2: upload directly to Supabase Storage
      await fetch(upload_url, {
        method: 'PUT',
        body: selectedFile,
        headers: { 'Content-Type': selectedFile.type },
      })

      // Step 3: confirm upload and trigger processing
      await fetch('/api/creator/ingest/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id }),
      })
    } else {
      // Existing non-audio flow unchanged
    }
  }
```

- [ ] **Step 8: Full build check**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

- [ ] **Step 9: Run all tests**

```bash
npx vitest run
```
Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/components/sona/MindDashboard.tsx src/components/sona/MindCharacterTab.tsx src/components/sona/MindCurrentsTab.tsx src/app/(sona)/dashboard/mind/page.tsx src/app/(sona)/dashboard/DashboardNav.tsx src/app/(sona)/dashboard/page.tsx src/components/sona/ContentAddForm.tsx
git commit -m "feat: Mind dashboard UI — character, currents, deepen, audio upload"
```

---

## Final Verification

- [ ] **Deploy to preview environment and verify:**
  1. Upload a text document → confirm extraction job created in `sona_synthesis_jobs`
  2. Upload an audio file → confirm presigned URL returned, transcription runs, subject transcript extracted
  3. Trigger Deepen from Mind dashboard → confirm status moves through `synthesising` → `ready`
  4. Check Character tab → narrative summaries visible, tier badges correct
  5. Check Currents tab → at least one current visible after synthesis
  6. Start a conversation → confirm assembled prompt uses synthesis-generated identity (check with `synthesis_status = 'ready'` portrait)
  7. Test fallback: set `synthesis_status = 'never'` on a portrait → confirm chat still works using `system_prompt`
  8. Test group session → confirm `/api/group-sessions/[id]/contribute` uses assembled prompt

- [ ] **Commit any final fixes**

```bash
git add -A && git commit -m "feat: knowledge layer — synthesis engine, audio ingestion, Mind dashboard"
```
