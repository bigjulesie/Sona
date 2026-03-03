# Phase 3 — B2C Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Launch entersona.com as a public creator/consumer Sona platform sharing the same Next.js app and Supabase backend as neuralheirloom.com.

**Architecture:** Single Next.js 16 app with hostname-based routing via middleware — `neuralheirloom.com` routes to `(nh)` route group, `entersona.com` routes to `(sona)` route group. Stripe Billing (manual payouts) handles per-Sona subscriptions. The existing NH admin and chat flows are untouched.

**Tech Stack:** Next.js 16 App Router, TypeScript, TailwindCSS, Supabase (Postgres + pgvector + Auth), Stripe, Vitest

**Design doc:** `docs/plans/2026-03-02-phase3-design.md`

---

## Prerequisites (done before starting this plan)

- [x] `src/middleware.ts` — renamed from `proxy.ts`, export renamed to `middleware`
- [ ] Vercel project created, env vars added, both domains configured
- [ ] Supabase: site URL updated to `neuralheirloom.com`, redirect URLs include both domains
- [ ] DNS for `neuralheirloom.com` and `entersona.com` pointing to Vercel

The implementation tasks below assume the Vercel/DNS setup is complete. Do not begin Phase A until the app is deployed and accessible on both domains.

---

## Phase A: Foundation

### Task 1: Install Stripe

**Files:**
- Modify: `package.json` (via npm install)

**Step 1: Install**

```bash
npm install stripe
```

**Step 2: Verify it's in package.json**

```bash
grep '"stripe"' package.json
```

Expected: `"stripe": "^17.x.x"` (or current latest).

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install stripe"
```

---

### Task 2: Extend middleware with hostname brand detection

The middleware currently guards auth. Extend it to also detect the brand from the `Host` header, inject an `x-brand` response header, and allow Sona's public routes through unauthenticated.

**Files:**
- Modify: `src/middleware.ts`
- Create: `tests/lib/middleware.test.ts`

**Step 1: Write failing tests**

Create `tests/lib/middleware.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { detectBrand, isSonaPublicRoute } from '@/middleware'

describe('detectBrand', () => {
  it('returns nh for neuralheirloom.com', () => {
    expect(detectBrand('neuralheirloom.com')).toBe('nh')
  })

  it('returns sona for entersona.com', () => {
    expect(detectBrand('entersona.com')).toBe('sona')
  })

  it('returns BRAND env var for localhost', () => {
    process.env.BRAND = 'sona'
    expect(detectBrand('localhost:3000')).toBe('sona')
    delete process.env.BRAND
  })

  it('defaults to nh when BRAND unset', () => {
    delete process.env.BRAND
    expect(detectBrand('localhost:3000')).toBe('nh')
  })
})

describe('isSonaPublicRoute', () => {
  it('allows /explore', () => expect(isSonaPublicRoute('/explore')).toBe(true))
  it('allows /sona/john-doe', () => expect(isSonaPublicRoute('/sona/john-doe')).toBe(true))
  it('allows /signup', () => expect(isSonaPublicRoute('/signup')).toBe(true))
  it('blocks /dashboard', () => expect(isSonaPublicRoute('/dashboard')).toBe(false))
  it('blocks /account', () => expect(isSonaPublicRoute('/account')).toBe(false))
})
```

**Step 2: Run to confirm failure**

```bash
npx vitest run tests/lib/middleware.test.ts
```

Expected: FAIL — `detectBrand` not exported.

**Step 3: Replace `src/middleware.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server'

export type Brand = 'nh' | 'sona'

export function detectBrand(host: string): Brand {
  if (host.includes('entersona.com')) return 'sona'
  if (host.includes('neuralheirloom.com')) return 'nh'
  return (process.env.BRAND as Brand) ?? 'nh'
}

export function isSonaPublicRoute(pathname: string): boolean {
  return (
    pathname === '/explore' ||
    pathname.startsWith('/sona/') ||
    pathname === '/signup'
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') ?? ''
  const brand = detectBrand(host)

  const isSharedPublicRoute =
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api') ||
    pathname === '/login' ||
    pathname === '/'

  const isPublic =
    isSharedPublicRoute ||
    (brand === 'sona' && isSonaPublicRoute(pathname))

  let response: ReturnType<typeof NextResponse.next>

  if (isPublic) {
    response = NextResponse.next()
  } else {
    const hasSession = request.cookies
      .getAll()
      .some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))

    if (!hasSession) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    response = NextResponse.next()
  }

  response.headers.set('x-brand', brand)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Step 4: Run tests to confirm pass**

```bash
npx vitest run tests/lib/middleware.test.ts
```

Expected: PASS all 9 tests.

**Step 5: Commit**

```bash
git add src/middleware.ts tests/lib/middleware.test.ts
git commit -m "feat: extend middleware with hostname brand detection and Sona public routes"
```

---

### Task 3: Brand context utility

Server components need to read the current brand without prop-drilling.

**Files:**
- Create: `src/lib/brand.ts`
- Create: `tests/lib/brand.test.ts`

**Step 1: Write failing test**

```typescript
// tests/lib/brand.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

import { getBrand } from '@/lib/brand'
import { headers } from 'next/headers'

describe('getBrand', () => {
  it('returns nh when x-brand is nh', async () => {
    vi.mocked(headers).mockReturnValue({ get: (k: string) => k === 'x-brand' ? 'nh' : null } as any)
    expect(await getBrand()).toBe('nh')
  })

  it('returns sona when x-brand is sona', async () => {
    vi.mocked(headers).mockReturnValue({ get: (k: string) => k === 'x-brand' ? 'sona' : null } as any)
    expect(await getBrand()).toBe('sona')
  })

  it('defaults to nh when header missing', async () => {
    vi.mocked(headers).mockReturnValue({ get: () => null } as any)
    expect(await getBrand()).toBe('nh')
  })
})
```

**Step 2: Run to confirm failure**

```bash
npx vitest run tests/lib/brand.test.ts
```

**Step 3: Create `src/lib/brand.ts`**

```typescript
import { headers } from 'next/headers'
import type { Brand } from '@/middleware'

export async function getBrand(): Promise<Brand> {
  const h = await headers()
  const brand = h.get('x-brand')
  return brand === 'sona' ? 'sona' : 'nh'
}
```

**Step 4: Run to confirm pass**

```bash
npx vitest run tests/lib/brand.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/brand.ts tests/lib/brand.test.ts
git commit -m "feat: add getBrand server utility"
```

---

### Task 4: Restructure routes into (nh) and (sona) route groups

Move existing authenticated/admin routes into `(nh)`. Scaffold `(sona)`. This is a pure file reorganisation — no logic changes.

