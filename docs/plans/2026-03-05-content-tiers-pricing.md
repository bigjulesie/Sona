# Content Library, Tier System & Pricing Hub — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-paste content form with a proper content library supporting file uploads; introduce Discovery/Perspective/Wisdom/Legacy tier labels throughout the UI; and add a dedicated Pricing & Earnings page to the dashboard.

**Architecture:** A new `content_sources` table groups uploaded items as logical units, with `knowledge_chunks` linking back to them via `source_id`. A new creator-authenticated `/api/creator/ingest` route handles text extraction (PDF via `pdf-parse`, DOCX via `mammoth`, plain text directly), chunking, and embedding synchronously. Tier enum values in Postgres are unchanged — a constants file maps internal values to display names everywhere in the UI.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres + pgvector), OpenAI embeddings, `pdf-parse`, `mammoth`, Stripe (existing), inline styles throughout.

---

## Context for implementer

- Internal DB enum: `access_tier` = `'public' | 'acquaintance' | 'colleague' | 'family'`
- Display names: `public` → Discovery, `acquaintance` → Perspective, `colleague` → Wisdom, `family` → Legacy
- Paying subscribers always receive `acquaintance` (Perspective) tier — this is the existing default
- The existing `/api/ingest` route is admin-only (service role key). We create a new `/api/creator/ingest` for creator-authenticated uploads
- Chunking: `src/lib/ingest/chunker.ts` → `chunkText(text)`
- Embeddings: `src/lib/ingest/embeddings.ts` → `generateEmbeddings(chunks)`
- Rate limiting: `src/lib/rate-limit.ts` → `checkRateLimit(userId, action)`
- Admin client: `src/lib/supabase/admin.ts` → `createAdminClient()`
- Server client: `src/lib/supabase/server.ts` → `createServerSupabaseClient()`

---

### Task 1: Tier display constants

**Files:**
- Create: `src/lib/tiers.ts`

**Step 1: Create the file**

```typescript
// src/lib/tiers.ts
import type { Database } from '@/lib/supabase/types'

export type AccessTier = Database['public']['Enums']['access_tier']

export const TIER_LABELS: Record<AccessTier, string> = {
  public:       'Discovery',
  acquaintance: 'Perspective',
  colleague:    'Wisdom',
  family:       'Legacy',
}

export const TIER_ORDER: AccessTier[] = ['public', 'acquaintance', 'colleague', 'family']

/** All tiers a creator can assign to content (all four for now) */
export const CREATOR_TIERS: AccessTier[] = ['public', 'acquaintance', 'colleague', 'family']
```

**Step 2: Verify it compiles**

```bash
cd /Users/julian/Documents/sona && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors related to `src/lib/tiers.ts`

**Step 3: Commit**

```bash
git add src/lib/tiers.ts
git commit -m "feat: add tier display name constants (Discovery/Perspective/Wisdom/Legacy)"
```

---

### Task 2: Database migration — content_sources table

**Files:**
- Create: `supabase/migrations/00012_content_sources.sql`

**Step 1: Write the migration**

```sql
-- supabase/migrations/00012_content_sources.sql

