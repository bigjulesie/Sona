// src/__tests__/audio/transcribe.test.ts
import { describe, it, expect, vi } from 'vitest'
import { parseDeepgramResponse, extractSubjectTranscript } from '@/lib/audio/transcribe'

const mockDiarizedResponse = {
  results: {
    channels: [{
      alternatives: [{
        transcript: 'Hello world this is speaker one then speaker two',
        words: [
          { word: 'Hello', speaker: 0, start: 0.0, end: 0.3 },
          { word: 'world', speaker: 0, start: 0.4, end: 0.7 },
          { word: 'this', speaker: 1, start: 1.0, end: 1.2 },
          { word: 'is', speaker: 1, start: 1.3, end: 1.4 },
          { word: 'speaker', speaker: 0, start: 2.0, end: 2.3 },
          { word: 'one', speaker: 0, start: 2.4, end: 2.6 },
          { word: 'then', speaker: 0, start: 3.0, end: 3.2 },
          { word: 'speaker', speaker: 1, start: 4.0, end: 4.3 },
          { word: 'two', speaker: 1, start: 4.4, end: 4.6 },
        ],
        paragraphs: {
          paragraphs: [
            { speaker: 0, sentences: [{ text: 'Hello world.' }], start: 0, end: 0.7 },
            { speaker: 1, sentences: [{ text: 'This is.' }], start: 1.0, end: 1.4 },
            { speaker: 0, sentences: [{ text: 'Speaker one then.' }], start: 2.0, end: 3.2 },
            { speaker: 1, sentences: [{ text: 'Speaker two.' }], start: 4.0, end: 4.6 },
          ]
        }
      }]
    }],
    utterances: [
      { speaker: 0, transcript: 'Hello world.', start: 0, end: 0.7 },
      { speaker: 1, transcript: 'This is.', start: 1.0, end: 1.4 },
      { speaker: 0, transcript: 'Speaker one then.', start: 2.0, end: 3.2 },
      { speaker: 1, transcript: 'Speaker two.', start: 4.0, end: 4.6 },
    ]
  },
  metadata: { duration: 5.0 }
}

describe('parseDeepgramResponse', () => {
  it('returns full transcript and speaker segments', () => {
    const result = parseDeepgramResponse(mockDiarizedResponse)
    expect(result.fullTranscript).toContain('Hello world')
    expect(result.speakerSegments).toHaveLength(4)
    expect(result.durationSeconds).toBe(5)
  })

  it('maps speaker numbers to speaker labels', () => {
    const result = parseDeepgramResponse(mockDiarizedResponse)
    expect(result.speakerSegments[0].speaker).toBe('speaker_0')
    expect(result.speakerSegments[1].speaker).toBe('speaker_1')
  })
})

describe('extractSubjectTranscript', () => {
  it('returns text from the speaker with the most words', () => {
    const segments = [
      { speaker: 'speaker_0', text: 'This is a long response from the subject yes indeed', start_ms: 0, end_ms: 5000 },
      { speaker: 'speaker_1', text: 'Short question', start_ms: 5100, end_ms: 6000 },
      { speaker: 'speaker_0', text: 'Another long answer from the same speaker', start_ms: 6100, end_ms: 9000 },
    ]
    const result = extractSubjectTranscript(segments)
    expect(result).toContain('long response')
    expect(result).toContain('Another long answer')
    expect(result).not.toContain('Short question')
  })
})
