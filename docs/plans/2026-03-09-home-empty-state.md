# /home Empty State Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the placeholder empty state on `/home` with a two-card layout presenting both value propositions — creating a Sona and discovering Sonas.

**Architecture:** Single file change to `src/app/(sona)/(platform)/home/page.tsx`. The `ownPortrait` value is already fetched by the server component — use it to conditionally render card 1. No new components, no new data fetching.

**Tech Stack:** Next.js 16 App Router, TypeScript, inline styles (no Tailwind classes in JSX).

---

### Task 1: Replace the empty state in `/home`

**Files:**
- Modify: `src/app/(sona)/(platform)/home/page.tsx` (lines 196–222 — the empty state block)

**Design tokens (already defined at top of file):**
```ts
const GEIST = 'var(--font-geist-sans)'
const CORMORANT = 'var(--font-cormorant)'
```

**Step 1: Locate the empty state block**

Open `src/app/(sona)/(platform)/home/page.tsx`. Find the else branch of the subscriptions conditional — currently lines ~196–222:

```tsx
) : (
  <div style={{
    border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14,
    padding: '40px 24px', textAlign: 'center',
  }}>
    <p ...>Your circle is empty.</p>
    <p ...>Add someone to your circle to start a conversation.</p>
    <Link href="/explore" ...>Discover Sonas</Link>
  </div>
)}
```

**Step 2: Replace the empty state block**

Replace the entire else branch content (the `<div>` and everything inside it) with the two-card layout below. The `ownPortrait` variable is already in scope from earlier in the component.

```tsx
) : (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 16,
  }}>

    {/* Card 1 — context-aware */}
    {ownPortrait ? (
      <div style={{
        border: '1px solid rgba(0,0,0,0.07)',
        borderRadius: 16,
        padding: '32px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <p style={{
          fontFamily: CORMORANT,
          fontSize: '1.375rem',
          fontWeight: 400,
          fontStyle: 'italic',
          letterSpacing: '-0.01em',
          color: '#1a1a1a',
          margin: 0,
          lineHeight: 1.25,
        }}>
          Be present. Even when you can&apos;t be.
        </p>
        <p style={{
          fontFamily: GEIST,
          fontSize: '0.875rem',
          fontWeight: 300,
          color: '#6b6b6b',
          margin: 0,
          lineHeight: 1.65,
        }}>
          Your Sona carries your perspective into every conversation. Add context, expand your circle, and track who&apos;s listening from your dashboard.
        </p>
        <div>
          <Link href="/dashboard" style={{
            fontFamily: GEIST,
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#fff',
            backgroundColor: '#1a1a1a',
            borderRadius: '980px',
            padding: '10px 24px',
            textDecoration: 'none',
            display: 'inline-block',
          }}>
            Go to dashboard
          </Link>
        </div>
      </div>
    ) : (
      <div style={{
        border: '1px solid rgba(0,0,0,0.07)',
        borderRadius: 16,
        padding: '32px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <p style={{
          fontFamily: CORMORANT,
          fontSize: '1.375rem',
          fontWeight: 400,
          fontStyle: 'italic',
          letterSpacing: '-0.01em',
          color: '#1a1a1a',
          margin: 0,
          lineHeight: 1.25,
        }}>
          Your whole self, present when it matters.
        </p>
        <p style={{
          fontFamily: GEIST,
          fontSize: '0.875rem',
          fontWeight: 300,
          color: '#6b6b6b',
          margin: 0,
          lineHeight: 1.65,
        }}>
          Share your knowledge, perspective, and way of thinking — with the people who matter, at the depth you choose. From open discovery to a private inner circle, you set the limits.
        </p>
        <div>
          <Link href="/dashboard/create" style={{
            fontFamily: GEIST,
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#fff',
            backgroundColor: '#1a1a1a',
            borderRadius: '980px',
            padding: '10px 24px',
            textDecoration: 'none',
            display: 'inline-block',
          }}>
            Create your Sona
          </Link>
        </div>
      </div>
    )}

    {/* Card 2 — always shown */}
    <div style={{
      border: '1px solid rgba(0,0,0,0.07)',
      borderRadius: 16,
      padding: '32px 28px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <p style={{
        fontFamily: CORMORANT,
        fontSize: '1.375rem',
        fontWeight: 400,
        fontStyle: 'italic',
        letterSpacing: '-0.01em',
        color: '#1a1a1a',
        margin: 0,
        lineHeight: 1.25,
      }}>
        The right mind in the room.
      </p>
      <p style={{
        fontFamily: GEIST,
        fontSize: '0.875rem',
        fontWeight: 300,
        color: '#6b6b6b',
        margin: 0,
        lineHeight: 1.65,
      }}>
        Build a circle of Sonas from thinkers, leaders, and people who inspire you. Their insights stay with you — a collection of minds to turn to whenever you need perspective, wisdom, or a second opinion.
      </p>
      <div>
        <Link href="/explore" style={{
          fontFamily: GEIST,
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#fff',
          backgroundColor: '#1a1a1a',
          borderRadius: '980px',
          padding: '10px 24px',
          textDecoration: 'none',
          display: 'inline-block',
        }}>
          Discover Sonas
        </Link>
      </div>
    </div>

  </div>
)}
```

**Step 3: TypeScript check**

```bash
cd /Users/julian/Documents/sona && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (zero errors).

**Step 4: Commit**

```bash
git add src/app/\(sona\)/\(platform\)/home/page.tsx
git commit -m "feat: replace /home empty state with two-card value proposition layout"
```
