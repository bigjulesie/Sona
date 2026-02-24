'use client'

import { useState } from 'react'
import { updateSystemPrompt } from './actions'

interface Portrait {
  id: string
  slug: string
  display_name: string
  system_prompt: string
}

export default function PortraitEditor({ portraits }: { portraits: Portrait[] }) {
  const [selected, setSelected] = useState(portraits[0]?.id ?? '')
  const [prompt, setPrompt] = useState(portraits[0]?.system_prompt ?? '')
  const [status, setStatus] = useState<{ success?: boolean; error?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  function handlePortraitChange(id: string) {
    const portrait = portraits.find(p => p.id === id)
    if (portrait) {
      setSelected(id)
      setPrompt(portrait.system_prompt)
      setStatus(null)
    }
  }

  async function handleSave() {
    setLoading(true)
    setStatus(null)
    const res = await updateSystemPrompt(selected, prompt)
    setStatus(res)
    setLoading(false)
  }

  const currentPortrait = portraits.find(p => p.id === selected)

  return (
    <div className="space-y-4 max-w-3xl">
      {portraits.length > 1 && (
        <div>
          <label className="block text-xs tracking-widest uppercase text-mist mb-2">Portrait</label>
          <select
            value={selected}
            onChange={e => handlePortraitChange(e.target.value)}
            className="bg-parchment border border-brass/20 rounded px-3 py-2 text-sm text-ink focus:outline-none focus:border-brass"
          >
            {portraits.map(p => (
              <option key={p.id} value={p.id}>{p.display_name} ({p.slug})</option>
            ))}
          </select>
        </div>
      )}

      {currentPortrait && portraits.length === 1 && (
        <p className="text-sm text-mist">
          <span className="text-ink">{currentPortrait.display_name}</span>
          <span className="mx-2 text-brass/40">·</span>
          <span>{currentPortrait.slug}</span>
        </p>
      )}

      <div className="bg-vellum border border-brass/20 rounded p-6 space-y-4">
        <div>
          <label className="block text-xs tracking-widest uppercase text-mist mb-2">System Prompt</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={24}
            className="w-full bg-parchment border border-brass/20 rounded px-3 py-2 text-sm font-mono
                       text-ink resize-y leading-relaxed focus:outline-none focus:border-brass transition-colors"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={loading || !selected}
            className="px-6 py-2.5 bg-ink text-parchment text-xs tracking-widest uppercase hover:bg-ink/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
          <span className="text-xs text-mist">{prompt.length} characters</span>
        </div>

        {status?.success && (
          <p className="text-brass text-sm">Saved.</p>
        )}
        {status?.error && (
          <p className="text-red-700 text-sm">{status.error}</p>
        )}
      </div>
    </div>
  )
}
