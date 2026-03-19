import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  if (!(await checkRateLimit(user.id, 'tts'))) {
    return new Response('Rate limit exceeded.', { status: 429 })
  }

  const body = await req.json()
  const { text: rawText, portrait_id } = body
  if (!rawText || !portrait_id) {
    return new Response('text and portrait_id required', { status: 400 })
  }
  // Cap at 2000 chars to keep credit usage predictable
  const text = rawText.slice(0, 2000)

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return new Response('ELEVENLABS_API_KEY not configured', { status: 500 })
  }

  // Look up creator's voice preference for this portrait
  const VOICE_IDS = {
    male:   'L0Dsvb3SLTyegXwtm47J',
    female: 'lcMyyd2HUfFzxdCaC4Ta',
  }
  const admin = createAdminClient()
  const { data: portrait } = await (admin as any)
    .from('portraits')
    .select('creator_id')
    .eq('id', portrait_id)
    .single()
  const creatorId = portrait?.creator_id
  let voiceId: string | undefined
  if (creatorId) {
    const { data: creatorProfile } = await (admin as any)
      .from('profiles')
      .select('voice_gender')
      .eq('id', creatorId)
      .single()
    const gender = creatorProfile?.voice_gender as 'male' | 'female' | null
    voiceId = gender ? VOICE_IDS[gender] : undefined
  }
  // Fall back to env var default if no preference set
  voiceId ??= process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? process.env.ELEVENLABS_DEFAULT_VOICE
  if (!voiceId) {
    return new Response('No voice ID configured', { status: 500 })
  }

  try {
    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
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

    await createAdminClient().from('audit_log').insert({
      user_id: user.id,
      action: 'tts',
      resource_type: 'portrait',
      resource_id: portrait_id,
      metadata: { text_length: text.length },
    })

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
