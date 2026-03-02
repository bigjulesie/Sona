# Phase 3 — B2C Platform Design

**Date:** 2026-03-02
**Status:** Approved
**Scope:** Public-facing creator/consumer platform on entersona.com, sharing the same Next.js codebase and Supabase backend as neuralheirloom.com.

---

## Goals

- Creators (real people) can self-serve sign up, build their Sona, and optionally charge subscribers
- Consumers can browse, discover, and subscribe to Sonas on entersona.com
- Neural Heirloom white-glove service continues unchanged on neuralheirloom.com
- Both brands share the same tech stack, codebase, and Supabase project
- Revenue model: consumer pays per Sona (Stripe Billing, manual creator payouts — Approach B)

---

## What We Are Not Building Yet

- Stripe Connect / automated creator payouts (manual payouts until ~50 paid creators)
- WhatsApp interview bot (human-facilitated first, automated later)
- Inner circle automated interviews
- NLP-optimised interview framework
- Sona verification / identity badge
- Image assets in knowledge base
- Video avatar (HeyGen/Tavus)
- Custom domains for individual Sona pages
- Phase 2 voice features (documented but not yet implemented — parallel workstream)

---

## Architecture: Dual-Brand, One App

`neuralheirloom.com` and `entersona.com` are served from a single Next.js deployment. Next.js middleware reads the `Host` header and rewrites requests to brand-specific route groups.

```
neuralheirloom.com/* → /(nh)/*
entersona.com/*      → /(sona)/*
localhost/*          → BRAND env var controls (dev)
```

Shared: all `/api/*` routes, Supabase client, RAG pipeline, auth callback.

### File structure

```
src/app/
  (nh)/                    # neuralheirloom.com
    layout.tsx             # NH branding, design tokens
    page.tsx
    chat/
    admin/
  (sona)/                  # entersona.com
    layout.tsx             # Sona branding
    page.tsx               # Marketing/landing
    explore/               # Public Sona discovery library
    sona/[slug]/           # Public Sona profile + chat
    onboarding/            # Post-signup choice screen
    dashboard/
      page.tsx             # Creator overview
      create/              # New Sona setup wizard
      content/             # Self-serve knowledge upload
      interview/           # WhatsApp interview scheduling
      settings/            # Pricing, visibility, bio
    account/               # Consumer subscriptions + billing portal
  (shared)/
    login/                 # Magic link login (brand-aware)
    auth/callback/
  api/                     # All API routes — shared
    chat/
    conversations/
    ingest/
    admin/
    stripe/
      checkout/            # Create Stripe Checkout Session
      portal/              # Stripe Billing Portal redirect
      webhook/             # Stripe event handler
```

---

## Database Schema

### Additions to `portraits`

```sql
ALTER TABLE portraits
  ADD COLUMN creator_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN brand              TEXT NOT NULL DEFAULT 'nh' CHECK (brand IN ('nh', 'sona')),
  ADD COLUMN is_public          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN monthly_price_cents INTEGER,        -- NULL = free
  ADD COLUMN stripe_price_id    TEXT,
  ADD COLUMN tagline            TEXT,
  ADD COLUMN bio                TEXT,
  ADD COLUMN category           TEXT,
  ADD COLUMN tags               TEXT[] DEFAULT '{}';
```

- `creator_id` NULL = NH white-glove (admin-created). Non-null = self-serve Sona creator.
- `brand` controls which frontend shows the Sona.
- `is_public` flipped to true by NH team after interview is complete.
- `monthly_price_cents` NULL = free. Paid Sonas require an active subscription.
- `stripe_price_id` Stripe Price object ID for checkout.
- `category` Predefined sector (Technology, Business, Arts, Science, Sport, Politics, etc.)
- `tags` Freeform expertise tags for richer discovery filtering.

### Additions to `profiles`

```sql
ALTER TABLE profiles
  ADD COLUMN stripe_customer_id   TEXT,
  ADD COLUMN onboarding_complete  BOOLEAN NOT NULL DEFAULT false;
```

### New: `subscriptions`

```sql
CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portrait_id             UUID NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  stripe_subscription_id  TEXT UNIQUE,           -- NULL for free Sonas
  status                  TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
  tier                    access_tier NOT NULL DEFAULT 'acquaintance',
  current_period_end      TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now(),
  UNIQUE(subscriber_id, portrait_id)
);
```

A consumer's chunk access depth is determined by `subscriptions.tier`, not `profiles.access_tier`. The existing `knowledge_chunks.min_tier` RLS gate is unchanged.

**Tier model for entersona.com:**
- `public` — available to all visitors, no subscription needed
- `acquaintance` — unlocked by paid subscription (or free subscription for free Sonas)
- `colleague` / `family` — manually granted by creator to specific people; not purchasable

### New: `interview_requests`

```sql
CREATE TABLE interview_requests (
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
```

NH team manages these via the admin panel. Creator is notified by email on status change.

### New: `ratings`

```sql
CREATE TABLE ratings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portrait_id    UUID NOT NULL REFERENCES portraits(id) ON DELETE CASCADE,
  score          INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(subscriber_id, portrait_id)
);
```

Only active subscribers can rate. One rating per subscriber per Sona, updatable.

### New: Discovery view

A Postgres view computes aggregate signals per portrait for the explore page:

