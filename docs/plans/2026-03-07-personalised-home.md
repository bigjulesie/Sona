# Personalised Home Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redirect logged-in Sona users from `/` to a new `/home` page showing their circle of subscribed Sonas with last-active dates, and clean up the nav and Account page accordingly.

**Architecture:** Four self-contained changes — redirect on `/`, new `/home` page, nav updates in `SonaNav`, and Account page stripped to settings only. No new DB tables needed; last-active comes from `conversations.updated_at`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase JS (server client), inline styles matching the Sona design system.

---

### Task 1: Redirect logged-in Sona users from `/` to `/home`

**Files:**
- Modify: `src/app/page.tsx`

**Current code (lines 1–18):**
```tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LandingPage } from '@/components/sona/LandingPage'
import { getBrand } from '@/lib/brand'

export default async function Home() {
  const brand = await getBrand()

  if (brand === 'sona') {
    return <LandingPage />
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/chat')
  redirect('/login')
}
```

**Step 1: Update `src/app/page.tsx`**

Replace the entire file with:
```tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LandingPage } from '@/components/sona/LandingPage'
import { getBrand } from '@/lib/brand'

export default async function Home() {
  const brand = await getBrand()

  if (brand === 'sona') {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) redirect('/home')
    return <LandingPage />
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/chat')
  redirect('/login')
}
```

