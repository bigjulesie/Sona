// src/app/api/profile/avatar-upload-url/route.ts
// Returns a Supabase signed upload URL for the authenticated user's avatar.
// Uses the admin client (required for createSignedUploadUrl — same pattern
// as /api/creator/ingest).

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const path = `${user.id}/avatar.png`

  const { data, error } = await admin.storage
    .from('avatars')
    .createSignedUploadUrl(path, { upsert: true })

  if (error || !data) {
    return NextResponse.json({ error: 'Could not create upload URL' }, { status: 500 })
  }

  // Public URL is the CDN URL used to display the avatar after upload.
  // Append a version timestamp so each upload busts the CDN cache —
  // without this, the CDN returns the stale image on page reload since
  // the storage path is fixed (user.id/avatar.png).
  const { data: { publicUrl: baseUrl } } = admin.storage
    .from('avatars')
    .getPublicUrl(path)

  const publicUrl = `${baseUrl}?v=${Date.now()}`

  return NextResponse.json({ signedUrl: data.signedUrl, publicUrl })
}