**Files:**
- Rename: `src/app/(authenticated)/` → `src/app/(nh)/`
- Move: `src/app/login/` → `src/app/(shared)/login/`
- Move: `src/app/auth/` → `src/app/(shared)/auth/`
- Create: `src/app/(nh)/layout.tsx`
- Create: `src/app/(sona)/layout.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Move (authenticated) to (nh)**

```bash
mkdir -p "src/app/(nh)"
cp -r "src/app/(authenticated)/." "src/app/(nh)/"
rm -rf "src/app/(authenticated)"
```

**Step 2: Move shared auth routes**

```bash
mkdir -p "src/app/(shared)"
mv "src/app/login" "src/app/(shared)/login"
mv "src/app/auth" "src/app/(shared)/auth"
```

**Step 3: Create `src/app/(nh)/layout.tsx`**

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Neural Heirloom', template: '%s | Neural Heirloom' },
  description: 'A private archive of memory and voice',
  icons: { icon: '/brand_assets/favicon.svg' },
}

export default function NHLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

**Step 4: Create `src/app/(sona)/layout.tsx`**

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Sona', template: '%s | Sona' },
  description: 'Meet the people who shaped your world',
}

export default function SonaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

**Step 5: Strip NH-specific metadata from root `src/app/layout.tsx`**

Remove the `title`, `description`, and `icons` from the `metadata` export — those now live in the brand layouts. Keep fonts and body styles (these apply to both brands).

**Step 6: Verify dev server**

```bash
npm run dev
```

- `localhost:3000/login` → login page renders
- `localhost:3000/admin` → redirects to login (unauthenticated)
- `localhost:3000/chat` → redirects to login (unauthenticated)

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor: reorganise routes into (nh), (sona), and (shared) route groups"
```

---

## Phase B: Database Migrations

Apply migrations with `npx supabase migration up` (or via Supabase dashboard SQL editor for hosted projects). After each migration, regenerate types:

```bash
npx supabase gen types typescript --local > src/lib/supabase/types.ts
```

If using hosted Supabase (not local), run the SQL directly in the Supabase dashboard SQL editor.

---

### Task 5: Portraits additions

**Files:**
- Create: `supabase/migrations/00008_portraits_phase3.sql`

**Step 1: Create migration**

```sql
-- Phase 3: portraits additions
ALTER TABLE portraits
  ADD COLUMN IF NOT EXISTS creator_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brand               TEXT NOT NULL DEFAULT 'nh'
                                                 CHECK (brand IN ('nh', 'sona')),
  ADD COLUMN IF NOT EXISTS is_public           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS stripe_price_id     TEXT,
  ADD COLUMN IF NOT EXISTS tagline             TEXT,
  ADD COLUMN IF NOT EXISTS bio                 TEXT,
  ADD COLUMN IF NOT EXISTS category            TEXT,
  ADD COLUMN IF NOT EXISTS tags                TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_portraits_brand_public
  ON portraits(brand, is_public) WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_portraits_creator
  ON portraits(creator_id) WHERE creator_id IS NOT NULL;
```

**Step 2: Apply**

```bash
npx supabase migration up
# or paste into Supabase SQL editor
```

**Step 3: Regenerate types**

```bash
npx supabase gen types typescript --local > src/lib/supabase/types.ts
```

**Step 4: Commit**

```bash
git add supabase/migrations/00008_portraits_phase3.sql src/lib/supabase/types.ts
git commit -m "db: add phase 3 columns to portraits"
```

---

### Task 6: Profiles additions + subscriptions table

**Files:**
- Create: `supabase/migrations/00009_profiles_subscriptions.sql`

**Step 1: Create migration**

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id  TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portrait_id             UUID NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  stripe_subscription_id  TEXT UNIQUE,
  status                  TEXT NOT NULL
                            CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
  tier                    access_tier NOT NULL DEFAULT 'acquaintance',
  current_period_end      TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now(),
  UNIQUE(subscriber_id, portrait_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_portrait ON subscriptions(portrait_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe
  ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Subscribers see their own subscriptions
CREATE POLICY "subscribers_read_own" ON subscriptions
  FOR SELECT USING (subscriber_id = auth.uid());

-- Service role manages all (webhook handler uses service role key)
CREATE POLICY "service_role_all" ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');
```

**Step 2: Apply, regenerate types, commit**

```bash
npx supabase migration up
npx supabase gen types typescript --local > src/lib/supabase/types.ts
git add supabase/migrations/00009_profiles_subscriptions.sql src/lib/supabase/types.ts
git commit -m "db: add subscriptions table and profiles phase 3 columns"
```

---

### Task 7: Interview requests, ratings, discovery view

**Files:**
- Create: `supabase/migrations/00010_interview_requests_ratings.sql`

**Step 1: Create migration**

```sql
CREATE TABLE IF NOT EXISTS interview_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portrait_id      UUID NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  whatsapp_number  TEXT NOT NULL,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'scheduled', 'completed')),
  scheduled_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE interview_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creators_manage_own" ON interview_requests
  FOR ALL USING (creator_id = auth.uid());

CREATE POLICY "admins_read_all" ON interview_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "admins_update" ON interview_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE TABLE IF NOT EXISTS ratings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portrait_id    UUID NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  score          INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(subscriber_id, portrait_id)
);

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscribers_manage_own_ratings" ON ratings
  FOR ALL USING (subscriber_id = auth.uid());

CREATE POLICY "public_read_ratings" ON ratings
  FOR SELECT USING (true);

-- Discovery view: aggregate stats per public Sona portrait
CREATE OR REPLACE VIEW portrait_discovery AS
SELECT
  p.id,
  p.slug,
  p.display_name,
  p.tagline,
  p.avatar_url,
  p.category,
  p.tags,
  p.monthly_price_cents,
  p.brand,
  COUNT(DISTINCT s.id) FILTER (
    WHERE s.status = 'active'
  )                                                       AS subscriber_count,
  COUNT(DISTINCT s.id) FILTER (
    WHERE s.status = 'active'
    AND s.created_at > now() - interval '30 days'
  )                                                       AS new_subscribers_30d,
  ROUND(AVG(r.score)::numeric, 1)                        AS avg_rating,
  COUNT(r.id)                                            AS rating_count
FROM portraits p
LEFT JOIN subscriptions s ON s.portrait_id = p.id
LEFT JOIN ratings r ON r.portrait_id = p.id
WHERE p.is_public = true AND p.brand = 'sona'
GROUP BY p.id;
```

**Step 2: Apply, regenerate types, commit**

```bash
npx supabase migration up
npx supabase gen types typescript --local > src/lib/supabase/types.ts
git add supabase/migrations/00010_interview_requests_ratings.sql src/lib/supabase/types.ts
git commit -m "db: add interview_requests, ratings tables and portrait_discovery view"
```

---

## Phase C: Stripe Integration

### Task 8: Stripe client and helpers

**Files:**
- Create: `src/lib/stripe/client.ts`

**Step 1: Create `src/lib/stripe/client.ts`**

```typescript
import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set')
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-01-27.acacia' })
  }
  return _stripe
}

