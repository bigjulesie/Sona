import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Returns the Deepgram API key to authenticated users so the browser can
// open a WebSocket directly to Deepgram using ?token=<key>.
// The route is auth-gated (Supabase session required) so only signed-in
// users can obtain the key.
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    console.error('[deepgram-token] DEEPGRAM_API_KEY not set')
    return NextResponse.json({ error: 'DEEPGRAM_API_KEY not configured' }, { status: 500 })
  }

  return NextResponse.json({ token: apiKey })
}
