# Sona Brand Guidelines

A practical reference for engineers building Sona features. Every decision here is extracted from the live codebase — not aspirational, but descriptive of what ships.

---

## 1. Brand Philosophy

Sona is a **companionship product**, not an access or knowledge-management tool. The emotional frame matters for every copy and design decision:

> Sona is the backdrop. The people are the product.
> White is not empty — it is pure potential.
> The coral mark is the only colour. It is heart energy.
> Every Sona is a jewel. We are the case that holds them.

This translates to extreme restraint in the UI. Sona never competes with the people it hosts. The interface should feel invisible — high-quality negative space that makes each portrait feel precious.

---

## 2. Color System

### Palette

| Token | Hex | Usage |
|---|---|---|
| Ink | `#1a1a1a` | Body text, headings, dark buttons, primary UI |
| Coral | `#DE3E7B` | The only brand colour. Accent only — checkmarks, active tab underlines, category dots, selection highlight |
| Muted | `#6b6b6b` | Secondary text, nav links (default state), taglines |
| Dim | `#b0b0b0` | Labels, meta, checklist descriptions, placeholder-level content |
| Ghost | `#c0c0c0` | Very muted — subscriber counts, optional indicators, disabled chevrons |
| White | `#ffffff` | Page background, card backgrounds |
| Near-white | `#fafafa` | Textarea and bordered input backgrounds |
| Dashboard bg | `#f7f7f7` | Dashboard sub-nav bar background |

### Border Values

```
Standard border:   1px solid rgba(0,0,0,0.07)   (cards, panels, lists)
Hover border:      1px solid rgba(0,0,0,0.14)   (.sona-card hover state)
Input border:      1px solid rgba(0,0,0,0.15)   (underline inputs, default)
Input focus:       1px solid #1a1a1a            (underline inputs, focus)
Textarea border:   1px solid rgba(0,0,0,0.08)   (bordered textareas)
Filter bar:        1px solid rgba(0,0,0,0.06)   (nav borders, section dividers)
```

### Semantic Colour Usage

**Coral is reserved for:**
- Active tab/filter underlines (`border-bottom: 2px solid #DE3E7B`)
- Completion checkmark circles (20–48px filled circle)
- Category dot indicators (5–6px filled circle)
- Text selection (`::selection` background)
- Unlock status text when unlocked

**Never use coral for:** body text, buttons, backgrounds, borders, error states, or decorative fills.

**Status colours (used sparingly, not brand colours):**
- Success/live: `#2a7c4f` text, `rgba(42,124,79,0.08)` background
- In review: `#b08850` text, `#fef9ef` background
- Error: `#1a7a5a` text, `rgba(26,122,90,0.07)` bg (settings save banner)

### CSS Theme Tokens

Defined in `globals.css` via `@theme inline`:

```css
--color-ink:    #1a1a1a
--color-white:  #ffffff
--color-coral:  #DE3E7B
--color-muted:  #6b6b6b
--color-border: rgba(0,0,0,0.08)
```

---

## 3. Typography

### Fonts

| Role | Variable | Family | Notes |
|---|---|---|---|
| Display | `var(--font-cormorant)` | Cormorant Garamond | Headlines, names, big numerals, italic always |
| Body / UI | `var(--font-geist-sans)` | Geist Sans | All UI text, labels, inputs, buttons |

Both are loaded via the `geist` npm package. In component files, always use the CSS variable shorthand:

```tsx
const CORMORANT = 'var(--font-cormorant)'
const GEIST = 'var(--font-geist-sans)'
```

### Cormorant (Display Font)

Cormorant is **always italic** in Sona. Never use it upright. It carries names, headings, and large numerals — anything that should feel human and editorial.

