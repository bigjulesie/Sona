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
          <label className="text-xs text-stone-500 block mb-1">Portrait</label>
          <select
            value={selected}
            onChange={e => handlePortraitChange(e.target.value)}
            className="px-3 py-2 border border-stone-200 rounded text-sm"
          >
            {portraits.map(p => (
              <option key={p.id} value={p.id}>{p.display_name} ({p.slug})</option>
            ))}
          </select>
        </div>
      )}

      {currentPortrait && portraits.length === 1 && (
        <p className="text-sm text-stone-500">
          <span className="font-medium text-stone-700">{currentPortrait.display_name}</span>
          {' '}<span className="text-stone-400">· {currentPortrait.slug}</span>
        </p>
      )}

      <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
        <div>
          <label className="text-xs text-stone-500 block mb-1">System Prompt</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={24}
            className="w-full px-3 py-2 border border-stone-200 rounded text-sm font-mono resize-y leading-relaxed"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={loading || !selected}
            className="px-4 py-2 bg-stone-900 text-white rounded text-sm hover:bg-stone-800 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
          <span className="text-xs text-stone-400">{prompt.length} characters</span>
        </div>

        {status?.success && (
          <p className="text-green-700 text-sm bg-green-50 rounded p-3">Saved.</p>
        )}
        {status?.error && (
          <p className="text-red-700 text-sm bg-red-50 rounded p-3">{status.error}</p>
        )}
      </div>
    </div>
  )
}
