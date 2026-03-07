# Personalised Home Page Design

## Goal

Replace the marketing landing page with a personalised circle view for logged-in Sona users, giving rapid access to their subscribed Sonas from the moment they arrive.

## Architecture

- `/` — server component checks auth. Logged-in Sona users are redirected to `/home`. Logged-out users see the existing marketing landing page (unchanged).
- `/home` — new page in `(sona)/(platform)/` route group (gets `SonaNav`). The user's personalised circle.
- `/account` — stripped to settings only: email display and billing portal. "Your Sona" and "Your circle" sections removed (they now live on `/home`).

## `/home` Page Layout

**If creator:** Own Sona row at top — avatar, name, **View** and **Manage** buttons.

**Your circle section:** Subscribed Sonas as cards showing avatar, name, and last conversation date (e.g. "3 days ago" or "Never" if no conversation yet). Tapping a card navigates to `/sona/[slug]`.

**Empty state (placeholder — see Task #51):** "Your circle is empty." with a Discover CTA. To be redesigned with proper marketing copy and featured Sonas before launch.

## Nav Changes

| State | Nav items |
|---|---|
| Logged-out | Discover · Get started |
| Logged-in subscriber | Discover · My Circle · Settings · Sign out |
| Logged-in creator | Discover · My Circle · Dashboard · Settings · Sign out |

- **My Circle** → `/home`
- **Settings** (renamed from Account) → `/account`
- **Dashboard** unchanged → `/dashboard`

## Data Requirements

`/home` needs:
- User's own portrait: `portraits.select('id, slug, display_name, avatar_url').eq('profile_id', user.id)`
- Subscriptions with portrait details and last conversation timestamp:
  `subscriptions JOIN portraits`, plus `MAX(conversations.updated_at)` per portrait

## Out of Scope

- Empty state marketing copy and featured Sonas list (Task #51)
- Conversation previews / last message text
