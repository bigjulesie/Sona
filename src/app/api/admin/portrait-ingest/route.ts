// src/app/api/admin/portrait-ingest/route.ts
// Admin-only ingest route for third-party interviews.
// Bypasses portrait ownership — requires is_admin on the authenticated user.
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav', 'ogg', 'mp4']
const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'video/mp4', 'audio/x-m4a']
const MAX_AUDIO_FILE_SIZE = 200 * 1024 * 1024 // 200 MB

function isAudioFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return AUDIO_EXTENSIONS.includes(ext) || AUDIO_MIME_TYPES.includes(file.type)
}

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

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const portrait_id              = formData.get('portrait_id') as string | null
  const title                    = (formData.get('title') as string | null)?.trim()
  const min_tier                 = (formData.get('min_tier') as string | null) ?? 'public'
  const source_perspective       = (formData.get('source_perspective') as string | null) ?? 'third_party'
  const interviewee_relationship = (formData.get('interviewee_relationship') as string | null) ?? null
  const file                     = formData.get('file') as File | null
  // Audio metadata-only init (filename + content_type sent before actual upload)
  const audioFilename    = formData.get('filename') as string | null
  const audioContentType = formData.get('content_type') as string | null
  const isAudioInit      = !file && !!(audioFilename || audioContentType)

  if (!portrait_id) return NextResponse.json({ error: 'portrait_id required' }, { status: 400 })
  if (!title)       return NextResponse.json({ error: 'title required' }, { status: 400 })
  if (!['public', 'acquaintance', 'colleague', 'family'].includes(min_tier)) {
    return NextResponse.json({ error: 'Invalid min_tier' }, { status: 400 })
  }
  if (!['first_person', 'third_party'].includes(source_perspective)) {
    return NextResponse.json({ error: 'Invalid source_perspective' }, { status: 400 })
  }
  if (!file && !isAudioInit) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }

  if (file) {
    if (!isAudioFile(file)) {
      return NextResponse.json({ error: 'Only audio files are accepted (MP3, M4A, WAV, OGG)' }, { status: 400 })
    }
    if (file.size > MAX_AUDIO_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 200 MB)' }, { status: 400 })
    }
  }

  const admin = createAdminClient()

  // Verify portrait exists (no ownership check — admin can ingest to any portrait)
  const { data: portrait } = await (admin as any)
    .from('portraits')
    .select('id')
    .eq('id', portrait_id)
    .single()
  if (!portrait) return NextResponse.json({ error: 'Portrait not found' }, { status: 404 })

  // Create content_source record
  const { data: source, error: sourceError } = await (admin as any)
    .from('content_sources')
    .insert({
      portrait_id,
      title,
      source_type: 'interview_audio',
      min_tier,
      source_perspective,
      interviewee_relationship,
      status: 'processing',
    })
    .select('id')
    .single()

  if (sourceError || !source) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Generate presigned upload URL for audio
  const resolvedAudioName = file?.name ?? audioFilename ?? 'interview.mp3'
  const storagePath = `${portrait_id}/${source.id}/${resolvedAudioName}`

  const { data: uploadData, error: uploadError } = await admin.storage
    .from('sona-content')
    .createSignedUploadUrl(storagePath)

  if (uploadError || !uploadData) {
    return NextResponse.json({ error: 'Storage error' }, { status: 500 })
  }

  await (admin as any)
    .from('content_sources')
    .update({ storage_path: storagePath })
    .eq('id', source.id)

  await admin.from('audit_log').insert({
    user_id: userId,
    action: 'admin_ingest_init',
    resource_type: 'content_source',
    resource_id: source.id,
    metadata: { portrait_id, title, source_perspective, interviewee_relationship },
  })

  return NextResponse.json({
    ok: true,
    source_id: source.id,
    status: 'awaiting_upload',
    upload_url: uploadData.signedUrl,
    storage_path: storagePath,
  })
}
