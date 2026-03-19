'use client'

import { useState } from 'react'
import { updateVoice } from './actions'

const GEIST = 'var(--font-geist-sans)'

interface Props {
  currentGender: 'male' | 'female' | null
}

export function VoiceSelector({ currentGender }: Props) {
  const [selected, setSelected] = useState<'male' | 'female' | null>(currentGender)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSelect(gender: 'male' | 'female') {
    if (gender === selected) return
    setSelected(gender)
    setSaved(false)
    setSaving(true)
    await updateVoice(gender)
    setSaving(false)
    setSaved(true)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(['male', 'female'] as const).map(gender => {
          const isActive = selected === gender
          return (
            <button
              key={gender}
              onClick={() => handleSelect(gender)}
              disabled={saving}
              style={{
                fontFamily: GEIST,
                fontSize: '0.875rem',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? '#fff' : '#6b6b6b',
                backgroundColor: isActive ? '#1a1a1a' : 'transparent',
                border: isActive ? '1px solid #1a1a1a' : '1px solid rgba(0,0,0,0.12)',
                borderRadius: '980px',
                padding: '8px 22px',
                cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.6 : 1,
                transition: 'all 0.15s ease',
                textTransform: 'capitalize',
              }}
            >
              {gender}
            </button>
          )
        })}
        {saving && (
          <span style={{ fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 300, color: '#b0b0b0', alignSelf: 'center' }}>
            Saving…
          </span>
        )}
        {saved && !saving && (
          <span style={{ fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 300, color: '#9b9b9b', alignSelf: 'center' }}>
            Saved
          </span>
        )}
      </div>
      {!selected && (
        <p style={{ fontFamily: GEIST, fontSize: '0.75rem', color: '#b0b0b0', margin: '8px 0 0' }}>
          Select the voice your subscribers will hear when talking with your Sona.
        </p>
      )}
    </div>
  )
}