| Use | `fontSize` | `fontWeight` | Notes |
|---|---|---|---|
| Hero headline | `clamp(3.75rem, 7vw, 6.5rem)` | 400 | Landing page only |
| Page heading (large) | `clamp(2rem, 4vw, 2.75rem)` | 400 | /home, /explore |
| Page heading (dashboard) | `clamp(1.75rem, 3vw, 2.25rem)` or `clamp(1.75rem, 3vw, 2.5rem)` | 400 | Dashboard pages |
| Next-action banner title | `1.375rem` | 400 | Dark card context |
| Card heading / empty state | `1.375rem` | 400 | Home empty state cards |
| Sona name in card | `1.375rem` | 400 | SonaCard |
| Auth heading | `1.625rem` | 400 | Login/signup pages |
| Sent/done confirmation | `1.75rem` | 400 | Login sent state |
| Stats numeral | `2.5rem` | 400 | Dashboard subscriber/MRR |
| List item name (large) | `1.125rem` | 400 | Circle list, own Sona row |
| Sub-nav portrait name | `1rem` | 400 | DashboardSubNav |
| Avatar initial (fallback) | `1.875rem` (card) / `1.25rem` (list) | 400 | When no avatar |

All Cormorant uses share: `lineHeight: 1.0–1.25`, `letterSpacing: '-0.02em'` (or `-0.01em` for smaller sizes), `fontStyle: 'italic'`.

### Geist Sans (Body / UI Font)

Used for everything that is not a headline or name. Font weight carries hierarchy:

| Weight | Usage |
|---|---|
| 300 | Body copy, descriptions, taglines, input values, checklist descriptions |
| 400 | Default UI — nav links, standard label text, meta info |
| 500 | Section labels (uppercase), active states, CTA text, pill badges |

### Type Scale Reference

| Size | rem | px | Common use |
|---|---|---|---|
| `0.5625rem` | — | ~9px | Sub-nav status badge |
| `0.6875rem` | — | 11px | Section labels (UPPERCASE), ghost meta, optional tags |
| `0.75rem` | — | 12px | Checklist description text, stat labels, timestamp text |
| `0.8125rem` | — | 13px | Nav links, tagline text, filter tabs, sort options, secondary UI |
| `0.875rem` | — | 14px | Checklist step labels, body paragraphs in cards, button text |
| `0.9375rem` | — | 15px | Input field values, form text |
| `1rem` | — | 16px | Sub-nav portrait name, body copy (standard) |

### Section Label Pattern

Used consistently for section headers, form labels, and group headings:

```tsx
<p style={{
  fontFamily: GEIST,
  fontSize: '0.6875rem',
  fontWeight: 500,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: '#b0b0b0',
  margin: '0 0 16px',
}}>
  Your circle
</p>
```

---

## 4. Spacing & Layout

### Container Widths

| Context | `maxWidth` |
|---|---|
| Auth pages | `320px` |
| Dashboard content | `520px` (settings) / `680px` (overview) |
| Home / circle | `720px` |
| Dashboard shell | `1080px` |
| Explore / landing | `1200px` |

### Responsive Padding

Page-level horizontal padding uses `clamp`:

```
clamp(24px, 4vw, 48px)   — standard page padding
```

### Vertical Rhythm

These values appear consistently across the codebase:

```
Section spacing:    48px (major sections apart)
Card padding:       24px–32px
Row padding:        10px–16px (list rows, circle items)
Heading → content:  32px–40px (page heading margin-bottom)
Label → input:      10px (form field label margin-bottom)
Between fields:     32px (form gap)
Grid gap (cards):   12px–20px
```

### Breakpoint Philosophy

Sona uses mobile-first design with `clamp()` for fluid scaling rather than hard breakpoints. Grid columns use `auto-fill` with `minmax()`:

```tsx
// Portrait card grid
gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))'

// Home empty state cards
gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))'

// Dashboard stats
gridTemplateColumns: '1fr 1fr'
```

---

## 5. Component Patterns

### Critical: Tailwind v4 CSS Rule

**Tailwind v4 strips `color` and `border-*` from custom CSS class base rules.** Only `transition` reliably survives in class definitions. This is why all base-state visual properties use inline styles, and CSS utility classes only define `:hover` behaviour.

Pattern:
```tsx
// CORRECT — base state inline, hover via CSS class
<a
  className="sona-link"
  style={{ color: '#6b6b6b', textDecoration: 'none' }}
>
  Link text
</a>

// WRONG — base state in CSS class will be stripped by Tailwind v4
```

### CSS Utility Classes

All defined in `src/app/globals.css`. Each class **only handles transitions and hover states** — base styles must be inline.

