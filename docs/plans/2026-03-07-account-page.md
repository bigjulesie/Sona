# Account Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build out the Account page with name editing, email change, billing access, and account deletion.

**Architecture:** Four self-contained pieces — a Server Actions file, a `ProfileForm` client component (name + email change), a `DeleteAccountButton` client component (inline confirmation), and an updated `page.tsx` that wires them together with fresh profile data. No new DB tables needed; `profiles.full_name` already exists.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase JS (server + admin client), Server Actions, inline styles matching the Sona design system.

**Design doc:** `docs/plans/2026-03-07-account-page-design.md`

---

### Task 1: Server Actions

**Files:**
- Create: `src/app/(sona)/(platform)/account/actions.ts`

**Context:**
- Follow exactly the same pattern as `src/app/(sona)/dashboard/settings/actions.ts`
- `updateProfile` updates `profiles.full_name` using the server Supabase client (RLS allows users to update their own row)
- `deleteAccount` uses the **admin client** (`createAdminClient` from `@/lib/supabase/admin`) to call `auth.admin.deleteUser` — this bypasses RLS

**Step 1: Create `src/app/(sona)/(platform)/account/actions.ts`**

```ts
'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateProfile(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const fullName = (formData.get('full_name') as string ?? '').trim()

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', user.id)

  if (error) throw new Error('Failed to save profile')

  revalidatePath('/account')
  redirect('/account?saved=1')
}

export async function deleteAccount() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await createAdminClient().auth.admin.deleteUser(user.id)
  if (error) throw new Error('Failed to delete account')

  redirect('/')
}
```

**Step 2: Verify manually**
- TypeScript: `npx tsc --noEmit` — expect no errors

**Step 3: Commit**
```bash
git add 'src/app/(sona)/(platform)/account/actions.ts'
git commit -m "feat: add updateProfile and deleteAccount server actions"
```

---

### Task 2: ProfileForm client component

**Files:**
- Create: `src/app/(sona)/(platform)/account/ProfileForm.tsx`

**Context:**
- Client component (`'use client'`) — needs `useState` for the email-change disclosure
- Name field uses a standard HTML `<form action={updateProfile}>` — Server Action handles submit
- Email change is **client-side only**: calls `supabase.auth.updateUser({ email })` via the browser Supabase client, then shows a "Confirmation sent" message. Email change does NOT use a Server Action.
- The browser Supabase client is imported from `@/lib/supabase/client` (check this path exists — it should export `createBrowserSupabaseClient` or similar)
- Saved state: if `saved` prop is true, show a small "Saved" confirmation next to the save button
- Input styling: underline style — `border: 'none'`, `borderBottom: '1px solid rgba(0,0,0,0.15)'`, `backgroundColor: 'transparent'`, class `sona-input`
- Font constants: `const GEIST = 'var(--font-geist-sans)'`

**Step 1: Check the browser Supabase client export**

```bash
cat src/lib/supabase/client.ts
```

Use whatever function it exports (e.g. `createBrowserClient`, `createBrowserSupabaseClient`).

