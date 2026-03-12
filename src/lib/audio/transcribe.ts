// src/lib/audio/transcribe.ts

export interface SpeakerSegment {
  speaker: string
  text: string
  start_ms: number
  end_ms: number
}

export interface TranscriptionResult {
  fullTranscript: string
  speakerSegments: SpeakerSegment[]
  durationSeconds: number
}

export function parseDeepgramResponse(raw: any): TranscriptionResult {
  const utterances: any[] = raw?.results?.utterances ?? []
  const fullTranscript =
    raw?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
  const durationSeconds = Math.round(raw?.metadata?.duration ?? 0)

  const speakerSegments: SpeakerSegment[] = utterances.map((u: any) => ({
    speaker: `speaker_${u.speaker}`,
    text: u.transcript,
    start_ms: Math.round((u.start ?? 0) * 1000),
    end_ms: Math.round((u.end ?? 0) * 1000),
  }))

  return { fullTranscript, speakerSegments, durationSeconds }
}

/**
 * Identify the "subject" as the speaker with the most total words,
 * and return their combined transcript text.
 */
export function extractSubjectTranscript(segments: SpeakerSegment[]): string {
  const wordCounts: Record<string, number> = {}
  for (const seg of segments) {
    wordCounts[seg.speaker] = (wordCounts[seg.speaker] ?? 0) +
      seg.text.split(/\s+/).filter(Boolean).length
  }
  const subjectSpeaker = Object.entries(wordCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0]
  if (!subjectSpeaker) return ''
  return segments
    .filter(s => s.speaker === subjectSpeaker)
    .map(s => s.text)
    .join('\n\n')
}

/**
 * Transcribe a pre-recorded audio file via Deepgram REST API.
 * Returns the raw Deepgram response (call parseDeepgramResponse to interpret).
 */
export async function transcribeAudio(storageUrl: string): Promise<any> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY not set')

  const response = await fetch(
    'https://api.deepgram.com/v1/listen' +
    '?model=nova-2&punctuate=true&paragraphs=true&diarize=true&utterances=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: storageUrl }),
    }
  )
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Deepgram error ${response.status}: ${text}`)
  }
  return response.json()
}
