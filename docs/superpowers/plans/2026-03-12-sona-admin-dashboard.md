# Sona Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Sona-branded admin dashboard at `/admin` where operators can view all creator portraits and flip `is_public` to publish them.

**Architecture:** Four files in a new `(sona)/admin/` route group: a server-component layout that gates on `profiles.is_admin`, a server-component page that fetches all data, a client-component table with an optimistic publish toggle, and a server action file. No new DB schema required.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (admin client), `revalidatePath`, inline styles (Sona design system — no Tailwind).

**Spec:** `docs/superpowers/specs/2026-03-12-sona-admin-dashboard-design.md`

---

## Chunk 1: Foundation — layout + server action

### Task 1: Admin layout with is_admin gate

**Files:**
- Create: `src/app/(sona)/admin/layout.tsx`

**Context:** The `(sona)/layout.tsx` is a pass-through (`<>{children}</>`). This new layout sits as a sibling to `(sona)/dashboard/` and adds its own minimal Sona-branded header. Pattern reference: `src/app/(nh)/admin/layout.tsx` for the gate logic.

- [ ] **Step 1: Create `src/app/(sona)/admin/layout.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Image from 'next/image'
import Link from 'next/link'

const GEIST = 'var(--font-geist-sans)'

export default async function SonaAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/')

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      {/* Minimal admin header */}
      <header style={{
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        backgroundColor: '#fff',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}>
        <div style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '0 clamp(24px, 4vw, 48px)',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Link href="/admin" style={{ display: 'flex', alignItems: 'center' }}>
            <Image
              src="/brand_assets/sona/Sona brand on white bg 1.svg"
              alt="Sona"
              width={88}
              height={33}
              priority
            />
          </Link>
          <span style={{
            fontFamily: GEIST,
            fontSize: '0.6875rem',
            fontWeight: 500,
            letterSpacing: '0.09em',
            textTransform: 'uppercase' as const,
            color: '#b0b0b0',
          }}>
            Admin
          </span>
        </div>
      </header>

      {/* Page content */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px clamp(24px, 4vw, 48px)' }}>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i admin`
Expected: no errors related to the new file.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(sona\)/admin/layout.tsx
git commit -m "feat(admin): Sona admin layout with is_admin gate"
```

---

### Task 2: Server action — togglePortraitPublished

**Files:**
- Create: `src/app/(sona)/admin/actions.ts`

**Context:** Follows the `assertAdmin()` pattern from `src/app/(nh)/admin/interviews/actions.ts`. The action re-checks `is_admin` at the server — the layout gate alone is insufficient because server actions are callable directly via HTTP.

- [ ] **Step 1: Create `src/app/(sona)/admin/actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function assertAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')
  // Use admin client for profile read to guarantee success regardless of RLS policy state
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) throw new Error('Forbidden')
}

export async function togglePortraitPublished(portraitId: string, isPublic: boolean) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin
    .from('portraits')
    .update({ is_public: isPublic })
    .eq('id', portraitId)
  if (error) throw new Error('Failed to update portrait')
  revalidatePath('/admin')
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i admin`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(sona\)/admin/actions.ts
git commit -m "feat(admin): togglePortraitPublished server action"
```

---

## Chunk 2: Data + UI

### Task 3: PortraitsTable client component

**Files:**
- Create: `src/app/(sona)/admin/PortraitsTable.tsx`

**Context:** Client component. Receives portrait rows and the set of portrait IDs that have an interview request as props. The `is_public` toggle uses optimistic state — flips immediately, calls the server action, rolls back on error. Follows Sona design system: inline styles only, no Tailwind.