```css
/* sona-link: muted → ink on hover */
.sona-link { transition: color 0.15s ease; }
.sona-link:hover { color: #1a1a1a !important; }

/* sona-btn-dark: ink pill → opacity 0.78 on hover */
.sona-btn-dark { transition: opacity 0.15s ease; }
.sona-btn-dark:hover { opacity: 0.78; }

/* sona-btn-outline: transparent pill → subtle fill on hover */
.sona-btn-outline { transition: background-color 0.15s ease; }
.sona-btn-outline:hover { background-color: rgba(0,0,0,0.05); }

/* sona-arrow-link: fades to 0.6 opacity on hover */
.sona-arrow-link { transition: opacity 0.15s ease; }
.sona-arrow-link:hover { opacity: 0.6; }

/* sona-filter-tab: ink text + grey underline on hover */
.sona-filter-tab { transition: color 0.15s ease, border-color 0.15s ease; }
.sona-filter-tab:hover { color: #1a1a1a !important; border-bottom: 2px solid rgba(0,0,0,0.12) !important; }

/* sona-input: underline darkens to ink on focus */
.sona-input { transition: border-color 0.15s ease; }
.sona-input:focus { border-bottom-color: #1a1a1a !important; }

/* sona-row-hover: subtle fill on hover (dashboard rows) */
.sona-row-hover { transition: background-color 0.15s ease; }
.sona-row-hover:hover { background-color: rgba(0,0,0,0.03); }

/* sona-card: border darkens + shadow on hover (portrait cards) */
.sona-card { transition: border-color 0.2s ease, box-shadow 0.2s ease; }
.sona-card:hover { border-color: rgba(0,0,0,0.14) !important; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
```

### Page Heading

```tsx
<h1 style={{
  fontFamily: 'var(--font-cormorant)',
  fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
  fontWeight: 400,
  fontStyle: 'italic',
  lineHeight: 1.1,
  letterSpacing: '-0.02em',
  color: '#1a1a1a',
  margin: '0 0 40px',
}}>
  Settings
</h1>
```

### Dark Pill Button (Primary CTA)

```tsx
<button
  type="submit"
  className="sona-btn-dark"
  style={{
    fontFamily: 'var(--font-geist-sans)',
    fontSize: '0.9375rem',
    fontWeight: 500,
    letterSpacing: '-0.01em',
    padding: '12px 32px',
    borderRadius: '980px',
    background: '#1a1a1a',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
  }}
>
  Save changes
</button>
```

Nav-size variant (smaller):
```tsx
style={{
  fontSize: '0.875rem',
  padding: '8px 20px',
  borderRadius: '980px',
  background: '#1a1a1a',
  color: '#fff',
}}
```

### Outline Pill Button (Secondary CTA)

```tsx
<Link
  href="/sona/slug"
  className="sona-btn-outline"
  style={{
    fontFamily: 'var(--font-geist-sans)',
    fontSize: '0.8125rem',
    fontWeight: 400,
    color: '#6b6b6b',
    textDecoration: 'none',
    padding: '7px 16px',
    borderRadius: '980px',
    border: '1px solid rgba(0,0,0,0.08)',
  }}
>
  View
</Link>
```

### Bordered Card

```tsx
<div style={{
  backgroundColor: '#fff',
  border: '1px solid rgba(0,0,0,0.07)',
  borderRadius: 16,
  padding: '24px',
}}>
  {/* content */}
</div>
```

For clickable cards, add the `sona-card` class:
```tsx
<Link className="sona-card" style={{ border: '1px solid rgba(0,0,0,0.07)', borderRadius: 16, ... }}>
```

Note: `.sona-card` only handles hover — `border` and `borderRadius` must remain inline.

### Underline Input

```tsx
<input
  className="sona-input"
  style={{
    fontFamily: 'var(--font-geist-sans)',
    fontSize: '0.9375rem',
    fontWeight: 300,
    color: '#1a1a1a',
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid rgba(0,0,0,0.15)',
    padding: '8px 0',
    outline: 'none',
    boxSizing: 'border-box',
  }}
/>
```

### Bordered Textarea

