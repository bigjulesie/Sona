import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const audio = formData.get('audio') as Blob | null
  if (!audio) return NextResponse.json({ error: 'audio field required' }, { status: 400 })

  const buffer = await audio.arrayBuffer()

  const dgRes = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/webm',
      },
      body: buffer,
    }
  )

  if (!dgRes.ok) {
    const text = await dgRes.text()
    return NextResponse.json({ error: `Deepgram error: ${text}` }, { status: 500 })
  }

  const data = await dgRes.json()
  const transcript =
    data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''

  return NextResponse.json({ transcript })
}
