'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

const GEIST = 'var(--font-geist-sans)'

const RELATIONSHIPS = [
  { value: 'friend',       label: 'Friend' },
  { value: 'colleague',    label: 'Colleague' },
  { value: 'family',       label: 'Family member' },
  { value: 'professional', label: 'Professional contact' },
  { value: 'other',        label: 'Other' },
]

const TIERS = [
  { value: 'public',       label: 'Discovery — visible to all' },
  { value: 'acquaintance', label: 'Perspective — paying subscribers' },
  { value: 'colleague',    label: 'Wisdom — close circle' },
  { value: 'family',       label: 'Legacy — inner circle' },
]

type Stage = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

interface Props {
  portraitId: string
  portraitName: string
}

export function UploadForm({ portraitId, portraitName }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [title, setTitle]           = useState('')
  const [relationship, setRelationship] = useState('friend')
  const [minTier, setMinTier]       = useState('public')
  const [file, setFile]             = useState<File | null>(null)
  const [stage, setStage]           = useState<Stage>('idle')
  const [progress, setProgress]     = useState(0)  // 0–100 upload %
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setErrorMsg(null)
    if (f && !title) {
      // Pre-fill title from filename (strip extension)
      setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !title.trim()) return

    setStage('uploading')
    setProgress(0)
    setErrorMsg(null)

    try {
      // Step 1: init — get presigned upload URL
      const initData = new FormData()
      initData.append('portrait_id',              portraitId)
      initData.append('title',                    title.trim())
      initData.append('min_tier',                 minTier)
      initData.append('source_perspective',       'third_party')
      initData.append('interviewee_relationship', relationship)
      initData.append('filename',                 file.name)
      initData.append('content_type',             file.type || 'audio/mpeg')

      const initRes = await fetch('/api/admin/portrait-ingest', {
        method: 'POST',
        body: initData,
      })
      if (!initRes.ok) {
        const { error } = await initRes.json()
        throw new Error(error ?? 'Failed to initialise upload')
      }
      const { source_id, upload_url } = await initRes.json()

      // Step 2: upload audio directly to Supabase Storage via XHR for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', upload_url)
        xhr.setRequestHeader('Content-Type', file.type || 'audio/mpeg')
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100))
        }
        xhr.onload  = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
        xhr.onerror = () => reject(new Error('Network error during upload'))
        xhr.send(file)
      })

      setStage('processing')
      setProgress(100)

      // Step 3: confirm — trigger transcription + evidence extraction
      const confirmRes = await fetch('/api/admin/portrait-ingest/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id }),
      })
      if (!confirmRes.ok) {
        const { error } = await confirmRes.json()
        throw new Error(error ?? 'Failed to start processing')
      }

      setStage('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStage('error')
    }
  }

  function handleReset() {
    setTitle('')
    setRelationship('friend')
    setMinTier('public')
    setFile(null)
    setStage('idle')
    setProgress(0)
    setErrorMsg(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const labelStyle = {
    fontFamily: GEIST,
    fontSize: '0.6875rem',
    fontWeight: 500,
    letterSpacing: '0.09em',
    textTransform: 'uppercase' as const,
    color: '#b0b0b0',
    display: 'block',
    marginBottom: 8,
  }

  const inputStyle = {
    fontFamily: GEIST,
    fontSize: '0.9375rem',
    fontWeight: 300,
    color: '#1a1a1a',
    width: '100%',
    outline: 'none',
    border: 'none',
    borderBottom: '1px solid rgba(0,0,0,0.15)',
    backgroundColor: 'transparent',
    padding: '6px 0',
    boxSizing: 'border-box' as const,
  }

  const selectStyle = {
    ...inputStyle,
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23b0b0b0' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 4px center',
    paddingRight: 24,
    cursor: 'pointer',
  }

  if (stage === 'done') {
    return (
      <div style={{
        border: '1px solid rgba(0,0,0,0.07)',
        borderRadius: 14,
        padding: '32px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Coral checkmark */}
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          backgroundColor: '#DE3E7B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M4 11l5 5 9-9" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p style={{ fontFamily: GEIST, fontSize: '0.9375rem', fontWeight: 500, color: '#1a1a1a', margin: '0 0 4px' }}>
            Interview uploaded
          </p>
          <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 300, color: '#6b6b6b', margin: 0, lineHeight: 1.6 }}>
            The recording is being transcribed and its insights will be added to {portraitName}'s profile. This happens in the background — it may take a few minutes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
          <button
            onClick={handleReset}
            className="sona-btn-dark"
            style={{
              fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 500,
              color: '#fff', backgroundColor: '#1a1a1a', border: 'none',
              borderRadius: '980px', padding: '10px 24px', cursor: 'pointer',
            }}
          >
            Upload another
          </button>
          <button
            onClick={() => router.push('/sona-admin')}
            className="sona-btn-outline"
            style={{
              fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 400,
              color: '#6b6b6b', backgroundColor: 'transparent',
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: '980px', padding: '10px 24px', cursor: 'pointer',
            }}
          >
            Back to portraits
          </button>
        </div>
      </div>
    )
  }

  const isBusy = stage === 'uploading' || stage === 'processing'

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Title */}
      <div>
        <label style={labelStyle}>Interview title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Interview with Sarah — close friend"
          required
          disabled={isBusy}
          className="sona-input"
          style={inputStyle}
        />
      </div>

      {/* Relationship */}
      <div>
        <label style={labelStyle}>Interviewee's relationship to {portraitName}</label>
        <select
          value={relationship}
          onChange={e => setRelationship(e.target.value)}
          disabled={isBusy}
          style={selectStyle}
        >
          {RELATIONSHIPS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Tier */}
      <div>
        <label style={labelStyle}>Visibility tier</label>
        <select
          value={minTier}
          onChange={e => setMinTier(e.target.value)}
          disabled={isBusy}
          style={selectStyle}
        >
          {TIERS.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <p style={{ fontFamily: GEIST, fontSize: '0.75rem', color: '#b0b0b0', margin: '8px 0 0' }}>
          Insights from this interview will only surface for subscribers at or above this tier.
        </p>
      </div>

      {/* Audio file */}
      <div>
        <label style={labelStyle}>Audio file</label>
        <div
          onClick={() => !isBusy && fileRef.current?.click()}
          style={{
            border: '1px dashed rgba(0,0,0,0.15)',
            borderRadius: 12,
            padding: '24px 20px',
            cursor: isBusy ? 'default' : 'pointer',
            textAlign: 'center',
            backgroundColor: file ? 'rgba(222,62,123,0.03)' : '#fafafa',
            borderColor: file ? 'rgba(222,62,123,0.25)' : 'rgba(0,0,0,0.15)',
            transition: 'all 0.15s',
          }}
        >
          {file ? (
            <>
              <p style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 500, color: '#1a1a1a', margin: '0 0 4px' }}>
                {file.name}
              </p>
              <p style={{ fontFamily: GEIST, fontSize: '0.75rem', color: '#b0b0b0', margin: 0 }}>
                {(file.size / 1024 / 1024).toFixed(1)} MB — click to change
              </p>
            </>
          ) : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 10px', display: 'block' }}>
                <path d="M12 15V3m0 0L8 7m4-4l4 4" stroke="#b0b0b0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 17v1a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-1" stroke="#b0b0b0" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p style={{ fontFamily: GEIST, fontSize: '0.875rem', color: '#6b6b6b', margin: '0 0 4px' }}>
                Click to select audio file
              </p>
              <p style={{ fontFamily: GEIST, fontSize: '0.75rem', color: '#b0b0b0', margin: 0 }}>
                MP3, M4A, WAV or OGG — up to 200 MB
              </p>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.wav,.ogg"
          onChange={handleFileChange}
          disabled={isBusy}
          style={{ display: 'none' }}
        />
      </div>

      {/* Upload progress */}
      {stage === 'uploading' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontFamily: GEIST, fontSize: '0.75rem', color: '#6b6b6b' }}>Uploading…</span>
            <span style={{ fontFamily: GEIST, fontSize: '0.75rem', color: '#b0b0b0' }}>{progress}%</span>
          </div>
          <div style={{ height: 3, backgroundColor: 'rgba(0,0,0,0.07)', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${progress}%`, backgroundColor: '#DE3E7B', borderRadius: 2, transition: 'width 0.2s' }} />
          </div>
        </div>
      )}

      {stage === 'processing' && (
        <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', color: '#6b6b6b', margin: 0 }}>
          Upload complete — starting transcription…
        </p>
      )}

      {/* Error */}
      {errorMsg && (
        <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', color: '#DE3E7B', margin: 0 }}>
          {errorMsg}
        </p>
      )}

      {/* Submit */}
      {(stage === 'idle' || stage === 'error') && (
        <div>
          <button
            type="submit"
            disabled={!file || !title.trim()}
            className="sona-btn-dark"
            style={{
              fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 500,
              color: '#fff', backgroundColor: '#1a1a1a', border: 'none',
              borderRadius: '980px', padding: '12px 32px',
              cursor: !file || !title.trim() ? 'default' : 'pointer',
              opacity: !file || !title.trim() ? 0.4 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            Upload interview
          </button>
        </div>
      )}
    </form>
  )
}