```tsx
<textarea
  style={{
    fontFamily: 'var(--font-geist-sans)',
    fontSize: '0.9375rem',
    fontWeight: 300,
    color: '#1a1a1a',
    lineHeight: 1.7,
    width: '100%',
    background: '#fafafa',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: 12,
    padding: '14px 16px',
    outline: 'none',
    resize: 'none',
    boxSizing: 'border-box',
  }}
/>
```

### Chevron Select

```tsx
<select
  className="sona-input"
  style={{
    fontFamily: 'var(--font-geist-sans)',
    fontSize: '0.9375rem',
    fontWeight: 300,
    color: '#1a1a1a',
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid rgba(0,0,0,0.15)',
    padding: '8px 0',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23b0b0b0' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 4px center',
    paddingRight: 24,
  }}
/>
```

### Form Field (Label + Input)

```tsx
<div>
  <label style={{
    fontFamily: 'var(--font-geist-sans)',
    fontSize: '0.6875rem',
    fontWeight: 500,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: '#b0b0b0',
    display: 'block',
    marginBottom: 10,
  }}>
    Tagline
  </label>
  <input className="sona-input" style={{ /* underline input styles */ }} />
</div>
```

### Coral Checkmark (Completion State)

Used for done/sent states — login success, setup step complete, etc.

```tsx
<div style={{
  width: 48,
  height: 48,
  borderRadius: '50%',
  backgroundColor: '#DE3E7B',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto 20px',
}}>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13l4 4L19 7" />
  </svg>
</div>
```

Smaller variant (20px circle for checklist rows):
```tsx
<div style={{
  width: 20,
  height: 20,
  borderRadius: '50%',
  backgroundColor: '#DE3E7B',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}}>
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13l4 4L19 7" />
  </svg>
</div>
```

### Coral Mark (Decorative Gradient Circle)

Used on the landing page hero and in empty states. The gradient fades to transparent at the edge — never a flat fill.

```tsx
<svg width="120" height="120" viewBox="0 0 72 72" fill="none" aria-hidden>
  <circle cx="36" cy="36" r="36" fill="url(#sonaGrad)" />
  <defs>
    <radialGradient id="sonaGrad" cx="0" cy="0" r="1"
      gradientUnits="userSpaceOnUse"
      gradientTransform="translate(36 36) rotate(90) scale(36)">
      <stop stopColor="#DE3E7B" />
      <stop offset="0.495" stopColor="#DE3E7B" />
      <stop offset="1" stopColor="#DE3E7B" stopOpacity="0" />
    </radialGradient>
  </defs>
</svg>
```

Empty state variant (smaller, more faded):
```tsx
<circle cx="36" cy="36" r="36" fill="url(#grad)" opacity="0.25" />
```

### Category Dot

The 5px coral dot used in SonaCard footers and unlock lists:

```tsx
<span style={{
  width: 5,
  height: 5,
  borderRadius: '50%',
  backgroundColor: '#DE3E7B',
  display: 'inline-block',
  flexShrink: 0,
}} />
```

### Status Badge (Pill)

```tsx
// Live (green)
<span style={{
  fontFamily: 'var(--font-geist-sans)',
  fontSize: '0.5625rem',
  fontWeight: 500,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: '#2a7c4f',
  backgroundColor: 'rgba(42,124,79,0.08)',
  padding: '2px 7px',
  borderRadius: '980px',
}}>
  Live
</span>

// Draft / In Review (warm amber)
<span style={{
  color: '#b08850',
  backgroundColor: '#fef9ef',
  padding: '4px 10px',
  borderRadius: '980px',
  fontSize: '0.6875rem',
  fontWeight: 500,
  letterSpacing: '0.05em',
}}>
  In review
</span>
```

### Navigation (SonaNav)

Sticky, 56px tall, frosted glass effect:

```tsx
<nav style={{
  position: 'sticky',
  top: 0,
  zIndex: 50,
  backgroundColor: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderBottom: '1px solid rgba(0,0,0,0.06)',
  padding: '0 clamp(24px, 4vw, 48px)',
  height: 56,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}}>
```

Nav links use Geist 400 at `0.875rem`, `#6b6b6b`, with `sona-link` class. The primary CTA ("Get started") uses the dark pill button pattern.

### Dashboard Sub-Nav

Background `#f7f7f7`, 44px tall, `borderBottom: '1px solid rgba(0,0,0,0.07)'`. Active tab gets `rgba(0,0,0,0.07)` background fill and `fontWeight: 500`.

