# User Avatar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow authenticated users to upload a cropped avatar photo with an auto-detected halo colour, shown in the nav, account page, chat bubbles, and sona profile page.

**Architecture:** Client-side crop (react-image-crop) + canvas resize to 256×256 + dominant-colour sampling → direct browser upload to Supabase Storage via signed URL from an admin-client API route → server action persists `avatar_url` and `avatar_halo_color` to `profiles`. A reusable `UserAvatar` component renders the circle image with a CSS glow and is wired into SonaNav, the account page, and MessageBubble (props passed down from the server page).

**Tech Stack:** Next.js 16 App Router, TypeScript, react-image-crop, HTML Canvas API, Supabase Storage, Supabase server actions

---

## Chunk 1: Foundation — migration, types, colour utility, UserAvatar

### Task 1: Database migration and types regeneration

**Files:**
- Create: `supabase/migrations/00023_user_avatar.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/00023_user_avatar.sql
-- Add avatar fields to profiles and create the avatars storage bucket.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url       TEXT,
  ADD COLUMN IF NOT EXISTS avatar_halo_color TEXT;

-- Storage bucket (public — avatars are shown to all users)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects (idempotent — safe to run even if already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users may upload only to their own path
CREATE POLICY "users_upload_own_avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users_update_own_avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: anyone can read avatars (shown in nav, chat, explore)
CREATE POLICY "public_read_avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
```

- [ ] **Step 2: Push the migration to Supabase**

```bash
supabase db push
```

Expected: migration applies without error.

- [ ] **Step 3: Regenerate TypeScript types**

```bash
supabase gen types typescript --linked > src/lib/supabase/types.ts
```

Expected: `src/lib/supabase/types.ts` now includes `avatar_url: string | null` and `avatar_halo_color: string | null` in the `profiles` Row, Insert, and Update types.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00023_user_avatar.sql src/lib/supabase/types.ts
git commit -m "feat: add avatar_url and avatar_halo_color to profiles, create avatars bucket"
```

---

### Task 2: Dominant colour extraction utility

This pure function is testable in isolation. It takes a canvas element and returns a hex colour string.

**Files:**
- Create: `src/lib/avatar/extract-halo-color.ts`
- Create: `tests/lib/avatar/extract-halo-color.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/avatar/extract-halo-color.test.ts
import { describe, it, expect } from 'vitest'
import { extractHaloColor } from '@/lib/avatar/extract-halo-color'

// Mock canvas for Node environment
function makeCanvas(pixels: [number, number, number][]): HTMLCanvasElement {
  const size = Math.sqrt(pixels.length)
  const imageData = new Uint8ClampedArray(pixels.flatMap(([r, g, b]) => [r, g, b, 255]))
  return {
    width: size,
    height: size,
    getContext: () => ({
      getImageData: () => ({ data: imageData, width: size, height: size }),
    }),
  } as unknown as HTMLCanvasElement
}