export async function getOrCreateStripeCustomer(
  supabase: any,
  userId: string,
  email: string
): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (profile?.stripe_customer_id) return profile.stripe_customer_id

  const customer = await getStripe().customers.create({
    email,
    metadata: { supabase_user_id: userId },
  })

  await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId)

  return customer.id
}
```

**Step 2: Commit**

```bash
git add src/lib/stripe/client.ts
git commit -m "feat: add stripe client singleton and customer helper"
```

---

### Task 9: Checkout, webhook, portal, and free subscription API endpoints

**Files:**
- Create: `src/app/api/stripe/checkout/route.ts`
- Create: `src/app/api/stripe/webhook/route.ts`
- Create: `src/app/api/stripe/portal/route.ts`
- Create: `src/app/api/subscriptions/route.ts`

**Step 1: Create `src/app/api/stripe/checkout/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getStripe, getOrCreateStripeCustomer } from '@/lib/stripe/client'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { portrait_id } = await request.json()
  if (!portrait_id) return NextResponse.json({ error: 'portrait_id required' }, { status: 400 })

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, slug, display_name, stripe_price_id, monthly_price_cents')
    .eq('id', portrait_id)
    .single()

  if (!portrait) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!portrait.stripe_price_id) return NextResponse.json({ error: 'Portrait is free' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single()

  const customerId = await getOrCreateStripeCustomer(supabase, user.id, profile!.email)
  const origin = request.headers.get('origin') ?? `https://${process.env.NEXT_PUBLIC_SONA_DOMAIN}`

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: portrait.stripe_price_id, quantity: 1 }],
    success_url: `${origin}/sona/${portrait.slug}?subscribed=true`,
    cancel_url: `${origin}/sona/${portrait.slug}`,
    metadata: { portrait_id, user_id: user.id },
  })

  return NextResponse.json({ url: session.url })
}
```

**Step 2: Create `src/app/api/stripe/webhook/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const { portrait_id, user_id } = sub.metadata
      if (!portrait_id || !user_id) break

      const status =
        sub.status === 'active' ? 'active'
        : sub.status === 'trialing' ? 'trialing'
        : sub.status === 'past_due' ? 'past_due'
        : 'cancelled'

      await supabase.from('subscriptions').upsert({
        subscriber_id: user_id,
        portrait_id,
        stripe_subscription_id: sub.id,
        status,
        tier: 'acquaintance',
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      }, { onConflict: 'subscriber_id,portrait_id' })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('stripe_subscription_id', sub.id)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.subscription) {
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', invoice.subscription as string)
      }
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.subscription) {
        await supabase
          .from('subscriptions')
          .update({ status: 'active' })
          .eq('stripe_subscription_id', invoice.subscription as string)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
```

**Step 3: Create `src/app/api/stripe/portal/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account' }, { status: 404 })
  }

  const origin = request.headers.get('origin') ?? `https://${process.env.NEXT_PUBLIC_SONA_DOMAIN}`
  const session = await getStripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${origin}/account`,
  })

  return NextResponse.json({ url: session.url })
}
```

**Step 4: Create `src/app/api/subscriptions/route.ts`** (free Sona follow)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { portrait_id } = await request.json()

  const { data: portrait } = await supabase
    .from('portraits')
    .select('monthly_price_cents, is_public')
    .eq('id', portrait_id)
    .single()

  if (!portrait?.is_public) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (portrait.monthly_price_cents) {
    return NextResponse.json({ error: 'Use checkout for paid Sonas' }, { status: 400 })
  }

  await createAdminClient().from('subscriptions').upsert({
    subscriber_id: user.id,
    portrait_id,
    status: 'active',
    tier: 'acquaintance',
  }, { onConflict: 'subscriber_id,portrait_id' })

  return NextResponse.json({ ok: true })
}
```

**Step 5: Test webhook locally**

Install Stripe CLI if needed: `brew install stripe/stripe-cli/stripe`

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# in another terminal:
stripe trigger customer.subscription.created
```

Expected: `200 POST /api/stripe/webhook` in the Stripe CLI output.

**Step 6: Commit**

```bash
git add src/app/api/stripe src/app/api/subscriptions
git commit -m "feat: add stripe checkout, webhook, portal, and free subscription endpoints"
```

---

### Task 10: Portrait pricing API + Stripe product creation

Called by the creation wizard when a creator sets a price.

**Files:**
- Create: `src/app/api/portraits/pricing/route.ts`

**Step 1: Create `src/app/api/portraits/pricing/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/client'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { portrait_id, monthly_price_cents } = await request.json()

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, display_name, creator_id')
    .eq('id', portrait_id)
    .single()

  if (!portrait || portrait.creator_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let stripe_price_id: string | null = null

  if (monthly_price_cents) {
    const stripe = getStripe()
    const product = await stripe.products.create({
      name: `${portrait.display_name} — Sona`,
      metadata: { portrait_id },
    })
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: monthly_price_cents,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { portrait_id },
    })
    stripe_price_id = price.id
  }

  await createAdminClient()
    .from('portraits')
    .update({ monthly_price_cents: monthly_price_cents ?? null, stripe_price_id })
    .eq('id', portrait_id)

  return NextResponse.json({ ok: true })
}
```

**Step 2: Commit**

```bash
git add src/app/api/portraits
git commit -m "feat: add portrait pricing endpoint with stripe product creation"
```

---

## Phase D: Subscription access helper

### Task 11: Subscription access check utility

Used by `/api/chat` to gate paid Sonas.

**Files:**
- Create: `src/lib/subscriptions.ts`
- Create: `tests/lib/subscriptions.test.ts`

**Step 1: Write failing test**

```typescript
// tests/lib/subscriptions.test.ts
import { describe, it, expect } from 'vitest'
import { hasActiveSubscription } from '@/lib/subscriptions'

const mockSupabase = (row: object | null) => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: row }),
          }),
        }),
      }),
    }),
  }),
})

describe('hasActiveSubscription', () => {
  it('returns true when active subscription exists', async () => {
    expect(await hasActiveSubscription(mockSupabase({ id: 'sub-1' }) as any, 'u1', 'p1')).toBe(true)
  })

  it('returns false when no subscription exists', async () => {
    expect(await hasActiveSubscription(mockSupabase(null) as any, 'u1', 'p1')).toBe(false)
  })
})
```

**Step 2: Run to confirm failure**

```bash
npx vitest run tests/lib/subscriptions.test.ts
```

**Step 3: Create `src/lib/subscriptions.ts`**

```typescript
export async function hasActiveSubscription(
  supabase: any,
  userId: string,
  portraitId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('subscriber_id', userId)
    .eq('portrait_id', portraitId)
    .eq('status', 'active')
    .maybeSingle()
  return !!data
}
```

**Step 4: Run to confirm pass**

```bash
npx vitest run tests/lib/subscriptions.test.ts
```

**Step 5: Update `src/app/api/chat/route.ts`** — gate paid Sonas

After the portrait fetch, update the select to include `brand` and `monthly_price_cents`, then add the subscription check:

```typescript
// Change this line:
const { data: portrait } = await supabase
  .from('portraits')
  .select('system_prompt, display_name')
  .eq('id', portrait_id)
  .single()

// To:
const { data: portrait } = await supabase
  .from('portraits')
  .select('system_prompt, display_name, brand, monthly_price_cents')
  .eq('id', portrait_id)
  .single()
```

Then after the `if (!portrait)` check, add:

```typescript
if (portrait.brand === 'sona' && portrait.monthly_price_cents) {
  const { hasActiveSubscription } = await import('@/lib/subscriptions')
  if (!(await hasActiveSubscription(supabase, user.id, portrait_id))) {
    return new Response('Subscription required', { status: 403 })
  }
}
```

