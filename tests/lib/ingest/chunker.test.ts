import { describe, it, expect } from 'vitest'
import { chunkText } from '@/lib/ingest/chunker'

describe('chunkText', () => {
  it('splits text into chunks respecting paragraph boundaries', () => {
    const text = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.'
    const chunks = chunkText(text, { maxChunkSize: 30, overlap: 0 })
    expect(chunks.length).toBeGreaterThan(1)
    chunks.forEach(c => expect(c.length).toBeLessThanOrEqual(30))
  })

  it('returns full text as single chunk when under max size', () => {
    const text = 'Short text.'
    const chunks = chunkText(text, { maxChunkSize: 1000, overlap: 0 })
    expect(chunks).toEqual(['Short text.'])
  })

  it('preserves content without data loss', () => {
    const text = 'A.\n\nB.\n\nC.'
    const chunks = chunkText(text, { maxChunkSize: 5, overlap: 0 })
    const reassembled = chunks.join('')
    expect(reassembled).toContain('A.')
    expect(reassembled).toContain('B.')
    expect(reassembled).toContain('C.')
  })
})