**Step 2: Verify manually**
- Visit `localhost:3000` logged in → should redirect to `/home` (will 404 until Task 2 is done — that's expected)
- Visit `localhost:3000` logged out → should show the Sona landing page

**Step 3: Commit**
```bash
git add src/app/page.tsx
git commit -m "feat: redirect logged-in Sona users from / to /home"
```

---

### Task 2: Create the `/home` page

**Files:**
- Create: `src/app/(sona)/(platform)/home/page.tsx`

This page inherits `SonaNav` from the platform layout automatically.

**Step 1: Create `src/app/(sona)/(platform)/home/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { formatDistanceToNow } from 'date-fns'

const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'

export const metadata = { title: 'My Circle — Sona' }

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Own portrait (if creator)
  const { data: ownPortrait } = await supabase
    .from('portraits')
    .select('id, slug, display_name, avatar_url')
    .eq('profile_id', user.id)
    .maybeSingle()

  // Subscribed Sonas
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('id, portrait_id, portraits(id, slug, display_name, avatar_url)')
    .eq('subscriber_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // Last conversation per portrait
  const { data: conversations } = await supabase
    .from('conversations')
    .select('portrait_id, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  // Build a map: portrait_id → most recent updated_at
  const lastActive: Record<string, string> = {}
  for (const c of conversations ?? []) {
    if (!lastActive[c.portrait_id]) lastActive[c.portrait_id] = c.updated_at
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      <div style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '56px clamp(24px, 4vw, 48px) 96px',
      }}>

        {/* ── Page header ─────────────────────────────────────────── */}
        <h1 style={{
          fontFamily: CORMORANT,
          fontSize: 'clamp(2rem, 4vw, 2.75rem)',
          fontWeight: 400,
          fontStyle: 'italic',
          letterSpacing: '-0.02em',
          color: '#1a1a1a',
          margin: '0 0 48px',
        }}>
          My Circle
        </h1>

        {/* ── Own Sona (creator only) ──────────────────────────────── */}
        {ownPortrait && (
          <section style={{ marginBottom: 48 }}>
            <p style={{
              fontFamily: GEIST, fontSize: '0.6875rem', fontWeight: 500,
              letterSpacing: '0.09em', textTransform: 'uppercase',
              color: '#b0b0b0', margin: '0 0 16px',
            }}>
              Your Sona
            </p>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 20px',
              border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14,
            }}>
              {ownPortrait.avatar_url ? (
                <img src={ownPortrait.avatar_url} alt={ownPortrait.display_name}
                  style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  backgroundColor: 'rgba(0,0,0,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontFamily: CORMORANT, fontSize: '1.25rem', fontStyle: 'italic', color: '#1a1a1a' }}>
                    {ownPortrait.display_name?.[0] ?? '?'}
                  </span>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontFamily: CORMORANT, fontSize: '1.125rem', fontWeight: 400,
                  fontStyle: 'italic', color: '#1a1a1a', margin: 0, lineHeight: 1.2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {ownPortrait.display_name}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Link href={`/sona/${ownPortrait.slug}`} style={{
                  fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 400,
                  color: '#6b6b6b', textDecoration: 'none',
                  padding: '7px 16px', borderRadius: '980px',
                  border: '1px solid rgba(0,0,0,0.08)',
                }}>View</Link>
                <Link href="/dashboard" style={{
                  fontFamily: GEIST, fontSize: '0.8125rem', fontWeight: 500,
                  color: '#fff', textDecoration: 'none',
                  padding: '7px 16px', borderRadius: '980px',
                  backgroundColor: '#1a1a1a',
                }}>Manage</Link>
              </div>
            </div>
          </section>
        )}

        {/* ── Circle ──────────────────────────────────────────────── */}
        <section>
          <p style={{
            fontFamily: GEIST, fontSize: '0.6875rem', fontWeight: 500,
            letterSpacing: '0.09em', textTransform: 'uppercase',
            color: '#b0b0b0', margin: '0 0 16px',
          }}>
            Your circle
          </p>

          {subscriptions && subscriptions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {subscriptions.map((sub) => {
                const portrait = sub.portraits as any
                const ts = lastActive[sub.portrait_id]
                const lastSeen = ts
                  ? formatDistanceToNow(new Date(ts), { addSuffix: true })
                  : null

                return (
                  <Link
                    key={sub.id}
                    href={`/sona/${portrait.slug}`}
                    className="sona-card"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: '16px 20px', backgroundColor: '#fff',
                      border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14,
                      textDecoration: 'none',
                    }}
                  >
                    {portrait.avatar_url ? (
                      <img src={portrait.avatar_url} alt={portrait.display_name}
                        style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%',
                        backgroundColor: 'rgba(0,0,0,0.04)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <span style={{ fontFamily: CORMORANT, fontSize: '1.25rem', fontStyle: 'italic', color: '#1a1a1a' }}>
                          {portrait.display_name?.[0] ?? '?'}
                        </span>
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontFamily: CORMORANT, fontSize: '1.125rem', fontWeight: 400,
                        fontStyle: 'italic', color: '#1a1a1a', margin: 0, lineHeight: 1.2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {portrait.display_name}
                      </p>
                      {lastSeen && (
                        <p style={{
                          fontFamily: GEIST, fontSize: '0.75rem', fontWeight: 300,
                          color: '#b0b0b0', margin: '2px 0 0',
                        }}>
                          {lastSeen}
                        </p>
                      )}
                    </div>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#c0c0c0" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M6 3l5 5-5 5" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div style={{
              border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14,
              padding: '40px 24px', textAlign: 'center',
            }}>
              <p style={{
                fontFamily: CORMORANT, fontSize: '1.5rem', fontWeight: 400,
                fontStyle: 'italic', color: '#1a1a1a', margin: '0 0 8px',
              }}>
                Your circle is empty.
              </p>
              <p style={{
                fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 300,
                color: '#9b9b9b', margin: '0 0 24px',
              }}>
                Add someone to your circle to start a conversation.
              </p>
              <Link href="/explore" style={{
                fontFamily: GEIST, fontSize: '0.875rem', fontWeight: 500,
                color: '#fff', backgroundColor: '#1a1a1a',
                borderRadius: '980px', padding: '10px 24px',
                textDecoration: 'none', display: 'inline-block',
              }}>
                Discover Sonas
              </Link>
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
```

**Step 2: Install date-fns if not present**
```bash
npm list date-fns 2>/dev/null | grep date-fns || npm install date-fns
```

**Step 3: Verify manually**
- Visit `localhost:3000` logged in → redirected to `/home` → see your circle
- Each card shows portrait name + last active date if you've had a conversation
- Creator sees "Your Sona" section above the circle

**Step 4: Commit**
```bash
git add 'src/app/(sona)/(platform)/home/page.tsx'
git commit -m "feat: add /home personalised circle page"
```

---

### Task 3: Update SonaNav — add My Circle, rename Account to Settings

**Files:**
- Modify: `src/components/sona/SonaNav.tsx`

**Step 1: Update the logged-in nav links**

Find this block in `SonaNav.tsx` (around line 58–65):
```tsx
{user ? (
  <>
    {hasPortrait && (
      <Link href="/dashboard" className="sona-link" style={linkStyle}>Dashboard</Link>
    )}
    <Link href="/account" className="sona-link" style={linkStyle}>Account</Link>
    <SignOutButton />
  </>
```

Replace with:
```tsx
{user ? (
  <>
    <Link href="/home" className="sona-link" style={linkStyle}>My Circle</Link>
    {hasPortrait && (
      <Link href="/dashboard" className="sona-link" style={linkStyle}>Dashboard</Link>
    )}
    <Link href="/account" className="sona-link" style={linkStyle}>Settings</Link>
    <SignOutButton />
  </>
```

**Step 2: Verify manually**
- Logged in: nav shows Discover · My Circle · Dashboard (if creator) · Settings · Sign out
- Logged out: nav shows Discover · Sign in · Get started

**Step 3: Commit**
```bash
git add src/components/sona/SonaNav.tsx
git commit -m "feat: add My Circle nav link and rename Account to Settings"
```

---

### Task 4: Strip Account page to settings only

**Files:**
- Modify: `src/app/(sona)/(platform)/account/page.tsx`

The "Your Sona" section and "Your circle" section were recently added/exist in this file. Remove both — they now live on `/home`. Keep only the page header (email), billing section, and the divider between them.

**Step 1: Remove the `ownPortrait` query and the "Your Sona" section**

Delete these lines from the data-fetching section:
```tsx
const { data: ownPortrait } = await supabase
  .from('portraits')
  .select('id, slug, display_name, avatar_url')
  .eq('profile_id', user.id)
  .maybeSingle()
```

And remove the entire `{/* ── Your Sona */}` section and the divider after it from the JSX.

**Step 2: Remove the `subscriptions` query and "Your circle" section**

Delete:
```tsx
const { data: subscriptions } = await supabase
  .from('subscriptions')
  .select('id, status, portraits(id, slug, display_name, avatar_url, monthly_price_cents)')
  .eq('subscriber_id', user.id)
  .order('created_at', { ascending: false })
```

And remove the entire `{/* ── Subscriptions */}` section from the JSX.

**Step 3: Add a divider between header and billing**

After the page header block, ensure there is:
```tsx
<div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginBottom: 40 }} />
```

**Step 4: Verify the final account page**
- Shows: heading "Settings", user email, divider, billing portal button (if Stripe customer)
- Does NOT show: Your Sona, Your circle

**Step 5: Commit**
```bash
git add 'src/app/(sona)/(platform)/account/page.tsx'
git commit -m "feat: strip account page to settings only, circle moved to /home"
```

---

### Task 5: Final check and push

**Step 1: TypeScript check**
```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 2: Manual smoke test**
- [ ] Logged-out user visits `/` → sees landing page
- [ ] Logged-in user visits `/` → redirected to `/home`
- [ ] `/home` shows circle cards with last-active dates
- [ ] Creator sees "Your Sona" row on `/home`
- [ ] Nav: My Circle · Dashboard (creator) · Settings · Sign out
- [ ] `/account` shows only email + billing

**Step 3: Push**
```bash
git push
```