describe('extractHaloColor', () => {
  it('returns the most saturated non-white non-black pixel as hex', () => {
    // 4 pixels: coral, white, black, grey
    const canvas = makeCanvas([
      [222, 62, 123],  // coral — should win
      [250, 250, 250], // near-white — skipped
      [10, 10, 10],    // near-black — skipped
      [128, 128, 128], // grey — low saturation
    ])
    expect(extractHaloColor(canvas)).toBe('#de3e7b')
  })

  it('returns a fallback grey when all pixels are near-white or near-black', () => {
    // Must be a perfect square (2×2 = 4 pixels) so canvas width/height are integers
    const canvas = makeCanvas([
      [240, 240, 240],
      [15,  15,  15],
      [240, 240, 240],
      [15,  15,  15],
    ])
    expect(extractHaloColor(canvas)).toBe('#b0b0b0')
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run tests/lib/avatar/extract-halo-color.test.ts
```

Expected: FAIL — `extractHaloColor` not found.

- [ ] **Step 3: Implement the utility**

```typescript
// src/lib/avatar/extract-halo-color.ts

/**
 * Sample a 10×10 grid across the canvas, skip near-white/near-black pixels,
 * and return the most saturated remaining pixel as a CSS hex string.
 * Falls back to #b0b0b0 if no usable pixels are found.
 */
export function extractHaloColor(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d')
  if (!ctx) return '#b0b0b0'

  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const stepX = Math.max(1, Math.floor(width / 10))
  const stepY = Math.max(1, Math.floor(height / 10))

  let bestR = 176, bestG = 176, bestB = 176
  let bestSaturation = -1

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const i = (y * width + x) * 4
      const r = data[i], g = data[i + 1], b = data[i + 2]

      // Skip near-white
      if (r > 230 && g > 230 && b > 230) continue
      // Skip near-black
      if (r < 25 && g < 25 && b < 25) continue

      // HSL saturation approximation
      const max = Math.max(r, g, b) / 255
      const min = Math.min(r, g, b) / 255
      const saturation = max === 0 ? 0 : (max - min) / max

      if (saturation > bestSaturation) {
        bestSaturation = saturation
        bestR = r; bestG = g; bestB = b
      }
    }
  }

  return `#${bestR.toString(16).padStart(2, '0')}${bestG.toString(16).padStart(2, '0')}${bestB.toString(16).padStart(2, '0')}`
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run tests/lib/avatar/extract-halo-color.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/avatar/extract-halo-color.ts tests/lib/avatar/extract-halo-color.test.ts
git commit -m "feat: add extractHaloColor canvas utility with tests"
```

---

### Task 3: UserAvatar display component

**Files:**
- Create: `src/components/account/UserAvatar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/account/UserAvatar.tsx
// Renders a circular avatar image with an optional CSS glow halo.
// Falls back to a Cormorant italic initial when no avatarUrl is set.
// Uses a plain <img> (not next/image) — no remotePatterns config exists.

const CORMORANT = 'var(--font-cormorant)'

interface UserAvatarProps {
  avatarUrl?: string | null
  haloColor?: string | null
  name: string
  size: number
}

export function UserAvatar({ avatarUrl, haloColor, name, size }: UserAvatarProps) {
  const glow = haloColor
    ? (() => {
        const r = parseInt(haloColor.slice(1, 3), 16)
        const g = parseInt(haloColor.slice(3, 5), 16)
        const b = parseInt(haloColor.slice(5, 7), 16)
        return `0 0 ${Math.round(size * 0.6)}px ${Math.round(size * 0.15)}px rgba(${r},${g},${b},0.30)`
      })()
    : undefined

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          display: 'block',
          boxShadow: glow,
        }}
      />
    )
  }

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      backgroundColor: 'rgba(0,0,0,0.04)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: CORMORANT,
        fontSize: Math.round(size * 0.45),
        fontStyle: 'italic',
        fontWeight: 400,
        color: '#1a1a1a',
        lineHeight: 1,
        userSelect: 'none',
      }}>
        {name[0]?.toUpperCase() ?? '?'}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
