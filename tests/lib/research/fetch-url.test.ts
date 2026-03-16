import { describe, it, expect } from 'vitest'
import { extractArticleText } from '@/lib/research/fetch-url'

describe('extractArticleText', () => {
  it('extracts article text from HTML', async () => {
    const html = `<html><head><title>Test Article</title></head><body>
      <article><p>This is the article content about the topic.</p></article>
    </body></html>`
    const result = await extractArticleText(html, 'https://example.com/article')
    expect(result.text).toContain('article content')
    expect(result.title).toBe('Test Article')
  })

  it('returns empty text for structureless HTML', async () => {
    const html = `<html><body></body></html>`
    const result = await extractArticleText(html, 'https://example.com/')
    expect(result.text).toBe('')
  })

  it('does not throw on malformed HTML', async () => {
    await expect(extractArticleText('<not valid html>', 'https://example.com/')).resolves.toBeDefined()
  })
})
