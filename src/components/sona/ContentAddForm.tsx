'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { TIER_LABELS, CREATOR_TIERS } from '@/lib/tiers'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

const SOURCE_TYPES = [
  { value: 'transcript',       label: 'Transcript' },
  { value: 'interview',        label: 'Interview' },
  { value: 'interview_audio',  label: 'Interview (audio)' },
  { value: 'article',          label: 'Article' },
  { value: 'book',             label: 'Book' },
  { value: 'essay',            label: 'Essay' },
  { value: 'speech',           label: 'Speech' },
  { value: 'letter',           label: 'Letter' },
  { value: 'other',            label: 'Other' },
]

function isAudioFile(file: File) {
  return file.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|flac|aac|webm)$/i.test(file.name)
}

interface Props {
  portraitId: string
  portraitName: string
  onSuccess: () => void
}

export function ContentAddForm({ portraitId, portraitName, onSuccess }: Props) {
  const [inputMode, setInputMode] = useState<'paste' | 'upload'>('paste')
  const [sourceDate, setSourceDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const fileLabelRef = useRef<HTMLParagraphElement>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('portrait_id', portraitId)
    if (sourceDate) formData.set('source_date', sourceDate)

    // If paste mode, remove file field
    if (inputMode === 'paste') {
      formData.delete('file')
    }

    try {
      const file = inputMode === 'upload' ? fileRef.current?.files?.[0] : undefined

      // Audio file: use presigned URL flow
      if (file && isAudioFile(file)) {
        const initData = new FormData()
        initData.set('portrait_id', portraitId)
        initData.set('title', formData.get('title') as string)
        initData.set('source_type', formData.get('source_type') as string)
        initData.set('min_tier', formData.get('min_tier') as string)
        initData.set('filename', file.name)
        initData.set('content_type', file.type || 'audio/mpeg')
        if (sourceDate) initData.set('source_date', sourceDate)

        const initRes = await fetch('/api/creator/ingest', { method: 'POST', body: initData })
        const initJson = await initRes.json()
        if (!initRes.ok) {
          setError(initJson.error ?? 'Something went wrong')
          return
        }

        const { upload_url, source_id } = initJson
        if (!upload_url || !source_id) {
          setError('Upload not available for this file type')
          return
        }

        // PUT file directly to presigned URL
        const uploadRes = await fetch(upload_url, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'audio/mpeg' },
        })
        if (!uploadRes.ok) {
          setError('File upload failed. Please try again.')
          return
        }

        // Confirm upload
        const confirmRes = await fetch('/api/creator/ingest/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_id }),
        })
        const confirmJson = await confirmRes.json()
        if (!confirmRes.ok) {
          setError(confirmJson.error ?? 'Something went wrong')
          return
        }
      } else {
        // Non-audio: existing FormData submission
        const res = await fetch('/api/creator/ingest', { method: 'POST', body: formData })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? 'Something went wrong')
          return
        }
      }

      form.reset()
      setSourceDate('')
      router.refresh()
      onSuccess()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const labelStyle = {
    fontFamily: GEIST,
    fontSize: '0.6875rem' as const,
    fontWeight: 500,
    letterSpacing: '0.09em',
    textTransform: 'uppercase' as const,
    color: '#b0b0b0',
    display: 'block',
    marginBottom: 10,
  }

  const inputStyle = {
    fontFamily: GEIST,
    fontSize: '0.9375rem',
    fontWeight: 300,
    color: '#1a1a1a',
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid rgba(0,0,0,0.15)',
    padding: '8px 0',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23b0b0b0' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat' as const,
    backgroundPosition: 'right 4px center',
    paddingRight: 24,
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Adding to label */}
      <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 300, color: '#b0b0b0', margin: 0 }}>
        Adding content to{' '}
        <span style={{ fontFamily: CORMORANT, fontStyle: 'italic', fontWeight: 400, color: '#6b6b6b', fontSize: '0.9375rem' }}>
          {portraitName}
        </span>
      </p>

      {/* Title */}
      <div>
        <label style={labelStyle}>Source title</label>
        <input
          name="title"
          required
          placeholder="e.g. Interview with The Guardian, 2019"
          className="sona-input"
          style={inputStyle}
        />
      </div>

      {/* Source date */}
      <div>
        <label style={labelStyle}>Date <span style={{ textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>(optional)</span></label>
        <input
          type="date"
          name="source_date"
          value={sourceDate}
          onChange={e => setSourceDate(e.target.value)}
          className="sona-input"
          style={inputStyle}
        />
      </div>

      {/* Type + Tier row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <label style={labelStyle}>Type</label>
          <select name="source_type" className="sona-input" style={selectStyle}>
            {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Access tier</label>
          <select name="min_tier" className="sona-input" style={selectStyle}>
            {CREATOR_TIERS.map(tier => (
              <option key={tier} value={tier}>{TIER_LABELS[tier]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Input mode toggle */}
      <div>
        <label style={labelStyle}>Content</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['paste', 'upload'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setInputMode(mode)}
              style={{
                fontFamily: GEIST,
                fontSize: '0.8125rem',
                fontWeight: 400,
                padding: '6px 16px',
                borderRadius: '980px',
                border: '1px solid',
                borderColor: inputMode === mode ? '#1a1a1a' : 'rgba(0,0,0,0.15)',
                background: inputMode === mode ? '#1a1a1a' : '#fff',
                color: inputMode === mode ? '#fff' : '#6b6b6b',
                cursor: 'pointer',
              }}
            >
              {mode === 'paste' ? 'Paste text' : 'Upload file'}
            </button>
          ))}
        </div>

        {inputMode === 'paste' ? (
          <textarea
            name="content"
            required
            rows={10}
            placeholder="Paste a transcript, article, or any text that represents your thinking…"
            style={{
              fontFamily: GEIST,
              fontSize: '0.9375rem',
              fontWeight: 300,
              color: '#1a1a1a',
              lineHeight: 1.7,
              width: '100%',
              background: '#fafafa',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 12,
              padding: '14px 16px',
              outline: 'none',
              resize: 'vertical' as const,
              boxSizing: 'border-box' as const,
            }}
          />
        ) : (
          <div
            style={{
              position: 'relative',
              border: '1.5px dashed rgba(0,0,0,0.15)',
              borderRadius: 12,
              padding: '36px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: '#fafafa',
            }}
          >
            <input
              ref={fileRef}
              name="file"
              type="file"
              accept=".pdf,.docx,.txt,.md,.mp3,.m4a,.wav,.ogg,.flac,.aac,.webm"
              required
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                cursor: 'pointer',
                width: '100%',
                height: '100%',
              }}
              onChange={e => {
                const name = e.target.files?.[0]?.name
                if (fileLabelRef.current) fileLabelRef.current.textContent = name ?? 'Click or drag a file here'
              }}
            />
            <p ref={fileLabelRef} style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 300, color: '#9b9b9b', margin: '0 0 6px', pointerEvents: 'none' }}>
              Click or drag a file here
            </p>
            <p style={{ fontFamily: GEIST, fontSize: '0.75rem', fontWeight: 300, color: '#c0c0c0', margin: 0, pointerEvents: 'none' }}>
              PDF, DOCX, TXT — up to 10 MB · Audio (MP3, M4A, WAV) — up to 200 MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', color: '#DE3E7B', margin: '-8px 0 0' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex' }}>
        <button
          type="submit"
          disabled={loading}
          className="sona-btn-dark"
          style={{
            fontFamily: GEIST,
            fontSize: '0.9375rem',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            padding: '12px 32px',
            borderRadius: '980px',
            background: '#1a1a1a',
            color: '#fff',
            border: 'none',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Processing…' : 'Add context'}
        </button>
      </div>

    </form>
  )
}
