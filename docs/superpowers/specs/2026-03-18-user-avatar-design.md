# User Avatar Implementation Design

## Goal
Allow account holders to upload a profile avatar that appears in the nav, account page, chat interface, and explore/discovery section, with a CSS glow halo derived from the image's dominant colour.

## Architecture

### Dependencies
- Add `react-image-crop` to `package.json` (`npm install react-image-crop`). The package ships its own TypeScript types — no separate `@types/` package needed.

### Data layer
- New migration (`00023_user_avatar.sql`) adds `avatar_url TEXT` and `avatar_halo_color TEXT` to `profiles`.
- The same migration creates a public Supabase Storage bucket `avatars` via `INSERT INTO storage.buckets`, adds storage RLS policies, and grants SELECT on storage objects to `anon` and `authenticated`.
- Storage RLS: authenticated users may INSERT/UPDATE only to their own `{user_id}/` path; reads are public.
- Storage path per user: `{user_id}/avatar.png` — overwrite on re-upload, no housekeeping.
- After the migration runs, regenerate `src/lib/supabase/types.ts` via `supabase gen types typescript` so the new `profiles` columns are type-safe.

### API route: `GET /api/profile/avatar-upload-url`
Returns a signed Supabase upload URL for the authenticated user's avatar path.

Uses `createAdminClient()` (matching the existing pattern in `/api/creator/ingest/route.ts`) — the admin client is required because `createSignedUploadUrl` needs INSERT privilege which the anon-key client does not have unless complex storage grants are added. The route calls `auth.getUser()` first to obtain `user.id`, constructs the path `{user_id}/avatar.png`, then calls `admin.storage.from('avatars').createSignedUploadUrl(path)`.

After the direct browser-to-storage upload completes, a server action updates `profiles.avatar_url` and `profiles.avatar_halo_color`.

### Upload component: `AvatarUpload`
Location: `src/components/account/AvatarUpload.tsx`

Props: `currentAvatarUrl?: string`, `currentHaloColor?: string`

Flow:
1. Circular avatar display (or Cormorant italic initial fallback) with a "change photo" overlay on hover opens a native file picker.
2. Selected image opens a crop modal using `react-image-crop` with a locked 1:1 aspect ratio.
3. On confirm, a canvas draws the cropped region resized to 256×256 and exports as PNG blob.
4. Dominant colour is extracted from the canvas by sampling a 10×10 grid of pixels across the image. Near-white (R, G, B all > 230) and near-black (R, G, B all < 25) pixels are skipped. The most saturated remaining pixel colour is selected. Result stored as a hex string (e.g. `#e87b4a`).
5. PNG blob is uploaded directly to Supabase Storage via the signed URL from the API route.
6. Server action `updateAvatar(avatarUrl, haloColor)` patches `profiles.avatar_url` and `profiles.avatar_halo_color`; UI updates optimistically.

Self-contained — no parent coordination beyond the two initial props.

### Display component: `UserAvatar`
Location: `src/components/account/UserAvatar.tsx`

Props: `avatarUrl?: string`, `haloColor?: string`, `name: string`, `size: number` (pixels)

Renders a plain `<img>` (not `next/image` — no `remotePatterns` config exists and adding it is out of scope) with `object-fit: cover` and `border-radius: 50%`. When `haloColor` is present, applies:
```css
box-shadow: 0 0 16px 4px rgba(r, g, b, 0.30);
```
Falls back to a Cormorant italic initial on a light grey circle when no `avatarUrl` is set.

### Integration points

**`SonaNav`** — server component. Widen the `profiles` SELECT to include `avatar_url, avatar_halo_color`. Render `UserAvatar` at 28px in the top-right alongside the sign-out button.

**Account page** — `src/app/(sona)/(platform)/account/page.tsx`. Widen the `profiles` SELECT to include `avatar_url, avatar_halo_color`. Render `AvatarUpload` at the top of the Profile section, above the full name and email fields.

**`MessageBubble` / `ChatInterface`**:
- `ChatInterface` does not have access to user profile data. Follow the existing prop-passing pattern (same as `existingRating`): the parent server page fetches `avatar_url` and `avatar_halo_color` from `profiles` and passes them as props to `ChatInterface`.
- Add `userAvatarUrl?: string` and `userHaloColor?: string` to `ChatInterfaceProps`.
- `ChatInterface` passes these down to `MessageBubble`.
- Add `userAvatarUrl?: string` and `userHaloColor?: string` to `MessageBubbleProps`.
- User message bubbles render a 24px `UserAvatar` beside the bubble. No visual change when props are absent.

## Tech stack
- `react-image-crop` — crop UI
- HTML Canvas API — resize to 256×256 and dominant colour extraction (no additional library)
- Supabase Storage — direct browser upload via signed URL (admin client for signing)
- Next.js server action — profile update after upload

## What is not in scope
- Subscriber avatar stacks on portrait cards on the explore page
- Passing avatar URL as context to the AI/Claude API
- Server-side image processing (sharp)
- Animated halo / pulsing effects
- `next/image` optimisation for avatar display