### Filter Bar (Explore)

Sticky below nav (`top: 56`), frosted: `rgba(255,255,255,0.92)` + `blur(12px)`. Active tab: `borderBottom: '2px solid #DE3E7B'`, `fontWeight: 500`, `color: #1a1a1a`. Inactive tabs use `sona-filter-tab` class.

---

## 6. Auth Pages

Auth pages (login, signup) are standalone — no nav, no layout chrome. They center a 320px-wide form vertically in the viewport.

```tsx
<div style={{
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#fff',
  padding: '0 24px',
}}>
  <div style={{ width: '100%', maxWidth: 320 }}>
    {/* Logo → Heading → Form → Footer link */}
  </div>
</div>
```

Structure inside the 320px container:
1. Logo: `Sona brand on white bg 1.svg` at `width={100} height={38}`, centered, `marginBottom: 40`
2. Heading: Cormorant italic, `1.625rem`, centered, `margin: '0 0 32px'`
3. Form inputs: underline style with `sona-input` class
4. Submit button: dark pill, full width
5. Footer: small Geist text with a link to signup/login

---

## 7. Logo Usage

### Assets

Located in `/public/brand_assets/sona/`:

| File | Background | Usage |
|---|---|---|
| `Sona brand on white bg 1.svg` | White | Primary — nav, auth pages, any white surface |
| `Sona brand on black bg 1.svg` | Black | Dark backgrounds (e.g., dark banner) |
| `Sona brand on black bg.svg` | Black | Alternative black variant |
| `Sona brand - on white bg.svg` | White | Alternative white variant |

### Sizing

| Context | Width | Height |
|---|---|---|
| Auth pages | 100 | 38 |
| Navigation (SonaNav, LandingPage) | 88 | 33 |

Always use `next/image` `<Image>` component with the `priority` prop on above-the-fold instances.

### Rules

- Never recolour the logo
- Never place the white-bg logo on a dark or coloured surface — use the black-bg variant
- Maintain the SVG's aspect ratio — never stretch
- The logo should link to `/` in all nav contexts

---

## 8. Iconography

Sona uses inline SVG icons only — no icon library dependency. Icons are always minimal, single-stroke:

```tsx
// Right arrow (navigation affordance)
<span style={{ color: 'rgba(0,0,0,0.18)', fontSize: '0.875rem' }}>→</span>

// External link
<span aria-hidden>↗</span>

// Chevron right (list row)
<svg width="16" height="16" viewBox="0 0 16 16" fill="none"
  stroke="#c0c0c0" strokeWidth="1.5" strokeLinecap="round">
  <path d="M6 3l5 5-5 5" />
</svg>

// Chevron down (select arrow — via SVG data URI)
// See Chevron Select pattern above

// Checkmark
<svg width="10" height="10" viewBox="0 0 24 24" fill="none"
  stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
  <path d="M5 13l4 4L19 7" />
</svg>
```

---

## 9. Motion & Animation

All transitions are `0.15s ease` (fast, responsive) or `0.2s ease` (cards, slightly more weighted). There is no slow or decorative animation — Sona is not playful, it is precise.

```
Interactive elements:  0.15s ease
Card hover:            0.2s ease
```

The only keyframe animation defined is the chat streaming indicator:

```css
@keyframes bounce {
  0%, 100% { transform: translateY(0); opacity: 0.4; }
  50%       { transform: translateY(-4px); opacity: 1; }
}
```

---

## 10. Voice & Tone

### Product Positioning

Sona is a companionship product. Not AI, not a chatbot, not an archive. People subscribe to Sonas the way they might follow a mentor, not the way they search a knowledge base. Copy should reflect this.

### Three Interaction Modes

1. One-on-one chat
2. One-on-one voice
3. Invite a Sona into a conversation with others

These are the primary use cases. Copy should make these feel intimate, not technical.

### Approved Headlines

Use these verbatim where applicable. Do not rephrase them:

| Context | Copy |
|---|---|
| Hero | "Know them. Be known." |
| Feature | "The right mind in the room — whenever you need it." |
| Subscriber value | "Their wisdom, present in your life." |
| Creator value | "Your whole self, present when it matters." |
| Closing / empty state (creator) | "Be present. Even when you can't be." |

