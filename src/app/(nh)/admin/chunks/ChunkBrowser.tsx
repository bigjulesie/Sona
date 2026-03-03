'use client'

import { useState, useEffect, useCallback } from 'react'

interface Portrait {
  id: string
  display_name: string
}

interface Chunk {
  id: string
  portrait_id: string
  content: string
  source_title: string | null
  source_type: string | null
  min_tier: string
  chunk_index: number
  created_at: string
}

interface Props {
  portraits: Portrait[]
}

export function ChunkBrowser({ portraits }: Props) {
  const [portraitId, setPortraitId] = useState(portraits[0]?.id ?? '')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [portraitId, debouncedSearch])

  const fetchChunks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (portraitId) params.set('portrait_id', portraitId)
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/admin/chunks?${params}`)
      if (!res.ok) return
      const data = await res.json()
      setChunks(data.chunks ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [portraitId, debouncedSearch, page])

  useEffect(() => {
    fetchChunks()
  }, [fetchChunks])

  async function handleDelete(id: string) {
    if (!confirm('Delete this knowledge chunk? This cannot be undone.')) return
    setDeleting(id)
    try {
      await fetch('/api/admin/chunks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setChunks(prev => prev.filter(c => c.id !== id))
      setTotal(prev => prev - 1)
    } finally {
      setDeleting(null)
    }
  }

  const pageSize = 25
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        {/* Portrait filter */}
        <select
          value={portraitId}
          onChange={e => setPortraitId(e.target.value)}
          className="bg-vellum border border-brass/20 rounded px-3 py-2 text-sm text-ink focus:outline-none focus:border-brass"
        >
          <option value="">All Sonas</option>
          {portraits.map(p => (
            <option key={p.id} value={p.id}>{p.display_name}</option>
          ))}
        </select>

        {/* Search */}
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search chunk content…"
          className="flex-1 bg-vellum border border-brass/20 rounded px-3 py-2 text-sm text-ink placeholder:text-mist/60 focus:outline-none focus:border-brass"
        />
      </div>

      {/* Stats */}
      <p className="text-xs text-mist mb-4 tracking-wide">
        {loading ? 'Loading…' : `${total.toLocaleString()} chunk${total !== 1 ? 's' : ''}`}
      </p>

      {/* Table */}
      <div className="border border-brass/20 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-vellum border-b border-brass/20">
            <tr>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-mist font-normal">Content</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-mist font-normal hidden md:table-cell">Source</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-mist font-normal hidden md:table-cell">Tier</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-mist font-normal hidden lg:table-cell">Date</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-mist text-sm">Loading…</td>
              </tr>
            ) : chunks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-mist text-sm italic">No chunks found</td>
              </tr>
            ) : (
              chunks.map(chunk => (
                <>
                  <tr
                    key={chunk.id}
                    className="border-b border-brass/10 last:border-0 hover:bg-vellum/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedId(expandedId === chunk.id ? null : chunk.id)}
                        className="text-left w-full"
                      >
                        <p className="text-ink text-sm leading-snug line-clamp-2">
                          {chunk.content}
                        </p>
                        <p className="text-xs text-mist mt-0.5">#{chunk.chunk_index}</p>
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-sm text-ink truncate max-w-[180px]">{chunk.source_title ?? '—'}</p>
                      <p className="text-xs text-mist">{chunk.source_type ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs bg-brass/10 text-brass px-2 py-0.5 rounded-full border border-brass/20">
                        {chunk.min_tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <p className="text-xs text-mist">
                        {new Date(chunk.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(chunk.id)}
                        disabled={deleting === chunk.id}
                        className="text-xs text-mist hover:text-red-600 transition-colors disabled:opacity-40"
                        title="Delete chunk"
                      >
                        {deleting === chunk.id ? '…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === chunk.id && (
                    <tr key={`${chunk.id}-expanded`} className="bg-vellum/30 border-b border-brass/10">
                      <td colSpan={5} className="px-4 py-3">
                        <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed font-mono text-xs">
                          {chunk.content}
                        </p>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="text-sm text-mist hover:text-ink transition-colors disabled:opacity-30"
          >
            ← Previous
          </button>
          <p className="text-xs text-mist">
            Page {page} of {totalPages}
          </p>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="text-sm text-mist hover:text-ink transition-colors disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