**Step 2: Create `src/app/(sona)/(platform)/account/ProfileForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { updateProfile } from './actions'

const GEIST = 'var(--font-geist-sans)'

interface ProfileFormProps {
  fullName: string
  email: string
  saved: boolean
}

export function ProfileForm({ fullName, email, saved }: ProfileFormProps) {
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault()
    if (!newEmail.trim()) return
    setEmailStatus('sending')
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    if (error) {
      setEmailStatus('error')
    } else {
      setEmailStatus('sent')
      setNewEmail('')
    }
  }

  return (
    <div>
      {/* ── Name form ─────────────────────────────────────── */}
      <form action={updateProfile}>
        <div style={{ marginBottom: 24 }}>
          <label style={{
            fontFamily: GEIST, fontSize: '0.6875rem', fontWeight: 500,
            letterSpacing: '0.09em', textTransform: 'uppercase',
            color: '#b0b0b0', display: 'block', marginBottom: 8,
          }}>
            Full name
          </label>
          <input
            name="full_name"
            type="text"
            defaultValue={fullName}
            placeholder="Your name"
            className="sona-input"
            style={{
              fontFamily: GEIST, fontSize: '0.9375rem', fontWeight: 300,
              color: '#1a1a1a', width: '100%', outline: 'none',
              border: 'none', borderBottom: '1px solid rgba(0,0,0,0.15)',
              backgroundColor: 'transparent', padding: '6px 0',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="submit"
            className="sona-btn-dark"
            style={{
              fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 500,
              letterSpacing: '-0.01em', color: '#fff', backgroundColor: '#1a1a1a',
              border: 'none', borderRadius: '980px', padding: '10px 24px',
              cursor: 'pointer',
            }}
          >
            Save
          </button>
          {saved && (
            <span style={{ fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 300, color: '#9b9b9b' }}>
              Saved
            </span>
          )}
        </div>
      </form>

      {/* ── Email section ─────────────────────────────────── */}
      <div style={{ marginTop: 32 }}>
        <p style={{
          fontFamily: GEIST, fontSize: '0.6875rem', fontWeight: 500,
          letterSpacing: '0.09em', textTransform: 'uppercase',
          color: '#b0b0b0', margin: '0 0 8px',
        }}>
          Email address
        </p>
        <p style={{ fontFamily: GEIST, fontSize: '0.9375rem', fontWeight: 300, color: '#1a1a1a', margin: '0 0 12px' }}>
          {email}
        </p>

        {!showEmailForm && emailStatus !== 'sent' && (
          <button
            onClick={() => setShowEmailForm(true)}
            className="sona-link"
            style={{
              fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 400,
              color: '#6b6b6b', background: 'none', border: 'none',
              padding: 0, cursor: 'pointer', textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            Change email address
          </button>
        )}

        {emailStatus === 'sent' && (
          <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 300, color: '#9b9b9b', margin: 0 }}>
            Confirmation sent — check your new inbox to complete the change.
          </p>
        )}

        {showEmailForm && emailStatus !== 'sent' && (
          <form onSubmit={handleEmailChange} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="New email address"
              required
              className="sona-input"
              style={{
                fontFamily: GEIST, fontSize: '0.9375rem', fontWeight: 300,
                color: '#1a1a1a', outline: 'none', border: 'none',
                borderBottom: '1px solid rgba(0,0,0,0.15)',
                backgroundColor: 'transparent', padding: '6px 0',
                maxWidth: 320,
              }}
            />
            {emailStatus === 'error' && (
              <p style={{ fontFamily: GEIST, fontSize: '0.8125rem', color: '#DE3E7B', margin: 0 }}>
                Unable to update email. Please try again.
              </p>
            )}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                type="submit"
                disabled={emailStatus === 'sending'}
                className="sona-btn-dark"
                style={{
                  fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 500,
                  color: '#fff', backgroundColor: '#1a1a1a', border: 'none',
                  borderRadius: '980px', padding: '10px 24px',
                  cursor: emailStatus === 'sending' ? 'default' : 'pointer',
                  opacity: emailStatus === 'sending' ? 0.5 : 1,
                }}
              >
                {emailStatus === 'sending' ? 'Sending…' : 'Send confirmation'}
              </button>
              <button
                type="button"
                onClick={() => { setShowEmailForm(false); setEmailStatus('idle'); setNewEmail('') }}
                style={{
                  fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 400,
                  color: '#b0b0b0', background: 'none', border: 'none',
                  padding: 0, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
```

**Step 3: Verify**
- `npx tsc --noEmit` — no errors

**Step 4: Commit**
```bash
git add 'src/app/(sona)/(platform)/account/ProfileForm.tsx'
git commit -m "feat: add ProfileForm with name edit and email change"
```

---

### Task 3: DeleteAccountButton client component

**Files:**
- Create: `src/app/(sona)/(platform)/account/DeleteAccountButton.tsx`

**Context:**
- Client component — needs `useState` for the inline confirmation flow
- Three states: `idle` → `confirming` (shows input + button) → `deleting` (submitting)
- The confirmation input must match the exact string `'DELETE'` (uppercase) to enable the button
- Calls the `deleteAccount` Server Action directly from the client via `startTransition`
- Visual style: danger zone — thin border with a very subtle coral tint `rgba(222,62,123,0.06)`, delete button uses coral `#DE3E7B` background