**Step 6: Commit**

```bash
git add src/lib/subscriptions.ts tests/lib/subscriptions.test.ts src/app/api/chat/route.ts
git commit -m "feat: add subscription access check and gate paid Sona chat"
```

---

## Phase E: Public Sona Pages

### Task 12: Explore / discovery page

**Files:**
- Create: `src/app/(sona)/explore/page.tsx`
- Create: `src/components/sona/SonaCard.tsx`

**Step 1: Create `src/components/sona/SonaCard.tsx`**

```typescript
import Link from 'next/link'

interface SonaCardProps {
  id: string
  slug: string
  display_name: string
  tagline: string | null
  avatar_url: string | null
  category: string | null
  subscriber_count: number
  avg_rating: string | null
  rating_count: number
  monthly_price_cents: number | null
}

export function SonaCard({
  slug, display_name, tagline, avatar_url, category,
  subscriber_count, avg_rating, rating_count, monthly_price_cents,
}: SonaCardProps) {
  return (
    <Link href={`/sona/${slug}`} className="block group">
      <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-300 hover:shadow-md transition-all">
        <div className="flex items-start gap-4">
          {avatar_url ? (
            <img src={avatar_url} alt={display_name}
              className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-semibold text-gray-400">{display_name[0]}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
              {display_name}
            </h3>
            {tagline && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{tagline}</p>}
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
          <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
            {category && (
              <span className="bg-gray-50 px-2 py-0.5 rounded-full">{category}</span>
            )}
            <span>{(subscriber_count ?? 0).toLocaleString()} subscribers</span>
            {avg_rating && rating_count >= 5 && <span>★ {avg_rating}</span>}
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
            monthly_price_cents
              ? 'bg-indigo-50 text-indigo-600'
              : 'bg-green-50 text-green-600'
          }`}>
            {monthly_price_cents
              ? `$${(monthly_price_cents / 100).toFixed(0)}/mo`
              : 'Free'}
          </span>
        </div>
      </div>
    </Link>
  )
}
```

**Step 2: Create `src/app/(sona)/explore/page.tsx`**

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SonaCard } from '@/components/sona/SonaCard'

const CATEGORIES = [
  'All', 'Technology', 'Business', 'Science', 'Arts',
  'Sport', 'Politics', 'Education', 'Health', 'Other',
]

interface PageProps {
  searchParams: Promise<{ category?: string; sort?: string; q?: string }>
}

export default async function ExplorePage({ searchParams }: PageProps) {
  const { category, sort = 'popular', q } = await searchParams
  const supabase = await createServerSupabaseClient()

  let query = supabase.from('portrait_discovery').select('*')

  if (category && category !== 'All') query = query.eq('category', category)
  if (q) query = query.ilike('display_name', `%${q}%`)

  const orderCol =
    sort === 'top_rated' ? 'avg_rating'
    : sort === 'trending' ? 'new_subscribers_30d'
    : 'subscriber_count'

  query = query.order(orderCol, { ascending: false })

  const { data: sonas } = await query

  return (
    <main className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Explore Sonas</h1>
      <p className="text-gray-500 mb-8">Discover and connect with remarkable people.</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(cat => (
          <a key={cat}
            href={`/explore?category=${cat}&sort=${sort}${q ? `&q=${q}` : ''}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              (category ?? 'All') === cat
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {cat}
          </a>
        ))}
      </div>

      <div className="flex items-center gap-4 mb-8">
        <form className="flex-1 max-w-xs">
          <input name="q" defaultValue={q} placeholder="Search by name…"
            className="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </form>
        <div className="flex gap-1">
          {[
            { value: 'popular', label: 'Popular' },
            { value: 'top_rated', label: 'Top rated' },
            { value: 'trending', label: 'Trending' },
          ].map(opt => (
            <a key={opt.value}
              href={`/explore?sort=${opt.value}${category ? `&category=${category}` : ''}${q ? `&q=${q}` : ''}`}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                sort === opt.value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
              }`}>
              {opt.label}
            </a>
          ))}
        </div>
      </div>

      {sonas && sonas.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sonas.map(sona => <SonaCard key={sona.id} {...(sona as any)} />)}
        </div>
      ) : (
        <p className="text-center text-gray-400 py-16">No Sonas found.</p>
      )}
    </main>
  )
}
```

**Step 3: Verify page renders**

```bash
npm run dev  # BRAND=sona
```

Visit `localhost:3000/explore` — empty grid renders without error.

**Step 4: Commit**

```bash
git add src/app/\(sona\)/explore src/components/sona/SonaCard.tsx
git commit -m "feat: add Sona explore/discovery page"
```

---

### Task 13: Public Sona profile page

**Files:**
- Create: `src/app/(sona)/sona/[slug]/page.tsx`
- Create: `src/components/sona/SubscribeButton.tsx`

**Step 1: Create `src/components/sona/SubscribeButton.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  portraitId: string
  isFree: boolean
  isLoggedIn: boolean
}

export function SubscribeButton({ portraitId, isFree, isLoggedIn }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    if (!isLoggedIn) {
      router.push(`/login?next=/sona/${portraitId}`)
      return
    }
    setLoading(true)
    try {
      if (isFree) {
        await fetch('/api/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ portrait_id: portraitId }),
        })
        router.refresh()
      } else {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ portrait_id: portraitId }),
        })
        const { url } = await res.json()
        if (url) window.location.href = url
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={loading}
      className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">
      {loading ? 'Loading…' : isFree ? 'Follow for free' : 'Subscribe'}
    </button>
  )
}
```

**Step 2: Create `src/app/(sona)/sona/[slug]/page.tsx`**

```typescript
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SubscribeButton } from '@/components/sona/SubscribeButton'
import { ChatInterface } from '@/components/chat/ChatInterface'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function SonaPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, display_name, tagline, bio, avatar_url, monthly_price_cents, slug')
    .eq('slug', slug)
    .eq('brand', 'sona')
    .eq('is_public', true)
    .single()

  if (!portrait) notFound()

  let isSubscribed = false
  if (user) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('subscriber_id', user.id)
      .eq('portrait_id', portrait.id)
      .eq('status', 'active')
      .maybeSingle()
    isSubscribed = !!sub
  }

  const { data: stats } = await supabase
    .from('portrait_discovery')
    .select('subscriber_count, avg_rating, rating_count')
    .eq('id', portrait.id)
    .maybeSingle()

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-start gap-6 mb-8">
        {portrait.avatar_url ? (
          <img src={portrait.avatar_url} alt={portrait.display_name}
            className="w-24 h-24 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <span className="text-3xl font-semibold text-gray-400">{portrait.display_name[0]}</span>
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{portrait.display_name}</h1>
          {portrait.tagline && <p className="text-gray-500 mt-1">{portrait.tagline}</p>}
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
            <span>{(stats?.subscriber_count ?? 0).toLocaleString()} subscribers</span>
            {stats?.avg_rating && (stats?.rating_count ?? 0) >= 5 && (
              <span>★ {stats.avg_rating}</span>
            )}
            <span className={portrait.monthly_price_cents ? 'text-indigo-600' : 'text-green-600'}>
              {portrait.monthly_price_cents
                ? `$${(portrait.monthly_price_cents / 100).toFixed(0)}/month`
                : 'Free'}
            </span>
          </div>
        </div>
      </div>

      {portrait.bio && (
        <p className="text-gray-600 mb-8 leading-relaxed">{portrait.bio}</p>
      )}

      {!isSubscribed && (
        <div className="mb-8 p-6 bg-gray-50 rounded-2xl">
          <p className="text-gray-600 text-sm mb-4">
            {portrait.monthly_price_cents
              ? `Subscribe for $${(portrait.monthly_price_cents / 100).toFixed(0)}/month to have a full conversation.`
              : 'Follow for free to unlock full conversations.'}
          </p>
          <SubscribeButton
            portraitId={portrait.id}
            isFree={!portrait.monthly_price_cents}
            isLoggedIn={!!user}
          />
        </div>
      )}

      {isSubscribed && (
        <ChatInterface portraitId={portrait.id} portraitName={portrait.display_name} />
      )}
    </main>
  )
}
```

Note: `ChatInterface` is at `src/components/chat/ChatInterface.tsx` — check its props signature before wiring. Adjust if it expects different props.

**Step 3: Commit**

```bash
git add src/app/\(sona\)/sona src/components/sona/SubscribeButton.tsx
git commit -m "feat: add public Sona profile page with subscribe and chat"
```

---

## Phase F: Auth & Onboarding

### Task 14: Public signup page

**Files:**
- Create: `src/app/(sona)/signup/page.tsx`
- Create: `src/app/(sona)/signup/actions.ts`

**Step 1: Create `src/app/(sona)/signup/actions.ts`**

```typescript
'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signUpWithMagicLink(formData: FormData) {
  const email = formData.get('email') as string
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `https://${process.env.NEXT_PUBLIC_SONA_DOMAIN}/auth/callback?next=/onboarding`,
    },
  })

  if (error) return { error: error.message }
  redirect('/signup?sent=true')
}
```

**Step 2: Create `src/app/(sona)/signup/page.tsx`**

```typescript
import { signUpWithMagicLink } from './actions'

