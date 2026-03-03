'use client'

import { useState } from 'react'
import { ingestContent } from './actions'

interface Portrait {
  id: string
  display_name: string
}

const inputClass = 'w-full bg-transparent border-b border-brass/30 py-1.5 text-ink text-sm focus:outline-none focus:border-brass placeholder:text-mist/50 transition-colors'
const selectClass = 'w-full bg-parchment border border-brass/20 rounded px-3 py-2 text-sm text-ink focus:outline-none focus:border-brass transition-colors'
const labelClass = 'block text-xs tracking-widest uppercase text-mist mb-2'

export function IngestForm({ portraits }: { portraits: Portrait[] }) {
  const [result, setResult] = useState<{ success?: boolean; chunksCreated?: number; error?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setResult(null)
    const res = await ingestContent(formData)
    setResult(res)
    setLoading(false)
  }

  return (
    <form action={handleSubmit} className="bg-vellum border border-brass/20 rounded p-6 space-y-5 max-w-2xl">
      <div>
        <label className={labelClass}>Sona</label>
        <select name="portrait_id" required className={selectClass}>
          {portraits.map(p => (
            <option key={p.id} value={p.id}>{p.display_name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Source Title</label>
        <input name="source_title" className={inputClass} placeholder="e.g. Interview with The Guardian, 2019" />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className={labelClass}>Source Type</label>
          <select name="source_type" className={selectClass}>
            <option value="transcript">Transcript</option>
            <option value="interview">Interview</option>
            <option value="letter">Letter</option>
            <option value="article">Article</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="flex-1">
          <label className={labelClass}>Minimum Tier</label>
          <select name="min_tier" className={selectClass}>
            <option value="public">Public</option>
            <option value="acquaintance">Acquaintance</option>
            <option value="colleague">Colleague</option>
            <option value="family">Family</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Content</label>
        <textarea
          name="content"
          required
          rows={12}
          placeholder="Paste transcript or document text here…"
          className="w-full bg-parchment border border-brass/20 rounded px-3 py-2 text-sm text-ink
                     focus:outline-none focus:border-brass placeholder:text-mist/50
                     resize-y transition-colors leading-relaxed"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="px-6 py-2.5 bg-ink text-parchment text-xs tracking-widest uppercase hover:bg-ink/90 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Processing…' : 'Ingest Content'}
      </button>

      {result?.success && (
        <p className="text-brass text-sm">
          Successfully created {result.chunksCreated} chunks.
        </p>
      )}
      {result?.error && (
        <p className="text-red-700 text-sm">{result.error}</p>
      )}
    </form>
  )
}
