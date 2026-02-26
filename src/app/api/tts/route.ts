import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { text, portrait_id } = await req.json()
  if (!text || !portrait_id) {
    return new Response('text and portrait_id required', { status: 400 })
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    return new Response('ELEVENLABS_API_KEY not configured', { status: 500 })
  }

  const { data: portrait } = await supabase
    .from('portraits')
    .select('voice_enabled, voice_provider_id')
    .eq('id', portrait_id)
    .single()

  if (!portrait?.voice_enabled) {
    return new Response('Voice not enabled for this portrait', { status: 403 })
  }

  const voiceId =
    portrait.voice_provider_id ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID
  if (!voiceId) {
    return new Response('No voice ID configured', { status: 500 })
  }

  try {
    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    )

    if (!elRes.ok) {
      const error = await elRes.text()
      return new Response(`ElevenLabs error: ${error}`, { status: 500 })
    }

    return new Response(elRes.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    })
  } catch {
    return new Response('TTS service unavailable', { status: 500 })
  }
}
