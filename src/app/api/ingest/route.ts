import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { chunkText } from '@/lib/ingest/chunker'
import { generateEmbeddings } from '@/lib/ingest/embeddings'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    portrait_id,
    content,
    source_title,
    source_type = 'transcript',
    source_date,
    min_tier = 'public',
    chunk_options,
  } = body

  if (!portrait_id || !content) {
    return NextResponse.json(
      { error: 'portrait_id and content are required' },
      { status: 400 }
    )
  }

  const chunks = chunkText(content, chunk_options)
  const embeddings = await generateEmbeddings(chunks)

  const supabase = createAdminClient()

  const rows = chunks.map((chunk, i) => ({
    portrait_id,
    content: chunk,
    embedding: JSON.stringify(embeddings[i]),
    source_title,
    source_type,
    source_date,
    min_tier,
    chunk_index: i,
  }))

  const { data, error } = await supabase
    .from('knowledge_chunks')
    .insert(rows)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('audit_log').insert({
    action: 'ingest',
    resource_type: 'knowledge_chunks',
    metadata: {
      portrait_id,
      source_title,
      chunks_created: chunks.length,
    },
  })

  return NextResponse.json({
    chunks_created: chunks.length,
    ids: data.map(d => d.id),
  })
}