interface PageProps {
  searchParams: Promise<{ sent?: string }>
}

export default async function SignUpPage({ searchParams }: PageProps) {
  const { sent } = await searchParams

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
          <p className="text-gray-500">We sent you a magic link. Click it to continue.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
        <p className="text-gray-500 mb-8">Join Sona — create your digital presence or explore others.</p>
        <form action={signUpWithMagicLink} className="space-y-4">
          <input type="email" name="email" placeholder="your@email.com" required
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <button type="submit"
            className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors">
            Continue with email
          </button>
        </form>
        <p className="text-center text-sm text-gray-400 mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-gray-700 underline">Sign in</a>
        </p>
      </div>
    </main>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/\(sona\)/signup
git commit -m "feat: add Sona public signup page"
```

---

### Task 15: Onboarding choice screen

**Files:**
- Create: `src/app/(sona)/onboarding/page.tsx`
- Create: `src/app/(sona)/onboarding/actions.ts`

**Step 1: Create `src/app/(sona)/onboarding/actions.ts`**

```typescript
'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export async function completeOnboarding(destination: 'create' | 'explore') {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await createAdminClient()
    .from('profiles')
    .update({ onboarding_complete: true })
    .eq('id', user.id)

  redirect(destination === 'create' ? '/dashboard/create' : '/explore')
}
```

**Step 2: Create `src/app/(sona)/onboarding/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { completeOnboarding } from './actions'

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_complete')
    .eq('id', user.id)
    .single()

  if (profile?.onboarding_complete) redirect('/dashboard')

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Sona</h1>
        <p className="text-gray-500 mb-10">What would you like to do first?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <form action={completeOnboarding.bind(null, 'create')}>
            <button type="submit"
              className="w-full p-6 rounded-2xl border-2 border-gray-200 hover:border-gray-900 text-left transition-colors">
              <div className="text-2xl mb-3">✦</div>
              <h2 className="font-semibold text-gray-900 mb-1">Create my Sona</h2>
              <p className="text-sm text-gray-500">Build your digital presence and share it with the world.</p>
            </button>
          </form>
          <form action={completeOnboarding.bind(null, 'explore')}>
            <button type="submit"
              className="w-full p-6 rounded-2xl border-2 border-gray-200 hover:border-gray-900 text-left transition-colors">
              <div className="text-2xl mb-3">◎</div>
              <h2 className="font-semibold text-gray-900 mb-1">Explore Sonas</h2>
              <p className="text-sm text-gray-500">Discover and connect with remarkable people.</p>
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/\(sona\)/onboarding
git commit -m "feat: add onboarding choice screen"
```

---

## Phase G: Creator Dashboard

### Task 16: Dashboard layout and overview

**Files:**
- Create: `src/app/(sona)/dashboard/layout.tsx`
- Create: `src/app/(sona)/dashboard/page.tsx`

**Step 1: Create `src/app/(sona)/dashboard/layout.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="font-semibold text-gray-900">Sona</a>
          <nav className="flex gap-6 text-sm">
            {[
              { href: '/dashboard', label: 'Overview' },
              { href: '/dashboard/content', label: 'Content' },
              { href: '/dashboard/interview', label: 'Interview' },
              { href: '/dashboard/settings', label: 'Settings' },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="text-gray-500 hover:text-gray-900 transition-colors">
                {item.label}
              </Link>
            ))}
          </nav>
          <a href="/account" className="text-sm text-gray-500 hover:text-gray-900">Account</a>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-6 py-10">{children}</div>
    </div>
  )
}
```

**Step 2: Create `src/app/(sona)/dashboard/page.tsx`**

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const UNLOCKS = [
  { count: 25, label: 'Inner circle interviews' },
  { count: 100, label: 'Analytics dashboard' },
  { count: 250, label: 'Custom domain' },
]

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, display_name, slug, is_public, monthly_price_cents')
    .eq('creator_id', user.id)
    .maybeSingle()

  if (!portrait) redirect('/dashboard/create')

  const { data: stats } = await supabase
    .from('portrait_discovery')
    .select('subscriber_count')
    .eq('id', portrait.id)
    .maybeSingle()

  const subscriberCount = stats?.subscriber_count ?? 0
  const mrr = portrait.monthly_price_cents
    ? (subscriberCount * portrait.monthly_price_cents) / 100
    : 0

  const { data: interviewRequest } = await supabase
    .from('interview_requests')
    .select('status')
    .eq('portrait_id', portrait.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{portrait.display_name}</h1>
        {portrait.is_public && (
          <a href={`/sona/${portrait.slug}`} target="_blank"
            className="text-sm text-indigo-600 hover:underline">View public page ↗</a>
        )}
      </div>

      {!portrait.is_public && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          {interviewRequest
            ? `Your interview is ${interviewRequest.status}. We'll notify you when your Sona goes live.`
            : 'Schedule your WhatsApp interview to get your Sona live.'}
          {!interviewRequest && (
            <Link href="/dashboard/interview" className="ml-2 underline font-medium">Schedule now →</Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Subscribers</p>
          <p className="text-3xl font-bold text-gray-900">{subscriberCount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Monthly revenue</p>
          <p className="text-3xl font-bold text-gray-900">{mrr > 0 ? `$${mrr.toFixed(0)}` : '—'}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Unlock more features</h2>
        <div className="space-y-3">
          {UNLOCKS.map(({ count, label }) => {
            const unlocked = subscriberCount >= count
            return (
              <div key={count} className={`flex items-center justify-between py-2 ${unlocked ? '' : 'opacity-40'}`}>
                <span className="text-sm text-gray-700">{label}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  unlocked ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  {unlocked ? 'Unlocked' : `${count} subscribers`}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/\(sona\)/dashboard/layout.tsx src/app/\(sona\)/dashboard/page.tsx
git commit -m "feat: add creator dashboard layout and overview"
```

---

### Task 17: Sona creation wizard

**Files:**
- Create: `src/app/(sona)/dashboard/create/actions.ts`
- Create: `src/app/(sona)/dashboard/create/page.tsx`
- Create: `src/app/(sona)/dashboard/create/InterviewStep.tsx`
- Create: `src/app/(sona)/dashboard/create/PricingStep.tsx`
- Create: `src/app/api/interview-requests/route.ts`

**Step 1: Create `src/app/(sona)/dashboard/create/actions.ts`**

```typescript
'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export async function createSonaIdentity(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const display_name = formData.get('display_name') as string
  const tagline = formData.get('tagline') as string
  const bio = formData.get('bio') as string
  const category = formData.get('category') as string
  const tags = (formData.get('tags') as string)
    .split(',').map(t => t.trim()).filter(Boolean)

  const slug = display_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const { data: portrait } = await createAdminClient()
    .from('portraits')
    .insert({
      creator_id: user.id,
      brand: 'sona',
      is_public: false,
      display_name,
      tagline,
      bio,
      category,
      tags,
      slug,
      system_prompt: `You are ${display_name}. Respond as this person based on the provided reference material.`,
    })
    .select('id')
    .single()

  if (!portrait) return

  redirect(`/dashboard/create?step=2&portrait_id=${portrait.id}`)
}
```

**Step 2: Create `src/app/api/interview-requests/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { portrait_id, whatsapp_number, notes } = await request.json()

  await createAdminClient().from('interview_requests').insert({
    creator_id: user.id,
    portrait_id,
    whatsapp_number,
    notes,
  })

  return NextResponse.json({ ok: true })
}
```

**Step 3: Create `src/app/(sona)/dashboard/create/InterviewStep.tsx`**

```typescript
'use client'

import { useState } from 'react'

export function InterviewStep({ portraitId }: { portraitId: string }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    await fetch('/api/interview-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portrait_id: portraitId,
        whatsapp_number: fd.get('whatsapp_number'),
        notes: fd.get('notes'),
      }),
    })
    setLoading(false)
    setDone(true)
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="text-4xl mb-4">✓</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Interview requested</h2>
        <p className="text-gray-500 text-sm mb-6">We'll be in touch via WhatsApp to schedule.</p>
        <a href={`/dashboard/create?step=3&portrait_id=${portraitId}`}
          className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors">
          Continue
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="p-4 bg-blue-50 rounded-xl text-sm text-blue-700">
        We'll conduct a WhatsApp interview to capture your voice and values — the foundation of your Sona.
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp number</label>
        <input name="whatsapp_number" type="tel" required placeholder="+44 7700 900000"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Preferred times (optional)</label>
        <textarea name="notes" rows={3} placeholder="e.g. weekday mornings, weekends"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
      </div>
      <button type="submit" disabled={loading}
        className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">
        {loading ? 'Submitting…' : 'Request interview'}
      </button>
      <a href={`/dashboard/create?step=3&portrait_id=${portraitId}`}
        className="block text-center text-sm text-gray-400 hover:text-gray-600">Skip for now</a>
    </form>
  )
}
```

**Step 4: Create `src/app/(sona)/dashboard/create/PricingStep.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function PricingStep({ portraitId }: { portraitId: string }) {
  const [type, setType] = useState<'free' | 'paid'>('free')
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/portraits/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portrait_id: portraitId,
        monthly_price_cents: type === 'paid' ? Math.round(parseFloat(price) * 100) : null,
      }),
    })
    router.push('/dashboard')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-lg font-semibold text-gray-900">Set your price</h2>
      <p className="text-sm text-gray-500">Subscribers pay this monthly to access your full Sona. You can always offer it free.</p>
      <div className="grid grid-cols-2 gap-3">
        {(['free', 'paid'] as const).map(t => (
          <button key={t} type="button" onClick={() => setType(t)}
            className={`p-4 rounded-xl border-2 text-left transition-colors ${
              type === t ? 'border-gray-900' : 'border-gray-100'
            }`}>
            <p className="font-medium text-gray-900 capitalize">{t}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {t === 'free' ? 'Anyone can access' : 'Subscribers only'}
            </p>
          </button>
        ))}
      </div>
      {type === 'paid' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monthly price (USD)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input type="number" min="1" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
              required placeholder="9.00"
              className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
        </div>
      )}
      <button type="submit" disabled={loading}
        className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">
        {loading ? 'Setting up…' : 'Finish'}
      </button>
    </form>
  )
}
```

**Step 5: Create `src/app/(sona)/dashboard/create/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createSonaIdentity } from './actions'
import { InterviewStep } from './InterviewStep'
import { PricingStep } from './PricingStep'