npx tsc --noEmit
```

Expected: no errors related to `UserAvatar`.

- [ ] **Step 3: Commit**

```bash
git add src/components/account/UserAvatar.tsx
git commit -m "feat: add UserAvatar component with halo glow support"
```

---

## Chunk 2: Upload flow — API route, server action, AvatarUpload component

### Task 4: Signed upload URL API route

**Files:**
- Create: `src/app/api/profile/avatar-upload-url/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/profile/avatar-upload-url/route.ts
// Returns a Supabase signed upload URL for the authenticated user's avatar.
// Uses the admin client (required for createSignedUploadUrl — same pattern
// as /api/creator/ingest).

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const path = `${user.id}/avatar.png`

  const { data, error } = await admin.storage
    .from('avatars')
    .createSignedUploadUrl(path)

  if (error || !data) {
    return NextResponse.json({ error: 'Could not create upload URL' }, { status: 500 })
  }

  // Public URL is the CDN URL used to display the avatar after upload
  const { data: { publicUrl } } = admin.storage
    .from('avatars')
    .getPublicUrl(path)

  return NextResponse.json({ signedUrl: data.signedUrl, publicUrl })
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/profile/avatar-upload-url/route.ts
git commit -m "feat: add avatar signed upload URL API route"
```

---

### Task 5: updateAvatar server action

**Files:**
- Modify: `src/app/(sona)/(platform)/account/actions.ts`

- [ ] **Step 1: Add `updateAvatar` to the actions file**

Open `src/app/(sona)/(platform)/account/actions.ts`. After the closing `}` of `updateProfile`, add:

```typescript
export async function updateAvatar(avatarUrl: string, haloColor: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl, avatar_halo_color: haloColor })
    .eq('id', user.id)

  if (error) throw new Error('Failed to save avatar')

  revalidatePath('/account')
  revalidatePath('/', 'layout')  // revalidates SonaNav across all pages
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. (If you see a type error on `avatar_url` or `avatar_halo_color`, the types weren't regenerated in Task 1 — re-run `supabase gen types typescript --linked > src/lib/supabase/types.ts`.)

- [ ] **Step 3: Commit**

```bash
git add src/app/(sona)/(platform)/account/actions.ts
git commit -m "feat: add updateAvatar server action"
```

---

### Task 6: AvatarUpload component

This is the largest component. It handles file selection, cropping, colour extraction, upload, and save.

**Files:**
- Create: `src/components/account/AvatarUpload.tsx`

**Before starting:** Install react-image-crop.

- [ ] **Step 1: Install the dependency**

```bash
npm install react-image-crop
```

Expected: package added to `dependencies` in `package.json`.

- [ ] **Step 2: Create the component**

```tsx
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
            {saving ? 'Saving…' : 'Save photo'}
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
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/account/AvatarUpload.tsx package.json package-lock.json
git commit -m "feat: add AvatarUpload component with crop, resize, colour extraction, and upload"
```

---

## Chunk 3: Integrations — account page, nav, chat

### Task 7: Account page integration

**Files:**
- Modify: `src/app/(sona)/(platform)/account/page.tsx`

- [ ] **Step 1: Widen the profiles SELECT and render AvatarUpload**

In `page.tsx`, change the `supabase.from('profiles').select(...)` query and add `AvatarUpload` above `ProfileForm`.

Replace:
```typescript
import { BillingPortalButton } from './BillingPortalButton'
import { ProfileForm } from './ProfileForm'
import { DeleteAccountButton } from './DeleteAccountButton'
```
With:
```typescript
import { BillingPortalButton } from './BillingPortalButton'
import { ProfileForm } from './ProfileForm'
import { DeleteAccountButton } from './DeleteAccountButton'
import { AvatarUpload } from '@/components/account/AvatarUpload'
```

Replace:
```typescript
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, stripe_customer_id')
    .eq('id', user.id)
    .single()
```
With:
```typescript
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, stripe_customer_id, avatar_url, avatar_halo_color')
    .eq('id', user.id)
    .single()
```

Replace the Profile section JSX:
```tsx
        {/* Profile section */}
        <section>
          <h2 style={{
            fontFamily: GEIST,
            fontSize: '0.6875rem',
            fontWeight: 500,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: '#b0b0b0',
            margin: '0 0 20px',
          }}>
            Profile
          </h2>
          <ProfileForm
            fullName={profile?.full_name ?? ''}
            email={user.email ?? ''}
            saved={saved}
          />
        </section>
```
With:
```tsx
        {/* Profile section */}
        <section>
          <h2 style={{
            fontFamily: GEIST,
            fontSize: '0.6875rem',
            fontWeight: 500,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: '#b0b0b0',
            margin: '0 0 20px',
          }}>
            Profile
          </h2>
          <AvatarUpload
            currentAvatarUrl={profile?.avatar_url}
            currentHaloColor={profile?.avatar_halo_color}
            name={profile?.full_name || user.email || 'User'}
          />
          <ProfileForm
            fullName={profile?.full_name ?? ''}
            email={user.email ?? ''}
            saved={saved}
          />
        </section>
```

- [ ] **Step 2: Type-check and verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Start dev server (`npm run dev`), sign in, navigate to `/account`. Confirm:
- Avatar circle (or initial fallback) appears above the name field
- Clicking it opens a file picker
- Selecting an image opens the crop modal with circular crop
- Confirming saves successfully; avatar updates in place

- [ ] **Step 4: Commit**

```bash
git add src/app/(sona)/(platform)/account/page.tsx
git commit -m "feat: integrate AvatarUpload into account page"
```

---

### Task 8: SonaNav integration

`SonaNav` is a server component that already queries `portraits` for `hasPortrait`. Add a `profiles` query to fetch the avatar.

**Files:**
- Modify: `src/components/sona/SonaNav.tsx`

- [ ] **Step 1: Add UserAvatar import and profile query**

Add import at the top:
```typescript
import { UserAvatar } from '@/components/account/UserAvatar'
```

After the `hasPortrait` block, add a profile query:
```typescript
  let avatarUrl: string | null = null
  let haloColor: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url, avatar_halo_color, full_name')
      .eq('id', user.id)
      .maybeSingle()
    avatarUrl = profile?.avatar_url ?? null
    haloColor = profile?.avatar_halo_color ?? null
    userName = profile?.full_name || user.email || 'User'
  }
```

Also add `let userName = 'User'` to the variable declarations at the top of the `if (user)` block (alongside `avatarUrl` and `haloColor`).

Replace `<SignOutButton />` with:
```tsx
            <UserAvatar
              avatarUrl={avatarUrl}
              haloColor={haloColor}
              name={userName}
              size={28}
            />
            <SignOutButton />
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Reload any page while signed in. Confirm the 28px avatar (or initial) appears in the nav. Confirm the halo glow is visible when a colourful avatar has been uploaded.

- [ ] **Step 4: Commit**

```bash
git add src/components/sona/SonaNav.tsx
git commit -m "feat: show user avatar in SonaNav"
```

---

### Task 9: Chat integration — MessageBubble and ChatInterface

User message bubbles gain a 24px avatar beside each bubble. Props flow from the server page (SonaPage) down through ChatInterface to MessageBubble — matching the existing `existingRating` prop pattern.

**Files:**
- Modify: `src/components/chat/MessageBubble.tsx`
- Modify: `src/components/chat/ChatInterface.tsx`
- Modify: `src/app/(sona)/(platform)/sona/[slug]/page.tsx`

- [ ] **Step 1: Update MessageBubble**

Add import at the top of `MessageBubble.tsx`:
```typescript
import { UserAvatar } from '@/components/account/UserAvatar'
```

Add two props to `MessageBubbleProps`:
```typescript
interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  portraitName?: string
  onPlayTTS?: () => void
  isPlayingTTS?: boolean
  variant?: 'aside'
  userAvatarUrl?: string | null   // add
  userHaloColor?: string | null   // add
}
```

Add them to the destructured params:
```typescript
export function MessageBubble({
  role,
  content,
  portraitName,
  onPlayTTS,
  isPlayingTTS,
  variant,
  userAvatarUrl,   // add
  userHaloColor,   // add
}: MessageBubbleProps) {
```

In the standard variant return, update the outermost `div` (currently line 84: `<div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 20, }}>`) by replacing the entire block from that `<div>` to its closing `</div>` at line 156. The inner `<div>` and all its children (portrait name label, text paragraph, TTS button) remain **completely unchanged**. Only the outermost wrapper gains `alignItems: 'flex-end'` and `gap: 8`, and the `UserAvatar` is appended after the inner div for user messages.
```tsx
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      alignItems: 'flex-end',
      gap: 8,
      marginBottom: 20,
    }}>
      {!isUser && <div style={{ width: 24, flexShrink: 0 }} />}
      <div style={{
        maxWidth: '72%',
        padding: '14px 18px',
        borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
        backgroundColor: isUser ? '#1a1a1a' : '#f5f5f5',
        border: isUser ? 'none' : '1px solid rgba(0,0,0,0.06)',
      }}>
        {/* ... existing content unchanged ... */}
      </div>
      {isUser && (
        <UserAvatar
          avatarUrl={userAvatarUrl}
          haloColor={userHaloColor}
          name="You"
          size={24}
        />
      )}
    </div>
  )
