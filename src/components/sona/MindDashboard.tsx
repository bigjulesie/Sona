// src/components/sona/MindDashboard.tsx
'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { MindCharacterTab } from './MindCharacterTab'
import { MindCurrentsTab } from './MindCurrentsTab'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

interface Props {
  initialData: {
    synthesis_status: string
    last_synthesised_at: string | null
    dimensions: Record<string, any[]>
    currents: any[]
    sourceCount?: number
  }
}

export function MindDashboard({ initialData }: Props) {
  const [data, setData] = useState(initialData)
  const [activeTab, setActiveTab] = useState<'character' | 'currents'>('character')
  const [deepening, setDeepening] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    let attempts = 0
    const MAX_ATTEMPTS = 100
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

  const isSynthesising = deepening || data.synthesis_status === 'synthesising'
  const canDeepen = !deepening && data.synthesis_status !== 'synthesising'
  const sourceCount = data.sourceCount ?? initialData.sourceCount ?? 0

  const renderStatusArea = () => {
    // In-progress state
    if (isSynthesising) {
      return (
        <div style={{
          borderRadius: 14,
          border: '1px solid rgba(0,0,0,0.07)',
          padding: '2rem',
          marginBottom: '2.5rem',
          background: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
        }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: '#DE3E7B',
              animation: 'pulse 1.4s ease-in-out infinite',
            }} />
          </div>
          <p style={{ fontFamily: GEIST, fontSize: '0.9375rem', fontWeight: 500, color: '#1a1a1a', margin: 0 }}>
            Your Sona is deepening…
          </p>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.75); } }`}</style>
        </div>
      )
    }

    // Error state
    if (data.synthesis_status === 'error') {
      return (
        <div style={{
          borderRadius: 14,
          border: '1px solid rgba(222,62,123,0.2)',
          padding: '1.5rem 2rem',
          marginBottom: '2.5rem',
          background: 'rgba(222,62,123,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem',
          flexWrap: 'wrap',
        }}>
          <p style={{ fontFamily: GEIST, fontSize: '0.9375rem', color: '#1a1a1a', margin: 0 }}>
            Something went wrong — try again.
          </p>
          <button
            onClick={handleDeepen}
            className="sona-btn-dark"
            style={{
              fontFamily: GEIST,
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#fff',
              backgroundColor: '#1a1a1a',
              border: 'none',
              borderRadius: 980,
              padding: '10px 28px',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Try again
          </button>
        </div>
      )
    }

    // Never deepened — first-run state
    if (data.synthesis_status === 'never' || !data.synthesis_status) {
      return (
        <div style={{
          borderRadius: 14,
          border: '1px solid rgba(0,0,0,0.07)',
          padding: '2rem',
          marginBottom: '2.5rem',
          background: '#fafafa',
        }}>
          <p style={{
            fontFamily: CORMORANT,
            fontSize: 'clamp(1.25rem, 2.5vw, 1.5rem)',
            fontStyle: 'italic',
            fontWeight: 400,
            letterSpacing: '-0.01em',
            color: '#1a1a1a',
            margin: '0 0 0.75rem',
            lineHeight: 1.35,
          }}>
            Your Sona is still finding its depth.
          </p>
          <p style={{ fontFamily: GEIST, fontSize: '0.875rem', color: '#6b6b6b', margin: '0 0 1.5rem', lineHeight: 1.65, maxWidth: 480 }}>
            The more of yourself you share — your writing, your talks, your thinking — the more precisely your Sona reflects you. Keep adding to{' '}
            <a href="/dashboard/content" style={{ color: '#1a1a1a', textDecoration: 'underline' }}>Context</a>
            {' '}and your Sona's depth will grow.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleDeepen}
              disabled={!canDeepen}
              className="sona-btn-outline"
              style={{
                fontFamily: GEIST,
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: '#1a1a1a',
                backgroundColor: 'transparent',
                border: '1px solid rgba(0,0,0,0.15)',
                borderRadius: 980,
                padding: '8px 22px',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              Deepen
            </button>
            <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', color: '#b0b0b0', margin: 0 }}>
              or it will update on its own as you add more
            </p>
          </div>
        </div>
      )
    }

    // Ready state
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.125rem 0',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        marginBottom: '2.5rem',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <div>
          <p style={{ fontFamily: GEIST, fontSize: '0.875rem', color: '#1a1a1a', margin: 0, fontWeight: 500 }}>
            Depth is up to date
          </p>
          {data.last_synthesised_at && (
            <p style={{ fontFamily: GEIST, fontSize: '0.75rem', color: '#b0b0b0', margin: '3px 0 0' }}>
              Last updated {new Date(data.last_synthesised_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              {' — '}use Refresh depth after adding significant new content
            </p>
          )}
        </div>
        <button
          onClick={handleDeepen}
          disabled={!canDeepen}
          className="sona-btn-outline"
          style={{
            fontFamily: GEIST,
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: '#1a1a1a',
            backgroundColor: 'transparent',
            border: '1px solid rgba(0,0,0,0.15)',
            borderRadius: 980,
            padding: '8px 22px',
            cursor: 'pointer',
            transition: 'opacity 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          Refresh depth
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 clamp(24px, 4vw, 48px) 4rem' }}>
      {renderStatusArea()}

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
            }}
          >
            {tab === 'character' ? 'Character' : 'Patterns'}
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
