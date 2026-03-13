# Sona Admin Dashboard Design

## Goal

A Sona-branded admin dashboard at `/admin` that lets platform operators review all creator portraits and manually publish them (flip `is_public`) for the MVP launch.

## Context

Sona portraits are not published automatically. An operator reviews each creator's setup and flips `is_public = true` when it's ready. Currently this requires a direct database change. This dashboard provides a safe, branded UI to do that.

---

## Architecture

### Route Structure

```
src/app/(sona)/admin/
  layout.tsx          — is_admin gate + Sona-branded header
  page.tsx            — server component: fetches all data, renders page
  actions.ts          — server action: togglePortraitPublished(id, bool)
  PortraitsTable.tsx  — client component: table rows + optimistic toggle
```

New route group under `(sona)` — completely separate from the existing NH admin at `(nh)/admin`. Does not share layout, navigation, or visual style with NH.

### Auth & Access

Gated by `profiles.is_admin = true` (same flag as NH admin — no schema changes required). Non-admins are redirected to `/`. The check is in `layout.tsx` using the admin Supabase client.

The route group `(sona)/admin/` sits as a sibling to `(sona)/dashboard/` and `(sona)/(platform)/`. It inherits `(sona)/layout.tsx` (the root Sona layout) but NOT the dashboard layout or the platform layout — no `SonaNav` or `DashboardSubNav` is rendered.

---

## Data

### Stat Cards (three aggregate queries)

| Card | Query |
|------|-------|
| Total creators | `COUNT(DISTINCT creator_id)` from `portraits` (one creator may have multiple portraits) |
| Live Sonas | `COUNT(*)` from `portraits WHERE is_public = true` |
| Total subscribers | `COUNT(*)` from `subscriptions` |

Each stat is fetched via `admin.from(...).select('*', { count: 'exact', head: true })` and extracted from the `count` property of the response.

### Portrait Table (one query)

Fetches all portraits joined with related data:

| Column | Source |
|--------|--------|
| Creator email | `profiles.email` via `portraits.creator_id` |
| Portrait name | `portraits.display_name` |
| Interview status | Boolean: fetched as a separate query — `SELECT portrait_id FROM interview_requests` — then matched by portrait ID in application code (a `Set` lookup). Displayed as "Requested" or "—". |
| Content count | `COUNT(*)` from `content_sources WHERE portrait_id` |
| Synthesis status | `portraits.synthesis_status` |
| Subscribers | `COUNT(*)` from `subscriptions WHERE portrait_id` |
| Joined | `portraits.created_at` |
| Published | `portraits.is_public` — inline toggle |

All data fetched server-side on page load. No client-side fetching.

### Server Action

`togglePortraitPublished(portraitId: string, isPublic: boolean)` in `actions.ts`:
- Re-checks `profiles.is_admin` for the calling user at the start of the action (same pattern as NH admin actions). Returns an error if not admin — layout gate alone is insufficient since server actions are callable directly via HTTP.
- Uses `createAdminClient()` (bypasses RLS)
- `UPDATE portraits SET is_public = $isPublic WHERE id = $portraitId`
- Calls `revalidatePath('/admin')` to refresh server data

---

## Components

### `layout.tsx` (server component)
- Reads auth user, checks `profiles.is_admin`
- Redirects to `/` if not admin
- Renders minimal Sona header: logo only (no nav tabs)
- Children rendered below header in a max-width container

### `page.tsx` (server component)
- Runs all queries in parallel via `Promise.all`: three stat card counts + portrait rows + interview request portrait IDs
- Stat cards are rendered inline (not a separate file). Each card receives a plain `number` extracted from the Supabase `count` property.
- Passes portrait rows and the interview Set to `<PortraitsTable>`
- No loading states needed — server-rendered
- Empty state: if no portraits exist, renders a centred Cormorant italic message "No portraits yet."

### `PortraitsTable.tsx` (client component)
- Receives portrait rows as props
- Renders a table with one row per portrait
- `is_public` column is an optimistic toggle:
  - Flips local state immediately on click
  - Calls `togglePortraitPublished` server action
  - Rolls back to original state on error, shows inline error message
- Status badges (synthesis status, live/draft) are pill spans with inline styles

### Visual Style
Follows the Sona design system throughout:
- Inline styles (not Tailwind utility classes)
- Fonts: `var(--font-geist-sans)` for UI, Cormorant italic for the page heading
- Colours: ink `#1a1a1a`, muted `#6b6b6b`, dim `#b0b0b0`, border `rgba(0,0,0,0.07)`
- Pill badges: `borderRadius: '980px'`, coral `#DE3E7B` for live, grey for draft/pending
- Table rows: thin border separator, `sona-row-hover` class for hover state

---

## Scope (MVP)

**In scope:**
- View all portraits with the data columns above
- Flip `is_public` on/off per portrait

**Explicitly out of scope:**
- Editing portrait details
- Deleting portraits or suspending creators
- Impersonation / acting as creator
- Filtering or searching the table
- Pagination (acceptable for MVP with small user count)

---

## Error Handling

- Toggle rollback on server action failure with inline error message per row
- If the page query fails, Next.js error boundary handles it
- Non-admin access: redirect (not 403 page)
