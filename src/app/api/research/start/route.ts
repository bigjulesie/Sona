// src/app/api/research/start/route.ts
import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runWebResearch } from '@/lib/research/web-research'

export async function POST(request: NextRequest) {
  if (!process.env.INTERNAL_API_SECRET) {
    console.error('[/api/research/start] INTERNAL_API_SECRET env var not set — rejecting all requests')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const secret = request.headers.get('x-internal-secret')
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let portrait_id: string
  try {
    const body = await request.json() as { portrait_id?: string }
    portrait_id = body.portrait_id ?? ''
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!portrait_id) {
    return NextResponse.json({ error: 'portrait_id required' }, { status: 400 })
  }

  // Return 202 immediately — all heavy work runs inside a single after() call
  after(async () => {
    const admin = createAdminClient()

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: portrait, error: portraitError } = await (admin as any)
        .from('portraits')
        .select('id, display_name, search_context, linkedin_url, website_url')
        .eq('id', portrait_id)
        .single()

      if (portraitError || !portrait) throw portraitError ?? new Error('Portrait not found')

      const { meta, sources } = await runWebResearch(portrait)

      // Evidence extraction: sequential per source within this single after() call.
      const { chunkText } = await import('@/lib/ingest/chunker')
      const { generateEmbeddings } = await import('@/lib/ingest/embeddings')
      const { extractEvidenceForSource } = await import('@/lib/synthesis/evidence-extract')

      for (const source of sources) {
        try {
          if (!source.raw_content) continue

          const chunks = chunkText(source.raw_content)
          const embeddings = await generateEmbeddings(chunks)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rows: any[] = chunks.map((chunk: string, i: number) => ({
            portrait_id,
            source_id: source.id,
            content: chunk,
            embedding: JSON.stringify(embeddings[i]),
            source_title: source.title,
            source_type: source.source_type,
            min_tier: 'public',
            chunk_index: i,
          }))

          const { error: chunkError } = await admin.from('knowledge_chunks').insert(rows)
          if (chunkError) throw chunkError

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin as any)
            .from('content_sources')
            .update({ status: 'ready' })
            .eq('id', source.id)

          await extractEvidenceForSource(source.id, portrait_id, source.source_type)
        } catch {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin as any)
            .from('content_sources')
            .update({ status: 'error' })
            .eq('id', source.id)
        }
      }

      // Write job record with pipeline metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('sona_synthesis_jobs')
        .insert({
          portrait_id,
          job_type: 'web_research',
          status: 'complete',
          triggered_by: 'web_research_auto',
          metadata: meta,
        })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('portraits')
        .update({ web_research_status: 'complete' })
        .eq('id', portrait_id)
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('sona_synthesis_jobs')
        .insert({
          portrait_id,
          job_type: 'web_research',
          status: 'error',
          triggered_by: 'web_research_auto',
          metadata: {},
        })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('portraits')
        .update({ web_research_status: 'error' })
        .eq('id', portrait_id)
    }
  })

  return NextResponse.json({ ok: true }, { status: 202 })
}
