import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Issues a short-lived Deepgram key so the client can open a WebSocket
// directly to Deepgram for real-time streaming transcription.
// Uses the Projects API (POST /v1/projects/:id/keys) which works with
// standard API keys — the /v1/auth/grant endpoint requires keys:write scope.
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.DEEPGRAM_API_KEY
  const projectId = process.env.DEEPGRAM_PROJECT_ID

  if (!apiKey) {
    console.error('[deepgram-token] DEEPGRAM_API_KEY not set')
    return NextResponse.json({ error: 'DEEPGRAM_API_KEY not configured' }, { status: 500 })
  }
  if (!projectId) {
    console.error('[deepgram-token] DEEPGRAM_PROJECT_ID not set')
    return NextResponse.json({ error: 'DEEPGRAM_PROJECT_ID not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: 'sona-browser-session',
        scopes: ['usage:write'],
        time_to_live_in_seconds: 60,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[deepgram-token] key creation failed', res.status, text)
      return NextResponse.json({ error: `Deepgram error: ${text}` }, { status: 500 })
    }

    const body = await res.json()
    const token = body.key
    if (!token) {
      console.error('[deepgram-token] unexpected response shape', JSON.stringify(body))
      return NextResponse.json({ error: 'Unexpected Deepgram response' }, { status: 500 })
    }
    return NextResponse.json({ token })
  } catch (err) {
    console.error('[deepgram-token] fetch threw', err)
    return NextResponse.json({ error: 'Token service unavailable' }, { status: 500 })
  }
}
