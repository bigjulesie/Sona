import Anthropic from '@anthropic-ai/sdk'

export interface FilterResult {
  identity_match: number
  relevance: number
  reason: string
}

export interface CandidateArticle {
  url: string
  domain: string
  title: string
  snippet: string
}

const IDENTITY_THRESHOLD = 0.7
const RELEVANCE_THRESHOLD = 0.5

export function parseFilterResponse(raw: string): FilterResult | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(cleaned)
    if (
      typeof parsed.identity_match !== 'number' ||
      typeof parsed.relevance !== 'number'
    ) return null
    return {
      identity_match: parsed.identity_match,
      relevance: parsed.relevance,
      reason: parsed.reason ?? '',
    }
  } catch {
    return null
  }
}

export function meetsThresholds(result: FilterResult): boolean {
  return result.identity_match >= IDENTITY_THRESHOLD && result.relevance >= RELEVANCE_THRESHOLD
}

/**
 * Ask Claude Haiku whether a candidate article is about the right person
 * and contains material useful for character synthesis.
 * Returns null on API failure — caller treats null as failed filter (discard).
 */
export async function filterCandidate(
  creatorName: string,
  searchContext: string | null,
  candidate: CandidateArticle,
): Promise<FilterResult | null> {
  const client = new Anthropic()
  const contextLine = searchContext ? `Context about the person: ${searchContext}` : ''

  const prompt = `You are evaluating whether a web article is about a specific person and contains material useful for building a character profile.

Creator name: ${creatorName}
${contextLine}
URL domain: ${candidate.domain}
Article title: ${candidate.title}
Content preview: ${candidate.snippet}

Return JSON with exactly these fields:
- identity_match: 0.0–1.0 (how confident you are this is about the correct ${creatorName})
- relevance: 0.0–1.0 (how useful this content is for understanding their personality, beliefs, expertise, or experiences)
- reason: brief explanation (1–2 sentences)

Respond with raw JSON only, no markdown.`

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    return parseFilterResponse(text)
  } catch {
    return null
  }
}
