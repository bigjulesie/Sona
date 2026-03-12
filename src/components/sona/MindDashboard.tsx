// src/components/sona/MindDashboard.tsx
'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { MindCharacterTab } from './MindCharacterTab'
import { MindCurrentsTab } from './MindCurrentsTab'

const GEIST = 'var(--font-geist-sans)'

interface Props {
  initialData: {
    synthesis_status: string
    last_synthesised_at: string | null
    dimensions: Record<string, any[]>
    currents: any[]
  }
}

export function MindDashboard({ initialData }: Props) {
  const [data, setData] = useState(initialData)
  const [activeTab, setActiveTab] = useState<'character' | 'currents'>('character')
  const [deepening, setDeepening] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleDeepen = useCallback(async () => {
    setDeepening(true)
    const res = await fetch('/api/creator/deepen', { method: 'POST' })
    if (!res.ok) {
      setDeepening(false)
      return
    }
    // Poll until status changes from synthesising (max 5 minutes)
    let attempts = 0
    const MAX_ATTEMPTS = 100 // 100 × 3s = 5 min
    pollRef.current = setInterval(async () => {
      attempts++
      if (attempts > MAX_ATTEMPTS) {
        clearInterval(pollRef.current!)
        pollRef.current = null
        setDeepening(false)
        return
      }
      const pollRes = await fetch('/api/creator/mind')
      const fresh = await pollRes.json()
      if (fresh.synthesis_status !== 'synthesising') {
        clearInterval(pollRef.current!)
        pollRef.current = null
        setData(fresh)
        setDeepening(false)
      }
    }, 3000)
  }, [])

  const statusLabel = deepening || data.synthesis_status === 'synthesising'
    ? 'Deepening…'
    : data.synthesis_status === 'ready'
      ? 'Up to date'
      : data.synthesis_status === 'error'
        ? 'Something went wrong — try again'
        : "Your Sona's depth hasn't been built yet"

  const canDeepen = !deepening && data.synthesis_status !== 'synthesising'

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 clamp(24px, 4vw, 48px) 4rem' }}>
      {/* Status bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem 0',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        marginBottom: '2.5rem',
      }}>
        <div>
          <p style={{ fontFamily: GEIST, fontSize: '0.875rem', color: '#1a1a1a', margin: 0 }}>{statusLabel}</p>
          {data.last_synthesised_at && data.synthesis_status === 'ready' && (
            <p style={{ fontFamily: GEIST, fontSize: '0.75rem', color: '#b0b0b0', margin: '2px 0 0' }}>
              Last deepened {new Date(data.last_synthesised_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
        <button
          onClick={handleDeepen}
          disabled={!canDeepen}
          className="sona-btn-dark"
          style={{
            fontFamily: GEIST,
            fontSize: '0.875rem',
            fontWeight: 500,
            color: canDeepen ? '#fff' : '#b0b0b0',
            backgroundColor: canDeepen ? '#1a1a1a' : 'rgba(0,0,0,0.05)',
            border: 'none',
            borderRadius: 980,
            padding: '10px 28px',
            cursor: canDeepen ? 'pointer' : 'default',
            transition: 'opacity 0.15s',
          }}
        >
          {deepening ? 'Deepening…' : 'Deepen'}
        </button>
      </div>

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
        {(['character', 'currents'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              fontFamily: GEIST,
              fontSize: '0.875rem',
              fontWeight: activeTab === tab ? 500 : 400,
              color: activeTab === tab ? '#1a1a1a' : '#6b6b6b',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #1a1a1a' : '2px solid transparent',
              padding: '0 0 0.75rem',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab === 'character' ? 'Character' : 'Currents'}
          </button>
        ))}
      </div>

      {activeTab === 'character'
        ? <MindCharacterTab grouped={data.dimensions} />
        : <MindCurrentsTab currents={data.currents} />
      }
    </div>
  )
}