```

**Important:** keep the inner `<div>` content (portrait name label, text, TTS button) completely unchanged — only the outer wrapper and the avatar addition are new.

- [ ] **Step 2: Update ChatInterfaceProps**

In `ChatInterface.tsx`, add two props to the interface and destructuring:

```typescript
interface ChatInterfaceProps {
  portraitId: string
  portraitName: string
  voiceEnabled?: boolean
  initialConversationId?: string
  onConversationChange?: (id: string) => void
  existingRating?: number | null
  userAvatarUrl?: string | null    // add
  userHaloColor?: string | null    // add
}
```

Add to destructuring:
```typescript
export function ChatInterface({
  ...
  existingRating,
  userAvatarUrl,    // add
  userHaloColor,    // add
}: ChatInterfaceProps) {
```

Pass the props to every `<MessageBubble>` that renders a `chat` kind entry (there are two `<MessageBubble>` calls in the timeline `.map()` — one for aside, one for standard). For the standard one:
```tsx
            <MessageBubble
              key={entry.id}
              role={entry.role}
              content={entry.content}
              portraitName={portraitName}
              variant={entry.metadata?.trigger === 'proactive' ? 'aside' : undefined}
              onPlayTTS={...}
              isPlayingTTS={...}
              userAvatarUrl={userAvatarUrl}    // add
              userHaloColor={userHaloColor}    // add
            />
```

- [ ] **Step 3: Update SonaPage to fetch user avatar and pass to ChatInterface**

In `src/app/(sona)/(platform)/sona/[slug]/page.tsx`, hoist the variable declarations to *before* the `if (user)` block — matching the existing `isSubscribed` / `existingRating` pattern so they're in scope at the `<ChatInterface>` JSX. Then populate them inside the `if (isSubscribed)` block.

```typescript
// Hoist alongside isSubscribed and existingRating — BEFORE if (user)
let isSubscribed = false
let existingRating: number | null = null
let userAvatarUrl: string | null = null   // hoisted here
let userHaloColor: string | null = null   // hoisted here

if (user) {
  // ... existing sub query (isSubscribed) ...
  // ... existing rating query (existingRating) ...

  // Add inside if (isSubscribed):
  if (isSubscribed) {
    // existingRating query already here...
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('avatar_url, avatar_halo_color')
      .eq('id', user.id)
      .maybeSingle()
    userAvatarUrl = userProfile?.avatar_url ?? null
    userHaloColor = userProfile?.avatar_halo_color ?? null
  }
}
```

Then pass them to `ChatInterface`:
```tsx
          <ChatInterface
            portraitId={portrait.id}
            portraitName={portrait.display_name}
            existingRating={existingRating}
            voiceEnabled={true}
            userAvatarUrl={userAvatarUrl}
            userHaloColor={userHaloColor}
          />
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Navigate to a Sona's chat page while subscribed. Confirm:
- User messages show a 24px avatar (or initial) to the right of each bubble
- The halo glow appears if a coloured avatar has been set
- Assistant messages are visually unchanged
- Aside messages are visually unchanged

- [ ] **Step 6: Commit**

```bash
git add src/components/chat/MessageBubble.tsx src/components/chat/ChatInterface.tsx src/app/(sona)/(platform)/sona/[slug]/page.tsx
git commit -m "feat: show user avatar in chat message bubbles"
```

---

### Task 10: Final test run and PR

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass including the new `extract-halo-color` tests.

- [ ] **Step 2: Type-check the full project**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Create PR**

```bash
git push -u origin feature/user-avatar
gh pr create --title "feat: user profile avatar with halo colour" \
  --body "Adds avatar upload to the account page with client-side crop, canvas resize to 256×256, and dominant-colour halo extraction. Avatar appears in SonaNav, chat message bubbles, and propagates via server-side props."
```
