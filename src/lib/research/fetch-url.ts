// src/lib/research/fetch-url.ts
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'

export interface FetchedArticle {
  text: string
  title: string | null
}

/**
 * Extract article text from raw HTML using @mozilla/readability.
 * Does not perform any network request.
 */
export async function extractArticleText(
  html: string,
  url: string,
): Promise<FetchedArticle> {
  try {
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    return {
      text: article?.textContent?.trim() ?? '',
      title: article?.title ?? null,
    }
  } catch {
    return { text: '', title: null }
  }
}

/**
 * Fetch a URL and extract article text.
 * Returns null on network error or non-200 response.
 */
export async function fetchUrl(url: string): Promise<FetchedArticle | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SonaBot/1.0)' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const html = await res.text()
    return extractArticleText(html, url)
  } catch {
    return null
  }
}
