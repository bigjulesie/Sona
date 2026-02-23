'use client'

import { useState } from 'react'
import { ingestContent } from './actions'

export default function IngestPage() {
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
    <div>
      <h2 className="text-lg font-medium text-stone-900 mb-6">Ingest Content</h2>

      <form action={handleSubmit} className="bg-white border border-stone-200 rounded-lg p-6 space-y-4 max-w-2xl">
        <div>
          <label className="text-xs text-stone-500 block mb-1">Portrait ID</label>
          <input name="portrait_id" required
            className="w-full px-3 py-2 border border-stone-200 rounded text-sm" />
        </div>
        <div>
          <label className="text-xs text-stone-500 block mb-1">Source Title</label>
          <input name="source_title"
            className="w-full px-3 py-2 border border-stone-200 rounded text-sm" />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs text-stone-500 block mb-1">Source Type</label>
            <select name="source_type" className="w-full px-3 py-2 border border-stone-200 rounded text-sm">
              <option value="transcript">Transcript</option>
              <option value="interview">Interview</option>
              <option value="letter">Letter</option>
              <option value="article">Article</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-stone-500 block mb-1">Minimum Tier</label>
            <select name="min_tier" className="w-full px-3 py-2 border border-stone-200 rounded text-sm">
              <option value="public">Public</option>
              <option value="acquaintance">Acquaintance</option>
              <option value="colleague">Colleague</option>
              <option value="family">Family</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-stone-500 block mb-1">Content</label>
          <textarea name="content" required rows={12}
            placeholder="Paste transcript or document text here..."
            className="w-full px-3 py-2 border border-stone-200 rounded text-sm resize-y" />
        </div>
        <button type="submit" disabled={loading}
          className="px-4 py-2 bg-stone-900 text-white rounded text-sm hover:bg-stone-800 disabled:opacity-50">
          {loading ? 'Processing...' : 'Ingest Content'}
        </button>

        {result?.success && (
          <p className="text-green-700 text-sm bg-green-50 rounded p-3">
            Successfully created {result.chunksCreated} chunks.
          </p>
        )}
        {result?.error && (
          <p className="text-red-700 text-sm bg-red-50 rounded p-3">{result.error}</p>
        )}
      </form>
    </div>
  )
}