### Tone Principles

**Precise, not verbose.** Every word earns its place. "A sign-in link has been sent to [email]" — not "We've sent you a magic link, please check your inbox!"

**Editorial, not chatty.** The display font (Cormorant italic) carries authority. Copy should match — short declarative sentences, no exclamation marks, no emoji.

**Human, not clinical.** "Your circle" not "Your subscriptions." "Schedule your interview" not "Complete onboarding step 2." "Remarkable people. Add them to your circle." — not "Browse available AI assistants."

**Understated confidence.** Do not over-explain what Sona is. The product makes the case. Error messages are factual, not apologetic.

### Microcopy Patterns

```
Navigation:    "Discover" · "My Circle" · "Dashboard" · "Account"
Button CTAs:   "Get started" · "Create your Sona" · "Discover Sonas" · "Schedule now" · "Add content"
Status text:   "Live" · "In review" · "Draft"
Empty states:  Cormorant italic heading + short Geist body + single CTA
Success:       Coral checkmark → Cormorant heading → Geist body (no exclamation)
```

---

## 11. Do's and Don'ts

### Colors

| Do | Don't |
|---|---|
| Use coral only for accent: checkmarks, active indicators, category dots | Use coral for buttons, backgrounds, body text, or borders |
| Use `#1a1a1a` for primary text and dark buttons | Use near-black values that aren't `#1a1a1a` (creates visual noise) |
| Use `rgba(0,0,0,0.07)` for standard card borders | Use solid grey (`#e5e5e5`) for borders — it looks heavier and less refined |
| Keep pages white (`#ffffff`) | Add coloured backgrounds, gradients, or tinted surfaces |

### Typography

| Do | Don't |
|---|---|
| Use Cormorant italic for all display text | Use Cormorant upright — always italic |
| Match the type scale values exactly | Introduce new font sizes that break the scale |
| Use `fontWeight: 300` for body/descriptions | Use `fontWeight: 400` for body text — it reads too heavy against the restrained palette |
| Use `letterSpacing: '-0.02em'` on Cormorant headings | Add positive letter-spacing to display text |
| Use `0.09em` letter-spacing on uppercase section labels | Use `em` tracking less than `0.05em` for uppercase labels |

### Components

| Do | Don't |
|---|---|
| Put base-state visual properties in inline styles | Rely on CSS classes for base-state color or border (Tailwind v4 strips them) |
| Use `borderRadius: '980px'` for pill shapes | Use `borderRadius: '9999px'` or `rounded-full` — keep values consistent |
| Add `sona-btn-dark` class alongside inline button styles | Forget the class — without it, hover opacity won't work |
| Keep card `borderRadius` at 14–18px | Mix border-radius values arbitrarily — consistency matters |

### Content & Copy

| Do | Don't |
|---|---|
| Use the approved headlines verbatim | Rephrase approved copy or add marketing superlatives |
| Use "Sona" (capitalised) for the product and for individual portraits | Use "AI", "bot", "assistant", or "digital twin" |
| Write placeholder text that feels human: "What you're known for, in one line" | Write generic placeholders: "Enter tagline here" |
| Use sentence case for most UI text | Use title case for navigation or buttons |

---

## 12. File Locations

| Asset | Path |
|---|---|
| Global CSS (utility classes + tokens) | `src/app/globals.css` |
| Logo assets | `public/brand_assets/sona/` |
| SonaNav (platform nav) | `src/components/sona/SonaNav.tsx` |
| DashboardSubNav | `src/app/(sona)/dashboard/DashboardSubNav.tsx` |
| SonaCard | `src/components/sona/SonaCard.tsx` |
| LandingPage | `src/components/sona/LandingPage.tsx` |
| Login form | `src/app/(shared)/login/LoginForm.tsx` |
| Dashboard overview | `src/app/(sona)/dashboard/page.tsx` |
| Settings page | `src/app/(sona)/dashboard/settings/page.tsx` |
| Explore page | `src/app/(sona)/(platform)/explore/page.tsx` |

---

*Guidelines version: March 2026. Derived from the live codebase — update this document when component patterns change.*
