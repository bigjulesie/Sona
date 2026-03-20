// src/app/api/admin/portrait-ingest/confirm/route.ts
// Called after admin has uploaded audio to storage.
// Transcribes and triggers evidence extraction.
// For third-party sources: uses the full transcript (all speakers).
// For first-person sources: uses subject-only transcript.
import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { transcribeAudio, parseDeepgramResponse, extractSubjectTranscript } from '@/lib/audio/transcribe'
import { chunkText } from '@/lib/ingest/chunker'
import { generateEmbeddings } from '@/lib/ingest/embeddings'
import { createJob, updateJob } from '@/lib/synthesis/jobs'

async function assertAdmin(): Promise<string> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) throw new Error('Forbidden')
  return user.id
}

export async function POST(request: NextRequest) {
  let userId: string
  try {
    userId = await assertAdmin()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: msg === 'Forbidden' ? 403 : 401 })
  }

  const { source_id } = await request.json()
  if (!source_id) return NextResponse.json({ error: 'source_id required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: source } = await (admin as any)
    .from('content_sources')
    .select('id, portrait_id, title, source_type, min_tier, storage_path, source_perspective')
    .eq('id', source_id)
    .single()

  if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 })
  if (!source.storage_path) return NextResponse.json({ error: 'No storage path on source' }, { status: 400 })

  const jobId = await createJob(source.portrait_id, 'evidence_extraction', 'admin_upload', source_id)

  after(async () => {
    try {
      await updateJob(jobId, 'running')

      const { data: signedData, error: signedError } = await admin.storage
        .from('sona-content')
        .createSignedUrl(source.storage_path, 600)
      if (signedError || !signedData?.signedUrl) throw new Error('Failed to create signed URL for audio')

      const rawResult = await transcribeAudio(signedData.signedUrl)
      const parsed = parseDeepgramResponse(rawResult)

      await (admin as any).from('sona_transcriptions').upsert({
        source_id,
        transcript: parsed.fullTranscript,
        transcript_with_speakers: parsed.speakerSegments,
        duration_seconds: parsed.durationSeconds,
      })

      // For third-party interviews: use full transcript — the interviewee's observations are all valuable.
      // For first-person audio: filter to subject's speech only.
      const isThirdParty = source.source_perspective === 'third_party'
      const textForChunking = isThirdParty
        ? parsed.fullTranscript
        : (parsed.speakerSegments.length > 0
            ? extractSubjectTranscript(parsed.speakerSegments)
            : parsed.fullTranscript)

      const chunks = chunkText(textForChunking)
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

      await (admin as any).from('content_sources')
        .update({ status: 'ready' })
        .eq('id', source_id)

      await updateJob(jobId, 'complete', { chunks_created: chunks.length })

      await admin.from('audit_log').insert({
        user_id: userId,
        action: 'admin_ingest_audio',
        resource_type: 'content_source',
        resource_id: source_id,
        metadata: {
          portrait_id: source.portrait_id,
          source_perspective: source.source_perspective,
          chunks_created: chunks.length,
        },
      })

      const { extractEvidenceForSource } = await import('@/lib/synthesis/evidence-extract')
      await extractEvidenceForSource(source_id, source.portrait_id, source.source_type, 'admin_upload')
    } catch (err) {
      await (admin as any).from('content_sources')
        .update({ status: 'error', error_msg: err instanceof Error ? err.message : 'Failed' })
        .eq('id', source_id)
      await updateJob(jobId, 'error', {}, err instanceof Error ? err.message : 'Failed')
    }
  })

  return NextResponse.json({ ok: true, source_id, status: 'processing' })
}
