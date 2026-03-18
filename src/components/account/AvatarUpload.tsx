// src/components/account/AvatarUpload.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { UserAvatar } from './UserAvatar'
import { extractHaloColor } from '@/lib/avatar/extract-halo-color'
import { updateAvatar } from '@/app/(sona)/(platform)/account/actions'

const GEIST = 'var(--font-geist-sans)'

interface AvatarUploadProps {
  currentAvatarUrl?: string | null
  currentHaloColor?: string | null
  name: string
}

export function AvatarUpload({ currentAvatarUrl, currentHaloColor, name }: AvatarUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl ?? null)
  const [haloColor, setHaloColor] = useState(currentHaloColor ?? null)
  const [srcUrl, setSrcUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    setError(null)
    const url = URL.createObjectURL(file)
    setSrcUrl(url)
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: width, naturalHeight: height } = e.currentTarget
    const centred = centerCrop(
      makeAspectCrop({ unit: '%', width: 80 }, 1, width, height),
      width,
      height,
    )
    setCrop(centred)
  }

  const getCroppedCanvas = useCallback((): HTMLCanvasElement | null => {
    const img = imgRef.current
    if (!img || !crop) return null

    // Convert percentage crop to natural-image pixel coordinates directly.
    // Do NOT multiply by scaleX/scaleY — those are display-to-natural ratios
    // and the percentage-to-natural conversion already accounts for them.
    const srcX = (crop.x / 100) * img.naturalWidth
    const srcY = (crop.y / 100) * img.naturalHeight
    const srcW = (crop.width / 100) * img.naturalWidth
    const srcH = (crop.height / 100) * img.naturalHeight

    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, 256, 256)
    return canvas
  }, [crop])

  async function handleConfirmCrop() {
    const canvas = getCroppedCanvas()
    if (!canvas) return

    setSaving(true)
    setError(null)

    try {
      // 1. Extract dominant colour from the 256×256 canvas
      const halo = extractHaloColor(canvas)

      // 2. Convert canvas to PNG blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas export failed')), 'image/png')
      })

      // 3. Get signed upload URL from API
      const urlRes = await fetch('/api/profile/avatar-upload-url')
      if (!urlRes.ok) throw new Error('Could not get upload URL')
      const { signedUrl, publicUrl } = await urlRes.json()

      // 4. Upload directly to Supabase Storage
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: blob,
      })
      if (!uploadRes.ok) throw new Error('Upload failed')

      // 5. Persist to profile via server action
      await updateAvatar(publicUrl, halo)

      // 6. Update local state optimistically
      // Append cache-buster so the browser re-fetches the new image
      setAvatarUrl(`${publicUrl}?t=${Date.now()}`)
      setHaloColor(halo)
      setSrcUrl(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    if (srcUrl) URL.revokeObjectURL(srcUrl)
    setSrcUrl(null)
    setCrop(undefined)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Crop modal
  if (srcUrl) {
    return (
      <div style={{ marginBottom: 32 }}>
        <p style={{
          fontFamily: GEIST,
          fontSize: '0.75rem',
          fontWeight: 400,
          color: '#6b6b6b',
          margin: '0 0 12px',
        }}>
          Drag to reposition, resize handles to crop
        </p>
        <ReactCrop
          crop={crop}
          onChange={c => setCrop(c)}
          aspect={1}
          circularCrop
          style={{ maxWidth: '100%' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={srcUrl}
            alt="Crop preview"
            onLoad={onImageLoad}
            style={{ maxWidth: '100%', maxHeight: 400 }}
          />
        </ReactCrop>
        {error && (
          <p style={{ fontFamily: GEIST, fontSize: '0.75rem', color: '#DE3E7B', margin: '8px 0 0' }}>
            {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            type="button"
            onClick={handleConfirmCrop}
            disabled={saving}
            style={{
              fontFamily: GEIST,
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: '#fff',
              background: '#1a1a1a',
              border: 'none',
              borderRadius: '980px',
              padding: '8px 20px',
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving\u2026' : 'Save photo'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            style={{
              fontFamily: GEIST,
              fontSize: '0.8125rem',
              fontWeight: 400,
              color: '#6b6b6b',
              background: 'none',
              border: '1px solid rgba(0,0,0,0.10)',
              borderRadius: '980px',
              padding: '8px 20px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Default: avatar display + change button
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
      <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
        <UserAvatar avatarUrl={avatarUrl} haloColor={haloColor} name={name} size={72} />
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          backgroundColor: 'rgba(0,0,0,0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.15s ease',
        }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.35)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0)')}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ opacity: 0, transition: 'opacity 0.15s ease' }}
            ref={el => {
              if (el) {
                const parent = el.parentElement
                if (parent) {
                  parent.addEventListener('mouseenter', () => { el.style.opacity = '1' })
                  parent.addEventListener('mouseleave', () => { el.style.opacity = '0' })
                }
              }
            }}
          >
            <path d="M9 12.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="#fff" strokeWidth="1.25" fill="none" />
            <path d="M2 6.5h1.5L5 4.5h8l1.5 2H16a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" stroke="#fff" strokeWidth="1.25" fill="none" />
          </svg>
        </div>
      </div>
      <div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            fontFamily: GEIST,
            fontSize: '0.8125rem',
            fontWeight: 400,
            color: '#6b6b6b',
            background: 'none',
            border: '1px solid rgba(0,0,0,0.10)',
            borderRadius: '980px',
            padding: '6px 16px',
            cursor: 'pointer',
          }}
        >
          {avatarUrl ? 'Change photo' : 'Add photo'}
        </button>
        {error && (
          <p style={{ fontFamily: GEIST, fontSize: '0.75rem', color: '#DE3E7B', margin: '6px 0 0' }}>
            {error}
          </p>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="Upload profile photo"
      />
    </div>
  )
}
