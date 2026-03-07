# Account Page Design

## Goal

Build out the Account page with full user profile management: name editing, email change, billing access, and account deletion.

## Auth Model

Magic link only — no passwords. Email change uses Supabase's built-in `updateUser({ email })` flow which sends a confirmation link to the new address.

## Sections

### 1. Profile

Two fields in a single form:

- **Full name** — text input (underline style, matching dashboard settings). Saves via Server Action → `UPDATE profiles SET full_name = $1 WHERE id = $2`. Redirect to `?saved=1` shows inline "Saved" confirmation.
- **Email** — read-only display of current email. Below it, a "Change email address" disclosure: clicking reveals a text input + submit button. Submits via client-side call to `supabase.auth.updateUser({ email: newEmail })`. On success, shows "Confirmation sent to [new email]" and collapses. This is client-side only (Supabase handles the confirmation flow).

### 2. Billing

Unchanged — `BillingPortalButton` shown only when `profiles.stripe_customer_id` is present.

### 3. Danger Zone

A section at the bottom with a thin coral-tinted border. "Delete account" button triggers an inline confirmation:

> "This will permanently delete your account and all data. Type DELETE to confirm."

Text input + "Delete my account" button (only enabled when input value === 'DELETE'). Server Action calls `supabase.auth.admin.deleteUser(user.id)` via admin client, then redirects to `/`.

## Architecture

- `account/page.tsx` — server component, fetches `profiles.full_name` in addition to existing data, passes to new client form components
- `account/actions.ts` — new file with two Server Actions: `updateProfile(formData)` and `deleteAccount()`
- `account/ProfileForm.tsx` — client component handling name save + email change UI
- `account/DeleteAccountButton.tsx` — client component handling inline confirmation flow

## Data

- `profiles.full_name` — already exists, updated via Server Action
- `auth.users.email` — read from `user.email`, changed via `supabase.auth.updateUser()`
- Account deletion — `supabase.auth.admin.deleteUser(user.id)` via admin client (bypasses RLS)

## Out of Scope

- Avatar/profile photo upload
- Notification preferences
- Connected accounts / OAuth