const CATEGORIES = [
  'Technology', 'Business', 'Science', 'Arts',
  'Sport', 'Politics', 'Education', 'Health', 'Other',
]

const STEPS = ['Identity', 'Interview', 'Content', 'Pricing']

interface PageProps {
  searchParams: Promise<{ step?: string; portrait_id?: string }>
}

export default async function CreateSonaPage({ searchParams }: PageProps) {
  const { step = '1', portrait_id } = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: existing } = await supabase
    .from('portraits')
    .select('id')
    .eq('creator_id', user.id)
    .maybeSingle()

  if (existing && step === '1') redirect('/dashboard')

  return (
    <div className="max-w-lg mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8 text-sm">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              i + 1 <= parseInt(step) ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
            }`}>{i + 1}</div>
            <span className={i + 1 === parseInt(step) ? 'text-gray-900 font-medium' : 'text-gray-400'}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-gray-200 mx-1" />}
          </div>
        ))}
      </div>

      {step === '1' && (
        <form action={createSonaIdentity} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your full name</label>
            <input name="display_name" required
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
            <input name="tagline" placeholder="One sentence about you"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea name="bio" rows={4} placeholder="Tell people about yourself"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select name="category"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
            <input name="tags" placeholder="e.g. startups, investing, leadership"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <button type="submit"
            className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors">
            Continue
          </button>
        </form>
      )}

      {step === '2' && portrait_id && <InterviewStep portraitId={portrait_id} />}

      {step === '3' && portrait_id && (
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Add content (optional)</h2>
          <p className="text-gray-500 text-sm mb-6">Upload documents or writings to enrich your Sona. You can always do this later.</p>
          <div className="flex gap-3 justify-center">
            <a href={`/dashboard/content?portrait_id=${portrait_id}`}
              className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm hover:border-gray-400 transition-colors">
              Add content
            </a>
            <a href={`/dashboard/create?step=4&portrait_id=${portrait_id}`}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm hover:bg-gray-700 transition-colors">
              Skip for now
            </a>
          </div>
        </div>
      )}

      {step === '4' && portrait_id && <PricingStep portraitId={portrait_id} />}
    </div>
  )
}
```

