# User Avatar Implementation Design

## Goal
Allow account holders to upload a profile avatar that appears in the nav, account page, chat interface, and explore/discovery section, with a CSS glow halo derived from the image's dominant colour.

## Architecture

### Data layer
- New migration adds `avatar_url TEXT` and `avatar_halo_color TEXT` to the `profiles` table.
- A new public Supabase Storage bucket `avatars` holds images.
- Storage path per user: `{user_id}/avatar.png` — overwrite on re-upload, no housekeeping.
- Storage RLS: authenticated users may INSERT/UPDATE only to their own `{user_id}/` path; reads are public.
- A thin API route `GET /api/profile/avatar-upload-url` returns a signed Supabase upload URL for the authenticated user's avatar path.
- After the direct upload completes, a server action updates `profiles.avatar_url` and `profiles.avatar_halo_color`.

### Upload flow (`AvatarUpload` component)
1. Circular avatar display (or Cormorant italic initial fallback) with a "change photo" overlay on hover opens a native file picker.
2. Selected image opens a crop modal using `react-image-crop` with a locked 1:1 aspect ratio.
3. On confirm, a canvas draws the cropped region resized to 256×256 and exports as PNG blob.
4. Dominant colour is extracted from the canvas by sampling a grid of pixels, skipping near-white and near-black values, and selecting the most saturated result. Stored as a hex string.
5. PNG blob is uploaded directly to Supabase Storage via the signed URL.
6. Server action patches `profiles.avatar_url` and `profiles.avatar_halo_color`; UI updates optimistically.

Component lives at `src/components/account/AvatarUpload.tsx`. Self-contained — no parent coordination beyond an initial `currentAvatarUrl` and `currentHaloColor` prop.

### Display (`UserAvatar` component)
Reusable component at `src/components/account/UserAvatar.tsx`.

Props: `avatarUrl`, `haloColor`, `name`, `size` (number, pixels).

Renders:
- Circle `<img>` with `object-fit: cover` when `avatarUrl` is present.
- Cormorant italic initial on light grey background as fallback (matches existing portrait fallback pattern).
- CSS `box-shadow: 0 0 16px 4px rgba(r,g,b,0.30)` glow when `haloColor` is present — soft, brand-consistent.

### Integration points

**`SonaNav`** — server component already fetches the authenticated user. Gains `profiles.avatar_url` and `profiles.avatar_halo_color` in its query. Renders `UserAvatar` at 28px in the top-right alongside the sign-out button.

**Account page** — `AvatarUpload` sits at the top of the existing Profile section, above the full name and email fields.

**`MessageBubble` / `ChatInterface`** — `ChatInterface` fetches `avatar_url` and `avatar_halo_color` from `profiles` once on mount and passes them to `MessageBubble`. User message bubbles gain a 24px `UserAvatar` beside the bubble. No visual change when no avatar is set.

## Tech stack
- `react-image-crop` — crop UI
- HTML Canvas API — resize to 256×256 and dominant colour extraction (no additional library)
- Supabase Storage — direct browser upload via signed URL
- Next.js server action — profile update after upload

## What is not in scope
- Subscriber avatar stacks on portrait cards on the explore page
- Passing avatar URL as context to the AI/Claude API
- Server-side image processing (sharp)
- Animated halo / pulsing effects
