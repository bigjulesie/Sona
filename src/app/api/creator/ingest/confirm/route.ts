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

  // Single ownership-verified query — RLS on portraits ensures only the creator's portraits are visible.
  // If source_id doesn't exist or the user doesn't own the portrait, both cases return 403 (no existence leak).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: source } = await (supabase as any)
    .from('content_sources')
    .select(`
      id, portrait_id, title, source_type, min_tier, storage_path,
      portraits!inner(id, creator_id)
    `)
    .eq('id', source_id)
    .eq('portraits.creator_id', user.id)
    .single()

  if (!source) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!source.storage_path) return NextResponse.json({ error: 'No storage path on source' }, { status: 400 })

  const jobId = await createJob(source.portrait_id, 'evidence_extraction', 'upload', source_id)

  after(async () => {
    try {
      await updateJob(jobId, 'running')

      // Generate a signed URL — sona-content bucket is private so getPublicUrl returns a broken URL
      const { data: signedData, error: signedError } = await admin.storage
        .from('sona-content')
        .createSignedUrl(source.storage_path, 600) // 10-minute TTL, enough for Deepgram to fetch
      if (signedError || !signedData?.signedUrl) throw new Error('Failed to create signed URL for audio')

      // Transcribe
      const rawResult = await transcribeAudio(signedData.signedUrl)
      const parsed = parseDeepgramResponse(rawResult)

      // Store transcript
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // Trigger evidence extraction (Task 6 — dynamically imported to avoid circular dep)
      const { extractEvidenceForSource } = await import('@/lib/synthesis/evidence-extract')
      await extractEvidenceForSource(source_id, source.portrait_id, 'interview_audio')
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('content_sources')
        .update({ status: 'error', error_msg: err instanceof Error ? err.message : 'Failed' })
        .eq('id', source_id)
      await updateJob(jobId, 'error', {}, err instanceof Error ? err.message : 'Failed')
    }
  })

  return NextResponse.json({ ok: true, source_id, status: 'processing' })
}