- [ ] **Step 1: Create `src/app/(sona)/admin/PortraitsTable.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { togglePortraitPublished } from './actions'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

interface PortraitData {
  id: string
  display_name: string
  creator_email: string
  is_public: boolean
  synthesis_status: string | null
  created_at: string
  content_count: number
  subscriber_count: number
  has_interview: boolean
}

interface Props {
  portraits: PortraitData[]
}

function StatusBadge({ status }: { status: string | null }) {
  const label = status ?? 'none'
  const colors: Record<string, { bg: string; color: string }> = {
    ready:      { bg: 'rgba(42,124,79,0.08)',  color: '#2a7c4f' },
    processing: { bg: 'rgba(180,120,20,0.08)', color: '#b08850' },
    error:      { bg: 'rgba(222,62,123,0.08)', color: '#DE3E7B' },
    none:       { bg: 'rgba(0,0,0,0.05)',       color: '#9b9b9b' },
  }
  const c = colors[label] ?? colors.none
  return (
    <span style={{
      fontFamily: GEIST,
      fontSize: '0.6875rem',
      fontWeight: 500,
      letterSpacing: '0.04em',
      padding: '3px 10px',
      borderRadius: '980px',
      backgroundColor: c.bg,
      color: c.color,
    }}>
      {label}
    </span>
  )
}

function PortraitTableRow({ portrait }: { portrait: PortraitData }) {
  const [isPublic, setIsPublic] = useState(portrait.is_public)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleToggle() {
    const next = !isPublic
    setIsPublic(next)
    setError(null)
    setPending(true)
    try {
      await togglePortraitPublished(portrait.id, next)
    } catch {
      setIsPublic(!next) // rollback
      setError('Failed to update')
    } finally {
      setPending(false)
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    })
  }

  return (
    <tr
      className="sona-row-hover"
      style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}
    >
      {/* Portrait name */}
      <td style={{ padding: '14px 16px' }}>
        <p style={{ fontFamily: CORMORANT, fontSize: '1rem', fontStyle: 'italic', fontWeight: 400, color: '#1a1a1a', margin: 0 }}>
          {portrait.display_name}
        </p>
        <p style={{ fontFamily: GEIST, fontSize: '0.75rem', fontWeight: 300, color: '#b0b0b0', margin: '2px 0 0' }}>
          {portrait.creator_email}
        </p>
      </td>

      {/* Interview */}
      <td style={{ padding: '14px 16px' }}>
        <span style={{ fontFamily: GEIST, fontSize: '0.8125rem', color: portrait.has_interview ? '#1a1a1a' : '#c0c0c0' }}>
          {portrait.has_interview ? 'Requested' : '—'}
        </span>
      </td>

      {/* Content */}
      <td style={{ padding: '14px 16px', fontFamily: GEIST, fontSize: '0.8125rem', color: '#6b6b6b' }}>
        {portrait.content_count}
      </td>

      {/* Synthesis */}
      <td style={{ padding: '14px 16px' }}>
        <StatusBadge status={portrait.synthesis_status} />
      </td>

      {/* Subscribers */}
      <td style={{ padding: '14px 16px', fontFamily: GEIST, fontSize: '0.8125rem', color: '#6b6b6b' }}>
        {portrait.subscriber_count}
      </td>

      {/* Joined */}
      <td style={{ padding: '14px 16px', fontFamily: GEIST, fontSize: '0.75rem', fontWeight: 300, color: '#b0b0b0', whiteSpace: 'nowrap' }}>
        {formatDate(portrait.created_at)}
      </td>

      {/* Publish toggle */}
      <td style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <button
            onClick={handleToggle}
            disabled={pending}
            style={{
              fontFamily: GEIST,
              fontSize: '0.6875rem',
              fontWeight: 500,
              letterSpacing: '0.04em',
              padding: '4px 12px',
              borderRadius: '980px',
              border: '1px solid',
              borderColor: isPublic ? 'rgba(42,124,79,0.3)' : 'rgba(0,0,0,0.15)',
              background: isPublic ? 'rgba(42,124,79,0.08)' : 'transparent',
              color: isPublic ? '#2a7c4f' : '#6b6b6b',
              cursor: pending ? 'default' : 'pointer',
              opacity: pending ? 0.5 : 1,
            }}
          >
            {isPublic ? 'Live' : 'Draft'}
          </button>
          {error && (
            <span style={{ fontFamily: GEIST, fontSize: '0.6875rem', color: '#DE3E7B' }}>{error}</span>
          )}
        </div>
      </td>
    </tr>
  )
}

export function PortraitsTable({ portraits }: Props) {
  if (portraits.length === 0) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <p style={{ fontFamily: CORMORANT, fontSize: '1.375rem', fontStyle: 'italic', color: '#1a1a1a', margin: 0 }}>
          No portraits yet.
        </p>
      </div>
    )
  }

  const thStyle = {
    fontFamily: GEIST,
    fontSize: '0.6875rem',
    fontWeight: 500,
    letterSpacing: '0.09em',
    textTransform: 'uppercase' as const,
    color: '#b0b0b0',
    padding: '10px 16px',
    textAlign: 'left' as const,
    borderBottom: '1px solid rgba(0,0,0,0.07)',
    whiteSpace: 'nowrap' as const,
  }

  return (
    <div style={{ border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Portrait', 'Interview', 'Content', 'Synthesis', 'Subscribers', 'Joined', 'Status'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {portraits.map(p => <PortraitTableRow key={p.id} portrait={p} />)}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i admin`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(sona\)/admin/PortraitsTable.tsx
git commit -m "feat(admin): PortraitsTable with optimistic publish toggle"
```

---

### Task 4: Admin page — data fetching + layout

**Files:**
- Create: `src/app/(sona)/admin/page.tsx`

**Context:** Server component. Runs all queries in parallel. Portraits are fetched with subscriber count and content count as aggregates. Interview status is resolved via a separate query returning all portrait IDs with interview requests, then matched in a `Set`. Stat cards rendered inline.

- [ ] **Step 1: Create `src/app/(sona)/admin/page.tsx`**

```tsx
import { createAdminClient } from '@/lib/supabase/admin'
import { PortraitsTable } from './PortraitsTable'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

