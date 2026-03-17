import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Issues a short-lived Deepgram browser token via /v1/auth/grant.
// Requires a Deepgram API key with keys:write scope (Member role or above).
// The returned token works with ?token= in the WebSocket URL for browser clients.
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    console.error('[deepgram-token] DEEPGRAM_API_KEY not set')
    return NextResponse.json({ error: 'DEEPGRAM_API_KEY not configured' }, { status: 500 })
  }

  try {
    const res = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ time_to_live_in_seconds: 300 }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[deepgram-token] grant failed', res.status, text)
      return NextResponse.json({ error: `Deepgram error: ${text}` }, { status: 500 })
    }

    const body = await res.json()
    console.log('[deepgram-token] grant response keys:', Object.keys(body))
    const token = body.key ?? body.token ?? body.access_token
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