**Step 6: Commit**

```bash
git add src/app/\(sona\)/dashboard/create \
        src/app/api/interview-requests
git commit -m "feat: add Sona creation wizard (identity, interview, content, pricing)"
```

---

### Task 18: Dashboard content and settings pages

**Files:**
- Create: `src/app/(sona)/dashboard/content/page.tsx`
- Create: `src/app/(sona)/dashboard/settings/page.tsx`
- Create: `src/app/(sona)/dashboard/settings/actions.ts`
- Modify: `src/app/(nh)/admin/ingest/IngestForm.tsx`

**Step 1: Add `lockedPortraitId` prop to IngestForm**

Open `src/app/(nh)/admin/ingest/IngestForm.tsx`. Read the file, then add these two optional props to the component's props interface:

```typescript
lockedPortraitId?: string
lockedPortraitName?: string
```

In the JSX, where the portrait dropdown is rendered, add a conditional: when `lockedPortraitId` is set, replace the dropdown with a hidden input and a read-only label:

```typescript
{lockedPortraitId ? (
  <>
    <input type="hidden" name="portrait_id" value={lockedPortraitId} />
    <p className="text-sm text-gray-600">Adding content to: <strong>{lockedPortraitName}</strong></p>
  </>
) : (
  /* existing portrait select dropdown */
)}
```

**Step 2: Create `src/app/(sona)/dashboard/content/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { IngestForm } from '@/app/(nh)/admin/ingest/IngestForm'

export default async function DashboardContentPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id, display_name')
    .eq('creator_id', user.id)
    .maybeSingle()

  if (!portrait) redirect('/dashboard/create')

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Add content</h1>
      <p className="text-gray-500 text-sm mb-8">Upload documents or paste text to enrich your Sona.</p>
      <IngestForm lockedPortraitId={portrait.id} lockedPortraitName={portrait.display_name} />
    </div>
  )
}
```

**Step 3: Create `src/app/(sona)/dashboard/settings/actions.ts`**

```typescript
'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function updateSonaSettings(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: portrait } = await supabase
    .from('portraits')
    .select('id')
    .eq('creator_id', user.id)
    .single()

  if (!portrait) return

  await createAdminClient().from('portraits').update({
    tagline: formData.get('tagline') as string,
    bio: formData.get('bio') as string,
    category: formData.get('category') as string,
  }).eq('id', portrait.id)

  revalidatePath('/dashboard/settings')
}
```

**Step 4: Create `src/app/(sona)/dashboard/settings/page.tsx`**

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { updateSonaSettings } from './actions'

const CATEGORIES = [
  'Technology', 'Business', 'Science', 'Arts',
  'Sport', 'Politics', 'Education', 'Health', 'Other',
]

export default async function DashboardSettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: portrait } = await supabase
    .from('portraits')
    .select('tagline, bio, category, monthly_price_cents')
    .eq('creator_id', user.id)
    .single()

  if (!portrait) redirect('/dashboard/create')

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-gray-900 mb-8">Sona settings</h1>
      <form action={updateSonaSettings} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
          <input name="tagline" defaultValue={portrait.tagline ?? ''}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
          <textarea name="bio" rows={5} defaultValue={portrait.bio ?? ''}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select name="category" defaultValue={portrait.category ?? ''}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button type="submit"
          className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors">
          Save changes
        </button>
      </form>

      <div className="mt-10 pt-8 border-t border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-1">Pricing</h2>
        <p className="text-sm text-gray-500 mb-1">
          {portrait.monthly_price_cents
            ? `$${(portrait.monthly_price_cents / 100).toFixed(0)}/month`
            : 'Free'}
        </p>
        <p className="text-xs text-gray-400">Contact support to change your pricing after launch.</p>
      </div>
    </div>
  )
}
```

**Step 5: Commit**

```bash
git add src/app/\(sona\)/dashboard/content \
        src/app/\(sona\)/dashboard/settings \
        src/app/\(nh\)/admin/ingest/IngestForm.tsx
git commit -m "feat: add dashboard content and settings pages"
```

---

## Phase H: Consumer Account

### Task 19: Consumer account page

**Files:**
- Create: `src/app/(sona)/account/page.tsx`
- Create: `src/app/(sona)/account/BillingPortalButton.tsx`

**Step 1: Create `src/app/(sona)/account/BillingPortalButton.tsx`**

```typescript
'use client'

export function BillingPortalButton() {
  async function openPortal() {
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const { url } = await res.json()
    if (url) window.location.href = url
  }

  return (
    <button onClick={openPortal}
      className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm hover:border-gray-400 transition-colors">
      Manage billing →
    </button>
  )
}
```

**Step 2: Create `src/app/(sona)/account/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { BillingPortalButton } from './BillingPortalButton'

