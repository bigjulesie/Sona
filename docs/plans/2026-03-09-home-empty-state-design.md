# /home Empty State Design

**Date:** 2026-03-09
**Status:** Approved

## Goal

Replace the placeholder empty state on `/home` with a two-card layout that presents both value propositions — creating a Sona and discovering Sonas — to new users who have no subscriptions yet.

## Layout

Two equal-height cards in a responsive 2-column grid. On mobile (≤600px) they stack vertically. Cards use the same visual language as the rest of the page: `1px solid rgba(0,0,0,0.07)` border, `borderRadius: 16`, generous padding. No section label above the cards — they speak for themselves.

## Cards

### Card 1 — context-aware

**If the user has no portrait yet:**

> *"Your whole self, present when it matters."*
>
> Share your knowledge, perspective, and way of thinking — with the people who matter, at the depth you choose. From open discovery to a private inner circle, you set the limits.
>
> CTA: "Create your Sona" → `/dashboard/create`

**If the user already has a portrait:**

> *"Be present. Even when you can't be."*
>
> Your Sona carries your perspective into every conversation. Add context, expand your circle, and track who's listening from your dashboard.
>
> CTA: "Go to dashboard" → `/dashboard`

### Card 2 — always shown

> *"The right mind in the room."*
>
> Build a circle of Sonas from thinkers, leaders, and people who inspire you. Their insights stay with you — a collection of minds to turn to whenever you need perspective, wisdom, or a second opinion.
>
> CTA: "Discover Sonas" → `/explore`

## Typography & Styling

- Card headline: Cormorant italic, `1.375rem`, `#1a1a1a`
- Body copy: Geist light (`fontWeight: 300`), `0.875rem`, `#6b6b6b`, `lineHeight: 1.65`
- CTA: dark pill button — `#1a1a1a` background, white text, `borderRadius: '980px'`, `padding: '10px 24px'`
- No Tailwind classes — inline styles only

## Architecture

Single file change: `src/app/(sona)/(platform)/home/page.tsx`

The `ownPortrait` value is already fetched by the server component. Pass it as a condition to the empty state JSX — no new components, no new data fetching needed.
