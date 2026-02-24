'use client'

import { useState } from 'react'
import { createPortrait, updatePortrait } from './actions'

interface Portrait {
  id: string
  slug: string
  display_name: string
  system_prompt: string
}

const inputClass = 'w-full bg-transparent border-b border-brass/30 py-1.5 text-ink text-sm focus:outline-none focus:border-brass placeholder:text-mist/40 transition-colors'
const labelClass = 'block text-xs tracking-widest uppercase text-mist mb-2'

function PortraitForm({
  initial,
  onSave,
}: {
  initial: { display_name: string; slug: string; system_prompt: string }
  onSave: (fields: { display_name: string; slug: string; system_prompt: string }) => Promise<{ success?: boolean; error?: string }>
}) {
  const [displayName, setDisplayName] = useState(initial.display_name)
  const [slug, setSlug] = useState(initial.slug)
  const [systemPrompt, setSystemPrompt] = useState(initial.system_prompt)
  const [status, setStatus] = useState<{ success?: boolean; error?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  // Auto-generate slug from display name (only when slug hasn't been manually edited)
  function handleDisplayNameChange(value: string) {
    setDisplayName(value)
    if (slug === '' || slug === toSlug(displayName)) {
      setSlug(toSlug(value))
    }
  }

  async function handleSave() {
    setLoading(true)
    setStatus(null)
    const res = await onSave({ display_name: displayName, slug, system_prompt: systemPrompt })
    setStatus(res)
    setLoading(false)
  }

  return (
    <div className="bg-vellum border border-brass/20 rounded p-6 space-y-5">
      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className={labelClass}>Display Name</label>
          <input
            value={displayName}
            onChange={e => handleDisplayNameChange(e.target.value)}
            placeholder="e.g. Kirit Shah"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Slug</label>
          <input
            value={slug}
            onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            placeholder="e.g. kirit-shah"
            className={inputClass}
          />
          <p className="text-xs text-mist/60 mt-1">Lowercase letters, numbers and hyphens only</p>
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <label className={labelClass}>System Prompt</label>
          <span className="text-xs text-mist/60">{systemPrompt.length} characters</span>
        </div>
        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          rows={20}
          placeholder="You are…"
          className="w-full bg-parchment border border-brass/20 rounded px-3 py-2 text-sm font-mono
                     text-ink resize-y leading-relaxed focus:outline-none focus:border-brass transition-colors
                     placeholder:text-mist/40"
        />
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={loading || !displayName || !slug || !systemPrompt}
          className="px-6 py-2.5 bg-ink text-parchment text-xs tracking-widest uppercase hover:bg-ink/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving…' : 'Save'}
        </button>
        {status?.success && <span className="text-brass text-sm">Saved.</span>}
        {status?.error && <span className="text-red-700 text-sm">{status.error}</span>}
      </div>
    </div>
  )
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function PortraitEditor({ portraits: initial }: { portraits: Portrait[] }) {
  const [portraits, setPortraits] = useState(initial)
  const [selectedId, setSelectedId] = useState(initial[0]?.id ?? null)
  const [creating, setCreating] = useState(initial.length === 0)

  const selected = portraits.find(p => p.id === selectedId)

  async function handleCreate(fields: { display_name: string; slug: string; system_prompt: string }) {
    const formData = new FormData()
    formData.set('display_name', fields.display_name)
    formData.set('slug', fields.slug)
    formData.set('system_prompt', fields.system_prompt)
    const res = await createPortrait(formData)
    if (res.success && res.id) {
      const newPortrait = { id: res.id, ...fields }
      setPortraits(prev => [...prev, newPortrait])
      setSelectedId(res.id)
      setCreating(false)
    }
    return res
  }

  async function handleUpdate(fields: { display_name: string; slug: string; system_prompt: string }) {
    if (!selectedId) return { error: 'No portrait selected' }
    const res = await updatePortrait(selectedId, fields)
    if (res.success) {
      setPortraits(prev => prev.map(p => p.id === selectedId ? { ...p, ...fields } : p))
    }
    return res
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header with portrait switcher and new button */}
      <div className="flex items-center gap-3">
        {portraits.length > 0 && (
          <select
            value={creating ? '' : (selectedId ?? '')}
            onChange={e => { setSelectedId(e.target.value); setCreating(false) }}
            className="bg-parchment border border-brass/20 rounded px-3 py-2 text-sm text-ink focus:outline-none focus:border-brass transition-colors"
          >
            {portraits.map(p => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => setCreating(true)}
          className={`px-4 py-2 text-xs tracking-widest uppercase transition-colors ${
            creating
              ? 'bg-ink text-parchment'
              : 'border border-brass/30 text-mist hover:text-ink hover:border-brass'
          }`}
        >
          + New Sona
        </button>
      </div>

      {creating ? (
        <PortraitForm
          key="new"
          initial={{ display_name: '', slug: '', system_prompt: '' }}
          onSave={handleCreate}
        />
      ) : selected ? (
        <PortraitForm
          key={selected.id}
          initial={selected}
          onSave={handleUpdate}
        />
      ) : null}
    </div>
  )
}