export default async function SonaAdminPage() {
  const admin = createAdminClient()

  // Run all queries in parallel
  const [
    { count: liveCount },
    { count: totalSubscribers },
    { data: portraits },
    { data: interviewRows },
  ] = await Promise.all([
    // Live Sonas
    admin.from('portraits').select('*', { count: 'exact', head: true }).eq('is_public', true),
    // Total subscribers
    admin.from('subscriptions').select('*', { count: 'exact', head: true }),
    // All portraits with creator email, content count, subscriber count
    // Note: if embedded `relation ( count )` syntax doesn't resolve correctly at runtime,
    // replace `content_sources ( count )` and `subscriptions ( count )` with separate
    // queries: admin.from('content_sources').select('portrait_id').then(...)
    // and build lookup maps by portrait_id.
    (admin as any)
      .from('portraits')
      .select(`
        id,
        creator_id,
        display_name,
        is_public,
        synthesis_status,
        created_at,
        profiles!portraits_creator_id_fkey ( email ),
        content_sources ( count ),
        subscriptions ( count )
      `)
      .order('created_at', { ascending: false }),
    // Portrait IDs that have interview requests
    admin.from('interview_requests').select('portrait_id'),
  ])

  // Count distinct creators from the portraits result (no separate query needed)
  const uniqueCreators = new Set((portraits ?? []).map((p: any) => p.creator_id)).size

  // Build a Set of portrait IDs that have an interview request
  const interviewPortraitIds = new Set((interviewRows ?? []).map((r: any) => r.portrait_id))

  // Shape portrait rows for PortraitsTable
  const rows = (portraits ?? []).map((p: any) => ({
    id: p.id,
    display_name: p.display_name,
    creator_email: p.profiles?.email ?? '—',
    is_public: p.is_public ?? false,
    synthesis_status: p.synthesis_status ?? null,
    created_at: p.created_at,
    content_count: p.content_sources?.[0]?.count ?? 0,
    subscriber_count: p.subscriptions?.[0]?.count ?? 0,
    has_interview: interviewPortraitIds.has(p.id),
  }))

  const statCards = [
    { label: 'Total creators', value: uniqueCreators },
    { label: 'Live Sonas', value: liveCount ?? 0 },
    { label: 'Total subscribers', value: totalSubscribers ?? 0 },
  ]

  return (
    <div>
      {/* Page heading */}
      <h1 style={{
        fontFamily: CORMORANT,
        fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
        fontWeight: 400,
        fontStyle: 'italic',
        letterSpacing: '-0.02em',
        color: '#1a1a1a',
        margin: '0 0 32px',
      }}>
        Portraits
      </h1>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }}>
        {statCards.map(card => (
          <div key={card.label} style={{
            border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: 14,
            padding: '20px 24px',
          }}>
            <p style={{
              fontFamily: GEIST,
              fontSize: '0.6875rem',
              fontWeight: 500,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: '#b0b0b0',
              margin: '0 0 8px',
            }}>
              {card.label}
            </p>
            <p style={{
              fontFamily: CORMORANT,
              fontSize: '2rem',
              fontWeight: 400,
              color: '#1a1a1a',
              margin: 0,
              lineHeight: 1,
            }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Portraits table */}
      <PortraitsTable portraits={rows} />
    </div>
  )
}
```

**Note on the portraits query:** The Supabase JS client supports embedded counts via `relation ( count )` syntax. If this doesn't work with the admin client, fall back to separate queries for content and subscriber counts per portrait (joining by `portrait_id`).

- [ ] **Step 2: Start the dev server and navigate to `/admin`**

Run: `npm run dev`
Expected: page loads without error, stat cards show numbers, portraits table renders.

If TypeScript errors appear related to Supabase types (common for tables added after type generation), add `as any` casts as needed — consistent with existing patterns in the codebase (see `dashboard/page.tsx` for examples).

- [ ] **Step 3: Test the publish toggle**

- Click the "Draft" button on a portrait row
- Expected: button immediately shows "Live" (optimistic), then stays "Live" after server round-trip
- Click "Live" to toggle back to "Draft"
- Expected: rolls back correctly

- [ ] **Step 4: Test non-admin redirect**

In a separate browser session (or incognito), log in as a non-admin user and navigate to `/admin`.
Expected: redirect to `/`.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(sona\)/admin/page.tsx
git commit -m "feat(admin): Sona admin page — stat cards + portraits table"
```

---

## Chunk 3: Ship

### Task 5: Push and open PR

- [ ] **Step 1: Run type check**

```bash
npx tsc --noEmit 2>&1
```
Expected: no new errors (pre-existing `as any` casts are fine).

- [ ] **Step 2: Push branch and open PR**

```bash
git push
```

Then use the `commit-commands:commit-push-pr` skill or run:
```bash
gh pr create --title "feat: Sona admin dashboard" \
  --body "Adds /(sona)/admin route with stat cards, portrait table, and optimistic is_public toggle. Gated by profiles.is_admin."
```