export default async function AccountPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('id, status, portraits(id, slug, display_name, avatar_url, monthly_price_cents)')
    .eq('subscriber_id', user.id)
    .order('created_at', { ascending: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Your account</h1>

      <section className="mb-10">
        <h2 className="font-semibold text-gray-700 mb-4">Subscriptions</h2>
        {subscriptions && subscriptions.length > 0 ? (
          <div className="space-y-3">
            {subscriptions.map(sub => {
              const portrait = sub.portraits as any
              return (
                <a key={sub.id} href={`/sona/${portrait.slug}`}
                  className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-300 transition-colors">
                  {portrait.avatar_url ? (
                    <img src={portrait.avatar_url} alt={portrait.display_name}
                      className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-gray-400">{portrait.display_name[0]}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{portrait.display_name}</p>
                    <p className="text-xs text-gray-400">
                      {portrait.monthly_price_cents
                        ? `$${(portrait.monthly_price_cents / 100).toFixed(0)}/month`
                        : 'Free'}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    sub.status === 'active' ? 'bg-green-50 text-green-600' :
                    sub.status === 'past_due' ? 'bg-red-50 text-red-600' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {sub.status.replace('_', ' ')}
                  </span>
                </a>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">
            No subscriptions yet. <a href="/explore" className="underline">Explore Sonas</a>
          </p>
        )}
      </section>

      {profile?.stripe_customer_id && (
        <section>
          <h2 className="font-semibold text-gray-700 mb-4">Billing</h2>
          <BillingPortalButton />
        </section>
      )}
    </main>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/\(sona\)/account
git commit -m "feat: add consumer account page with subscriptions and billing portal"
```

---

## Phase I: Ratings

### Task 20: Ratings API and prompt component

**Files:**
- Create: `src/app/api/ratings/route.ts`
- Create: `src/components/sona/RatingPrompt.tsx`

**Step 1: Create `src/app/api/ratings/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { portrait_id, score } = await request.json()

  // Must have active subscription to rate
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('subscriber_id', user.id)
    .eq('portrait_id', portrait_id)
    .eq('status', 'active')
    .maybeSingle()

  if (!sub) return NextResponse.json({ error: 'Subscription required' }, { status: 403 })

  await createAdminClient().from('ratings').upsert({
    subscriber_id: user.id,
    portrait_id,
    score,
  }, { onConflict: 'subscriber_id,portrait_id' })

  return NextResponse.json({ ok: true })
}
```

**Step 2: Create `src/components/sona/RatingPrompt.tsx`**

```typescript
'use client'

import { useState } from 'react'

interface Props {
  portraitId: string
  onDismiss: () => void
}

export function RatingPrompt({ portraitId, onDismiss }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleRate(score: number) {
    setSelected(score)
    await fetch('/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portrait_id: portraitId, score }),
    })
    setSubmitted(true)
    setTimeout(onDismiss, 1500)
  }

  if (submitted) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl text-sm text-green-700">
        ✓ Thanks for your rating!
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
      <span className="text-sm text-gray-500">How was this conversation?</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} onClick={() => handleRate(star)}
            className={`text-lg transition-colors ${
              selected && star <= selected ? 'text-amber-400' : 'text-gray-300 hover:text-amber-300'
            }`}>★</button>
        ))}
      </div>
      <button onClick={onDismiss} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">
        Dismiss
      </button>
    </div>
  )
}
```

**Step 3: Wire RatingPrompt into ChatInterface**

Open `src/components/chat/ChatInterface.tsx`. Read the file to understand how messages are tracked.

Add a `messageCount` state that increments with each assistant message. When `messageCount === 5` and the user is a subscriber and hasn't rated yet, render `<RatingPrompt>` above the chat input.

The exact implementation depends on the current `ChatInterface` structure — read the file before editing.

**Step 4: Commit**

```bash
git add src/app/api/ratings src/components/sona/RatingPrompt.tsx src/components/chat/ChatInterface.tsx
git commit -m "feat: add ratings API and rating prompt component"
```

---

## Phase J: Admin Additions

### Task 21: Interview requests panel in NH admin

**Files:**
- Create: `src/app/(nh)/admin/interviews/page.tsx`
- Create: `src/app/(nh)/admin/interviews/actions.ts`
- Modify: `src/app/(nh)/admin/layout.tsx`

**Step 1: Create `src/app/(nh)/admin/interviews/actions.ts`**

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function updateInterviewStatus(
  requestId: string,
  status: 'scheduled' | 'completed',
) {
  await createAdminClient()
    .from('interview_requests')
    .update({ status })
    .eq('id', requestId)
  revalidatePath('/admin/interviews')
}

export async function publishSona(portraitId: string) {
  await createAdminClient()
    .from('portraits')
    .update({ is_public: true })
    .eq('id', portraitId)
  revalidatePath('/admin/interviews')
}
```

**Step 2: Create `src/app/(nh)/admin/interviews/page.tsx`**

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { updateInterviewStatus, publishSona } from './actions'

export default async function AdminInterviewsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/')

  const { data: requests } = await supabase
    .from('interview_requests')
    .select(`
      id, whatsapp_number, notes, status, created_at,
      portraits(id, display_name, is_public, slug),
      profiles!creator_id(email, full_name)
    `)
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Interview Requests</h1>
      {requests && requests.length > 0 ? (
        <div className="space-y-4">
          {requests.map(req => {
            const portrait = req.portraits as any
            const creator = req.profiles as any
            return (
              <div key={req.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{portrait?.display_name}</p>
                    <p className="text-sm text-gray-500">{creator?.full_name ?? creator?.email}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      WhatsApp: <span className="font-mono">{req.whatsapp_number}</span>
                    </p>
                    {req.notes && <p className="text-sm text-gray-400 mt-0.5">Notes: {req.notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      req.status === 'completed' ? 'bg-green-50 text-green-600' :
                      req.status === 'scheduled' ? 'bg-blue-50 text-blue-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>{req.status}</span>
                    <div className="flex gap-2">
                      {req.status === 'pending' && (
                        <form action={updateInterviewStatus.bind(null, req.id, 'scheduled')}>
                          <button className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50">
                            Mark scheduled
                          </button>
                        </form>
                      )}
                      {req.status === 'scheduled' && (
                        <form action={updateInterviewStatus.bind(null, req.id, 'completed')}>
                          <button className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50">
                            Mark complete
                          </button>
                        </form>
                      )}
                      {req.status === 'completed' && portrait && !portrait.is_public && (
                        <form action={publishSona.bind(null, portrait.id)}>
                          <button className="text-xs px-3 py-1 bg-gray-900 text-white rounded-lg hover:bg-gray-700">
                            Publish Sona
                          </button>
                        </form>
                      )}
                      {portrait?.is_public && (
                        <a href={`/sona/${portrait.slug}`} target="_blank"
                          className="text-xs text-green-600 hover:underline">✓ Live ↗</a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-gray-400">No interview requests yet.</p>
      )}
    </div>
  )
}
```

**Step 3: Add Interviews link to admin nav**

Open `src/app/(nh)/admin/layout.tsx`. Read the file. Add `{ href: '/admin/interviews', label: 'Interviews' }` to the navigation items array.

**Step 4: Commit**

```bash
git add src/app/\(nh\)/admin/interviews src/app/\(nh\)/admin/layout.tsx
git commit -m "feat: add interview requests panel to NH admin"
```

---

## Phase K: Final verification

### Task 22: Smoke test — creator flow

1. Set `BRAND=sona` in `.env.local`, run `npm run dev`
2. Visit `localhost:3000/signup` → submit email → magic link arrives → click link
3. `/onboarding` → click "Create my Sona"
4. Complete wizard: fill identity, submit interview request, skip content, set price (or free)
5. `/dashboard` → status banner shows "interview pending"

**In NH admin (set `BRAND=nh` or use a second terminal):**
6. Visit `localhost:3000/admin/interviews` → find request → mark scheduled → mark complete → click "Publish Sona"
7. Return to `BRAND=sona` → `/dashboard` → "View public page" link appears

### Task 23: Smoke test — consumer flow

1. Open incognito / new session
2. Visit `localhost:3000/explore` → Sona appears in grid
3. Click Sona card → profile page loads
4. Click Subscribe / Follow → prompted to log in → subscribe
5. For paid: Stripe Checkout opens (use test card `4242 4242 4242 4242`)
6. Return to Sona page → chat interface visible → send messages
7. After 5 messages → rating prompt appears
8. Visit `/account` → subscription listed

### Task 24: Stripe webhook smoke test

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger customer.subscription.created
```

Expected: `200 OK` in Stripe CLI. Check Supabase `subscriptions` table — row inserted.

### Task 25: Run all tests

```bash
npx vitest run
```

Expected: all tests pass.

---

## Environment variables checklist (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET          ← set to Vercel endpoint after deploy
PLATFORM_FEE_PERCENT           ← e.g. 20
NEXT_PUBLIC_NH_DOMAIN          ← neuralheirloom.com
NEXT_PUBLIC_SONA_DOMAIN        ← entersona.com
```

Stripe webhook endpoint in Stripe dashboard: `https://entersona.com/api/stripe/webhook`

Events to subscribe: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`