```sql
CREATE VIEW portrait_discovery AS
SELECT
  p.id,
  p.slug,
  p.display_name,
  p.tagline,
  p.avatar_url,
  p.category,
  p.tags,
  p.monthly_price_cents,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') AS subscriber_count,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active'
    AND s.created_at > now() - interval '30 days')        AS new_subscribers_30d,
  ROUND(AVG(r.score), 1)                                  AS avg_rating,
  COUNT(r.id)                                             AS rating_count
FROM portraits p
LEFT JOIN subscriptions s ON s.portrait_id = p.id
LEFT JOIN ratings r ON r.portrait_id = p.id
WHERE p.is_public = true AND p.brand = 'sona'
GROUP BY p.id;
```

---

## Stripe Integration (Approach B — Billing + Manual Payouts)

### Objects

| Stripe object | Maps to |
|---|---|
| `Product` | One per paid `portrait` |
| `Price` | One per Product — monthly recurring, creator-set |
| `Customer` | One per `profile` — stored as `stripe_customer_id` |
| `Subscription` | One per `subscriptions` row |

### Checkout flow

1. Consumer clicks Subscribe on a Sona page
2. `POST /api/stripe/checkout` creates a Stripe Checkout Session
3. Consumer completes payment on Stripe-hosted page
4. Redirect back to Sona page — webhook is the access source of truth
5. `POST /api/stripe/webhook` fires `customer.subscription.created` → inserts `subscriptions` row

### Webhook events

| Event | Action |
|---|---|
| `customer.subscription.created` | Insert subscription row, status `active` |
| `customer.subscription.updated` | Update status, `current_period_end` |
| `customer.subscription.deleted` | Set status `cancelled` |
| `invoice.payment_failed` | Set status `past_due` |
| `invoice.payment_succeeded` | Ensure status `active` |

### Creator pricing

When a creator sets a price, the platform creates a Stripe Product + Price and stores `stripe_price_id` on the portrait. Price changes create a new Price object (old one archived — Stripe's recommended pattern).

Platform fee percentage is configured via `PLATFORM_FEE_PERCENT` env var. Enforced manually at payout time. No Stripe logic required for Approach B.

Consumer subscription management: `GET /api/stripe/portal` redirects to Stripe Billing Portal.

---

## Creator Onboarding Flow

### Signup

Public `/signup` on entersona.com via Supabase magic link. On first login, user lands on `/onboarding` with two options: *"Create my Sona"* or *"Explore Sonas."*

### Sona setup wizard (`/dashboard/create`) — 4 steps

1. **Identity** — display name, tagline, bio, avatar, category, tags. Creates `portraits` row: `creator_id = me`, `brand = 'sona'`, `is_public = false`.
2. **Interview** — explains the WhatsApp interview. Creator submits WhatsApp number + preferred time. Creates `interview_requests` row. NH team notified.
3. **Content** (skippable) — optional document upload using existing ingest pipeline. Can return via `/dashboard/content` at any time.
4. **Pricing** — free or monthly price in local currency. If paid, Stripe Product + Price created. `monthly_price_cents` and `stripe_price_id` written to portrait.

After step 4: Sona is private (`is_public = false`). Dashboard shows: *"Your Sona is being prepared. We'll notify you when your interview is scheduled."*

### NH team publish step

After completing the WhatsApp interview: NH team uploads transcript via admin ingest, marks `interview_requests` row `completed`, flips `is_public = true`. Creator notified by email.

### Creator dashboard

- Subscriber count + MRR
- Interview request status
- Content management shortcut
- Sona preview link
- Pricing and visibility settings

### Progressive subscriber-gated unlocks

| Subscribers | Unlock |
|---|---|
| 0 | Basic Sona, public chat |
| 25 | Inner circle interview request (future phase) |
| 100 | Analytics dashboard |
| 250 | Custom domain (future phase) |

Thresholds stored in config. Locked features visible but greyed out with the unlock threshold shown — acts as a growth prompt.

---

## Consumer Flow

### Discovery (`/explore`)

Browsable grid using `portrait_discovery` view. No account required.

**Sort modes:**
- Popular — `subscriber_count DESC`
- Top rated — `avg_rating DESC` (minimum 5 ratings to qualify)
- Trending — `new_subscribers_30d DESC`

**Filters:** category, tags. Combinable with any sort (e.g. "Top rated in Technology").

### Sona page (`/sona/[slug]`)

- Avatar, name, bio, subscriber count, average rating
- 3-message public-tier preview chat (no login required — teaser)
- "Subscribe" / "Follow for free" CTA
- Full chat interface shown inline once subscribed

### Subscribe flow

1. Consumer clicks Subscribe → magic link login/signup if not authenticated
2. Free Sona: subscription row inserted immediately, access granted
3. Paid Sona: Stripe Checkout → webhook fires → access live on return
4. Full acquaintance-tier chat unlocked on the Sona page

### Ratings

Rating prompt appears in the chat interface after a subscriber's 5th message with that Sona. One rating per subscriber per Sona, 1–5 stars, updatable. Score feeds directly into explore page ranking.

### Consumer account (`/account`)

- List of subscribed Sonas with status badges
- "Manage billing" link → Stripe Billing Portal
- No custom cancellation UI required

### Access enforcement in `/api/chat`

Existing auth check is extended: for a paid Sona, verify an `active` subscriptions row exists for `(user_id, portrait_id)` before retrieving chunks. The `min_tier` RLS on `knowledge_chunks` continues to enforce content depth. No other changes to the chat pipeline.

---

## Environment Variables (new)

```
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
PLATFORM_FEE_PERCENT
NEXT_PUBLIC_NH_DOMAIN        # neuralheirloom.com
NEXT_PUBLIC_SONA_DOMAIN      # entersona.com
BRAND                        # dev only: 'nh' | 'sona'
```