CREATE TABLE IF NOT EXISTS content_sources (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portrait_id  UUID NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  source_type  TEXT NOT NULL DEFAULT 'transcript'
                 CHECK (source_type IN ('transcript', 'interview', 'article', 'book', 'essay', 'speech', 'letter', 'other')),
  min_tier     access_tier NOT NULL DEFAULT 'public',
  storage_path TEXT,
  status       TEXT NOT NULL DEFAULT 'ready'
                 CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_msg    TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_sources_portrait
  ON content_sources(portrait_id);

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES content_sources(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source
  ON knowledge_chunks(source_id) WHERE source_id IS NOT NULL;

-- RLS
ALTER TABLE content_sources ENABLE ROW LEVEL SECURITY;

-- Creators can read their own portrait's sources
CREATE POLICY "creator_read_own_sources" ON content_sources
  FOR SELECT USING (
    portrait_id IN (
      SELECT id FROM portraits WHERE creator_id = auth.uid()
    )
  );

-- Service role manages all
CREATE POLICY "service_role_all_sources" ON content_sources
  FOR ALL USING (auth.role() = 'service_role');
```

**Step 2: Apply the migration**

In Supabase dashboard → SQL editor, paste and run the migration. Or via CLI:
```bash
supabase db push
```

**Step 3: Verify in Supabase dashboard**

Check that `content_sources` table exists and `knowledge_chunks` has a `source_id` column.

**Step 4: Commit**

```bash
git add supabase/migrations/00012_content_sources.sql
git commit -m "feat: add content_sources table and source_id to knowledge_chunks"
```

---

### Task 3: Install PDF and DOCX parsing dependencies

**Step 1: Install packages**

```bash
cd /Users/julian/Documents/sona
npm install pdf-parse mammoth
npm install --save-dev @types/pdf-parse @types/mammoth
```

**Step 2: Verify install**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no new errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add pdf-parse and mammoth for document text extraction"
```

---

### Task 4: Text extraction utility

**Files:**
- Create: `src/lib/ingest/extract.ts`

**Step 1: Write the utility**

```typescript
// src/lib/ingest/extract.ts

/**
 * Extracts plain text from a file buffer based on MIME type or extension.
 * Supports: PDF, DOCX, plain text.
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''

  // PDF
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    const pdfParse = (await import('pdf-parse')).default
    const result = await pdfParse(buffer)
    return result.text
  }

  // DOCX
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  // Plain text (txt, md, etc.)
  return buffer.toString('utf-8')
}

export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]

export const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md']

/** Max file size: 10 MB */
export const MAX_FILE_SIZE = 10 * 1024 * 1024
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

**Step 3: Commit**

```bash
git add src/lib/ingest/extract.ts
git commit -m "feat: add text extraction utility for PDF, DOCX, and plain text"
```

---

### Task 5: Creator ingest API route

**Files:**
- Create: `src/app/api/creator/ingest/route.ts`

This route replaces `SonaIngestForm`'s use of the NH admin action. It:
1. Authenticates the creator
2. Verifies they own the portrait
3. Rate-limits (20 ingests per hour)
4. Accepts `multipart/form-data` with fields: `portrait_id`, `title`, `source_type`, `min_tier`, and either `content` (text) or `file` (File)
5. Extracts text, chunks, embeds, inserts `content_sources` + `knowledge_chunks`

**Step 1: Write the route**

```typescript
// src/app/api/creator/ingest/route.ts
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

  // Verify creator owns portrait
  const { data: portrait } = await supabase
    .from('portraits')
    .select('id')
    .eq('id', portrait_id)
    .eq('creator_id', user.id)
    .single()
  if (!portrait) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Extract text
  let text: string
  try {
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
      }
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        return NextResponse.json({ error: 'Unsupported file type. Use PDF, DOCX, or TXT.' }, { status: 400 })
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      text = await extractText(buffer, file.type, file.name)
    } else {
      text = pastedContent!
    }
  } catch {
    return NextResponse.json({ error: 'Failed to extract text from file' }, { status: 422 })
  }

  if (!text.trim()) {
    return NextResponse.json({ error: 'No text content found' }, { status: 422 })
  }

  const admin = createAdminClient()

  // Create content_source record
  const { data: source, error: sourceError } = await admin
    .from('content_sources')
    .insert({ portrait_id, title, source_type, min_tier, status: 'processing' })
    .select('id')
    .single()

  if (sourceError || !source) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Chunk + embed + insert
  try {
    const chunks = chunkText(text)
    const embeddings = await generateEmbeddings(chunks)

    const rows = chunks.map((chunk, i) => ({
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

    await admin
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

    return NextResponse.json({ ok: true, source_id: source.id, chunks_created: chunks.length })
  } catch {
    await admin
      .from('content_sources')
      .update({ status: 'error', error_msg: 'Processing failed' })
      .eq('id', source.id)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
```

**Step 2: Also add 'ingest' to rate-limit.ts LIMITS**

In `src/lib/rate-limit.ts`, find the LIMITS object and add:
```typescript
ingest: 20,
```

**Step 3: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add src/app/api/creator/ingest/route.ts src/lib/rate-limit.ts
git commit -m "feat: creator ingest API with PDF/DOCX/text extraction and tier tagging"
```

---

### Task 6: ContentAddForm component

**Files:**
- Create: `src/components/sona/ContentAddForm.tsx`

This replaces `SonaIngestForm` for the Sona dashboard (the NH admin form remains unchanged).

**Step 1: Write the component**

```typescript
// src/components/sona/ContentAddForm.tsx
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { TIER_LABELS, CREATOR_TIERS } from '@/lib/tiers'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

const SOURCE_TYPES = [
  { value: 'transcript', label: 'Transcript' },
  { value: 'interview',  label: 'Interview' },
  { value: 'article',    label: 'Article' },
  { value: 'book',       label: 'Book' },
  { value: 'essay',      label: 'Essay' },
  { value: 'speech',     label: 'Speech' },
  { value: 'letter',     label: 'Letter' },
  { value: 'other',      label: 'Other' },
]

interface Props {
  portraitId: string
  portraitName: string
  onSuccess: () => void
}

export function ContentAddForm({ portraitId, portraitName, onSuccess }: Props) {
  const [inputMode, setInputMode] = useState<'paste' | 'upload'>('paste')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = e.currentTarget
    const data = new FormData(form)
    data.set('portrait_id', portraitId)
    data.set('input_mode', inputMode)

    // If upload mode, ensure file is set; if paste mode, remove file field
    if (inputMode === 'paste') {
      data.delete('file')
    }

    try {
      const res = await fetch('/api/creator/ingest', { method: 'POST', body: data })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Something went wrong')
        return
      }
      form.reset()
      router.refresh()
      onSuccess()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const labelStyle = {
    fontFamily: GEIST,
    fontSize: '0.6875rem' as const,
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

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23b0b0b0' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat' as const,
    backgroundPosition: 'right 4px center',
    paddingRight: 24,
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Adding to label */}
      <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 300, color: '#b0b0b0', margin: 0 }}>
        Adding content to{' '}
        <span style={{ fontFamily: CORMORANT, fontStyle: 'italic', fontWeight: 400, color: '#6b6b6b', fontSize: '0.9375rem' }}>
          {portraitName}
        </span>
      </p>

      {/* Title */}
      <div>
        <label style={labelStyle}>Source title</label>
        <input
          name="title"
          required
          placeholder="e.g. Interview with The Guardian, 2019"
          className="sona-input"
          style={inputStyle}
        />
      </div>

      {/* Type + Tier row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <label style={labelStyle}>Type</label>
          <select name="source_type" className="sona-input" style={selectStyle}>
            {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Access tier</label>
          <select name="min_tier" className="sona-input" style={selectStyle}>
            {CREATOR_TIERS.map(tier => (
              <option key={tier} value={tier}>{TIER_LABELS[tier]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Input mode toggle */}
      <div>
        <label style={labelStyle}>Content</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['paste', 'upload'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setInputMode(mode)}
              style={{
                fontFamily: GEIST,
                fontSize: '0.8125rem',
                fontWeight: 400,
                padding: '6px 16px',
                borderRadius: '980px',
                border: '1px solid',
                borderColor: inputMode === mode ? '#1a1a1a' : 'rgba(0,0,0,0.15)',
                background: inputMode === mode ? '#1a1a1a' : '#fff',
                color: inputMode === mode ? '#fff' : '#6b6b6b',
                cursor: 'pointer',
              }}
            >
              {mode === 'paste' ? 'Paste text' : 'Upload file'}
            </button>
          ))}
        </div>

        {inputMode === 'paste' ? (
          <textarea
            name="content"
            required
            rows={10}
            placeholder="Paste a transcript, article, or any text that represents your thinking…"
            style={{
              fontFamily: GEIST,
              fontSize: '0.9375rem',
              fontWeight: 300,
              color: '#1a1a1a',
              lineHeight: 1.7,
              width: '100%',
              background: '#fafafa',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 12,
              padding: '14px 16px',
              outline: 'none',
              resize: 'vertical' as const,
              boxSizing: 'border-box' as const,
            }}
          />
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: '1.5px dashed rgba(0,0,0,0.15)',
              borderRadius: 12,
              padding: '36px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: '#fafafa',
            }}
          >
            <input
              ref={fileRef}
              name="file"
              type="file"
              accept=".pdf,.docx,.txt,.md"
              required
              style={{ display: 'none' }}
              onChange={e => {
                const name = e.target.files?.[0]?.name
                const label = document.getElementById('file-label')
                if (label) label.textContent = name ?? 'Choose a file'
              }}
            />
            <p id="file-label" style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 300, color: '#9b9b9b', margin: '0 0 6px' }}>
              Choose a file
            </p>
            <p style={{ fontFamily: GEIST, fontSize: '0.75rem', fontWeight: 300, color: '#c0c0c0', margin: 0 }}>
              PDF, DOCX, or TXT — up to 10 MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', color: '#DE3E7B', margin: '-8px 0 0' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex' }}>
        <button
          type="submit"
          disabled={loading}
          className="sona-btn-dark"
          style={{
            fontFamily: GEIST,
            fontSize: '0.9375rem',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            padding: '12px 32px',
            borderRadius: '980px',
            background: '#1a1a1a',
            color: '#fff',
            border: 'none',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Processing…' : 'Add content'}
        </button>
      </div>

    </form>
  )
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/components/sona/ContentAddForm.tsx
git commit -m "feat: ContentAddForm with paste/upload toggle and tier selector"
```

---

### Task 7: Content library page

**Files:**
- Modify: `src/app/(sona)/dashboard/content/page.tsx`

Replace the current page (which just renders `SonaIngestForm`) with a content library view that lists existing sources and lets the creator add new ones.

**Step 1: Rewrite the page**

```typescript
// src/app/(sona)/dashboard/content/page.tsx
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ContentAddForm } from '@/components/sona/ContentAddForm'
import { ContentLibrary } from '@/components/sona/ContentLibrary'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

export default async function DashboardContentPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, display_name')
    .eq('creator_id', user.id)
    .maybeSingle()

  if (!portrait) redirect('/dashboard/create')

  const { data: sources } = await supabase
    .from('content_sources')
    .select('id, title, source_type, min_tier, status, created_at')
    .eq('portrait_id', portrait.id)
    .order('created_at', { ascending: false })

  return (
    <div style={{ maxWidth: 640 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 40, gap: 16 }}>
        <div>
          <h1 style={{
            fontFamily: CORMORANT,
            fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
            fontWeight: 400,
            fontStyle: 'italic',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: '#1a1a1a',
            margin: '0 0 6px',
          }}>
            Content
          </h1>
          <p style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 300, color: '#6b6b6b', margin: 0, lineHeight: 1.6 }}>
            Writings, talks, and documents that enrich your Sona's knowledge.
          </p>
        </div>
      </div>

      {/* Library */}
      <ContentLibrary
        sources={sources ?? []}
        portraitId={portrait.id}
        portraitName={portrait.display_name}
      />

    </div>
  )
}
```

**Step 2: Commit**

```bash
git add 'src/app/(sona)/dashboard/content/page.tsx'
git commit -m "feat: rewrite content page to use ContentLibrary component"
```

---

### Task 8: ContentLibrary component (list + add form)

**Files:**
- Create: `src/components/sona/ContentLibrary.tsx`

This is a client component that manages the show/hide state of the add form and renders the source list.

**Step 1: Write the component**

```typescript
// src/components/sona/ContentLibrary.tsx
'use client'

import { useState } from 'react'
import { TIER_LABELS } from '@/lib/tiers'
import { ContentAddForm } from './ContentAddForm'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

const TYPE_LABELS: Record<string, string> = {
  transcript: 'Transcript',
  interview:  'Interview',
  article:    'Article',
  book:       'Book',
  essay:      'Essay',
  speech:     'Speech',
  letter:     'Letter',
  other:      'Other',
}

const TIER_COLORS: Record<string, string> = {
  public:       'rgba(0,0,0,0.06)',
  acquaintance: 'rgba(222,62,123,0.08)',
  colleague:    'rgba(26,122,90,0.08)',
  family:       'rgba(180,120,20,0.08)',
}

const TIER_TEXT_COLORS: Record<string, string> = {
  public:       '#9b9b9b',
  acquaintance: '#DE3E7B',
  colleague:    '#1a7a5a',
  family:       '#b08850',
}

interface Source {
  id: string
  title: string
  source_type: string
  min_tier: string
  status: string
  created_at: string
}

interface Props {
  sources: Source[]
  portraitId: string
  portraitName: string
}

export function ContentLibrary({ sources, portraitId, portraitName }: Props) {
  const [showForm, setShowForm] = useState(false)

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div>
      {/* Add content button */}
      {!showForm && (
        <div style={{ marginBottom: 32 }}>
          <button
            onClick={() => setShowForm(true)}
            className="sona-btn-dark"
            style={{
              fontFamily: GEIST,
              fontSize: '0.875rem',
              fontWeight: 500,
              letterSpacing: '-0.01em',
              padding: '10px 24px',
              borderRadius: '980px',
              background: '#1a1a1a',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            + Add content
          </button>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div style={{
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 18,
          padding: '28px 28px',
          marginBottom: 32,
          backgroundColor: '#fafafa',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <p style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 500, color: '#1a1a1a', margin: 0 }}>
              Add content
            </p>
            <button
              onClick={() => setShowForm(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b0b0b0', fontSize: '1.25rem', lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </div>
          <ContentAddForm
            portraitId={portraitId}
            portraitName={portraitName}
            onSuccess={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Empty state */}
      {sources.length === 0 && !showForm && (
        <div style={{
          border: '1px solid rgba(0,0,0,0.07)',
          borderRadius: 14,
          padding: '36px 28px',
          textAlign: 'center',
        }}>
          <p style={{ fontFamily: CORMORANT, fontSize: '1.375rem', fontWeight: 400, fontStyle: 'italic', color: '#1a1a1a', margin: '0 0 8px', lineHeight: 1.3 }}>
            No content yet.
          </p>
          <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 300, color: '#9b9b9b', margin: 0, lineHeight: 1.6 }}>
            Your WhatsApp interview is the primary source. Add documents to enrich your Sona further.
          </p>
        </div>
      )}

      {/* Source list */}
      {sources.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sources.map(source => (
            <div
              key={source.id}
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

              {/* Tier badge */}
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/components/sona/ContentLibrary.tsx
git commit -m "feat: ContentLibrary with source list, tier badges, and inline add form"
```

---

### Task 9: Pricing & Earnings page

**Files:**
- Create: `src/app/(sona)/dashboard/pricing/page.tsx`

**Step 1: Write the page**

```typescript
// src/app/(sona)/dashboard/pricing/page.tsx
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PricingManager } from '@/components/sona/PricingManager'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

export default async function DashboardPricingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, monthly_price_cents')
    .eq('creator_id', user.id)
    .maybeSingle()

  if (!portrait) redirect('/dashboard/create')

  const { data: stats } = await supabase
    .from('portrait_discovery')
    .select('subscriber_count')
    .eq('id', portrait.id)
    .maybeSingle()

  const subscriberCount = Number(stats?.subscriber_count ?? 0)
  const mrr = portrait.monthly_price_cents
    ? (subscriberCount * portrait.monthly_price_cents) / 100
    : 0

  return (
    <div style={{ maxWidth: 520 }}>

      <h1 style={{
        fontFamily: CORMORANT,
        fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
        fontWeight: 400,
        fontStyle: 'italic',
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
        color: '#1a1a1a',
        margin: '0 0 40px',
      }}>
        Pricing & Earnings
      </h1>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 40 }}>
        {[
          { label: 'Subscribers', value: subscriberCount.toLocaleString() },
          { label: 'Monthly revenue', value: mrr > 0 ? `$${mrr.toFixed(0)}` : '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{
            border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: 16,
            padding: '20px 24px',
          }}>
            <p style={{ fontFamily: GEIST, fontSize: '0.75rem', fontWeight: 400, color: '#b0b0b0', margin: '0 0 6px' }}>
              {label}
            </p>
            <p style={{
              fontFamily: CORMORANT,
              fontSize: '2rem',
              fontWeight: 400,
              fontStyle: 'italic',
              color: '#1a1a1a',
              margin: 0,
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginBottom: 40 }} />

      {/* Pricing manager */}
      <PricingManager
        portraitId={portrait.id}
        currentPriceCents={portrait.monthly_price_cents}
      />

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.06)', margin: '40px 0' }} />

      {/* Payouts placeholder */}
      <div>
        <p style={{ fontFamily: GEIST, fontSize: '0.6875rem', fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#b0b0b0', margin: '0 0 12px' }}>
          Payouts
        </p>
        <p style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 300, color: '#9b9b9b', margin: 0, lineHeight: 1.6 }}>
          Direct payouts via Stripe Connect are coming soon.
        </p>
      </div>

    </div>
  )
}
```

**Step 2: Create PricingManager client component**

```typescript
// src/components/sona/PricingManager.tsx
'use client'

import { useState } from 'react'
import { TIER_LABELS } from '@/lib/tiers'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

interface Props {
  portraitId: string
  currentPriceCents: number | null
}

export function PricingManager({ portraitId, currentPriceCents }: Props) {
  const isPaid = currentPriceCents != null && currentPriceCents > 0
  const [editing, setEditing] = useState(false)
  const [type, setType] = useState<'free' | 'paid'>(isPaid ? 'paid' : 'free')
  const [price, setPrice] = useState(isPaid ? (currentPriceCents! / 100).toFixed(0) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setLoading(true)
    setError(null)
    setSaved(false)

    const monthly_price_cents = type === 'paid' ? Math.round(parseFloat(price) * 100) : null
    if (type === 'paid' && (!monthly_price_cents || monthly_price_cents < 100)) {
      setError('Minimum price is $1.00')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/portraits/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portrait_id: portraitId, monthly_price_cents }),
      })
      if (!res.ok) {
        setError('Something went wrong. Please try again.')
        return
      }
      setSaved(true)
      setEditing(false)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p style={{ fontFamily: GEIST, fontSize: '0.6875rem', fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#b0b0b0', margin: '0 0 16px' }}>
        Subscription price
      </p>

      {!editing ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ fontFamily: CORMORANT, fontSize: '1.75rem', fontWeight: 400, fontStyle: 'italic', color: '#1a1a1a', margin: '0 0 4px', lineHeight: 1 }}>
              {isPaid ? `$${(currentPriceCents! / 100).toFixed(0)}/month` : 'Free'}
            </p>
            <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 300, color: '#9b9b9b', margin: 0 }}>
              Subscribers receive <strong style={{ fontWeight: 500 }}>{TIER_LABELS['acquaintance']}</strong> tier access
            </p>
          </div>
          <button
            onClick={() => setEditing(true)}
            style={{
              fontFamily: GEIST,
              fontSize: '0.8125rem',
              fontWeight: 400,
              padding: '8px 20px',
              borderRadius: '980px',
              border: '1px solid rgba(0,0,0,0.15)',
              background: '#fff',
              color: '#1a1a1a',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Free / Paid toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(['free', 'paid'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: type === t ? '2px solid #1a1a1a' : '1.5px solid rgba(0,0,0,0.1)',
                  background: type === t ? '#1a1a1a' : '#fff',
                  textAlign: 'left' as const,
                  cursor: 'pointer',
                }}
              >
                <p style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 500, color: type === t ? '#fff' : '#1a1a1a', margin: '0 0 2px', textTransform: 'capitalize' as const }}>
                  {t}
                </p>
                <p style={{ fontFamily: GEIST, fontSize: '0.75rem', fontWeight: 300, color: type === t ? 'rgba(255,255,255,0.55)' : '#b0b0b0', margin: 0 }}>
                  {t === 'free' ? 'Anyone can access' : 'Subscribers only'}
                </p>
              </button>
            ))}
          </div>

          {type === 'paid' && (
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', fontFamily: GEIST, fontSize: '0.9375rem', fontWeight: 300, color: '#b0b0b0' }}>
                $
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="10"
                className="sona-input"
                style={{
                  fontFamily: GEIST,
                  fontSize: '0.9375rem',
                  fontWeight: 300,
                  color: '#1a1a1a',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(0,0,0,0.15)',
                  padding: '8px 0 8px 18px',
                  outline: 'none',
                  boxSizing: 'border-box' as const,
                }}
              />
            </div>
          )}

          {error && <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', color: '#DE3E7B', margin: 0 }}>{error}</p>}
          {saved && <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', color: '#1a7a5a', margin: 0 }}>Price updated.</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleSave}
              disabled={loading}
              className="sona-btn-dark"
              style={{
                fontFamily: GEIST,
                fontSize: '0.875rem',
                fontWeight: 500,
                padding: '10px 24px',
                borderRadius: '980px',
                background: '#1a1a1a',
                color: '#fff',
                border: 'none',
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{
                fontFamily: GEIST,
                fontSize: '0.875rem',
                fontWeight: 400,
                padding: '10px 20px',
                borderRadius: '980px',
                border: '1px solid rgba(0,0,0,0.15)',
                background: '#fff',
                color: '#6b6b6b',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 3: Verify both compile**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add 'src/app/(sona)/dashboard/pricing/page.tsx' src/components/sona/PricingManager.tsx
git commit -m "feat: pricing & earnings page with subscriber stats and price editor"
```

---

### Task 10: Dashboard nav — add Pricing link

**Files:**
- Modify: `src/app/(sona)/dashboard/DashboardNav.tsx`

**Step 1: Add Pricing to NAV_ITEMS**

In `DashboardNav.tsx`, find the `NAV_ITEMS` array and add:

```typescript
const NAV_ITEMS = [
  { href: '/dashboard',         label: 'Overview',  exact: true },
  { href: '/dashboard/content', label: 'Content',   exact: false },
  { href: '/dashboard/pricing', label: 'Pricing',   exact: false },
  { href: '/dashboard/interview', label: 'Interview', exact: false },
  { href: '/dashboard/settings',  label: 'Settings',  exact: false },
]
```

**Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | head -20
git add 'src/app/(sona)/dashboard/DashboardNav.tsx'
git commit -m "feat: add Pricing to dashboard nav"
```

---

### Task 11: Update PricingStep in wizard — Perspective note + min price $1

**Files:**
- Modify: `src/app/(sona)/(wizard)/dashboard/create/PricingStep.tsx`

Two changes:
1. Minimum price changes from $0.50 to $1.00 (`min="1"`, validation `< 100`)
2. Add a note: "Subscribers receive Perspective-level access."

**Step 1: Update validation and add note**

Find the validation line:
```typescript
if (type === 'paid' && (isNaN(monthly_price_cents!) || monthly_price_cents! < 50)) {
  setError('Minimum price is $0.50')
```
Change to:
```typescript
if (type === 'paid' && (isNaN(monthly_price_cents!) || monthly_price_cents! < 100)) {
  setError('Minimum price is $1.00')
```

Find the price input and change `min="0.50"` to `min="1"` and `step="0.01"` to `step="1"`.

Add below the toggle buttons (after the closing `</div>` of the grid):
```tsx
<p style={{
  fontFamily: GEIST,
  fontSize: '0.8125rem',
  fontWeight: 300,
  color: '#9b9b9b',
  margin: '-12px 0 0',
  lineHeight: 1.6,
}}>
  Subscribers receive <strong style={{ fontWeight: 500 }}>Perspective</strong>-level access.
  Wisdom and Legacy tier controls are coming soon.
</p>
```

**Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | head -20
git add 'src/app/(sona)/(wizard)/dashboard/create/PricingStep.tsx'
git commit -m "feat: update PricingStep — min price $1, add Perspective tier note"
```

---

### Task 12: Smoke test the full flow

**Step 1: Start dev server**

```bash
npx next dev
```

**Step 2: Test content library**

1. Go to `/dashboard/content` as a logged-in creator
2. Verify empty state shows with correct message
3. Click "Add content" — form should appear
4. Paste some text, select Perspective tier, submit
5. Verify source appears in list with correct tier badge
6. Repeat with a file upload (use a small .txt file)

**Step 3: Test pricing page**

1. Go to `/dashboard/pricing`
2. Verify subscriber count and MRR show
3. Click "Change" — verify free/paid toggle
4. Set a price, save — verify it updates

**Step 4: Test wizard pricing step**

1. Start a new Sona creation as a fresh user
2. Reach step 4 — verify Perspective note is visible
3. Verify minimum price shows $1 validation

**Step 5: Final commit if any fixes needed, then push**

```bash
git push
```