**Step 1: Create `src/app/(sona)/(platform)/account/DeleteAccountButton.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { deleteAccount } from './actions'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      await deleteAccount()
    })
  }

  return (
    <div style={{
      border: '1px solid rgba(222,62,123,0.15)',
      borderRadius: 14,
      padding: '24px',
      backgroundColor: 'rgba(222,62,123,0.02)',
    }}>
      <p style={{
        fontFamily: GEIST, fontSize: '0.6875rem', fontWeight: 500,
        letterSpacing: '0.09em', textTransform: 'uppercase',
        color: '#DE3E7B', margin: '0 0 8px',
      }}>
        Danger zone
      </p>

      {!confirming ? (
        <>
          <p style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 300, color: '#6b6b6b', margin: '0 0 16px' }}>
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          <button
            onClick={() => setConfirming(true)}
            className="sona-btn-outline"
            style={{
              fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 400,
              color: '#DE3E7B', border: '1px solid rgba(222,62,123,0.3)',
              borderRadius: '980px', padding: '10px 24px',
              background: 'transparent', cursor: 'pointer',
            }}
          >
            Delete account
          </button>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 300, color: '#1a1a1a', margin: 0 }}>
            Type <strong>DELETE</strong> to confirm.
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoFocus
            style={{
              fontFamily: GEIST, fontSize: '0.9375rem', fontWeight: 300,
              color: '#1a1a1a', outline: 'none', border: 'none',
              borderBottom: '1px solid rgba(0,0,0,0.15)',
              backgroundColor: 'transparent', padding: '6px 0',
              maxWidth: 200,
            }}
          />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={handleDelete}
              disabled={confirmText !== 'DELETE' || isPending}
              style={{
                fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 500,
                color: '#fff', backgroundColor: '#DE3E7B',
                border: 'none', borderRadius: '980px', padding: '10px 24px',
                cursor: confirmText !== 'DELETE' || isPending ? 'default' : 'pointer',
                opacity: confirmText !== 'DELETE' || isPending ? 0.4 : 1,
              }}
            >
              {isPending ? 'Deleting…' : 'Delete my account'}
            </button>
            <button
              type="button"
              onClick={() => { setConfirming(false); setConfirmText('') }}
              disabled={isPending}
              style={{
                fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 400,
                color: '#b0b0b0', background: 'none', border: 'none',
                padding: 0, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify**
- `npx tsc --noEmit` — no errors

**Step 3: Commit**
```bash
git add 'src/app/(sona)/(platform)/account/DeleteAccountButton.tsx'
git commit -m "feat: add DeleteAccountButton with inline DELETE confirmation"
```

---

### Task 4: Update account/page.tsx

**Files:**
- Modify: `src/app/(sona)/(platform)/account/page.tsx`

**Context:**
- Add `full_name` to the profiles query
- Read `saved` from `searchParams` (same pattern as `dashboard/settings/page.tsx`)
- Replace the static email display in the header with `ProfileForm`
- Add `DeleteAccountButton` in a danger zone section at the bottom
- Remove the static `<h1>Account</h1>` + email paragraph from the header — `ProfileForm` now owns both name and email display. Keep just the `<h1>` heading.
- Layout: heading → divider → Profile section → divider → Billing section (if customer) → divider → Danger zone

**Step 1: Replace `src/app/(sona)/(platform)/account/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { BillingPortalButton } from './BillingPortalButton'
import { AccountSync } from './AccountSync'
import { ProfileForm } from './ProfileForm'
import { DeleteAccountButton } from './DeleteAccountButton'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

interface PageProps {
  searchParams: Promise<{ saved?: string }>
}

export default async function AccountPage({ searchParams }: PageProps) {
  const { saved } = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, stripe_customer_id')
    .eq('id', user.id)
    .single()

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      <AccountSync />
      <div style={{
        maxWidth: 520,
        margin: '0 auto',
        padding: '56px clamp(24px, 4vw, 48px) 96px',
      }}>

        {/* ── Page header ─────────────────────────────────────── */}
        <h1 style={{
          fontFamily: CORMORANT,
          fontSize: 'clamp(2rem, 4vw, 2.75rem)',
          fontWeight: 400,
          fontStyle: 'italic',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          color: '#1a1a1a',
          margin: '0 0 40px',
        }}>
          Account
        </h1>

        {/* ── Profile ─────────────────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <p style={{
            fontFamily: GEIST, fontSize: '0.6875rem', fontWeight: 500,
            letterSpacing: '0.09em', textTransform: 'uppercase',
            color: '#b0b0b0', margin: '0 0 24px',
          }}>
            Profile
          </p>
          <ProfileForm
            fullName={profile?.full_name ?? ''}
            email={user.email ?? ''}
            saved={saved === '1'}
          />
        </section>

        <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginBottom: 40 }} />

        {/* ── Billing ─────────────────────────────────────────── */}
        {profile?.stripe_customer_id && (
          <>
            <section style={{ marginBottom: 40 }}>
              <p style={{
                fontFamily: GEIST, fontSize: '0.6875rem', fontWeight: 500,
                letterSpacing: '0.09em', textTransform: 'uppercase',
                color: '#b0b0b0', margin: '0 0 16px',
              }}>
                Billing
              </p>
              <BillingPortalButton />
            </section>
            <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginBottom: 40 }} />
          </>
        )}

        {/* ── Danger zone ─────────────────────────────────────── */}
        <DeleteAccountButton />

      </div>
    </main>
  )
}
```

**Step 2: Verify manually**
- Visit `localhost:3000/account` — see heading, Profile section (name field + email), billing (if applicable), danger zone
- Edit name → Save → page reloads with "Saved" confirmation
- Click "Change email address" → enter new email → "Send confirmation" → see "Confirmation sent" message
- Click "Delete account" → type DELETE → button enables → click → redirected to `/`

**Step 3: TypeScript check**
```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 4: Commit**
```bash
git add 'src/app/(sona)/(platform)/account/page.tsx'
git commit -m "feat: build out account page with profile editing and account deletion"
```

---

### Task 5: Final check and push

**Step 1: TypeScript check**
```bash
npx tsc --noEmit
```

**Step 2: Manual smoke test**
- [ ] Name field shows current `full_name`, saves correctly
- [ ] Email section shows current email, "Change email" reveals form, sends confirmation
- [ ] Billing section shows only when Stripe customer exists
- [ ] Danger zone: "Delete account" → type DELETE → deletes → redirects to `/`
- [ ] Cancelling at any point returns to default state cleanly

**Step 3: Push**
```bash
git push
```
