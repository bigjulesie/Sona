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
    // creator_id is a FK to profiles(id), which mirrors auth.users.id per the
    // profile-creation trigger — so user.id (auth UID) is safe to use here.
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
  // content_sources was added in migration 00012 and is not yet in the generated types,
  // so we cast to any to bypass the type checker for this table.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: source, error: sourceError } = await (admin as any)
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

    // source_id was added to knowledge_chunks in migration 00012 and is not in generated
    // types yet, so we cast to any[] to include it without a type error.
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

    return NextResponse.json({ ok: true, source_id: source.id, chunks_created: chunks.length })
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('content_sources')
      .update({ status: 'error', error_msg: 'Processing failed' })
      .eq('id', source.id)
    await admin.from('audit_log').insert({
      user_id: user.id,
      action: 'ingest',
      resource_type: 'content_source',
      resource_id: source.id,
      metadata: { portrait_id, title, chunks_created: 0, status: 'error' },
    })
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
